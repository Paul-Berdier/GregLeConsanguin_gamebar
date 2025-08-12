# Greg – Widget Xbox Game Bar (FR)

Un widget **Xbox Game Bar** pour Windows qui affiche/contrôle la musique de **Greg le Consanguin**.
Le widget charge l’overlay (HTML/JS/CSS) dans une WebView et se connecte à ton **backend Flask + Socket.IO** (par défaut `http://localhost:3000`, ou ton domaine Railway).

---

## Fonctionnalités

* Affiche la piste en cours (titre, vignette) + **barre de progression** (temps écoulé / total).
* **Contrôles**: lecture/pause, suivant, redémarrer, stop, répétition de la file.
* **Ajout rapide**: colle une URL ou une recherche ; suggestions (Top 3).
* **Overlay double-mode**:

   * **HUD minimal** (translucide, non intrusif) – affiche titre + progression.
   * **Panneau complet** (file d’attente + contrôles).
   * **Raccourci**: **Ctrl + Q** pour basculer HUD ↔ Panneau.
* **Socket.IO** en temps réel + REST API.
* **OAuth Discord (optionnel)**: bouton *Se connecter* si ton backend expose `/login` (cookies de session).

---

## Arborescence (projet widget)

```
gamebar_widget/
├── GregGameBarWidget.csproj
├── Package.appxmanifest            # Extension Game Bar (com.microsoft.gamebar.widget)
├── App.xaml / App.xaml.cs
├── MainPage.xaml / MainPage.xaml.cs # WebView2 -> Assets/index.html
└── Assets/
    ├── index.html
    ├── overlay.js
    └── overlay.css
```

> Les fichiers `index.html`, `overlay.js`, `overlay.css` sont les mêmes que ceux utilisés côté web/Flask, adaptés pour pointer vers ton serveur.

---

## Prérequis

* **Windows 10/11** avec **Barre de jeu Xbox** activée.
* **Visual Studio 2022** (ou + récent) avec la charge de travail **UWP**.
* **Mode développeur** activé :

   * *Paramètres → Confidentialité et sécurité → Pour les développeurs → Mode développeur*.

---

## Configuration du backend

1. Démarre le serveur Flask/Socket.IO (ex: `python main.py`).
2. Depuis le **panneau de configuration** du widget (icône ⚙️ dans le HUD), saisis l’URL de ton serveur :

   * Local: `http://localhost:3000`
   * Railway: `https://ton-app.up.railway.app`
3. (Optionnel) OAuth :

   * Clique **Se connecter avec Discord** (le lien pointe vers `${serverUrl}/login`).
   * Pour que la session fonctionne, le widget doit pouvoir atteindre le **même domaine** que ton backend (les cookies de session ne passent pas entre domaines différents).

---

## Build & Sideload (installation hors Store)

1. **Ouvre le projet** `GregGameBarWidget.csproj` dans Visual Studio.
2. Configuration **x64** (ou ARM64 selon ta machine).
3. **Publier** :

   * Clic droit sur le projet → *Publish → Create App Packages…*
   * Choisis **Sideloading**.
   * **Signer**: utilise un certificat existant ou crée un **certificat de test**.
   * Visual Studio génère un **`.msixbundle`** + le **.cer** (certificat).
4. **Installer sur ta machine** :

   * Double-clique le `.cer` → installer dans **Current User → Trusted People**.
   * Double-clique le `.msixbundle` (ou lance `Add-AppxPackage` en PowerShell).
5. **Installer sur une autre machine** :

   * Copier le `.msixbundle` + `.cer`.
   * Importer le `.cer` (Trusted People).
   * Exécuter :

     ```powershell
     Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
     Add-AppxPackage .\GregOverlay.msixbundle
     ```

> Option : fournis un `install.ps1` qui fait `Import-Certificate` + `Add-AppxPackage` automatiquement.

---

## Lancer le widget

* **En jeu** : appuie **Win + G** pour ouvrir la Game Bar → menu **Widgets** → *Greg Game Bar Widget* → **Épingler** pour le garder visible.
* **Par URI** :

  ```text
  ms-gamebarwidget://?widgetId=<PFN>!<WidgetId>
  ```

   * **PFN** (Package Family Name) :

     ```powershell
     Get-AppxPackage *Greg* | Select PackageFamilyName
     ```
   * **WidgetId** : attribut `Id` de `<uap3:AppExtension>` dans `Package.appxmanifest`.

Exemple PowerShell :

```powershell
$pfn = (Get-AppxPackage *GregOverlay*).PackageFamilyName
start "ms-gamebarwidget://?widgetId=$pfn!GregOverlayWidget"
```

---

## Utilisation

* **HUD ↔ Panneau** : **Alt + Shift + O** (j'ai quelque probleme pour le changer mais on verra)
* **Lecture/Pause** : bouton central (icône bascule Play/Pause)
* **Suivant** : ⏭
* **Redémarrer la piste** : ⏮
* **Stop** : ⏹
* **Répéter la file** : 🔁 (devient actif visuellement)
* **Ajouter un titre/URL** : champ en haut + bouton **+**
* **Suggestions** : s’affichent sous le champ (Top 3) → clique pour ajouter

---

## Dépannage (FAQ)

**Le widget ne s’ouvre pas dans un jeu plein écran.**
→ Certains jeux en *exclusive fullscreen* bloquent Win+G. Active *Ouvrir la barre de jeu au-dessus des jeux en plein écran pris en charge* dans les paramètres de la Game Bar, ou passe le jeu en *fullscreen optimisé* / *fenêtré sans bordure*.

**Les boutons répondent mais l’ajout dit « user\_id requis ».**
→ Connecte-toi avec Discord (bouton **Se connecter**) pour que le backend obtienne ton `user_id` via la session.
→ Sinon, utilise le bot directement dans Discord pour lancer Greg dans un vocal, puis contrôle via le widget.

**La progression/miniature ne s’affiche pas.**
→ Assure-toi d’utiliser la branche avec `playlist_update` enrichi (**progress**, **thumbnail**, **repeat\_all**) côté `commands/music.py`.

**OAuth n’a pas l’air de fonctionner.**
→ Les cookies de session ne sont valides que sur **le même domaine** que ton backend. Depuis le widget, configure **exactement** ton domaine (ex: `https://ton-app.up.railway.app`) dans ⚙️.

**CORS / 401 / 404.**
→ Vérifie que tes routes Flask existent (`/api/play`, `/api/pause`, `/api/skip`, `/api/playlist`, `/api/me`, `/api/guilds`, `/autocomplete`) et que Socket.IO accepte `cors_allowed_origins="*"` (ou ton domaine).

---

## Désinstallation

* **Paramètres Windows → Applications → Applications installées** → rechercher « Greg » → **Désinstaller**,
  ou
* **PowerShell** :

  ```powershell
  Get-AppxPackage *GregOverlay* | Remove-AppxPackage
  ```

---

## Sécurité & conformité

* Le widget **n’injecte rien** dans les jeux et ne hooke **aucune API** du jeu → pas de risque *anti-cheat* lié à ce projet.
* Respecte les CGU **Xbox Game Bar** et celles des plateformes musicales utilisées (YouTube/SoundCloud).

---

## Astuces

* Tu peux préconfigurer `serverUrl` : ouvre ⚙️ et saisis une fois ton domaine Railway ; la valeur est mémorisée (localStorage).
* Tu peux lancer directement le widget avec un **raccourci** `.url` pointant vers l’URI `ms-gamebarwidget://…`.