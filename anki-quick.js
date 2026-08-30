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

  function renderGroupColorDots(gid, currentColor) {
    return `<div class="qk-color-dots" role="radiogroup" aria-label="Couleur du dossier">` +
      GROUP_COLORS.map(col =>
        `<button type="button" class="qk-color-dot${currentColor === col ? ' is-on' : ''}" ` +
        `style="background:${col}" data-gid="${esc(gid)}" data-color="${col}" ` +
        `aria-label="Couleur" aria-pressed="${currentColor === col ? 'true' : 'false'}" ` +
        `onclick="window.quickPickGroupColor('${jsStr(gid)}','${col}')"></button>`
      ).join('') +
      `</div>`;
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

  function allQuickCards() {
    return (window.D.exercices || []).filter(isQuickCard);
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
    }

    var initial = collectMathNodes();
    if (!initial.length || !anyFaceNeedsMath(initial)) return Promise.resolve();

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
        window.quickOpenGroupsModal();
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
        <button class="bs" onclick="window.quickStartAll()">${window.iconLabel('play', 'Réviser ce groupe (actives)')}</button>
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
    window.quickOpenGroupsModal({ focusAdd: true, focusMat: Q.mat || '' });
  };

  window.quickArianeManageGroups = function () {
    window.quickOpenGroupsModal();
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
      window.hydrateQuickCardFaces(host);
    }
  }

  /* ===== Gestion des dossiers ===== */

  function renderGroupsModalSection(sec) {
    const mat = sec.mat;
    const matId = mat.id || '';
    const groups = groupsForMat(matId);
    const rows = groups.map((g, idx) => {
      const globalIdx = sortedGroups().findIndex(x => x.id === g.id);
      const canUp = globalIdx > 0 && inferGroupMat(sortedGroups()[globalIdx - 1]) === matId;
      const canDown = globalIdx >= 0 && globalIdx < sortedGroups().length - 1
        && inferGroupMat(sortedGroups()[globalIdx + 1]) === matId;
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
    }).join('');

    const addId = 'qkNewGroupName-' + (matId || 'other');
    return `
      <section class="qk-groups-mat-block" data-mat="${esc(matId)}">
        <div class="anki-lib-group-hdr qk-groups-mat-hdr" style="border-left:4px solid ${esc(mat.color)};">
          <span class="anki-lib-grp-mat" style="background:${esc(mat.color)}20;color:${esc(mat.color)};">${esc(mat.label || matId || '?')}</span>
          <span class="anki-lib-grp-t">${esc(mat.name || matId || 'Autre')}</span>
        </div>
        ${rows || '<p class="anki-mut qk-groups-empty">Aucun dossier pour cette matière.</p>'}
        <div class="qk-group-add-inline">
          <input type="text" id="${addId}" class="fi qk-new-group-name" data-mat="${esc(matId)}" placeholder="Nouveau dossier…" maxlength="40">
          <button type="button" class="bp qk-group-add-btn" data-mat="${esc(matId)}" onclick="window.quickAddGroup('${jsStr(matId)}')">${window.iconLabel('plus', 'Ajouter')}</button>
        </div>
      </section>`;
  }

  function renderGroupsModalBody() {
    const mats = (window.D.matieres || []).slice();
    if (!mats.length) {
      return '<p class="anki-mut" style="font-size:13px;">Aucune matière configurée.</p>';
    }
    return `<div class="qk-groups-sections">${mats.map(m => renderGroupsModalSection({ mat: m, groups: groupsForMat(m.id) })).join('')}</div>`;
  }

  function refreshGroupsModalBody() {
    const body = $('qkGroupsBody');
    if (body) {
      body.innerHTML = renderGroupsModalBody();
      if (window.hydrateIcons) window.hydrateIcons(body);
      bindGroupsModalInputs();
    }
  }

  function bindGroupsModalInputs() {
    const ov = $('ovQuickGroups');
    if (!ov) return;
    ov.querySelectorAll('.qk-new-group-name').forEach(function (inp) {
      if (inp.dataset.bound === '1') return;
      inp.dataset.bound = '1';
      inp.onkeydown = function (e) {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          window.quickAddGroup(inp.getAttribute('data-mat') || '');
        }
      };
    });
  }

  window.quickPickGroupColor = function (gid, color) {
    const g = groupInfo(gid);
    if (!g || !color) return;
    g.color = color;
    refreshGroupsModalBody();
  };

  window.quickOpenGroupsModal = function (opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    ensure();
    Q.groupsModalFocusMat = opts.focusMat || Q.mat || '';
    Q.groupsModalFocusAdd = !!opts.focusAdd;
    let ov = $('ovQuickGroups');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ovQuickGroups';
      ov.className = 'ov';
      document.body.appendChild(ov);
    }
    ov.classList.remove('hidden');
    ov.innerHTML = `
      <div class="modal qk-groups-modal">
        <h2>${window.iconLabel('folder', 'Dossiers Rapide')}</h2>
        <p class="anki-mut qk-groups-intro">Organise tes cartes Y- par matière. Clique une pastille pour la couleur — pas de liste déroulante.</p>
        <div id="qkGroupsBody">${renderGroupsModalBody()}</div>
        <div class="macts">
          <button type="button" class="bs" onclick="window.quickCloseGroupsModal()">Fermer</button>
          <button type="button" class="bp" onclick="window.quickSaveGroupsModal()">Enregistrer</button>
        </div>
      </div>`;
    if (window.hydrateIcons) window.hydrateIcons(ov);
    bindGroupsModalInputs();

    const focusMat = Q.groupsModalFocusMat || ((window.D.matieres || [])[0] && window.D.matieres[0].id) || '';
    const addId = 'qkNewGroupName-' + (focusMat || 'other');
    const nameEl = $(addId);
    if (nameEl) {
      if (Q.groupsModalFocusAdd) {
        try { nameEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
        nameEl.focus();
      }
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
    const mat = matId || Q.groupsModalFocusMat || Q.mat || ((window.D.matieres || [])[0] && window.D.matieres[0].id) || '';
    const addId = 'qkNewGroupName-' + (mat || 'other');
    const el = $(addId) || document.querySelector('.qk-new-group-name[data-mat="' + mat + '"]');
    const name = (el && el.value || '').trim();
    if (!name) {
      if (typeof window.showToast === 'function') window.showToast('Indique un nom de dossier.');
      if (el) el.focus();
      return;
    }
    if (!mat) {
      if (typeof window.showToast === 'function') window.showToast('Matière introuvable.');
      return;
    }
    const id = genGroupId();
    window.D.quickGroups.push({
      id,
      name,
      color: defaultGroupColor(mat),
      order: groupsForMat(mat).length,
      mat: mat
    });
    if (el) el.value = '';
    refreshGroupsModalBody();
    if (typeof window.showToast === 'function') window.showToast('Dossier « ' + name + ' » créé.');
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
    if (typeof window.showToast === 'function') window.showToast('Dossiers enregistrés.');
  };

  window.quickStartAll = function () {
    const list = getFiltered().filter(c => c.statut === 'actif');
    if (!list.length) return window.sysAlert("Aucune carte Y- active à réviser.", "Rapide");
    window.save();
    if (window.startAnkiSingle && list.length === 1) {
      window.startAnkiSingle(list[0].id);
    } else if (typeof window.ankiV2SetQuickQueue === 'function') {
      window.ankiV2SetQuickQueue(list.map(c => c.id));
      window.switchTab('ankiV2');
    } else if (window.startAnkiSingle) {
      window.startAnkiSingle(list[0].id);
    }
  };
})();
