# Bloc Ops — Suivi du projet

FPS web « à la Call of Duty », graphismes minimalistes façon blocs (style Roblox),
responsive mobile. Carte originale « Rue Atomique » inspirée de l'esprit des petites
maps symétriques (deux maisons face à face, bus au centre) — **pas une copie de
Nuketown** (design protégé par le droit d'auteur, on garde une version originale).

## ✅ Fait (session du 2026-07-10)

- Structure : `index.html`, `css/style.css`, `js/map.js`, `js/controls.js`, `js/game.js`
- Three.js r128 via CDN (nécessite une connexion internet)
- Carte symétrique : 2 maisons à étage (portes, fenêtres, escaliers praticables),
  bus central, 2 voitures, caisses, clôtures de spawn avec passages, murs d'enceinte
- Joueur : déplacement ZQSD/WASD + flèches, saut, gravité, collisions AABB avec
  montée de marche automatique (escaliers OK), pointer lock souris
- Armes : fusil d'assaut (20 dégâts, 25 balles, auto) et sniper (100 dégâts,
  5 balles, lunette avec zoom + overlay). Tir à la tête = dégâts ×2 (sniper tête = 200 = kill).
  Munitions illimitées mais rechargement obligatoire (AR 1,8 s / sniper 2,5 s)
- Santé : 200 PV, régénération auto après 5 s sans dégâts (60 PV/s)
- Règles : 2 équipes (Bleus/Rouges) 4v4, 1 point par élimination, victoire à 20 ;
  respawns fixes en rotation, protection de spawn 2 s (clignotement des bots, badge HUD)
- Bots IA : 7 bots (3 alliés + 4 ennemis), patrouille par waypoints, ligne de vue,
  strafe en combat, chance de toucher selon la distance, 12 % de tirs à la tête,
  chargeurs et rechargements respectés
- Mobile : joystick gauche (déplacement), joystick droit (visée), boutons TIR,
  ADS (bascule), SAUT, R (recharger), passage plein écran au lancement
- HUD : scores, barre de vie colorée, munitions, hitmarker (rouge si tête),
  kill feed, flash de dégâts, écran de mort avec compte à rebours, écran de victoire,
  reprise après perte du pointer lock

## ✅ Fait (session du 2026-07-11)

- **Testé en vrai** : syntaxe validée (`node --check`), jeu lancé dans Edge headless
  (Puppeteer) : 0 erreur console, partie jouée 60 s, les bots s'entretuent (score 4-6),
  au moins un bot monte à l'étage, HUD complet à l'écran. Reste à tester à la main
  sur PC et surtout sur un vrai téléphone.
- **Sons** (`js/audio.js`, Web Audio 100 % synthétisé) : tirs AR/sniper (les tirs des
  bots s'atténuent avec la distance), rechargement (début/fin), hitmarker, headshot,
  élimination, dégâts subis, mort, jingles victoire/défaite. Touche **M** = muet,
  bouton 🔊 dans le menu, préférence mémorisée (localStorage).
- **Effets de tir** (`js/effects.js`, tout en pool → zéro allocation en jeu) :
  traçantes (joueur ET bots), flash de bouche, gerbe d'impact (étincelles jaunes
  sur le décor, rouge sur un personnage), léger recul de FOV au sprint.
- **Bots à l'étage** : les waypoints 2D ont été remplacés par un **graphe de
  navigation 3D** (40 nœuds, liens praticables vérifiés : portes, escaliers,
  contournement voitures/caisses/clôtures) + BFS. Gravité simplifiée des bots
  (`groundY`) : ils montent les escaliers via `tryAxis`, marchent sur le plancher
  de l'étage, campent aux fenêtres, redescendent (ou tombent par le trou).
  Animation de mort : le bot bascule en avant puis disparaît.
- **Ergonomie** : slider de sensibilité de visée dans le menu (souris + joystick,
  ×0,3 à ×2, mémorisé), **sprint** (Maj sur PC, joystick à fond sur mobile).
- **Polish HUD** : compteur K/D personnel, indicateur directionnel de dégâts
  (flèche rouge autour du réticule orientée vers le tireur).
- Debug : `window.BLOCOPS_DEBUG` en console (player, bots, nav, CFG, WEAPONS).
- **Visuel de rechargement** : l'arme plonge et bascule pendant le rechargement
  (cloche sinusoïdale), barre de progression jaune sous le compteur de munitions,
  et **anneau de progression SVG autour du réticule** (dashoffset piloté chaque
  frame). Même plongeon (plus court) au changement d'arme.
