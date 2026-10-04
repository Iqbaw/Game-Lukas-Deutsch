// ═══════════════════════════════════════════════════════════════════
// js/music.js — MUSIK LATAR ABAD PERTENGAHAN (Web Audio, tanpa file)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Semua musik disintesis langsung di browser:
//   • lute & harpa  : senar dipetik (algoritma Karplus–Strong)
//   • recorder      : seruling kayu dengan vibrato & napas
//   • drone         : hurdy-gurdy / bagpipe yang berdengung rendah
//   • string, horn, lonceng, frame drum, tambourine, timpani
//   • gema (reverb) seperti di aula batu
//
// Lagu (js/musicscore.js) dipilih otomatis sesuai keadaan permainan:
// zona, quest aktif, siang/malam, dan cutscene (bus, bioskop, restoran…).
// Pergantian lagu selalu crossfade. Tidak butuh internet — selalu bunyi,
// juga di jaringan sekolah yang memblokir YouTube.
//
// API publik tetap sama seperti versi lama (initMusic, unlockMusic,
// setMusicVolume, setMusicEnabled) + setMusicOverride / playJingle.
// ═══════════════════════════════════════════════════════════════════

import { SONGS } from './musicscore.js';
import { timeOfDay } from './data/quests.js';

export const Music = {
  ctx:        null,
  master:     null,
  bus:        null,     // semua lagu → bus (duck) → master
  reverb:     null,
  enabled:    true,
  volume:     0.7,
  isUnlocked: false,
  scene:      null,     // lagu yang sedang (atau akan) diputar
  override:   null,     // dipaksa oleh cutscene
  player:     null,
  _timer:     null,
  _duck:      1,
};

const LEVEL = 0.74;            // volume 100 % → gain master
const LOOKAHEAD = 0.4;         // detik dijadwalkan ke depan
const TICK_MS = 70;

// ═══════════════════════════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════════════════════════

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

let _rand = 12345;
function rnd() { _rand = (_rand * 1103515245 + 12345) & 0x7fffffff; return _rand / 0x7fffffff; }

// Cache per AudioContext (juga untuk OfflineAudioContext saat pengujian)
const CACHES = new WeakMap();
function cache(ctx) {
  let c = CACHES.get(ctx);
  if (!c) { c = { pluck: new Map(), noise: null, impulse: null }; CACHES.set(ctx, c); }
  return c;
}

function noiseBuffer(ctx) {
  const c = cache(ctx);
  if (c.noise) return c.noise;
  const len = Math.floor(ctx.sampleRate * 2);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  c.noise = b;
  return b;
}

function impulse(ctx, seconds = 2.8) {
  const c = cache(ctx);
  if (c.impulse) return c.impulse;
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const b = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += ((Math.random() * 2 - 1) - lp) * (0.55 - t * 0.35);   // makin gelap di ekor
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
    }
  }
  c.impulse = b;
  return b;
}

/** Senar dipetik (Karplus–Strong), dibuat sekali per nada lalu disimpan. */
function pluckBuffer(ctx, midi, kind) {
  const c = cache(ctx);
  const key = kind + midi;
  if (c.pluck.has(key)) return c.pluck.get(key);
  const P = {
    lute: { decay: 2.4, bright: 0.42, sr: 22050 },
    harp: { decay: 3.4, bright: 0.62, sr: 22050 },
    pizz: { decay: 0.9, bright: 0.35, sr: 22050 },
  }[kind] || { decay: 2, bright: 0.5, sr: 22050 };
  const f = mtof(midi);
  const a = 0.5 + P.bright * 0.22, b = 1 - a;
  // Filter rata-rata memperpendek periode sebesar b sampel. Supaya nada tepat,
  // laju sampel buffer disesuaikan sehingga (N − b) sampel = satu periode.
  const N = Math.max(2, Math.round(P.sr / f + b));
  const sr = (N - b) * f;
  const len = Math.floor(sr * P.decay);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const ring = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * (0.3 + P.bright * 0.6); ring[i] = lp; }
  // posisi petikan (sedikit filter sisir) → warna suara lebih "kayu"
  const pick = Math.max(1, Math.floor(N * 0.18));
  const tmp = ring.slice();
  for (let i = 0; i < N; i++) ring[i] = tmp[i] - 0.45 * tmp[(i + pick) % N];
  const g = Math.pow(0.001, 1 / (P.decay * f));
  let idx = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const cur = ring[idx];
    const nxt = ring[idx + 1 === N ? 0 : idx + 1];
    ring[idx] = g * (a * cur + b * nxt);
    out[i] = cur;
    if (Math.abs(cur) > peak) peak = Math.abs(cur);
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  const norm = peak > 0 ? 0.85 / peak : 1;
  const fade = Math.floor(len * 0.12);
  for (let i = 0; i < len; i++) out[i] *= norm * (i > len - fade ? (len - i) / fade : 1);
  c.pluck.set(key, buf);
  return buf;
}

