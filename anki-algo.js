/**
 * anki-algo.js v4 — Moteur Synchrotron (PC*) — cœur partagé
 * UI v1 archivée · UI active : anki-app-v2.js · fenêtres/phases : anki-algo-v2.js
 * Répétition espacée : réservoir, I_R, ease élastique
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

  /** Paliers SM-2 pour cartes rapides Y- (selon ★, pas le profil Cours/Anglais). */
  ALGO.DEFAULT_QUICK_STAR_STEPS = {
    1: { steps: [1, 4, 10, 21, 45], ease: 2.2, label: "★1 — faible" },
    2: { steps: [1, 3, 7, 14, 30], ease: 2.3, label: "★2" },
    3: { steps: [1, 2, 4, 8, 15], ease: 2.3, label: "★3 — standard" },
    4: { steps: [1, 2, 3, 6, 12], ease: 2.4, label: "★4" },
    5: { steps: [1, 1, 2, 4, 8], ease: 2.5, label: "★5 — prioritaire" }
  };

  // ===== Coefficients du score d'urgence (modifiables dans Réglages) =====
  // v4 : refonte autour de l'Index de Délai Relatif I_R = joursÉcoulés / intervallePrévu
  ALGO.DEFAULT_COEFS = {
    // ----- Composante temporelle unifiée (I_R) -----
    W_urgenceTemps: 4.0,   // poids global de l'axe temporel (I_R)
    K_PROCHE:       3.0,   // exposant de la montée exponentielle pour I_R < 1
    GAMMA_RETARD:   2.5,   // pente linéaire du retard pour I_R > 1 (agressivité)
    // ----- Autres composantes (priorité, ease, nouveauté) -----
    W_priorite:     2.0,   // poids de l'importance (étoiles 1–5 → facteur 0.35–2.0)
    W_nouveau:      1.0,   // bonus aux nouvelles cartes activées (legacy/transition)
    W_ease:         0.8,   // poids de la difficulté (faible ease = monte)
    W_long:         0.5,   // (legacy) poids pénalisant pour éviter 2 longues à la suite
    // ----- Legacy v3 (gardés pour rétrocompatibilité affichage Diagnostic) -----
    W_retard:       3.0,   // (legacy v3, non utilisé en v4)
    W_proche:       2.0,   // (legacy v3, non utilisé en v4)
    TAU:            3.0,   // (legacy v3, non utilisé en v4)
    // ----- Ease élastique / Ease Hell mitigation -----
    EASE_DROP_FAIL:           0.20, // baisse de fond d'ease en cas d'échec (modifiable)
    BLOCAGE_QSCORE_TRIGGER:   3,    // qScore ≤ X → flag _blocageActif
    BLOCAGE_QSCORE_VALIDATE:  8,    // qScore ≥ X → flag levé
    BLOCAGE_TIMEOUT_REV:      5,    // nb max de révisions avec flag actif avant libération auto
    BLOCAGE_BOOST_EASE_VAL:   1.3,  // valeur d'ease "virtuelle" utilisée pendant le boost
    // ----- Budget temps -----
    MARGE_BUDGET_DEFAULT:     0.92  // marge de sécurité par défaut (cf. settings.margeBudget)
  };

  ALGO.MIN_IMPORTANCE = 1;
  ALGO.MAX_IMPORTANCE = 5;
  ALGO.DEFAULT_IMPORTANCE = 3;

  /** Importance 1–5★ (legacy priorite 1=urgence→5★, 2=normale→3★, 3=faible→1★). */
  ALGO.getImportance = function (card) {
    if (!card) return ALGO.DEFAULT_IMPORTANCE;
    if (typeof card.importance === "number" && card.importance >= 1 && card.importance <= 5) {
      return Math.round(card.importance);
    }
    const p = card.priorite;
    if (p === 1) return 5;
    if (p === 3) return 1;
    if (p === 2) return 3;
    if (p >= 1 && p <= 5) return Math.round(p);
    return ALGO.DEFAULT_IMPORTANCE;
  };

  /** Facteur d'urgence : 1★→0.35 · 3★→1.0 · 5★→2.0 */
  ALGO.importanceUrgencyFactor = function (importance) {
    const imp = Math.max(1, Math.min(5, importance || ALGO.DEFAULT_IMPORTANCE));
    return 0.35 + (imp - 1) * 0.4125;
  };

  /** Multiplicateur d'intervalle : plus d'étoiles → révisions plus serrées. */
  ALGO.importanceIntervalMult = function (importance) {
    const imp = Math.max(1, Math.min(5, importance || ALGO.DEFAULT_IMPORTANCE));
    return 1.35 - (imp - 1) * 0.2;
  };

  /** Boost léger des devoirs selon l'importance. */
  ALGO.importanceDevoirMult = function (importance) {
    const imp = Math.max(1, Math.min(5, importance || ALGO.DEFAULT_IMPORTANCE));
    return 0.85 + (imp - 1) * 0.1;
  };

  ALGO.getProfile = function (name) {
    const user = (window.D && window.D.settings && window.D.settings.ankiProfiles) || {};
    return user[name] || ALGO.DEFAULT_PROFILES[name] || ALGO.DEFAULT_PROFILES.COURS;
  };
  ALGO.getQuickStarProfile = function (importance) {
    const imp = Math.max(1, Math.min(5, importance || ALGO.DEFAULT_IMPORTANCE));
    const user = (window.D && window.D.settings && window.D.settings.ankiQuickStarSteps) || {};
    return user[imp] || user[String(imp)] || ALGO.DEFAULT_QUICK_STAR_STEPS[imp] || ALGO.DEFAULT_QUICK_STAR_STEPS[3];
  };
  ALGO.getCoefs = function () {
    const user = (window.D && window.D.settings && window.D.settings.ankiCoefs) || {};
    return Object.assign({}, ALGO.DEFAULT_COEFS, user);
  };

  // ===== Date helpers =====
  // ⚠ Date LOCALE (pas UTC). Délègue à core-utils.js si disponible.
  function _localISO(d) {
    if (typeof window.localDateISO === 'function') return window.localDateISO(d);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  ALGO.todayISO = function () {
    if (typeof window.todayISO === 'function') return window.todayISO();
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

  // ===== UID flashcards / exercices : W-XXX | X-XXX | Y-XXX (1 lettre + 3 alphanum) =====
  // W = devoirs · X = cartes principales (Synchrotron) · Y = cartes rapides (onglet Rapide)
  ALGO.EXO_PREFIX = { devoir: 'W', principal: 'X', main: 'X', quick: 'Y', rapide: 'Y', W: 'W', X: 'X', Y: 'Y' };

  ALGO.resolveExoPrefix = function (kind) {
    const raw = String(kind || 'X').trim().toUpperCase();
    if (ALGO.EXO_PREFIX[raw]) return ALGO.EXO_PREFIX[raw];
    if (raw === 'W' || raw === 'X' || raw === 'Y') return raw;
    return 'X';
  };

  ALGO.genExoUid = function (kind, existing) {
    const prefix = ALGO.resolveExoPrefix(kind);
    const used = new Set(existing || []);
    const ALPHANUM = ALGO.LETTERS + ALGO.DIGITS;
    for (let i = 0; i < 5000; i++) {
      let suffix = "";
      for (let j = 0; j < 3; j++) suffix += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
      const code = prefix + "-" + suffix;
      if (!used.has(code)) return code;
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
    let steps;
    let ease;
    if (ALGO.cardKind(card) === "quick") {
      const qs = ALGO.getQuickStarProfile(ALGO.getImportance(card));
      steps = qs.steps;
      ease = card.ease || qs.ease || ALGO.DEFAULT_EASE;
    } else {
      const profile = ALGO.getProfile(profileName);
      steps = profile.steps;
      ease = card.ease || profile.ease || ALGO.DEFAULT_EASE;
    }
    const C = ALGO.getCoefs();
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
    const EASE_DROP_FAIL     = C.EASE_DROP_FAIL          != null ? C.EASE_DROP_FAIL          : 0.20;

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

    if (intervalle > 0) {
      const impMult = ALGO.importanceIntervalMult(ALGO.getImportance(card));
      intervalle = Math.max(1, Math.round(intervalle * impMult));
    }

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
  // Source de vérité : préfixe d'ID W- / X- / Y- (cf. archive/anki-v1/anki-viz.js nœud 1)
  //   W- → DEVOIR  : agenda calendaire (urgenceDevoir), forcés en Phase 0
  //   X- → MAIN    : répétition espacée I_R + ease élastique (Phase 1a)
  //   Y- → QUICK   : comblage fin de session (Phase 2), tri I_R + entrelacement
  ALGO.QUICK_PROFILES = ['ANGLAIS', 'FORMULE']; // legacy fallback uniquement
  ALGO.exoPrefixFromId = function (id) {
    if (!id || typeof id !== 'string') return null;
    const m = id.match(/^([WXY])-/i);
    return m ? m[1].toUpperCase() : null;
  };
  ALGO.cardKind = function (card) {
    if (!card) return 'unknown';
    if (card._devoirChunkOf) return 'devoir';
    const px = ALGO.exoPrefixFromId(card.id);
    if (px === 'W') return 'devoir';
    if (px === 'Y') return 'quick';
    if (px === 'X') return 'main';
    // Rétrocompat données sans préfixe W/X/Y
    if (card.type === 'devoir' || card.type === 'devoir-morceau') return 'devoir';
    if (ALGO.QUICK_PROFILES.indexOf(card.profil) >= 0) return 'quick';
    return 'main';
  };

  /** Temps total proposé pour un DM (minutes), avant saisie utilisateur. */
  ALGO.proposerTempsDevoir = function (opts) {
    opts = opts || {};
    if (opts.tempsRestantConnu != null && Number(opts.tempsRestantConnu) > 0) {
      return Math.max(5, Math.round(Number(opts.tempsRestantConnu) / 5) * 5);
    }
    const imp = Math.max(1, Math.min(5, opts.importance || 3));
    const today = opts.ref || ALGO.todayISO();
    let jours = 5;
    if (opts.dateLimite) {
      jours = Math.max(1, ALGO.daysBetween(today, opts.dateLimite));
    }
    let propose = 25 * imp; // 25–125 min selon ★
    if (jours <= 2) propose = Math.round(propose * 0.8);
    else if (jours >= 10) propose = Math.round(propose * 1.2);
    propose = Math.max(20, Math.min(240, propose));
    return Math.round(propose / 5) * 5;
  };

  /**
   * Découpe auto d'un DM :
   *  - tempsRestantMin : estimation utilisateur du travail restant
   *  - sessionMinMin   : durée minimale souhaitée par bout
   * → nombre de bouts + durée par bout (l'algo décide, pas l'utilisateur)
   */
  ALGO.planifierDecoupeDevoir = function (tempsRestantMin, sessionMinMin, dateLimite, refIso) {
    const today = refIso || ALGO.todayISO();
    let restant = Math.max(5, Math.round(Number(tempsRestantMin) || 30));
    let sessMin = Math.max(5, Math.min(180, Math.round(Number(sessionMinMin) || 25)));
    if (sessMin > restant) sessMin = restant;

    let n = Math.max(1, Math.ceil(restant / sessMin));
    n = Math.min(n, 30);

    const jours = dateLimite ? ALGO.daysBetween(today, dateLimite) : null;
    const tempsParBout = Math.max(1, Math.round(restant / n));
    const boutsParJour = (jours != null && jours > 0)
      ? Math.max(1, Math.ceil(n / Math.max(1, jours)))
      : n;

    return {
      tempsRestantMin: restant,
      sessionMinMin: sessMin,
      morceauxTotal: n,
      tempsParBoutMin: tempsParBout,
      joursRestants: jours,
      boutsParJourEstime: boutsParJour
    };
  };

  /** Applique un plan de découpe sur la carte DM (conserve les sessions déjà faites). */
  ALGO.applyDecoupeDevoir = function (card, plan, meta) {
    if (!card || !plan) return card;
    meta = meta || {};
    const faits = Math.max(0, card._morceauxFaits || 0);
    const remainingBouts = Math.max(1, plan.morceauxTotal || 1);
    card._tempsProposeMin = meta.tempsProposeMin != null ? meta.tempsProposeMin : (card._tempsProposeMin || plan.tempsRestantMin);
    card._tempsRestantMin = plan.tempsRestantMin;
    card._sessionMinMin = plan.sessionMinMin;
    card._dureeTotaleMin = plan.tempsRestantMin;
    card._morceauxFaits = faits;
    card._morceauxTotal = faits + remainingBouts;
    card.tempsCible = Math.max(60, Math.round((plan.tempsParBoutMin || plan.sessionMinMin || 25) * 60));
    card.type = 'devoir';
    return card;
  };

  /**
   * Bout virtuel pour intercaler un DM plusieurs fois dans une session.
   * @param boutIndex0 index absolu 0-based dans le plan du DM (stable au restore :
   *   id W-xxx#2 reste le bout n°3 même après progression).
   */
  ALGO.makeDevoirChunk = function (parent, boutIndex0) {
    if (!parent) return null;
    const boutSec = ALGO.cardDuration(parent);
    const total = parent._morceauxTotal || 1;
    const idx = Math.max(0, boutIndex0 | 0);
    return Object.assign({}, parent, {
      id: parent.id + '#' + idx,
      type: 'devoir',
      _devoirChunkOf: parent.id,
      _devoirChunkIdx: idx,
      _projSessionIdx: idx + 1,
      _projSessionTotal: total,
      tempsCible: boutSec,
      historique: parent.historique || []
    });
  };

  /**
   * Combien de bouts d'un DM viser ce soir (urgence calendaire),
   * puis tronqué au budget restant.
   */
  ALGO.chunksDevoirTonight = function (card, refIso, budgetLeftSec, opts) {
    opts = opts || {};
    if (!card || card.statut === 'fini' || card.statut === 'termine' || card.statut === 'terminé') return [];
    const ref = refIso || ALGO.todayISO();
    const faits = card._morceauxFaits || 0;
    const restants = Math.max(0, (card._morceauxTotal || 1) - faits);
    if (!restants) return [];
    const boutSec = Math.max(60, ALGO.cardDuration(card));
    const urg = ALGO.urgenceDevoir(card, ref);
    const jr = urg.joursRestants;
    let want = 1;
    if (jr != null && jr <= 0) want = restants;
    else if (jr != null && jr < restants) want = Math.min(restants, restants - jr + 1);
    else if (opts.forced) want = 1;
    else want = 1;
    if (opts.maxChunks != null) want = Math.min(want, opts.maxChunks);
    want = Math.min(want, restants, 8);

    const out = [];
    let used = 0;
    for (let i = 0; i < want; i++) {
      // Le 1er bout forcé peut dépasser le budget (overload), les suivants respectent le reste
      if (i > 0 && used + boutSec > budgetLeftSec) break;
      if (!opts.forced && used + boutSec > budgetLeftSec) break;
      // Index absolu = faits + i (stable si on restaure la session plus tard)
      out.push(ALGO.makeDevoirChunk(card, faits + i));
      used += boutSec;
    }
    return out;
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
      const fallback = card.dateProchaineRevision || today;
      const joursRestants = ALGO.daysBetween(today, fallback);
      let urg = joursRestants <= 0 ? 30 : Math.max(5, 25 - joursRestants);
      const imp = ALGO.getImportance(card);
      urg *= ALGO.importanceDevoirMult(imp);
      return { total: urg, joursRestants, morceauxRestants, dateLimite: null };
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
      urg = Math.max(6, 25 - (joursRestants - morceauxRestants));
    }
    urg = urg * ALGO.importanceDevoirMult(ALGO.getImportance(card));
    return { total: urg, joursRestants, morceauxRestants, dateLimite };
  };

  // Score unifié pour tri / affichage (W- → calendaire · X-/Y- → I_R)
  ALGO.scoreSession = function (card, refIso) {
    if (!card) return { total: 0 };
    if (ALGO.cardKind(card) === 'devoir') {
      const d = ALGO.urgenceDevoir(card, refIso);
      return { total: d.total, kind: 'devoir', raw: d };
    }
    const s = ALGO.urgenceScore(card, refIso);
    if (typeof s === 'number') return { total: s, kind: ALGO.cardKind(card) };
    return { total: s.total, kind: ALGO.cardKind(card), raw: s };
  };

  ALGO.isOverdue = function (card, refIso) {
    if (!card || !card.dateProchaineRevision) return false;
    const ref = refIso || ALGO.todayISO();
    return card.dateProchaineRevision < ref;
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

    // 2) Importance (étoiles 1–5)
    const imp = ALGO.getImportance(card);
    const priFactor = ALGO.importanceUrgencyFactor(imp);

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
        importance:   parseFloat(((C.W_priorite || 2.0) * priFactor).toFixed(2)),
        nouveau:      parseFloat(((C.W_nouveau  || 1.0) * nouveau).toFixed(2)),
        ease:         parseFloat(((C.W_ease     || 0.8) * easeFactor).toFixed(2))
      },
      raw: {
        IR: parseFloat(IR.toFixed(3)),
        intervalleRef: irInfo.intervalleRef,
        joursEcoules:  irInfo.joursEcoules,
        urgenceTemps:  parseFloat(urgenceTemps.toFixed(3)),
        priFactor, easeFactor, nouveau, ease: easeReel,
        importance: imp,
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
      .filter(c => ALGO.isActive(c) && ALGO.cardKind(c) !== 'devoir')
      .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
      .sort((a, b) => {
        const aLate = ALGO.isOverdue(a.card, ref) ? 1 : 0;
        const bLate = ALGO.isOverdue(b.card, ref) ? 1 : 0;
        if (bLate !== aLate) return bLate - aLate;
        return b.score.total - a.score.total;
      });
  };

  // Pioche la carte la plus urgente en tête de file, en évitant la matière précédente si possible
  ALGO._pickAvoidMat = function (queue, lastMat) {
    if (!queue || !queue.length) return null;
    for (let i = 0; i < queue.length; i++) {
      if ((queue[i].mat || '?') !== lastMat) return queue.splice(i, 1)[0];
    }
    return queue.shift();
  };

  // Entrelacement long (X-) / court (Y-) + évitement matière consécutive (Rohrer & Taylor)
  // Les Y- sont tissées ENTRE les gros exos, pas reléguées en bloc final.
  ALGO.weaveSession = function (longCards, quickCards) {
    const longs = (longCards || []).slice();
    const shorts = (quickCards || []).slice();
    if (!shorts.length) return ALGO.interleaveMatieres(longs);
    if (!longs.length) return ALGO.interleaveMatieres(shorts);

    const out = [];
    let lastMat = null;
    let turnLong = true;

    while (longs.length || shorts.length) {
      let card = null;
      if (turnLong && longs.length) card = ALGO._pickAvoidMat(longs, lastMat);
      else if (!turnLong && shorts.length) card = ALGO._pickAvoidMat(shorts, lastMat);
      else if (longs.length) { card = ALGO._pickAvoidMat(longs, lastMat); turnLong = true; }
      else if (shorts.length) { card = ALGO._pickAvoidMat(shorts, lastMat); turnLong = false; }
      if (!card) break;
      out.push(card);
      lastMat = card.mat || '?';
      if (longs.length && shorts.length) turnLong = !turnLong;
      else turnLong = longs.length > 0;
    }
    return out;
  };

  // ===== Entrelacement matière + alternance long/court (Mode Colle) =====
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
  //   PHASE 2 — CARTES RAPIDES Y- (comblage tissé + fin de session) ───────
  //     · Tissées ENTRE les X- via weaveSession (long/court + matières)
  //     · Y- supplémentaires en fin de file si le budget le permet encore
  //
  // Entrelacement : weaveSession(X- + W- latents, Y-) puis comblage Y- final.
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

    // ===== PHASE 1a : MAIN (I_R, taxe d'entretien = retards d'abord) =====
    const seuilInclusion = (window.D && window.D.settings && window.D.settings.ankiUrgenceSeuil) || 0;
    const mainsScored = pileMain
      .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
      .sort((a, b) => {
        const aLate = ALGO.isOverdue(a.card, ref) ? 1 : 0;
        const bLate = ALGO.isOverdue(b.card, ref) ? 1 : 0;
        if (bLate !== aLate) return bLate - aLate;
        return b.score.total - a.score.total;
      });
    const mainsTaken = [];
    for (const x of mainsScored) {
      if (seuilInclusion > 0 && x.score.total < seuilInclusion) continue;
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

    // ===== PHASE 2 : Y- pour tissage (entre les gros exos) =====
    const maxQuick = (window.D && window.D.settings && window.D.settings.ankiMaxAnglaisFill) || 5;
    const quicksScored = pileQuick
      .map(c => ({ card: c, score: ALGO.urgenceScore(c, ref) }))
      .sort((a, b) => b.score.total - a.score.total);
    const quicksWoven = [];
    for (const x of quicksScored) {
      if (quicksWoven.length >= maxQuick) break;
      const t = _tempsCarte(x.card);
      if (used + t > budget) continue;
      quicksWoven.push(x.card);
      used += t;
    }

    // ===== TISSAGE long (X- + W- latents) ↔ court (Y-) =====
    const longPool = mainsTaken.concat(latentsTaken);
    const woven = ALGO.weaveSession(longPool, quicksWoven);

    // ===== Comblage final : Y- supplémentaires si budget reste =====
    const quicksExtra = [];
    for (const x of quicksScored) {
      if (quicksWoven.includes(x.card)) continue;
      const t = _tempsCarte(x.card);
      if (used + t > budget) break;
      quicksExtra.push(x.card);
      used += t;
    }

    const arranged = selected.concat(woven).concat(quicksExtra);
    const reportees = pool.filter(c => !arranged.includes(c));

    return {
      cartes: arranged,
      tempsTotalPrev: used,
      countDevoir:       selected.length + latentsTaken.length,
      countDevoirForce:  selected.length,
      countDevoirLatent: latentsTaken.length,
      countMain:         mainsTaken.length,
      countQuick:        quicksWoven.length + quicksExtra.length,
      countQuickWoven:   quicksWoven.length,
      countQuickExtra:   quicksExtra.length,
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

  ALGO.cardDuration = function (c) {
    if (!c) return 60;
    // Bout virtuel : toujours lire le parent live (évite tempsCible figé en file)
    if (c._devoirChunkOf && window.D) {
      const parent = ALGO.findCard(window.D, c._devoirChunkOf);
      if (parent) return ALGO.cardDuration(parent);
    }
    if (c._devoirChunkOf && c.tempsCible) return Math.max(60, c.tempsCible);
    if (c.type === 'devoir' || c.type === 'devoir-morceau' || ALGO.cardKind(c) === 'devoir') {
      const restants = Math.max(1, (c._morceauxTotal || 1) - (c._morceauxFaits || 0));
      let restantMin;
      if (c._tempsRestantMin != null && c._tempsRestantMin >= 0) {
        restantMin = c._tempsRestantMin;
      } else if (c._dureeTotaleMin != null) {
        // Ancien modèle : durée totale du DM (parfois encore le total initial)
        const total = Math.max(1, c._morceauxTotal || 1);
        const faits = c._morceauxFaits || 0;
        restantMin = faits > 0
          ? (c._dureeTotaleMin * restants) / total
          : c._dureeTotaleMin;
      } else {
        restantMin = ((c.tempsCible || 60) / 60) * restants;
      }
      return Math.max(60, Math.round((restantMin / restants) * 60));
    }
    return (c.tempsCible || 60);
  };

  function _tempsCarte(c) { return ALGO.cardDuration(c); }

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

  // Session Rapide (Y- uniquement) : tri I_R puis entrelacement matières
  ALGO.buildQuickSession = function (exercices) {
    const pool = (exercices || []).filter(c => ALGO.isActive(c) && ALGO.cardKind(c) === 'quick');
    const sorted = pool
      .map(c => ({ card: c, score: ALGO.urgenceScore(c) }))
      .sort((a, b) => b.score.total - a.score.total)
      .map(x => x.card);
    return ALGO.interleaveMatieres(sorted);
  };

  // Alias rétrocompat — préférer buildQuickSession ou interleaveMatieres
  ALGO.interleave = function (cards) { return ALGO.interleaveMatieres(cards || []); };

  // ===== Décalage automatique : cartes en retard → aujourd'hui (max 1×/jour) =====
  ALGO.shiftProgramIfMissed = function (cards) {
    const today = ALGO.todayISO();
    const skipped = (cards || []).filter(c =>
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

  /** Toutes les cartes Synchrotron : X-/Y- dans exercices + W- dans devoirs. */
  ALGO.allCards = function (D) {
    if (!D) return [];
    return (D.exercices || []).concat(D.devoirs || []);
  };

  ALGO.findCard = function (D, id) {
    if (!D || !id) return null;
    // Bouts virtuels W-xxx#n → parent W-xxx
    const baseId = String(id).split('#')[0];
    return (D.exercices || []).find(c => c.id === id || c.id === baseId)
      || (D.devoirs || []).find(c => c.id === id || c.id === baseId)
      || null;
  };

  /** Parent réel d'un bout de DM (chunk session) ou de l'ancien devoir-morceau. */
  ALGO.resolveDevoirParent = function (D, card) {
    if (!card) return null;
    if (card._devoirChunkOf) return ALGO.findCard(D, card._devoirChunkOf) || card;
    if (card.type === 'devoir-morceau' && card._morceauOf) {
      return ALGO.findCard(D, card._morceauOf) || card;
    }
    return card;
  };

  ALGO.allExistingIds = function (D) {
    const ids = new Set();
    if (!D) return ids;
    ALGO.allCards(D).forEach(c => { if (c && c.id) ids.add(c.id); });
    (D.cours || []).forEach(c => { if (c && c.uid) ids.add(c.uid); });
    return ids;
  };

  ALGO.migrateImportance = function (card) {
    if (!card) return;
    if (typeof card.importance === 'number' && card.importance >= 1 && card.importance <= 5) {
      delete card.priorite;
      return;
    }
    const p = card.priorite;
    if (p === 1) card.importance = 5;
    else if (p === 3) card.importance = 1;
    else if (p === 2) card.importance = 3;
    else if (p >= 1 && p <= 5) card.importance = Math.round(p);
    else if (card.importance == null) card.importance = ALGO.DEFAULT_IMPORTANCE;
    delete card.priorite;
  };

  /** Migration données : W- → devoirs, attente → reservoir, priorite → importance. */
  ALGO.migrateData = function (D) {
    if (!D) return;
    if (!Array.isArray(D.exercices)) D.exercices = [];
    if (!Array.isArray(D.devoirs)) D.devoirs = [];
    const moved = [];
    D.exercices = D.exercices.filter(c => {
      const isW = c.type === 'devoir' || ALGO.cardKind(c) === 'devoir'
        || (c.id && String(c.id).startsWith('W-'));
      if (isW) { moved.push(c); return false; }
      return true;
    });
    moved.forEach(c => {
      if (!D.devoirs.some(d => d.id === c.id)) D.devoirs.push(c);
    });
    ALGO.allCards(D).forEach(c => {
      if (c.statut === 'attente') c.statut = 'reservoir';
      // Alias legacy / démo → statut canonique des DM achevés
      if (c.statut === 'termine' || c.statut === 'terminé' || c.statut === 'Termine' || c.statut === 'Terminé') {
        c.statut = 'fini';
      }
      ALGO.migrateImportance(c);
      if (!Array.isArray(c.coursIds)) c.coursIds = c.coursId ? [c.coursId] : [];
      if (!c.profil && ALGO.cardKind(c) === 'quick') c.profil = 'ANGLAIS';
      else if (!c.profil) c.profil = 'COURS';
      // DM : renseigner temps restant / session min si absents (rétrocompat)
      if (ALGO.cardKind(c) === 'devoir' || c.type === 'devoir') {
        const restants = Math.max(1, (c._morceauxTotal || 1) - (c._morceauxFaits || 0));
        if (c._tempsRestantMin == null) {
          if (c._dureeTotaleMin != null) {
            const total = Math.max(1, c._morceauxTotal || 1);
            const faits = c._morceauxFaits || 0;
            c._tempsRestantMin = faits > 0
              ? Math.round((c._dureeTotaleMin * restants) / total)
              : c._dureeTotaleMin;
          } else {
            c._tempsRestantMin = Math.round(((c.tempsCible || 60) / 60) * restants);
          }
        }
        if (c._sessionMinMin == null) {
          c._sessionMinMin = Math.max(5, Math.round((c.tempsCible || 1500) / 60));
        }
        if (c._tempsProposeMin == null) c._tempsProposeMin = c._tempsRestantMin;
        if (c._dureeTotaleMin == null) c._dureeTotaleMin = c._tempsRestantMin;
      }
    });
  };

  /** Rattrapage des retards — une seule fois par jour calendaire (pas à chaque onglet). */
  ALGO.shiftProgramIfMissedDaily = function (D) {
    if (!D) return { shifted: 0 };
    if (!D.settings) D.settings = {};
    const today = ALGO.todayISO();
    if (D.settings.lastMissedShiftISO === today) return { shifted: 0, alreadyDone: true };
    const result = ALGO.shiftProgramIfMissed(ALGO.allCards(D));
    if (result.shifted > 0) {
      D.settings.lastMissedShiftISO = today;
      ALGO.log('auto-shift-daily', { count: result.shifted, date: today });
    }
    return result;
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
