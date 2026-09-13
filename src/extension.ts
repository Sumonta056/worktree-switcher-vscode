import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';

export interface Worktree {
    path: string;
    head?: string;
    branch?: string;
    detached: boolean;
    bare: boolean;
    locked: boolean;
    prunable: boolean;
    /** Filled in lazily when the picker opens. */
    status?: WorktreeStatus;
}

interface WorktreeStatus {
    changes: number;
    ahead: number;
    behind: number;
}

export interface RepoState {
    cwd: string;
    gitDir: string;
    root: string;
    worktrees: Worktree[];
    current?: Worktree;
}

let worktreeStatusBar: vscode.StatusBarItem;
let recentStatusBar: vscode.StatusBarItem;
let headWatcher: fs.FSWatcher | undefined;
let state: RepoState | undefined;
let output: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;

// -------------------------------------------------------------------- pinning

/** Pin identity for a worktree: its branch name, or its path when detached. */
export function worktreeId(w: Worktree): string {
    return w.branch ?? w.path;
}

/** Pin identity for a recent-folder entry: its filesystem path. */
export function recentId(e: RecentEntry): string {
    return e.uri.fsPath;
}

function pinnedWorktreesKey(root: string): string {
    return `pinnedWorktrees:${root}`;
}

export function getPinnedWorktrees(context: vscode.ExtensionContext, root: string): Set<string> {
    return new Set(context.workspaceState.get<string[]>(pinnedWorktreesKey(root), []));
}

export async function toggleWorktreePin(
    context: vscode.ExtensionContext,
    root: string,
    id: string
): Promise<Set<string>> {
    const pins = getPinnedWorktrees(context, root);
    if (pins.has(id)) { pins.delete(id); } else { pins.add(id); }
    await context.workspaceState.update(pinnedWorktreesKey(root), [...pins]);
    return pins;
}

const RECENT_PINS_KEY = 'pinnedRecentFolders';

export function getPinnedRecentFolders(context: vscode.ExtensionContext): Set<string> {
    return new Set(context.globalState.get<string[]>(RECENT_PINS_KEY, []));
}

export async function toggleRecentPin(context: vscode.ExtensionContext, id: string): Promise<Set<string>> {
    const pins = getPinnedRecentFolders(context);
    if (pins.has(id)) { pins.delete(id); } else { pins.add(id); }
    await context.globalState.update(RECENT_PINS_KEY, [...pins]);
    return pins;
}

/** Pinned entries first (in existing order), then the rest (in existing order). */
export function splitByPin<T>(entries: T[], pinned: ReadonlySet<string>, idOf: (t: T) => string): { pinnedList: T[]; rest: T[] } {
    const pinnedList: T[] = [];
    const rest: T[] = [];
    for (const e of entries) {
        (pinned.has(idOf(e)) ? pinnedList : rest).push(e);
    }
    return { pinnedList, rest };
}

/** Full pinned-then-recency order, matching what the picker shows (used for keyboard slots). */
export function orderWorktreesByPin(worktrees: Worktree[], pinned: ReadonlySet<string>): Worktree[] {
    const { pinnedList, rest } = splitByPin(worktrees, pinned, worktreeId);
    return [...pinnedList, ...rest];
}

/** Human-readable last-opened detail. Uses a real timestamp when the data provides one; otherwise
 *  falls back to a relative-order label rather than inventing a time. */
export function lastOpenedDetail(timestampMs: number | undefined, index: number, now: number = Date.now()): string {
    if (typeof timestampMs === 'number' && Number.isFinite(timestampMs)) {
        const diffMs = now - timestampMs;
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        if (diffMs < minute) { return 'just now'; }
        if (diffMs < hour) { return `${Math.floor(diffMs / minute)} minutes ago`; }
        if (diffMs < day) { return `${Math.floor(diffMs / hour)} hours ago`; }
        if (diffMs < 2 * day) { return 'yesterday'; }
        return `${Math.floor(diffMs / day)} days ago`;
    }
    return index === 0 ? 'most recent' : `#${index + 1} most recent`;
}

// ---------------------------------------------------------------- git helpers