// ═══════════════════════════════════════════════════════════════════
// INSTRUMEN — setiap fungsi: (ctx, out, t, midi, dur, vel)
// ═══════════════════════════════════════════════════════════════════

function env(g, t, a, peak, d, sustain, end, r) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (d > 0) g.gain.linearRampToValueAtTime(peak * sustain, t + a + d);
  g.gain.setValueAtTime(peak * sustain, Math.max(t + a + d, end));
  g.gain.linearRampToValueAtTime(0.0001, Math.max(t + a + d, end) + r);
}

const INSTRUMENTS = {
  lute(ctx, out, t, m, dur, v) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(ctx, m, 'lute');
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 230; body.gain.value = 5; body.Q.value = 1.1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    const g = ctx.createGain();
    const end = t + Math.max(dur, 0.25) + 0.9;
    g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, end - 0.35);
    g.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(body); body.connect(lp); lp.connect(g); g.connect(out);
    src.start(t); src.stop(end + 0.05);
  },
  harp(ctx, out, t, m, dur, v) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(ctx, m, 'harp');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(lp); lp.connect(g); g.connect(out);
    src.start(t); src.stop(t + 3.4);
  },
  pizz(ctx, out, t, m, dur, v) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(ctx, m, 'pizz');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.5);
    src.connect(lp); lp.connect(g); g.connect(out);
    src.start(t); src.stop(t + 0.55);
  },
  flute(ctx, out, t, m, dur, v) {
    const f = mtof(m), end = t + dur * 0.97;
    const o1 = ctx.createOscillator(); o1.type = 'triangle';
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o1.frequency.setValueAtTime(f * 0.985, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    o2.frequency.setValueAtTime(f * 1.97, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.07);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.45, dur * 0.6));
    vib.connect(vg); vg.connect(o1.frequency);
    const g2 = ctx.createGain(); g2.gain.value = 0.14;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const g = ctx.createGain();
    env(g, t, 0.045, v, 0.12, 0.82, end, 0.12);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
    // napas
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 3); bp.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(v * 0.09, t + 0.02);
    ng.gain.linearRampToValueAtTime(v * 0.025, t + 0.12); ng.gain.setValueAtTime(v * 0.025, end); ng.gain.linearRampToValueAtTime(0.0001, end + 0.1);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    const stop = end + 0.2;
    for (const o of [o1, o2, vib]) { o.start(t); o.stop(stop); }
    n.start(t, Math.random() * 1.5); n.stop(stop);
  },
  drone(ctx, out, t, m, dur, v) {
    const f = mtof(m), end = t + dur;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 760; lp.Q.value = 0.7;
    const g = ctx.createGain();
    env(g, t, 1.4, v, 0, 1, end, 1.6);
    const oscs = [-5, 5].map(det => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); return o; });
    // dengung lembut (hurdy-gurdy)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg); lg.connect(lp.frequency);
    lp.connect(g); g.connect(out);
    for (const o of [...oscs, lfo]) { o.start(t); o.stop(end + 1.7); }
  },
  pad(ctx, out, t, m, dur, v, tremolo = false) {
    const f = mtof(m), end = t + dur;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
    const g = ctx.createGain();
    env(g, t, tremolo ? 0.15 : 0.9, v, 0, 1, end, tremolo ? 0.4 : 1.3);
    const oscs = [-9, 0, 9].map(det => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); return o; });
    let stopList = oscs;
    if (tremolo) {
      const trem = ctx.createGain(); trem.gain.value = 0.55;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 11; const lg = ctx.createGain(); lg.gain.value = 0.45;
      lfo.connect(lg); lg.connect(trem.gain);
      lp.connect(trem); trem.connect(g);
      stopList = [...oscs, lfo];
    } else {
      lp.connect(g);
    }
    g.connect(out);
    for (const o of stopList) { o.start(t); o.stop(end + 1.4); }
  },
  strings(ctx, out, t, m, dur, v) { INSTRUMENTS.pad(ctx, out, t, m, dur, v, true); },
  horn(ctx, out, t, m, dur, v) {
    const f = mtof(m), end = t + dur * 0.95;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f / 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1900, t + 0.08); lp.frequency.linearRampToValueAtTime(1150, t + 0.35);
    const g = ctx.createGain();
    env(g, t, 0.06, v, 0.2, 0.75, end, 0.15);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(end + 0.2); o2.stop(end + 0.2);
  },
  bell(ctx, out, t, m, dur, v) {
    const f = mtof(m);
    [[1, 1, 2.6], [2.0, 0.45, 1.6], [2.76, 0.3, 1.1], [5.4, 0.12, 0.5]].forEach(([r, a, dcy]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dcy);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dcy + 0.05);
    });
  },
  drum(ctx, out, t, m, dur, v) {          // frame drum / tabor
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.16);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5);
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(v * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + 0.1);
  },
  tak(ctx, out, t, m, dur, v) {           // pukulan tepi drum
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.08);
    const o = ctx.createOscillator(); o.frequency.value = 420;
    const og = ctx.createGain(); og.gain.setValueAtTime(v * 0.35, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.06);
  },
  tamb(ctx, out, t, m, dur, v) {          // tamborin
    for (const [dt, a] of [[0, 1], [0.022, 0.5], [0.048, 0.3]]) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
      const g = ctx.createGain(); g.gain.setValueAtTime(v * a, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.12);
      n.connect(hp); hp.connect(g); g.connect(out); n.start(t + dt, Math.random()); n.stop(t + dt + 0.13);
    }
  },
  timp(ctx, out, t, m, dur, v) {          // timpani (film)
    const f = mtof(m);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.08, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.6);
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(v * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + 0.3);
  },
};