- **Changement d'arme en jeu** : touches **1/2** ou **molette** sur PC, bouton
  **AR/SNIP** sur mobile. Changement en 0,5 s (tir bloqué pendant), annule un
  rechargement en cours, chaque arme garde son chargeur (`ammoStore`), les deux
  chargeurs repartent pleins au respawn. Nom de l'arme affiché dans le HUD.
  Testé headless : bascule 1↔2, chargeurs séparés conservés, barre à ~50 % à
  mi-rechargement, 0 erreur console.
- **Relooking de la map, ambiance banlieue 50s de site d'essai** (toujours un
  design original, pas une copie de Nuketown) : maison jaune pastel / maison
  verte avec encadrements blancs, porches sur poteaux, clôtures blanches à
  lisse, panneaux « RUE ATOMIQUE — POPULATION 8 » (texture canvas), marquage
  routier jaune, lampadaires, boîtes aux lettres, mannequins d'essai dans les
  jardins, arbres en blocs, roues sur bus/voitures + bande de fenêtres du bus,
  et décor extérieur : plaine désertique, mesas, pylône d'essai rayé
  rouge/blanc, nuages en blocs. Les nouveaux solides (poteaux de porche,
  lampadaires, troncs, poteaux des panneaux) sont placés hors des liens du
  graphe de nav — re-testé 40 s : bots ok (étage inclus), 0 erreur.

## 🔲 Reste à faire (par priorité)

1. **Test manuel réel** : ouvrir `index.html` sur PC (double-clic suffit) puis sur
   téléphone (`npx serve .` + IP locale). Vérifier le rendu des sons, la taille des
   boutons tactiles, la sensibilité par défaut.
2. **Équilibrage** : dégâts AR, cadence sniper, précision des bots, vitesse de
   strafe, vitesse de sprint (1,45×) — à ajuster après quelques parties
   (`BLOCOPS_DEBUG.CFG` / `.WEAPONS` modifiables en console pour tester).
3. **Ergonomie mobile (suite)** : ajuster taille/position des boutons après test
   réel, éventuellement tir auto quand la cible est visée.
4. **Polish restant** : mini-carte, trous d'impact persistants, nuages/décor
   de fond, intérieur du bus praticable.
5. **Vrai multijoueur** (gros chantier, optionnel) : actuellement c'est du
   joueur + bots. Pour du vrai multi il faudrait un serveur WebSocket
   (Node + ws) avec autorité serveur sur les dégâts.

## 🗒️ Notes techniques (pour reprendre le travail)

- `map.js` → `MapBuilder.build(scene)` retourne `{solids, colliders, nav, spawns}`.
  `solids` = meshes pour raycasts, `colliders` = Box3 pour la physique,
  `nav` = `{nodes: [[x,y,z]…], links: [[a,b]…]}` graphe de navigation des bots.
- `controls.js` → objet global `Input` lu chaque frame par `game.js`
  (`move`, `lookDX/DY`, `lookStick`, `fire`, `ads`, `sprint`, `jumpQueued`, `reloadQueued`).
- `audio.js` → global `Sfx` (sons synthétisés, contexte créé au clic JOUER).
- `effects.js` → global `Effects` (`init(scene)`, `tracer`, `muzzle`, `impact`, `update(dt)`).
- `game.js` → toute la logique. Constantes dans `CFG` et `WEAPONS` en haut du fichier.
- Physique : AABB joueur 0,7×1,8 m, marches ≤ 0,56 m franchies automatiquement
  (les escaliers font des marches de 0,375 m). Bots : montée par `tryAxis`,
  descente par `groundY` (sol le plus haut sous l'empreinte).
- Tir joueur = vrai raycast (têtes = mesh `userData.part === 'head'`).
  Tir des bots = probabilité selon la distance (traçante/flash/son quand même).
- Le joueur est toujours dans l'équipe bleue, spawn côté z négatif.
- Maisons : étage accessible par l'escalier au fond (plancher à y = 3,15),
  fenêtres de tir vers la rue (allège à 0,85 m au-dessus du plancher).
- Test automatisé : scripts Puppeteer (`smoke.js`, `soak.js`) dans le scratchpad
  de session Claude — à recréer au besoin (Edge headless + `--enable-unsafe-swiftshader`).
