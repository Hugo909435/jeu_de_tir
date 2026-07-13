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
- **Modèles 3D distincts pour les deux armes** (`buildAR` / `buildSniper` dans
  `game.js`) : carabine polymère/métal avec rail, organes de visée, chargeur
  incliné et accents orange ; fusil à verrou avec long canon fuselé, lunette à
  objectif vitré, levier de culasse, fût et crosse en bois. Visibilité basculée
  dans `updateWeaponUI`, bout du canon (`muzzle`) défini par arme dans `WEAPONS`,
  léger yaw de l'arme pour en voir le flanc. Testé headless (captures AR + sniper).
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

## ✅ Fait (session du 2026-07-13)

- **Personnages redessinés et animés** (`buildCharacter` dans `game.js`) :
  casque aux couleurs de l'équipe + visière sombre, gilet tactique avec poches,
  ceinture, sac à dos, bottes — et surtout **la vraie arme du bot** (mêmes
  modèles 3D AR/sniper qu'en vue première personne) tenue à deux mains.
  Squelette articulé : jambes pivotant à la hanche (**cycle de marche** calé
  sur la vitesse réelle), groupe « aim » bras+arme pivotant à l'épaule —
  **arme baissée en patrouille, levée et inclinée vers la cible en combat**
  (la tête suit), léger **recul au tir**, et les traçantes partent désormais
  du vrai bout du canon. Hitbox : casque et visière comptent comme tête
  (headshot ×2), l'arme ne bloque pas les balles. Testé headless (Puppeteer +
  Edge) : captures combat/patrouille validées, 12 s de jeu, 0 erreur console.

- **Bots bloqués au spawn corrigés** : un vérificateur Node (colliders réels +
  physique de `game.js`) a révélé **16 liens du graphe de nav sur 60 traversant
  des obstacles** — dont les 4 liens de sortie de spawn `sN/sS → rue` qui
  passaient en plein panneau central des clôtures (le bot fonçait dans la
  clôture, repartait du même nœud, et bouclait). Corrections dans `map.js` :
  sorties de spawn uniquement par les passages (`cNW/cNE/cSW/cSE`, coins sud
  recentrés sur les passages), nœuds `dW/dE` supprimés (ils étaient DANS la
  maison, `hAback/hBback` servent de détour d'allée), liens des portes arrière
  supprimés (barricadées par les caisses — le joueur peut sauter par-dessus,
  pas les bots), `hAdoor/hBdoor` sortis d'entre les poteaux de porche,
  lampadaires reculés à z=∓13, contournement des voitures élargi. Vérifié :
  50/50 liens praticables même avec +10 cm de marge, graphe connexe, et soak
  test 60 s en Edge headless — 7 bots, 112–155 m parcourus chacun, aucun séjour
  en zone de spawn > 10 s, aucune immobilité hors combat > 0,5 s, 0 erreur.

- **Fenêtres de l'étage franchissables** : suppression du bandeau de mur
  au-dessus des fenêtres (l'ouverture monte jusqu'au toit), encadrement blanc
  supérieur remonté sous la toiture. On saute par-dessus l'allège (0,85 m,
  toujours utile comme couverture) pour sortir — sortie possible en marchant
  ou en sprintant, retour impossible depuis la rue. Vérifié par simulation
  physique en Node (colliders réels de la map + physique copiée de `game.js`) :
  les 4 fenêtres passent, le mur plein entre les fenêtres bloque toujours.

- **IA des bots améliorée** : (1) *chasse* — quand un bot perd sa cible de vue,
  il mémorise sa dernière position connue et va la vérifier via le graphe de nav
  (6 s max, arme mi-levée, pas accéléré 4,6) avant de reprendre la patrouille ;
  (2) en combat il *avance* si la cible est à plus de 25 m et *recule* si elle
  colle à moins de 8 m (en plus du strafe) ; (3) sa précision dépend de la
  posture de la cible : accroupi ×0,65, sprint ×0,8, immobile ×1,25 (plafond 95 %).
  Le joueur expose `spd`/`crouching` chaque frame pour ça.
- **Recul cumulatif** : chaque tir fait monter la caméra (`kick` par arme dans
  `WEAPONS` : AR 0,0085 rad, sniper 0,05) avec une dérive latérale aléatoire,
  et le spread s'élargit avec la chauffe (`heat`, +1/tir, −5/s, plafond 8) —
  les rafales longues deviennent imprécises, les tirs courts restent chirurgicaux.
- **Tableau des scores** : Tab maintenu sur PC, tap sur le score en haut sur
  mobile (bascule). Deux colonnes Bleus/Rouges triées par kills, ligne du joueur
  surlignée. Les kills/deaths de *tous* les combattants sont désormais comptés.
