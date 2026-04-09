#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: close-dependabot-prs-for-forks.sh --owner OWNER [--apply] [--comment TEXT]

Closes open Dependabot pull requests in fork repositories owned by OWNER.

Options:
  --owner OWNER    GitHub user or organization to scan
  --apply          Actually close PRs; default is dry-run
  --comment TEXT   Comment to add when closing a PR
  --help           Show this help
EOF
}

owner=""
apply=0
comment="Closing because Dependabot is disabled for fork repositories."

while (( $# > 0 )); do
  case "$1" in
    --owner)
      owner="${2:-}"
      shift 2
      ;;
    --apply)
      apply=1
      shift
      ;;
    --comment)
      comment="${2:-}"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${owner}" ]]; then
  echo "--owner is required" >&2
  usage
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required" >&2
  exit 1
fi

echo "Mode: $([[ ${apply} -eq 1 ]] && echo apply || echo dry-run)" >&2
echo "Owner: ${owner}" >&2

fork_repos="$(
  gh repo list "${owner}" --limit 1000 --json nameWithOwner,isFork,isArchived \
    --jq 'sort_by(.nameWithOwner)[] | select(.isFork) | [.nameWithOwner, .isArchived] | @tsv'
)"

if [[ -z "${fork_repos}" ]]; then
  echo "No fork repositories found for ${owner}" >&2
  exit 0
fi

closed_count=0
matched_count=0
skipped_archived_count=0

while IFS=$'\t' read -r repo is_archived; do
  [[ -n "${repo}" ]] || continue

  repo_matches="$(
    gh pr list -R "${repo}" --state open --limit 100 --json number,url,title,author,createdAt,updatedAt \
      --jq '.[]
        | select(.author.login == "dependabot[bot]" or .author.login == "app/dependabot")
        | [.number, .url, .title, .createdAt, .updatedAt]
        | @tsv'
  )"

  if [[ "${is_archived}" == "true" ]]; then
    echo "Fork: ${repo} [archived]"
  else
    echo "Fork: ${repo}"
  fi

  if [[ -z "${repo_matches}" ]]; then
    continue
  fi

  while IFS=$'\t' read -r pr_number pr_url pr_title pr_created_at pr_updated_at; do
    [[ -n "${pr_number}" ]] || continue
    matched_count=$((matched_count + 1))
    echo "  - PR by dependabot: ${pr_url} (${pr_title}) [created: ${pr_created_at}, updated: ${pr_updated_at}]"

    if (( apply )); then
      if [[ "${is_archived}" == "true" ]]; then
        skipped_archived_count=$((skipped_archived_count + 1))
        echo "Skipping ${pr_url}: archived repositories are read-only" >&2
        continue
      fi

      gh pr close -R "${repo}" "${pr_number}" --comment "${comment}" >/dev/null
      closed_count=$((closed_count + 1))
      echo "Closed ${pr_url}" >&2
    fi
  done <<< "${repo_matches}"
done <<< "${fork_repos}"

if (( apply )); then
  echo "Closed ${closed_count} Dependabot PR(s) across fork repositories for ${owner}"
  if (( skipped_archived_count > 0 )); then
    echo "Skipped ${skipped_archived_count} Dependabot PR(s) in archived fork repositories for ${owner}"
  fi
else
  echo "Would close ${matched_count} Dependabot PR(s) across fork repositories for ${owner}"
fi
