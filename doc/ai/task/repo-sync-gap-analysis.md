# Repo Sync Gap Analysis

This analysis compares the desired repository standard from
[`doc/ai/task/Task_RepoSync-Analysis.md`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/doc/ai/task/Task_RepoSync-Analysis.md)
with:

- this repo's workflow configuration in
  [`.github/workflows/sync-github-repo-settings.yml`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/.github/workflows/sync-github-repo-settings.yml)
- this repo's owner rules configuration in
  [`config/owners`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners)
- the local fork of the action in
  [`../bulk-github-repo-settings-sync-action/action.yml`](/home/stefan/development/github/Wuodan/bulk-github-repo-settings-sync-action/action.yml)
  and
  [`../bulk-github-repo-settings-sync-action/src/index.js`](/home/stefan/development/github/Wuodan/bulk-github-repo-settings-sync-action/src/index.js)

## Current Workflow Coverage

The workflow currently configures only these security-related action inputs:

- `immutable-releases: true`
- `code-scanning: true`
- `secret-scanning: true`
- `secret-scanning-push-protection: true`
- `dependabot-alerts: true`
- `dependabot-security-updates: true`
- per-repo `dependabot-yml`

Source:
[`.github/workflows/sync-github-repo-settings.yml`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/.github/workflows/sync-github-repo-settings.yml)

The local action fork supports exactly those security toggles and does not expose inputs for the other settings listed below.

## Gap Classification

### Supported today and already configured

- Dependency graph: effectively covered when `dependabot-alerts` is enabled.
- Dependabot alerts: covered.
- Dependabot security updates: covered.
- Grouped security updates: covered only where the synced `dependabot.yml` defines `groups`.
- Dependabot version updates: covered only where a repo gets a synced `dependabot.yml`.
- CodeQL analysis default setup: covered by `code-scanning: true`.
- Secret protection: covered by `secret-scanning: true`.
- Push protection: covered by `secret-scanning-push-protection: true`.
- Immutable releases: covered.

### Repo configuration gaps

- `config/owners/Wuodan.yml` references a missing Dependabot profile name.
  Source:
  [`config/owners/Wuodan.yml:17`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/Wuodan.yml:17)
  The repo `ensure-immutable-actions-test` is assigned `npm-actions`, but
  `npm-actions` is not defined in `Wuodan.yml` under
  `dependabot.profiles`.
  Result: the repository passes the coverage check because the repo name is
  listed, but no valid profile exists to resolve.

- The current Dependabot coverage check only verifies that each non-fork, non-archived repo has a key under `dependabot.repos`.
  The current Dependabot coverage check only verifies that each non-fork,
  non-archived repo has a key under `dependabot.repos`.
  Source:
  [`scripts/check-dependabot-coverage.sh:54`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/scripts/check-dependabot-coverage.sh:54)
  through
  [`scripts/check-dependabot-coverage.sh:61`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/scripts/check-dependabot-coverage.sh:61)
  It does not validate that the assigned profile name exists in `dependabot.profiles`.

### Unsupported by the current action

- Private vulnerability reporting
- Automatic dependency submission
- Dependabot rules
- Dependabot malware alerts
- Prevent direct alert dismissals for Dependabot alerts
- Copilot Autofix
- Prevent direct alert dismissals for code scanning alerts
- Protection rules check runs failure threshold
- Code quality page settings

Reason: the local action fork does not expose inputs or implementation for these settings in
[`action.yml`](/home/stefan/development/github/Wuodan/bulk-github-repo-settings-sync-action/action.yml),
and the security handling code in
[`src/index.js:1268`](/home/stefan/development/github/Wuodan/bulk-github-repo-settings-sync-action/src/index.js:1268)
through
[`src/index.js:1700`](/home/stefan/development/github/Wuodan/bulk-github-repo-settings-sync-action/src/index.js:1700)
only manages CodeQL default setup, immutable releases, secret scanning, push
protection, Dependabot alerts, and Dependabot security updates.

## Interpretation Of The Example Repo Gap

For `Wuodan/ensure-immutable-actions-test-custom-actions`, the observed differences line up with action support:

- Private vulnerability reporting is disabled because the action cannot sync it.
- Automatic dependency submission is disabled because the action cannot sync it.
- Dependabot malware alerts are disabled because the action cannot sync them.
- Code quality is absent because the action cannot sync those settings.
- Grouped security updates and version updates are plausibly correct because
  the repo is assigned the `actions-only` profile, which defines grouped GitHub
  Actions updates in
  [`config/dependabot/actions-only.yml`](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/dependabot/actions-only.yml).

## Recommended Next Changes In This Repo

1. Exclude forks in the owner rules by using `all: true` plus `fork: false`.
2. Add profile validation so `dependabot.repos.<repo>` must either be empty by design or reference a key that exists in `dependabot.profiles`.
3. Fix the invalid `npm-actions` reference in `config/owners/Wuodan.yml`, or add the missing profile there.

## Recommended Next Changes In The Action

The remaining mismatches are action capability gaps, not workflow input
mistakes. The next investigation should focus on whether GitHub exposes APIs
for:

- private vulnerability reporting
- automatic dependency submission
- Dependabot rules
- Dependabot malware alerts
- alert dismissal restrictions
- Copilot Autofix
- code quality configuration