function git(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                const msg = (stderr || '').toString().trim() || err.message;
                output.appendLine(`git ${args.join(' ')}  ->  ${msg}`);
                reject(new Error(msg));
                return;
            }
            resolve(stdout.toString());
        });
    });
}

function shortBranch(ref: string): string {
    return ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '');
}

function parseWorktrees(porcelain: string): Worktree[] {
    const result: Worktree[] = [];
    let cur: Worktree | undefined;

    for (const rawLine of porcelain.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        if (line === '') {
            if (cur) { result.push(cur); cur = undefined; }
            continue;
        }
        const sep = line.indexOf(' ');
        const key = sep === -1 ? line : line.slice(0, sep);
        const value = sep === -1 ? '' : line.slice(sep + 1);

        switch (key) {
            case 'worktree':
                cur = { path: value, detached: false, bare: false, locked: false, prunable: false };
                break;
            case 'HEAD': if (cur) { cur.head = value; } break;
            case 'branch': if (cur) { cur.branch = shortBranch(value); } break;
            case 'detached': if (cur) { cur.detached = true; } break;
            case 'bare': if (cur) { cur.bare = true; } break;
            case 'locked': if (cur) { cur.locked = true; } break;
            case 'prunable': if (cur) { cur.prunable = true; } break;
        }
    }
    if (cur) { result.push(cur); }
    return result;
}

/** `git status --porcelain -b` in one shot: dirty count plus ahead/behind. */
async function loadStatus(worktreePath: string): Promise<WorktreeStatus | undefined> {
    try {
        const out = await git(['status', '--porcelain', '-b'], worktreePath);
        const lines = out.split(/\r?\n/).filter(l => l.length > 0);
        const header = lines.find(l => l.startsWith('##')) ?? '';
        const changes = lines.filter(l => !l.startsWith('##')).length;
        const ahead = Number(/ahead (\d+)/.exec(header)?.[1] ?? 0);
        const behind = Number(/behind (\d+)/.exec(header)?.[1] ?? 0);
        return { changes, ahead, behind };
    } catch {
        return undefined;
    }
}

function realPath(p: string): string {
    try { return fs.realpathSync.native(p); } catch { return path.resolve(p); }
}

function samePath(a: string, b: string): boolean {
    const x = realPath(a);
    const y = realPath(b);
    return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

function tildify(p: string): string {
    const home = os.homedir();
    return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p;
}

function currentFolder(): string | undefined {
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active && active.scheme === 'file') {
        const owner = vscode.workspace.getWorkspaceFolder(active);
        if (owner && owner.uri.scheme === 'file') { return owner.uri.fsPath; }
    }
    const folders = vscode.workspace.workspaceFolders?.filter(f => f.uri.scheme === 'file');
    if (folders && folders.length > 0) { return folders[0].uri.fsPath; }
    if (active && active.scheme === 'file') { return path.dirname(active.fsPath); }
    return undefined;
}

async function loadState(): Promise<RepoState | undefined> {
    const cwd = currentFolder();
    if (!cwd) { return undefined; }

    let gitDir: string;
    let topLevel: string;
    try {
        gitDir = (await git(['rev-parse', '--absolute-git-dir'], cwd)).trim();
        topLevel = (await git(['rev-parse', '--show-toplevel'], cwd)).trim();
    } catch {
        return undefined;
    }

    const worktrees = parseWorktrees(await git(['worktree', 'list', '--porcelain'], cwd));
    const current = worktrees.find(w => samePath(w.path, topLevel));
    return { cwd, gitDir, root: topLevel, worktrees, current };
}

// ------------------------------------------------------------------ status bar

function describe(w: Worktree): string {
    if (w.bare) { return '(bare)'; }
    if (w.branch) { return w.branch; }
    if (w.head) { return w.head.slice(0, 7); }
    return '(unknown)';
}

