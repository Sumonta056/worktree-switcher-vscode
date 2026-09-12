import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { runTests } from '@vscode/test-electron';

/**
 * Orchestrator for automatic UI screenshot capture. Builds a throwaway git
 * repo with two worktrees, opens it in a real Extension Development Host,
 * and lets ./capture/index.ts drive the UI and save fresh PNGs into
 * images/. Invoked via `npm run capture:screenshots`, and from
 * .husky/pre-commit whenever src/extension.ts changes. macOS only.
 */

function git(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error((stderr || err.message).toString().trim()));
                return;
            }
            resolve(stdout.toString());
        });
    });
}

async function setupFixtureRepo(): Promise<{ tmpRoot: string; workspace: string }> {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wts-capture-'));
    const workspace = path.join(tmpRoot, 'demo');
    fs.mkdirSync(workspace);

    await git(['init', '-b', 'main'], workspace);
    await git(['config', 'user.email', 'demo@example.com'], workspace);
    await git(['config', 'user.name', 'Demo'], workspace);
    fs.writeFileSync(path.join(workspace, 'README.md'), '# demo\n');
    await git(['add', '.'], workspace);
    await git(['commit', '-m', 'initial commit'], workspace);
    await git(['branch', 'feature/payments'], workspace);
    await git(
        ['worktree', 'add', path.join(tmpRoot, 'demo-feature-payments'), 'feature/payments'],
        workspace
    );

    return { tmpRoot, workspace };
}

async function main(): Promise<void> {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './capture/index');
    const imagesDir = path.resolve(__dirname, '../../images');

    const { tmpRoot, workspace } = await setupFixtureRepo();
    try {
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [workspace],
            extensionTestsEnv: { ...process.env, CAPTURE_OUT_DIR: imagesDir }
        });
    } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
}

main().catch(err => {
    console.error('Failed to capture screenshots');
    console.error(err);
    process.exit(1);
});
