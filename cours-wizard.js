/**
 * cours-wizard.js — Création de documents type Finder / Explorateur
 * (parcours matière → classeur → intercalaire → formulaire),
 * calqué sur le picker de cartes Synchrotron.
 *
 * Modes :
 *  - single : 1 document → après enregistrement, retour au début / fermeture
 *  - batch  : création rapide d’ensemble → après enregistrement, retour à l’intercalaire
 */
(function () {
  'use strict';

  var STATE = {
    mode: 'single', // 'single' | 'batch'
    step: 'entry',  // entry | mat | cl | inter | form | summary
    mat: null,
    cl: null,
    inter: null,
    createdCount: 0,
    lastUid: null,
    createdUids: []
  };

  function esc(s) {
    return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s);
  }

  /** Escape pour chaînes JS dans des attributs onclick="...('...')". */
  function jsStr(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function iconLabel(name, text) {
    return window.iconLabel ? window.iconLabel(name, text) : esc(text);
  }

  function iconHtml(name, size) {
    return window.iconHtml ? window.iconHtml(name, size || 18) : '';
  }

  function injectStyles() {
    var STYLE_V = '20260721w';
    var tag = document.getElementById('cours-wizard-styles');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'cours-wizard-styles';
      var host = document.head || document.body || document.documentElement;
      if (host && host.appendChild) host.appendChild(tag);
    }
    if (tag.getAttribute('data-v') === STYLE_V) return;
    tag.setAttribute('data-v', STYLE_V);
    tag.textContent = `
.cours-wiz-modal {
  max-width: 560px;
  width: min(560px, 94vw);
}
.cours-wiz-modal.card-type-surface {
  backdrop-filter: blur(64px) saturate(var(--glass-saturate, 2.05));
  -webkit-backdrop-filter: blur(64px) saturate(var(--glass-saturate, 2.05));
  overflow: hidden;
}
.cours-wiz-modal.card-type-surface,
body.tmpl-glass .ov .cours-wiz-modal.card-type-surface {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.09) 0%, transparent 46%),
    linear-gradient(220deg, rgba(91, 141, 247, 0.18) 0%, transparent 56%),
    linear-gradient(180deg, rgba(91, 141, 247, 0.08) 0%, transparent 40%),
    var(--glass-surface),
    rgba(18, 22, 32, 0.36) !important;
  border: 0.5px solid rgba(130, 165, 255, 0.32) !important;
  box-shadow:
    inset 0 1px 0 rgba(210, 225, 255, 0.28),
    inset 0 -1px 0 rgba(0, 0, 0, 0.14),
    inset 0 0 44px rgba(91, 154, 255, 0.08),
    0 24px 64px rgba(0, 0, 0, 0.36),
    0 8px 28px rgba(91, 154, 255, 0.14) !important;
}
body.theme-light .cours-wiz-modal.card-type-surface {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.82) 0%, transparent 50%),
    linear-gradient(220deg, rgba(91, 141, 247, 0.12) 0%, transparent 58%),
    var(--glass-surface),
    rgba(248, 250, 255, 0.72) !important;
}
.cours-wiz-modal h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 6px;
}
.cours-wiz-sub {
  font-size: 13px;
  color: var(--mut);
  margin: 0 0 12px;
  line-height: 1.4;
}
.cours-wiz-mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(91, 141, 247, 0.35);
  background: rgba(91, 141, 247, 0.12);
  color: var(--acc);
  margin-left: 4px;
}
.cours-wiz-mode-pill.is-batch {
  border-color: rgba(76, 175, 125, 0.4);
  background: rgba(76, 175, 125, 0.12);
  color: var(--grn);
}
.cours-wiz-crumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 2px;
  font-size: 12px;
  color: var(--mut);
  margin: 0 0 14px;
  min-height: 22px;
}
.cours-wiz-crumb button {
  background: none;
  border: none;
  color: var(--acc);
  cursor: pointer;
  font: inherit;
  padding: 2px 4px;
  border-radius: 4px;
}
.cours-wiz-crumb button:hover { background: rgba(91, 141, 247, 0.12); }
.cours-wiz-crumb .sep { opacity: 0.45; padding: 0 2px; }
.cours-wiz-crumb .cur { color: var(--txt); font-weight: 600; padding: 2px 4px; }
.cours-wiz-banner {
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  margin: 0 0 12px;
  background: rgba(76, 175, 125, 0.12);
  border: 1px solid rgba(76, 175, 125, 0.28);
  color: var(--txt);
}
.cours-wiz-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 4px;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding-right: 2px;
}
.cours-wiz-grid.cours-wiz-grid-inter {
  grid-template-columns: 1fr;
  gap: 6px;
  max-height: min(58vh, 480px);
}
.cours-wiz-opt.cours-wiz-opt-compact {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
}
.cours-wiz-opt.cours-wiz-opt-compact .cours-wiz-ico {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 6px;
}
.cours-wiz-opt.cours-wiz-opt-compact strong {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cours-wiz-opt.cours-wiz-opt-compact .cours-wiz-hint {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.2;
}
@media (max-width: 560px) {
  .cours-wiz-grid { grid-template-columns: 1fr; max-height: min(48vh, 360px); }
}
.cours-wiz-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 12px;
  border-radius: 10px;
  border: 1px solid var(--bd);
  background: var(--s1);
  background-clip: padding-box;
  overflow: hidden;
  isolation: isolate;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  color: inherit;
  font: inherit;
  width: 100%;
  box-shadow: none;
}
.cours-wiz-opt:hover,
.cours-wiz-opt:focus-visible {
  border-color: var(--wiz-color, var(--acc));
  background: color-mix(in srgb, var(--wiz-color, var(--acc)) 8%, var(--s1));
  background-clip: padding-box;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--wiz-color, var(--acc)) 35%, transparent);
  outline: none;
}
.cours-wiz-opt:active {
  background: color-mix(in srgb, var(--wiz-color, var(--acc)) 12%, var(--s1));
}
.cours-wiz-opt strong { font-size: 14px; color: var(--txt); }
.cours-wiz-opt .cours-wiz-hint { font-size: 11px; color: var(--mut); line-height: 1.35; }
.cours-wiz-ico {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--wiz-color, var(--acc)) 16%, transparent);
  color: var(--wiz-color, var(--acc));
  flex-shrink: 0;
}
.cours-wiz-entry {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 8px;
}
.cours-wiz-empty {
  text-align: center;
  padding: 24px 12px;
  color: var(--mut);
  font-size: 13px;
}
.cours-wiz-inventory {
  margin: 12px 0 0;
  padding: 10px;
  border-radius: 10px;
  border: 0.5px solid color-mix(in srgb, var(--acc) 28%, var(--bd));
  background: color-mix(in srgb, var(--s2) 85%, transparent);
  max-height: 160px;
  overflow-y: auto;
}
.cours-wiz-inventory-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--mut);
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cours-wiz-inv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 0.5px solid transparent;
}
.cours-wiz-inv-row:hover {
  background: color-mix(in srgb, var(--acc) 8%, transparent);
  border-color: var(--bd);
}
.cours-wiz-inv-main {
  flex: 1;
  min-width: 0;
}
.cours-wiz-inv-uid {
  font-family: 'DM Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--acc);
  font-weight: 700;
}
.cours-wiz-inv-title {
  font-size: 12px;
  color: var(--txt);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cours-wiz-inv-type {
  display: inline-block;
  margin-top: 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--acc);
  background: color-mix(in srgb, var(--acc) 12%, transparent);
  border: 0.5px solid color-mix(in srgb, var(--acc) 28%, transparent);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 1.4;
}
.cours-wiz-inv-meta {
  font-size: 10px;
  color: var(--mut);
  line-height: 1.35;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cours-wiz-inv-acts {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.cours-wiz-inv-acts button {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 0.5px solid var(--bd);
  background: var(--s1);
  color: var(--txt);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.cours-wiz-inv-acts button:hover {
  border-color: var(--acc);
  color: var(--acc);
}
.cours-wiz-inv-acts button.is-danger:hover {
  border-color: var(--red);
  color: var(--red);
}
.cours-wiz-modal.cours-wiz-wide {
  max-width: min(920px, 96vw);
  width: min(920px, 96vw);
}
.cours-wiz-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 4px;
}
.cours-wiz-main {
  flex: 1 1 auto;
  min-width: 0;
}
.cours-wiz-session {
  flex: 0 0 auto;
  border-top: 1px dashed color-mix(in srgb, var(--bd) 80%, transparent);
  padding-top: 12px;
  margin-top: 2px;
}
.cours-wiz-session .cours-wiz-inventory {
  margin: 0;
  max-height: min(32vh, 220px);
}
@media (min-width: 780px) {
  .cours-wiz-layout {
    flex-direction: row;
    align-items: stretch;
    gap: 16px;
  }
  .cours-wiz-main {
    flex: 1 1 0;
  }
  .cours-wiz-session {
    flex: 0 0 250px;
    width: 250px;
    max-width: 280px;
    border-top: none;
    border-left: 1px solid var(--bd);
    padding-top: 0;
    padding-left: 14px;
    margin-top: 0;
  }
  .cours-wiz-session .cours-wiz-inventory {
    max-height: min(58vh, 460px);
    height: 100%;
    box-sizing: border-box;
  }
}

.cours-pane-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  position: relative;
  z-index: 20;
  flex-wrap: wrap;
}
.cours-browse-toggle {
  flex: 0 0 auto;
}
.cours-create-menu {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 30;
}
.cours-create-menu.open {
  z-index: 80;
}
.cours-create-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  width: auto;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  color: var(--txt);
  background: var(--s2);
  border: 0.5px solid var(--bd);
  border-radius: var(--radius-control);
  cursor: pointer;
  box-shadow: none;
  white-space: nowrap;
}
.cours-create-trigger:hover {
  border-color: var(--acc);
  background: color-mix(in srgb, var(--acc) 10%, var(--s2));
}
.cours-create-trigger[aria-expanded="true"] {
  border-color: var(--acc);
  color: var(--acc);
}
.cours-create-chevron {
  opacity: 0.65;
  transition: transform 0.15s;
}
.cours-create-trigger[aria-expanded="true"] .cours-create-chevron {
  transform: rotate(180deg);
}
.cours-create-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 240px;
  max-width: min(320px, 92vw);
  padding: 6px;
  border-radius: 10px;
  border: 0.5px solid var(--bd);
  /* --s1/--s2 sont translucides (glass) : fond opaque obligatoire */
  background: #141822;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  display: none;
  flex-direction: column;
  gap: 4px;
  z-index: 90;
  overflow: hidden;
  isolation: isolate;
}
body.theme-light .cours-create-dropdown {
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(20, 30, 50, 0.18);
}
.cours-create-menu.open .cours-create-dropdown {
  display: flex;
}
.cours-create-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--txt);
  cursor: pointer;
  font: inherit;
  position: relative;
  z-index: 1;
}
.cours-create-item:hover,
.cours-create-item:focus-visible {
  background: rgba(91, 154, 255, 0.16);
  outline: none;
}
body.theme-light .cours-create-item:hover,
body.theme-light .cours-create-item:focus-visible {
  background: rgba(91, 154, 255, 0.12);
}
.cours-create-item strong {
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cours-create-item span.hint {
  font-size: 11px;
  color: var(--mut);
  line-height: 1.3;
  max-width: 100%;
}

`;
    var host = document.head || document.body || document.documentElement;
    if (host && host.appendChild) host.appendChild(tag);
  }

  function ensureOverlay() {
    injectStyles();
    var ov = document.getElementById('ovCoursWizard');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovCoursWizard';
      ov.className = 'ov hidden';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        if (e.target === ov) {
          if (typeof window.coursWizardQuit === 'function') window.coursWizardQuit();
          else window.closeCoursWizard();
        }
      });
    }
    return ov;
  }

  function listMatieres() {
    if (!window.D || !window.D.matieres) return [];
    return window.D.matieres.filter(function (m) {
      return m && m.id && !m._system && m.id !== window.UNSORTED_MAT_ID;
    });
  }

  function listClasseurs() {
    if (!window.D || !window.D.classeurs) return [];
    return window.D.classeurs.filter(function (c) {
      return c && c.id && !c._system && c.id !== window.UNSORTED_CL_ID;
    });
  }

  function countDocs(mat, cl, inter) {
    if (!window.D || !window.D.cours) return 0;
    return window.D.cours.filter(function (c) {
      if (mat && c.mat !== mat) return false;
      if (cl && c.cl !== cl) return false;
      if (inter && c.inter !== inter) return false;
      return true;
    }).length;
  }

  function matById(id) {
    return ((window.D && window.D.matieres) || []).find(function (m) { return m.id === id; }) || null;
  }

  function clById(id) {
    return ((window.D && window.D.classeurs) || []).find(function (c) { return c.id === id; }) || null;
  }

  function modePill() {
    if (STATE.mode === 'batch') {
      return '<span class="cours-wiz-mode-pill is-batch">' + iconHtml('layers', 12) + ' Création rapide</span>';
    }
    return '<span class="cours-wiz-mode-pill">' + iconHtml('plus', 12) + ' 1 document</span>';
  }

  function crumbHtml() {
    var parts = [];
    var pushSep = function () {
      if (parts.length) parts.push('<span class="sep">›</span>');
    };
    var canCrumb = STATE.step !== 'entry';
    if (!canCrumb) return '<div class="cours-wiz-crumb"></div>';

    parts.push('<button type="button" onclick="window.coursWizardGo(\'entry\')">Début</button>');

    if (STATE.mat) {
      pushSep();
      var mo = matById(STATE.mat);
      var matLabel = mo ? (mo.label || mo.name) : STATE.mat;
      if (STATE.step === 'mat') {
        parts.push('<span class="cur">' + esc(matLabel) + '</span>');
      } else {
        parts.push('<button type="button" onclick="window.coursWizardGo(\'mat\')">' + esc(matLabel) + '</button>');
      }
    } else if (STATE.step === 'mat') {
      pushSep();
      parts.push('<span class="cur">Matière</span>');
    }

    if (STATE.cl || STATE.step === 'cl' || STATE.step === 'inter' || STATE.step === 'form') {
      pushSep();
      if (STATE.cl) {
        var co = clById(STATE.cl);
        var clLabel = co ? co.name : STATE.cl;
        if (STATE.step === 'cl') parts.push('<span class="cur">' + esc(clLabel) + '</span>');
        else parts.push('<button type="button" onclick="window.coursWizardGo(\'cl\')">' + esc(clLabel) + '</button>');
      } else {
        parts.push('<span class="cur">Classeur</span>');
      }
    }

    if (STATE.inter || STATE.step === 'inter' || (STATE.step === 'form' && STATE.inter)) {
      pushSep();
      if (STATE.inter) {
        var cl = clById(STATE.cl);
        var interLabel = window.getInterName ? window.getInterName(cl, STATE.inter) : STATE.inter;
        if (STATE.step === 'inter') parts.push('<span class="cur">' + esc(interLabel) + '</span>');
        else parts.push('<button type="button" onclick="window.coursWizardGo(\'inter\')">' + esc(interLabel) + '</button>');
      } else if (STATE.step === 'inter') {
        parts.push('<span class="cur">Intercalaire</span>');
      }
    }

    if (STATE.step === 'form') {
      pushSep();
      parts.push('<span class="cur">Document</span>');
    }

    return '<div class="cours-wiz-crumb">' + parts.join('') + '</div>';
  }

  function bannerHtml() {
    if (!STATE.lastUid && !STATE.createdCount) return '';
    var msg = STATE.lastUid
      ? ('Document <b>' + esc(STATE.lastUid) + '</b> ajouté' +
        (STATE.mode === 'batch' ? ' — continue ou termine quand tu as fini.' : '.'))
      : '';
    if (STATE.mode === 'batch' && STATE.createdCount > 1) {
      msg += ' <span style="color:var(--mut);">(' + STATE.createdCount + ' créés)</span>';
    }
    return msg ? '<div class="cours-wiz-banner">' + msg + '</div>' : '';
  }

  function createdDocs() {
    if (!window.D || !window.D.cours || !STATE.createdUids.length) return [];
    var byUid = {};
    window.D.cours.forEach(function (c) { if (c && c.uid) byUid[c.uid] = c; });
    return STATE.createdUids.map(function (uid) { return byUid[uid]; }).filter(Boolean);
  }

  function inventoryHtml(opts) {
    var o = opts || {};
    if (STATE.mode !== 'batch') return '';
    var docs = createdDocs();
    if (!docs.length && !o.force) return '';
    if (!docs.length) {
      return '<div class="cours-wiz-inventory"><div class="cours-wiz-inventory-title">Session</div>' +
        '<div class="cours-wiz-empty" style="padding:10px;">Aucun document créé pour l’instant.</div></div>';
    }
    var rows = docs.map(function (c) {
      var mo = matById(c.mat);
      var co = clById(c.cl);
      var interLabel = window.getInterName ? window.getInterName(co, c.inter) : (c.inter || '');
      var typeLabel = c.type || '';
      var meta = [
        mo ? (mo.name || mo.label) : c.mat,
        co ? co.name : c.cl,
        interLabel
      ].filter(Boolean).join(' · ');
      return '<div class="cours-wiz-inv-row">' +
        '<div class="cours-wiz-inv-main">' +
          '<div class="cours-wiz-inv-uid">' + esc(c.uid) + '</div>' +
          '<div class="cours-wiz-inv-title">' + esc(c.title || 'Sans titre') + '</div>' +
          (typeLabel ? '<div class="cours-wiz-inv-type">' + esc(typeLabel) + '</div>' : '') +
          (meta ? '<div class="cours-wiz-inv-meta">' + esc(meta) + '</div>' : '') +
        '</div>' +
        '<div class="cours-wiz-inv-acts">' +
          '<button type="button" title="Modifier" onclick="window.coursWizardEditCreated(\'' + jsStr(c.uid) + '\')">' + iconHtml('pencil', 14) + '</button>' +
          '<button type="button" class="is-danger" title="Supprimer" onclick="window.coursWizardDeleteCreated(\'' + jsStr(c.uid) + '\')">' + iconHtml('trash-2', 14) + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="cours-wiz-inventory">' +
      '<div class="cours-wiz-inventory-title"><span>Créés dans cette session</span><span>' + docs.length + '</span></div>' +
      rows +
      '</div>';
  }

  /** Contenu principal + inventaire session (bas mobile / droite desktop). */
  function withSessionLayout(mainHtml, actionsHtml) {
    var inv = inventoryHtml();
    if (!inv) return mainHtml + (actionsHtml || '');
    return '<div class="cours-wiz-layout">' +
      '<div class="cours-wiz-main">' + mainHtml + '</div>' +
      '<aside class="cours-wiz-session" aria-label="Créés dans cette session">' + inv + '</aside>' +
      '</div>' + (actionsHtml || '');
  }

  function exitActionsHtml(backStep) {
    var back = backStep
      ? '<button type="button" class="bs" onclick="window.coursWizardGo(\'' + backStep + '\')">Retour</button>'
      : '';
    if (STATE.mode === 'batch') {
      var finish = STATE.createdUids.length
        ? '<button type="button" class="bp" onclick="window.coursWizardGo(\'summary\')">Terminer</button>'
        : '';
      return '<div class="macts" style="margin-top:16px;">' + back +
        '<button type="button" class="bs" onclick="window.coursWizardQuit()">' +
        (STATE.createdUids.length ? 'Quitter' : 'Annuler') + '</button>' +
        finish + '</div>';
    }
    return '<div class="macts" style="margin-top:16px;">' + back +
      '<button type="button" class="bs" onclick="window.closeCoursWizard()">Annuler</button></div>';
  }

  function renderEntry() {
    var main = `
      <h2>${iconLabel('folders', 'Nouveau document')}${modePill()}</h2>
      <p class="cours-wiz-sub">${STATE.mode === 'batch'
        ? 'Création rapide : après chaque enregistrement, tu restes sur l’intercalaire pour enchaîner. Termine pour revoir la liste.'
        : 'Choisis comment placer le document — comme dans un explorateur de fichiers.'}</p>
      ${bannerHtml()}
      <div class="cours-wiz-entry">
        <button type="button" class="cours-wiz-opt" style="--wiz-color:var(--acc);" onclick="window.coursWizardPickDirect()">
          <span class="cours-wiz-ico">${iconHtml('zap', 18)}</span>
          <strong>Créer directement</strong>
          <span class="cours-wiz-hint">Formulaire complet tout de suite — tu choisis matière, classeur et intercalaire dans la fiche.</span>
        </button>
        <button type="button" class="cours-wiz-opt" style="--wiz-color:var(--grn);" onclick="window.coursWizardGo('mat')">
          <span class="cours-wiz-ico">${iconHtml('folder', 18)}</span>
          <strong>Parcourir (Finder)</strong>
          <span class="cours-wiz-hint">Matière → classeur → intercalaire, puis titre et détails.</span>
        </button>
      </div>`;
    return withSessionLayout(main, exitActionsHtml(null));
  }

  function renderMat() {
    var mats = listMatieres();
    var grid = mats.length
      ? mats.map(function (m) {
          var n = countDocs(m.id);
          return `<button type="button" class="cours-wiz-opt" style="--wiz-color:${esc(m.color || '#5b9aff')};" onclick="window.coursWizardPickMat('${esc(m.id)}')">
            <span class="cours-wiz-ico">${iconHtml('book-open', 18)}</span>
            <strong>${esc(m.name || m.label)}</strong>
            <span class="cours-wiz-hint">${esc(m.label)} · ${n} doc${n > 1 ? 's' : ''}</span>
          </button>`;
        }).join('')
      : '<div class="cours-wiz-empty">Aucune matière. Crée-en une dans Réglages.</div>';
    var main = `
      <h2>${iconLabel('book-open', 'Choisir une matière')}${modePill()}</h2>
      <p class="cours-wiz-sub">Sélectionne la matière du document.</p>
      ${crumbHtml()}
      ${bannerHtml()}
      <div class="cours-wiz-grid">${grid}</div>`;
    return withSessionLayout(main, exitActionsHtml('entry'));
  }

  function renderCl() {
    var cls = listClasseurs();
    var grid = cls.length
      ? cls.map(function (c) {
          var n = countDocs(STATE.mat, c.id);
          var ico = window.renderClasseurIcon
            ? window.renderClasseurIcon(c.icon, 18)
            : iconHtml('folder', 18);
          return `<button type="button" class="cours-wiz-opt" style="--wiz-color:${esc(c.color || '#5b9aff')};" onclick="window.coursWizardPickCl('${esc(c.id)}')">
            <span class="cours-wiz-ico">${ico}</span>
            <strong>${esc(c.name)}</strong>
            <span class="cours-wiz-hint">${c.maxInter || 12} intercalaires · ${n} doc${n > 1 ? 's' : ''} ici</span>
          </button>`;
        }).join('')
      : '<div class="cours-wiz-empty">Aucun classeur. Crée-en un dans Réglages.</div>';
    var main = `
      <h2>${iconLabel('folder', 'Choisir un classeur')}${modePill()}</h2>
      <p class="cours-wiz-sub">Où ranger ce document dans ta base.</p>
      ${crumbHtml()}
      ${bannerHtml()}
      <div class="cours-wiz-grid">${grid}</div>`;
    return withSessionLayout(main, exitActionsHtml('mat'));
  }

  function renderInter() {
    var cl = clById(STATE.cl);
    var maxI = cl ? (cl.maxInter || 12) : 12;
    var cells = [];
    for (var i = 1; i <= maxI; i++) {
      var val = String(i).padStart(2, '0');
      var label = window.getInterName ? window.getInterName(cl, val) : val;
      var n = countDocs(STATE.mat, STATE.cl, val);
      cells.push(`<button type="button" class="cours-wiz-opt cours-wiz-opt-compact" style="--wiz-color:var(--gold);" onclick="window.coursWizardPickInter('${val}')">
        <span class="cours-wiz-ico">${iconHtml('bookmark', 14)}</span>
        <strong>${esc(label)}</strong>
        <span class="cours-wiz-hint">n° ${val} · ${n} doc${n > 1 ? 's' : ''}</span>
      </button>`);
    }
    var main = `
      <h2>${iconLabel('bookmark', 'Choisir un intercalaire')}${modePill()}</h2>
      <p class="cours-wiz-sub">${STATE.mode === 'batch'
        ? 'Après enregistrement, tu reviendras ici pour enchaîner.'
        : 'Dernière étape avant le titre et les détails.'}</p>
      ${crumbHtml()}
      ${bannerHtml()}
      <div class="cours-wiz-grid cours-wiz-grid-inter">${cells.join('')}</div>`;
    return withSessionLayout(main, exitActionsHtml('cl'));
  }

  function renderSummary() {
    var n = createdDocs().length;
    return `
      <h2>${iconLabel('layers', 'Résumé de la session')}${modePill()}</h2>
      <p class="cours-wiz-sub">${n
        ? (n + ' document' + (n > 1 ? 's' : '') + ' créé' + (n > 1 ? 's' : '') + ' — tu peux encore modifier ou supprimer.')
        : 'Aucun document dans cette session.'}</p>
      ${inventoryHtml({ force: true })}
      <div class="macts" style="margin-top:16px;">
        <button type="button" class="bs" onclick="window.coursWizardContinueFromSummary()">Continuer</button>
        <button type="button" class="bp" onclick="window.closeCoursWizard()">Valider</button>
      </div>`;
  }

  function paint() {
    var ov = ensureOverlay();
    var body = '';
    if (STATE.step === 'entry') body = renderEntry();
    else if (STATE.step === 'mat') body = renderMat();
    else if (STATE.step === 'cl') body = renderCl();
    else if (STATE.step === 'inter') body = renderInter();
    else if (STATE.step === 'summary') body = renderSummary();
    else body = renderEntry();

    var wide = STATE.step === 'summary' || (STATE.mode === 'batch' && STATE.createdUids.length > 0);
    ov.innerHTML = '<div class="modal cours-wiz-modal card-type-surface' + (wide ? ' cours-wiz-wide' : '') + '" role="dialog" aria-modal="true">' + body + '</div>';
    ov.classList.remove('hidden');
    if (window.hydrateIcons) window.hydrateIcons(ov);
  }

  function openFormWithContext(opts) {
    var o = opts || {};
    /* Contexte lu par openModalCours / saveCours */
    window._coursWizardActive = true;
    window._coursWizardMode = STATE.mode;
    window._coursWizardCtx = {
      mat: o.mat != null ? o.mat : STATE.mat,
      cl: o.cl != null ? o.cl : STATE.cl,
      inter: o.inter != null ? o.inter : STATE.inter,
      mode: STATE.mode,
      fromBrowse: !!(STATE.mat && STATE.cl && STATE.inter)
    };
    var ov = document.getElementById('ovCoursWizard');
    if (ov) ov.classList.add('hidden');
    if (!window.D) {
      if (ov) ov.classList.remove('hidden');
      paint();
      return;
    }
    if (typeof window.openModalCours === 'function') {
      window.openModalCours({
        fromWizard: true,
        mat: window._coursWizardCtx.mat,
        cl: window._coursWizardCtx.cl,
        inter: window._coursWizardCtx.inter
      });
      /* Si le formulaire n’a pas pu s’ouvrir, réafficher le wizard */
      var formOv = document.getElementById('ovCours');
      if (formOv && formOv.classList.contains('hidden') && ov) {
        ov.classList.remove('hidden');
        paint();
      }
    } else if (ov) {
      ov.classList.remove('hidden');
      paint();
    }
  }

  window.openCoursWizard = function (mode) {
    injectStyles();
    STATE.mode = mode === 'batch' ? 'batch' : 'single';
    STATE.step = 'entry';
    STATE.mat = null;
    STATE.cl = null;
    STATE.inter = null;
    STATE.createdCount = 0;
    STATE.lastUid = null;
    STATE.createdUids = [];
    window._coursWizardResumeAfterEdit = false;
    window._coursWizardActive = true;
    window._coursWizardMode = STATE.mode;
    window._coursWizardCtx = { mode: STATE.mode };
    paint();
  };

  window.closeCoursWizard = function () {
    var ov = document.getElementById('ovCoursWizard');
    if (ov) ov.classList.add('hidden');
    window._coursWizardActive = false;
    window._coursWizardMode = null;
    window._coursWizardCtx = null;
    window._coursWizardResumeAfterEdit = false;
    STATE.step = 'entry';
    STATE.createdUids = [];
    STATE.createdCount = 0;
    STATE.lastUid = null;
  };

  window.coursWizardQuit = function () {
    if (STATE.mode === 'batch' && STATE.createdUids.length) {
      STATE.step = 'summary';
      paint();
      return;
    }
    window.closeCoursWizard();
  };

  window.coursWizardContinueFromSummary = function () {
    if (STATE.mat && STATE.cl) {
      STATE.step = 'inter';
    } else {
      STATE.step = 'entry';
    }
    paint();
  };

  window.coursWizardGo = function (step) {
    if (step === 'entry') {
      STATE.step = 'entry';
      STATE.mat = null;
      STATE.cl = null;
      STATE.inter = null;
    } else if (step === 'mat') {
      STATE.step = 'mat';
      STATE.mat = null;
      STATE.cl = null;
      STATE.inter = null;
    } else if (step === 'cl') {
      if (!STATE.mat) { STATE.step = 'mat'; paint(); return; }
      STATE.step = 'cl';
      STATE.inter = null;
    } else if (step === 'inter') {
      if (!STATE.mat) { STATE.step = 'mat'; paint(); return; }
      if (!STATE.cl) { STATE.step = 'cl'; paint(); return; }
      STATE.step = 'inter';
    } else if (step === 'summary') {
      STATE.step = 'summary';
    }
    paint();
  };

  /** Annulation du formulaire : revenir au wizard sans fermer (surtout mode batch). */
  window.coursWizardCancelForm = function () {
    if (window._coursWizardResumeAfterEdit) {
      window.coursWizardResumeAfterEdit();
      return;
    }
    var mode = window._coursWizardMode || (window._coursWizardCtx && window._coursWizardCtx.mode);
    var ctx = window._coursWizardCtx || {};
    if (!mode) {
      window.closeCoursWizard();
      return;
    }
    STATE.mode = mode === 'batch' ? 'batch' : 'single';
    if (ctx.mat && ctx.cl) {
      STATE.mat = ctx.mat;
      STATE.cl = ctx.cl;
      STATE.inter = ctx.inter || null;
      STATE.step = 'inter';
    } else {
      STATE.mat = null;
      STATE.cl = null;
      STATE.inter = null;
      STATE.step = 'entry';
    }
    window._coursWizardActive = true;
    paint();
  };

  window.coursWizardEditCreated = function (uid) {
    if (!uid) return;
    if (!window.D || !window.D.cours || !window.D.cours.some(function (c) { return c && c.uid === uid; })) {
      return;
    }
    window._coursWizardResumeAfterEdit = true;
    window._coursWizardActive = true;
    window._coursWizardMode = 'batch';
    var ov = document.getElementById('ovCoursWizard');
    if (ov) ov.classList.add('hidden');
    if (typeof window.editCours === 'function') {
      window.editCours(uid, { keepWizard: true });
      /* Si editCours a échoué sans ouvrir le form, ne pas laisser le flag coincé */
      if (!window.editUid) {
        window._coursWizardResumeAfterEdit = false;
        if (ov) ov.classList.remove('hidden');
        paint();
      }
    }
  };

  window.coursWizardDeleteCreated = function (uid) {
    if (!uid) return;
    var run = function () {
      if (!window.D || !window.D.cours) return;
      window.D.cours = window.D.cours.filter(function (c) { return c.uid !== uid; });
      STATE.createdUids = STATE.createdUids.filter(function (u) { return u !== uid; });
      STATE.createdCount = STATE.createdUids.length;
      if (STATE.lastUid === uid) STATE.lastUid = STATE.createdUids[STATE.createdUids.length - 1] || null;
      if (typeof window.pruneUnsortedMatiere === 'function') window.pruneUnsortedMatiere();
      if (typeof window.pruneUnsortedClasseur === 'function') window.pruneUnsortedClasseur();
      if (typeof window.save === 'function') window.save();
      if (typeof window.renderCours === 'function') window.renderCours();
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderMatieres === 'function') window.renderMatieres();
      if (typeof window.renderClasseurs === 'function') window.renderClasseurs();
      if (typeof window.renderNotes === 'function') window.renderNotes();
      paint();
    };
    if (typeof window.sysConfirm === 'function') {
      window.sysConfirm('Supprimer définitivement le document ' + uid + ' ?', run, 'Suppression');
    } else {
      run();
    }
  };

  window.coursWizardResumeAfterEdit = function () {
    window._coursWizardResumeAfterEdit = false;
    STATE.mode = 'batch';
    STATE.step = 'summary';
    window._coursWizardActive = true;
    window._coursWizardMode = 'batch';
    window._coursWizardCtx = {
      mat: STATE.mat,
      cl: STATE.cl,
      inter: STATE.inter,
      mode: 'batch',
      fromBrowse: !!(STATE.mat && STATE.cl)
    };
    paint();
  };

  window.coursWizardPickDirect = function () {
    STATE.step = 'form';
    STATE.mat = null;
    STATE.cl = null;
    STATE.inter = null;
    openFormWithContext({});
  };

  window.coursWizardPickMat = function (matId) {
    STATE.mat = matId;
    STATE.cl = null;
    STATE.inter = null;
    STATE.step = 'cl';
    paint();
  };

  window.coursWizardPickCl = function (clId) {
    STATE.cl = clId;
    STATE.inter = null;
    STATE.step = 'inter';
    paint();
  };

  window.coursWizardPickInter = function (inter) {
    STATE.inter = inter;
    STATE.step = 'form';
    openFormWithContext({ mat: STATE.mat, cl: STATE.cl, inter: STATE.inter });
  };

  /**
   * Appelé par saveCours après une création réussie (pas une édition).
   * @param {string} uid
   * @param {{mat?:string,cl?:string,inter?:string}} saved
   * @returns {boolean} true si le wizard a repris la main (batch)
   */
  window.coursWizardAfterCreate = function (uid, saved) {
    var mode = window._coursWizardMode || (window._coursWizardCtx && window._coursWizardCtx.mode);
    var s = saved || {};
    if (mode !== 'batch') {
      window.closeCoursWizard();
      return false;
    }
    STATE.mode = 'batch';
    STATE.createdCount += 1;
    STATE.lastUid = uid || null;
    if (uid && STATE.createdUids.indexOf(uid) === -1) STATE.createdUids.push(uid);
    /* Toujours revenir à l’intercalaire du document venant d’être créé */
    if (s.mat && s.cl) {
      STATE.mat = s.mat;
      STATE.cl = s.cl;
      STATE.inter = s.inter || null;
      STATE.step = 'inter';
    } else {
      STATE.step = 'entry';
      STATE.mat = null;
      STATE.cl = null;
      STATE.inter = null;
    }
    window._coursWizardActive = true;
    window._coursWizardMode = 'batch';
    window._coursWizardCtx = {
      mat: STATE.mat,
      cl: STATE.cl,
      inter: STATE.inter,
      mode: 'batch',
      fromBrowse: !!(STATE.mat && STATE.cl)
    };
    paint();
    return true;
  };

  window.closeCoursCreateMenu = function () {
    var menu = document.getElementById('coursCreateMenu');
    var trigger = document.getElementById('btnCoursCreateMenu');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };

  window.toggleCoursCreateMenu = function () {
    var menu = document.getElementById('coursCreateMenu');
    var trigger = document.getElementById('btnCoursCreateMenu');
    if (!menu || !trigger) return;
    var open = !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  window.ensureCoursPaneToolbar = function () {
    injectStyles();
    var pane = document.getElementById('paneCours');
    if (!pane) return;

    var existing = document.getElementById('coursPaneToolbar');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'coursPaneToolbar';
      existing.className = 'cours-pane-toolbar';
      existing.innerHTML =
        '<div class="notes-metric-toggle cours-browse-toggle" role="group" aria-label="Affichage Base Doc">' +
          '<button type="button" class="notes-metric-btn is-active" id="btnCoursBrowseTree" data-browse="tree">Arbre</button>' +
          '<button type="button" class="notes-metric-btn" id="btnCoursBrowseMat" data-browse="mat">Matières</button>' +
        '</div>' +
        '<div class="cours-create-menu" id="coursCreateMenu">' +
          '<button type="button" class="cours-create-trigger" id="btnCoursCreateMenu" aria-expanded="false" aria-haspopup="true" title="Créer un document">' +
            (window.iconLabel ? window.iconLabel('plus', 'Créer') : 'Créer') +
          '</button>' +
          '<div class="cours-create-dropdown" role="menu">' +
            '<button type="button" class="cours-create-item" id="btnCoursCreateSingle" role="menuitem">' +
              '<strong>Nouveau document</strong><span class="hint">1 cours — comme le menu éclair</span>' +
            '</button>' +
            '<button type="button" class="cours-create-item" id="btnCoursBatchCreate" role="menuitem">' +
              '<strong>Création rapide</strong><span class="hint">Enchaîne plusieurs docs</span>' +
            '</button>' +
          '</div>' +
        '</div>';
      var filters = pane.querySelector('.filters');
      if (filters) pane.insertBefore(existing, filters);
      else pane.insertBefore(existing, pane.firstChild);
    } else if (!document.getElementById('btnCoursBrowseTree')) {
      var toggleWrap = document.createElement('div');
      toggleWrap.className = 'notes-metric-toggle cours-browse-toggle';
      toggleWrap.setAttribute('role', 'group');
      toggleWrap.setAttribute('aria-label', 'Affichage Base Doc');
      toggleWrap.innerHTML =
        '<button type="button" class="notes-metric-btn is-active" id="btnCoursBrowseTree" data-browse="tree">Arbre</button>' +
        '<button type="button" class="notes-metric-btn" id="btnCoursBrowseMat" data-browse="mat">Matières</button>';
      existing.insertBefore(toggleWrap, existing.firstChild);
    }

    var btnTree = document.getElementById('btnCoursBrowseTree');
    var btnMat = document.getElementById('btnCoursBrowseMat');
    if (btnTree && !btnTree._coursBrowseBound) {
      btnTree._coursBrowseBound = true;
      btnTree.addEventListener('click', function () {
        if (typeof window.setCoursBrowseMode === 'function') window.setCoursBrowseMode('tree');
      });
    }
    if (btnMat && !btnMat._coursBrowseBound) {
      btnMat._coursBrowseBound = true;
      btnMat.addEventListener('click', function () {
        if (typeof window.setCoursBrowseMode === 'function') window.setCoursBrowseMode('mat');
      });
    }

    var trigger = document.getElementById('btnCoursCreateMenu');
    var btnSingle = document.getElementById('btnCoursCreateSingle');
    var btnBatch = document.getElementById('btnCoursBatchCreate');

    if (trigger && !trigger._coursWizBound) {
      trigger._coursWizBound = true;
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        window.toggleCoursCreateMenu();
      });
    }
    if (btnSingle && !btnSingle._coursWizBound) {
      btnSingle._coursWizBound = true;
      btnSingle.addEventListener('click', function () {
        window.closeCoursCreateMenu();
        window.openCoursWizard('single');
      });
    }
    if (btnBatch && !btnBatch._coursWizBound) {
      btnBatch._coursWizBound = true;
      if (typeof btnBatch.removeAttribute === 'function') btnBatch.removeAttribute('onclick');
      btnBatch.addEventListener('click', function () {
        window.closeCoursCreateMenu();
        window.openCoursWizard('batch');
      });
    }

    if (!window._coursCreateMenuDocBound) {
      window._coursCreateMenuDocBound = true;
      document.addEventListener('click', function (e) {
        var menu = document.getElementById('coursCreateMenu');
        if (!menu || !menu.classList.contains('open')) return;
        if (menu.contains(e.target)) return;
        window.closeCoursCreateMenu();
      });
    }

    if (existing && typeof window.hydrateIcons === 'function') {
      try { window.hydrateIcons(existing); } catch (err) { /* non bloquant */ }
    }
  };

  /* Init toolbar dès que le DOM est prêt (jamais bloquer le chargement du module) */
  function safeInitToolbar() {
    try {
      window.ensureCoursPaneToolbar();
    } catch (err) {
      console.error('cours-wizard toolbar init:', err);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitToolbar);
  } else {
    safeInitToolbar();
  }
})();