function renderWorktreeStatusBar(): void {
    void vscode.commands.executeCommand('setContext', 'worktreeSwitcher.hasRepo', !!state);
    if (!state || state.worktrees.length === 0) {
        worktreeStatusBar.hide();
        return;
    }

    const cfg = vscode.workspace.getConfiguration('worktreeSwitcher');
    const cur = state.current;
    const count = state.worktrees.length;
    const branch = cur ? describe(cur) : 'no worktree';
    const folder = cur ? path.basename(cur.path) : '';

    const template = cfg.get<string>('statusBarFormat', '$(git-branch) ${folder} (${branch}) · ${count} worktrees');
    worktreeStatusBar.text = template
        .replace(/\$\{branch\}/g, branch)
        .replace(/\$\{folder\}/g, folder)
        .replace(/\$\{count\}/g, String(count))
        .replace(/\$\{detached\}/g, cur?.detached ? ' (detached)' : '');

    worktreeStatusBar.backgroundColor = cur?.detached
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;

    const tip = new vscode.MarkdownString(undefined, true);
    tip.appendMarkdown(`$(git-branch) **Git Worktree Switcher**\n\n`);
    if (cur) {
        tip.appendMarkdown(`Branch &nbsp;&nbsp;**${describe(cur)}**${cur.detached ? ' _(detached)_' : ''}\n\n`);
        tip.appendMarkdown(`Folder &nbsp;&nbsp;\`${tildify(cur.path)}\`\n\n`);
    }
    tip.appendMarkdown(`---\n\n`);
    tip.appendMarkdown(`${count} worktree${count === 1 ? '' : 's'} in this repository\n\n`);
    tip.appendMarkdown(`_Click to switch worktree_`);
    worktreeStatusBar.tooltip = tip;
    worktreeStatusBar.show();
}

function renderRecentStatusBar(): void {
    const cfg = vscode.workspace.getConfiguration('worktreeSwitcher');
    if (!cfg.get<boolean>('showRecentStatusBar', true)) {
        recentStatusBar.hide();
        return;
    }
    recentStatusBar.text = cfg.get<string>('recentStatusBarFormat', '$(history) Recent');
    const tip = new vscode.MarkdownString(undefined, true);
    tip.appendMarkdown(`$(history) **Recent Folders**\n\n`);
    tip.appendMarkdown(`_Click to open a recent folder_`);
    recentStatusBar.tooltip = tip;
    recentStatusBar.show();
}

function renderStatusBar(): void {
    renderWorktreeStatusBar();
    renderRecentStatusBar();
}

function watchHead(): void {
    headWatcher?.close();
    headWatcher = undefined;
    if (!state) { return; }
    try {
        headWatcher = fs.watch(state.gitDir, (_e, filename) => {
            if (!filename || filename.toString() === 'HEAD') { void refresh(); }
        });
    } catch {
        // best effort; focus changes still refresh
    }
}

let refreshQueued = false;
async function refresh(): Promise<void> {
    if (refreshQueued) { return; }
    refreshQueued = true;
    setTimeout(async () => {
        refreshQueued = false;
        const previousGitDir = state?.gitDir;
        try { state = await loadState(); } catch { state = undefined; }
        renderStatusBar();
        if (state?.gitDir !== previousGitDir) { watchHead(); }
    }, 120);
}

async function refreshNow(): Promise<void> {
    try { state = await loadState(); } catch { state = undefined; }
    renderStatusBar();
}

// ------------------------------------------------------------------- switching

async function openFolderPath(target: vscode.Uri, forceNewWindow?: boolean): Promise<void> {
    const newWindow = forceNewWindow ??
        vscode.workspace.getConfiguration('worktreeSwitcher').get<boolean>('openInNewWindow', false);
    await vscode.commands.executeCommand('vscode.openFolder', target, {
        forceNewWindow: newWindow,
        forceReuseWindow: !newWindow
    });
}

async function openWorktree(target: Worktree, forceNewWindow?: boolean): Promise<void> {
    if (state?.current && samePath(target.path, state.current.path)) {
        vscode.window.setStatusBarMessage(`$(check) Already in ${describe(target)}`, 2500);
        return;
    }
    if (!fs.existsSync(target.path)) {
        vscode.window.showErrorMessage(`Worktree folder is missing: ${target.path}`);
        return;
    }
    await openFolderPath(vscode.Uri.file(target.path), forceNewWindow);
}

/** Opens the worktree at position `slot` (1-based) in the same pinned-then-recency
 *  order the picker shows. No-ops with a brief status bar message if the slot is empty. */
