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
    coursId: ""
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
      const oa = a.order != null ? a.order : 0;
      const ob = b.order != null ? b.order : 0;
      if (oa !== ob) return oa - ob;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
  }

  function groupInfo(id) {
    if (!id) return null;
    return (window.D.quickGroups || []).find(g => g.id === id) || null;
  }

  function groupNavMeta(groupKey) {
    if (groupKey === UNGROUPED) {
      return { id: UNGROUPED, name: 'Sans groupe', color: '#6a7088' };
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
    const noneLabel = opts.noneLabel || 'Sans groupe';
    const allLabel = opts.allLabel;
    let html = '';
    if (allLabel != null) {
      html += `<option value="" ${!selectedId ? 'selected' : ''}>${esc(allLabel)}</option>`;
      html += `<option value="${UNGROUPED}" ${selectedId === UNGROUPED ? 'selected' : ''}>${esc(noneLabel)}</option>`;
    } else {
      html += `<option value="" ${!selectedId ? 'selected' : ''}>${esc(noneLabel)}</option>`;
    }
    sortedGroups().forEach(g => {
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
          <p>Choisis un <b>groupe</b> dans le fil d’Ariane, puis révise ou crée des cartes. Nouvelle carte → <b>active directement</b>.</p>
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
                <span class="hint">Enchaîne plusieurs cartes (même groupe)</span>
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
    const groups = sortedGroups();
    const noneStats = countGroupCards(UNGROUPED);
    let tiles = groups.map(g => {
      const stats = countGroupCards(g.id);
      return (
        `<button type="button" class="cours-bc-tile" style="--mat-color:${esc(g.color)}" onclick="window.quickArianePickGroup('${jsStr(g.id)}')">` +
          `<span class="cours-bc-tile-name">${esc(g.name)}</span>` +
          `<span class="cours-bc-tile-meta">${stats.active} active${stats.active > 1 ? 's' : ''}` +
            (stats.reservoir ? ` · ${stats.reservoir} réservoir` : '') +
          `</span>` +
        `</button>`
      );
    }).join('');

    if (noneStats.total) {
      tiles += (
        `<button type="button" class="cours-bc-tile" style="--mat-color:#6a7088" onclick="window.quickArianePickGroup('${jsStr(UNGROUPED)}')">` +
          `<span class="cours-bc-tile-name">Sans groupe</span>` +
          `<span class="cours-bc-tile-meta">${noneStats.active} active${noneStats.active > 1 ? 's' : ''}` +
            (noneStats.reservoir ? ` · ${noneStats.reservoir} réservoir` : '') +
          `</span>` +
        `</button>`
      );
    }

    tiles += (
      `<button type="button" class="cours-bc-tile cours-bc-tile--manage" onclick="window.quickArianeManageGroups()">` +
        `<span class="cours-bc-tile-name">${window.iconLabel('folder', 'Gérer les groupes')}</span>` +
        `<span class="cours-bc-tile-meta">Créer, renommer, couleurs</span>` +
      `</button>`
    );

    const empty = !groups.length && !noneStats.total;
    const body = empty
      ? '<div class="cours-bc-empty">Aucune carte Y- pour l’instant. Utilise <b>Créer</b> puis classe tes cartes via <b>Gérer les groupes</b>.</div>'
      : (
        '<div class="cours-bc-level-head">' +
          '<h3 class="cours-bc-level-title">Choisir un groupe</h3>' +
          '<p class="cours-bc-level-sub anki-mut">Puis révise ou ajoute des cartes dans ce groupe.</p>' +
        '</div>' +
        '<div class="cours-bc-grid">' + tiles + '</div>'
      );

    return body;
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

  /* ===== Gestion des groupes ===== */

  function renderGroupsModalBody() {
    const groups = sortedGroups();
    if (!groups.length) {
      return '<p class="anki-mut" style="font-size:13px;">Aucun groupe pour l’instant. Crée-en un pour classer tes cartes Rapide.</p>';
    }
    return `<div class="qk-groups-list">${groups.map((g, idx) => `
      <div class="qk-group-row" data-gid="${esc(g.id)}">
        <span class="qk-group-swatch" style="background:${g.color};" title="Couleur"></span>
        <input type="text" class="fi qk-group-name" value="${esc(g.name)}" data-gid="${esc(g.id)}" aria-label="Nom du groupe">
        <select class="qk-group-color" data-gid="${esc(g.id)}" aria-label="Couleur" title="Couleur">
          ${GROUP_COLORS.map(col => `<option value="${col}" ${g.color === col ? 'selected' : ''} style="background:${col};">${col}</option>`).join('')}
        </select>
        <button type="button" class="bs" title="Monter" ${idx === 0 ? 'disabled' : ''} onclick="window.quickMoveGroup('${esc(g.id)}', -1)">↑</button>
        <button type="button" class="bs" title="Descendre" ${idx === groups.length - 1 ? 'disabled' : ''} onclick="window.quickMoveGroup('${esc(g.id)}', 1)">↓</button>
        <button type="button" class="bs" style="color:var(--red);" title="Supprimer" onclick="window.quickDeleteGroup('${esc(g.id)}')">${window.iconHtml ? window.iconHtml('trash-2', 14, 'icon-sm') : '×'}</button>
      </div>
    `).join('')}</div>`;
  }

  window.quickOpenGroupsModal = function () {
    ensure();
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
        <h2>${window.iconLabel('folder', 'Groupes de cartes Rapide')}</h2>
        <p class="anki-mut" style="font-size:12px;margin-top:-4px;">Catégorise tes cartes Y- (vocabulaire, formules, etc.). Les cartes sans groupe restent dans « Sans groupe ».</p>
        <div id="qkGroupsBody">${renderGroupsModalBody()}</div>
        <div class="qk-group-add-row">
          <input type="text" id="qkNewGroupName" class="fi" placeholder="Nom du nouveau groupe" maxlength="40">
          <button type="button" class="bp" onclick="window.quickAddGroup()">${window.iconLabel('plus', 'Ajouter')}</button>
        </div>
        <div class="macts">
          <button type="button" class="bs" onclick="window.quickCloseGroupsModal()">Fermer</button>
          <button type="button" class="bp" onclick="window.quickSaveGroupsModal()">Enregistrer</button>
        </div>
      </div>`;
    if (window.hydrateIcons) window.hydrateIcons(ov);
    const nameEl = $('qkNewGroupName');
    if (nameEl) {
      nameEl.onkeydown = function (e) {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          window.quickAddGroup();
        }
      };
      nameEl.focus();
    }
  };

  window.quickCloseGroupsModal = function () {
    const ov = $('ovQuickGroups');
    if (ov) ov.classList.add('hidden');
  };

  window.quickAddGroup = function () {
    ensure();
    if (typeof window.refuseSecondaryFullMutation === 'function'
        && window.refuseSecondaryFullMutation('Appareil secondaire : création de groupe indisponible.')) {
      return;
    }
    const el = $('qkNewGroupName');
    const name = (el && el.value || '').trim();
    if (!name) {
      if (typeof window.showToast === 'function') window.showToast('Indique un nom de groupe.');
      return;
    }
    const id = genGroupId();
    window.D.quickGroups.push({
      id,
      name,
      color: nextGroupColor(),
      order: window.D.quickGroups.length
    });
    if (el) el.value = '';
    const body = $('qkGroupsBody');
    if (body) body.innerHTML = renderGroupsModalBody();
    if (window.hydrateIcons) window.hydrateIcons(body || document);
  };

  window.quickMoveGroup = function (id, delta) {
    ensure();
    const groups = sortedGroups();
    const idx = groups.findIndex(g => g.id === id);
    if (idx < 0) return;
    const j = idx + delta;
    if (j < 0 || j >= groups.length) return;
    const tmp = groups[idx];
    groups[idx] = groups[j];
    groups[j] = tmp;
    groups.forEach((g, i) => { g.order = i; });
    window.D.quickGroups = groups;
    const body = $('qkGroupsBody');
    if (body) body.innerHTML = renderGroupsModalBody();
    if (window.hydrateIcons) window.hydrateIcons(body || document);
  };

  window.quickDeleteGroup = function (id) {
    ensure();
    const g = groupInfo(id);
    if (!g) return;
    const count = (window.D.exercices || []).filter(c => isQuickCard(c) && c.groupId === id).length;
    const msg = count
      ? 'Supprimer le groupe « ' + g.name + ' » ? ' + count + ' carte(s) passeront en « Sans groupe ».'
      : 'Supprimer le groupe « ' + g.name + ' » ?';
    const doDel = function () {
      window.D.quickGroups = (window.D.quickGroups || []).filter(x => x.id !== id);
      (window.D.exercices || []).forEach(c => {
        if (c && c.groupId === id) delete c.groupId;
      });
      window.D.quickGroups.forEach((x, i) => { x.order = i; });
      if (Q.nav.group === id) Q.nav.group = '';
      const body = $('qkGroupsBody');
      if (body) body.innerHTML = renderGroupsModalBody();
      if (window.hydrateIcons) window.hydrateIcons(body || document);
    };
    if (typeof window.sysConfirm === 'function') {
      window.sysConfirm(msg, doDel, 'Groupe');
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
      ov.querySelectorAll('.qk-group-color').forEach(function (sel) {
        const gid = sel.getAttribute('data-gid');
        const g = groupInfo(gid);
        if (g && sel.value) g.color = sel.value;
      });
    }
    window.save();
    window.quickCloseGroupsModal();
    window.renderFlashcards();
    if (typeof window.showToast === 'function') window.showToast('Groupes enregistrés.');
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
