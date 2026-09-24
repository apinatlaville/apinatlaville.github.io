/**
 * chimie-lab.js — Labo Chimie (test)
 *
 * Éditeur libre existant : JSME (BSD-3-Clause)
 *   https://jsme-editor.github.io/  ·  npm: jsme-editor
 *
 * Remplace Kekule (trop d’erreurs d’export / outils partiels).
 * Pour un éditeur encore plus « pro » (Ketcher / Apache 2.0) : ~35 Mo standalone à vendorer.
 */
(function () {
  'use strict';

  var JSME_VER = '2024.4.29';
  var JSME_SRC = 'https://cdn.jsdelivr.net/npm/jsme-editor@' + JSME_VER + '/jsme.nocache.js';

  var _loadPromise = null;
  var _built = false;
  var _jsme = null;
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

  function boardSize() {
    var h = window.innerHeight || 800;
    var height = Math.max(400, Math.min(700, h - 200));
    var host = document.getElementById('chimieJsmeHost');
    var width = host && host.clientWidth > 80 ? host.clientWidth : Math.min(960, (window.innerWidth || 900) - 80);
    return { w: Math.max(320, width) + 'px', h: height + 'px' };
  }

  /**
   * JSME appelle window.jsmeOnLoad une fois le runtime prêt.
   * On enchaîne via une promesse partagée.
   */
  function ensureJsme() {
    if (window.JSApplet && window.JSApplet.JSME) {
      return Promise.resolve();
    }
    if (_loadPromise) return _loadPromise;

    _loadPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var prev = window.jsmeOnLoad;

      window.jsmeOnLoad = function () {
        try {
          if (typeof prev === 'function') prev.apply(this, arguments);
        } catch (e) { /* ignore */ }
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      var existing = document.querySelector('script[data-jsme-lab="1"]');
      if (existing) {
        /* Script déjà là : attendre jsmeOnLoad ou API déjà dispo */
        if (window.JSApplet && window.JSApplet.JSME) {
          settled = true;
          resolve();
        }
        setTimeout(function () {
          if (!settled && window.JSApplet && window.JSApplet.JSME) {
            settled = true;
            resolve();
          } else if (!settled) {
            settled = true;
            _loadPromise = null;
            reject(new Error('JSME chargé mais API indisponible.'));
          }
        }, 12000);
        return;
      }

      var s = document.createElement('script');
      s.src = JSME_SRC;
      s.async = true;
      s.setAttribute('data-jsme-lab', '1');
      s.onerror = function () {
        if (!settled) {
          settled = true;
          _loadPromise = null;
          reject(new Error('Impossible de charger JSME (réseau / CDN).'));
        }
      };
      document.head.appendChild(s);

      setTimeout(function () {
        if (!settled) {
          settled = true;
          _loadPromise = null;
          reject(new Error('Délai dépassé en chargeant JSME.'));
        }
      }, 20000);
    });

    return _loadPromise;
  }

  function safeCall(fn) {
    try {
      return fn();
    } catch (e) {
      return null;
    }
  }

  function getSmiles() {
    if (!_jsme) return '';
    return safeCall(function () {
      if (typeof _jsme.smiles === 'function') return String(_jsme.smiles() || '').trim();
      if (typeof _jsme.getSmiles === 'function') return String(_jsme.getSmiles() || '').trim();
      return '';
    }) || '';
  }

  function getMolfile() {
    if (!_jsme) return '';
    return safeCall(function () {
      if (typeof _jsme.molFile === 'function') return String(_jsme.molFile() || '').trim();
      if (typeof _jsme.getMolfile === 'function') return String(_jsme.getMolfile() || '').trim();
      return '';
    }) || '';
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

  function syncExport() {
    var smi = getSmiles();
    var mol = getMolfile();
    var smiEl = document.getElementById('chimieExportSmi');
    var molEl = document.getElementById('chimieExportMol');
    var status = document.getElementById('chimieExportStatus');
    if (smiEl) smiEl.value = smi;
    if (molEl) molEl.value = mol;
    if (status) {
      status.textContent = smi
        ? 'Structure prête · SMILES / Molfile à jour'
        : 'Choisis un outil (C, liaison, cycle…) puis clique sur la planche';
    }
  }

  function scheduleExport() {
    if (_exportTimer) clearTimeout(_exportTimer);
    _exportTimer = setTimeout(function () {
      _exportTimer = null;
      syncExport();
    }, 150);
  }

  function clearBoard() {
    if (!_jsme) return;
    safeCall(function () {
      if (typeof _jsme.clear === 'function') _jsme.clear();
      else if (typeof _jsme.reset === 'function') _jsme.reset();
      else if (typeof _jsme.readMolecule === 'function') _jsme.readMolecule('');
    });
    syncExport();
  }

  function destroyJsme() {
    var host = document.getElementById('chimieJsmeHost');
    if (host) host.innerHTML = '';
    _jsme = null;
  }

  function mountJsme(host) {
    if (!host || !window.JSApplet || !window.JSApplet.JSME) return null;
    host.innerHTML = '';
    var size = boardSize();
    /* options : GUI complète JSME (atomes, cycles, stéréo, réactions…) */
    var opts = {
      options: 'depictAction,newLook,reaction,stereoButton,atomMoveButton,useOCL'
    };
    try {
      _jsme = new window.JSApplet.JSME(host.id, size.w, size.h, opts);
    } catch (e1) {
      try {
        _jsme = new window.JSApplet.JSME(host.id, size.w, size.h);
      } catch (e2) {
        _jsme = null;
        throw e2;
      }
    }

    /* Callbacks JSME (selon versions) */
    safeCall(function () {
      if (typeof _jsme.setCallBack === 'function') {
        _jsme.setCallBack('AfterStructureModified', function () { scheduleExport(); });
        _jsme.setCallBack('onStructureChange', function () { scheduleExport(); });
      }
    });
    safeCall(function () {
      if (typeof _jsme.setNotifyStructuralChangeJSCallback === 'function') {
        _jsme.setNotifyStructuralChangeJSCallback(function () { scheduleExport(); });
      }
    });

    scheduleExport();
    return _jsme;
  }

  function resizeJsme() {
    if (!_jsme) return;
    var size = boardSize();
    safeCall(function () {
      if (typeof _jsme.setSize === 'function') _jsme.setSize(size.w, size.h);
    });
  }

  function buildShell(root) {
    root.innerHTML =
      '<div class="chimie-lab chimie-lab-full">' +
        '<header class="chimie-lab-top">' +
          '<div class="chimie-lab-top-text">' +
            '<h2 class="chimie-lab-title"><span data-icon="flask-conical"></span> Labo Chimie</h2>' +
            '<p class="chimie-lab-lead anki-mut">' +
              'Éditeur <b>JSME</b> (libre, BSD) — atomes, liaisons, cycles, stéréochimie, réactions. ' +
              'Pas de SMILES à taper : tu dessines sur la planche.' +
            '</p>' +
          '</div>' +
          '<div class="chimie-lab-top-actions">' +
            '<button type="button" class="bs" id="chimieBtnCopySmi" title="Copier SMILES">' +
              '<span data-icon="copy"></span> SMILES</button>' +
            '<button type="button" class="bs" id="chimieBtnCopyMol" title="Copier Molfile">MOL</button>' +
            '<button type="button" class="bs" id="chimieBtnClear" title="Effacer la planche">' +
              '<span data-icon="trash-2"></span></button>' +
          '</div>' +
        '</header>' +
        '<p class="chimie-lab-howto anki-mut" id="chimieExportStatus">' +
          'Chargement de JSME…' +
        '</p>' +
        '<div class="chimie-jsme-wrap">' +
          '<div id="chimieJsmeHost" class="chimie-jsme-host"></div>' +
        '</div>' +
        '<details class="chimie-lab-export" open>' +
          '<summary>Export <span class="anki-mut">— mis à jour quand tu modifies la structure</span></summary>' +
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
            '<button type="button" class="bs" id="chimieBtnRefreshExport">Actualiser</button>' +
          '</div>' +
        '</details>' +
        '<p class="chimie-lab-credit anki-mut">' +
          'JSME · Bienfait &amp; Ertl · licence BSD-3-Clause · ' +
          '<a href="https://jsme-editor.github.io/" target="_blank" rel="noopener">jsme-editor.github.io</a>' +
        '</p>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
  }

  function wireChrome() {
    var copyS = document.getElementById('chimieBtnCopySmi');
    var copyM = document.getElementById('chimieBtnCopyMol');
    var clear = document.getElementById('chimieBtnClear');
    var refresh = document.getElementById('chimieBtnRefreshExport');
    if (copyS) copyS.onclick = function () {
      syncExport();
      copyText(getSmiles(), 'SMILES copié');
    };
    if (copyM) copyM.onclick = function () {
      syncExport();
      copyText(getMolfile(), 'Molfile copié');
    };
    if (clear) clear.onclick = clearBoard;
    if (refresh) refresh.onclick = syncExport;

    var wrap = document.getElementById('chimieJsmeHost');
    if (wrap && !wrap._chimieBound) {
      wrap._chimieBound = true;
      wrap.addEventListener('mouseup', scheduleExport);
      wrap.addEventListener('keyup', scheduleExport);
      wrap.addEventListener('touchend', scheduleExport, { passive: true });
    }
  }

  window.renderChimieLab = function () {
    var root = document.getElementById('paneChimieLab');
    if (!root) return;

    if (!_built) {
      root.innerHTML =
        '<div class="chimie-lab chimie-lab-loading">' +
          '<div class="clean-spinner" aria-hidden="true"></div>' +
          '<p class="anki-mut">Chargement de JSME (éditeur libre)…</p>' +
        '</div>';
    }

    ensureJsme().then(function () {
      if (!_built) {
        buildShell(root);
        _built = true;
        wireChrome();
        if (!window._chimieJsmeResizeBound) {
          window._chimieJsmeResizeBound = true;
          window.addEventListener('resize', function () {
            var pane = document.getElementById('paneChimieLab');
            if (pane && !pane.classList.contains('hidden')) resizeJsme();
          });
        }
      }

      var host = document.getElementById('chimieJsmeHost');
      if (!host) return;

      if (!_jsme || !host.querySelector('div, canvas, table')) {
        destroyJsme();
        /* Le conteneur doit avoir un id pour JSME */
        host.id = 'chimieJsmeHost';
        mountJsme(host);
      } else {
        resizeJsme();
        syncExport();
      }
    }).catch(function (err) {
      _built = false;
      destroyJsme();
      root.innerHTML =
        '<div class="chimie-lab">' +
          '<h2 class="chimie-lab-title">Labo Chimie</h2>' +
          '<p class="chimie-lab-error">' + esc(err && err.message ? err.message : 'Erreur') + '</p>' +
          '<p class="anki-mut">JSME se charge depuis jsDelivr (licence BSD). Vérifie ta connexion.</p>' +
          '<button type="button" class="bp" id="chimieLabRetry">Réessayer</button>' +
        '</div>';
      var retry = document.getElementById('chimieLabRetry');
      if (retry) retry.addEventListener('click', function () {
        _loadPromise = null;
        window.renderChimieLab();
      });
    });
  };
})();
