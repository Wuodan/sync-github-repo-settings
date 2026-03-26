# Standard Repo Settings

## General

### Releases

Enable release immutability Loading: true

### Pull Requests

all default, no need to sync

## Advanced Security

- Private vulnerability reporting: Enabled
- Dependency graph: Enabled
- Automatic dependency submission: Enabled (standard)
- Dependabot alerts: Enabled
- Dependabot rules: 1 rule enabled (Managed by GitHub)
  - Dismiss low-impact alerts for development-scoped dependencies: enabled
- Dependabot malware alerts: Enabled
- Dependabot security updates
- Grouped security updates
- Dependabot version updates: each repo same dependabot.yml

### Code scanning

- CodeQL analysis: Enabled (Default setup)
- Copilot Autofix: On (default setting on new repos, no sync)
- Prevent direct alert dismissals: Off (default setting on new repos, no sync)

### Protection rules

Check runs failure threshold: Whatever GHs defaults are, no need to sync

Secret Protection: Enabled

Push protection: Enabled

## Code quality

Code quality: Enabled

- Runner type: Standard GitHub runner
- Quality query suites
- Scan events: all GH defaults