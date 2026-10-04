// ═══════════════════════════════════════════════════════════════════
// js/activitylog.js — SPIELPROTOKOLL (log aktivitas & percakapan)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Zeichnet auf, was Lukas tut: Sitzungen, Orte, Quests und Schritte,
// gefundene Gegenstände, Tipps, nachgeschlagene Vokabeln, Zwischen-
// sequenzen — und jedes Gespräch mit NPCs Zeile für Zeile, samt der
// gewählten Antworten (richtig/falsch, Punkte).
//
// Sichtbar ist das Protokoll NUR im Admin-Modus (js/adminlog.js).
// Gespeichert wird ausschließlich lokal in diesem Browser (localStorage) —
// nichts verlässt das Gerät.
// ═══════════════════════════════════════════════════════════════════

import { QUESTS, questNumber } from './data/quests.js';

const STORE_KEY   = 'lukas_activity_log_v1';
const MAX_ENTRIES = 6000;       // ältere Sitzungen fallen zuerst heraus

export const ZONE_LABELS = {
  haus_interior:        { de: 'Haus — innen',          id: 'Rumah — dalam' },
  haus:                 { de: 'Garten der Großeltern', id: 'Halaman kakek-nenek' },
  stadt:                { de: 'Die Stadt',             id: 'Kota' },
  supermarket_interior: { de: 'EDEKA — innen',         id: 'Supermarket — dalam' },
};

export const ActivityLog = {
  entries:  [],     // { i, s, t, k, q, z, ...daten }
  sessions: [],     // { id, start, mode }
  current:  null,   // id der laufenden Sitzung
  seq:      0,
};

const listeners = new Set();
let saveTimer = null;


// ── Speicher ──────────────────────────────────────────────────────

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.entries))  ActivityLog.entries  = data.entries;
    if (Array.isArray(data.sessions)) ActivityLog.sessions = data.sessions;
    ActivityLog.seq = ActivityLog.entries.reduce((m, e) => Math.max(m, e.i || 0), 0);
  } catch (_) { /* beschädigt oder gesperrt → leer beginnen */ }
}

function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 1, sessions: ActivityLog.sessions, entries: ActivityLog.entries,
    }));
  } catch (_) {
    // Speicher voll → die ältere Hälfte verwerfen und noch einmal versuchen
    if (ActivityLog.entries.length > 200) {
      ActivityLog.entries.splice(0, Math.floor(ActivityLog.entries.length / 2));
      pruneSessions();
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, sessions: ActivityLog.sessions, entries: ActivityLog.entries })); } catch (_) {}
    }
  }
}

function scheduleSave() {
  if (!saveTimer) saveTimer = setTimeout(flush, 1500);
}

function pruneSessions() {
  const used = new Set(ActivityLog.entries.map(e => e.s));
  ActivityLog.sessions = ActivityLog.sessions.filter(s => used.has(s.id) || s.id === ActivityLog.current);
}


// ── Aufzeichnen ───────────────────────────────────────────────────

/** Neue Sitzung (Neues Spiel / Weiterspielen). */
export function startSession(mode = 'new') {
  const id = 's' + Date.now().toString(36);
  ActivityLog.sessions.push({ id, start: Date.now(), mode });
  ActivityLog.current = id;
  logActivity('session', { mode });
  return id;
}

/**
 * Einen Eintrag ins Protokoll schreiben.
 * kind: session · zone · quest_start · quest_step · quest_done · item · hint ·
 *       vocab · cutscene · sms · dlg_open · dlg_line · dlg_choice · dlg_close ·
 *       dlg_skip · admin
 */
export function logActivity(kind, data = {}) {
  if (!ActivityLog.current) {
    // Spiel ohne Menü gestartet (Test, Admin-Sprung) → stille Sitzung
    const id = 's' + Date.now().toString(36);
    ActivityLog.sessions.push({ id, start: Date.now(), mode: 'auto' });
    ActivityLog.current = id;
  }
  const entry = {
    i: ++ActivityLog.seq,
    s: ActivityLog.current,
    t: Date.now(),
    k: kind,
    q: window.__QUEST_SYSTEM__?.activeQuestId || null,
    z: window.__currentZoneId__ || null,
    ...data,
  };
  ActivityLog.entries.push(entry);
  if (ActivityLog.entries.length > MAX_ENTRIES) {
    ActivityLog.entries.splice(0, ActivityLog.entries.length - MAX_ENTRIES);
    pruneSessions();
  }
  scheduleSave();
  listeners.forEach(fn => { try { fn(entry); } catch (_) {} });
  return entry;
}

/** Benachrichtigung bei jedem neuen Eintrag; gibt eine Abmeldefunktion zurück. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearLog() {
  ActivityLog.entries = [];
  ActivityLog.sessions = ActivityLog.current
    ? ActivityLog.sessions.filter(s => s.id === ActivityLog.current)
    : [];
  flush();
  listeners.forEach(fn => { try { fn(null); } catch (_) {} });
}


// ── Hilfen für Text ───────────────────────────────────────────────

/** HTML eines Dialogknotens → Klartext + Liste der Vokabeln [wort, übersetzung]. */
export function plainText(html) {
  const vocab = [];
  const src = String(html || '').replace(/<vocab title="([^"]+)">([^<]+)<\/vocab>/g, (_, tr, w) => {
    vocab.push([w, tr]);
    return w;
  });
  const div = document.createElement('div');
  div.innerHTML = src.replace(/<br\s*\/?>/gi, ' ');
  return { text: (div.textContent || '').replace(/\s+/g, ' ').trim(), vocab };
}

export function questTitle(qid) {
  const q = qid && QUESTS[qid];
  return q ? { n: questNumber(qid), title: q.title, subtitle: q.subtitle || '' } : null;
}


// ── Automatisch erfasste Ereignisse ───────────────────────────────

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  window.addEventListener('zone:enter', (e) => {
    const id = e.detail?.zoneId;
    const lbl = ZONE_LABELS[id] || { de: e.detail?.zoneName || id, id: '' };
    logActivity('zone', { zone: id, name: lbl.de, nameID: lbl.id });
  });
  // Vor dem Schließen/Verstecken sofort speichern
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}

load();
if (typeof window !== 'undefined') {
  wire();
  window.__ActivityLog__ = ActivityLog;
}
