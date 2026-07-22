# PrettyDrama Voices

Outil libre pour troupes de théâtre : répétition « à l'italienne » avec les vraies
voix des acteurs. Site statique (GitHub Pages) + GitHub Action Python/ffmpeg.
Tout est en français côté utilisateur (UI, messages d'erreur, issues).

## Architecture

- **Frontend** : React + Vite, multi-pages (pas de SPA). Entrées déclarées dans
  `vite.config.js` : `index.html` (accueil), `rehearsal.html`, `recorder.html`,
  `dashboard.html`, `editor.html`. Sources dans `src/<page>/`, partagé dans
  `src/shared/` (`data.js` = fetch + helpers, `useManifest.js`,
  `PageHeader.jsx`, `PageState.jsx` = écran chargement/erreur commun,
  `theme.css`). `dist/` est gitignoré, build en CI.
- **Backend** : aucun serveur. `.github/workflows/build.yml` traite les uploads,
  reconstruit le manifest, déploie Pages, PUIS commit les résultats (jamais de
  commit si le déploiement échoue). Une seule exécution à la fois (concurrency).
  En cas d'échec : issue GitHub en français + statut dans le README.
- Dev : `npm run dev` (un middleware Vite sert `data/` et `clips/` depuis le
  repo avec de vrais 404), `npm run build`. Tests Python :
  `python3 -m unittest discover -s scripts/tests` (statuts + normalisation,
  cas partagés dans `normalize-cases.json`). Pas de tests JS.

## Flux de données

1. `data/script.json` — **source de vérité**, produit par l'éditeur (téléchargé
   puis uploadé à la main sur github.com, donc potentiellement malformé :
   tout consommateur doit être tolérant, cf. `sanitize_script`).
2. Page Enregistrement → ZIP `voix-<slug>.zip` contenant :
   - `manifest.json` : **mapping nu `{lineId: texte brut au moment de
     l'enregistrement}`** (rien d'autre — ni nom de fichier ni personnage) ;
   - un audio `{lineId}.{ext}` par réplique (`ext` = webm/mp4/ogg selon le
     navigateur, cf. `extensionForMimeType`). L'Action retrouve le fichier
     depuis l'id seul.
3. L'acteur envoie le ZIP au responsable, qui le glisse dans `uploads/voix/`.
4. `scripts/process_uploads.py` : valide TOUT le manifest, transcode chaque clip
   (ffmpeg : trim silences + loudnorm, mp3 mono 64 kbps) → `clips/{lineId}.mp3`
   et `data/clips.json` (`{lineId: texte brut}`). Merge **tout-ou-rien par ZIP** ;
   le ZIP est supprimé même en cas d'erreur (sinon il échouerait à chaque run) ;
   erreurs collectées dans `uploads_errors.json` pour l'issue.
5. `scripts/build_manifest.py` : join stateless `script.json` × `clips.json` →
   `data/manifest.json`, **seul fichier lu par les pages** (l'éditeur lit aussi
   `script.json`). Statut par réplique : `ok` / `perime` (« À refaire », texte
   modifié depuis l'enregistrement) / `manquant` (« À enregistrer »).

## Invariants (à ne pas casser)

- **Normalisation de texte : une seule implémentation**, `scripts/normalize.py`,
  appelée uniquement dans `build_manifest.compute_status`. Le navigateur stocke
  et transporte du texte **brut**, jamais normalisé.
- **Les ids de répliques ne sont jamais recyclés** (ils nomment les mp3).
  `SAFE_ID` (`src/editor/reducer.js`) et `LINE_ID_PATTERN`
  (`scripts/process_uploads.py`) doivent rester synchrones :
  `^[0-9a-zA-Z-]{1,64}$` (alphanumérique, pas seulement hex : ids lisibles
  édités à la main acceptés).
- Le format du ZIP est un contrat navigateur ↔ Action : toute modification doit
  toucher `downloadZip` (recorder `App.jsx`) ET `parse_manifest`
  (`process_uploads.py`) en même temps.
- `sanitize_script` (Python) est le miroir tolérant du `sanitizeScript` de
  l'éditeur : une entrée malformée est ignorée, jamais un crash de workflow.
  Asymétrie assumée : le JS valide chaque id contre `SAFE_ID` et **reminte** les
  ids invalides/dupliqués (il est le producteur, doit rester réparable) ; le
  Python ne vérifie qu'« id = chaîne non vide » (il ne peut pas reminter sans
  orpheliner les mp3 déjà nommés). C'est sans conséquence : un id hors `SAFE_ID`
  hand-édité dans `script.json` n'a jamais de clip (l'Action rejette ces ids à
  l'upload) → statut `manquant`, `clip: null`, aucune URL forgée n'est émise.
- Uploads hostiles : caps de taille réels (les en-têtes ZIP mentent), noms de
  membres validés par fullmatch, un ZIP cassé ne bloque jamais les autres.
- Prises d'enregistrement : en mémoire uniquement (garde `beforeunload` tant
  que non exportées), une seule prise par réplique, `URL.revokeObjectURL` à
  chaque remplacement.

