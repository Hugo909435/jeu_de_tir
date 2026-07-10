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

    /* ---------- Clôtures de spawn (avec 2 passages chacune) ---------- */
    for (const s of [-1, 1]) {
      const z = 22 * s;
      wallX(z, -20, -14, 0, 2.2, 0xa78b62);
      wallX(z, -9, 5, 0, 2.2, 0xa78b62);
      wallX(z, 10, 20, 0, 2.2, 0xa78b62);
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
    }
    // Maison A (côté spawn bleu) et maison B (côté spawn rouge), en diagonale
    house(-12, -8, 1, 0xc9d2a3, 0x7c5a44);
    house(12, 8, -1, 0xd8b48f, 0x6d564a);

    /* ---------- Bus central ---------- */
    box(3.4, 3, 9, 0, 1.5, 0, 0xd9a441);
    box(3.0, 0.5, 8.4, 0, 3.25, 0, 0x4a4a4a); // toit du bus

    /* ---------- Voitures (carrosserie + cabine) ---------- */
    function car(x, z, c) {
      box(2.2, 1.2, 4.6, x, 0.6, z, c);
      box(1.8, 0.9, 2.2, x, 1.65, z, 0x2b2f33);
    }
    car(2, -9, 0x3aa6a0);
    car(-2, 9, 0xd06430);

    /* ---------- Caisses de couverture dans les allées ---------- */
    for (const s of [-1, 1]) {
      box(1.6, 1.4, 1.6, 17 * s, 0.7, 7 * s, 0x9a6a3f);
      box(1.6, 1.4, 1.6, 17 * s, 0.7, -7 * s, 0x9a6a3f);
      box(1.2, 1.0, 1.2, 17 * s, 0.5, 7 * s + 1.5 * s, 0x8a5c34);
    }

    /* ---------- Points de passage pour les bots (RDC uniquement) ---------- */
    const waypoints = [
      [0, -25], [0, -14], [0, 14], [0, 25],
      [-2.6, 0], [2.6, 0],
      [-11.5, -23], [7.5, -23], [11.5, 23], [-7.5, 23],
      [-12, -8], [12, 8],          // intérieurs des maisons
      [-6.5, -8], [6.5, 8],        // devant les portes
      [-17, 0], [17, 0],
      [-17, -14], [17, 14],
      [-12, 14], [12, -14],
    ];

    /* ---------- Spawns fixes ---------- */
    const spawns = {
      blue: [[-16, -26], [-8, -27], [2, -26], [10, -27]],
      red: [[16, 26], [8, 27], [-2, 26], [-10, 27]],
    };

    return { solids, colliders, waypoints, spawns };
  }

  return { build };
})();
