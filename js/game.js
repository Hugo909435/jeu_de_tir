/* game.js — boucle principale : joueur, physique, armes, bots, score, respawn. */
(() => {
  'use strict';

  /* ================= Config ================= */
  const CFG = {
    maxHP: 200,
    scoreToWin: 20,
    respawnDelay: 3,      // s avant réapparition
    protectionTime: 2,    // s d'invulnérabilité au spawn
    regenDelay: 5,        // s sans dégâts avant régénération
    regenRate: 60,        // PV / s
    moveSpeed: 6,
    adsSpeedMul: 0.55,
    sprintMul: 1.45,
    crouchMul: 0.5,
    crouchEyeHeight: 0.9,
    jumpSpeed: 7.5,
    gravity: -20,
    eyeHeight: 1.6,
    baseFov: 75,
    switchTime: 0.5,      // s pour changer d'arme (tir impossible pendant)
    nades: 2,             // grenades par vie
    nadeFuse: 2.2,        // s entre le lancer et l'explosion
    nadeRadius: 6.5,      // m : rayon des dégâts (décroissance linéaire vers 0)
    nadeDmg: 170,         // dégâts au centre de l'explosion
    nadeSpeed: 17,        // m/s : vitesse initiale du lancer
  };
  /* Armes — équilibrage : toutes les principales tuent en ~0,9-1 s si tous les
     tirs touchent (200 PV), chacune avec sa force et sa faiblesse.
     kick = recul vertical (rad/tir) ; le spread grandit avec la chauffe en auto ;
     speed = multiplicateur de vitesse de déplacement ; tip = bout du canon du
     modèle (traçantes des personnages) ; desc = lignes des cartes du menu.
     Fusil à pompe : pellets plombs par cartouche, dégâts pleins jusqu'à
     rangeFull m puis décroissance vers dmgMin à rangeMax (0 au-delà). */
  const WEAPONS = {
    ar: {
      label: "Fusil d'assaut", short: 'AR', dmg: 20, mag: 25, reloadT: 1.8, interval: 0.1,
      auto: true, adsFov: 50, spreadHip: 0.016, spreadAds: 0.005, kick: 0.0085, speed: 1,
      botInterval: 0.22, muzzle: [0.28, -0.24, -1.2], tip: -0.66,
      desc: ['20 dégâts (40 tête) · 25 balles', 'automatique · le bon partout'],
    },
    smg: {
      label: 'Mitraillette', short: 'SMG', dmg: 14, mag: 32, reloadT: 1.4, interval: 0.068,
      auto: true, adsFov: 55, spreadHip: 0.011, spreadAds: 0.008, kick: 0.006, speed: 1.06,
      heatPerShot: 0.9, botInterval: 0.16, muzzle: [0.28, -0.24, -1.08], tip: -0.53,
      desc: ['14 dégâts (28 tête) · 32 balles', 'cadence folle · +6 % vitesse · faible de loin'],
    },
    shotgun: {
      label: 'Fusil à pompe', short: 'POMPE', dmg: 26, mag: 6, reloadT: 2.8, interval: 0.8,
      auto: false, adsFov: 60, spreadHip: 0.012, spreadAds: 0.008, kick: 0.055, speed: 1,
      pellets: 8, pspread: 0.045, headMul: 1.5, rangeFull: 9, rangeMax: 24, dmgMin: 0.25,
      botInterval: 1.1, botDmg: 90, botMaxD: 16, muzzle: [0.28, -0.23, -1.28], tip: -0.73,
      desc: ['8 plombs × 26 dégâts · 6 cartouches', 'dévastateur à bout portant · nul de loin'],
    },
    dmr: {
      label: 'Fusil coup par coup', short: 'DMR', dmg: 55, mag: 12, reloadT: 2.1, interval: 0.33,
      auto: false, adsFov: 38, spreadHip: 0.02, spreadAds: 0.001, kick: 0.02, speed: 1,
      botInterval: 0.6, muzzle: [0.28, -0.24, -1.32], tip: -0.77,
      desc: ['55 dégâts (110 tête) · 12 balles', 'coup par coup précis · 2 têtes = kill'],
    },
    lmg: {
      label: 'Mitrailleuse', short: 'LMG', dmg: 24, mag: 60, reloadT: 3.5, interval: 0.12,
      auto: true, adsFov: 55, spreadHip: 0.03, spreadAds: 0.009, kick: 0.012, speed: 0.88,
      heatPerShot: 1.25, botInterval: 0.26, muzzle: [0.28, -0.25, -1.37], tip: -0.82,
      desc: ['24 dégâts (48 tête) · 60 balles', 'énorme chargeur · lourde : −12 % vitesse'],
    },
    sniper: {
      label: 'Sniper', short: 'SNIP', dmg: 100, mag: 5, reloadT: 2.5, interval: 1.4,
      auto: false, adsFov: 18, spreadHip: 0.02, spreadAds: 0.0006, kick: 0.05, speed: 0.95,
      botInterval: 1.6, muzzle: [0.28, -0.23, -1.5], tip: -0.97,
      desc: ['100 dégâts (200 tête) · 5 balles', 'lunette · 1 balle en tête = kill'],
    },
    // Arme secondaire (tout le monde l'a en touche 2) : gros dégâts, tir lent
    deagle: {
      label: 'Deagle', short: 'DGL', dmg: 70, mag: 7, reloadT: 1.5, interval: 0.42,
      auto: false, adsFov: 60, spreadHip: 0.025, spreadAds: 0.004, kick: 0.045, speed: 1.05,
      botInterval: 0.7, muzzle: [0.28, -0.235, -0.83], tip: -0.28,
      desc: ['70 dégâts (140 tête) · 7 balles', 'coup par coup lent mais brutal'],
    },
  };
  const TEAM = {
    blue: { color: 0x2e6df6, name: 'Bleus' },
    red: { color: 0xe23c3c, name: 'Rouges' },
  };
  const BOT_NAMES = { blue: ['Nova', 'Pixel', 'Turbo'], red: ['Rex', 'Zed', 'Mango', 'Kiwi'] };

  const now = () => performance.now() / 1000;

  /* ================= Scène ================= */
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ef);
  scene.fog = new THREE.Fog(0x9fd8ef, 70, 150);
  const camera = new THREE.PerspectiveCamera(CFG.baseFov, 1, 0.1, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88996a, 1.0));
  const sun = new THREE.DirectionalLight(0xfff3d6, 0.7);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  const world = MapBuilder.build(scene);
  Effects.init(scene);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  /* ============ Modèles d'armes en vue première personne ============ */
  const GUNMAT = {
    metal: new THREE.MeshLambertMaterial({ color: 0x2a2e35 }),
    black: new THREE.MeshLambertMaterial({ color: 0x14161a }),
    polymer: new THREE.MeshLambertMaterial({ color: 0x4d5560 }),
    accent: new THREE.MeshLambertMaterial({ color: 0xe8762c }),
    wood: new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
    woodDark: new THREE.MeshLambertMaterial({ color: 0x59391f }),
    glass: new THREE.MeshBasicMaterial({ color: 0xaad8ff }),
  };
  function gunPart(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }
  const gbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const gcyl = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg);

  // Carabine moderne : garde-main rainuré, organes de visée, chargeur incliné, accents orange.
  function buildAR() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.09, 0.11, 0.34), GUNMAT.metal, 0, 0, 0);                    // carcasse
    gunPart(g, gbox(0.078, 0.088, 0.3), GUNMAT.polymer, 0, 0.005, -0.3);          // garde-main
    gunPart(g, gbox(0.082, 0.02, 0.3), GUNMAT.accent, 0, -0.048, -0.3);           // liseré accent
    gunPart(g, gbox(0.036, 0.018, 0.6), GUNMAT.black, 0, 0.066, -0.13);           // rail supérieur
    gunPart(g, gcyl(0.018, 0.16), GUNMAT.black, 0, 0.02, -0.53, Math.PI / 2);     // canon
    gunPart(g, gbox(0.05, 0.05, 0.07), GUNMAT.metal, 0, 0.02, -0.62);             // frein de bouche
    gunPart(g, gbox(0.018, 0.05, 0.018), GUNMAT.black, 0, 0.1, -0.42);            // guidon
    gunPart(g, gbox(0.034, 0.045, 0.05), GUNMAT.black, 0, 0.1, 0.1);              // hausse
    gunPart(g, gbox(0.055, 0.2, 0.09), GUNMAT.polymer, 0, -0.155, -0.05, 0.22);   // chargeur incliné
    gunPart(g, gbox(0.058, 0.03, 0.095), GUNMAT.accent, 0, -0.25, -0.028, 0.22);  // talon du chargeur
    gunPart(g, gbox(0.05, 0.13, 0.075), GUNMAT.polymer, 0, -0.125, 0.13, -0.25);  // poignée pistolet
    gunPart(g, gbox(0.06, 0.075, 0.24), GUNMAT.polymer, 0, -0.005, 0.3);          // crosse
    gunPart(g, gbox(0.07, 0.12, 0.035), GUNMAT.black, 0, -0.02, 0.42);            // butée d'épaule
    return g;
  }

  // Fusil à verrou : long canon fuselé, lunette avec objectif vitré, fût et crosse en bois.
  function buildSniper() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.085, 0.1, 0.3), GUNMAT.metal, 0, 0.01, -0.02);              // boîtier de culasse
    gunPart(g, gcyl(0.024, 0.34), GUNMAT.metal, 0, 0.025, -0.34, Math.PI / 2);    // canon (base)
    gunPart(g, gcyl(0.019, 0.38), GUNMAT.black, 0, 0.025, -0.7, Math.PI / 2);     // canon (fin)
    gunPart(g, gcyl(0.03, 0.09, 12), GUNMAT.black, 0, 0.025, -0.92, Math.PI / 2); // frein de bouche
    gunPart(g, gcyl(0.011, 0.07), GUNMAT.metal, 0.075, 0.03, 0.06, 0, 0, Math.PI / 2); // levier de culasse
    gunPart(g, gbox(0.032, 0.032, 0.032), GUNMAT.black, 0.115, 0.03, 0.06);       // pommeau du levier
    gunPart(g, gbox(0.024, 0.05, 0.03), GUNMAT.black, 0, 0.09, -0.1);             // montage avant
    gunPart(g, gbox(0.024, 0.05, 0.03), GUNMAT.black, 0, 0.09, 0.04);             // montage arrière
    gunPart(g, gcyl(0.03, 0.22, 12), GUNMAT.black, 0, 0.135, -0.02, Math.PI / 2); // tube de lunette
    gunPart(g, gcyl(0.045, 0.08, 12), GUNMAT.black, 0, 0.135, -0.16, Math.PI / 2);// objectif
    gunPart(g, gcyl(0.038, 0.006, 12), GUNMAT.glass, 0, 0.135, -0.198, Math.PI / 2); // verre
    gunPart(g, gcyl(0.038, 0.06, 12), GUNMAT.black, 0, 0.135, 0.1, Math.PI / 2);  // oculaire
    gunPart(g, gbox(0.075, 0.075, 0.42), GUNMAT.wood, 0, -0.045, -0.3);           // fût
    gunPart(g, gbox(0.08, 0.1, 0.3), GUNMAT.wood, 0, -0.04, 0.25);                // crosse
    gunPart(g, gbox(0.07, 0.05, 0.18), GUNMAT.woodDark, 0, 0.035, 0.3);           // appui-joue
    gunPart(g, gbox(0.05, 0.12, 0.08), GUNMAT.woodDark, 0, -0.13, 0.13, -0.35);   // poignée
    gunPart(g, gbox(0.085, 0.13, 0.035), GUNMAT.black, 0, -0.05, 0.41);           // butée d'épaule
    gunPart(g, gbox(0.05, 0.07, 0.12), GUNMAT.black, 0, -0.1, -0.06);             // chargeur
    return g;
  }

  // Mitraillette compacte : canon court à silencieux, long chargeur, crosse repliée.
  function buildSMG() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.085, 0.1, 0.3), GUNMAT.metal, 0, 0, -0.02);                  // carcasse
    gunPart(g, gbox(0.07, 0.075, 0.16), GUNMAT.polymer, 0, 0, -0.26);              // garde-main court
    gunPart(g, gcyl(0.016, 0.18), GUNMAT.black, 0, 0.01, -0.42, Math.PI / 2);      // canon
    gunPart(g, gcyl(0.026, 0.1, 12), GUNMAT.black, 0, 0.01, -0.48, Math.PI / 2);   // silencieux
    gunPart(g, gbox(0.03, 0.016, 0.3), GUNMAT.black, 0, 0.06, -0.1);               // rail
    gunPart(g, gbox(0.016, 0.04, 0.016), GUNMAT.black, 0, 0.085, -0.3);            // guidon
    gunPart(g, gbox(0.05, 0.22, 0.07), GUNMAT.metal, 0, -0.16, -0.1, 0.08);        // chargeur long
    gunPart(g, gbox(0.05, 0.11, 0.07), GUNMAT.polymer, 0, -0.11, 0.1, -0.2);       // poignée
    gunPart(g, gbox(0.028, 0.05, 0.2), GUNMAT.metal, 0.045, 0.01, 0.22);           // crosse repliée (tube)
    gunPart(g, gbox(0.05, 0.09, 0.03), GUNMAT.polymer, 0.045, 0, 0.32);            // plaque de crosse
    gunPart(g, gbox(0.05, 0.05, 0.06), GUNMAT.accent, 0, 0.005, 0.12);             // culasse accent
    return g;
  }

  // Fusil à pompe : gros canon + tube magasin dessous, pompe et crosse en bois.
  function buildShotgun() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.09, 0.11, 0.26), GUNMAT.metal, 0, 0, 0.02);                  // carcasse
    gunPart(g, gcyl(0.024, 0.62), GUNMAT.black, 0, 0.035, -0.42, Math.PI / 2);     // canon
    gunPart(g, gcyl(0.018, 0.5), GUNMAT.metal, 0, -0.02, -0.36, Math.PI / 2);      // tube magasin
    gunPart(g, gbox(0.075, 0.06, 0.2), GUNMAT.wood, 0, -0.02, -0.3);               // pompe
    gunPart(g, gbox(0.02, 0.03, 0.02), GUNMAT.accent, 0, 0.075, -0.7);             // guidon (perle)
    gunPart(g, gbox(0.08, 0.1, 0.28), GUNMAT.wood, 0, -0.035, 0.26);               // crosse
    gunPart(g, gbox(0.05, 0.12, 0.09), GUNMAT.woodDark, 0, -0.12, 0.13, -0.3);     // poignée
    gunPart(g, gbox(0.085, 0.12, 0.03), GUNMAT.black, 0, -0.04, 0.41);             // butée d'épaule
    gunPart(g, gbox(0.06, 0.03, 0.1), GUNMAT.accent, 0, -0.065, 0.02);             // porte-cartouches
    return g;
  }

  // Fusil coup par coup (DMR) : canon long, viseur tubulaire court, chargeur droit.
  function buildDMR() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.09, 0.105, 0.34), GUNMAT.metal, 0, 0, 0);                    // carcasse
    gunPart(g, gbox(0.075, 0.08, 0.3), GUNMAT.polymer, 0, 0.005, -0.3);            // garde-main
    gunPart(g, gbox(0.082, 0.02, 0.3), GUNMAT.accent, 0, -0.045, -0.3);            // liseré accent
    gunPart(g, gcyl(0.017, 0.34), GUNMAT.black, 0, 0.02, -0.6, Math.PI / 2);       // canon long
    gunPart(g, gbox(0.045, 0.045, 0.06), GUNMAT.metal, 0, 0.02, -0.74);            // frein de bouche
    gunPart(g, gbox(0.03, 0.016, 0.55), GUNMAT.black, 0, 0.065, -0.15);            // rail
    gunPart(g, gcyl(0.026, 0.14, 12), GUNMAT.black, 0, 0.11, 0, Math.PI / 2);      // viseur tubulaire
    gunPart(g, gcyl(0.032, 0.005, 12), GUNMAT.glass, 0, 0.11, -0.072, Math.PI / 2);// verre
    gunPart(g, gbox(0.05, 0.16, 0.08), GUNMAT.metal, 0, -0.13, -0.02, 0.1);        // chargeur
    gunPart(g, gbox(0.05, 0.13, 0.075), GUNMAT.polymer, 0, -0.125, 0.14, -0.25);   // poignée
    gunPart(g, gbox(0.06, 0.08, 0.26), GUNMAT.polymer, 0, -0.005, 0.32);           // crosse
    gunPart(g, gbox(0.07, 0.12, 0.035), GUNMAT.black, 0, -0.02, 0.44);             // butée d'épaule
    return g;
  }

  // Mitrailleuse : canon épais sous cache, grosse boîte à munitions, bipied replié.
  function buildLMG() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.1, 0.13, 0.4), GUNMAT.metal, 0, 0, 0.02);                    // carcasse massive
    gunPart(g, gbox(0.09, 0.09, 0.34), GUNMAT.black, 0, 0.01, -0.36);              // cache-canon
    gunPart(g, gcyl(0.02, 0.3), GUNMAT.black, 0, 0.01, -0.66, Math.PI / 2);        // canon
    gunPart(g, gcyl(0.03, 0.07, 10), GUNMAT.metal, 0, 0.01, -0.79, Math.PI / 2);   // cache-flamme
    gunPart(g, gbox(0.03, 0.016, 0.4), GUNMAT.black, 0, 0.075, -0.14);             // rail
    gunPart(g, gbox(0.02, 0.05, 0.02), GUNMAT.black, 0, 0.1, -0.44);               // guidon
    gunPart(g, gbox(0.12, 0.18, 0.16), GUNMAT.polymer, 0, -0.14, -0.02);           // boîte à munitions
    gunPart(g, gbox(0.125, 0.04, 0.165), GUNMAT.accent, 0, -0.05, -0.02);          // couvercle accent
    gunPart(g, gbox(0.016, 0.16, 0.016), GUNMAT.metal, -0.035, -0.1, -0.5, 0.35);  // bipied replié
    gunPart(g, gbox(0.016, 0.16, 0.016), GUNMAT.metal, 0.035, -0.1, -0.5, 0.35);
    gunPart(g, gbox(0.05, 0.13, 0.075), GUNMAT.polymer, 0, -0.13, 0.16, -0.25);    // poignée
    gunPart(g, gbox(0.07, 0.09, 0.22), GUNMAT.polymer, 0, -0.005, 0.34);           // crosse
    gunPart(g, gbox(0.08, 0.13, 0.035), GUNMAT.black, 0, -0.02, 0.46);             // butée d'épaule
    return g;
  }

  // Deagle : gros pistolet — glissière large, guidon accent, poignée sombre.
  function buildDeagle() {
    const g = new THREE.Group();
    gunPart(g, gbox(0.055, 0.07, 0.3), GUNMAT.metal, 0, 0.02, -0.08);              // glissière
    gunPart(g, gbox(0.05, 0.05, 0.3), GUNMAT.black, 0, -0.03, -0.08);              // châssis
    gunPart(g, gcyl(0.014, 0.06), GUNMAT.black, 0, 0.025, -0.25, Math.PI / 2);     // bouche
    gunPart(g, gbox(0.016, 0.03, 0.016), GUNMAT.accent, 0, 0.065, -0.21);          // guidon
    gunPart(g, gbox(0.04, 0.03, 0.03), GUNMAT.accent, 0, 0.065, 0.05);             // hausse
    gunPart(g, gbox(0.05, 0.16, 0.09), GUNMAT.woodDark, 0, -0.12, 0.05, -0.35);    // poignée
    gunPart(g, gbox(0.045, 0.05, 0.05), GUNMAT.metal, 0, -0.05, -0.02);            // pontet
    return g;
  }

  const gun = new THREE.Group();
  const gunBuilders = {
    ar: buildAR, smg: buildSMG, shotgun: buildShotgun, dmr: buildDMR,
    lmg: buildLMG, sniper: buildSniper, deagle: buildDeagle,
  };
  const gunModels = {};
  for (const k in gunBuilders) {
    gunModels[k] = gunBuilders[k]();
    gunModels[k].visible = k === 'ar';
    gun.add(gunModels[k]);
  }
  gun.position.set(0.28, -0.26, -0.55);
  camera.add(gun);
  let gunKick = 0;
  let heat = 0; // chauffe du tir auto : élargit le spread, retombe entre les rafales

  /* ================= Personnages (style blocs, articulés) =================
     Le modèle regarde vers +z (group.rotation.y = facing des bots).
     Squelette : jambes pivotant à la hanche (cycle de marche), groupe « aim »
     (bras + arme) pivotant à l'épaule (baissé en patrouille, levé et incliné
     vers la cible en combat), tête avec casque équipe et visière.
     Toutes les briques du corps sont des cibles de raycast ('body'/'head') ;
     l'arme, elle, ne bloque pas les balles. */
  function buildCharacter(teamColor, weapon, name) {
    const g = new THREE.Group();
    const parts = [];
    const block = (parent, w, h, d, x, y, z, color, part, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      if (part) { m.userData.part = part; parts.push(m); }
      parent.add(m);
      return m;
    };
    const DARK = 0x3c4048, GEAR = 0x24262b, SKIN = 0xf2c14e;

    // Jambes : pivot à la hanche, botte au bout
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.19, 0.85, 0);
    legR.position.set(0.19, 0.85, 0);
    g.add(legL, legR);
    for (const leg of [legL, legR]) {
      block(leg, 0.34, 0.85, 0.34, 0, -0.425, 0, DARK, 'body');
      block(leg, 0.36, 0.2, 0.42, 0, -0.76, 0.04, GEAR, 'body'); // botte
    }

    // Torse, gilet tactique, ceinture (cache l'articulation), sac à dos
    block(g, 0.8, 0.75, 0.45, 0, 1.225, 0, teamColor, 'body');
    block(g, 0.58, 0.46, 0.52, 0, 1.26, 0, GEAR, 'body');            // gilet
    block(g, 0.16, 0.14, 0.08, -0.17, 1.33, 0.28, 0x5a6069, 'body'); // poches
    block(g, 0.16, 0.14, 0.08, 0.17, 1.33, 0.28, 0x5a6069, 'body');
    block(g, 0.82, 0.12, 0.47, 0, 0.9, 0, GEAR, 'body');             // ceinture
    block(g, 0.5, 0.55, 0.2, 0, 1.32, -0.33, DARK, 'body');          // sac à dos

    // Tête : casque aux couleurs de l'équipe + visière sombre
    const head = new THREE.Group();
    head.position.set(0, 1.9, 0);
    g.add(head);
    block(head, 0.55, 0.55, 0.55, 0, 0, 0, SKIN, 'head');
    block(head, 0.61, 0.24, 0.61, 0, 0.22, 0, teamColor, 'head');    // casque
    block(head, 0.45, 0.16, 0.07, 0, 0.03, 0.29, 0x1d2126, 'head');  // visière

    // Bras + arme dans le groupe de visée (pivot à hauteur d'épaule)
    const aim = new THREE.Group();
    aim.position.set(0, 1.52, 0);
    g.add(aim);
    block(aim, 0.22, 0.22, 0.62, 0.36, -0.05, 0.24, teamColor, 'body', 0.22);  // bras droit
    block(aim, 0.22, 0.22, 0.62, -0.22, -0.06, 0.32, teamColor, 'body', -0.55); // bras gauche
    block(aim, 0.17, 0.17, 0.17, 0.15, -0.15, 0.5, SKIN, 'body');    // mains
    block(aim, 0.17, 0.17, 0.17, 0.06, -0.1, 0.62, SKIN, 'body');
    // La vraie arme (mêmes modèles qu'en vue première personne), retournée pour
    // pointer vers +z ; le bout du canon sert aux traçantes. Tous les modèles
    // sont montés pour pouvoir refléter un changement d'arme (joueurs en ligne).
    const guns = {};
    for (const wName in WEAPONS) {
      const gm = gunBuilders[wName]();
      gm.rotation.y = Math.PI;
      gm.position.set(0.13, -0.04, 0.38);
      gm.userData.tip = new THREE.Vector3(0, 0.025, WEAPONS[wName].tip);
      gm.visible = wName === weapon;
      aim.add(gm);
      guns[wName] = gm;
    }

    // Étiquette de pseudo au-dessus de la tête (joueurs distants uniquement)
    if (name) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 56;
      const c2 = cv.getContext('2d');
      c2.font = '900 30px "Segoe UI", system-ui, sans-serif';
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.lineWidth = 7;
      c2.strokeStyle = 'rgba(0,0,0,.85)';
      c2.strokeText(name, 128, 28);
      c2.fillStyle = '#' + teamColor.toString(16).padStart(6, '0');
      c2.fillText(name, 128, 28);
      const tex = new THREE.CanvasTexture(cv);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      tag.position.set(0, 2.62, 0);
      tag.scale.set(2.1, 0.46, 1);
      g.add(tag);
    }

    scene.add(g);
    const res = {
      group: g, parts, anim: { legL, legR, aim, head, gun: guns[weapon] },
      setWeapon(w) {
        if (!guns[w]) return;
        for (const k in guns) guns[k].visible = k === w;
        res.anim.gun = guns[w];
      },
    };
    return res;
  }

  /* ================= Entités ================= */
  const player = {
    name: 'Toi', team: 'blue', isPlayer: true,
    pos: new THREE.Vector3(0, 0, -26), vy: 0, yaw: Math.PI, pitch: 0, grounded: true,
    hp: CFG.maxHP, dead: false, respawnAt: 0, protectedUntil: 0, lastDamage: -99,
    weapon: 'ar', ammo: 25, reloading: false, reloadEnd: 0, reloadDur: 1, nextShot: 0, switchEnd: 0,
    kills: 0, deaths: 0, streak: 0, nades: 2,
    spd: 0, crouching: false, // posture lue par l'IA des bots (précision)
  };
  const bots = [];
  function makeBot(name, team, weapon) {
    const ch = buildCharacter(TEAM[team].color, weapon);
    const b = {
      name, team, isPlayer: false, weapon,
      pos: new THREE.Vector3(), vy: 0, facing: 0,
      hp: CFG.maxHP, dead: false, respawnAt: 0, protectedUntil: 0, lastDamage: -99,
      ammo: WEAPONS[weapon].mag, reloading: false, reloadEnd: 0, nextShot: 0,
      path: null, pathI: 0, stuckT: 0, dieT: 0, target: null, losT: Math.random() * 0.25,
      strafeT: 0, strafeDir: 1, walkPhase: Math.random() * 7, gunKick: 0,
      kills: 0, deaths: 0, spd: 0, crouching: false,
      lastKnown: new THREE.Vector3(), huntT: 0, // chasse : dernière position vue de la cible
      group: ch.group, parts: ch.parts, anim: ch.anim,
    };
    b.parts.forEach(p => { p.userData.botRef = b; });
    bots.push(b);
    return b;
  }
  // Les bots ne sont construits qu'au premier lancement d'une partie solo.
  // Chaque équipe mélange les styles d'armes (le joueur complète l'équipe bleue).
  const BOT_WEAPONS = { blue: ['smg', 'sniper', 'lmg'], red: ['ar', 'dmr', 'shotgun', 'smg'] };
  let botsBuilt = false;
  function ensureBots() {
    if (botsBuilt) return;
    botsBuilt = true;
    BOT_NAMES.blue.forEach((n, i) => makeBot(n, 'blue', BOT_WEAPONS.blue[i]));
    BOT_NAMES.red.forEach((n, i) => makeBot(n, 'red', BOT_WEAPONS.red[i]));
  }

  /* ---- Joueurs distants (mode en ligne) : mêmes personnages, pilotés par le réseau ---- */
  const remotes = new Map(); // id serveur → entité distante
  function makeRemote(info) {
    const ch = buildCharacter(TEAM[info.team].color, info.weapon, info.name);
    const r = {
      id: info.id, name: info.name, team: info.team, weapon: info.weapon,
      isPlayer: false, isRemote: true,
      pos: new THREE.Vector3(), netPos: new THREE.Vector3(), netYaw: 0, netAim: 0.55,
      facing: 0, spd: 0, crouching: false,
      hp: CFG.maxHP, dead: false, protectedUntil: now() + CFG.protectionTime, lastDamage: -99,
      walkPhase: Math.random() * 7, gunKick: 0, dieT: 0,
      kills: 0, deaths: 0,
      group: ch.group, parts: ch.parts, anim: ch.anim, setWeapon: ch.setWeapon,
    };
    // position provisoire côté équipe, écrasée par le premier état reçu
    const s = world.spawns[info.team][0];
    r.pos.set(s[0], 0, s[1]);
    r.netPos.copy(r.pos);
    r.facing = r.netYaw = info.team === 'blue' ? 0 : Math.PI;
    r.parts.forEach(p => { p.userData.botRef = r; });
    remotes.set(r.id, r);
    return r;
  }
  function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    scene.remove(r.group);
    remotes.delete(id);
    const i = entities.indexOf(r);
    if (i >= 0) entities.splice(i, 1);
  }
  function clearRemotes() { for (const id of [...remotes.keys()]) removeRemote(id); }

  let mode = 'solo'; // 'solo' (bots locaux) | 'online' (joueurs distants via serveur)
  const entities = [player]; // combattants de la partie en cours (rempli par startMatch)

  const scores = { blue: 0, red: 0 };
  const spawnIdx = { blue: 0, red: 0 };
  let state = 'menu'; // 'menu' | 'play' | 'over'

  /* ================= HUD ================= */
  const $ = id => document.getElementById(id);
  const ui = {
    menu: $('menu'), hud: $('hud'), mobile: $('mobile'), resume: $('resume'),
    win: $('winOverlay'), winTitle: $('winTitle'), winScore: $('winScore'),
    scoreBlue: $('scoreBlue'), scoreRed: $('scoreRed'),
    hpbar: $('hpbar'), hpnum: $('hpnum'), ammo: $('ammo'), ammoNum: $('ammoNum'),
    hitmarker: $('hitmarker'), killfeed: $('killfeed'), protection: $('protection'),
    damageFlash: $('damageFlash'), scope: $('scope'),
    death: $('deathOverlay'), respawnTxt: $('respawnTxt'),
    kdNum: $('kdNum'), dmgdir: $('dmgdir'),
    weaponName: $('weaponName'), weaponBtn: $('btn-weapon'), reloadBar: $('reloadBar'),
    reloadRing: $('reloadRing'), loadout: $('loadout'), loadoutMsg: $('loadoutMsg'),
    nades: $('nades'), streak: $('streakMsg'), killMsg: $('killMsg'),
    scoreboard: $('scoreboard'), sbBlue: $('sbBlue'), sbRed: $('sbRed'),
  };
  const RING_LEN = 125.66; // circonférence du cercle SVG (2π × 20)
  function updateScores() {
    ui.scoreBlue.textContent = scores.blue;
    ui.scoreRed.textContent = scores.red;
  }
  function updateAmmo() {
    ui.ammoNum.textContent = player.ammo;
    ui.ammo.classList.toggle('reloading', player.reloading);
    ui.reloadRing.classList.toggle('show', player.reloading);
    if (player.reloading) ui.reloadRing.firstElementChild.style.strokeDashoffset = RING_LEN;
  }
  function updateHP() {
    const r = Math.max(0, player.hp) / CFG.maxHP;
    ui.hpbar.style.width = (r * 100) + '%';
    ui.hpbar.style.background = r > 0.5 ? '#4caf50' : r > 0.25 ? '#ffb02e' : '#e23c3c';
    ui.hpnum.textContent = Math.ceil(Math.max(0, player.hp));
  }
  function updateKD() {
    ui.kdNum.textContent = player.kills + ' / ' + player.deaths;
  }
  // Indicateur directionnel : d'où vient le tir (flèche autour du réticule)
  let dmgDirT = null;
  function showDamageDir(attacker) {
    if (!attacker || !attacker.pos) return;
    const brg = Math.atan2(attacker.pos.x - player.pos.x, attacker.pos.z - player.pos.z);
    const deg = -(brg - (player.yaw + Math.PI)) * 180 / Math.PI;
    ui.dmgdir.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
    ui.dmgdir.classList.add('show');
    clearTimeout(dmgDirT);
    dmgDirT = setTimeout(() => ui.dmgdir.classList.remove('show'), 650);
  }
  let hitT = null;
  function showHitmarker(head) {
    ui.hitmarker.classList.add('show');
    ui.hitmarker.classList.toggle('head', head);
    clearTimeout(hitT);
    hitT = setTimeout(() => ui.hitmarker.classList.remove('show'), 120);
  }
  // Confirmation de kill en bas de l'écran
  let killMsgT = null;
  function showKillMsg(victim, head) {
    ui.killMsg.textContent = head
      ? `💥 HEADSHOT — ${victim.name} éliminé !`
      : `🎯 ${victim.name} éliminé`;
    ui.killMsg.classList.add('show');
    clearTimeout(killMsgT);
    killMsgT = setTimeout(() => ui.killMsg.classList.remove('show'), 1800);
  }
  function feed(killer, victim, head) {
    const d = document.createElement('div');
    d.className = 'feeditem';
    d.innerHTML = killer === victim
      ? `<span class="${victim.team}">${victim.name}</span> 💥 (sa propre grenade)`
      : `<span class="${killer.team}">${killer.name}</span> 🎯${head ? '💥' : ''} <span class="${victim.team}">${victim.name}</span>`;
    ui.killfeed.prepend(d);
    while (ui.killfeed.children.length > 5) ui.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 4500);
  }

  /* ================= Physique ================= */
  const HALF = 0.35, HEIGHT = 1.8, STEP = 0.56;
  function collide(px, py, pz) {
    for (const c of world.colliders) {
      if (px + HALF > c.min.x && px - HALF < c.max.x &&
          py + HEIGHT > c.min.y && py < c.max.y &&
          pz + HALF > c.min.z && pz - HALF < c.max.z) return c;
    }
    return null;
  }
  // Déplacement horizontal d'une entité avec montée de marche automatique
  function tryAxis(e, axis, delta) {
    if (!delta) return true;
    const p = e.pos;
    const nx = axis === 'x' ? p.x + delta : p.x;
    const nz = axis === 'z' ? p.z + delta : p.z;
    const c = collide(nx, p.y, nz);
    if (!c) { p[axis] += delta; return true; }
    if (e.grounded !== false && c.max.y - p.y <= STEP && !collide(nx, c.max.y + 0.01, nz)) {
      p[axis] += delta;
      p.y = c.max.y + 0.01;
      return true;
    }
    return false;
  }
  // Hauteur du sol le plus haut sous une empreinte (pour la gravité des bots)
  function groundY(x, z, y) {
    let g = 0;
    for (const c of world.colliders) {
      if (x + HALF > c.min.x && x - HALF < c.max.x &&
          z + HALF > c.min.z && z - HALF < c.max.z &&
          c.max.y <= y + 0.06 && c.max.y > g) g = c.max.y;
    }
    return g;
  }

  /* ================= Navigation des bots (graphe) ================= */
  const nav = world.nav;
  const adj = nav.nodes.map(() => []);
  for (const [a, b] of nav.links) { adj[a].push(b); adj[b].push(a); }
  function nearestNode(p) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < nav.nodes.length; i++) {
      const n = nav.nodes[i];
      const d = (p.x - n[0]) ** 2 + (p.z - n[2]) ** 2 + 6 * (p.y - n[1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function findPath(from, to) { // BFS : le graphe est petit, pas besoin d'A*
    if (from === to) return [to];
    const prev = new Array(nav.nodes.length).fill(-1);
    prev[from] = from;
    const queue = [from];
    for (let h = 0; h < queue.length; h++) {
      for (const v of adj[queue[h]]) {
        if (prev[v] !== -1) continue;
        prev[v] = queue[h];
        if (v === to) {
          const path = [to];
          let c = to;
          while (c !== from) { c = prev[c]; path.push(c); }
          return path.reverse();
        }
        queue.push(v);
      }
    }
    return null;
  }

  /* ================= Visée / raycasts ================= */
  const shootRay = new THREE.Raycaster();
  const losRay = new THREE.Raycaster();
  const eyeOf = e => e.isPlayer
    ? new THREE.Vector3(e.pos.x, e.pos.y + eyeH, e.pos.z)
    : new THREE.Vector3(e.pos.x, e.pos.y + 1.75, e.pos.z);
  function los(a, b) {
    const o = eyeOf(a), t = eyeOf(b);
    const dir = t.sub(o);
    const d = dir.length();
    losRay.set(o, dir.normalize());
    losRay.far = Math.max(0.1, d - 0.3);
    return losRay.intersectObjects(world.solids, false).length === 0;
  }

  /* ================= Dégâts / éliminations ================= */
  function applyDamage(target, dmg, attacker, head) {
    if (state !== 'play' || target.dead || now() < target.protectedUntil) return;
    target.hp -= dmg;
    target.lastDamage = now();
    if (target.isPlayer) {
      ui.damageFlash.style.opacity = '1';
      setTimeout(() => { ui.damageFlash.style.opacity = '0'; }, 90);
      updateHP();
      showDamageDir(attacker);
      Sfx.damage();
    }
    if (target.hp <= 0) kill(target, attacker, head);
  }
  function kill(victim, killer, head) {
    victim.dead = true;
    victim.respawnAt = now() + CFG.respawnDelay;
    victim.deaths++;
    // le point d'un suicide (sa propre grenade) va à l'équipe adverse
    const team = killer.team === victim.team
      ? (victim.team === 'blue' ? 'red' : 'blue') : killer.team;
    if (killer !== victim) killer.kills++;
    scores[team]++;
    updateScores();
    feed(killer, victim, head);
    if (killer.isPlayer && killer !== victim) { updateKD(); Sfx.kill(); showKillMsg(victim, head); onPlayerKill(); }
    if (victim.isPlayer) {
      player.streak = 0;
      updateKD();
      Sfx.death();
      ui.death.classList.add('show');
      Input.fire = false;
      Input.ads = false;
    } else {
      victim.dieT = 0.9; // animation de chute avant disparition
    }
    if (sbShown) renderScoreboard();
    if (scores[team] >= CFG.scoreToWin) endGame(team);
  }

  /* ================= Killstreaks (série sans mourir) ================= */
  let uavUntil = 0, rushUntil = 0, announceT = null;
  const rushed = () => now() < rushUntil;
  function announce(txt) {
    ui.streak.textContent = txt;
    ui.streak.classList.add('show');
    clearTimeout(announceT);
    announceT = setTimeout(() => ui.streak.classList.remove('show'), 2800);
  }
  function onPlayerKill() {
    player.streak++;
    if (player.streak === 3) { uavUntil = now() + 12; announce('📡 UAV — radar ennemi pendant 12 s'); Sfx.streak(); }
    else if (player.streak === 5) { rushUntil = now() + 12; announce('⚡ RUSH — vitesse et rechargement boostés 12 s'); Sfx.streak(); }
  }

  // Radar UAV : centré sur le joueur, le haut = direction du regard
  const radar = $('radar'), rctx = radar.getContext('2d');
  function drawRadar() {
    const on = state === 'play' && now() < uavUntil;
    radar.classList.toggle('show', on);
    if (!on) return;
    const S = radar.width, c = S / 2, scale = (c - 6) / 30; // rayon affiché = 30 m
    rctx.clearRect(0, 0, S, S);
    rctx.fillStyle = 'rgba(6,18,10,.78)';
    rctx.beginPath(); rctx.arc(c, c, c - 2, 0, 7); rctx.fill();
    rctx.strokeStyle = 'rgba(110,255,150,.4)';
    rctx.lineWidth = 1;
    for (const r of [c - 2, (c - 2) / 2]) { rctx.beginPath(); rctx.arc(c, c, r, 0, 7); rctx.stroke(); }
    const cos = Math.cos(player.yaw), sin = Math.sin(player.yaw);
    for (const b of entities) {
      if (b === player || b.dead) continue;
      const dx = b.pos.x - player.pos.x, dz = b.pos.z - player.pos.z;
      const rx = (dx * cos - dz * sin) * scale;  // composante « droite » du joueur
      const ry = (dx * sin + dz * cos) * scale;  // composante « arrière » (bas du radar)
      const l = Math.hypot(rx, ry), max = c - 6;
      const k = l > max ? max / l : 1; // les cibles hors portée restent collées au bord
      rctx.fillStyle = b.team === 'red' ? '#ff5a5a' : '#6ea0ff';
      rctx.beginPath();
      rctx.arc(c + rx * k, c + ry * k, 3.2, 0, 7);
      rctx.fill();
    }
    rctx.fillStyle = '#fff'; // joueur : triangle vers le haut
    rctx.beginPath();
    rctx.moveTo(c, c - 5); rctx.lineTo(c - 4, c + 4); rctx.lineTo(c + 4, c + 4);
    rctx.fill();
  }
  function respawn(e) {
    const list = world.spawns[e.team];
    const [x, z] = list[spawnIdx[e.team]++ % list.length];
    e.pos.set(x, 0, z);
    e.vy = 0;
    e.hp = CFG.maxHP;
    e.dead = false;
    e.protectedUntil = now() + CFG.protectionTime;
    e.lastDamage = -99;
    e.ammo = WEAPONS[e.weapon].mag;
    e.reloading = false;
    e.nextShot = 0;
    if (e.isPlayer) {
      e.yaw = e.team === 'blue' ? Math.PI : 0;
      e.pitch = 0;
      e.switchEnd = 0;
      e.nades = CFG.nades;
      heat = 0;
      // l'équipement choisi dans le menu (B) s'applique à la réapparition
      loadout.primary = chosenWeapon;
      e.weapon = loadout.primary;
      e.ammo = WEAPONS[e.weapon].mag;
      ammoStore[loadout.primary] = WEAPONS[loadout.primary].mag; // chargeurs pleins
      ammoStore.deagle = WEAPONS.deagle.mag;
      ui.death.classList.remove('show');
      updateHP();
      updateAmmo();
      updateNadeUI();
      updateWeaponUI();
    } else {
      e.group.visible = true;
      e.group.rotation.set(0, 0, 0);
      e.dieT = 0;
      e.path = null;
      e.target = null;
      e.huntT = 0;
    }
  }
  function regen(e, dt) {
    if (!e.dead && e.hp < CFG.maxHP && now() - e.lastDamage >= CFG.regenDelay) {
      e.hp = Math.min(CFG.maxHP, e.hp + CFG.regenRate * dt);
      if (e.isPlayer) updateHP();
    }
  }

  /* ================= Changement d'arme (principale ↔ Deagle) ================= */
  // Chaque arme garde son propre chargeur entre deux changements
  const ammoStore = { ar: WEAPONS.ar.mag, deagle: WEAPONS.deagle.mag };
  function updateWeaponUI() {
    ui.weaponName.textContent = WEAPONS[player.weapon].label;
    ui.weaponBtn.textContent = WEAPONS[player.weapon].short;
    for (const k in gunModels) gunModels[k].visible = k === player.weapon;
  }
  function switchWeapon(to) {
    if (to === 'toggle') to = player.weapon === loadout.primary ? 'secondary' : 'primary';
    if (to === 'primary') to = loadout.primary;
    else if (to === 'secondary') to = 'deagle';
    if (!WEAPONS[to] || to === player.weapon || player.dead) return;
    ammoStore[player.weapon] = player.ammo;
    player.weapon = to;
    player.ammo = ammoStore[to] !== undefined ? ammoStore[to] : WEAPONS[to].mag;
    player.reloading = false; // un rechargement en cours est annulé
    player.switchEnd = now() + CFG.switchTime;
    player.nextShot = Math.max(player.nextShot, player.switchEnd);
    Sfx.swap();
    updateAmmo();
    updateWeaponUI();
  }

  /* ================= Tableau des scores (Tab / tap sur le score) ================= */
  let sbShown = false, sbPinned = false;
  function renderScoreboard() {
    for (const team of ['blue', 'red']) {
      const rows = entities.filter(e => e.team === team)
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      const tbl = team === 'blue' ? ui.sbBlue : ui.sbRed;
      tbl.innerHTML = `<tr><th>${TEAM[team].name}</th><th>K</th><th>D</th></tr>` +
        rows.map(e => `<tr${e.isPlayer ? ' class="me"' : ''}><td>${e.name}</td><td>${e.kills}</td><td>${e.deaths}</td></tr>`).join('');
    }
  }
  function setScoreboard(v) {
    if (v === sbShown) return;
    sbShown = v;
    if (v) renderScoreboard();
    ui.scoreboard.classList.toggle('hidden', !v);
  }
  $('scores').addEventListener('click', () => { if (state === 'play') sbPinned = !sbPinned; });

  /* ================= Grenades (joueur uniquement) ================= */
  const NADE_R = 0.13;
  const nades = [];
  {
    const geo = new THREE.SphereGeometry(NADE_R, 10, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3d5240 });
    for (let i = 0; i < 10; i++) { // pool élargi : grenades locales + distantes
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      nades.push({ mesh: m, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, active: false });
    }
  }
  function updateNadeUI() { ui.nades.textContent = '🧨 ×' + player.nades; }
  function nadeHit(x, y, z) {
    for (const c of world.colliders) {
      if (x + NADE_R > c.min.x && x - NADE_R < c.max.x &&
          y + NADE_R > c.min.y && y - NADE_R < c.max.y &&
          z + NADE_R > c.min.z && z - NADE_R < c.max.z) return true;
    }
    return false;
  }
  let nadeNext = 0;
  function throwNade() {
    if (player.nades <= 0 || now() < nadeNext || now() < player.switchEnd) return;
    const n = nades.find(x => !x.active);
    if (!n) return;
    player.nades--;
    nadeNext = now() + 0.8;
    updateNadeUI();
    Sfx.pin();
    camera.getWorldDirection(_dir);
    n.pos.copy(camera.position).addScaledVector(_dir, 0.5);
    n.vel.copy(_dir).multiplyScalar(CFG.nadeSpeed);
    n.vel.y += 3.5; // trajectoire en cloche
    n.fuse = CFG.nadeFuse;
    n.active = true;
    n.remote = false;
    n.mesh.visible = true;
    if (mode === 'online') Net.nade(n.pos, n.vel);
  }
  const _nadeC = new THREE.Vector3(), _nadeD = new THREE.Vector3();
  function explode(n) {
    n.active = false;
    n.mesh.visible = false;
    Effects.explosion(n.pos);
    Sfx.explosion(Math.max(0.15, 1 - n.pos.distanceTo(player.pos) / 50));
    // grenade d'un autre joueur : visuel seulement, ses dégâts sont revendiqués par lui
    if (n.remote) return;
    if (mode === 'online') Net.boom(n.pos);
    for (const e of entities) {
      // touche les ennemis et le lanceur lui-même, épargne ses alliés
      if (e.dead || (e !== player && e.team === player.team)) continue;
      _nadeC.set(e.pos.x, e.pos.y + 0.9, e.pos.z);
      const d = n.pos.distanceTo(_nadeC);
      if (d > CFG.nadeRadius) continue;
      _nadeD.subVectors(_nadeC, n.pos).normalize();
      losRay.set(n.pos, _nadeD);
      losRay.far = Math.max(0.1, d - 0.4);
      if (losRay.intersectObjects(world.solids, false).length) continue; // à l'abri derrière un mur
      const dmg = CFG.nadeDmg * (1 - d / CFG.nadeRadius);
      if (mode === 'online') Net.nadeHit(e === player ? Net.id : e.id, dmg);
      else applyDamage(e, dmg, player, false);
      if (!e.isPlayer) showHitmarker(false);
    }
  }
  function stepNades(dt) {
    for (const n of nades) {
      if (!n.active) continue;
      n.fuse -= dt;
      if (n.fuse <= 0) { explode(n); continue; }
      n.vel.y += CFG.gravity * dt;
      for (const ax of 'xyz') { // déplacement axe par axe avec rebond amorti
        const d = n.vel[ax] * dt;
        if (!d) continue;
        const nx = ax === 'x' ? n.pos.x + d : n.pos.x;
        const ny = ax === 'y' ? n.pos.y + d : n.pos.y;
        const nz = ax === 'z' ? n.pos.z + d : n.pos.z;
        if ((ax === 'y' && ny < NADE_R) || nadeHit(nx, ny, nz)) {
          n.vel[ax] *= -0.42;
          if (ax === 'y') {
            n.vel.x *= 0.7; n.vel.z *= 0.7; // friction à chaque rebond au sol
            if (Math.abs(n.vel.y) < 1.2) n.vel.y = 0;
          }
        } else {
          n.pos[ax] = ax === 'x' ? nx : ax === 'y' ? ny : nz;
        }
      }
      n.mesh.position.copy(n.pos);
    }
  }

  /* ================= Tir du joueur ================= */
  const _dir = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _end = new THREE.Vector3();
  // Décroissance des dégâts avec la distance (fusil à pompe) — même formule côté serveur
  function falloff(w, d) {
    if (!w.rangeFull || d <= w.rangeFull) return w.rangeFull && d >= w.rangeMax ? 0 : 1;
    if (d >= w.rangeMax) return 0;
    return 1 - (d - w.rangeFull) / (w.rangeMax - w.rangeFull) * (1 - w.dmgMin);
  }
  const _pellets = new Map(); // cible → dégâts cumulés du coup (plombs du pompe)
  function playerShoot() {
    const w = WEAPONS[player.weapon];
    player.nextShot = now() + w.interval;
    player.ammo--;
    updateAmmo();
    gunKick = 1;
    Sfx.shot(player.weapon);
    // recul : la caméra monte à chaque tir (avec une dérive latérale aléatoire),
    // et le spread s'élargit quand on maintient la rafale (chauffe)
    heat = Math.min(8, heat + (w.heatPerShot || 1));
    player.pitch += w.kick * (0.8 + Math.random() * 0.4);
    player.yaw += (Math.random() - 0.5) * w.kick * 0.6;
    camera.localToWorld(_muzzle.set(w.muzzle[0], w.muzzle[1], w.muzzle[2])); // bout du canon
    Effects.muzzle(_muzzle);
    // fusil à pompe : gerbe fixe de plombs, à peine resserrée en visée
    const spread = w.pellets
      ? w.pspread * (Input.ads ? 0.75 : 1)
      : (Input.ads ? w.spreadAds : w.spreadHip) * (1 + heat * 0.16);
    const targets = world.solids.slice();
    for (const e of entities) if (e !== player && !e.dead) targets.push(...e.parts);
    _pellets.clear();
    for (let i = 0; i < (w.pellets || 1); i++) {
      camera.getWorldDirection(_dir);
      _dir.x += (Math.random() - 0.5) * spread * 2;
      _dir.y += (Math.random() - 0.5) * spread * 2;
      _dir.z += (Math.random() - 0.5) * spread * 2;
      _dir.normalize();
      shootRay.set(camera.position, _dir);
      shootRay.far = Infinity;
      const hits = shootRay.intersectObjects(targets, false);
      if (hits.length) {
        _end.copy(hits[0].point);
        const ref = hits[0].object.userData.botRef;
        if (ref && ref.team !== player.team) {
          const head = hits[0].object.userData.part === 'head';
          const f = falloff(w, hits[0].distance);
          let rec = _pellets.get(ref);
          if (!rec) _pellets.set(ref, rec = { dmg: 0, nb: 0, nh: 0, head: false });
          rec.dmg += w.dmg * (head ? (w.headMul || 2) : 1) * f;
          if (f > 0) { if (head) rec.nh++; else rec.nb++; }
          rec.head = rec.head || head;
          Effects.impact(_end, 0xc0392b);
        } else {
          Effects.impact(_end, 0xffd257);
        }
      } else {
        _end.copy(camera.position).addScaledVector(_dir, 80);
      }
      Effects.tracer(_muzzle, _end);
      if (i === 0 && mode === 'online') Net.shoot(_muzzle, _end, player.weapon);
    }
    // dégâts appliqués une fois par cible (les plombs du pompe sont cumulés)
    for (const [ref, rec] of _pellets) {
      if (rec.dmg <= 0) continue;
      // en ligne, le serveur valide et applique les dégâts (hitmarker optimiste)
      if (mode === 'online') Net.hit(ref.id, rec.head, player.weapon, rec.nb, rec.nh);
      else applyDamage(ref, rec.dmg, player, rec.head);
      showHitmarker(rec.head);
      if (rec.head) Sfx.headshot(); else Sfx.hit();
    }
  }

  /* ================= Mise à jour du joueur ================= */
  let prevFire = false;
  let eyeH = CFG.eyeHeight; // hauteur d'yeux lissée (descend quand on s'accroupit)
  function updatePlayer(dt) {
    if (player.dead) {
      const left = player.respawnAt - now();
      ui.respawnTxt.textContent = 'Réapparition dans ' + Math.max(0, left).toFixed(1) + ' s';
      if (left <= 0) {
        respawn(player);
        if (mode === 'online') Net.spawn(player.pos); // le serveur réarme PV + protection
      }
      Input.lookDX = Input.lookDY = 0;
      Input.weaponQueued = null;
      Input.nadeQueued = false;
      return;
    }
    // --- Vue ---
    player.yaw -= Input.lookDX * 0.0022 * sens;
    player.pitch -= Input.lookDY * 0.0022 * sens;
    const stickSens = (Input.ads && player.weapon === 'sniper' ? 0.7 : 2.6) * sens;
    player.yaw -= Input.lookStick.x * stickSens * dt;
    player.pitch -= Input.lookStick.y * stickSens * 0.7 * dt;
    player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
    Input.lookDX = Input.lookDY = 0;
    camera.rotation.set(player.pitch, player.yaw, 0);

    // --- Déplacement ---
    const fw = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
    const rt = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
    let mx = fw.x * Input.move.y + rt.x * Input.move.x;
    let mz = fw.z * Input.move.y + rt.z * Input.move.x;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    // Sprint : Verr Maj sur PC, joystick poussé à fond sur mobile (pas en ADS ni accroupi)
    const sprinting = !Input.ads && !Input.crouch && len > 0.1 &&
      (Input.sprint || (Input.isTouch && Math.hypot(Input.move.x, Input.move.y) > 0.95));
    const sp = CFG.moveSpeed * (Input.crouch ? CFG.crouchMul : Input.ads ? CFG.adsSpeedMul : sprinting ? CFG.sprintMul : 1)
      * (WEAPONS[player.weapon].speed || 1) // arme légère = rapide, LMG = lourde
      * (rushed() ? 1.25 : 1); // killstreak RUSH
    const px0 = player.pos.x, pz0 = player.pos.z;
    tryAxis(player, 'x', mx * sp * dt);
    tryAxis(player, 'z', mz * sp * dt);
    // posture lue par les bots pour leur précision
    player.spd = Math.hypot(player.pos.x - px0, player.pos.z - pz0) / Math.max(dt, 1e-4);
    player.crouching = Input.crouch;

    // --- Saut / gravité ---
    if (Input.jumpQueued && player.grounded) { player.vy = CFG.jumpSpeed; player.grounded = false; }
    Input.jumpQueued = false;
    player.vy += CFG.gravity * dt;
    let ny = player.pos.y + player.vy * dt;
    const cv = collide(player.pos.x, ny, player.pos.z);
    if (cv) {
      if (player.vy < 0) { ny = cv.max.y; player.grounded = true; }
      else ny = cv.min.y - HEIGHT - 0.01;
      player.vy = 0;
    } else if (ny <= 0) {
      ny = 0; player.vy = 0; player.grounded = true;
    } else {
      player.grounded = false;
    }
    player.pos.y = ny;
    const targetEye = Input.crouch ? CFG.crouchEyeHeight : CFG.eyeHeight;
    eyeH += (targetEye - eyeH) * Math.min(1, dt * 10);
    camera.position.set(player.pos.x, player.pos.y + eyeH, player.pos.z);

    // --- Arme ---
    if (Input.weaponQueued) { switchWeapon(Input.weaponQueued); Input.weaponQueued = null; }
    if (Input.nadeQueued) { throwNade(); Input.nadeQueued = false; }
    heat = Math.max(0, heat - dt * 5);
    const w = WEAPONS[player.weapon];
    if (player.reloading && now() >= player.reloadEnd) {
      player.reloading = false;
      player.ammo = w.mag;
      updateAmmo();
      Sfx.reloadEnd();
    }
    if (!player.reloading && (Input.reloadQueued || player.ammo === 0) && player.ammo < w.mag) {
      player.reloading = true;
      player.reloadDur = w.reloadT * (rushed() ? 0.5 : 1); // RUSH : 2× plus rapide
      player.reloadEnd = now() + player.reloadDur;
      updateAmmo();
      Sfx.reloadStart();
    }
    Input.reloadQueued = false;
    const wantFire = Input.fire && (w.auto || !prevFire);
    prevFire = Input.fire;
    if (!player.reloading && wantFire && player.ammo > 0 && now() >= player.nextShot) playerShoot();

    // --- FOV / lunette ---
    const targetFov = Input.ads ? w.adsFov : CFG.baseFov + (sprinting ? 6 : 0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    const scoped = player.weapon === 'sniper' && Input.ads && camera.fov < w.adsFov + 8;
    ui.scope.classList.toggle('show', scoped);
    gun.visible = !scoped;

    // --- Animation de l'arme (recul, marche, rechargement, changement) ---
    gunKick = Math.max(0, gunKick - dt * 6);
    const bob = len > 0.1 && player.grounded ? Math.sin(now() * 10) * 0.01 : 0;
    let dip = 0; // plongeon de l'arme : cloche sinusoïdale sur la progression
    if (player.reloading) {
      const p = Math.min(1, Math.max(0, 1 - (player.reloadEnd - now()) / player.reloadDur));
      dip = Math.sin(Math.PI * p) * 0.22;
      ui.reloadBar.style.width = (p * 100) + '%';
      ui.reloadRing.firstElementChild.style.strokeDashoffset = RING_LEN * (1 - p);
    } else if (now() < player.switchEnd) {
      dip = Math.sin(Math.PI * (1 - (player.switchEnd - now()) / CFG.switchTime)) * 0.3;
    }
    gun.position.set(0.28, -0.26 + bob - dip, -0.55 + gunKick * 0.13);
    gun.rotation.set(-dip * 2.4, 0.05, dip * 0.9); // léger yaw pour voir le flanc de l'arme, canon qui bascule vers le bas

    regen(player, dt);
    ui.protection.classList.toggle('show', now() < player.protectedUntil);
  }

  /* ================= IA des bots ================= */
  function acquireTarget(b) {
    let best = null, bestD = 48;
    for (const e of entities) {
      if (e.team === b.team || e.dead) continue;
      const d = b.pos.distanceTo(e.pos);
      if (d < bestD && los(b, e)) { best = e; bestD = d; }
    }
    return best;
  }
  function botMove(b, dx, dz, dt, speed) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return;
    tryAxis(b, 'x', dx / l * speed * dt);
    tryAxis(b, 'z', dz / l * speed * dt);
  }
  const _prevPos = new THREE.Vector3(), _animPrev = new THREE.Vector3();
  const _botFrom = new THREE.Vector3(), _botEnd = new THREE.Vector3(), _botDir = new THREE.Vector3();
  function updateBot(b, dt) {
    if (b.dead) {
      if (b.dieT > 0) { // bascule en avant puis disparaît
        b.dieT -= dt;
        b.group.rotation.x = -Math.min(1, (0.9 - b.dieT) / 0.4) * Math.PI / 2;
        if (b.dieT <= 0) b.group.visible = false;
      }
      if (now() >= b.respawnAt) respawn(b);
      return;
    }
    regen(b, dt);
    _animPrev.copy(b.pos); // pour mesurer la vitesse réelle (cycle de marche)
    const w = WEAPONS[b.weapon];
    if (b.reloading && now() >= b.reloadEnd) { b.reloading = false; b.ammo = w.mag; }

    b.losT -= dt;
    if (b.losT <= 0) {
      b.losT = 0.25;
      const had = b.target && !b.target.dead;
      b.target = acquireTarget(b);
      if (!b.target && had) {
        // cible perdue de vue → aller vérifier sa dernière position connue
        b.huntT = 6;
        b.path = findPath(nearestNode(b.pos), nearestNode(b.lastKnown));
        b.pathI = 0;
        b.stuckT = 0;
      }
    }

    if (b.target && !b.target.dead) {
      const t = b.target;
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      b.facing = Math.atan2(dx, dz);
      // petit strafe latéral pendant le combat
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = 0.6 + Math.random(); b.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      botMove(b, -dz * b.strafeDir, dx * b.strafeDir, dt, 2.2);
      // avance vers une cible lointaine, recule si elle colle
      if (d > 25) botMove(b, dx, dz, dt, 3);
      else if (d < 8) botMove(b, -dx, -dz, dt, 2.2);
      b.lastKnown.copy(t.pos); // mémorisée pour la chasse si la cible disparaît
      // tir : probabilité de toucher selon la distance + traçante/flash/son
      // (le fusil à pompe ne tire qu'à courte portée : botMaxD)
      if (!b.reloading && now() >= b.nextShot && d <= (w.botMaxD || 60)) {
        b.nextShot = now() + w.botInterval;
        b.ammo--;
        if (b.ammo <= 0) { b.reloading = true; b.reloadEnd = now() + w.reloadT; }
        // précision selon la posture de la cible : accroupi = dur, immobile = facile
        let hitChance = Math.max(0.12, 0.8 - d * 0.016);
        if (t.crouching) hitChance *= 0.65;
        else if (t.spd > 7) hitChance *= 0.8;               // en sprint
        if (!t.crouching && t.spd < 0.5) hitChance *= 1.25; // à l'arrêt
        const hit = Math.random() < Math.min(0.95, hitChance);
        _botEnd.set(t.pos.x, t.pos.y + 1.2, t.pos.z);
        if (!hit) { // balle perdue : point d'arrivée décalé
          _botEnd.x += (Math.random() - 0.5) * 3;
          _botEnd.y += Math.random() * 1.6;
          _botEnd.z += (Math.random() - 0.5) * 3;
        }
        // la traçante part du vrai bout du canon de l'arme du bot
        b.group.position.copy(b.pos);
        b.group.rotation.y = b.facing;
        b.group.updateMatrixWorld(true);
        _botFrom.copy(b.anim.gun.userData.tip);
        b.anim.gun.localToWorld(_botFrom);
        _botDir.subVectors(_botEnd, _botFrom).normalize();
        b.gunKick = 1; // léger recul visible de l'arme
        Effects.muzzle(_botFrom);
        Effects.tracer(_botFrom, _botEnd);
        Sfx.shot(b.weapon, Math.max(0, 1 - b.pos.distanceTo(player.pos) / 45));
        if (hit) {
          const head = Math.random() < 0.12;
          if (!t.isPlayer) Effects.impact(_botEnd, 0xc0392b);
          // botDmg : dégâts forfaitaires du pompe (gerbe non simulée pour les bots)
          applyDamage(t, (w.botDmg || w.dmg) * (head ? 2 : 1), b, head);
        }
      }
    } else {
      // patrouille : suit un chemin dans le graphe de navigation (étage inclus).
      // En chasse (huntT > 0), le chemin mène à la dernière position vue de la cible.
      if (b.huntT > 0) b.huntT -= dt;
      if (!b.path || b.pathI >= b.path.length) {
        b.huntT = 0; // arrivé sur place sans retrouver la cible → patrouille normale
        b.path = findPath(nearestNode(b.pos), (Math.random() * nav.nodes.length) | 0);
        b.pathI = 0;
        b.stuckT = 0;
      }
      if (b.path && b.pathI < b.path.length) {
        const n = nav.nodes[b.path[b.pathI]];
        const dx = n[0] - b.pos.x, dz = n[2] - b.pos.z;
        b.facing = Math.atan2(dx, dz);
        _prevPos.copy(b.pos);
        botMove(b, dx, dz, dt, b.huntT > 0 ? 4.6 : 4);
        b.stuckT = b.pos.distanceTo(_prevPos) < 4 * dt * 0.3 ? b.stuckT + dt : 0;
        if (b.stuckT > 0.7) b.path = null; // bloqué → nouveau chemin
        else if (Math.hypot(dx, dz) < 0.8 && Math.abs(n[1] - b.pos.y) < 1.2) b.pathI++;
      }
    }
    // gravité simplifiée : descente jusqu'au sol le plus haut sous les pieds
    // (la montée des marches est gérée par tryAxis → les bots prennent les escaliers)
    const gy = groundY(b.pos.x, b.pos.z, b.pos.y);
    b.pos.y = b.pos.y > gy + 0.01 ? Math.max(gy, b.pos.y - 9 * dt) : gy;

    // --- Animation : cycle de marche, visée, recul de tir ---
    const spd = Math.hypot(b.pos.x - _animPrev.x, b.pos.z - _animPrev.z) / Math.max(dt, 1e-4);
    b.spd = spd; // posture lue par les autres bots (précision)
    b.walkPhase += Math.min(spd, 6) * dt * 3.4;
    const sw = Math.sin(b.walkPhase) * Math.min(1, spd / 4) * 0.55;
    b.anim.legL.rotation.x = sw;   // jambes en opposition
    b.anim.legR.rotation.x = -sw;
    // arme baissée en patrouille, mi-levée en chasse, inclinée vers la cible en combat
    let aimPitch = b.huntT > 0 ? 0.15 : 0.55;
    if (b.target && !b.target.dead) {
      const ty = (b.target.pos.y + 1.4) - (b.pos.y + 1.52);
      const th = Math.hypot(b.target.pos.x - b.pos.x, b.target.pos.z - b.pos.z);
      aimPitch = -Math.atan2(ty, Math.max(th, 0.5));
    }
    b.anim.aim.rotation.x += (aimPitch - b.anim.aim.rotation.x) * Math.min(1, dt * 10);
    b.anim.head.rotation.x = b.anim.aim.rotation.x * 0.35; // la tête suit un peu
    b.gunKick = Math.max(0, b.gunKick - dt * 5);
    b.anim.aim.position.z = -0.09 * b.gunKick;

    // synchro du mesh + clignotement pendant la protection
    b.group.position.copy(b.pos);
    b.group.rotation.y = b.facing;
    b.group.visible = now() < b.protectedUntil ? (Math.floor(now() * 8) % 2 === 0) : true;
  }

  /* ================= Joueurs distants (mode en ligne) =================
     Position/orientation interpolées vers le dernier état reçu (~15 Hz),
     mêmes animations que les bots : cycle de marche, visée, recul, mort. */
  function updateRemote(r, dt) {
    if (r.dead) {
      if (r.dieT > 0) { // même bascule avant que les bots
        r.dieT -= dt;
        r.group.rotation.x = -Math.min(1, (0.9 - r.dieT) / 0.4) * Math.PI / 2;
        if (r.dieT <= 0) r.group.visible = false;
      }
      return;
    }
    _animPrev.copy(r.pos);
    if (r.pos.distanceTo(r.netPos) > 6) r.pos.copy(r.netPos); // trop loin (respawn) → téléporte
    else r.pos.lerp(r.netPos, Math.min(1, dt * 12));
    let dy = r.netYaw - r.facing;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy)); // angle le plus court
    r.facing += dy * Math.min(1, dt * 12);

    const spd = _animPrev.distanceTo(r.pos) / Math.max(dt, 1e-4);
    r.spd = spd;
    r.walkPhase += Math.min(spd, 6) * dt * 3.4;
    const sw = Math.sin(r.walkPhase) * Math.min(1, spd / 4) * 0.55;
    r.anim.legL.rotation.x = sw;
    r.anim.legR.rotation.x = -sw;
    r.anim.aim.rotation.x += (r.netAim - r.anim.aim.rotation.x) * Math.min(1, dt * 10);
    r.anim.head.rotation.x = r.anim.aim.rotation.x * 0.35;
    r.gunKick = Math.max(0, r.gunKick - dt * 5);
    r.anim.aim.position.z = -0.09 * r.gunKick;
    const ts = r.crouching ? 0.72 : 1; // accroupi : personnage tassé
    r.group.scale.y += (ts - r.group.scale.y) * Math.min(1, dt * 10);

    r.group.position.copy(r.pos);
    r.group.rotation.y = r.facing;
    r.group.visible = now() < r.protectedUntil ? (Math.floor(now() * 8) % 2 === 0) : true;
  }

  /* ================= Fin de partie ================= */
  function endGame(team) {
    state = 'over';
    sbPinned = false;
    setLoadout(false);
    setScoreboard(false);
    radar.classList.remove('show');
    ui.winTitle.textContent = team === player.team ? '🏆 Victoire des ' + TEAM[team].name + ' !' : '💀 Défaite… Les ' + TEAM[team].name + ' gagnent';
    ui.winScore.textContent = 'Bleus ' + scores.blue + ' — ' + scores.red + ' Rouges';
    $('btn-replay').textContent = mode === 'online' ? 'RETOUR AU LOBBY' : 'REJOUER';
    ui.win.classList.remove('hidden');
    ui.hud.classList.add('hidden');
    ui.mobile.classList.add('hidden');
    if (team === player.team) Sfx.win(); else Sfx.lose();
    if (document.exitPointerLock) document.exitPointerLock();
  }

  /* ================= Menu / démarrage ================= */
  // Sensibilité de visée (souris et joystick), mémorisée entre les sessions
  let sens = parseFloat(localStorage.getItem('blocops-sens')) || 1;
  const sensEl = $('sens'), sensVal = $('sensVal');
  sensEl.value = sens;
  sensVal.textContent = '×' + sens.toFixed(2);
  sensEl.addEventListener('input', () => {
    sens = parseFloat(sensEl.value);
    sensVal.textContent = '×' + sens.toFixed(2);
    localStorage.setItem('blocops-sens', sens);
  });
  // Son : bouton du menu + touche M en jeu
  const soundBtn = $('btn-sound');
  const updateMuteUI = () => { soundBtn.textContent = Sfx.muted ? '🔇 Son coupé' : '🔊 Son activé'; };
  updateMuteUI();
  soundBtn.addEventListener('click', () => { Sfx.toggleMute(); updateMuteUI(); });
  addEventListener('keydown', e => {
    if (e.code === 'KeyM') { Sfx.toggleMute(); updateMuteUI(); }
  });

  /* ---- Équipement : arme principale au choix + Deagle en secondaire ----
     Les cartes sont générées depuis WEAPONS dans le menu principal ET dans le
     menu d'équipement en jeu (touche B / bouton 🎒). En pleine partie, le choix
     s'applique à la prochaine réapparition (style Call of). */
  const PRIMARIES = ['ar', 'smg', 'shotgun', 'dmr', 'lmg', 'sniper'];
  let chosenWeapon = localStorage.getItem('blocops-weapon');
  if (!PRIMARIES.includes(chosenWeapon)) chosenWeapon = 'ar';
  const loadout = { primary: chosenWeapon }; // arme réellement en main (le choix attend le respawn)
  function selectWeapon(key) {
    chosenWeapon = key;
    localStorage.setItem('blocops-weapon', key);
    document.querySelectorAll('.wcard').forEach(b =>
      b.classList.toggle('selected', b.dataset.weapon === key));
    if (state === 'play') {
      ui.loadoutMsg.textContent = key === loadout.primary
        ? '' : '✔ ' + WEAPONS[key].label + ' — équipé à ta prochaine réapparition';
    }
  }
  function renderWeaponCards(el) {
    el.innerHTML = '';
    for (const key of PRIMARIES) {
      const w = WEAPONS[key];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wcard' + (key === chosenWeapon ? ' selected' : '');
      b.dataset.weapon = key;
      b.innerHTML = `<span class="wname">${w.label}</span>` +
        w.desc.map(s => `<span class="wstat">${s}</span>`).join('');
      b.addEventListener('click', () => selectWeapon(key));
      el.appendChild(b);
    }
  }
  renderWeaponCards($('menuWeapons'));
  renderWeaponCards($('loadoutWeapons'));

  /* ---- Menu d'équipement en jeu (touche B / bouton 🎒 mobile) ---- */
  let loadoutOpen = false;
  function setLoadout(open) {
    if (open === loadoutOpen) return;
    loadoutOpen = open;
    ui.loadout.classList.toggle('hidden', !open);
    if (open) {
      ui.loadoutMsg.textContent = '';
      Input.fire = false;
      if (!Input.isTouch && document.exitPointerLock) document.exitPointerLock();
    } else if (!Input.isTouch && state === 'play') {
      Input.requestLock(canvas);
    }
  }
  $('btn-loadout-close').addEventListener('click', () => setLoadout(false));
  /* ---- Lancement d'une partie (solo ou en ligne) ---- */
  let touchReady = false;
  function startMatch(m) {
    mode = m;
    Sfx.unlock(); // création du contexte audio sur le geste utilisateur
    loadout.primary = chosenWeapon;
    player.weapon = loadout.primary;
    setLoadout(false);
    Input.loadoutQueued = false;
    if (mode === 'solo') {
      ensureBots();
      player.team = 'blue';
      player.name = 'Toi';
    }
    entities.length = 0;
    entities.push(player);
    if (mode === 'solo') {
      entities.push(...bots);
      bots.forEach(b => { b.kills = b.deaths = 0; respawn(b); });
    } else {
      // une partie solo a pu avoir lieu avant : on range les bots
      bots.forEach(b => { b.dead = true; b.respawnAt = Infinity; b.group.visible = false; });
      entities.push(...remotes.values());
    }
    state = 'play';
    spawnIdx.blue = spawnIdx.red = 0;
    ui.menu.classList.add('hidden');
    mpUI.lobby.classList.add('hidden');
    ui.win.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    respawn(player);
    scores.blue = scores.red = 0;
    player.kills = player.deaths = player.streak = 0;
    uavUntil = rushUntil = 0;
    updateScores();
    updateKD();
    updateWeaponUI();
    if (Input.isTouch) {
      ui.mobile.classList.remove('hidden');
      if (!touchReady) { touchReady = true; Input.setupTouch(); }
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      Input.requestLock(canvas);
    }
  }
  $('btn-start').addEventListener('click', () => startMatch('solo'));
  $('btn-resume').addEventListener('click', () => {
    ui.resume.classList.add('hidden');
    Input.requestLock(canvas);
  });
  $('btn-quit').addEventListener('click', () => location.reload());
  $('btn-replay').addEventListener('click', () => {
    if (mode === 'online' && Net.connected) {
      // le salon est toujours ouvert côté serveur : retour au lobby
      ui.win.classList.add('hidden');
      mpUI.lobby.classList.remove('hidden');
    } else {
      location.reload();
    }
  });

  /* ================= Multijoueur : menu, lobby, événements réseau ================= */
  const mpUI = {
    pname: $('pname'), jcode: $('jcode'), msg: $('mpMsg'),
    lobby: $('lobby'), code: $('roomCode'), blue: $('lobbyBlue'), red: $('lobbyRed'),
    launch: $('btn-launch'), wait: $('lobbyWait'),
  };
  let lobbyPlayers = [];
  mpUI.pname.value = localStorage.getItem('blocops-name') || '';
  const mpMsg = s => { mpUI.msg.textContent = s || ''; };
  function myName() {
    const n = mpUI.pname.value.trim().slice(0, 14) || 'Joueur';
    localStorage.setItem('blocops-name', n);
    return n;
  }
  function renderLobby() {
    for (const team of ['blue', 'red']) {
      const ul = team === 'blue' ? mpUI.blue : mpUI.red;
      ul.innerHTML = lobbyPlayers.filter(p => p.team === team)
        .map(p => `<li>${p.name}${p.host ? ' <span class="crown">👑</span>' : ''}${p.id === Net.id ? ' — toi' : ''}</li>`)
        .join('');
    }
    const amHost = lobbyPlayers.some(p => p.id === Net.id && p.host);
    mpUI.launch.classList.toggle('hidden', !amHost);
    mpUI.wait.classList.toggle('hidden', amHost);
  }
  async function mpConnect() {
    if (!Net.available) {
      mpMsg('Multijoueur indisponible en fichier local : lance « node server/server.js » puis ouvre http://localhost:8080');
      return false;
    }
    try { await Net.connect(); return true; }
    catch { mpMsg('Serveur injoignable. Lance « node server/server.js » et recharge la page.'); return false; }
  }
  $('btn-create').addEventListener('click', async () => {
    mpMsg('Connexion…');
    if (await mpConnect()) Net.create(myName(), chosenWeapon);
  });
  $('btn-join').addEventListener('click', async () => {
    const code = mpUI.jcode.value.trim().toUpperCase();
    if (code.length !== 4) { mpMsg('Entre le code à 4 lettres du salon.'); return; }
    mpMsg('Connexion…');
    if (await mpConnect()) Net.join(code, myName(), chosenWeapon);
  });
  $('btn-leave').addEventListener('click', () => location.reload());
  mpUI.launch.addEventListener('click', () => Net.start());

  Net.on('room', m => { // salon créé ou rejoint → lobby
    mpMsg('');
    mpUI.code.textContent = m.code;
    lobbyPlayers = m.players;
    renderLobby();
    ui.menu.classList.add('hidden');
    mpUI.lobby.classList.remove('hidden');
  });
  Net.on('plist', m => { lobbyPlayers = m.players; renderLobby(); });
  Net.on('err', m => mpMsg(m.msg));
  Net.on('start', m => { // l'hôte a lancé : tout le monde entre en jeu
    clearRemotes();
    const me = m.players.find(p => p.id === Net.id);
    if (!me) return;
    player.team = me.team;
    player.name = me.name;
    for (const info of m.players) if (info.id !== Net.id) makeRemote(info);
    startMatch('online');
  });
  Net.on('st', m => { // état de mouvement d'un joueur distant
    const r = remotes.get(m.id);
    if (!r || state !== 'play') return;
    r.netPos.set(m.p[0], m.p[1], m.p[2]);
    r.netYaw = m.y + Math.PI; // le modèle regarde +z, la caméra regarde -z
    r.netAim = -m.a;
    r.crouching = !!m.c;
    if (m.w !== r.weapon) { r.weapon = m.w; r.setWeapon(m.w); }
  });
  Net.on('shoot', m => { // traçante + son du tir d'un autre joueur
    if (state !== 'play') return;
    const from = _botFrom.set(m.f[0], m.f[1], m.f[2]);
    const to = _botEnd.set(m.e[0], m.e[1], m.e[2]);
    Effects.muzzle(from);
    Effects.tracer(from, to);
    const r = remotes.get(m.id);
    if (r) r.gunKick = 1;
    Sfx.shot(m.w, Math.max(0, 1 - from.distanceTo(player.pos) / 45));
  });
  Net.on('hp', m => { // le serveur m'a infligé des dégâts (PV autoritaires)
    if (state !== 'play' || player.dead) return;
    player.hp = m.hp;
    player.lastDamage = now();
    updateHP();
    ui.damageFlash.style.opacity = '1';
    setTimeout(() => { ui.damageFlash.style.opacity = '0'; }, 90);
    const att = remotes.get(m.from);
    if (att) showDamageDir(att);
    Sfx.damage();
  });
  Net.on('kill', m => { // élimination annoncée par le serveur
    if (state !== 'play') return;
    const killer = m.killer === Net.id ? player : remotes.get(m.killer);
    const victim = m.victim === Net.id ? player : remotes.get(m.victim);
    scores.blue = m.scores.blue;
    scores.red = m.scores.red;
    updateScores();
    for (const [id, kd] of Object.entries(m.kd || {})) {
      const e = id === Net.id ? player : remotes.get(id);
      if (e) { e.kills = kd[0]; e.deaths = kd[1]; }
    }
    if (killer && victim) feed(killer, victim, m.head);
    if (victim === player) {
      player.dead = true;
      player.hp = 0;
      player.respawnAt = now() + CFG.respawnDelay;
      player.streak = 0;
      updateHP();
      updateKD();
      Sfx.death();
      ui.death.classList.add('show');
      Input.fire = false;
      Input.ads = false;
    } else if (victim) {
      victim.dead = true;
      victim.hp = 0;
      victim.dieT = 0.9;
    }
    if (killer === player && victim !== player) {
      updateKD();
      Sfx.kill();
      showKillMsg(victim, m.head);
      onPlayerKill();
    }
    if (sbShown) renderScoreboard();
  });
  Net.on('spawn', m => { // réapparition d'un joueur distant
    const r = remotes.get(m.id);
    if (!r) return;
    r.dead = false;
    r.hp = CFG.maxHP;
    r.dieT = 0;
    r.pos.set(m.p[0], m.p[1], m.p[2]);
    r.netPos.copy(r.pos);
    r.protectedUntil = now() + CFG.protectionTime;
    r.group.visible = true;
    r.group.rotation.set(0, r.facing, 0);
    r.group.scale.y = 1;
  });
  Net.on('nade', m => { // grenade d'un autre joueur : simulation visuelle locale
    if (state !== 'play') return;
    const n = nades.find(x => !x.active);
    if (!n) return;
    n.pos.set(m.p[0], m.p[1], m.p[2]);
    n.vel.set(m.v[0], m.v[1], m.v[2]);
    n.fuse = CFG.nadeFuse;
    n.active = true;
    n.remote = true;
    n.mesh.visible = true;
  });
  Net.on('win', m => { if (state === 'play') endGame(m.team); });
  Net.on('pleave', m => { // un joueur a quitté la partie
    if (remotes.has(m.id)) {
      const d = document.createElement('div');
      d.className = 'feeditem';
      d.textContent = `${m.name} a quitté la partie`;
      ui.killfeed.prepend(d);
      setTimeout(() => d.remove(), 4500);
    }
    removeRemote(m.id);
    if (sbShown) renderScoreboard();
  });
  Net.on('close', () => { // connexion au serveur perdue
    if (mode !== 'online') return;
    if (state === 'play') {
      state = 'over';
      ui.winTitle.textContent = '🔌 Connexion perdue';
      ui.winScore.textContent = 'Le serveur ne répond plus.';
      $('btn-replay').textContent = 'MENU';
      ui.win.classList.remove('hidden');
      ui.hud.classList.add('hidden');
      ui.mobile.classList.add('hidden');
      if (document.exitPointerLock) document.exitPointerLock();
    } else if (state === 'menu') {
      mpUI.lobby.classList.add('hidden');
      ui.menu.classList.remove('hidden');
      mpMsg('Connexion au serveur perdue.');
    }
  });
  Input.onLockChange = locked => {
    // pas d'écran pause quand c'est le menu d'équipement qui a libéré la souris
    if (!locked && state === 'play' && !Input.isTouch && !loadoutOpen) ui.resume.classList.remove('hidden');
    if (locked) ui.resume.classList.add('hidden');
  };
  canvas.addEventListener('click', () => {
    if (state === 'play' && !Input.isTouch && !Input.locked) Input.requestLock(canvas);
  });

  // Accès console pour le debug et l'équilibrage (positions, PV, nav…)
  window.BLOCOPS_DEBUG = { player, bots, remotes, entities, nav, CFG, WEAPONS, Net, world, get mode() { return mode; }, get state() { return state; }, get scores() { return scores; } };

  /* ================= Boucle principale ================= */
  let last = now();
  let netAcc = 0; // envoi de l'état au serveur à ~15 Hz
  function loop() {
    requestAnimationFrame(loop);
    const t = now();
    const dt = Math.min(0.05, t - last);
    last = t;
    if (state === 'play') {
      if (Input.loadoutQueued) { Input.loadoutQueued = false; setLoadout(!loadoutOpen); }
      updatePlayer(dt);
      if (mode === 'solo') {
        for (const b of bots) updateBot(b, dt);
      } else {
        for (const r of remotes.values()) updateRemote(r, dt);
        netAcc += dt;
        if (netAcc >= 1 / 15) {
          netAcc = 0;
          Net.state(player.pos, player.yaw, player.pitch, player.crouching, player.spd, player.weapon, player.reloading);
        }
      }
      stepNades(dt);
      setScoreboard(Input.scoreHeld || sbPinned);
      drawRadar();
    }
    Effects.update(dt);
    renderer.render(scene, camera);
  }
  loop();
})();
