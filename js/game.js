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
    jumpSpeed: 7.5,
    gravity: -20,
    eyeHeight: 1.6,
    baseFov: 75,
  };
  const WEAPONS = {
    sniper: { label: 'Sniper', dmg: 100, mag: 5, reloadT: 2.5, interval: 1.4, auto: false, adsFov: 18, spreadHip: 0.02, spreadAds: 0.0006, botInterval: 1.6 },
    ar: { label: "Fusil d'assaut", dmg: 20, mag: 25, reloadT: 1.8, interval: 0.1, auto: true, adsFov: 50, spreadHip: 0.016, spreadAds: 0.005, botInterval: 0.22 },
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

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  /* ============ Modèle d'arme en vue première personne ============ */
  const gun = new THREE.Group();
  {
    const dark = new THREE.MeshLambertMaterial({ color: 0x2f3338 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x6d4c33 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), dark);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.1), wood);
    grip.position.set(0, -0.13, 0.12);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), dark);
    barrel.position.set(0, 0.03, -0.45);
    barrel.name = 'barrel';
    gun.add(body, grip, barrel);
  }
  gun.position.set(0.28, -0.26, -0.55);
  camera.add(gun);
  let gunKick = 0;

  /* ================= Personnages (style blocs) ================= */
  function buildCharacter(teamColor) {
    const g = new THREE.Group();
    const parts = [];
    const add = (w, h, d, x, y, z, color, part) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      m.userData.part = part;
      g.add(m);
      parts.push(m);
      return m;
    };
    add(0.34, 0.85, 0.34, -0.19, 0.425, 0, 0x3c4048, 'body'); // jambes
    add(0.34, 0.85, 0.34, 0.19, 0.425, 0, 0x3c4048, 'body');
    add(0.8, 0.75, 0.45, 0, 1.225, 0, teamColor, 'body');     // torse
    add(0.24, 0.7, 0.24, -0.54, 1.25, 0, teamColor, 'body');  // bras
    add(0.24, 0.7, 0.24, 0.54, 1.25, 0, teamColor, 'body');
    add(0.55, 0.55, 0.55, 0, 1.9, 0, 0xf2c14e, 'head');       // tête
    scene.add(g);
    return { group: g, parts };
  }

  /* ================= Entités ================= */
  const player = {
    name: 'Toi', team: 'blue', isPlayer: true,
    pos: new THREE.Vector3(0, 0, -26), vy: 0, yaw: Math.PI, pitch: 0, grounded: true,
    hp: CFG.maxHP, dead: false, respawnAt: 0, protectedUntil: 0, lastDamage: -99,
    weapon: 'ar', ammo: 25, reloading: false, reloadEnd: 0, nextShot: 0,
  };
  const bots = [];
  function makeBot(name, team, weapon) {
    const ch = buildCharacter(TEAM[team].color);
    const b = {
      name, team, isPlayer: false, weapon,
      pos: new THREE.Vector3(), vy: 0, facing: 0,
      hp: CFG.maxHP, dead: false, respawnAt: 0, protectedUntil: 0, lastDamage: -99,
      ammo: WEAPONS[weapon].mag, reloading: false, reloadEnd: 0, nextShot: 0,
      wp: null, target: null, losT: Math.random() * 0.25,
      strafeT: 0, strafeDir: 1,
      group: ch.group, parts: ch.parts,
    };
    b.parts.forEach(p => { p.userData.botRef = b; });
    bots.push(b);
    return b;
  }
  BOT_NAMES.blue.forEach((n, i) => makeBot(n, 'blue', i % 2 ? 'sniper' : 'ar'));
  BOT_NAMES.red.forEach((n, i) => makeBot(n, 'red', i % 2 ? 'sniper' : 'ar'));
  const entities = [player, ...bots];

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
  };
  function updateScores() {
    ui.scoreBlue.textContent = scores.blue;
    ui.scoreRed.textContent = scores.red;
  }
  function updateAmmo() {
    ui.ammoNum.textContent = player.ammo;
    ui.ammo.classList.toggle('reloading', player.reloading);
  }
  function updateHP() {
    const r = Math.max(0, player.hp) / CFG.maxHP;
    ui.hpbar.style.width = (r * 100) + '%';
    ui.hpbar.style.background = r > 0.5 ? '#4caf50' : r > 0.25 ? '#ffb02e' : '#e23c3c';
    ui.hpnum.textContent = Math.ceil(Math.max(0, player.hp));
  }
  let hitT = null;
  function showHitmarker(head) {
    ui.hitmarker.classList.add('show');
    ui.hitmarker.classList.toggle('head', head);
    clearTimeout(hitT);
    hitT = setTimeout(() => ui.hitmarker.classList.remove('show'), 120);
  }
  function feed(killer, victim, head) {
    const d = document.createElement('div');
    d.className = 'feeditem';
    d.innerHTML = `<span class="${killer.team}">${killer.name}</span> 🎯${head ? '💥' : ''} <span class="${victim.team}">${victim.name}</span>`;
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

  /* ================= Visée / raycasts ================= */
  const shootRay = new THREE.Raycaster();
  const losRay = new THREE.Raycaster();
  const eyeOf = e => e.isPlayer
    ? new THREE.Vector3(e.pos.x, e.pos.y + CFG.eyeHeight, e.pos.z)
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
    }
    if (target.hp <= 0) kill(target, attacker, head);
  }
  function kill(victim, killer, head) {
    victim.dead = true;
    victim.respawnAt = now() + CFG.respawnDelay;
    scores[killer.team]++;
    updateScores();
    feed(killer, victim, head);
    if (victim.isPlayer) {
      ui.death.classList.add('show');
      Input.fire = false;
      Input.ads = false;
    } else {
      victim.group.visible = false;
    }
    if (scores[killer.team] >= CFG.scoreToWin) endGame(killer.team);
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
      ui.death.classList.remove('show');
      updateHP();
      updateAmmo();
    } else {
      e.group.visible = true;
      e.wp = null;
      e.target = null;
    }
  }
  function regen(e, dt) {
    if (!e.dead && e.hp < CFG.maxHP && now() - e.lastDamage >= CFG.regenDelay) {
      e.hp = Math.min(CFG.maxHP, e.hp + CFG.regenRate * dt);
      if (e.isPlayer) updateHP();
    }
  }

  /* ================= Tir du joueur ================= */
  const _dir = new THREE.Vector3();
  function playerShoot() {
    const w = WEAPONS[player.weapon];
    player.nextShot = now() + w.interval;
    player.ammo--;
    updateAmmo();
    gunKick = 1;
    camera.getWorldDirection(_dir);
    const spread = Input.ads ? w.spreadAds : w.spreadHip;
    _dir.x += (Math.random() - 0.5) * spread * 2;
    _dir.y += (Math.random() - 0.5) * spread * 2;
    _dir.z += (Math.random() - 0.5) * spread * 2;
    _dir.normalize();
    shootRay.set(camera.position, _dir);
    shootRay.far = Infinity;
    const targets = world.solids.slice();
    for (const b of bots) if (!b.dead) targets.push(...b.parts);
    const hits = shootRay.intersectObjects(targets, false);
    if (hits.length) {
      const ref = hits[0].object.userData.botRef;
      if (ref && ref.team !== player.team) {
        const head = hits[0].object.userData.part === 'head';
        applyDamage(ref, w.dmg * (head ? 2 : 1), player, head);
        showHitmarker(head);
      }
    }
  }

  /* ================= Mise à jour du joueur ================= */
  let prevFire = false;
  function updatePlayer(dt) {
    if (player.dead) {
      const left = player.respawnAt - now();
      ui.respawnTxt.textContent = 'Réapparition dans ' + Math.max(0, left).toFixed(1) + ' s';
      if (left <= 0) respawn(player);
      Input.lookDX = Input.lookDY = 0;
      return;
    }
    // --- Vue ---
    player.yaw -= Input.lookDX * 0.0022;
    player.pitch -= Input.lookDY * 0.0022;
    const stickSens = Input.ads && player.weapon === 'sniper' ? 0.7 : 2.6;
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
    const sp = CFG.moveSpeed * (Input.ads ? CFG.adsSpeedMul : 1);
    tryAxis(player, 'x', mx * sp * dt);
    tryAxis(player, 'z', mz * sp * dt);

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
    camera.position.set(player.pos.x, player.pos.y + CFG.eyeHeight, player.pos.z);

    // --- Arme ---
    const w = WEAPONS[player.weapon];
    if (player.reloading && now() >= player.reloadEnd) {
      player.reloading = false;
      player.ammo = w.mag;
      updateAmmo();
    }
    if (!player.reloading && (Input.reloadQueued || player.ammo === 0) && player.ammo < w.mag) {
      player.reloading = true;
      player.reloadEnd = now() + w.reloadT;
      updateAmmo();
    }
    Input.reloadQueued = false;
    const wantFire = Input.fire && (w.auto || !prevFire);
    prevFire = Input.fire;
    if (!player.reloading && wantFire && player.ammo > 0 && now() >= player.nextShot) playerShoot();

    // --- FOV / lunette ---
    const targetFov = Input.ads ? w.adsFov : CFG.baseFov;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    const scoped = player.weapon === 'sniper' && Input.ads && camera.fov < w.adsFov + 8;
    ui.scope.classList.toggle('show', scoped);
    gun.visible = !scoped;

    // --- Animation de l'arme ---
    gunKick = Math.max(0, gunKick - dt * 6);
    const bob = len > 0.1 && player.grounded ? Math.sin(now() * 10) * 0.01 : 0;
    gun.position.set(0.28, -0.26 + bob, -0.55 + gunKick * 0.13);
    gun.getObjectByName('barrel').scale.z = player.weapon === 'sniper' ? 1.8 : 1;

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
  function pickWaypoint(b) {
    for (let i = 0; i < 5; i++) {
      const [x, z] = world.waypoints[(Math.random() * world.waypoints.length) | 0];
      const t = { pos: new THREE.Vector3(x, 0, z), isPlayer: false };
      if (los(b, t)) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }
  function botMove(b, dx, dz, dt, speed) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return;
    tryAxis(b, 'x', dx / l * speed * dt);
    tryAxis(b, 'z', dz / l * speed * dt);
  }
  function updateBot(b, dt) {
    if (b.dead) {
      if (now() >= b.respawnAt) respawn(b);
      return;
    }
    regen(b, dt);
    const w = WEAPONS[b.weapon];
    if (b.reloading && now() >= b.reloadEnd) { b.reloading = false; b.ammo = w.mag; }

    b.losT -= dt;
    if (b.losT <= 0) {
      b.losT = 0.25;
      b.target = acquireTarget(b);
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
      // tir : probabilité de toucher selon la distance
      if (!b.reloading && now() >= b.nextShot) {
        b.nextShot = now() + w.botInterval;
        b.ammo--;
        if (b.ammo <= 0) { b.reloading = true; b.reloadEnd = now() + w.reloadT; }
        const hitChance = Math.max(0.12, 0.8 - d * 0.016);
        if (Math.random() < hitChance) {
          const head = Math.random() < 0.12;
          applyDamage(t, w.dmg * (head ? 2 : 1), b, head);
        }
      }
    } else {
      // patrouille entre points de passage
      if (!b.wp || b.pos.distanceTo(b.wp) < 0.9) b.wp = pickWaypoint(b);
      if (b.wp) {
        const dx = b.wp.x - b.pos.x, dz = b.wp.z - b.pos.z;
        b.facing = Math.atan2(dx, dz);
        const before = b.pos.clone();
        botMove(b, dx, dz, dt, 4);
        if (b.pos.distanceTo(before) < 4 * dt * 0.3) b.wp = null; // bloqué → nouveau point
      }
    }
    // maintien au sol (bots restent au RDC)
    b.pos.y = Math.max(0, b.pos.y - 4 * dt);
    // synchro du mesh + clignotement pendant la protection
    b.group.position.copy(b.pos);
    b.group.rotation.y = b.facing;
    b.group.visible = now() < b.protectedUntil ? (Math.floor(now() * 8) % 2 === 0) : true;
  }

  /* ================= Fin de partie ================= */
  function endGame(team) {
    state = 'over';
    ui.winTitle.textContent = team === player.team ? '🏆 Victoire des ' + TEAM[team].name + ' !' : '💀 Défaite… Les ' + TEAM[team].name + ' gagnent';
    ui.winScore.textContent = 'Bleus ' + scores.blue + ' — ' + scores.red + ' Rouges';
    ui.win.classList.remove('hidden');
    ui.hud.classList.add('hidden');
    ui.mobile.classList.add('hidden');
    if (document.exitPointerLock) document.exitPointerLock();
  }

  /* ================= Menu / démarrage ================= */
  let chosenWeapon = 'ar';
  document.querySelectorAll('.wcard').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wcard').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      chosenWeapon = btn.dataset.weapon;
    });
  });
  $('btn-start').addEventListener('click', () => {
    player.weapon = chosenWeapon;
    state = 'play';
    ui.menu.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    respawn(player);
    bots.forEach(respawn);
    scores.blue = scores.red = 0;
    updateScores();
    if (Input.isTouch) {
      ui.mobile.classList.remove('hidden');
      Input.setupTouch();
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      Input.requestLock(canvas);
    }
  });
  $('btn-resume').addEventListener('click', () => {
    ui.resume.classList.add('hidden');
    Input.requestLock(canvas);
  });
  $('btn-replay').addEventListener('click', () => location.reload());
  Input.onLockChange = locked => {
    if (!locked && state === 'play' && !Input.isTouch) ui.resume.classList.remove('hidden');
    if (locked) ui.resume.classList.add('hidden');
  };
  canvas.addEventListener('click', () => {
    if (state === 'play' && !Input.isTouch && !Input.locked) Input.requestLock(canvas);
  });

  /* ================= Boucle principale ================= */
  let last = now();
  function loop() {
    requestAnimationFrame(loop);
    const t = now();
    const dt = Math.min(0.05, t - last);
    last = t;
    if (state === 'play') {
      updatePlayer(dt);
      for (const b of bots) updateBot(b, dt);
    }
    renderer.render(scene, camera);
  }
  loop();
})();
