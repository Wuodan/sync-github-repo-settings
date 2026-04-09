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
dependabot_repo_profiles_json="$(
  yq -o=json '.dependabot.repos // {}' "${OWNER_CONFIG_FILE}"
)"

echo "Ignored repositories:" >&2
echo "${ignored_repos_json}" >&2
echo "Dependabot profiles:" >&2
echo "${dependabot_profiles_json}" >&2
echo "Dependabot repo assignments:" >&2
echo "${dependabot_repo_profiles_json}" >&2
echo "Repository filter regex: ${REPO_FILTER:-<none>}" >&2

page=1
printf '%s\n' 'repos:' > generated/generated-repos.yml

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
    --argjson dependabot_profiles "${dependabot_profiles_json}" \
    --argjson dependabot_repo_profiles "${dependabot_repo_profiles_json}" \
    --arg repo_filter "${REPO_FILTER:-}" \
    '
    # Apply explicit ignore and optional regex filters.
    .[]
    | . as $repo
    | select(($ignored | index($repo.full_name)) | not)
    | select(
        ($repo_filter == "")
        or (.full_name | test($repo_filter))
        or (.name | test($repo_filter))
      )
    # Forks remain in scope for general repo settings, but Dependabot stays off for them.
    | ((.fork | not) and (($dependabot_repo_profiles[.name] // "") != "")) as $should_sync_dependabot
    # Resolve the configured profile name to the actual dependabot.yml path.
    | ($dependabot_repo_profiles[.name] // "") as $dependabot_profile
    | ($dependabot_profiles[$dependabot_profile] // "") as $dependabot_yml
    # Emit one repos.yml entry, with optional per-repo Dependabot overrides.
    | "  - repo: " + .full_name
      + (
          if .fork then
            "\n    dependabot-alerts: false"
            + "\n    dependabot-security-updates: false"
          else
            ""
          end
        )
      + (
          if ($should_sync_dependabot and ($dependabot_yml != "")) then
            "\n    dependabot-yml: " + $dependabot_yml
          else
            ""
          end
        )
    ' <<< "${page_repos_json}" >> generated/generated-repos.yml

  if (( page_repos_count < per_page )); then
    break
  fi

  page=$((page + 1))
done

echo "Generated repository list:" >&2
cat generated/generated-repos.yml >&2
