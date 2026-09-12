# worktree-switcher — project rules

## What this project is

A VS Code extension. It shows the current git worktree in the status bar and
lets the user switch worktrees, jump to recent folders, and create or remove
worktrees. All source code lives in `src/extension.ts` (one file). The
extension has no custom HTML/CSS UI — it only uses native VS Code UI:
status bar items, quick-pick menus, and input boxes.

## Build and verify

- `npm run compile` — type-checks and builds with `tsc`. Run this after any
  edit to `src/**/*.ts` to catch type errors early.
- `npm test` — compiles, then runs the real automated test suite in a
  headless VS Code instance (Extension Development Host), via
  `@vscode/test-electron` + Mocha. Tests live in `src/test/suite/*.test.ts`.
  Run this before claiming any change is verified — a clean compile is not
  proof the extension still works.
- Do not claim a fix or a feature "works" without running `npm test` and
  showing the output.

## Test infrastructure notes

- `@vscode/test-electron` must stay pinned at `^3.1.0` or newer. VS Code
  1.110+ renamed the macOS Electron binary from `Electron` to `Code`;
  `@vscode/test-electron@2.x` cannot find it and fails with
  `spawn .../Contents/MacOS/Electron ENOENT`. Only 3.x resolves the new
  binary name. The `engines.node >=22` warning this version prints on
  install is safe to ignore — it runs fine on Node 20 in practice.
- `.vscode-test/` holds a downloaded VS Code build used only for running
  tests. It is gitignored. If tests fail with an `ENOENT` spawn error,
  delete `.vscode-test/` and rerun — the cached download may be stale or
  incomplete.

## Scope discipline

- Keep changes inside `src/extension.ts` and `src/test/` unless the task
  needs a new file. This is a small, single-purpose extension — do not add
  new abstractions, config systems, or files it doesn't need.
- Do not commit generated output: `out/`, `*.vsix`, `.vscode-test/`.

## Release process — use the skills, not raw git/gh commands

- Building a local `.vsix` to test or install by hand: use the
  `package-vsix` skill.
- Cutting a tagged GitHub Release (bumps version, updates changelog, tags,
  pushes, CI builds and attaches the `.vsix`): use the `release` skill.
- Publishing the update to the VS Code Marketplace: use the
  `publish-marketplace` skill.
- Checking whether the extension still works end to end (compile + full
  test suite): use the `health-check` skill.
- Changing quick-pick items, status bar labels/icons, or picker UX: use the
  `ui-tweak` skill for VS Code-native UX conventions.

## Git safety (inherited from global rules, restated here for emphasis)

- Never run `git commit`, `git push`, `git tag`, or any destructive git
  command without asking first, even mid-task.
- Never skip hooks or force-push.
