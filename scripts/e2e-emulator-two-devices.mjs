/**
 * Bout en bout, deux appareils, émulateurs Firebase locaux (jamais la vraie base).
 *
 * Prérequis :
 *   firebase emulators:start --only auth,firestore   (ports 9099 et 8080)
 *   python3 -m http.server 8005                        (racine du dépôt)
 * Usage : node scripts/e2e-emulator-two-devices.mjs [http://127.0.0.1:8005]
 *
 * Deux contextes Chrome isolés (stockage séparé = deux appareils) sur le même compte :
 * Principal / Secondaire, suppression propagée, refus d’écriture en Secondaire,
 * prise de contrôle, absence de résurrection après rechargement.
 */
import { spawn } from 'child_process';
import fs from 'fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8005';
const PORT = 9333;
const EMAIL = 'e2e-' + Date.now() + '@example.com';

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDir = fs.mkdtempSync('/tmp/chrome-e2e-');
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'
], { stdio: 'ignore' });

async function browserWs() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { await sleep(200); }
  }
  throw new Error('Chrome DevTools indisponible');
}

function cdpClient(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((fn) => fn(msg));
    }
  };
  return new Promise((resolve) => {
    ws.onopen = () => resolve({
      send(method, params, sessionId) {
        const mid = ++id;
        ws.send(JSON.stringify({ id: mid, method, params: params || {}, sessionId }));
        return new Promise((res, rej) => pending.set(mid, { resolve: res, reject: rej }));
      },
      on(fn) { listeners.push(fn); },
      close() { ws.close(); }
    });
  });
}

async function newDevice(cdp, name) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  const errors = [];
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || msg.params.exceptionDetails.text);
    }
  });
  const dev = {
    name,
    errors,
    async eval(expression) {
      const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) {
        throw new Error(name + ': ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
      }
      return r.result.value;
    },
    async waitFor(expression, timeoutMs, label) {
      const t0 = Date.now();
      while (Date.now() - t0 < (timeoutMs || 20000)) {
        try { if (await dev.eval('!!(' + expression + ')')) return true; } catch (e) { /* page en chargement */ }
        await sleep(250);
      }
      throw new Error(name + ': délai dépassé — ' + (label || expression));
    },
    async goto(url) { await cdp.send('Page.navigate', { url }, sessionId); },
    async reload() { await cdp.send('Page.reload', { ignoreCache: true }, sessionId); }
  };
  return dev;
}

const READY = "window.appReady === true && window.cloudConnected === true && window.DeviceSession && window.DeviceSession.getStatus().joinResolved";
const STATUS = "(function(){var s=window.DeviceSession.getStatus();return {primary:s.isPrimary,secondary:s.isSecondary,needsRoleChoice:s.needsRoleChoice,canFullSave:window.DeviceSession.canFullSave()};})()";
const COUNTS = "({cours:(window.D.cours||[]).length,cartes:(window.D.exercices||[]).length,rev:(window.D.meta&&window.D.meta.revision)||0})";
const SYNCED = "window._lastCloudConfirmedRevision != null && window._lastCloudConfirmedRevision >= ((window.D.meta && window.D.meta.revision) || 0)";

async function signIn(dev) {
  await dev.goto(BASE + '/?emulator=1&emuUser=' + encodeURIComponent(EMAIL));
  await dev.waitFor("typeof window.emulatorSignIn === 'function' && document.getElementById('btnEmuLogin')", 30000, 'bouton émulateur');
  await dev.eval("document.getElementById('btnEmuLogin').click(), true");
  await dev.waitFor(READY, 45000, 'app prête + rôle résolu');
}

