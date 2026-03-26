#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is required" >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <owners-dir>" >&2
  exit 1
fi

owners_dir="$1"

if [[ ! -d "${owners_dir}" ]]; then
  echo "Owners directory not found: ${owners_dir}" >&2
  exit 1
fi

# Discover owner config files, look up each owner type via the GitHub API,
# emit one JSON object per owner, then wrap the stream into {include:[...]}
# for use as a GitHub Actions matrix.
while IFS= read -r owner_config_file; do
  owner="$(basename "${owner_config_file}" .yml)"
  owner_type="$(
    # /users/{name} works for both user and organization accounts and returns
    # a .type field we normalize to the matrix values used later by the workflow.
    curl -fsSL \
      -H "Authorization: Bearer ${GH_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/users/${owner}" \
    | jq -r '
        if .type == "User" then
          "user"
        elif .type == "Organization" then
          "org"
        else
          error("Unsupported owner type: \(.type)")
        end
      '
  )"

  # Emit one matrix entry as JSON. jq -s below collects all emitted objects.
  jq -n \
    --arg owner "${owner}" \
    --arg owner_type "${owner_type}" \
    --arg owner_config_file "${owner_config_file}" \
    '{
      owner: $owner,
      owner_type: $owner_type,
      owner_config_file: $owner_config_file
    }'
done < <(find "${owners_dir}" -maxdepth 1 -type f -name '*.yml' | sort) \
| jq -s '{include: .}'
