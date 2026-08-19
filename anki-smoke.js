/**
 * anki-smoke.js — Tests smoke (console) pour Synchrotron
 * Résultats : window.ankiSmokeResults + console.table
 */
(function () {
  function log(msg, ok, detail) {
    const row = { test: msg, ok: !!ok, detail: detail || '' };
    if (!window.ankiSmokeResults) window.ankiSmokeResults = [];
    window.ankiSmokeResults.push(row);
    if (!ok) console.error('[SMOKE FAIL]', msg, detail || '');
    else console.log('[SMOKE OK]', msg);
    return ok;
  }

  window.runAnkiSmokeTests = function () {
    window.ankiSmokeResults = [];
    const A = window.AnkiAlgo;
    if (!A) return log('AnkiAlgo chargé', false, 'window.AnkiAlgo manquant');

    const sample = {
      settings: { ankiCoefs: {} },
      matieres: [{ id: 'MATH', label: 'MATH', name: 'Maths', color: '#f0c060' }],
      cours: [{ uid: 'MA-001', title: 'Test', mat: 'MATH' }],
      exercices: [
        { id: 'X-AAA', mat: 'MATH', profil: 'COURS', question: 'q', statut: 'actif', importance: 3, intervalle: 1, ease: 2.5, repetitions: 1, dateProchaineRevision: '2020-01-01', historique: [], coursIds: [] },
        { id: 'Y-BBB', mat: 'MATH', profil: 'ANGLAIS', question: 'y', statut: 'reservoir', importance: 3, intervalle: 0, ease: 2.5, repetitions: 0, coursIds: [] },
        { id: 'W-CCC', type: 'devoir', mat: 'MATH', profil: 'EXO', question: 'dm', statut: 'actif', importance: 5, dateLimite: '2099-12-31', coursIds: [], historique: [] }
      ],
      devoirs: []
    };

    A.migrateData(sample);
    log('migrateData : W- → devoirs', sample.devoirs.some(c => c.id === 'W-CCC') && !sample.exercices.some(c => c.id === 'W-CCC'));
    log('migrateData : attente → reservoir', !sample.exercices.some(c => c.statut === 'attente'));
    log('migrateData : importance présent', sample.exercices.every(c => typeof c.importance === 'number'));

    const ids = new Set();
    for (let i = 0; i < 200; i++) {
      const id = A.genExoUid('X', Array.from(ids));
      if (ids.has(id)) { log('genExoUid unique (200×)', false, 'collision ' + id); break; }
      ids.add(id);
      if (i === 199) log('genExoUid unique (200×)', true);
    }

    const allIds = A.allExistingIds(sample);
    log('allExistingIds inclut cours', allIds.has('MA-001'));
    log('allExistingIds inclut X-/Y-/W-', allIds.has('X-AAA') && allIds.has('Y-BBB') && allIds.has('W-CCC'));

    log('findCard W-', A.findCard(sample, 'W-CCC') && A.findCard(sample, 'W-CCC').type === 'devoir');
    log('findCard X-', !!A.findCard(sample, 'X-AAA'));

    const shiftData = JSON.parse(JSON.stringify(sample));
    shiftData.settings.lastMissedShiftISO = null;
    const r1 = A.shiftProgramIfMissedDaily(shiftData);
    log('shiftProgramIfMissedDaily décale retards', r1.shifted >= 1);
    const r2 = A.shiftProgramIfMissedDaily(shiftData);
    log('shiftProgramIfMissedDaily 1×/jour max', r2.shifted === 0 && r2.alreadyDone);

    const fns = [
      'renderAnkiV2', 'ankiV2SetView', 'ankiV2OpenExoModal', 'ankiV2OpenDevoirModal', 'startAnkiV2Session',
      'renderFlashcards', 'quickAdd', 'quickActivate', 'renderAnkiVizV2', 'save'
    ];
    fns.forEach(name => log('window.' + name, typeof window[name] === 'function'));

    const fails = window.ankiSmokeResults.filter(r => !r.ok);
    console.table(window.ankiSmokeResults);
    console.log('[SMOKE] ' + (fails.length ? fails.length + ' échec(s)' : 'Tous les tests OK'));
    return fails.length === 0;
  };

  if (typeof document !== 'undefined') {
    function scheduleSmoke() {
      setTimeout(function () {
        if (!window.AnkiAlgo) return;
        var q = (window.location && window.location.search) || '';
        if (q.indexOf('smoke=1') < 0) return;
        var chain = Promise.resolve();
        if (typeof window.ensureAnkiUi === 'function') chain = chain.then(function () { return window.ensureAnkiUi(); });
        if (typeof window.ensureScriptsForTab === 'function') {
          chain = chain
            .then(function () { return window.ensureScriptsForTab('flashcards'); })
            .then(function () { return window.ensureScriptsForTab('ankiVizV2'); });
        }
        chain.then(function () { window.runAnkiSmokeTests(); })
          .catch(function () { window.runAnkiSmokeTests(); });
      }, 800);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleSmoke);
    } else {
      scheduleSmoke();
    }
  }
})();