export async function switchToSlot(slot: number): Promise<void> {
    await refreshNow();
    if (!state) { return; }
    const pins = getPinnedWorktrees(extensionContext, state.root);
    const ordered = orderWorktreesByPin(state.worktrees, pins);
    const target = ordered[slot - 1];
    if (!target) {
        vscode.window.setStatusBarMessage(`$(info) No worktree in slot ${slot}`, 2500);
        return;
    }
    await openWorktree(target);
}

// ------------------------------------------------------------- recent folders

export interface RecentEntry {
    uri: vscode.Uri;
    label: string;
    isWorkspaceFile: boolean;
}

function toUri(raw: unknown): vscode.Uri | undefined {
    if (!raw) { return undefined; }
    if (raw instanceof vscode.Uri) { return raw; }
    const obj = raw as { scheme?: string; path?: string; fsPath?: string };
    try {
        if (obj.scheme) { return vscode.Uri.from(obj as never); }
    } catch { /* fall through */ }
    if (typeof obj.fsPath === 'string') { return vscode.Uri.file(obj.fsPath); }
    if (typeof obj.path === 'string') { return vscode.Uri.file(obj.path); }
    return undefined;
}

async function getRecentFolders(): Promise<RecentEntry[]> {
    let raw: { workspaces?: unknown[] } | undefined;
    try {
        raw = await vscode.commands.executeCommand('_workbench.getRecentlyOpened');
    } catch {
        return [];
    }
    const entries: RecentEntry[] = [];
    for (const item of raw?.workspaces ?? []) {
        const w = item as {
            folderUri?: unknown;
            workspace?: { configPath?: unknown };
            label?: string;
            remoteAuthority?: string;
        };
        if (w.remoteAuthority) { continue; }
        const uri = toUri(w.folderUri) ?? toUri(w.workspace?.configPath);
        if (!uri || uri.scheme !== 'file') { continue; }
        const isWorkspaceFile = !w.folderUri && !!w.workspace;
        entries.push({ uri, label: w.label ?? path.basename(uri.fsPath), isWorkspaceFile });
    }
    return entries;
}

// ---------------------------------------------------------------- quick picker

type Mode = 'worktrees' | 'recent';

export interface Item extends vscode.QuickPickItem {
    worktree?: Worktree;
    recent?: RecentEntry;
    action?: 'create' | 'remove' | 'prune' | 'recent' | 'back';
}

const newWindowButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('empty-window'),
    tooltip: 'Open in a new window'
};
const createButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('add'),
    tooltip: 'Create new worktree'
};
const refreshButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('refresh'),
    tooltip: 'Refresh'
};
const backButton: vscode.QuickInputButton = vscode.QuickInputButtons.Back;
const pinOnButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('pinned'),
    tooltip: 'Unpin'
};
const pinOffButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('pin'),
    tooltip: 'Pin to top'
};

function statusBadge(w: Worktree): string {
    if (!w.status) { return ''; }
    const bits: string[] = [];
    if (w.status.changes > 0) { bits.push(`$(circle-filled) ${w.status.changes}`); }
    if (w.status.ahead > 0) { bits.push(`$(arrow-up)${w.status.ahead}`); }
    if (w.status.behind > 0) { bits.push(`$(arrow-down)${w.status.behind}`); }
    if (bits.length === 0) { bits.push('$(check) clean'); }
    return bits.join('  ');
}

function worktreeRow(w: Worktree, s: RepoState, isPinned: boolean): Item {
    const isCurrent = !!s.current && samePath(w.path, s.current.path);
    const flags: string[] = [];
    if (w.detached) { flags.push('detached'); }
    if (w.locked) { flags.push('$(lock) locked'); }
    if (w.prunable) { flags.push('$(warning) prunable'); }
    if (w.bare) { flags.push('bare'); }

    const badge = statusBadge(w);
    const detailBits = [`$(folder) ${tildify(w.path)}`];
    if (badge) { detailBits.push(badge); }
    if (flags.length) { detailBits.push(flags.join(' · ')); }

    const pinButton = isPinned ? pinOnButton : pinOffButton;

    return {
        label: `${isCurrent ? '$(target)' : '$(git-branch)'} ${describe(w)}`,
        description: isCurrent ? 'current worktree' : '',
        detail: detailBits.join('   ·   '),
        worktree: w,
        buttons: isCurrent ? [pinButton] : [pinButton, newWindowButton],
        alwaysShow: isCurrent
    };
}

