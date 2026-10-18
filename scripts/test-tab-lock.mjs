/**
 * Verrou entre onglets (tab-lock.js) : un seul onglet actif par profil.
 * Usage: node scripts/test-tab-lock.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'tab-lock.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0));

function makeStore() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); }
  };
}

function makeBus() {
  const chans = new Set();
  class FakeBC {
    constructor(name) { this.name = name; this.onmessage = null; chans.add(this); }
    postMessage(data) {
      const msg = JSON.parse(JSON.stringify(data));
      chans.forEach((c) => {
        if (c !== this && c.name === this.name && c.onmessage) setTimeout(() => c.onmessage({ data: msg }), 1);
      });
    }
    close() { chans.delete(this); }
  }
  return FakeBC;
}

function makeTab(shared, opts) {
  opts = opts || {};
  const listeners = {};
  const body = { children: [], appendChild(el) { this.children.push(el); el.parentNode = body; }, removeChild(el) { this.children = this.children.filter((x) => x !== el); } };
  const doc = {
    body,
    createElement() {
      return { style: {}, setAttribute() {}, appendChild() {}, parentNode: null };
    }
  };
  const win = {
    _events: [],
    _flushed: [],
    _reloaded: false,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatch(type, ev) { (listeners[type] || []).forEach((fn) => fn(ev || {})); },
    recordDataEvent(code, detail) { win._events.push({ code, detail }); },
    flushCloudOnHide(reason) { win._flushed.push(reason); }
  };
  const session = opts.session || makeStore();
  const sandbox = {
    window: win,
    document: doc,
    localStorage: shared.local,
    sessionStorage: session,
    BroadcastChannel: opts.noBC ? undefined : shared.BC,
    location: { reload() { win._reloaded = true; } },
    console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise
  };
  vm.runInNewContext(code, sandbox, { filename: 'tab-lock.js' });
  win.session = session;
  win.overlayCount = () => body.children.length;
  return win;
}

async function testSecondTabLocked() {
  console.log('\n· 2e onglet du même profil : lecture seule + Prendre la main');
  const shared = { local: makeStore(), BC: makeBus() };
  const A = makeTab(shared);
  const stA = await A.TabLock.start('principal');
  assert(stA === 'owner', 'onglet A propriétaire');
  assert(A.TabLock.isReadOnly() === false, 'A peut enregistrer');
  const B = makeTab(shared);
  const stB = await B.TabLock.start('principal');
  assert(stB === 'locked', 'onglet B verrouillé');
  assert(B.TabLock.isReadOnly() === true, 'B en lecture seule');
  assert(B.overlayCount() === 1, 'B affiche « Déjà ouvert dans un autre onglet »');
  assert(B._events.some((e) => e.code === 'TAB_LOCKED'), 'B : événement TAB_LOCKED');

  const tTake = Date.now();
  await B.TabLock.takeOver();
  assert(B._reloaded === true, 'Prendre la main recharge l’onglet (données fraîches)');
  assert(A.TabLock.getState() === 'lost', 'A a lâché la main AVANT le rechargement de B');
  assert(Date.now() - tTake < 1500, 'B recharge dès que A confirme (yielded), sans attendre le délai max');
  const B2 = makeTab(shared, { session: B.session });
  const stB2 = await B2.TabLock.start('principal');
  assert(stB2 === 'owner', 'après rechargement : B propriétaire');
  assert(B2._events.some((e) => e.code === 'TAB_TAKEOVER'), 'B : événement TAB_TAKEOVER');
  await tick(20);
  assert(A.TabLock.getState() === 'lost', 'A a perdu la main');
  assert(A.TabLock.isReadOnly() === true, 'A passe en lecture seule');
  assert(A._flushed.includes('tab-lost'), 'A envoie ses données au cloud avant de lâcher');
  assert(A.overlayCount() === 1, 'A affiche le message de perte de main');
}

async function testProfilesIndependent() {
  console.log('\n· profils différents : pas de verrou croisé');
  const shared = { local: makeStore(), BC: makeBus() };
  const A = makeTab(shared);
  await A.TabLock.start('principal');
  const B = makeTab(shared);
  const st = await B.TabLock.start('test');
  assert(st === 'owner', 'profil test ouvert librement à côté du principal');
  assert(A.TabLock.getState() === 'owner', 'principal non affecté');
}

async function testCloseReleases() {
  console.log('\n· fermeture de l’onglet propriétaire : profil libéré');
  const shared = { local: makeStore(), BC: makeBus() };
  const A = makeTab(shared);
  await A.TabLock.start('principal');
  assert(!!shared.local.getItem('mc_tab_owner__principal'), 'clé propriétaire posée');
  A.dispatch('pagehide');
  assert(shared.local.getItem('mc_tab_owner__principal') == null, 'clé propriétaire retirée à la fermeture');
}

async function testFrozenTabMissedClaim() {
  console.log('\n· onglet gelé qui a manqué le « claim » : la clé propriétaire fait foi');
  const shared = { local: makeStore(), BC: makeBus() };
  const A = makeTab(shared);
  await A.TabLock.start('principal');
  shared.local.setItem('mc_tab_owner__principal', JSON.stringify({ tabId: 'Tautre', at: Date.now() }));
  assert(A.TabLock.isReadOnly() === true, 'A détecte un autre propriétaire avant d’enregistrer');
  assert(A.TabLock.getState() === 'lost', 'A passe en « perdu »');
  assert(JSON.parse(shared.local.getItem('mc_tab_owner__principal')).tabId === 'Tautre', 'A n’écrase pas la clé du nouveau propriétaire');
}

async function testBfcacheReload() {
  console.log('\n· retour par l’historique (bfcache) : rechargement');
  const shared = { local: makeStore(), BC: makeBus() };
  const A = makeTab(shared);
  await A.TabLock.start('principal');
  A.dispatch('pagehide');
  A.dispatch('pageshow', { persisted: true });
  assert(A._reloaded === true, 'page restaurée depuis le bfcache rechargée');
}

async function testNoBroadcastFallback() {
  console.log('\n· sans BroadcastChannel : repli sur la clé propriétaire');
  const shared = { local: makeStore(), BC: makeBus() };
  const A = makeTab(shared, { noBC: true });
  await A.TabLock.start('principal');
  const B = makeTab(shared, { noBC: true });
  const st = await B.TabLock.start('principal');
  assert(st === 'locked', 'propriétaire vivant détecté via localStorage');
}

function testWiring() {
  console.log('\n· câblage app.js');
  const saveImpl = appSrc.slice(appSrc.indexOf('window._saveLocalImpl = '), appSrc.indexOf('window._saveCloudImpl = '));
  assert(/TabLock\.isReadOnly\(\)[\s\S]{0,600}TAB_READ_ONLY/.test(saveImpl), 'save refusée en lecture seule (TAB_READ_ONLY)');
  const iGate = saveImpl.indexOf('TAB_READ_ONLY');
  const iRev = saveImpl.indexOf('window.D.meta.revision = prevRevision + 1');
  assert(iGate > 0 && iRev > iGate, 'refus avant toute modification de révision');
  assert(/await window\.TabLock\.start\(/.test(appSrc), 'initApp démarre le verrou');
  const boot = fs.readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
  assert(/'tab-lock\.js'/.test(boot), 'boot-loader charge tab-lock.js');
}

async function main() {
  console.log('=== Verrou entre onglets ===');
  await testSecondTabLocked();
  await testProfilesIndependent();
  await testCloseReleases();
  await testNoBroadcastFallback();
  await testFrozenTabMissedClaim();
  await testBfcacheReload();
  testWiring();
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