- **Grenades** (joueur ; les bots n'en lancent pas encore) : touche **G** ou
  bouton 🧨 mobile, 2 par vie (restock au respawn), compteur dans le HUD.
  Projectile physique avec gravité et rebonds amortis axe par axe, fusée 2,2 s,
  dégâts 170 au centre → 0 à 6,5 m, bloqués par les murs (raycast), pas de
  dégâts aux alliés mais dégâts sur soi (un suicide donne le point à l'adversaire,
  kill feed dédié). Explosion : flashs agrandis + double gerbe + son grave.
- **Killstreaks légers** : 3 kills sans mourir = **UAV** 12 s (radar canvas en
  haut à gauche, centré joueur, haut = direction du regard, points rouges/bleus) ;
  5 kills = **RUSH** 12 s (vitesse ×1,25, rechargement ×0,5). Bannière d'annonce
  + jingle, série remise à zéro à la mort.
- Testé headless (Puppeteer + Edge) : grenade lancée/explosée, scoreboard Tab
  ouvert/fermé (5 lignes par équipe), recul vérifié (pitch monte en rafale),
  UAV déclenché après 3 kills réels (radar affiché), chasse active sur 96 % des
  échantillons d'une partie de 30 s, bots toujours mobiles, 0 erreur console.

## ✅ Fait (session du 2026-07-13, suite) — MULTIJOUEUR EN LIGNE

- **Vrai multijoueur (parties privées)** : serveur Node (`server/server.js`,
  dépendance `ws`) qui sert le jeu en HTTP **et** héberge le WebSocket sur le
  même port. Lancement : `npm install` puis `node server/server.js` →
  http://localhost:8080 (les IP LAN sont affichées pour jouer depuis un
  téléphone sur le même Wi-Fi).
- **Menu remanié** : SOLO contre les bots (inchangé, marche toujours en
  ouvrant `index.html` en double-clic) ou multijoueur — pseudo + « Créer une
  partie privée » (code à 4 lettres) ou « Rejoindre » avec le code. Lobby
  avec liste des joueurs par équipe (équilibrage auto), couronne sur l'hôte,
  seul l'hôte peut lancer (2 à 8 joueurs). Après une victoire, retour au
  lobby (le salon reste ouvert) et l'hôte peut relancer.
- **Autorité serveur sur les dégâts** : les clients envoient des
  revendications de touche ; le serveur valide (cadence par seau à jetons,
  table de dégâts serveur, équipe, portée, protection de spawn, timing de
  respawn, rayon de grenade avec explosion mémorisée) et tient PV / kills /
  scores / victoire. Régénération paresseuse identique au client.
- **Réseau côté client** (`js/net.js` + intégration `game.js`) : positions
  simulées localement et relayées à ~15 Hz, joueurs distants = mêmes
  personnages articulés (marche, visée au pitch réel, recul, mort, accroupi
  tassé, changement d'arme AR↔sniper reflété) + **étiquette de pseudo**
  au-dessus de la tête. Traçantes/flash/son des tirs distants, grenades
  relayées (simulation visuelle chez les autres, dégâts revendiqués par le
  lanceur), kill feed/scoreboard/UAV/killstreaks fonctionnent en ligne.
  Déconnexion : écran « Connexion perdue », départs affichés dans le feed.
- **Protocole** (JSON, types courts) : `create/join/start`, `st` (état 15 Hz),
  `shoot` (traçante), `hit` (revendication), `nade/boom/nadeHit`, `spawn`,
  `kill/hp/win/plist/pleave` en retour. Détail dans `server/server.js`.
- Testé E2E (script Puppeteer + Edge headless, à recréer au besoin dans le
  scratchpad) : création/join avec code, lancement hôte, les deux clients se
  voient, kill AR validé serveur + scores synchro, respawn, dégâts de
  grenade croisés, 0 erreur console, et non-régression du solo (7 bots).

## 🔲 Reste à faire (par priorité)

1. **Test manuel réel** : solo en ouvrant `index.html` (double-clic suffit) ;
   multijoueur avec `node server/server.js` → http://localhost:8080 (l'IP LAN
   affichée au lancement sert pour un téléphone / 2e PC sur le même Wi-Fi).
   Vérifier le rendu des sons, la taille des boutons tactiles, la sensibilité,
   et une vraie partie privée à 2.
2. **Équilibrage** : dégâts AR, cadence sniper, précision des bots, vitesse de
   strafe, vitesse de sprint (1,45×), recul (`kick`/chauffe), grenade (dégâts,
   rayon, fusée), seuils de killstreak — à ajuster après quelques parties
   (`BLOCOPS_DEBUG.CFG` / `.WEAPONS` modifiables en console pour tester).
3. **Ergonomie mobile (suite)** : ajuster taille/position des boutons après test
   réel, éventuellement tir auto quand la cible est visée.
4. **Polish restant** : mini-carte, trous d'impact persistants, nuages/décor
   de fond, intérieur du bus praticable.
5. **Multijoueur (suite)** : la base est en place (voir ci-dessus). Idées :
   bots de remplissage simulés par l'hôte quand on est peu nombreux, choix
   d'équipe dans le lobby, rejoindre une partie en cours, chat rapide,
   validation serveur des positions (anti-triche), hébergement public
   (le serveur actuel est pensé pour du LAN / petit VPS).

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
  Les fenêtres de l'étage sont **franchissables en sortie** : ouvertes jusqu'au
  toit, on saute sur l'allège puis on bascule dehors (marche ou sprint).
  Pas d'entrée possible depuis la rue (allège extérieure à 4 m). Vérifié par
  simulation physique Node (mêmes constantes que `game.js`) sur les 4 fenêtres.
- Test automatisé : scripts Puppeteer (`smoke.js`, `soak.js`) dans le scratchpad
  de session Claude — à recréer au besoin (Edge headless + `--enable-unsafe-swiftshader`).
