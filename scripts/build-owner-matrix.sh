#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <owners-dir> [owner-filter-regex]" >&2
  exit 1
fi

owners_dir="$1"
owner_filter="${2:-}"

if [[ ! -d "${owners_dir}" ]]; then
  echo "Owners directory not found: ${owners_dir}" >&2
  exit 1
fi

while IFS= read -r owner_config_file; do
  owner="$(basename "${owner_config_file}" .yml)"

  if [[ -n "${owner_filter}" && ! "${owner}" =~ ${owner_filter} ]]; then
    continue
  fi

  jq -n \
    --arg owner_config_file "${owner_config_file}" \
    '{
      owner_config_file: $owner_config_file
    }'
done < <(find "${owners_dir}" -maxdepth 1 -type f -name '*.yml' | sort) \
| jq -cs '{include: .}'
