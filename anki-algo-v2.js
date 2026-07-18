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

  /** Fenêtres ★ : [jours avant ouverture, largeur fenêtre en jours] — base cycle 2 ans. */
  V2.STAR_WINDOWS = {
    1: { openAfter: 120, width: 90 },
    2: { openAfter: 75, width: 50 },
    3: { openAfter: 50, width: 35 },
    4: { openAfter: 30, width: 25 },
    5: { openAfter: 20, width: 28 }
  };

  V2.scaledWindow = function (imp) {
    const s = V2.horizonScale();
    const w = V2.STAR_WINDOWS[imp] || V2.STAR_WINDOWS[3];
    return {
      openAfter: Math.max(1, Math.round(w.openAfter * s)),
      width: Math.max(3, Math.round(w.width * s))
    };
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
