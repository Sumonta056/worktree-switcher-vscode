import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';

/**
 * Runs inside a real Extension Development Host (launched by
 * ../captureScreenshots.ts) and drives the extension's UI so we can grab
 * fresh macOS screenshots for the README. macOS only: relies on
 * `osascript` (window bounds, focus) and `screencapture`.
 */

function sh(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, (err, stdout, stderr) => {
            if (err) {
                reject(new Error((stderr || err.message).toString().trim()));
                return;
            }
            resolve(stdout.toString());
        });
    });
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function bringVSCodeToFront(): Promise<void> {
    await sh('osascript', [
        '-e',
        'tell application "System Events" to set frontmost of (first process whose name is "Code") to true'
    ]);
}

/** Returns the frontmost window's bounds as "x,y,w,h", in screen points. */
async function frontWindowBounds(): Promise<string> {
    const script = [
        'tell application "System Events"',
        '  set p to first process whose frontmost is true',
        '  set b to position of front window of p',
        '  set s to size of front window of p',
        'end tell',
        '((item 1 of b) as string) & "," & ((item 2 of b) as string) & "," & ((item 1 of s) as string) & "," & ((item 2 of s) as string)'
    ].join('\n');
    return (await sh('osascript', ['-e', script])).trim();
}

async function captureRegion(region: string, outFile: string): Promise<void> {
    await sh('screencapture', ['-x', '-R', region, outFile]);
}

/** Captures the whole VS Code window. */
async function captureWindow(outFile: string): Promise<void> {
    const bounds = await frontWindowBounds();
    await captureRegion(bounds, outFile);
}

/** Captures only the bottom strip of the window, where the status bar lives. */
async function captureStatusBarStrip(outFile: string): Promise<void> {
    const [x, y, w, h] = (await frontWindowBounds()).split(',').map(Number);
    const stripHeight = 32;
    const region = `${x},${y + h - stripHeight},${w},${stripHeight}`;
    await captureRegion(region, outFile);
}

/** Seeds the isolated test profile's recent-folders list with a few demo
 *  folders, via VS Code's internal recent-history command, so the Recent
 *  picker screenshot shows realistic content instead of being empty. */
async function seedRecentlyOpened(folderPaths: string[]): Promise<void> {
    for (const p of folderPaths) {
        await vscode.commands.executeCommand('_workbench.addToRecentlyOpened', {
            uri: vscode.Uri.file(p),
            type: 'folder'
        });
    }
}

export async function run(): Promise<void> {
    const outDir = process.env.CAPTURE_OUT_DIR;
    if (!outDir) {
        throw new Error('CAPTURE_OUT_DIR is not set — this suite must be launched via captureScreenshots.ts');
    }
    const demoRecentFolders: string[] = JSON.parse(process.env.CAPTURE_DEMO_RECENT_FOLDERS ?? '[]');

    // Let the window open and the extension activate/render before we touch it.
    await wait(2500);
    await bringVSCodeToFront();
    await wait(500);
    // Close the Chat panel and any first-run/notification toasts (e.g. the
    // "show Recent Folders in the status bar?" prompt) so screenshots show
    // only this extension's own UI.
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await vscode.commands.executeCommand('notifications.hideToasts');
    await seedRecentlyOpened(demoRecentFolders);
    await vscode.commands.executeCommand('worktreeSwitcher.refresh');
    await wait(300);
    await vscode.commands.executeCommand('notifications.hideToasts');

    await captureStatusBarStrip(path.join(outDir, 'status-bar.png'));

    await vscode.commands.executeCommand('worktreeSwitcher.switch');
    await wait(800);
    await vscode.commands.executeCommand('notifications.hideToasts');
    await captureWindow(path.join(outDir, 'worktree-picker.png'));
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await wait(300);

    await vscode.commands.executeCommand('worktreeSwitcher.openRecent');
    await wait(800);
    await vscode.commands.executeCommand('notifications.hideToasts');
    await captureWindow(path.join(outDir, 'recent-picker.png'));
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
}
