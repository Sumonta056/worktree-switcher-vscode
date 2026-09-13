# Feature request — pinning, keyboard slots, and picker cleanup

This document is a build prompt. It lists new feature requirements and
fixes for the status bar, the worktree picker, and the recent-folders
picker. It follows from a design review with mock-ups; see the
"Design reference" section below for the artifact link. Read
`FEATURES.md` first for the current behavior — this document only
lists what must change or get added.

## Ground rules (do not violate these)

1. Worktrees and recent folders stay **two separate features**. Do not
   merge their status bar items, their commands, or their pickers. Do
   not show a worktree entry inside the Recent picker, and do not show
   a recent-folder entry inside the Worktree picker.
2. **No new status bar background colors.** The existing detached-HEAD
   tint (`statusBarItem.warningBackground`) is the only color rule that
   exists today. Do not add a color for ahead/behind, dirty state, or
   anything else.
3. Ahead/behind counts show only inside the worktree picker (as plain
   text next to a row), never in the status bar text.
4. Every new command must have a codicon and a clear label, matching
   the conventions in `.claude/skills/ui-tweak/SKILL.md`.
5. Keep all changes inside `src/extension.ts`, `src/test/`, and
   `package.json` (for new settings, commands, and keybindings), per
   `CLAUDE.md`. Do not introduce a webview or custom HTML.

## 1. Pin worktrees to the top of the picker

- Add a pin toggle to each worktree row in the picker (a button, using
  a bookmark-style codicon: outline when unpinned, filled when
  pinned).
- Clicking it toggles pin state immediately and re-sorts the list:
  pinned worktrees first (as a **Pinned** group), then the rest (as a
  **Worktrees** group), in existing order within each group.
- The currently-open worktree keeps its own marker icon regardless of
  pin state (see section 4).
- Persist pinned worktree IDs (branch name, or worktree path if
  detached) in `context.workspaceState`, keyed per repository root, so
  pins survive closing and reopening VS Code. Do not use
  `context.globalState` — pins are per-repository.

## 2. Pin recent folders to the top of the picker

- Same behavior as section 1, applied independently to the
  recent-folders picker: a pin button per row, a **Pinned** group at
  the top, its own persisted state.
- Recent-folder pins and worktree pins are stored separately. Pinning
  a worktree must never affect the Recent picker's order, and vice
  versa.
- Persist recent-folder pins in `context.globalState` (recent folders
  are not scoped to one repository the way worktrees are).

## 3. Recent picker shows only plain project folders

- Remove any entry from the Recent picker whose path matches a
  worktree of the currently open repository. Those already have a home
  in the Worktree picker.
- Keep workspace-file entries (`*.code-workspace`) and ordinary folders
  unrelated to the current repository.
- Add a last-opened-time detail to every row (for example
  `3 hours ago`, `yesterday`, `4 days ago`). Compute this from the data
  already returned by `_workbench.getRecentlyOpened` if it carries a
  timestamp; otherwise fall back to relative order without inventing a
  time.

## 4. A distinct icon for the currently open worktree

- Give the current worktree its own icon, separate from the
  clean/dirty icons used for every other row (for example
  `$(target)` or another codicon not otherwise used in this list).
- Clean worktrees keep a check-style icon; dirty worktrees keep the
  filled-dot-plus-count they use today.

## 5. Remove the locked/prunable group

- Do not add a separate "Locked & stale" section to the picker. Keep
  today's behavior: a locked or prunable worktree shows its existing
  inline flag (`$(lock) locked`, `$(warning) prunable`) in its own row,
  and remains reachable through **Manage** → **Remove** / **Prune**.

## 6. Keyboard shortcut to jump directly to a worktree

- Add up to 9 commands, `worktreeSwitcher.switchToSlot1` through
  `worktreeSwitcher.switchToSlot9`, each opening the worktree at that
  position in the pinned-then-recency order used by the picker (slot 1
  is the first row a user would see, slot 2 the second, and so on).
- Only contribute as many of these commands' keybindings as make sense
  by default; all 9 commands can exist, but only bind keys for the
  slots that are likely to be used. Register default keybindings in
  `package.json` under `contributes.keybindings`:
  - `cmd+shift+1` … `cmd+shift+9` on macOS
  - `ctrl+shift+1` … `ctrl+shift+9` on Windows/Linux
  - Scope with a `when` clause so they do not fire outside a window
    that has this extension active with a known repository.
- These are **default** bindings, not fixed ones — VS Code lets every
  user rebind or disable them from `keybindings.json` if they clash
  with something else on their machine. Document this in `README.md`.
- If there are fewer than N worktrees, slot N simply has nothing to
  switch to; running it should no-op (or show a brief status bar
  message) rather than error.
- Switching should reuse the existing `openWorktree` function and its
  same-worktree short-circuit (see `src/extension.ts:251-261`).

## 7. Status bar wording (no behavior change, wording only)

- Worktree item keeps its current two-part text
  (`${folder} (${branch})`) and adds the existing worktree `${count}`
  variable if a project's configured format does not already include
  it (see `worktreeSwitcher.statusBarFormat` in `FEATURES.md`) — no new
  setting needed, just confirm the default format surfaces the count
  clearly, for example `${folder} (${branch}) · ${count} worktrees`.
- Recent item's label and behavior do not change.

## Acceptance criteria

- `npm run compile` passes with no new type errors.
- `npm test` passes, including new tests for: pin/unpin ordering (both
  pickers), workspace-state persistence of worktree pins,
  global-state persistence of recent-folder pins, Recent picker
  excluding current-repo worktrees, and slot-command resolution
  (slot N maps to the Nth row in pinned-then-recency order).
- Manual check: pin two worktrees, reload the window, confirm the pins
  and their order survive.
- Manual check: with 3+ worktrees, press the default keybinding for
  slot 2 and slot 3 and confirm each opens the expected worktree.

## Design reference

Interactive mock-ups covering the status bar, both pickers, pinning,
and the keyboard-slot behavior were reviewed as an artifact during
planning. Ask in the original conversation thread for the link if it
is needed again — it is not checked into this repository.

## Backlog (not required for this pass)

- Copy a worktree's or a recent folder's path from its row.
- A setting to hide the Recent status bar item entirely.
- Drag-to-reorder pinned entries, instead of sorting by pin order.
- Sync pins across machines through VS Code Settings Sync.
