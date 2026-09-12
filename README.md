# Git Worktree Switcher

A status bar worktree switcher for VS Code, the feature Zed gives you out of the box.

The status bar shows the branch of your current worktree. Click it to open a picker of
every worktree in the repository. Choosing one **reopens it in the current window** — no
new window unless you ask for it.

## Features

- Status bar item reads `⧉ wt: feature/checkout`. The `wt:` prefix and tree icon make it
clear this is the worktree switcher, not the plain branch indicator. You can customize
the format with `worktreeSwitcher.statusBarFormat`.
- Titled picker (`Git worktrees — my-repo`) with grouped sections: **Worktrees**,
**Elsewhere**, and **Manage**.
- Each worktree row shows the branch, folder path, dirty-file count, and ahead/behind
counts. These load in the background, so the picker opens instantly.
- **Open recent folder...** swaps the same picker into a recent-folders list, with a back
button. Folders that belong to the current repository are tagged as worktrees.
- Everything opens in the **current window** by default. The ⧉ button on a row opens it in
a new window.
- Create a worktree from a local branch, a remote branch, or a new branch.
- Remove a worktree, with a force fallback, and prune stale worktrees.
- Detached HEAD state turns the status bar item orange.
- The status bar refreshes on branch change, on window focus, and on editor change.

## Screenshots

**Recent folders picker** — the status bar chip shows the active worktree branch at a
glance.

![Status bar worktree chip](images/status-bar.png)

**Worktree picker** — pick any worktree in the repository, with dirty and clean status
shown per row.

![Worktree picker](images/worktree-picker.png)

A short demo video is available on the author's YouTube channel:
[Code Career Golpo](https://www.youtube.com/@codecareergolpo5638).

## Commands


| Command                            | Default keybinding         |
| ---------------------------------- | -------------------------- |
| `Worktree: Switch...`              | `Ctrl+Alt+W` / `Cmd+Alt+W` |
| `Worktree: Open Recent Folder...`  | —                          |
| `Worktree: Create New Worktree...` | —                          |
| `Worktree: Remove Worktree...`     | —                          |
| `Worktree: Refresh Status Bar`     | —                          |


## Settings


| Setting                                 | Default                      | What it does                                                                    |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `worktreeSwitcher.openInNewWindow`      | `false`                      | Always open the chosen worktree in a new window.                                |
| `worktreeSwitcher.statusBarAlignment`   | `left`                       | Place the status bar item on the `left` or `right` side.                        |
| `worktreeSwitcher.statusBarPriority`    | `100`                        | Higher value moves the item further left.                                       |
| `worktreeSwitcher.statusBarFormat`      | `$(list-tree) wt: ${branch}` | Label template. Variables: `${branch}`, `${folder}`, `${count}`, `${detached}`. |
| `worktreeSwitcher.showWorktreeStatus`   | `true`                       | Show dirty count and ahead/behind counts per worktree in the picker.            |
| `worktreeSwitcher.newWorktreeParentDir` | `""`                         | Default parent folder for new worktrees.                                        |


## How to use it

1. Open a Git repository that has one or more worktrees.
2. Look at the status bar. It shows the branch of the current worktree.
3. Select the status bar item, or press `Ctrl+Alt+W` (`Cmd+Alt+W` on macOS).
4. Select a worktree from the picker. VS Code reopens the current window in that worktree.
5. To open a worktree in a new window instead, select the ⧉ button next to its row.
6. To create, remove, or prune worktrees, use the **Manage** section of the same picker.

## Develop

```bash
npm install
npm run compile
# then press F5 in VS Code to launch an Extension Development Host
npm run package     # requires: npm i -g @vscode/vsce
```

## Notes

- Switching runs `vscode.openFolder`, so the current window reloads. VS Code's hot exit
restores unsaved editors, but a reload is still a reload.
- If the window has a multi-root `.code-workspace` open, switching replaces it with the
single worktree folder.
- The extension detects the repository from the workspace folder that owns the active
editor. If no editor is active, it falls back to the first workspace folder.

## Feedback and issues

If you find a bug, or you want to request a feature, please open an issue on GitHub:

👉 [Open an issue](https://github.com/Sumonta056/worktree-switcher-vscode/issues)

Your feedback helps improve this extension for everyone.

## About the author

**Sumonta Saha Mridul** — Associate Software Engineer.

- GitHub: [github.com/sumonta056](https://github.com/sumonta056)
- LinkedIn: [linkedin.com/in/sumonta-saha-mridul-b35bb61a0](https://www.linkedin.com/in/sumonta-saha-mridul-b35bb61a0/)
- YouTube: [Code Career Golpo](https://www.youtube.com/@codecareergolpo5638)

---

*This project and its documentation were built through a collaboration between AI and a
human — "AI + U".*