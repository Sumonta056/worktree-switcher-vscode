# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.1.0] - 2026-09-13

### Added

- Pin worktrees to the top of the worktree picker (stored per repository).
- Pin recent folders to the top of the recent-folders picker.
- `worktreeSwitcher.switchToSlot1` through `switchToSlot9` commands, with
  default keybindings for slots 1-5 (`Cmd/Ctrl+Shift+1` through `+5`).
- `worktreeSwitcher.showRecentStatusBar` setting, with a first-run prompt
  that asks whether to show the Recent Folders status bar item.
- Automated UI screenshot capture (`npm run capture:screenshots`) used to
  keep `README.md` screenshots current for each release.

### Changed

- The recent-folders picker no longer lists folders that are already
  worktrees of the open repository.
- The currently open worktree now shows a distinct icon in the picker.
- Default worktree status bar format now shows the worktree count.

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
