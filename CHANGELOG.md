# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.0] - 2026-09-12

### Changed

- Split the single status bar item into two independent sections:
  - **Recent folders** — fixed label, opens the recent-folders picker directly.
  - **Worktree** — shows `${folder} (${branch})`, opens the worktree picker directly.
- Default worktree status bar format changed from `$(list-tree) wt: ${branch}` to `$(git-branch) ${folder} (${branch})`.
- Removed the "Open recent folder..." entry from inside the worktree picker, since it is now redundant with the dedicated recent-folders status bar section.

### Added

- New settings: `worktreeSwitcher.recentStatusBarFormat`, `worktreeSwitcher.recentStatusBarAlignment`, `worktreeSwitcher.recentStatusBarPriority`.
- `FEATURES.md` describing all current features.
- Automated GitHub Release workflow: pushing a `v*` tag builds the `.vsix` and publishes it as a release asset.

## [0.2.0] - earlier

- Initial tracked version: worktree switching, recent-folder picker, create/remove/prune worktrees, dirty/ahead/behind status, detached-HEAD warning color.
