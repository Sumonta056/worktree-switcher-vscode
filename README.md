# Git Worktree Switcher

A status bar worktree switcher for VS Code — the thing Zed gives you out of the box.

The bottom bar shows the branch of the worktree you're currently in. Click it to get a
picker of every worktree in the repository; choosing one **reopens it in the current
window** (no new window unless you ask for it).

## Features

- Status bar item reads `⧉ wt: feature/checkout` — the `wt:` prefix and tree icon make it
  obvious this is the worktree switcher, not the plain branch indicator. Fully templatable
  via `worktreeSwitcher.statusBarFormat`.
- Titled picker (`Git worktrees — my-repo`) with grouped sections: **Worktrees**,
  **Elsewhere**, **Manage**.
- Each worktree row shows branch, folder path, dirty-file count, and ahead/behind counts,
  loaded in the background so the picker opens instantly.
- **Open recent folder...** swaps the same picker into a recent-folders list (with a back
  button) — folders belonging to the current repo are tagged as worktrees.
- Everything opens in the **current window**; the ⧉ button on a row opens it in a new one.
- Create a worktree from a local branch, a remote branch, or a brand new branch.
- Remove a worktree (with a force fallback) and prune stale ones.
- Detached HEAD turns the status bar item orange.
- Refreshes on branch change (watches `HEAD`), on window focus, and on editor change.

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
| `worktreeSwitcher.statusBarAlignment` | `left` | `left` or `right` side of the status bar. |
| `worktreeSwitcher.statusBarPriority` | `100` | Higher = further left. |
| `worktreeSwitcher.statusBarFormat` | `$(list-tree) wt: ${branch}` | Label template. Vars: `${branch}`, `${folder}`, `${count}`, `${detached}`. |
| `worktreeSwitcher.showWorktreeStatus` | `true` | Dirty count + ahead/behind per worktree in the picker. |
| `worktreeSwitcher.newWorktreeParentDir` | `""` | Default parent folder for new worktrees. |

## Install

```bash
code --install-extension worktree-switcher-0.2.0.vsix
```

Or in VS Code: Extensions view → `...` menu → **Install from VSIX...**

## Develop

```bash
npm install
npm run compile
# then F5 in VS Code to launch an Extension Development Host
npm run package     # needs: npm i -g @vscode/vsce
```

## Notes

- Switching runs `vscode.openFolder`, so the current window reloads — unsaved editors are
  restored by VS Code's hot exit, but a reload is a reload.
- If the window has a multi-root `.code-workspace` open, switching replaces it with the
  single worktree folder.
- The repository is detected from the workspace folder that owns the active editor, falling
  back to the first workspace folder.
