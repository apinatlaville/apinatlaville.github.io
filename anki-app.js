/**
 * anki-app.js v4 — UI Mode Synchrotron (PC*)
 * Vues : Cockpit · Agenda · Réservoir · Bibliothèque · Prévisions · Stats · Réglages
 */
(function () {
  const $ = id => document.getElementById(id);

  const S = {
    view: "cockpit",
    queue: [], current: null, showAnswer: false,
    chronoStart: 0, chronoElapsed: 0, chronoInt: null,
    chronoPausedAt: 0, chronoPausedAccum: 0, // v4: pause auto au changement d'onglet
    stats: { ok: 0, mid: 0, bad: 0, total: 0 },
    mode: "normal",
    libFilter: { mat: "", stat: "", profil: "", q: "" },
    libOpenMat: new Set(),
    libOpenGrp: new Set(),
    libFilterTimer: null,
    reservoirFilter: { mat: "", q: "" },  // v4: filtre de la vue Réservoir
    reservoirSel: new Set(),              // v4: sélection multiple pour activation groupée
    forecastDays: 14,
    selectionIds: new Set(),
    selectionOrder: [],
    pinnedIds: new Set(),      // auto : cartes ajoutées à la file
    excludedIds: new Set(),    // auto : cartes retirées de la file algo
    coursLinkSelection: new Set(),
    coursLinkQuery: "",
    manualOrder: null, // array d'ids quand l'utilisateur drag&drop
    expandedDay: null,
    sliderValue: 7,
    showSlider: false,
    sessionTempsManuel: null,             // v4: temps réel saisi manuellement (minutes)
    dernierExerciceModifie: null,         // v4: snapshot pour Undo
    sessionGeneree: false,                 // v4: flag "session du soir générée"
    cockpitMode: 'auto',                   // 'auto' | 'manual'
    cockpitFilterMat: '',
    cockpitFilterCours: '',
  };

  // v4: pause / reprise du chrono (visibilité onglet, changement de vue)
  function pauseChrono() {
    if (!S.chronoInt) return;
    clearInterval(S.chronoInt);
    S.chronoInt = null;
    S.chronoPausedAt = Date.now();
  }
  function resumeChrono() {
    if (!S.current || S.chronoInt) return;
    if (S.chronoPausedAt > 0) {
      // Translate the start time so elapsed time excludes the pause duration
      S.chronoStart += (Date.now() - S.chronoPausedAt);
      S.chronoPausedAt = 0;
    }
    S.chronoInt = setInterval(tickChrono, 200);
  }
  function tickChrono() {
    S.chronoElapsed = (Date.now() - S.chronoStart) / 1000;
    const el = $("ankiChrono");
    if (el) {
      el.textContent = fmtSec(S.chronoElapsed);
      const cible = (S.current && S.current.tempsCible) || 60;
      el.style.color = S.chronoElapsed > cible * 1.5 ? "var(--red)" : S.chronoElapsed > cible ? "var(--gold)" : "var(--grn)";
    }
  }
  // Pause auto quand l'onglet/navigateur perd le focus
  if (typeof document !== 'undefined' && !window._ankiVisibilityBound) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseChrono(); else if (S.current) resumeChrono();
    });
    window._ankiVisibilityBound = true;
  }

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
  }
  function ankAllCards() {
    return window.AnkiAlgo ? window.AnkiAlgo.allCards(window.D) : (window.D.exercices || []).concat(window.D.devoirs || []);
  }
  function ankFind(id) {
    return window.AnkiAlgo ? window.AnkiAlgo.findCard(window.D, id) : ((window.D.exercices || []).find(x => x.id === id) || (window.D.devoirs || []).find(x => x.id === id));
  }
  function ankSessionPool() { return ankAllCards(); }
  function ankExistingIds() {
    return window.AnkiAlgo ? Array.from(window.AnkiAlgo.allExistingIds(window.D)) : ankAllCards().map(c => c.id).concat((window.D.cours || []).map(x => x.uid));
  }
  function isQuickCard(c) {
    return !!(c && window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === 'quick');
  }
  function isMainCard(c) {
    return !!(c && window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === 'main');
  }
  function countReservoirMain() {
    return (window.D.exercices || []).filter(c => window.AnkiAlgo.isReservoir(c) && !isQuickCard(c) && !isDevoirCard(c)).length;
  }
  function ankLocate(id) {
    let idx = (window.D.exercices || []).findIndex(x => x.id === id);
    if (idx >= 0) return { list: window.D.exercices, idx };
    idx = (window.D.devoirs || []).findIndex(x => x.id === id);
    if (idx >= 0) return { list: window.D.devoirs, idx };
    return null;
  }
  function updateReservoirTabBadge(root) {
    const btn = root && root.querySelector('[data-testid="anki-tab-reservoir"]');
    if (!btn) return;
    const n = countReservoirMain();
    let badge = btn.querySelector('.anki-tab-badge');
    if (n) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'anki-tab-badge'; btn.appendChild(badge); }
      badge.textContent = n;
    } else if (badge) badge.remove();
  }
  function fmtSec(s) {
    s = Math.max(0, Math.round(s));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function mat(id) { return (window.D.matieres || []).find(m => m.id === id) || { color: "#666", label: id || "?", name: id || "?" }; }
  const esc = s => window.escHtml(s);
  function cardAlgoStatsLine(c) {
    if (!c || !window.AnkiAlgo) return '';
    const today = window.AnkiAlgo.todayISO();
    if (window.AnkiAlgo.cardKind(c) === 'devoir' || isDevoirCard(c)) {
      const urg = window.AnkiAlgo.urgenceDevoir(c, today);
      const bits = [`urg ${urg.total.toFixed(0)}`];
      if (c.dateLimite) bits.push(`limite ${c.dateLimite}`);
      if (c._morceauxTotal) bits.push(`sess ${(c._morceauxFaits || 0) + 1}/${c._morceauxTotal}`);
      return bits.join(' · ');
    }
    const score = window.AnkiAlgo.urgenceScore(c, today);
    const ir = window.AnkiAlgo.computeIR(c, today);
    const urgVal = typeof score === 'object' ? score.total : score;
    const bits = [
      `I_R ${ir.IR.toFixed(2)}`,
      `int ${c.intervalle || 0}j`,
      `ease ${(c.ease || 2.5).toFixed(1)}`,
      `rep ${c.repetitions || 0}`,
      `urg ${urgVal.toFixed(1)}`
    ];
    const next = c.dateProchaineRevision;
    if (next) {
      bits.push(next < today ? `retard (${next})` : `→ ${next}`);
    }
    return bits.join(' · ');
  }

  function renderSessionTimeBar(sessionMin) {
    const total = Math.max(5, Math.min(300, parseInt(sessionMin, 10) || 60));
    const sessionH = Math.floor(total / 60);
    const sessionM = Math.round((total % 60) / 5) * 5;
    const hourOpts = [0, 1, 2, 3, 4, 5].map(h =>
      `<option value="${h}"${h === sessionH ? ' selected' : ''}>${h}</option>`
    ).join('');
    const minOpts = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m =>
      `<option value="${m}"${m === sessionM ? ' selected' : ''}>${String(m).padStart(2, '0')}</option>`
    ).join('');
    const presets = [[45, '45m'], [60, '1h'], [75, '1h15'], [90, '1h30'], [120, '2h']];
    return `
      <div class="anki-session-bar">
        <span class="anki-session-bar-label">${window.iconLabel('timer', 'Durée session')}</span>
        <div class="anki-session-time">
          <select class="anki-time-h fi" aria-label="Heures" onchange="window.ankiSetSessionTime()">${hourOpts}</select>
          <span class="anki-time-unit">h</span>
          <select class="anki-time-m fi" aria-label="Minutes" onchange="window.ankiSetSessionTime()">${minOpts}</select>
          <span class="anki-time-unit">min</span>
        </div>
        <div class="anki-session-presets">
          ${presets.map(([m, label]) =>
            `<button type="button" class="cbt anki-preset-time${total === m ? ' on' : ''}" data-preset="${m}" onclick="window.ankiSetSessionTimePreset(${m})">${label}</button>`
          ).join('')}
        </div>
      </div>`;
  }
  function stars(c) { return window.importanceLabel(c); }
  function cardImportance(c) { return window.AnkiAlgo.getImportance(c); }
  function sessStatsHtml(ok, mid, bad) {
    return `${window.iconHtml('check', 14, 'eval-good')} ${ok} · ${window.iconHtml('circle-minus', 14, 'eval-mid')} ${mid} · ${window.iconHtml('circle-x', 14, 'eval-bad')} ${bad}`;
  }
  function searchField(placeholder, attrs) {
    return `<div class="search-field"><span data-icon="search" data-icon-size="14"></span><input class="fi" placeholder="${placeholder}" ${attrs || ''}></div>`;
  }
  function isDevoirCard(c) {
    if (!c) return false;
    if (window.AnkiAlgo && window.AnkiAlgo.cardKind(c) === 'devoir') return true;
    return c.type === 'devoir' || c.type === 'devoir-morceau';
  }
  function profileLabel(p) { const pr = window.AnkiAlgo.getProfile(p); return pr ? pr.label : p; }

  // ===== Vue principale =====
  window.renderAnki = function () {
    ensure();
    const shift = window.AnkiAlgo.shiftProgramIfMissedDaily(window.D);
    if (shift.shifted > 0) window.save();
    restoreSessionFromStorageIfAny();

    const root = $("paneAnki");
    if (!root) return;

    const reservoir = countReservoirMain();
    const sessionActive = !!(window.D.sessionEnCours && Array.isArray(window.D.sessionEnCours.queueIds) && window.D.sessionEnCours.queueIds.length);

    root.innerHTML = `
      <div class="anki-head">
        <h2>${window.iconLabel('dna', 'Synchrotron')} <span class="anki-sub">— Répétition espacée PC*</span></h2>
        <p>Coefficient d'urgence I_R · Ease élastique · Réservoir · Session persistante.</p>
      </div>

      <div class="anki-nav">
        <button class="anki-tab ${S.view === 'cockpit' ? 'on' : ''}" data-anki-view="cockpit" data-testid="anki-tab-cockpit" onclick="window.ankiSetView('cockpit')">${window.iconLabel('sliders', 'Cockpit')}</button>
        <button class="anki-tab ${S.view === 'agenda' ? 'on' : ''}" data-anki-view="agenda" data-testid="anki-tab-agenda" onclick="window.ankiSetView('agenda')">${window.iconLabel('clipboard-list', 'Agenda')}</button>
        <button class="anki-tab ${S.view === 'reservoir' ? 'on' : ''}" data-anki-view="reservoir" data-testid="anki-tab-reservoir" onclick="window.ankiSetView('reservoir')">${window.iconLabel('hourglass', 'Réservoir')}${reservoir ? `<span class="anki-tab-badge">${reservoir}</span>` : ''}</button>
        <button class="anki-tab ${S.view === 'library' ? 'on' : ''}" data-anki-view="library" data-testid="anki-tab-library" onclick="window.ankiSetView('library')">${window.iconLabel('book-open', 'Bibliothèque')}</button>
        <button class="anki-tab ${S.view === 'forecast' ? 'on' : ''}" data-anki-view="forecast" data-testid="anki-tab-forecast" onclick="window.ankiSetView('forecast')">${window.iconLabel('calendar', 'Prévisions')}</button>
        <button class="anki-tab ${S.view === 'stats' ? 'on' : ''}" data-anki-view="stats" data-testid="anki-tab-stats" onclick="window.ankiSetView('stats')">${window.iconLabel('bar-chart', 'Stats')}</button>
        <button class="anki-tab ${S.view === 'settings' ? 'on' : ''}" data-anki-view="settings" data-testid="anki-tab-settings" onclick="window.ankiSetView('settings')">${window.iconLabel('settings', 'Réglages')}</button>
      </div>

      ${sessionActive ? `
        <div class="anki-session-resume" data-testid="session-resume-bar">
          <span>${window.iconLabel('pin', `<b>Session du soir en cours</b> — ${window.D.sessionEnCours.queueIds.length} cartes restantes`)}</span>
          <div>
            <button class="bp" data-testid="btn-reprendre-session" onclick="window.ankiResumeSession()">${window.iconLabel('play', 'Reprendre la session en cours')}</button>
            <button class="bs" data-testid="btn-abandon-session" onclick="window.ankiDiscardSession()">${window.iconLabel('trash-2', 'Abandonner')}</button>
          </div>
        </div>
      ` : ''}

      <div id="ankiViewContent"></div>
    `;
    renderActiveView();
    window.hydrateIcons(root);
    if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
  };

  window.ankiSetView = function (v) {
    if (S.current) pauseChrono();
    S.view = v;
    const root = $("paneAnki");
    if (root && root.querySelector('.anki-nav')) {
      root.querySelectorAll('.anki-tab').forEach(btn => {
        const tab = btn.getAttribute('data-anki-view');
        if (tab) btn.classList.toggle('on', tab === v);
      });
      updateReservoirTabBadge(root);
      renderActiveView();
      if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
      return;
    }
    window.renderAnki();
  };

  window.ankiSetCockpitMode = function (mode) {
    S.cockpitMode = mode === 'manual' ? 'manual' : 'auto';
    if (S.cockpitMode === 'auto') {
      S.selectionIds.clear();
      S.selectionOrder = [];
      S.pinnedIds.clear();
      S.excludedIds.clear();
      S.manualOrder = null;
      S.cockpitSearch = '';
      S.cockpitFilterMat = '';
      S.cockpitFilterCours = '';
    }
    const root = $("paneAnki");
    if (root && root.querySelector('.anki-nav')) {
      renderActiveView();
      return;
    }
    window.renderAnki();
  };

  function formatSessionKpi(min) {
    min = Math.max(0, parseInt(min, 10) || 0);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
    if (h) return `${h}h`;
    return `${m}<span style="font-size:14px;color:var(--mut);">min</span>`;
  }

  function cardDurationSec(c) {
    if (!c) return 60;
    if (window.AnkiAlgo.cardDuration) return window.AnkiAlgo.cardDuration(c);
    if (c.type === 'devoir' || c.type === 'devoir-morceau') {
      return Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)) * 60);
    }
    return c.tempsCible || 60;
  }

  function pickLowestPriorityCard(cartes) {
    const ref = window.AnkiAlgo.todayISO();
    let worst = null, worstScore = Infinity;
    (cartes || []).forEach(c => {
      const s = window.AnkiAlgo.scoreSession(c, ref).total;
      if (s < worstScore) { worstScore = s; worst = c; }
    });
    return worst;
  }

  function applyAutoAdjustments(basePlan, sessionMin) {
    const settings = window.D.settings || {};
    const marge = typeof settings.margeBudget === 'number' ? settings.margeBudget : (window.AnkiAlgo.DEFAULT_COEFS && window.AnkiAlgo.DEFAULT_COEFS.MARGE_BUDGET_DEFAULT) || 0.92;
    const budget = (sessionMin || 60) * 60 * Math.max(0.5, Math.min(1, marge));
    const overflowExtend = !!settings.ankiSessionOverflow;
    let cartes = (basePlan.cartes || []).filter(c => !S.excludedIds.has(c.id));
    let used = cartes.reduce((s, c) => s + cardDurationSec(c), 0);

    S.pinnedIds.forEach(id => {
      if (cartes.some(c => c.id === id)) return;
      const c = ankFind(id);
      if (!c || !window.AnkiAlgo.isActive(c)) return;
      const t = cardDurationSec(c);
      if (overflowExtend) {
        cartes.push(c);
        used += t;
        return;
      }
      while (used + t > budget && cartes.length > 0) {
        const victim = pickLowestPriorityCard(cartes);
        if (!victim) break;
        cartes = cartes.filter(x => x.id !== victim.id);
        used -= cardDurationSec(victim);
      }
      if (used + t <= budget || cartes.length === 0) {
        cartes.push(c);
        used += t;
      }
    });

    if (S.manualOrder && S.manualOrder.length) {
      const map = {};
      cartes.forEach(c => { map[c.id] = c; });
      cartes = S.manualOrder.map(id => map[id]).filter(Boolean);
      used = cartes.reduce((s, c) => s + cardDurationSec(c), 0);
    }

    return Object.assign({}, basePlan, {
      cartes,
      tempsTotalPrev: used,
      reportees: (basePlan.reportees || []).concat(
        (basePlan.cartes || []).filter(c => S.excludedIds.has(c.id))
      )
    });
  }

  function computeCockpitPlan() {
    const settings = window.D.settings || {};
    const sessionMin = settings.ankiSessionMin || 60;
    const includeNew = settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5;
    const isManualTab = S.cockpitMode === 'manual';

    if (isManualTab) {
      const selectedIds = S.selectionIds.size ? getSelectedIds() : [];
      if (!selectedIds.length) {
        return { cartes: [], tempsTotalPrev: 0, reportees: [], marge: settings.margeBudget || 0.92, countDevoir: 0, countMain: 0, countQuick: 0 };
      }
      return window.AnkiAlgo.buildSession(ankSessionPool(), {
        sessionMinutes: sessionMin,
        includeNew,
        selectedIds,
        manualOrder: S.manualOrder
      });
    }

    const base = window.AnkiAlgo.buildSession(ankSessionPool(), {
      sessionMinutes: sessionMin,
      includeNew,
      selectedIds: null,
      manualOrder: null
    });
    return applyAutoAdjustments(base, sessionMin);
  }

  window.ankiSetSessionTime = function () {
    const hEl = document.querySelector('.anki-time-h');
    const mEl = document.querySelector('.anki-time-m');
    const h = hEl ? parseInt(hEl.value, 10) || 0 : 0;
    const m = mEl ? parseInt(mEl.value, 10) || 0 : 0;
    const total = Math.max(5, Math.min(300, h * 60 + m));
    if (!window.D.settings) window.D.settings = {};
    window.D.settings.ankiSessionMin = total;
    window.save();
    syncSessionTimeUi(total);
    refreshQueueOnly();
  };

  window.ankiSetSessionTimePreset = function (min) {
    const total = Math.max(5, Math.min(300, parseInt(min, 10) || 60));
    if (!window.D.settings) window.D.settings = {};
    window.D.settings.ankiSessionMin = total;
    window.save();
    syncSessionTimeUi(total);
    refreshQueueOnly();
  };

  function syncSessionTimeUi(total) {
    const h = Math.floor(total / 60);
    const m = Math.round((total % 60) / 5) * 5;
    const hEl = document.querySelector('.anki-time-h');
    const mEl = document.querySelector('.anki-time-m');
    if (hEl) hEl.value = String(h);
    if (mEl) mEl.value = String(m);
    const kpi = document.getElementById('ankiKpiSessionDur') || document.querySelector('.anki-kpis .kpi:last-child .kpi-n');
    if (kpi) kpi.innerHTML = formatSessionKpi(total);
    document.querySelectorAll('.anki-preset-time').forEach(btn => {
      btn.classList.toggle('on', parseInt(btn.dataset.preset, 10) === total);
    });
  }

  window.ankiSetSessionOverflow = function (checked) {
    if (!window.D.settings) window.D.settings = {};
    window.D.settings.ankiSessionOverflow = !!checked;
    window.save();
    refreshQueueOnly();
  };

  window.ankiSetSessionMin = function (val) {
    window.ankiSetSessionTime();
  };

  function renderActiveView() {
    const c = $("ankiViewContent");
    if (!c) return;
    const scrollY = S.view === "library" ? (window.scrollY || window.pageYOffset || 0) : 0;
    if (S.view === "diag") S.view = "cockpit";
    if (S.view === "cockpit")        c.innerHTML = viewCockpit();
    else if (S.view === "agenda")    c.innerHTML = viewAgenda();
    else if (S.view === "reservoir") c.innerHTML = viewReservoir();
    else if (S.view === "library")   c.innerHTML = viewLibrary();
    else if (S.view === "forecast")  c.innerHTML = viewForecast();
    else if (S.view === "stats")     c.innerHTML = viewStats();
    else if (S.view === "settings")  c.innerHTML = viewSettings();
    bindDragDrop();
    window.hydrateIcons(c);
    if (S.view === "library" && scrollY > 0) {
      requestAnimationFrame(function () { window.scrollTo(0, scrollY); });
    }
  }

  function renderCockpitKpisBar() {
    const exos = window.D.exercices || [];
    const actifs = exos.filter(c => c.statut === 'actif' && !isQuickCard(c) && !isDevoirCard(c)).length;
    const reservoir = countReservoirMain();
    const cands = window.AnkiAlgo.getCandidates(exos);
    const sessionMin = (window.D.settings && window.D.settings.ankiSessionMin) || 60;
    const tile = typeof window.uiTile === 'function' ? window.uiTile : function (v, l, o) {
      const c = o && o.color ? ' style="color:' + o.color + ';"' : '';
      const id = o && o.id ? ' id="' + o.id + '"' : '';
      return '<div class="kpi ui-tile"><div class="kpi-n"' + id + c + '>' + v + '</div><div class="kpi-l">' + l + '</div></div>';
    };
    return `
      <div class="anki-kpis">
        ${tile(cands.length, 'Candidates', { color: 'var(--red)' })}
        ${tile(reservoir, 'Réservoir', { color: 'var(--gold)' })}
        ${tile(actifs, 'Actives', { color: 'var(--grn)' })}
        ${tile(formatSessionKpi(sessionMin), 'Session', { id: 'ankiKpiSessionDur' })}
      </div>
      ${renderSessionTimeBar(sessionMin)}
    `;
  }

  function coursLabel(uid) {
    const co = (window.D.cours || []).find(x => x.uid === uid);
    return co ? `${co.uid} · ${co.title}` : uid;
  }

  function cardCoursSearchText(c) {
    return (c.coursIds || []).map(uid => coursLabel(uid)).join(' ');
  }

  function getCockpitDisplayList() {
    const allCards = (window.D.exercices || []).filter(c => (c.statut === 'actif' || c.statut === 'attente' || c.statut === 'reservoir') && !isDevoirCard(c));
    const candidats = window.AnkiAlgo.getCandidates(window.D.exercices)
      .map(x => ({ ...x.card, _urg: x.score.total }));
    const cockpitSearch = (S.cockpitSearch || '').trim().toLowerCase();
    const isManualTab = S.cockpitMode === 'manual';
    let list = isManualTab ? allCards.map(c => ({
      ...c,
      _urg: window.AnkiAlgo.scoreSession(c).total
    })) : candidats.slice();

    if (S.cockpitFilterMat) list = list.filter(c => c.mat === S.cockpitFilterMat);
    if (S.cockpitFilterCours) {
      list = list.filter(c => {
        const ids = c.coursIds || (c.coursId ? [c.coursId] : []);
        return ids.includes(S.cockpitFilterCours);
      });
    }
    if (cockpitSearch) {
      list = list.filter(c => {
        const blob = [
          c.titre || '',
          c.question || '',
          c.id || '',
          cardCoursSearchText(c)
        ].join(' ').toLowerCase();
        return blob.includes(cockpitSearch);
      });
      if (!isManualTab) {
        list = list.map(c => ({
          ...c,
          _urg: c._urg != null ? c._urg : window.AnkiAlgo.scoreSession(c).total
        }));
      }
    }
    list.sort((a, b) => (b._urg || 0) - (a._urg || 0));
    return list;
  }

  function renderCockpitPickFilters(isManualTab) {
    if (!isManualTab) return '';
    const matOpts = (window.D.matieres || []).map(m =>
      `<option value="${m.id}"${S.cockpitFilterMat === m.id ? ' selected' : ''}>${m.label} — ${m.name}</option>`
    ).join('');
    const coursList = (window.D.cours || []).filter(co =>
      !S.cockpitFilterMat || co.mat === S.cockpitFilterMat
    );
    const coursOpts = coursList.map(co =>
      `<option value="${co.uid}"${S.cockpitFilterCours === co.uid ? ' selected' : ''}>${esc(co.uid)} · ${esc(co.title)}</option>`
    ).join('');
    return `
      <div class="anki-filters anki-cockpit-filters">
        <select class="fi" onchange="window.ankiCockpitFilter('mat', this.value)">
          <option value="">Toutes matières</option>${matOpts}
        </select>
        <select class="fi" onchange="window.ankiCockpitFilter('cours', this.value)">
          <option value="">Tous chapitres / cours</option>${coursOpts}
        </select>
      </div>`;
  }

  // ====== VUE COCKPIT ======
  function viewCockpit() {
    const settings = window.D.settings || {};
    const isManualTab = S.cockpitMode === 'manual';
    const plan = computeCockpitPlan();
    S._effectiveIds = new Set(plan.cartes.map(c => c.id));

    const cartes = plan.cartes;
    const total = plan.tempsTotalPrev;

    const counts = {
      devoir: plan.countDevoir || 0,
      devoirF: plan.countDevoirForce || 0,
      devoirL: plan.countDevoirLatent || 0,
      main:   plan.countMain   || 0,
      quick:  plan.countQuick  || 0,
      quickW: plan.countQuickWoven || 0,
      quickE: plan.countQuickExtra || 0
    };
    const overloadBanner = plan.overload ? `
      <div class="anki-overload-banner" data-testid="overload-banner"
           style="margin:0 0 10px;padding:10px 12px;border-radius:8px;
                  background:rgba(233,79,100,0.15);border:1px solid var(--red);color:var(--red);
                  display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
        ${window.iconHtml('alert-triangle', 16)} <span>Pas assez de temps prévu pour les devoirs urgents : il manque
        <b>${window.AnkiAlgo.fmtDur(plan.overloadDelta)}</b>. Pense à augmenter la durée de session,
        ou à devancer certains DM sur les jours précédents.</span>
      </div>
    ` : '';

    const cockpitSearch = S.cockpitSearch || '';
    const displayList = getCockpitDisplayList();

    let html = `
      ${renderCockpitKpisBar()}
      <div class="anki-cockpit-tabs">
        <button type="button" class="anki-cockpit-tab ${!isManualTab ? 'on' : ''}" onclick="window.ankiSetCockpitMode('auto')">${window.iconLabel('brain', 'Automatique')}</button>
        <button type="button" class="anki-cockpit-tab ${isManualTab ? 'on' : ''}" onclick="window.ankiSetCockpitMode('manual')">${window.iconLabel('mouse-pointer-click', 'Manuel')}</button>
      </div>
      ${overloadBanner}
      <div class="anki-card-block ${isManualTab ? 'manual' : 'auto'}">
        <div class="anki-block-hdr">
          <div>
            <h3>${isManualTab ? window.iconLabel('mouse-pointer-click', 'File manuelle') : window.iconLabel('brain', 'File automatique')} <span class="anki-mut" id="ankiQueueMeta">(${cartes.length} cartes · ${window.AnkiAlgo.fmtDur(total)})</span></h3>
            <p class="anki-mut" data-testid="cockpit-piles-counts">
              <span style="color:var(--red);font-weight:700;">${window.iconLabel('pin', `${counts.devoir} devoir${counts.devoir > 1 ? 's' : ''}`)}</span>${counts.devoirF ? ` (${counts.devoirF} forcé${counts.devoirF > 1 ? 's' : ''}${counts.devoirL ? ' + ' + counts.devoirL + ' latent' + (counts.devoirL > 1 ? 's' : '') : ''})` : ''}
              · <span style="color:var(--grn);font-weight:700;">${window.iconLabel('brain', `${counts.main} principale${counts.main > 1 ? 's' : ''}`)}</span>
              · <span style="color:#5b8def;font-weight:700;">${window.iconLabel('languages', `${counts.quick} rapide${counts.quick > 1 ? 's' : ''}`)}</span>${counts.quickW ? ` (${counts.quickW} tissée${counts.quickW > 1 ? 's' : ''}${counts.quickE ? ' + ' + counts.quickE + ' fin' : ''})` : ''}
              · marge ${Math.round((plan.marge || 0.92) * 100)}%
              · ${isManualTab ? '<span style="color:var(--gold);">Uniquement ta sélection</span>' : '<span style="color:var(--grn);">Algorithme + ajustements</span>'}
            </p>
          </div>
          <div class="anki-block-actions" style="align-items:center;">
            <button class="bs" data-testid="btn-generer-session-soir" onclick="window.ankiGenererSessionSoir()" title="Fige la file actuelle (auto ou manuelle) pour ce soir">${window.iconLabel('pin', 'Session du soir')}</button>
            <button class="bp" data-testid="btn-commencer-session" onclick="window.startAnkiSession()" ${cartes.length === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>${window.iconLabel('play', 'Commencer')}</button>
          </div>
        </div>
        ${!isManualTab ? `
        <label class="anki-check-row">
          <input type="checkbox" ${settings.ankiSessionOverflow ? 'checked' : ''} onchange="window.ankiSetSessionOverflow(this.checked)">
          <span>Dépasser le temps max si besoin <span class="anki-mut">(sinon : remplacer les cartes les moins prioritaires)</span></span>
        </label>` : ''}
        <p class="anki-mut" style="font-size:11px;margin:0 0 8px;">${isManualTab
          ? window.iconLabel('lightbulb', 'Mode manuel : compose ta session carte par carte (colle, DS ciblé…). « Session du soir » fige cette liste.')
          : window.iconLabel('lightbulb', 'L&apos;algo remplit la file. Clique une carte due pour l&apos;ajouter ou la retirer — le reste de la file est conservé.')
        }</p>
        <div class="anki-queue anki-queue-fixed" id="ankiQueueDrop">
          ${cartes.length === 0 ? `<div class="anki-empty">${isManualTab ? window.iconLabel('search', 'Sélectionne des cartes en mode manuel.') : window.iconLabel('sparkles', 'Aucune carte à réviser.')}</div>` : cartes.map((c, i) => renderQueueRow(c, i)).join('')}
        </div>
        ${plan.reportees.length && !isManualTab ? `<div class="anki-mut" style="margin-top:8px;font-size:11px;">${plan.reportees.length} carte(s) hors budget → reportées</div>` : ""}
      </div>
    `;

    const pickTitle = isManualTab ? 'Choisir mes cartes' : 'Ajuster la file (cartes dues)';
    const pickHint = isManualTab
      ? (cockpitSearch ? `<b>Recherche</b> (${displayList.length}) — clique pour sélectionner` : 'Toutes les cartes actives — clique pour composer ta session')
      : (cockpitSearch ? `<b>Recherche</b> (${displayList.length})` : '<b>Cartes dues</b> — clique pour ajouter / retirer (budget recalculé)');

    const pickStats = isManualTab
      ? `${S.selectionIds.size} sélectionnée(s)`
      : `${S.pinnedIds.size} ajoutée(s) · ${S.excludedIds.size} retirée(s)`;

    html += `
      <div class="anki-card-block">
        <div class="pbar">
          <div>
            <h3 style="font-family:'Inter';font-size:16px;margin-bottom:4px;">${window.iconLabel('search', pickTitle)}</h3>
            <p style="color:var(--mut);font-size:12px;margin:0;" id="ankiPickStats">${pickStats}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${isManualTab ? `<button class="cbt" type="button" onclick="window.ankiSelectAllPick()">Sél. toutes</button>` : `<button class="cbt" type="button" onclick="window.ankiResetAutoAdjust()">Réinit. algo</button>`}
            <button class="cbt" type="button" onclick="window.ankiSelectClear()">Vider</button>
          </div>
        </div>
        ${isManualTab ? searchField("Cherche carte, chapitre, code cours...", `class="fi anki-search-input" value="${esc(cockpitSearch)}" oninput="window.ankiCockpitSearch(this.value)"`) : (cockpitSearch || displayList.length > 12 ? searchField('Filtrer les cartes dues...', `class="fi anki-search-input" value="${esc(cockpitSearch)}" oninput="window.ankiCockpitSearch(this.value)"`) : '')}
        ${renderCockpitPickFilters(isManualTab)}
        <p class="anki-mut" style="margin:8px 0 6px;font-size:11px;">${pickHint}${isManualTab ? ' · triées par urgence ↓' : ''}</p>
        <div class="cgrid anki-pick-grid" id="ankiPickGrid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;">
          ${displayList.map(c => renderPickPcard(c)).join('') || '<div class="anki-empty" style="grid-column:1/-1;">Aucun résultat</div>'}
        </div>
        ${isManualTab ? `
        <div id="ankiSelOrderWrap" class="anki-sel-order-wrap" style="${S.selectionIds.size ? '' : 'display:none;'}">
          <p class="anki-mut" style="font-size:11px;margin:10px 0 6px;">Ordre de ta sélection — ↑ ↓ pour réordonner</p>
          <div id="ankiSelOrder" class="anki-sel-order">${renderSelectionOrderRows()}</div>
        </div>` : ''}
      </div>
    `;
    return html;
  }

  // ====== VUE AGENDA (devoirs W- triés par date limite) ======
  function viewAgenda() {
    const ref = window.AnkiAlgo.todayISO();
    const seuil = (window.D.settings && window.D.settings.seuilDevoirForce) || 35;
    const devoirs = (window.D.devoirs || [])
      .filter(c => c.statut === 'actif')
      .map(c => ({ card: c, urg: window.AnkiAlgo.urgenceDevoir(c, ref) }))
      .sort((a, b) => {
        const da = a.card.dateLimite || '9999-12-31';
        const db = b.card.dateLimite || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return b.urg.total - a.urg.total;
      });

    const forcesCeSoir = devoirs.filter(x => x.urg.total >= seuil);
    const tempsForce = forcesCeSoir.reduce((s, x) => s + (x.card.tempsCible || 0) / (x.card._morceauxTotal || 1), 0);

    return `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <div>
            <h3>${window.iconLabel('clipboard-list', 'Agenda — Devoirs W-')}</h3>
            <p class="anki-mut" style="font-size:12px;">Tous les DM / colles / exos à rendre, triés par <b>date limite</b>. Les devoirs ne passent pas par l'I_R : c'est l'agenda qui décide quand ils entrent en session.</p>
          </div>
          <div class="anki-block-actions">
            <button class="bp" onclick="window.openDevoirModal()">+ Ajouter un devoir</button>
          </div>
        </div>
        ${forcesCeSoir.length ? `
          <div style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(233,79,100,0.12);border:1px solid rgba(233,79,100,0.35);font-size:13px;">
            <b>Ce soir (Phase 0)</b> : ${forcesCeSoir.length} devoir(s) forcé(s) · ~${window.AnkiAlgo.fmtDur(tempsForce)}
            <span class="anki-mut"> — urgence calendaire ≥ ${seuil}</span>
          </div>
        ` : `<p class="anki-mut" style="font-size:12px;margin-bottom:12px;">Aucun devoir forcé ce soir (urgence &lt; ${seuil}). Les W- opportunistes peuvent entrer si le budget le permet.</p>`}
        <div class="anki-devoirs-list">${renderAgendaList(devoirs, seuil) || '<div class="anki-empty">Aucun devoir actif. Ajoute un DM avec date limite.</div>'}</div>
        <p class="anki-mut" style="font-size:11px;margin-top:10px;">Un DM = un objet unique · sessions quotidiennes (_morceauxFaits / _morceauxTotal) · pas de slider qScore (Fait / Partiel / À refaire).</p>
      </div>
    `;
  }

  function renderAgendaList(devoirs, seuil) {
    if (!devoirs.length) return '';
    return devoirs.map(({ card: d, urg }) => {
      const m = mat(d.mat);
      const done = d._morceauxFaits || 0;
      const total = d._morceauxTotal || 1;
      const pct = Math.round(done / total * 100);
      const isForce = urg.total >= seuil;
      const jr = urg.joursRestants;
      const jrLabel = jr == null ? '—' : (jr <= 0 ? `Retard J${jr}` : `J+${jr}`);
      return `
        <div class="anki-devoir-row" style="${isForce ? 'border-left:3px solid var(--red);' : ''}">
          <span class="anki-q-mat" style="background:${m.color};">${window.iconHtml('file-text', 12)}</span>
          <div class="anki-devoir-body">
            <div class="anki-devoir-title">${esc(d.titre || d.question)} ${isForce ? '<span style="color:var(--red);font-size:11px;">· FORCÉ ce soir</span>' : ''}</div>
            <div class="anki-devoir-meta">${d.id} · ${window.iconHtml('calendar', 12)} ${d.dateLimite || '—'} · ${jrLabel} · urg ${urg.total.toFixed(0)} · session ${done + 1}/${total} · ${window.iconHtml('timer', 12)} ${window.AnkiAlgo.fmtDur((d._dureeTotaleMin || d.tempsCible / 60) / total * 60)}/sess</div>
            <div class="anki-progress"><div class="anki-progress-bar" style="width:${pct}%;background:${m.color};"></div></div>
          </div>
          ${window.iconBtn('play', 'Session', `onclick="window.startAnkiSingle('${d.id}')"`)}
          ${window.iconBtn('pencil', 'Modifier', `onclick="window.editExo('${d.id}')"`)}
          ${window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${d.id}')"`)}
        </div>
      `;
    }).join('');
  }

  window.ankiCockpitSearch = function (v) {
    S.cockpitSearch = v;
    renderPickGridOnly();
    const input = document.querySelector('.anki-search-input');
    if (input) { input.focus(); input.setSelectionRange(v.length, v.length); }
  };

  window.ankiCockpitFilter = function (k, v) {
    if (k === 'mat') {
      S.cockpitFilterMat = v;
      if (S.cockpitFilterCours) {
        const co = (window.D.cours || []).find(x => x.uid === S.cockpitFilterCours);
        if (co && v && co.mat !== v) S.cockpitFilterCours = '';
      }
    } else if (k === 'cours') {
      S.cockpitFilterCours = v;
      if (v) {
        const co = (window.D.cours || []).find(x => x.uid === v);
        if (co) S.cockpitFilterMat = co.mat;
      }
    }
    keepPageScroll(renderPickGridOnly);
  };

  window.ankiBackToAuto = function () {
    S.cockpitMode = 'auto';
    S.selectionIds.clear();
    S.selectionOrder = [];
    S.pinnedIds.clear();
    S.excludedIds.clear();
    S.manualOrder = null;
    S.cockpitSearch = '';
    S.cockpitFilterMat = '';
    S.cockpitFilterCours = '';
    renderActiveView();
  };

  function syncSelectionOrder() {
    S.selectionOrder = S.selectionOrder.filter(id => S.selectionIds.has(id));
    S.selectionIds.forEach(id => {
      if (!S.selectionOrder.includes(id)) S.selectionOrder.push(id);
    });
  }

  function getSelectedIds() {
    syncSelectionOrder();
    return S.selectionOrder.filter(id => S.selectionIds.has(id));
  }

  function renderPickPcard(c) {
    const m = mat(c.mat);
    const isManualTab = S.cockpitMode === 'manual';
    const sel = isManualTab
      ? S.selectionIds.has(c.id)
      : (S._effectiveIds && S._effectiveIds.has(c.id));
    const kind = window.AnkiAlgo.cardKind(c);
    const kindLabel = kind === 'devoir' ? 'W' : kind === 'quick' ? 'Y' : 'X';
    const pinTag = !isManualTab && S.pinnedIds.has(c.id) ? '<span class="anki-pcard-pin">+</span>' : '';
    return `
      <div class="pcard anki-pcard ${sel ? 'sel' : ''}" data-pickid="${c.id}" onclick="event.preventDefault();window.ankiTogglePick('${c.id}')">
        <div class="pc-check">${sel ? window.iconHtml('check', 14, 'icon-sm') : window.iconHtml('square', 14, 'icon-sm')}</div>
        ${pinTag}
        <div class="anki-pcard-mat" style="background:${m.color}20;color:${m.color};">${m.label} · ${kindLabel}</div>
        <div class="pc-uid">${c.id}</div>
        <div class="pc-title">${esc(c.titre || (c.question || '').substring(0, 48))}</div>
        <div class="anki-pcard-stats anki-mut">${cardAlgoStatsLine(c)}</div>
        <div class="anki-pcard-urg">${(c._urg || 0).toFixed(1)}</div>
      </div>`;
  }

  function renderSelectionOrderRows() {
    const ids = getSelectedIds();
    if (!ids.length) return '';
    return ids.map((id, i) => {
      const c = ankFind(id);
      if (!c) return '';
      const m = mat(c.mat);
      return `
        <div class="anki-sel-order-row" data-selid="${id}">
          <span class="anki-sel-order-n">${i + 1}</span>
          <span class="anki-pick-mat" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${m.label}</span>
          <span class="anki-pick-id">${c.id}</span>
          <span class="anki-sel-order-title">${esc(c.titre || (c.question || '').substring(0, 40))}</span>
          <span class="anki-sel-order-btns">
            <button type="button" class="bs anki-sel-move" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="event.stopPropagation();window.ankiMovePick('${id}',-1)">${window.iconHtml('chevron-up', 14)}</button>
            <button type="button" class="bs anki-sel-move" title="Descendre" ${i === ids.length - 1 ? 'disabled' : ''} onclick="event.stopPropagation();window.ankiMovePick('${id}',1)">${window.iconHtml('chevron-down', 14)}</button>
            <button type="button" class="bs anki-sel-move" title="Retirer" onclick="event.stopPropagation();window.ankiTogglePick('${id}')">${window.iconHtml('x', 14)}</button>
          </span>
        </div>`;
    }).join('');
  }

  function renderPickGridOnly() {
    const grid = $("ankiPickGrid");
    const stats = $("ankiPickStats");
    const scrollTop = grid ? grid.scrollTop : 0;
    if (!grid) { renderActiveView(); return; }
    const plan = computeCockpitPlan();
    S._effectiveIds = new Set(plan.cartes.map(c => c.id));
    const list = getCockpitDisplayList();
    const isManualTab = S.cockpitMode === 'manual';
    const limit = isManualTab ? 120 : 80;
    grid.innerHTML = list.map(c => renderPickPcard(c)).join('')
      || '<div class="anki-empty" style="grid-column:1/-1;">Aucun résultat</div>';
    if (stats) {
      stats.textContent = S.cockpitMode === 'manual'
        ? `${S.selectionIds.size} sélectionnée(s)`
        : `${S.pinnedIds.size} ajoutée(s) · ${S.excludedIds.size} retirée(s)`;
    }
    grid.scrollTop = scrollTop;
    renderSelOrderOnly();
    window.hydrateIcons(grid);
  }

  function renderSelOrderOnly() {
    const wrap = $("ankiSelOrderWrap");
    const box = $("ankiSelOrder");
    if (!wrap || !box) return;
    if (!S.selectionIds.size) {
      wrap.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    wrap.style.display = 'block';
    box.innerHTML = renderSelectionOrderRows();
    window.hydrateIcons(box);
  }

  function renderQueueRow(c, i) {
    const m = mat(c.mat);
    const today = window.AnkiAlgo.todayISO();
    const isLate = c.dateProchaineRevision && c.dateProchaineRevision < today;
    const kind = window.AnkiAlgo.cardKind(c);
    const kindTag = kind === 'devoir'
      ? `${window.iconHtml('file-text', 12)}W`
      : kind === 'quick'
        ? `${window.iconHtml('zap', 12)}Y`
        : `${window.iconHtml('brain', 12)}X`;
    const isDevoir = isDevoirCard(c);
    const dmRef = isDevoir && c.type === 'devoir-morceau'
      ? (ankFind(c._morceauOf) || c)
      : c;
    // Pour un DM : on affiche le temps PAR SESSION (pas la durée totale)
    const tempsAffiche = isDevoir
      ? Math.round(((dmRef._dureeTotaleMin || (dmRef.tempsCible / 60)) / (dmRef._morceauxTotal || 1)) * 10) / 10
      : ((c.tempsCible || 60) / 60).toFixed(1).replace(/\.0$/, '');
    const sessionInfo = isDevoir ? ` · session ${(dmRef._morceauxFaits || 0) + 1}/${dmRef._morceauxTotal || 1}` : '';
    return `
      <div class="anki-q-row ${isDevoir ? 'devoir' : ''}" draggable="true" data-id="${c.id}" data-idx="${i}">
        <span class="anki-q-handle" title="Glisser">⋮⋮</span>
        <div class="anki-q-num">${i + 1}</div>
        <div class="anki-q-mat" style="background:${m.color};">${isDevoir ? window.iconHtml('file-text', 12) : m.label}</div>
        <div class="anki-q-body" onclick="window.startAnkiSingle('${c.id}')">
          <div class="anki-q-title">${esc(c.titre || (c.question || '').substring(0, 60))}${sessionInfo}</div>
          <div class="anki-q-meta">${kindTag} · ${c.id} · ${cardAlgoStatsLine(c)} ${isLate ? '<span style="color:var(--red);">· retard</span>' : ''}</div>
        </div>
        <div class="anki-q-time" onclick="event.stopPropagation();">
          <input type="number" min="0.25" max="600" step="0.25" value="${tempsAffiche}" title="Temps en minutes — éditable"
            onchange="window.ankiUpdateTemps('${c.id}', this.value, ${isDevoir})">
          <span class="anki-mut">min</span>
        </div>
        <div class="anki-q-go" onclick="window.startAnkiSingle('${c.id}')">${window.iconHtml('play', 14)}</div>
      </div>
    `;
  }

  function renderPickCard(c) {
    return renderPickPcard(c);
  }

  // ====== VUE RÉSERVOIR (v4) ======
  // Liste toutes les cartes en réservoir (statut 'reservoir' ou 'attente' legacy),
  // groupées par matière, avec activation individuelle ou groupée vers 'actif'.
  function viewReservoir() {
    const exos = window.D.exercices || [];
    const all = exos.filter(c => window.AnkiAlgo.isReservoir(c) && !isQuickCard(c) && !isDevoirCard(c));
    // Filtres
    let list = all.slice();
    if (S.reservoirFilter.mat) list = list.filter(c => c.mat === S.reservoirFilter.mat);
    if (S.reservoirFilter.q) {
      const q = S.reservoirFilter.q.toLowerCase();
      list = list.filter(c => ((c.titre || '') + ' ' + (c.question || '') + ' ' + (c.id || '')).toLowerCase().includes(q));
    }
    // Groupement par matière
    const groups = {};
    list.forEach(c => {
      const k = c.mat || '?';
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    });
    const matKeys = Object.keys(groups).sort((a, b) => {
      const la = (mat(a).label || a), lb = (mat(b).label || b);
      return la.localeCompare(lb);
    });
    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${S.reservoirFilter.mat === m.id ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const selCount = S.reservoirSel.size;

    let html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <div>
            <h3>${window.iconLabel('hourglass', 'Réservoir')} <span class="anki-mut">(${all.length} cartes)</span></h3>
            <p class="anki-mut" style="font-size:12px;">Les cartes du réservoir n'entrent JAMAIS dans les sessions automatiques. Active-les manuellement quand tu veux les intégrer aux révisions.</p>
          </div>
          <div class="anki-block-actions">
            <button class="bp" data-testid="btn-reservoir-new-card" onclick="window.openExoModal()">+ Nouvelle carte X-</button>
          </div>
        </div>
        <div class="anki-filters">
          ${searchField('Titre, énoncé, code...', `data-testid="reservoir-search" value="${esc(S.reservoirFilter.q || '')}" oninput="window.ankiReservoirFilter('q', this.value)"`)}
          <select class="fi" data-testid="reservoir-mat-filter" onchange="window.ankiReservoirFilter('mat', this.value)">
            <option value="">Toutes matières</option>${matOpts}
          </select>
          <button class="bs" data-testid="btn-reservoir-clear-sel" onclick="window.ankiReservoirClearSel()">Vider sél. (${selCount})</button>
          <button class="bp" data-testid="btn-reservoir-activate-selected" onclick="window.ankiReservoirActivateSelected()" ${selCount === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>${window.iconLabel('zap', `Activer la sélection (${selCount})`)}</button>
        </div>
        ${list.length === 0 ? '<div class="anki-empty">Aucune carte dans le réservoir.</div>' : matKeys.map(k => {
          const m = mat(k);
          const cards = groups[k];
          return `
            <div class="anki-lib-group" data-testid="reservoir-group-${k}">
              <div class="anki-lib-group-hdr" style="border-left:4px solid ${m.color};">
                <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${m.label}</span>
                <span class="anki-lib-grp-t">${esc(m.name || k)}</span>
                <span class="anki-mut" style="margin-left:auto;">${cards.length}</span>
                <button class="bs" style="margin-left:8px;" data-testid="btn-reservoir-activate-mat-${k}" onclick="window.ankiReservoirActivateMat('${k}')">${window.iconLabel('zap', 'Activer toute la matière')}</button>
              </div>
              <div class="anki-lib-items">
                ${cards.map(c => renderReservoirRow(c)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    return html;
  }
  function renderReservoirRow(c) {
    const m = mat(c.mat);
    const checked = S.reservoirSel.has(c.id);
    const hasSrcE = c.sourceEnonce && (c.sourceEnonce.nom || c.sourceEnonce.details);
    const hasSrcC = c.sourceCorrection && (c.sourceCorrection.nom || c.sourceCorrection.details);
    const srcChips = [];
    if (hasSrcE) srcChips.push(`<span class="anki-tag" style="background:#ffaa3320;color:#ffaa33;border:1px solid #ffaa33;">${window.iconLabel('book-open', `Énoncé : ${esc(c.sourceEnonce.type || '?')} · ${esc(c.sourceEnonce.nom || '')} ${esc(c.sourceEnonce.details || '')}`)}</span>`);
    if (hasSrcC) srcChips.push(`<span class="anki-tag" style="background:#42b56b20;color:#42b56b;border:1px solid #42b56b;">${window.iconLabel('check', `Corrigé : ${esc(c.sourceCorrection.type || '?')} · ${esc(c.sourceCorrection.nom || '')} ${esc(c.sourceCorrection.details || '')}`)}</span>`);
    return `
      <div class="anki-lib-row" data-testid="reservoir-row-${c.id}">
        <label class="anki-pick ${checked ? 'on' : ''}" style="flex:0 0 auto;" data-pickid="res-${c.id}">
          <input type="checkbox" ${checked ? 'checked' : ''} data-testid="reservoir-check-${c.id}" onchange="window.ankiReservoirToggleSel('${c.id}')">
        </label>
        <span class="uid-badge anki-lib-id">${c.id}</span>
        <div class="anki-lib-text">
          <div class="anki-lib-title">${esc(c.titre || (c.question || '').substring(0, 70))}</div>
          <div class="anki-lib-meta">
            <span class="anki-tag" style="border-color:${m.color}80;color:${m.color};">${profileLabel(c.profil || 'COURS')}</span>
            <span class="anki-mut">${window.iconHtml('timer', 12)} ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)} · ${stars(c)}</span>
            <span class="anki-card-stats">${cardAlgoStatsLine(c)}</span>
            ${srcChips.join(' ')}
          </div>
        </div>
        <div class="anki-lib-acts">
          <button class="bp" data-testid="btn-reservoir-activate-${c.id}" onclick="window.ankiReservoirActivateOne('${c.id}')" title="Activer pour les révisions">${window.iconLabel('zap', 'Activer')}</button>
          ${window.iconBtn('pencil', 'Modifier', `onclick="window.editExo('${c.id}')"`)}
          ${window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red);border-color:var(--red);" onclick="window.delExo('${c.id}')"`)}
        </div>
      </div>
    `;
  }
  window.ankiReservoirFilter = function (k, v) { S.reservoirFilter[k] = v; renderActiveView(); };
  window.ankiReservoirToggleSel = function (id) {
    if (S.reservoirSel.has(id)) S.reservoirSel.delete(id);
    else S.reservoirSel.add(id);
    renderActiveView();
  };
  window.ankiReservoirClearSel = function () {
    S.reservoirSel.clear();
    renderActiveView();
  };
  function activateCardById(id) {
    const c = ankFind(id);
    if (!c) return false;
    return window.AnkiAlgo.activateFromReservoir(c);
  }
  window.ankiReservoirActivateOne = function (id) {
    if (activateCardById(id)) {
      S.reservoirSel.delete(id);
      window.AnkiAlgo.log("activate-reservoir", { id, mode: "single" });
      window.save();
      window.renderAnki();
    }
  };
  window.ankiReservoirActivateSelected = function () {
    const ids = Array.from(S.reservoirSel);
    let n = 0;
    ids.forEach(id => { if (activateCardById(id)) n++; });
    S.reservoirSel.clear();
    window.AnkiAlgo.log("activate-reservoir", { count: n, mode: "selected" });
    window.save();
    window.sysAlert(`${n} carte(s) activée(s) pour les révisions (échéance : aujourd'hui).`, "Réservoir");
    window.renderAnki();
  };
  window.ankiReservoirActivateMat = function (matId) {
    const list = (window.D.exercices || []).filter(c => c.mat === matId && window.AnkiAlgo.isReservoir(c));
    let n = 0;
    list.forEach(c => { if (window.AnkiAlgo.activateFromReservoir(c)) n++; });
    window.AnkiAlgo.log("activate-reservoir", { mat: matId, count: n, mode: "matiere" });
    window.save();
    window.sysAlert(`${n} carte(s) de la matière "${(mat(matId).name || matId)}" activées.`, "Réservoir");
    window.renderAnki();
  };

  // ===== Drag & drop =====
  function bindDragDrop() {
    const box = $("ankiQueueDrop");
    if (!box) return;
    let dragId = null;
    box.querySelectorAll('.anki-q-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragId = row.dataset.id;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = box.querySelector('.dragging');
        if (!dragging || dragging === row) return;
        const rect = row.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        box.insertBefore(dragging, after ? row.nextSibling : row);
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        const ids = Array.from(box.querySelectorAll('.anki-q-row')).map(r => r.dataset.id);
        S.manualOrder = ids;
        window.AnkiAlgo.log("reorder", { ids });
        renderActiveView();
      });
    });
  }

  function keepPageScroll(fn) {
    const y = window.scrollY || window.pageYOffset || 0;
    fn();
    requestAnimationFrame(function () { window.scrollTo(0, y); });
  }

  // ===== Sélection style Impression (grille pcard + ordre ↑↓) =====
  function togglePickAuto(id) {
    const base = window.AnkiAlgo.buildSession(ankSessionPool(), {
      sessionMinutes: (window.D.settings && window.D.settings.ankiSessionMin) || 60,
      includeNew: (window.D.settings && window.D.settings.ankiIncludeNew) || 5,
      selectedIds: null,
      manualOrder: null
    });
    const inBase = base.cartes.some(c => c.id === id);
    S.manualOrder = null;

    if (S.excludedIds.has(id)) {
      S.excludedIds.delete(id);
    } else if (S.pinnedIds.has(id)) {
      S.pinnedIds.delete(id);
      S.excludedIds.add(id);
    } else if (inBase) {
      S.excludedIds.add(id);
    } else {
      S.pinnedIds.add(id);
      S.excludedIds.delete(id);
    }
  }

  window.ankiTogglePick = function (id) {
    keepPageScroll(function () {
      if (S.cockpitMode === 'manual') {
        if (S.selectionIds.has(id)) {
          S.selectionIds.delete(id);
          S.selectionOrder = S.selectionOrder.filter(x => x !== id);
        } else {
          S.selectionIds.add(id);
          if (!S.selectionOrder.includes(id)) S.selectionOrder.push(id);
        }
        if (!S.selectionIds.size) S.manualOrder = null;
      } else {
        togglePickAuto(id);
      }
      renderPickGridOnly();
      refreshQueueOnly();
    });
  };

  window.ankiMovePick = function (id, dir) {
    syncSelectionOrder();
    const i = S.selectionOrder.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= S.selectionOrder.length) return;
    const tmp = S.selectionOrder[i];
    S.selectionOrder[i] = S.selectionOrder[j];
    S.selectionOrder[j] = tmp;
    S.manualOrder = S.selectionOrder.slice();
    renderSelOrderOnly();
    refreshQueueOnly();
  };
  function refreshQueueOnly() {
    const box = $("ankiQueueDrop");
    if (!box) return;
    const pageY = window.scrollY || window.pageYOffset || 0;
    const isManualTab = S.cockpitMode === 'manual';
    const plan = computeCockpitPlan();
    S._effectiveIds = new Set(plan.cartes.map(c => c.id));
    const cartes = plan.cartes;
    box.innerHTML = cartes.length === 0
      ? `<div class="anki-empty anki-queue-empty">${isManualTab ? window.iconLabel('search', 'Sélectionne des cartes en mode manuel.') : window.iconLabel('sparkles', 'Aucune carte à réviser.')}</div>`
      : cartes.map((c, i) => renderQueueRow(c, i)).join('');
    const meta = document.getElementById('ankiQueueMeta');
    if (meta) meta.textContent = `(${cartes.length} cartes · ${window.AnkiAlgo.fmtDur(plan.tempsTotalPrev)})`;
    bindDragDrop();
    window.hydrateIcons(box);
    requestAnimationFrame(function () { window.scrollTo(0, pageY); });
  }
  window.ankiSelectClear = function () {
    if (S.cockpitMode === 'manual') {
      S.selectionIds.clear();
      S.selectionOrder = [];
    } else {
      S.pinnedIds.clear();
      S.excludedIds.clear();
    }
    S.manualOrder = null;
    renderPickGridOnly();
    refreshQueueOnly();
  };
  window.ankiResetAutoAdjust = function () {
    S.pinnedIds.clear();
    S.excludedIds.clear();
    S.manualOrder = null;
    renderPickGridOnly();
    refreshQueueOnly();
  };
  window.ankiSelectAllPick = function () {
    S.selectionIds.clear();
    S.selectionOrder = [];
    getCockpitDisplayList().forEach(c => {
      S.selectionIds.add(c.id);
      S.selectionOrder.push(c.id);
    });
    S.manualOrder = null;
    renderPickGridOnly();
    refreshQueueOnly();
  };
  window.ankiUpdateTemps = function (id, valMin, isDevoir) {
    const c = ankFind(id);
    if (!c) return;
    const minVal = parseFloat(valMin) || 1;
    if (isDevoir) {
      // Pour un DM : on modifie le temps PAR SESSION, donc on recalcule la durée totale = min × morceauxRestants
      const restants = (c._morceauxTotal || 1) - (c._morceauxFaits || 0);
      c.tempsCible = Math.round(minVal * 60) * Math.max(1, restants);
      c._dureeTotaleMin = minVal * (c._morceauxTotal || 1);
    } else {
      c.tempsCible = Math.round(minVal * 60);
    }
    window.AnkiAlgo.log("update-temps", { id, min: minVal, isDevoir: !!isDevoir });
    window.save();
    refreshQueueOnly();
  };
  window.ankiResetManualOrder = function () {
    S.manualOrder = null;
    window.AnkiAlgo.log("reorder", { reset: true });
    renderActiveView();
  };
  window.ankiQuickEditSession = function () {
    const cur = (window.D.settings && window.D.settings.ankiSessionMin) || 60;
    const val = prompt("Durée de la session (minutes) :", cur);
    if (val === null) return;
    window.D.settings.ankiSessionMin = Math.max(5, Math.min(240, parseInt(val) || cur));
    window.save(); renderActiveView();
  };

  // ====== VUE BIBLIOTHÈQUE ======
  function viewLibrary() {
    let list = window.D.exercices.slice().filter(c => isMainCard(c));
    if (S.libFilter.mat) list = list.filter(c => c.mat === S.libFilter.mat);
    if (S.libFilter.stat) {
      if (S.libFilter.stat === 'reservoir') list = list.filter(c => window.AnkiAlgo.isReservoir(c));
      else list = list.filter(c => c.statut === S.libFilter.stat);
    }
    if (S.libFilter.profil) list = list.filter(c => (c.profil || "COURS") === S.libFilter.profil);
    if (S.libFilter.q) {
      const q = S.libFilter.q.toLowerCase();
      list = list.filter(c => ((c.titre || "") + ' ' + (c.question || "") + ' ' + c.id).toLowerCase().includes(q));
    }
    list.sort((a, b) => (a.dateProchaineRevision || "9999").localeCompare(b.dateProchaineRevision || "9999"));

    const byMat = {};
    list.forEach(c => {
      const matId = c.mat || "?";
      const coursId = (c.coursIds && c.coursIds[0]) || "—";
      const gk = matId + "|" + coursId;
      if (!byMat[matId]) byMat[matId] = {};
      if (!byMat[matId][gk]) byMat[matId][gk] = [];
      byMat[matId][gk].push(c);
    });

    const matOrder = (window.D.matieres || []).map(m => m.id).filter(id => byMat[id]);
    Object.keys(byMat).forEach(id => { if (!matOrder.includes(id)) matOrder.push(id); });

    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${S.libFilter.mat === m.id ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const profOpts = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${S.libFilter.profil === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('');
    const matChips = (window.D.matieres || []).map(m => {
      const n = (byMat[m.id] && Object.values(byMat[m.id]).reduce((s, a) => s + a.length, 0)) || 0;
      if (!n && S.libFilter.mat !== m.id) return '';
      return `<button type="button" class="anki-lib-chip${S.libFilter.mat === m.id ? ' on' : ''}" onclick="window.ankiLibFilter('mat','${m.id}')">${m.label} <span class="anki-lib-chip-n">${n}</span></button>`;
    }).join('');
    const autoExpand = !!S.libFilter.q;

    let html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Bibliothèque (${list.length})</h3>
          <div class="anki-block-actions">
            <button class="bp" onclick="window.openExoModal()">+ Nouvelle carte</button>
          </div>
        </div>
        <div class="anki-filters">
          ${searchField('Titre, énoncé, code...', `value="${esc(S.libFilter.q)}" oninput="window.ankiLibFilter('q', this.value)"`)}
          <select class="fi" onchange="window.ankiLibFilter('mat', this.value)"><option value="">Toutes matières</option>${matOpts}</select>
          <select class="fi" onchange="window.ankiLibFilter('stat', this.value)">
            <option value="">Tous statuts</option>
            <option value="actif" ${S.libFilter.stat === 'actif' ? 'selected' : ''}>Actif</option>
            <option value="reservoir" ${S.libFilter.stat === 'reservoir' ? 'selected' : ''}>Réservoir</option>
          </select>
          <select class="fi" onchange="window.ankiLibFilter('profil', this.value)"><option value="">Tous profils</option>${profOpts}</select>
        </div>
        <div class="anki-lib-chips">
          <button type="button" class="anki-lib-chip${!S.libFilter.mat ? ' on' : ''}" onclick="window.ankiLibFilter('mat','')">Toutes</button>
          ${matChips}
        </div>
        <div class="anki-lib">
    `;

    if (!list.length) {
      html += '<div class="anki-empty">Aucune carte ne correspond aux filtres.</div>';
    } else {
      html += matOrder.map(matId => {
        const m = mat(matId);
        const chGroups = byMat[matId];
        const matCount = Object.values(chGroups).reduce((s, arr) => s + arr.length, 0);
        const matOpen = autoExpand || S.libOpenMat.has(matId);
        const grpKeys = Object.keys(chGroups).sort();
        return `
          <div class="anki-lib-mat${matOpen ? ' open' : ''}" data-mat="${esc(matId)}">
            <div class="anki-lib-mat-hdr" style="border-left:4px solid ${m.color};" onclick="window.ankiLibToggleMat('${esc(matId)}')" role="button" tabindex="0">
              <span class="anki-lib-chevron">${matOpen ? '▼' : '▶'}</span>
              <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${m.label}</span>
              <span class="anki-lib-mat-name">${esc(m.name || matId)}</span>
              <span class="anki-mut" style="margin-left:auto;">${matCount} carte${matCount > 1 ? 's' : ''}</span>
            </div>
            <div class="anki-lib-mat-body"${matOpen ? '' : ' hidden'}>
              ${grpKeys.map(gk => {
                const coursId = gk.split('|')[1];
                const co = (window.D.cours || []).find(x => x.uid === coursId);
                const grpTitle = co ? `${co.uid} · ${co.title}` : (coursId === '—' ? 'Sans cours lié' : coursId);
                const grpOpen = autoExpand || S.libOpenGrp.has(gk);
                const cards = chGroups[gk];
                return `
                  <div class="anki-lib-group${grpOpen ? ' open' : ''}">
                    <div class="anki-lib-group-hdr" onclick="window.ankiLibToggleGrp('${esc(gk)}')" role="button" tabindex="0">
                      <span class="anki-lib-chevron">${grpOpen ? '▼' : '▶'}</span>
                      <span class="anki-lib-grp-t">${esc(grpTitle)}</span>
                      <span class="anki-mut" style="margin-left:auto;">${cards.length}</span>
                    </div>
                    <div class="anki-lib-items"${grpOpen ? '' : ' hidden'}>
                      ${grpOpen ? cards.map(c => renderLibRow(c)).join('') : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }
    html += '</div></div>';
    return html;
  }

  function renderLibRow(c) {
    const m = mat(c.mat);
    return `
      <div class="anki-lib-row">
        <span class="uid-badge anki-lib-id">${c.id}</span>
        <div class="anki-lib-text">
          <div class="anki-lib-title">${esc(c.titre || (c.question || '').substring(0, 70))}</div>
          <div class="anki-lib-meta">
            <span class="anki-tag" style="border-color:${m.color}80;color:${m.color};">${profileLabel(c.profil || 'COURS')}</span>
            <span class="anki-mut">${window.iconHtml('timer', 12)} ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)} · ${stars(c)}</span>
            <span class="anki-card-stats">${cardAlgoStatsLine(c)}</span>
          </div>
        </div>
        <div class="anki-lib-acts">
          ${window.iconBtn('play', 'Réviser', `onclick="window.startAnkiSingle('${c.id}')"`)}
          ${window.iconBtn('pencil', 'Modifier', `onclick="window.editExo('${c.id}')"`)}
          ${window.iconBtn('calendar', 'Décaler', `onclick="event.stopPropagation();window.ankiAdjustNext('${c.id}')"`)}
          ${window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red);border-color:var(--red);" onclick="event.stopPropagation();window.delExo('${c.id}')"`)}
        </div>
      </div>
    `;
  }
  window.ankiLibFilter = function (k, v) {
    const apply = function () {
      S.libFilter[k] = v;
      keepPageScroll(renderActiveView);
    };
    if (k === 'q') {
      clearTimeout(S.libFilterTimer);
      S.libFilterTimer = setTimeout(apply, 280);
      return;
    }
    if (k === 'mat' && v) S.libOpenMat.add(v);
    apply();
  };
  window.ankiLibToggleMat = function (matId) {
    keepPageScroll(function () {
      if (S.libOpenMat.has(matId)) S.libOpenMat.delete(matId);
      else S.libOpenMat.add(matId);
      renderActiveView();
    });
  };
  window.ankiLibToggleGrp = function (gk) {
    keepPageScroll(function () {
      if (S.libOpenGrp.has(gk)) S.libOpenGrp.delete(gk);
      else S.libOpenGrp.add(gk);
      renderActiveView();
    });
  };
  window.ankiAdjustNext = function (id) {
    const c = ankFind(id);
    if (!c) return;
    const cur = c.dateProchaineRevision || window.AnkiAlgo.todayISO();
    if (typeof window.fcOpenShiftDate === 'function') {
      window.fcOpenShiftDate({
        subtitle: (c.titre || c.id) + ' — prochaine révision',
        current: cur,
        onApply: function (newDate) {
          const from = cur;
          c.dateProchaineRevision = newDate;
          window.AnkiAlgo.log('manual-shift', { id, from, to: newDate });
          window.save();
          renderActiveView();
        }
      });
      return;
    }
    const d = prompt(`Décale de combien de jours ? (négatif = avancer)\nDate actuelle : ${cur}`, '0');
    if (d === null) return;
    c.dateProchaineRevision = window.AnkiAlgo.addDays(cur, parseInt(d) || 0);
    window.AnkiAlgo.log('manual-shift', { id, from: cur, to: c.dateProchaineRevision });
    window.save();
    renderActiveView();
  };

  // ====== VUE PRÉVISIONS (barres + calendrier jour par jour) ======
  function viewForecast() {
    const sch = window.AnkiAlgo.forecastSchedule(ankSessionPool(), S.forecastDays);
    const dates = Object.keys(sch).sort();
    const charges = dates.map(d => sch[d].reduce((s, c) => s + (c.tempsCible || 60), 0));
    const max = Math.max(1, ...charges);
    const maxDay = (window.D.settings.ankiMaxPerDay || 75) * 60;

    return `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Prévisions (${S.forecastDays} jours)</h3>
          <div class="anki-block-actions">
            <button class="bs ${S.forecastDays === 7 ? 'on-bs' : ''}" onclick="window.ankiForecastDays(7)">7j</button>
            <button class="bs ${S.forecastDays === 14 ? 'on-bs' : ''}" onclick="window.ankiForecastDays(14)">14j</button>
            <button class="bs ${S.forecastDays === 30 ? 'on-bs' : ''}" onclick="window.ankiForecastDays(30)">30j</button>
          </div>
        </div>
        <div class="anki-forecast-bars">
          ${dates.map((d, i) => {
            const total = charges[i];
            const pct = Math.round((total / max) * 100);
            const over = total > maxDay;
            const dd = d.substring(5).replace('-', '/');
            const isToday = d === window.AnkiAlgo.todayISO();
            return `<div class="anki-fc-col ${isToday ? 'today' : ''} ${S.expandedDay === d ? 'sel' : ''}" onclick="window.ankiToggleDay('${d}')" title="${d} — ${sch[d].length} cartes · ${window.AnkiAlgo.fmtDur(total)}">
              <div class="anki-fc-n">${sch[d].length || ''}</div>
              <div class="anki-fc-bar ${over ? 'over' : ''}" style="height:${Math.max(2, pct)}%;"></div>
              <div class="anki-fc-lbl">${dd}</div>
            </div>`;
          }).join('')}
        </div>

        <div class="anki-cal-list" style="margin-top:14px;">
          ${dates.map(d => {
            const cards = sch[d];
            const total = cards.reduce((s, c) => s + (c.tempsCible || 60), 0);
            const isToday = d === window.AnkiAlgo.todayISO();
            // Par défaut tout fermé ; ouvert SI l'utilisateur a cliqué
            const open = S.expandedDay === d;
            if (!cards.length) return '';
            return `
              <div class="anki-cal-day ${isToday ? 'today' : ''}">
                <div class="anki-cal-day-hdr" onclick="window.ankiToggleDay('${d}')">
                  <strong>${isToday ? window.iconLabel('map-pin', "Aujourd'hui") : d}</strong>
                  <span class="anki-mut">${cards.length} cartes · ${window.AnkiAlgo.fmtDur(total)}</span>
                  <span class="anki-mut" data-icon="${open ? 'chevron-down' : 'chevron-right'}" data-icon-size="12"></span>
                </div>
                ${open ? `<div class="anki-cal-day-list">${cards.map((c, i) => renderCalCard(c, i)).join('')}</div>` : ''}
              </div>
            `;
          }).join('') || '<div class="anki-empty">Aucune révision prévue.</div>'}
        </div>
      </div>
    `;
  }
  function renderCalCard(c, i) {
    const m = mat(c.mat);
    return `
      <div class="anki-cal-row">
        <span class="anki-day-num">${i + 1}</span>
        <span class="anki-q-mat" style="background:${m.color};">${m.label}</span>
        <span class="uid-badge">${c.id}</span>
        <span class="anki-day-title">${esc(c.titre || (c.question || '').substring(0, 80))}</span>
        <span class="anki-mut">${window.iconHtml('timer', 12)} ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)}</span>
        ${window.iconBtn('calendar', 'Décaler', `onclick="event.stopPropagation();window.ankiAdjustNext('${c.id}')"`)}
        ${window.iconBtn('play', 'Réviser', `onclick="event.stopPropagation();window.startAnkiSingle('${c.id}')"`)}
      </div>
    `;
  }
  window.ankiForecastDays = function (n) { S.forecastDays = n; renderActiveView(); };
  window.ankiToggleDay = function (d) { S.expandedDay = S.expandedDay === d ? null : d; renderActiveView(); };

  // SVG line chart pour stats hebdo
  function renderStatsCurve(week, byDay) {
    const W = 600, H = 180, PAD_L = 32, PAD_R = 32, PAD_T = 14, PAD_B = 24;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const maxN = Math.max(1, ...week.map(d => byDay[d].total));
    const xStep = innerW / Math.max(1, week.length - 1);
    // Courbe quantité (échelle gauche, max=maxN)
    const ptsN = week.map((d, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + innerH - (byDay[d].total / maxN) * innerH;
      return { x, y, val: byDay[d].total, d };
    });
    // Courbe qualité moyenne (échelle droite, 0-10)
    const ptsQ = week.map((d, i) => {
      const x = PAD_L + i * xStep;
      const q = byDay[d].total ? byDay[d].sumQ / byDay[d].total : null;
      const y = q === null ? null : PAD_T + innerH - (q / 10) * innerH;
      return { x, y, q, d };
    });
    const pathN = ptsN.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
    const pathQ = ptsQ.filter(p => p.y !== null).map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
    // Aire sous la courbe quantité
    const areaN = `${pathN} L ${ptsN[ptsN.length-1].x},${PAD_T + innerH} L ${ptsN[0].x},${PAD_T + innerH} Z`;
    return `
      <div class="anki-curve-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="anki-curve" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gradN" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--acc)" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="var(--acc)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${[0,0.25,0.5,0.75,1].map(t => `<line x1="${PAD_L}" x2="${W-PAD_R}" y1="${PAD_T + innerH * t}" y2="${PAD_T + innerH * t}" stroke="var(--bd)" stroke-width="1" stroke-dasharray="2,3"/>`).join('')}
          <path d="${areaN}" fill="url(#gradN)"/>
          <path d="${pathN}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${pathQ ? `<path d="${pathQ}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4,3" stroke-linejoin="round"/>` : ''}
          ${ptsN.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--bg)" stroke="var(--acc)" stroke-width="2"/>`).join('')}
          ${ptsQ.filter(p => p.y !== null).map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--gold)"/>`).join('')}
          ${ptsN.map(p => `<text x="${p.x}" y="${H-6}" text-anchor="middle" fill="var(--mut)" font-size="10" font-family="DM Mono, monospace">${p.d.substring(8) + '/' + p.d.substring(5,7)}</text>`).join('')}
          ${ptsN.map(p => p.val ? `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="var(--acc)" font-size="11" font-weight="700">${p.val}</text>` : '').join('')}
        </svg>
        <div class="anki-curve-legend">
          <span><span class="anki-leg-dot" style="background:var(--acc);"></span> Nombre de cartes</span>
          <span><span class="anki-leg-dot" style="background:var(--gold);"></span> Qualité moy. (0-10)</span>
        </div>
      </div>
    `;
  }

  // ====== VUE STATS ======
  function viewStats() {
    const today = window.AnkiAlgo.todayISO();
    const exos = ankAllCards();
    // Filtre des évaluations d'aujourd'hui
    const todayEvals = [];
    exos.forEach(c => {
      (c.historique || []).forEach(h => {
        if (h.date && h.date.substring(0, 10) === today) {
          todayEvals.push({ card: c, h });
        }
      });
    });
    const nOk = todayEvals.filter(e => e.h.qScore >= 8).length;
    const nMid = todayEvals.filter(e => e.h.qScore >= 4 && e.h.qScore < 8).length;
    const nBad = todayEvals.filter(e => e.h.qScore < 4).length;
    const total = todayEvals.length;

    // Temps réel total
    const tempsReel = todayEvals.reduce((s, e) => s + (e.h.tempsReel || 0), 0);
    // Temps prévu total (somme des tempsCible des cartes faites)
    const tempsPrevu = todayEvals.reduce((s, e) => s + (e.card.tempsCible || 0), 0);

    // Note d'efficacité : 0-100
    // Facteur exactitude : moyenne des qScore (0-10) → /10
    const moyQ = total ? todayEvals.reduce((s, e) => s + (e.h.qScore || 0), 0) / total : 0;
    const factExact = moyQ / 10; // 0-1
    // Facteur vitesse : tempsPrevu/tempsReel (cap 1.2)
    const factVit = tempsPrevu && tempsReel ? Math.min(1.2, tempsPrevu / tempsReel) : 1;
    // Facteur volume : min(1, total / 10) (10 cartes = volume idéal)
    const factVol = total ? Math.min(1, total / 10) : 0;
    // Note finale : exactitude pondère 50%, vitesse 25%, volume 25%
    const note = Math.round((factExact * 0.5 + (factVit / 1.2) * 0.25 + factVol * 0.25) * 100);
    const noteColor = note >= 75 ? 'var(--grn)' : note >= 50 ? 'var(--gold)' : 'var(--red)';

    // Stats par matière (7 derniers jours)
    const week = Array.from({ length: 7 }, (_, i) => window.AnkiAlgo.addDays(today, -6 + i));
    const byDay = {};
    week.forEach(d => byDay[d] = { ok: 0, mid: 0, bad: 0, total: 0, sumQ: 0 });
    exos.forEach(c => {
      (c.historique || []).forEach(h => {
        const d = h.date && h.date.substring(0, 10);
        if (byDay[d]) {
          byDay[d].total++;
          byDay[d].sumQ += (h.qScore || 0);
          if ((h.qScore || 0) >= 8) byDay[d].ok++;
          else if ((h.qScore || 0) >= 4) byDay[d].mid++;
          else byDay[d].bad++;
        }
      });
    });
    const maxDay = Math.max(1, ...week.map(d => byDay[d].total));

    // Stats par matière (depuis le début)
    const matStats = {};
    exos.forEach(c => {
      const k = c.mat || '?';
      if (!matStats[k]) matStats[k] = { total: 0, ok: 0, bad: 0, easeSum: 0, easeN: 0, cards: 0 };
      matStats[k].cards++;
      matStats[k].easeSum += c.ease || 2.5;
      matStats[k].easeN++;
      (c.historique || []).forEach(h => {
        matStats[k].total++;
        if ((h.qScore || 0) >= 8) matStats[k].ok++;
        if ((h.qScore || 0) < 4) matStats[k].bad++;
      });
    });

    return `
      <div class="anki-card-block">
        <h3>${window.iconLabel('bar-chart', 'Efficacité de la session du jour')}</h3>
        <div class="anki-stat-hero">
          <div class="anki-stat-note" style="color:${noteColor};">${total ? note + '/100' : '—'}</div>
          <div class="anki-mut">${total ? "Note d&apos;efficacité" : "Aucune carte révisée aujourd&apos;hui"}</div>
        </div>
        <div class="anki-stat-bars">
          <div class="anki-stat-bar-row">
            <span class="anki-stat-lbl">Exactitude</span>
            <div class="anki-stat-bar-bg"><div class="anki-stat-bar-fill" style="width:${factExact * 100}%;background:var(--grn);"></div></div>
            <span class="anki-stat-val">${(factExact * 100).toFixed(0)}%</span>
          </div>
          <div class="anki-stat-bar-row">
            <span class="anki-stat-lbl">Vitesse</span>
            <div class="anki-stat-bar-bg"><div class="anki-stat-bar-fill" style="width:${Math.min(100, (factVit / 1.2) * 100)}%;background:var(--acc);"></div></div>
            <span class="anki-stat-val">${(factVit * 100).toFixed(0)}%</span>
          </div>
          <div class="anki-stat-bar-row">
            <span class="anki-stat-lbl">Volume</span>
            <div class="anki-stat-bar-bg"><div class="anki-stat-bar-fill" style="width:${factVol * 100}%;background:var(--gold);"></div></div>
            <span class="anki-stat-val">${total}/10</span>
          </div>
        </div>
        <div class="anki-stat-grid">
          <div class="kpi"><div class="kpi-n" style="color:var(--grn);">${nOk}</div><div class="kpi-l">Parfait ≥8</div></div>
          <div class="kpi"><div class="kpi-n" style="color:var(--gold);">${nMid}</div><div class="kpi-l">Étourderie 4-7</div></div>
          <div class="kpi"><div class="kpi-n" style="color:var(--red);">${nBad}</div><div class="kpi-l">Blocage &lt;4</div></div>
          <div class="kpi"><div class="kpi-n">${window.AnkiAlgo.fmtDur(tempsReel)}</div><div class="kpi-l">Temps réel</div></div>
          <div class="kpi"><div class="kpi-n anki-mut">${window.AnkiAlgo.fmtDur(tempsPrevu)}</div><div class="kpi-l">Temps prévu</div></div>
        </div>
        <details class="anki-stat-details">
          <summary class="anki-mut" style="cursor:pointer;font-size:12px;">${window.iconLabel('scale', 'Comment la note est calculée')}</summary>
          <pre class="anki-formula" style="white-space:pre-wrap;font-size:11px;">note = 50% × exactitude(moyQ/10) + 25% × vitesse(prévu/réel, max 1.2) + 25% × volume(min(1, n/10))
moyQ = ${moyQ.toFixed(1)} · prévu/réel = ${tempsPrevu && tempsReel ? (tempsPrevu/tempsReel).toFixed(2) : '—'} · n = ${total}</pre>
        </details>
      </div>

      <div class="anki-card-block">
        <h3>${window.iconLabel('trending-up', 'Évolution sur 7 jours')}</h3>
        <p class="anki-mut" style="font-size:11px;margin-bottom:10px;">Courbe du nombre de cartes révisées par jour + courbe de la qualité moyenne (0-10).</p>
        ${renderStatsCurve(week, byDay)}
      </div>

      <div class="anki-card-block">
        <h3>${window.iconLabel('target', 'Par matière')}</h3>
        <table class="anki-diag-table">
          <thead><tr><th>Matière</th><th>Cartes</th><th>Révisions</th><th>${window.iconHtml('check', 14, 'eval-good')}</th><th>${window.iconHtml('circle-x', 14, 'eval-bad')}</th><th>Ease moy.</th></tr></thead>
          <tbody>
            ${Object.keys(matStats).map(k => {
              const m = mat(k);
              const s = matStats[k];
              const easeMoy = (s.easeSum / s.easeN).toFixed(2);
              const easeCol = parseFloat(easeMoy) < 2.0 ? 'var(--red)' : parseFloat(easeMoy) < 2.4 ? 'var(--gold)' : 'var(--grn)';
              return `<tr>
                <td><span class="anki-q-mat" style="background:${m.color};">${m.label}</span> ${m.name}</td>
                <td>${s.cards}</td>
                <td>${s.total}</td>
                <td>${s.ok}</td>
                <td>${s.bad}</td>
                <td style="color:${easeCol};font-weight:700;">${easeMoy}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="anki-mut">Aucune donnée</td></tr>'}
          </tbody>
        </table>
        <p class="anki-mut" style="font-size:11px;margin-top:8px;">Ease faible (rouge) = matière où tu galères. L'algo va y mettre plus d'urgence automatiquement.</p>
      </div>
    `;
  }


  // ====== VUE RÉGLAGES ======
  function viewSettings() {
    const st = window.D.settings || {};
    if (!st.ankiProfiles) st.ankiProfiles = JSON.parse(JSON.stringify(window.AnkiAlgo.DEFAULT_PROFILES));
    if (!st.ankiCoefs) st.ankiCoefs = Object.assign({}, window.AnkiAlgo.DEFAULT_COEFS);
    const C = st.ankiCoefs;

    const coefRow = (k, label, step) => `
      <div class="anki-set-row">
        <label>${label} <code class="anki-mut">${k}</code></label>
        <input type="number" class="fi" step="${step || 0.1}" value="${C[k]}" onchange="window.D.settings.ankiCoefs.${k}=parseFloat(this.value)||0;window.save();window.renderAnki();">
      </div>
    `;

    const profilesHtml = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(k => {
      const p = st.ankiProfiles[k] || window.AnkiAlgo.DEFAULT_PROFILES[k];
      return `
        <div class="anki-prof">
          <div class="anki-prof-hdr"><strong>${p.label || k}</strong><span class="anki-mut">${k}</span></div>
          <label class="anki-mut" style="font-size:11px;">Étapes (jours)</label>
          <input class="fi" id="prof_${k}_steps" value="${(p.steps || []).join(', ')}" oninput="window.ankiSaveProfile('${k}')">
          <label class="anki-mut" style="font-size:11px;">Ease initiale</label>
          <input class="fi" type="number" step="0.1" min="1.3" max="3.0" id="prof_${k}_ease" value="${p.ease}" oninput="window.ankiSaveProfile('${k}')">
        </div>
      `;
    }).join('');

    return `
      <div class="anki-card-block">
        <h3>Maintenance / Démo</h3>
        <p class="anki-mut" style="font-size:12px;">Si tu utilises les données de démo et que les dates ne sont plus à jour (ex: tu reviens après plusieurs jours), recale-les sur aujourd'hui.</p>
        <button class="bs" onclick="window.ankiRecalDates()">${window.iconLabel('calendar', "Recaler toutes les dates sur aujourd'hui")}</button>
        <button class="bs" onclick="window.ankiRebuildPieces()" style="margin-left:6px;">${window.iconLabel('refresh-cw', 'Re-découper les devoirs en morceaux')}</button>
      </div>

      <div class="anki-card-block">
        <h3>Session</h3>
        <div class="anki-set-row">
          <label>Durée de session (min)</label>
          <input type="number" class="fi" min="5" max="300" step="5" value="${st.ankiSessionMin || 60}" onchange="window.D.settings.ankiSessionMin=Math.max(5,Math.min(300,parseInt(this.value)||60));window.save();window.renderAnki();">
          <p class="anki-mut" style="font-size:11px;margin-top:4px;">Même réglage que la barre « Durée session » en haut du Synchrotron (max 5 h).</p>
        </div>
        <div class="anki-set-row">
          <label>Nouvelles cartes / session (legacy — réservoir activé manuellement)</label>
          <input type="number" class="fi" min="0" max="30" value="${st.ankiIncludeNew !== undefined ? st.ankiIncludeNew : 0}" onchange="window.D.settings.ankiIncludeNew=parseInt(this.value)||0;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Charge max / jour (min)</label>
          <input type="number" class="fi" min="15" max="240" value="${st.ankiMaxPerDay || 75}" onchange="window.D.settings.ankiMaxPerDay=parseInt(this.value)||75;window.save();">
        </div>
        <div class="anki-set-row">
          <label>Seuil d'urgence I_R min. pour inclusion X-/Y- <code class="anki-mut">ankiUrgenceSeuil</code></label>
          <input type="number" class="fi" step="0.1" min="0" value="${st.ankiUrgenceSeuil != null ? st.ankiUrgenceSeuil : 0}" onchange="window.D.settings.ankiUrgenceSeuil=parseFloat(this.value)||0;window.save();window.renderAnki();">
        </div>
        <p class="anki-mut" style="font-size:11px;">0 = pas de filtre. Sinon seules les cartes X-/Y- dont le score I_R ≥ seuil entrent en session (les retards passent toujours en priorité).</p>
        <div class="anki-set-row">
          <label>Seuil urgence devoir forcé (Phase 0) <code class="anki-mut">seuilDevoirForce</code></label>
          <input type="number" class="fi" min="0" max="100" step="5" value="${st.seuilDevoirForce != null ? st.seuilDevoirForce : 35}" onchange="window.D.settings.seuilDevoirForce=parseInt(this.value)||35;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Max cartes rapides Y- en fin de session <code class="anki-mut">ankiMaxAnglaisFill</code></label>
          <input type="number" class="fi" min="0" max="30" value="${st.ankiMaxAnglaisFill != null ? st.ankiMaxAnglaisFill : 5}" onchange="window.D.settings.ankiMaxAnglaisFill=parseInt(this.value)||5;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Marge budget de session <code class="anki-mut">margeBudget</code> (0.5–1.0, défaut 0.92)</label>
          <input type="number" class="fi" data-testid="input-marge-budget" min="0.5" max="1.0" step="0.01" value="${st.margeBudget != null ? st.margeBudget : 0.92}" onchange="window.D.settings.margeBudget=Math.max(0.5,Math.min(1.0,parseFloat(this.value)||0.92));window.save();window.renderAnki();">
        </div>
        <p class="anki-mut" style="font-size:11px;">Exemple : 0.85 → la session se limite à 85% du temps demandé pour garder de la marge.</p>
      </div>

      <div class="anki-card-block">
        <h3>${window.iconLabel('zap', 'Ease élastique (anti-Ease Hell)')}</h3>
        <p class="anki-mut" style="font-size:12px;">En cas d'échec (qScore ≤ seuil), l'ease baisse de <code>EASE_DROP_FAIL</code> (défaut −0.20). Un <b>boost d'urgence temporaire</b> (_blocageActif) propulse la carte en tête jusqu'à validation.</p>
        <div class="anki-set-row">
          <label>Baisse de l'ease en cas d'échec <code class="anki-mut">EASE_DROP_FAIL</code></label>
          <input type="number" class="fi" data-testid="input-ease-drop" min="0" max="0.5" step="0.01" value="${C.EASE_DROP_FAIL != null ? C.EASE_DROP_FAIL : 0.20}" onchange="window.D.settings.ankiCoefs.EASE_DROP_FAIL=parseFloat(this.value)||0.20;window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>qScore qui déclenche le boost de blocage <code class="anki-mut">BLOCAGE_QSCORE_TRIGGER</code></label>
          <input type="number" class="fi" data-testid="input-bloc-trigger" min="0" max="10" step="1" value="${C.BLOCAGE_QSCORE_TRIGGER != null ? C.BLOCAGE_QSCORE_TRIGGER : 3}" onchange="window.D.settings.ankiCoefs.BLOCAGE_QSCORE_TRIGGER=parseInt(this.value);window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>qScore qui lève le blocage <code class="anki-mut">BLOCAGE_QSCORE_VALIDATE</code></label>
          <input type="number" class="fi" data-testid="input-bloc-validate" min="1" max="10" step="1" value="${C.BLOCAGE_QSCORE_VALIDATE != null ? C.BLOCAGE_QSCORE_VALIDATE : 8}" onchange="window.D.settings.ankiCoefs.BLOCAGE_QSCORE_VALIDATE=parseInt(this.value);window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Timeout : nb max de révisions sous blocage avant libération auto <code class="anki-mut">BLOCAGE_TIMEOUT_REV</code></label>
          <input type="number" class="fi" data-testid="input-bloc-timeout" min="1" max="50" step="1" value="${C.BLOCAGE_TIMEOUT_REV != null ? C.BLOCAGE_TIMEOUT_REV : 5}" onchange="window.D.settings.ankiCoefs.BLOCAGE_TIMEOUT_REV=parseInt(this.value);window.save();window.renderAnki();">
        </div>
        <div class="anki-set-row">
          <label>Ease "virtuelle" pendant le boost <code class="anki-mut">BLOCAGE_BOOST_EASE_VAL</code></label>
          <input type="number" class="fi" min="1.3" max="3.0" step="0.05" value="${C.BLOCAGE_BOOST_EASE_VAL != null ? C.BLOCAGE_BOOST_EASE_VAL : 1.3}" onchange="window.D.settings.ankiCoefs.BLOCAGE_BOOST_EASE_VAL=parseFloat(this.value)||1.3;window.save();window.renderAnki();">
        </div>
      </div>

      <div class="anki-card-block">
        <h3>${window.iconLabel('scale', 'Index de Délai Relatif (I_R)')}</h3>
        <p class="anki-mut" style="font-size:12px;">
          <b>I_R</b> = (jours écoulés depuis la dernière révision) / (intervalle prévu).<br>
          · <b>I_R &lt; 1</b> (en avance) → urgence en exponentielle douce <code>exp(K · (I_R−1))</code><br>
          · <b>I_R = 1</b> (jour J) → valeur nominale<br>
          · <b>I_R &gt; 1</b> (en retard) → urgence linéaire <code>1 + γ · (I_R−1)</code> — les petits intervalles en retard montent vite.
        </p>
        ${coefRow('W_urgenceTemps', 'Poids global de la composante temporelle I_R')}
        ${coefRow('K_PROCHE', 'K — exposant de la montée exponentielle (I_R < 1)', 0.1)}
        ${coefRow('GAMMA_RETARD', 'γ — pente du retard linéaire (I_R > 1)', 0.1)}
      </div>

      <div class="anki-card-block">
        <h3>Importance (étoiles)</h3>
        <p class="anki-mut" style="font-size:12px;">Chaque carte a 1 à 5★. Plus c'est élevé, plus elle monte en session (<code>W_priorite</code>) et plus les intervalles entre révisions sont serrés (×0,55 à ×1,35).</p>
      </div>

      <div class="anki-card-block">
        <h3>Coefficients du score d'urgence</h3>
        <p class="anki-mut" style="font-size:12px;">Plus un poids est élevé, plus la composante influence l'ordre de passage.</p>
        ${coefRow('W_retard', 'Poids du retard (par jour)')}
        ${coefRow('W_proche', 'Poids de la proximité (approche)')}
        ${coefRow('TAU', 'τ — constante de temps (jours)', 0.5)}
        ${coefRow('W_priorite', 'Poids de l\'importance (étoiles)')}
        ${coefRow('W_nouveau', 'Bonus nouvelles cartes')}
        ${coefRow('W_ease', 'Poids de la difficulté (ease bas → monte)')}
        <button class="bs" style="margin-top:10px;" onclick="window.D.settings.ankiCoefs=Object.assign({},window.AnkiAlgo.DEFAULT_COEFS);window.save();window.renderAnki();">${window.iconLabel('refresh-cw', 'Coefs par défaut')}</button>
      </div>

      <div class="anki-card-block">
        <h3>Auto-évaluation</h3>
        <div class="anki-set-row">
          <label>Afficher le slider 1-10</label>
          <input type="checkbox" ${st.ankiShowSlider !== false ? 'checked' : ''} onchange="window.D.settings.ankiShowSlider=this.checked;window.save();">
        </div>
        <p class="anki-mut" style="font-size:12px;">Boutons 3-niveaux toujours visibles. Slider 1-10 en complément pour granularité.</p>
      </div>

      <div class="anki-card-block">
        <h3>Profils d'intervalles</h3>
        <p class="anki-mut">Chaque carte appartient à un profil ; les étapes définissent quand elle revient après une réussite.</p>
        <div class="anki-prof-grid">${profilesHtml}</div>
        <button class="bs" onclick="window.ankiResetProfiles()" style="margin-top:10px;">${window.iconLabel('refresh-cw', 'Profils par défaut')}</button>
      </div>
    `;
  }
  window.ankiSaveProfile = function (k) {
    const stepsRaw = $("prof_" + k + "_steps").value;
    const easeRaw = parseFloat($("prof_" + k + "_ease").value);
    const steps = stepsRaw.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
    if (!window.D.settings.ankiProfiles) window.D.settings.ankiProfiles = {};
    window.D.settings.ankiProfiles[k] = {
      steps: steps.length ? steps : window.AnkiAlgo.DEFAULT_PROFILES[k].steps,
      ease: isNaN(easeRaw) ? 2.5 : Math.max(1.3, Math.min(3.0, easeRaw)),
      label: window.AnkiAlgo.DEFAULT_PROFILES[k].label
    };
    window.save();
  };
  window.ankiResetProfiles = function () {
    window.D.settings.ankiProfiles = JSON.parse(JSON.stringify(window.AnkiAlgo.DEFAULT_PROFILES));
    window.save(); renderActiveView();
  };

  window.ankiRecalDates = function () {
    const today = window.AnkiAlgo.todayISO();
    let n = 0;
    (window.D.exercices || []).forEach(c => {
      if (c.statut !== 'actif') return;
      // Si dueDate < today : recaler à today
      // Si dueDate > today + 30 : trop loin, recaler aussi
      if (!c.dateProchaineRevision || c.dateProchaineRevision < today) {
        c.dateProchaineRevision = today;
        n++;
      }
    });
    window.AnkiAlgo.log("recal-dates", { n });
    window.save();
    window.sysAlert(`${n} carte(s) recalée(s) sur aujourd'hui (${today}).`, "Dates recalées");
    window.renderAnki();
  };

  window.ankiRebuildPieces = function () {
    // v3.4+ : le système ne découpe PLUS en cartes séparées.
    // Un DM est UN seul objet avec _morceauxTotal / _morceauxFaits.
    // Cette fonction nettoie les anciens morceaux résiduels (éventuelles données d'avant v3.4)
    // et réinitialise la progression de tous les devoirs actifs.
    const exos = window.D.exercices || [];
    const before = exos.length;
    // Supprime les éventuels morceaux résiduels des versions précédentes
    window.D.exercices = exos.filter(c => c.type !== 'devoir-morceau');
    window.D.devoirs = (window.D.devoirs || []).filter(c => c.type !== 'devoir-morceau');
    const removed = before - (window.D.exercices || []).length;
    const today = window.AnkiAlgo.todayISO();
    const devoirs = (window.D.devoirs || []).filter(c => c.statut === 'actif');
    devoirs.forEach(parent => {
      parent._morceauxFaits = 0;
      parent.dateProchaineRevision = today;
      if (!parent._morceauxTotal || parent._morceauxTotal < 1) parent._morceauxTotal = 1;
      // Restaure le tempsCible depuis _dureeTotaleMin si disponible
      if (parent._dureeTotaleMin) parent.tempsCible = parent._dureeTotaleMin * 60;
      delete parent._morceauIndex;
      delete parent._isMorceauParent;
    });
    window.save();
    window.sysAlert(
      `${removed ? removed + ' ancien(s) morceau(x) résiduel(s) supprimé(s).<br>' : ''}${devoirs.length} devoir(s) réinitialisé(s) (progression remise à zéro, dû aujourd'hui).`,
      "Réinitialisation devoirs"
    );
    window.renderAnki();
  };

  // ====== SESSION ======
  // v4: persistance de la session dans D.sessionEnCours pour survivre aux changements
  // d'onglet et au refresh du navigateur.
  function buildSessionPlan() {
    return computeCockpitPlan();
  }
  function persistSession() {
    if (!window.D) return;
    window.D.sessionEnCours = {
      queueIds:     S.queue.map(c => c.id),
      currentId:    S.current ? S.current.id : null,
      stats:        Object.assign({}, S.stats),
      mode:         S.mode,
      generatedAt:  new Date().toISOString(),
      manualOrder:  S.manualOrder ? S.manualOrder.slice() : null,
      selectedIds:  getSelectedIds(),
      selectionOrder: S.selectionOrder.slice(),
      pinnedIds: Array.from(S.pinnedIds),
      excludedIds: Array.from(S.excludedIds),
      cockpitMode: S.cockpitMode,
      showAnswer:   !!S.showAnswer
    };
    window.save();
  }
  function clearPersistedSession() {
    if (window.D) {
      delete window.D.sessionEnCours;
      window.save();
    }
  }
  // À chaque renderAnki : si une session est persistée mais que S.queue est vide
  // (cas refresh), on prépare la "Reprendre" sans réafficher l'overlay tant que
  // l'utilisateur ne clique pas dessus.
  function restoreSessionFromStorageIfAny() {
    if (!window.D || !window.D.sessionEnCours) return;
    const sec = window.D.sessionEnCours;
    if (!Array.isArray(sec.queueIds) || !sec.queueIds.length) {
      delete window.D.sessionEnCours;
      return;
    }
    // Si la queue mémoire est déjà chargée (changement d'onglet simple), ne rien faire
    if (S.queue && S.queue.length) return;
    // Sinon : reconstruit la queue à partir des ids
    const cards = sec.queueIds.map(id => ankFind(id)).filter(Boolean);
    S.queue        = cards;
    S.stats        = Object.assign({ ok: 0, mid: 0, bad: 0, total: cards.length }, sec.stats || {});
    S.mode         = sec.mode || "normal";
    S.manualOrder  = sec.manualOrder ? sec.manualOrder.slice() : null;
    S.selectionIds = new Set(sec.selectedIds || []);
    S.selectionOrder = Array.isArray(sec.selectionOrder) ? sec.selectionOrder.slice() : (sec.selectedIds || []).slice();
    S.pinnedIds = new Set(sec.pinnedIds || []);
    S.excludedIds = new Set(sec.excludedIds || []);
    if (sec.cockpitMode) S.cockpitMode = sec.cockpitMode;
    syncSelectionOrder();
    // Note : on NE relance PAS l'overlay automatiquement. L'utilisateur clique "Reprendre".
    S.current = null;
  }

  // v4: Générer la session du soir = construire la file + la figer en persistance
  window.ankiGenererSessionSoir = function () {
    const plan = buildSessionPlan();
    if (!plan.cartes.length) {
      return window.sysAlert("Aucune carte à inclure dans la session du soir.", "Synchrotron");
    }
    // Activer les cartes du réservoir éventuellement présentes (forceIncludeReservoir)
    plan.cartes.forEach(c => {
      if (window.AnkiAlgo.isReservoir(c)) window.AnkiAlgo.activateFromReservoir(c);
    });
    S.queue   = plan.cartes.slice();
    S.mode    = "normal";
    S.current = null;
    S.stats   = { ok: 0, mid: 0, bad: 0, total: plan.cartes.length };
    S.sessionGeneree = true;
    persistSession();
    window.AnkiAlgo.log("session-generated", { count: plan.cartes.length, totalSec: plan.tempsTotalPrev });
    window.sysAlert(`Session du soir générée : <b>${plan.cartes.length} cartes</b> (${window.AnkiAlgo.fmtDur(plan.tempsTotalPrev)}). Elle est sauvegardée et reprenable après refresh.`, "Session figée");
    window.renderAnki();
  };
  // Bouton "Reprendre"
  window.ankiResumeSession = function () {
    if (!S.queue || !S.queue.length) restoreSessionFromStorageIfAny();
    if (!S.queue || !S.queue.length) return window.sysAlert("Aucune session active à reprendre.", "Synchrotron");
    nextCard();
  };
  window.ankiDiscardSession = function () {
    window.sysConfirm(
      "Abandonner la session du soir ?<br>La file sera effacée — les cartes déjà notées restent enregistrées.",
      () => {
        S.queue = []; S.current = null; S.stats = { ok: 0, mid: 0, bad: 0, total: 0 };
        S.dernierExerciceModifie = null;
        clearPersistedSession();
        window.renderAnki();
      },
      "Abandonner la session"
    );
  };

  window.startAnkiSession = function () {
    const plan = buildSessionPlan();
    if (!plan.cartes.length) return window.sysAlert("Aucune carte à réviser.", "Synchrotron");
    plan.cartes.forEach(c => {
      if (window.AnkiAlgo.isReservoir(c)) window.AnkiAlgo.activateFromReservoir(c);
    });
    S.queue = plan.cartes.slice();
    S.mode = (S.selectionIds.size > 0 || S.manualOrder) ? "custom" : "normal";
    S.stats = { ok: 0, mid: 0, bad: 0, total: plan.cartes.length };
    persistSession();
    nextCard();
  };
  window.startAnkiSingle = function (id) {
    const c = ankFind(id);
    if (!c) return;
    if (c.statut !== "actif") { c.statut = "actif"; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO(); }
    S.queue = [c]; S.mode = "single";
    S.stats = { ok: 0, mid: 0, bad: 0, total: 1 };
    nextCard();
  };
  window.startAnkiColle = function (coursId) {
    ensure();
    const q = window.D.exercices.filter(c => (c.coursIds || []).includes(coursId) || c.coursId === coursId);
    if (!q.length) return window.sysAlert("Aucune carte liée à ce cours.", "Mode Colle");
    S.queue = window.AnkiAlgo.smartOrder(q.slice());
    S.mode = "colle"; S.stats = { ok: 0, mid: 0, bad: 0, total: q.length };
    nextCard();
  };
  window.ankiSetQuickQueue = function (ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const cards = ids.map(id => ankFind(id)).filter(Boolean);
    if (!cards.length) return;
    cards.forEach(c => { if (c.statut !== 'actif') { c.statut = 'actif'; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO(); } });
    const quickOnly = cards.filter(c => window.AnkiAlgo.cardKind(c) === 'quick');
    if (!quickOnly.length) return window.sysAlert("Aucune carte rapide (Y-) dans la sélection.", "Rapide");
    S.queue = window.AnkiAlgo.buildQuickSession(quickOnly);
    S.mode = "quick";
    S.stats = { ok: 0, mid: 0, bad: 0, total: cards.length };
    window.save(); nextCard();
  };

  function nextCard() {
    if (!S.queue.length) return endSession();
    S.current = S.queue.shift();
    S.showAnswer = false; S.chronoElapsed = 0; S.chronoStart = Date.now();
    S.chronoPausedAt = 0;
    S.sliderValue = 7;
    S.sessionTempsManuel = null; // v4: reset à chaque carte
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = setInterval(tickChrono, 200);
    persistSession();
    renderSessionOverlay();
  }

  function renderSessionOverlay() {
    const c = S.current; if (!c) return;
    let ov = $("ovAnkiSession");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovAnkiSession"; ov.className = "ov"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const m = mat(c.mat);
    const linkedTitle = (c.coursIds || []).map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      return co ? co.uid + " · " + co.title : uid;
    }).join(' · ');
    const hasReponse = c.reponse && c.reponse.trim().length;
    const showSlider = (window.D.settings && window.D.settings.ankiShowSlider !== false);
    const isDevoir = isDevoirCard(c);
    const dmRef = isDevoir && c.type === 'devoir-morceau'
      ? (ankFind(c._morceauOf) || c)
      : c;
    const sessionMin = isDevoir
      ? Math.round(((dmRef._dureeTotaleMin || (dmRef.tempsCible / 60)) / (dmRef._morceauxTotal || 1)))
      : ((c.tempsCible || 60) / 60);

    ov.innerHTML = `
      <div class="modal anki-session" style="border-top:5px solid ${m.color};">
        <div class="anki-sess-top">
          <div>
            <span class="uid-badge">${c.id}</span>
            <span class="anki-tag" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${m.label}</span>
            ${isDevoir ? `<span class="anki-tag" style="background:#b06af720;color:#b06af7;border:1px solid #b06af7;">${window.iconLabel('file-text', `DM ${(dmRef._morceauxFaits || 0) + 1}/${dmRef._morceauxTotal || 1}`)}</span>` : `<span class="anki-tag">${stars(c)}</span>`}
          </div>
          <div class="anki-chrono" id="ankiChrono">00:00</div>
        </div>
        ${isDevoir ? `
          <div class="anki-devoir-bandeau">
            <div class="anki-mut" style="font-size:11px;">Temps prévu pour cette session :</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">
              <div class="anki-session-min-wrap">
                <span data-icon="timer" data-icon-size="14"></span>
                <input type="number" class="fc-number" id="ankiDevoirTemps" min="1" max="240" step="5" value="${sessionMin}" aria-label="Durée session DM en minutes">
                <span class="anki-mut">min</span>
              </div>
              <span class="anki-mut">Reste après celle-ci : <b>${Math.max(0, (dmRef._morceauxTotal || 1) - (dmRef._morceauxFaits || 0) - 1)} session(s)</b></span>
            </div>
          </div>
        ` : `<div class="anki-sess-meta">${window.iconHtml('timer', 12)} Cible ${window.AnkiAlgo.fmtDur(c.tempsCible || 60)} · ${profileLabel(c.profil || 'COURS')}${linkedTitle ? ' · ' + esc(linkedTitle) : ''}${c._blocageActif ? ' · <span style="color:var(--red);font-weight:700;">' + window.iconLabel('zap', 'BOOST blocage actif') + '</span>' : ''}</div>`}
        ${c.titre ? `<div class="anki-sess-titre">${esc(c.titre)}</div>` : ''}
        <div class="anki-sess-q">${esc(c.question || '')}</div>
        ${renderSourcesBox(c, false)}
        ${S.showAnswer ? `
          ${hasReponse ? `<div class="anki-sess-r"><div class="anki-mut" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Réponse</div><div>${esc(c.reponse)}</div></div>` : '<div class="anki-sess-r-empty">Auto-évaluation libre (pas de réponse enregistrée)</div>'}
          ${renderSourcesBox(c, true)}
          <div class="anki-temps-manuel" data-testid="temps-manuel-wrap">
            <label class="anki-mut" style="font-size:11px;display:block;margin-bottom:6px;">${window.iconLabel('timer', 'Temps mesuré — modifie si différent du chrono :')}</label>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div class="anki-session-min-wrap">
                <input type="number" class="fc-number" id="ankiTempsManuel" data-testid="input-temps-manuel" min="0" max="600" step="0.5"
                  placeholder="auto" value="${S.sessionTempsManuel != null ? S.sessionTempsManuel : ''}"
                  onchange="window._ankiSessionTempsManuel = this.value === '' ? null : parseFloat(this.value);"
                  aria-label="Temps mesuré en minutes">
                <span class="anki-mut">min</span>
              </div>
              <span class="anki-mut" style="font-size:11px;">(défaut : chrono ${fmtSec(S.chronoElapsed)})</span>
            </div>
          </div>
          ${isDevoir ? `
            <div class="anki-mut" style="text-align:center;margin:14px 0 8px;font-size:12px;">Session de DM terminée ? Indique l'avancement :</div>
            <div class="anki-evals">
              <button class="anki-eval bad" data-testid="eval-dm-bad" onclick="window.evalCard(2)" title="Pas avancé ou bloqué"><span class="eval-bad">${window.iconHtml('circle-x', 20)}</span><small>À refaire</small></button>
              <button class="anki-eval mid" data-testid="eval-dm-mid" onclick="window.evalCard(6)" title="Partiellement fait"><span class="eval-mid">${window.iconHtml('circle-minus', 20)}</span><small>Partiel</small></button>
              <button class="anki-eval good" data-testid="eval-dm-good" onclick="window.evalCard(9)" title="Session complétée"><span class="eval-good">${window.iconHtml('check', 20)}</span><small>Fait</small></button>
            </div>
            <p class="anki-mut" style="font-size:11px;text-align:center;margin-top:8px;">Pour un DM, on n'évalue pas la mémoire mais l'avancement. L'ease/intervalle ne changent pas.</p>
          ` : `
            <div class="anki-mut" style="text-align:center;margin:14px 0 8px;font-size:12px;">Comment ça s'est passé ?</div>
            <div class="anki-evals">
              <button class="anki-eval bad" data-testid="eval-bad" onclick="window.evalCard(2)"><span class="eval-bad">${window.iconHtml('circle-x', 20)}</span><small>Blocage</small></button>
              <button class="anki-eval mid" data-testid="eval-mid" onclick="window.evalCard(6)"><span class="eval-mid">${window.iconHtml('circle-minus', 20)}</span><small>Étourderie</small></button>
              <button class="anki-eval good" data-testid="eval-good" onclick="window.evalCard(9)"><span class="eval-good">${window.iconHtml('check', 20)}</span><small>Parfait</small></button>
            </div>
            ${showSlider ? `
              <div class="anki-slider-wrap">
                <div class="anki-slider-head">
                  <span class="anki-mut">Précision fine :</span>
                  <span class="anki-slider-val" id="ankiSliderVal">${S.sliderValue}</span><span class="anki-mut">/10</span>
                </div>
                <input type="range" min="1" max="10" value="${S.sliderValue}" class="anki-slider" id="ankiSlider"
                  oninput="document.getElementById('ankiSliderVal').textContent=this.value;window._ankiSlider=parseInt(this.value);">
                <button class="bp anki-slider-btn" data-testid="btn-eval-slider" onclick="window.evalCard(parseInt(document.getElementById('ankiSlider').value))">Valider (score précis)</button>
              </div>
            ` : ''}
          `}
        ` : `<button class="bp anki-reveal" data-testid="btn-reveal" onclick="window.revealAnki()">${isDevoir ? "J'ai fini cette session" : (hasReponse ? 'Afficher la réponse' : "J'ai fini · m'auto-évaluer")}</button>`}
        <div class="anki-sess-foot">
          <span class="anki-mut">Reste : ${S.queue.length} · ${sessStatsHtml(S.stats.ok, S.stats.mid, S.stats.bad)}</span>
          <div style="display:flex;gap:6px;">
            ${S.dernierExerciceModifie ? `<button class="bs" data-testid="btn-undo-notation" style="border-color:var(--gold);color:var(--gold);" onclick="window.ankiUndoLastEval()">${window.iconLabel('refresh-cw', 'Annuler la dernière notation')}</button>` : ''}
            <button class="bs" data-testid="btn-pause-session" onclick="window.ankiPauseSession()">${window.iconLabel('pause', 'Pause · reprendre plus tard')}</button>
            <button class="bs anki-quit" data-testid="btn-abandon-session-active" onclick="window.ankiAbandonActiveSession()">${window.iconLabel('trash-2', 'Abandonner tout')}</button>
          </div>
        </div>
      </div>
    `;
    window.hydrateIcons(ov);
  }

  function renderSourcesBox(c, isAnswerSide) {
    if (!c) return '';
    const src = isAnswerSide ? c.sourceCorrection : c.sourceEnonce;
    if (!src) return '';
    const hasContent = (src.nom || src.details);
    if (!hasContent) return '';
    const labelType = (src.type || '').toString();
    const labelTitle = isAnswerSide ? window.iconLabel('check', 'Corrigé') : window.iconLabel('book-open', 'Énoncé');
    const color = isAnswerSide ? 'var(--grn)' : 'var(--gold)';
    return `
      <div class="anki-src-box" data-testid="src-box-${isAnswerSide ? 'cor' : 'enon'}" style="border:1px dashed ${color};background:rgba(0,0,0,0.04);padding:8px 10px;border-radius:6px;margin:6px 0;">
        <div style="font-size:11px;color:${color};font-weight:700;letter-spacing:.4px;text-transform:uppercase;">${labelTitle} · ${esc(labelType)}</div>
        <div style="font-size:13px;margin-top:2px;"><b>${esc(src.nom || '')}</b> ${src.details ? ' — ' + esc(src.details) : ''}</div>
      </div>
    `;
  }

  window.revealAnki = function () { S.showAnswer = true; renderSessionOverlay(); };

  // v4: helper deep clone (snapshot complet d'une carte pour Undo)
  function cloneCard(c) {
    if (!c) return null;
    try { return JSON.parse(JSON.stringify(c)); }
    catch (e) { return Object.assign({}, c); }
  }

  // v4: annule la dernière notation
  window.ankiUndoLastEval = function () {
    const snap = S.dernierExerciceModifie;
    if (!snap) return window.sysAlert("Aucune notation récente à annuler.", "Undo");
    const loc = ankLocate(snap.card.id);
    if (!loc || loc.idx < 0) {
      (isDevoirCard(snap.card) ? window.D.devoirs : window.D.exercices).unshift(cloneCard(snap.card));
    } else {
      const current = loc.list[loc.idx];
      const keptHist = Array.isArray(current.historique) ? current.historique.slice() : [];
      keptHist.push({
        date: new Date().toISOString(),
        type: "undo",
        qScore: snap.qScore,
        message: "Annulation — ease/intervalle/repetitions restaurés"
      });
      const restored = cloneCard(snap.card);
      loc.list[loc.idx] = Object.assign(restored, { historique: keptHist });
    }
    // Décrémentation des compteurs de session
    if (snap.statBucket === 'ok')  S.stats.ok  = Math.max(0, S.stats.ok  - 1);
    if (snap.statBucket === 'mid') S.stats.mid = Math.max(0, S.stats.mid - 1);
    if (snap.statBucket === 'bad') S.stats.bad = Math.max(0, S.stats.bad - 1);
    // Réinjection en tête de file
    const restoredCard = ankFind(snap.card.id);
    if (restoredCard) {
      S.queue.unshift(restoredCard);
      // On rouvre la carte directement (le chrono repart de 0 pour cette tentative)
      S.current = null;
    }
    window.AnkiAlgo.log("undo-eval", { id: snap.card.id, statBucket: snap.statBucket, historiqueConserved: true });
    S.dernierExerciceModifie = null;
    window.save();
    persistSession();
    nextCard();
    window.sysAlert("Dernière notation annulée. Paramètres restaurés — l'historique est conservé (entrée undo ajoutée).", "Undo");
  };

  window.evalCard = function (qScore) {
    if (!S.current) return;
    qScore = Math.max(0, Math.min(10, qScore));
    if (S.chronoInt) { clearInterval(S.chronoInt); S.chronoInt = null; }

    // v4: temps réel = soit saisie manuelle (minutes), soit chrono auto (secondes)
    const inputManuel = document.getElementById('ankiTempsManuel');
    let tps = S.chronoElapsed; // par défaut : chrono auto (secondes)
    if (inputManuel && inputManuel.value !== '' && !isNaN(parseFloat(inputManuel.value))) {
      const min = Math.max(0, parseFloat(inputManuel.value));
      tps = min * 60; // conversion minutes → secondes
      S.sessionTempsManuel = min;
    }

    const isDevoir = isDevoirCard(S.current);

    // v4: SNAPSHOT AVANT modification (pour Undo)
    const snapshot = {
      card: cloneCard(S.current),
      tps,
      qScore,
      isDevoir,
      statBucket: null,    // rempli ci-dessous
      timestamp: new Date().toISOString()
    };

    if (isDevoir) {
      // DM : progression par sessions (_morceauxTotal / _morceauxFaits), sans ease/intervalle
      const dmCard = S.current.type === 'devoir-morceau'
        ? (ankFind(S.current._morceauOf) || S.current)
        : S.current;
      dmCard._morceauxFaits = (dmCard._morceauxFaits || 0) + 1;
      const restants = (dmCard._morceauxTotal || 1) - dmCard._morceauxFaits;
      if (restants <= 0) {
        dmCard.statut = 'fini';
        dmCard.dateProchaineRevision = null;
      } else {
        dmCard.dateProchaineRevision = window.AnkiAlgo.addDays(window.AnkiAlgo.todayISO(), 1);
      }
      dmCard.historique = dmCard.historique || [];
      dmCard.historique.push({ date: new Date().toISOString(), qScore, tempsReel: Math.round(tps), pen: 1, mode: S.mode, type: 'devoir-session' });
      window.AnkiAlgo.log("devoir-session", {
        id: dmCard.id,
        morceaux: dmCard._morceauxFaits + "/" + dmCard._morceauxTotal,
        prochaine: restants > 0 ? dmCard.dateProchaineRevision : "TERMINÉ",
        tempsReel: window.AnkiAlgo.fmtDur(tps)
      });
      window.sysAlert(`${window.iconHtml('file-text', 14)} <b>${dmCard.titre || dmCard.id}</b><br>Session ${dmCard._morceauxFaits}/${dmCard._morceauxTotal} terminée.<br>${restants > 0 ? 'Prochaine session : <b>' + dmCard.dateProchaineRevision + '</b>' : window.iconLabel('check', '<b>DM TERMINÉ</b>')}`, "DM");
    } else {
      // Carte normale : update ease/intervalle/repetitions + flag blocage
      const easeAvant = S.current.ease || 2.5;
      const intAvant = S.current.intervalle || 0;
      const out = window.AnkiAlgo.computeNextInterval(S.current, qScore, tps);
      if (S.mode !== "colle") {
        S.current.intervalle = out.intervalle;
        S.current.ease = out.ease;
        S.current.repetitions = out.repetitions;
        S.current.dateProchaineRevision = out.dateProchaineRevision;
        // v4: flags d'état pour l'ease aggressif + traçabilité I_R
        S.current._blocageActif    = out._blocageActif;
        S.current._blocageRevCount = out._blocageRevCount;
        S.current._lastReviewDate  = out._lastReviewDate;
      }
      S.current.historique = S.current.historique || [];
      S.current.historique.push({ date: new Date().toISOString(), qScore, tempsReel: Math.round(tps), pen: out.penaliteVitesse, mode: S.mode });
      window.AnkiAlgo.log("eval", {
        id: S.current.id,
        qScore,
        ease: easeAvant.toFixed(2) + "→" + out.ease,
        intervalle: intAvant + "→" + out.intervalle + "j",
        next: out.dateProchaineRevision,
        blocage: out._blocageActif ? `actif(${out._blocageRevCount})` : 'levé'
      });
      // Confirmation visible immédiate après chaque eval (mode single / quick)
      if (S.mode === 'single' || S.queue.length === 0) {
        const deltaEase = out.ease - easeAvant;
        const easeArrow = deltaEase > 0 ? '↑' : deltaEase < 0 ? '↓' : '=';
        const easeColor = deltaEase > 0 ? 'var(--grn)' : deltaEase < 0 ? 'var(--red)' : 'var(--mut)';
        const blocageLine = out._blocageActif
          ? `<br>${window.iconLabel('zap', `<b style="color:var(--red);">Blocage actif</b> (tentative ${out._blocageRevCount}) — la carte sera boostée jusqu'à note ≥ ${(window.AnkiAlgo.getCoefs().BLOCAGE_QSCORE_VALIDATE || 8)}.`)}`
          : (snapshot.card._blocageActif ? `<br>${window.iconLabel('check', '<b style="color:var(--grn);">Blocage levé</b>')}` : '');
        window.sysAlert(
          `<b>${S.current.titre || S.current.id}</b><br><br>` +
          `${window.iconLabel('target', `Score : <b>${qScore}/10</b> (vitesse ×${out.penaliteVitesse})`)}<br>` +
          `${window.iconLabel('bar-chart', `Ease : ${easeAvant.toFixed(2)} → <b style="color:${easeColor};">${out.ease} ${easeArrow}</b>`)}<br>` +
          `${window.iconLabel('calendar', `Intervalle : ${intAvant}j → <b>${out.intervalle}j</b>`)}<br>` +
          `${window.iconLabel('calendar', `Prochaine révision : <b>${out.dateProchaineRevision}</b>`)}${blocageLine}`,
          "Carte évaluée"
        );
      }
    }

    const btn = window.AnkiAlgo.qScoreToButton(qScore);
    if (btn === 0)      { S.stats.bad++; snapshot.statBucket = 'bad'; }
    else if (btn === 1) { S.stats.mid++; snapshot.statBucket = 'mid'; }
    else                { S.stats.ok++;  snapshot.statBucket = 'ok';  }

    // v4: conserve le snapshot pour Undo
    S.dernierExerciceModifie = snapshot;

    if (qScore <= 3 && S.mode !== "colle" && S.mode !== "single" && !isDevoir) S.queue.push(S.current);
    if (window.D.settings) window.D.settings.ankiLastSession = window.AnkiAlgo.todayISO();
    window.save();
    persistSession();
    nextCard();
  };
  window.ankiPauseSession = function () {
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = null;
    const ov = $("ovAnkiSession");
    if (ov) ov.classList.add("hidden");
    S.current = null;
    persistSession();
    const rest = S.queue ? S.queue.length : 0;
    const done = S.stats ? (S.stats.total - rest) : 0;
    window.sysAlert(
      `Session en pause.<br>${done}/${S.stats.total || 0} cartes faites · <b>${rest}</b> restante(s).<br><br>` +
      window.iconLabel('pin', 'Clique « Reprendre » dans le bandeau pour continuer au même endroit.'),
      "Synchrotron"
    );
    window.renderAnki();
  };

  window.ankiAbandonActiveSession = function () {
    window.sysConfirm(
      "Abandonner cette session ? La file en cours sera effacée (les cartes déjà notées restent enregistrées).",
      function () {
        if (S.chronoInt) clearInterval(S.chronoInt);
        S.chronoInt = null;
        const ov = $("ovAnkiSession");
        if (ov) ov.classList.add("hidden");
        S.queue = [];
        S.current = null;
        S.stats = { ok: 0, mid: 0, bad: 0, total: 0 };
        S.selectionIds.clear();
        S.selectionOrder = [];
        S.manualOrder = null;
        S.dernierExerciceModifie = null;
        clearPersistedSession();
        window.renderAnki();
      },
      "Abandonner la session"
    );
  };

  window.abortAnkiSession = function () {
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = null;
    const ov = $("ovAnkiSession"); if (ov) ov.classList.add("hidden");
    const s = S.stats;
    const fini = !S.queue.length;
    if (fini && s.total) {
      window.sysAlert(`Session terminée !<br>${sessStatsHtml(s.ok, s.mid, s.bad)}<br>${s.total}/${s.total} cartes faites.`, "Synchrotron");
      S.queue = [];
      S.current = null;
      S.selectionIds.clear();
      S.selectionOrder = [];
      S.manualOrder = null;
      S.dernierExerciceModifie = null;
      clearPersistedSession();
    } else {
      window.ankiPauseSession();
      return;
    }
    window.renderAnki();
  };
  function endSession() { window.abortAnkiSession(); }

  // ====== CRUD ======
  let editingExoId = null;

  window.openExoModal = function () {
    ensure(); editingExoId = null; S.coursLinkSelection = new Set(); S.coursLinkQuery = "";
    showExoModal({});
  };
  window.openDevoirModal = function () {
    ensure(); editingExoId = null; S.coursLinkSelection = new Set(); S.coursLinkQuery = "";
    showDevoirModal({ type: 'devoir', tempsCible: 30 * 60, profil: 'EXO', statut: 'actif' });
  };
  window.editExo = function (id) {
    const c = ankFind(id); if (!c) return;
    editingExoId = id;
    S.coursLinkSelection = new Set(c.coursIds || (c.coursId ? [c.coursId] : []));
    S.coursLinkQuery = "";
    if (isDevoirCard(c)) showDevoirModal(c);
    else showExoModal(c);
  };
  window.delExo = function (id) {
    window.sysConfirm("Supprimer la carte " + id + " ?", () => {
      window.D.exercices = (window.D.exercices || []).filter(c => c.id !== id && c._morceauOf !== id);
      window.D.devoirs = (window.D.devoirs || []).filter(c => c.id !== id && c._morceauOf !== id);
      window.save(); window.renderAnki();
    }, "Suppression");
  };

  function fieldVal(id) {
    const el = $(id);
    if (!el || el.value == null) return '';
    return String(el.value).trim();
  }

  function showFormError(elId, msg) {
    const el = $(elId);
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('visible'); }
    else { el.textContent = ''; el.classList.remove('visible'); }
  }

  function showExoModal(c) {
    let ov = $("ovExo");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovExo"; ov.className = "ov"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const matOpts = '<option value="">— Choisir —</option>' + (window.D.matieres || []).map(m => `<option value="${m.id}" ${m.id === c.mat ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const profileOpts = Object.keys(window.AnkiAlgo.DEFAULT_PROFILES).map(p => `<option value="${p}" ${(c.profil || 'COURS') === p ? 'selected' : ''}>${window.AnkiAlgo.DEFAULT_PROFILES[p].label}</option>`).join('');
    const tempsMin = c.tempsCible ? (c.tempsCible / 60) : 1;

    ov.innerHTML = `
      <div class="modal anki-modal-exo">
        <h2>${editingExoId ? window.iconLabel('pencil', 'Modifier la carte') : window.iconLabel('sparkles', 'Nouvelle carte X-')}</h2>
        <div id="exoFormError" class="anki-form-error" role="alert"></div>
        <div class="fg">
          <label>Titre court</label>
          <input type="text" id="exoTitre" placeholder="Ex: Théorème énergie cinétique" value="${esc(c.titre || '')}">
        </div>
        <div class="fg">
          <label>Énoncé *</label>
          <textarea id="exoQ" rows="3">${esc(c.question || '')}</textarea>
        </div>
        <div class="fg">
          <label>Réponse (facultatif) <span class="anki-mut" style="font-weight:normal;">— laisse vide pour t'auto-évaluer</span></label>
          <textarea id="exoR" rows="2">${esc(c.reponse || '')}</textarea>
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Matière *</label><select id="exoMat">${matOpts}</select></div>
          <div class="fg"><label>Profil</label><select id="exoProf">${profileOpts}</select></div>
          <div class="fg"><label>Durée (min)</label><input type="number" id="exoTempsMin" min="1" max="600" step="0.5" value="${tempsMin}"></div>
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Importance</label>
            ${window.starPickerHtml('exoImportance', cardImportance(c))}
            <p class="anki-mut" style="font-size:11px;margin-top:4px;">Plus d'étoiles → monte plus vite en session et revient plus souvent.</p>
          </div>
          <div class="fg"><label>Statut</label>
            <select id="exoStat">
              <option value="reservoir" ${(c.statut || 'reservoir') === 'reservoir' || c.statut === 'attente' ? 'selected' : ''}>Réservoir</option>
              <option value="actif" ${c.statut === 'actif' ? 'selected' : ''}>Actif</option>
            </select>
          </div>
        </div>

        <div class="anki-src-block" style="border-top:1px dashed var(--bd);padding-top:10px;margin-top:6px;">
          <p class="anki-mut" style="font-size:12px;margin-bottom:6px;">${window.iconLabel('book-open', '<b>Guidage physique</b> — où trouver l\'énoncé et le corrigé (facultatif).')}</p>
          <div class="anki-modal-row">
            <div class="fg"><label>Énoncé · Type</label>
              <select id="exoSrcEnonceType">
                <option value="">— Aucun —</option>
                <option value="livre"    ${(c.sourceEnonce && c.sourceEnonce.type) === 'livre'    ? 'selected' : ''}>Livre</option>
                <option value="classeur" ${(c.sourceEnonce && c.sourceEnonce.type) === 'classeur' ? 'selected' : ''}>Classeur</option>
              </select>
            </div>
            <div class="fg"><label>Nom (livre / classeur)</label>
              <input type="text" id="exoSrcEnonceNom" data-testid="src-enonce-nom" placeholder="Ex: HPrépa MP" value="${esc((c.sourceEnonce && c.sourceEnonce.nom) || '')}">
            </div>
            <div class="fg"><label>Détails (page, exo, onglet…)</label>
              <input type="text" id="exoSrcEnonceDet" data-testid="src-enonce-det" placeholder="Ex: p.142 ex.7" value="${esc((c.sourceEnonce && c.sourceEnonce.details) || '')}">
            </div>
          </div>
          <div class="anki-modal-row">
            <div class="fg"><label>Corrigé · Type</label>
              <select id="exoSrcCorType">
                <option value="">— Aucun —</option>
                <option value="livre"    ${(c.sourceCorrection && c.sourceCorrection.type) === 'livre'    ? 'selected' : ''}>Livre</option>
                <option value="classeur" ${(c.sourceCorrection && c.sourceCorrection.type) === 'classeur' ? 'selected' : ''}>Classeur</option>
                <option value="app"      ${(c.sourceCorrection && c.sourceCorrection.type) === 'app'      ? 'selected' : ''}>Dans l'app</option>
              </select>
            </div>
            <div class="fg"><label>Nom</label>
              <input type="text" id="exoSrcCorNom" data-testid="src-cor-nom" placeholder="Ex: Corrigé HPrépa" value="${esc((c.sourceCorrection && c.sourceCorrection.nom) || '')}">
            </div>
            <div class="fg"><label>Détails</label>
              <input type="text" id="exoSrcCorDet" data-testid="src-cor-det" placeholder="Ex: p.480, vidéo, onglet jaune" value="${esc((c.sourceCorrection && c.sourceCorrection.details) || '')}">
            </div>
          </div>
        </div>

        <div class="fg">
          <label>Cours liés (recherche · plusieurs possibles)</label>
          ${searchField('Titre, matière, classeur, code...', `id="exoCoursSearch" oninput="window.ankiCoursLinkSearch(this.value)"`)}
          <div id="exoCoursSelected" class="anki-link-selected"></div>
          <div id="exoCoursResults" class="anki-link-results"></div>
        </div>

        ${editingExoId ? `<div class="fg"><label>Identifiant</label><div class="uidbox">${c.id}</div></div>` : ''}

        <div class="macts">
          <button class="bs" onclick="document.getElementById('ovExo').classList.add('hidden')">Annuler</button>
          <button class="bp" onclick="window.saveExo()">Enregistrer</button>
        </div>
      </div>
    `;
    renderCoursLinkUI();
    window.hydrateIcons(ov);
  }

  function showDevoirModal(c) {
    ensure();
    if (!window.D) return window.sysAlert("Données non chargées — réessaie dans un instant.", "Erreur");
    let ov = $("ovDevoir");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovDevoir"; ov.className = "ov anki-ov-devoir"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const matieres = window.D.matieres || [];
    const defaultMat = c.mat || (matieres[0] && matieres[0].id) || '';
    const matOpts = (matieres.length
      ? '<option value="">— Choisir —</option>'
      : '<option value="">— Aucune matière — crée-en une dans Matières —</option>')
      + matieres.map(m => `<option value="${m.id}" ${m.id === defaultMat ? 'selected' : ''}>${m.label} — ${m.name}</option>`).join('');
    const tempsMin = c._dureeTotaleMin != null ? c._dureeTotaleMin : (c.tempsCible ? (c.tempsCible / 60) : 30);
    const morceaux = Math.max(1, c._morceauxTotal || 1);
    const morceauxFaits = c._morceauxFaits || 0;

    ov.innerHTML = `
      <div class="modal anki-modal-devoir">
        <h2>${editingExoId ? window.iconLabel('pencil', 'Modifier le devoir') : window.iconLabel('file-text', 'Nouveau devoir W-')}</h2>
        <div class="modal-body-scroll">
        <div class="anki-devoir-hero">
          ${window.iconLabel('calendar', '<b>Devoir à rendre</b> — visible dans l\'Agenda, planifié selon la date limite et ton importance (étoiles). Pas de réservoir : il entre directement dans le flux de travail.')}
        </div>
        <div id="devoirFormError" class="anki-form-error" role="alert"></div>
        ${!matieres.length ? `<div class="anki-form-error visible">Aucune matière disponible. Va dans l'onglet <b>Matières</b> pour en créer une avant d'ajouter un devoir.</div>` : ''}

        <div class="fg">
          <label>Titre du devoir *</label>
          <input type="text" id="devoirTitre" placeholder="Ex: DM Mécanique n°3, Colle Analyse…" value="${esc(c.titre || '')}">
        </div>

        <div class="anki-modal-row">
          <div class="fg"><label>Matière *</label><select id="devoirMat">${matOpts}</select></div>
          <div class="fg"><label>Date limite *</label><input type="date" id="devoirDateLim" required min="${window.AnkiAlgo.todayISO()}" value="${esc(c.dateLimite || '')}"></div>
        </div>

        <div class="anki-modal-row">
          <div class="fg"><label>Durée totale estimée (min)</label>
            <input type="number" id="devoirTempsMin" min="5" max="600" step="5" value="${tempsMin}">
          </div>
          <div class="fg"><label>Sessions prévues</label>
            <input type="number" id="devoirMorceaux" min="1" max="20" value="${morceaux}">
            <p class="anki-devoir-sessions-hint">${morceauxFaits > 0 ? morceauxFaits + ' session(s) déjà faite(s). ' : ''}Répartis le travail sur plusieurs soirs (ex. 3 → 3 sessions d'environ ${Math.round(tempsMin / morceaux)} min).</p>
          </div>
        </div>

        <div class="fg">
          <label>Consignes / objectif *</label>
          <textarea id="devoirQ" rows="4" placeholder="Quoi faire, quelles questions, contraintes…">${esc(c.question || '')}</textarea>
        </div>

        <div class="fg">
          <label>Importance</label>
          ${window.starPickerHtml('devoirImportance', cardImportance(c))}
        </div>

        <div class="anki-src-block" style="border-top:1px dashed var(--bd);padding-top:10px;margin-top:6px;">
          <p class="anki-mut" style="font-size:12px;margin-bottom:6px;">${window.iconLabel('book-open', '<b>Où est le sujet ?</b> (souvent sur papier pour un DM)')}</p>
          <div class="anki-modal-row">
            <div class="fg"><label>Sujet · Type</label>
              <select id="devoirSrcEnonceType">
                <option value="">— Aucun —</option>
                <option value="livre"    ${(c.sourceEnonce && c.sourceEnonce.type) === 'livre'    ? 'selected' : ''}>Livre</option>
                <option value="classeur" ${(c.sourceEnonce && c.sourceEnonce.type) === 'classeur' ? 'selected' : ''}>Classeur</option>
              </select>
            </div>
            <div class="fg"><label>Nom</label>
              <input type="text" id="devoirSrcEnonceNom" placeholder="Ex: Feuille distribuée en cours" value="${esc((c.sourceEnonce && c.sourceEnonce.nom) || '')}">
            </div>
            <div class="fg"><label>Détails</label>
              <input type="text" id="devoirSrcEnonceDet" placeholder="Ex: p.2 ex.4 à 7" value="${esc((c.sourceEnonce && c.sourceEnonce.details) || '')}">
            </div>
          </div>
          <div class="anki-modal-row">
            <div class="fg"><label>Corrigé · Type</label>
              <select id="devoirSrcCorType">
                <option value="">— Aucun —</option>
                <option value="livre"    ${(c.sourceCorrection && c.sourceCorrection.type) === 'livre'    ? 'selected' : ''}>Livre</option>
                <option value="classeur" ${(c.sourceCorrection && c.sourceCorrection.type) === 'classeur' ? 'selected' : ''}>Classeur</option>
                <option value="app"      ${(c.sourceCorrection && c.sourceCorrection.type) === 'app'      ? 'selected' : ''}>Dans l'app</option>
              </select>
            </div>
            <div class="fg"><label>Nom</label>
              <input type="text" id="devoirSrcCorNom" placeholder="Ex: Corrigé prof" value="${esc((c.sourceCorrection && c.sourceCorrection.nom) || '')}">
            </div>
            <div class="fg"><label>Détails</label>
              <input type="text" id="devoirSrcCorDet" placeholder="Ex: après rendu" value="${esc((c.sourceCorrection && c.sourceCorrection.details) || '')}">
            </div>
          </div>
        </div>

        <div class="fg">
          <label>Cours liés (optionnel)</label>
          ${searchField('Titre, matière, classeur, code...', `id="exoCoursSearch" oninput="window.ankiCoursLinkSearch(this.value)"`)}
          <div id="exoCoursSelected" class="anki-link-selected"></div>
          <div id="exoCoursResults" class="anki-link-results"></div>
        </div>

        ${editingExoId ? `<div class="fg"><label>Identifiant W-</label><div class="uidbox">${c.id}</div></div>` : ''}
        </div>

        <div class="macts">
          <button type="button" class="bs" onclick="document.getElementById('ovDevoir').classList.add('hidden')">Annuler</button>
          <button type="button" class="bp" style="background:var(--red);border-color:var(--red);" onclick="window.saveDevoir()">Enregistrer le devoir</button>
        </div>
      </div>
    `;
    const morcEl = $("devoirMorceaux");
    const hintEl = ov.querySelector('.anki-devoir-sessions-hint');
    const tempsEl = $("devoirTempsMin");
    function updateSessionsHint() {
      if (!hintEl || !morcEl || !tempsEl) return;
      const n = Math.max(1, parseInt(morcEl.value, 10) || 1);
      const t = parseFloat(tempsEl.value) || 30;
      const faits = morceauxFaits;
      hintEl.textContent = (faits > 0 ? faits + ' session(s) déjà faite(s). ' : '') +
        (n > 1 ? `Répartis le travail sur ${n} soirs (~${Math.round(t / n)} min par session).` : 'Une seule session — tout le devoir d\'un coup.');
    }
    if (morcEl) morcEl.addEventListener('input', updateSessionsHint);
    if (tempsEl) tempsEl.addEventListener('input', updateSessionsHint);
    renderCoursLinkUI();
    window.hydrateIcons(ov);
  }

  function renderCoursLinkUI() {
    const sel = $("exoCoursSelected"), res = $("exoCoursResults");
    if (!sel || !res) return;
    sel.innerHTML = Array.from(S.coursLinkSelection).map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      if (!co) return `<span class="anki-link-chip" onclick="window.ankiCoursLinkToggle('${uid}')">${uid} ${window.iconHtml('x', 12)}</span>`;
      const m = mat(co.mat);
      return `<span class="anki-link-chip" style="background:${m.color}20;border:1px solid ${m.color};color:${m.color};" onclick="window.ankiCoursLinkToggle('${uid}')">${co.uid} · ${esc(co.title)} ${window.iconHtml('x', 12)}</span>`;
    }).join('') || '<span class="anki-mut" style="font-size:11px;">Aucun cours lié.</span>';

    const q = (S.coursLinkQuery || '').toLowerCase().trim();
    if (!q) { res.innerHTML = ''; return; }
    const list = (window.D.cours || []).filter(c => {
      if (S.coursLinkSelection.has(c.uid)) return false;
      const matObj = mat(c.mat);
      const cl = (window.D.classeurs || []).find(x => x.id === c.cl) || {};
      return ((c.uid || '') + ' ' + (c.title || '') + ' ' + (matObj.name || '') + ' ' + (matObj.label || '') + ' ' + (cl.name || '')).toLowerCase().includes(q);
    }).slice(0, 12);
    if (!list.length) { res.innerHTML = '<div class="anki-mut" style="padding:8px;font-size:12px;">Aucun cours trouvé.</div>'; return; }
    res.innerHTML = list.map(c => {
      const m = mat(c.mat);
      const cl = (window.D.classeurs || []).find(x => x.id === c.cl) || {};
      return `<div class="anki-link-row" onclick="window.ankiCoursLinkToggle('${c.uid}')">
        <span class="anki-link-mat" style="background:${m.color}20;color:${m.color};">${m.label}</span>
        <span class="anki-link-id">${c.uid}</span>
        <span class="anki-link-title">${esc(c.title)}</span>
        <span class="anki-mut">${cl.name || ''}</span>
      </div>`;
    }).join('');
  }
  window.ankiCoursLinkSearch = function (v) { S.coursLinkQuery = v; renderCoursLinkUI(); };
  window.ankiCoursLinkToggle = function (uid) {
    if (S.coursLinkSelection.has(uid)) S.coursLinkSelection.delete(uid);
    else S.coursLinkSelection.add(uid);
    renderCoursLinkUI();
  };

  /** Applique la découpe DM sur un seul objet (sessions _morceauxTotal / _morceauxFaits) */
  function applyDevoirDecoupe(card, morceaux, tempsMinTotal) {
    const n = Math.max(1, parseInt(morceaux, 10) || 1);
    card._morceauxTotal = n;
    if (card._morceauxFaits == null) card._morceauxFaits = 0;
    if (n > 1) {
      card._dureeTotaleMin = tempsMinTotal;
      card.tempsCible = Math.max(60, Math.round((tempsMinTotal / n) * 60));
    } else {
      card._morceauxFaits = 0;
      delete card._dureeTotaleMin;
      card.tempsCible = Math.max(60, Math.round(tempsMinTotal * 60));
    }
  }

  window.saveExo = function () {
    showFormError('exoFormError', '');
    const titre = $("exoTitre").value.trim();
    const q = $("exoQ").value.trim();
    const r = $("exoR").value.trim();
    const matV = $("exoMat").value;
    const profil = $("exoProf") ? $("exoProf").value : 'COURS';
    const tempsMin = parseFloat($("exoTempsMin").value) || 1;
    const temps = Math.round(tempsMin * 60);
    const importance = window.getStarPickerValue('exoImportance');
    const stat = $("exoStat").value || "reservoir";
    const coursIds = Array.from(S.coursLinkSelection);

    function readSrc(prefix) {
      const type = ($("exoSrc" + prefix + "Type") || {}).value || '';
      const nom  = (($("exoSrc" + prefix + "Nom")  || {}).value || '').trim();
      const det  = (($("exoSrc" + prefix + "Det")  || {}).value || '').trim();
      if (!type && !nom && !det) return null;
      return { type: type || 'livre', nom, details: det };
    }
    const sourceEnonce     = readSrc('Enonce');
    const sourceCorrection = readSrc('Cor');

    if (!q || !matV) {
      showFormError('exoFormError', 'Énoncé et matière sont obligatoires.');
      return;
    }

    if (editingExoId) {
      const c = ankFind(editingExoId); if (!c || isDevoirCard(c)) return;
      Object.assign(c, { titre, question: q, reponse: r, mat: matV, profil, tempsCible: temps, importance, statut: stat, coursIds });
      delete c.priorite;
      if (sourceEnonce)     c.sourceEnonce     = sourceEnonce;     else delete c.sourceEnonce;
      if (sourceCorrection) c.sourceCorrection = sourceCorrection; else delete c.sourceCorrection;
      delete c.type;
      delete c.dateLimite;
      delete c._morceauxTotal;
      delete c._morceauxFaits;
      delete c._dureeTotaleMin;
      delete c.coursId;
      if (stat === 'actif' && !c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgo.todayISO();
    } else {
      const existing = ankExistingIds();
      const newId = window.AnkiAlgo.genExoUid('X', existing);
      const card = {
        id: newId, titre, question: q, reponse: r, mat: matV, profil, tempsCible: temps,
        importance, statut: stat, coursIds, intervalle: 0,
        ease: window.AnkiAlgo.getProfile(profil).ease,
        repetitions: 0, dateProchaineRevision: stat === 'actif' ? window.AnkiAlgo.todayISO() : null,
        historique: [], epinglee: false, dateCreation: new Date().toISOString()
      };
      if (sourceEnonce)     card.sourceEnonce     = sourceEnonce;
      if (sourceCorrection) card.sourceCorrection = sourceCorrection;
      window.D.exercices.unshift(card);
    }
    window.save();
    const ov = $("ovExo"); if (ov) ov.classList.add("hidden");
    window.renderAnki();
  };

  window.saveDevoir = function () {
    try {
      ensure();
      if (!window.D) {
        window.sysAlert("Données non chargées.", "Erreur");
        return;
      }
      showFormError('devoirFormError', '');

      const titre = fieldVal('devoirTitre');
      let q = fieldVal('devoirQ');
      let matV = fieldVal('devoirMat');
      const tempsMin = parseFloat(fieldVal('devoirTempsMin')) || 30;
      const morceaux = Math.max(1, parseInt(fieldVal('devoirMorceaux'), 10) || 1);
      const importance = window.getStarPickerValue('devoirImportance');
      const dateLim = fieldVal('devoirDateLim');
      const coursIds = Array.from(S.coursLinkSelection);

      if (!matV && (window.D.matieres || []).length === 1) matV = window.D.matieres[0].id;
      if (!q && titre) q = titre;

      function readDevoirSrc(prefix) {
        const type = fieldVal('devoirSrc' + prefix + 'Type');
        const nom  = fieldVal('devoirSrc' + prefix + 'Nom');
        const det  = fieldVal('devoirSrc' + prefix + 'Det');
        if (!type && !nom && !det) return null;
        return { type: type || 'livre', nom, details: det };
      }
      const sourceEnonce     = readDevoirSrc('Enonce');
      const sourceCorrection = readDevoirSrc('Cor');

      if (!(window.D.matieres || []).length) {
        showFormError('devoirFormError', 'Crée d\'abord une matière (onglet Matières), puis réouvre ce formulaire.');
        return;
      }
      if (!matV) {
        showFormError('devoirFormError', 'Choisis une matière dans la liste.');
        return;
      }
      if (!q) {
        showFormError('devoirFormError', 'Remplis les consignes (ou au minimum le titre du devoir).');
        return;
      }
    if (!dateLim) {
      showFormError('devoirFormError', 'Indique une date limite pour planifier le devoir dans l\'Agenda.');
      return;
    }
    if (dateLim < window.AnkiAlgo.todayISO()) {
      showFormError('devoirFormError', 'La date limite ne peut pas être dans le passé.');
      return;
    }

      const profil = 'EXO';
      const stat = 'actif';
      const today = window.AnkiAlgo.todayISO();

      if (editingExoId) {
        const c = ankFind(editingExoId); if (!c) return;
        window.D.exercices = (window.D.exercices || []).filter(x => x.id !== editingExoId);
        Object.assign(c, {
          titre, question: q, mat: matV, profil, importance, statut: stat, coursIds,
          type: 'devoir', dateLimite: dateLim
        });
        delete c.priorite;
        delete c.reponse;
        if (sourceEnonce)     c.sourceEnonce     = sourceEnonce;     else delete c.sourceEnonce;
        if (sourceCorrection) c.sourceCorrection = sourceCorrection; else delete c.sourceCorrection;
        applyDevoirDecoupe(c, morceaux, tempsMin);
        delete c.coursId;
        if (!c.dateProchaineRevision) c.dateProchaineRevision = today;
        if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
        if (!(window.D.devoirs || []).some(x => x.id === c.id)) window.D.devoirs.unshift(c);
      } else {
        if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
        const existing = ankExistingIds();
        const newId = window.AnkiAlgo.genExoUid('W', existing);
        const card = {
          id: newId, titre, question: q, mat: matV, profil, importance, statut: stat, coursIds,
          type: 'devoir', dateLimite: dateLim, intervalle: 0,
          ease: window.AnkiAlgo.getProfile(profil).ease,
          repetitions: 0, dateProchaineRevision: today,
          historique: [], epinglee: false, dateCreation: new Date().toISOString()
        };
        if (sourceEnonce)     card.sourceEnonce     = sourceEnonce;
        if (sourceCorrection) card.sourceCorrection = sourceCorrection;
        applyDevoirDecoupe(card, morceaux, tempsMin);
        window.D.devoirs.unshift(card);
      }
      window.save();
      editingExoId = null;
      const ov = $("ovDevoir"); if (ov) ov.classList.add("hidden");
      S.view = 'agenda';
      window.renderAnki();
      window.sysAlert(`${window.iconLabel('check', 'Devoir enregistré')}<br><b>${esc(titre || q)}</b> — visible dans l'Agenda.`, "Devoir W-");
    } catch (e) {
      console.error('saveDevoir', e);
      showFormError('devoirFormError', 'Erreur à l\'enregistrement : ' + (e.message || e));
    }
  };

  window.quickAddAnkiCard = function (data) {
    ensure();
    const matV = data.mat || ((window.D.matieres[0] && window.D.matieres[0].id) || 'XX');
    const existing = ankExistingIds();
    const id = window.AnkiAlgo.genExoUid('Y', existing);
    const profil = data.profil || "ANGLAIS";
    const statut = data.statut || "reservoir";
    const card = {
      id, titre: data.titre || "", question: data.question || "", reponse: data.reponse || "",
      mat: matV, profil, tempsCible: data.tempsCible || 60,
      importance: data.importance != null ? data.importance : window.AnkiAlgo.getImportance(data),
      statut,
      coursIds: data.coursIds || [], intervalle: 0, ease: window.AnkiAlgo.getProfile(profil).ease, repetitions: 0,
      dateProchaineRevision: statut === 'actif' ? window.AnkiAlgo.todayISO() : null, historique: [], epinglee: false, dateCreation: new Date().toISOString()
    };
    window.D.exercices.unshift(card);
    window.save();
    return card;
  };

  window.cardAlgoStatsLine = cardAlgoStatsLine;
})();
