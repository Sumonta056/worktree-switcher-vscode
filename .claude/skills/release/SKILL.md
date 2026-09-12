---
name: release
description: Cut a new tagged release of worktree-switcher on GitHub. Use this skill whenever the user asks to "release", "ship", "publish", "cut a version", "tag a release", or "push a new version" of this extension. It bumps the version, updates the changelog, tags, and pushes — the GitHub Actions workflow then builds the .vsix and attaches it to the release automatically.
---

# Release worktree-switcher

This project publishes releases through a tag-triggered GitHub Actions workflow
(`.github/workflows/release.yml`). Pushing a tag like `v1.0.0` makes CI build the
`.vsix` from source and attach it to an auto-created GitHub Release. Nothing needs
to be built or uploaded by hand.

## Steps

1. Confirm the target version number with the user if it is not already clear
   (semantic version: major for breaking changes, minor for new features, patch
   for fixes).

2. Update `package.json`'s `"version"` field to the new version, no `v` prefix.

3. Regenerate the UI screenshots so `README.md` shows the current UI for this
   release: run `npm run capture:screenshots` (macOS only, needs Accessibility
   permission granted to the terminal — see `src/test/capture/index.ts`). If
   `images/status-bar.png` or `images/worktree-picker.png` changed, stage them
   with the release commit. If capture fails or you are not on macOS, tell the
   user and let them update the images by hand before continuing — do not
   silently skip this step.

4. Update `CHANGELOG.md`:
   - Move anything under `## [Unreleased]` into a new `## [<version>] - <date>` section.
   - Leave a fresh empty `## [Unreleased]` section at the top.
   - Use today's actual date (`YYYY-MM-DD`), not a placeholder.

5. If `FEATURES.md` needs updating for user-visible changes in this release, update it too.

6. Confirm with the user before running any git command that touches the remote
   (commit is usually fine to just do; push and tag push need a clear go-ahead,
   per this project's own git safety rules) — commit, then tag, then push both:
   ```
   git add -A
   git commit -m "release: v<version>"
   git tag v<version>
   git push origin main
   git push origin v<version>
   ```

7. The tag push triggers `.github/workflows/release.yml`. It:
   - Checks out the repo, installs dependencies with `npm ci`.
   - Runs `vsce package` to build the `.vsix`.
   - Creates a GitHub Release for the tag and attaches the `.vsix` as an asset,
     with auto-generated release notes from the commits since the last tag.

8. Tell the user where to watch progress: the Actions tab of the repo, or
   `gh run watch` if the GitHub CLI is available and authenticated.

## Notes

- The workflow only triggers on tags matching `v*.*.*` — a plain `git push` of
  commits to `main` does not create a release.
- Never commit a built `.vsix` file into git; `.gitignore` already excludes
  `*.vsix`, and the workflow always builds a fresh one from source.
- If the release needs redoing (bad build, wrong notes), delete the tag and the
  GitHub Release, fix the issue, and push the tag again — do not reuse a tag
  name for different content.
