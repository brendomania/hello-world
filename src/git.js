import * as diff from 'diff';
import { Buffer } from 'buffer';

window.Buffer = window.Buffer || Buffer;

// eslint-disable-next-line no-undef
const git = window.git;

class MemoryFS {
    constructor() {
        this.files = new Map();
        this.dirs = new Set(['/']);
        this._initPromises();
    }

    _initPromises() {
        const self = this;
        this.promises = {
            async readFile(path, opts) {
                if (path === undefined || path === null) {
                    const err = new Error(`ENOENT: path is undefined`);
                    err.code = 'ENOENT';
                    throw err;
                }
                const normalizedPath = String(path).replace(/\/+/g, '/');
                const data = self.files.get(normalizedPath);
                if (data === undefined) {
                    const err = new Error(`ENOENT: no such file or directory, open '${normalizedPath}'`);
                    err.code = 'ENOENT';
                    throw err;
                }
                if (opts?.encoding === 'utf8') {
                    return new TextDecoder().decode(data);
                }
                return Buffer.from(data);
            },
            async writeFile(path, data) {
                if (path === undefined || path === null) return;
                const normalizedPath = String(path).replace(/\/+/g, '/');
                if (typeof data === 'string') {
                    data = new TextEncoder().encode(data);
                }
                self.files.set(normalizedPath, new Uint8Array(data));
                self._addParentDirs(normalizedPath);
            },
            async readdir(path) {
                if (path === undefined || path === null) return [];
                const normalizedPath = String(path).replace(/\/+$/, '') || '/';
                const prefix = normalizedPath === '/' ? '/' : normalizedPath + '/';
                const entries = new Set();

                for (const filePath of self.files.keys()) {
                    if (filePath.startsWith(prefix)) {
                        const rest = filePath.substring(prefix.length);
                        const name = rest.split('/')[0];
                        if (name) entries.add(name);
                    }
                }
                for (const dirPath of self.dirs) {
                    if (dirPath !== normalizedPath && dirPath.startsWith(prefix)) {
                        const rest = dirPath.substring(prefix.length);
                        const name = rest.split('/')[0];
                        if (name) entries.add(name);
                    }
                }
                return Array.from(entries);
            },
            async stat(path) {
                if (path === undefined || path === null) {
                    const err = new Error('ENOENT: path is undefined');
                    err.code = 'ENOENT';
                    throw err;
                }
                const normalizedPath = String(path).replace(/\/+$/, '') || '/';
                if (self.dirs.has(normalizedPath)) {
                    return { type: 'dir', mode: 0o40755, size: 0, ino: 0, mtimeMs: Date.now(), ctimeMs: Date.now(), isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false };
                }
                if (self.files.has(normalizedPath)) {
                    const data = self.files.get(normalizedPath);
                    return { type: 'file', mode: 0o100644, size: data.length, ino: 0, mtimeMs: Date.now(), ctimeMs: Date.now(), isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false };
                }
                const hasChildren = [...self.files.keys(), ...self.dirs].some(p => p.startsWith(normalizedPath + '/'));
                if (hasChildren) {
                    self.dirs.add(normalizedPath);
                    return { type: 'dir', mode: 0o40755, size: 0, ino: 0, mtimeMs: Date.now(), ctimeMs: Date.now(), isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false };
                }
                const err = new Error(`ENOENT: no such file or directory, stat '${normalizedPath}'`);
                err.code = 'ENOENT';
                throw err;
            },
            async lstat(path) {
                return self.promises.stat(path);
            },
            async mkdir(path) {
                if (path === undefined || path === null) return;
                const normalizedPath = String(path).replace(/\/+$/, '') || '/';
                self.dirs.add(normalizedPath);
            },
            async rmdir() { },
            async unlink(path) {
                self.files.delete(path);
            },
            async rename(oldPath, newPath) {
                const data = self.files.get(oldPath);
                if (data) {
                    self.files.set(newPath, data);
                    self.files.delete(oldPath);
                }
            },
            async readlink(path) {
                const err = new Error(`ENOENT: no such file or directory, readlink '${path}'`);
                err.code = 'ENOENT';
                throw err;
            },
            async symlink() { },
            async chmod() { },
        };
    }

    clear() {
        this.files.clear();
        this.dirs.clear();
        this.dirs.add('/');
    }