export function worktreeItems(s: RepoState, pinned: ReadonlySet<string>): Item[] {
    const items: Item[] = [];
    const { pinnedList, rest } = splitByPin(s.worktrees, pinned, worktreeId);

    if (pinnedList.length > 0) {
        items.push({ label: 'Pinned', kind: vscode.QuickPickItemKind.Separator });
        for (const w of pinnedList) { items.push(worktreeRow(w, s, true)); }
    }

    items.push({ label: `Worktrees · ${rest.length}`, kind: vscode.QuickPickItemKind.Separator });
    for (const w of rest) { items.push(worktreeRow(w, s, false)); }

    items.push({ label: 'Manage', kind: vscode.QuickPickItemKind.Separator });
    items.push({ label: '$(add) Create new worktree...', action: 'create' });
    items.push({ label: '$(trash) Remove a worktree...', action: 'remove' });
    items.push({ label: '$(clear-all) Prune stale worktrees', action: 'prune' });
    return items;
}

function recentRow(e: RecentEntry, s: RepoState | undefined, isPinned: boolean, index: number): Item {
    const isCurrent = !!s && samePath(e.uri.fsPath, s.root);
    const icon = e.isWorkspaceFile ? '$(file-code)' : '$(folder)';
    const missing = !e.isWorkspaceFile && !fs.existsSync(e.uri.fsPath);
    const timeDetail = lastOpenedDetail(undefined, index);
    const pinButton = isPinned ? pinOnButton : pinOffButton;

    return {
        label: `${icon} ${e.label}`,
        description: isCurrent ? 'current' : '',
        detail: `${missing ? '$(warning) missing · ' : ''}${tildify(e.uri.fsPath)} · ${timeDetail}`,
        recent: e,
        buttons: [pinButton, newWindowButton]
    };
}

/** Excludes entries whose path is a worktree of the currently open repository —
 *  those already have a home in the Worktree picker (see requirement: two
 *  separate features, no duplicate entries). */
export function filterOutCurrentRepoWorktrees(entries: RecentEntry[], s: RepoState | undefined): RecentEntry[] {
    if (!s) { return entries; }
    return entries.filter(e => !s.worktrees.some(w => samePath(w.path, e.uri.fsPath)));
}

export function recentItems(entries: RecentEntry[], pinned: ReadonlySet<string>, s: RepoState | undefined): Item[] {
    const filtered = filterOutCurrentRepoWorktrees(entries, s);
    if (filtered.length === 0) {
        return [{ label: '$(info) No recent folders', alwaysShow: true }];
    }
    const items: Item[] = [];
    const { pinnedList, rest } = splitByPin(filtered, pinned, recentId);

    if (pinnedList.length > 0) {
        items.push({ label: 'Pinned', kind: vscode.QuickPickItemKind.Separator });
        pinnedList.forEach((e, i) => items.push(recentRow(e, s, true, i)));
    }

    items.push({ label: `Recent folders · ${rest.length}`, kind: vscode.QuickPickItemKind.Separator });
    rest.forEach((e, i) => items.push(recentRow(e, s, false, i)));
    return items;
}

