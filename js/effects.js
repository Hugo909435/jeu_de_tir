/* effects.js — effets visuels de tir : traçantes, flashs de bouche, impacts.
   Tous les objets sont mis en pool (pas d'allocation pendant la partie).
   game.js appelle Effects.init(scene) puis Effects.update(dt) chaque frame. */
const Effects = (() => {
  'use strict';

  let scene = null;

  /* ---------- Traçantes : fines boîtes étirées entre départ et arrivée ---------- */
  const TRACERS = 24;
  const tracers = [];
  const _mid = new THREE.Vector3();

  /* ---------- Flashs de bouche : petit losange lumineux, très bref ---------- */
  const FLASHES = 10;
  const flashes = [];

  /* ---------- Impacts : gerbe de particules cubiques avec gravité ---------- */
  const BURSTS = 10, PARTS = 6;
  const bursts = [];

  function init(sc) {
    scene = sc;
    const tracerGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true });
    for (let i = 0; i < TRACERS; i++) {
      const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
      m.visible = false;
      scene.add(m);
      tracers.push({ mesh: m, life: 0 });
    }
    const flashGeo = new THREE.OctahedronGeometry(0.09);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd257 });
    for (let i = 0; i < FLASHES; i++) {
      const m = new THREE.Mesh(flashGeo, flashMat);
      m.visible = false;
      scene.add(m);
      flashes.push({ mesh: m, life: 0 });
    }
    const partGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    for (let i = 0; i < BURSTS; i++) {
      const group = [];
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      for (let j = 0; j < PARTS; j++) {
        const m = new THREE.Mesh(partGeo, mat);
        m.visible = false;
        scene.add(m);
        group.push({ mesh: m, vel: new THREE.Vector3() });
      }
      bursts.push({ parts: group, mat, life: 0 });
    }
  }

  function next(pool) {
    let best = pool[0];
    for (const p of pool) {
      if (p.life <= 0) return p;
      if (p.life < best.life) best = p;
    }
    return best; // tous occupés → on recycle le plus ancien
  }

  function tracer(from, to) {
    const t = next(tracers);
    t.life = 0.08;
    const m = t.mesh;
    _mid.addVectors(from, to).multiplyScalar(0.5);
    m.position.copy(_mid);
    m.lookAt(to);
    m.scale.set(1, 1, Math.max(0.1, from.distanceTo(to)));
    m.material.opacity = 0.9;
    m.visible = true;
  }

  function muzzle(pos) {
    const f = next(flashes);
    f.life = 0.045;
    f.mesh.position.copy(pos);
    f.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    f.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
    f.mesh.visible = true;
  }

  // color : 0xffd257 étincelles (décor) · 0xc0392b sang (personnage touché)
  function impact(pos, color) {
    const b = next(bursts);
    b.life = 0.35;
    b.mat.color.setHex(color);
    b.mat.opacity = 1;
    for (const p of b.parts) {
      p.mesh.position.copy(pos);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).multiplyScalar(5);
      p.mesh.visible = true;
    }
  }

  function update(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.08) * 0.9;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const f of flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) f.mesh.visible = false;
    }
    for (const b of bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mat.opacity = Math.max(0, b.life / 0.35);
      for (const p of b.parts) {
        p.vel.y -= 14 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        if (b.life <= 0) p.mesh.visible = false;
      }
    }
  }

  return { init, tracer, muzzle, impact, update };
})();
