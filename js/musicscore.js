// ═══════════════════════════════════════════════════════════════════
// js/musicscore.js — PARTITUR MUSIK ABAD PERTENGAHAN
//
// Setiap lagu ditulis sebagai akor per birama + melodi (nama nada/durasi),
// memakai mode khas abad pertengahan (Dorian, Mixolydian, Aeolian).
// Pengiring dibuat dari "gaya" (petikan lute, harpa, drone, gendang…).
// Bentuk A–B–A: di bagian B melodi diam dan harpa/lute memainkan variasi,
// sehingga lagu tidak terasa berulang-ulang.
//
// Satuan waktu = "beat" lagu itu sendiri (untuk 6/8 = seperdelapan).
// ═══════════════════════════════════════════════════════════════════

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (Number(m[3]) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** "D4/2 F#4 r/1 [D3,A3]/3" → [{t, d, n}] (tanpa "/durasi" = 1 beat). */
function seq(str, t0 = 0) {
  const out = [];
  let t = t0;
  for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
    if (!tok) continue;
    const [head, durS] = tok.split('/');
    const d = durS ? Number(durS) : 1;
    if (head !== 'r') {
      const n = head.startsWith('[') ? head.slice(1, -1).split(',').map(midi) : midi(head);
      out.push({ t, d, n });
    }
    t += d;
  }
  return { events: out, length: t - t0 };
}

