---
name: publish-marketplace
description: Publish this VS Code extension (worktree-switcher) to the VS Code Marketplace under publisher SumontaSahaMridul. Use this skill whenever the user asks to "publish the extension", "publish to marketplace", "update the extension", "ship the update", "push a new version to marketplace", or otherwise wants a code change to reach real VS Code users through the Marketplace listing (not just a local .vsix or a GitHub Release). Distinct from "release" (GitHub Release only, no Marketplace) and "package-vsix" (local build only, no publish).
---

# Publish worktree-switcher to the VS Code Marketplace

This project publishes directly to the Marketplace with `vsce publish`, separate from
the GitHub Release flow. Use this skill any time the user wants their latest code
changes to actually reach people who install the extension by searching for it in
VS Code — that only happens through the Marketplace, not through a GitHub Release
or a local `.vsix` file.

## Steps

1. **Confirm the version bump type**, if not already clear from the conversation:
   `patch` (fixes), `minor` (new features), or `major` (breaking changes).

2. **Check Marketplace login.** Run `vsce verify-pat SumontaSahaMridul` or just
   proceed — if the stored Personal Access Token (PAT) is missing or expired,
   `vsce publish` fails with an auth error and tells the user to run
   `vsce login SumontaSahaMridul` again. Don't ask the user to log in preemptively;
   only surface it if the publish step actually fails on auth.

3. **Do not hand-check `.env` exclusion every time.** `.vscodeignore` already
   excludes it (fixed after a real incident where `.env` nearly got packaged into
   the public `.vsix`). `vsce` hard-errors on any unignored `.env` file before
   anything uploads, so this is a built-in safety net, not a manual step — no
   need to re-verify it by hand on every publish.

4. **Run the publish command** from the project root:
   ```
   vsce publish <patch|minor|major>
   ```
   This single command does four things:
   - Bumps `"version"` in `package.json`.
   - Creates a git commit and a git tag locally, named for the new version.
   - Packages a fresh `.vsix` (compiling first via `vscode:prepublish`).
   - Uploads that `.vsix` to the Marketplace under publisher `SumontaSahaMridul`.

   It does **not** push anything to the git remote — that commit and tag stay local.

5. **Ask before pushing.** This project's git safety rules require an explicit
   go-ahead before anything touches the remote. After a successful publish, tell
   the user the commit and tag are ready locally, and ask before running:
   ```
   git push origin main
   git push origin <new-tag>
   ```

6. **Report the result.** Give the user the Marketplace URL:
   `https://marketplace.visualstudio.com/items?itemName=SumontaSahaMridul.worktree-switcher`
   Mention that Marketplace indexing can take a few minutes before the new version
   shows up for installs and searches.

## Notes

- Never commit a built `.vsix` file — `.gitignore` already excludes `*.vsix`.
- If `vsce publish` reports a display-name conflict (rare, only relevant if
  `displayName` changes) or any other Marketplace-side rejection, fix the flagged
  field in `package.json` and rerun the same command — the version bump and git
  tag from a failed attempt do not roll back on their own, so check
  `git log`/`git tag` before bumping again to avoid a duplicate version number.
- If the user wants both a GitHub Release and a Marketplace publish for the same
  change, run this skill's `vsce publish` first (it owns the version bump), then
  point the `release` skill at the same version so the tag it pushes matches.
