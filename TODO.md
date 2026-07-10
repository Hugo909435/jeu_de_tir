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

## 🔲 Reste à faire (par priorité)

1. **Tester en vrai** : ouvrir `index.html` (double-clic suffit, ou `npx serve .`),
   vérifier PC puis mobile. Syntaxe JS non encore vérifiée par `node --check`
   (outil shell indisponible en fin de session) — à faire en premier.
2. **Sons** : tirs, rechargement, hitmarker, éliminations (Web Audio API,
   sons synthétisés = pas de fichiers à télécharger).
3. **Effets de tir** : traçantes, flash de bouche, impacts (étincelles/trous),
   animation de rechargement de l'arme.
4. **Bots à l'étage** : ajouter des waypoints à l'étage + navigation escaliers
   (actuellement les bots restent au rez-de-chaussée).
5. **Ergonomie mobile** : ajuster taille/position des boutons après test réel,
   sensibilité de visée réglable, éventuellement tir auto quand la cible est visée.
6. **Équilibrage** : dégâts AR par balle, cadence sniper, précision des bots,
   vitesse de strafe — à ajuster après quelques parties.
7. **Polish** : mini-carte, indicateur directionnel de dégâts (d'où on se fait tirer),
   compteur K/D personnel, sprint, animation de mort des bots (ragdoll simple),
   nuages/décor de fond, intérieur du bus praticable.
8. **Vrai multijoueur** (gros chantier, optionnel) : actuellement c'est du
   joueur + bots. Pour du vrai multi il faudrait un serveur WebSocket
   (Node + ws) avec autorité serveur sur les dégâts.

## 🗒️ Notes techniques (pour reprendre le travail)

- `map.js` → `MapBuilder.build(scene)` retourne `{solids, colliders, waypoints, spawns}`.
  `solids` = meshes pour raycasts, `colliders` = Box3 pour la physique.
- `controls.js` → objet global `Input` lu chaque frame par `game.js`
  (`move`, `lookDX/DY`, `lookStick`, `fire`, `ads`, `jumpQueued`, `reloadQueued`).
- `game.js` → toute la logique. Constantes dans `CFG` et `WEAPONS` en haut du fichier.
- Physique : AABB joueur 0,7×1,8 m, marches ≤ 0,56 m franchies automatiquement
  (les escaliers font des marches de 0,375 m).
- Tir joueur = vrai raycast (têtes = mesh `userData.part === 'head'`).
  Tir des bots = probabilité selon distance (pas de raycast de projectile).
- Le joueur est toujours dans l'équipe bleue, spawn côté z négatif.
- Maisons : étage accessible par l'escalier au fond, fenêtres de tir vers la rue.
