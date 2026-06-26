# Synchrotron v1 (archivé)

UI et visualisations de la **v1** du mode Synchrotron, retirées de l'app active (V2 uniquement).

## Contenu

| Fichier | Rôle |
|---------|------|
| `anki-app.js` | UI Synchrotron v1 (`renderAnki`, session, cockpit, réglages profils…) |
| `anki-viz.js` | Carte mentale interactive v1 |
| `anki-viz-compare.js` | Page comparaison v1 vs v2 |

## Moteur partagé (racine du projet)

Ces fichiers **ne sont pas** dans ce dossier — ils restent chargés en prod :

- `anki-algo.js` — algorithme de base (intervalles, scores, migration…)
- `anki-algo-v2.js` — extensions V2 (phases, fenêtres ★…)

## Réactiver la v1 (dev)

1. Remettre les panes dans `index.html` : `paneAnki`, `paneAnkiViz`, `paneAnkiCompare`
2. Charger les scripts depuis `archive/anki-v1/` (lazy ou boot)
3. Dans `nav-config.js`, retirer `archived: true` sur les entrées concernées
4. `anki-algo.js` doit être chargé avant `anki-viz.js`

Les URLs / onglets `anki`, `ankiViz`, `ankiCompare` redirigent encore vers la V2 via `resolveTabId()`.
