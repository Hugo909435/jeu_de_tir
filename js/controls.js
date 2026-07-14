/* controls.js — entrées PC (pointer lock) et mobile (joysticks + boutons).
   Le jeu lit l'objet global Input à chaque frame. */
const Input = {
  move: { x: 0, y: 0 },        // -1..1 : x = droite, y = avant
  lookDX: 0, lookDY: 0,        // pixels souris accumulés (consommés par game.js)
  lookStick: { x: 0, y: 0 },   // joystick droit mobile (-1..1)
  fire: false, ads: false, sprint: false, crouch: false,
  jumpQueued: false, reloadQueued: false, nadeQueued: false,
  loadoutQueued: false,        // B / bouton 🎒 = menu d'équipement (consommé par game.js)
  scoreHeld: false,            // Tab maintenu = tableau des scores
  weaponQueued: null,          // 'primary' | 'secondary' | 'toggle' (consommé par game.js)
  locked: false,
  onLockChange: null,
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
};

(() => {
  'use strict';

  /* ---------- Clavier (e.code = position physique → ZQSD marche en AZERTY) ---------- */
  const keys = {};
  function updMove() {
    Input.move.x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    Input.move.y = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    Input.crouch = !!(keys.ShiftLeft || keys.ShiftRight);
    Input.sprint = !!keys.CapsLock;
  }
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') { Input.jumpQueued = true; e.preventDefault(); }
    if (e.code === 'KeyR') Input.reloadQueued = true;
    if (e.code === 'KeyG') Input.nadeQueued = true;
    if (e.code === 'Tab') { Input.scoreHeld = true; e.preventDefault(); }
    if (e.code === 'Digit1') Input.weaponQueued = 'primary';
    if (e.code === 'Digit2') Input.weaponQueued = 'secondary';
    if (e.code === 'KeyB') Input.loadoutQueued = true;
    updMove();
  });
  addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Tab') Input.scoreHeld = false;
    updMove();
  });

  /* ---------- Souris ---------- */
  addEventListener('mousemove', e => {
    if (Input.locked) { Input.lookDX += e.movementX; Input.lookDY += e.movementY; }
  });
  addEventListener('mousedown', e => {
    if (!Input.locked) return;
    if (e.button === 0) Input.fire = true;
    if (e.button === 2) Input.ads = true;
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) Input.fire = false;
    if (e.button === 2) Input.ads = false;
  });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', () => { if (Input.locked) Input.weaponQueued = 'toggle'; }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement !== null;
    if (Input.onLockChange) Input.onLockChange(Input.locked);
  });
  Input.requestLock = el => {
    if (!el.requestPointerLock) return;
    // hors geste utilisateur (ex. : début de partie en ligne déclenché par l'hôte),
    // la demande peut être refusée — un clic sur le canvas la relancera
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* refusé : sans gravité */ }
  };

  /* ---------- Tactile ---------- */
  function joystick(sel, cb) {
    const base = document.querySelector(sel);
    const knob = base.querySelector('.knob');
    const R = 46;
    let id = null;
    function move(t) {
      const r = base.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      cb({ x: dx / R, y: dy / R });
    }
    base.addEventListener('touchstart', e => {
      e.preventDefault();
      if (id !== null) return;
      const t = e.changedTouches[0];
      id = t.identifier;
      move(t);
    }, { passive: false });
    base.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) move(t);
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) if (t.identifier === id) {
        id = null;
        knob.style.transform = '';
        cb({ x: 0, y: 0 });
      }
    };
    base.addEventListener('touchend', end);
    base.addEventListener('touchcancel', end);
  }
  function hold(sel, cb) {
    const el = document.querySelector(sel);
    el.addEventListener('touchstart', e => { e.preventDefault(); cb(true); }, { passive: false });
    el.addEventListener('touchend', () => cb(false));
    el.addEventListener('touchcancel', () => cb(false));
  }
  function tap(sel, cb) {
    document.querySelector(sel).addEventListener('touchstart', e => { e.preventDefault(); cb(); }, { passive: false });
  }

  Input.setupTouch = () => {
    joystick('#stick-move', v => { Input.move.x = v.x; Input.move.y = -v.y; });
    joystick('#stick-look', v => { Input.lookStick.x = v.x; Input.lookStick.y = v.y; });
    hold('#btn-fire', on => { Input.fire = on; });
    tap('#btn-jump', () => { Input.jumpQueued = true; });
    tap('#btn-reload', () => { Input.reloadQueued = true; });
    tap('#btn-nade', () => { Input.nadeQueued = true; });
    tap('#btn-weapon', () => { Input.weaponQueued = 'toggle'; });
    tap('#btn-loadout', () => { Input.loadoutQueued = true; });
    const adsBtn = document.querySelector('#btn-ads');
    adsBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      Input.ads = !Input.ads;
      adsBtn.classList.toggle('on', Input.ads);
    }, { passive: false });
  };
})();
