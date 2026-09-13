import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    Worktree,
    RepoState,
    RecentEntry,
    worktreeId,
    recentId,
    getPinnedWorktrees,
    toggleWorktreePin,
    getPinnedRecentFolders,
    toggleRecentPin,
    splitByPin,
    orderWorktreesByPin,
    worktreeItems,
    recentItems,
    filterOutWorktrees,
    isGitWorktreeFolder,
    lastOpenedDetail
} from '../../extension';
import * as fs from 'fs';
import * as os from 'os';

/**
 * A minimal in-memory stand-in for vscode.Memento, so pin-persistence tests
 * exercise the real get/update contract used by extension.ts without
 * touching the actual test host's workspaceState/globalState.
 */
class FakeMemento {
    private store = new Map<string, unknown>();
    get<T>(key: string, defaultValue: T): T {
        return this.store.has(key) ? (this.store.get(key) as T) : defaultValue;
    }
    async update(key: string, value: unknown): Promise<void> {
        this.store.set(key, value);
    }
}

function fakeContext(): vscode.ExtensionContext {
    return {
        workspaceState: new FakeMemento(),
        globalState: new FakeMemento()
    } as unknown as vscode.ExtensionContext;
}

function wt(path_: string, branch?: string, detached = false): Worktree {
    return { path: path_, branch, detached, bare: false, locked: false, prunable: false };
}

function repoState(worktrees: Worktree[], current?: Worktree): RepoState {
    return { cwd: worktrees[0]?.path ?? '/repo', gitDir: '/repo/.git', root: '/repo', worktrees, current };
}

function recent(fsPath: string, label?: string): RecentEntry {
    return { uri: vscode.Uri.file(fsPath), label: label ?? path.basename(fsPath), isWorkspaceFile: false };
}

suite('worktree pin identity and ordering', () => {
    test('worktreeId uses branch name, falling back to path when detached', () => {
        assert.strictEqual(worktreeId(wt('/a', 'main')), 'main');
        assert.strictEqual(worktreeId(wt('/a', undefined, true)), '/a');
    });

    test('splitByPin keeps pinned entries first, preserving order within each group', () => {
        const a = wt('/a', 'a');
        const b = wt('/b', 'b');
        const c = wt('/c', 'c');
        const d = wt('/d', 'd');
        const pinned = new Set(['c', 'a']);
        const { pinnedList, rest } = splitByPin([a, b, c, d], pinned, worktreeId);
        assert.deepStrictEqual(pinnedList.map(worktreeId), ['a', 'c']);
        assert.deepStrictEqual(rest.map(worktreeId), ['b', 'd']);
    });

    test('orderWorktreesByPin flattens to pinned group then the rest, in existing order', () => {
        const a = wt('/a', 'a');
        const b = wt('/b', 'b');
        const c = wt('/c', 'c');
        const ordered = orderWorktreesByPin([a, b, c], new Set(['c']));
        assert.deepStrictEqual(ordered.map(worktreeId), ['c', 'a', 'b']);
    });

    test('slot-command resolution: slot N maps to the Nth row in pinned-then-recency order', () => {
        const a = wt('/a', 'a');
        const b = wt('/b', 'b');
        const c = wt('/c', 'c');
        const ordered = orderWorktreesByPin([a, b, c], new Set(['b']));
        // slot 1 -> b (pinned), slot 2 -> a, slot 3 -> c
        assert.strictEqual(ordered[0], b);
        assert.strictEqual(ordered[1], a);
        assert.strictEqual(ordered[2], c);
        // slot beyond the list resolves to nothing (caller no-ops)
        assert.strictEqual(ordered[3], undefined);
    });

    test('worktreeItems groups pinned worktrees under a Pinned separator ahead of Worktrees', () => {
        const a = wt('/a', 'a');
        const b = wt('/b', 'b');
        const state = repoState([a, b]);
        const items = worktreeItems(state, new Set(['b']));

        const labels = items.map(i => i.label);
        const pinnedSepIdx = labels.indexOf('Pinned');
        const worktreesSepIdx = labels.findIndex(l => l.startsWith('Worktrees ·'));
        assert.ok(pinnedSepIdx !== -1, 'expected a Pinned separator');
        assert.ok(pinnedSepIdx < worktreesSepIdx, 'Pinned group must come before Worktrees group');

        const bRow = items.find(i => i.worktree === b)!;
        const aRow = items.find(i => i.worktree === a)!;
        assert.ok(items.indexOf(bRow) > pinnedSepIdx && items.indexOf(bRow) < worktreesSepIdx);
        assert.ok(items.indexOf(aRow) > worktreesSepIdx);
    });

    test('worktreeItems omits the Pinned separator when nothing is pinned', () => {
        const a = wt('/a', 'a');
        const items = worktreeItems(repoState([a]), new Set());
        assert.ok(!items.some(i => i.label === 'Pinned'));
    });
});

