# Standard Repo Settings

This document has two kinds of content:

- `Preference`: the intended GitHub repository standard.
- `Sync status`: whether that preference is enforced by this repo's automation.

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
- Sync status: Synced, except forks where it is explicitly disabled.

- Preference: Dependabot rules enabled.
  - Dismiss low-impact alerts for development-scoped dependencies enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependabot malware alerts enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependabot security updates enabled.
- Sync status: Synced, except forks where it is explicitly disabled.

- Preference: Grouped security updates enabled.
- Sync status: Unsupported by `joshjohanning/bulk-github-repo-settings-sync-action`.

- Preference: Dependabot version updates enabled only on repositories that have an explicit matching profile.
- Sync status: Synced via per-repository `dependabot.yml` assignment from the owner   config. Archived repositories are
  ignored and forks do not get a synced `dependabot.yml`, `dependabot-alerts`, or `dependabot-security-updates`.

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
