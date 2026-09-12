# Features

## Status bar

- Two separate status bar sections:
  - **Recent folders** — fixed label `$(history) Recent`. Click it to open the recent-folders picker directly.
  - **Worktree** — shows `${folder} (${branch})`, for example `feature-x (main)`. Click it to open the worktree picker directly.
- Both sections are fully templatable through settings (`statusBarFormat`, `recentStatusBarFormat`).
- The worktree section turns orange when the current worktree is in a detached `HEAD` state.
- Both sections refresh on branch change (watches `HEAD`), on window focus, and on editor change.

## Worktree picker

- Titled picker (`Git worktrees — my-repo`) with grouped sections: **Worktrees** and **Manage**.
- Each worktree row shows branch, folder path, dirty-file count, and ahead/behind counts, loaded in the background so the picker opens instantly.
- Everything opens in the **current window**; the empty-window button on a row opens it in a new one instead.
- Create a worktree from a local branch, a remote branch, or a brand new branch.
- Remove a worktree (with a force fallback) and prune stale ones.

## Recent-folders picker

- Lists folders you had open recently, tagging any that belong to the current repository as worktrees.
- Opens in the current window by default; the empty-window button opens it in a new one.

## Commands

| Command | Default keybinding |
| --- | --- |
| `Worktree: Switch...` | `Ctrl+Alt+W` / `Cmd+Alt+W` |
| `Worktree: Open Recent Folder...` | — |
| `Worktree: Create New Worktree...` | — |
| `Worktree: Remove Worktree...` | — |
| `Worktree: Refresh Status Bar` | — |

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `worktreeSwitcher.openInNewWindow` | `false` | Always open in a new window instead. |
| `worktreeSwitcher.statusBarAlignment` | `left` | `left` or `right` side of the status bar, for the worktree section. |
| `worktreeSwitcher.statusBarPriority` | `100` | Higher = further left, for the worktree section. |
| `worktreeSwitcher.statusBarFormat` | `$(git-branch) ${folder} (${branch})` | Worktree label template. Vars: `${branch}`, `${folder}`, `${count}`, `${detached}`. |
| `worktreeSwitcher.recentStatusBarAlignment` | `left` | `left` or `right` side of the status bar, for the recent-folders section. |
| `worktreeSwitcher.recentStatusBarPriority` | `101` | Higher = further left. Defaults to sitting left of the worktree section. |
| `worktreeSwitcher.recentStatusBarFormat` | `$(history) Recent` | Recent-folders label. Fixed text, not tied to any folder. |
| `worktreeSwitcher.showWorktreeStatus` | `true` | Dirty count + ahead/behind per worktree in the picker. |
| `worktreeSwitcher.newWorktreeParentDir` | `""` | Default parent folder for new worktrees. |