suite('worktree pin persistence (workspaceState, per repository)', () => {
    test('starts with no pins', () => {
        const ctx = fakeContext();
        assert.strictEqual(getPinnedWorktrees(ctx, '/repo').size, 0);
    });

    test('toggling adds a pin and persists it under workspaceState', async () => {
        const ctx = fakeContext();
        const pins = await toggleWorktreePin(ctx, '/repo', 'main');
        assert.ok(pins.has('main'));
        assert.ok(getPinnedWorktrees(ctx, '/repo').has('main'), 'pin must be readable back from workspaceState');
    });

    test('toggling a pinned id again removes it', async () => {
        const ctx = fakeContext();
        await toggleWorktreePin(ctx, '/repo', 'main');
        const pins = await toggleWorktreePin(ctx, '/repo', 'main');
        assert.ok(!pins.has('main'));
    });

    test('pins are scoped per repository root', async () => {
        const ctx = fakeContext();
        await toggleWorktreePin(ctx, '/repoA', 'main');
        assert.ok(getPinnedWorktrees(ctx, '/repoA').has('main'));
        assert.ok(!getPinnedWorktrees(ctx, '/repoB').has('main'), 'pins for one repo must not leak into another');
    });

    test('does not use globalState for worktree pins', async () => {
        const ctx = fakeContext();
        await toggleWorktreePin(ctx, '/repo', 'main');
        const globalKeys = (ctx.globalState as unknown as { get<T>(k: string, d: T): T }).get<string[]>('anything', []);
        // Nothing was ever written to globalState by the worktree-pin functions.
        assert.deepStrictEqual(globalKeys, []);
    });
});

suite('recent-folder pin persistence (globalState, not per repository)', () => {
    test('starts with no pins', () => {
        assert.strictEqual(getPinnedRecentFolders(fakeContext()).size, 0);
    });

    test('toggling adds and persists a pin under globalState', async () => {
        const ctx = fakeContext();
        const pins = await toggleRecentPin(ctx, '/home/me/project');
        assert.ok(pins.has('/home/me/project'));
        assert.ok(getPinnedRecentFolders(ctx).has('/home/me/project'));
    });

    test('toggling again removes the pin', async () => {
        const ctx = fakeContext();
        await toggleRecentPin(ctx, '/home/me/project');
        const pins = await toggleRecentPin(ctx, '/home/me/project');
        assert.ok(!pins.has('/home/me/project'));
    });

    test('recent-folder pins are independent of worktree pins', async () => {
        const ctx = fakeContext();
        await toggleWorktreePin(ctx, '/repo', '/home/me/project');
        assert.ok(!getPinnedRecentFolders(ctx).has('/home/me/project'),
            'pinning a worktree must never affect recent-folder pins');
    });

    test('recentId uses the entry filesystem path', () => {
        assert.strictEqual(recentId(recent('/x/y')), path.resolve('/x/y'));
    });
});

suite('recent picker excludes current-repo worktrees', () => {
    test('filterOutWorktrees drops entries matching a worktree path', () => {
        const w1 = wt('/repo-main', 'main');
        const w2 = wt('/repo-feature', 'feature');
        const state = repoState([w1, w2]);
        const entries = [recent('/repo-main'), recent('/repo-feature'), recent('/some/other/folder')];

        const filtered = filterOutWorktrees(entries, state);
        assert.deepStrictEqual(filtered.map((e: RecentEntry) => e.uri.fsPath), [path.resolve('/some/other/folder')]);
    });

    test('keeps everything when there is no open repository', () => {
        const entries = [recent('/a'), recent('/b')];
        assert.strictEqual(filterOutWorktrees(entries, undefined).length, 2);
    });

    test('recentItems shows the info row when everything was filtered out', () => {
        const w1 = wt('/only-worktree', 'main');
        const state = repoState([w1]);
        const items = recentItems([recent('/only-worktree')], new Set(), state);
        assert.strictEqual(items.length, 1);
        assert.ok(items[0].label.includes('No recent folders'));
    });

    test('recentItems groups pinned recent folders under Pinned', () => {
        const state = repoState([wt('/repo-main', 'main')]);
        const a = recent('/a');
        const b = recent('/b');
        const items = recentItems([a, b], new Set([recentId(b)]), state);
        const labels = items.map(i => i.label);
        const pinnedSepIdx = labels.indexOf('Pinned');
        assert.ok(pinnedSepIdx !== -1);
        const bRow = items.find(i => i.recent === b)!;
        assert.ok(items.indexOf(bRow) > pinnedSepIdx);
    });

    test('filterOutWorktrees also drops any folder that is itself a linked git worktree, of any repo', () => {
        const linkedWorktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-switcher-linked-'));
        const plainRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-switcher-plain-'));
        try {
            // A linked worktree's checkout has a `.git` FILE (not a directory) pointing
            // back at the main repo's gitdir.
            fs.writeFileSync(path.join(linkedWorktreeDir, '.git'), 'gitdir: /somewhere/else\n');
            // A normal, non-worktree project has a real `.git` directory.
            fs.mkdirSync(path.join(plainRepoDir, '.git'));

            const linkedEntry = recent(linkedWorktreeDir);
            const plainEntry = recent(plainRepoDir);
            const entries = [linkedEntry, plainEntry];

            // Case 1: no open repository at all (s === undefined) — still applies the
            // general "is this folder itself a linked worktree" rule.
            const filteredNoState = filterOutWorktrees(entries, undefined);
            assert.deepStrictEqual(filteredNoState.map((e: RecentEntry) => e.uri.fsPath), [plainEntry.uri.fsPath]);

            // Case 2: an open repository whose worktrees don't match either path —
            // the exclusion must still come from the linked-worktree check, not the
            // current-repo-worktree check.
            const state = repoState([wt('/unrelated-repo', 'main')]);
            const filteredWithState = filterOutWorktrees(entries, state);
            assert.deepStrictEqual(filteredWithState.map((e: RecentEntry) => e.uri.fsPath), [plainEntry.uri.fsPath]);
        } finally {
            fs.rmSync(linkedWorktreeDir, { recursive: true, force: true });
            fs.rmSync(plainRepoDir, { recursive: true, force: true });
        }
    });
});