// ── Akor ──────────────────────────────────────────────────────────
const CH_RE = /^([A-G])(#|b)?(m|dim|7|m7|maj7|sus4)?(?:\/([A-G][#b]?))?$/;
/** Nada-nada akor (MIDI) di sekitar oktaf tertentu. */
function chordTones(sym) {
  const m = CH_RE.exec(sym);
  if (!m) throw new Error('bad chord ' + sym);
  const root = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const q = m[3] || '';
  const third = q.startsWith('m') && q !== 'maj7' ? 3 : q === 'sus4' ? 5 : 4;
  const fifth = q === 'dim' ? 6 : 7;
  const sev = q === '7' || q === 'm7' ? 10 : q === 'maj7' ? 11 : null;
  return { root, third, fifth, sev };
}
const at = (pc, oct) => 12 * (oct + 1) + ((pc % 12) + 12) % 12;
function voicing(sym, kind) {
  const { root, third, fifth } = chordTones(sym);
  // akar di oktaf 2 bila nadanya tinggi, supaya bas tidak melompat jauh
  const r = root >= 7 ? 2 : 3;
  switch (kind) {
    case 'lute':  return [at(root, r), at(root + fifth, r), at(root, r + 1), at(root + third, r + 1)];
    case 'harp':  return [at(root, r), at(root + fifth, r), at(root, r + 1), at(root + third, r + 1), at(root + fifth, r + 1), at(root, r + 2)];
    case 'pad':   return [at(root, 3), at(root + third, 3), at(root + fifth, 3)];
    case 'high':  return [at(root, 5), at(root + third, 5), at(root + fifth, 5)];
    case 'bass':  return [at(root, 2)];
    default:      return [at(root, 3)];
  }
}

/** "G C | Am D" → akor per birama (dua akor = dibagi rata). */
function bars(str) {
  return str.split('|').map(b => b.trim().split(/\s+/).filter(Boolean));
}

// RNG deterministik per lagu
function rng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ═══════════════════════════════════════════════════════════════════
// GAYA PENGIRING
// ═══════════════════════════════════════════════════════════════════

const ARP = {
  6: { step: 1, idx: [0, 1, 2, 3, 2, 1] },
  3: { step: 0.5, idx: [0, 1, 2, 3, 2, 1] },
  4: { step: 0.5, idx: [0, 1, 2, 3, 2, 1, 2, 3] },
  2: { step: 0.5, idx: [0, 2, 1, 3] },
};

function accompany(style, chordBars, beats, o = {}) {
  const ev = [];
  chordBars.forEach((chs, bi) => {
    const barT = bi * beats;
    const seg = beats / chs.length;
    chs.forEach((sym, ci) => {
      const t0 = barT + ci * seg;
      switch (style.type) {
        case 'arp': {
          const v = voicing(sym, 'lute');
          const pat = ARP[beats] || ARP[4];
          for (let k = 0; k < pat.idx.length; k++) {
            const t = t0 + k * pat.step * (seg / beats);
            if (t >= t0 + seg - 1e-6) break;
            ev.push({ t, d: pat.step * 2, n: v[pat.idx[k]], v: k === 0 ? 0.85 : 0.6 });
          }
          break;
        }
        case 'strum': {
          const v = voicing(sym, 'lute');
          for (const b of style.on || [0]) if (b < seg) ev.push({ t: t0 + b, d: seg, n: b === 0 ? v : v.slice(1), v: b === 0 ? 0.8 : 0.55 });
          break;
        }
        case 'harp': {
          const v = voicing(sym, 'harp');
          const n = style.notes || 6;
          for (let k = 0; k < n; k++) ev.push({ t: t0 + (k * seg) / n, d: seg, n: v[k % v.length], v: 0.55 - k * 0.03 });
          break;
        }
        case 'pizz': {
          const b = voicing(sym, 'bass')[0], v = voicing(sym, 'lute').slice(1);
          for (let k = 0; k < seg; k++) ev.push(k % 2 === 0 ? { t: t0 + k, d: 0.5, n: b, v: 0.8 } : { t: t0 + k, d: 0.5, n: v, v: 0.5 });
          break;
        }
        case 'pad':
          ev.push({ t: t0, d: seg, n: voicing(sym, 'pad'), v: 0.7 });
          break;
        case 'bass':
          ev.push({ t: t0, d: Math.min(seg, style.len || seg), n: voicing(sym, 'bass')[0], v: 0.7 });
          break;
      }
    });
  });
  return ev;
}

/** Pola gendang per birama: B=frame drum, t=tak, j=tamborin, x=B+j, b=drum pelan. */
function drums(pattern, nBars, beats, o = {}) {
  const ev = [];
  const steps = pattern.length, dt = beats / steps;
  for (let bar = 0; bar < nBars; bar++) {
    if (o.every && bar % o.every !== o.every - 1 && pattern === o.fillOnly) continue;
    for (let s = 0; s < steps; s++) {
      const c = pattern[s], t = bar * beats + s * dt;
      const acc = s === 0 ? 1 : 0.8;
      if (c === 'B' || c === 'x') ev.push({ inst: 'drum', t, d: dt, n: 40, v: 0.75 * acc });
      if (c === 'b') ev.push({ inst: 'drum', t, d: dt, n: 40, v: 0.42 });
      if (c === 't') ev.push({ inst: 'tak', t, d: dt, n: 60, v: 0.6 });
      if (c === 'j' || c === 'x') ev.push({ inst: 'tamb', t, d: dt, n: 80, v: 0.55 });
    }
  }
  return ev;
}

/** Garis kontra-melodi untuk bagian B: nada akor, gerak bertahap. */
function descant(chordBars, beats, seed, o = {}) {
  const r = rng(seed);
  const rhythms = {
    6: [[3, 3], [2, 1, 2, 1], [3, 2, 1], [6]],
    3: [[2, 1], [1, 1, 1], [3], [1.5, 0.5, 1]],
    4: [[2, 2], [1, 1, 2], [2, 1, 1], [1, 1, 1, 1]],
    2: [[1, 1], [2], [0.5, 0.5, 1]],
  }[beats] || [[beats]];
  const ev = [];
  let prev = o.start || 72;
  chordBars.forEach((chs, bi) => {
    const rh = rhythms[Math.floor(r() * rhythms.length)];
    let t = bi * beats;
    rh.forEach((d, k) => {
      const sym = chs[Math.min(chs.length - 1, Math.floor(((t - bi * beats) / beats) * chs.length))];
      const { root, third, fifth } = chordTones(sym);
      const pcs = [root, third, fifth].map(p => ((p % 12) + 12) % 12);
      // kandidat dalam rentang yang nyaman
      const cand = [];
      for (let m = (o.low || 64); m <= (o.high || 81); m++) if (pcs.includes(m % 12)) cand.push(m);
      cand.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
      const pick = cand[Math.min(cand.length - 1, r() < 0.7 ? 0 : 1)];
      ev.push({ t, d, n: pick, v: k === 0 ? 0.75 : 0.6 });
      prev = pick;
      t += d;
    });
  });
  return ev;
}

// ═══════════════════════════════════════════════════════════════════
// PENYUSUN LAGU
// ═══════════════════════════════════════════════════════════════════

/**
 * Bentuk lagu A–B–A.
 *   chords  : string akor per birama
 *   melody  : { inst, notes, vel }
 *   accomp  : [{ inst, type, … }] pengiring di semua bagian
 *   drone   : nada drone (tetap) mis. ['D3','A3']
 *   drums   : pola gendang per birama
 *   b       : { inst, low, high } kontra-melodi di bagian B
 */
function theme(spec) {
  const cb = bars(spec.chords);
  const B = spec.beats, nBars = cb.length, passBeats = nBars * B;
  const form = spec.form || ['A', 'B', 'A'];
  const events = [];
  form.forEach((part, pi) => {
    const off = pi * passBeats;
    const push = (list, inst, vScale = 1) => list.forEach(e => events.push({ inst: e.inst || inst, t: e.t + off, d: e.d, n: e.n, v: (e.v ?? 0.8) * vScale }));
    if (part === 'A' && spec.melody) {
      const m = seq(spec.melody.notes);
      if (Math.abs(m.length - passBeats) > 1e-6) console.warn(`[music] ${spec.name}: melodi ${m.length} beat, akor ${passBeats}`);
      push(m.events.map(e => ({ ...e, v: spec.melody.vel ?? 0.8 })), spec.melody.inst);
      if (spec.melody.double) push(m.events.map(e => ({ ...e, n: e.n + (spec.melody.double.shift || 0), v: spec.melody.double.vel ?? 0.4 })), spec.melody.double.inst);
    }
    if (part === 'B' && spec.b) {
      push(descant(cb, B, spec.name + pi, spec.b), spec.b.inst, spec.b.vel ?? 0.8);
    }
    for (const a of spec.accomp || []) {
      if (a.only && a.only !== part) continue;
      push(accompany(a, cb, B), a.inst, a.vel ?? 1);
    }
    if (spec.drone) events.push({ inst: 'drone', t: off, d: passBeats, n: spec.drone.map(midi), v: spec.droneVel ?? 0.8 });
    if (spec.drums && !(spec.drumsOnlyA && part !== 'A')) push(drums(spec.drums, nBars, B), 'drum', spec.drumVel ?? 1);
    if (spec.bells) {
      for (let bar = 0; bar < nBars; bar += spec.bells) {
        const { root, fifth } = chordTones(cb[bar][0]);
        events.push({ inst: 'bell', t: off + bar * B, d: B, n: at(bar % 2 ? root + fifth : root, 6), v: 0.5 });
      }
    }
  });
  events.sort((a, b) => a.t - b.t);
  return { name: spec.name, bpm: spec.bpm, beats: B, totalBeats: passBeats * form.length, loop: spec.loop !== false, reverb: spec.reverb, gain: spec.gain, events };
}

/** Lagu dari trek eksplisit (cue film, jingle). */
function cue(spec) {
  const events = [];
  let total = 0;
  for (const tr of spec.tracks) {
    const s = seq(tr.notes);
    total = Math.max(total, s.length);
    s.events.forEach(e => events.push({ inst: tr.inst, t: e.t, d: e.d, n: e.n, v: tr.vel ?? 0.8 }));
  }
  if (spec.drums) {
    const d = drums(spec.drums.pattern, spec.drums.bars, spec.beats);
    d.forEach(e => events.push({ ...e, v: e.v * (spec.drums.vel ?? 1) }));
    total = Math.max(total, spec.drums.bars * spec.beats);
  }
  events.sort((a, b) => a.t - b.t);
  return { name: spec.name, bpm: spec.bpm, beats: spec.beats, totalBeats: spec.total || total, loop: !!spec.loop, reverb: spec.reverb, gain: spec.gain, events };
}

// ═══════════════════════════════════════════════════════════════════
// LAGU-LAGU
// ═══════════════════════════════════════════════════════════════════

export const SONGS = {};
const def = (s) => { SONGS[s.name] = s; };

// ── Menu utama: "Lukas' Reise" — D Dorian, 3/4, tenang & mengundang ──
def(theme({
  name: 'menu', bpm: 92, beats: 3, reverb: 0.32,
  chords: 'Dm | C | Dm | Am | F | C | G | A | Dm | C | F | C | Dm | Am | A | Dm',
  melody: { inst: 'flute', vel: 0.75, notes:
    'D4 F4 A4 | G4/2 E4/1 | F4 E4 D4 | E4/2 A3/1 | A4 C5 A4 | G4/1.5 F4/0.5 E4/1 | D4 G4 B4 | A4/2 E4/1 | ' +
    'D5 C5 A4 | C5 G4 E4 | F4 A4 C5 | E5/2 D5/0.5 C5/0.5 | D5 A4 F4 | A4/1.5 G4/0.5 E4/1 | E4 A4 C#5 | D5/3' },
  accomp: [{ inst: 'lute', type: 'arp' }],
  drone: ['D3', 'A3'], droneVel: 0.7,
  b: { inst: 'harp', low: 62, high: 79 },
  drums: 'b..', drumVel: 0.7,
}));

// ── Rumah Oma (pagi, pedesaan): G mayor, 6/8 lembut ──
def(theme({
  name: 'home', bpm: 196, beats: 6, reverb: 0.24,
  chords: 'G | G | C | G | Em | C | D | D | G | G | C | Am | G | C | D | G',
  melody: { inst: 'flute', vel: 0.72, notes:
    'D5/2 B4/1 G4/2 B4/1 | D5/3 E5/2 D5/1 | C5/2 E5/1 G5/2 E5/1 | D5/6 | B4/2 G4/1 E4/2 G4/1 | C5/3 B4/2 A4/1 | A4/2 B4/1 C5/2 A4/1 | D5/4 r/2 | ' +
    'D5/2 B4/1 G4/2 B4/1 | D5/3 G5/2 F#5/1 | E5/2 C5/1 E5/2 G5/1 | A5/3 E5/3 | D5/2 B4/1 G4/2 D5/1 | E5/2 D5/1 C5/2 E5/1 | D5/2 C5/1 B4/2 A4/1 | G4/6' },
  accomp: [{ inst: 'lute', type: 'arp' }],
  b: { inst: 'harp', low: 67, high: 83 },
  drums: 'b..t..', drumVel: 0.55,
}));

// ── Mencari barang (Quest 2): E Dorian, 4/4, ingin tahu & ringan ──
def(theme({
  name: 'search', bpm: 100, beats: 4, reverb: 0.22,
  chords: 'Em | Em | D | D | Em | Em | C | D | Em | Em | D | D | Em | G | C D | Em',
  melody: { inst: 'flute', vel: 0.68, notes:
    'E4/0.5 G4/0.5 B4/1 A4/0.5 G4/0.5 E4/1 | F#4/0.5 G4/0.5 A4/1 B4/2 | A4/0.5 F#4/0.5 D4/1 E4/0.5 F#4/0.5 A4/1 | G4 F#4 E4/2 | ' +
    'B4/0.5 C#5/0.5 D5/1 B4/0.5 A4/0.5 G4/1 | A4/0.5 B4/0.5 G4/1 E4/2 | E4/0.5 G4/0.5 C5/1 B4 A4 | B4 A4 F#4/2 | ' +
    'E5/0.5 D5/0.5 B4/1 C#5/0.5 B4/0.5 G4/1 | A4/0.5 G4/0.5 E4/1 F#4/2 | D4/0.5 F#4/0.5 A4/1 D5/1 C#5/1 | B4/1 A4/1 F#4/2 | ' +
    'E4/0.5 F#4/0.5 G4/1 B4/1 E5/1 | D5/1 B4/1 G4/2 | E4/1 G4/1 F#4/1 A4/1 | E4/4' },
  accomp: [{ inst: 'pizz', type: 'pizz' }],
  b: { inst: 'harp', low: 64, high: 81 },
  drums: '..t...t.', drumVel: 0.5,
  bells: 4,
}));

// ── Perjalanan di kota (Quest 3, 5, 8): D Mixolydian, 4/4, langkah gagah ──
def(theme({
  name: 'journey', bpm: 108, beats: 4, reverb: 0.22,
  chords: 'D | C | D | G | D | C | G | D | D | C | D | G | D | C | G | D',
  melody: { inst: 'flute', vel: 0.74, notes:
    'D4 F#4 A4 F#4 | G4 E4 C4/2 | D4/0.5 E4/0.5 F#4/1 A4/1 D5/1 | B4/1.5 A4/0.5 G4/2 | A4 F#4 D5 C5 | B4 G4 E4 C5 | B4 D5 C5/0.5 B4/0.5 A4 | D5/2 r/1 A4/1 | ' +
    'D5 A4 F#4 A4 | C5 E5 D5 C5 | A4 D5 F#5 E5 | D5/1.5 C5/0.5 B4/2 | A4 D5 C5 A4 | G4 C5 E5/2 | D5 B4 A4/0.5 G4/0.5 E4 | D4/3 r/1' },
  accomp: [{ inst: 'lute', type: 'strum', on: [0, 2] }],
  drone: ['D3', 'A3'], droneVel: 0.75,
  b: { inst: 'lute', low: 62, high: 79, vel: 0.9 },
  drums: 'B.t.B.tt', drumVel: 0.85,
}));

// ── Pasar & belanja di kota (Quest 4): G Mixolydian, 6/8, ramai (saltarello) ──
def(theme({
  name: 'market', bpm: 250, beats: 6, reverb: 0.2,
  chords: 'G | F | G | D | G | F | C | D | G | F | G | C | F | G | D | G',
  melody: { inst: 'flute', vel: 0.74, notes:
    'G4/2 A4/1 B4/2 G4/1 | A4/2 G4/1 F4/2 A4/1 | B4/1 C5/1 D5/1 B4/2 G4/1 | A4/3 D4/3 | G4/2 B4/1 D5/2 B4/1 | C5/2 A4/1 F4/2 A4/1 | G4/1 A4/1 G4/1 E4/2 G4/1 | D5/3 A4/3 | ' +
    'D5/2 C5/1 B4/2 D5/1 | C5/2 F5/1 E5/2 C5/1 | D5/1 E5/1 D5/1 B4/2 G4/1 | E5/2 D5/1 C5/2 G4/1 | A4/2 C5/1 F5/2 E5/1 | D5/2 B4/1 G4/2 B4/1 | A4/1 B4/1 C5/1 A4/2 F#4/1 | G4/6' },
  accomp: [{ inst: 'lute', type: 'strum', on: [0, 3] }],
  drone: ['G2', 'D3'], droneVel: 0.7,
  b: { inst: 'lute', low: 62, high: 79, vel: 0.9 },
  drums: 'x..t.t', drumVel: 0.8,
}));

// ── Di dalam EDEKA / foyer bioskop: C mayor, ceria & ringan ──
def(theme({
  name: 'shop', bpm: 116, beats: 4, reverb: 0.18,
  chords: 'C | G | Am | F | C | G | F G | C',
  melody: { inst: 'flute', vel: 0.66, double: { inst: 'bell', shift: 12, vel: 0.25 }, notes:
    'E5/0.5 G5/0.5 E5/0.5 C5/0.5 D5/1 E5/1 | D5/0.5 B4/0.5 G4/1 B4/1 D5/1 | C5/0.5 E5/0.5 A5/1 G5/0.5 E5/0.5 C5/1 | D5/1 C5/0.5 A4/0.5 F4/2 | ' +
    'E5/0.5 F5/0.5 G5/1 E5/0.5 C5/0.5 G4/1 | B4/0.5 D5/0.5 G5/1 F5/1 D5/1 | C5/1 A4/1 B4/1 D5/1 | C5/3 r/1' },
  accomp: [{ inst: 'pizz', type: 'pizz' }],
  b: { inst: 'harp', low: 67, high: 84 },
  drums: '..t...t.', drumVel: 0.45,
}));

// ── Tersesat (Quest 6, sore): A Aeolian, 3/4, rindu tapi penuh harapan ──
def(theme({
  name: 'lost', bpm: 78, beats: 3, reverb: 0.34,
  chords: 'Am | Am | G | G | F | F | E | E | Am | Am | G | C | F | Dm | E | Am',
  melody: { inst: 'flute', vel: 0.7, notes:
    'E4 A4 C5 | B4/2 A4/1 | G4 B4 D5 | C5/1.5 B4/0.5 A4/1 | A4 F4 A4 | C5/2 B4/0.5 A4/0.5 | G#4/2 B4/1 | E4/3 | ' +
    'A4 C5 E5 | D5/1.5 C5/0.5 B4/1 | B4 D5 G5 | E5/2 D5/0.5 C5/0.5 | C5 A4 F4 | D5/1.5 C5/0.5 A4/1 | B4 G#4 E4 | A4/3' },
  accomp: [{ inst: 'harp', type: 'harp', notes: 6 }, { inst: 'pad', type: 'pad', vel: 0.8 }],
  b: { inst: 'lute', low: 60, high: 76 },
}));

// ── Malam (Quest 7 & berjalan malam): D minor, 3/4 sangat tenang ──
def(theme({
  name: 'night', bpm: 60, beats: 3, reverb: 0.5, gain: 0.95,
  form: ['A', 'B', 'A', 'B'],
  chords: 'Dm | Bb | F | C | Dm | Bb | Gm | A | Dm | F | C | Bb | Gm | Dm | A | Dm',
  melody: { inst: 'flute', vel: 0.55, notes:
    'A4/2 F4/1 | D5/3 | C5/2 A4/1 | G4/3 | F4 A4 D5 | F5/2 D5/1 | D5 Bb4 G4 | A4/2 C#5/1 | ' +
    'D5/3 | C5/1 A4/2 | G4 C5 E5 | D5/3 | Bb4/1.5 A4/0.5 G4/1 | F4 A4 D5 | E5/2 C#5/1 | D5/3' },
  accomp: [{ inst: 'harp', type: 'harp', notes: 6, vel: 0.85 }, { inst: 'pad', type: 'pad', vel: 0.9 }],
  b: { inst: 'bell', low: 74, high: 86, vel: 0.6 },
}));

// ── Malam perpisahan (Quest 10): F mayor, 3/4 hangat & haru ──
def(theme({
  name: 'farewell', bpm: 70, beats: 3, reverb: 0.4,
  chords: 'F | Dm | Bb | C | F | Am | Bb | C | Dm | Am | Bb | F | Gm | C | C7 | F',
  melody: { inst: 'flute', vel: 0.66, notes:
    'C5 A4 F4 | D5/2 C5/1 | Bb4 D5 F5 | E5/2 C5/1 | A4 C5 F5 | E5/1.5 D5/0.5 C5/1 | D5 Bb4 G4 | C5/3 | ' +
    'F5 E5 D5 | C5/2 A4/1 | Bb4 C5 D5 | C5/1.5 A4/0.5 F4/1 | G4 Bb4 D5 | E5 D5 C5 | Bb4 A4 G4 | F4/3' },
  accomp: [{ inst: 'lute', type: 'arp', vel: 0.9 }, { inst: 'pad', type: 'pad', vel: 0.7 }],
  b: { inst: 'harp', low: 65, high: 81 },
}));

// ── Jalan-jalan di tepi Elbe (Quest 9): D mayor, 6/8 mengalir ──
def(theme({
  name: 'river', bpm: 176, beats: 6, reverb: 0.32,
  chords: 'D | G | D | A | Bm | G | Em | A | D | G | Bm | A | G | D | A | D',
  melody: { inst: 'flute', vel: 0.7, notes:
    'F#4/3 A4/2 D5/1 | B4/3 G4/3 | A4/2 F#4/1 D4/2 F#4/1 | E4/6 | F#4/2 B4/1 D5/2 B4/1 | D5/3 B4/3 | G4/2 B4/1 E5/2 D5/1 | C#5/6 | ' +
    'D5/3 F#5/2 E5/1 | D5/3 B4/3 | A4/2 B4/1 D5/2 F#5/1 | E5/6 | D5/2 B4/1 G4/2 B4/1 | A4/2 F#4/1 D4/2 F#4/1 | E4/2 A4/1 C#5/2 E5/1 | D5/6' },
  accomp: [{ inst: 'harp', type: 'arp' }],
  b: { inst: 'lute', low: 62, high: 78 },
  drums: 'b.....', drumVel: 0.45,
}));

// ── Naik bus (cutscene Quest 5): G mayor, riang & bergoyang ──
def(theme({
  name: 'travel', bpm: 124, beats: 4, reverb: 0.18, form: ['A', 'A'],
  chords: 'G | C | G | D | G | C | D | G',
  melody: { inst: 'flute', vel: 0.72, notes:
    'G4/0.5 B4/0.5 D5/0.5 B4/0.5 G4/1 D4/1 | E4/0.5 G4/0.5 C5/0.5 G4/0.5 E4/1 C5/1 | D4/0.5 G4/0.5 B4/0.5 D5/0.5 G5/1 D5/1 | C5/0.5 B4/0.5 A4/1 F#4/1 D4/1 | ' +
    'G4/0.5 B4/0.5 D5/0.5 G5/0.5 F#5/0.5 E5/0.5 D5/1 | E5/0.5 D5/0.5 C5/0.5 B4/0.5 A4/1 G4/1 | F#4/0.5 G4/0.5 A4/0.5 B4/0.5 C5/1 A4/1 | G4/2 r/2' },
  accomp: [{ inst: 'lute', type: 'strum', on: [0, 1, 2, 3] }],
  drums: 'B.tjB.tj', drumVel: 0.7,
}));

// ── Restoran (Quest 8): D Dorian, 6/8 cepat — musik kedai abad pertengahan ──
def(theme({
  name: 'tavern', bpm: 290, beats: 6, reverb: 0.22, form: ['A', 'B', 'A'],
  chords: 'Dm | C | Dm | Am | Dm | C | F C | Dm | Dm | C | Dm | Am | Dm | C | A | Dm',
  melody: { inst: 'flute', vel: 0.72, notes:
    'D5/2 A4/1 F4/2 A4/1 | G4/2 C5/1 E5/2 C5/1 | D5/1 E5/1 F5/1 E5/2 D5/1 | C5/2 A4/1 E4/3 | F4/1 G4/1 A4/1 D5/2 A4/1 | G4/1 A4/1 G4/1 E4/2 C4/1 | F4/2 A4/1 G4/2 E4/1 | D4/3 D5/3 | ' +
    'A5/2 F5/1 D5/2 F5/1 | G5/2 E5/1 C5/2 E5/1 | F5/1 E5/1 D5/1 C5/1 B4/1 A4/1 | E5/3 A4/3 | D5/2 F5/1 A5/2 F5/1 | E5/2 C5/1 G4/2 C5/1 | C#5/1 D5/1 E5/1 A4/2 C#5/1 | D5/6' },
  accomp: [{ inst: 'lute', type: 'strum', on: [0, 3] }],
  drone: ['D3', 'A3'], droneVel: 0.6,
  b: { inst: 'lute', low: 62, high: 79, vel: 0.9 },
  drums: 'x.tBt.', drumVel: 0.75,
}));

// ── Akhir permainan: D mayor, himne hangat ──
def(theme({
  name: 'finale', bpm: 72, beats: 4, reverb: 0.42, form: ['A', 'B', 'A'],
  chords: 'D | G | Bm | A | G | D | Em A | D',
  melody: { inst: 'flute', vel: 0.7, double: { inst: 'horn', shift: -12, vel: 0.35 }, notes:
    'F#4 A4 D5/2 | B4 A4 G4/2 | F#4 B4 D5 C#5 | A4/4 | B4 D5 G5/2 | F#5 E5 D5/2 | E5 G5 A4 C#5 | D5/4' },
  accomp: [{ inst: 'harp', type: 'harp', notes: 8 }, { inst: 'pad', type: 'pad' }],
  b: { inst: 'flute', low: 66, high: 81, vel: 0.7 },
  bells: 2,
}));

// ═══════════════════════════════════════════════════════════════════
// MUSIK FILM "Abenteuer an der Elbe" (cutscene bioskop, Quest 7)
// Disinkronkan dengan adegan di js/cutscene.js.
// ═══════════════════════════════════════════════════════════════════

// Judul: fanfare horn + timpani (≈ 2,6 dtk)
def(cue({
  name: 'film_title', bpm: 100, beats: 4, reverb: 0.45, total: 5,
  tracks: [
    { inst: 'horn', vel: 0.85, notes: 'D4/0.5 F#4/0.5 A4/0.5 D5/2.5' },
    { inst: 'horn', vel: 0.6, notes: 'r/1.5 A3/2.5' },
    { inst: 'strings', vel: 0.8, notes: '[D3,A3,D4,F#4]/4.5' },
    { inst: 'timp', vel: 0.9, notes: 'D2/0.25 D2/0.25 D2/0.25 D2/0.25 r/0.5 D2/3' },
  ],
}));

// Kapten berlayar: lagu pelaut 6/8 (berulang selama adegan)
def(cue({
  name: 'film_sail', bpm: 200, beats: 6, reverb: 0.3, loop: true,
  tracks: [
    { inst: 'flute', vel: 0.78, notes: 'A4/2 D5/1 D5/2 E5/1 | D5/2 B4/1 G4/3 | F#4/2 A4/1 D5/2 F#5/1 | E5/6' },
    { inst: 'lute', vel: 0.75, notes: '[D3,A3,D4,F#4]/3 [D3,A3,D4,F#4]/3 | [G2,D3,G3,B3]/3 [G2,D3,G3,B3]/3 | [D3,A3,D4,F#4]/3 [D3,A3,D4,F#4]/3 | [A2,E3,A3,C#4]/3 [A2,E3,A3,C#4]/3' },
  ],
  drums: { pattern: 'B..t..', bars: 4, vel: 0.8 },
}));

// Badai: tremolo string, timpani bergemuruh, horn rendah (D minor)
def(cue({
  name: 'film_storm', bpm: 140, beats: 4, reverb: 0.4, loop: true,
  tracks: [
    { inst: 'strings', vel: 0.9, notes: '[D3,F3,A3,D4]/4 [Bb2,F3,Bb3,D4]/4' },
    { inst: 'horn', vel: 0.75, notes: 'D3/1 F3/1 A3/1 Bb3/1 | A3/3 C#4/1' },
    { inst: 'timp', vel: 0.75, notes: 'D2/0.25 D2/0.25 D2/0.25 D2/0.25 D2/0.25 D2/0.25 D2/0.25 D2/0.25 A1/0.5 A1/0.5 D2/1 | Bb1/0.25 Bb1/0.25 Bb1/0.25 Bb1/0.25 Bb1/0.25 Bb1/0.25 Bb1/0.25 Bb1/0.25 A1/1 A1/1' },
  ],
}));

// Mercusuar menunjukkan jalan: himne D mayor, lega & hangat
def(cue({
  name: 'film_light', bpm: 80, beats: 4, reverb: 0.45, loop: true,
  tracks: [
    { inst: 'strings', vel: 0.75, notes: '[D3,A3,D4,F#4]/4 [G2,D3,G3,B3]/2 [A2,E3,A3,C#4]/2' },
    { inst: 'horn', vel: 0.62, notes: 'F#4/2 A4/1 B4/1 | A4/2 E4/1 C#5/1' },
    { inst: 'harp', vel: 0.55, notes: 'D4/0.5 F#4/0.5 A4/0.5 D5/0.5 F#5/0.5 D5/0.5 A4/0.5 F#4/0.5 | G4/0.5 B4/0.5 D5/0.5 G5/0.5 A4/0.5 C#5/0.5 E5/0.5 A5/0.5' },
  ],
}));

// ENDE: kadens akhir + lonceng
def(cue({
  name: 'film_end', bpm: 80, beats: 4, reverb: 0.5, total: 6,
  tracks: [
    { inst: 'strings', vel: 0.8, notes: '[G2,D3,G3,B3]/1 [A2,E3,A3,C#4]/1 [D3,A3,D4,F#4]/4' },
    { inst: 'horn', vel: 0.6, notes: 'B4/1 C#5/1 D5/4' },
    { inst: 'harp', vel: 0.6, notes: 'r/2 D4/0.25 F#4/0.25 A4/0.25 D5/0.25 F#5/0.25 A5/0.25 D6/2.5' },
    { inst: 'bell', vel: 0.5, notes: 'r/2 D6/4' },
  ],
}));

// ── Jingle ────────────────────────────────────────────────────────
def(cue({
  name: 'jingle_complete', bpm: 132, beats: 4, reverb: 0.35, total: 5,
  tracks: [
    { inst: 'flute', vel: 0.8, notes: 'G4/0.5 B4/0.5 D5/0.5 G5/2.5' },
    { inst: 'lute', vel: 0.8, notes: 'r/1.5 [G2,D3,G3,B3,D4]/3' },
    { inst: 'bell', vel: 0.5, notes: 'r/1.5 G6/3' },
  ],
}));
