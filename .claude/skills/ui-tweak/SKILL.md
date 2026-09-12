---
name: ui-tweak
description: Improve the user-facing text and layout of worktree-switcher's VS Code-native UI — status bar labels/icons, quick-pick item labels/descriptions/icons, ordering, and input box prompts. Use whenever the user asks to improve, redesign, or polish the extension's UI, picker, or status bar — this extension has no custom HTML/CSS, only native VS Code UI.
---

# UI tweaks for worktree-switcher

This extension has no webview, no custom HTML, and no CSS. All "UI" is
native VS Code UI: `vscode.window.createStatusBarItem`,
`vscode.window.showQuickPick`, and `vscode.window.showInputBox`. Design
work here means picking good labels, icons, ordering, and grouping within
those APIs — not visual styling.

## Where the UI lives in this codebase

- Status bar items: `worktreeStatusBar` and `recentStatusBar` in
  `src/extension.ts`. Their text comes from the configurable templates
  `worktreeSwitcher.statusBarFormat` and
  `worktreeSwitcher.recentStatusBarFormat` (see the `configuration` section
  of `package.json` for the variables each template supports).
- Quick-pick items: built wherever a command calls
  `vscode.window.showQuickPick(...)`. Each item can set `label`,
  `description`, `detail`, and an icon via a `$(codicon-name)` prefix in
  the label.

## Conventions to follow

1. **Use codicons, not emoji.** VS Code's built-in icon font is invoked as
   `$(icon-name)` inside a label or status bar text (for example
   `$(git-branch)`, `$(history)`, `$(check)`, `$(warning)`). Look up
   available names at the VS Code Codicon reference before inventing one.
2. **Keep labels short; put detail in `description`/`detail`.** A
   quick-pick `label` should be scannable at a glance (for example a
   branch name); secondary info (ahead/behind counts, path, dirty state)
   belongs in `description` or `detail`, not crammed into the label.
3. **Match existing formatting conventions already in the file** — for
   example how `${branch}`, `${folder}`, `${count}`, `${detached}` are
   substituted into `statusBarFormat`. Add new template variables the same
   way if a new one is needed; document it in the corresponding
   `markdownDescription` in `package.json`.
4. **Never break configurability.** If a label or format is already
   user-configurable (see the `configuration` properties in
   `package.json`), keep it configurable — do not hardcode a string that
   was previously templated.
5. **Respect theming.** Do not hardcode colors; VS Code status bar and
   quick-pick items follow the user's theme automatically. Only
   `vscode.ThemeColor` (for example marking a status bar item as a
   warning/error background) is acceptable if truly needed, and should be
   used sparingly.

## Steps

1. Read the relevant section of `src/extension.ts` fully before editing —
   note existing variable names and the exact QuickPick item shape already
   in use, so the change is consistent, not a new pattern.
2. Make the change.
3. Run `npm run compile` to type-check.
4. If the change affects a configuration property's default or
   description, update the matching entry in `package.json`'s
   `contributes.configuration.properties`.
5. Where practical, add or update a test under `src/test/suite/` that
   checks the new label/format logic (for pure string-formatting logic,
   this can be a plain unit test without needing the full Extension Dev
   Host). Otherwise, describe the manual verification steps to the user
   (what to click, what they should see).
