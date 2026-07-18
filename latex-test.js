/**
 * latex-test.js — Onglet labo : éditeur MathLive + aperçu (sandbox avant intégration cartes)
 */
(function () {
  'use strict';

  var MATHLIVE_VER = '0.110.0';
  var CDN = 'https://cdn.jsdelivr.net/npm/mathlive@' + MATHLIVE_VER;
  var _mathLivePromise = null;
  var _built = false;
  var _wired = false;
  var _mf = null;
  var _preview = null;

  var SNIPS = [
    { id: 'frac', label: 'Fraction', latex: '\\frac{#0}{#1}' },
    { id: 'sqrt', label: '√', latex: '\\sqrt{#0}' },
    { id: 'int', label: '∫', latex: '\\int_{#0}^{#1}#2\\,d#3' },
    { id: 'sum', label: '∑', latex: '\\sum_{#0}^{#1}#2' },
    { id: 'lim', label: 'lim', latex: '\\lim_{#0\\to#1}#2' },
    { id: 'mat2', label: 'Mat 2×2', latex: '\\begin{pmatrix}#0&#1\\\\#2&#3\\end{pmatrix}' },
    { id: 'mat3', label: 'Mat 3×3', latex: '\\begin{pmatrix}#0&#1&#2\\\\#3&#4&#5\\\\#6&#7&#8\\end{pmatrix}' },
    { id: 'cases', label: 'Syst.', latex: '\\begin{cases}#0\\\\#1\\end{cases}' },
    { id: 'vec', label: 'vec', latex: '\\vec{#0}' },
    { id: 'partial', label: '∂', latex: '\\frac{\\partial #0}{\\partial #1}' },
    { id: 'norm', label: '‖·‖', latex: '\\lVert#0\\rVert' },
    { id: 'exp', label: 'e^{}', latex: 'e^{#0}' }
  ];

  function loadStylesheet(href) {
    if (document.querySelector('link[data-mathlive="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-mathlive', href);
    document.head.appendChild(link);
  }

  function ensureMathLive() {
    if (_mathLivePromise) return _mathLivePromise;
    if (window.MathfieldElement || customElements.get('math-field')) {
      _mathLivePromise = Promise.resolve();
      return _mathLivePromise;
    }
    _mathLivePromise = new Promise(function (resolve, reject) {
      loadStylesheet(CDN + '/mathlive-static.css');
      loadStylesheet(CDN + '/mathlive-fonts.css');
      var s = document.createElement('script');
      s.src = CDN + '/mathlive.min.js';
      s.async = true;
      s.onload = function () {
        try {
          if (window.MathfieldElement) {
            window.MathfieldElement.fontsDirectory = CDN + '/fonts';
          }
        } catch (e) { /* ignore */ }
        resolve();
      };
      s.onerror = function () {
        _mathLivePromise = null;
        reject(new Error('Impossible de charger MathLive (réseau / CDN).'));
      };
      document.head.appendChild(s);
    });
    return _mathLivePromise;
  }

  function syncFromEditor() {
    if (!_mf) return;
    var latex = '';
    try {
      latex = _mf.getValue ? _mf.getValue('latex') : (_mf.value || '');
    } catch (e) {
      latex = _mf.value || '';
    }
    var codeEl = document.getElementById('latexTestCode');
    if (codeEl && document.activeElement !== codeEl) codeEl.value = latex;
    if (_preview) {
      try {
        _preview.value = latex;
      } catch (e) { /* ignore */ }
    }
  }

  function applyLatexToEditor(latex, focus) {
    if (!_mf) return;
    try {
      _mf.value = latex || '';
    } catch (e) { /* ignore */ }
    syncFromEditor();
    if (focus) {
      try { _mf.focus(); } catch (e2) { /* ignore */ }
    }
  }

  function insertSnip(latex) {
    if (!_mf) return;
    try {
      if (typeof _mf.executeCommand === 'function') {
        _mf.executeCommand(['insert', latex]);
      } else {
        _mf.value = (_mf.value || '') + latex;
      }
      _mf.focus();
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast('Insertion échouée');
    }
    syncFromEditor();
  }

  function copyLatex() {
    var codeEl = document.getElementById('latexTestCode');
    var text = (codeEl && codeEl.value) || '';
    if (!text) {
      if (typeof window.showToast === 'function') window.showToast('Rien à copier');
      return;
    }
    var done = function () {
      if (typeof window.showToast === 'function') window.showToast('LaTeX copié');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        codeEl.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      });
    } else {
      codeEl.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    }
  }

  function clearAll() {
    applyLatexToEditor('', true);
    var codeEl = document.getElementById('latexTestCode');
    if (codeEl) codeEl.value = '';
  }

  function wireFields() {
    _mf = document.getElementById('latexTestField');
    _preview = document.getElementById('latexTestPreview');
    if (!_mf) return;

    if (_wired) {
      syncFromEditor();
      return;
    }
    _wired = true;

    _mf.setAttribute('virtual-keyboard-mode', 'manual');
    _mf.setAttribute('smart-mode', 'true');
    if (_preview) {
      _preview.setAttribute('read-only', '');
      _preview.style.pointerEvents = 'none';
    }

    _mf.addEventListener('input', syncFromEditor);
    _mf.addEventListener('change', syncFromEditor);

    var codeEl = document.getElementById('latexTestCode');
    if (codeEl) {
      codeEl.addEventListener('input', function () {
        applyLatexToEditor(codeEl.value, false);
      });
    }

    // Démo de départ : matrice pour tester le clic dans les coeffs
    if (!_mf.value) {
      applyLatexToEditor('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', false);
    } else {
      syncFromEditor();
    }

    try { _mf.focus(); } catch (e) { /* ignore */ }
  }

  function buildShell(root) {
    var snipHtml = SNIPS.map(function (s) {
      return '<button type="button" class="latex-lab-snip" data-snip="' + s.id + '" title="' + s.label + '">' + s.label + '</button>';
    }).join('');

    root.innerHTML =
      '<div class="latex-lab">' +
        '<div class="latex-lab-head">' +
          '<div>' +
            '<h2 class="latex-lab-title"><span data-icon="flask-conical"></span> Labo LaTeX</h2>' +
            '<p class="latex-lab-desc">Sandbox MathLive — clique dans les cases / bornes pour éditer. Pas encore branché aux cartes.</p>' +
          '</div>' +
          '<div class="latex-lab-head-actions">' +
            '<button type="button" class="bs" id="latexTestCopy"><span data-icon="copy"></span> Copier LaTeX</button>' +
            '<button type="button" class="bs" id="latexTestClear"><span data-icon="trash-2"></span> Effacer</button>' +
          '</div>' +
        '</div>' +
        '<div class="latex-lab-snips" id="latexTestSnips">' + snipHtml + '</div>' +
        '<div class="latex-lab-grid">' +
          '<section class="latex-lab-panel">' +
            '<div class="latex-lab-panel-label">Éditeur <span class="anki-mut">— clique un coeff, Tab pour le suivant</span></div>' +
            '<div class="latex-lab-field-wrap">' +
              '<math-field id="latexTestField" class="latex-lab-field"></math-field>' +
            '</div>' +
            '<button type="button" class="bs latex-lab-kb" id="latexTestKeyboard"><span data-icon="keyboard"></span> Clavier math</button>' +
          '</section>' +
          '<section class="latex-lab-panel latex-lab-panel-preview">' +
            '<div class="latex-lab-panel-label">Aperçu</div>' +
            '<div class="latex-lab-preview-wrap">' +
              '<math-field id="latexTestPreview" class="latex-lab-preview"></math-field>' +
            '</div>' +
          '</section>' +
        '</div>' +
        '<section class="latex-lab-panel latex-lab-code-panel">' +
          '<div class="latex-lab-panel-label">Code LaTeX <span class="anki-mut">— éditable aussi à la main</span></div>' +
          '<textarea id="latexTestCode" class="latex-lab-code" rows="3" spellcheck="false" placeholder="\\frac{a}{b}"></textarea>' +
        '</section>' +
        '<p class="latex-lab-hint anki-mut">Astuce : bouton Mat 2×2 → clique <b>a</b>, tape, Tab → <b>b</b>, etc. Même principe pour les bornes d’intégrale.</p>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);

    root.querySelectorAll('[data-snip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var snip = SNIPS.find(function (s) { return s.id === btn.getAttribute('data-snip'); });
        if (snip) insertSnip(snip.latex);
      });
    });

    var copyBtn = document.getElementById('latexTestCopy');
    var clearBtn = document.getElementById('latexTestClear');
    var kbBtn = document.getElementById('latexTestKeyboard');
    if (copyBtn) copyBtn.addEventListener('click', copyLatex);
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    if (kbBtn) {
      kbBtn.addEventListener('click', function () {
        if (!_mf) return;
        try {
          if (typeof _mf.executeCommand === 'function') {
            _mf.executeCommand('showVirtualKeyboard');
          } else if (_mf.showVirtualKeyboard) {
            _mf.showVirtualKeyboard();
          }
          _mf.focus();
        } catch (e) { /* ignore */ }
      });
    }
  }

  window.renderLatexTest = function () {
    var root = document.getElementById('paneLatexTest');
    if (!root) return;

    if (!_built) {
      root.innerHTML =
        '<div class="latex-lab latex-lab-loading">' +
          '<div class="clean-spinner" aria-hidden="true"></div>' +
          '<p class="anki-mut">Chargement de MathLive…</p>' +
        '</div>';
    }

    ensureMathLive().then(function () {
      if (!_built) {
        buildShell(root);
        _built = true;
      }
      // Custom elements prêts après le script
      customElements.whenDefined('math-field').then(function () {
        wireFields();
      }).catch(function () {
        wireFields();
      });
    }).catch(function (err) {
      root.innerHTML =
        '<div class="latex-lab">' +
          '<h2 class="latex-lab-title">Labo LaTeX</h2>' +
          '<p class="latex-lab-error">' + (err && err.message ? err.message : 'Erreur de chargement') + '</p>' +
          '<p class="anki-mut">Vérifie ta connexion : MathLive est chargé depuis jsDelivr.</p>' +
          '<button type="button" class="bp" id="latexTestRetry">Réessayer</button>' +
        '</div>';
      var retry = document.getElementById('latexTestRetry');
      if (retry) retry.addEventListener('click', function () {
        _built = false;
        _wired = false;
        window.renderLatexTest();
      });
    });
  };
})();
