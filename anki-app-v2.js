/**
 * anki-app.js v4 — UI Mode Synchrotron (PC*)
 * Vues : Cockpit · Agenda · Réservoir · Bibliothèque · Prévisions · Stats · Réglages
 */
(function () {
  const $ = id => document.getElementById(id);

  window.ankiQueueEmptyHtml = function (isManualTab, withQueueClass) {
    const M = window.APP_MSG || {};
    const msg = isManualTab
      ? (M.QUEUE_EMPTY_MANUAL || 'Sélectionne des cartes en mode manuel.')
      : (M.QUEUE_EMPTY || 'Aucune carte à réviser.');
    const icon = isManualTab ? 'search' : 'sparkles';
    const cls = withQueueClass ? 'anki-empty anki-queue-empty' : 'anki-empty';
    return `<div class="${cls}">${window.iconLabel(icon, msg)}</div>`;
  };

  const S = {
    view: "cockpit",
    queue: [], current: null, showAnswer: false,
    chronoStart: 0, chronoElapsed: 0, chronoInt: null,
    chronoRunning: false,
    chronoPausedAt: 0, chronoPausedAccum: 0,
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
    sessionMinTonight: null,
    expandedDay: null,
    sliderValue: 7,
    showSlider: false,
    sessionTempsManuel: null,             // v4: temps réel saisi manuellement (minutes)
    dernierExerciceModifie: null,         // v4: snapshot pour Undo
    sessionGeneree: false,                 // v4: flag "session du soir générée"
    sessionUI: 'mini',                   // 'full' | 'dock' | 'mini' — panneau Synchrotron
    dockShowCardDetail: false,
    cockpitMode: 'auto',                   // 'auto' | 'manual'
    cockpitFilterMat: '',
    cockpitFilterCours: '',
  };

  // Chrono session : démarrage manuel · pause/play · reprise auto onglet si en cours
  function stopChronoInterval() {
    if (S.chronoInt) { clearInterval(S.chronoInt); S.chronoInt = null; }
  }
  function syncChronoElapsed() {
    if (S.chronoRunning && S.chronoStart) {
      S.chronoElapsed = Math.max(0, (Date.now() - S.chronoStart) / 1000);
    }
  }
  function chronoColor() {
    const cible = (S.current && S.current.tempsCible) || 60;
    if (!S.chronoRunning && S.chronoElapsed <= 0) return "var(--mut)";
    if (S.chronoElapsed > cible * 1.5) return "var(--red)";
    if (S.chronoElapsed > cible) return "var(--gold)";
    return "var(--grn)";
  }
  function paintChronoDisplays() {
    syncChronoElapsed();
    const t = fmtSec(S.chronoElapsed);
    const col = chronoColor();
    ["ankiChrono", "syncDockChrono"].forEach(id => {
      const el = $(id);
      if (el) { el.textContent = t; el.style.color = col; }
    });
    document.querySelectorAll(".sync-dock-mini-time").forEach(el => {
      el.textContent = t;
      el.style.color = col;
    });
    const hint = $("ankiChronoHint");
    if (hint) {
      hint.textContent = S.chronoRunning
        ? "Chrono en cours"
        : (S.chronoElapsed > 0 ? "Chrono en pause — reprends ou remets à zéro" : "Lance le chrono quand tu es prêt(e)");
    }
    const toggle = $("btnChronoToggle");
    if (toggle) {
      toggle.innerHTML = window.iconHtml(S.chronoRunning ? "pause" : "play", 20);
      toggle.title = S.chronoRunning ? "Pause chrono" : (S.chronoElapsed > 0 ? "Reprendre le chrono" : "Lancer le chrono");
    }
    const dockToggle = $("btnChronoToggleDock");
    if (dockToggle) {
      dockToggle.innerHTML = window.iconHtml(S.chronoRunning ? "pause" : "play", 14);
    }
    const chronoEl = $("ankiChrono");
    if (chronoEl) chronoEl.classList.toggle("anki-chrono-idle", !S.chronoRunning && S.chronoElapsed <= 0);
  }
  function tickChrono() {
    paintChronoDisplays();
  }
  /** keepRunningIntent : true = pause technique (onglet / navigation), l'intention utilisateur reste « en cours » */
  function pauseChrono(keepRunningIntent) {
    syncChronoElapsed();
    stopChronoInterval();
    if (!keepRunningIntent) S.chronoRunning = false;
    paintChronoDisplays();
  }
  function startChrono() {
    if (!S.current) return;
    S.chronoStart = Date.now() - S.chronoElapsed * 1000;
    S.chronoRunning = true;
    stopChronoInterval();
    S.chronoInt = setInterval(tickChrono, 200);
    tickChrono();
  }
  function resetChronoCard() {
    stopChronoInterval();
    S.chronoRunning = false;
    S.chronoElapsed = 0;
    S.chronoStart = 0;
    S.chronoPausedAt = 0;
  }
  function renderChronoBlock(compact) {
    const sz = compact ? 14 : 20;
    const timeId = compact ? "syncDockChrono" : "ankiChrono";
    return `
      <div class="anki-chrono-wrap${compact ? ' compact' : ''}">
        <button type="button" class="anki-chrono-btn" id="${compact ? 'btnChronoToggleDock' : 'btnChronoToggle'}" data-testid="btn-chrono-toggle${compact ? '-dock' : ''}" onclick="window.ankiV2ToggleChrono()" aria-label="Chrono">
          ${window.iconHtml(S.chronoRunning ? "pause" : "play", sz)}
        </button>
        <div class="anki-chrono${!S.chronoRunning && S.chronoElapsed <= 0 ? ' anki-chrono-idle' : ''}${compact ? ' sync-dock-chrono' : ''}" id="${timeId}">${fmtSec(S.chronoElapsed)}</div>
        ${!compact ? `<button type="button" class="anki-chrono-btn anki-chrono-reset" data-testid="btn-chrono-reset" onclick="window.ankiV2ResetChrono()" title="Remettre à zéro">${window.iconHtml('refresh-cw', 16)}</button>` : ''}
      </div>
    `;
  }
  window.ankiV2ToggleChrono = function () {
    if (!S.current) return;
    if (S.chronoRunning) pauseChrono(false);
    else startChrono();
    renderSyncSessionDock();
  };
  window.ankiV2ResetChrono = function () {
    if (!S.current) return;
    resetChronoCard();
    paintChronoDisplays();
    if ($("ovAnkiSession") && !$("ovAnkiSession").classList.contains("hidden")) {
      const wrap = document.querySelector("#ovAnkiSession .anki-chrono-wrap:not(.compact)");
      if (wrap) {
        const parent = wrap.parentElement;
        const hint = $("ankiChronoHint");
        wrap.outerHTML = renderChronoBlock(false) + (hint ? '' : `<p class="anki-chrono-hint anki-mut" id="ankiChronoHint">Lance le chrono quand tu es prêt(e)</p>`);
      }
    }
    renderSyncSessionDock();
  };
  if (typeof document !== 'undefined' && !window._ankiVisibilityBound) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (S.chronoRunning) pauseChrono(true);
      } else if (S.chronoRunning && S.current) {
        startChrono();
      }
    });
    window._ankiVisibilityBound = true;
  }
  if (typeof document !== 'undefined' && !window._ankiRevealKeyBound) {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing || e.repeat) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (S.sessionUI !== 'full' || !S.current || S.showAnswer) return;
      const ov = $('ovAnkiSession');
      if (!ov || ov.classList.contains('hidden')) return;
      const btn = ov.querySelector('[data-testid="btn-reveal"]');
      if (!btn) return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return;
      }
      e.preventDefault();
      window.revealAnkiV2();
    });
    window._ankiRevealKeyBound = true;
  }

  function ensure() {
    if (!window.D) return;
    if (!Array.isArray(window.D.exercices)) window.D.exercices = [];
    if (!Array.isArray(window.D.devoirs)) window.D.devoirs = [];
  }
  function ankAllCards() {
    return window.AnkiAlgoV2 ? window.AnkiAlgoV2.allCards(window.D) : (window.D.exercices || []).concat(window.D.devoirs || []);
  }
  function ankFind(id) {
    return window.AnkiAlgoV2 ? window.AnkiAlgoV2.findCard(window.D, id) : ((window.D.exercices || []).find(x => x.id === id) || (window.D.devoirs || []).find(x => x.id === id));
  }
  function ankSessionPool() { return ankAllCards(); }
  function ankExistingIds() {
    return window.AnkiAlgoV2 ? Array.from(window.AnkiAlgoV2.allExistingIds(window.D)) : ankAllCards().map(c => c.id).concat((window.D.cours || []).map(x => x.uid));
  }
  function isQuickCard(c) {
    return !!(c && window.AnkiAlgoV2 && window.AnkiAlgoV2.cardKind(c) === 'quick');
  }
  function isMainCard(c) {
    return !!(c && window.AnkiAlgoV2 && window.AnkiAlgoV2.cardKind(c) === 'main');
  }
  function countReservoirMain() {
    return (window.D.exercices || []).filter(c => window.AnkiAlgoV2.isReservoir(c) && !isQuickCard(c) && !isDevoirCard(c)).length;
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
  function cardTypeKindOf(c) {
    if (window.cardTypeKind) return window.cardTypeKind(c);
    if (isDevoirCard(c)) return 'devoir';
    if (isQuickCard(c)) return 'quick';
    return 'main';
  }
  function cardTypeBadge(c) {
    return window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml(cardTypeKindOf(c)) : '';
  }
  function cardAlgoStatsLine(c) {
    if (!c || !window.AnkiAlgoV2) return '';
    const today = window.AnkiAlgoV2.todayISO();
    if (window.AnkiAlgoV2.cardKind(c) === 'devoir' || isDevoirCard(c)) {
      const urg = window.AnkiAlgoV2.urgenceDevoir(c, today);
      const bits = [`urg ${urg.total.toFixed(0)}`];
      if (c.dateLimite) bits.push(`limite ${c.dateLimite}`);
      if (c._morceauxTotal) bits.push(`sess ${(c._morceauxFaits || 0) + 1}/${c._morceauxTotal}`);
      return bits.join(' · ');
    }
    const sc = window.AnkiAlgoV2.priorityScore(c, today);
    const phase = sc.raw.phase || window.AnkiAlgoV2.getPhase(c);
    const bits = [
      `prio ${sc.priority.toFixed(0)}`,
      phase,
      `★${window.AnkiAlgoV2.getImportance(c)}`,
      `ease ${(c.ease || 2.5).toFixed(1)}`,
      `rep ${c.repetitions || 0}`
    ];
    if (c._v2WindowOpen && c._v2WindowClose) bits.push(`fen ${c._v2WindowOpen}→${c._v2WindowClose}`);
    else if (c.dateProchaineRevision) {
      bits.push(c.dateProchaineRevision < today ? `retard (${c.dateProchaineRevision})` : `→ ${c.dateProchaineRevision}`);
    }
    return bits.join(' · ');
  }

  function getSessionMinutesV2() {
    if (S.sessionMinTonight != null) return S.sessionMinTonight;
    const st = window.AnkiAlgoV2 ? window.AnkiAlgoV2.getSettings() : {};
    return st.sessionMinDefault || (window.D.settings && window.D.settings.ankiSessionMin) || 90;
  }

  function renderSessionTimeBar(sessionMin) {
    const total = Math.max(5, Math.min(300, parseInt(sessionMin, 10) || 60));
    const presets = [[45, '45m'], [60, '1h'], [75, '1h15'], [90, '1h30'], [120, '2h']];
    return `
      <div class="anki-session-bar">
        <span class="anki-session-bar-label">${window.iconLabel('timer', 'Durée session')}</span>
        ${durationPickerHtml(total, { minTotal: 5, maxTotal: 300, maxHours: 5, hClass: 'anki-time-h', mClass: 'anki-time-m', onChange: 'window.ankiV2SetSessionTime()' })}
        <div class="anki-session-presets">
          ${presets.map(([m, label]) =>
            `<button type="button" class="cbt anki-preset-time${total === m ? ' on' : ''}" data-preset="${m}" onclick="window.ankiV2SetSessionTimePreset(${m})">${label}</button>`
          ).join('')}
        </div>
      </div>`;
  }

  function durationPickerHtml(totalMin, opts) {
    opts = opts || {};
    const minTotal = opts.minTotal != null ? opts.minTotal : 5;
    const maxTotal = opts.maxTotal != null ? opts.maxTotal : 300;
    const maxHours = opts.maxHours != null ? opts.maxHours : 5;
    const hId = opts.hId || '';
    const mId = opts.mId || '';
    const hClass = opts.hClass || 'anki-time-h';
    const mClass = opts.mClass || 'anki-time-m';
    const onChange = opts.onChange ? ` onchange="${opts.onChange}"` : '';
    const label = opts.label;
    const wrapClass = opts.wrapClass || 'anki-session-time';

    let total = Math.max(minTotal, Math.min(maxTotal, Math.round(parseFloat(totalMin)) || minTotal));
    let h = Math.floor(total / 60);
    let m = Math.round((total % 60) / 5) * 5;
    if (h * 60 + m < minTotal) m = minTotal - h * 60;
    if (m >= 60) { h += 1; m -= 60; }
    m = Math.round(m / 5) * 5;

    const hourOpts = Array.from({ length: maxHours + 1 }, (_, i) => i).map(hh =>
      `<option value="${hh}"${hh === h ? ' selected' : ''}>${hh}</option>`
    ).join('');
    const minOpts = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(mm =>
      `<option value="${mm}"${mm === m ? ' selected' : ''}>${String(mm).padStart(2, '0')}</option>`
    ).join('');

    const picker = `
      <div class="${wrapClass}">
        <select class="${hClass} fi" ${hId ? `id="${hId}"` : ''} aria-label="Heures"${onChange}>${hourOpts}</select>
        <span class="anki-time-unit">h</span>
        <select class="${mClass} fi" ${mId ? `id="${mId}"` : ''} aria-label="Minutes"${onChange}>${minOpts}</select>
        <span class="anki-time-unit">min</span>
      </div>`;

    if (label) {
      return `<div class="fg anki-duration-field"><label>${label}</label>${picker}</div>`;
    }
    return picker;
  }

  function readDurationFromPicker(hId, mId, hClass, mClass, minTotal, maxTotal) {
    const hEl = hId ? $(hId) : document.querySelector('.' + (hClass || 'anki-time-h'));
    const mEl = mId ? $(mId) : document.querySelector('.' + (mClass || 'anki-time-m'));
    const h = hEl ? parseInt(hEl.value, 10) || 0 : 0;
    const m = mEl ? parseInt(mEl.value, 10) || 0 : 0;
    return Math.max(minTotal, Math.min(maxTotal, h * 60 + m));
  }

  function syncDurationPicker(total, hId, mId, hClass, mClass) {
    const hEl = hId ? $(hId) : document.querySelector('.' + (hClass || 'anki-time-h'));
    const mEl = mId ? $(mId) : document.querySelector('.' + (mClass || 'anki-time-m'));
    if (!hEl || !mEl) return;
    const h = Math.floor(total / 60);
    const m = Math.round((total % 60) / 5) * 5;
    hEl.value = String(h);
    mEl.value = String(m);
  }
  function stars(c) { return window.importanceLabel(c); }
  function cardImportance(c) { return window.AnkiAlgoV2.getImportance(c); }
  function sessStatsHtml(ok, mid, bad) {
    return `${window.iconHtml('check', 14, 'eval-good')} ${ok} · ${window.iconHtml('circle-minus', 14, 'eval-mid')} ${mid} · ${window.iconHtml('circle-x', 14, 'eval-bad')} ${bad}`;
  }
  function searchField(placeholder, attrs) {
    return `<div class="search-field"><span data-icon="search" data-icon-size="14"></span><input class="fi" placeholder="${placeholder}" ${attrs || ''}></div>`;
  }
  function isDevoirCard(c) {
    if (!c) return false;
    if (window.AnkiAlgoV2 && window.AnkiAlgoV2.cardKind(c) === 'devoir') return true;
    return c.type === 'devoir' || c.type === 'devoir-morceau';
  }
  function profileLabel(p) { const pr = window.AnkiAlgoV2.getProfile(p); return pr ? pr.label : p; }

  // ===== Vue principale =====
  window.renderAnkiV2 = function () {
    ensure();
    const shift = window.AnkiAlgoV2.shiftProgramIfMissedDaily(window.D);
    if (shift.shifted > 0) window.save();
    restoreSessionFromStorageIfAny();

    const root = $("paneAnkiV2");
    if (!root) return;

    const reservoir = countReservoirMain();
    const sessionActive = sessionIsLive();
    const sessionRem = sessionActive ? sessionRemainingCount() : 0;

    root.innerHTML = `
      <div class="anki-head">
        <h2>${window.iconLabel('dna', 'Synchrotron')} <span class="anki-sub">— Répétition espacée PC*</span></h2>
        <p>Fenêtres ★ · Phases (apprentissage → mature) · Score de priorité.</p>
      </div>

      <div class="anki-nav">
        <button class="anki-tab ${S.view === 'cockpit' ? 'on' : ''}" data-anki-v2-view="cockpit" data-testid="anki-tab-cockpit" onclick="window.ankiV2SetView('cockpit')">${window.iconLabel('sliders', 'Cockpit')}</button>
        <button class="anki-tab ${S.view === 'agenda' ? 'on' : ''}" data-anki-v2-view="agenda" data-testid="anki-tab-agenda" onclick="window.ankiV2SetView('agenda')">${window.iconLabel('clipboard-list', 'Agenda')}</button>
        <button class="anki-tab ${S.view === 'reservoir' ? 'on' : ''}" data-anki-v2-view="reservoir" data-testid="anki-tab-reservoir" onclick="window.ankiV2SetView('reservoir')">${window.iconLabel('hourglass', 'Réservoir')}${reservoir ? `<span class="anki-tab-badge">${reservoir}</span>` : ''}</button>
        <button class="anki-tab ${S.view === 'library' ? 'on' : ''}" data-anki-v2-view="library" data-testid="anki-tab-library" onclick="window.ankiV2SetView('library')">${window.iconLabel('book-open', 'Bibliothèque')}</button>
        <button class="anki-tab ${S.view === 'forecast' ? 'on' : ''}" data-anki-v2-view="forecast" data-testid="anki-tab-forecast" onclick="window.ankiV2SetView('forecast')">${window.iconLabel('calendar', 'Prévisions')}</button>
        <button class="anki-tab ${S.view === 'stats' ? 'on' : ''}" data-anki-v2-view="stats" data-testid="anki-tab-stats" onclick="window.ankiV2SetView('stats')">${window.iconLabel('bar-chart', 'Stats')}</button>
        <button class="anki-tab ${S.view === 'settings' ? 'on' : ''}" data-anki-v2-view="settings" data-testid="anki-tab-settings" onclick="window.ankiV2SetView('settings')">${window.iconLabel('settings', 'Réglages')}</button>
      </div>

      ${sessionActive ? `
        <div class="anki-session-resume" data-testid="session-resume-bar">
          <span>${window.iconLabel('pin', `<b>Session du soir en cours</b> — ${sessionRem} carte(s) restante(s)`)}</span>
          <div>
            <button class="bp" data-testid="btn-reprendre-session" onclick="window.ankiV2ResumeSession()">${window.iconLabel('play', 'Reprendre la session en cours')}</button>
            <button class="bs" data-testid="btn-abandon-session" onclick="window.ankiV2DiscardSession()">${window.iconLabel('trash-2', 'Abandonner')}</button>
          </div>
        </div>
      ` : ''}

      <div id="ankiV2ViewContent"></div>
    `;
    renderActiveView();
    renderSyncSessionDock();
    window.hydrateIcons(root);
    if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
  };

  window.ankiV2SetView = function (v) {
    if (S.current) pauseChrono(true);
    S.view = v;
    const root = $("paneAnkiV2");
    if (root && root.querySelector('.anki-nav')) {
      root.querySelectorAll('.anki-tab').forEach(btn => {
        const tab = btn.getAttribute('data-anki-v2-view');
        if (tab) btn.classList.toggle('on', tab === v);
      });
      updateReservoirTabBadge(root);
      renderActiveView();
      if (typeof window.syncNavSubMenu === 'function') window.syncNavSubMenu();
      return;
    }
    window.renderAnkiV2();
  };

  window.ankiV2SetCockpitMode = function (mode) {
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
    const root = $("paneAnkiV2");
    if (root && root.querySelector('.anki-nav')) {
      renderActiveView();
      return;
    }
    window.renderAnkiV2();
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
    if (window.AnkiAlgoV2.cardDuration) return window.AnkiAlgoV2.cardDuration(c);
    if (c.type === 'devoir' || c.type === 'devoir-morceau') {
      return Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)) * 60);
    }
    return c.tempsCible || 60;
  }

  function pickLowestPriorityCard(cartes) {
    const ref = window.AnkiAlgoV2.todayISO();
    let worst = null, worstScore = Infinity;
    (cartes || []).forEach(c => {
      const s = window.AnkiAlgoV2.scoreSession(c, ref).total;
      if (s < worstScore) { worstScore = s; worst = c; }
    });
    return worst;
  }

  function applyAutoAdjustments(basePlan, sessionMin) {
    const settings = window.D.settings || {};
    const marge = typeof settings.margeBudget === 'number' ? settings.margeBudget : (window.AnkiAlgoV2.DEFAULT_COEFS && window.AnkiAlgoV2.DEFAULT_COEFS.MARGE_BUDGET_DEFAULT) || 0.92;
    const budget = (sessionMin || 60) * 60 * Math.max(0.5, Math.min(1, marge));
    const overflowExtend = !!settings.ankiSessionOverflow;
    let cartes = (basePlan.cartes || []).filter(c => !S.excludedIds.has(c.id));
    let used = cartes.reduce((s, c) => s + cardDurationSec(c), 0);

    S.pinnedIds.forEach(id => {
      if (cartes.some(c => c.id === id)) return;
      const c = ankFind(id);
      if (!c || !window.AnkiAlgoV2.isActive(c)) return;
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
    const sessionMin = getSessionMinutesV2();
    const includeNew = settings.ankiIncludeNew !== undefined ? settings.ankiIncludeNew : 5;
    const isManualTab = S.cockpitMode === 'manual';

    if (isManualTab) {
      const selectedIds = getSelectedIds();
      if (!selectedIds.length) {
        return { cartes: [], tempsTotalPrev: 0, reportees: [], marge: settings.margeBudget || 0.92, countDevoir: 0, countMain: 0, countQuick: 0, overload: false, overloadDelta: 0 };
      }
      const map = {};
      ankSessionPool().forEach(c => { map[c.id] = c; });
      const cartes = selectedIds.map(id => map[id]).filter(Boolean);
      S.manualOrder = selectedIds.slice();
      let countDevoir = 0, countMain = 0, countQuick = 0;
      cartes.forEach(c => {
        const k = window.AnkiAlgoV2.cardKind(c);
        if (k === 'devoir') countDevoir++;
        else if (k === 'quick') countQuick++;
        else countMain++;
      });
      const tempsTotalPrev = cartes.reduce((s, c) => s + cardDurationSec(c), 0);
      return {
        cartes,
        tempsTotalPrev,
        reportees: [],
        marge: settings.margeBudget || 0.92,
        countDevoir,
        countMain,
        countQuick,
        countDevoirForce: 0,
        countDevoirLatent: 0,
        countQuickWoven: 0,
        countQuickExtra: 0,
        overload: false,
        overloadDelta: 0
      };
    }

    const base = window.AnkiAlgoV2.buildSession(ankSessionPool(), {
      sessionMinutes: sessionMin,
      includeNew,
      selectedIds: null,
      manualOrder: null,
      pullForward: (window.AnkiAlgoV2.getSettings().pullForward !== false)
    });
    return applyAutoAdjustments(base, sessionMin);
  }

  window.ankiV2SetSessionTime = function () {
    const hEl = document.querySelector('.anki-time-h');
    const mEl = document.querySelector('.anki-time-m');
    const h = hEl ? parseInt(hEl.value, 10) || 0 : 0;
    const m = mEl ? parseInt(mEl.value, 10) || 0 : 0;
    const total = Math.max(5, Math.min(300, h * 60 + m));
    if (!window.D.settings) window.D.settings = {};
    if (!window.D.settings.algoV2) window.D.settings.algoV2 = {};
    window.D.settings.algoV2.sessionMinDefault = total;
    S.sessionMinTonight = total;
    window.save();
    syncSessionTimeUi(total);
    refreshQueueOnly();
  };

  window.ankiV2SetSessionTimePreset = function (min) {
    const total = Math.max(5, Math.min(300, parseInt(min, 10) || 60));
    if (!window.D.settings) window.D.settings = {};
    if (!window.D.settings.algoV2) window.D.settings.algoV2 = {};
    window.D.settings.algoV2.sessionMinDefault = total;
    S.sessionMinTonight = total;
    window.save();
    syncSessionTimeUi(total);
    refreshQueueOnly();
  };

  function syncSessionTimeUi(total) {
    syncDurationPicker(total, null, null, 'anki-time-h', 'anki-time-m');
    const kpi = document.getElementById('ankiKpiSessionDur') || document.querySelector('.anki-kpis .kpi:last-child .kpi-n');
    if (kpi) kpi.innerHTML = formatSessionKpi(total);
    document.querySelectorAll('.anki-preset-time').forEach(btn => {
      btn.classList.toggle('on', parseInt(btn.dataset.preset, 10) === total);
    });
  }

  window.ankiV2SetSessionOverflow = function (checked) {
    if (!window.D.settings) window.D.settings = {};
    window.D.settings.ankiSessionOverflow = !!checked;
    window.save();
    const picker = document.querySelector('.anki-overflow-picker');
    if (picker) {
      const on = !!checked;
      const toggle = picker.querySelector('.anki-overflow-switch');
      if (toggle) {
        toggle.classList.toggle('is-on', on);
        toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      picker.querySelectorAll('.anki-overflow-side').forEach(function (btn) {
        const extend = btn.getAttribute('data-overflow') === 'extend';
        btn.classList.toggle('on', extend ? on : !on);
      });
    }
    refreshQueueOnly();
  };

  function renderSessionOverflowPicker() {
    const on = !!(window.D.settings && window.D.settings.ankiSessionOverflow);
    return `
      <div class="anki-overflow-picker" role="group" aria-label="Gestion du budget session">
        <button type="button" class="anki-overflow-side anki-overflow-side--left${on ? '' : ' on'}" data-overflow="trim" onclick="window.ankiV2SetSessionOverflow(false)">
          <span class="anki-overflow-side-title">Enlever les cartes</span>
          <span class="anki-overflow-side-hint anki-mut">moins prioritaires</span>
        </button>
        <button type="button" class="anki-overflow-switch${on ? ' is-on' : ''}" aria-pressed="${on ? 'true' : 'false'}" aria-label="Basculer le mode budget" onclick="window.ankiV2SetSessionOverflow(!(window.D.settings && window.D.settings.ankiSessionOverflow))">
          <span class="anki-overflow-switch-track" aria-hidden="true"><span class="anki-overflow-switch-thumb"></span></span>
        </button>
        <button type="button" class="anki-overflow-side anki-overflow-side--right${on ? ' on' : ''}" data-overflow="extend" onclick="window.ankiV2SetSessionOverflow(true)">
          <span class="anki-overflow-side-title">Dépasser le temps max</span>
          <span class="anki-overflow-side-hint anki-mut">si besoin</span>
        </button>
      </div>`;
  }

  window.ankiV2SetSessionMin = function (val) {
    window.ankiV2SetSessionTime();
  };

  function renderActiveView() {
    const c = $("ankiV2ViewContent");
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
    const cands = window.AnkiAlgoV2.getCandidates(exos);
    const sessionMin = getSessionMinutesV2();
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
    const candidats = window.AnkiAlgoV2.getCandidates(window.D.exercices)
      .map(x => ({ ...x.card, _prio: x.score.total }));
    const cockpitSearch = (S.cockpitSearch || '').trim().toLowerCase();
    const isManualTab = S.cockpitMode === 'manual';
    let list = isManualTab ? allCards.map(c => ({
      ...c,
      _prio: window.AnkiAlgoV2.scoreSession(c).total
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
          _prio: c._prio != null ? c._prio : window.AnkiAlgoV2.scoreSession(c).total
        }));
      }
    }
    list.sort((a, b) => (b._prio || 0) - (a._prio || 0));
    return list;
  }

  function renderCockpitPickFilters(isManualTab) {
    if (!isManualTab) return '';
    const matOpts = (window.D.matieres || []).map(m =>
      `<option value="${m.id}"${S.cockpitFilterMat === m.id ? ' selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`
    ).join('');
    const coursList = (window.D.cours || []).filter(co =>
      !S.cockpitFilterMat || co.mat === S.cockpitFilterMat
    );
    const coursOpts = coursList.map(co =>
      `<option value="${co.uid}"${S.cockpitFilterCours === co.uid ? ' selected' : ''}>${esc(co.uid)} · ${esc(co.title)}</option>`
    ).join('');
    return `
      <div class="anki-filters anki-cockpit-filters">
        <select class="fi" onchange="window.ankiV2CockpitFilter('mat', this.value)">
          <option value="">Toutes matières</option>${matOpts}
        </select>
        <select class="fi" onchange="window.ankiV2CockpitFilter('cours', this.value)">
          <option value="">Tous chapitres / cours</option>${coursOpts}
        </select>
        <button type="button" class="bp" ${S.cockpitFilterCours ? '' : 'disabled'} onclick="window.ankiV2PlayChapter('${esc(S.cockpitFilterCours)}')" title="Réviser toutes les cartes actives du chapitre">${window.iconLabel('play', 'Play chapitre')}</button>
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
        <b>${window.AnkiAlgoV2.fmtDur(plan.overloadDelta)}</b>. Pense à augmenter la durée de session,
        ou à devancer certains DM sur les jours précédents.</span>
      </div>
    ` : '';

    const cockpitSearch = S.cockpitSearch || '';
    const displayList = getCockpitDisplayList();

    let html = `
      ${renderCockpitKpisBar()}
      <div class="anki-cockpit-tabs">
        <button type="button" class="anki-cockpit-tab ${!isManualTab ? 'on' : ''}" onclick="window.ankiV2SetCockpitMode('auto')">${window.iconLabel('brain', 'Automatique')}</button>
        <button type="button" class="anki-cockpit-tab ${isManualTab ? 'on' : ''}" onclick="window.ankiV2SetCockpitMode('manual')">${window.iconLabel('mouse-pointer-click', 'Manuel')}</button>
      </div>
      ${overloadBanner}
      <div class="anki-card-block ${isManualTab ? 'manual' : 'auto'}">
        <div class="anki-block-hdr">
          <div>
            <h3>${isManualTab ? window.iconLabel('mouse-pointer-click', 'File manuelle') : window.iconLabel('brain', 'File automatique')} <span class="anki-mut" id="ankiQueueMeta">(${cartes.length} cartes · ${window.AnkiAlgoV2.fmtDur(total)})</span></h3>
            <p class="anki-mut" data-testid="cockpit-piles-counts">
              <span style="color:var(--red);font-weight:700;">${window.iconLabel('pin', `${counts.devoir} devoir${counts.devoir > 1 ? 's' : ''}`)}</span>${counts.devoirF ? ` (${counts.devoirF} forcé${counts.devoirF > 1 ? 's' : ''}${counts.devoirL ? ' + ' + counts.devoirL + ' latent' + (counts.devoirL > 1 ? 's' : '') : ''})` : ''}
              · <span style="color:var(--grn);font-weight:700;">${window.iconLabel('brain', `${counts.main} principale${counts.main > 1 ? 's' : ''}`)}</span>
              · <span style="color:#5b8def;font-weight:700;">${window.iconLabel('languages', `${counts.quick} rapide${counts.quick > 1 ? 's' : ''}`)}</span>${counts.quickW ? ` (${counts.quickW} tissée${counts.quickW > 1 ? 's' : ''}${counts.quickE ? ' + ' + counts.quickE + ' fin' : ''})` : ''}
              · marge ${Math.round((plan.marge || 0.92) * 100)}%
              · ${isManualTab ? '<span style="color:var(--gold);">Uniquement ta sélection</span>' : '<span style="color:var(--grn);">Algorithme + ajustements</span>'}
            </p>
          </div>
          <div class="anki-block-actions" style="align-items:center;">
            <button class="bs" data-testid="btn-create-card" onclick="window.openCardTypePicker()" title="Devoir, principale ou rapide">${window.iconLabel('plus', 'Créer')}</button>
            <button class="bs" data-testid="btn-generer-session-soir" onclick="window.ankiV2GenererSessionSoir()" title="Fige la file actuelle (auto ou manuelle) pour ce soir">${window.iconLabel('pin', 'Session du soir')}</button>
            <button class="bp" data-testid="btn-commencer-session" onclick="window.startAnkiV2Session()" ${cartes.length === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>${window.iconLabel('play', 'Commencer')}</button>
          </div>
        </div>
        ${!isManualTab ? renderSessionOverflowPicker() : ''}
        <p class="anki-mut" style="font-size:11px;margin:0 0 8px;">${isManualTab
          ? window.iconLabel('lightbulb', 'Clique une carte ci-dessous → elle apparaît ici en haut. Glisse pour réordonner.')
          : window.iconLabel('lightbulb', 'L&apos;algo remplit la file. Clique une carte due pour l&apos;ajouter ou la retirer — le reste de la file est conservé.')
        }</p>
        <div class="anki-queue anki-queue-fixed" id="ankiQueueDrop">
          ${cartes.length === 0 ? (typeof window.ankiQueueEmptyHtml === 'function' ? window.ankiQueueEmptyHtml(isManualTab) : `<div class="anki-empty">${isManualTab ? window.iconLabel('search', (window.APP_MSG && window.APP_MSG.QUEUE_EMPTY_MANUAL) || 'Sélectionne des cartes en mode manuel.') : window.iconLabel('sparkles', (window.APP_MSG && window.APP_MSG.QUEUE_EMPTY) || 'Aucune carte à réviser.')}</div>`) : cartes.map((c, i) => renderQueueRow(c, i)).join('')}
        </div>
        ${plan.reportees.length && !isManualTab ? `<div class="anki-mut" style="margin-top:8px;font-size:11px;">${plan.reportees.length} carte(s) hors budget → reportées</div>` : ""}
      </div>
    `;

    const pickTitle = isManualTab ? 'Choisir mes cartes' : 'Ajouter des Cartes';
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
            ${isManualTab ? `<button class="cbt" type="button" onclick="window.ankiV2SelectAllPick()">Sél. toutes</button>` : `<button class="cbt" type="button" onclick="window.ankiV2ResetAutoAdjust()">Réinit. algo</button>`}
            <button class="cbt" type="button" onclick="window.ankiV2SelectClear()">Vider</button>
          </div>
        </div>
        ${isManualTab ? searchField("Cherche carte, chapitre, code cours...", `class="fi anki-search-input" value="${esc(cockpitSearch)}" oninput="window.ankiV2CockpitSearch(this.value)"`) : (cockpitSearch || displayList.length > 12 ? searchField('Filtrer les cartes dues...', `class="fi anki-search-input" value="${esc(cockpitSearch)}" oninput="window.ankiV2CockpitSearch(this.value)"`) : '')}
        ${renderCockpitPickFilters(isManualTab)}
        <p class="anki-mut" style="margin:8px 0 6px;font-size:11px;">${pickHint}${isManualTab ? ' · triées par prio ↓' : ''}</p>
        <div class="cgrid anki-pick-grid" id="ankiPickGrid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;">
          ${displayList.map(c => renderPickPcard(c)).join('') || `<div class="anki-empty" style="grid-column:1/-1;">${(window.APP_MSG && window.APP_MSG.EMPTY_SEARCH) || 'Aucun résultat'}</div>`}
        </div>
      </div>
    `;
    return html;
  }

  // ====== VUE AGENDA (devoirs W- triés par date limite) ======
  function viewAgenda() {
    const ref = window.AnkiAlgoV2.todayISO();
    const seuil = (window.D.settings && window.D.settings.seuilDevoirForce) || 35;
    const devoirs = (window.D.devoirs || [])
      .filter(c => c.statut === 'actif')
      .map(c => ({ card: c, urg: window.AnkiAlgoV2.urgenceDevoir(c, ref) }))
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
            <button class="bp" onclick="window.ankiV2OpenDevoirModal()">+ Ajouter un devoir</button>
          </div>
        </div>
        ${forcesCeSoir.length ? `
          <div style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(233,79,100,0.12);border:1px solid rgba(233,79,100,0.35);font-size:13px;">
            <b>Ce soir (Phase 0)</b> : ${forcesCeSoir.length} devoir(s) forcé(s) · ~${window.AnkiAlgoV2.fmtDur(tempsForce)}
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
          ${cardTypeBadge(d)}
          <span class="anki-q-mat" style="background:${m.color};">${window.iconHtml('file-text', 12)}</span>
          <div class="anki-devoir-body">
            <div class="anki-devoir-title">${esc(d.titre || d.question)} ${isForce ? '<span style="color:var(--red);font-size:11px;">· FORCÉ ce soir</span>' : ''}</div>
            <div class="anki-devoir-meta">${d.id} · ${window.iconHtml('calendar', 12)} ${d.dateLimite || '—'} · ${jrLabel} · urg ${urg.total.toFixed(0)} · session ${done + 1}/${total} · ${window.iconHtml('timer', 12)} ${window.AnkiAlgoV2.fmtDur((d._dureeTotaleMin || d.tempsCible / 60) / total * 60)}/sess</div>
            <div class="anki-progress"><div class="anki-progress-bar" style="width:${pct}%;background:${m.color};"></div></div>
          </div>
          ${window.iconBtn('play', 'Session', `onclick="window.startAnkiV2Single('${d.id}')"`)}
          ${typeof window.iconEditDeletePair === 'function'
            ? window.iconEditDeletePair(`window.ankiV2EditExo('${d.id}')`, `window.ankiV2DelExo('${d.id}')`)
            : (window.iconBtn('pencil', 'Modifier', `onclick="window.ankiV2EditExo('${d.id}')"`) +
               window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red);border-color:var(--red);" onclick="window.ankiV2DelExo('${d.id}')"`))}
        </div>
      `;
    }).join('');
  }

  window.ankiV2CockpitSearch = function (v) {
    S.cockpitSearch = v;
    renderPickGridOnly();
    const input = document.querySelector('.anki-search-input');
    if (input) { input.focus(); input.setSelectionRange(v.length, v.length); }
  };

  window.ankiV2CockpitFilter = function (k, v) {
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

  window.ankiV2BackToAuto = function () {
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
    const kind = window.AnkiAlgoV2.cardKind(c);
    const kindLabel = kind === 'devoir' ? 'W' : kind === 'quick' ? 'Y' : 'X';
    const pinTag = !isManualTab && S.pinnedIds.has(c.id) ? '<span class="anki-pcard-pin">+</span>' : '';
    return `
      <div class="pcard anki-pcard ${sel ? 'sel' : ''}" data-pickid="${c.id}" onclick="event.preventDefault();window.ankiV2TogglePick('${c.id}')">
        <div class="pc-check">${sel ? window.iconHtml('check', 14, 'icon-sm') : window.iconHtml('square', 14, 'icon-sm')}</div>
        ${pinTag}
        <div class="anki-pcard-mat" style="background:${m.color}20;color:${m.color};">${cardTypeBadge(c)} ${esc(m.label)}</div>
        <div class="pc-uid">${c.id}</div>
        <div class="pc-title">${esc(c.titre || (c.question || '').substring(0, 48))}</div>
        <div class="anki-pcard-stats anki-mut">${cardAlgoStatsLine(c)}</div>
        <div class="anki-pcard-urg" title="Priorité V2">${(c._prio || 0).toFixed(0)}</div>
      </div>`;
  }

  function renderPickGridOnly() {
    const grid = $("ankiPickGrid");
    const stats = $("ankiPickStats");
    const scrollTop = grid ? grid.scrollTop : 0;
    if (!grid) { renderActiveView(); return; }
    const plan = computeCockpitPlan();
    S._effectiveIds = new Set(plan.cartes.map(c => c.id));
    const list = getCockpitDisplayList();
    grid.innerHTML = list.map(c => renderPickPcard(c)).join('')
      || `<div class="anki-empty" style="grid-column:1/-1;">${(window.APP_MSG && window.APP_MSG.EMPTY_SEARCH) || 'Aucun résultat'}</div>`;
    if (stats) {
      stats.textContent = S.cockpitMode === 'manual'
        ? `${S.selectionIds.size} sélectionnée(s)`
        : `${S.pinnedIds.size} ajoutée(s) · ${S.excludedIds.size} retirée(s)`;
    }
    grid.scrollTop = scrollTop;
    window.hydrateIcons(grid);
  }

  function renderQueueRow(c, i) {
    const m = mat(c.mat);
    const isManualTab = S.cockpitMode === 'manual';
    const today = window.AnkiAlgoV2.todayISO();
    const isLate = c.dateProchaineRevision && c.dateProchaineRevision < today;
    const kind = window.AnkiAlgoV2.cardKind(c);
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
        ${cardTypeBadge(c)}
        <div class="anki-q-mat" style="background:${m.color};">${isDevoir ? window.iconHtml('file-text', 12) : m.label}</div>
        <div class="anki-q-body" onclick="window.startAnkiV2Single('${c.id}')">
          <div class="anki-q-title">${esc(c.titre || (c.question || '').substring(0, 60))}${sessionInfo}</div>
          <div class="anki-q-meta">${c.id} · ${cardAlgoStatsLine(c)} ${isLate ? '<span style="color:var(--red);">· retard</span>' : ''}</div>
        </div>
        <div class="anki-q-time" onclick="event.stopPropagation();">
          <input type="number" min="0.25" max="600" step="0.25" value="${tempsAffiche}" title="Temps en minutes — éditable"
            onchange="window.ankiV2UpdateTemps('${c.id}', this.value, ${isDevoir})">
          <span class="anki-mut">min</span>
        </div>
        <div class="anki-q-go" onclick="window.startAnkiV2Single('${c.id}')">${window.iconHtml('play', 14)}</div>
        ${isManualTab ? `<button type="button" class="anki-q-remove" title="Retirer" onclick="event.stopPropagation();window.ankiV2TogglePick('${c.id}')">${window.iconHtml('x', 14)}</button>` : ''}
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
    const all = exos.filter(c => window.AnkiAlgoV2.isReservoir(c) && !isQuickCard(c) && !isDevoirCard(c));
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
    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${S.reservoirFilter.mat === m.id ? 'selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`).join('');
    const selCount = S.reservoirSel.size;

    let html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <div>
            <h3>${window.iconLabel('hourglass', 'Réservoir')} <span class="anki-mut">(${all.length} cartes)</span></h3>
            <p class="anki-mut" style="font-size:12px;">Les cartes du réservoir n'entrent JAMAIS dans les sessions automatiques. Active-les manuellement quand tu veux les intégrer aux révisions.</p>
          </div>
          <div class="anki-block-actions">
            <button class="bp" data-testid="btn-reservoir-new-card" onclick="window.openCardTypePicker()">+ Nouvelle carte</button>
          </div>
        </div>
        <div class="anki-filters">
          ${searchField('Titre, énoncé, code...', `data-testid="reservoir-search" value="${esc(S.reservoirFilter.q || '')}" oninput="window.ankiV2ReservoirFilter('q', this.value)"`)}
          <select class="fi" data-testid="reservoir-mat-filter" onchange="window.ankiV2ReservoirFilter('mat', this.value)">
            <option value="">Toutes matières</option>${matOpts}
          </select>
          <button class="bs" data-testid="btn-reservoir-clear-sel" onclick="window.ankiV2ReservoirClearSel()">Vider sél. (${selCount})</button>
          <button class="bp" data-testid="btn-reservoir-activate-selected" onclick="window.ankiV2ReservoirActivateSelected()" ${selCount === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>${window.iconLabel('zap', `Activer la sélection (${selCount})`)}</button>
        </div>
        ${list.length === 0 ? `<div class="anki-empty">${(window.APP_MSG && window.APP_MSG.EMPTY_RESERVOIR) || 'Aucune carte dans le réservoir.'}</div>` : matKeys.map(k => {
          const m = mat(k);
          const cards = groups[k];
          return `
            <div class="anki-lib-group" data-testid="reservoir-group-${k}">
              <div class="anki-lib-group-hdr" style="border-left:4px solid ${m.color};">
                <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${esc(m.label)}</span>
                <span class="anki-lib-grp-t">${esc(m.name || k)}</span>
                <span class="anki-mut" style="margin-left:auto;">${cards.length}</span>
                <button class="bs" style="margin-left:8px;" data-testid="btn-reservoir-activate-mat-${k}" onclick="window.ankiV2ReservoirActivateMat('${k}')">${window.iconLabel('zap', 'Activer toute la matière')}</button>
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
        ${cardTypeBadge(c)}
        <label class="anki-pick ${checked ? 'on' : ''}" style="flex:0 0 auto;" data-pickid="res-${c.id}">
          <input type="checkbox" ${checked ? 'checked' : ''} data-testid="reservoir-check-${c.id}" onchange="window.ankiV2ReservoirToggleSel('${c.id}')">
        </label>
        <span class="uid-badge anki-lib-id">${c.id}</span>
        <div class="anki-lib-text">
          <div class="anki-lib-title">${esc(c.titre || (c.question || '').substring(0, 70))}</div>
          <div class="anki-lib-meta">
            <span class="anki-tag" style="border-color:${m.color}80;color:${m.color};">${profileLabel(c.profil || 'COURS')}</span>
            <span class="anki-mut">${window.iconHtml('timer', 12)} ${window.AnkiAlgoV2.fmtDur(c.tempsCible || 60)} · ${stars(c)}</span>
            <span class="anki-card-stats">${cardAlgoStatsLine(c)}</span>
            ${srcChips.join(' ')}
          </div>
        </div>
        <div class="anki-lib-acts">
          <button class="bp" data-testid="btn-reservoir-activate-${c.id}" onclick="window.ankiV2ReservoirActivateOne('${c.id}')" title="Activer pour les révisions">${window.iconLabel('zap', 'Activer')}</button>
          ${typeof window.iconEditDeletePair === 'function'
            ? window.iconEditDeletePair(`window.ankiV2EditExo('${c.id}')`, `window.ankiV2DelExo('${c.id}')`)
            : (window.iconBtn('pencil', 'Modifier', `onclick="window.ankiV2EditExo('${c.id}')"`) +
               window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red);border-color:var(--red);" onclick="window.ankiV2DelExo('${c.id}')"`))}
        </div>
      </div>
    `;
  }
  window.ankiV2ReservoirFilter = function (k, v) { S.reservoirFilter[k] = v; renderActiveView(); };
  window.ankiV2ReservoirToggleSel = function (id) {
    if (S.reservoirSel.has(id)) S.reservoirSel.delete(id);
    else S.reservoirSel.add(id);
    renderActiveView();
  };
  window.ankiV2ReservoirClearSel = function () {
    S.reservoirSel.clear();
    renderActiveView();
  };
  function activateCardById(id) {
    const c = ankFind(id);
    if (!c) return false;
    return window.AnkiAlgoV2.activateFromReservoir(c);
  }
  window.ankiV2ReservoirActivateOne = function (id) {
    if (activateCardById(id)) {
      S.reservoirSel.delete(id);
      window.AnkiAlgoV2.log("activate-reservoir", { id, mode: "single" });
      window.save();
      window.renderAnkiV2();
    }
  };
  window.ankiV2ReservoirActivateSelected = function () {
    const ids = Array.from(S.reservoirSel);
    let n = 0;
    ids.forEach(id => { if (activateCardById(id)) n++; });
    S.reservoirSel.clear();
    window.AnkiAlgoV2.log("activate-reservoir", { count: n, mode: "selected" });
    window.save();
    window.sysAlert(`${n} carte(s) activée(s) pour les révisions (échéance : aujourd'hui).`, "Réservoir");
    window.renderAnkiV2();
  };
  window.ankiV2ReservoirActivateMat = function (matId) {
    const list = (window.D.exercices || []).filter(c => c.mat === matId && window.AnkiAlgoV2.isReservoir(c));
    let n = 0;
    list.forEach(c => { if (window.AnkiAlgoV2.activateFromReservoir(c)) n++; });
    window.AnkiAlgoV2.log("activate-reservoir", { mat: matId, count: n, mode: "matiere" });
    window.save();
    window.sysAlert(`${n} carte(s) de la matière "${esc(mat(matId).name || matId)}" activées.`, "Réservoir");
    window.renderAnkiV2();
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
        if (S.cockpitMode === 'manual') {
          S.selectionOrder = ids.slice();
        }
        window.AnkiAlgoV2.log("reorder", { ids });
        refreshQueueOnly();
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
    const base = window.AnkiAlgoV2.buildSession(ankSessionPool(), {
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

  window.ankiV2TogglePick = function (id) {
    keepPageScroll(function () {
      if (S.cockpitMode === 'manual') {
        if (S.selectionIds.has(id)) {
          S.selectionIds.delete(id);
          S.selectionOrder = S.selectionOrder.filter(x => x !== id);
        } else {
          S.selectionIds.add(id);
          S.selectionOrder = S.selectionOrder.filter(x => x !== id);
          S.selectionOrder.unshift(id);
        }
        S.manualOrder = S.selectionOrder.slice();
      } else {
        togglePickAuto(id);
      }
      renderPickGridOnly();
      refreshQueueOnly();
    });
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
      ? (typeof window.ankiQueueEmptyHtml === 'function' ? window.ankiQueueEmptyHtml(isManualTab, true) : `<div class="anki-empty anki-queue-empty">${isManualTab ? window.iconLabel('search', (window.APP_MSG && window.APP_MSG.QUEUE_EMPTY_MANUAL) || 'Sélectionne des cartes en mode manuel.') : window.iconLabel('sparkles', (window.APP_MSG && window.APP_MSG.QUEUE_EMPTY) || 'Aucune carte à réviser.')}</div>`)
      : cartes.map((c, i) => renderQueueRow(c, i)).join('');
    const meta = document.getElementById('ankiQueueMeta');
    if (meta) meta.textContent = `(${cartes.length} cartes · ${window.AnkiAlgoV2.fmtDur(plan.tempsTotalPrev)})`;
    bindDragDrop();
    window.hydrateIcons(box);
    requestAnimationFrame(function () { window.scrollTo(0, pageY); });
  }
  window.ankiV2SelectClear = function () {
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
  window.ankiV2ResetAutoAdjust = function () {
    S.pinnedIds.clear();
    S.excludedIds.clear();
    S.manualOrder = null;
    renderPickGridOnly();
    refreshQueueOnly();
  };
  window.ankiV2SelectAllPick = function () {
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
  window.ankiV2UpdateTemps = function (id, valMin, isDevoir) {
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
    window.AnkiAlgoV2.log("update-temps", { id, min: minVal, isDevoir: !!isDevoir });
    window.save();
    refreshQueueOnly();
  };
  window.ankiV2ResetManualOrder = function () {
    S.manualOrder = null;
    window.AnkiAlgoV2.log("reorder", { reset: true });
    renderActiveView();
  };
  window.ankiV2QuickEditSession = function () {
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
      if (S.libFilter.stat === 'reservoir') list = list.filter(c => window.AnkiAlgoV2.isReservoir(c));
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

    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${S.libFilter.mat === m.id ? 'selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`).join('');
    const profOpts = Object.keys(window.AnkiAlgoV2.DEFAULT_PROFILES).map(p => `<option value="${p}" ${S.libFilter.profil === p ? 'selected' : ''}>${esc(window.AnkiAlgoV2.DEFAULT_PROFILES[p].label)}</option>`).join('');
    const matChips = (window.D.matieres || []).map(m => {
      const n = (byMat[m.id] && Object.values(byMat[m.id]).reduce((s, a) => s + a.length, 0)) || 0;
      if (!n && S.libFilter.mat !== m.id) return '';
      return `<button type="button" class="anki-lib-chip${S.libFilter.mat === m.id ? ' on' : ''}" onclick="window.ankiV2LibFilter('mat','${m.id}')">${esc(m.label)} <span class="anki-lib-chip-n">${n}</span></button>`;
    }).join('');
    const autoExpand = !!S.libFilter.q;

    let html = `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Bibliothèque (${list.length})</h3>
          <div class="anki-block-actions">
            <button class="bp" onclick="window.openCardTypePicker()">+ Nouvelle carte</button>
          </div>
        </div>
        <div class="anki-filters">
          ${searchField('Titre, énoncé, code...', `value="${esc(S.libFilter.q)}" oninput="window.ankiV2LibFilter('q', this.value)"`)}
          <select class="fi" onchange="window.ankiV2LibFilter('mat', this.value)"><option value="">Toutes matières</option>${matOpts}</select>
          <select class="fi" onchange="window.ankiV2LibFilter('stat', this.value)">
            <option value="">Tous statuts</option>
            <option value="actif" ${S.libFilter.stat === 'actif' ? 'selected' : ''}>Actif</option>
            <option value="reservoir" ${S.libFilter.stat === 'reservoir' ? 'selected' : ''}>Réservoir</option>
          </select>
          <select class="fi" onchange="window.ankiV2LibFilter('profil', this.value)"><option value="">Tous profils</option>${profOpts}</select>
        </div>
        <div class="anki-lib-chips">
          <button type="button" class="anki-lib-chip${!S.libFilter.mat ? ' on' : ''}" onclick="window.ankiV2LibFilter('mat','')">Toutes</button>
          ${matChips}
        </div>
        <div class="anki-lib">
    `;

    if (!list.length) {
      html += `<div class="anki-empty">${(window.APP_MSG && window.APP_MSG.EMPTY_FILTERS) || 'Aucune carte ne correspond aux filtres.'}</div>`;
    } else {
      html += matOrder.map(matId => {
        const m = mat(matId);
        const chGroups = byMat[matId];
        const matCount = Object.values(chGroups).reduce((s, arr) => s + arr.length, 0);
        const matOpen = autoExpand || S.libOpenMat.has(matId);
        const grpKeys = Object.keys(chGroups).sort();
        return `
          <div class="anki-lib-mat${matOpen ? ' open' : ''}" data-mat="${esc(matId)}">
            <div class="anki-lib-mat-hdr" style="border-left:4px solid ${m.color};" onclick="window.ankiV2LibToggleMat('${esc(matId)}')" role="button" tabindex="0">
              <span class="anki-lib-chevron">${matOpen ? '▼' : '▶'}</span>
              <span class="anki-lib-grp-mat" style="background:${m.color}20;color:${m.color};">${esc(m.label)}</span>
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
                    <div class="anki-lib-group-hdr" onclick="window.ankiV2LibToggleGrp('${esc(gk)}')" role="button" tabindex="0">
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
        ${cardTypeBadge(c)}
        <span class="uid-badge anki-lib-id">${c.id}</span>
        <div class="anki-lib-text">
          <div class="anki-lib-title">${esc(c.titre || (c.question || '').substring(0, 70))}</div>
          <div class="anki-lib-meta">
            <span class="anki-tag" style="border-color:${m.color}80;color:${m.color};">${profileLabel(c.profil || 'COURS')}</span>
            <span class="anki-mut">${window.iconHtml('timer', 12)} ${window.AnkiAlgoV2.fmtDur(c.tempsCible || 60)} · ${stars(c)}</span>
            <span class="anki-card-stats">${cardAlgoStatsLine(c)}</span>
          </div>
        </div>
        <div class="anki-lib-acts">
          ${window.iconBtn('play', 'Réviser', `onclick="window.startAnkiV2Single('${c.id}')"`)}
          ${typeof window.iconEditBtn === 'function' ? window.iconEditBtn(`window.ankiV2EditExo('${c.id}')`) : window.iconBtn('pencil', 'Modifier', `onclick="window.ankiV2EditExo('${c.id}')"`)}
          ${window.iconBtn('calendar', 'Décaler', `onclick="event.stopPropagation();window.ankiV2AdjustNext('${c.id}')"`)}
          ${typeof window.iconDeleteBtn === 'function' ? window.iconDeleteBtn(`window.ankiV2DelExo('${c.id}')`, { stopPropagation: true }) : window.iconBtn('trash-2', 'Supprimer', `style="color:var(--red);border-color:var(--red);" onclick="event.stopPropagation();window.ankiV2DelExo('${c.id}')"`)}
        </div>
      </div>
    `;
  }
  window.ankiV2LibFilter = function (k, v) {
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
  window.ankiV2LibToggleMat = function (matId) {
    keepPageScroll(function () {
      if (S.libOpenMat.has(matId)) S.libOpenMat.delete(matId);
      else S.libOpenMat.add(matId);
      renderActiveView();
    });
  };
  window.ankiV2LibToggleGrp = function (gk) {
    keepPageScroll(function () {
      if (S.libOpenGrp.has(gk)) S.libOpenGrp.delete(gk);
      else S.libOpenGrp.add(gk);
      renderActiveView();
    });
  };
  window.ankiV2AdjustNext = function (id) {
    const c = ankFind(id);
    if (!c) return;
    const cur = c.dateProchaineRevision || window.AnkiAlgoV2.todayISO();
    if (typeof window.fcOpenShiftDate === 'function') {
      window.fcOpenShiftDate({
        subtitle: (c.titre || c.id) + ' — prochaine révision',
        current: cur,
        onApply: function (newDate) {
          const from = cur;
          c.dateProchaineRevision = newDate;
          window.AnkiAlgoV2.log('manual-shift', { id, from, to: newDate });
          window.save();
          renderActiveView();
        }
      });
      return;
    }
    const d = prompt(`Décale de combien de jours ? (négatif = avancer)\nDate actuelle : ${cur}`, '0');
    if (d === null) return;
    c.dateProchaineRevision = window.AnkiAlgoV2.addDays(cur, parseInt(d) || 0);
    window.AnkiAlgoV2.log('manual-shift', { id, from: cur, to: c.dateProchaineRevision });
    window.save();
    renderActiveView();
  };

  // ====== VUE PRÉVISIONS (barres + calendrier jour par jour) ======
  function viewForecast() {
    const sch = window.AnkiAlgoV2.forecastSchedule(ankSessionPool(), S.forecastDays);
    const dates = Object.keys(sch).sort();
    const charges = dates.map(d => sch[d].reduce((s, c) => s + (c.tempsCible || 60), 0));
    const max = Math.max(1, ...charges);
    const maxDay = (window.D.settings.ankiMaxPerDay || 75) * 60;

    return `
      <div class="anki-card-block">
        <div class="anki-block-hdr">
          <h3>Prévisions (${S.forecastDays} jours)</h3>
          <div class="anki-block-actions">
            <button class="bs ${S.forecastDays === 7 ? 'on-bs' : ''}" onclick="window.ankiV2ForecastDays(7)">7j</button>
            <button class="bs ${S.forecastDays === 14 ? 'on-bs' : ''}" onclick="window.ankiV2ForecastDays(14)">14j</button>
            <button class="bs ${S.forecastDays === 30 ? 'on-bs' : ''}" onclick="window.ankiV2ForecastDays(30)">30j</button>
          </div>
        </div>
        <div class="anki-forecast-bars">
          ${dates.map((d, i) => {
            const total = charges[i];
            const pct = Math.round((total / max) * 100);
            const over = total > maxDay;
            const dd = d.substring(5).replace('-', '/');
            const isToday = d === window.AnkiAlgoV2.todayISO();
            return `<div class="anki-fc-col ${isToday ? 'today' : ''} ${S.expandedDay === d ? 'sel' : ''}" onclick="window.ankiV2ToggleDay('${d}')" title="${d} — ${sch[d].length} cartes · ${window.AnkiAlgoV2.fmtDur(total)}">
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
            const isToday = d === window.AnkiAlgoV2.todayISO();
            // Par défaut tout fermé ; ouvert SI l'utilisateur a cliqué
            const open = S.expandedDay === d;
            if (!cards.length) return '';
            return `
              <div class="anki-cal-day ${isToday ? 'today' : ''}">
                <div class="anki-cal-day-hdr" onclick="window.ankiV2ToggleDay('${d}')">
                  <strong>${isToday ? window.iconLabel('map-pin', "Aujourd'hui") : d}</strong>
                  <span class="anki-mut">${cards.length} cartes · ${window.AnkiAlgoV2.fmtDur(total)}</span>
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
        ${window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml(window.cardTypeKind ? window.cardTypeKind(c) : 'main') : ''}
        <span class="anki-q-mat" style="background:${m.color};">${esc(m.label)}</span>
        <span class="uid-badge">${esc(c.id)}</span>
        <span class="anki-day-title">${esc(c.titre || (c.question || '').substring(0, 80))}</span>
        <span class="anki-mut">${window.iconHtml('timer', 12)} ${window.AnkiAlgoV2.fmtDur(c.tempsCible || 60)}</span>
        ${window.iconBtn('calendar', 'Décaler', `onclick="event.stopPropagation();window.ankiV2AdjustNext('${c.id}')"`)}
        ${window.iconBtn('play', 'Réviser', `onclick="event.stopPropagation();window.startAnkiV2Single('${c.id}')"`)}
      </div>
    `;
  }
  window.ankiV2ForecastDays = function (n) { S.forecastDays = n; renderActiveView(); };
  window.ankiV2ToggleDay = function (d) { S.expandedDay = S.expandedDay === d ? null : d; renderActiveView(); };

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
    const today = window.AnkiAlgoV2.todayISO();
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
    const week = Array.from({ length: 7 }, (_, i) => window.AnkiAlgoV2.addDays(today, -6 + i));
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
          <div class="kpi"><div class="kpi-n">${window.AnkiAlgoV2.fmtDur(tempsReel)}</div><div class="kpi-l">Temps réel</div></div>
          <div class="kpi"><div class="kpi-n anki-mut">${window.AnkiAlgoV2.fmtDur(tempsPrevu)}</div><div class="kpi-l">Temps prévu</div></div>
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
                <td><span class="anki-q-mat" style="background:${m.color};">${esc(m.label)}</span> ${esc(m.name)}</td>
                <td>${s.cards}</td>
                <td>${s.total}</td>
                <td>${s.ok}</td>
                <td>${s.bad}</td>
                <td style="color:${easeCol};font-weight:700;">${easeMoy}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="anki-mut">Aucune donnée</td></tr>'}
          </tbody>
        </table>
        <p class="anki-mut" style="font-size:11px;margin-top:8px;">Ease faible (rouge) = matière où tu galères → la carte monte via le terme « difficulté » du score <code>prio</code>.</p>
      </div>
    `;
  }


  // ====== VUE RÉGLAGES ======
  function viewSettings() {
    const st = window.D.settings || {};
    if (!st.ankiCoefs) st.ankiCoefs = Object.assign({}, window.AnkiAlgoV2.DEFAULT_COEFS);
    if (!st.ankiQuickStarSteps) st.ankiQuickStarSteps = JSON.parse(JSON.stringify(window.AnkiAlgoV2.DEFAULT_QUICK_STAR_STEPS));
    const C = st.ankiCoefs;

    const coefRow = (k, label, step) => `
      <div class="anki-set-row">
        <label>${label} <code class="anki-mut">${k}</code></label>
        <input type="number" class="fi" step="${step || 0.1}" value="${C[k]}" onchange="window.D.settings.ankiCoefs.${k}=parseFloat(this.value)||0;window.save();window.renderAnkiV2();">
      </div>
    `;

    const quickStarHtml = [1, 2, 3, 4, 5].map(function (stars) {
      const p = st.ankiQuickStarSteps[stars] || st.ankiQuickStarSteps[String(stars)] || window.AnkiAlgoV2.DEFAULT_QUICK_STAR_STEPS[stars];
      return `
        <div class="anki-prof">
          <div class="anki-prof-hdr"><strong>${window.importanceLabel(stars)}</strong><span class="anki-mut">Y- · rapide</span></div>
          <label class="anki-mut" style="font-size:11px;">Étapes (jours)</label>
          <input class="fi" id="qstar_${stars}_steps" value="${(p.steps || []).join(', ')}" oninput="window.ankiV2SaveQuickStar(${stars})">
          <label class="anki-mut" style="font-size:11px;">Ease initiale</label>
          <input class="fi" type="number" step="0.1" min="1.3" max="3.0" id="qstar_${stars}_ease" value="${p.ease}" oninput="window.ankiV2SaveQuickStar(${stars})">
        </div>
      `;
    }).join('');

    const av2 = window.AnkiAlgoV2.getSettings();
    return `
      <div class="anki-card-block" style="border:1px solid var(--gold);">
        <h3>${window.iconLabel('dna', 'Algorithme Synchrotron')}</h3>
        <p class="anki-mut" style="font-size:12px;">Horizon de révision · fenêtres ★ · avance si budget large (pas de quota forcé les soirs DM).</p>
        <div class="anki-set-row">
          <label>Horizon (1 an redouble / 2 ans cycle)</label>
          <select class="fi" onchange="window.D.settings.algoV2=window.D.settings.algoV2||{};window.D.settings.algoV2.horizon=this.value;window.save();window.renderAnkiV2();">
            <option value="1y" ${av2.horizon === '1y' ? 'selected' : ''}>1 an (resserré)</option>
            <option value="2y" ${av2.horizon === '2y' ? 'selected' : ''}>2 ans (cycle complet)</option>
          </select>
        </div>
        <div class="anki-set-row">
          <label>Durée session par défaut (min)</label>
          <input type="number" class="fi" min="15" max="300" step="5" value="${av2.sessionMinDefault || 90}" onchange="window.D.settings.algoV2=window.D.settings.algoV2||{};window.D.settings.algoV2.sessionMinDefault=parseInt(this.value)||90;window.save();window.renderAnkiV2();">
        </div>
        <label class="anki-check-row">
          <input type="checkbox" ${av2.pullForward !== false ? 'checked' : ''} onchange="window.D.settings.algoV2=window.D.settings.algoV2||{};window.D.settings.algoV2.pullForward=this.checked;window.save();window.renderAnkiV2();">
          <span>Avancer des cartes « bientôt due » si la session a du budget (soirées longues)</span>
        </label>
      </div>

      <div class="anki-card-block">
        <h3>Maintenance / Démo</h3>
        <p class="anki-mut" style="font-size:12px;">Si tu utilises les données de démo et que les dates ne sont plus à jour (ex: tu reviens après plusieurs jours), recale-les sur aujourd'hui.</p>
        <button class="bs" onclick="window.ankiV2RecalDates()">${window.iconLabel('calendar', "Recaler toutes les dates sur aujourd'hui")}</button>
        <button class="bs" onclick="window.ankiV2RebuildPieces()" style="margin-left:6px;">${window.iconLabel('refresh-cw', 'Re-découper les devoirs en morceaux')}</button>
      </div>

      <div class="anki-card-block">
        <h3>Session</h3>
        <div class="anki-set-row">
          <label>Durée de session (min)</label>
          <input type="number" class="fi" min="5" max="300" step="5" value="${st.ankiSessionMin || 60}" onchange="window.D.settings.ankiSessionMin=Math.max(5,Math.min(300,parseInt(this.value)||60));window.save();window.renderAnkiV2();">
          <p class="anki-mut" style="font-size:11px;margin-top:4px;">Même réglage que la barre « Durée session » en haut du Synchrotron (max 5 h).</p>
        </div>
        <div class="anki-set-row">
          <label>Nouvelles cartes / session (legacy — réservoir activé manuellement)</label>
          <input type="number" class="fi" min="0" max="30" value="${st.ankiIncludeNew !== undefined ? st.ankiIncludeNew : 0}" onchange="window.D.settings.ankiIncludeNew=parseInt(this.value)||0;window.save();window.renderAnkiV2();">
        </div>
        <div class="anki-set-row">
          <label>Charge max / jour (min)</label>
          <input type="number" class="fi" min="15" max="240" value="${st.ankiMaxPerDay || 75}" onchange="window.D.settings.ankiMaxPerDay=parseInt(this.value)||75;window.save();">
        </div>
        <div class="anki-set-row">
          <label>Seuil devoir forcé (Agenda) <code class="anki-mut">seuilDevoirForce</code></label>
          <input type="number" class="fi" min="0" max="100" step="5" value="${st.seuilDevoirForce != null ? st.seuilDevoirForce : 35}" onchange="window.D.settings.seuilDevoirForce=parseInt(this.value)||35;window.save();window.renderAnkiV2();">
        </div>
        <p class="anki-mut" style="font-size:11px;">Urgence <b>calendaire</b> des W- uniquement (date limite). Les X- ne passent plus par I_R ni seuil d'urgence.</p>
        <div class="anki-set-row">
          <label>Max cartes rapides Y- en fin de session <code class="anki-mut">ankiMaxAnglaisFill</code></label>
          <input type="number" class="fi" min="0" max="30" value="${st.ankiMaxAnglaisFill != null ? st.ankiMaxAnglaisFill : 5}" onchange="window.D.settings.ankiMaxAnglaisFill=parseInt(this.value)||5;window.save();window.renderAnkiV2();">
        </div>
        <div class="anki-set-row">
          <label>Marge budget de session <code class="anki-mut">margeBudget</code> (0.5–1.0, défaut 0.92)</label>
          <input type="number" class="fi" data-testid="input-marge-budget" min="0.5" max="1.0" step="0.01" value="${st.margeBudget != null ? st.margeBudget : 0.92}" onchange="window.D.settings.margeBudget=Math.max(0.5,Math.min(1.0,parseFloat(this.value)||0.92));window.save();window.renderAnkiV2();">
        </div>
        <p class="anki-mut" style="font-size:11px;">Exemple : 0.85 → la session se limite à 85% du temps demandé pour garder de la marge.</p>
      </div>

      <div class="anki-card-block">
        <h3>${window.iconLabel('zap', 'Ease élastique (anti-Ease Hell)')}</h3>
        <p class="anki-mut" style="font-size:12px;">En cas d'échec (qScore ≤ seuil), l'ease baisse de <code>EASE_DROP_FAIL</code>. Le flag <code>_blocageActif</code> remonte la carte via le score <b>prio</b> jusqu'à validation.</p>
        <div class="anki-set-row">
          <label>Baisse de l'ease en cas d'échec <code class="anki-mut">EASE_DROP_FAIL</code></label>
          <input type="number" class="fi" data-testid="input-ease-drop" min="0" max="0.5" step="0.01" value="${C.EASE_DROP_FAIL != null ? C.EASE_DROP_FAIL : 0.20}" onchange="window.D.settings.ankiCoefs.EASE_DROP_FAIL=parseFloat(this.value)||0.20;window.save();window.renderAnkiV2();">
        </div>
        <div class="anki-set-row">
          <label>qScore qui déclenche le boost de blocage <code class="anki-mut">BLOCAGE_QSCORE_TRIGGER</code></label>
          <input type="number" class="fi" data-testid="input-bloc-trigger" min="0" max="10" step="1" value="${C.BLOCAGE_QSCORE_TRIGGER != null ? C.BLOCAGE_QSCORE_TRIGGER : 3}" onchange="window.D.settings.ankiCoefs.BLOCAGE_QSCORE_TRIGGER=parseInt(this.value);window.save();window.renderAnkiV2();">
        </div>
        <div class="anki-set-row">
          <label>qScore qui lève le blocage <code class="anki-mut">BLOCAGE_QSCORE_VALIDATE</code></label>
          <input type="number" class="fi" data-testid="input-bloc-validate" min="1" max="10" step="1" value="${C.BLOCAGE_QSCORE_VALIDATE != null ? C.BLOCAGE_QSCORE_VALIDATE : 8}" onchange="window.D.settings.ankiCoefs.BLOCAGE_QSCORE_VALIDATE=parseInt(this.value);window.save();window.renderAnkiV2();">
        </div>
        <div class="anki-set-row">
          <label>Timeout : nb max de révisions sous blocage avant libération auto <code class="anki-mut">BLOCAGE_TIMEOUT_REV</code></label>
          <input type="number" class="fi" data-testid="input-bloc-timeout" min="1" max="50" step="1" value="${C.BLOCAGE_TIMEOUT_REV != null ? C.BLOCAGE_TIMEOUT_REV : 5}" onchange="window.D.settings.ankiCoefs.BLOCAGE_TIMEOUT_REV=parseInt(this.value);window.save();window.renderAnkiV2();">
        </div>
        <div class="anki-set-row">
          <label>Ease "virtuelle" pendant le boost <code class="anki-mut">BLOCAGE_BOOST_EASE_VAL</code></label>
          <input type="number" class="fi" min="1.3" max="3.0" step="0.05" value="${C.BLOCAGE_BOOST_EASE_VAL != null ? C.BLOCAGE_BOOST_EASE_VAL : 1.3}" onchange="window.D.settings.ankiCoefs.BLOCAGE_BOOST_EASE_VAL=parseFloat(this.value)||1.3;window.save();window.renderAnkiV2();">
        </div>
      </div>

      <div class="anki-card-block">
        <h3>${window.iconLabel('star', 'Importance — fenêtres de révision')}</h3>
        <p class="anki-mut" style="font-size:12px;">Chaque carte a 1 à 5★. En phase <b>mature</b>, l'étoile définit <b>quand s'ouvre la fenêtre</b> et sa <b>largeur</b> (pas un poids dans un score composite).</p>
        <table class="fi" style="width:100%;font-size:12px;border-collapse:collapse;margin-top:8px;">
          <thead><tr style="color:var(--mut);font-size:11px;"><th style="text-align:left;padding:4px 8px;">★</th><th style="text-align:left;padding:4px 8px;">Ouverture</th><th style="text-align:left;padding:4px 8px;">Fenêtre</th></tr></thead>
          <tbody>
            ${[5,4,3,2,1].map(st => {
              const w = window.AnkiAlgoV2.scaledWindow(st);
              return `<tr><td style="padding:4px 8px;">★${st}</td><td style="padding:4px 8px;">~${w.openAfter} j</td><td style="padding:4px 8px;">${w.width} j</td></tr>`;
            }).join('')}
          </tbody>
        </table>
        <p class="anki-mut" style="font-size:11px;margin-top:8px;">Cartes <b>X-</b> et <b>W-</b> : fenêtres ★ ci-dessus. Cartes <b>Y-</b> : paliers SM-2 par ★ (bloc ci-dessous).</p>
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
        <h3>${window.iconLabel('languages', 'Cartes rapides (Y-) — intervalles par ★')}</h3>
        <p class="anki-mut">Chaque carte Y- suit le palier SM-2 de son nombre d'étoiles (plus de ★ → révisions plus serrées). Les profils Anglais/Cours/Exo ne s'appliquent plus aux rapides.</p>
        <div class="anki-prof-grid">${quickStarHtml}</div>
        <button class="bs" onclick="window.ankiV2ResetQuickStarSteps()" style="margin-top:10px;">${window.iconLabel('refresh-cw', 'Intervalles par défaut')}</button>
      </div>
    `;
  }
  window.ankiV2SaveQuickStar = function (stars) {
    const k = Math.max(1, Math.min(5, parseInt(stars, 10) || 3));
    const stepsRaw = $("qstar_" + k + "_steps").value;
    const easeRaw = parseFloat($("qstar_" + k + "_ease").value);
    const steps = stepsRaw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0);
    if (!window.D.settings.ankiQuickStarSteps) window.D.settings.ankiQuickStarSteps = {};
    const def = window.AnkiAlgoV2.DEFAULT_QUICK_STAR_STEPS[k] || window.AnkiAlgoV2.DEFAULT_QUICK_STAR_STEPS[3];
    window.D.settings.ankiQuickStarSteps[k] = {
      steps: steps.length ? steps : def.steps,
      ease: isNaN(easeRaw) ? def.ease : Math.max(1.3, Math.min(3.0, easeRaw)),
      label: def.label
    };
    window.save();
  };
  window.ankiV2ResetQuickStarSteps = function () {
    window.D.settings.ankiQuickStarSteps = JSON.parse(JSON.stringify(window.AnkiAlgoV2.DEFAULT_QUICK_STAR_STEPS));
    window.save(); renderActiveView();
  };

  window.ankiV2RecalDates = function () {
    const today = window.AnkiAlgoV2.todayISO();
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
    window.AnkiAlgoV2.log("recal-dates", { n });
    window.save();
    window.sysAlert(`${n} carte(s) recalée(s) sur aujourd'hui (${today}).`, "Dates recalées");
    window.renderAnkiV2();
  };

  window.ankiV2RebuildPieces = function () {
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
    const today = window.AnkiAlgoV2.todayISO();
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
    window.renderAnkiV2();
  };

  function sessionRemainingCount() {
    if (S.current) return S.queue.length + 1;
    return S.queue ? S.queue.length : 0;
  }

  function flashAnkiBtn(testId) {
    requestAnimationFrame(() => {
      const btn = document.querySelector(`[data-testid="${testId}"]`);
      if (!btn) return;
      btn.classList.remove('anki-btn-conflict-flash');
      void btn.offsetWidth;
      btn.classList.add('anki-btn-conflict-flash');
      setTimeout(() => btn.classList.remove('anki-btn-conflict-flash'), 2000);
    });
  }

  function promptSessionConflict(testId) {
    flashAnkiBtn(testId);
    const n = sessionRemainingCount();
    window.sysConfirm(
      `Une session est déjà en cours (<b>${n} carte(s)</b> restante(s)).<br><br>` +
      `<b>Confirmer</b> → reprendre cette session<br>` +
      `<b>Annuler</b> → rester ici (abandonne la session si tu veux en lancer une autre)`,
      () => window.ankiV2ResumeSession(),
      'Session déjà en cours'
    );
  }

  function clearSessionStateForNew() {
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = null;
    S.chronoRunning = false;
    S.current = null;
    S.queue = [];
    S.stats = { ok: 0, mid: 0, bad: 0, total: 0 };
    S.showAnswer = false;
    S.dernierExerciceModifie = null;
    S.sessionGeneree = false;
    clearPersistedSession();
    setSessionOverlayLock(false);
    const ov = $("ovAnkiSession");
    if (ov) ov.classList.add("hidden");
    renderSyncSessionDock();
  }

  // ====== SESSION ======
  // v4: persistance de la session dans D.sessionEnCoursV2 pour survivre aux changements
  // d'onglet et au refresh du navigateur.
  function buildSessionPlan() {
    return computeCockpitPlan();
  }
  function persistSession() {
    if (!window.D) return;
    window.D.sessionEnCoursV2 = {
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
      showAnswer:   !!S.showAnswer,
      chronoElapsed: S.chronoElapsed || 0,
      sliderValue:  S.sliderValue,
      sessionTempsManuel: S.sessionTempsManuel,
      sessionUI:    S.sessionUI || 'full'
    };
    window.save();
  }
  function clearPersistedSession() {
    if (window.D) {
      delete window.D.sessionEnCoursV2;
      window.save();
    }
  }
  // À chaque renderAnki : si une session est persistée mais que S.queue est vide
  // (cas refresh), on prépare la "Reprendre" sans réafficher l'overlay tant que
  // l'utilisateur ne clique pas dessus.
  function restoreSessionFromStorageIfAny() {
    if (!window.D || !window.D.sessionEnCoursV2) return;
    const sec = window.D.sessionEnCoursV2;
    const hasQueue = Array.isArray(sec.queueIds) && sec.queueIds.length;
    const hasCurrent = !!sec.currentId;
    if (!hasQueue && !hasCurrent) {
      delete window.D.sessionEnCoursV2;
      return;
    }
    if (S.current) return;
    if (S.queue && S.queue.length && !hasCurrent) return;

    if (!S.queue || !S.queue.length) {
      S.queue = (sec.queueIds || []).map(id => ankFind(id)).filter(Boolean);
    }
    S.stats        = Object.assign({ ok: 0, mid: 0, bad: 0, total: 0 }, sec.stats || {});
    S.mode         = sec.mode || "normal";
    S.manualOrder  = sec.manualOrder ? sec.manualOrder.slice() : null;
    S.selectionIds = new Set(sec.selectedIds || []);
    S.selectionOrder = Array.isArray(sec.selectionOrder) ? sec.selectionOrder.slice() : (sec.selectedIds || []).slice();
    S.pinnedIds = new Set(sec.pinnedIds || []);
    S.excludedIds = new Set(sec.excludedIds || []);
    if (sec.cockpitMode) S.cockpitMode = sec.cockpitMode;
    if (sec.sessionUI) S.sessionUI = sec.sessionUI;
    syncSelectionOrder();

    if (hasCurrent) {
      const cur = ankFind(sec.currentId);
      if (cur) {
        S.current = cur;
        S.queue = S.queue.filter(c => c.id !== cur.id);
      }
    }
    S.showAnswer = !!sec.showAnswer;
    S.chronoElapsed = typeof sec.chronoElapsed === 'number' ? sec.chronoElapsed : 0;
    S.chronoRunning = false;
    if (sec.sliderValue != null) S.sliderValue = sec.sliderValue;
    if (sec.sessionTempsManuel != null) S.sessionTempsManuel = sec.sessionTempsManuel;
  }

  // v4: Générer la session du soir = construire la file + la figer en persistance
  window.ankiV2GenererSessionSoir = function () {
    ensure();
    restoreSessionFromStorageIfAny();
    const plan = buildSessionPlan();
    if (!plan.cartes.length) {
      return window.sysAlert("Aucune carte à inclure dans la session du soir.", "Synchrotron");
    }
    const apply = () => {
      plan.cartes.forEach(c => {
        if (window.AnkiAlgoV2.isReservoir(c)) window.AnkiAlgoV2.activateFromReservoir(c);
      });
      clearSessionStateForNew();
      S.queue   = plan.cartes.slice();
      S.mode    = "normal";
      S.current = null;
      S.stats   = { ok: 0, mid: 0, bad: 0, total: plan.cartes.length };
      S.sessionGeneree = true;
      persistSession();
      window.AnkiAlgoV2.log("session-generated", { count: plan.cartes.length, totalSec: plan.tempsTotalPrev });
      window.sysAlert(`Session du soir générée : <b>${plan.cartes.length} cartes</b> (${window.AnkiAlgoV2.fmtDur(plan.tempsTotalPrev)}). Elle est sauvegardée et reprenable après refresh.`, "Session figée");
      window.renderAnkiV2();
    };
    if (sessionIsLive()) {
      flashAnkiBtn('btn-generer-session-soir');
      return window.sysConfirm(
        `Une session est déjà active (${sessionRemainingCount()} carte(s)).<br><b>Confirmer</b> pour la remplacer par la file actuelle du cockpit.`,
        apply,
        'Remplacer la session du soir ?'
      );
    }
    apply();
  };
  // Bouton "Reprendre"
  window.ankiV2ResumeSession = function () {
    restoreSessionFromStorageIfAny();
    if (!S.current && (!S.queue || !S.queue.length)) {
      return window.sysAlert("Aucune session active à reprendre.", "Synchrotron");
    }
    if (!S.current && S.queue.length) {
      S.current = S.queue.shift();
      S.showAnswer = false;
      S.dockShowCardDetail = false;
      resetChronoCard();
    }
    S.sessionUI = "full";
    persistSession();
    renderSessionOverlay();
  };
  window.ankiV2DiscardSession = function () {
    const M = window.APP_MSG || {};
    window.sysConfirm(
      M.ABANDON_EVENING || "Abandonner la session du soir ?<br>La file sera effacée — les cartes déjà notées restent enregistrées.",
      () => {
        S.queue = []; S.current = null; S.stats = { ok: 0, mid: 0, bad: 0, total: 0 };
        S.dernierExerciceModifie = null;
        S.sessionUI = "mini";
        clearPersistedSession();
        renderSyncSessionDock();
        window.renderAnkiV2();
      },
      M.ABANDON_SESSION_TITLE || "Abandonner la session"
    );
  };

  window.startAnkiV2Session = function () {
    ensure();
    restoreSessionFromStorageIfAny();
    if (sessionIsLive()) {
      return promptSessionConflict('btn-commencer-session');
    }
    const plan = buildSessionPlan();
    if (!plan.cartes.length) return window.sysAlert((window.APP_MSG && window.APP_MSG.QUEUE_EMPTY) || "Aucune carte à réviser.", "Synchrotron");
    plan.cartes.forEach(c => {
      if (window.AnkiAlgoV2.isReservoir(c)) window.AnkiAlgoV2.activateFromReservoir(c);
    });
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = null;
    S.chronoRunning = false;
    S.current = null;
    S.queue = plan.cartes.slice();
    S.mode = (S.selectionIds.size > 0 || S.manualOrder) ? "custom" : "normal";
    S.stats = { ok: 0, mid: 0, bad: 0, total: plan.cartes.length };
    S.sessionUI = 'full';
    persistSession();
    nextCard();
  };
  window.startAnkiV2Single = function (id) {
    ensure();
    restoreSessionFromStorageIfAny();
    if (sessionIsLive()) {
      return promptSessionConflict('btn-commencer-session');
    }
    const c = ankFind(id);
    if (!c) return;
    if (c.statut !== "actif") { c.statut = "actif"; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgoV2.todayISO(); }
    S.queue = [c]; S.mode = "single";
    S.stats = { ok: 0, mid: 0, bad: 0, total: 1 };
    S.sessionUI = 'full';
    nextCard();
  };
  window.startAnkiV2Colle = function (coursId) {
    ensure();
    const q = window.D.exercices.filter(c => (c.coursIds || []).includes(coursId) || c.coursId === coursId);
    if (!q.length) return window.sysAlert("Aucune carte liée à ce cours.", "Mode Colle");
    S.queue = window.AnkiAlgoV2.smartOrder(q.slice());
    S.mode = "colle"; S.stats = { ok: 0, mid: 0, bad: 0, total: q.length };
    S.sessionUI = 'full';
    nextCard();
  };
  window.ankiV2SetQuickQueue = function (ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const cards = ids.map(id => ankFind(id)).filter(Boolean);
    if (!cards.length) return;
    cards.forEach(c => { if (c.statut !== 'actif') { c.statut = 'actif'; if (!c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgoV2.todayISO(); } });
    const quickOnly = cards.filter(c => window.AnkiAlgoV2.cardKind(c) === 'quick');
    if (!quickOnly.length) return window.sysAlert("Aucune carte rapide (Y-) dans la sélection.", "Rapide");
    S.queue = window.AnkiAlgoV2.buildQuickSession(quickOnly);
    S.mode = "quick";
    S.stats = { ok: 0, mid: 0, bad: 0, total: cards.length };
    S.sessionUI = 'full';
    window.save(); nextCard();
  };

  function renderDeckProgressHtml(accentColor) {
    const total = Math.max(1, S.stats.total || 1);
    const done = (S.stats.ok || 0) + (S.stats.mid || 0) + (S.stats.bad || 0);
    const remaining = S.queue.length + 1;
    const pct = Math.min(100, Math.round((done / total) * 100));
    const hiddenExtra = S.queue.length > 4 ? S.queue.length - 4 : 0;
    const pileMeta = hiddenExtra
      ? `${remaining} restante(s) · <span class="anki-deck-progress-more">+${hiddenExtra} sous la pile</span>`
      : `${remaining} restante(s)`;
    return `
      <div class="anki-deck-progress" style="--deck-accent:${accentColor}">
        <div class="anki-deck-progress-label">
          <span>${window.iconLabel('layers', `Pile · <b>${pileMeta}</b>`)}</span>
          <span>${done}/${total} faites · ${pct}%</span>
        </div>
        <div class="anki-deck-progress-track">
          <div class="anki-deck-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }

  function runDeckExitThen(fn) {
    const el = document.querySelector('#ovAnkiSession .anki-deck-card');
    if (!el || S.sessionUI !== 'full') { fn(); return; }
    el.classList.remove('anki-deck-enter');
    el.classList.add('anki-deck-exit');
    let done = false;
    const finish = () => { if (done) return; done = true; fn(); };
    el.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 340);
  }

  function applyNextCardState() {
    S.showAnswer = false;
    S.sliderValue = 7;
    S.sessionTempsManuel = null;
    S.dockShowCardDetail = false;
    resetChronoCard();
    S.sessionUI = S.sessionUI === "mini" || S.sessionUI === "dock" ? S.sessionUI : "full";
    persistSession();
    renderSessionOverlay();
  }

  function nextCard(animate, opts) {
    const skipCurrent = opts && opts.skipCurrent;
    if (!skipCurrent && !S.queue.length) return endSession();

    const advance = () => {
      if (skipCurrent) S.queue.push(skipCurrent);
      if (!S.queue.length) return endSession();
      S.current = S.queue.shift();
      applyNextCardState();
    };

    if (animate && S.current && S.sessionUI === 'full') {
      runDeckExitThen(advance);
      return;
    }
    advance();
  }

  function sessionIsLive() {
    if (S.current) return true;
    if (S.queue && S.queue.length) return true;
    const sec = window.D && window.D.sessionEnCoursV2;
    if (!sec) return false;
    if (sec.currentId) return true;
    return !!(Array.isArray(sec.queueIds) && sec.queueIds.length);
  }

  function firstLinkedCoursId(c) {
    if (!c) return null;
    const ids = c.coursIds || (c.coursId ? [c.coursId] : []);
    return ids.length ? ids[0] : null;
  }

  function renderDockSources(c) {
    if (!c) return '';
    const parts = [];
    [['sourceEnonce', 'Énoncé', 'book-open', 'var(--gold)'], ['sourceCorrection', 'Corrigé', 'check', 'var(--grn)']].forEach(([key, label, icon, color]) => {
      const src = c[key];
      if (!src || (!src.nom && !src.details)) return;
      parts.push(`
        <div class="sync-dock-src" style="--src-color:${color}">
          <div class="sync-dock-src-label">${window.iconLabel(icon, label)} · ${esc(src.type || 'livre')}</div>
          <div class="sync-dock-src-body"><b>${esc(src.nom || '')}</b>${src.details ? `<span class="sync-dock-src-det">${esc(src.details)}</span>` : ''}</div>
        </div>
      `);
    });
    return parts.length ? `<div class="sync-dock-sources">${parts.join('')}</div>` : '';
  }

  function renderDockCardDetail(c) {
    if (!c) return '';
    return `
      <div class="sync-dock-detail">
        ${c.titre ? `<div class="sync-dock-detail-titre">${esc(c.titre)}</div>` : ''}
        <div class="sync-dock-detail-q">${esc(c.question || '')}</div>
        ${renderDockSources(c)}
        ${(c.coursIds || []).length ? `<div class="sync-dock-detail-links anki-mut">${(c.coursIds || []).map(uid => {
          const co = (window.D.cours || []).find(x => x.uid === uid);
          return co ? `<button type="button" class="av-tag sync-dock-cours-link" onclick="window.doLocate('${esc(uid)}')">${esc(co.uid)}</button>` : '';
        }).join(' ')}</div>` : ''}
      </div>
    `;
  }

  function dockPillSubline(c, paused, rest) {
    if (c) return `${fmtSec(S.chronoElapsed)} · ${c.id}`;
    if (paused) return `${rest} carte(s) · en pause`;
    if (sessionIsLive()) return `${rest} carte(s) en file`;
    return 'Prêt pour ce soir ?';
  }

  function renderDockPill(c, paused, rest, matColor) {
    const sub = dockPillSubline(c, paused, rest);
    const live = sessionIsLive();
    return `
      <button type="button" class="sync-dock-pill${live ? ' live' : ''}" onclick="window.ankiV2DockToggle()" style="--pill-accent:${matColor || 'var(--gold)'}">
        <span class="sync-dock-pill-icon-wrap">${window.iconHtml('dna', 22, 'icon-md')}</span>
        <span class="sync-dock-pill-body">
          <span class="sync-dock-pill-title">Synchrotron</span>
          <span class="sync-dock-pill-sub">${esc(sub)}</span>
        </span>
        ${c ? `<span class="sync-dock-pill-chrono" id="syncDockChrono">${fmtSec(S.chronoElapsed)}</span>` : ''}
        <span class="sync-dock-pill-chevron">${window.iconHtml('chevron-up', 16)}</span>
      </button>
    `;
  }

  window.ankiV2DockLaunch = function () {
    ensure();
    restoreSessionFromStorageIfAny();
    if (sessionIsLive()) {
      window.switchTab('ankiV2');
      if (S.current) {
        window.ankiV2SessionSetUI('full');
      } else if (S.queue && S.queue.length) {
        S.sessionUI = 'dock';
        window.renderAnkiV2 && window.renderAnkiV2();
        renderSyncSessionDock();
      }
      return;
    }
    window.switchTab('ankiV2');
    if (typeof window.ankiV2SetView === 'function') window.ankiV2SetView('cockpit');
    S.sessionUI = 'dock';
    window.renderAnkiV2 && window.renderAnkiV2();
    renderSyncSessionDock();
  };

  window.ankiV2DockToggle = function () {
    if (S.sessionUI === 'dock') {
      S.sessionUI = 'mini';
      renderSessionOverlay();
      renderSyncSessionDock();
      return;
    }
    if (!sessionIsLive()) {
      window.ankiV2DockLaunch();
      return;
    }
    S.sessionUI = 'dock';
    renderSessionOverlay();
    renderSyncSessionDock();
  };

  window.ankiV2DockToggleCardDetail = function () {
    S.dockShowCardDetail = !S.dockShowCardDetail;
    renderSyncSessionDock();
  };

  function renderSyncSessionDock() {
    const dock = $("syncSessionDock");
    if (!dock) return;
    ensure();
    restoreSessionFromStorageIfAny();

    const live = sessionIsLive();
    const ui = S.sessionUI || 'mini';
    const c = S.current;
    const rest = (S.queue ? S.queue.length : 0) + (c ? 1 : 0);
    const done = S.stats ? Math.max(0, (S.stats.total || 0) - (S.queue ? S.queue.length : 0) - (c ? 1 : 0)) : 0;
    const paused = live && !c && S.queue && S.queue.length;
    const matColor = c ? (mat(c.mat).color || "var(--acc)") : "var(--gold)";
    const showExpanded = ui === 'dock' || (ui === 'full' && !c && live);

    dock.className = "sync-dock " + (showExpanded ? "expanded" : "mini") + (live ? " live" : " idle");
    document.body.classList.toggle("sync-session-mini", !showExpanded);
    document.body.classList.toggle("sync-session-dock-open", showExpanded);

    if (!showExpanded) {
      dock.innerHTML = renderDockPill(c, paused, rest, matColor);
      window.hydrateIcons && window.hydrateIcons(dock);
      paintChronoDisplays();
      return;
    }

    const locBtn = c && firstLinkedCoursId(c)
      ? `<button type="button" class="sync-dock-btn sync-dock-btn-ghost" onclick="window.doLocate('${esc(firstLinkedCoursId(c))}')">${window.iconLabel('map-pin', 'Où est le cours ?')}</button>`
      : "";

    const idleBlock = !live ? `
      <div class="sync-dock-idle-msg">
        <p>Lance ta session du soir depuis le Cockpit — mode <b>Automatique</b> ou choisis tes cartes.</p>
      </div>
      <div class="sync-dock-actions sync-dock-actions-row">
        <button type="button" class="bp sync-dock-btn sync-dock-btn-primary" onclick="window.switchTab('ankiV2');window.ankiV2SetView('cockpit');">${window.iconLabel('sliders', 'Ouvrir Cockpit')}</button>
        <button type="button" class="bp sync-dock-btn sync-dock-btn-gold" onclick="window.switchTab('ankiV2');window.ankiV2SetView('cockpit');window.startAnkiV2Session && window.startAnkiV2Session();">${window.iconLabel('play', 'Session auto')}</button>
      </div>
    ` : (c ? `
      <div class="sync-dock-card">
        <div class="sync-dock-card-top">
          <span class="uid-badge">${esc(c.id)}</span>
          <span class="anki-tag" style="background:${matColor}22;color:${matColor};border:1px solid ${matColor}">${esc(mat(c.mat).label)}</span>
          ${renderChronoBlock(true)}
        </div>
        <div class="sync-dock-title">${esc(c.titre || c.question || c.id)}</div>
        <div class="sync-dock-meta anki-mut">${sessStatsHtml(S.stats.ok, S.stats.mid, S.stats.bad)} · reste ${S.queue.length}</div>
        ${S.dockShowCardDetail ? renderDockCardDetail(c) : `
          <div class="sync-dock-preview anki-mut">${esc((c.question || '').slice(0, 120))}${(c.question || '').length > 120 ? '…' : ''}</div>
          ${renderDockSources(c)}
        `}
        <button type="button" class="sync-dock-link-btn" onclick="window.ankiV2DockToggleCardDetail()">${S.dockShowCardDetail ? window.iconLabel('chevron-down', 'Réduire') : window.iconLabel('book-open', 'Énoncé complet & sources livre')}</button>
      </div>
      <div class="sync-dock-actions">
        <button type="button" class="bp sync-dock-btn sync-dock-btn-primary" onclick="window.ankiV2SessionSetUI('full')">${window.iconLabel('square', 'Carte plein écran')}</button>
        <button type="button" class="sync-dock-btn sync-dock-btn-ghost" onclick="window.ankiV2SkipCard()">${window.iconLabel('skip-forward', 'Passer cette carte')}</button>
        ${locBtn}
        <button type="button" class="sync-dock-btn sync-dock-btn-ghost" onclick="window.ankiV2PauseSession()">${window.iconLabel('pause', 'Pause session')}</button>
      </div>
    ` : `
      <div class="sync-dock-card">
        <div class="sync-dock-title">${paused ? "Session en pause" : "Session du soir"}</div>
        <div class="sync-dock-meta anki-mut">${done}/${S.stats.total || rest} faites · <b>${S.queue ? S.queue.length : 0}</b> restante(s)</div>
      </div>
      <div class="sync-dock-actions sync-dock-actions-row">
        <button type="button" class="bp sync-dock-btn sync-dock-btn-primary" onclick="window.ankiV2ResumeSession()">${window.iconLabel('play', 'Reprendre')}</button>
        <button type="button" class="sync-dock-btn sync-dock-btn-ghost" onclick="window.ankiV2DiscardSession()">${window.iconLabel('trash-2', 'Abandonner')}</button>
      </div>
    `);

    dock.innerHTML = `
      <div class="sync-dock-panel" style="--dock-accent:${matColor}">
        <div class="sync-dock-panel-accent"></div>
        <div class="sync-dock-head">
          <span class="sync-dock-brand">${window.iconLabel('dna', 'Synchrotron')}</span>
          <button type="button" class="sync-dock-icon" onclick="window.ankiV2DockToggle()" title="Réduire">${window.iconHtml('chevron-down', 16)}</button>
        </div>
        ${idleBlock}
      </div>
    `;
    window.hydrateIcons && window.hydrateIcons(dock);
    paintChronoDisplays();
  }

  window.ankiV2SessionSetUI = function (mode) {
    S.sessionUI = mode === "mini" || mode === "dock" ? mode : "full";
    persistSession();
    renderSessionOverlay();
    renderSyncSessionDock();
  };

  window.ankiV2SessionMinimize = function () {
    S.sessionUI = 'mini';
    persistSession();
    renderSessionOverlay();
    renderSyncSessionDock();
  };

  function setSessionOverlayLock(on) {
    document.body.classList.toggle('anki-session-lock', !!on);
  }

  function renderSessionOverlay() {
    renderSyncSessionDock();
    const c = S.current;
    if (!c) {
      setSessionOverlayLock(false);
      const ov = $("ovAnkiSession");
      if (ov) ov.classList.add("hidden");
      return;
    }
    if (S.sessionUI === "mini" || S.sessionUI === "dock") {
      setSessionOverlayLock(false);
      const ov = $("ovAnkiSession");
      if (ov) ov.classList.add("hidden");
      return;
    }
    setSessionOverlayLock(true);
    let ov = $("ovAnkiSession");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovAnkiSession"; ov.className = "ov anki-deck-ov"; document.body.appendChild(ov); }
    ov.classList.add("anki-deck-ov");
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

    const isNewDeckCard = S._deckLastCardId !== c.id;
    S._deckLastCardId = c.id;
    const qText = (c.question || '').trim();
    const tText = (c.titre || '').trim();
    const showTitre = tText && tText.toLowerCase() !== qText.toLowerCase();

    ov.innerHTML = `
      <div class="anki-deck-scene" style="--deck-accent:${m.color}">
        <div class="anki-deck-card modal anki-session${isNewDeckCard ? ' anki-deck-enter' : ''}" style="--deck-accent:${m.color};border-top:5px solid ${m.color};">
          ${renderDeckProgressHtml(m.color)}
          <div class="anki-sess-top">
          <div class="anki-sess-tags">
            ${cardTypeBadge(c)}
            <span class="uid-badge">${c.id}</span>
            <span class="anki-tag" style="background:${m.color}20;color:${m.color};border:1px solid ${m.color};">${esc(m.label)}</span>
            ${isDevoir ? `<span class="anki-tag" style="background:#b06af720;color:#b06af7;border:1px solid #b06af7;">${window.iconLabel('file-text', `DM ${(dmRef._morceauxFaits || 0) + 1}/${dmRef._morceauxTotal || 1}`)}</span>` : `<span class="anki-tag">${stars(c)}</span>`}
          </div>
          <div class="anki-sess-chrono-col">
            ${renderChronoBlock(false)}
            <p class="anki-chrono-hint anki-mut" id="ankiChronoHint">${S.chronoRunning ? "Chrono en cours" : "Lance le chrono quand tu es prêt(e)"}</p>
          </div>
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
        ` : `<div class="anki-sess-meta">${window.iconHtml('timer', 12)} Cible ${window.AnkiAlgoV2.fmtDur(c.tempsCible || 60)} · ${profileLabel(c.profil || 'COURS')}${linkedTitle ? ' · ' + esc(linkedTitle) : ''}${c._blocageActif ? ' · <span style="color:var(--red);font-weight:700;">' + window.iconLabel('zap', 'BOOST blocage actif') + '</span>' : ''}</div>`}
        ${showTitre ? `<div class="anki-sess-titre">${esc(c.titre)}</div>` : ''}
        <div class="anki-sess-q">${esc(c.question || '')}</div>
        ${renderSourcesBox(c, false)}
        ${S.showAnswer ? `
          <div class="anki-eval-zone">
          ${hasReponse ? `<div class="anki-sess-r anki-sess-r-compact"><span class="anki-sess-r-label">Réponse</span><div>${esc(c.reponse)}</div></div>` : '<p class="anki-mut anki-no-rep-hint">Auto-éval · pas de réponse enregistrée</p>'}
          ${renderSourcesBox(c, true)}
          <div class="anki-temps-manuel anki-temps-compact" data-testid="temps-manuel-wrap">
            <div class="anki-temps-row">
              <span class="anki-mut anki-temps-lbl">${window.iconLabel('timer', 'Temps')}</span>
              <div class="anki-session-min-wrap">
                <input type="number" class="fc-number" id="ankiTempsManuel" data-testid="input-temps-manuel" min="0" max="600" step="0.5"
                  placeholder="${(S.chronoElapsed / 60).toFixed(1).replace(/\.0$/, '')}"
                  value="${S.sessionTempsManuel != null ? S.sessionTempsManuel : ''}"
                  oninput="window._ankiSessionTempsManuel = this.value === '' ? null : parseFloat(this.value);"
                  aria-label="Temps en minutes">
                <span class="anki-mut">min</span>
              </div>
              <button type="button" class="bs anki-temps-chrono-btn" onclick="document.getElementById('ankiTempsManuel').value=${(S.chronoElapsed / 60).toFixed(2)};window._ankiSessionTempsManuel=parseFloat(document.getElementById('ankiTempsManuel').value);">${window.iconLabel('timer', 'Chrono')}</button>
              <span class="anki-mut anki-temps-hint">${fmtSec(S.chronoElapsed)}</span>
            </div>
          </div>
          ${isDevoir ? `
            <div class="anki-evals anki-evals-compact">
              <button class="anki-eval bad" data-testid="eval-dm-bad" onclick="window.evalCardV2(2)" title="Pas avancé"><span class="eval-bad">${window.iconHtml('circle-x', 22, 'icon-lg')}</span><small>À refaire</small></button>
              <button class="anki-eval mid" data-testid="eval-dm-mid" onclick="window.evalCardV2(6)" title="Partiel"><span class="eval-mid">${window.iconHtml('circle-minus', 22, 'icon-lg')}</span><small>Partiel</small></button>
              <button class="anki-eval good" data-testid="eval-dm-good" onclick="window.evalCardV2(9)" title="Fait"><span class="eval-good">${window.iconHtml('check', 22, 'icon-lg')}</span><small>Fait</small></button>
            </div>
          ` : `
            <div class="anki-evals anki-evals-compact">
              <button class="anki-eval bad" data-testid="eval-bad" onclick="window.evalCardV2(2)"><span class="eval-bad">${window.iconHtml('circle-x', 22, 'icon-lg')}</span><small>Blocage</small></button>
              <button class="anki-eval mid" data-testid="eval-mid" onclick="window.evalCardV2(6)"><span class="eval-mid">${window.iconHtml('circle-minus', 22, 'icon-lg')}</span><small>Étourderie</small></button>
              <button class="anki-eval good" data-testid="eval-good" onclick="window.evalCardV2(9)"><span class="eval-good">${window.iconHtml('check', 22, 'icon-lg')}</span><small>Parfait</small></button>
            </div>
            ${showSlider ? `
              <div class="anki-slider-wrap anki-slider-compact">
                <span class="anki-mut anki-slider-lbl">Précision</span>
                <span class="anki-slider-val" id="ankiSliderVal">${S.sliderValue}</span><span class="anki-mut">/10</span>
                <input type="range" min="1" max="10" value="${S.sliderValue}" class="anki-slider" id="ankiSlider"
                  oninput="document.getElementById('ankiSliderVal').textContent=this.value;window._ankiSlider=parseInt(this.value);">
                <button class="bp anki-slider-btn" data-testid="btn-eval-slider" onclick="window.evalCardV2(parseInt(document.getElementById('ankiSlider').value))">Valider</button>
              </div>
            ` : ''}
          `}
          </div>
        ` : `<button class="bp anki-reveal" data-testid="btn-reveal" onclick="window.revealAnkiV2()">${isDevoir ? "J'ai fini cette session" : (hasReponse ? 'Afficher la réponse' : "J'ai fini · m'auto-évaluer")}</button>`}
        <div class="anki-sess-foot">
          <span class="anki-mut anki-sess-foot-stats">Reste : ${S.queue.length} · ${sessStatsHtml(S.stats.ok, S.stats.mid, S.stats.bad)}</span>
          <div class="anki-sess-foot-actions">
            ${S.dernierExerciceModifie ? `<button class="bs" data-testid="btn-undo-notation" style="border-color:var(--gold);color:var(--gold);" onclick="window.ankiV2UndoLastEval()">${window.iconLabel('refresh-cw', 'Annuler')}</button>` : ''}
            <button class="bs" data-testid="btn-skip-card" onclick="window.ankiV2SkipCard()">${window.iconLabel('skip-forward', 'Passer')}</button>
            <button class="bs" data-testid="btn-pause-session" onclick="window.ankiV2PauseSession()">${window.iconLabel('pause', 'Pause')}</button>
            <button class="bs" onclick="window.ankiV2SessionMinimize()">${window.iconLabel('layout-list', 'Réduire')}</button>
            <button class="bs anki-quit" data-testid="btn-abandon-session-active" onclick="window.ankiV2AbandonActiveSession()">${window.iconLabel('trash-2', 'Abandonner')}</button>
          </div>
        </div>
        </div>
      </div>
    `;
    window.hydrateIcons(ov);
    paintChronoDisplays();
    if (isNewDeckCard) ov.scrollTop = 0;
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

  window.revealAnkiV2 = function () { S.showAnswer = true; renderSessionOverlay(); };

  // v4: helper deep clone (snapshot complet d'une carte pour Undo)
  function cloneCard(c) {
    if (!c) return null;
    try { return JSON.parse(JSON.stringify(c)); }
    catch (e) { return Object.assign({}, c); }
  }

  // v4: annule la dernière notation
  window.ankiV2UndoLastEval = function () {
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
    window.AnkiAlgoV2.log("undo-eval", { id: snap.card.id, statBucket: snap.statBucket, historiqueConserved: true });
    S.dernierExerciceModifie = null;
    window.save();
    persistSession();
    nextCard();
    window.sysAlert("Dernière notation annulée. Paramètres restaurés — l'historique est conservé (entrée undo ajoutée).", "Undo");
  };

  window.evalCardV2 = function (qScore) {
    if (!S.current) return;
    qScore = Math.max(0, Math.min(10, qScore));
    if (S.chronoInt) { clearInterval(S.chronoInt); S.chronoInt = null; }
    syncChronoElapsed();
    S.chronoRunning = false;

    // temps réel = saisie manuelle (minutes) ou chrono figé au moment de la note (secondes)
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
        dmCard.dateProchaineRevision = window.AnkiAlgoV2.addDays(window.AnkiAlgoV2.todayISO(), 1);
      }
      dmCard.historique = dmCard.historique || [];
      dmCard.historique.push({ date: new Date().toISOString(), qScore, tempsReel: Math.round(tps), pen: 1, mode: S.mode, type: 'devoir-session' });
      window.AnkiAlgoV2.log("devoir-session", {
        id: dmCard.id,
        morceaux: dmCard._morceauxFaits + "/" + dmCard._morceauxTotal,
        prochaine: restants > 0 ? dmCard.dateProchaineRevision : "TERMINÉ",
        tempsReel: window.AnkiAlgoV2.fmtDur(tps)
      });
      window.sysAlert(`${window.iconHtml('file-text', 14)} <b>${esc(dmCard.titre || dmCard.id)}</b><br>Session ${dmCard._morceauxFaits}/${dmCard._morceauxTotal} terminée.<br>${restants > 0 ? 'Prochaine session : <b>' + esc(dmCard.dateProchaineRevision) + '</b>' : window.iconLabel('check', '<b>DM TERMINÉ</b>')}`, "DM");
    } else {
      // Carte normale : update ease/intervalle/repetitions + flag blocage
      const easeAvant = S.current.ease || 2.5;
      const intAvant = S.current.intervalle || 0;
      const out = window.AnkiAlgoV2.computeNextInterval(S.current, qScore, tps);
      if (S.mode !== "colle") {
        S.current.intervalle = out.intervalle;
        S.current.ease = out.ease;
        S.current.repetitions = out.repetitions;
        S.current.dateProchaineRevision = out.dateProchaineRevision;
        // v4: flags d'état pour l'ease aggressif + traçabilité I_R
        S.current._blocageActif    = out._blocageActif;
        S.current._blocageRevCount = out._blocageRevCount;
        S.current._lastReviewDate  = out._lastReviewDate;
        if (out._v2WindowOpen != null) S.current._v2WindowOpen = out._v2WindowOpen;
        if (out._v2WindowClose != null) S.current._v2WindowClose = out._v2WindowClose;
        if (out._v2Phase) S.current._v2Phase = out._v2Phase;
      }
      S.current.historique = S.current.historique || [];
      S.current.historique.push({ date: new Date().toISOString(), qScore, tempsReel: Math.round(tps), pen: out.penaliteVitesse, mode: S.mode });
      window.AnkiAlgoV2.log("eval", {
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
          ? `<br>${window.iconLabel('zap', `<b style="color:var(--red);">Blocage actif</b> (tentative ${out._blocageRevCount}) — la carte sera boostée jusqu'à note ≥ ${(window.AnkiAlgoV2.getCoefs().BLOCAGE_QSCORE_VALIDATE || 8)}.`)}`
          : (snapshot.card._blocageActif ? `<br>${window.iconLabel('check', '<b style="color:var(--grn);">Blocage levé</b>')}` : '');
        window.sysAlert(
          `<b>${esc(S.current.titre || S.current.id)}</b><br><br>` +
          `${window.iconLabel('target', `Score : <b>${qScore}/10</b> (vitesse ×${out.penaliteVitesse})`)}<br>` +
          `${window.iconLabel('bar-chart', `Ease : ${easeAvant.toFixed(2)} → <b style="color:${easeColor};">${out.ease} ${easeArrow}</b>`)}<br>` +
          `${window.iconLabel('calendar', `Intervalle : ${intAvant}j → <b>${out.intervalle}j</b>`)}<br>` +
          `${window.iconLabel('calendar', `Prochaine révision : <b>${out.dateProchaineRevision}</b>`)}${blocageLine}`,
          "Carte évaluée"
        );
      }
    }

    const btn = window.AnkiAlgoV2.qScoreToButton(qScore);
    if (btn === 0)      { S.stats.bad++; snapshot.statBucket = 'bad'; }
    else if (btn === 1) { S.stats.mid++; snapshot.statBucket = 'mid'; }
    else                { S.stats.ok++;  snapshot.statBucket = 'ok';  }

    // v4: conserve le snapshot pour Undo
    S.dernierExerciceModifie = snapshot;

    if (qScore <= 3 && S.mode !== "colle" && S.mode !== "single" && !isDevoir) S.queue.push(S.current);
    if (window.D.settings) window.D.settings.ankiLastSession = window.AnkiAlgoV2.todayISO();
    window.save();
    persistSession();
    nextCard(true);
  };
  window.ankiV2SkipCard = function () {
    if (!S.current) return;
    if (S.chronoInt) { clearInterval(S.chronoInt); S.chronoInt = null; }
    S.chronoRunning = false;
    nextCard(true, { skipCurrent: S.current });
  };

  window.ankiV2PauseSession = function () {
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = null;
    S.chronoRunning = false;
    const ov = $("ovAnkiSession");
    if (ov) ov.classList.add("hidden");
    S.sessionUI = "dock";
    setSessionOverlayLock(false);
    persistSession();
    renderSyncSessionDock();
    window.renderAnkiV2 && window.renderAnkiV2();
  };

  window.ankiV2AbandonActiveSession = function () {
    const M = window.APP_MSG || {};
    window.sysConfirm(
      M.ABANDON_ACTIVE || "Abandonner cette session ? La file en cours sera effacée (les cartes déjà notées restent enregistrées).",
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
        S.sessionUI = "full";
        setSessionOverlayLock(false);
        clearPersistedSession();
        renderSyncSessionDock();
        window.renderAnkiV2();
      },
      M.ABANDON_SESSION_TITLE || "Abandonner la session"
    );
  };

  window.abortAnkiV2Session = function () {
    if (S.chronoInt) clearInterval(S.chronoInt);
    S.chronoInt = null;
    setSessionOverlayLock(false);
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
      S.sessionUI = "mini";
      clearPersistedSession();
    } else {
      window.ankiV2PauseSession();
      return;
    }
    renderSyncSessionDock();
    window.renderAnkiV2();
  };
  function endSession() { window.abortAnkiV2Session(); }

  // ====== CRUD ======
  let editingExoId = null;

  window.ankiV2OpenExoModal = function (opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    ensure(); editingExoId = null;
    const preset = {};
    if (opts.mat) preset.mat = opts.mat;
    if (opts.coursId) {
      S.coursLinkSelection = new Set([opts.coursId]);
      if (!preset.mat) {
        const co = (window.D.cours || []).find(x => x.uid === opts.coursId);
        if (co) preset.mat = co.mat;
      }
    } else {
      S.coursLinkSelection = new Set();
    }
    S.coursLinkQuery = "";
    showExoModal(preset);
  };
  window.ankiV2OpenDevoirModal = function (opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    ensure(); editingExoId = null;
    const preset = { type: 'devoir', tempsCible: 30 * 60, profil: 'EXO', statut: 'actif' };
    if (opts.mat) preset.mat = opts.mat;
    if (opts.coursId) {
      S.coursLinkSelection = new Set([opts.coursId]);
      if (!preset.mat) {
        const co = (window.D.cours || []).find(x => x.uid === opts.coursId);
        if (co) preset.mat = co.mat;
      }
    } else {
      S.coursLinkSelection = new Set();
    }
    S.coursLinkQuery = "";
    showDevoirModal(preset);
  };
  window.ankiV2EditExo = function (id) {
    const c = ankFind(id); if (!c) return;
    editingExoId = id;
    S.coursLinkSelection = new Set(c.coursIds || (c.coursId ? [c.coursId] : []));
    S.coursLinkQuery = "";
    if (isDevoirCard(c)) showDevoirModal(c);
    else showExoModal(c);
  };
  window.ankiV2DelExo = function (id) {
    window.sysConfirm("Supprimer la carte " + id + " ?", () => {
      window.D.exercices = (window.D.exercices || []).filter(c => c.id !== id && c._morceauOf !== id);
      window.D.devoirs = (window.D.devoirs || []).filter(c => c.id !== id && c._morceauOf !== id);
      window.save(); window.renderAnkiV2();
    }, "Suppression");
  };

  function fieldVal(id) {
    const el = $(id);
    if (!el || el.value == null) return '';
    return String(el.value).trim();
  }

  function showFormError(elId, msg) {
    // Délègue au helper global (core-utils) — ne pas appeler le local (pas de récursion)
    if (typeof window.showFormError === 'function' && window.showFormError !== showFormError) {
      return window.showFormError(elId, msg);
    }
    const el = $(elId);
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('visible'); }
    else { el.textContent = ''; el.classList.remove('visible'); }
  }

  function autoGrowTextarea(el, maxPx) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    const max = maxPx || 280;
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, max);
    el.style.height = h + 'px';
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }

  function bindAutoGrowTextareas(root, maxPx) {
    const scope = root || document;
    scope.querySelectorAll('textarea').forEach(function (ta) {
      if (ta.dataset.autoGrowBound) return;
      ta.dataset.autoGrowBound = '1';
      autoGrowTextarea(ta, maxPx);
      ta.addEventListener('input', function () { autoGrowTextarea(ta, maxPx); });
    });
  }

  function cardHasSrcGuidance(c) {
    return !!(
      (c.sourceEnonce && (c.sourceEnonce.type || c.sourceEnonce.nom || c.sourceEnonce.details))
      || (c.sourceCorrection && (c.sourceCorrection.type || c.sourceCorrection.nom || c.sourceCorrection.details))
    );
  }

  function renderStatutChecks(c, prefix) {
    const isActif = c.statut === 'actif';
    const id = prefix;
    return `
      <div class="anki-statut-encart" id="${id}StatGroup">
        <input type="hidden" id="${id}Stat" value="${isActif ? 'actif' : 'reservoir'}">
        <div class="anki-statut-picker" role="group" aria-label="Statut de la carte">
          <button type="button" class="anki-statut-card${!isActif ? ' is-active' : ''}" data-stat="reservoir" onclick="window.ankiV2SetCardStatut('${id}', 'reservoir')">
            <span class="anki-statut-option-title">Réservoir</span>
            <span class="anki-mut anki-statut-hint">En attente d'activation</span>
          </button>
          <button type="button" class="anki-statut-card${isActif ? ' is-active' : ''}" data-stat="actif" onclick="window.ankiV2SetCardStatut('${id}', 'actif')">
            <span class="anki-statut-option-title">Actif</span>
            <span class="anki-mut anki-statut-hint">Entre dans les révisions</span>
          </button>
        </div>
      </div>`;
  }

  window.ankiV2SetCardStatut = function (prefix, value) {
    const hidden = $(prefix + 'Stat');
    const group = $(prefix + 'StatGroup');
    if (!hidden || !group) return;
    hidden.value = value === 'actif' ? 'actif' : 'reservoir';
    group.querySelectorAll('.anki-statut-card').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-stat') === hidden.value);
    });
  };

  function renderSrcGuidanceBlock(c, prefix, summaryHtml) {
    const open = cardHasSrcGuidance(c) ? ' open' : '';
    const id = prefix;
    const enonceTypeLabel = id === 'devoir' ? 'Sujet · Type' : 'Énoncé · Type';
    const enonceNomLabel = id === 'devoir' ? 'Nom' : 'Nom (livre / classeur)';
    const enonceNomPh = id === 'devoir' ? 'Ex: Feuille distribuée en cours' : 'Ex: HPrépa MP';
    const enonceDetLabel = id === 'devoir' ? 'Détails' : 'Détails (page, exo, onglet…)';
    const enonceDetPh = id === 'devoir' ? 'Ex: p.2 ex.4 à 7' : 'Ex: p.142 ex.7';
    return `
      <details class="anki-src-block anki-src-fold"${open}>
        <summary class="anki-src-fold-summary">${summaryHtml}</summary>
        <div class="anki-src-fold-body">
          <div class="anki-modal-row">
            <div class="fg"><label>${enonceTypeLabel}</label>
              <select id="${id}SrcEnonceType">
                <option value="">— Aucun —</option>
                <option value="livre"    ${(c.sourceEnonce && c.sourceEnonce.type) === 'livre'    ? 'selected' : ''}>Livre</option>
                <option value="classeur" ${(c.sourceEnonce && c.sourceEnonce.type) === 'classeur' ? 'selected' : ''}>Classeur</option>
              </select>
            </div>
            <div class="fg"><label>${enonceNomLabel}</label>
              <input type="text" id="${id}SrcEnonceNom" ${id === 'exo' ? 'data-testid="src-enonce-nom"' : ''} placeholder="${enonceNomPh}" value="${esc((c.sourceEnonce && c.sourceEnonce.nom) || '')}">
            </div>
            <div class="fg"><label>${enonceDetLabel}</label>
              <input type="text" id="${id}SrcEnonceDet" ${id === 'exo' ? 'data-testid="src-enonce-det"' : ''} placeholder="${enonceDetPh}" value="${esc((c.sourceEnonce && c.sourceEnonce.details) || '')}">
            </div>
          </div>
          <div class="anki-modal-row">
            <div class="fg"><label>Corrigé · Type</label>
              <select id="${id}SrcCorType">
                <option value="">— Aucun —</option>
                <option value="livre"    ${(c.sourceCorrection && c.sourceCorrection.type) === 'livre'    ? 'selected' : ''}>Livre</option>
                <option value="classeur" ${(c.sourceCorrection && c.sourceCorrection.type) === 'classeur' ? 'selected' : ''}>Classeur</option>
                <option value="app"      ${(c.sourceCorrection && c.sourceCorrection.type) === 'app'      ? 'selected' : ''}>Dans l'app</option>
              </select>
            </div>
            <div class="fg"><label>Nom</label>
              <input type="text" id="${id}SrcCorNom" ${id === 'exo' ? 'data-testid="src-cor-nom"' : ''} placeholder="${id === 'devoir' ? 'Ex: Corrigé prof' : 'Ex: Corrigé HPrépa'}" value="${esc((c.sourceCorrection && c.sourceCorrection.nom) || '')}">
            </div>
            <div class="fg"><label>Détails</label>
              <input type="text" id="${id}SrcCorDet" ${id === 'exo' ? 'data-testid="src-cor-det"' : ''} placeholder="${id === 'devoir' ? 'Ex: après rendu' : 'Ex: p.480, vidéo, onglet jaune'}" value="${esc((c.sourceCorrection && c.sourceCorrection.details) || '')}">
            </div>
          </div>
        </div>
      </details>`;
  }

  function showExoModal(c) {
    let ov = $("ovExo");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovExo"; ov.className = "ov ov-scroll"; document.body.appendChild(ov); }
    ov.classList.add('ov-scroll');
    ov.classList.remove("hidden");
    const matOpts = '<option value="">— Choisir —</option>' + (window.D.matieres || []).map(m => `<option value="${m.id}" ${m.id === c.mat ? 'selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`).join('');
    const profileOpts = Object.keys(window.AnkiAlgoV2.DEFAULT_PROFILES).map(p => `<option value="${p}" ${(c.profil || 'COURS') === p ? 'selected' : ''}>${esc(window.AnkiAlgoV2.DEFAULT_PROFILES[p].label)}</option>`).join('');
    const tempsMin = c.tempsCible ? (c.tempsCible / 60) : 1;

    ov.innerHTML = `
      <div class="modal anki-modal-exo card-type-surface card-type-main">
        <h2>${editingExoId ? window.iconLabel('pencil', 'Modifier') : window.iconLabel('sparkles', 'Nouvelle carte')} ${window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml('main') : ''} <span class="anki-mut" style="font-size:13px;font-weight:normal;">Principale</span></h2>
        <div id="exoFormError" class="anki-form-error" role="alert"></div>
        <div class="fg">
          <label>Titre court *</label>
          <input type="text" id="exoTitre" placeholder="Ex: Théorème énergie cinétique" value="${esc(c.titre || '')}" required>
        </div>
        <div class="fg">
          <label>Énoncé <span class="anki-mut" style="font-weight:normal;">(facultatif)</span></label>
          <textarea id="exoQ" rows="3">${esc(c.question || '')}</textarea>
        </div>
        <div class="fg">
          <label>Réponse (facultatif)</label>
          <textarea id="exoR" rows="2">${esc(c.reponse || '')}</textarea>
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Matière *</label><select id="exoMat">${matOpts}</select></div>
          <div class="fg"><label>Profil</label><select id="exoProf">${profileOpts}</select></div>
          ${durationPickerHtml(tempsMin, { hId: 'exoTimeH', mId: 'exoTimeM', minTotal: 5, maxTotal: 600, maxHours: 10, label: 'Durée' })}
        </div>
        <div class="anki-modal-row anki-modal-row--meta">
          <div class="fg fg-importance">
            <label>Importance</label>
            <div class="anki-importance-encart">
              ${window.starPickerHtml('exoImportance', cardImportance(c))}
              <p class="anki-mut anki-importance-tip">Plus d'étoiles → monte plus vite en session et revient plus souvent.</p>
            </div>
          </div>
          <div class="fg fg-statut">
            <label>Statut</label>
            ${renderStatutChecks(c, 'exo')}
          </div>
        </div>

        ${renderSrcGuidanceBlock(c, 'exo', window.iconLabel('book-open', '<b>Guidage physique</b> <span class="anki-mut" style="font-weight:normal;">— où trouver l\'énoncé et le corrigé (facultatif)</span>'))}

        <div class="fg">
          <label>Cours liés (recherche · plusieurs possibles)</label>
          ${searchField('Titre, matière, classeur, code...', `id="exoCoursSearch" oninput="window.ankiV2CoursLinkSearch(this.value)"`)}
          <div id="exoCoursSelected" class="anki-link-selected"></div>
          <div id="exoCoursResults" class="anki-link-results"></div>
        </div>

        ${editingExoId ? `<div class="fg"><label>Identifiant</label><div class="uidbox">${c.id}</div></div>` : ''}

        <div class="macts">
          ${typeof window.uiModalActions === 'function'
            ? window.uiModalActions({ overlayId: 'ovExo', saveClick: 'window.ankiV2SaveExo()' })
            : '<button class="bs" onclick="window.hideOverlay(\'ovExo\')">Annuler</button><button class="bp" onclick="window.ankiV2SaveExo()">Enregistrer</button>'}
        </div>
      </div>
    `;
    renderCoursLinkUI();
    window.hydrateIcons(ov);
    bindAutoGrowTextareas(ov);
  }

  function showDevoirModal(c) {
    ensure();
    if (!window.D) return window.sysAlert((window.APP_MSG && window.APP_MSG.DATA_NOT_READY) || "Données non chargées — réessaie dans un instant.", (window.APP_MSG && window.APP_MSG.ERROR) || "Erreur");
    let ov = $("ovDevoir");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovDevoir"; ov.className = "ov anki-ov-devoir"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const matieres = window.D.matieres || [];
    const defaultMat = c.mat || (matieres[0] && matieres[0].id) || '';
    const matOpts = (matieres.length
      ? '<option value="">— Choisir —</option>'
      : '<option value="">— Aucune matière — crée-en une dans Matières —</option>')
      + matieres.map(m => `<option value="${m.id}" ${m.id === defaultMat ? 'selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`).join('');
    const tempsMin = c._dureeTotaleMin != null ? c._dureeTotaleMin : (c.tempsCible ? (c.tempsCible / 60) : 30);
    const morceaux = Math.max(1, c._morceauxTotal || 1);
    const morceauxFaits = c._morceauxFaits || 0;

    ov.innerHTML = `
      <div class="modal anki-modal-devoir card-type-surface card-type-devoir">
        <h2>${editingExoId ? window.iconLabel('pencil', 'Modifier') : window.iconLabel('file-text', 'Nouveau')} ${window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml('devoir') : ''} <span class="anki-mut" style="font-size:13px;font-weight:normal;">Devoir</span></h2>
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
          <div class="fg"><label>Date limite *</label><input type="date" id="devoirDateLim" required min="${window.AnkiAlgoV2.todayISO()}" value="${esc(c.dateLimite || '')}"></div>
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

        <div class="fg fg-importance">
          <label>Importance</label>
          <div class="anki-importance-encart">
            ${window.starPickerHtml('devoirImportance', cardImportance(c))}
          </div>
        </div>

        ${renderSrcGuidanceBlock(c, 'devoir', window.iconLabel('book-open', '<b>Où est le sujet ?</b> <span class="anki-mut" style="font-weight:normal;">(souvent sur papier pour un DM)</span>'))}

        <div class="fg">
          <label>Cours liés (optionnel)</label>
          ${searchField('Titre, matière, classeur, code...', `id="exoCoursSearch" oninput="window.ankiV2CoursLinkSearch(this.value)"`)}
          <div id="exoCoursSelected" class="anki-link-selected"></div>
          <div id="exoCoursResults" class="anki-link-results"></div>
        </div>

        ${editingExoId ? `<div class="fg"><label>Identifiant W-</label><div class="uidbox">${c.id}</div></div>` : ''}
        </div>

        <div class="macts">
          ${typeof window.uiModalActions === 'function'
            ? window.uiModalActions({ overlayId: 'ovDevoir', saveClick: 'window.ankiV2SaveDevoir()', saveLabel: 'Enregistrer le devoir', saveColor: 'red' })
            : '<button type="button" class="bs" onclick="window.hideOverlay(\'ovDevoir\')">Annuler</button><button type="button" class="bp" style="background:var(--red);border-color:var(--red);" onclick="window.ankiV2SaveDevoir()">Enregistrer le devoir</button>'}
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
    bindAutoGrowTextareas(ov);
  }

  function renderCoursLinkUI() {
    const sel = $("exoCoursSelected"), res = $("exoCoursResults");
    if (!sel || !res) return;
    sel.innerHTML = Array.from(S.coursLinkSelection).map(uid => {
      const co = (window.D.cours || []).find(x => x.uid === uid);
      if (!co) return `<span class="anki-link-chip" onclick="window.ankiV2CoursLinkToggle('${uid}')">${uid} ${window.iconHtml('x', 12)}</span>`;
      const m = mat(co.mat);
      return `<span class="anki-link-chip" style="background:${m.color}20;border:1px solid ${m.color};color:${m.color};" onclick="window.ankiV2CoursLinkToggle('${uid}')">${co.uid} · ${esc(co.title)} ${window.iconHtml('x', 12)}</span>`;
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
      return `<div class="anki-link-row" onclick="window.ankiV2CoursLinkToggle('${c.uid}')">
        <span class="anki-link-mat" style="background:${m.color}20;color:${m.color};">${esc(m.label)}</span>
        <span class="anki-link-id">${esc(c.uid)}</span>
        <span class="anki-link-title">${esc(c.title)}</span>
        <span class="anki-mut">${esc(cl.name || '')}</span>
      </div>`;
    }).join('');
  }
  window.ankiV2CoursLinkSearch = function (v) { S.coursLinkQuery = v; renderCoursLinkUI(); };
  window.ankiV2CoursLinkToggle = function (uid) {
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

  window.ankiV2SaveExo = function () {
    showFormError('exoFormError', '');
    const titre = fieldVal('exoTitre');
    const q = fieldVal('exoQ');
    const r = fieldVal('exoR');
    const matV = fieldVal('exoMat');
    const profil = fieldVal('exoProf') || 'COURS';
    const tempsMin = readDurationFromPicker('exoTimeH', 'exoTimeM', null, null, 5, 600);
    const temps = Math.round(tempsMin * 60);
    const importance = window.getStarPickerValue('exoImportance');
    const stat = fieldVal('exoStat') || "reservoir";
    const coursIds = Array.from(S.coursLinkSelection);

    function readSrc(prefix) {
      const type = fieldVal('exoSrc' + prefix + 'Type');
      const nom  = fieldVal('exoSrc' + prefix + 'Nom');
      const det  = fieldVal('exoSrc' + prefix + 'Det');
      if (!type && !nom && !det) return null;
      return { type: type || 'livre', nom, details: det };
    }
    const sourceEnonce     = readSrc('Enonce');
    const sourceCorrection = readSrc('Cor');

    if (!titre || !matV) {
      showFormError('exoFormError', 'Titre et matière sont obligatoires.');
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
      if (stat === 'actif' && !c.dateProchaineRevision) c.dateProchaineRevision = window.AnkiAlgoV2.todayISO();
    } else {
      const existing = ankExistingIds();
      const newId = window.AnkiAlgoV2.genExoUid('X', existing);
      const card = {
        id: newId, titre, question: q, reponse: r, mat: matV, profil, tempsCible: temps,
        importance, statut: stat, coursIds, intervalle: 0,
        ease: window.AnkiAlgoV2.getProfile(profil).ease,
        repetitions: 0, dateProchaineRevision: stat === 'actif' ? window.AnkiAlgoV2.todayISO() : null,
        historique: [], epinglee: false, dateCreation: new Date().toISOString()
      };
      if (sourceEnonce)     card.sourceEnonce     = sourceEnonce;
      if (sourceCorrection) card.sourceCorrection = sourceCorrection;
      window.D.exercices.unshift(card);
    }
    window.save();
    const ov = $("ovExo"); if (ov) ov.classList.add("hidden");
    window.renderAnkiV2();
  };

  window.ankiV2SaveDevoir = function () {
    try {
      ensure();
      if (!window.D) {
        window.sysAlert((window.APP_MSG && window.APP_MSG.DATA_NOT_READY) || "Données non chargées — réessaie dans un instant.", (window.APP_MSG && window.APP_MSG.ERROR) || "Erreur");
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
    if (dateLim < window.AnkiAlgoV2.todayISO()) {
      showFormError('devoirFormError', 'La date limite ne peut pas être dans le passé.');
      return;
    }

      const profil = 'EXO';
      const stat = 'actif';
      const today = window.AnkiAlgoV2.todayISO();

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
        const newId = window.AnkiAlgoV2.genExoUid('W', existing);
        const card = {
          id: newId, titre, question: q, mat: matV, profil, importance, statut: stat, coursIds,
          type: 'devoir', dateLimite: dateLim, intervalle: 0,
          ease: window.AnkiAlgoV2.getProfile(profil).ease,
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
      window.renderAnkiV2();
      window.sysAlert(`${window.iconLabel('check', 'Devoir enregistré')}<br><b>${esc(titre || q)}</b> — visible dans l'Agenda.`, "Devoir W-");
    } catch (e) {
      console.error('saveDevoir', e);
      showFormError('devoirFormError', 'Erreur à l\'enregistrement : ' + (e.message || e));
    }
  };

  window.ankiV2PlayChapter = function (coursId) {
    ensure();
    if (!coursId) return;
    const sessionMin = getSessionMinutesV2();
    const plan = window.AnkiAlgoV2.buildChapterSession(ankSessionPool(), coursId, sessionMin);
    if (!plan.cartes.length) return window.sysAlert("Aucune carte active pour ce chapitre.", "Synchrotron V2");
    S.queue = plan.cartes.slice();
    S.mode = "colle";
    S.stats = { ok: 0, mid: 0, bad: 0, total: plan.cartes.length };
    nextCard();
  };

  window.ankiV2OpenQuickModal = function (opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    ensure();
    editingExoId = null;
    const preset = { profil: 'ANGLAIS', statut: 'actif', tempsCible: 30 };
    if (opts.mat) preset.mat = opts.mat;
    if (opts.coursId) {
      S.coursLinkSelection = new Set([opts.coursId]);
      if (!preset.mat) {
        const co = (window.D.cours || []).find(x => x.uid === opts.coursId);
        if (co) preset.mat = co.mat;
      }
    } else {
      S.coursLinkSelection = new Set();
    }
    S.coursLinkQuery = "";
    showQuickCreateModal(preset);
  };

  function showQuickCreateModal(c) {
    let ov = $("ovQuickCreate");
    if (!ov) { ov = document.createElement("div"); ov.id = "ovQuickCreate"; ov.className = "ov"; document.body.appendChild(ov); }
    ov.classList.remove("hidden");
    const matOpts = (window.D.matieres || []).map(m => `<option value="${m.id}" ${m.id === c.mat ? 'selected' : ''}>${esc(m.label)} — ${esc(m.name)}</option>`).join('');
    const tempsMin = c.tempsCible ? (c.tempsCible / 60) : 0.5;
    ov.innerHTML = `
      <div class="modal card-type-surface card-type-quick">
        <h2>${window.iconLabel('zap', 'Nouvelle carte')} ${window.cardTypeBadgeHtml ? window.cardTypeBadgeHtml('quick') : ''} <span class="anki-mut" style="font-size:13px;font-weight:normal;">Rapide</span></h2>
        <p class="anki-mut" style="font-size:12px;margin-top:-4px;">Active directement · comblage de session</p>
        <div id="quickFormError" class="anki-form-error" role="alert"></div>
        <div class="fg">
          <label>Question / recto *</label>
          <input type="text" id="quickQ" placeholder="Ex: « to elicit »" value="${esc(c.question || '')}">
        </div>
        <div class="fg">
          <label>Réponse / verso <span class="anki-mut" style="font-weight:normal;">(facultatif)</span></label>
          <input type="text" id="quickR" placeholder="Traduction ou rappel court" value="${esc(c.reponse || '')}">
        </div>
        <div class="anki-modal-row">
          <div class="fg"><label>Matière *</label><select id="quickMat">${matOpts}</select></div>
          <div class="fg"><label>Durée (min)</label><input type="number" id="quickTempsMin" min="0.25" max="5" step="0.25" value="${tempsMin}"></div>
        </div>
        <div class="macts">
          ${typeof window.uiModalActions === 'function'
            ? window.uiModalActions({ overlayId: 'ovQuickCreate', saveClick: 'window.ankiV2SaveQuick()', saveLabel: (window.APP_MSG && window.APP_MSG.CREATE) || 'Créer' })
            : '<button type="button" class="bs" onclick="window.hideOverlay(\'ovQuickCreate\')">Annuler</button><button type="button" class="bp" onclick="window.ankiV2SaveQuick()">Créer</button>'}
        </div>
      </div>`;
    window.hydrateIcons(ov);
    bindAutoGrowTextareas(ov);
    const qEl = $("quickQ");
    if (qEl) qEl.focus();
  }

  window.ankiV2SaveQuick = function () {
    showFormError('quickFormError', '');
    const q = fieldVal('quickQ');
    const r = fieldVal('quickR');
    const mat = fieldVal('quickMat');
    const tempsMin = parseFloat(fieldVal('quickTempsMin')) || 0.5;
    if (!q) return showFormError('quickFormError', 'La question est obligatoire.');
    if (!mat) return showFormError('quickFormError', 'Choisis une matière.');
    const coursIds = Array.from(S.coursLinkSelection || []);
    window.quickAddAnkiCard({
      question: q,
      reponse: r,
      mat,
      profil: 'ANGLAIS',
      tempsCible: Math.max(15, Math.round(tempsMin * 60)),
      statut: 'actif',
      importance: 3,
      coursIds
    });
    const ov = $("ovQuickCreate");
    if (ov) ov.classList.add('hidden');
    window.renderAnkiV2();
    if (typeof window.renderFlashcards === 'function') window.renderFlashcards();
    window.sysAlert(window.iconLabel('check', 'Carte rapide créée et active.'), 'Rapide Y-');
  };

  window.quickAddAnkiCard = function (data) {
    ensure();
    const matV = data.mat || ((window.D.matieres[0] && window.D.matieres[0].id) || 'XX');
    const existing = ankExistingIds();
    const id = window.AnkiAlgoV2.genExoUid('Y', existing);
    const profil = data.profil || 'ANGLAIS';
    const statut = data.statut || 'actif';
    const importance = data.importance != null ? data.importance : 3;
    const card = {
      id,
      titre: data.titre || '',
      question: data.question || '',
      reponse: data.reponse || '',
      mat: matV,
      profil,
      tempsCible: data.tempsCible || 60,
      importance,
      statut,
      coursIds: data.coursIds || [],
      intervalle: 0,
      ease: window.AnkiAlgoV2.getQuickStarProfile(importance).ease,
      repetitions: 0,
      dateProchaineRevision: statut === 'actif' ? window.AnkiAlgoV2.todayISO() : null,
      historique: [],
      epinglee: false,
      dateCreation: new Date().toISOString()
    };
    window.D.exercices.unshift(card);
    window.save();
    return card;
  };

  window.editExo = window.ankiV2EditExo;
  window.delExo = window.ankiV2DelExo;
  window.startAnkiSingle = window.startAnkiV2Single;

  window.cardAlgoStatsLineV2 = cardAlgoStatsLine;
  window.renderSyncSessionDock = renderSyncSessionDock;
})();
