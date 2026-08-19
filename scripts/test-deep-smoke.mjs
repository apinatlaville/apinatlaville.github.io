/**
 * Smoke test approfondi : wizard batch (layout/type/edit/delete) + arbre Base Doc + gardes D.
 * Usage: node scripts/test-deep-smoke.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; failures.push(msg); console.error('  ✗', msg); }
}

function makeEl(id) {
  const el = {
    id,
    value: '',
    innerHTML: '',
    style: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }
    },
    dataset: {},
    children: [],
    _listeners: {},
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      (this._listeners[type] || (this._listeners[type] = [])).push(fn);
    },
    click() {
      (this._listeners.click || []).forEach(fn => fn({ stopPropagation() {}, preventDefault() {}, target: el }));
    }
  };
  Object.defineProperty(el, '_html', {
    get() { return el.innerHTML; },
    set(v) { el.innerHTML = v; }
  });
  return el;
}

function buildEnv() {
  const els = {};
  const need = [
    'ovCoursWizard', 'ovCours', 'paneCours', 'coursPaneToolbar', 'coursCreateMenu',
    'btnCoursCreateMenu', 'btnCoursCreateSingle', 'btnCoursBatchCreate',
    'btnCoursBrowseTree', 'btnCoursBrowseMat', 'coursGrid', 'matChips',
    'fltMat', 'fltCl', 'fltType', 'fltQr', 'mainSearchText', 'mainSearchCode',
    'fTitle', 'fMat', 'fCl', 'fInter', 'fType', 'fDesc', 'fNote', 'fRang', 'fEffectif',
    'fManualUidToggle', 'fUidInput', 'fUidPrefix', 'mTitle', 'uidBox', 'manualUidContainer',
    'fgNote', 'btnCancelCours', 'btnSaveCours', 'statsBand'
  ];
  need.forEach(id => { els[id] = makeEl(id); });
  els.fManualUidToggle.checked = false;
  els.fType.value = 'COURS';
  els.ovCours.classList.add('hidden');
  els.ovCoursWizard.classList.add('hidden');

  const document = {
    readyState: 'complete',
    head: { appendChild() {} },
    body: makeEl('body'),
    documentElement: { appendChild() {} },
    getElementById(id) {
      if (!els[id]) els[id] = makeEl(id);
      return els[id];
    },
    querySelector(sel) {
      if (sel === '.filters') return makeEl('filters');
      return null;
    },
    querySelectorAll() { return []; },
    createElement(tag) {
      const el = makeEl(tag);
      el.tagName = tag.toUpperCase();
      el.textContent = '';
      return el;
    },
    addEventListener() {}
  };

  const window = {
    document,
    D: {
      settings: { showInitWarn: true },
      matieres: [
        { id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' },
        { id: 'MATH', label: 'MATH', name: 'Mathématiques', color: '#f0c060' }
      ],
      classeurs: [
        { id: 'A', name: 'Classeur A', icon: 'folder', color: '#5b8df7', maxInter: 4, interNames: { '01': 'Meca' } },
        { id: 'B', name: 'Classeur B', icon: 'folder', color: '#f0c060', maxInter: 3, interNames: {} }
      ],
      cours: []
    },
    escHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    iconHtml: () => '',
    iconLabel: (_i, t) => t,
    iconBtn: () => '',
    iconEditDeletePair: (a, b) => a + b,
    renderClasseurIcon: () => '',
    statusLabel: (_c, t) => t,
    statusDot: () => '',
    localDateISO: () => '2026-07-21',
    genUid: (mat) => (mat || 'XX').slice(0, 2).toUpperCase() + '-T' + (window.D.cours.length + 1),
    save() {},
    renderDashboard() {},
    renderMatieres() {},
    renderClasseurs() {},
    renderNotes() {},
    renderStats() {},
    enhanceFormControls() {},
    hydrateIcons() {},
    updateIntercalairesDropdown() {
      const cl = window.D.classeurs.find(c => c.id === els.fCl.value);
      const maxI = cl ? (cl.maxInter || 12) : 12;
      els.fInter.innerHTML = Array.from({ length: maxI }, (_, i) => {
        const v = String(i + 1).padStart(2, '0');
        return `<option value="${v}">${v}</option>`;
      }).join('');
    },
    toggleNoteField() {},
    sysAlert() {},
    sysConfirm(_m, run) { run(); },
    closeModalCours(opts) {
      els.ovCours.classList.add('hidden');
      if (!(opts && opts.skipWizard) && window._coursWizardResumeAfterEdit && window.coursWizardResumeAfterEdit) {
        window.coursWizardResumeAfterEdit();
      }
    },
    $: (id) => document.getElementById(id),
    _els: els,
    _renderCount: 0
  };
  window.window = window;
  const origRender = null;

  const ctx = { window, document, console, Fuse: undefined };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cours-wizard.js'), 'utf8'), ctx);

  const _rc = window.renderCours;
  window.renderCours = function () {
    window._renderCount += 1;
    return _rc.apply(this, arguments);
  };

  // saveCours simplified like wizard tests
  window.saveCours = function () {
    const title = els.fTitle.value.trim();
    const mat = els.fMat.value;
    const cl = els.fCl.value;
    const inter = els.fInter.value;
    const type = els.fType.value || 'COURS';
    if (!title || !mat || !cl || !inter) return window.sysAlert('missing');
    const obj = {
      title, type, mat, cl, inter, note: '', rang: '', effectif: '', desc: '',
      date: window.localDateISO(), rev: 'green', stat: 'pending',
      uid: window.genUid(mat)
    };
    if (window.editUid) {
      const idx = window.D.cours.findIndex(c => c.uid === window.editUid);
      if (idx > -1) {
        obj.uid = window.editUid;
        obj.stat = window.D.cours[idx].stat;
        window.D.cours[idx] = obj;
      }
      window.editUid = null;
      els.ovCours.classList.add('hidden');
      if (window._coursWizardResumeAfterEdit) window.coursWizardResumeAfterEdit();
      return;
    }
    window.D.cours.push(obj);
    els.ovCours.classList.add('hidden');
    const handled = window.coursWizardAfterCreate && window.coursWizardAfterCreate(obj.uid, { mat, cl, inter });
    if (!handled) window.closeCoursWizard && window.closeCoursWizard();
  };

  window.openModalCours = window.openModalCours;
  const realOpen = window.openModalCours;
  window.openModalCours = function (opts) {
    realOpen.call(window, opts);
    if (!window.D) return;
    const ctxW = window._coursWizardCtx || {};
    if (ctxW.mat) els.fMat.value = ctxW.mat;
    if (ctxW.cl) els.fCl.value = ctxW.cl;
    window.updateIntercalairesDropdown();
    if (ctxW.inter) els.fInter.value = ctxW.inter;
    els.ovCours.classList.remove('hidden');
  };

  // Real editCours from data.js — wire form open
  const realEdit = window.editCours;
  window.editCours = function (uid, opts) {
    realEdit.call(window, uid, opts);
    if (window.editUid) els.ovCours.classList.remove('hidden');
  };

  return window;
}

console.log('\n=== Deep smoke — wizard + arbre + gardes ===\n');

console.log('[1] Intercalaires compactes + session layout');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  const html0 = W._els.ovCoursWizard.innerHTML;
  assert(html0.includes('cours-wiz-opt-compact'), 'intercalaires en mode compact');
  assert(!html0.includes('cours-wiz-session'), 'pas de panneau session avant création');
  W.coursWizardPickInter('01');
  W._els.fTitle.value = 'Doc 1';
  W._els.fType.value = 'TD';
  W.saveCours();
  const html = W._els.ovCoursWizard.innerHTML;
  assert(html.includes('cours-wiz-session'), 'panneau session après création');
  assert(html.includes('cours-wiz-layout'), 'layout principal + session');
  assert(html.includes('cours-wiz-inv-type') && html.includes('TD'), 'type TD sous le doc');
  assert(html.includes('Physique') || html.includes('Classeur A'), 'emplacement sous le doc');
  assert(html.includes('cours-wiz-opt-compact'), 'intercalaires restent compactes');
  assert(html.includes('jsStr') === false && html.includes("coursWizardEditCreated('PH-T1')"), 'onclick edit avec uid JS-safe');
}

console.log('\n[2] Edit / delete session (keepWizard)');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  W.coursWizardPickInter('01');
  W._els.fTitle.value = 'Alpha';
  W.saveCours();
  const uid = W.D.cours[0].uid;
  W.coursWizardEditCreated(uid);
  assert(W._coursWizardResumeAfterEdit === true, 'flag resume après edit');
  assert(W.editUid === uid, 'editUid posé');
  assert(W._els.ovCoursWizard.classList.contains('hidden'), 'wizard masqué pendant edit');
  W._els.fTitle.value = 'Alpha modifié';
  W.saveCours();
  assert(W.D.cours[0].title === 'Alpha modifié', 'titre mis à jour');
  assert(W._coursWizardResumeAfterEdit === false, 'flag resume cleared');
  assert(W._els.ovCoursWizard.innerHTML.includes('summary') || W._els.ovCoursWizard.innerHTML.includes('Résumé') || W._els.ovCoursWizard.innerHTML.includes('session'), 'retour résumé après edit');

  W.coursWizardDeleteCreated(uid);
  assert(W.D.cours.length === 0, 'doc supprimé de D.cours');
  assert(!W._els.ovCoursWizard.innerHTML.includes(uid) || W._els.ovCoursWizard.innerHTML.includes('Aucun'), 'uid retiré de l’inventaire');
}

console.log('\n[3] Edit uid inconnu ne bloque pas le wizard');
{
  const W = buildEnv();
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  W.coursWizardPickInter('02');
  W._els.fTitle.value = 'Beta';
  W.saveCours();
  W.coursWizardEditCreated('NOPE-404');
  assert(W._coursWizardResumeAfterEdit !== true, 'flag non coincé si uid absent');
  assert(!W._els.ovCoursWizard.classList.contains('hidden') || W._els.ovCoursWizard.innerHTML.length > 0, 'wizard toujours utilisable');
}

console.log('\n[4] Gardes D=null openModal / editCours');
{
  const W = buildEnv();
  W.D = null;
  let threw = false;
  try { W.openModalCours({}); } catch (e) { threw = true; }
  assert(!threw, 'openModalCours ne throw pas si D null');
  threw = false;
  try { W.editCours('X'); } catch (e) { threw = true; }
  assert(!threw, 'editCours ne throw pas si D null');
}

console.log('\n[4b] Tri Base Doc inter null + recovery wizard si D=null');
{
  const W = buildEnv();
  W.D.cours = [
    { uid: 'A1', title: 'Sans inter', mat: 'PHYS', cl: 'A', inter: null, type: 'COURS', stat: 'active' },
    { uid: 'A2', title: 'Avec inter', mat: 'PHYS', cl: 'A', inter: '01', type: 'TD', stat: 'active' }
  ];
  let threw = false;
  try { W.renderCours(); } catch (e) { threw = true; }
  assert(!threw, 'renderCours ne throw pas si inter null');
  assert(W._els.coursGrid.innerHTML.includes('cours-tree'), 'grille arbre malgré inter null');

  W.D = {
    settings: { showInitWarn: true },
    matieres: [{ id: 'PHYS', label: 'PHYS', name: 'Physique', color: '#5b8df7' }],
    classeurs: [{ id: 'A', name: 'Classeur A', icon: 'folder', color: '#5b8df7', maxInter: 4, interNames: {} }],
    cours: []
  };
  W.openCoursWizard('batch');
  W.coursWizardPickMat('PHYS');
  W.coursWizardPickCl('A');
  W.D = null;
  threw = false;
  try { W.coursWizardPickInter('01'); } catch (e) { threw = true; }
  assert(!threw, 'pick inter avec D=null ne throw pas');
  assert(!W._els.ovCoursWizard.classList.contains('hidden'), 'wizard réaffiché si formulaire impossible');
}

console.log('\n[5] Arbre Base Doc — collapse, mode, carte');
{
  const W = buildEnv();
  W.D.cours = [
    { uid: 'P1', title: 'Cinématique', mat: 'PHYS', cl: 'A', inter: '01', type: 'COURS', stat: 'active' },
    { uid: 'P2', title: 'Optique', mat: 'PHYS', cl: 'A', inter: '02', type: 'TD', stat: 'pending' },
    { uid: 'M1', title: 'Algèbre', mat: 'MATH', cl: 'B', inter: '01', type: 'COURS', stat: 'active' }
  ];
  W._els.coursGrid.id = 'coursGrid';
  W.renderCours();
  let html = W._els.coursGrid.innerHTML;
  assert(html.includes('cours-tree'), 'render en arbre');
  assert(html.includes('Classeur A') || html.includes('cours-tree-hdr--cl'), 'matière ouverte : classeurs visibles');
  assert(!html.includes('Cinématique'), 'cartes cachées tant que classeur/inter repliés');
  W.toggleCoursTreeNode('c:PHYS|A');
  W.toggleCoursTreeNode('i:PHYS|A|01');
  html = W._els.coursGrid.innerHTML;
  assert(html.includes('Cinématique'), 'carte après expand cl→inter');
  assert(html.includes("doLocate('P1')"), 'onclick carte JS-safe');
  W.setCoursBrowseMode('mat');
  W.coursExpanded = Object.create(null);
  W.renderCours();
  html = W._els.coursGrid.innerHTML;
  assert(html.includes('Cinématique') && html.includes('Optique'), 'mode matières : docs sous matière');
  assert(!html.includes('cours-tree-hdr--cl'), 'mode matières : pas de headers classeur');
}

console.log('\n[6] Browse toggle : un seul binding wizard (pas app.js)');
{
  const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert(!/bindClick\('btnCoursBrowseTree'/.test(appSrc), 'pas de double bindClick dans app.js');
  const wizSrc = fs.readFileSync(path.join(root, 'cours-wizard.js'), 'utf8');
  assert(wizSrc.includes('_coursBrowseBound'), 'binding unique via cours-wizard');
  assert(wizSrc.includes('function jsStr'), 'jsStr présent pour onclick inventaire');
}

console.log('\n[7] Cache bump + boot-loader');
{
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const boot = fs.readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
  assert(/__BOOT_CACHE_V\s*=\s*'20260[78]\d{2}[a-z]'/.test(index), 'cache version bumpée');
  assert(boot.includes('cours-wizard.js'), 'boot charge cours-wizard.js');
  assert(index.includes('btnCoursBrowseTree') && index.includes('btnCoursBrowseMat'), 'toggle Arbre/Matières dans HTML');
}

console.log('\n=== Résultat deep smoke ===');
console.log(`passed=${passed} failed=${failed}`);
if (failed) {
  console.error(failures.join('\n'));
  process.exit(1);
}
