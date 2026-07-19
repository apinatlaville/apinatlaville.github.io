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
  V2.proposerTempsDevoir = function (opts) { return needA1().proposerTempsDevoir(opts); };
  V2.planifierDecoupeDevoir = function (a, b, c, d) { return needA1().planifierDecoupeDevoir(a, b, c, d); };
  V2.applyDecoupeDevoir = function (card, plan, meta) { return needA1().applyDecoupeDevoir(card, plan, meta); };
  V2.makeDevoirChunk = function (parent, idx) { return needA1().makeDevoirChunk(parent, idx); };
  V2.chunksDevoirTonight = function (card, ref, budget, opts) { return needA1().chunksDevoirTonight(card, ref, budget, opts); };
  V2.resolveDevoirParent = function (D, card) { return needA1().resolveDevoirParent(D, card); };
  V2.shiftProgramIfMissedDaily = function (D) { return needA1().shiftProgramIfMissedDaily(D); };
  V2.migrateData = function (D) { return needA1().migrateData(D); };
  V2.interleaveMatieres = function (cards) { return needA1().interleaveMatieres(cards); };
  V2.buildQuickSession = function (cards) { return needA1().buildQuickSession(cards); };
  V2.weaveSession = function (main, quick) { return needA1().weaveSession(main, quick); };
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
      // Échec / hors mature : effacer les fenêtres pour que dateProchaineRevision (SM-2) prime
      base._v2Phase = phase;
      base._v2WindowOpen = null;
      base._v2WindowClose = null;
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
        // DM : intercaler autant de bouts que le budget le permet (1er bout forcé comme Phase 0)
        if (V2.cardKind(c) === "devoir") {
          const chunks = V2.chunksDevoirTonight(c, ref, Math.max(0, budget - used), {
            forced: true,
            maxChunks: 8
          });
          const list = chunks.length
            ? chunks
            : [V2.makeDevoirChunk(c, c._morceauxFaits || 0)].filter(Boolean);
          for (let i = 0; i < list.length; i++) {
            const ch = list[i];
            const t = _tempsCarte(ch);
            if (i > 0 && used + t > budget) break;
            result.push(ch);
            used += t;
          }
          continue;
        }
        const t = _tempsCarte(c);
        if (used + t > budget && result.length) break;
        result.push(c); used += t;
      }
      return {
        cartes: result, tempsTotalPrev: used,
        countDevoir: result.filter(c => V2.cardKind(c) === "devoir").length,
        countMain: result.filter(c => V2.cardKind(c) === "main").length,
        countQuick: result.filter(c => V2.cardKind(c) === "quick").length,
        reportees: ordered.filter(c => !result.some(r => (r._devoirChunkOf || r.id) === c.id)),
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
    const devoirsLatents = devoirsScored.filter(x => x.score.total < seuilDevoir);

    // Phase 0a : 1er bout de chaque DM forcé (peut surcharger le budget)
    const forcedFirst = [];
    let used = 0;
    devoirsForces.forEach(x => {
      const chunks = V2.chunksDevoirTonight(x.card, ref, Math.max(0, budget - used), { forced: true, maxChunks: 1 });
      chunks.forEach(ch => { forcedFirst.push(ch); used += _tempsCarte(ch); });
    });
    const overload = used > budget;
    const overloadDelta = overload ? used - budget : 0;

    const mainsEligible = pileMain.filter(c => V2.isEligibleTonight(c, ref, o.pullForward));
    const mainsSorted = mainsEligible
      .map(c => ({ card: c, sc: V2.priorityScore(c, ref) }))
      .sort((a, b) => b.sc.priority - a.sc.priority);

    const mainsTaken = [];
    for (const x of mainsSorted) {
      const t = _tempsCarte(x.card);
      if (used + t > budget && (forcedFirst.length || mainsTaken.length)) break;
      mainsTaken.push(x.card);
      used += t;
    }

    // Phase 0b : bouts supplémentaires des DM forcés (rattrapage calendaire) — intercalés après les X-
    const forcedExtra = [];
    devoirsForces.forEach(x => {
      const allWanted = V2.chunksDevoirTonight(x.card, ref, 1e9, { forced: true });
      const alreadyIds = new Set(forcedFirst.filter(ch => ch._devoirChunkOf === x.card.id).map(ch => ch.id));
      for (let i = 0; i < allWanted.length; i++) {
        const ch = allWanted[i];
        if (alreadyIds.has(ch.id)) continue;
        const t = _tempsCarte(ch);
        if (used + t > budget) break;
        forcedExtra.push(ch);
        used += t;
      }
    });

    // W- opportunistes (latents) : autant de bouts que le budget permet
    const latentsTaken = [];
    for (const x of devoirsLatents) {
      const chunks = V2.chunksDevoirTonight(x.card, ref, Math.max(0, budget - used), { forced: false });
      chunks.forEach(ch => {
        const t = _tempsCarte(ch);
        if (used + t > budget) return;
        latentsTaken.push(ch);
        used += t;
      });
    }

    const quickSorted = pileQuick
      .filter(c => V2.isEligibleTonight(c, ref, o.pullForward))
      .map(c => ({ card: c, sc: V2.priorityScore(c, ref) }))
      .sort((a, b) => b.sc.priority - a.sc.priority);

    // Y- tissées : respectent le budget + plafond ankiMaxAnglaisFill
    const maxQuick = (window.D && window.D.settings && window.D.settings.ankiMaxAnglaisFill != null)
      ? Math.max(0, parseInt(window.D.settings.ankiMaxAnglaisFill, 10) || 0)
      : 5;
    const quicksWoven = [];
    for (const x of quickSorted) {
      if (quicksWoven.length >= maxQuick) break;
      const t = _tempsCarte(x.card);
      if (used + t > budget) continue;
      quicksWoven.push(x.card);
      used += t;
    }

    // Intercalation : 1er bout forcé → X- → bouts extra DM → latents, puis tissage Y-
    const longPool = forcedFirst.concat(mainsTaken).concat(forcedExtra).concat(latentsTaken);
    const woven = needA1().weaveSession(longPool, quicksWoven);
    let final = woven.slice();
    let usedFinal = final.reduce((s, c) => s + _tempsCarte(c), 0);

    let quicksExtra = 0;
    for (const x of quickSorted) {
      if (quicksWoven.length + quicksExtra >= maxQuick) break;
      if (final.some(c => c.id === x.card.id)) continue;
      const t = _tempsCarte(x.card);
      if (usedFinal + t > budget) break;
      final.push(x.card);
      usedFinal += t;
      quicksExtra++;
    }

    const devoirChunks = final.filter(c => V2.cardKind(c) === "devoir");
    const uniqueDevoirParents = new Set(devoirChunks.map(c => c._devoirChunkOf || c.id));

    return {
      cartes: final,
      tempsTotalPrev: usedFinal,
      countDevoir: devoirChunks.length,
      countDevoirForce: forcedFirst.length + forcedExtra.length,
      countDevoirLatent: latentsTaken.length,
      countDevoirParents: uniqueDevoirParents.size,
      countMain: mainsTaken.length,
      countQuick: quicksWoven.length + quicksExtra,
      countQuickWoven: quicksWoven.length,
      countQuickExtra: quicksExtra,
      reportees: [],
      marge: o.marge,
      overload,
      overloadDelta
    };
  };

  /**
   * Projection après une note donnée (qScore 0–10).
   * Utilisé par l'onglet Prévisions « Selon la note ».
   */
  V2.projectAfterScore = function (card, qScore, tempsReel) {
    if (!card) return null;
    const tps = tempsReel != null ? tempsReel : (card.tempsCible || 60);
    const out = V2.computeNextInterval(card, qScore, tps);
    const today = V2.todayISO();
    const next = out.dateProchaineRevision || today;
    return {
      qScore: Math.max(0, Math.min(10, qScore)),
      intervalle: out.intervalle,
      ease: out.ease,
      repetitions: out.repetitions,
      dateProchaineRevision: next,
      daysUntil: V2.daysBetween(today, next),
      windowOpen: out._v2WindowOpen || null,
      windowClose: out._v2WindowClose || null,
      phase: out._v2Phase || V2.getPhase(Object.assign({}, card, out))
    };
  };

  /**
   * Calendrier de charge sur N jours — simulation V2 (fenêtres ★ incluses).
   * Hypothèse de révision : qScore 7 (réussi moyen), durée = tempsCible.
   */
  V2.forecastSchedule = function (exercices, days) {
    const N = days || 14;
    const today = V2.todayISO();
    const horizonEnd = V2.addDays(today, N - 1);
    const out = {};
    for (let i = 0; i < N; i++) out[V2.addDays(today, i)] = [];

    (exercices || []).forEach(function (c) {
      if (!c || c.statut !== "actif") return;

      if (c.type === "devoir" || V2.cardKind(c) === "devoir") {
        const restants = Math.max(0, (c._morceauxTotal || 1) - (c._morceauxFaits || 0));
        // Plus de temps restant estimé → rien à projeter
        if (c._tempsRestantMin != null && c._tempsRestantMin <= 0) return;
        if (!restants) return;
        const tempsParSession = V2.cardDuration(c);
        let date = c.dateProchaineRevision || today;
        if (date < today) date = today;
        for (let i = 0; i < restants; i++) {
          if (out[date]) {
            out[date].push(Object.assign({}, c, {
              tempsCible: tempsParSession,
              _projDate: date,
              _projSessionIdx: (c._morceauxFaits || 0) + i + 1,
              _projSessionTotal: c._morceauxTotal || 1,
              _projKind: "devoir"
            }));
          }
          date = V2.addDays(date, 1);
          if (date > horizonEnd) break;
        }
        return;
      }

      let sim = {
        id: c.id,
        type: c.type,
        profil: c.profil || "COURS",
        importance: V2.getImportance(c),
        intervalle: c.intervalle || 0,
        ease: c.ease || 2.5,
        repetitions: c.repetitions || 0,
        tempsCible: c.tempsCible || 60,
        dateProchaineRevision: c.dateProchaineRevision,
        _v2WindowOpen: c._v2WindowOpen || null,
        _v2WindowClose: c._v2WindowClose || null,
        _blocageActif: c._blocageActif,
        _blocageRevCount: c._blocageRevCount
      };
      let date = sim.dateProchaineRevision || today;
      // Fenêtre mature : première occurrence = ouverture (ou aujourd'hui si déjà ouverte / overdue)
      const ws0 = V2.windowState(sim, today);
      if (V2.getPhase(sim) === "mature" && sim._v2WindowOpen) {
        if (ws0 === "later" || ws0 === "soon") date = sim._v2WindowOpen;
        else if (ws0 === "overdue" || ws0 === "active") date = today;
      }
      if (date < today) date = today;

      let safety = 0;
      while (date <= horizonEnd && safety++ < 24) {
        if (out[date]) {
          out[date].push(Object.assign({}, c, {
            _projDate: date,
            _projRep: sim.repetitions,
            _projEase: parseFloat((sim.ease || 2.5).toFixed(2)),
            _projWindowOpen: sim._v2WindowOpen || null,
            _projWindowClose: sim._v2WindowClose || null,
            _projPhase: V2.getPhase(sim),
            _projKind: V2.cardKind(c)
          }));
        }
        // computeNextInterval ancre toujours sur « aujourd'hui » réel — pour la simu
        // calendaire on avance depuis la date projetée (sinon doublons / dates qui reculent).
        const nxt = V2.computeNextInterval(sim, 7, sim.tempsCible || 60);
        const reviewedOn = date;
        sim.intervalle = nxt.intervalle;
        sim.ease = nxt.ease;
        sim.repetitions = nxt.repetitions;
        sim._blocageActif = nxt._blocageActif;
        sim._blocageRevCount = nxt._blocageRevCount;

        let nextDate;
        if (!nxt.intervalle || nxt.intervalle < 1) {
          nextDate = V2.addDays(reviewedOn, 1);
          sim._v2WindowOpen = null;
          sim._v2WindowClose = null;
        } else {
          const phaseAfter = V2.getPhase(Object.assign({}, sim, nxt));
          if (phaseAfter === "mature" && nxt.qScore > 3) {
            const w = V2.scaledWindow(V2.getImportance(sim));
            const openAfter = Math.max(w.openAfter, Math.min(nxt.intervalle, w.openAfter + 5));
            sim._v2WindowOpen = V2.addDays(reviewedOn, openAfter);
            sim._v2WindowClose = V2.addDays(reviewedOn, openAfter + w.width);
            nextDate = sim._v2WindowOpen;
          } else {
            sim._v2WindowOpen = null;
            sim._v2WindowClose = null;
            nextDate = V2.addDays(reviewedOn, nxt.intervalle);
          }
        }
        sim.dateProchaineRevision = nextDate;
        if (!nextDate || nextDate <= reviewedOn) break;
        date = nextDate;
      }
    });

    Object.keys(out).forEach(function (d) {
      out[d] = V2.smartOrder(out[d]);
    });
    return out;
  };

  /** Session chapitre : toutes les cartes actives liées à un coursId (ordre priorité, sans filtre « ce soir »). */
  V2.buildChapterSession = function (exercices, coursId, sessionMinutes) {
    const ref = V2.todayISO();
    const list = (exercices || []).filter(c => {
      if (!V2.isActive(c)) return false;
      const ids = c.coursIds || (c.coursId ? [c.coursId] : []);
      return ids.includes(coursId);
    });
    list.sort((a, b) => V2.priorityScore(b, ref).priority - V2.priorityScore(a, ref).priority);
    // manualOrder : remplit le budget dans l'ordre donné, sans isEligibleTonight
    return V2.buildSession(list, {
      sessionMinutes: sessionMinutes || 120,
      pullForward: true,
      manualOrder: list.map(c => c.id)
    });
  };

  window.AnkiAlgoV2 = V2;
})();
