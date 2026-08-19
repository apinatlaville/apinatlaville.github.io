/**
 * Tests unitaires du wizard de création de cours (Finder / batch / single).
 * Exécution : node scripts/test-cours-wizard.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.log('  ✗', msg);
  }
}

function makeEl(id) {
  const el = {
    id,
    value: '',
    checked: false,
    style: { display: '' },
    className: '',
    textContent: '',
    _html: '',
    _c: new Set(['hidden']),
    _attrs: {},
    classList: {
      add(c) { el._c.add(c); },
      remove(c) { el._c.delete(c); },
      contains(c) { return el._c.has(c); }
    },
    set innerHTML(v) { el._html = v; },
    get innerHTML() { return el._html; },
    addEventListener() {},
    getAttribute(n) { return el._attrs[n] || null; },
    setAttribute(n, v) { el._attrs[n] = v; },
    querySelector() { return null; },
    insertBefore() {},
    appendChild() {}
  };
  return el;
}

function buildEnv() {
  const els = {};
  const doc = {
    readyState: 'complete',
    body: { appendChild(n) { if (n && n.id) els[n.id] = n; } },
    head: { appendChild() {} },
    createElement(tag) {
      const e = makeEl('_' + tag + Math.random());
      e.tagName = tag;
      return e;
    },
    getElementById(id) {
      if (!els[id]) {
        els[id] = makeEl(id);
        if (id === 'paneCours') {
          els[id].querySelector = (sel) => {
            if (sel === '.filters') return makeEl('filters');
            if (sel === '#btnCoursBatchCreate') return els.btnCoursBatchCreate || null;
            return null;
          };
        }
      }
      return els[id];
    },
    addEventListener() {},
    querySelectorAll() { return []; }
  };

  [
    'mTitle', 'fTitle', 'fDesc', 'fMat', 'fCl', 'fInter', 'fType', 'fRev', 'fNote', 'fRang', 'fEffectif',
    'fManualUidToggle', 'lblManualUid', 'fUidInput', 'manualUidContainer', 'uidBox', 'fUidPrefix', 'ovCours',
    'btnCoursBatchCreate', 'btnCoursCreateSingle', 'btnCoursCreateMenu', 'coursCreateMenu', 'coursPaneToolbar', 'paneCours'
  ].forEach((id) => doc.getElementById(id));
  els.coursCreateMenu.contains = (node) => node === els.coursCreateMenu || node === els.btnCoursCreateMenu;

  const alerts = [];
  const windowObj = {
    D: {
      matieres: [
        { id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' },
        { id: 'MATH', label: 'MATH', name: 'Mathématiques', color: '#f0c060' },
        { id: 'UNTRI', label: 'UNTR', name: 'Non trié', color: '#666', _system: true }
      ],
      classeurs: [
        { id: 'A', name: 'Classeur A', icon: 'folder', color: '#5b8df7', maxInter: 3, interNames: { '01': 'Mécanique' } },
        { id: 'UNTRI', name: 'Non trié', _system: true, maxInter: 1, interNames: {} }
      ],
      cours: [],
      exercices: [],
      devoirs: []
    },
    UNSORTED_MAT_ID: 'UNTRI',
    UNSORTED_CL_ID: 'UNTRI',
    escHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      ));
    },
    iconLabel(_n, t) { return t; },
    iconHtml() { return ''; },
    hydrateIcons() {},
    renderClasseurIcon() { return ''; },
    getInterName(cl, ns) {
      if (cl && cl.interNames && cl.interNames[ns]) return ns + ' - ' + cl.interNames[ns];
      return 'Intercalaire ' + ns;
    },
    sysAlert(m, t) { alerts.push([t, m]); },
    localDateISO() { return '2026-07-21'; },
    genUid(mat) { return mat.slice(0, 2) + '-T' + String(windowObj.D.cours.length + 1); },
    save() {},
    pruneUnsortedMatiere() {},
    pruneUnsortedClasseur() {},
    renderMatieres() {},
    renderCours() {},
    renderDashboard() {},
    renderClasseurs() {},
    renderNotes() {},
    updateUidPrefix() {},
    toggleNoteField() {},
    updateIntercalairesDropdown() {
      const clId = windowObj.$('fCl').value;
      const cl = windowObj.D.classeurs.find((c) => c.id === clId);
      const maxI = cl ? (cl.maxInter || 12) : 12;
      windowObj.$('fInter')._opts = Array.from({ length: maxI }, (_, i) => String(i + 1).padStart(2, '0'));
    },
    $: (id) => doc.getElementById(id),
    document: doc,
    _alerts: alerts,
    _els: els
  };
  windowObj.window = windowObj;

  const ctx = {
    window: windowObj,
    document: doc,
    console,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    Date,
    parseFloat,
    parseInt,
    isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cours-wizard.js'), 'utf8'), ctx);

  vm.runInContext(`
window.closeModalCours = function(opts) {
  const o = opts || {};
  const ov = window.$('ovCours');
  if (ov) ov.classList.add('hidden');
  if (o.skipWizard) return;
  if (window._coursWizardActive && window._coursWizardMode && typeof window.coursWizardCancelForm === 'function') {
    window.coursWizardCancelForm();
  }
};
window.openModalCours = function(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  window.editUid = null;
  window.$('fTitle').value = '';
  window.$('fMat').value = '';
  window.$('fCl').value = '';
  window.updateIntercalairesDropdown();
  window.$('fInter').value = '';
  window.$('fType').value = 'COURS';
  if (o.mat) window.$('fMat').value = o.mat;
  if (o.cl) { window.$('fCl').value = o.cl; window.updateIntercalairesDropdown(); }
  if (o.inter) window.$('fInter').value = o.inter;
  window.$('ovCours').classList.remove('hidden');
};
window.editCours = function(uid) {
  if (typeof window.closeCoursWizard === 'function') window.closeCoursWizard();
  const c = window.D.cours.find(x => x.uid === uid);
  if (!c) return;
  window.editUid = uid;
  window.$('fTitle').value = c.title;
  window.$('fMat').value = c.mat;
  window.$('fCl').value = c.cl;
  window.updateIntercalairesDropdown();
  window.$('fInter').value = c.inter;
  window.$('ovCours').classList.remove('hidden');
};
window.saveCours = function() {
  const title = window.$('fTitle').value.trim();
  const mat = window.$('fMat').value;
  const cl = window.$('fCl').value;
  const inter = window.$('fInter').value;
  if (!title || !mat || !cl || !inter) return window.sysAlert('missing', 'err');
  const obj = { title, type: 'COURS', rev: 'green', mat, cl, inter, note: '', rang: '', effectif: '', desc: '', date: window.localDateISO() };
  const wasEdit = !!window.editUid;
  let createdUid = null;
  if (window.editUid) {
    const idx = window.D.cours.findIndex(c => c.uid === window.editUid);
    obj.uid = window.D.cours[idx].uid;
    obj.stat = window.D.cours[idx].stat;
    window.D.cours[idx] = obj;
  } else {
    createdUid = window.genUid(mat);
    obj.uid = createdUid;
    obj.stat = 'pending';
    window.D.cours.unshift(obj);
  }
  window.save();
  window.closeModalCours({ skipWizard: true });
  let wizardHandled = false;
  try {
    if (!wasEdit && createdUid && typeof window.coursWizardAfterCreate === 'function' && window._coursWizardMode) {
      wizardHandled = !!window.coursWizardAfterCreate(createdUid, { mat: obj.mat, cl: obj.cl, inter: obj.inter });
    } else if (!wasEdit && typeof window.closeCoursWizard === 'function') {
      window.closeCoursWizard();
      wizardHandled = true;
    }
  } catch (err) {
    if (typeof window.closeCoursWizard === 'function') window.closeCoursWizard();
    wizardHandled = true;
  }
  if (!wasEdit && !wizardHandled && typeof window.closeCoursWizard === 'function') window.closeCoursWizard();
};
`, ctx);

  return windowObj;
}

console.log('=== Tests wizard création cours ===\n');

console.log('[1] API publique exposée');
{
  const W = buildEnv();
  ['openCoursWizard', 'closeCoursWizard', 'coursWizardGo', 'coursWizardPickDirect',
    'coursWizardPickMat', 'coursWizardPickCl', 'coursWizardPickInter',
    'coursWizardAfterCreate', 'coursWizardCancelForm', 'ensureCoursPaneToolbar'
  ].forEach((name) => assert(typeof W[name] === 'function', name));
}

console.log('\n[2] Filtre matières/classeurs système');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardGo('mat');
  const html = W._els.ovCoursWizard._html;
  assert(html.includes('Physique'), 'matière user visible');
  assert(!html.includes('Non trié'), 'matière système masquée');
  W.coursWizardPickMat('PHYS');
  const htmlCl = W._els.ovCoursWizard._html;
  assert(htmlCl.includes('Classeur A'), 'classeur user visible');
  assert(!/Non trié/.test(htmlCl), 'classeur système masqué');
}

console.log('\n[3] Prefill Finder → save batch → retour intercalaire');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  W.coursWizardPickInter('01');
  assert(W.$('fMat').value === 'PHYS', 'prefill mat');
  assert(W.$('fCl').value === 'A', 'prefill cl');
  assert(W.$('fInter').value === '01', 'prefill inter');
  W.$('fTitle').value = 'Newton';
  W.saveCours();
  assert(W.D.cours.length === 1, '1 cours créé');
  assert(W.D.cours[0].uid === 'PH-T1', 'uid généré');
  assert(W._coursWizardMode === 'batch', 'mode batch conservé');
  assert(W._coursWizardActive === true, 'wizard actif');
  assert(W._els.ovCours.classList.contains('hidden'), 'form fermé');
  assert(W._els.ovCoursWizard._html.includes('ajouté') || W._els.ovCoursWizard._html.includes('PH-T1'), 'bannière succès');
  assert(W._els.ovCoursWizard._html.includes('cours-wiz-inv-type') && W._els.ovCoursWizard._html.includes('COURS'), 'type sous le doc créé');
  assert(W._els.ovCoursWizard._html.includes('cours-wiz-session'), 'inventaire en panneau session');
}

console.log('\n[4] Mode single ferme après save');
{
  const W = buildEnv();
  W.openCoursWizard('single');
  W.coursWizardPickDirect();
  W.$('fMat').value = 'MATH';
  W.$('fCl').value = 'A';
  W.updateIntercalairesDropdown();
  W.$('fInter').value = '01';
  W.$('fTitle').value = 'Séries';
  W.saveCours();
  assert(W.D.cours.length === 1, 'cours single créé');
  assert(W._coursWizardMode == null, 'wizard fermé');
  assert(W._coursWizardActive === false, 'active false');
}

console.log('\n[5] Cancel form ne pollue pas l’édition');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  W.coursWizardPickInter('01');
  W.$('fTitle').value = 'A';
  W.saveCours();
  W.editCours('PH-T1');
  assert(W._coursWizardMode == null, 'edit clear mode');
  W.closeModalCours();
  assert(W._coursWizardMode == null, 'cancel edit ne rouvre pas wizard');
}

console.log('\n[6] Cancel form batch revient à l’inter');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  W.coursWizardPickInter('02');
  assert(W._coursWizardActive === true, 'actif sur form');
  W.closeModalCours();
  assert(W._coursWizardMode === 'batch', 'batch après cancel');
  assert(W._els.ovCoursWizard._html.includes('intercalaire') || W._els.ovCoursWizard._html.includes('Intercalaire') || W._els.ovCoursWizard._html.includes('01 -'), 'retour inter');
}

console.log('\n[7] FAB fallback string opts + validation');
{
  const W = buildEnv();
  W.openModalCours('single');
  assert(W.editUid == null, 'string opts ignoré sans crash');
  W.$('fTitle').value = '';
  W.saveCours();
  assert(W._alerts.length === 1, 'validation champs manquants');
  assert(W.D.cours.length === 0, 'aucun cours créé');
}

console.log('\n[8] D=null ne crash pas le wizard');
{
  const W = buildEnv();
  W.D = null;
  let threw = false;
  try {
    W.openCoursWizard('batch');
    W.coursWizardGo('mat');
    W.coursWizardGo('cl');
    W.coursWizardGo('entry');
  } catch (e) {
    threw = true;
    console.log('    error:', e.message);
  }
  assert(!threw, 'pas de throw si D null');
}

console.log('\n[9] Toolbar menu bound une seule fois');
{
  const W = buildEnv();
  W.ensureCoursPaneToolbar();
  W.ensureCoursPaneToolbar();
  assert(W._els.btnCoursCreateMenu._coursWizBound === true, 'trigger bound');
  assert(W._els.btnCoursCreateSingle._coursWizBound === true, 'single bound');
  assert(W._els.btnCoursBatchCreate._coursWizBound === true, 'batch bound');
}

console.log('\n[10] Boot-loader référence cours-wizard.js');
{
  const boot = fs.readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
  assert(boot.includes("'cours-wizard.js'"), 'cours-wizard.js dans loadParallel');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('btnCoursBatchCreate'), 'bouton batch Base Doc');
  assert(html.includes('btnCoursCreateSingle'), 'bouton single Base Doc');
  assert(html.includes('openCoursWizard'), 'FAB/openCoursWizard');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
