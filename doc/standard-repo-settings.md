# Standard Repo Settings

This document has two kinds of content:

- `Preference`: the intended GitHub repository standard.
- `Sync status`: whether that preference is enforced by this repo's automation.

## UI Mapping

This is the direct mapping from the GitHub repository settings UI to what this repo currently enforces.

### Already enforced

- Immutable releases: Synced by workflow input `immutable-releases: true`.
- Dependency graph: Synced indirectly by `dependabot-alerts`.
- Dependabot alerts: Synced for non-fork repositories selected by the owner rules.
- Dependabot security updates: Synced for non-fork repositories selected by the owner rules.
- Dependabot version updates: Synced for repositories with an explicit assigned `dependabot.yml` profile.
- Grouped security updates: Synced for repositories whose assigned `dependabot.yml` profile defines `groups`.
- CodeQL default setup: Synced by workflow input `code-scanning: true`.
- Secret protection: Synced by workflow input `secret-scanning: true`.
- Push protection: Synced by workflow input `secret-scanning-push-protection: true`.

### Conditional or partial

- Dependabot version updates: Only enforced for repositories that receive a synced `dependabot.yml`.
- Grouped security updates: Only enforced where the synced `dependabot.yml` contains matching `groups`.
- Fork repositories: Intentionally excluded by the owner rules.

### Unsupported by current action

- Private vulnerability reporting.
- Automatic dependency submission.
- Dependabot rules.
- Dependabot malware alerts.
- Prevent direct alert dismissals for Dependabot alerts.
- Copilot Autofix.
- Prevent direct alert dismissals for code scanning alerts.
- Protection rules check runs failure threshold.

## General

### Releases

- Preference: Immutable releases enabled.
- Sync status: Synced by `.github/workflows/sync-github-repo-settings.yml`.

### Pull Requests

- Preference: Keep GitHub defaults; no custom standard to enforce.
- Sync status: Not synced.

## Advanced Security

- Preference: Private vulnerability reporting enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependency graph enabled.
- Sync status: Synced indirectly by `dependabot-alerts`.

- Preference: Automatic dependency submission enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependabot alerts enabled.
- Sync status: Synced for non-fork repositories selected by the owner rules.

- Preference: Dependabot rules enabled.
  - Dismiss low-impact alerts for development-scoped dependencies enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependabot malware alerts enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependabot security updates enabled.
- Sync status: Synced for non-fork repositories selected by the owner rules.

- Preference: Grouped security updates enabled.
- Sync status: Synced via per-repository `dependabot.yml` assignment from the owner config.

- Preference: Dependabot version updates enabled only on repositories that have an explicit matching profile.
- Sync status: Synced via per-repository `dependabot.yml` assignment from the owner config. Archived repositories are
  ignored by the action, and the owner rules exclude forks entirely.

### Code Scanning

- Preference: CodeQL analysis enabled with default setup.
- Sync status: Synced.

- Preference: Copilot Autofix on.
- Sync status: Not synced; left at GitHub/repo default.

- Preference: Prevent direct alert dismissals off.
- Sync status: Not synced; left at GitHub/repo default.

### Protection Rules

- Preference: Check runs failure threshold left at GitHub defaults.
- Sync status: Not synced.

- Preference: Secret protection enabled.
- Sync status: Synced.

- Preference: Push protection enabled.
- Sync status: Synced.

## Code Quality

- Preference: GitHub code quality enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Runner type standard GitHub runner, quality query suites, scan events at GitHub defaults.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.
