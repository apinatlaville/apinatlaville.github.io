/**
 * chimie-lab.js — Easy Chimie (labo test)
 * Même simplicité qu’Easy LaTeX : éditeur + aperçu, palette d’insertions, code optionnel.
 */
(function () {
  'use strict';

  var SMI_VER = '2.1.7';
  var CDN = 'https://cdn.jsdelivr.net/npm/smiles-drawer@' + SMI_VER + '/dist/smiles-drawer.min.js';

  /** Palette = insertions dans l’éditeur (comme les snips LaTeX), pas un catalogue à choisir. */
  var GROUPS = [
    {
      id: 'freq',
      label: 'Raccourcis',
      items: [
        { id: 'f-oh', label: '–OH', smiles: 'O', title: 'Hydroxy / eau' },
        { id: 'f-me', label: '–CH3', smiles: 'C', title: 'Méthyle' },
        { id: 'f-et', label: '–Et', smiles: 'CC', title: 'Éthyle' },
        { id: 'f-ph', label: 'Ph', smiles: 'c1ccccc1', title: 'Benzène / phényle' },
        { id: 'f-cooh', label: 'COOH', smiles: 'C(=O)O', title: 'Acide carboxylique' },
        { id: 'f-cho', label: 'CHO', smiles: 'C=O', title: 'Aldéhyde' },
        { id: 'f-co', label: 'C=O', smiles: 'C(=O)', title: 'Carbonyle' },
        { id: 'f-nh2', label: 'NH2', smiles: 'N', title: 'Amine' }
      ]
    },
    {
      id: 'atomes',
      label: 'Atomes',
      items: [
        { id: 'a-c', label: 'C', smiles: 'C', title: 'Carbone' },
        { id: 'a-o', label: 'O', smiles: 'O', title: 'Oxygène' },
        { id: 'a-n', label: 'N', smiles: 'N', title: 'Azote' },
        { id: 'a-s', label: 'S', smiles: 'S', title: 'Soufre' },
        { id: 'a-p', label: 'P', smiles: 'P', title: 'Phosphore' },
        { id: 'a-f', label: 'F', smiles: 'F', title: 'Fluor' },
        { id: 'a-cl', label: 'Cl', smiles: 'Cl', title: 'Chlore' },
        { id: 'a-br', label: 'Br', smiles: 'Br', title: 'Brome' },
        { id: 'a-i', label: 'I', smiles: 'I', title: 'Iode' },
        { id: 'a-h', label: '[H]', smiles: '[H]', title: 'Hydrogène explicite' }
      ]
    },
    {
      id: 'liaisons',
      label: 'Liaisons',
      items: [
        { id: 'b-s', label: '—', smiles: '', title: 'Simple (implicite)', insert: '' },
        { id: 'b-d', label: '=', smiles: '=', title: 'Double' },
        { id: 'b-t', label: '≡', smiles: '#', title: 'Triple' },
        { id: 'b-aro', label: ':', smiles: ':', title: 'Aromatique (SMILES)' },
        { id: 'b-par', label: '( )', smiles: '()', title: 'Branche', cursor: -1 },
        { id: 'b-bra', label: '[ ]', smiles: '[]', title: 'Atome entre crochets', cursor: -1 },
        { id: 'b-plus', label: '+', smiles: '+', title: 'Charge +' },
        { id: 'b-minus', label: '−', smiles: '-', title: 'Charge − / liaison' }
      ]
    },
    {
      id: 'cycles',
      label: 'Cycles',
      items: [
        { id: 'c-hex', label: 'C6', smiles: 'C1CCCCC1', title: 'Cyclohexane' },
        { id: 'c-pent', label: 'C5', smiles: 'C1CCCC1', title: 'Cyclopentane' },
        { id: 'c-benz', label: 'Ph', smiles: 'c1ccccc1', title: 'Benzène' },
        { id: 'c-pyr', label: 'Py', smiles: 'c1ccncc1', title: 'Pyridine' },
        { id: 'c-hexene', label: 'C6=', smiles: 'C1=CCCCC1', title: 'Cyclohexène' },
        { id: 'c-napht', label: 'Naph', smiles: 'c1ccc2ccccc2c1', title: 'Naphtalène' }
      ]
    },
    {
      id: 'exemples',
      label: 'Exemples',
      items: [
        { id: 'e-eau', label: 'H2O', smiles: 'O', title: 'Eau', ce: 'H2O', replace: true },
        { id: 'e-etoh', label: 'EtOH', smiles: 'CCO', title: 'Éthanol', ce: 'C2H5OH', replace: true },
        { id: 'e-ace', label: 'Acétone', smiles: 'CC(=O)C', title: 'Acétone', ce: 'CH3COCH3', replace: true },
        { id: 'e-acoh', label: 'AcOH', smiles: 'CC(=O)O', title: 'Acide acétique', ce: 'CH3COOH', replace: true },
        { id: 'e-benz', label: 'Benzène', smiles: 'c1ccccc1', title: 'Benzène', ce: 'C6H6', replace: true },
        { id: 'e-tol', label: 'Toluène', smiles: 'Cc1ccccc1', title: 'Toluène', ce: 'PhCH3', replace: true },
        { id: 'e-phoh', label: 'PhOH', smiles: 'Oc1ccccc1', title: 'Phénol', ce: 'PhOH', replace: true },
        { id: 'e-gly', label: 'Glycine', smiles: 'NCC(=O)O', title: 'Glycine', ce: 'H2NCH2COOH', replace: true }
      ]
    }
  ];

  var SECTIONS = [
    { id: 'construire', label: 'Construire', groups: ['atomes', 'liaisons', 'cycles'] },
    { id: 'exemples', label: 'Exemples', groups: ['exemples'] }
  ];

  var _smiPromise = null;
  var _built = false;
  var _wired = false;
  var _section = 'construire';
  var _sub = 'atomes';
  var _drawTimer = null;
  var _meta = { name: '', ce: '' };

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

  function isDark() {
    return !!(document.body && document.body.classList.contains('theme-dark'));
  }

  function ensureSmilesDrawer() {
    if (window.SmilesDrawer) return Promise.resolve(window.SmilesDrawer);
    if (_smiPromise) return _smiPromise;
    _smiPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = function () {
        if (window.SmilesDrawer) resolve(window.SmilesDrawer);
        else reject(new Error('SmilesDrawer sans API globale.'));
      };
      s.onerror = function () {
        _smiPromise = null;
        reject(new Error('Impossible de charger SmilesDrawer (réseau / CDN).'));
      };
      document.head.appendChild(s);
    });
    return _smiPromise;
  }

  function getGroup(id) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (GROUPS[i].id === id) return GROUPS[i];
    }
    return GROUPS[0];
  }

  function findSnip(id) {
    for (var i = 0; i < GROUPS.length; i++) {
      var items = GROUPS[i].items;
      for (var j = 0; j < items.length; j++) {
        if (items[j].id === id) return items[j];
      }
    }
    return null;
  }

  function fold(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function searchSnips(q) {
    var qq = fold(q).trim();
    if (!qq) return null;
    var out = [];
    GROUPS.forEach(function (g) {
      if (g.id === 'freq') return;
      g.items.forEach(function (it) {
        var hay = fold(it.label + ' ' + (it.title || '') + ' ' + (it.smiles || '') + ' ' + (it.ce || ''));
        if (hay.indexOf(qq) >= 0) out.push(it);
      });
    });
    return out;
  }

  function smilesField() {
    return document.getElementById('chimieEasyField');
  }

  function getSmiles() {
    var el = smilesField();
    return el ? String(el.value || '') : '';
  }

  function setSmiles(v, focus) {
    var el = smilesField();
    if (!el) return;
    el.value = v == null ? '' : String(v);
    scheduleDraw();
    syncCode();
    if (focus) {
      try { el.focus(); } catch (e) { /* ignore */ }
    }
  }

  function insertAtCursor(text, cursorOffset) {
    var el = smilesField();
    if (!el) return;
    text = text == null ? '' : String(text);
    var start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
    var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    var val = el.value || '';
    el.value = val.slice(0, start) + text + val.slice(end);
    var pos = start + text.length + (cursorOffset || 0);
    if (pos < start) pos = start;
    try {
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
    } catch (e) { /* ignore */ }
    scheduleDraw();
    syncCode();
  }

  function applySnip(snip) {
    if (!snip) return;
    if (snip.replace) {
      _meta = { name: snip.title || snip.label, ce: snip.ce || '' };
      setSmiles(snip.smiles || '', true);
      updateMeta();
      return;
    }
    var piece = snip.smiles != null ? snip.smiles : (snip.insert || '');
    insertAtCursor(piece, snip.cursor || 0);
    if (snip.ce) _meta.ce = snip.ce;
    if (snip.title) _meta.name = snip.title;
    updateMeta();
  }

  function syncCode() {
    var code = document.getElementById('chimieEasyCode');
    var el = smilesField();
    if (code && el && document.activeElement !== code) code.value = el.value;
  }

  function updateMeta() {
    var meta = document.getElementById('chimieEasyMeta');
    if (!meta) return;
    var smi = getSmiles().trim();
    var bits = [];
    if (_meta.name) bits.push('<strong>' + esc(_meta.name) + '</strong>');
    if (_meta.ce) bits.push('<code>\\ce{' + esc(_meta.ce) + '}</code>');
    if (smi) bits.push('<span class="anki-mut">SMILES</span>');
    meta.innerHTML = bits.length ? bits.join(' · ') : '<span class="anki-mut">Tape ou insère depuis la palette</span>';
  }

  function drawNow() {
    var host = document.getElementById('chimieEasyPreview');
    if (!host) return;
    var raw = getSmiles().trim();
    if (!raw) {
      host.innerHTML = '<span class="anki-mut">Aperçu vide — tape un SMILES ou choisis un exemple</span>';
      host.removeAttribute('data-ok');
      return;
    }
    if (!window.SmilesDrawer || typeof window.SmilesDrawer.parse !== 'function' || typeof window.SmilesDrawer.Drawer !== 'function') {
      host.innerHTML = '<span class="chimie-lab-error">Moteur indisponible</span>';
      return;
    }
    var theme = isDark() ? 'dark' : 'light';
    var w = Math.max(260, Math.min(480, (host.clientWidth || 360) - 8));
    var h = Math.max(200, Math.min(320, Math.round(w * 0.75)));
    var drawer;
    try {
      drawer = new window.SmilesDrawer.Drawer({
        width: w,
        height: h,
        bondThickness: 1.15,
        bondLength: 15,
        compactDrawing: false,
        terminalCarbons: true,
        padding: 14
      });
    } catch (e) {
      host.innerHTML = '<span class="chimie-lab-error">Moteur indisponible</span>';
      return;
    }
    host.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.id = 'chimieEasyCanvas';
    canvas.width = w;
    canvas.height = h;
    canvas.className = 'chimie-lab-canvas';
    host.appendChild(canvas);
    window.SmilesDrawer.parse(raw, function (tree) {
      try {
        drawer.draw(tree, 'chimieEasyCanvas', theme, false);
        host.setAttribute('data-ok', '1');
      } catch (e2) {
        host.innerHTML = '<span class="chimie-lab-error">Impossible de tracer</span>';
        host.removeAttribute('data-ok');
      }
    }, function () {
      host.innerHTML = '<span class="chimie-lab-error">SMILES invalide</span>';
      host.removeAttribute('data-ok');
    });
  }

  function scheduleDraw() {
    if (_drawTimer) clearTimeout(_drawTimer);
    _drawTimer = setTimeout(function () {
      _drawTimer = null;
      drawNow();
      updateMeta();
    }, 100);
  }

  function renderSnips(items) {
    return items.map(function (s) {
      return (
        '<button type="button" class="latex-lab-snip" data-snip="' + esc(s.id) + '" title="' +
          esc(s.title || s.label) + '">' + esc(s.label) + '</button>'
      );
    }).join('');
  }

  function wireSnips(container) {
    if (!container) return;
    container.querySelectorAll('[data-snip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applySnip(findSnip(btn.getAttribute('data-snip')));
      });
    });
  }

  function refreshPalette(query) {
    var tabs = document.getElementById('chimieEasyCats');
    var subs = document.getElementById('chimieEasySubs');
    var grid = document.getElementById('chimieEasySnips');
    var title = document.getElementById('chimieEasyCatTitle');
    var hint = document.getElementById('chimieEasyHint');
    var searched = searchSnips(query);

    if (searched) {
      if (tabs) tabs.innerHTML = '';
      if (subs) subs.innerHTML = '';
      if (title) title.textContent = 'Recherche';
      if (hint) hint.textContent = searched.length ? (searched.length + ' résultat(s)') : 'Aucun résultat';
      if (grid) {
        grid.innerHTML = searched.length
          ? renderSnips(searched)
          : '<span class="anki-mut">Essaie « benzène », « OH », « C=O »…</span>';
        wireSnips(grid);
      }
      return;
    }

    if (tabs) {
      tabs.innerHTML = SECTIONS.map(function (sec) {
        return (
          '<button type="button" class="latex-lab-family' + (sec.id === _section ? ' is-on' : '') +
            '" data-section="' + esc(sec.id) + '">' + esc(sec.label) + '</button>'
        );
      }).join('');
      tabs.querySelectorAll('[data-section]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _section = btn.getAttribute('data-section');
          var sec = SECTIONS.filter(function (s) { return s.id === _section; })[0];
          _sub = sec && sec.groups[0] ? sec.groups[0] : 'atomes';
          refreshPalette('');
        });
      });
    }

    var section = SECTIONS.filter(function (s) { return s.id === _section; })[0] || SECTIONS[0];
    if (subs) {
      subs.innerHTML = section.groups.map(function (gid) {
        var g = getGroup(gid);
        return (
          '<button type="button" class="latex-lab-sub' + (gid === _sub ? ' is-on' : '') +
            '" data-sub="' + esc(gid) + '">' + esc(g.label) + '</button>'
        );
      }).join('');
      subs.querySelectorAll('[data-sub]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _sub = btn.getAttribute('data-sub');
          refreshPalette('');
        });
      });
    }

    var group = getGroup(_sub);
    if (title) title.textContent = section.label + ' · ' + group.label;
    if (hint) {
      hint.textContent = group.id === 'exemples'
        ? 'Remplace le champ (exemple complet)'
        : 'Insère au curseur dans le SMILES';
    }
    if (grid) {
      grid.innerHTML = renderSnips(group.items);
      wireSnips(grid);
    }
  }

  function copyText(text, okMsg) {
    var t = String(text || '');
    if (!t) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast(okMsg || 'Copié'); })
        .catch(function () { window.prompt('Copier :', t); });
    } else {
      window.prompt('Copier :', t);
    }
  }

  function buildShell(root) {
    var freq = getGroup('freq');
    var quickHtml =
      '<div class="latex-lab-quick-row" role="toolbar" aria-label="Raccourcis">' +
        '<span class="latex-lab-quick-label">Raccourcis</span>' +
        '<div class="latex-lab-quick-snips">' + renderSnips(freq.items) + '</div>' +
      '</div>';

    root.innerHTML =
      '<div class="latex-lab chimie-easy">' +
        '<header class="latex-lab-toolbar">' +
          '<div class="latex-lab-toolbar-head">' +
            '<h2 class="latex-lab-title"><span data-icon="flask-conical"></span> Easy Chimie</h2>' +
            '<div class="latex-lab-head-actions">' +
              '<input type="search" id="chimieEasySearch" class="latex-lab-search" ' +
                'placeholder="Sans accents : benzene, hydroxyle, cetone…" ' +
                'autocomplete="off" spellcheck="true" lang="fr">' +
              '<button type="button" class="bs" id="chimieEasyCopy" title="Copier le SMILES">' +
                '<span data-icon="copy"></span> Copier</button>' +
              '<button type="button" class="bs" id="chimieEasyCopyCe" title="Copier \\ce{…} si connu">' +
                '\\ce{}</button>' +
              '<button type="button" class="bs" id="chimieEasyClear" title="Effacer">' +
                '<span data-icon="trash-2"></span></button>' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<div class="latex-lab-work">' +
          '<div class="latex-lab-compose">' +
            '<section class="latex-lab-panel latex-lab-panel-editor">' +
              '<div class="latex-lab-panel-label">Éditeur <span class="anki-mut">· SMILES · Entrée libre</span></div>' +
              '<div class="latex-lab-field-wrap chimie-easy-field-wrap">' +
                '<textarea id="chimieEasyField" class="chimie-easy-field" rows="3" spellcheck="false" ' +
                  'placeholder="CCO   ou   c1ccccc1   ou   CC(=O)O" ' +
                  'aria-label="SMILES"></textarea>' +
              '</div>' +
              '<div class="chimie-easy-meta" id="chimieEasyMeta"></div>' +
              '<div class="latex-lab-quickbar" role="toolbar" aria-label="Insertions rapides">' +
                '<button type="button" class="latex-lab-quick" data-ins="C" title="Carbone">C</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="O" title="Oxygène">O</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="N" title="Azote">N</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="=" title="Double liaison">=</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="#" title="Triple liaison">≡</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="()" data-cur="-1" title="Branche">( )</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="c1ccccc1" title="Benzène">Ph</button>' +
                '<button type="button" class="latex-lab-quick" data-ins="C(=O)O" title="Acide">COOH</button>' +
              '</div>' +
            '</section>' +
            '<section class="latex-lab-panel latex-lab-panel-preview">' +
              '<div class="latex-lab-panel-label">Aperçu <span class="anki-mut">· structure 2D</span></div>' +
              '<div class="latex-lab-preview-wrap chimie-easy-preview" id="chimieEasyPreview"></div>' +
            '</section>' +
          '</div>' +

          '<section class="latex-lab-palette">' +
            '<div id="chimieEasyQuick" class="latex-lab-quick-wrap">' + quickHtml + '</div>' +
            '<div class="latex-lab-families" id="chimieEasyCats" role="tablist" aria-label="Familles"></div>' +
            '<div class="latex-lab-family-panel">' +
              '<div class="latex-lab-palette-head">' +
                '<span class="latex-lab-panel-label" id="chimieEasyCatTitle">Construire · Atomes</span>' +
                '<span class="anki-mut latex-lab-palette-hint" id="chimieEasyHint">Insère au curseur</span>' +
              '</div>' +
              '<div class="latex-lab-subs" id="chimieEasySubs" role="tablist"></div>' +
              '<div class="latex-lab-snip-grid" id="chimieEasySnips" role="tabpanel"></div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<details class="latex-lab-code-panel">' +
          '<summary class="latex-lab-code-summary">Code SMILES <span class="anki-mut">— édition brute</span></summary>' +
          '<textarea id="chimieEasyCode" class="latex-lab-code" rows="2" spellcheck="false" ' +
            'placeholder="CCO"></textarea>' +
        '</details>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);
  }

  function wire(root) {
    if (_wired) return;
    _wired = true;

    var field = smilesField();
    if (field) {
      field.addEventListener('input', function () {
        _meta = { name: '', ce: '' };
        scheduleDraw();
        syncCode();
      });
    }

    var code = document.getElementById('chimieEasyCode');
    if (code) {
      code.addEventListener('input', function () {
        setSmiles(code.value, false);
        _meta = { name: '', ce: '' };
      });
    }

    var search = document.getElementById('chimieEasySearch');
    if (search) {
      search.addEventListener('input', function () {
        refreshPalette(search.value);
      });
    }

    root.querySelectorAll('[data-ins]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cur = parseInt(btn.getAttribute('data-cur') || '0', 10) || 0;
        insertAtCursor(btn.getAttribute('data-ins') || '', cur);
      });
    });

    wireSnips(document.getElementById('chimieEasyQuick'));

    var copyBtn = document.getElementById('chimieEasyCopy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyText(getSmiles().trim(), 'SMILES copié');
      });
    }
    var copyCe = document.getElementById('chimieEasyCopyCe');
    if (copyCe) {
      copyCe.addEventListener('click', function () {
        if (!_meta.ce) {
          toast('Pas de \\ce{} — choisis un exemple du catalogue');
          return;
        }
        copyText('\\ce{' + _meta.ce + '}', 'LaTeX mhchem copié');
      });
    }
    var clearBtn = document.getElementById('chimieEasyClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        _meta = { name: '', ce: '' };
        setSmiles('', true);
        updateMeta();
      });
    }

    window.addEventListener('resize', function () {
      var pane = document.getElementById('paneChimieLab');
      if (pane && !pane.classList.contains('hidden')) scheduleDraw();
    });
  }

  window.renderChimieLab = function () {
    var root = document.getElementById('paneChimieLab');
    if (!root) return;

    if (!_built) {
      root.innerHTML =
        '<div class="latex-lab latex-lab-loading chimie-easy">' +
          '<div class="clean-spinner" aria-hidden="true"></div>' +
          '<p class="anki-mut">Chargement d’Easy Chimie…</p>' +
        '</div>';
    }

    ensureSmilesDrawer().then(function () {
      if (!_built) {
        buildShell(root);
        _built = true;
        wire(root);
      }
      refreshPalette((document.getElementById('chimieEasySearch') || {}).value || '');
      if (!getSmiles().trim()) {
        _meta = { name: 'Éthanol', ce: 'C2H5OH' };
        setSmiles('CCO', true);
      } else {
        scheduleDraw();
      }
      updateMeta();
    }).catch(function (err) {
      _built = false;
      _wired = false;
      root.innerHTML =
        '<div class="latex-lab chimie-easy">' +
          '<h2 class="latex-lab-title">Easy Chimie</h2>' +
          '<p class="chimie-lab-error">' + esc(err && err.message ? err.message : 'Erreur') + '</p>' +
          '<p class="anki-mut">Vérifie ta connexion (SmilesDrawer / jsDelivr).</p>' +
          '<button type="button" class="bp" id="chimieEasyRetry">Réessayer</button>' +
        '</div>';
      var retry = document.getElementById('chimieEasyRetry');
      if (retry) retry.addEventListener('click', function () { window.renderChimieLab(); });
    });
  };
})();
