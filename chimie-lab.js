/**
 * chimie-lab.js — Labo Chimie (test)
 * Éditeur structurel COMPLET (Kekule Composer fullFunc) :
 * atomes, liaisons, cycles, charges, formules, glyphes/réactions,
 * templates, undo/redo, import/export, inspecteur d’objets.
 */
(function () {
  'use strict';

  var KEKULE_VER = '1.0.4';
  var CDN_BASE = 'https://cdn.jsdelivr.net/npm/kekule@' + KEKULE_VER + '/dist';
  var CDN_JS = CDN_BASE + '/kekule.min.js';
  var CDN_CSS = CDN_BASE + '/themes/default/kekule.css';

  var _loadPromise = null;
  var _built = false;
  var _composer = null;
  var _exportTimer = null;

  function esc(s) {
    return typeof window.escHtml === 'function'
      ? window.escHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  function loadStylesheet(href) {
    if (document.querySelector('link[data-kekule="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-kekule', href);
    document.head.appendChild(link);
  }

  function ensureKekule() {
    if (window.Kekule && window.Kekule.Editor && window.Kekule.Editor.Composer) {
      return Promise.resolve(window.Kekule);
    }
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise(function (resolve, reject) {
      loadStylesheet(CDN_CSS);
      var s = document.createElement('script');
      s.src = CDN_JS;
      s.async = true;
      s.onload = function () {
        if (window.Kekule && window.Kekule.Editor && window.Kekule.Editor.Composer) {
          resolve(window.Kekule);
        } else {
          _loadPromise = null;
          reject(new Error('Kekule chargé sans Composer.'));
        }
      };
      s.onerror = function () {
        _loadPromise = null;
        reject(new Error('Impossible de charger Kekule (réseau / CDN).'));
      };
      document.head.appendChild(s);
    });
    return _loadPromise;
  }

  function boardHeight() {
    var h = window.innerHeight || 800;
    /* Presque plein écran sous la barre d’actions */
    return Math.max(420, Math.min(780, h - 160)) + 'px';
  }

  /**
   * Mode « appli web complète » : fullFunc + tous les outils chimie.
   * (Les exemples C / cycle / Br n’étaient que des cas d’usage.)
   */
  function configureFullComposer(composer) {
    try {
      if (typeof composer.setPredefinedSetting === 'function') {
        composer.setPredefinedSetting('fullFunc');
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof composer.setEnableOperHistory === 'function') composer.setEnableOperHistory(true);
      if (typeof composer.setEnableLoadNewFile === 'function') composer.setEnableLoadNewFile(true);
      if (typeof composer.setEnableCreateNewDoc === 'function') composer.setEnableCreateNewDoc(true);
      if (typeof composer.setAllowCreateNewChild === 'function') composer.setAllowCreateNewChild(true);
      if (typeof composer.setEnableStyleToolbar === 'function') composer.setEnableStyleToolbar(true);
    } catch (e2) { /* ignore */ }

    try {
      if (typeof composer.setCommonToolButtons === 'function') {
        composer.setCommonToolButtons([
          'newDoc', 'loadData', 'saveData',
          'undo', 'redo', 'copy', 'cut', 'paste',
          'zoomIn', 'reset', 'zoomOut',
          'config', 'objInspector'
        ]);
      }
      if (typeof composer.setChemToolButtons === 'function') {
        composer.setChemToolButtons([
          'manipulate', 'erase',
          'bond', 'atom', 'formula', 'atomAndFormula',
          'ring', 'charge',
          'glyph', 'textAndImage', 'textImage'
        ]);
      }
      if (typeof composer.setStyleToolComponentNames === 'function') {
        composer.setStyleToolComponentNames([
          'fontName', 'fontSize', 'color', 'textDirection', 'textAlign'
        ]);
      }
      if (typeof composer.setAllowedObjModifierCategories === 'function' && window.Kekule.Editor && window.Kekule.Editor.ObjModifier) {
        var Cat = window.Kekule.Editor.ObjModifier.Category;
        composer.setAllowedObjModifierCategories([
          Cat.GENERAL,
          Cat.CHEM_STRUCTURE,
          Cat.STYLE,
          Cat.GLYPH
        ].filter(Boolean));
      }
    } catch (e3) { /* ignore */ }

    /* Rendu plus lisible (type appli chimie) */
    try {
      var rc = composer.getRenderConfigs && composer.getRenderConfigs();
      if (rc && rc.getLengthConfigs) {
        var lc = rc.getLengthConfigs();
        if (lc && lc.setBondLength) lc.setBondLength(1.0);
      }
    } catch (e4) { /* ignore */ }
  }

  function destroyComposer() {
    if (_composer) {
      try {
        if (typeof _composer.finalize === 'function') _composer.finalize();
      } catch (e) { /* ignore */ }
      _composer = null;
    }
    var host = document.getElementById('chimieComposerHost');
    if (host) host.innerHTML = '';
  }

  function mountComposer(host) {
    if (!host || !window.Kekule) return null;
    destroyComposer();
    host.innerHTML = '';
    var box = document.createElement('div');
    box.id = 'chimieComposerBoard';
    box.className = 'chimie-composer-board';
    host.appendChild(box);

    var composer = new window.Kekule.Editor.Composer(box);
    composer.setDimension('100%', boardHeight());
    configureFullComposer(composer);
    _composer = composer;

    /* Écoute large : changements → export */
    try {
      if (typeof composer.addEventListener === 'function') {
        ['editDone', 'change', 'selectionChange', 'load'].forEach(function (ev) {
          try {
            composer.addEventListener(ev, function () { scheduleExport(); });
          } catch (e) { /* ignore */ }
        });
      }
    } catch (e2) { /* ignore */ }

    return composer;
  }

  function firstMolecule() {
    if (!_composer || !window.Kekule) return null;
    try {
      var mols = _composer.exportObjs(window.Kekule.Molecule);
      return mols && mols.length ? mols[0] : null;
    } catch (e) {
      return null;
    }
  }

  function exportFormat(preferred) {
    var mol = firstMolecule();
    if (!mol || !window.Kekule || !window.Kekule.IO) return '';
    var map = {
      smi: ['smi', 'smiles', 'SMILES'],
      mol: ['mol', 'mol2000', 'mdl', 'sd'],
      cml: ['cml', 'CML']
    };
    var candidates = map[preferred] || [preferred];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var out = window.Kekule.IO.saveFormatData(mol, candidates[i]);
        if (out) return String(out).trim();
      } catch (e) { /* next */ }
    }
    /* Fallback : document entier */
    try {
      var doc = _composer.getChemObj && _composer.getChemObj();
      if (doc) {
        for (var j = 0; j < candidates.length; j++) {
          try {
            var out2 = window.Kekule.IO.saveFormatData(doc, candidates[j]);
            if (out2) return String(out2).trim();
          } catch (e2) { /* next */ }
        }
      }
    } catch (e3) { /* ignore */ }
    return '';
  }

  function copyText(text, okMsg) {
    var t = String(text || '');
    if (!t) {
      toast('Rien à copier — dessine d’abord une structure');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast(okMsg || 'Copié'); })
        .catch(function () { window.prompt('Copier :', t); });
    } else {
      window.prompt('Copier :', t);
    }
  }

  function scheduleExport() {
    if (_exportTimer) clearTimeout(_exportTimer);
    _exportTimer = setTimeout(function () {
      _exportTimer = null;
      syncExportPreview();
    }, 120);
  }

  function syncExportPreview() {
    var smiEl = document.getElementById('chimieExportSmi');
    var molEl = document.getElementById('chimieExportMol');
    var smi = exportFormat('smi');
    var mol = exportFormat('mol');
    if (smiEl) smiEl.value = smi || '';
    if (molEl) molEl.value = mol || '';
    var badge = document.getElementById('chimieExportStatus');
    if (badge) {
      badge.textContent = smi
        ? 'Structure prête · export disponible'
        : 'Planche vide — utilise la barre d’outils Kekule';
    }
  }

  function clearBoard() {
    if (!_composer) return;
    try {
      if (typeof _composer.newDoc === 'function') _composer.newDoc();
      else if (typeof _composer.setChemObj === 'function') {
        _composer.setChemObj(new window.Kekule.Molecule());
      }
    } catch (e) {
      var host = document.getElementById('chimieComposerHost');
      if (host) mountComposer(host);
    }
    syncExportPreview();
  }

  function buildShell(root) {
    root.innerHTML =
      '<div class="chimie-lab chimie-lab-full">' +
        '<header class="chimie-lab-top">' +
          '<div class="chimie-lab-top-text">' +
            '<h2 class="chimie-lab-title"><span data-icon="flask-conical"></span> Labo Chimie</h2>' +
            '<p class="chimie-lab-lead anki-mut">' +
              'Éditeur structurel complet : atomes, liaisons, cycles, charges, formules, ' +
              'templates, réactions / flèches, import·export, undo — comme une appli chimie web.' +
            '</p>' +
          '</div>' +
          '<div class="chimie-lab-top-actions">' +
            '<button type="button" class="bs" id="chimieBtnUndo" title="Annuler"><span data-icon="undo-2"></span></button>' +
            '<button type="button" class="bs" id="chimieBtnRedo" title="Rétablir"><span data-icon="refresh-cw"></span></button>' +
            '<button type="button" class="bs" id="chimieBtnCopySmi" title="Copier SMILES">' +
              '<span data-icon="copy"></span> SMILES</button>' +
            '<button type="button" class="bs" id="chimieBtnCopyMol" title="Copier Molfile">MOL</button>' +
            '<button type="button" class="bs" id="chimieBtnClear" title="Nouvelle planche">' +
              '<span data-icon="trash-2"></span></button>' +
          '</div>' +
        '</header>' +
        '<p class="chimie-lab-howto anki-mut" id="chimieExportStatus">' +
          'Astuce : barre gauche = outils (atome, liaison, cycle…) · barre haut = fichier / zoom / inspecteur' +
        '</p>' +
        '<div class="chimie-composer-host" id="chimieComposerHost"></div>' +
        '<details class="chimie-lab-export" open>' +
          '<summary>Export <span class="anki-mut">— SMILES &amp; Molfile (lecture seule, se met à jour)</span></summary>' +
          '<div class="chimie-lab-export-grid">' +
            '<label class="chimie-lab-export-block">' +
              '<span>SMILES</span>' +
              '<textarea id="chimieExportSmi" rows="2" readonly placeholder="…"></textarea>' +
            '</label>' +
            '<label class="chimie-lab-export-block">' +
              '<span>Molfile</span>' +
              '<textarea id="chimieExportMol" rows="4" readonly placeholder="…"></textarea>' +
            '</label>' +
          '</div>' +
          '<div class="chimie-lab-export-actions">' +
            '<button type="button" class="bs" id="chimieBtnRefreshExport">Actualiser l’export</button>' +
          '</div>' +
        '</details>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
  }

  function wireChrome(root) {
    function bind(id, fn) {
      var el = document.getElementById(id);
      if (el) el.onclick = fn;
    }
    bind('chimieBtnUndo', function () {
      try { if (_composer) _composer.undo(); } catch (e) { /* ignore */ }
      scheduleExport();
    });
    bind('chimieBtnRedo', function () {
      try { if (_composer) _composer.redo(); } catch (e) { /* ignore */ }
      scheduleExport();
    });
    bind('chimieBtnCopySmi', function () {
      syncExportPreview();
      copyText(exportFormat('smi'), 'SMILES copié');
    });
    bind('chimieBtnCopyMol', function () {
      syncExportPreview();
      copyText(exportFormat('mol'), 'Molfile copié');
    });
    bind('chimieBtnClear', clearBoard);
    bind('chimieBtnRefreshExport', syncExportPreview);

    if (!root._chimieInteractBound) {
      root._chimieInteractBound = true;
      root.addEventListener('mouseup', scheduleExport);
      root.addEventListener('keyup', scheduleExport);
      root.addEventListener('touchend', scheduleExport, { passive: true });
    }
  }

  function resizeComposer() {
    if (!_composer || typeof _composer.setDimension !== 'function') return;
    try { _composer.setDimension('100%', boardHeight()); } catch (e) { /* ignore */ }
  }

  window.renderChimieLab = function () {
    var root = document.getElementById('paneChimieLab');
    if (!root) return;

    if (!_built) {
      root.innerHTML =
        '<div class="chimie-lab chimie-lab-loading">' +
          '<div class="clean-spinner" aria-hidden="true"></div>' +
          '<p class="anki-mut">Chargement de l’éditeur chimie complet…</p>' +
        '</div>';
    }

    ensureKekule().then(function () {
      if (!_built) {
        buildShell(root);
        _built = true;
        wireChrome(root);
        if (!window._chimieResizeBound) {
          window._chimieResizeBound = true;
          window.addEventListener('resize', resizeComposer);
        }
      }
      var host = document.getElementById('chimieComposerHost');
      if (host) {
        if (!_composer || !host.querySelector('#chimieComposerBoard')) {
          mountComposer(host);
        } else {
          resizeComposer();
        }
      }
      syncExportPreview();
    }).catch(function (err) {
      _built = false;
      destroyComposer();
      root.innerHTML =
        '<div class="chimie-lab">' +
          '<h2 class="chimie-lab-title">Labo Chimie</h2>' +
          '<p class="chimie-lab-error">' + esc(err && err.message ? err.message : 'Erreur') + '</p>' +
          '<p class="anki-mut">Vérifie ta connexion : Kekule est chargé depuis jsDelivr.</p>' +
          '<button type="button" class="bp" id="chimieLabRetry">Réessayer</button>' +
        '</div>';
      var retry = document.getElementById('chimieLabRetry');
      if (retry) retry.addEventListener('click', function () { window.renderChimieLab(); });
    });
  };
})();