    _addParentDirs(filePath) {
        const parts = filePath.split('/').filter(Boolean);
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
            current += '/' + parts[i];
            this.dirs.add(current);
        }
    }

    readFile(path, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        this.promises.readFile(path, opts).then(data => cb(null, data)).catch(cb);
    }

    writeFile(path, data, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        this.promises.writeFile(path, data).then(() => cb(null)).catch(cb);
    }

    readdir(path, cb) {
        this.promises.readdir(path).then(entries => cb(null, entries)).catch(cb);
    }

    stat(path, cb) {
        this.promises.stat(path).then(stats => cb(null, stats)).catch(cb);
    }

    lstat(path, cb) {
        this.promises.lstat(path).then(stats => cb(null, stats)).catch(cb);
    }

    mkdir(path, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        this.promises.mkdir(path).then(() => cb(null)).catch(cb);
    }

    rmdir(path, cb) {
        this.promises.rmdir(path).then(() => cb(null)).catch(cb);
    }

    unlink(path, cb) {
        this.promises.unlink(path).then(() => cb(null)).catch(cb);
    }

    rename(oldPath, newPath, cb) {
        this.promises.rename(oldPath, newPath).then(() => cb(null)).catch(cb);
    }

    readlink(path, cb) {
        const err = new Error(`ENOENT: no such file or directory, readlink '${path}'`);
        err.code = 'ENOENT';
        cb(err);
    }

    symlink(target, path, cb) {
        cb(null);
    }

    chmod(path, mode, cb) {
        cb(null);
    }
}

const fs = new MemoryFS();
let gitCache = {};

export const loadFilesIntoFs = async (files) => {
    if (files.length === 0) return;

    fs.clear();
    gitCache = {};

    const rootPrefix = files[0].webkitRelativePath.split('/')[0];

    for (const file of files) {
        const relativePath = file.webkitRelativePath.substring(rootPrefix.length);
        if (!relativePath || relativePath === '/') continue;

        const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
        const arrayBuffer = await file.arrayBuffer();
        await fs.promises.writeFile(path, new Uint8Array(arrayBuffer));
    }
};

export const getBranches = async () => {
    try {
        const branches = await git.listBranches({ fs, dir: '/', cache: gitCache });
        return branches;
    } catch (err) {
        console.error("Error reading branches:", err);
        return [];
    }
};

const listTreeFiles = async (treeOid) => {
    const fileMap = {};

    const walkTree = async (oid, prefix) => {
        const { tree } = await git.readTree({ fs, dir: '/', oid, cache: gitCache });
        for (const entry of tree) {
            const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;
            if (entry.type === 'blob') {
                fileMap[fullPath] = entry.oid;
            } else if (entry.type === 'tree') {
                await walkTree(entry.oid, fullPath);
            }
        }
    };

    await walkTree(treeOid, '');
    return fileMap;
};

export const generateDiff = async (baseBranch, compareBranch) => {
    if (!baseBranch || !compareBranch) return [];

    const baseCommit = await git.resolveRef({ fs, dir: '/', ref: baseBranch, cache: gitCache });
    const compareCommit = await git.resolveRef({ fs, dir: '/', ref: compareBranch, cache: gitCache });

    if (baseCommit === compareCommit) return [];

    const { commit: baseCommitObj } = await git.readCommit({ fs, dir: '/', oid: baseCommit, cache: gitCache });
    const { commit: compareCommitObj } = await git.readCommit({ fs, dir: '/', oid: compareCommit, cache: gitCache });

    let baseFiles = {};
    let compareFiles = {};

    try {
        baseFiles = await listTreeFiles(baseCommitObj.tree);
    } catch (e) {
        console.error('Failed to read base tree:', e);
    }

    try {
        compareFiles = await listTreeFiles(compareCommitObj.tree);
    } catch (e) {
        console.error('Failed to read compare tree:', e);
    }

    const allPaths = new Set([...Object.keys(baseFiles), ...Object.keys(compareFiles)]);
    const diffResults = [];

    for (const filepath of allPaths) {
        const baseOid = baseFiles[filepath] || null;
        const compareOid = compareFiles[filepath] || null;

        if (baseOid === compareOid) continue;

        let status = 'modified';
        if (!baseOid) status = 'added';
        if (!compareOid) status = 'deleted';

        let baseText = '';
        let compareText = '';

        try {
            if (baseOid) {
                const { blob } = await git.readBlob({ fs, dir: '/', oid: baseOid, cache: gitCache });
                baseText = new TextDecoder().decode(blob);
            }
        } catch (e) {
            continue;
        }

        try {
            if (compareOid) {
                const { blob } = await git.readBlob({ fs, dir: '/', oid: compareOid, cache: gitCache });
                compareText = new TextDecoder().decode(blob);
            }
        } catch (e) {
            continue;
        }

        const isBinary = (text) => text.includes('\0');
        if (isBinary(baseText) || isBinary(compareText)) continue;

        const patch = diff.createPatch(filepath, baseText, compareText, baseBranch, compareBranch);
        const parsedPatch = diff.parsePatch(patch);

        if (parsedPatch.length > 0 && parsedPatch[0].hunks.length > 0) {
            diffResults.push({
                filename: filepath,
                status,
                hunks: parsedPatch[0].hunks
            });
        }
    }

    return diffResults;
};
