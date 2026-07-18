/**
 * latex-test.js — Onglet labo : éditeur MathLive + aperçu (sandbox avant intégration cartes)
 */
(function () {
  'use strict';

  var MATHLIVE_VER = '0.110.0';
  var CDN = 'https://cdn.jsdelivr.net/npm/mathlive@' + MATHLIVE_VER;
  var UI_REV = 2;
  var _uiRev = 0;
  var _mathLivePromise = null;
  var _built = false;
  var _wired = false;
  var _mf = null;
  var _preview = null;
  var _activeCat = 'base';
  var _kbOpen = false;

  /** Palettes PC* — rangées par usage (clic = structure, Tab pour remplir) */
  var SNIP_GROUPS = [
    {
      id: 'base',
      label: 'Bases',
      items: [
        { label: 'a/b', latex: '\\frac{#0}{#1}', title: 'Fraction' },
        { label: '√', latex: '\\sqrt{#0}', title: 'Racine' },
        { label: 'ⁿ√', latex: '\\sqrt[#0]{#1}', title: 'Racine n-ième' },
        { label: 'aⁿ', latex: '{#0}^{#1}', title: 'Puissance' },
        { label: 'aₙ', latex: '{#0}_{#1}', title: 'Indice' },
        { label: 'aₙᵐ', latex: '{#0}_{#1}^{#2}', title: 'Indice + exposant' },
        { label: '|·|', latex: '\\left|#0\\right|', title: 'Valeur absolue' },
        { label: '( )', latex: '\\left(#0\\right)', title: 'Parenthèses auto' },
        { label: '[ ]', latex: '\\left[#0\\right]', title: 'Crochets auto' },
        { label: 'e^{}', latex: 'e^{#0}', title: 'Exponentielle' },
        { label: 'ln', latex: '\\ln{#0}', title: 'Logarithme népérien' },
        { label: 'log', latex: '\\log_{#0}{#1}', title: 'Logarithme' }
      ]
    },
    {
      id: 'analyse',
      label: 'Analyse',
      items: [
        { label: 'lim', latex: '\\lim_{#0\\to#1}#2', title: 'Limite' },
        { label: 'lim±', latex: '\\lim_{#0\\to{#1}^{#2}}#3', title: 'Limite à gauche/droite' },
        { label: "f'", latex: "{#0}'", title: 'Dérivée prime' },
        { label: "f''", latex: "{#0}''", title: 'Dérivée seconde' },
        { label: 'df/dx', latex: '\\frac{\\mathrm{d}#0}{\\mathrm{d}#1}', title: 'Dérivée' },
        { label: 'd²f/dx²', latex: '\\frac{\\mathrm{d}^{2}#0}{\\mathrm{d}#1^{2}}', title: 'Dérivée seconde' },
        { label: '∂/∂', latex: '\\frac{\\partial #0}{\\partial #1}', title: 'Dérivée partielle' },
        { label: '∂²', latex: '\\frac{\\partial^{2}#0}{\\partial #1\\,\\partial #2}', title: 'Dérivée partielle croisée' },
        { label: '∫', latex: '\\int_{#0}^{#1}#2\\,\\mathrm{d}#3', title: 'Intégrale définie' },
        { label: '∬', latex: '\\iint_{#0}#1\\,\\mathrm{d}#2\\,\\mathrm{d}#3', title: 'Intégrale double' },
        { label: '∮', latex: '\\oint_{#0}#1\\,\\mathrm{d}#2', title: 'Intégrale de circulation' },
        { label: '∑', latex: '\\sum_{#0}^{#1}#2', title: 'Somme' },
        { label: '∏', latex: '\\prod_{#0}^{#1}#2', title: 'Produit' },
        { label: '∞', latex: '\\infty', title: 'Infini' }
      ]
    },
    {
      id: 'algebre',
      label: 'Algèbre',
      items: [
        { label: 'Mat 2×2', latex: '\\begin{pmatrix}#0&#1\\\\#2&#3\\end{pmatrix}', title: 'Matrice 2×2' },
        { label: 'Mat 3×3', latex: '\\begin{pmatrix}#0&#1&#2\\\\#3&#4&#5\\\\#6&#7&#8\\end{pmatrix}', title: 'Matrice 3×3' },
        { label: 'det', latex: '\\begin{vmatrix}#0&#1\\\\#2&#3\\end{vmatrix}', title: 'Déterminant 2×2' },
        { label: 'Syst.', latex: '\\begin{cases}#0\\\\#1\\end{cases}', title: 'Système' },
        { label: 'vec', latex: '\\vec{#0}', title: 'Vecteur' },
        { label: 'â', latex: '\\hat{#0}', title: 'Chapeau (base orthonormée)' },
        { label: 'Ā', latex: '\\overline{#0}', title: 'Barre / conjugué' },
        { label: '‖·‖', latex: '\\lVert#0\\rVert', title: 'Norme' },
        { label: '⟨·|·⟩', latex: '\\langle#0\\mid#1\\rangle', title: 'Produit scalaire' },
        { label: '⊕', latex: '#0\\oplus#1', title: 'Somme directe' },
        { label: '⊗', latex: '#0\\otimes#1', title: 'Produit tensoriel' },
        { label: '∈', latex: '\\in', title: 'Appartient' },
        { label: '⊂', latex: '\\subset', title: 'Inclus' },
        { label: '∅', latex: '\\emptyset', title: 'Ensemble vide' }
      ]
    },
    {
      id: 'grec',
      label: 'Grec',
      items: [
        { label: 'α', latex: '\\alpha' }, { label: 'β', latex: '\\beta' },
        { label: 'γ', latex: '\\gamma' }, { label: 'δ', latex: '\\delta' },
        { label: 'ε', latex: '\\varepsilon' }, { label: 'θ', latex: '\\theta' },
        { label: 'λ', latex: '\\lambda' }, { label: 'μ', latex: '\\mu' },
        { label: 'π', latex: '\\pi' }, { label: 'ρ', latex: '\\rho' },
        { label: 'σ', latex: '\\sigma' }, { label: 'τ', latex: '\\tau' },
        { label: 'φ', latex: '\\varphi' }, { label: 'ω', latex: '\\omega' },
        { label: 'Δ', latex: '\\Delta' }, { label: 'Σ', latex: '\\Sigma' },
        { label: 'Ω', latex: '\\Omega' }, { label: '∇', latex: '\\nabla' }
      ]
    },
    {
      id: 'physique',
      label: 'Physique',
      items: [
        { label: 'd/dt', latex: '\\frac{\\mathrm{d}#0}{\\mathrm{d}t}', title: 'Dérivée temporelle' },
        { label: '∂/∂t', latex: '\\frac{\\partial #0}{\\partial t}', title: 'Dérivée partielle temporelle' },
        { label: 'ẋ', latex: '\\dot{#0}', title: 'Point (Newton)' },
        { label: 'ẍ', latex: '\\ddot{#0}', title: 'Double point' },
        { label: 'grad', latex: '\\overrightarrow{\\mathrm{grad}}\\,#0', title: 'Gradient' },
        { label: 'div', latex: '\\mathrm{div}\\,#0', title: 'Divergence' },
        { label: 'rot', latex: '\\overrightarrow{\\mathrm{rot}}\\,#0', title: 'Rotationnel' },
        { label: 'Δ', latex: '\\Delta#0', title: 'Laplacien' },
        { label: '→F', latex: '\\overrightarrow{#0}', title: 'Vecteur flèche' },
        { label: '×', latex: '\\times', title: 'Produit vectoriel' },
        { label: '·', latex: '\\cdot', title: 'Produit scalaire' },
        { label: '≈', latex: '\\approx', title: 'Environ' },
        { label: '∝', latex: '\\propto', title: 'Proportionnel' },
        { label: '≪', latex: '\\ll', title: 'Très inférieur' },
        { label: '∼', latex: '\\sim', title: 'Ordre de grandeur' },
        { label: 'ℏ', latex: '\\hbar', title: 'h barre' },
        { label: '⟨ψ|', latex: '\\langle#0|', title: 'Bra' },
        { label: '|ψ⟩', latex: '|#0\\rangle', title: 'Ket' }
      ]
    },
    {
      id: 'chimie',
      label: 'Chimie',
      items: [
        { label: 'ce{}', latex: '\\ce{#0}', title: 'Formule mhchem (H2O, Fe2+, …)' },
        { label: '→', latex: '\\longrightarrow', title: 'Réaction' },
        { label: '⇌', latex: '\\rightleftharpoons', title: 'Équilibre' },
        { label: '⟶ᵏ', latex: '\\xrightarrow{#0}', title: 'Flèche avec condition dessus' },
        { label: '⇄', latex: '\\xrightleftharpoons[#0]{#1}', title: 'Équilibre annoté' },
        { label: '↑', latex: '\\uparrow', title: 'Gaz dégagé' },
        { label: '↓', latex: '\\downarrow', title: 'Précipité' },
        { label: 'Δ', latex: '\\Delta', title: 'Chaleur / variation' },
        { label: '°C', latex: '{}^{\\circ}\\mathrm{C}', title: 'Degré Celsius' },
        { label: 'aq', latex: '(\\mathrm{aq})', title: 'Aqueux' },
        { label: 's/l/g', latex: '(\\mathrm{#0})', title: 'État (s, l, g)' },
        { label: 'pH', latex: '\\mathrm{pH}', title: 'pH' },
        { label: 'K', latex: 'K_{#0}', title: 'Constante (K_a, K_éq…)' },
        { label: '½', latex: '\\tfrac{1}{2}', title: 'Un demi (stœchio)' },
        { label: 'e⁻', latex: 'e^{-}', title: 'Électron' },
        { label: 'n⁰', latex: 'n^{0}', title: 'Neutron' }
      ]
    },
    {
      id: 'relations',
      label: 'Relations',
      items: [
        { label: '=', latex: '=' }, { label: '≠', latex: '\\neq' },
        { label: '≤', latex: '\\leq' }, { label: '≥', latex: '\\geq' },
        { label: '≃', latex: '\\simeq' }, { label: '≡', latex: '\\equiv' },
        { label: '⇒', latex: '\\Rightarrow' }, { label: '⇔', latex: '\\Leftrightarrow' },
        { label: '∀', latex: '\\forall' }, { label: '∃', latex: '\\exists' },
        { label: '±', latex: '\\pm' }, { label: '∓', latex: '\\mp' },
        { label: '…', latex: '\\dots' }, { label: '⋯', latex: '\\cdots' }
      ]
    }
  ];

  /** Layout clavier virtuel chimie (pas de layout natif MathLive) */
  var VK_CHEMISTRY_LAYOUT = {
    label: 'Chimie',
    tooltip: 'Symboles chimie (mhchem)',
    rows: [
      [
        '\\ce{#0}', '\\longrightarrow', '\\rightleftharpoons',
        '\\xrightarrow{#0}', '\\uparrow', '\\downarrow', '\\Delta'
      ],
      [
        '{}^{\\circ}\\mathrm{C}', '(\\mathrm{aq})', '\\mathrm{pH}',
        'K_{#0}', 'e^{-}', '\\tfrac{1}{2}', '(\\mathrm{#0})'
      ]
    ]
  };

  function findSnipById(id) {
    for (var g = 0; g < SNIP_GROUPS.length; g++) {
      var items = SNIP_GROUPS[g].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
    }
    return null;
  }

  function findGroupById(id) {
    for (var g = 0; g < SNIP_GROUPS.length; g++) {
      if (SNIP_GROUPS[g].id === id) return SNIP_GROUPS[g];
    }
    return null;
  }

  function ensureSnipIds() {
    SNIP_GROUPS.forEach(function (group) {
      group.items.forEach(function (item, idx) {
        if (!item.id) item.id = group.id + '-' + idx;
      });
    });
  }
  ensureSnipIds();

  function getMathVK() {
    return window.mathVirtualKeyboard || null;
  }

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

  function updateKbButton() {
    var kbBtn = document.getElementById('latexTestKeyboard');
    if (!kbBtn) return;
    kbBtn.classList.toggle('is-active', _kbOpen);
    kbBtn.setAttribute('aria-pressed', _kbOpen ? 'true' : 'false');
  }

  function updateKbHost() {
    var host = document.getElementById('latexTestKbHost');
    if (!host) return;
    host.classList.toggle('is-open', _kbOpen);
    host.setAttribute('aria-hidden', _kbOpen ? 'false' : 'true');
  }

  function configureVirtualKeyboard() {
    var vk = getMathVK();
    var host = document.getElementById('latexTestKbHost');
    if (!vk || !host) return;

    try {
      vk.container = host;
      vk.layouts = ['numeric', 'symbols', 'greek', VK_CHEMISTRY_LAYOUT];
      if (typeof vk.alphabeticLayout !== 'undefined') {
        vk.alphabeticLayout = 'azerty';
      }
    } catch (e) { /* ignore */ }

    if (host._latexLabVkWired) return;
    host._latexLabVkWired = true;

    try {
      vk.addEventListener('geometrychange', function () {
        var open = !!(vk.visible || vk.boundingRect && vk.boundingRect.height > 0);
        _kbOpen = open;
        updateKbButton();
        updateKbHost();
      });
    } catch (e2) { /* ignore */ }
  }

  function hideVirtualKeyboard() {
    var vk = getMathVK();
    _kbOpen = false;
    updateKbButton();
    updateKbHost();
    if (!vk) return;
    try {
      if (typeof vk.hide === 'function') vk.hide();
      else vk.visible = false;
    } catch (e) { /* ignore */ }
  }

  function showVirtualKeyboard() {
    configureVirtualKeyboard();
    var vk = getMathVK();
    if (!vk) return;
    try {
      if (typeof vk.show === 'function') vk.show();
      else vk.visible = true;
      _kbOpen = true;
      updateKbButton();
      updateKbHost();
    } catch (e) {
      if (_mf) {
        try {
          if (typeof _mf.executeCommand === 'function') {
            _mf.executeCommand('showVirtualKeyboard');
          } else if (_mf.showVirtualKeyboard) {
            _mf.showVirtualKeyboard();
          }
        } catch (e2) { /* ignore */ }
      }
    }
    if (_mf) {
      try { _mf.focus(); } catch (e3) { /* ignore */ }
    }
  }

  function toggleVirtualKeyboard() {
    if (_kbOpen) hideVirtualKeyboard();
    else showVirtualKeyboard();
  }

  function clearAll() {
    applyLatexToEditor('', true);
    var codeEl = document.getElementById('latexTestCode');
    if (codeEl) codeEl.value = '';
  }

  function wireSnipButtons(container) {
    if (!container) return;
    container.querySelectorAll('[data-snip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var snip = findSnipById(btn.getAttribute('data-snip'));
        if (snip) insertSnip(snip.latex);
      });
    });
  }

  function renderActiveSnips() {
    var snipsEl = document.getElementById('latexTestSnips');
    if (!snipsEl) return;

    var group = findGroupById(_activeCat) || SNIP_GROUPS[0];
    var buttons = group.items.map(function (s) {
      var tip = s.title || s.label;
      return '<button type="button" class="latex-lab-snip" data-snip="' + s.id + '" title="' + tip + '">' + s.label + '</button>';
    }).join('');

    snipsEl.setAttribute('data-cat', group.id);
    snipsEl.innerHTML = buttons;
    wireSnipButtons(snipsEl);
  }

  function setActiveCategory(catId) {
    if (!findGroupById(catId)) return;
    _activeCat = catId;

    document.querySelectorAll('.latex-lab-tab').forEach(function (tab) {
      var on = tab.getAttribute('data-cat') === catId;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    renderActiveSnips();
  }

  function configureMathField(mf, readOnly) {
    if (!mf) return;
    try {
      mf.menuItems = [];
      mf.mathVirtualKeyboardPolicy = 'manual';
    } catch (e) { /* ignore */ }
    mf.setAttribute('virtual-keyboard-mode', 'manual');
    mf.setAttribute('math-virtual-keyboard-policy', 'manual');
    if (readOnly) {
      mf.setAttribute('read-only', '');
      mf.style.pointerEvents = 'none';
    }
  }

  function watchPaneVisibility() {
    var pane = document.getElementById('paneLatexTest');
    if (!pane || pane._latexLabObserved) return;
    pane._latexLabObserved = true;
    var obs = new MutationObserver(function () {
      if (!pane.classList.contains('on')) hideVirtualKeyboard();
    });
    obs.observe(pane, { attributes: true, attributeFilter: ['class'] });
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

    configureMathField(_mf, false);
    configureMathField(_preview, true);
    _mf.setAttribute('smart-mode', 'true');

    _mf.addEventListener('input', syncFromEditor);
    _mf.addEventListener('change', syncFromEditor);

    var codeEl = document.getElementById('latexTestCode');
    if (codeEl) {
      codeEl.addEventListener('input', function () {
        applyLatexToEditor(codeEl.value, false);
      });
    }

    configureVirtualKeyboard();
    watchPaneVisibility();

    // Démo de départ : matrice pour tester le clic dans les coeffs
    if (!_mf.value) {
      applyLatexToEditor('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', false);
    } else {
      syncFromEditor();
    }

    try { _mf.focus(); } catch (e) { /* ignore */ }
  }

  function buildShell(root) {
    var tabsHtml = SNIP_GROUPS.map(function (group) {
      var active = group.id === _activeCat;
      return (
        '<button type="button" class="latex-lab-tab' + (active ? ' is-active' : '') + '" ' +
          'role="tab" data-cat="' + group.id + '" ' +
          'aria-selected="' + (active ? 'true' : 'false') + '">' +
          group.label +
        '</button>'
      );
    }).join('');

    root.innerHTML =
      '<div class="latex-lab">' +
        '<div class="latex-lab-toolbar">' +
          '<div class="latex-lab-toolbar-row latex-lab-toolbar-head">' +
            '<div class="latex-lab-toolbar-title-wrap">' +
              '<h2 class="latex-lab-title"><span data-icon="flask-conical"></span> Labo LaTeX</h2>' +
              '<p class="latex-lab-desc">Sandbox MathLive — structures prêtes par catégorie PC*. Clique une case / borne, Tab pour la suivante.</p>' +
            '</div>' +
            '<div class="latex-lab-head-actions">' +
              '<button type="button" class="bs" id="latexTestKeyboard" aria-pressed="false"><span data-icon="keyboard"></span> Clavier</button>' +
              '<button type="button" class="bs" id="latexTestCopy"><span data-icon="copy"></span> Copier LaTeX</button>' +
              '<button type="button" class="bs" id="latexTestClear"><span data-icon="trash-2"></span> Effacer</button>' +
            '</div>' +
          '</div>' +
          '<div class="latex-lab-toolbar-row latex-lab-tabs" id="latexTestTabs" role="tablist">' + tabsHtml + '</div>' +
          '<div class="latex-lab-toolbar-row latex-lab-tab-snips" id="latexTestSnips" data-cat="' + _activeCat + '" role="tabpanel"></div>' +
        '</div>' +
        '<div class="latex-lab-grid">' +
          '<section class="latex-lab-panel">' +
            '<div class="latex-lab-panel-label">Éditeur <span class="anki-mut">— clique un coeff, Tab pour le suivant</span></div>' +
            '<div class="latex-lab-field-wrap">' +
              '<math-field id="latexTestField" class="latex-lab-field"></math-field>' +
            '</div>' +
          '</section>' +
          '<section class="latex-lab-panel latex-lab-panel-preview">' +
            '<div class="latex-lab-panel-label">Aperçu</div>' +
            '<div class="latex-lab-preview-wrap">' +
              '<math-field id="latexTestPreview" class="latex-lab-preview"></math-field>' +
            '</div>' +
          '</section>' +
        '</div>' +
        '<div id="latexTestKbHost" class="latex-lab-kb-host" aria-hidden="true"></div>' +
        '<section class="latex-lab-panel latex-lab-code-panel">' +
          '<div class="latex-lab-panel-label">Code LaTeX <span class="anki-mut">— éditable aussi à la main</span></div>' +
          '<textarea id="latexTestCode" class="latex-lab-code" rows="3" spellcheck="false" placeholder="\\frac{a}{b}"></textarea>' +
        '</section>' +
        '<p class="latex-lab-hint anki-mut">Astuce chimie : <b>ce{}</b> puis tape <code>H2O</code> ou <code>Fe^{2+}</code>. Physique : <b>ẋ</b> / <b>grad</b> / <b>|ψ⟩</b>.</p>' +
      '</div>';

    if (typeof window.hydrateIcons === 'function') window.hydrateIcons(root);

    renderActiveSnips();

    document.querySelectorAll('.latex-lab-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        setActiveCategory(tab.getAttribute('data-cat'));
      });
    });

    var copyBtn = document.getElementById('latexTestCopy');
    var clearBtn = document.getElementById('latexTestClear');
    var kbBtn = document.getElementById('latexTestKeyboard');
    if (copyBtn) copyBtn.addEventListener('click', copyLatex);
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    if (kbBtn) kbBtn.addEventListener('click', toggleVirtualKeyboard);
  }

  window.renderLatexTest = function () {
    if (_uiRev !== UI_REV) {
      _built = false;
      _wired = false;
      _uiRev = UI_REV;
    }

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
