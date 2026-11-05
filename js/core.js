/* ============================================================================
   O RATO DETETIVE 2.0 — core: utils, viewport, audio, data
   ============================================================================ */
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}
function fmtNum(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function storeGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ arena */
const ARENA = { w: 3000, h: 2100, pad: 100 };

/* --------------------------------------------------------------- viewport */
let W = 0, H = 0, DPR = 1, zoomBase = 1;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  zoomBase = clamp(Math.min(W, H) / 640, 0.72, 1.35);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

/* ================================================================ WEAPONS */
const WEAPONS = [
  {
    id: 'eagle', name: 'DESERT EAGLE', tag: 'Pesada e precisa',
    damage: 38, rate: 0.52, ammo: 7, reload: 1.15, range: 660, speed: 1550,
    pellets: 1, spread: 0.025, bulletR: 4, color: '#ffd27a', shake: 2.6,
    sfx: 'eagle'
  },
  {
    id: 'shotgun', name: 'SHOTGUN', tag: 'Estraçalha de perto',
    damage: 17, rate: 0.95, ammo: 7, reload: 2.1, range: 350, speed: 1250,
    pellets: 7, spread: 0.52, bulletR: 3, color: '#ffb35c', shake: 6,
    sfx: 'shotgun'
  },
  {
    id: 'thompson', name: 'THOMPSON', tag: 'Chuva de chumbo',
    damage: 9, rate: 0.09, ammo: 49, reload: 1.9, range: 500, speed: 1750,
    pellets: 1, spread: 0.075, bulletR: 2.6, color: '#9fe8ff', shake: 1.1,
    sfx: 'thompson'
  }
];
const WEAPON_ICONS = [
  `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M5 9h28v8H23l-4 10h-7l3-10H5z" fill="rgba(233,185,73,.12)"/><path d="M33 11h8v4h-8"/><path d="M11 13h5" stroke-width="3"/></svg>`,
  `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M2 16h25l5-6h13v5H34l-4 6H2z" fill="rgba(233,185,73,.12)"/><path d="M8 21l-4 8h7l3-7"/><path d="M31 10v5" stroke-width="2"/></svg>`,
  `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M5 10h25v7H18v4h-6v-4H5z" fill="rgba(233,185,73,.12)"/><circle cx="19" cy="23" r="5"/><path d="M30 12h16v4H30"/><path d="M9 21l-3 8"/></svg>`
];

/* ================================================================= SKILLS */
const RARITY = {
  common:    { label: 'Comum',     color: '#b9b4a8' },
  rare:      { label: 'Raro',      color: '#6aa8ff' },
  epic:      { label: 'Épico',     color: '#b07cff' },
  legendary: { label: 'Lendário',  color: '#e9b949' },
  fusion:    { label: 'Fusão',     color: '#ff6b3d' }
};

const SKILLS = {
  speed: {
    name: 'Pés Ligeiros', icon: '👟', rarity: 'common', max: 5,
    desc: 'Aumenta a velocidade de movimento em 10% por nível.'
  },
  damage: {
    name: 'Munição Especial', icon: '🔫', rarity: 'rare', max: 5,
    desc: 'Aumenta todo o dano causado em 15% por nível.'
  },
  vest: {
    name: 'Colete Reforçado', icon: '🧥', rarity: 'rare', max: 3,
    desc: 'Reduz o dano recebido em 1 ponto por nível.'
  },
  rapid: {
    name: 'Gatilho Rápido', icon: '⚡', rarity: 'epic', max: 5,
    desc: 'Aumenta a cadência de tiro em 22% por nível.'
  },
  magnet: {
    name: 'Faro de Queijo', icon: '🧀', rarity: 'common', max: 3,
    desc: 'Aumenta o raio de coleta de queijo em 40% por nível.'
  },
  flaming: {
    name: 'Charuto Flamejante', icon: '🚬', rarity: 'epic', max: 1,
    desc: 'Seus tiros incendeiam os inimigos, causando dano ao longo do tempo.'
  },
  double: {
    name: 'Tiros Duplos', icon: '✌️', rarity: 'epic', max: 1,
    desc: 'Cada disparo gera um projétil extra.'
  },
  eye: {
    name: 'Olho de Detetive', icon: '👁️', rarity: 'legendary', max: 1,
    desc: 'Aumenta o alcance das armas em 40% e o dano em 10%.'
  },
  heart: {
    name: 'Coração de Alcatra', icon: '❤️', rarity: 'rare', max: 3,
    desc: 'Ganha um coração máximo e recupera toda a vida.'
  },
  fusion: {
    name: 'Chama do Submundo', icon: '🔥', rarity: 'fusion', max: 1,
    desc: 'Fusão de Charuto Flamejante + Tiros Duplos. Tiro duplo com queimadura brutal.'
  }
};

/* ==================================================================== GAME */
const G = {
  state: 'menu',
  runId: 0,
  time: 0,
  score: 0,
  money: 0,
  kills: 0,
  cheese: 0,
  level: 1,
  xp: 0,
  xpNext: 90,
  loop: 0,
  enemies: [],
  bullets: [],
  ebullets: [],
  pickups: [],
  particles: [],
  texts: [],
  splats: [],
  player: null,
  boss: null,
  bossNext: 10,
  pendingLevels: 0,
  levelChoices: [],
  spawnTimer: 0,
  shake: 0,
  flashSky: 0,
  camera: { x: ARENA.w / 2, y: ARENA.h / 2, zoom: 1 },
  menuT: 0,
  deathT: 0,
  chosenWeapon: 0,
  god: false,
  muted: storeGet('rato_muted', '0') === '1',
  best: parseInt(storeGet('rato_best', '0'), 10) || 0,
  newRecord: false
};

const input = {
  keys: new Set(),
  joy: { x: 0, y: 0, active: false }
};

/* =================================================================== AUDIO */
const audio = {
  ctx: null,
  master: null,
  noiseBuf: null,
  musicTimer: null,
  nextNote: 0,
  step: 0,
  muted: G.muted,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (!this.muted) this.startMusic();
    } catch { this.ctx = null; }
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.ctx && !this.muted) this.startMusic();
  },

  setMuted(m) {
    this.muted = m;
    G.muted = m;
    storeSet('rato_muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    if (!m) { this.resume(); this.startMusic(); }
  },

  tone(freq, dur, type = 'sine', vol = 0.1, delay = 0, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise(dur, vol = 0.1, cutoff = 1200, delay = 0, type = 'lowpass') {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = cutoff; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },

  sfx(kind) {
    if (!this.ctx || this.muted) return;
    switch (kind) {
      case 'eagle':
        this.noise(0.09, 0.16, 2600); this.tone(105, 0.13, 'square', 0.1, 0, -55); break;
      case 'shotgun':
        this.noise(0.2, 0.24, 1700); this.tone(78, 0.18, 'sawtooth', 0.11, 0, -38); break;
      case 'thompson':
        this.noise(0.055, 0.09, 3200); this.tone(170, 0.05, 'square', 0.045, 0, -60); break;
      case 'hit':
        this.tone(320, 0.035, 'square', 0.028, 0, -80); break;
      case 'crit':
        this.tone(760, 0.07, 'triangle', 0.05, 0, 240); break;
      case 'kill':
        this.noise(0.1, 0.06, 800); this.tone(120, 0.08, 'triangle', 0.035, 0, -40); break;
      case 'pickup':
        this.tone(880, 0.06, 'sine', 0.035, 0, 320); break;
      case 'cheese':
        this.tone(660, 0.05, 'triangle', 0.028, 0, 180); break;
      case 'reload':
        this.tone(220, 0.04, 'square', 0.04); this.tone(150, 0.05, 'square', 0.035, 0.16); break;
      case 'hurt':
        this.tone(88, 0.3, 'sawtooth', 0.1, 0, -40); this.noise(0.18, 0.09, 420); break;
      case 'levelup':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.06, i * 0.075, 20)); break;
      case 'boss':
        this.tone(55, 0.7, 'sawtooth', 0.12, 0, 10); this.tone(82, 0.5, 'square', 0.06, 0.08, -8);
        this.noise(0.4, 0.06, 300); break;
      case 'super':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.065, i * 0.06, 30)); break;
      case 'loop':
        this.tone(65, 1.2, 'sawtooth', 0.12, 0, 40); this.tone(98, 1.0, 'triangle', 0.08, 0.1, 20);
        this.noise(0.7, 0.05, 240); break;
      case 'death':
        this.tone(180, 0.7, 'sawtooth', 0.12, 0, -120); this.tone(90, 1.1, 'triangle', 0.1, 0.1, -45);
        this.noise(0.4, 0.07, 340); break;
      case 'unlock':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'square', 0.04, i * 0.06)); break;
    }
  },

  startMusic() {
    if (!this.ctx || this.muted || this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + 0.15;
    this.step = 0;
    this.musicTimer = setInterval(() => this.schedule(), 220);
    this.schedule();
  },

  schedule() {
    if (!this.ctx || this.muted) return;
    const bass = [73.42, 73.42, 87.31, 82.41, 73.42, 110.0, 98.0, 87.31];
    const melody = [293.66, 0, 349.23, 0, 392.0, 349.23, 293.66, 0, 261.63, 0, 293.66, 0, 349.23, 0, 311.13, 0];
    while (this.nextNote < this.ctx.currentTime + 0.35) {
      const t = this.nextNote - this.ctx.currentTime;
      this.tone(bass[this.step % bass.length], 0.5, 'triangle', 0.045, t);
      if (this.step % 4 === 0) this.noise(0.06, 0.012, 7000, t, 'highpass');
      if (this.step % 2 === 1) this.noise(0.035, 0.008, 9000, t, 'highpass');
      const mi = this.step % melody.length;
      if (melody[mi]) this.tone(melody[mi], 0.55, 'sine', 0.022, t, 4);
      this.nextNote += 0.42;
      this.step++;
    }
  }
};
