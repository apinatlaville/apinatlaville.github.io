/**
 * Application Mac : bundle .app, lanceur Chrome --app, même URL que le site publié.
 * Usage: node scripts/test-mac-app.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'mac-app', 'Mes Cours.app');
const liveUrl = 'https://apinatlaville.github.io/';

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

const plist = path.join(appRoot, 'Contents', 'Info.plist');
const exe = path.join(appRoot, 'Contents', 'MacOS', 'MesCours');
const icns = path.join(appRoot, 'Contents', 'Resources', 'AppIcon.icns');
const installer = path.join(root, 'mac-app', 'installer.command');
const readme = path.join(root, 'mac-app', 'LIRE-MOI.md');

assert(fs.existsSync(plist), 'Info.plist présent');
assert(fs.existsSync(exe), 'exécutable MesCours présent');
assert(fs.existsSync(icns), 'AppIcon.icns présent');
assert(fs.existsSync(installer), 'installer.command présent');
assert(fs.existsSync(readme), 'LIRE-MOI.md présent');

const plistTxt = read(plist);
assert(plistTxt.includes('io.github.apinatlaville.mescours'), 'identifiant bundle');
assert(plistTxt.includes('<string>MesCours</string>'), 'CFBundleExecutable = MesCours');
assert(plistTxt.includes('<string>Mes Cours</string>'), 'nom affiché Mes Cours');
assert(plistTxt.includes('AppIcon'), 'icône AppIcon');

const exeTxt = read(exe);
assert(exeTxt.startsWith('#!/bin/bash'), 'shebang bash');
assert(exeTxt.includes(liveUrl), 'URL du site publié');
assert(exeTxt.includes('--app='), 'mode Chrome --app (fenêtre dédiée)');
assert(exeTxt.includes('Google Chrome'), 'cherche Google Chrome');
assert(exeTxt.includes('Brave Browser'), 'cherche Brave');
assert(exeTxt.includes('Safari'), 'repli Safari');

const mode = fs.statSync(exe).mode;
assert((mode & 0o111) !== 0, 'MesCours est exécutable');
assert((fs.statSync(installer).mode & 0o111) !== 0, 'installer.command est exécutable');

const icnsBuf = fs.readFileSync(icns);
assert(icnsBuf.slice(0, 4).toString('ascii') === 'icns', 'magic icns');
assert(icnsBuf.length > 1000, 'icns non vide');

const installerTxt = read(installer);
assert(installerTxt.includes('/Applications/Mes Cours.app'), 'installe dans /Applications');
assert(!installerTxt.includes('rm -rf /'), 'pas de rm -rf dangereux');

const readmeTxt = read(readme);
assert(readmeTxt.includes('xattr -dr com.apple.quarantine'), 'LIRE-MOI : déblocage Gatekeeper (xattr)');
assert(readmeTxt.includes('Ne mets pas à la corbeille'), 'LIRE-MOI : ne pas jeter l’app bloquée');
assert(readmeTxt.includes('Ouvrir quand même'), 'LIRE-MOI : Réglages → Ouvrir quand même');

function dryRun(apps, extraEnv = {}) {
  const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mescours-apps-'));
  for (const name of apps) {
    fs.mkdirSync(path.join(fakeRoot, `${name}.app`), { recursive: true });
  }
  const env = {
    ...process.env,
    MESCOURS_DRY_RUN: '1',
    MESCOURS_APP_ROOT: fakeRoot,
    HOME: path.join(fakeRoot, '_home'),
    ...extraEnv,
  };
  const r = spawnSync('bash', [exe], { encoding: 'utf8', env });
  fs.rmSync(fakeRoot, { recursive: true, force: true });
  return r;
}

let r = dryRun(['Google Chrome']);
assert(r.status === 0, `dry-run Chrome exit 0 (got ${r.status}, ${r.stderr})`);
assert((r.stdout || '').includes('-na Google Chrome'), 'dry-run lance Chrome par nom');
assert((r.stdout || '').includes(`--app=${liveUrl}`), 'dry-run --app URL live');
assert(!(r.stdout || '').includes('Safari'), 'Chrome prioritaire sur Safari');

r = dryRun(['Brave Browser']);
assert((r.stdout || '').includes('-na Brave Browser'), 'dry-run Brave si pas de Chrome');
assert((r.stdout || '').includes(`--app=${liveUrl}`), 'Brave aussi en --app');

r = dryRun(['Safari']);
assert((r.stdout || '').includes('-a Safari'), 'repli Safari');
assert(!(r.stdout || '').includes('--app='), 'Safari n’utilise pas --app');
assert((r.stdout || '').includes(liveUrl), 'Safari ouvre l’URL live');

r = dryRun([]);
assert(r.status === 0, 'sans navigateur listé : exit 0');
assert((r.stdout || '').trim() === `open ${liveUrl}`, 'dernier recours : open URL');

r = dryRun(['Google Chrome'], { MESCOURS_URL: 'https://example.test/' });
assert((r.stdout || '').includes('--app=https://example.test/'), 'MESCOURS_URL surcharge l’URL');

const bashN = spawnSync('bash', ['-n', exe], { encoding: 'utf8' });
assert(bashN.status === 0, 'bash -n MesCours');
const bashN2 = spawnSync('bash', ['-n', installer], { encoding: 'utf8' });
assert(bashN2.status === 0, 'bash -n installer.command');

console.log(`\n${passed} ok, ${failed} échec`);
if (failed) {
  console.error(failures.map((m) => `  - ${m}`).join('\n'));
  process.exit(1);
}
