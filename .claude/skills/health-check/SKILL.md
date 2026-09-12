---
name: health-check
description: Check whether worktree-switcher is currently working or broken — runs a full type check and the automated test suite, then reports a clear pass/fail. Use this skill whenever the user asks "is everything working?", "is this feature broken?", "does the extension still work?", or before telling the user a change is done.
---

# Health check for worktree-switcher

This skill answers one question: does the extension currently build and
behave correctly? It does not fix anything — it only reports status.

## Steps

1. Run a full compile:
   ```
   npm run compile
   ```
   If this fails, report the exact `tsc` errors and stop here — the
   extension is broken at the type level, and the test suite could not be
   trusted until this is fixed.

2. Run the automated test suite:
   ```
   npm test
   ```
   This compiles again (harmless — `pretest` reruns `npm run compile`),
   then launches a real headless VS Code (Extension Development Host) with
   Mocha and reports pass/fail per test.

3. Report clearly:
   - "Everything is working" only if both steps exit with code 0 and the
     test output shows all tests passing.
   - Otherwise, list exactly what failed: which `tsc` errors, or which
     named test(s) failed and their assertion messages.

4. Never say a feature "works" or "the extension is fine" without having
   run these two commands in this exact session. A clean compile alone is
   not proof of correct behavior.

## Known environment note

If `npm test` fails with:
```
spawn .../Contents/MacOS/Electron ENOENT
```
this means `@vscode/test-electron` is pinned below `3.1.0` (VS Code 1.110+
renamed the macOS binary). Confirm `package.json` has
`"@vscode/test-electron": "^3.1.0"` or newer, and reinstall if not. If the
error persists with the correct version, delete `.vscode-test/` (stale
cached download) and rerun `npm test`.

## When a feature is reported broken

If the user says a specific feature is broken (for example, "switching
worktrees doesn't work"), first run this health check to see if it is a
build-level or test-level failure. If both pass but the manual behavior
still seems wrong, hand off to `systematic-debugging` (or the
`debugging-and-error-recovery` skill) to reproduce and localize the actual
runtime bug — this skill only tells you pass/fail, not why.
