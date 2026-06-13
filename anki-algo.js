/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * FICHIER ACTUEL : anki-algo.js (Moteur Mathématique du Mode Synchrotron)
 *
 * 🏗️ ARCHITECTURE MULTI-FICHIERS :
 *  1. app.js        : Cœur (Firebase, État global window.D, Navigation, Paramètres)
 *  2. data.js       : CRUD Cours, Classeurs, Matières
 *  3. scanner.js    : Scanner codes-barres 1D
 *  4. anki-algo.js  : [CE FICHIER] Algorithme Répétition Espacée Vitesse+Exactitude
 *  5. anki-app.js   : UI/Workflow du Mode Synchrotron (cockpit, sessions, CRUD exos)
 *
 * 👉 RÔLE : Calculs purs (aucun DOM, aucun Firebase) :
 *   - Génération UID au format PH-AAA (3 lettres pures)
 *   - Calcul du prochain intervalle de révision (Vitesse + Exactitude)
 *   - Sélection des cartes "dues"
 *   - Construction du Cockpit du jour (taxe + devoirs + comblement)
 * =========================================================================================
 */

(function () {
  const ALGO = {};

  // ----- Constantes algorithmiques -----
  ALGO.MIN_EASE = 1.3;
  ALGO.DEFAULT_EASE = 2.5;
  ALGO.QUOTA_DEFAULT_MIN = 90; // 1h30 par défaut
  ALGO.LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // ----- Date helpers -----
  ALGO.todayISO = function () {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  };

  ALGO.addDays = function (iso, n) {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Math.round(n));
    return d.toISOString().split("T")[0];
  };

  ALGO.isDue = function (card, refIso) {
    if (!card || card.statut !== "actif") return false;
    if (!card.dateProchaineRevision) return true;
    return card.dateProchaineRevision <= (refIso || ALGO.todayISO());
  };

  // ----- UID Generator format PH-AAA (3 lettres pures) -----
  // exos: 3 lettres pour distinguer visuellement des cours (PH-A1B alphanum)
  ALGO.genExoUid = function (matierePrefix, existingIds) {
    const prefix = (matierePrefix || "XX").substring(0, 2).toUpperCase();
    const used = new Set(existingIds || []);
    let attempts = 0;
    while (attempts < 5000) {
      let suffix = "";
      for (let i = 0; i < 3; i++) {
        suffix += ALGO.LETTERS.charAt(Math.floor(Math.random() * 26));
      }
      const code = prefix + "-" + suffix;
      if (!used.has(code)) return code;
      attempts++;
    }
    // fallback ultra rare
    return prefix + "-" + Date.now().toString(36).substring(0, 3).toUpperCase();
  };

  // ----- Cœur de l'algorithme : exactitude + vitesse -----
  // qualite : 0 = blocage, 1 = étourderie, 2 = parfait
  // tempsReel en secondes ; tempsCible en secondes
  ALGO.computeNextInterval = function (card, qualite, tempsReel) {
    const c = Object.assign(
      { intervalle: 0, ease: ALGO.DEFAULT_EASE, repetitions: 0, tempsCible: 60 },
      card || {}
    );
    let ease = c.ease || ALGO.DEFAULT_EASE;
    let intervalle = c.intervalle || 0;
    let repetitions = c.repetitions || 0;
    const cible = c.tempsCible || 60;

    if (qualite === 0) {
      // Blocage total → reset
      repetitions = 0;
      intervalle = 0;
      ease = Math.max(ALGO.MIN_EASE, ease - 0.2);
    } else {
      // Réussite (étourderie ou parfaite)
      if (repetitions === 0) intervalle = 1;
      else if (repetitions === 1) intervalle = 3;
      else intervalle = Math.round(intervalle * ease);

      repetitions += 1;

      if (qualite === 1) {
        // Étourderie : ease descend un peu
        ease = Math.max(ALGO.MIN_EASE, ease - 0.15);
      } else {
        // Parfait : ease monte
        ease = ease + 0.1;
      }
    }

    // ----- Pénalité Vitesse (spécifique PC* / X / ENS) -----
    // Si timeReel > 1.5 * cible et qualité > 0 → intervalle * 0.7 (force la fluidité)
    let penaliteVitesse = 1;
    if (qualite > 0 && tempsReel && cible) {
      const ratio = tempsReel / cible;
      if (ratio > 2) penaliteVitesse = 0.5;
      else if (ratio > 1.5) penaliteVitesse = 0.7;
      else if (ratio < 0.8) penaliteVitesse = 1.1; // bonus si très rapide
    }
    intervalle = Math.max(0, Math.round(intervalle * penaliteVitesse));

    return {
      intervalle: intervalle,
      ease: parseFloat(ease.toFixed(2)),
      repetitions: repetitions,
      dateProchaineRevision: ALGO.addDays(ALGO.todayISO(), intervalle),
      penaliteVitesse: penaliteVitesse,
    };
  };

  // ----- Sélection des cartes dues -----
  ALGO.getDueCards = function (cards, refIso) {
    if (!Array.isArray(cards)) return [];
    const ref = refIso || ALGO.todayISO();
    return cards.filter((c) => ALGO.isDue(c, ref));
  };

  // ----- Cockpit du jour : taxe d'entretien + devoirs + comblement -----
  // exercices : window.D.exercices
  // devoirs   : window.D.devoirs (optionnel)
  // quotaMin  : minutes (défaut 90)
  ALGO.buildCockpit = function (exercices, devoirs, quotaMin) {
    const quota = (quotaMin || ALGO.QUOTA_DEFAULT_MIN) * 60; // → secondes
    const today = ALGO.todayISO();

    // 1) Taxe d'entretien : toutes les cartes actives dues
    const due = ALGO.getDueCards(exercices || [], today)
      .slice()
      .sort((a, b) => (a.priorite || 2) - (b.priorite || 2));
    let tempsTaxe = 0;
    due.forEach((c) => (tempsTaxe += c.tempsCible || 60));

    // 2) Devoirs : ceux dont la date limite est proche
    const dvs = Array.isArray(devoirs) ? devoirs.slice() : [];
    dvs.sort((a, b) => (a.dateLimite || "").localeCompare(b.dateLimite || ""));
    let tempsDevoirs = 0;
    const devoirsRetenus = [];
    dvs.forEach((d) => {
      const dur = (d.dureeMin || 30) * 60;
      if (tempsTaxe + tempsDevoirs + dur <= quota) {
        devoirsRetenus.push(d);
        tempsDevoirs += dur;
      }
    });

    // 3) Comblement : pioche dans le Réservoir (statut=attente)
    const restant = quota - tempsTaxe - tempsDevoirs;
    const reservoir = (exercices || [])
      .filter((c) => c.statut === "attente")
      .sort((a, b) => {
        const pa = a.priorite || 2;
        const pb = b.priorite || 2;
        if (pa !== pb) return pa - pb;
        return (a.epinglee ? 0 : 1) - (b.epinglee ? 0 : 1);
      });
    let tempsCombl = 0;
    const nouvelles = [];
    for (const c of reservoir) {
      const t = c.tempsCible || 60;
      if (tempsCombl + t > restant) break;
      nouvelles.push(c);
      tempsCombl += t;
    }

    return {
      quotaSecondes: quota,
      tempsTaxe: tempsTaxe,
      tempsDevoirs: tempsDevoirs,
      tempsComblement: tempsCombl,
      tempsTotalPrev: tempsTaxe + tempsDevoirs + tempsCombl,
      tempsRestant: Math.max(0, quota - (tempsTaxe + tempsDevoirs + tempsCombl)),
      cartesDues: due,
      devoirsRetenus: devoirsRetenus,
      nouvellesCartes: nouvelles,
    };
  };

  // ----- Heatmap prévisionnelle (charge sur N jours) -----
  ALGO.forecastLoad = function (exercices, days) {
    const N = days || 14;
    const today = ALGO.todayISO();
    const map = {};
    for (let i = 0; i < N; i++) map[ALGO.addDays(today, i)] = 0;
    (exercices || []).forEach((c) => {
      if (c.statut !== "actif") return;
      const d = c.dateProchaineRevision || today;
      if (map.hasOwnProperty(d)) map[d] += c.tempsCible || 60;
      else if (d < today && map[today] !== undefined) map[today] += c.tempsCible || 60;
    });
    return map;
  };

  window.AnkiAlgo = ALGO;
})();
