#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is required" >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <owner>" >&2
  exit 1
fi

owner="$1"

curl -fsSL \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/users/${owner}" \
| jq -r '.type'