## Repères rapides

| Quoi | Où |
| --- | --- |
| Lien GitHub affiché (footer accueil) | `src/home/App.jsx` — repo `ThomasParistech/prettydrama-voices` |
| Cartes de dialogue (look commun Répétition/Enregistrement) | `.dialogue-card` dans `src/shared/theme.css`, qui porte aussi la palette rose/doré « mes répliques » (`.dialogue-card.mine`) et la bordure `.active` communes — les pages posent `.mine` à côté de leur classe sémantique (`.muted` côté répétition, `.own` côté enregistrement) et ne gardent que leurs vrais écarts (`.hide-text`, `.fresh`, `.recording`…) ; côté enregistrement l'état des prises est porté par l'étiquette `.rec-status` orange/verte (palette en variables `--rec-*` locales à `recorder.css`) |
| Bandeau de pièce + barre de contrôle basse (communs Répétition/Enregistrement) | composants `src/shared/PlayHeader.jsx` (marque + label de page + titre, repliable) et `src/shared/ProgressBar.jsx` (slider indexé) ; CSS dans `theme.css` (`.play-header*`, `.controls`, `.ctrl-btn`…). Pas de tiret « — » dans les headers |
| Page Enregistrement | structurée comme la Répétition : sélecteurs acte/scène/personnage, navigation contrainte à SES répliques, micro central (SVG) dans la barre basse, bouton Télécharger à droite. Les prises survivent au changement de personnage (ZIP multi-voix : `voix-<noms>.zip`) |
| Statut des répliques (Enregistrement) | 3 états par réplique, étiquette au coin de la carte + légende en tête de liste : `todo` « À enregistrer » (point ambre), `fresh` « À télécharger » (prise de la séance, halo vert + lecteur vert vif — reste fresh MÊME après téléchargement du ZIP : « Déjà enregistrée » n'est vrai qu'une fois le ZIP intégré par le respo et le site republié), `done` « Déjà enregistrée » (clip publié à jour uniquement, lecteur vert grisé). Le téléchargement ne touche pas aux statuts, il ne pilote que la note « pas sauvegardé »/« téléchargé » ; ◀ ▶ parcourent TOUTES mes répliques ; l'avertissement « pas sauvegardé » vit dans le bandeau du HAUT (jamais dans la barre basse) ; lecteur intégré à la carte (`TakePlayer` : play rond, durée avec workaround Infinity des blobs MediaRecorder, onde décorative déterministe) |
| Couleurs des personnages (éditeur) | teinte **stockée** sur le personnage (`{id, name, hue}` dans script.json) ; palette `CHARACTER_HUES` (12 teintes, rendu `oklch(0.58 0.14 H)`, attribution auto entrelacée via `HUE_ASSIGN_ORDER`) dans `src/editor/reducer.js`, helpers dans `CharacterPanel.jsx` ; auto = 1re libre, modifiable via popover ; teinte invalide réparée au chargement |
| Design « Rail » de l'éditeur | tokens re-skinnés dans `src/editor/editor.css` (`:root` local à la page) : même fond crème `--paper` que les autres pages, filets/neutres réchauffés assortis, accent `#7a5cc0`, fonts IBM Plex Sans/Mono + Spectral (chargées par `editor.html`) — les autres pages gardent le thème chaud partagé. Le re-skin ne fuit jamais dans le bandeau partagé : PageHeader/PlayHeader consomment les tokens réservés `--header-accent`/`--header-serif` (theme.css), qu'aucune page ne redéfinit (Cormorant 700 chargée aussi par `editor.html`). Les répliques de la scène vivent dans UN panneau blanc (`.line-list` : card blanche arrondie sur le crème, lignes fines à filet 1px dedans) pour le même contraste blanc-sur-crème que les cartes des autres modes |
| Navigation d'édition | une scène à la fois via le `PlayHeader` partagé (acte/scène + « + Scène »/« + Acte ») ; à la place du select personnage des autres pages : la **gestion** des personnages en puces (`CharacterChips` dans `src/editor/CharacterPanel.jsx`) ; titre de pièce éditable dans le bandeau ; bouton Télécharger dans les `actions` du bandeau |
| Enregistrement micro | `src/recorder/useRecorder.js` (MediaRecorder, stream réutilisé, `release()` en fin de session) |
| Construction du ZIP | `downloadZip` dans `src/recorder/App.jsx` |
| Filtre audio ffmpeg | `AUDIO_FILTER` dans `scripts/process_uploads.py` |
| Chemins repo côté Python | `scripts/common.py` (`REPO_ROOT`, `write_json`) |
| Middleware dev data/clips | `serveRepoData` dans `vite.config.js` |

Pour tester les pages sans build : éditer `data/manifest.json` à la main puis
`npm run dev`.
