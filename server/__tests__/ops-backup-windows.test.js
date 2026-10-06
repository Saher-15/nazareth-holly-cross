import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ops/backup-windows.ps1 (the daily Windows task): rotation, failure handling and secrets, with a stand-in for
// server/scripts/backup.js so no database is involved. Windows only (it runs the real script with Windows PowerShell).
// NOT covered here: -Setup (it asks for the secret at a prompt) and -Register (it changes the PC's scheduled tasks).

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../ops/backup-windows.ps1');
const SECRET = 'mongodb://stub-user:S3cret-Stub-Pass@stub.example.net/nhc';
const day = 24 * 3600 * 1000;

let dir;
let serverDir;
let out;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nhc-ps-test-'));
  serverDir = path.join(dir, 'server');
  out = path.join(dir, 'backups');
  fs.mkdirSync(path.join(serverDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'package.json'), '{"type":"commonjs"}'); // whatever package.json sits above the temp folder must not decide
  // The stand-in: refuses without the address (so the test sees it was handed over), prints only a host, writes a
  // finished backup folder like the real script does.
  fs.writeFileSync(path.join(serverDir, 'scripts', 'backup.js'), `
    const fs = require('node:fs');
    const path = require('node:path');
    const out = process.argv[process.argv.indexOf('--out') + 1];
    if (process.env.STUB_FAIL === '1') { console.error('Backup FAILED: connection lost'); process.exit(1); }
    if (process.env.DATABASEURL !== ${JSON.stringify(SECRET)}) { console.error('no address handed over'); process.exit(3); }
    console.log('Database: stub.example.net/nhc');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\\..+/, '').replace('T', '-');
    const folder = path.join(out, 'nhc-backup-' + stamp);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'manifest.json'), '{}');
    console.log('Backup complete: ' + folder);
  `);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const run = (extra = [], env = {}) =>
  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-BackupFolder', out, '-ServerDir', serverDir, '-SecretFile', path.join(dir, 'none.dpapi'), ...extra], {
    encoding: 'utf8',
    env: { ...process.env, DATABASEURL: SECRET, ...env },
  });

// A backup folder of a given age.
function oldBackup(name, ageDays, { manifest = true } = {}) {
  const folder = path.join(out, name);
  fs.mkdirSync(folder, { recursive: true });
  if (manifest) fs.writeFileSync(path.join(folder, 'manifest.json'), '{}');
  const when = new Date(Date.now() - ageDays * day);
  fs.utimesSync(folder, when, when);
  return folder;
}
const folders = () => fs.readdirSync(out).filter((n) => n.startsWith('nhc-backup-')).sort();