async function showSwitcher(initialMode: Mode = 'worktrees'): Promise<void> {
    await refreshNow();
    if (!state && initialMode === 'worktrees') {
        vscode.window.showWarningMessage('No git repository found in this window.');
        return;
    }

    const pick = vscode.window.createQuickPick<Item>();
    let mode: Mode = initialMode;
    let recents: RecentEntry[] | undefined;
    let disposed = false;

    const render = async (): Promise<void> => {
        if (disposed) { return; }
        if (mode === 'worktrees' && state) {
            pick.title = `Git worktrees — ${path.basename(state.worktrees[0]?.path ?? state.root)}`;
            pick.placeholder = 'Pick a worktree to open in this window';
            pick.buttons = [createButton, refreshButton];
            pick.items = worktreeItems(state, getPinnedWorktrees(extensionContext, state.root));
        } else {
            pick.title = 'Open recent folder';
            pick.placeholder = 'Pick a folder to open in this window';
            pick.buttons = [backButton, refreshButton];
            if (!recents) {
                pick.busy = true;
                recents = await getRecentFolders();
                pick.busy = false;
            }
            pick.items = recentItems(recents, getPinnedRecentFolders(extensionContext), state);
        }
    };

    // Load dirty/ahead/behind in the background, then repaint.
    const enrich = async (): Promise<void> => {
        if (!state) { return; }
        const cfg = vscode.workspace.getConfiguration('worktreeSwitcher');
        if (!cfg.get<boolean>('showWorktreeStatus', true)) { return; }
        pick.busy = true;
        await Promise.all(
            state.worktrees.map(async w => { w.status = await loadStatus(w.path); })
        );
        pick.busy = false;
        if (!disposed && mode === 'worktrees') {
            const active = pick.activeItems[0];
            pick.items = worktreeItems(state, getPinnedWorktrees(extensionContext, state.root));
            const again = pick.items.find(i => i.worktree && active?.worktree &&
                samePath(i.worktree.path, active.worktree.path));
            if (again) { pick.activeItems = [again]; }
        }
    };

    pick.onDidTriggerButton(async b => {
        if (b === backButton) { mode = 'worktrees'; await render(); }
        else if (b === refreshButton) { recents = undefined; await refreshNow(); await render(); void enrich(); }
        else if (b === createButton) { pick.hide(); await createWorktree(); }
    });

    pick.onDidTriggerItemButton(async e => {
        if (e.button === pinOnButton || e.button === pinOffButton) {
            if (e.item.worktree && state) {
                await toggleWorktreePin(extensionContext, state.root, worktreeId(e.item.worktree));
            } else if (e.item.recent) {
                await toggleRecentPin(extensionContext, recentId(e.item.recent));
            }
            await render();
            return;
        }
        if (e.button !== newWindowButton) { return; }
        pick.hide();
        if (e.item.worktree) { await openWorktree(e.item.worktree, true); }
        else if (e.item.recent) { await openFolderPath(e.item.recent.uri, true); }
    });

    pick.onDidAccept(async () => {
        const item = pick.selectedItems[0];
        if (!item) { return; }

        if (item.action === 'recent') { mode = 'recent'; await render(); return; }
        if (item.action === 'back') { mode = 'worktrees'; await render(); return; }

        pick.hide();
        if (item.worktree) { await openWorktree(item.worktree); return; }
        if (item.recent) {
            if (state && samePath(item.recent.uri.fsPath, state.root)) {
                vscode.window.setStatusBarMessage('$(check) Already open', 2500);
                return;
            }
            await openFolderPath(item.recent.uri);
            return;
        }
        switch (item.action) {
            case 'create': await createWorktree(); break;
            case 'remove': await removeWorktree(); break;
            case 'prune': await pruneWorktrees(); break;
        }
    });

    pick.onDidHide(() => { disposed = true; pick.dispose(); });

    await render();
    pick.show();
    void enrich();
}

// --------------------------------------------------------------- create/remove

