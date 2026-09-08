/**
 * anki-quick.js — Onglet Rapide : cartes Y- par fil d’Ariane (groupes) + LaTeX
 */
(function () {
  const $ = id => document.getElementById(id);
  const QUICK_PROFIL = "ANGLAIS";
  const QUICK_DEFAULT_SEC = 30;
  const UNGROUPED = '__none__';
  const GROUP_COLORS = ['#5b8df7', '#f0c060', '#50d890', '#e07ab3', '#f06060', '#06b6d4', '#a855f7', '#f97316'];

  const Q = {
    mat: "",
    nav: { group: "" },
    coursId: "",
    groupsModalFocusMat: "",
    groupsModalFocusAdd: false
  };

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.quickGroups)) window.D.quickGroups = [];
    if (!Q.mat && window.D.matieres && window.D.matieres.length) Q.mat = window.D.matieres[0].id;
    if (typeof window.dedupeAnkiCardArrays === 'function' && !window._qkDedupeDone) {
      const n = window.dedupeAnkiCardArrays(window.D);
      window._qkDedupeDone = true;
      if (n > 0 && typeof window.save === 'function') {
        try { window.save(); } catch (e) { /* best-effort */ }
      }
    }
  }

  function allQuickCards() {
    const list = (window.D.exercices || []).filter(isQuickCard);
    const seen = Object.create(null);
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c || !c.id) continue;
      if (seen[c.id]) continue;
      seen[c.id] = true;
      out.push(c);
    }
    return out;
  }

  function sortedGroups() {
    ensure();
    return (window.D.quickGroups || []).slice().sort((a, b) => {
      const ma = inferGroupMat(a);
      const mb = inferGroupMat(b);
      if (ma !== mb) {
        const order = matOrderIndex(ma) - matOrderIndex(mb);
        if (order !== 0) return order;
        return String(ma).localeCompare(String(mb), 'fr');
      }
      const oa = a.order != null ? a.order : 0;
      const ob = b.order != null ? b.order : 0;
      if (oa !== ob) return oa - ob;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
  }

  function matOrderIndex(matId) {
    const mats = window.D.matieres || [];
    const idx = mats.findIndex(m => m.id === matId);
    return idx >= 0 ? idx : 999;
  }

  function inferGroupMat(g) {
    if (!g) return '';
    if (g.mat) return g.mat;
    const counts = {};
    allQuickCards().forEach(c => {
      if (c.groupId !== g.id || !c.mat) return;
      counts[c.mat] = (counts[c.mat] || 0) + 1;
    });
    let best = '';
    let max = 0;
    Object.keys(counts).forEach(k => {
      if (counts[k] > max) { max = counts[k]; best = k; }
    });
    return best || (window.D.matieres && window.D.matieres[0] && window.D.matieres[0].id) || '';
  }

  function groupsByMat() {
    ensure();
    const mats = (window.D.matieres || []).slice();
    const buckets = new Map();
    mats.forEach(m => buckets.set(m.id, []));
    const orphanGroups = [];
    sortedGroups().forEach(g => {
      const mat = inferGroupMat(g);
      if (mat && buckets.has(mat)) buckets.get(mat).push(g);
      else orphanGroups.push(g);
    });
    const sections = mats
      .map(m => ({ mat: m, groups: buckets.get(m.id) || [] }))
      .filter(sec => sec.groups.length > 0);
    if (orphanGroups.length) {
      sections.push({
        mat: { id: '', label: '?', name: 'Autre', color: '#6a7088' },
        groups: orphanGroups
      });
    }
    return sections;
  }

  function groupsForMat(matId) {
    if (!matId) return sortedGroups();
    return sortedGroups().filter(g => inferGroupMat(g) === matId);
  }

  function defaultGroupColor(matId) {
    const m = matInfo(matId);
    return (m && m.color) || nextGroupColor();
  }

  function renderGroupColorDots(gid, currentColor, opts) {
    opts = opts || {};
    const forNew = !!opts.forNew;
    const onclick = forNew
      ? function (col) { return `window.quickPickNewGroupColor('${col}')`; }
      : function (col) { return `window.quickPickGroupColor('${jsStr(gid)}','${col}')`; };
    return `<div class="qk-color-dots" role="radiogroup" aria-label="Couleur du dossier">` +
      GROUP_COLORS.map(col =>
        `<button type="button" class="qk-color-dot${currentColor === col ? ' is-on' : ''}" ` +
        `style="background:${col}" ${forNew ? '' : `data-gid="${esc(gid)}" `}data-color="${col}" ` +
        `aria-label="Couleur" aria-pressed="${currentColor === col ? 'true' : 'false'}" ` +
        `onclick="${onclick(col)}"></button>`
      ).join('') +
      `</div>`;
  }

  function renderGroupColorReadonly(color) {
    const c = color || '#6a7088';
    return `<span class="qk-color-dot qk-color-dot--readonly is-on" style="background:${esc(c)}" title="Couleur" aria-hidden="true"></span>`;
  }

  function groupInfo(id) {
    if (!id) return null;
    return (window.D.quickGroups || []).find(g => g.id === id) || null;
  }

  function groupNavMeta(groupKey) {
    if (groupKey === UNGROUPED) {
      return { id: UNGROUPED, name: 'Sans dossier', color: '#6a7088' };
    }
    return groupInfo(groupKey) || { id: groupKey, name: groupKey || 'Groupe', color: '#6a7088' };
  }

  function jsStr(s) {
    return typeof window.escapeJsStr === 'function'
      ? window.escapeJsStr(s)
      : String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function countGroupCards(groupKey) {
    const cards = groupKey === UNGROUPED
      ? allQuickCards().filter(c => !c.groupId)
      : allQuickCards().filter(c => c.groupId === groupKey);
    const split = splitActiveReservoir(cards);
    return { total: cards.length, active: split.active.length, reservoir: split.reservoir.length };
  }

  function genGroupId() {
    const used = new Set((window.D.quickGroups || []).map(g => g.id));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let n = 0; n < 2000; n++) {
      let s = 'QG-';
      for (let i = 0; i < 3; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      if (!used.has(s)) return s;
    }
    return 'QG-' + Date.now().toString(36).slice(-3).toUpperCase();
  }

  function nextGroupColor() {
    const n = (window.D.quickGroups || []).length;
    return GROUP_COLORS[n % GROUP_COLORS.length];
  }

  function groupSelectOptions(selectedId, opts) {
    opts = opts || {};
    const noneLabel = opts.noneLabel || 'Sans dossier';
    const allLabel = opts.allLabel;
    let html = '';
    if (allLabel != null) {
      html += `<option value="" ${!selectedId ? 'selected' : ''}>${esc(allLabel)}</option>`;
      html += `<option value="${UNGROUPED}" ${selectedId === UNGROUPED ? 'selected' : ''}>${esc(noneLabel)}</option>`;
    } else {
      html += `<option value="" ${!selectedId ? 'selected' : ''}>${esc(noneLabel)}</option>`;
    }
    let groups = sortedGroups();
    if (opts.matFilter) {
      groups = groups.filter(g => inferGroupMat(g) === opts.matFilter);
    }
    groups.forEach(g => {
      html += `<option value="${esc(g.id)}" ${selectedId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`;
    });
    return html;
  }

  window.quickGroupOptionsHtml = function (selectedId, opts) {
    ensure();
    return groupSelectOptions(selectedId, opts);
  };

  window.quickSortedGroups = function () {
    ensure();
    return sortedGroups();
  };

  window.quickGroupsByMat = function () {
    ensure();
    return groupsByMat();
  };

  window.quickRefreshGroupSelect = function () {
    const matSel = document.getElementById('quickMat');
    const grpSel = document.getElementById('quickGroup');
    if (!matSel || !grpSel) return;
    const cur = grpSel.value;
    const html = groupSelectOptions(cur, { noneLabel: 'Sans dossier', matFilter: matSel.value || '' });
    if (typeof window.fcRefreshSelect === 'function') window.fcRefreshSelect(grpSel, html);
    else grpSel.innerHTML = html;
    if (typeof window.fcSetSelectValue === 'function') window.fcSetSelectValue(grpSel, cur);
  };

  const esc = s => window.escHtml(s);

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function faceNeedsMath(str) {
    var s = String(str == null ? '' : str);
    return s.indexOf('\\(') >= 0 || /\\[a-zA-Z[{]/.test(s);
  }

  function mathLiveReady() {
    try {
      if (window.MathfieldElement && typeof window.MathfieldElement.convertLatexToMarkup === 'function') return true;
      if (window.MathLive && typeof window.MathLive.convertLatexToMarkup === 'function') return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  /** Placeholder lisible tant que MathLive n’a pas rendu la formule. */
  function formatFacePlaceholder() {
    return '<span class="qk-math-pending" aria-busy="true">Formule en cours de rendu…</span>';
  }

  function applyCardFaceHtml(el, raw, side, opts) {
    if (!el) return;
    opts = opts || {};
    if (side === 'r' && !(raw || '').trim()) {
      el.innerHTML = '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>';
      return;
    }
    if (!raw) {
      el.innerHTML = '';
      return;
    }
    if (faceNeedsMath(raw) && !mathLiveReady() && !opts.allowFallback) {
      el.innerHTML = formatFacePlaceholder();
      return;
    }
    if (typeof window.formatCardFaceHtml === 'function') {
      el.innerHTML = window.formatCardFaceHtml(raw);
    } else {
      el.innerHTML = esc(raw);
    }
  }

  /** Uniformise les faces : réduit la police tant que le texte déborde (cartes à taille fixe). */
  function fitQuickCardFaces(root) {
    var host = root || document.getElementById('qkSections') || document;
    if (!host) return;
    host.querySelectorAll('.qk-q, .qk-r').forEach(function (el) {
      el.style.fontSize = '';
      var base = parseFloat(window.getComputedStyle(el).fontSize) || 15;
      var size = base;
      var min = 10;
      el.style.fontSize = size + 'px';
      /* Limite de sécurité anti-boucle */
      var guard = 0;
      while (guard < 24 && size > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
        guard++;
      }
    });
  }

  window.fitQuickCardFaces = fitQuickCardFaces;

  /** Re-rendu des faces LaTeX une fois MathLive + formatCardFaceHtml prêts */
  window.hydrateQuickCardFaces = function (root) {
    var host = root || document.getElementById('qkSections') || document;
    if (!host) return Promise.resolve();

    function collectMathNodes() {
      return host.querySelectorAll('[data-card-face-id]');
    }

    function anyFaceNeedsMath(nodes) {
      var needs = false;
      nodes.forEach(function (el) {
        var id = el.getAttribute('data-card-face-id');
        var side = el.getAttribute('data-card-face-side') || 'q';
        var c = window.AnkiAlgo && window.AnkiAlgo.findCard(window.D, id);
        if (!c) return;
        var raw = side === 'r' ? (c.reponse || '') : (c.question || '');
        if (faceNeedsMath(raw)) needs = true;
      });
      return needs;
    }

    function paintFaces(allowFallback) {
      /* Re-query : le DOM a pu être re-rendu pendant le chargement async */
      var nodes = collectMathNodes();
      nodes.forEach(function (el) {
        var id = el.getAttribute('data-card-face-id');
        var side = el.getAttribute('data-card-face-side') || 'q';
        var c = window.AnkiAlgo && window.AnkiAlgo.findCard(window.D, id);
        if (!c) return;
        var raw = side === 'r' ? (c.reponse || '') : (c.question || '');
        applyCardFaceHtml(el, raw, side, { allowFallback: !!allowFallback });
        var card = el.closest('.qk-card');
        if (card && faceNeedsMath(raw)) card.classList.add('qk-card--math');
      });
      fitQuickCardFaces(host);
    }

    var initial = collectMathNodes();
    if (!initial.length) {
      fitQuickCardFaces(host);
      return Promise.resolve();
    }
    if (!anyFaceNeedsMath(initial)) {
      fitQuickCardFaces(host);
      return Promise.resolve();
    }

    var loadScripts = Promise.resolve();
    if (typeof window.ensureScriptsForTab === 'function') {
      loadScripts = window.ensureScriptsForTab('quickLatex');
    }
    return loadScripts.then(function () {
      if (typeof window.ensureMathLive === 'function') return window.ensureMathLive();
    }).then(function () {
      paintFaces(false);
      /* Si MathLive a échoué silencieusement, éviter le placeholder éternel */
      if (!mathLiveReady()) paintFaces(true);
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Rapide] hydrate LaTeX', err);
      }
      paintFaces(true);
    });
  };

  function isQuickCard(c) {
    return window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === "quick";
  }

  function matInfo(id) {
    return (window.D.matieres || []).find(m => m.id === id) || { color: '#666', label: id || '?', name: id || '?' };
  }

  function formatFace(str) {
    if (faceNeedsMath(str) && !mathLiveReady()) {
      return formatFacePlaceholder();
    }
    if (typeof window.formatCardFaceHtml === 'function') return window.formatCardFaceHtml(str);
    if (typeof window.formatQuickCardHtml === 'function') return window.formatQuickCardHtml(str);
    // Fallback sûr si latex-test pas encore chargé : texte échappé uniquement
    return esc(str);
  }

  window.closeQuickCreateMenu = function () {
    const menu = document.getElementById('quickCreateMenu');
    const trigger = document.getElementById('btnQuickCreateMenu');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };

  window.toggleQuickCreateMenu = function () {
    const menu = document.getElementById('quickCreateMenu');
    const trigger = document.getElementById('btnQuickCreateMenu');
    if (!menu || !trigger) return;
    const open = !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  function bindQuickCreateMenu() {
    const trigger = document.getElementById('btnQuickCreateMenu');
    const btnSingle = document.getElementById('btnQuickCreateSingle');
    const btnBatch = document.getElementById('btnQuickCreateBatch');
    const btnFolder = document.getElementById('btnQuickCreateFolder');
    const btnManageFolders = document.getElementById('btnQuickManageFolders');
    if (trigger && trigger.dataset.bound !== '1') {
      trigger.dataset.bound = '1';
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        window.toggleQuickCreateMenu();
      });
    }
    if (btnSingle && btnSingle.dataset.bound !== '1') {
      btnSingle.dataset.bound = '1';
      btnSingle.addEventListener('click', function () {
        window.closeQuickCreateMenu();
        window.quickAdd('single');
      });
    }
    if (btnBatch && btnBatch.dataset.bound !== '1') {
      btnBatch.dataset.bound = '1';
      btnBatch.addEventListener('click', function () {
        window.closeQuickCreateMenu();
        window.quickAdd('batch');
      });
    }
    if (btnFolder && btnFolder.dataset.bound !== '1') {
      btnFolder.dataset.bound = '1';
      btnFolder.addEventListener('click', function () {
        window.closeQuickCreateMenu();
        window.quickOpenCreateFolder();
      });
    }
    if (btnManageFolders && btnManageFolders.dataset.bound !== '1') {
      btnManageFolders.dataset.bound = '1';
      btnManageFolders.addEventListener('click', function () {
        window.closeQuickCreateMenu();
        window.quickArianeManageGroups();
      });
    }
    if (!window._quickCreateMenuDocBound) {
      window._quickCreateMenuDocBound = true;
      document.addEventListener('click', function (e) {
        const menu = document.getElementById('quickCreateMenu');
        if (!menu || !menu.classList.contains('open')) return;
        if (menu.contains(e.target)) return;
        window.closeQuickCreateMenu();
      });
    }
  }

  /**
   * Ouvre le modal de création Rapide (même flux que Synchrotron / FAB).
   * @param {'single'|'batch'} [mode]
   */
  window.quickAdd = function (mode) {
    ensure();
    const m = mode === 'batch' ? 'batch' : 'single';
    const go = function () {
      const opts = {};
      if (Q.mat) opts.mat = Q.mat;
      if (Q.nav.group && Q.nav.group !== UNGROUPED) opts.groupId = Q.nav.group;
      window._cardCreateOpts = opts;
      window._quickCreateMode = m;
      window._quickCreateCount = 0;
      if (typeof window.closeQuickCreateMenu === 'function') window.closeQuickCreateMenu();
      if (typeof window.ankiV2OpenQuickModal === 'function') {
        window.ankiV2OpenQuickModal(Object.assign({ mode: m }, opts));
        return;
      }
      if (typeof window.openQuickCardCreate === 'function') {
        window.openQuickCardCreate(m);
        return;
      }
      if (typeof window.sysAlert === 'function') {
        window.sysAlert('Module Anki non chargé.', 'Erreur');
      }
    };
    const load = typeof window.ensureAnkiUi === 'function'
      ? window.ensureAnkiUi()
      : (typeof window.ensureScriptsForTab === 'function'
        ? window.ensureScriptsForTab('ankiV2')
        : Promise.resolve());
    Promise.resolve(load).then(function () {
      if (typeof window.ankiV2OpenQuickModal === 'function') {
        go();
        return;
      }
      if (typeof window.ensureScriptsForTab === 'function') {
        return window.ensureScriptsForTab('ankiV2').then(function () {
          if (typeof window.ankiV2OpenQuickModal === 'function') go();
          else if (typeof window.openQuickCardCreate === 'function') window.openQuickCardCreate(m);
          else if (typeof window.sysAlert === 'function') {
            window.sysAlert('Module Anki non chargé.', 'Erreur');
          }
        });
      }
      if (typeof window.openQuickCardCreate === 'function') window.openQuickCardCreate(m);
      else if (typeof window.sysAlert === 'function') {
        window.sysAlert('Module Anki non chargé.', 'Erreur');
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Rapide] quickAdd', err);
      }
      if (typeof window.ankiV2OpenQuickModal !== 'function'
          && typeof window.sysAlert === 'function') {
        window.sysAlert('Module Anki non chargé.', 'Erreur');
      }
    });
  };

  /** Alias : ouvre le modal puis l’éditeur LaTeX (rétrocompat). */
  window.quickOpenLatex = function (side) {
    ensure();
    const go = function () {
      if (typeof window.openQuickCardCreate === 'function') {
        window.openQuickCardCreate('single');
      } else if (typeof window.ankiV2OpenQuickModal === 'function') {
        window.ankiV2OpenQuickModal({ mat: Q.mat || undefined });
      }
      const openLatex = function () {
        if (typeof window.ankiV2QuickOpenLatex === 'function') {
          window.ankiV2QuickOpenLatex(side || 'both');
        }
      };
      setTimeout(openLatex, 0);
    };
    if (typeof window.ensureScriptsForTab === 'function') {
      window.ensureScriptsForTab('ankiV2').then(go).catch(function () {
        if (typeof window.sysAlert === 'function') {
          window.sysAlert('Module Anki non chargé.', 'Erreur');
        }
      });
    } else go();
  };

  window.renderFlashcards = function () {
    ensure();
    const root = $("paneFlashcards");
    if (!root) return;
    const inGroup = !!Q.nav.group;
    const navGroup = groupNavMeta(Q.nav.group);

    root.innerHTML = `
      <div class="quick-pane-toolbar">
        <div class="quick-head">
          <h2>${window.iconLabel('zap', 'Rapide — cartes Y-')}</h2>
          <p>Choisis un <b>dossier</b> dans le fil d’Ariane, puis révise ou crée des cartes. Nouvelle carte → <b>active directement</b>.</p>
        </div>
        <div class="quick-toolbar-actions">
          <div class="cours-create-menu" id="quickCreateMenu">
            <button type="button" class="cours-create-trigger" id="btnQuickCreateMenu"
              aria-expanded="false" aria-haspopup="true" title="Créer une carte rapide">
              <span data-icon="plus" data-icon-size="14"></span>
              Créer
              <span class="cours-create-chevron" data-icon="chevron-down" data-icon-size="12"></span>
            </button>
            <div class="cours-create-dropdown" role="menu">
              <button type="button" class="cours-create-item" id="btnQuickCreateSingle" role="menuitem">
                <strong><span data-icon="zap" data-icon-size="14"></span> Créer une</strong>
                <span class="hint">1 carte rapide — ferme après création</span>
              </button>
              <button type="button" class="cours-create-item" id="btnQuickCreateBatch" role="menuitem">
                <strong><span data-icon="layers" data-icon-size="14"></span> Créer à la suite</strong>
                <span class="hint">Enchaîne plusieurs cartes (même dossier)</span>
              </button>
              <div class="cours-create-sep" role="separator"></div>
              <button type="button" class="cours-create-item" id="btnQuickCreateFolder" role="menuitem">
                <strong><span data-icon="folder" data-icon-size="14"></span> Créer un dossier</strong>
                <span class="hint">Classer tes cartes Y- par matière</span>
              </button>
              <button type="button" class="cours-create-item" id="btnQuickManageFolders" role="menuitem">
                <strong><span data-icon="folder" data-icon-size="14"></span> Gérer les dossiers</strong>
                <span class="hint">Renommer, couleurs, ordre</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      ${inGroup ? `
      <div class="quick-filters quick-filters--in-group">
        <div class="search-field">
          ${window.iconHtml('search', 14, 'icon-sm')}
          <input type="text" id="qkSearch" placeholder="Filtrer dans ${esc(navGroup.name)}..." oninput="window.quickFilter()">
        </div>
        <div class="quick-drill-bar" id="qkDrillBar">
          ${renderToolbarDrillOpts()}
          <button type="button" class="bp" onclick="window.quickStartAll()">${window.iconLabel('play', 'Réviser ce groupe')}</button>
        </div>
      </div>` : ''}

      <div id="qkSections" class="quick-bc-root"></div>
    `;
    renderQuickAriane();
    bindQuickCreateMenu();
    if (window.hydrateIcons) window.hydrateIcons(root);
  };

  window.quickFilter = function () { renderQuickAriane(); };

  window.quickArianeReset = function () {
    Q.nav.group = '';
    window.renderFlashcards();
  };

  window.quickArianePickGroup = function (groupKey) {
    Q.nav.group = groupKey || '';
    window.renderFlashcards();
  };

  window.quickOpenCreateFolder = function () {
    window.quickOpenGroupsModal({ focusAdd: true, focusMat: Q.mat || '', mode: 'create' });
  };

  window.quickArianeManageGroups = function () {
    window.quickOpenGroupsModal({ mode: 'manage', focusMat: Q.mat || '' });
  };

  window.quickActivate = function (id) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : activation de carte indisponible.')) {
      return;
    }
    const c = window.AnkiAlgo.findCard(window.D, id);
    if (!c || !window.AnkiAlgo.isReservoir(c)) return;
    window.AnkiAlgo.activateFromReservoir(c);
    window.save();
    renderQuickAriane();
  };

  window.quickActivateMat = function (matId) {
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : activation de carte indisponible.')) {
      return;
    }
    getFiltered().filter(c => c.mat === matId && window.AnkiAlgo.isReservoir(c)).forEach(c => {
      window.AnkiAlgo.activateFromReservoir(c);
    });
    window.save();
    renderQuickAriane();
  };

  function getFiltered() {
    if (!Q.nav.group) return [];
    const q = ($("qkSearch") && $("qkSearch").value || '').toLowerCase().trim();
    let list = allQuickCards();
    if (Q.nav.group === UNGROUPED) list = list.filter(c => !c.groupId);
    else list = list.filter(c => c.groupId === Q.nav.group);
    if (q) {
      list = list.filter(c =>
        (c.question + ' ' + (c.reponse || '') + ' ' + (c.titre || '') + ' ' + c.id)
          .toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
    return list;
  }

  function quickCardStats(c) {
    if (window.cardAlgoStatsLine) return window.cardAlgoStatsLine(c);
    return '';
  }

  function coursChip(c) {
    const ids = c.coursIds || (c.coursId ? [c.coursId] : []);
    if (!ids.length) return '';
    const labels = ids.map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      return co ? co.uid : uid;
    });
    return `<span class="anki-tag qk-cours-chip" title="Chapitre(s) lié(s)">${esc(labels.join(', '))}</span>`;
  }

  function renderCard(c) {
    const m = matInfo(c.mat);
    const inRes = window.AnkiAlgo.isReservoir(c);
    const typeCls = window.cardTypeSurfaceClass ? window.cardTypeSurfaceClass('quick') : '';
    const typeBadge = window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml('quick') : '';
    const isMath = faceNeedsMath(c.question) || faceNeedsMath(c.reponse);
    return `
      <div class="qk-card ${typeCls}${inRes ? ' qk-reservoir' : ''}${isMath ? ' qk-card--math' : ''}" onclick="this.classList.toggle('flipped')">
        <div class="qk-inner">
          <div class="qk-front">
            <div class="qk-top">
              ${typeBadge}
              <span class="qk-mat" style="background:${m.color};">${esc(m.label)}</span>
              <span class="qk-id">${c.id}</span>
              ${coursChip(c)}
              ${inRes ? `<span class="anki-tag" style="background:rgba(255,170,51,.15);color:var(--gold);">Ancien réservoir</span>` : ''}
            </div>
            <div class="qk-q" data-card-face-id="${escAttr(c.id)}" data-card-face-side="q">${formatFace(c.question)}</div>
            <div class="qk-foot">
              <span class="anki-mut">${window.iconLabel('zap', 'Rapide')}</span>
              <span class="qk-actions" onclick="event.stopPropagation();">
                ${inRes ? `<button class="bs" onclick="window.quickActivate('${c.id}')">${window.iconLabel('zap', 'Activer')}</button>` : window.iconBtn('play', 'Réviser', `onclick="window.startAnkiSingle('${c.id}')"`)}
                ${typeof window.iconEditBtn === 'function' ? window.iconEditBtn(`window.editExo('${c.id}')`) : window.iconBtn('pencil', 'Modifier', `onclick="window.editExo('${c.id}')"`)}
                ${typeof window.iconDeleteBtn === 'function' ? window.iconDeleteBtn(`window.delExo('${c.id}')`) : `<button class="cbt icon-only-btn" aria-label="Supprimer" title="Supprimer" style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${c.id}')">${window.iconHtml('trash-2', 16, 'icon-sm')}</button>`}
              </span>
            </div>
            <div class="anki-card-stats qk-stats">${quickCardStats(c)}</div>
          </div>
          <div class="qk-back">
            <div class="qk-r" data-card-face-id="${escAttr(c.id)}" data-card-face-side="r">${c.reponse ? formatFace(c.reponse) : '<em style="color:var(--mut);">Pas de réponse — auto-évaluation libre</em>'}</div>
          </div>
        </div>
      </div>
    `;
  }

  function splitActiveReservoir(cards) {
    const active = [];
    const reservoir = [];
    cards.forEach(c => {
      if (window.AnkiAlgo.isReservoir(c)) reservoir.push(c);
      else if (c.statut === 'actif') active.push(c);
    });
    return { active, reservoir };
  }

  function renderBucketBody(split, activateMatId) {
    if (!split.active.length && !split.reservoir.length) {
      return '<div class="cours-bc-empty">Aucune carte dans ce groupe.</div>';
    }
    return `
      ${split.reservoir.length ? `
        <div class="quick-reservoir-block">
          <div class="quick-reservoir-hdr">
            <span>${window.iconLabel('hourglass', 'Réservoir Y-')}</span>
            ${activateMatId ? `<button class="bs" onclick="event.stopPropagation();window.quickActivateMat('${esc(activateMatId)}')">${window.iconLabel('zap', 'Activer toute la matière')}</button>` : ''}
          </div>
          <div class="quick-grid">${split.reservoir.map(renderCard).join('')}</div>
        </div>` : ''}
      ${split.active.length ? `
        <div class="quick-active-block">
          <p class="anki-mut" style="font-size:11px;margin:8px 0;">${window.iconLabel('play', 'Actives')}</p>
          <div class="quick-grid">${split.active.map(renderCard).join('')}</div>
        </div>` : ''}
    `;
  }

  function renderQuickArianeBreadcrumb() {
    const chev = window.iconHtml ? window.iconHtml('chevron-right', 14) : '›';
    const nav = Q.nav;
    let crumbs = `<button type="button" class="cours-bc-crumb${!nav.group ? ' is-current' : ''}" onclick="window.quickArianeReset()">${window.iconLabel('zap', 'Rapide')}</button>`;
    if (nav.group) {
      const g = groupNavMeta(nav.group);
      crumbs += `<span class="cours-bc-sep" aria-hidden="true">${chev}</span>`;
      crumbs += `<span class="cours-bc-crumb is-current">${esc(g.name)}</span>`;
    }
    return `<nav class="cours-bc-bar" aria-label="Fil d’Ariane Rapide">${crumbs}</nav>`;
  }

  function renderQuickArianeRoot() {
    const sections = groupsByMat();
    const noneStats = countGroupCards(UNGROUPED);
    const hasGroups = sections.some(sec => sec.groups.length > 0);

    let bodyHtml = '';
    if (hasGroups) {
      bodyHtml += (
        '<div class="cours-bc-level-head">' +
          '<h3 class="cours-bc-level-title">Choisir un dossier</h3>' +
          '<p class="cours-bc-level-sub anki-mut">Classés par matière · puis révise ou ajoute des cartes.</p>' +
        '</div>'
      );
      bodyHtml += sections.map(sec => {
        const m = sec.mat;
        const tiles = sec.groups.map(g => {
          const stats = countGroupCards(g.id);
          return (
            `<button type="button" class="cours-bc-tile" style="--mat-color:${esc(g.color || m.color)}" onclick="window.quickArianePickGroup('${jsStr(g.id)}')">` +
              `<span class="cours-bc-tile-name">${esc(g.name)}</span>` +
              `<span class="cours-bc-tile-meta">${stats.active} active${stats.active > 1 ? 's' : ''}` +
                (stats.reservoir ? ` · ${stats.reservoir} réservoir` : '') +
              `</span>` +
            `</button>`
          );
        }).join('');
        return (
          `<section class="quick-group-section">` +
            `<div class="anki-lib-group-hdr" style="border-left:4px solid ${esc(m.color)};">` +
              `<span class="anki-lib-grp-mat" style="background:${esc(m.color)}20;color:${esc(m.color)};">${esc(m.label || m.id)}</span>` +
              `<span class="anki-lib-grp-t">${esc(m.name || m.id)}</span>` +
              `<span class="anki-mut" style="margin-left:auto;">${sec.groups.length} dossier${sec.groups.length > 1 ? 's' : ''}</span>` +
            `</div>` +
            `<div class="cours-bc-grid">${tiles}</div>` +
          `</section>`
        );
      }).join('');
    }

    if (noneStats.total) {
      bodyHtml += (
        `<section class="quick-group-section quick-group-section--orphan">` +
          `<div class="anki-lib-group-hdr" style="border-left:4px solid #6a7088;">` +
            `<span class="anki-lib-grp-mat" style="background:#6a708820;color:#9aa3b8;">Sans dossier</span>` +
          `</div>` +
          `<div class="cours-bc-grid">` +
            `<button type="button" class="cours-bc-tile" style="--mat-color:#6a7088" onclick="window.quickArianePickGroup('${jsStr(UNGROUPED)}')">` +
              `<span class="cours-bc-tile-name">Cartes non classées</span>` +
              `<span class="cours-bc-tile-meta">${noneStats.active} active${noneStats.active > 1 ? 's' : ''}` +
                (noneStats.reservoir ? ` · ${noneStats.reservoir} réservoir` : '') +
              `</span>` +
            `</button>` +
          `</div>` +
        `</section>`
      );
    }

    if (!hasGroups && !noneStats.total) {
      bodyHtml = (
        '<div class="cours-bc-empty">' +
          'Aucune carte Y- pour l’instant. Utilise <b>Créer</b> pour ajouter une carte ou un dossier.' +
        '</div>'
      );
    } else if (!hasGroups && noneStats.total) {
      bodyHtml = (
        '<div class="cours-bc-level-head">' +
          '<h3 class="cours-bc-level-title">Cartes sans dossier</h3>' +
          '<p class="cours-bc-level-sub anki-mut">Crée des dossiers via <b>Créer → Créer un dossier</b>.</p>' +
        '</div>' + bodyHtml
      );
    }

    return bodyHtml;
  }

  function renderQuickArianeGroupBody() {
    const g = groupNavMeta(Q.nav.group);
    const list = getFiltered();
    const split = splitActiveReservoir(list);
    const allInGroup = Q.nav.group === UNGROUPED
      ? allQuickCards().filter(c => !c.groupId)
      : allQuickCards().filter(c => c.groupId === Q.nav.group);
    const totalSplit = splitActiveReservoir(allInGroup);

    return (
      '<div class="cours-bc-level-head">' +
        `<h3 class="cours-bc-level-title">${esc(g.name)}</h3>` +
        `<p class="cours-bc-level-sub anki-mut">${totalSplit.active.length} active${totalSplit.active.length > 1 ? 's' : ''}` +
          (totalSplit.reservoir ? ` · ${totalSplit.reservoir} réservoir` : '') +
        '</p>' +
      '</div>' +
      renderBucketBody(split, null)
    );
  }

  function renderQuickAriane() {
    const host = $("qkSections");
    if (!host) return;

    if (Q.nav.group) {
      const g = groupInfo(Q.nav.group);
      if (Q.nav.group !== UNGROUPED && !g) {
        Q.nav.group = '';
        return renderQuickAriane();
      }
    }

    const body = Q.nav.group ? renderQuickArianeGroupBody() : renderQuickArianeRoot();
    host.innerHTML =
      '<div class="cours-bc-page quick-bc-page">' +
        renderQuickArianeBreadcrumb() +
        '<div class="cours-bc-body">' + body + '</div>' +
      '</div>';

    if (window.hydrateIcons) window.hydrateIcons(host);
    if (Q.nav.group && typeof window.hydrateQuickCardFaces === 'function') {
      var hyd = window.hydrateQuickCardFaces(host);
      if (hyd && typeof hyd.then === 'function') {
        hyd.then(function () { fitQuickCardFaces(host); });
      } else {
        fitQuickCardFaces(host);
      }
    } else {
      fitQuickCardFaces(host);
    }
  }

  /* ===== Gestion des dossiers ===== */

  function renderGroupsModalSection(sec) {
    const mat = sec.mat;
    const matId = mat.id || '';
    const groups = groupsForMat(matId);
    const manage = Q.groupsModalMode === 'manage';
    const rows = groups.map(function (g) {
      const globalIdx = sortedGroups().findIndex(x => x.id === g.id);
      const canUp = globalIdx > 0 && inferGroupMat(sortedGroups()[globalIdx - 1]) === matId;
      const canDown = globalIdx >= 0 && globalIdx < sortedGroups().length - 1
        && inferGroupMat(sortedGroups()[globalIdx + 1]) === matId;
      if (manage) {
        return `
        <div class="qk-group-row" data-gid="${esc(g.id)}">
          <div class="qk-group-row-main">
            <input type="text" class="fi qk-group-name" value="${esc(g.name)}" data-gid="${esc(g.id)}" aria-label="Nom du dossier" maxlength="40">
            ${renderGroupColorDots(g.id, g.color)}
          </div>
          <div class="qk-group-actions">
            <button type="button" class="bs qk-group-move" title="Monter" ${!canUp ? 'disabled' : ''} onclick="window.quickMoveGroup('${esc(g.id)}', -1)">${window.iconHtml ? window.iconHtml('chevron-up', 14, 'icon-sm') : '↑'}</button>
            <button type="button" class="bs qk-group-move" title="Descendre" ${!canDown ? 'disabled' : ''} onclick="window.quickMoveGroup('${esc(g.id)}', 1)">${window.iconHtml ? window.iconHtml('chevron-down', 14, 'icon-sm') : '↓'}</button>
            <button type="button" class="bs qk-group-del" title="Supprimer" onclick="window.quickDeleteGroup('${esc(g.id)}')">${window.iconHtml ? window.iconHtml('trash-2', 14, 'icon-sm') : '×'}</button>
          </div>
        </div>`;
      }
      return `
        <div class="qk-group-row qk-group-row--readonly" data-gid="${esc(g.id)}">
          <div class="qk-group-row-main qk-group-row-main--readonly">
            ${renderGroupColorReadonly(g.color)}
            <span class="qk-group-name-ro">${esc(g.name)}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <section class="qk-groups-mat-block" data-mat="${esc(matId)}">
        <div class="anki-lib-group-hdr qk-groups-mat-hdr" style="border-left:4px solid ${esc(mat.color)};">
          <span class="anki-lib-grp-mat" style="background:${esc(mat.color)}20;color:${esc(mat.color)};">${esc(mat.label || matId || '?')}</span>
          <span class="anki-lib-grp-t">${esc(mat.name || matId || 'Autre')}</span>
          <span class="anki-mut" style="margin-left:auto;">${groups.length} dossier${groups.length > 1 ? 's' : ''}</span>
        </div>
        ${rows || '<p class="anki-mut qk-groups-empty">Aucun dossier pour cette matière.</p>'}
      </section>`;
  }

  function selectedGroupsMatId() {
    const mats = window.D.matieres || [];
    const want = Q.groupsModalFocusMat || Q.mat || '';
    if (want && mats.some(m => m.id === want)) return want;
    return (mats[0] && mats[0].id) || '';
  }

  function renderGroupsMatSelect(selectedId) {
    const mats = window.D.matieres || [];
    return `<select id="qkNewGroupMat" class="fi qk-new-group-mat" aria-label="Matière du dossier" onchange="window.quickGroupsMatChanged(this.value)">` +
      mats.map(function (m) {
        return `<option value="${esc(m.id)}"${m.id === selectedId ? ' selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`;
      }).join('') +
      `</select>`;
  }

  function renderGroupsModalBody() {
    const mats = (window.D.matieres || []).slice();
    if (!mats.length) {
      return '<p class="anki-mut" style="font-size:13px;">Aucune matière configurée.</p>';
    }
    const matId = selectedGroupsMatId();
    const mat = mats.find(m => m.id === matId) || mats[0];
    if (!Q.newGroupColor) Q.newGroupColor = defaultGroupColor(mat.id);
    return `
      <div class="qk-group-create">
        <label class="qk-group-create-lbl" for="qkNewGroupMat">Matière</label>
        ${renderGroupsMatSelect(mat.id)}
        <label class="qk-group-create-lbl" for="qkNewGroupName">Nouveau dossier</label>
        <div class="qk-group-add-inline">
          <input type="text" id="qkNewGroupName" class="fi qk-new-group-name" placeholder="Nom du dossier…" maxlength="40" autocomplete="off">
          <button type="button" class="bp qk-group-add-btn" onclick="window.quickAddGroup()">${window.iconLabel('plus', 'Ajouter')}</button>
        </div>
        <label class="qk-group-create-lbl">Couleur</label>
        ${renderGroupColorDots('new', Q.newGroupColor, { forNew: true })}
      </div>
      <div class="qk-groups-sections">
        ${renderGroupsModalSection({ mat: mat, groups: groupsForMat(mat.id) })}
      </div>`;
  }

  function refreshGroupsModalBody() {
    const body = $('qkGroupsBody');
    if (body) {
      const keepName = ($('qkNewGroupName') && $('qkNewGroupName').value) || '';
      const keepColor = Q.newGroupColor;
      body.innerHTML = renderGroupsModalBody();
      if (keepColor) Q.newGroupColor = keepColor;
      if (window.hydrateIcons) window.hydrateIcons(body);
      bindGroupsModalInputs();
      const nameEl = $('qkNewGroupName');
      if (nameEl && keepName) nameEl.value = keepName;
      // Re-sync color dots after HTML rebuild with preserved color
      if (keepColor) {
        body.querySelectorAll('.qk-group-create .qk-color-dot').forEach(function (btn) {
          const on = btn.getAttribute('data-color') === keepColor;
          btn.classList.toggle('is-on', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
    }
  }

  function bindGroupsModalInputs() {
    const nameEl = $('qkNewGroupName');
    if (!nameEl || nameEl.dataset.bound === '1') return;
    nameEl.dataset.bound = '1';
    nameEl.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        window.quickAddGroup();
      }
    };
  }

  window.quickGroupsMatChanged = function (matId) {
    Q.groupsModalFocusMat = matId || '';
    Q.mat = matId || Q.mat;
    Q.newGroupColor = defaultGroupColor(matId);
    refreshGroupsModalBody();
    const nameEl = $('qkNewGroupName');
    if (nameEl) nameEl.focus();
  };

  window.quickPickNewGroupColor = function (color) {
    if (!color) return;
    Q.newGroupColor = color;
    const body = $('qkGroupsBody');
    if (!body) return;
    body.querySelectorAll('.qk-group-create .qk-color-dot').forEach(function (btn) {
      const on = btn.getAttribute('data-color') === color;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  window.quickPickGroupColor = function (gid, color) {
    const g = groupInfo(gid);
    if (!g || !color) return;
    g.color = color;
    refreshGroupsModalBody();
  };

  window.quickOpenGroupsModal = function (opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    ensure();
    Q.groupsModalFocusMat = opts.focusMat || Q.mat || selectedGroupsMatId();
    Q.groupsModalFocusAdd = !!opts.focusAdd;
    Q.groupsModalMode = opts.mode === 'manage' || (!opts.focusAdd && opts.mode !== 'create')
      ? 'manage'
      : 'create';
    // Créer un dossier → create ; Gérer les dossiers → manage
    if (opts.mode === 'create' || opts.focusAdd) Q.groupsModalMode = 'create';
    if (opts.mode === 'manage') Q.groupsModalMode = 'manage';
    Q.newGroupColor = defaultGroupColor(Q.groupsModalFocusMat);
    let ov = $('ovQuickGroups');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovQuickGroups';
      ov.className = 'ov ov-scroll';
      document.body.appendChild(ov);
    }
    ov.classList.remove('hidden');
    const intro = Q.groupsModalMode === 'manage'
      ? 'Renomme, change la couleur, réordonne ou supprime tes dossiers.'
      : 'Choisis la matière, le nom et la couleur, puis ajoute le dossier.';
    const title = Q.groupsModalMode === 'manage'
      ? window.iconLabel('folder', 'Gérer les dossiers')
      : window.iconLabel('folder', 'Nouveau dossier');
    ov.innerHTML = `
      <div class="modal qk-groups-modal">
        <h2>${title}</h2>
        <p class="anki-mut qk-groups-intro">${intro}</p>
        <div id="qkGroupsBody">${renderGroupsModalBody()}</div>
        <div class="macts">
          <button type="button" class="bs" onclick="window.quickCloseGroupsModal()">Fermer</button>
          <button type="button" class="bp" onclick="window.quickSaveGroupsModal()">Enregistrer</button>
        </div>
      </div>`;
    if (window.hydrateIcons) window.hydrateIcons(ov);
    bindGroupsModalInputs();

    const nameEl = $('qkNewGroupName');
    if (nameEl && (Q.groupsModalFocusAdd || Q.groupsModalMode === 'create')) {
      try { nameEl.focus(); } catch (e) { /* ignore */ }
    }
    Q.groupsModalFocusAdd = false;
  };

  window.quickCloseGroupsModal = function () {
    const ov = $('ovQuickGroups');
    if (ov) ov.classList.add('hidden');
  };

  window.quickAddGroup = function (matId) {
    ensure();
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : création de dossier indisponible.')) {
      return;
    }
    const matSel = $('qkNewGroupMat');
    const mat = matId
      || (matSel && matSel.value)
      || Q.groupsModalFocusMat
      || Q.mat
      || ((window.D.matieres || [])[0] && window.D.matieres[0].id)
      || '';
    const el = $('qkNewGroupName');
    const name = (el && el.value || '').trim();
    if (!name) {
      if (typeof window.showToast === 'function') window.showToast('Indique un nom de dossier.', { type: 'error' });
      if (el) el.focus();
      return;
    }
    if (!mat) {
      if (typeof window.showToast === 'function') window.showToast('Choisis une matière.', { type: 'error' });
      if (matSel) matSel.focus();
      return;
    }
    Q.groupsModalFocusMat = mat;
    const id = genGroupId();
    window.D.quickGroups.push({
      id,
      name,
      color: Q.newGroupColor || defaultGroupColor(mat),
      order: groupsForMat(mat).length,
      mat: mat
    });
    if (el) el.value = '';
    Q.newGroupColor = defaultGroupColor(mat);
    refreshGroupsModalBody();
    if (typeof window.showToast === 'function') window.showToast('Dossier « ' + name + ' » créé.', { type: 'ok' });
    const again = $('qkNewGroupName');
    if (again) again.focus();
  };

  window.quickMoveGroup = function (id, delta) {
    ensure();
    const g = groupInfo(id);
    if (!g) return;
    const mat = inferGroupMat(g);
    const groups = groupsForMat(mat);
    const idx = groups.findIndex(x => x.id === id);
    if (idx < 0) return;
    const j = idx + delta;
    if (j < 0 || j >= groups.length) return;
    const tmp = groups[idx];
    groups[idx] = groups[j];
    groups[j] = tmp;
    groups.forEach((x, i) => { x.order = i; x.mat = mat; });
    refreshGroupsModalBody();
  };

  window.quickDeleteGroup = function (id) {
    ensure();
    const g = groupInfo(id);
    if (!g) return;
    const count = (window.D.exercices || []).filter(c => isQuickCard(c) && c.groupId === id).length;
    const msg = count
      ? 'Supprimer le dossier « ' + g.name + ' » ? ' + count + ' carte(s) passeront en « Sans dossier ».'
      : 'Supprimer le dossier « ' + g.name + ' » ?';
    const doDel = function () {
      window.D.quickGroups = (window.D.quickGroups || []).filter(x => x.id !== id);
      (window.D.exercices || []).forEach(c => {
        if (c && c.groupId === id) delete c.groupId;
      });
      window.D.quickGroups.forEach((x, i) => { x.order = i; });
      if (Q.nav.group === id) Q.nav.group = '';
      refreshGroupsModalBody();
    };
    if (typeof window.sysConfirm === 'function') {
      window.sysConfirm(msg, doDel, 'Dossier');
    } else {
      doDel();
    }
  };

  window.quickSaveGroupsModal = function () {
    ensure();
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : enregistrement indisponible.')) {
      return;
    }
    const ov = $('ovQuickGroups');
    if (ov) {
      ov.querySelectorAll('.qk-group-name').forEach(function (inp) {
        const gid = inp.getAttribute('data-gid');
        const g = groupInfo(gid);
        if (!g) return;
        const name = (inp.value || '').trim();
        if (name) g.name = name;
      });
    }
    window.save();
    window.quickCloseGroupsModal();
    window.renderFlashcards();
    if (typeof window.showToast === 'function') window.showToast('Dossiers enregistrés.', { type: 'ok' });
  };

  window.quickStartAll = function () {
    const list = getFiltered().filter(c => c.statut === 'actif');
    if (!list.length) return window.sysAlert("Aucune carte Y- active à réviser.", "Rapide");
    const g = groupNavMeta(Q.nav.group);
    openQuickDrill(list, (g && g.name) || 'Groupe');
  };

  /** Réviser un dossier Rapide (groupId) hors navigation courante. */
  window.quickStartGroup = function (groupKey) {
    const key = groupKey || Q.nav.group;
    if (!key) return window.sysAlert("Ouvre un dossier pour réviser un groupe.", "Rapide");
    const list = (key === UNGROUPED
      ? allQuickCards().filter(c => !c.groupId)
      : allQuickCards().filter(c => c.groupId === key)
    ).filter(c => c.statut === 'actif');
    if (!list.length) return window.sysAlert("Aucune carte Y- active dans ce groupe.", "Rapide");
    const g = groupNavMeta(key);
    openQuickDrill(list, (g && g.name) || 'Groupe');
  };

  /**
   * Compare une saisie à la face attendue.
   * Ignore casse, espaces (tous) et accents — le mot doit rester le même.
   */
  window.normalizeQuickDrillAnswer = function (s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '');
  };

  const DRILL = {
    phase: 'setup',
    label: '',
    pool: [],
    queue: [],
    idx: 0,
    random: true,
    swap: false,
    typeMode: false,
    revealed: false,
    typed: '',
    check: null,
    results: {},
    _bound: false
  };

  function readDrillPrefs() {
    const st = (window.D && window.D.settings && window.D.settings.ankiQuickDrill) || {};
    DRILL.random = st.random !== false;
    DRILL.swap = st.swap === true;
    DRILL.typeMode = st.typeMode === true;
  }

  function persistDrillPrefs() {
    if (!window.D) return;
    if (!window.D.settings) window.D.settings = {};
    window.D.settings.ankiQuickDrill = {
      random: !!DRILL.random,
      swap: !!DRILL.swap,
      typeMode: !!DRILL.typeMode
    };
    if (typeof window.save === 'function') {
      try { window.save(); } catch (e) { /* prefs locales */ }
    }
  }

  function shuffleCards(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function drillLiveCard() {
    return DRILL.queue[DRILL.idx] || null;
  }

  function drillFaces(c) {
    const q = (c && c.question) || '';
    const r = (c && c.reponse) || '';
    if (DRILL.swap) return { prompt: r || q, expected: r ? q : '', swapped: true, empty: !r };
    return { prompt: q, expected: r, swapped: false, empty: !r };
  }

  function expectedLooksLikeLatex(s) {
    return /\\[a-zA-Z[{]|\\\(|\\\[/.test(String(s || ''));
  }

  function drillCounts() {
    let ok = 0, bad = 0;
    Object.keys(DRILL.results).forEach(function (id) {
      if (DRILL.results[id] === 'ok') ok++;
      else if (DRILL.results[id] === 'bad') bad++;
    });
    return { ok: ok, bad: bad, done: ok + bad, total: DRILL.queue.length };
  }

  function ensureDrillOverlay() {
    let ov = document.getElementById('ovQuickDrill');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovQuickDrill';
      ov.className = 'ov hidden';
      ov.innerHTML = '<div class="modal qk-drill-modal" id="qkDrillRoot" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(ov);
    }
    if (!DRILL._bound) {
      DRILL._bound = true;
      ov.addEventListener('click', function (e) {
        if (e.target === ov) window.quickDrillClose();
      });
      document.addEventListener('keydown', function (e) {
        if (ov.classList.contains('hidden')) return;
        if (e.key !== 'Escape') return;
        // Laisser le dialogue système (confirm / alert) gérer Escape en priorité
        const sys = document.getElementById('ovSysDialog');
        if (sys && !sys.classList.contains('hidden')) return;
        e.preventDefault();
        window.quickDrillClose();
      });
    }
    return ov;
  }

  function openQuickDrill(cards, label) {
    readDrillPrefs();
    DRILL.pool = cards.slice();
    DRILL.label = label || 'Groupe';
    buildDrillQueue(DRILL.pool);
    DRILL.phase = 'card';
    const ov = ensureDrillOverlay();
    ov.classList.remove('hidden');
    renderDrill();
  }

  function buildDrillQueue(subset) {
    const src = subset && subset.length ? subset : DRILL.pool;
    DRILL.queue = DRILL.random ? shuffleCards(src) : src.slice();
    DRILL.idx = 0;
    DRILL.results = {};
    DRILL.revealed = false;
    DRILL.typed = '';
    DRILL.check = null;
  }

  function optChip(on, icon, label, onclick) {
    return `<button type="button" class="qk-drill-chip${on ? ' on' : ''}" onclick="${onclick}">${window.iconLabel(icon, label)}</button>`;
  }

  function renderToolbarDrillOpts() {
    readDrillPrefs();
    return `
      <div class="qk-drill-opts qk-drill-opts--toolbar" role="group" aria-label="Options de révision">
        ${optChip(DRILL.random, 'shuffle', 'Aléatoire', "window.quickDrillToggle('random')")}
        ${optChip(DRILL.swap, 'arrow-left-right', DRILL.swap ? 'Verso → recto' : 'Recto → verso', "window.quickDrillToggle('swap')")}
        ${optChip(DRILL.typeMode, 'keyboard', 'Écrire', "window.quickDrillToggle('type')")}
      </div>`;
  }

  function refreshToolbarDrillOpts() {
    const bar = document.getElementById('qkDrillBar');
    if (!bar) return;
    const btn = bar.querySelector('button.bp');
    const btnHtml = btn ? btn.outerHTML : `<button type="button" class="bp" onclick="window.quickStartAll()">${window.iconLabel('play', 'Réviser ce groupe')}</button>`;
    bar.innerHTML = renderToolbarDrillOpts() + btnHtml;
    if (window.hydrateIcons) window.hydrateIcons(bar);
  }

  function renderDrill() {
    const root = document.getElementById('qkDrillRoot');
    const ov = document.getElementById('ovQuickDrill');
    if (!root || !ov || ov.classList.contains('hidden')) return;

    let body = '';
    if (DRILL.phase === 'done') {
      const cts = drillCounts();
      const missed = DRILL.queue.filter(function (c) { return DRILL.results[c.id] === 'bad'; });
      body = `
        <h2 id="qkDrillTitle">${window.iconLabel('target', 'Bilan')}</h2>
        <p class="qk-drill-sub">${esc(DRILL.label)}</p>
        <div class="qk-drill-score">
          <div class="qk-drill-score-ok"><b>${cts.ok}</b><span>juste${cts.ok > 1 ? 's' : ''}</span></div>
          <div class="qk-drill-score-bad"><b>${cts.bad}</b><span>ratée${cts.bad > 1 ? 's' : ''}</span></div>
        </div>
        <div class="qk-drill-acts qk-drill-acts-col">
          <button type="button" class="bp" onclick="window.quickDrillRetry('all')">${window.iconLabel('refresh-cw', 'Tout revoir')}</button>
          <button type="button" class="bs" ${missed.length ? '' : 'disabled'} onclick="window.quickDrillRetry('missed')">${window.iconLabel('circle-x', 'Revoir les ratées' + (missed.length ? ' (' + missed.length + ')' : ''))}</button>
          <button type="button" class="bs" onclick="window.quickDrillClose()">Fermer</button>
        </div>
      `;
    } else {
      const c = drillLiveCard();
      if (!c) {
        DRILL.phase = 'done';
        return renderDrill();
      }
      const faces = drillFaces(c);
      const cts = drillCounts();
      const canType = DRILL.typeMode && faces.expected && !expectedLooksLikeLatex(faces.expected);
      const typeBlocked = DRILL.typeMode && (!faces.expected || expectedLooksLikeLatex(faces.expected));
      body = `
        ${DRILL.check && DRILL.check.ok ? '<div class="qk-drill-ok-wash" aria-hidden="true"></div>' : ''}
        <div class="qk-drill-top">
          <h2 id="qkDrillTitle">${window.iconLabel('zap', esc(DRILL.label))}</h2>
          <button type="button" class="qk-drill-x" onclick="window.quickDrillClose()" aria-label="Quitter">${window.iconHtml('x', 18)}</button>
        </div>
        <div class="qk-drill-progress">
          <span>${DRILL.idx + 1} / ${DRILL.queue.length}</span>
          <span class="qk-drill-mini-ok">${cts.ok} juste${cts.ok > 1 ? 's' : ''}</span>
          <span class="qk-drill-mini-bad">${cts.bad} ratée${cts.bad > 1 ? 's' : ''}</span>
        </div>
        <p class="qk-drill-hint">${DRILL.swap ? 'Verso → recto (ex. EN → FR).' : 'Recto → verso (ex. FR → EN).'}${DRILL.typeMode ? ' Majuscules, espaces et accents ignorés.' : ''}</p>
        <div class="qk-drill-card">
          <div class="qk-drill-face-lbl">${faces.swapped ? 'Verso (indice)' : 'Recto'}</div>
          <div class="qk-drill-prompt">${formatFace(faces.prompt) || '<em>Face vide</em>'}</div>
        </div>
        ${typeBlocked ? '<p class="qk-drill-hint">Cette carte n’a pas de texte simple à taper — auto-évaluation.</p>' : ''}
        ${canType && !DRILL.revealed ? `
          <form class="qk-drill-type" onsubmit="window.quickDrillCheck(); return false;">
            <label for="qkDrillInput">Ta réponse</label>
            <input type="text" id="qkDrillInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Écris la réponse…" value="${escAttr(DRILL.typed)}">
            <button type="submit" class="bp">${window.iconLabel('check', 'Vérifier')}</button>
          </form>
        ` : ''}
        ${DRILL.check ? (
          DRILL.check.ok && DRILL.check.glowOnly
            ? '' /* flash vert seul — pas de texte « Juste » */
            : `<div class="qk-drill-verdict ${DRILL.check.ok ? 'ok qk-drill-verdict--hero' : 'bad'}">
            ${DRILL.check.ok
              ? `<span class="qk-drill-juste">
                   <span class="qk-drill-juste-lbl">${window.iconHtml('circle-check', 22)} Juste</span>
                   <span class="qk-drill-juste-word">${faces.expected ? formatFace(faces.expected) : esc(DRILL.check.got || '')}</span>
                 </span>`
              : window.iconLabel('circle-x', 'Raté')}
            ${DRILL.check.ok ? '' : `<div class="qk-drill-expected"><span>Attendu</span>${formatFace(faces.expected)}</div>`}
            ${!DRILL.check.ok && DRILL.check.got ? `<div class="qk-drill-got"><span>Tu as écrit</span>${esc(DRILL.check.got)}</div>` : ''}
            ${!DRILL.check.ok ? `<button type="button" class="bs qk-drill-override" onclick="window.quickDrillOverrideOk()">C’était bon (faute de frappe)</button>` : ''}
          </div>`
        ) : ''}
        ${!canType && DRILL.revealed ? `
          <div class="qk-drill-card qk-drill-answer">
            <div class="qk-drill-face-lbl">${faces.swapped ? 'Recto (réponse)' : 'Verso'}</div>
            <div class="qk-drill-prompt">${faces.expected ? formatFace(faces.expected) : '<em>Pas de réponse enregistrée</em>'}</div>
          </div>
        ` : ''}
        <div class="qk-drill-acts">
          ${canType && !DRILL.revealed
            ? `<button type="button" class="bs" onclick="window.quickDrillGiveUp()">${window.iconLabel('book-open', 'Je ne sais pas')}</button>
               <button type="button" class="bs qk-drill-quit" onclick="window.quickDrillClose()">${window.iconLabel('x', 'Quitter')}</button>`
            : (!DRILL.revealed
            ? `<button type="button" class="bp" onclick="window.quickDrillReveal()">${window.iconLabel('book-open', 'Voir la réponse')}</button>
               <button type="button" class="bs qk-drill-quit" onclick="window.quickDrillClose()">${window.iconLabel('x', 'Quitter')}</button>`
            : (DRILL.check
              ? (DRILL.check.ok
                ? (DRILL.check.glowOnly
                  ? ''
                  : `<p class="qk-drill-ok-wait" aria-live="polite">Passage automatique…</p>
                     <button type="button" class="bs qk-drill-quit" onclick="window.quickDrillClose()">${window.iconLabel('x', 'Quitter')}</button>`)
                : `<button type="button" class="bp" onclick="window.quickDrillAdvance()">${window.iconLabel('arrow-right', DRILL.idx + 1 >= DRILL.queue.length ? 'Bilan' : 'Suivante')}</button>
                   <button type="button" class="bs qk-drill-quit" onclick="window.quickDrillClose()">${window.iconLabel('x', 'Quitter')}</button>`)
              : `<button type="button" class="bs" style="border-color:var(--red);color:var(--red);" onclick="window.quickDrillMark(false)">${window.iconLabel('x', 'Raté')}</button>
                 <button type="button" class="bp" style="background:var(--grn);color:#000;" onclick="window.quickDrillMark(true)">${window.iconLabel('check', 'Je savais')}</button>
                 <button type="button" class="bs qk-drill-quit" onclick="window.quickDrillClose()">${window.iconLabel('x', 'Quitter')}</button>`))}
        </div>
      `;
    }

    root.innerHTML = body;
    root.classList.toggle('is-ok-flash', !!(DRILL.check && DRILL.check.ok));
    if (window.hydrateIcons) window.hydrateIcons(root);
    const inp = document.getElementById('qkDrillInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('input', function () { DRILL.typed = inp.value; });
    }
  }

  window.quickDrillToggle = function (which) {
    readDrillPrefs();
    if (which === 'random') DRILL.random = !DRILL.random;
    else if (which === 'swap') DRILL.swap = !DRILL.swap;
    else if (which === 'type') DRILL.typeMode = !DRILL.typeMode;
    persistDrillPrefs();
    refreshToolbarDrillOpts();
  };

  window.quickDrillBegin = function () {
    if (!DRILL.pool.length) return;
    buildDrillQueue(DRILL.pool);
    DRILL.phase = 'card';
    renderDrill();
  };

  window.quickDrillReveal = function () {
    DRILL.revealed = true;
    renderDrill();
  };

  window.quickDrillGiveUp = function () {
    const c = drillLiveCard();
    if (!c) return;
    const inp = document.getElementById('qkDrillInput');
    if (inp) DRILL.typed = inp.value;
    DRILL.revealed = true;
    DRILL.check = { ok: false, got: DRILL.typed };
    DRILL.results[c.id] = 'bad';
    renderDrill();
  };

  window.quickDrillMark = function (ok) {
    const c = drillLiveCard();
    if (!c) return;
    DRILL.results[c.id] = ok ? 'ok' : 'bad';
    if (ok) {
      DRILL.revealed = true;
      DRILL.check = { ok: true, glowOnly: true };
      renderDrill();
      scheduleOkAdvance(c, 500);
      return;
    }
    window.quickDrillAdvance();
  };

  function scheduleOkAdvance(card, ms) {
    const delay = ms != null ? ms : 2000;
    try {
      if (navigator.vibrate) navigator.vibrate(28);
    } catch (e) { /* ignore */ }
    setTimeout(function () {
      if (DRILL.phase === 'card' && drillLiveCard() === card && DRILL.check && DRILL.check.ok) {
        window.quickDrillAdvance();
      }
    }, delay);
  }

  window.quickDrillCheck = function () {
    const c = drillLiveCard();
    if (!c) return;
    const faces = drillFaces(c);
    const inp = document.getElementById('qkDrillInput');
    const got = inp ? inp.value : DRILL.typed;
    DRILL.typed = got;
    const a = window.normalizeQuickDrillAnswer(got);
    const b = window.normalizeQuickDrillAnswer(faces.expected);
    const ok = !!b && a === b;
    DRILL.check = { ok: ok, got: got };
    DRILL.revealed = true;
    DRILL.results[c.id] = ok ? 'ok' : 'bad';
    renderDrill();
    if (ok) scheduleOkAdvance(c);
  };

  window.quickDrillOverrideOk = function () {
    const c = drillLiveCard();
    if (!c) return;
    DRILL.results[c.id] = 'ok';
    DRILL.check = { ok: true, got: DRILL.typed };
    DRILL.revealed = true;
    renderDrill();
    scheduleOkAdvance(c);
  };

  window.quickDrillAdvance = function () {
    DRILL.idx += 1;
    DRILL.revealed = false;
    DRILL.typed = '';
    DRILL.check = null;
    if (DRILL.idx >= DRILL.queue.length) DRILL.phase = 'done';
    renderDrill();
  };

  window.quickDrillRetry = function (mode) {
    const missed = DRILL.queue.filter(function (c) { return DRILL.results[c.id] === 'bad'; });
    if (mode === 'missed') {
      if (!missed.length) return;
      buildDrillQueue(missed);
    } else {
      buildDrillQueue(DRILL.pool);
    }
    DRILL.phase = 'card';
    renderDrill();
  };

  window.quickDrillClose = function () {
    const ov = document.getElementById('ovQuickDrill');
    if (ov) ov.classList.add('hidden');
    DRILL.phase = 'setup';
    DRILL.queue = [];
  };
})();