async function main() {
  const cdp = await cdpClient(await browserWs());
  console.log('=== E2E émulateur : deux appareils, compte ' + EMAIL + ' ===');

  console.log('\n· appareil A : connexion, Principal, contenu de démo');
  const A = await newDevice(cdp, 'A');
  await signIn(A);
  let sA = await A.eval(STATUS);
  assert(sA.primary && sA.canFullSave, 'A seul connecté → Principal');
  await A.eval(`(async function(){
    await window.ensureDemoData();
    var meta = window.D.meta || {};
    var demo = JSON.parse(JSON.stringify(window.demoDataPCStar));
    demo.meta = Object.assign({}, demo.meta || {}, meta);
    window.D = demo;
    await window.save();
    return true;
  })()`);
  await A.waitFor(SYNCED, 20000, 'démo envoyée au cloud');
  const cA = await A.eval(COUNTS);
  assert(cA.cours > 10 && cA.cartes > 50, 'A : démo chargée (' + cA.cours + ' cours, ' + cA.cartes + ' cartes)');

  console.log('\n· appareil B : même compte, autre appareil → Secondaire');
  const B = await newDevice(cdp, 'B');
  await signIn(B);
  const sB = await B.eval(STATUS);
  assert(sB.secondary && !sB.canFullSave, 'B → Secondaire (Principal A actif)');
  assert(sB.needsRoleChoice === true, 'B : choix de rôle proposé');
  const cB = await B.eval(COUNTS);
  assert(cB.cours === cA.cours && cB.cartes === cA.cartes, 'B voit les mêmes données que A');
  sA = await A.eval(STATUS);
  assert(sA.primary, 'A reste Principal');

  console.log('\n· suppression sur A → effective sur B');
  const delUid = await A.eval(`(async function(){
    var c = window.D.cours[0];
    window.D.cours.splice(0, 1);
    await window.save();
    return c.uid;
  })()`);
  await A.waitFor(SYNCED, 20000, 'suppression envoyée');
  const tomb = await A.eval(`(window.D.meta.deleted || {})['c:${delUid}'] || 0`);
  assert(tomb > 0, 'A : trace de suppression c:' + delUid + ' posée');
  await B.waitFor(`!window.D.cours.some(function(c){return c.uid===${JSON.stringify(delUid)};})`, 20000, 'B reçoit la suppression');
  assert(true, 'B : cours supprimé disparu en direct (sans recharger)');
  await B.reload();
  await B.waitFor(READY, 45000, 'B rechargé');
  assert(await B.eval(`!window.D.cours.some(function(c){return c.uid===${JSON.stringify(delUid)};})`), 'B après rechargement : toujours supprimé');
  assert((await B.eval(STATUS)).secondary, 'B après rechargement : toujours Secondaire');

  console.log('\n· B Secondaire : écriture complète refusée');
  const refused = await B.eval(`(async function(){
    window.D.cours.splice(0, 1);
    try { await window.save(); return 'saved'; } catch (e) { return String(e && e.message || e); }
  })()`);
  assert(/SECONDARY_READ_ONLY/.test(refused), 'B : sauvegarde refusée (' + refused + ')');
  await B.reload();
  await B.waitFor(READY, 45000, 'B rechargé');
  const cB2 = await B.eval(COUNTS);
  assert(cB2.cours === cA.cours - 1, 'B : la modification refusée n’a rien écrit (' + cB2.cours + ' cours)');

  console.log('\n· B prend la main → A passe Secondaire');
  const claim = await B.eval('window.DeviceSession.claimPrimary().then(function(s){return {primary:s.isPrimary};})');
  assert(claim.primary, 'B : prise de contrôle confirmée par le hub');
  await A.waitFor('window.DeviceSession.getStatus().isSecondary', 20000, 'A rétrogradé');
  assert(!(await A.eval('window.DeviceSession.canFullSave()')), 'A : plus d’écriture complète');

  console.log('\n· suppression sur B (nouveau Principal) → A ne la ressuscite pas');
  const del2 = await B.eval(`(async function(){
    var c = window.D.cours[0];
    window.D.cours.splice(0, 1);
    await window.save();
    return c.uid;
  })()`);
  await B.waitFor(SYNCED, 20000, 'suppression B envoyée');
  await A.waitFor(`!window.D.cours.some(function(c){return c.uid===${JSON.stringify(del2)};})`, 20000, 'A reçoit la suppression');
  await A.reload();
  await A.waitFor(READY, 45000, 'A rechargé');
  const gone = await A.eval(`!window.D.cours.some(function(c){return c.uid===${JSON.stringify(del2)};}) && !window.D.cours.some(function(c){return c.uid===${JSON.stringify(delUid)};})`);
  assert(gone, 'A après rechargement : les deux suppressions tiennent');
  const cloudCount = await B.eval(`window.getDoc(window.docRef).then(function(s){return (s.data().cours||[]).length;})`);
  assert(cloudCount === cA.cours - 2, 'cloud : ' + cloudCount + ' cours (2 suppressions)');

  const errs = A.errors.concat(B.errors);
  assert(errs.length === 0, 'aucune exception JavaScript' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));

  cdp.close();
}

main().catch((e) => {
  failed++;
  failures.push(e.message);
  console.error(e);
}).finally(() => {
  try { chrome.kill(); } catch (e) { /* ignore */ }
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) console.error('Échecs:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(failed ? 1 : 0);
});
