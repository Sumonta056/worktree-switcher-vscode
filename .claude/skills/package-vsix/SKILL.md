---
name: package-vsix
description: Build this VS Code extension (worktree-switcher) into a .vsix file for local install or distribution. Use this skill whenever the user asks to "package the extension", "build the vsix", "make a vsix", "install vsix", or wants to test the extension in a real VS Code install instead of the Extension Development Host.
---

# Package worktree-switcher as a .vsix file

## Steps

1. Check that `@vscode/vsce` is installed as a dev dependency. Look at `package.json` under `devDependencies`. If it is missing, install it:
   ```
   npm install --save-dev @vscode/vsce
   ```
   Use `@vscode/vsce`, not the old deprecated `vsce` package name.

2. Run the package script:
   ```
   npm run package
   ```
   This runs `vsce package`, which itself runs `vscode:prepublish` first, and that runs `npm run compile`. So compiling by hand before this step is not needed — `npm run package` already does it.

3. The output file appears at the project root, named `worktree-switcher-<version>.vsix`, where `<version>` comes from the `version` field in `package.json` (for example `worktree-switcher-0.2.0.vsix`).

4. To install the built file into VS Code:
   ```
   code --install-extension worktree-switcher-<version>.vsix
   ```

## Known warning to ignore

`vsce package` prints:
```
WARNING  A 'repository' field is missing from the 'package.json' manifest file.
```
This is safe to ignore for local packaging and testing. Fix it later only if the extension will be published to the Marketplace — add a `repository` field to `package.json` pointing at the extension's git remote.

## Notes

- Do not add a separate `npm run compile` step before `npm run package` — it is redundant, since the `vscode:prepublish` hook already compiles.
- Each run overwrites the existing `.vsix` file for the same version. Bump `version` in `package.json` first if you want to keep an old build around.
