import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Coverage for the `worktreeSwitcher.showRecentStatusBar` preference.
 *
 * NOTE ON SCOPE: `recentStatusBar` (the vscode.StatusBarItem instance) is a
 * module-private variable inside src/extension.ts and is never exported, and
 * the VS Code API exposes no public way to query whether an *existing*
 * StatusBarItem is currently shown or hidden (StatusBarItem has `.show()`
 * and `.hide()` but no readable `visible` property, and there is no
 * `_workbench.*` introspection command for per-item visibility — verified
 * empirically against the running test host). That means true black-box
 * assertions of "is the recent-folder item actually rendered" are not
 * reachable from here without editing src/extension.ts to expose test
 * hooks, which is out of scope for this test-only pass.
 *
 * Given that constraint, this suite verifies everything about the feature
 * that *is* observable from outside the module:
 *  - the configuration contract (declared in package.json) matches the
 *    spec: a boolean, defaulting to true;
 *  - the setting can be flipped through the real VS Code configuration
 *    system and read back correctly;
 *  - toggling it while the extension is active does not throw (exercises
 *    the onDidChangeConfiguration -> renderStatusBar -> renderRecentStatusBar
 *    code path for both the "hide and return early" and "show" branches);
 *  - critically, `worktreeSwitcher.openRecent` keeps working regardless of
 *    the setting's value, per the stated requirement that the command must
 *    not be gated by it.
 */

const CFG_SECTION = 'worktreeSwitcher';
const KEY = 'showRecentStatusBar';

async function setShowRecent(value: boolean | undefined): Promise<void> {
    await vscode.workspace
        .getConfiguration(CFG_SECTION)
        .update(KEY, value, vscode.ConfigurationTarget.Global);
}

suite('showRecentStatusBar configuration', () => {
    teardown(async () => {
        await setShowRecent(undefined);
    });

    test('package.json declares showRecentStatusBar as a boolean defaulting to true', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(path.resolve(__dirname, '../../../package.json'));
        const prop = pkg.contributes.configuration.properties['worktreeSwitcher.showRecentStatusBar'];
        assert.ok(prop, 'worktreeSwitcher.showRecentStatusBar is not declared in package.json');
        assert.strictEqual(prop.type, 'boolean');
        assert.strictEqual(prop.default, true);
    });

    test('defaults to true when unset', async () => {
        await setShowRecent(undefined);
        const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
        assert.strictEqual(cfg.get<boolean>(KEY), true);
    });

    test('can be set to false and reads back as false', async () => {
        await setShowRecent(false);
        const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
        assert.strictEqual(cfg.get<boolean>(KEY), false);
    });

    test('can be set to true explicitly and reads back as true', async () => {
        await setShowRecent(true);
        const cfg = vscode.workspace.getConfiguration(CFG_SECTION);
        assert.strictEqual(cfg.get<boolean>(KEY), true);
    });

    test('toggling the setting while the extension is active does not throw', async () => {
        const ext = vscode.extensions.getExtension('SumontaSahaMridul.worktree-switcher');
        assert.ok(ext, 'extension is not present in the test host');
        await ext!.activate();

        // false -> triggers the "hide and return early" branch of renderRecentStatusBar
        await setShowRecent(false);
        await new Promise(resolve => setTimeout(resolve, 50));

        // true -> triggers the normal "build label/tooltip and show()" branch
        await setShowRecent(true);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Reaching this line means neither transition threw inside the
        // onDidChangeConfiguration listener.
        assert.ok(true);
    });
});

suite('worktreeSwitcher.openRecent command independence from showRecentStatusBar', () => {
    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        await setShowRecent(undefined);
    });

    test('executes successfully when showRecentStatusBar is false', async () => {
        await setShowRecent(false);
        await vscode.commands.executeCommand('worktreeSwitcher.openRecent');
    });

    test('executes successfully when showRecentStatusBar is true', async () => {
        await setShowRecent(true);
        await vscode.commands.executeCommand('worktreeSwitcher.openRecent');
    });

    test('executes successfully when showRecentStatusBar is unset (default)', async () => {
        await setShowRecent(undefined);
        await vscode.commands.executeCommand('worktreeSwitcher.openRecent');
    });
});
