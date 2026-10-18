/**
 * Helper partagé par les tests : extrait le corps d'une fonction/bloc dans un
 * source JS (comptage d'accolades naïf, suffisant pour du code applicatif) afin
 * que les regex ne matchent pas par hasard ailleurs dans le fichier.
 * Retourne '' si le marqueur est introuvable.
 */
export function sliceBlock(src, marker, maxLen = 40000) {
  const start = src.indexOf(marker);
  if (start < 0) return '';
  const open = src.indexOf('{', start + marker.length);
  if (open < 0) return '';
  let depth = 0;
  const end = Math.min(src.length, open + maxLen);
  for (let i = open; i < end; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start, end);
}

/** Tous les blocs ouverts par `marker` (ex. chaque `.catch(function (err)` d'une fonction). */
export function sliceAll(src, marker, maxLen = 40000) {
  const out = [];
  let from = 0;
  for (;;) {
    const idx = src.indexOf(marker, from);
    if (idx < 0) return out;
    out.push(sliceBlock(src.slice(idx), marker, maxLen));
    from = idx + marker.length;
  }
}

/**
 * Invariants anti double-notation de evalCardV2, vérifiés sur CHAQUE chemin
 * (devoir + évaluation normale) :
 *  - verrou S._evalBusy avant toute mutation ;
 *  - chaque avance de file en mémoire est suivie directement de la save
 *    (render seulement dans le .then, après persist) ;
 *  - chaque .catch libère le verrou ET avance quand même l'UI (la note est déjà
 *    appliquée en mémoire : rester sur la carte permettrait de la noter 2×).
 */
export function evalCardV2SafetyReport(ankiSrc) {
  const body = sliceBlock(ankiSrc, 'window.evalCardV2 = function');
  const busyGuard = /if \(S\._evalBusy\) return;[\s\S]*?S\._evalBusy = true;/.test(body);
  const advanceCalls = (body.match(/advanceSessionQueueInMemory\(/g) || []).length;
  const advanceThenPersist = (body.match(/advanceSessionQueueInMemory\(\);\s*Promise\.resolve\(persistSession\(\)\)\.then\(function \(\) \{/g) || []).length;
  const catches = sliceAll(body, '.catch(function (err)');
  const safeCatches = catches.filter(c => /S\._evalBusy = false;/.test(c)
    && /if \(!cont\) endSession\(\);\s*else renderSessionOverlay\(\)/.test(c)).length;
  return {
    busyGuard,
    advanceCalls,
    advanceThenPersist,
    catches: catches.length,
    safeCatches,
    persistBeforeRender: advanceCalls >= 1 && advanceCalls === advanceThenPersist,
    catchAdvances: catches.length >= advanceThenPersist && advanceThenPersist >= 1 && safeCatches === catches.length,
  };
}
