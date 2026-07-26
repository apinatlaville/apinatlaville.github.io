/**
 * anki-quick-latex.js — Popup LaTeX Easy (remplace temporairement ovQuickCreate)
 * Même modèle que le Labo LaTeX (mountLatexEasyEditor).
 *
 * Entrée : window.openQuickLatexCard({
 *   latexRecto, latexVerso, focusSide, question, reponse,
 *   restoreOverlay,   // ex. 'ovQuickCreate'
 *   fieldQ, fieldR,   // ids des champs à remplir (quickQ / qkQ…)
 *   onApplied         // callback optionnel après Appliquer
 * })
 */
(function () {
  'use strict';

  var CTX = null;
  var _editorRecto = null;
  var _editorVerso = null;
  var _activeFace = 'recto';

  function $(id) { return document.getElementById(id); }

  function defaultCtx() {
    return {
      latexRecto: true,
      latexVerso: false,
      focusSide: 'recto',
      question: '',
      reponse: '',
      restoreOverlay: null,
      fieldQ: 'quickQ',
      fieldR: 'quickR',
      onApplied: null
    };
  }

  function hideOverlay(id) {
    var ov = $(id);
    if (ov) ov.classList.add('hidden');
  }

  function showOverlay(id) {
    var ov = $(id);
    if (ov) ov.classList.remove('hidden');
  }

  function destroyEditors() {
    if (_editorRecto && typeof _editorRecto.destroy === 'function') _editorRecto.destroy();
    if (_editorVerso && typeof _editorVerso.destroy === 'function') _editorVerso.destroy();
    _editorRecto = null;
    _editorVerso = null;
  }

  function ensureOverlay() {
    var ov = $('ovQuickLatex');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovQuickLatex';
      ov.className = 'ov ov-scroll';
      document.body.appendChild(ov);
    }
    return ov;
  }

  function writeBackFields() {
    if (!CTX) return;
    var qEl = CTX.fieldQ ? $(CTX.fieldQ) : null;
    var rEl = CTX.fieldR ? $(CTX.fieldR) : null;
    if (CTX.latexRecto && _editorRecto) {
      var q = _editorRecto.getInline();
      if (qEl) qEl.value = q;
      CTX.question = q;
    }
    if (CTX.latexVerso && _editorVerso) {
      var r = _editorVerso.getInline();
      if (rEl) rEl.value = r;
      CTX.reponse = r;
    }
  }

  function closeLatexPopup(apply) {
    if (apply) writeBackFields();
    destroyEditors();
    hideOverlay('ovQuickLatex');
    var restore = CTX && CTX.restoreOverlay;
    var onApplied = CTX && CTX.onApplied;
    var applied = !!apply;
    CTX = null;
    window._quickLatexCtx = null;
    if (restore) showOverlay(restore);
    if (applied && typeof onApplied === 'function') {
      try { onApplied(); } catch (e) { /* ignore */ }
    }
  }

  function syncFaceVisibility() {
    var rectoPane = $('qlEasyPaneRecto');
    var versoPane = $('qlEasyPaneVerso');
    var tabR = $('qlEasyTabRecto');
    var tabV = $('qlEasyTabVerso');
    if (rectoPane) rectoPane.hidden = !(CTX && CTX.latexRecto) || _activeFace !== 'recto';
    if (versoPane) versoPane.hidden = !(CTX && CTX.latexVerso) || _activeFace !== 'verso';
    if (tabR) {
      tabR.classList.toggle('is-active', _activeFace === 'recto');
      tabR.setAttribute('aria-selected', _activeFace === 'recto' ? 'true' : 'false');
    }
    if (tabV) {
      tabV.classList.toggle('is-active', _activeFace === 'verso');
      tabV.setAttribute('aria-selected', _activeFace === 'verso' ? 'true' : 'false');
    }
    var ed = _activeFace === 'verso' ? _editorVerso : _editorRecto;
    if (ed && ed.focus) ed.focus();
  }

  function renderPopup() {
    var ov = ensureOverlay();
    CTX = window._quickLatexCtx || CTX || defaultCtx();
    window._quickLatexCtx = CTX;

    if (!CTX.latexRecto && !CTX.latexVerso) CTX.latexRecto = true;

    var both = !!(CTX.latexRecto && CTX.latexVerso);
    if (CTX.focusSide === 'verso' && CTX.latexVerso) _activeFace = 'verso';
    else if (CTX.latexRecto) _activeFace = 'recto';
    else _activeFace = 'verso';

    var tabsHtml = '';
    if (both) {
      tabsHtml =
        '<div class="ql-easy-face-tabs notes-metric-toggle" role="tablist" aria-label="Face de la carte">' +
          '<button type="button" class="notes-metric-btn' + (_activeFace === 'recto' ? ' is-active' : '') +
            '" id="qlEasyTabRecto" role="tab">Recto</button>' +
          '<button type="button" class="notes-metric-btn' + (_activeFace === 'verso' ? ' is-active' : '') +
            '" id="qlEasyTabVerso" role="tab">Verso</button>' +
        '</div>';
    }

    ov.classList.remove('hidden');
    ov.innerHTML =
      '<div class="modal card-type-surface ql-easy-modal">' +
        '<div class="ql-easy-modal-head">' +
          '<h2>' + (typeof window.iconLabel === 'function'
            ? window.iconLabel('sigma', 'Carte LaTeX Easy')
            : 'Carte LaTeX Easy') + '</h2>' +
          '<p class="anki-mut" style="font-size:12px;margin:4px 0 0;">Même éditeur que le Labo LaTeX — Appliquer renvoie au popup Rapide</p>' +
        '</div>' +
        tabsHtml +
        '<div id="qlEasyPaneRecto" class="ql-easy-pane"></div>' +
        '<div id="qlEasyPaneVerso" class="ql-easy-pane"></div>' +
        '<div id="qlEasyError" class="anki-form-error" role="alert"></div>' +
        '<div class="macts">' +
          '<button type="button" class="bs" id="qlEasyCancel">Retour</button>' +
          '<button type="button" class="bp" id="qlEasyApply">' +
            (typeof window.iconLabel === 'function' ? window.iconLabel('check', 'Appliquer') : 'Appliquer') +
          '</button>' +
        '</div>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(ov);

    destroyEditors();

    var paneR = $('qlEasyPaneRecto');
    var paneV = $('qlEasyPaneVerso');
    var mountJobs = [];

    if (CTX.latexRecto && paneR && typeof window.mountLatexEasyEditor === 'function') {
      paneR.innerHTML = '<div id="qlEasyHostRecto"></div>';
      _editorRecto = window.mountLatexEasyEditor($('qlEasyHostRecto'), {
        prefix: 'qlEasyRecto',
        title: both ? 'Recto · LaTeX Easy' : 'Recto / question · LaTeX Easy',
        seedInline: CTX.question || '',
        autofocus: _activeFace === 'recto'
      });
      if (_editorRecto && _editorRecto.ready) mountJobs.push(_editorRecto.ready);
    } else if (paneR) {
      paneR.innerHTML = '';
    }

    if (CTX.latexVerso && paneV && typeof window.mountLatexEasyEditor === 'function') {
      paneV.innerHTML = '<div id="qlEasyHostVerso"></div>';
      _editorVerso = window.mountLatexEasyEditor($('qlEasyHostVerso'), {
        prefix: 'qlEasyVerso',
        title: both ? 'Verso · LaTeX Easy' : 'Verso / réponse · LaTeX Easy',
        seedInline: CTX.reponse || '',
        autofocus: _activeFace === 'verso'
      });
      if (_editorVerso && _editorVerso.ready) mountJobs.push(_editorVerso.ready);
    } else if (paneV) {
      paneV.innerHTML = '';
    }

    Promise.all(mountJobs).then(function () {
      syncFaceVisibility();
    }).catch(function (err) {
      var errEl = $('qlEasyError');
      if (errEl) errEl.textContent = (err && err.message) || 'Éditeur LaTeX indisponible';
    });

    syncFaceVisibility();

    var tabR = $('qlEasyTabRecto');
    var tabV = $('qlEasyTabVerso');
    if (tabR) tabR.addEventListener('click', function () {
      _activeFace = 'recto';
      syncFaceVisibility();
    });
    if (tabV) tabV.addEventListener('click', function () {
      _activeFace = 'verso';
      syncFaceVisibility();
    });

    var cancel = $('qlEasyCancel');
    if (cancel) cancel.addEventListener('click', function () { closeLatexPopup(false); });
    var apply = $('qlEasyApply');
    if (apply) apply.addEventListener('click', function () { closeLatexPopup(true); });

    ov.onclick = function (e) {
      if (e.target === ov) closeLatexPopup(false);
    };
  }

  window.openQuickLatexCard = function (opts) {
    CTX = Object.assign(defaultCtx(), opts || {});
    window._quickLatexCtx = CTX;

    if (CTX.restoreOverlay) hideOverlay(CTX.restoreOverlay);

    var go = function () {
      if (typeof window.mountLatexEasyEditor !== 'function') {
        if (typeof window.sysAlert === 'function') {
          window.sysAlert('Éditeur LaTeX Easy non chargé.', 'Erreur');
        }
        if (CTX.restoreOverlay) showOverlay(CTX.restoreOverlay);
        return;
      }
      renderPopup();
    };

    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('quickLatex').then(go).catch(go);
    } else if (typeof window.ensureMathLive === 'function') {
      window.ensureMathLive().then(go).catch(go);
    } else {
      go();
    }
  };

  /** Compat : ancien rendu onglet — redirige vers le popup */
  window.renderQuickLatexCard = function () {
    if (window._quickLatexCtx) {
      window.openQuickLatexCard(window._quickLatexCtx);
    }
  };

  window.closeQuickLatexPopup = function (apply) {
    closeLatexPopup(!!apply);
  };
})();
