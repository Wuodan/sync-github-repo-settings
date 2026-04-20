# sync-github-repo-settings

Private config repo for asserting the same GitHub repo settings across:

- `Wuodan`
- `aicage`
- `gh-workflow`

Shared config:

- [sync-github-repo-settings.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/.github/workflows/sync-github-repo-settings.yml)
- [dependabot profiles](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/dependabot)

Managed owners / ignore lists:

- [Wuodan.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/Wuodan.yml)
- [aicage.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/aicage.yml)
- [gh-workflow.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/gh-workflow.yml)

Dependabot behavior:

- Archived repositories are ignored (now by `joshjohanning/bulk-github-repo-settings-sync-action`).
- Forks are excluded by the action's rules-based selectors (`all: true` plus `fork: false`).
- Owned repositories only get a synced `dependabot.yml` when they are assigned an explicit profile in the owner config.

Upstream action docs:

- [bulk-github-repo-settings-sync-action](https://github.com/joshjohanning/bulk-github-repo-settings-sync-action)

Auth needed in this repo:

- repository variable `APP_ID`
- repository secret `APP_PRIVATE_KEY`