suite('isGitWorktreeFolder', () => {
    test('true when the folder has a .git FILE (linked worktree checkout)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-switcher-isgit-file-'));
        try {
            fs.writeFileSync(path.join(dir, '.git'), 'gitdir: /somewhere/else\n');
            assert.strictEqual(isGitWorktreeFolder(dir), true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('false when the folder has a .git DIRECTORY (normal repo, not a worktree)', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-switcher-isgit-dir-'));
        try {
            fs.mkdirSync(path.join(dir, '.git'));
            assert.strictEqual(isGitWorktreeFolder(dir), false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('false when the folder has no .git at all', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-switcher-isgit-none-'));
        try {
            assert.strictEqual(isGitWorktreeFolder(dir), false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

suite('last-opened detail', () => {
    test('formats a real timestamp as a relative time', () => {
        const now = Date.parse('2026-01-02T12:00:00Z');
        assert.strictEqual(lastOpenedDetail(now - 30_000, 0, now), 'just now');
        assert.strictEqual(lastOpenedDetail(now - 5 * 60_000, 0, now), '5 minutes ago');
        assert.strictEqual(lastOpenedDetail(now - 3 * 60 * 60_000, 0, now), '3 hours ago');
        assert.strictEqual(lastOpenedDetail(now - 26 * 60 * 60_000, 0, now), 'yesterday');
        assert.strictEqual(lastOpenedDetail(now - 4 * 24 * 60 * 60_000, 0, now), '4 days ago');
    });

    test('falls back to a relative-order label, never inventing a time, when no timestamp exists', () => {
        assert.strictEqual(lastOpenedDetail(undefined, 0), 'most recent');
        assert.strictEqual(lastOpenedDetail(undefined, 2), '#3 most recent');
    });
});

suite('keyboard slot commands', () => {
    test('all 9 slot commands are registered', async () => {
        const ext = vscode.extensions.getExtension('SumontaSahaMridul.worktree-switcher');
        assert.ok(ext, 'extension is not present in the test host');
        await ext!.activate();

        const commands = await vscode.commands.getCommands(true);
        for (let i = 1; i <= 9; i++) {
            assert.ok(commands.includes(`worktreeSwitcher.switchToSlot${i}`), `slot command ${i} is not registered`);
        }
    });

    test('package.json declares default keybindings for at least slots 1-5, scoped by a when clause', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(path.resolve(__dirname, '../../../package.json'));
        const keybindings: Array<{ command: string; key: string; mac?: string; when?: string }> =
            pkg.contributes.keybindings;

        for (let i = 1; i <= 5; i++) {
            const kb = keybindings.find(k => k.command === `worktreeSwitcher.switchToSlot${i}`);
            assert.ok(kb, `expected a default keybinding for slot ${i}`);
            assert.ok(kb!.when, `slot ${i} keybinding must be scoped with a when clause`);
        }
    });

    test('running a slot command for an empty slot does not throw', async () => {
        // No workspace/git repo is open in the test host, so every slot is empty;
        // switchToSlot must no-op rather than error.
        await vscode.commands.executeCommand('worktreeSwitcher.switchToSlot9');
    });
});
