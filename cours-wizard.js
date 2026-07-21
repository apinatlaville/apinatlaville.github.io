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
    step: 'entry',  // entry | mat | cl | inter | form
    mat: null,
    cl: null,
    inter: null,
    createdCount: 0,
    lastUid: null
  };

  function esc(s) {
    return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s);
  }

  function iconLabel(name, text) {
    return window.iconLabel ? window.iconLabel(name, text) : esc(text);
  }

  function iconHtml(name, size) {
    return window.iconHtml ? window.iconHtml(name, size || 18) : '';
  }

  function injectStyles() {
    if (document.getElementById('cours-wizard-styles')) return;
    var tag = document.createElement('style');
    tag.id = 'cours-wizard-styles';
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
.cours-pane-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.cours-pane-toolbar .bp {
  padding: 8px 14px;
  font-size: 13px;
}
`;
    document.head.appendChild(tag);
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
        if (e.target === ov) window.closeCoursWizard();
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
        (STATE.mode === 'batch' ? ' — continue sur cet intercalaire.' : '.'))
      : '';
    if (STATE.mode === 'batch' && STATE.createdCount > 1) {
      msg += ' <span style="color:var(--mut);">(' + STATE.createdCount + ' créés)</span>';
    }
    return msg ? '<div class="cours-wiz-banner">' + msg + '</div>' : '';
  }

  function renderEntry() {
    return `
      <h2>${iconLabel('folders', 'Nouveau document')}${modePill()}</h2>
      <p class="cours-wiz-sub">${STATE.mode === 'batch'
        ? 'Création rapide : après chaque enregistrement, tu restes sur l’intercalaire pour enchaîner le catalogue virtuel.'
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
      </div>
      <div class="macts" style="margin-top:16px;">
        <button type="button" class="bs" onclick="window.closeCoursWizard()">Annuler</button>
      </div>`;
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
    return `
      <h2>${iconLabel('book-open', 'Choisir une matière')}${modePill()}</h2>
      <p class="cours-wiz-sub">Sélectionne la matière du document.</p>
      ${crumbHtml()}
      ${bannerHtml()}
      <div class="cours-wiz-grid">${grid}</div>
      <div class="macts" style="margin-top:16px;">
        <button type="button" class="bs" onclick="window.coursWizardGo('entry')">Retour</button>
        <button type="button" class="bs" onclick="window.closeCoursWizard()">Annuler</button>
      </div>`;
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
    return `
      <h2>${iconLabel('folder', 'Choisir un classeur')}${modePill()}</h2>
      <p class="cours-wiz-sub">Où ranger ce document dans ta base.</p>
      ${crumbHtml()}
      ${bannerHtml()}
      <div class="cours-wiz-grid">${grid}</div>
      <div class="macts" style="margin-top:16px;">
        <button type="button" class="bs" onclick="window.coursWizardGo('mat')">Retour</button>
        <button type="button" class="bs" onclick="window.closeCoursWizard()">Annuler</button>
      </div>`;
  }

  function renderInter() {
    var cl = clById(STATE.cl);
    var maxI = cl ? (cl.maxInter || 12) : 12;
    var cells = [];
    for (var i = 1; i <= maxI; i++) {
      var val = String(i).padStart(2, '0');
      var label = window.getInterName ? window.getInterName(cl, val) : val;
      var n = countDocs(STATE.mat, STATE.cl, val);
      cells.push(`<button type="button" class="cours-wiz-opt" style="--wiz-color:var(--gold);" onclick="window.coursWizardPickInter('${val}')">
        <span class="cours-wiz-ico">${iconHtml('bookmark', 18)}</span>
        <strong>${esc(label)}</strong>
        <span class="cours-wiz-hint">n° ${val} · ${n} doc${n > 1 ? 's' : ''}</span>
      </button>`);
    }
    return `
      <h2>${iconLabel('bookmark', 'Choisir un intercalaire')}${modePill()}</h2>
      <p class="cours-wiz-sub">${STATE.mode === 'batch'
        ? 'Après enregistrement, tu reviendras ici pour enchaîner.'
        : 'Dernière étape avant le titre et les détails.'}</p>
      ${crumbHtml()}
      ${bannerHtml()}
      <div class="cours-wiz-grid">${cells.join('')}</div>
      <div class="macts" style="margin-top:16px;">
        <button type="button" class="bs" onclick="window.coursWizardGo('cl')">Retour</button>
        <button type="button" class="bs" onclick="window.closeCoursWizard()">Annuler</button>
      </div>`;
  }

  function paint() {
    var ov = ensureOverlay();
    var body = '';
    if (STATE.step === 'entry') body = renderEntry();
    else if (STATE.step === 'mat') body = renderMat();
    else if (STATE.step === 'cl') body = renderCl();
    else if (STATE.step === 'inter') body = renderInter();
    else body = renderEntry();

    ov.innerHTML = `<div class="modal cours-wiz-modal card-type-surface" role="dialog" aria-modal="true">${body}</div>`;
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
    if (typeof window.openModalCours === 'function') {
      window.openModalCours({
        fromWizard: true,
        mat: window._coursWizardCtx.mat,
        cl: window._coursWizardCtx.cl,
        inter: window._coursWizardCtx.inter
      });
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
    STATE.step = 'entry';
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
    }
    paint();
  };

  /** Annulation du formulaire : revenir au wizard sans fermer (surtout mode batch). */
  window.coursWizardCancelForm = function () {
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

  window.ensureCoursPaneToolbar = function () {
    injectStyles();
    var btn = document.getElementById('btnCoursBatchCreate');
    if (!btn) {
      var pane = document.getElementById('paneCours');
      if (!pane) return;
      var existing = document.getElementById('coursPaneToolbar');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'coursPaneToolbar';
        existing.className = 'cours-pane-toolbar';
        existing.innerHTML = '<button type="button" class="bp" id="btnCoursBatchCreate" title="Créer plusieurs documents à la suite">' +
          (window.iconLabel ? window.iconLabel('layers', 'Création rapide') : 'Création rapide') +
          '</button>';
        var filters = pane.querySelector('.filters');
        if (filters) pane.insertBefore(existing, filters);
        else pane.insertBefore(existing, pane.firstChild);
        btn = document.getElementById('btnCoursBatchCreate');
      } else {
        btn = existing.querySelector('#btnCoursBatchCreate') || document.getElementById('btnCoursBatchCreate');
      }
    }
    if (btn && !btn._coursWizBound) {
      btn._coursWizBound = true;
      /* Pas de addEventListener si onclick HTML déjà présent (évite double ouverture) */
      if (!btn.getAttribute('onclick')) {
        btn.addEventListener('click', function () {
          window.openCoursWizard('batch');
        });
      }
    }
    var bar = document.getElementById('coursPaneToolbar');
    if (bar && typeof window.hydrateIcons === 'function') {
      try { window.hydrateIcons(bar); } catch (err) { /* non bloquant */ }
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
