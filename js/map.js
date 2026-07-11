/* map.js — « Rue Atomique » : carte originale minimaliste (style blocs).
   Petite map symétrique : deux maisons à étage face à face, un bus au centre,
   des voitures en couverture, spawns fixes derrière les clôtures. */
const MapBuilder = (() => {
  'use strict';

  function build(scene) {
    const solids = [];    // meshes bloquants (raycast balles + ligne de vue)
    const colliders = []; // AABB {min:{x,y,z}, max:{x,y,z}} pour la physique
    const mats = {};
    const mat = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));

    // Boîte axis-aligned : (largeur x, hauteur y, profondeur z, centre x/y/z)
    function box(w, h, d, x, y, z, color, solid = true) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
      m.position.set(x, y, z);
      scene.add(m);
      if (solid) {
        solids.push(m);
        colliders.push(new THREE.Box3(
          new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
          new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
      }
      return m;
    }
    // Pan de mur le long de Z (à x fixe), de y1 à y2
    const wallZ = (x, za, zb, y1, y2, c) =>
      box(0.4, y2 - y1, Math.abs(zb - za), x, (y1 + y2) / 2, (za + zb) / 2, c);
    // Pan de mur le long de X (à z fixe)
    const wallX = (z, xa, xb, y1, y2, c) =>
      box(Math.abs(xb - xa), y2 - y1, 0.4, (xa + xb) / 2, (y1 + y2) / 2, z, c);

    /* ---------- Sol ---------- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 64), mat(0x7cb45b));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    box(7, 0.05, 60, 0, 0.025, 0, 0x565b60, false);      // rue
    box(2, 0.06, 60, -4.5, 0.03, 0, 0xb9bdc1, false);     // trottoirs
    box(2, 0.06, 60, 4.5, 0.03, 0, 0xb9bdc1, false);

    /* ---------- Murs d'enceinte ---------- */
    const TAN = 0xcbb79a;
    box(0.6, 3, 61, -20.3, 1.5, 0, TAN);
    box(0.6, 3, 61, 20.3, 1.5, 0, TAN);
    box(41.2, 3, 0.6, 0, 1.5, -30.3, TAN);
    box(41.2, 3, 0.6, 0, 1.5, 30.3, TAN);

    /* ---------- Clôtures de spawn blanches, avec 2 passages chacune ---------- */
    const FENCE = 0xefe9dc;
    for (const s of [-1, 1]) {
      const z = 22 * s;
      wallX(z, -20, -14, 0, 2.2, FENCE);
      wallX(z, -9, 5, 0, 2.2, FENCE);
      wallX(z, 10, 20, 0, 2.2, FENCE);
      // lisse supérieure décorative façon palissade
      box(6.2, 0.18, 0.55, -17, 2.28, z, FENCE, false);
      box(14.2, 0.18, 0.55, -2, 2.28, z, FENCE, false);
      box(10.2, 0.18, 0.55, 15, 2.28, z, FENCE, false);
    }

    /* ---------- Maison à étage ----------
       cx,cz = centre · dir = +1 (façade vers +x) ou -1 · couleurs murs/toit */
    function house(cx, cz, dir, wallC, roofC) {
      const fx = cx + 4 * dir;   // façade (côté rue)
      const bx = cx - 4 * dir;   // arrière
      const z1 = cz - 5, z2 = cz + 5;

      // Façade RDC : porte (2 m, linteau à 2.2) + fenêtre (1 → 2.2)
      wallZ(fx, z1, cz - 1, 0, 3, wallC);
      wallZ(fx, cz - 1, cz + 1, 2.2, 3, wallC);
      wallZ(fx, cz + 1, cz + 2, 0, 3, wallC);
      wallZ(fx, cz + 2, cz + 4, 0, 1, wallC);
      wallZ(fx, cz + 2, cz + 4, 2.2, 3, wallC);
      wallZ(fx, cz + 4, z2, 0, 3, wallC);
      // Façade étage : deux fenêtres (allège à 4, haut à 5.2)
      wallZ(fx, z1, cz - 4, 3, 6, wallC);
      wallZ(fx, cz - 4, cz - 2, 3, 4, wallC);
      wallZ(fx, cz - 4, cz - 2, 5.2, 6, wallC);
      wallZ(fx, cz - 2, cz + 2, 3, 6, wallC);
      wallZ(fx, cz + 2, cz + 4, 3, 4, wallC);
      wallZ(fx, cz + 2, cz + 4, 5.2, 6, wallC);
      wallZ(fx, cz + 4, z2, 3, 6, wallC);
      // Mur arrière : porte au RDC
      wallZ(bx, z1, cz - 1, 0, 6, wallC);
      wallZ(bx, cz - 1, cz + 1, 2.2, 6, wallC);
      wallZ(bx, cz + 1, z2, 0, 6, wallC);
      // Murs latéraux pleins
      const xa = Math.min(fx, bx) - 0.2, xb = Math.max(fx, bx) + 0.2;
      wallX(z1, xa, xb, 0, 6, wallC);
      wallX(z2, xa, xb, 0, 6, wallC);

      // Plancher de l'étage (trou au-dessus de l'escalier, coin arrière/z2)
      box(8, 0.3, (cz + 0.8) - z1, cx, 3, (z1 + cz + 0.8) / 2, 0x9b8b74); // partie z1 → cz+0.8
      const sxa = bx + 1.9 * dir, sxb = fx;                               // partie restante hors trou
      box(Math.abs(sxb - sxa), 0.3, z2 - (cz + 0.8), (sxa + sxb) / 2, 3, (cz + 0.8 + z2) / 2, 0x9b8b74);

      // Escalier : 8 marches (montée vers z2, collées au mur arrière)
      for (let i = 0; i < 8; i++) {
        const hStep = 0.375 * (8 - i);
        const zc = cz + 4.55 - 0.5 * i;
        box(1.6, hStep, 0.5, bx + dir * 1.0, hStep / 2, zc, 0x8a7a63);
      }

      // Toit plat
      box(8.6, 0.3, 10.6, cx, 6.15, cz, roofC);

      // Habillage blanc (décor non bloquant) : encadrements de porte et fenêtres
      const W = 0xf5f2e8;
      box(0.5, 2.5, 0.16, fx, 1.25, cz - 1.1, W, false); // montants de porte
      box(0.5, 2.5, 0.16, fx, 1.25, cz + 1.1, W, false);
      box(0.5, 0.16, 2.4, fx, 2.32, cz, W, false);       // linteau
      box(0.5, 0.14, 2.2, fx, 0.95, cz + 3, W, false);   // fenêtre RDC
      box(0.5, 0.14, 2.2, fx, 2.28, cz + 3, W, false);
      for (const zc of [cz - 3, cz + 3]) {               // fenêtres de l'étage
        box(0.5, 0.14, 2.2, fx, 3.94, zc, W, false);
        box(0.5, 0.14, 2.2, fx, 5.28, zc, W, false);
      }
      // Porche d'entrée : auvent (décor) sur deux poteaux (solides)
      box(2.0, 0.18, 3.4, fx + 1.0 * dir, 2.72, cz, roofC, false);
      box(0.16, 2.62, 0.16, fx + 1.8 * dir, 1.31, cz - 1.4, W);
      box(0.16, 2.62, 0.16, fx + 1.8 * dir, 1.31, cz + 1.4, W);
    }
    // Maison A jaune pastel (côté bleu) et maison B verte (côté rouge), en diagonale
    house(-12, -8, 1, 0xf0dd88, 0x707a70);
    house(12, 8, -1, 0x93c08f, 0x77584c);

    /* ---------- Bus central ---------- */
    box(3.4, 3, 9, 0, 1.5, 0, 0xd9a441);
    box(3.0, 0.5, 8.4, 0, 3.25, 0, 0x4a4a4a);            // toit du bus
    box(3.5, 0.8, 7.6, 0, 2.35, 0, 0x2b3a45, false);     // bande de fenêtres
    for (const [wx, wz] of [[-1.75, -3], [1.75, -3], [-1.75, 3], [1.75, 3]])
      box(0.25, 0.8, 0.8, wx, 0.4, wz, 0x1e1e1e, false); // roues

    /* ---------- Voitures (carrosserie + cabine + roues) ---------- */
    function car(x, z, c) {
      box(2.2, 1.2, 4.6, x, 0.6, z, c);
      box(1.8, 0.9, 2.2, x, 1.65, z, 0x2b2f33);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        box(0.22, 0.5, 0.55, x + 1.12 * sx, 0.25, z + 1.45 * sz, 0x1e1e1e, false);
    }
    car(2, -9, 0x3aa6a0);
    car(-2, 9, 0xd06430);

    /* ---------- Caisses de couverture dans les allées ---------- */
    for (const s of [-1, 1]) {
      box(1.6, 1.4, 1.6, 17 * s, 0.7, 7 * s, 0x9a6a3f);
      box(1.6, 1.4, 1.6, 17 * s, 0.7, -7 * s, 0x9a6a3f);
      box(1.2, 1.0, 1.2, 17 * s, 0.5, 7 * s + 1.5 * s, 0x8a5c34);
    }

    /* ---------- Décor de rue (banlieue années 50) ----------
       Les éléments solides (poteaux, troncs, mâts) sont placés à l'écart
       des liens du graphe de navigation — vérifié segment par segment. */
    const WHITE = 0xf5f2e8;

    // Marquage central de la rue (on saute la zone cachée par le bus)
    for (let z = -27; z <= 27; z += 4.5)
      if (Math.abs(z) > 5.5) box(0.18, 0.02, 1.6, 0, 0.06, z, 0xe8d44d, false);

    // Lampadaires (mât solide, tête décorative tournée vers la rue)
    function lamp(x, z, side) {
      box(0.14, 3.7, 0.14, x, 1.85, z, 0x3a3f44);
      box(0.9, 0.12, 0.3, x + 0.45 * side, 3.66, z, 0x3a3f44, false);
      box(0.3, 0.14, 0.26, x + 0.8 * side, 3.55, z, 0xffe9a8, false);
    }
    lamp(-4.5, -10, 1);
    lamp(4.5, 10, -1);

    // Boîtes aux lettres devant chaque maison
    function mailbox(x, z) {
      box(0.1, 1.1, 0.1, x, 0.55, z, 0x6d4c33, false);
      box(0.34, 0.26, 0.5, x, 1.23, z, 0xb3392c, false);
    }
    mailbox(-6.8, -10.5);
    mailbox(6.8, 10.5);

    // Panneaux d'entrée de la ville (texture canvas, poteaux solides)
    function billboard(x, z, ry) {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 208;
      const c = cv.getContext('2d');
      c.fillStyle = '#f6ecd7'; c.fillRect(0, 0, 512, 208);
      c.fillStyle = '#b3392c'; c.fillRect(0, 0, 512, 16); c.fillRect(0, 192, 512, 16);
      c.textAlign = 'center';
      c.fillStyle = '#27343f'; c.font = '900 58px sans-serif';
      c.fillText('RUE ATOMIQUE', 256, 92);
      c.fillStyle = '#b3392c'; c.font = '800 40px sans-serif';
      c.fillText('POPULATION 8', 256, 158);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.7),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
      panel.position.set(x, 3.3, z);
      panel.rotation.y = ry;
      scene.add(panel);
      box(0.16, 2.6, 0.16, x - 1.6, 1.3, z, WHITE);
      box(0.16, 2.6, 0.16, x + 1.6, 1.3, z, WHITE);
    }
    billboard(6.4, -28.8, 0);
    billboard(-6.4, 28.8, Math.PI);

    // Mannequins d'essai dans les jardins (décor non bloquant)
    function mannequin(x, z, ry) {
      const g = new THREE.Group();
      const part = (w, h, d, px, py, pz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xcfc9bc));
        m.position.set(px, py, pz);
        g.add(m);
      };
      part(0.26, 0.8, 0.26, -0.15, 0.4, 0);  // jambes
      part(0.26, 0.8, 0.26, 0.15, 0.4, 0);
      part(0.6, 0.65, 0.34, 0, 1.12, 0);     // torse
      part(0.2, 0.6, 0.2, -0.42, 1.15, 0);   // bras
      part(0.2, 0.6, 0.2, 0.42, 1.15, 0);
      part(0.42, 0.42, 0.42, 0, 1.68, 0);    // tête
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      scene.add(g);
    }
    mannequin(-19, -24.5, 0.7);
    mannequin(19, 24.5, -2.3);
    mannequin(-7, -12.3, 2.6);
    mannequin(7, 12.3, -0.5);

    // Arbres en blocs (tronc solide, feuillage décoratif)
    function tree(x, z) {
      box(0.4, 2.4, 0.4, x, 1.2, z, 0x6d4c33);
      box(2.2, 1.6, 2.2, x, 3.0, z, 0x4e8f46, false);
      box(1.4, 1.1, 1.4, x, 4.1, z, 0x5da24f, false);
    }
    tree(-19, -18); tree(19, 18); tree(14, -28); tree(-14, 28);

    /* ---------- Décor extérieur : désert, mesas, pylône d'essai, nuages ---------- */
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mat(0xd9bd85));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.05;
    scene.add(sand);
    const mesa = (x, z, w, h, d, c) => box(w, h, d, x, h / 2 - 0.05, z, c, false);
    mesa(0, -95, 60, 10, 18, 0xcfa76e);
    mesa(30, -85, 30, 14, 22, 0xc9a26b);
    mesa(-45, -70, 36, 12, 20, 0xdcb98a);
    mesa(85, 10, 24, 16, 50, 0xc9a26b);
    mesa(-85, -15, 26, 14, 55, 0xcfa76e);
    mesa(0, 95, 70, 12, 20, 0xdcb98a);
    mesa(50, 70, 30, 10, 24, 0xc9a26b);
    mesa(-55, 60, 28, 16, 26, 0xcfa76e);
    // Pylône d'essai rayé rouge et blanc, feu au sommet
    for (let i = 0; i < 5; i++) {
      const s = 3 - i * 0.55;
      box(s, 6, s, 48, 3 + i * 6, -50, i % 2 ? 0xd6d2c8 : 0xb3392c, false);
    }
    box(0.6, 0.6, 0.6, 48, 33.3, -50, 0xff5544, false);
    // Nuages en blocs
    for (const [x, y, z, s] of [[-25, 26, -12, 1], [18, 30, -40, 1.4], [35, 27, 8, 1.1],
                                 [-40, 28, 22, 1.3], [8, 32, 45, 1.2], [-12, 29, 60, 0.9]]) {
      box(9 * s, 1.1, 4.5 * s, x, y, z, 0xffffff, false);
      box(5 * s, 1.0, 3 * s, x + 2.5 * s, y + 0.8, z + 0.6, 0xffffff, false);
    }

    /* ---------- Graphe de navigation des bots (RDC + étage) ----------
       Chaque nœud = [x, y, z] (y = hauteur du sol à cet endroit).
       Chaque lien = segment directement praticable en ligne droite
       (portes, escaliers, contournement des voitures/caisses/clôtures). */
    const nodes = [], links = [];
    const N = (x, y, z) => nodes.push([x, y, z]) - 1;
    const L = (a, b) => links.push([a, b]);

    // Rue et centre
    const sN = N(0, 0, -25), sWN = N(-2.6, 0, -14), sEN = N(2.6, 0, -14);
    const busW = N(-2.6, 0, 0), busE = N(2.6, 0, 0);
    const sWS = N(-2.6, 0, 14), sES = N(2.6, 0, 14), sS = N(0, 0, 25);
    const carW = N(-4.6, 0, 9), carE = N(4.6, 0, -9); // contournent les voitures
    // Coins des zones de spawn (alignés sur les passages des clôtures)
    const cNW = N(-11.5, 0, -23), cNE = N(7.5, 0, -23);
    const cSE = N(8.5, 0, 23), cSW = N(-10.5, 0, 23);
    // Allées latérales
    const aW = N(-17, 0, 0), aE = N(17, 0, 0);
    const aWN = N(-17, 0, -14), aES = N(17, 0, 14);
    const aWS = N(-12, 0, 14), aEN = N(12, 0, -14);
    const dW = N(-14.5, 0, -7), dE = N(14.5, 0, 7); // contournent les caisses
    // Maison A (ouest) : RDC, escalier, étage, fenêtres de tir
    const hAdoor = N(-6.5, 0, -8), hAin = N(-12, 0, -8), hAback = N(-18.9, 0, -8);
    const hAsb = N(-15, 0, -7.6), hAst = N(-15, 3.0, -3.7);
    const hAup = N(-13.2, 3.15, -4.3), hAupC = N(-12, 3.15, -10);
    const hAw1 = N(-9, 3.15, -11), hAw2 = N(-9, 3.15, -5);
    // Maison B (est)
    const hBdoor = N(6.5, 0, 8), hBin = N(12, 0, 8), hBback = N(18.9, 0, 8);
    const hBsb = N(15, 0, 8.4), hBst = N(15, 3.0, 12.3);
    const hBup = N(13.2, 3.15, 12.2), hBupC = N(12, 3.15, 6);
    const hBw1 = N(9, 3.15, 5), hBw2 = N(9, 3.15, 11);

    [
      // rue (le bus coupe le passage central : on passe par les côtés)
      [sN, sWN], [sN, sEN], [sWN, sEN], [sWN, busW], [busW, carW], [carW, sWS],
      [sEN, carE], [carE, busE], [busE, sES], [sWS, sES], [sWS, sS], [sES, sS],
      // zones de spawn et passages des clôtures
      [sN, cNW], [sN, cNE], [sS, cSE], [sS, cSW],
      [cNW, aWN], [cNW, sWN], [cNE, sEN], [cNE, aEN],
      [cSE, sES], [cSE, aES], [cSW, aWS], [cSW, sWS],
      // allées latérales (détour dW/dE autour des caisses)
      [aWN, sWN], [aWN, dW], [dW, aW], [aW, aWS], [aWS, sWS],
      [aEN, sEN], [aEN, aE], [aE, dE], [dE, aES], [aES, sES],
      // maison A : portes, RDC, escalier, étage
      [aWN, hAback], [hAback, aW], [hAdoor, sWN], [hAdoor, busW],
      [hAdoor, hAin], [hAback, hAin], [hAin, hAsb], [hAsb, hAst], [hAst, hAup],
      [hAup, hAupC], [hAup, hAw2], [hAupC, hAw1], [hAw1, hAw2],
      // maison B
      [aES, hBback], [hBback, aE], [hBdoor, sES], [hBdoor, busE],
      [hBdoor, hBin], [hBback, hBin], [hBin, hBsb], [hBsb, hBst], [hBst, hBup],
      [hBup, hBupC], [hBup, hBw2], [hBupC, hBw1], [hBw1, hBw2],
    ].forEach(([a, b]) => L(a, b));

    /* ---------- Spawns fixes ---------- */
    const spawns = {
      blue: [[-16, -26], [-8, -27], [2, -26], [10, -27]],
      red: [[16, 26], [8, 27], [-2, 26], [-10, 27]],
    };

    return { solids, colliders, nav: { nodes, links }, spawns };
  }

  return { build };
})();