// Level & posisi stereo per instrumen
const MIX = {
  flute: [0.30, 0.18], lute: [0.42, -0.22], harp: [0.40, -0.12], pizz: [0.42, -0.25],
  drone: [0.075, 0], pad: [0.055, 0.05], strings: [0.07, 0.1], horn: [0.17, 0.12],
  bell: [0.11, 0.25], drum: [0.55, 0.05], tak: [0.22, 0.12], tamb: [0.11, 0.3], timp: [0.5, -0.05],
};

// ═══════════════════════════════════════════════════════════════════
// PEMUTAR LAGU (penjadwal dengan lookahead)
// ═══════════════════════════════════════════════════════════════════

class SongPlayer {
  constructor(ctx, dest, reverbIn, song, { fadeIn = 1.2, gain = 1 } = {}) {
    this.ctx = ctx;
    this.song = song;
    this.spb = 60 / song.bpm;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(gain * (song.gain ?? 1), ctx.currentTime + fadeIn);
    this.out.connect(dest);
    if (reverbIn) {
      this.send = ctx.createGain(); this.send.gain.value = song.reverb ?? 0.25;
      this.out.connect(this.send); this.send.connect(reverbIn);
    }
    this.buses = {};
    this.t0 = ctx.currentTime + 0.08;
    this.idx = 0;
    this.loop = 0;
    this.done = false;
    this.warm();
  }
  bus(inst) {
    let b = this.buses[inst];
    if (!b) {
      const [lvl, pan] = MIX[inst] || [0.3, 0];
      const g = this.ctx.createGain(); g.gain.value = lvl;
      let node = g;
      if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
      node.connect(this.out);
      b = this.buses[inst] = g;
    }
    return b;
  }
  /** Siapkan buffer senar dipetik sebelum dipakai (hindari patah-patah). */
  warm() {
    const seen = new Set();
    for (const e of this.song.events) {
      if (e.inst !== 'lute' && e.inst !== 'harp' && e.inst !== 'pizz') continue;
      for (const n of Array.isArray(e.n) ? e.n : [e.n]) {
        const k = e.inst + n;
        if (!seen.has(k)) { seen.add(k); pluckBuffer(this.ctx, n, e.inst); }
      }
    }
  }
  schedule(until) {
    const ev = this.song.events;
    if (!ev.length || this.done) return;
    for (let guard = 0; guard < 400; guard++) {
      if (this.idx >= ev.length) {
        if (!this.song.loop) { this.done = true; return; }
        this.loop++; this.idx = 0;
      }
      const e = ev[this.idx];
      const when = this.t0 + (this.loop * this.song.totalBeats + e.t) * this.spb;
      if (when > until) return;
      if (when >= this.ctx.currentTime - 0.02) this.play(e, when);
      this.idx++;
    }
  }
  play(e, when) {
    const fn = INSTRUMENTS[e.inst];
    if (!fn) return;
    const out = this.bus(e.inst);
    const dur = e.d * this.spb;
    const notes = Array.isArray(e.n) ? e.n : [e.n];
    const human = e.inst === 'drone' || e.inst === 'pad' ? 0 : (rnd() - 0.5) * 0.014;
    notes.forEach((n, i) => {
      const strum = (e.inst === 'lute' || e.inst === 'harp') && notes.length > 1 ? i * 0.022 : 0;
      const v = e.v * (0.9 + rnd() * 0.18);
      try { fn(this.ctx, out, Math.max(this.ctx.currentTime, when + human + strum), n, dur, v); } catch (_) {}
    });
  }
  stop(fade = 1.4) {
    const t = this.ctx.currentTime;
    try {
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0.0001, t + fade);
    } catch (_) {}
    this.done = true;
    setTimeout(() => { try { this.out.disconnect(); } catch (_) {} }, (fade + 3.6) * 1000);
  }
}

