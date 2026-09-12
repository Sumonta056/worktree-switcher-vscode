import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension activation', () => {
    test('activates and registers all worktree commands', async () => {
        const ext = vscode.extensions.getExtension('SumontaSahaMridul.worktree-switcher');
        assert.ok(ext, 'extension is not present in the test host');

        await ext!.activate();

        const commands = await vscode.commands.getCommands(true);
        const expected = [
            'worktreeSwitcher.switch',
            'worktreeSwitcher.openRecent',
            'worktreeSwitcher.create',
            'worktreeSwitcher.remove',
            'worktreeSwitcher.refresh',
        ];

        for (const cmd of expected) {
            assert.ok(commands.includes(cmd), `command "${cmd}" is not registered`);
        }
    });
});
