// ═══════════════════════════════════════════════════════════════════
// js/sfx.js — UI-SOUNDEFFEKTE (Web Audio, ohne Asset-Dateien)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Erzeugt kurze, warme Chimes und schickt sie durch einen
// prozeduralen Hallraum (ConvolverNode mit selbst berechneter
// Impulsantwort). Dadurch klingt das Menü "teuer", ohne dass eine
// einzige Audiodatei geladen werden muss.
//
// Browser starten AudioContext gesperrt: der Kontext wird beim ersten
// echten Nutzer-Input entsperrt (siehe unlock()).
// ═══════════════════════════════════════════════════════════════════

export const Sfx = {
  ctx:      null,
  master:   null,   // Gesamtlautstärke
  dry:      null,   // Direktsignal
  wet:      null,   // Hallanteil
  convolver:null,
  enabled:  true,
  volume:   0.7,    // folgt der Lautstärke-Einstellung
  _lastPlay: 0,
  _unlocked: false,
};

// ── Voices: Frequenzen (Hz), Länge (s), Hallanteil ────────────────
const VOICES = {
  hover:  { freqs: [784.0, 1174.7], dur: 0.26, wet: 0.42, peak: 0.16, type: 'sine'     },
  select: { freqs: [523.3, 784.0, 1046.5], dur: 0.62, wet: 0.55, peak: 0.22, type: 'triangle' },
  back:   { freqs: [587.3, 392.0], dur: 0.34, wet: 0.45, peak: 0.15, type: 'sine'     },
  toggle: { freqs: [880.0], dur: 0.2,  wet: 0.35, peak: 0.13, type: 'triangle' },
};

const MIN_GAP_MS = 55;   // verhindert Sound-Stakkato beim schnellen Hovern


/**
 * Impulsantwort für den Hall: Rauschen mit exponentiellem Abfall,
 * leicht versetzt pro Kanal → breiter, weicher Raum.
 */
function buildImpulse(ctx, seconds = 2.4, decay = 3.4) {
  const rate = ctx.sampleRate;
  const len  = Math.max(1, Math.floor(rate * seconds));
  const buf  = ctx.createBuffer(2, len, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data   = buf.getChannelData(ch);
    const spread = ch === 0 ? 1.0 : 0.92;   // minimaler Kanalversatz
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay * spread);
    }
  }
  return buf;
}


function ensureContext() {
  if (Sfx.ctx) return Sfx.ctx;

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  const ctx = new AC();
  Sfx.ctx = ctx;

  // master → destination
  const master = ctx.createGain();
  master.gain.value = Sfx.volume;
  master.connect(ctx.destination);

  // Etwas Höhen nehmen — macht den Klang runder statt schrill
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  tone.Q.value = 0.6;
  tone.connect(master);

  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  dry.connect(tone);

  const convolver = ctx.createConvolver();
  convolver.buffer = buildImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  convolver.connect(wet);
  wet.connect(tone);

  Sfx.master    = master;
  Sfx.dry       = dry;
  Sfx.wet       = wet;
  Sfx.convolver = convolver;

  return ctx;
}


/**
 * Entsperrt den AudioContext. Muss aus einem echten Nutzer-Event
 * heraus laufen (Klick, Tastendruck, Touch) — Mausbewegung zählt nicht.
 */
export function unlockSfx() {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  Sfx._unlocked = true;
}


/**
 * Spielt einen Menü-Sound. Unbekannte Namen werden ignoriert.
 * @param {'hover'|'select'|'back'|'toggle'} name
 */
export function playSfx(name) {
  if (!Sfx.enabled || Sfx.volume <= 0) return;

  const voice = VOICES[name];
  if (!voice) return;

  const now = performance.now();
  if (now - Sfx._lastPlay < MIN_GAP_MS) return;
  Sfx._lastPlay = now;

  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'running') return;   // noch gesperrt → still

  const t0 = ctx.currentTime;

  voice.freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.setValueAtTime(freq, t0);

    // "back" fällt hörbar ab, die anderen bleiben stehen
    if (name === 'back' && i === voice.freqs.length - 1) {
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, t0 + voice.dur * 0.7);
    }

    const gain = ctx.createGain();
    const peak = voice.peak / (i + 1.35);          // obere Töne leiser → weicher Akkord
    const start = t0 + i * 0.022;                  // minimales Arpeggio
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.dur);

    osc.connect(gain);
    gain.connect(Sfx.dry);
    gain.connect(Sfx.convolver);

    osc.start(start);
    osc.stop(start + voice.dur + 0.05);
  });

  Sfx.wet.gain.setTargetAtTime(voice.wet, t0, 0.02);
}


export function setSfxVolume(v) {
  Sfx.volume = Math.max(0, Math.min(1, v));
  if (Sfx.master) Sfx.master.gain.setTargetAtTime(Sfx.volume, Sfx.ctx.currentTime, 0.03);
}

export function setSfxEnabled(on) {
  Sfx.enabled = !!on;
}


