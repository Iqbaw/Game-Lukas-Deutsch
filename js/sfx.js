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
