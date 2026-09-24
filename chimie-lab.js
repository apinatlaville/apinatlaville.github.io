/**
 * chimie-lab.js — Easy Chimie (labo test)
 * Éditeur VISUEL : poser atomes / cycles / Br sur une planche (Kekule Composer).
 * Même esprit Easy LaTeX : une planche, peu de chrome, actions claires.
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
    var h = window.innerHeight || 700;
    return Math.max(360, Math.min(620, h - 220)) + 'px';
  }

  function configureEasyComposer(composer) {
    try {
      if (typeof composer.setPredefinedSetting === 'function') {
        composer.setPredefinedSetting('molOnly');
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof composer.setEnableStyleToolbar === 'function') composer.setEnableStyleToolbar(false);
      if (typeof composer.setEnableLoadNewFile === 'function') composer.setEnableLoadNewFile(false);
      if (typeof composer.setEnableCreateNewDoc === 'function') composer.setEnableCreateNewDoc(true);
      if (typeof composer.setAllowCreateNewChild === 'function') composer.setAllowCreateNewChild(true);
      if (typeof composer.setEnableOperHistory === 'function') composer.setEnableOperHistory(true);
    } catch (e2) { /* ignore */ }

    try {
      if (typeof composer.setCommonToolButtons === 'function') {
        composer.setCommonToolButtons(['newDoc', 'undo', 'redo', 'zoomIn', 'reset', 'zoomOut']);
      }
      if (typeof composer.setChemToolButtons === 'function') {
        /* Atomes, liaisons, cycles, charge, gomme — pas de texte / flèches */
        composer.setChemToolButtons(['manipulate', 'erase', 'bond', 'atomAndFormula', 'ring', 'charge']);
      }
    } catch (e3) { /* ignore */ }
  }

  function mountComposer(host) {
    if (!host || !window.Kekule) return null;
    host.innerHTML = '';
    var box = document.createElement('div');
    box.id = 'chimieComposerBoard';
    box.className = 'chimie-composer-board';
    host.appendChild(box);

    var composer = new window.Kekule.Editor.Composer(box);
    composer.setDimension('100%', boardHeight());
    configureEasyComposer(composer);
    _composer = composer;
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

  function exportFormat(fmt) {
    var mol = firstMolecule();
    if (!mol || !window.Kekule || !window.Kekule.IO) return '';
    var candidates = fmt === 'smi'
      ? ['smi', 'smiles', 'SMILES']
      : [fmt];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var out = window.Kekule.IO.saveFormatData(mol, candidates[i]);
        if (out) return String(out).trim();
      } catch (e) { /* try next */ }
    }
    return '';
  }

  function copyText(text, okMsg) {
    var t = String(text || '');
    if (!t) {
      toast('Rien à copier — dessine d’abord une molécule');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast(okMsg || 'Copié'); })
        .catch(function () { window.prompt('Copier :', t); });
    } else {
      window.prompt('Copier :', t);
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
      try { mountComposer(document.getElementById('chimieComposerHost')); } catch (e2) { /* ignore */ }
    }
    syncExportPreview();
  }

  function syncExportPreview() {
    var el = document.getElementById('chimieEasyExport');
    if (!el) return;
    var smi = exportFormat('smi');
    el.value = smi || '';
    el.placeholder = smi ? '' : 'Le SMILES apparaîtra ici quand tu dessines…';
  }

  function buildShell(root) {
    root.innerHTML =
      '<div class="chimie-easy chimie-easy-visual">' +
        '<header class="chimie-easy-bar">' +
          '<div class="chimie-easy-bar-head">' +
            '<h2 class="chimie-easy-title"><span data-icon="flask-conical"></span> Easy Chimie</h2>' +
            '<p class="chimie-easy-hint anki-mut">Choisis un outil (C, cycle, Br…) puis clique sur la planche — comme ChemDraw, en version Easy.</p>' +
          '</div>' +
          '<div class="chimie-easy-actions">' +
            '<button type="button" class="bs" id="chimieEasyUndo" title="Annuler"><span data-icon="undo-2"></span></button>' +
            '<button type="button" class="bs" id="chimieEasyRedo" title="Rétablir"><span data-icon="refresh-cw"></span></button>' +
            '<button type="button" class="bs" id="chimieEasyCopySmi" title="Copier SMILES">' +
              '<span data-icon="copy"></span> SMILES</button>' +
            '<button type="button" class="bs" id="chimieEasyClear" title="Nouvelle planche">' +
              '<span data-icon="trash-2"></span></button>' +
          '</div>' +
        '</header>' +
        '<div class="chimie-composer-host" id="chimieComposerHost"></div>' +
        '<details class="chimie-easy-export">' +
          '<summary>Exporter <span class="anki-mut">— SMILES (lecture seule)</span></summary>' +
          '<div class="chimie-easy-export-row">' +
            '<textarea id="chimieEasyExport" class="chimie-easy-export-field" rows="2" readonly ' +
              'placeholder="Le SMILES apparaîtra ici quand tu dessines…"></textarea>' +
            '<button type="button" class="bp" id="chimieEasyRefreshExport">Actualiser</button>' +
          '</div>' +
        '</details>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
  }

  function wireChrome(root) {
    var undo = document.getElementById('chimieEasyUndo');
    var redo = document.getElementById('chimieEasyRedo');
    var copy = document.getElementById('chimieEasyCopySmi');
    var clear = document.getElementById('chimieEasyClear');
    var refresh = document.getElementById('chimieEasyRefreshExport');

    if (undo) undo.onclick = function () {
      try { if (_composer) _composer.undo(); } catch (e) { /* ignore */ }
      syncExportPreview();
    };
    if (redo) redo.onclick = function () {
      try { if (_composer) _composer.redo(); } catch (e) { /* ignore */ }
      syncExportPreview();
    };
    if (copy) copy.onclick = function () {
      syncExportPreview();
      copyText(exportFormat('smi'), 'SMILES copié');
    };
    if (clear) clear.onclick = function () { clearBoard(); };
    if (refresh) refresh.onclick = function () { syncExportPreview(); };

    /* Actualise l’export après interactions sur la planche */
    if (!root._chimieExportBound) {
      root._chimieExportBound = true;
      root.addEventListener('mouseup', function () {
        setTimeout(syncExportPreview, 80);
      });
      root.addEventListener('keyup', function () {
        setTimeout(syncExportPreview, 80);
      });
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
        '<div class="chimie-easy chimie-easy-loading">' +
          '<div class="clean-spinner" aria-hidden="true"></div>' +
          '<p class="anki-mut">Chargement de la planche moléculaire…</p>' +
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
      if (host && !_composer) {
        mountComposer(host);
      } else if (host && _composer) {
        resizeComposer();
      } else if (host) {
        mountComposer(host);
      }
      syncExportPreview();
    }).catch(function (err) {
      _built = false;
      _composer = null;
      root.innerHTML =
        '<div class="chimie-easy">' +
          '<h2 class="chimie-easy-title">Easy Chimie</h2>' +
          '<p class="chimie-lab-error">' + esc(err && err.message ? err.message : 'Erreur') + '</p>' +
          '<p class="anki-mut">Vérifie ta connexion : l’éditeur Kekule est chargé depuis jsDelivr.</p>' +
          '<button type="button" class="bp" id="chimieEasyRetry">Réessayer</button>' +
        '</div>';
      var retry = document.getElementById('chimieEasyRetry');
      if (retry) retry.addEventListener('click', function () { window.renderChimieLab(); });
    });
  };
})();
