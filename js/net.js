/* net.js — client WebSocket du mode multijoueur.
   game.js s'abonne aux événements via Net.on(type, fn) et envoie avec les
   helpers (Net.create, Net.join, Net.state, Net.hit…). Le serveur (voir
   server/server.js) fait autorité sur les PV, les kills et le score.
   Nécessite d'être servi en http(s) — en file:// le multijoueur est désactivé. */
const Net = (() => {
  'use strict';

  let ws = null;
  let myId = null;
  const listeners = {}; // type → [fn]

  const available = location.protocol === 'http:' || location.protocol === 'https:';

  function emit(type, msg) {
    for (const fn of listeners[type] || []) fn(msg);
  }

  function connect() {
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === 1) return resolve();
      const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
      ws = new WebSocket(url);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Connexion au serveur impossible.'));
      ws.onclose = () => { ws = null; myId = null; emit('close', {}); };
      ws.onmessage = ev => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'room') myId = m.id;
        emit(m.t, m);
      };
    });
  }

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  return {
    available,
    connect,
    on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    get id() { return myId; },
    get connected() { return !!(ws && ws.readyState === 1); },
    close() { if (ws) ws.close(); },

    create(name, weapon) { send({ t: 'create', name, weapon }); },
    join(code, name, weapon) { send({ t: 'join', code, name, weapon }); },
    start() { send({ t: 'start' }); },
    // état de mouvement ~15 Hz : pos, yaw, pitch de visée, accroupi, vitesse, arme, rechargement
    state(pos, yaw, aim, crouch, spd, weapon, reloading) {
      send({ t: 'st', p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], y: +yaw.toFixed(3), a: +aim.toFixed(3), c: crouch ? 1 : 0, s: +spd.toFixed(1), w: weapon, r: reloading ? 1 : 0 });
    },
    shoot(from, to, weapon) {
      send({ t: 'shoot', f: [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)], e: [+to.x.toFixed(2), +to.y.toFixed(2), +to.z.toFixed(2)], w: weapon });
    },
    // nb/nh : nombre de plombs corps/tête (fusil à pompe) — 1 balle sinon
    hit(targetId, head, weapon, nb = 1, nh = 0) { send({ t: 'hit', target: targetId, head, w: weapon, nb, nh }); },
    nade(pos, vel) { send({ t: 'nade', p: [pos.x, pos.y, pos.z], v: [vel.x, vel.y, vel.z] }); },
    boom(pos) { send({ t: 'boom', p: [pos.x, pos.y, pos.z] }); },
    nadeHit(targetId, dmg) { send({ t: 'nadeHit', target: targetId, dmg: Math.round(dmg) }); },
    spawn(pos) { send({ t: 'spawn', p: [pos.x, pos.y, pos.z] }); },
  };
})();
