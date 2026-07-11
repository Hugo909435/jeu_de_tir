/* audio.js — sons synthétisés via Web Audio API (aucun fichier à télécharger).
   Le contexte est créé au premier geste utilisateur (clic JOUER). Touche M = muet. */
const Sfx = (() => {
  'use strict';

  let ctx = null, master = null;
  let muted = localStorage.getItem('blocops-muted') === '1';
  let noiseBuffer = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Buffer de bruit blanc partagé (tirs, impacts)
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // Rafale de bruit filtré : base des sons de tir et d'impact
  function noise(vol, dur, freq, q, delay = 0) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur);
  }
  // Bip : oscillateur avec glissando et enveloppe
  function tone(vol, dur, f0, f1, type = 'square', delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur);
  }

  const api = {
    get muted() { return muted; },
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      localStorage.setItem('blocops-muted', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // vol ∈ 0..1 : atténuation selon la distance pour les tirs des bots
    shot(weapon, vol = 1) {
      if (!ensure() || vol <= 0.02) return;
      if (weapon === 'sniper') {
        noise(0.9 * vol, 0.28, 900, 1);
        noise(0.5 * vol, 0.5, 220, 1);          // grondement
        tone(0.25 * vol, 0.12, 180, 40, 'triangle');
      } else {
        noise(0.7 * vol, 0.09, 1600, 1);
        tone(0.18 * vol, 0.05, 320, 90, 'triangle');
      }
    },
    reloadStart() { if (ensure()) { tone(0.25, 0.06, 500, 300); noise(0.2, 0.05, 3000, 2, 0.05); } },
    swap() { if (ensure()) { tone(0.22, 0.05, 650, 480); tone(0.25, 0.06, 480, 700, 'square', 0.07); } },
    reloadEnd() { if (ensure()) { tone(0.3, 0.05, 400, 700); tone(0.3, 0.06, 700, 1100, 'square', 0.07); } },
    hit() { if (ensure()) tone(0.3, 0.06, 1100, 900, 'square'); },
    headshot() { if (ensure()) { tone(0.35, 0.07, 1500, 1300, 'square'); tone(0.3, 0.09, 1900, 1700, 'square', 0.05); } },
    kill() { if (ensure()) { tone(0.3, 0.08, 600, 600, 'triangle'); tone(0.35, 0.12, 900, 1200, 'triangle', 0.08); } },
    damage() { if (ensure()) noise(0.35, 0.12, 350, 1); },
    death() { if (ensure()) { tone(0.4, 0.5, 300, 70, 'sawtooth'); noise(0.3, 0.4, 500, 1); } },
    win() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(0.35, 0.22, f, f, 'triangle', i * 0.14));
    },
    lose() {
      if (!ensure()) return;
      [392, 330, 262, 196].forEach((f, i) => tone(0.35, 0.3, f, f * 0.97, 'sawtooth', i * 0.18));
    },
  };
  return api;
})();
