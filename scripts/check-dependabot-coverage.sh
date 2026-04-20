#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is required" >&2
  exit 1
fi

if [[ -z "${OWNER:-}" ]]; then
  echo "OWNER is required" >&2
  exit 1
fi

if [[ -z "${OWNER_TYPE:-}" ]]; then
  echo "OWNER_TYPE is required" >&2
  exit 1
fi

if [[ -z "${OWNER_CONFIG_FILE:-}" ]]; then
  echo "OWNER_CONFIG_FILE is required" >&2
  exit 1
fi

if ! command -v yq >/dev/null 2>&1; then
  echo "yq is required" >&2
  exit 1
fi

per_page=100
api_path="/users/${OWNER}/repos?per_page=${per_page}&type=owner"
if [[ "${OWNER_TYPE}" == "org" ]]; then
  api_path="/orgs/${OWNER}/repos?per_page=${per_page}&type=all"
fi

ignored_repos_json="$(
  yq -o=json '.ignore_repos // []' "${OWNER_CONFIG_FILE}"
)"
dependabot_profiles_json="$(
  yq -o=json '.dependabot.profiles // {}' "${OWNER_CONFIG_FILE}"
)"
configured_dependabot_repos_json="$(
  yq -o=json '.dependabot.repos // {} | keys' "${OWNER_CONFIG_FILE}"
)"
invalid_profile_assignments_json="$(
  yq -o=json '
    .dependabot as $dependabot
    | ($dependabot.profiles // {}) as $profiles
    | ($dependabot.repos // {})
    | to_entries
    | map(
        select(
          (.value // "") != ""
          and ($profiles[.value] == null)
        )
      )
  ' "${OWNER_CONFIG_FILE}"
)"

invalid_profile_assignments_count="$(jq 'length' <<< "${invalid_profile_assignments_json}")"
if (( invalid_profile_assignments_count > 0 )); then
  echo "Repos with undefined Dependabot profiles in ${OWNER_CONFIG_FILE}:" >&2
  jq -r '.[] | "  - \(.key): \(.value)"' <<< "${invalid_profile_assignments_json}" >&2
  echo "Defined Dependabot profiles:" >&2
  jq -r 'keys[]' <<< "${dependabot_profiles_json}" | sed 's/^/  - /' >&2
  exit 1
fi

page=1
missing_repos_file="$(mktemp)"
trap 'rm -f "${missing_repos_file}"' EXIT

while true; do
  page_repos_json="$(
    curl -fsSL \
      -H "Authorization: Bearer ${GH_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com${api_path}&page=${page}"
  )"

  page_repos_count="$(jq 'length' <<< "${page_repos_json}")"

  jq -r \
      --argjson ignored "${ignored_repos_json}" \
      --argjson configured "${configured_dependabot_repos_json}" \
      '
      .[]
      | . as $repo
      | select(.archived | not)
      | select(.fork | not)
      | select(($ignored | index($repo.full_name)) | not)
      | select(($configured | index($repo.name)) | not)
      | .full_name
      ' <<< "${page_repos_json}" >> "${missing_repos_file}"

  if (( page_repos_count < per_page )); then
    break
  fi

  page=$((page + 1))
done

if [[ -s "${missing_repos_file}" ]]; then
  echo "Repos missing Dependabot profile assignment in ${OWNER_CONFIG_FILE}:" >&2
  sort "${missing_repos_file}" >&2
  exit 1
fi

echo "Dependabot coverage complete for ${OWNER}" >&2
