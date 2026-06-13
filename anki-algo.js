/**
 * =========================================================================================
 * 🧠 anki-algo.js — Moteur Mathématique Mode Synchrotron (PC*)
 * =========================================================================================
 * Études : Roediger & Karpicke 2006 (testing effect), Cepeda 2008 (spacing),
 *          Rohrer & Taylor 2007 (interleaving), Pimsleur 1967, SM-2 (Wozniak).
 *
 * 👉 RÔLE : Calculs purs (aucun DOM, aucun Firebase).
 *   - UID format PH-AAA (3 lettres pures, distinct des cours PH-A1B)
 *   - Intervalles configurables par profil (ANGLAIS, COURS, EXO, FORMULE)
 *   - SM-2 adapté + pénalité Vitesse (PC*) + bonus rapidité
 *   - Planificateur intelligent : load balancing sur N jours (anti-pic)
 *   - Ordre de passage stable et prévisible
 *   - File de session paramétrable en durée
 * =========================================================================================
 */
(function () {
  const ALGO = {};
  ALGO.LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  ALGO.MIN_EASE = 1.3;
  ALGO.MAX_EASE = 3.0;
  ALGO.DEFAULT_EASE = 2.5;

  // ===== Profils d'intervalles (modifiables par l'utilisateur via window.D.settings.ankiProfiles) =====
  // Inspiré de Pimsleur (anglais : court) et SM-2 (cours/exo : long)
  ALGO.DEFAULT_PROFILES = {
    ANGLAIS:  { steps: [1, 2, 4, 8, 15, 30], ease: 2.3, label: "Anglais (court)" },
    FORMULE:  { steps: [1, 3, 7, 14, 30, 60], ease: 2.5, label: "Formule / Définition" },
    COURS:    { steps: [1, 3, 8, 21, 45, 90], ease: 2.5, label: "Cours (long)" },
    EXO:      { steps: [1, 2, 5, 12, 25, 50], ease: 2.4, label: "Exercice type" }
  };

  ALGO.getProfile = function (name) {
    const user = (window.D && window.D.settings && window.D.settings.ankiProfiles) || {};
    return user[name] || ALGO.DEFAULT_PROFILES[name] || ALGO.DEFAULT_PROFILES.COURS;
  };

  // ===== Date helpers =====
  ALGO.todayISO = function () {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  };
  ALGO.addDays = function (iso, n) {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + Math.round(n));
    return d.toISOString().split("T")[0];
  };
  ALGO.daysBetween = function (a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  };

  // ===== UID format PH-AAA =====
  ALGO.genExoUid = function (matierePrefix, existing) {
    const prefix = (matierePrefix || "XX").substring(0, 2).toUpperCase();
    const used = new Set(existing || []);
    for (let i = 0; i < 5000; i++) {
      let suffix = "";
      for (let j = 0; j < 3; j++) suffix += ALGO.LETTERS.charAt(Math.floor(Math.random() * 26));
      const code = prefix + "-" + suffix;
      if (!used.has(code)) return code;
    }
    return prefix + "-" + Date.now().toString(36).substring(0, 3).toUpperCase();
  };

  // ===== Cœur de calcul : intervalle + ease + vitesse =====
  // qualite : 0=blocage, 1=étourderie, 2=parfait
  ALGO.computeNextInterval = function (card, qualite, tempsReel) {
    const profileName = (card && card.profil) || "COURS";
    const profile = ALGO.getProfile(profileName);
    const steps = profile.steps;
    let ease = card.ease || profile.ease || ALGO.DEFAULT_EASE;
    let rep = card.repetitions || 0;
    let intervalle = card.intervalle || 0;
    const cible = card.tempsCible || 60;

    if (qualite === 0) {
      rep = 0; intervalle = 0;
      ease = Math.max(ALGO.MIN_EASE, ease - 0.2);
    } else {
      if (rep < steps.length) intervalle = steps[rep];
      else intervalle = Math.round(intervalle * ease);
      rep += 1;
      ease = qualite === 1
        ? Math.max(ALGO.MIN_EASE, ease - 0.15)
        : Math.min(ALGO.MAX_EASE, ease + 0.1);
    }

    // ===== Pénalité vitesse (spécifique PC*) =====
    let pen = 1;
    if (qualite > 0 && tempsReel && cible) {
      const r = tempsReel / cible;
      if (r > 2) pen = 0.5;
      else if (r > 1.5) pen = 0.7;
      else if (r < 0.7) pen = 1.15;
    }
    intervalle = Math.max(0, Math.round(intervalle * pen));

    return {
      intervalle,
      ease: parseFloat(ease.toFixed(2)),
      repetitions: rep,
      dateProchaineRevision: ALGO.addDays(ALGO.todayISO(), intervalle),
      penaliteVitesse: pen
    };
  };

  // ===== Sélection des cartes "dues" + ordre stable =====
  ALGO.getDueCards = function (cards, refIso) {
    if (!Array.isArray(cards)) return [];
    const ref = refIso || ALGO.todayISO();
    return cards
      .filter(c => c.statut === "actif" && (c.dateProchaineRevision || ref) <= ref)
      .sort((a, b) => {
        // 1) Priorité (1=urgence en premier)
        const pa = a.priorite || 2, pb = b.priorite || 2;
        if (pa !== pb) return pa - pb;
        // 2) En retard d'abord (date la plus ancienne)
        const da = a.dateProchaineRevision || ref;
        const db = b.dateProchaineRevision || ref;
        if (da !== db) return da.localeCompare(db);
        // 3) Stabilité par ID
        return (a.id || "").localeCompare(b.id || "");
      });
  };

  // ===== Entrelacement (Rohrer & Taylor) : alterne les matières =====
  ALGO.interleave = function (cards) {
    const buckets = {};
    cards.forEach(c => {
      const k = c.mat || "?";
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(c);
    });
    const out = [];
    let remaining = true;
    while (remaining) {
      remaining = false;
      Object.keys(buckets).sort().forEach(k => {
        if (buckets[k].length) {
          out.push(buckets[k].shift());
          remaining = true;
        }
      });
    }
    return out;
  };

  // ===== Construction de la session (longueur paramétrable) =====
  // sessionMinutes : durée souhaitée (peut être null → toutes les dues)
  // includeNew     : nombre max de nouvelles cartes à introduire
  // selectedIds    : si fourni, on limite à ces cartes (l'utilisateur a coché)
  ALGO.buildSession = function (exercices, opts) {
    const o = Object.assign({
      sessionMinutes: 60,
      includeNew: 5,
      selectedIds: null,
      interleave: true
    }, opts || {});

    let due = ALGO.getDueCards(exercices, ALGO.todayISO());
    let nouvelles = (exercices || [])
      .filter(c => c.statut === "attente")
      .sort((a, b) => {
        if ((a.epinglee?0:1) !== (b.epinglee?0:1)) return (a.epinglee?0:1) - (b.epinglee?0:1);
        return (a.priorite || 2) - (b.priorite || 2);
      });

    if (o.selectedIds && o.selectedIds.length) {
      const set = new Set(o.selectedIds);
      due = due.filter(c => set.has(c.id));
      nouvelles = nouvelles.filter(c => set.has(c.id));
    }

    nouvelles = nouvelles.slice(0, o.includeNew);

    // Construction respectant le budget temps
    const budget = (o.sessionMinutes || 60) * 60;
    const candidats = [...due, ...nouvelles];
    const queue = [];
    let used = 0;
    for (const c of candidats) {
      const t = c.tempsCible || 60;
      if (o.sessionMinutes && used + t > budget && queue.length > 0) break;
      queue.push(c);
      used += t;
    }

    const ordered = o.interleave ? ALGO.interleave(queue) : queue;
    return {
      cartes: ordered,
      tempsTotalPrev: used,
      countDue: due.length,
      countNew: nouvelles.length,
      reportees: candidats.filter(c => !ordered.includes(c))
    };
  };

  // ===== Load balancing : étale les pics sur N jours =====
  // Si un jour > seuil, on déplace les cartes excédentaires vers jours plus libres
  // (uniquement pour les cartes non-urgentes, priorité ≥ 2)
  ALGO.rebalanceFuture = function (exercices, opts) {
    const o = Object.assign({ days: 30, maxPerDay: 75 * 60, dryRun: false }, opts || {});
    const today = ALGO.todayISO();
    const horizon = ALGO.addDays(today, o.days);
    const buckets = {}; // date → [cards]
    const charge = {};

    (exercices || []).forEach(c => {
      if (c.statut !== "actif") return;
      const d = c.dateProchaineRevision || today;
      if (d < today || d > horizon) return;
      if (!buckets[d]) { buckets[d] = []; charge[d] = 0; }
      buckets[d].push(c);
      charge[d] += c.tempsCible || 60;
    });

    const moves = [];
    Object.keys(buckets).sort().forEach(d => {
      while (charge[d] > o.maxPerDay) {
        // Trouve la carte la moins prioritaire à déplacer
        const movable = buckets[d]
          .filter(c => (c.priorite || 2) >= 2)
          .sort((a, b) => (b.priorite || 2) - (a.priorite || 2));
        if (!movable.length) break;
        const card = movable[0];
        // Cherche un jour proche moins chargé
        let target = null;
        for (let off = 1; off <= 7; off++) {
          const cand = ALGO.addDays(d, off);
          if (cand > horizon) break;
          const ch = charge[cand] || 0;
          if (ch + (card.tempsCible || 60) <= o.maxPerDay) { target = cand; break; }
        }
        if (!target) target = ALGO.addDays(d, 1);
        moves.push({ id: card.id, from: d, to: target });
        if (!o.dryRun) card.dateProchaineRevision = target;
        // mise à jour buckets/charge
        buckets[d] = buckets[d].filter(c => c.id !== card.id);
        charge[d] -= (card.tempsCible || 60);
        if (!buckets[target]) { buckets[target] = []; charge[target] = 0; }
        buckets[target].push(card);
        charge[target] += (card.tempsCible || 60);
      }
    });
    return { moves, charge, buckets };
  };

  // ===== Plan prévisionnel détaillé : date → cartes ordonnées =====
  ALGO.forecastSchedule = function (exercices, days) {
    const N = days || 14;
    const today = ALGO.todayISO();
    const out = {};
    for (let i = 0; i < N; i++) out[ALGO.addDays(today, i)] = [];
    (exercices || []).forEach(c => {
      if (c.statut !== "actif") return;
      let d = c.dateProchaineRevision || today;
      if (d < today) d = today;
      if (out[d]) out[d].push(c);
    });
    Object.keys(out).forEach(d => {
      out[d].sort((a, b) => (a.priorite || 2) - (b.priorite || 2));
    });
    return out;
  };

  window.AnkiAlgo = ALGO;
})();