// ═══════════════════════════════════════════════════════════════════
// KONTEKS AUDIO & PENJADWAL
// ═══════════════════════════════════════════════════════════════════

function buildGraph(ctx) {
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  master.connect(comp); comp.connect(ctx.destination);
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.9;
  conv.connect(wet); wet.connect(bus);
  return { master, bus, reverbIn: conv };
}

function ensureContext() {
  if (Music.ctx) return Music.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: 'playback' });
  Music.ctx = ctx;
  const g = buildGraph(ctx);
  Music.master = g.master; Music.bus = g.bus; Music.reverb = g.reverbIn;
  return ctx;
}

function audible() { return Music.enabled && Music.isUnlocked && Music.volume > 0; }

function applyLevel() {
  if (!Music.ctx || !Music.master) return;
  const t = Music.ctx.currentTime;
  const target = audible() ? Music.volume * LEVEL : 0;
  Music.master.gain.cancelScheduledValues(t);
  Music.master.gain.setValueAtTime(Music.master.gain.value, t);
  Music.master.gain.linearRampToValueAtTime(target, t + 0.4);
  if (audible()) {
    if (Music.ctx.state === 'suspended' && !document.hidden) Music.ctx.resume().catch(() => {});
  } else {
    // Musik dimatikan: setelah fade-out, hentikan konteks agar tidak makan CPU
    clearTimeout(Music._sleepTimer);
    Music._sleepTimer = setTimeout(() => {
      if (!audible() && Music.ctx.state === 'running') Music.ctx.suspend().catch(() => {});
    }, 600);
  }
}

function tick() {
  const ctx = Music.ctx;
  if (!ctx || ctx.state !== 'running' || !audible()) return;
  const until = ctx.currentTime + LOOKAHEAD;
  if (Music.player) Music.player.schedule(until);
  if (Music._fading) for (const p of Music._fading) p.schedule(until);
  if (Music._jingle) { Music._jingle.schedule(until); if (Music._jingle.done) Music._jingle = null; }
}

function startScheduler() {
  if (Music._timer) return;
  Music._timer = setInterval(tick, TICK_MS);
}

/** Ganti lagu dengan crossfade. */
function switchTo(name, { fade = 1.6 } = {}) {
  if (!name || name === Music._playing) return;
  const song = SONGS[name];
  if (!song) return;
  Music._playing = name;
  const ctx = Music.ctx;
  if (!ctx) return;
  const old = Music.player;
  if (old) {
    old.stop(fade);
    Music._fading = (Music._fading || []).filter(p => !p.done).concat([old]);
    // lagu lama berhenti menjadwalkan nada baru, ekor nada tetap bergema
    old.done = true;
  }
  Music.player = new SongPlayer(ctx, Music.bus, Music.reverb, song, { fadeIn: old ? fade * 0.8 : 2.2 });
}

// ═══════════════════════════════════════════════════════════════════
// SUTRADARA: lagu mana yang cocok sekarang?
// ═══════════════════════════════════════════════════════════════════