describe.skipIf(process.platform !== 'win32')('ops/backup-windows.ps1', () => {
  it('runs the backup, logs it, writes LAST_OK, and never prints or logs the address', () => {
    const res = run();
    expect(res.status, res.stdout + res.stderr).toBe(0);
    expect(folders()).toHaveLength(1);
    expect(fs.readFileSync(path.join(out, 'LAST_OK.txt'), 'utf8')).toMatch(/nhc-backup-\d{8}-\d{6}/);
    const log = fs.readFileSync(path.join(out, 'backup.log'), 'utf8');
    expect(log).toMatch(/Backup starting/);
    expect(log).toMatch(/OK\s+nhc-backup-/);
    expect(log).toMatch(/Database: stub\.example\.net\/nhc/);
    for (const text of [res.stdout, res.stderr, log]) expect(text).not.toMatch(/S3cret|stub-user/);
  });

  it('removes backups older than 30 days, keeps the recent ones, and never touches a folder without a manifest', () => {
    oldBackup('nhc-backup-20200101-000000', 400);
    oldBackup('nhc-backup-20200201-000000', 100);
    oldBackup('nhc-backup-20201001-000000', 10);
    oldBackup('nhc-backup-20201002-000000', 1);
    const unfinished = oldBackup('nhc-backup-20190101-000000', 900, { manifest: false }); // not a complete backup: left alone
    const res = run(['-KeepDays', '30', '-KeepAtLeast', '2']);
    expect(res.status, res.stdout + res.stderr).toBe(0);
    const left = folders();
    expect(left).not.toContain('nhc-backup-20200101-000000');
    expect(left).not.toContain('nhc-backup-20200201-000000');
    expect(left).toContain('nhc-backup-20201001-000000');
    expect(left).toContain('nhc-backup-20201002-000000');
    expect(fs.existsSync(unfinished)).toBe(true);
    expect(left.some((n) => !/20(19|20)/.test(n))).toBe(true); // today's new backup
    expect(fs.readFileSync(path.join(out, 'backup.log'), 'utf8')).toMatch(/2 older than 30 days removed/);
  });

  it('never leaves fewer than -KeepAtLeast backups, however old they all are', () => {
    oldBackup('nhc-backup-20200101-000000', 500);
    oldBackup('nhc-backup-20200102-000000', 499);
    oldBackup('nhc-backup-20200103-000000', 498);
    const res = run(['-KeepDays', '30', '-KeepAtLeast', '3']);
    expect(res.status, res.stdout + res.stderr).toBe(0);
    // the new one plus the two newest old ones are the 3 kept
    expect(folders()).toHaveLength(3);
    expect(folders()).not.toContain('nhc-backup-20200101-000000');
  });

  it('a FAILED backup deletes nothing, exits 1, says why, and leaves a marker', () => {
    oldBackup('nhc-backup-20200101-000000', 400);
    const res = run(['-KeepDays', '30', '-KeepAtLeast', '1'], { STUB_FAIL: '1' });
    expect(res.status).toBe(1);
    expect(folders()).toEqual(['nhc-backup-20200101-000000']); // the old one is NOT removed when the new one failed
    expect(fs.readFileSync(path.join(out, 'LAST_FAILED.txt'), 'utf8')).toMatch(/backup\.js failed/);
    expect(fs.readFileSync(path.join(out, 'backup.log'), 'utf8')).toMatch(/FAILED/);
    expect(fs.existsSync(path.join(out, 'LAST_OK.txt'))).toBe(false);
  });

  it('a later success clears the failure marker', () => {
    expect(run([], { STUB_FAIL: '1' }).status).toBe(1);
    expect(fs.existsSync(path.join(out, 'LAST_FAILED.txt'))).toBe(true);
    expect(run().status).toBe(0);
    expect(fs.existsSync(path.join(out, 'LAST_FAILED.txt'))).toBe(false);
  });

  it('refuses to run without the database address, and says how to store it', () => {
    const res = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-BackupFolder', out, '-ServerDir', serverDir, '-SecretFile', path.join(dir, 'none.dpapi')], {
      encoding: 'utf8',
      env: { ...process.env, DATABASEURL: '' },
    });
    expect(res.status).toBe(1);
    expect(fs.readFileSync(path.join(out, 'backup.log'), 'utf8')).toMatch(/-Setup/);
  });

  it('reads the address from the DPAPI-encrypted file that -Setup writes (this user, this PC), and the file does not contain it', () => {
    const secretFile = path.join(dir, 'database-url.dpapi');
    const made = spawnSync('powershell.exe', ['-NoProfile', '-Command', `ConvertTo-SecureString $env:NHC_TEST_SECRET -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath '${secretFile}' -Encoding ASCII`], {
      encoding: 'utf8',
      env: { ...process.env, NHC_TEST_SECRET: SECRET },
    });
    expect(made.status, made.stderr).toBe(0);
    expect(fs.readFileSync(secretFile, 'utf8')).not.toContain('S3cret'); // encrypted, not just encoded
    const res = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-BackupFolder', out, '-ServerDir', serverDir, '-SecretFile', secretFile], {
      encoding: 'utf8',
      env: { ...process.env, DATABASEURL: '' }, // nothing in the environment: the file is used
    });
    expect(res.status, res.stdout + res.stderr).toBe(0);
    expect(folders()).toHaveLength(1);
    expect(res.stdout + res.stderr + fs.readFileSync(path.join(out, 'backup.log'), 'utf8')).not.toMatch(/S3cret|stub-user/);
  });

  it('removes an unfinished .partial folder left by a crash, once it is old', () => {
    const partial = oldBackup('nhc-backup-20200101-000000.partial', 5, { manifest: false });
    const fresh = oldBackup('nhc-backup-20201231-235959.partial', 0, { manifest: false });
    expect(run().status).toBe(0);
    expect(fs.existsSync(partial)).toBe(false);
    expect(fs.existsSync(fresh)).toBe(true); // maybe a backup in progress
  });

  it('the script source never takes the address from an argument and never echoes it', () => {
    const source = fs.readFileSync(script, 'utf8');
    expect(source).not.toMatch(/param\([\s\S]*\$DatabaseUrl/i);
    expect(source).toMatch(/DPAPI/);
    expect(source).toMatch(/-LogonType Interactive/); // signed in, like the owner's other tasks
    expect(source).toMatch(/StartWhenAvailable/);
    expect(/[^\x00-\x7f]/.test(source)).toBe(false); // plain ASCII: Windows PowerShell 5.1 reads a BOM-less file as ANSI
  });
});
