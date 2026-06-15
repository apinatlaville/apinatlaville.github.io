/**
 * =========================================================================================
 * 🧠 anki-algo.js v4 — Moteur Mode Synchrotron (PC*) — Refonte Réservoir / I_R / Ease élastique
 * =========================================================================================
 * Études : Roediger & Karpicke 2006, Cepeda 2008, Rohrer & Taylor 2007, Pimsleur 1967, SM-2.
 *
 * ✨ Nouveautés v4 :
 *   - Statut "reservoir" : exclusion stricte des cartes inactives des sessions automatiques
 *     (toute carte créée naît en réservoir ; activation explicite via UI)
 *   - Champs optionnels sourceEnonce / sourceCorrection (livre / classeur / app)
 *   - Index de Délai Relatif I_R = jours écoulés / intervalle prévu
 *       · I_R < 1 → exponentielle douce (proximité)
 *       · I_R = 1 → valeur nominale
 *       · I_R > 1 → croissance linéaire agressive (les petits intervalles en retard
 *         prennent automatiquement le pas sur les grands)
 *   - Ease élastique ("ease aggressif") : la baisse de fond est minime (-0.05),
 *     mais un flag _blocageActif amplifie temporairement l'urgence comme si l'ease
 *     valait MIN_EASE. Levé à la première note ≥ seuil (par défaut 8) ou après un
 *     timeout réglable de révisions (par défaut 5).
 *   - Marge budget de session 100% paramétrable (window.D.settings.margeBudget)
 *   - Entrelacement matières GLOUTON post-sélection (jamais deux cartes de la même
 *     matière à la suite, sauf si plus d'autre choix)
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
  // v4 : refonte autour de l'Index de Délai Relatif I_R = joursÉcoulés / intervallePrévu
  ALGO.DEFAULT_COEFS = {
    // ----- Composante temporelle unifiée (I_R) -----
    W_urgenceTemps: 4.0,   // poids global de l'axe temporel (I_R)
    K_PROCHE:       3.0,   // exposant de la montée exponentielle pour I_R < 1
    GAMMA_RETARD:   2.5,   // pente linéaire du retard pour I_R > 1 (agressivité)
    // ----- Autres composantes (priorité, ease, nouveauté) -----
    W_priorite:     2.0,   // poids de la priorité user (1=urgent → +2, 3=faible → +0.3)
    W_nouveau:      1.0,   // bonus aux nouvelles cartes activées (legacy/transition)
    W_ease:         0.8,   // poids de la difficulté (faible ease = monte)
    W_long:         0.5,   // (legacy) poids pénalisant pour éviter 2 longues à la suite
    // ----- Legacy v3 (gardés pour rétrocompatibilité affichage Diagnostic) -----
    W_retard:       3.0,   // (legacy v3, non utilisé en v4)
    W_proche:       2.0,   // (legacy v3, non utilisé en v4)
    TAU:            3.0,   // (legacy v3, non utilisé en v4)
    // ----- Ease élastique / Ease Hell mitigation -----
    EASE_DROP_FAIL:           0.05, // baisse de fond d'ease en cas d'échec (très douce)
    BLOCAGE_QSCORE_TRIGGER:   3,    // qScore ≤ X → flag _blocageActif
    BLOCAGE_QSCORE_VALIDATE:  8,    // qScore ≥ X → flag levé
    BLOCAGE_TIMEOUT_REV:      5,    // nb max de révisions avec flag actif avant libération auto
    BLOCAGE_BOOST_EASE_VAL:   1.3,  // valeur d'ease "virtuelle" utilisée pendant le boost
    // ----- Budget temps -----
    MARGE_BUDGET_DEFAULT:     0.92  // marge de sécurité par défaut (cf. settings.margeBudget)
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
  // ⚠ Fix v4.1 : on retourne la date LOCALE (pas UTC). `toISOString` convertit
  // en UTC, ce qui décale d'un jour en zone UTC+x après minuit local.
  function _localISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  ALGO.todayISO = function () {
    return _localISO(new Date());
  };
  ALGO.addDays = function (iso, n) {
    const d = iso ? new Date(iso + "T00:00:00") : new Date();
    d.setDate(d.getDate() + Math.round(n));
    return _localISO(d);
  };
  ALGO.daysBetween = function (a, b) {
    const da = new Date(a + (a.length === 10 ? "T00:00:00" : ""));
    const db = new Date(b + (b.length === 10 ? "T00:00:00" : ""));
    return Math.round((db - da) / 86400000);
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
  // ⚙️ v4 : ease élastique — baisse de fond minime (EASE_DROP_FAIL),
  //         flag _blocageActif pour amplifier l'urgence sans détruire l'historique macro.
  //         Le flag est levé à qScore ≥ BLOCAGE_QSCORE_VALIDATE OU au-delà
  //         de BLOCAGE_TIMEOUT_REV révisions consécutives (timeout réglable).
  ALGO.computeNextInterval = function (card, qScore, tempsReel) {
    const profileName = (card && card.profil) || "COURS";
    const profile = ALGO.getProfile(profileName);
    const steps = profile.steps;
    const C = ALGO.getCoefs();
    let ease = card.ease || profile.ease || ALGO.DEFAULT_EASE;
    let rep = card.repetitions || 0;
    let intervalle = card.intervalle || 0;
    const cible = card.tempsCible || 60;
    qScore = Math.max(0, Math.min(10, qScore));

    // --- Gestion du flag de blocage temporaire (ease aggressif) ---
    // Récupération des compteurs courants (peuvent être absents = première utilisation)
    let blocageActif         = !!card._blocageActif;
    let blocageRevCount      = card._blocageRevCount || 0;
    const QSCORE_FAIL        = C.BLOCAGE_QSCORE_TRIGGER  != null ? C.BLOCAGE_QSCORE_TRIGGER  : 3;
    const QSCORE_VALIDATE    = C.BLOCAGE_QSCORE_VALIDATE != null ? C.BLOCAGE_QSCORE_VALIDATE : 8;
    const TIMEOUT_REV        = C.BLOCAGE_TIMEOUT_REV     != null ? C.BLOCAGE_TIMEOUT_REV     : 5;
    const EASE_DROP_FAIL     = C.EASE_DROP_FAIL          != null ? C.EASE_DROP_FAIL          : 0.05;

    // Mapping continu : 0-3 reset · 4-6 doux · 7-8 normal · 9-10 bonus
    let qFactor;
    if (qScore <= QSCORE_FAIL) {
      // Reset progressif (0=reset total, 3=presque OK)
      rep = Math.max(0, rep - 2 + Math.floor(qScore / 1.5));
      intervalle = 0;
      // 🆕 v4 : on ne casse PAS l'ease définitivement → baisse douce uniquement
      ease = Math.max(ALGO.MIN_EASE, ease - EASE_DROP_FAIL);
      qFactor = 0;
      // ⚡ Active le flag de blocage temporaire
      blocageActif    = true;
      blocageRevCount = blocageActif === card._blocageActif ? (blocageRevCount + 1) : 1;
    } else {
      // Succès gradué
      if (rep < steps.length) intervalle = steps[rep];
      else intervalle = Math.round(intervalle * ease);
      rep += 1;
      // qScore 4 → 0.45 · 7 → 1.0 · 10 → 1.4
      qFactor = 0.45 + (qScore - 4) * (0.95 / 6);
      if (qScore >= 9) qFactor = 1.2 + (qScore - 9) * 0.2;
      // Ajustement ease (succès)
      const easeDelta = (qScore - 7) * 0.05; // <7 baisse douce, >7 monte
      ease = Math.max(ALGO.MIN_EASE, Math.min(ALGO.MAX_EASE, ease + easeDelta));
      // ⚡ Si carte en blocage et qScore validateur atteint → on libère le flag
      if (blocageActif && qScore >= QSCORE_VALIDATE) {
        blocageActif    = false;
        blocageRevCount = 0;
      } else if (blocageActif) {
        // Validation partielle (4-7) → on incrémente le compteur de tentatives sous blocage
        blocageRevCount += 1;
        // Timeout : libération automatique pour éviter un blocage éternel
        if (blocageRevCount >= TIMEOUT_REV) {
          blocageActif    = false;
          blocageRevCount = 0;
        }
      }
    }
    intervalle = Math.round(intervalle * (qFactor || 0));

    // Pénalité vitesse (PC*)
    let pen = 1;
    if (qScore > QSCORE_FAIL && tempsReel && cible) {
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
      qScore,
      // 🆕 v4 : nouveaux champs à persister sur la carte par l'appelant
      _blocageActif:    blocageActif,
      _blocageRevCount: blocageRevCount,
      _lastReviewDate:  ALGO.todayISO()
    };
  };

  // ===== Slider 1-10 ↔ bouton 3 niveaux =====
  ALGO.qButtonToScore = b => b === 0 ? 2 : b === 1 ? 6 : 9; // bad, mid, good
  ALGO.qScoreToButton = s => s <= 3 ? 0 : s <= 7 ? 1 : 2;

  // ===== Helpers réservoir =====
  // Une carte est en "réservoir" si elle n'est pas active. On accepte les statuts
  // legacy ('attente') et le nouveau nom canonique ('reservoir'). Toute carte
  // créée naît en réservoir et doit être activée explicitement par l'utilisateur
  // depuis l'onglet Réservoir.
  ALGO.RESERVOIR_STATUSES = ['reservoir', 'attente'];
  ALGO.isReservoir = function (card) {
    if (!card) return false;
    return ALGO.RESERVOIR_STATUSES.indexOf(card.statut) >= 0;
  };
  ALGO.isActive = function (card) {
    return !!card && card.statut === 'actif';
  };
  // Active une carte du réservoir : statut 'actif' + due aujourd'hui.
  ALGO.activateFromReservoir = function (card) {
    if (!card) return false;
    if (!ALGO.isReservoir(card)) return false;
    card.statut = 'actif';
    card.dateProchaineRevision = ALGO.todayISO();
    if (card.intervalle == null) card.intervalle = 0;
    if (card.ease == null)       card.ease = (ALGO.getProfile(card.profil || 'COURS').ease || ALGO.DEFAULT_EASE);
    if (card.repetitions == null) card.repetitions = 0;
    card._activatedAt = ALGO.todayISO();
    return true;
  };

  // ===== Classification des cartes en 3 PILES séparées (v4.2) =====
  // 1) DEVOIR : DM, colles, exercices à rendre avec date limite
  //              → traitement calendaire (urgenceDevoir), priorité absolue, forcés en session
  // 2) QUICK  : petites flashcards (anglais, formules) créées via l'onglet rapide
  //              → simple comblage de fin de session, hors I_R
  // 3) MAIN   : cartes principales (cours, exos types)
  //              → cœur du système de répétition espacée I_R + ease élastique
  ALGO.QUICK_PROFILES = ['ANGLAIS', 'FORMULE'];
  ALGO.cardKind = function (card) {
    if (!card) return 'unknown';
    if (card.type === 'devoir' || card.type === 'devoir-morceau') return 'devoir';
    if (ALGO.QUICK_PROFILES.indexOf(card.profil) >= 0) return 'quick';
    return 'main';
  };

  // ===== URGENCE CALENDAIRE (DEVOIRS) — totalement séparée d'I_R (v4.2) =====
  // Les DM ont une dateLimite stricte : il faut absolument les terminer avant.
  // Logique :
  //   · si déjà dépassée                           → urgence MAX (force absolue)
  //   · si joursRestants ≤ morceauxRestants        → URGENT (faut le faire ce soir)
  //   · si joursRestants ≤ morceauxRestants + 2    → bientôt critique
  //   · sinon                                      → planification douce (rampe inverse)
  // Une carte sans dateLimite ni morceaux → urgence faible.
  ALGO.urgenceDevoir = function (card, refIso) {
    if (!card) return { total: 0 };
    const today = refIso || ALGO.todayISO();
    const dateLimite = card.dateLimite || null;
    const morceauxRestants = Math.max(1, (card._morceauxTotal || 1) - (card._morceauxFaits || 0));
    if (!dateLimite) {
      // DM sans deadline explicite → on retombe sur dateProchaineRevision si dispo
      const fallback = card.dateProchaineRevision || today;
      const joursRestants = ALGO.daysBetween(today, fallback);
      return {
        total: joursRestants <= 0 ? 30 : Math.max(5, 25 - joursRestants),
        joursRestants, morceauxRestants, dateLimite: null
      };
    }
    const joursRestants = ALGO.daysBetween(today, dateLimite);
    let urg;
    if (joursRestants <= 0) {
      urg = 100 + Math.abs(joursRestants) * 10;          // dépassée : monte à l'infini
    } else if (joursRestants <= morceauxRestants) {
      urg = 60 + (morceauxRestants - joursRestants + 1) * 12; // strict minimum non respecté
    } else if (joursRestants <= morceauxRestants + 2) {
      urg = 35 + (morceauxRestants + 2 - joursRestants) * 5;  // zone "à anticiper"
    } else {
      // Zone confortable : urgence faible mais non nulle → l'algo l'intercale dans un
      // jour creux (settings.ankiSessionMin × overload-check de jour)
      urg = Math.max(6, 25 - (joursRestants - morceauxRestants));
    }
    return { total: urg, joursRestants, morceauxRestants, dateLimite };
  };

  // ===== Cœur de l'algo : urgence I_R (déjà définie en v4) =====

  // ===== Calcul de l'Index de Délai Relatif (I_R) =====
  // I_R = (jours écoulés depuis la dernière révision) / (intervalle théorique prévu)
  //   · < 1  → en avance / approche (exp douce)
  //   · = 1  → jour J
  //   · > 1  → en retard linéaire
  // Si la carte n'a pas d'intervalle (nouvelle activation, intervalle=0), on
  // considère un intervalle minimal de 1j pour éviter la division par zéro et on
  // retourne directement un ratio basé sur le retard absolu (cf. cas dégradé).
  ALGO.computeIR = function (card, refIso) {
    if (!card) return { IR: 0, intervalleRef: 0, joursEcoules: 0 };
    const today = refIso || ALGO.todayISO();
    const intervalle = Math.max(0, Math.round(card.intervalle || 0));
    // Date de la dernière révision : champ explicite si dispo, sinon déduite
    // (dateProchaineRevision - intervalle), sinon today.
    let lastIso = card._lastReviewDate;
    if (!lastIso) {
      if (card.dateProchaineRevision && intervalle > 0) {
        lastIso = ALGO.addDays(card.dateProchaineRevision, -intervalle);
      } else if (card.dateProchaineRevision) {
        lastIso = card.dateProchaineRevision; // intervalle = 0 → due aujourd'hui
      } else {
        lastIso = today;
      }
    }
    const joursEcoules = Math.max(0, ALGO.daysBetween(lastIso, today));
    // Cas dégradé : pas d'intervalle prévu → on traite comme "jour J + retard absolu"
    if (intervalle <= 0) {
      return {
        IR: joursEcoules >= 0 ? (1 + joursEcoules * 0.5) : 0,
        intervalleRef: 1, joursEcoules, lastIso, degraded: true
      };
    }
    return {
      IR: joursEcoules / intervalle,
      intervalleRef: intervalle, joursEcoules, lastIso
    };
  };

  // ===== SCORE D'URGENCE CONTINU — VERSION I_R (v4) =====
  // urgenceTemps :
  //   IR ≤ 1 → exp(K_PROCHE · (IR - 1))   ∈ ]0, 1]   (montée exponentielle douce)
  //   IR > 1 → 1 + GAMMA_RETARD · (IR - 1)            (montée linéaire agressive)
  // Plus le score est haut, plus la carte doit être révisée maintenant.
  // ⚡ Ease aggressif : si _blocageActif, on calcule easeFactor comme si ease = MIN_EASE.
  ALGO.urgenceScore = function (card, refIso) {
    if (!card) return 0;
    const ref = refIso || ALGO.todayISO();
    const C = ALGO.getCoefs();

    // 1) Composante temporelle unifiée via I_R
    const irInfo = ALGO.computeIR(card, ref);
    const IR = irInfo.IR;
    let urgenceTemps;
    if (IR <= 1) {
      urgenceTemps = Math.exp((C.K_PROCHE || 3.0) * (IR - 1));
    } else {
      urgenceTemps = 1 + (C.GAMMA_RETARD || 2.5) * (IR - 1);
    }

    // 2) Priorité user
    const priFactor = (card.priorite || 2) === 1 ? 2 : (card.priorite || 2) === 2 ? 1 : 0.3;

    // 3) Difficulté (ease) avec boost de blocage temporaire
    const easeReel = card.ease || 2.5;
    const easeEffective = card._blocageActif ? (C.BLOCAGE_BOOST_EASE_VAL || ALGO.MIN_EASE) : easeReel;
    const easeFactor = Math.max(0, (3 - easeEffective)); // ease bas → monte

    // 4) Nouveauté (legacy : transition de cartes 'attente' historiques)
    const nouveau = ALGO.isReservoir(card) ? 1 : 0;

    const score =
      (C.W_urgenceTemps || 4.0) * urgenceTemps +
      (C.W_priorite     || 2.0) * priFactor +
      (C.W_nouveau      || 1.0) * nouveau +
      (C.W_ease         || 0.8) * easeFactor;

    // Composantes héritées (retard/proche) recalculées pour l'affichage Diagnostic
    const retardAffiche = IR > 1 ? (IR - 1) * (irInfo.intervalleRef || 1) : 0;
    const procheAffiche = IR <= 1 ? Math.exp((C.K_PROCHE || 3.0) * (IR - 1)) : 1;

    return {
      total: parseFloat(score.toFixed(2)),
      breakdown: {
        urgenceTemps: parseFloat(((C.W_urgenceTemps || 4.0) * urgenceTemps).toFixed(2)),
        retard:       parseFloat(retardAffiche.toFixed(2)),  // legacy display
        proche:       parseFloat(procheAffiche.toFixed(2)),  // legacy display
        priorite:     parseFloat(((C.W_priorite || 2.0) * priFactor).toFixed(2)),
        nouveau:      parseFloat(((C.W_nouveau  || 1.0) * nouveau).toFixed(2)),
        ease:         parseFloat(((C.W_ease     || 0.8) * easeFactor).toFixed(2))
      },
      raw: {
        IR: parseFloat(IR.toFixed(3)),
        intervalleRef: irInfo.intervalleRef,
        joursEcoules:  irInfo.joursEcoules,
        urgenceTemps:  parseFloat(urgenceTemps.toFixed(3)),
        priFactor, easeFactor, nouveau, ease: easeReel,
        blocageActif: !!card._blocageActif,
        easeEffective
      }
    };
  };

  // ===== Cartes à proposer aujourd'hui (TOUTES, triées par urgence) =====
  // ⚠️ v4 : EXCLUSION STRICTE des cartes en réservoir (statut 'reservoir' ou 'attente').
  //         Seules les cartes 'actif' (et non 'fini') entrent en session automatique.
  ALGO.getCandidates = function (exercices, refIso) {
    const ref = refIso || ALGO.todayISO();
    if (!Array.isArray(exercices)) return [];
    return exercices
      .filter(c => ALGO.isActive(c))
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

  // ===== Build session — REFONTE 3 PILES (v4.2) =====
  // Architecture claire et SÉPARÉE :
  //
  //   PHASE 0 — DEVOIRS (urgence calendaire stricte) ────────────────────────
  //     · DM, colles, exercices à rendre (card.type === 'devoir' / 'devoir-morceau')
  //     · Triés par ALGO.urgenceDevoir (date limite + morceaux restants)
  //     · FORCÉS en début de session, même si ça dépasse le budget
  //     · Si dépassement → flag overload=true (UI affiche un avertissement rouge)
  //
  //   PHASE 1 — CARTES PRINCIPALES (cœur I_R + ease élastique) ──────────────
  //     · Cours, exos types (profil COURS / EXO)
  //     · Triées par ALGO.urgenceScore (I_R + ease)
  //     · Empilées tant que budget restant > 0
  //     · Si retard → c'est OK, on peut sauter (la nature de l'I_R s'en occupe)
  //
  //   PHASE 2 — PETITES CARTES (comblage anglais / formules) ────────────────
  //     · profil ANGLAIS ou FORMULE (créées via anki-quick.js)
  //     · Triées par urgence simple
  //     · Comblent les trous de fin (≤ settings.ankiMaxAnglaisFill, défaut 5)
  //
  // Entrelacement matières (Nœud 4) : appliqué sur PHASES 1+2 SEULEMENT.
  // Les devoirs restent en tête, dans leur ordre d'urgence calendaire propre.
  ALGO.buildSession = function (exercices, opts) {
    const userMarge = (window.D && window.D.settings && typeof window.D.settings.margeBudget === 'number')
      ? window.D.settings.margeBudget
      : ALGO.DEFAULT_COEFS.MARGE_BUDGET_DEFAULT;
    const o = Object.assign({
      sessionMinutes: 60,
      includeNew: 0,
      selectedIds: null,
      marge: userMarge,
      manualOrder: null,
      forceIncludeReservoir: false
    }, opts || {});
    o.marge = Math.max(0.5, Math.min(1.0, o.marge));

    const ref = ALGO.todayISO();
    const budget = (o.sessionMinutes || 60) * 60 * o.marge;
    if (!Array.isArray(exercices)) {
      return { cartes: [], tempsTotalPrev: 0, countDevoir: 0, countMain: 0, countQuick: 0, countDue: 0, countNew: 0, reportees: [], marge: o.marge, overload: false, overloadDelta: 0 };
    }

    // Mode manuel : l'utilisateur a fixé un ordre via drag&drop
    if (o.manualOrder && o.manualOrder.length) {
      const allActive = exercices.filter(c => ALGO.isActive(c));
      const map = {}; allActive.forEach(c => { map[c.id] = c; });
      const ordered = o.manualOrder.map(id => map[id]).filter(Boolean);
      const result = []; let used = 0;
      for (const c of ordered) {
        const t = _tempsCarte(c);
        if (used + t > budget && result.length) break;
        result.push(c); used += t;
      }
      return {
        cartes: result, tempsTotalPrev: used,
        countDevoir: result.filter(c => ALGO.cardKind(c) === 'devoir').length,
        countMain:   result.filter(c => ALGO.cardKind(c) === 'main').length,
        countQuick:  result.filter(c => ALGO.cardKind(c) === 'quick').length,
        countDue: ordered.filter(c => ALGO.isActive(c)).length,
        countNew: 0,
        reportees: ordered.filter(c => !result.includes(c)),
        marge: o.marge,
        overload: false,
        overloadDelta: 0
      };
    }

    // Pool de base : uniquement les cartes actives (réservoir exclus, sauf forçage)
    let pool = exercices.filter(c => ALGO.isActive(c));
    if (o.forceIncludeReservoir) {
      pool = pool.concat(exercices.filter(c => ALGO.isReservoir(c)).slice(0, o.includeNew || 0));
    }
    if (o.selectedIds && o.selectedIds.length) {
      const set = new Set(o.selectedIds);
      pool = pool.filter(c => set.has(c.id));
    }

    // Classement en 3 piles distinctes
    const pileDevoir = [];
    const pileMain   = [];
    const pileQuick  = [];
    pool.forEach(c => {
      const k = ALGO.cardKind(c);
      if (k === 'devoir')      pileDevoir.push(c);
      else if (k === 'quick')  pileQuick.push(c);
      else                     pileMain.push(c);
    });

    // ===== PHASE 0 : DEVOIRS URGENTS (urgence calendaire, FORCÉS) =====
    // Seuls les DM dont l'urgence calendaire dépasse SEUIL_DEVOIR_FORCE sont
    // imposés en session. Les autres sont mis en attente et concourent en
    // Phase 1b (insertion opportuniste si du budget reste).
    const seuilDevoir = (window.D && window.D.settings && window.D.settings.seuilDevoirForce) || 35;
    const devoirsScored = pileDevoir
      .map(c => ({ card: c, score: ALGO.urgenceDevoir(c, ref) }))
      .sort((a, b) => b.score.total - a.score.total);
    const devoirsForces  = devoirsScored.filter(x => x.score.total >= seuilDevoir);
    const devoirsLatents = devoirsScored.filter(x => x.score.total <  seuilDevoir);

    const selected = [];
    let used = 0;
    for (const x of devoirsForces) {
      selected.push(x.card);
      used += _tempsCarte(x.card);
    }
    // Flag overload : les devoirs urgents SEULS dépassent déjà le budget ce soir
    const overload = used > budget;
    const overloadDelta = overload ? (used - budget) : 0;

    // ===== PHASE 1a : MAIN (I_R, jusqu'au budget restant) =====
    const mainsScored = pileMain
      .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
      .sort((a, b) => b.score.total - a.score.total);
    const mainsTaken = [];
    for (const x of mainsScored) {
      const t = _tempsCarte(x.card);
      if (used + t > budget) continue;
      mainsTaken.push(x.card);
      used += t;
    }

    // ===== PHASE 1b : DEVOIRS LATENTS (insertion opportuniste si budget restant) =====
    const latentsTaken = [];
    for (const x of devoirsLatents) {
      const t = _tempsCarte(x.card);
      if (used + t > budget) continue;
      latentsTaken.push(x.card);
      used += t;
    }

    // ===== PHASE 2 : QUICK (comblage anglais / formules, fin de session) =====
    const maxQuick = (window.D && window.D.settings && window.D.settings.ankiMaxAnglaisFill) || 5;
    const reste = budget - used;
    const quicksTaken = [];
    if (reste > 30) {
      const quicksScored = pileQuick
        .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
        .sort((a, b) => b.score.total - a.score.total)
        .slice(0, maxQuick);
      for (const x of quicksScored) {
        const t = _tempsCarte(x.card);
        if (used + t > budget) break;
        quicksTaken.push(x.card);
        used += t;
      }
    }

    // ===== Entrelacement matières (Phases 1a + 1b + 2 uniquement) =====
    // Les devoirs forcés (Phase 0) restent en tête, dans leur ordre d'urgence
    // calendaire propre. C'est volontaire : tu dois les voir en premier.
    const interleavable = mainsTaken.concat(latentsTaken).concat(quicksTaken);
    const interleaved = ALGO.interleaveMatieres(interleavable);

    const arranged = selected.concat(interleaved);
    const reportees = pool.filter(c => !arranged.includes(c));

    return {
      cartes: arranged,
      tempsTotalPrev: used,
      countDevoir:       selected.length + latentsTaken.length,
      countDevoirForce:  selected.length,
      countDevoirLatent: latentsTaken.length,
      countMain:         mainsTaken.length,
      countQuick:        quicksTaken.length,
      countDue:          arranged.filter(c => ALGO.isActive(c)).length,
      countNew:          arranged.filter(c => ALGO.isReservoir(c)).length,
      reportees,
      marge: o.marge,
      overload,
      overloadDelta,
      // Méta pour la vue Agenda : tous les devoirs non sélectionnés mais à venir
      devoirsLatentsNonInseres: devoirsLatents
        .filter(x => !latentsTaken.includes(x.card))
        .map(x => ({ card: x.card, urgence: x.score }))
    };
  };

  // Durée par carte en secondes (gère les DM segmentés)
  function _tempsCarte(c) {
    if (c.type === 'devoir' || c.type === 'devoir-morceau') {
      return Math.round(((c._dureeTotaleMin || (c.tempsCible / 60)) / (c._morceauxTotal || 1)) * 60);
    }
    return (c.tempsCible || 60);
  }

  // ===== Entrelacement matières GLOUTON (v4) =====
  // Entrée : liste déjà triée par urgence ↓ globale.
  // Sortie : liste où l'on évite deux cartes consécutives de la même matière,
  //          en piochant à chaque tour la carte la plus urgente d'une matière ≠
  //          de la précédente. Si impossible (toutes les cartes restantes sont
  //          de la même matière), on accepte le doublon par obligation.
  ALGO.interleaveMatieres = function (cards) {
    if (!cards || cards.length <= 1) return (cards || []).slice();
    // Bucket par matière en préservant l'ordre d'urgence d'entrée
    const buckets = {};
    const order = [];
    cards.forEach(c => {
      const k = c.mat || '?';
      if (!buckets[k]) { buckets[k] = []; order.push(k); }
      buckets[k].push(c);
    });
    const out = [];
    let lastMat = null;
    let safety = 0;
    while (Object.keys(buckets).some(k => buckets[k].length) && safety++ < cards.length * 4) {
      // 1) Cherche la 1ère matière ≠ lastMat avec une carte dispo,
      //    en suivant l'ordre d'apparition (qui reflète l'urgence des têtes de file)
      const matsDispo = order.filter(k => buckets[k] && buckets[k].length);
      let chosenMat = null;
      // Trie les mats par urgence de la tête de file (la plus urgente d'abord)
      const matsTries = matsDispo.slice().sort((a, b) => {
        const ua = ALGO.urgenceScore(buckets[a][0]).total;
        const ub = ALGO.urgenceScore(buckets[b][0]).total;
        return ub - ua;
      });
      for (const k of matsTries) {
        if (k !== lastMat) { chosenMat = k; break; }
      }
      // Toutes les mats restantes sont == lastMat → doublon obligé
      if (!chosenMat) chosenMat = matsTries[0];
      out.push(buckets[chosenMat].shift());
      lastMat = chosenMat;
    }
    return out;
  };

  // ===== Arrangement legacy long/court (conservé pour rétrocompat) =====
  ALGO.arrangeUrgentFirst = function (cards) {
    if (!cards || cards.length <= 1) return cards;
    const courtes = cards.filter(c => (c.tempsCible || 60) <= 90);
    const longues = cards.filter(c => (c.tempsCible || 60) > 90);
    if (!courtes.length) return longues;
    if (!longues.length) return courtes;
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