function slug(branch: string): string {
    return branch.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function listBranches(cwd: string): Promise<{ local: string[]; remote: string[] }> {
    const out = await git(
        ['for-each-ref', '--format=%(refname)', '--sort=-committerdate', 'refs/heads', 'refs/remotes'],
        cwd
    );
    const local: string[] = [];
    const remote: string[] = [];
    for (const line of out.split(/\r?\n/)) {
        if (!line) { continue; }
        if (line.startsWith('refs/heads/')) { local.push(shortBranch(line)); }
        else if (line.startsWith('refs/remotes/') && !line.endsWith('/HEAD')) { remote.push(shortBranch(line)); }
    }
    return { local, remote };
}

interface BranchItem extends vscode.QuickPickItem {
    branch?: string;
    remote?: boolean;
    createNew?: boolean;
}

async function createWorktree(): Promise<void> {
    await refreshNow();
    if (!state) { return; }
    const s = state;
    const used = new Set(s.worktrees.map(w => w.branch).filter(Boolean) as string[]);

    let branches: { local: string[]; remote: string[] };
    try {
        branches = await listBranches(s.cwd);
    } catch (e) {
        vscode.window.showErrorMessage(`Could not list branches: ${(e as Error).message}`);
        return;
    }

    const items: BranchItem[] = [
        { label: '$(add) Create a new branch...', createNew: true, alwaysShow: true },
        { label: 'Local branches', kind: vscode.QuickPickItemKind.Separator }
    ];
    for (const b of branches.local) {
        items.push({
            label: `$(git-branch) ${b}`,
            description: used.has(b) ? '$(warning) already checked out in a worktree' : undefined,
            branch: b
        });
    }
    if (branches.remote.length > 0) {
        items.push({ label: 'Remote branches', kind: vscode.QuickPickItemKind.Separator });
        for (const b of branches.remote) {
            items.push({ label: `$(cloud) ${b}`, branch: b, remote: true });
        }
    }

    const picked = await vscode.window.showQuickPick(items, {
        title: 'New worktree — pick a branch',
        placeHolder: 'Branch to check out in the new worktree'
    });
    if (!picked) { return; }

    let branchName: string;
    let createArgs: string[];

    if (picked.createNew) {
        const name = await vscode.window.showInputBox({
            title: 'New branch name',
            placeHolder: 'feature/my-thing',
            validateInput: v => (v && v.trim() ? undefined : 'Branch name is required')
        });
        if (!name) { return; }
        branchName = name.trim();
        createArgs = ['-b', branchName];
    } else if (picked.remote) {
        const local = picked.branch!.replace(/^[^/]+\//, '');
        branchName = local;
        createArgs = used.has(local) ? [] : ['-b', local];
    } else {
        branchName = picked.branch!;
        createArgs = [];
    }

    const configuredParent = vscode.workspace
        .getConfiguration('worktreeSwitcher')
        .get<string>('newWorktreeParentDir', '')
        .trim();
    const mainPath = s.worktrees[0]?.path ?? s.cwd;
    const parent = configuredParent || path.dirname(mainPath);
    const suggestion = path.join(parent, `${path.basename(mainPath)}-${slug(branchName)}`);

    const targetPath = await vscode.window.showInputBox({
        title: 'New worktree folder',
        value: suggestion,
        valueSelection: [suggestion.length - slug(branchName).length, suggestion.length],
        validateInput: v => {
            if (!v.trim()) { return 'A folder path is required'; }
            if (fs.existsSync(v.trim())) { return 'That path already exists'; }
            return undefined;
        }
    });
    if (!targetPath) { return; }

    const args = ['worktree', 'add', ...createArgs, targetPath.trim()];
    if (createArgs.length === 0) { args.push(branchName); }
    else if (picked.remote) { args.push(picked.branch!); }

    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Creating worktree for ${branchName}...` },
            () => git(args, s.cwd)
        );
    } catch (e) {
        vscode.window.showErrorMessage(`git worktree add failed: ${(e as Error).message}`);
        return;
    }

    await refreshNow();
    const open = await vscode.window.showInformationMessage(
        `Worktree created for ${branchName}.`,
        'Open in this window',
        'Open in new window'
    );
    if (open) {
        await openWorktree(
            { path: targetPath.trim(), branch: branchName, detached: false, bare: false, locked: false, prunable: false },
            open === 'Open in new window'
        );
    }
}

async function removeWorktree(): Promise<void> {
    await refreshNow();
    if (!state) { return; }
    const s = state;

    const candidates = s.worktrees.filter(w => !(s.current && samePath(w.path, s.current.path)) && !w.bare);
    if (candidates.length === 0) {
        vscode.window.showInformationMessage('No other worktrees to remove.');
        return;
    }

    const picked = await vscode.window.showQuickPick(
        candidates.map(w => ({
            label: `$(git-branch) ${describe(w)}`,
            detail: `$(folder) ${tildify(w.path)}`,
            worktree: w
        })),
        { title: 'Remove worktree', placeHolder: 'This deletes the worktree folder' }
    );
    if (!picked) { return; }

    const confirm = await vscode.window.showWarningMessage(
        `Remove worktree ${describe(picked.worktree)}?`,
        { modal: true, detail: picked.worktree.path },
        'Remove'
    );
    if (confirm !== 'Remove') { return; }

    try {
        await git(['worktree', 'remove', picked.worktree.path], s.cwd);
    } catch (e) {
        const force = await vscode.window.showWarningMessage(
            `Removal failed: ${(e as Error).message}`,
            { modal: true, detail: 'The worktree may have uncommitted changes or untracked files.' },
            'Force remove'
        );
        if (force !== 'Force remove') { return; }
        try {
            await git(['worktree', 'remove', '--force', picked.worktree.path], s.cwd);
        } catch (e2) {
            vscode.window.showErrorMessage(`Force removal failed: ${(e2 as Error).message}`);
            return;
        }
    }
    await refreshNow();
    vscode.window.setStatusBarMessage('$(check) Worktree removed', 2500);
}

async function pruneWorktrees(): Promise<void> {
    if (!state) { return; }
    try {
        const out = await git(['worktree', 'prune', '-v'], state.cwd);
        await refreshNow();
        vscode.window.showInformationMessage(out.trim() || 'Nothing to prune.');
    } catch (e) {
        vscode.window.showErrorMessage(`Prune failed: ${(e as Error).message}`);
    }
}

// -------------------------------------------------------------------- activate

export function activate(context: vscode.ExtensionContext): void {
    extensionContext = context;
    output = vscode.window.createOutputChannel('Worktree Switcher');

    const cfg = vscode.workspace.getConfiguration('worktreeSwitcher');
    const alignmentOf = (key: string, fallback: 'left' | 'right'): vscode.StatusBarAlignment =>
        cfg.get<string>(key, fallback) === 'right' ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left;

    worktreeStatusBar = vscode.window.createStatusBarItem(
        'worktreeSwitcher.status',
        alignmentOf('statusBarAlignment', 'left'),
        cfg.get<number>('statusBarPriority', 100)
    );
    worktreeStatusBar.name = 'Git Worktree Switcher';
    worktreeStatusBar.command = 'worktreeSwitcher.switch';

    recentStatusBar = vscode.window.createStatusBarItem(
        'worktreeSwitcher.recent',
        alignmentOf('recentStatusBarAlignment', 'left'),
        cfg.get<number>('recentStatusBarPriority', 101)
    );
    recentStatusBar.name = 'Recent Folders';
    recentStatusBar.command = 'worktreeSwitcher.openRecent';

    context.subscriptions.push(
        output,
        worktreeStatusBar,
        recentStatusBar,
        vscode.commands.registerCommand('worktreeSwitcher.switch', () => showSwitcher('worktrees')),
        vscode.commands.registerCommand('worktreeSwitcher.openRecent', () => showSwitcher('recent')),
        vscode.commands.registerCommand('worktreeSwitcher.create', createWorktree),
        vscode.commands.registerCommand('worktreeSwitcher.remove', removeWorktree),
        vscode.commands.registerCommand('worktreeSwitcher.refresh', refreshNow),
        vscode.window.onDidChangeActiveTextEditor(() => void refresh()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => void refresh()),
        vscode.window.onDidChangeWindowState(e => { if (e.focused) { void refresh(); } }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('worktreeSwitcher')) { renderStatusBar(); }
        }),
        { dispose: () => headWatcher?.close() }
    );

    for (let slot = 1; slot <= 9; slot++) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`worktreeSwitcher.switchToSlot${slot}`, () => switchToSlot(slot))
        );
    }

    void refreshNow();
    void maybeAskAboutRecentStatusBar(context);
}

const RECENT_PREF_ASKED_KEY = 'worktreeSwitcher.askedRecentPref';

async function maybeAskAboutRecentStatusBar(context: vscode.ExtensionContext): Promise<void> {
    if (context.globalState.get<boolean>(RECENT_PREF_ASKED_KEY)) {
        return;
    }
    const choice = await vscode.window.showInformationMessage(
        'Worktree Switcher can show a "Recent Folders" item in the status bar. Show it?',
        'Show it',
        'Hide it'
    );
    await context.globalState.update(RECENT_PREF_ASKED_KEY, true);
    if (choice === 'Hide it') {
        await vscode.workspace.getConfiguration('worktreeSwitcher')
            .update('showRecentStatusBar', false, vscode.ConfigurationTarget.Global);
        renderRecentStatusBar();
    }
    // "Show it", or the prompt dismissed with no choice, keeps the default (true) as-is.
}

export function deactivate(): void {
    headWatcher?.close();
}
