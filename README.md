# Greg Overlay pour Overwolf (Mode développeur)

Ce dossier contient une extension Overwolf **non publiée** permettant d'afficher et contrôler la musique de Greg via un overlay HTML/JS.

## Contenu
- `index.html`, `overlay.js`, `overlay.css` : votre interface existante (non modifiée).
- `manifest.json` : description de l'extension pour Overwolf.
- `icon.png` : icône simple utilisée par Overwolf.
- `README.md` : ce fichier.

## Installation pour un ami

1. **Installer Overwolf** depuis <https://www.overwolf.com/>.
2. Ouvrir Overwolf, puis activer le **mode développeur** :
   - Paramètres → Général → **Enable Developer Mode**.
   - Cliquer sur **Reload Apps** pour appliquer.
3. Télécharger ou cloner ce dossier. Si vous avez reçu un fichier `.zip`, décompressez‑le.
4. Dans Overwolf, aller sur l’icône **Extensions**, puis cliquer sur **Load unpacked extension**.
5. Sélectionnez le dossier décompressé `GregOverlayOverwolf`. L’extension apparaîtra dans la liste.
6. Lancez l’overlay en cliquant dessus ; il s’ouvrira en surimpression. Épinglez‑le si nécessaire.

## Mise à jour

Pour mettre à jour, remplacez les fichiers `index.html`, `overlay.js` et `overlay.css` dans le dossier, puis dans Overwolf cliquez sur **Reload** sur la ligne de l’extension.

## Remarques

- Ce mode ne nécessite pas de publication officielle ni de signature. Il est destiné à des usages privés entre amis.
- Certains jeux avec anti‑cheat (comme Valorant) peuvent bloquer les overlays non approuvés. À utiliser à vos risques et périls.
- Pour changer l’URL du backend Greg, modifiez la constante `DEFAULT_SERVER` dans `overlay.js` ou via l’interface si prévue.

Bon jeu !