export function pickScene() {
  if (Music.override) return Music.override;
  if (!window.__GAME__?.isRunning) return 'menu';
  const qs = window.__questState__ || {};
  const zone = window.__currentZoneId__;
  const q = window.__QUEST_SYSTEM__?.activeQuestId || null;
  const night = timeOfDay(qs) === 'night';
  if (zone === 'supermarket_interior') return 'shop';
  if (night) {
    if (zone === 'haus' && (q === 'quest_10' || qs.quest_10 === 'completed')) return 'farewell';
    return 'night';
  }
  if (zone === 'haus_interior') return q === 'quest_2' ? 'search' : 'home';
  if (zone === 'haus') return 'home';
  if (zone === 'stadt') {
    if (q === 'quest_4') return 'market';
    if (q === 'quest_6') return 'lost';
    if (q === 'quest_9') return 'river';
    return 'journey';
  }
  return 'home';
}

function refreshScene() {
  const scene = pickScene();
  Music.scene = scene;
  if (Music.ctx && Music.isUnlocked) switchTo(scene);
}

let _directorWired = false;
function wireDirector() {
  if (_directorWired) return;
  _directorWired = true;
  for (const ev of ['zone:enter', 'quest:step', 'quest:complete', 'game:start', 'menu:continue']) {
    window.addEventListener(ev, () => setTimeout(refreshScene, 50));
  }
  setInterval(refreshScene, 1500);
  // Saat dialog terbuka musik sedikit mengecil supaya teks mudah diikuti
  window.addEventListener('dialog:open', () => setDuck(0.72));
  window.addEventListener('dialog:close', () => setDuck(1));
  document.addEventListener('visibilitychange', () => {
    if (!Music.ctx) return;
    if (document.hidden) Music.ctx.suspend().catch(() => {});
    else if (audible()) Music.ctx.resume().catch(() => {});
  });
}

function setDuck(v, ramp = 0.5) {
  Music._duck = v;
  if (!Music.ctx || !Music.bus) return;
  const t = Music.ctx.currentTime;
  Music.bus.gain.cancelScheduledValues(t);
  Music.bus.gain.setValueAtTime(Music.bus.gain.value, t);
  Music.bus.gain.linearRampToValueAtTime(v, t + ramp);
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function setMusicVolume(v) {
  Music.volume = Math.max(0, Math.min(1, v));
  applyLevel();
}

export function setMusicEnabled(on) {
  Music.enabled = !!on;
  applyLevel();
}

/** Dipanggil saat input pertama pemain (klik / tombol / sentuh). */
export function unlockMusic() {
  if (Music.isUnlocked) return;
  const ctx = ensureContext();
  if (!ctx) return;
  Music.isUnlocked = true;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  startScheduler();
  refreshScene();
  applyLevel();
}

/** Cutscene memaksa lagu tertentu (null = kembali ke pilihan otomatis). */
export function setMusicOverride(name, { fade = 1.2 } = {}) {
  Music.override = name || null;
  const scene = pickScene();
  Music.scene = scene;
  if (Music.ctx && Music.isUnlocked) switchTo(scene, { fade });
}

/** Potongan musik pendek (mis. quest selesai) — musik latar mengecil sejenak. */
export function playJingle(name) {
  const song = SONGS[name];
  if (!song || !Music.ctx || !Music.isUnlocked) return;
  const p = new SongPlayer(Music.ctx, Music.master, Music.reverb, song, { fadeIn: 0.02 });
  Music._jingle = p;
  const len = song.totalBeats * (60 / song.bpm);
  setDuck(0.3, 0.15);
  setTimeout(() => setDuck(document.body.classList.contains('dialog-open') ? 0.72 : 1, 0.8), (len + 0.2) * 1000);
}

export async function initMusic({ volume = 0.7, enabled = true } = {}) {
  Music.volume = volume;
  Music.enabled = enabled;
  wireDirector();
  Music.scene = pickScene();
  return Music;
}

/** Untuk pengujian: render satu lagu secara offline. */
export async function renderSongOffline(name, seconds = 20, sampleRate = 22050) {
  const song = typeof name === 'string' ? SONGS[name] : name;
  if (!song) throw new Error('unknown song ' + name);
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  const g = buildGraph(ctx);
  g.master.gain.value = LEVEL * 0.7;
  const p = new SongPlayer(ctx, g.bus, g.reverbIn, song, { fadeIn: 0.05 });
  p.t0 = 0.05;
  for (let k = 0; k < 40 && !p.done; k++) p.schedule(seconds);
  return ctx.startRendering();
}

if (typeof window !== 'undefined') window.__Music__ = { Music, pickScene, setMusicOverride, playJingle, renderSongOffline, SONGS };
