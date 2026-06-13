/**
 * =========================================================================================
 * 🧠 anki-algo.js v3 — Moteur Mode Synchrotron (PC*)
 * =========================================================================================
 * Études : Roediger & Karpicke 2006, Cepeda 2008, Rohrer & Taylor 2007, Pimsleur 1967, SM-2.
 *
 * ✨ Nouveautés v3 :
 *   - Score d'urgence CONTINU (coefficient agrégé, tous poids réglables)
 *   - Décalage automatique du programme si session ratée
 *   - Load balancing bidirectionnel (j-1, j+1, j-2, j+2…)
 *   - Entrelacement matière + alternance long/court
 *   - Slider 1-10 (granulaire) interopérable avec boutons 3-niveaux
 *   - Découpage de cartes spéciales (DM/Colles) en morceaux
 *   - Journal des décisions pour onglet Diagnostic
 * =========================================================================================
 */
(function () {
  const ALGO = {};
  ALGO.LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  ALGO.DIGITS  = "0123456789";
  ALGO.MIN_EASE = 1.3;
  ALGO.MAX_EASE = 3.0;
  ALGO.DEFAULT_EASE = 2.5;

  // ===== Profils d'intervalles (jours) =====
  ALGO.DEFAULT_PROFILES = {
    ANGLAIS:  { steps: [1, 2, 4, 8, 15, 30], ease: 2.3, label: "Anglais (court)" },
    FORMULE:  { steps: [1, 3, 7, 14, 30, 60], ease: 2.5, label: "Formule / Définition" },
    COURS:    { steps: [1, 3, 8, 21, 45, 90], ease: 2.5, label: "Cours (long)" },
    EXO:      { steps: [1, 2, 5, 12, 25, 50], ease: 2.4, label: "Exercice type" }
  };

  // ===== Coefficients du score d'urgence (modifiables dans Réglages) =====
  ALGO.DEFAULT_COEFS = {
    W_retard:    3.0,  // poids par jour de retard
    W_proche:    2.0,  // pic d'urgence à l'approche
    TAU:         3.0,  // constante de temps de la montée d'urgence (jours)
    W_priorite:  2.0,  // poids de la priorité user (1=urgent → +2, 3=faible → +0)
    W_nouveau:   1.0,  // bonus aux nouvelles cartes
    W_ease:      0.8,  // poids de la difficulté (faible ease = monte)
    W_long:      0.5   // poids pénalisant pour éviter 2 longues à la suite (alternance)
  };

  ALGO.getProfile = function (name) {
    const user = (window.D && window.D.settings && window.D.settings.ankiProfiles) || {};
    return user[name] || ALGO.DEFAULT_PROFILES[name] || ALGO.DEFAULT_PROFILES.COURS;
  };
  ALGO.getCoefs = function () {
    const user = (window.D && window.D.settings && window.D.settings.ankiCoefs) || {};
    return Object.assign({}, ALGO.DEFAULT_COEFS, user);
  };

  // ===== Date helpers =====
  ALGO.todayISO = function () {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.toISOString().split("T")[0];
  };
  ALGO.addDays = function (iso, n) {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(0,0,0,0); d.setDate(d.getDate() + Math.round(n));
    return d.toISOString().split("T")[0];
  };
  ALGO.daysBetween = function (a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  };

  // ===== UID format PH-XXX avec mélange alphanum (vraiment aléatoire) =====
  ALGO.genExoUid = function (matierePrefix, existing) {
    const prefix = (matierePrefix || "XX").substring(0, 2).toUpperCase();
    const used = new Set(existing || []);
    const ALPHANUM = ALGO.LETTERS + ALGO.DIGITS;
    for (let i = 0; i < 5000; i++) {
      let suffix = "";
      // Au moins 1 lettre + 1 chiffre pour distinguer visuellement
      for (let j = 0; j < 3; j++) suffix += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
      const code = prefix + "-" + suffix;
      if (!used.has(code) && /[A-Z]/.test(suffix) && /[0-9]/.test(suffix)) return code;
    }
    return prefix + "-" + Date.now().toString(36).slice(-3).toUpperCase();
  };

  // ===== Conversion temps =====
  ALGO.secToMin = s => Math.round((s || 0) / 60 * 10) / 10;
  ALGO.minToSec = m => Math.round((m || 0) * 60);
  ALGO.fmtDur = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const min = Math.floor(sec / 60);
    if (sec < 60) return sec + "s";
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    const r = min % 60;
    return r ? h + "h" + String(r).padStart(2, "0") : h + "h";
  };

  // ===== Cœur : intervalle avec qualité GRANULAIRE (0-10) =====
  // qScore (0-10) : 0 = catastrophe, 10 = parfait & rapide
  ALGO.computeNextInterval = function (card, qScore, tempsReel) {
    const profileName = (card && card.profil) || "COURS";
    const profile = ALGO.getProfile(profileName);
    const steps = profile.steps;
    let ease = card.ease || profile.ease || ALGO.DEFAULT_EASE;
    let rep = card.repetitions || 0;
    let intervalle = card.intervalle || 0;
    const cible = card.tempsCible || 60;
    qScore = Math.max(0, Math.min(10, qScore));

    // Mapping continu : 0-3 reset · 4-6 doux · 7-8 normal · 9-10 bonus
    let qFactor;
    if (qScore <= 3) {
      // Reset progressif (0=reset total, 3=presque OK)
      rep = Math.max(0, rep - 2 + Math.floor(qScore / 1.5));
      intervalle = 0;
      ease = Math.max(ALGO.MIN_EASE, ease - (0.25 - qScore * 0.05));
      qFactor = 0;
    } else {
      // Succès gradué
      if (rep < steps.length) intervalle = steps[rep];
      else intervalle = Math.round(intervalle * ease);
      rep += 1;
      // qScore 4 → 0.45 · 7 → 1.0 · 10 → 1.4
      qFactor = 0.45 + (qScore - 4) * (0.95 / 6);
      if (qScore >= 9) qFactor = 1.2 + (qScore - 9) * 0.2;
      // Ajustement ease
      const easeDelta = (qScore - 7) * 0.05; // <7 baisse, >7 monte
      ease = Math.max(ALGO.MIN_EASE, Math.min(ALGO.MAX_EASE, ease + easeDelta));
    }
    intervalle = Math.round(intervalle * (qFactor || 0));

    // Pénalité vitesse (PC*)
    let pen = 1;
    if (qScore > 3 && tempsReel && cible) {
      const r = tempsReel / cible;
      if (r > 2) pen = 0.5;
      else if (r > 1.5) pen = 0.7;
      else if (r < 0.7) pen = 1.15;
    }
    intervalle = Math.max(0, Math.round(intervalle * pen));

    return {
      intervalle, ease: parseFloat(ease.toFixed(2)),
      repetitions: rep,
      dateProchaineRevision: ALGO.addDays(ALGO.todayISO(), intervalle),
      qFactor: parseFloat((qFactor || 0).toFixed(2)),
      penaliteVitesse: pen,
      qScore
    };
  };

  // ===== Slider 1-10 ↔ bouton 3 niveaux =====
  ALGO.qButtonToScore = b => b === 0 ? 2 : b === 1 ? 6 : 9; // bad, mid, good
  ALGO.qScoreToButton = s => s <= 3 ? 0 : s <= 7 ? 1 : 2;

  // ===== SCORE D'URGENCE CONTINU =====
  // Plus le score est haut, plus la carte doit être révisée maintenant
  ALGO.urgenceScore = function (card, refIso) {
    if (!card) return 0;
    const ref = refIso || ALGO.todayISO();
    const C = ALGO.getCoefs();
    const due = card.dateProchaineRevision || ref;
    const delta = ALGO.daysBetween(due, ref); // >0 = en retard, <0 = futur
    const retard = Math.max(0, delta);
    // Composante "proche" : décroissance exponentielle douce vers le futur
    const proche = delta < 0 ? Math.exp(delta / Math.max(1, C.TAU)) : 1;
    const priFactor = (card.priorite || 2) === 1 ? 2 : (card.priorite || 2) === 2 ? 1 : 0.3;
    const ease = card.ease || 2.5;
    const easeFactor = Math.max(0, (3 - ease)); // ease bas → monte
    const nouveau = card.statut === 'attente' ? 1 : 0;

    const score =
      C.W_retard   * retard +
      C.W_proche   * proche +
      C.W_priorite * priFactor +
      C.W_nouveau  * nouveau +
      C.W_ease     * easeFactor;

    return {
      total: parseFloat(score.toFixed(2)),
      breakdown: {
        retard: parseFloat((C.W_retard * retard).toFixed(2)),
        proche: parseFloat((C.W_proche * proche).toFixed(2)),
        priorite: parseFloat((C.W_priorite * priFactor).toFixed(2)),
        nouveau: parseFloat((C.W_nouveau * nouveau).toFixed(2)),
        ease: parseFloat((C.W_ease * easeFactor).toFixed(2))
      },
      raw: { delta, retard, proche, priFactor, easeFactor, nouveau, ease }
    };
  };

  // ===== Cartes à proposer aujourd'hui (TOUTES, triées par urgence — le coef gère tout) =====
  // ⚠️ Exclut les DM terminés (statut='fini')
  ALGO.getCandidates = function (exercices, refIso) {
    const ref = refIso || ALGO.todayISO();
    if (!Array.isArray(exercices)) return [];
    return exercices
      .filter(c => (c.statut === 'actif' || c.statut === 'attente') && c.statut !== 'fini')
      .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
      .sort((a, b) => b.score.total - a.score.total);
  };

  // ===== Entrelacement matière + alternance long/court =====
  ALGO.smartOrder = function (cards) {
    if (!cards || !cards.length) return [];
    // 1) Bucket par matière
    const buckets = {};
    cards.forEach(c => {
      const k = c.mat || '?';
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(c);
    });
    // Trier chaque bucket par durée alternée (long, court, long…)
    Object.keys(buckets).forEach(k => {
      const arr = buckets[k].slice().sort((a, b) => (b.tempsCible || 0) - (a.tempsCible || 0));
      const out = [];
      let head = 0, tail = arr.length - 1, takeHead = true;
      while (head <= tail) {
        out.push(takeHead ? arr[head++] : arr[tail--]);
        takeHead = !takeHead;
      }
      buckets[k] = out;
    });
    // 2) Round-robin par matière en évitant 2 mêmes matières à la suite + alternance long/court
    const out = [];
    const matKeys = Object.keys(buckets).sort();
    let lastDur = 0;
    let lastMat = null;
    while (matKeys.some(k => buckets[k].length)) {
      let chosen = null, chosenKey = null;
      // 1ère passe : préfère une matière différente de la dernière
      for (const k of matKeys) {
        if (!buckets[k].length) continue;
        if (k === lastMat && matKeys.filter(m => buckets[m].length).length > 1) continue;
        const cand = buckets[k][0];
        if (chosen === null) { chosen = cand; chosenKey = k; continue; }
        const cantDur = cand.tempsCible || 0;
        const chosenDur = chosen.tempsCible || 0;
        if (lastDur > 0) {
          if ((lastDur > 300 && cantDur < chosenDur) || (lastDur < 120 && cantDur > chosenDur)) {
            chosen = cand; chosenKey = k;
          }
        }
      }
      // Fallback : si rien (toutes filtrées) → on prend même matière
      if (!chosen) {
        for (const k of matKeys) {
          if (buckets[k].length) { chosen = buckets[k][0]; chosenKey = k; break; }
        }
      }
      out.push(chosen);
      buckets[chosenKey].shift();
      lastDur = chosen.tempsCible || 0;
      lastMat = chosenKey;
    }
    return out;
  };

  // ===== Build session — VERSION URGENCE FIRST =====
  // Stratégie :
  //  1) Tri par urgence ↓ (file naturelle)
  //  2) On prend tant que ça rentre dans (budget × 0.92) → marge de sécurité
  //  3) Réorganisation intelligente : on garde le 1er urgent (au cas où l'utilisateur s'arrête)
  //     puis on intercale long/court + on insère des cartes ANGLAIS courtes pour combler les trous
  //  4) Si selectedIds : on respecte cette restriction
  ALGO.buildSession = function (exercices, opts) {
    const o = Object.assign({
      sessionMinutes: 60,
      includeNew: 5,
      selectedIds: null,
      marge: 0.92,        // 8% de marge
      manualOrder: null
    }, opts || {});

    const ref = ALGO.todayISO();
    const all = ALGO.getCandidates(exercices, ref);
    let pool = all.map(x => x.card);

    if (o.selectedIds && o.selectedIds.length) {
      const set = new Set(o.selectedIds);
      pool = pool.filter(c => set.has(c.id));
    }

    // Limite des nouvelles (statut='attente')
    let newCount = 0;
    pool = pool.filter(c => {
      if (c.statut === 'attente') {
        if (newCount >= o.includeNew) return false;
        newCount++;
      }
      return true;
    });

    if (o.manualOrder && o.manualOrder.length) {
      const map = {};
      pool.forEach(c => { map[c.id] = c; });
      const ordered = o.manualOrder.map(id => map[id]).filter(Boolean);
      // Limite budget
      const budget = (o.sessionMinutes || 60) * 60 * o.marge;
      const result = []; let used = 0;
      for (const c of ordered) {
        const t = c.tempsCible || 60;
        if (used + t > budget && result.length) break;
        result.push(c); used += t;
      }
      return {
        cartes: result, tempsTotalPrev: used,
        countDue: ordered.filter(c=>c.statut==='actif').length,
        countNew: ordered.filter(c=>c.statut==='attente').length,
        reportees: ordered.filter(c => !result.includes(c))
      };
    }

    // ===== Phase 1 : sélection par urgence + budget =====
    // Pour les DM : on compte le temps par session (pas la durée totale)
    const budget = (o.sessionMinutes || 60) * 60 * o.marge;
    const selected = []; let used = 0;
    for (const c of pool) {
      const t = c.type === 'devoir'
        ? Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)) * 60)
        : (c.tempsCible || 60);
      if (used + t > budget && selected.length) continue;
      selected.push(c); used += t;
    }

    // ===== Phase 2 : remplissage anglais (cartes courtes ≤ 60s) — MAX 5 pour ne pas envahir =====
    const reste = budget - used;
    const maxAnglais = (window.D && window.D.settings && window.D.settings.ankiMaxAnglaisFill) || 5;
    if (reste > 30) {
      const anglais = (exercices || [])
        .filter(c => !selected.includes(c)
          && (c.profil === 'ANGLAIS' || (c.tempsCible || 60) <= 60)
          && (c.statut === 'actif' || c.statut === 'attente'))
        .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
        .sort((a, b) => b.score.total - a.score.total)
        .map(x => x.card)
        .slice(0, maxAnglais);
      for (const c of anglais) {
        const t = c.tempsCible || 60;
        if (used + t > budget) break;
        selected.push(c); used += t;
      }
    }

    // ===== Phase 3 : réorganisation long/court avec préservation des urgents =====
    const arranged = ALGO.arrangeUrgentFirst(selected);

    return {
      cartes: arranged,
      tempsTotalPrev: used,
      countDue: arranged.filter(c => c.statut === 'actif').length,
      countNew: arranged.filter(c => c.statut === 'attente').length,
      reportees: pool.filter(c => !selected.includes(c))
    };
  };

  // ===== Arrangement : intercalation longues/courtes en PRÉSERVANT l'ordre d'urgence =====
  ALGO.arrangeUrgentFirst = function (cards) {
    if (!cards || cards.length <= 1) return cards;
    // Sépare courtes (≤90s) et longues (>90s) — l'ordre d'urgence est déjà dans 'cards'
    const courtes = cards.filter(c => (c.tempsCible || 60) <= 90);
    const longues = cards.filter(c => (c.tempsCible || 60) > 90);
    if (!courtes.length) return longues;
    if (!longues.length) return courtes;
    // Intercalation : long → court → long → court...
    // L'ordre d'urgence est respecté car les listes sont déjà triées dans 'cards'
    const out = [];
    let li = 0, ci = 0;
    while (li < longues.length || ci < courtes.length) {
      if (li < longues.length) out.push(longues[li++]);
      if (ci < courtes.length) out.push(courtes[ci++]);
    }
    return out;
  };

  // Alias rétrocompat (anki-quick.js et code legacy)
  ALGO.interleave = function (cards) { return ALGO.smartOrder(cards); };

  // ===== Load balancing BIDIRECTIONNEL =====
  // Si j+5 dépasse maxPerDay → cherche j+4, j+6, j+3, j+7… (étoile)
  ALGO.rebalanceFuture = function (exercices, opts) {
    const o = Object.assign({ days: 30, maxPerDay: 75 * 60, dryRun: false }, opts || {});
    const today = ALGO.todayISO();
    const buckets = {}, charge = {};
    for (let i = 0; i <= o.days; i++) {
      const d = ALGO.addDays(today, i); buckets[d] = []; charge[d] = 0;
    }
    (exercices || []).forEach(c => {
      if (c.statut !== 'actif') return;
      const d = c.dateProchaineRevision || today;
      if (!buckets[d]) return;
      buckets[d].push(c);
      charge[d] += c.tempsCible || 60;
    });
    const moves = [];
    const dates = Object.keys(buckets).sort();
    for (const d of dates) {
      let safety = 0;
      while (charge[d] > o.maxPerDay && safety++ < 50) {
        const movable = buckets[d]
          .filter(c => (c.priorite || 2) >= 2)
          .sort((a, b) => (b.priorite || 2) - (a.priorite || 2));
        if (!movable.length) break;
        const card = movable[0];
        let target = null;
        // Étoile : alterne +1, -1, +2, -2 …
        for (let off = 1; off <= 7 && !target; off++) {
          for (const sign of [1, -1]) {
            const cand = ALGO.addDays(d, sign * off);
            if (cand < today) continue;
            if (!buckets[cand]) continue;
            if ((charge[cand] || 0) + (card.tempsCible || 60) <= o.maxPerDay) {
              target = cand; break;
            }
          }
        }
        if (!target) target = ALGO.addDays(d, 1);
        moves.push({ id: card.id, from: d, to: target, dur: card.tempsCible || 60 });
        if (!o.dryRun) card.dateProchaineRevision = target;
        buckets[d] = buckets[d].filter(c => c.id !== card.id);
        charge[d] -= (card.tempsCible || 60);
        if (!buckets[target]) { buckets[target] = []; charge[target] = 0; }
        buckets[target].push(card);
        charge[target] += card.tempsCible || 60;
      }
    }
    return { moves, charge, buckets };
  };

  // ===== Décalage automatique : toute carte dont dueDate < today est replacée à today =====
  ALGO.shiftProgramIfMissed = function (exercices) {
    const today = ALGO.todayISO();
    const skipped = (exercices || []).filter(c =>
      c.statut === 'actif' &&
      c.dateProchaineRevision &&
      c.dateProchaineRevision < today
    );
    if (!skipped.length) return { shifted: 0 };
    skipped.forEach(c => {
      c._shiftedFrom = c.dateProchaineRevision;
      c.dateProchaineRevision = today;
      c._shiftedFromMiss = true;
    });
    return { shifted: skipped.length };
  };

  // ===== Schedule détaillé (avec projection multi-révisions) =====
  // Pour les cartes normales : projette les N prochaines révisions (simul. qScore=7)
  // Pour les DM (type='devoir') : projette les morceaux RESTANTS, 1 par jour, avec tempsParSession
  ALGO.forecastSchedule = function (exercices, days) {
    const N = days || 14;
    const today = ALGO.todayISO();
    const out = {};
    for (let i = 0; i < N; i++) out[ALGO.addDays(today, i)] = [];
    (exercices || []).forEach(c => {
      if (c.statut !== 'actif') return;

      // --- DM : 1 occurrence par session restante ---
      if (c.type === 'devoir') {
        const restants = (c._morceauxTotal || 1) - (c._morceauxFaits || 0);
        const tempsParSession = Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)) * 60);
        let date = c.dateProchaineRevision || today;
        if (date < today) date = today;
        for (let i = 0; i < restants; i++) {
          if (out[date]) {
            out[date].push({
              ...c,
              tempsCible: tempsParSession,
              _projDate: date,
              _projSessionIdx: (c._morceauxFaits || 0) + i + 1,
              _projSessionTotal: c._morceauxTotal || 1
            });
          }
          date = ALGO.addDays(date, 1);
          if (date > ALGO.addDays(today, N - 1)) break;
        }
        return;
      }

      // --- Carte normale : simulation des révisions ---
      let sim = {
        intervalle: c.intervalle || 0,
        ease: c.ease || 2.5,
        repetitions: c.repetitions || 0,
        tempsCible: c.tempsCible || 60,
        profil: c.profil || 'COURS'
      };
      let date = c.dateProchaineRevision || today;
      if (date < today) date = today;
      let safety = 0;
      while (date <= ALGO.addDays(today, N - 1) && safety++ < 20) {
        if (out[date]) {
          out[date].push({
            ...c,
            _projDate: date,
            _projRep: sim.repetitions,
            _projEase: parseFloat(sim.ease.toFixed(2))
          });
        }
        const nxt = ALGO.computeNextInterval(sim, 7, sim.tempsCible);
        sim.intervalle = nxt.intervalle;
        sim.ease = nxt.ease;
        sim.repetitions = nxt.repetitions;
        if (!nxt.intervalle || nxt.intervalle < 1) break;
        date = nxt.dateProchaineRevision;
      }
    });
    Object.keys(out).forEach(d => {
      out[d] = ALGO.smartOrder(out[d]);
    });
    return out;
  };

  // ===== Découpe d'une carte spéciale (DM/Colle/Exo) en morceaux =====
  ALGO.splitDevoir = function (card, nMorceaux) {
    if (!card || !nMorceaux || nMorceaux < 2) return [card];
    const piece = Math.ceil((card.tempsCible || 60) / nMorceaux);
    return Array.from({ length: nMorceaux }, (_, i) => ({
      ...card,
      id: card.id + '-' + (i + 1),
      titre: (card.titre || card.question) + ' (' + (i + 1) + '/' + nMorceaux + ')',
      tempsCible: piece,
      _morceauOf: card.id,
      _morceauIndex: i + 1,
      _morceauTotal: nMorceaux
    }));
  };

  // ===== Journal des décisions (onglet Diagnostic) =====
  ALGO.LOG = [];
  ALGO.log = function (action, details) {
    ALGO.LOG.unshift({ at: new Date().toISOString(), action, details });
    if (ALGO.LOG.length > 200) ALGO.LOG.length = 200;
  };

  window.AnkiAlgo = ALGO;
})();
