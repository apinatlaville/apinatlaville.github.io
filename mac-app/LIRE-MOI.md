# Mes Cours pour Mac

Application qui ouvre le site [Mes Cours](https://apinatlaville.github.io/) dans **une fenêtre dédiée de ton navigateur**.

Ce n’est pas un deuxième navigateur : Chrome (ou Brave / Edge) est lancé en mode application, **avec ton profil habituel**. La connexion Google du site est donc la même que dans Chrome.

L’app n’est pas signée par Apple. Après un téléchargement, macOS affiche « non ouvert » / « Placer dans la corbeille ». **Ne mets pas à la corbeille.** Clique **Terminé**, puis débloque comme ci-dessous.

## Lancer (le plus simple)

1. Ouvre **Terminal** (Spotlight : `Cmd+Espace`, tape `Terminal`).
2. Colle ces deux lignes, Entrée :

```bash
xattr -dr com.apple.quarantine ~/Desktop/Mes-Cours-mac
open ~/Desktop/Mes-Cours-mac/"Mes Cours.app"
```

Si le dossier n’est pas sur le Bureau, remplace `~/Desktop/Mes-Cours-mac` par le vrai chemin (glisse le dossier dans la fenêtre Terminal pour le coller).

Sans Terminal : **Réglages Système → Confidentialité et sécurité** → tout en bas → **Ouvrir quand même**. Ensuite clic droit sur `Mes Cours.app` → **Ouvrir**.

## Mettre dans Applications (optionnel)

Après le `xattr` ci-dessus, tu peux glisser `Mes Cours.app` dans Applications, puis dans le Dock.

## Comportement

| Navigateur trouvé | Fenêtre |
| --- | --- |
| Chrome, Brave, Edge, Vivaldi, Chromium, Arc | Fenêtre site, sans onglets, **même compte Google** |
| Safari seulement | Ouvre le site dans Safari (un onglet). Pour une vraie app Safari : Safari → **Fichier → Ajouter au Dock** |

## Désinstaller

Supprime `Mes Cours.app` (Bureau ou `/Applications`). Aucune donnée du site n’est dans cette app : tout reste dans le navigateur (cookies, localStorage).
