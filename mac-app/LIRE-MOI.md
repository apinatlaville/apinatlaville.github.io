# Mes Cours pour Mac

Application qui ouvre le site [Mes Cours](https://apinatlaville.github.io/) dans **une fenêtre dédiée de ton navigateur**.

Ce n’est pas un deuxième navigateur : Chrome (ou Brave / Edge) est lancé en mode application, **avec ton profil habituel**. La connexion Google du site est donc la même que dans Chrome.

## Installer

1. Ouvre le dossier `mac-app`.
2. Double-clique sur `installer.command`  
   (ou glisse `Mes Cours.app` dans le dossier Applications).
3. Au premier lancement, si macOS dit que l’app n’est pas signée : **clic droit → Ouvrir**.
4. (Optionnel) Glisse Mes Cours du dossier Applications vers le Dock.

## Comportement

| Navigateur trouvé | Fenêtre |
| --- | --- |
| Chrome, Brave, Edge, Vivaldi, Chromium, Arc | Fenêtre site, sans onglets, **même compte Google** |
| Safari seulement | Ouvre le site dans Safari (un onglet). Pour une vraie app Safari : Safari → **Fichier → Ajouter au Dock** |

## Désinstaller

Supprime `/Applications/Mes Cours.app`. Aucune donnée du site n’est dans cette app : tout reste dans le navigateur (cookies, localStorage).
