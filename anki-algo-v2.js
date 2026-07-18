/**
 * anki-algo-v2.js — Synchrotron V2 (fenêtres ★, phases, priorité simple)
 * Même données (D.exercices / D.devoirs) · moteur de session distinct de v1.
 */
(function () {
  const V2 = {};
  const A1 = function () { return window.AnkiAlgo; };

  function needA1() {
    if (!A1()) throw new Error("AnkiAlgo v1 requis avant anki-algo-v2.js");
    return A1();
  }

  // ===== Délégation utilitaires partagés (cartes, dates, profils) =====
  V2.allCards = function (D) { return needA1().allCards(D); };
  V2.findCard = function (D, id) { return needA1().findCard(D, id); };
  V2.allExistingIds = function (D) { return needA1().allExistingIds(D); };
  V2.genExoUid = function (kind, existing) { return needA1().genExoUid(kind, existing); };
  V2.cardKind = function (c) { return needA1().cardKind(c); };
  V2.isActive = function (c) { return needA1().isActive(c); };
  V2.isReservoir = function (c) { return needA1().isReservoir(c); };
  V2.activateFromReservoir = function (c) { return needA1().activateFromReservoir(c); };
  V2.getImportance = function (c) { return needA1().getImportance(c); };
  V2.getProfile = function (p) { return needA1().getProfile(p); };
  V2.getQuickStarProfile = function (imp) { return needA1().getQuickStarProfile(imp); };
  V2.DEFAULT_PROFILES = needA1().DEFAULT_PROFILES;
  V2.DEFAULT_QUICK_STAR_STEPS = needA1().DEFAULT_QUICK_STAR_STEPS;
  V2.DEFAULT_COEFS = needA1().DEFAULT_COEFS;
  V2.todayISO = function () { return needA1().todayISO(); };
  V2.addDays = function (d, n) { return needA1().addDays(d, n); };
  V2.fmtDur = function (s) { return needA1().fmtDur(s); };
  V2.secToMin = function (s) { return needA1().secToMin(s); };
  V2.log = function (ev, data) { return needA1().log(ev, Object.assign({ engine: "v2" }, data || {})); };
  V2.urgenceDevoir = function (c, ref) { return needA1().urgenceDevoir(c, ref); };
  V2.shiftProgramIfMissedDaily = function (D) { return needA1().shiftProgramIfMissedDaily(D); };
  V2.migrateData = function (D) { return needA1().migrateData(D); };
  V2.interleaveMatieres = function (cards) { return needA1().interleaveMatieres(cards); };
  V2.buildQuickSession = function (cards) { return needA1().buildQuickSession(cards); };
  V2.weaveSession = function (main, quick) { return needA1().weaveSession(main, quick); };
  V2.forecastSchedule = function (cards, days) { return needA1().forecastSchedule(cards, days); };
  V2.isOverdue = function (c, ref) { return needA1().isOverdue(c, ref); };
  V2.computeIR = function (c, ref) { return needA1().computeIR(c, ref); };
  V2.qButtonToScore = function (b) { return needA1().qButtonToScore(b); };
  V2.qScoreToButton = function (s) { return needA1().qScoreToButton(s); };
  V2.getCoefs = function () { return needA1().getCoefs(); };
  V2.importanceIntervalMult = function (imp) { return needA1().importanceIntervalMult(imp); };
  V2.smartOrder = function (cards) { return needA1().smartOrder(cards); };
  V2.cardDuration = function (c) { return needA1().cardDuration(c); };

  V2.getCandidates = function (exercices, ref) {
    return V2.sortByPriority(exercices, ref).map(x => ({ card: x.card, score: { total: x.priority, breakdown: x.breakdown, raw: x.raw } }));
  };

  /** Alias compat UI v1 : score unique = priorité V2. */
  V2.scoreSession = function (card, ref) {
    const sc = V2.priorityScore(card, ref);
    return { total: sc.priority, breakdown: sc.breakdown, raw: sc.raw };
  };

  V2.urgenceScore = function (card, ref) {
    return V2.priorityScore(card, ref);
  };

  V2.DEFAULT_SETTINGS = {
    horizon: "1y",
    sessionMinDefault: 90,
    pullForward: true,
    margeBudget: 0.92
  };

  /** Facteur d'échelle des fenêtres : 1 an (redouble) vs 2 ans (cycle complet). */
  V2.horizonScale = function () {
    const h = (window.D && window.D.settings && window.D.settings.algoV2 && window.D.settings.algoV2.horizon) || "1y";
    return h === "2y" ? 1 : 0.55;
  };

  V2.getSettings = function () {
    if (!window.D) return Object.assign({}, V2.DEFAULT_SETTINGS);
    if (!window.D.settings.algoV2) window.D.settings.algoV2 = Object.assign({}, V2.DEFAULT_SETTINGS);
    return window.D.settings.algoV2;
  };

  /** Fenêtres ★ par défaut (base cycle 2 ans) : openAfter = jours avant ouverture, width = largeur. */
  V2.STAR_WINDOWS = {
    1: { openAfter: 120, width: 90 },
    2: { openAfter: 75, width: 50 },
    3: { openAfter: 50, width: 35 },
    4: { openAfter: 30, width: 25 },
    5: { openAfter: 20, width: 28 }
  };
  V2.DEFAULT_STAR_WINDOWS = V2.STAR_WINDOWS;

  function _clampInt(n, min, max, fallback) {
    const v = parseInt(n, 10);
    if (isNaN(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  /** Fenêtres effectives (defaults + overrides `settings.algoV2.starWindows`). */
  V2.getStarWindows = function () {
    const user = (window.D && window.D.settings && window.D.settings.algoV2 && window.D.settings.algoV2.starWindows) || {};
    const out = {};
    [1, 2, 3, 4, 5].forEach(function (k) {
      const d = V2.STAR_WINDOWS[k];
      const u = user[k] || user[String(k)] || {};
      out[k] = {
        openAfter: _clampInt(u.openAfter != null ? u.openAfter : d.openAfter, 1, 730, d.openAfter),
        width: _clampInt(u.width != null ? u.width : d.width, 3, 365, d.width)
      };
    });
    return out;
  };

  V2.scaledWindow = function (imp) {
    const s = V2.horizonScale();
    const all = V2.getStarWindows();
    const w = all[imp] || all[3];
    return {
      openAfter: Math.max(1, Math.round(w.openAfter * s)),
      width: Math.max(3, Math.round(w.width * s))
    };
  };

  V2.setStarWindow = function (stars, openAfter, width) {
    const k = Math.max(1, Math.min(5, parseInt(stars, 10) || 3));
    const def = V2.STAR_WINDOWS[k];
    if (!window.D) return V2.getStarWindows()[k];
    if (!window.D.settings) window.D.settings = {};
    if (!window.D.settings.algoV2) window.D.settings.algoV2 = Object.assign({}, V2.DEFAULT_SETTINGS);
    if (!window.D.settings.algoV2.starWindows) window.D.settings.algoV2.starWindows = {};
    window.D.settings.algoV2.starWindows[k] = {
      openAfter: _clampInt(openAfter, 1, 730, def.openAfter),
      width: _clampInt(width, 3, 365, def.width)
    };
    return window.D.settings.algoV2.starWindows[k];
  };

  V2.resetStarWindows = function () {
    if (!window.D || !window.D.settings || !window.D.settings.algoV2) return;
    delete window.D.settings.algoV2.starWindows;
  };

  /**
   * Éditeur intuitif des fenêtres ★ (modèle carte mentale).
   * opts.idPrefix — préfixe des ids input ; opts.onChange — nom de handler window (défaut ankiV2SaveStarWindow)
   */
  V2.renderStarWindowsEditor = function (opts) {
    opts = opts || {};
    const prefix = opts.idPrefix || "sw";
    const handler = opts.onChange || "ankiV2SaveStarWindow";
    const scale = V2.horizonScale();
    const horizon = (window.D && window.D.settings && window.D.settings.algoV2 && window.D.settings.algoV2.horizon) === "2y"
      ? "2 ans (×1)" : "1 an (×" + scale.toFixed(2) + ")";
    const bases = V2.getStarWindows();
    const labelFn = (typeof window.importanceLabel === "function")
      ? window.importanceLabel
      : function (n) { return "★".repeat(n); };

    const cards = [5, 4, 3, 2, 1].map(function (stars) {
      const base = bases[stars];
      const scaled = V2.scaledWindow(stars);
      const maxBar = 210;
      const waitPct = Math.min(92, Math.round((base.openAfter / maxBar) * 100));
      const winPct = Math.min(100 - waitPct, Math.max(4, Math.round((base.width / maxBar) * 100)));
      return `
        <div class="sw-card" data-stars="${stars}">
          <div class="sw-card-hdr">
            <strong>${labelFn(stars)}</strong>
            <span class="sw-card-hint">plus de ★ → revient plus tôt</span>
          </div>
          <div class="sw-timeline" title="Attente puis fenêtre de révision">
            <div class="sw-tl-wait" style="width:${waitPct}%"></div>
            <div class="sw-tl-win" style="width:${winPct}%"></div>
          </div>
          <div class="sw-tl-legend">
            <span>attente</span>
            <span>fenêtre ouverte</span>
          </div>
          <div class="sw-fields">
            <label>Ouvre après
              <input type="number" class="fi sw-input" id="${prefix}_open_${stars}" min="1" max="730" step="1"
                value="${base.openAfter}" oninput="window.${handler}(${stars},'${prefix}')">
              <span class="sw-unit">j</span>
            </label>
            <label>Largeur
              <input type="number" class="fi sw-input" id="${prefix}_width_${stars}" min="3" max="365" step="1"
                value="${base.width}" oninput="window.${handler}(${stars},'${prefix}')">
              <span class="sw-unit">j</span>
            </label>
          </div>
          <div class="sw-preview" id="${prefix}_prev_${stars}">→ horizon actuel : ouvre <b>J+${scaled.openAfter}</b> · fenêtre <b>${scaled.width} j</b></div>
        </div>`;
    }).join("");

    return `
      <div class="sw-editor" data-testid="star-windows-editor">
        <p class="sw-intro">Valeurs en <b>base cycle 2 ans</b> — l'horizon (${horizon}) les réduit ensuite. En phase <b>mature</b>, après une bonne note : la carte s'ouvre à J+ouverture, tu peux la revoir pendant toute la largeur.</p>
        <div class="sw-grid">${cards}</div>
        <div class="sw-actions">
          <button type="button" class="bs" onclick="window.ankiV2ResetStarWindows('${prefix}')">${typeof window.iconLabel === "function" ? window.iconLabel("refresh-cw", "Fenêtres par défaut") : "Fenêtres par défaut"}</button>
        </div>
      </div>`;
  };

  window.ankiV2SaveStarWindow = function (stars, idPrefix) {
    const prefix = idPrefix || "sw";
    const k = Math.max(1, Math.min(5, parseInt(stars, 10) || 3));
    const openEl = document.getElementById(prefix + "_open_" + k);
    const widthEl = document.getElementById(prefix + "_width_" + k);
    if (!openEl || !widthEl) return;
    V2.setStarWindow(k, openEl.value, widthEl.value);
    if (typeof window.save === "function") window.save();
    const scaled = V2.scaledWindow(k);
    const prev = document.getElementById(prefix + "_prev_" + k);
    if (prev) {
      prev.innerHTML = "→ horizon actuel : ouvre <b>J+" + scaled.openAfter + "</b> · fenêtre <b>" + scaled.width + " j</b>";
    }
    const card = openEl.closest(".sw-card");
    if (card) {
      const base = V2.getStarWindows()[k];
      const maxBar = 210;
      const waitPct = Math.min(92, Math.round((base.openAfter / maxBar) * 100));
      const winPct = Math.min(100 - waitPct, Math.max(4, Math.round((base.width / maxBar) * 100)));
      const wait = card.querySelector(".sw-tl-wait");
      const win = card.querySelector(".sw-tl-win");
      if (wait) wait.style.width = waitPct + "%";
      if (win) win.style.width = winPct + "%";
    }
  };

  window.ankiV2ResetStarWindows = function (idPrefix) {
    V2.resetStarWindows();
    if (typeof window.save === "function") window.save();
    if (typeof window.renderAnkiVizV2 === "function" && window._activeTab === "ankiVizV2") {
      window.renderAnkiVizV2();
    }
    if (typeof window.renderAnkiV2 === "function" && window._activeTab === "ankiV2") {
      window.renderAnkiV2();
    }
    // Si aucun des deux onglets actifs : rafraîchir quand même les inputs visibles
    if (idPrefix) {
      const bases = V2.getStarWindows();
      [1, 2, 3, 4, 5].forEach(function (k) {
        const o = document.getElementById(idPrefix + "_open_" + k);
        const w = document.getElementById(idPrefix + "_width_" + k);
        if (o) o.value = bases[k].openAfter;
        if (w) w.value = bases[k].width;
        if (typeof window.ankiV2SaveStarWindow === "function") {
          // Met à jour timeline + preview sans réécrire settings (déjà reset)
          const scaled = V2.scaledWindow(k);
          const prev = document.getElementById(idPrefix + "_prev_" + k);
          if (prev) prev.innerHTML = "→ horizon actuel : ouvre <b>J+" + scaled.openAfter + "</b> · fenêtre <b>" + scaled.width + " j</b>";
          if (o) {
            const card = o.closest(".sw-card");
            if (card) {
              const maxBar = 210;
              const waitPct = Math.min(92, Math.round((bases[k].openAfter / maxBar) * 100));
              const winPct = Math.min(100 - waitPct, Math.max(4, Math.round((bases[k].width / maxBar) * 100)));
              const wait = card.querySelector(".sw-tl-wait");
              const win = card.querySelector(".sw-tl-win");
              if (wait) wait.style.width = waitPct + "%";
              if (win) win.style.width = winPct + "%";
            }
          }
        }
      });
    }
  };

  /** learning | consolidation | mature */
  V2.getPhase = function (card) {
    if (!card) return "learning";
    const rep = card.repetitions || 0;
    const ease = card.ease || 2.5;
    if (rep < 3 || ease < 2.2) return "learning";
    if (rep < 8 || ease < 2.4) return "consolidation";
    return "mature";
  };

  V2.daysBetween = function (a, b) {
    const da = new Date(a + "T12:00:00");
    const db = new Date(b + "T12:00:00");
    return Math.round((db - da) / 86400000);
  };

  /** État fenêtre : overdue | active | soon | later */
  V2.windowState = function (card, ref) {
    ref = ref || V2.todayISO();
    const phase = V2.getPhase(card);
    const due = card.dateProchaineRevision;

    if (phase === "learning") {
      if (!due) return "active";
      if (due < ref) return "overdue";
      if (due === ref) return "active";
      const d = V2.daysBetween(ref, due);
      if (d <= 1) return "soon";
      return "later";
    }

    if (phase === "consolidation") {
      if (!due) return "active";
      if (due < ref) return "overdue";
      const slack = V2.daysBetween(ref, due);
      if (slack <= 0) return "active";
      if (slack <= 4) return "soon";
      return "later";
    }

    const open = card._v2WindowOpen || due;
    const close = card._v2WindowClose;
    if (!open) return "active";
    if (ref < open) {
      const until = V2.daysBetween(ref, open);
      return until <= 3 ? "soon" : "later";
    }
    if (close && ref > close) return "overdue";
    return "active";
  };

  /**
   * Score de priorité unique (affichage + tri session).
   * Retard >> fenêtre active >> ★ >> ease bas >> fin de fenêtre proche.
   */
  V2.priorityScore = function (card, ref) {
    ref = ref || V2.todayISO();
    if (!card || !V2.isActive(card)) return { priority: 0, breakdown: {}, raw: {} };

    const imp = V2.getImportance(card);
    const ease = card.ease || 2.5;
    const ws = V2.windowState(card, ref);
    const phase = V2.getPhase(card);
    let p = 0;
    const bd = { retard: 0, fenetre: 0, importance: 0, difficulte: 0, finFenetre: 0 };

    if (ws === "overdue") {
      const due = card.dateProchaineRevision || card._v2WindowOpen || ref;
      const late = Math.max(1, V2.daysBetween(due, ref));
      bd.retard = 10000 + late * 100;
      p += bd.retard;
    } else if (ws === "active") {
      bd.fenetre = 5000;
      p += bd.fenetre;
      if (phase === "mature" && card._v2WindowClose) {
        const toClose = V2.daysBetween(ref, card._v2WindowClose);
        if (toClose >= 0 && toClose <= 5) {
          bd.finFenetre = (5 - toClose) * 80;
          p += bd.finFenetre;
        }
      }
    } else if (ws === "soon") {
      bd.fenetre = 2000;
      p += bd.fenetre;
    }

    bd.importance = imp * 200;
    p += bd.importance;
    bd.difficulte = Math.max(0, (2.8 - ease) * 60);
    p += bd.difficulte;

    const ir = V2.computeIR(card, ref);
    return {
      priority: Math.round(p * 100) / 100,
      breakdown: bd,
      raw: { phase, windowState: ws, importance: imp, ease, IR: ir.IR }
    };
  };

  V2.sortByPriority = function (cards, ref) {
    ref = ref || V2.todayISO();
    return (cards || [])
      .filter(c => V2.isActive(c) && V2.cardKind(c) !== "devoir")
      .map(c => {
        const sc = V2.priorityScore(c, ref);
        return { card: c, priority: sc.priority, breakdown: sc.breakdown, raw: sc.raw };
      })
      .sort((a, b) => b.priority - a.priority);
  };

  V2.isEligibleTonight = function (card, ref, pullForward) {
    ref = ref || V2.todayISO();
    const ws = V2.windowState(card, ref);
    if (ws === "overdue" || ws === "active") return true;
    if (pullForward && ws === "soon") return true;
    return false;
  };

  function _tempsCarte(c) {
    // Même durée que l'UI / v1 (évite de rediviser tempsCible déjà « par session »)
    if (c && (c.type === "devoir" || V2.cardKind(c) === "devoir")) {
      const total = c._morceauxTotal || 1;
      const done = c._morceauxFaits || 0;
      if (done >= total) return 0;
    }
    return V2.cardDuration(c);
  }

  /** Après notation : même cœur SM-2 que v1 + fenêtres ★ en phase mature. */
  V2.computeNextInterval = function (card, qScore, tempsReel) {
    const base = needA1().computeNextInterval(card, qScore, tempsReel);
    const imp = V2.getImportance(card);
    const phase = V2.getPhase(Object.assign({}, card, base));
    const today = V2.todayISO();

    if (phase === "mature" && base.intervalle > 0 && qScore > 3) {
      const w = V2.scaledWindow(imp);
      const openAfter = Math.max(w.openAfter, Math.min(base.intervalle, w.openAfter + 5));
      base._v2WindowOpen = V2.addDays(today, openAfter);
      base._v2WindowClose = V2.addDays(today, openAfter + w.width);
      base.dateProchaineRevision = base._v2WindowOpen;
      base._v2Phase = "mature";
    } else {
      base._v2Phase = phase;
      if (qScore <= 3) {
        base._v2WindowOpen = null;
        base._v2WindowClose = null;
      }
    }
    return base;
  };

  V2.buildSession = function (exercices, opts) {
    const st = V2.getSettings();
    const userMarge = (window.D && window.D.settings && typeof window.D.settings.margeBudget === "number")
      ? window.D.settings.margeBudget : st.margeBudget;
    const o = Object.assign({
      sessionMinutes: st.sessionMinDefault || 90,
      includeNew: 0,
      selectedIds: null,
      marge: userMarge,
      manualOrder: null,
      pullForward: st.pullForward !== false
    }, opts || {});
    o.marge = Math.max(0.5, Math.min(1.0, o.marge));
    const ref = V2.todayISO();
    const budget = (o.sessionMinutes || 60) * 60 * o.marge;

    if (!Array.isArray(exercices)) {
      return { cartes: [], tempsTotalPrev: 0, countDevoir: 0, countMain: 0, countQuick: 0, reportees: [], marge: o.marge, overload: false, overloadDelta: 0 };
    }

    if (o.manualOrder && o.manualOrder.length) {
      const map = {};
      exercices.filter(c => V2.isActive(c)).forEach(c => { map[c.id] = c; });
      const ordered = o.manualOrder.map(id => map[id]).filter(Boolean);
      const result = []; let used = 0;
      for (const c of ordered) {
        const t = _tempsCarte(c);
        if (used + t > budget && result.length) break;
        result.push(c); used += t;
      }
      return {
        cartes: result, tempsTotalPrev: used,
        countDevoir: result.filter(c => V2.cardKind(c) === "devoir").length,
        countMain: result.filter(c => V2.cardKind(c) === "main").length,
        countQuick: result.filter(c => V2.cardKind(c) === "quick").length,
        reportees: ordered.filter(c => !result.includes(c)),
        marge: o.marge, overload: false, overloadDelta: 0
      };
    }

    let pool = exercices.filter(c => V2.isActive(c));
    if (o.selectedIds && o.selectedIds.length) {
      const set = new Set(o.selectedIds);
      pool = pool.filter(c => set.has(c.id));
    }

    const pileDevoir = [], pileMain = [], pileQuick = [];
    pool.forEach(c => {
      const k = V2.cardKind(c);
      if (k === "devoir") pileDevoir.push(c);
      else if (k === "quick") pileQuick.push(c);
      else pileMain.push(c);
    });

    const seuilDevoir = (window.D && window.D.settings && window.D.settings.seuilDevoirForce) || 35;
    const devoirsScored = pileDevoir
      .map(c => ({ card: c, score: V2.urgenceDevoir(c, ref) }))
      .sort((a, b) => b.score.total - a.score.total);
    const devoirsForces = devoirsScored.filter(x => x.score.total >= seuilDevoir);

    const selected = [];
    let used = 0;
    devoirsForces.forEach(x => { selected.push(x.card); used += _tempsCarte(x.card); });
    const overload = used > budget;
    const overloadDelta = overload ? used - budget : 0;

    const mainsEligible = pileMain.filter(c => V2.isEligibleTonight(c, ref, o.pullForward));
    const mainsSorted = mainsEligible
      .map(c => ({ card: c, sc: V2.priorityScore(c, ref) }))
      .sort((a, b) => b.sc.priority - a.sc.priority);

    for (const x of mainsSorted) {
      const t = _tempsCarte(x.card);
      if (used + t > budget && selected.length) break;
      selected.push(x.card);
      used += t;
    }

    const quickSorted = pileQuick
      .filter(c => V2.isEligibleTonight(c, ref, o.pullForward))
      .map(c => ({ card: c, sc: V2.priorityScore(c, ref) }))
      .sort((a, b) => b.sc.priority - a.sc.priority);

    const woven = needA1().weaveSession(selected.filter(c => V2.cardKind(c) !== "quick"), quickSorted.slice(0, 8).map(x => x.card));
    let final = woven.slice();
    let usedFinal = final.reduce((s, c) => s + _tempsCarte(c), 0);

    for (const x of quickSorted) {
      if (final.some(c => c.id === x.card.id)) continue;
      const t = _tempsCarte(x.card);
      if (usedFinal + t > budget) break;
      final.push(x.card);
      usedFinal += t;
    }

    return {
      cartes: final,
      tempsTotalPrev: usedFinal,
      countDevoir: devoirsForces.length,
      countDevoirForce: devoirsForces.length,
      countMain: final.filter(c => V2.cardKind(c) === "main").length,
      countQuick: final.filter(c => V2.cardKind(c) === "quick").length,
      countQuickWoven: 0,
      countQuickExtra: 0,
      reportees: [],
      marge: o.marge,
      overload,
      overloadDelta
    };
  };

  /** Session chapitre : toutes les cartes actives liées à un coursId, ordre priorité. */
  V2.buildChapterSession = function (exercices, coursId, sessionMinutes) {
    const ref = V2.todayISO();
    const list = (exercices || []).filter(c => {
      if (!V2.isActive(c)) return false;
      const ids = c.coursIds || (c.coursId ? [c.coursId] : []);
      return ids.includes(coursId);
    });
    list.sort((a, b) => V2.priorityScore(b, ref).priority - V2.priorityScore(a, ref).priority);
    return V2.buildSession(list, { sessionMinutes: sessionMinutes || 120, pullForward: true, selectedIds: list.map(c => c.id) });
  };

  window.AnkiAlgoV2 = V2;
})();
