# Features

## Status bar

- Two separate status bar sections:
  - **Recent folders** — fixed label `$(history) Recent`. Click it to open the recent-folders picker directly.
  - **Worktree** — shows `${folder} (${branch})`, for example `feature-x (main)`. Click it to open the worktree picker directly.
- Both sections are fully templatable through settings (`statusBarFormat`, `recentStatusBarFormat`).
- The worktree section turns orange when the current worktree is in a detached `HEAD` state.
- Both sections refresh on branch change (watches `HEAD`), on window focus, and on editor change.

## Worktree picker

- Titled picker (`Git worktrees — my-repo`) with grouped sections: **Pinned** (only shown once something is pinned), **Worktrees**, and **Manage**.
- Each row has a pin button (`$(pin)` / `$(pinned)`) that toggles pin state immediately and re-sorts the list: pinned worktrees first, then the rest, in existing order within each group. Pins persist per repository in `workspaceState`.
- The currently open worktree shows a distinct `$(target)` icon, separate from the clean/dirty status shown in its detail line, regardless of pin state.
- Each worktree row shows branch, folder path, dirty-file count, and ahead/behind counts, loaded in the background so the picker opens instantly.
- A locked or prunable worktree shows its flag (`$(lock) locked`, `$(warning) prunable`) inline in its own row.
- Everything opens in the **current window**; the empty-window button on a row opens it in a new one instead.
- Create a worktree from a local branch, a remote branch, or a brand new branch.
- Remove a worktree (with a force fallback) and prune stale ones.

## Recent-folders picker

- Lists folders you had open recently, **excluding** any folder that is a worktree of the currently open repository — those already have a home in the Worktree picker.
- Grouped into **Pinned** (only shown once something is pinned) and **Recent folders**. A pin button per row persists independently of worktree pins, in `globalState` (not scoped to one repository).
- Every row shows a last-opened-time detail (for example `3 hours ago`) when the underlying data provides a timestamp; otherwise a relative-order label (`most recent`, `#2 most recent`, ...) rather than an invented time.
- Opens in the current window by default; the empty-window button opens it in a new one.

## Keyboard slots

- `worktreeSwitcher.switchToSlot1` through `...Slot9` jump straight to the worktree at that position in the picker's pinned-then-recency order (slot 1 is the first row, slot 2 the second, and so on).
- Default keybindings are registered for slots 1-5 only (`Cmd+Shift+1`…`5` / `Ctrl+Shift+1`…`5`), scoped to windows with a known repository; slots 6-9 exist as commands with no default keybinding. All bindings are rebindable or disable-able like any other VS Code shortcut.
- Running a slot with nothing in that position is a no-op (brief status bar message), not an error.

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
| `worktreeSwitcher.statusBarFormat` | `$(git-branch) ${folder} (${branch}) · ${count} worktrees` | Worktree label template. Vars: `${branch}`, `${folder}`, `${count}`, `${detached}`. |
| `worktreeSwitcher.recentStatusBarAlignment` | `left` | `left` or `right` side of the status bar, for the recent-folders section. |
| `worktreeSwitcher.recentStatusBarPriority` | `101` | Higher = further left. Defaults to sitting left of the worktree section. |
| `worktreeSwitcher.recentStatusBarFormat` | `$(history) Recent` | Recent-folders label. Fixed text, not tied to any folder. |
| `worktreeSwitcher.showWorktreeStatus` | `true` | Dirty count + ahead/behind per worktree in the picker. |
| `worktreeSwitcher.newWorktreeParentDir` | `""` | Default parent folder for new worktrees. |
