# sync-github-repo-settings

Private config repo for asserting the same GitHub repo settings across:

- `Wuodan`
- `aicage`
- `gh-workflow`

Shared config:

- [sync-github-repo-settings.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/.github/workflows/sync-github-repo-settings.yml)
- [dependabot.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/.github/dependabot.yml)

Managed owners / ignore lists:

- [Wuodan.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/Wuodan.yml)
- [aicage.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/aicage.yml)
- [gh-workflow.yml](/home/stefan/development/github/Wuodan/sync-github-repo-settings/config/owners/gh-workflow.yml)

Upstream action docs:

- https://github.com/joshjohanning/bulk-github-repo-settings-sync-action

Auth needed in this repo:

- repository variable `APP_ID`
- repository secret `APP_PRIVATE_KEY`