// ═══════════════════════════════════════════════════════════════════
// TELEFONKLINGELN — altes Wählscheibentelefon im Flur
// Ein Klöppel schlägt ~24× pro Sekunde abwechselnd zwei kleine
// Glocken an: „Brrring … brrring“. Der Klang wird einmal als
// AudioBuffer berechnet und dann im Rhythmus abgespielt.
// ═══════════════════════════════════════════════════════════════════

export const RING_PATTERN = [
  { at: 0.00, dur: 0.80 },        // brrring
  { at: 1.05, dur: 0.80 },        // brrring
];
export const RING_CYCLE = 3.45;   // danach Pause bis zum nächsten Doppelklingeln

const Ring = { buffer: null, gain: null, timer: null, nextCycle: 0, sources: [], level: 1 };

function buildRingBuffer(ctx, dur) {
  const sr   = ctx.sampleRate;
  const tail = 0.35;
  const len  = Math.floor(sr * (dur + tail));
  const buf  = ctx.createBuffer(1, len, sr);
  const out  = buf.getChannelData(0);
  const T    = 1 / 24;                                  // Klöppel-Takt
  // Teiltöne (Hz, Gewicht) — unharmonisch wie echte Glocken
  const bellA = [[1046, 1.0], [2507, 0.42], [3952, 0.22], [5280, 0.08]];
  const bellB = [[ 988, 0.9], [2370, 0.38], [3730, 0.20], [5010, 0.07]];
  const TAU = Math.PI * 2;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const n = Math.floor(Math.min(t, dur - 1e-4) / T);  // letzter Schlag
    const sinceA = t - (n % 2 === 0 ? n : n - 1) * T;    // A: gerade Schläge
    const sinceB = n >= 1 ? t - (n % 2 === 1 ? n : n - 1) * T : 1e9;
    const ampA = Math.exp(-sinceA * 22) * (0.6 + 0.4 * Math.exp(-sinceA * 140));
    const ampB = Math.exp(-sinceB * 22) * (0.6 + 0.4 * Math.exp(-sinceB * 140));
    let s = 0;
    for (const [f, w] of bellA) s += ampA * w * Math.sin(TAU * f * t);
    for (const [f, w] of bellB) s += ampB * w * Math.sin(TAU * f * t + 1.3);
    const fadeIn = Math.min(1, t / 0.006);
    out[i] = s * 0.22 * fadeIn;
  }
  return buf;
}

function scheduleRing() {
  const ctx = Sfx.ctx;
  if (!ctx || !Ring.gain) return;
  if (document.hidden) {                           // Tab im Hintergrund → nicht klingeln
    Ring.nextCycle = Math.max(Ring.nextCycle, ctx.currentTime + 0.4);
    return;
  }
  while (Ring.nextCycle < ctx.currentTime + 0.4) {
    for (const p of RING_PATTERN) {
      const src = ctx.createBufferSource();
      src.buffer = Ring.buffer;
      src.connect(Ring.gain);
      src.start(Math.max(ctx.currentTime, Ring.nextCycle + p.at));
      src.onended = () => { Ring.sources = Ring.sources.filter(x => x !== src); };
      Ring.sources.push(src);
    }
    Ring.nextCycle += RING_CYCLE;
  }
}

/** Telefon klingelt, bis stopPhoneRing() kommt. Gibt false zurück, wenn stumm. */
export function startPhoneRing() {
  stopPhoneRing();
  const ctx = ensureContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!Ring.buffer) Ring.buffer = buildRingBuffer(ctx, RING_PATTERN[0].dur);
  const g = ctx.createGain();
  g.gain.value = Sfx.enabled ? Ring.level : 0;
  g.connect(Sfx.dry);
  g.connect(Sfx.convolver);          // etwas Flur-Hall
  Ring.gain = g;
  Ring.nextCycle = ctx.currentTime + 0.05;
  scheduleRing();
  Ring.timer = setInterval(scheduleRing, 150);
  window.dispatchEvent(new CustomEvent('phone:ring'));
  return true;
}

/** Lautstärke des Klingelns 0..1 (Entfernung, Pause, anderer Raum). */
export function setPhoneRingLevel(v) {
  Ring.level = Math.max(0, Math.min(1, v));
  if (!Ring.gain || !Sfx.ctx) return;
  Ring.gain.gain.setTargetAtTime(Sfx.enabled ? Ring.level : 0, Sfx.ctx.currentTime, 0.08);
}

export function stopPhoneRing() {
  const wasRinging = !!Ring.gain;
  clearInterval(Ring.timer);
  Ring.timer = null;
  if (Ring.gain && Sfx.ctx) {
    const g = Ring.gain, t = Sfx.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, 0.03);
    Ring.sources.forEach(s => { try { s.stop(t + 0.15); } catch (_) {} });
    setTimeout(() => { try { g.disconnect(); } catch (_) {} }, 400);
  }
  Ring.gain = null;
  Ring.sources = [];
  if (wasRinging) window.dispatchEvent(new CustomEvent('phone:stop'));
}

export function isPhoneRinging() { return !!Ring.gain; }
