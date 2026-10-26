// ═══════════════════════════════════════════════════════════════════
// js/cloud.js — AKUN & SIMPAN ONLINE (Google Sheets / Apps Script)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Akun tanpa password: siswa cukup mengetik nama. Nama yang sama
// (tanpa beda huruf besar/spasi) = akun yang sama.
//
// Semua panggilan ke Web App Google Apps Script (google-sheets/Code.gs):
// POST text/plain {fn, args} → {ok, data}. Kalau SHEETS_API_URL di config
// kosong, game berjalan dalam mode lokal (akun & progress hanya di browser ini).
//
// Bewusst OHNE Import aus main.js: das Hauptmenü nutzt dieses Modul,
// bevor Three.js geladen ist.
// ═══════════════════════════════════════════════════════════════════

import { CONFIG } from './config.js';

const PLAYER_KEY   = 'lukas_player_v1';
const KNOWN_KEY    = 'lukas_known_players_v1';   // nama → id (untuk login offline)
const QUIZ_PREFIX  = 'lukas_quiz_v1';
// Apps Script verträgt keine Flut: ±40 Schüler gleichzeitig → höchstens
// alle 30 s ein Spielstand pro Schüler (sofort bei Quest-Ende / Schließen).
const SAVE_THROTTLE_MS = 30000;
const DRAFT_DEBOUNCE_MS = 3000;
const RETRY_MS         = 20000;

const API_URL = String(CONFIG.SHEETS_API_URL || '').trim();

// Wie im Server (Code.gs): mit einem Buchstaben beginnen, 2–40 Zeichen.
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]{1,39}$/u;

export const Cloud = {
  player:      null,     // { id, name, key, local }
  pendingSave: null,     // snapshot yang belum terkirim
  syncing:     false,
  lastSyncAt:  0,
  lastError:   null,
};

let saveTimer  = null;
let retryTimer = null;


// ── Dasar ─────────────────────────────────────────────────────────

export function cloudEnabled() {
  return !!API_URL;
}

export function nameKey(name) {
  return cleanName(name).toLowerCase();
}

export function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

/** Panggil fungsi di Apps Script. Melempar Error { status, code } bila gagal. */
export async function rpc(fn, args = {}, { keepalive = false } = {}) {
  if (!cloudEnabled()) throw Object.assign(new Error('cloud_disabled'), { code: 'cloud_disabled' });
  // text/plain = „simple request“: kein CORS-Preflight, den Apps Script nicht beantworten kann
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn, args }),
    redirect: 'follow',
    keepalive,
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
  if (!res.ok || !body || body.ok !== true) {
    const err = new Error(body?.error?.message || res.statusText || 'request_failed');
    err.status = res.ok ? 400 : res.status;
    err.code = body?.error?.code || null;
    throw err;
  }
  return body.data;
}


// ── Pemain ────────────────────────────────────────────────────────

export function currentPlayer() {
  if (Cloud.player) return Cloud.player;
  const p = readJSON(PLAYER_KEY);
  if (p && p.id && p.name && p.key) Cloud.player = p;
  return Cloud.player;
}

/** Kunci localStorage khusus pemain (komputer lab dipakai bergantian). */
export function playerStorageKey(base) {
  const p = currentPlayer();
  return p ? `${base}:${p.key}` : base;
}

/**
 * Masuk dengan nama. Mengembalikan { player, isNew, offline }.
 * Progress online & lokal dicocokkan: yang lebih baru dipakai.
 */
export async function login(rawName) {
  const name = cleanName(rawName);
  const key = nameKey(name);
  if (!NAME_RE.test(name)) {
    throw Object.assign(new Error('invalid_name'), { code: 'invalid_name' });
  }

  if (!cloudEnabled()) {
    const known = readJSON(KNOWN_KEY, {});
    const isNew = !known[key];
    const player = { id: known[key]?.id || `local:${key}`, name: known[key]?.name || name, key, local: true };
    known[key] = { id: player.id, name: player.name };
    writeJSON(KNOWN_KEY, known);
    setPlayer(player);
    if (isNew) adoptLegacySave(player);
    return { player, isNew, offline: false };
  }

  let res;
  try {
    res = await rpc('player_login', { p_name: name });
  } catch (err) {
    // Tanpa internet: pemain yang pernah masuk di perangkat ini tetap bisa lanjut
    const known = readJSON(KNOWN_KEY, {})[key];
    if (known && (err.status === undefined || err.status >= 500)) {
      const player = { id: known.id, name: known.name, key, local: false };
      setPlayer(player);
      return { player, isNew: false, offline: true };
    }
    throw err;
  }

  const player = { id: res.id, name: res.name, key, local: false };
  const known = readJSON(KNOWN_KEY, {});
  known[key] = { id: player.id, name: player.name };
  writeJSON(KNOWN_KEY, known);
  setPlayer(player);

  reconcileSave(res.save, Number(res.progressResetAt) || 0);
  reconcileQuiz(res.quiz, Number(res.quizResetAt) || 0);
  if (res.isNew) adoptLegacySave(player);
  return { player, isNew: !!res.isNew, offline: false };
}

export function logout() {
  flushSave();
  Cloud.player = null;
  Cloud.pendingSave = null;
  writeJSON(PLAYER_KEY, null);
  window.dispatchEvent(new CustomEvent('player:change', { detail: { player: null } }));
}

function setPlayer(player) {
  Cloud.player = player;
  writeJSON(PLAYER_KEY, player);
  window.dispatchEvent(new CustomEvent('player:change', { detail: { player } }));
}


// ── Progress game ─────────────────────────────────────────────────

function saveKey() {
  return playerStorageKey(CONFIG.STORAGE_KEY);
}

function reconcileSave(remote, resetAt) {
  const local = readJSON(saveKey());
  if (local && (Number(local.savedAt) || 0) < resetAt) writeJSON(saveKey(), null);
  const fresh = readJSON(saveKey());
  const remoteAt = Number(remote?.savedAt) || 0;
  const localAt = Number(fresh?.savedAt) || 0;
  if (remote && remoteAt >= localAt) writeJSON(saveKey(), remote);
  else if (fresh && localAt > remoteAt) queueSave(fresh, { now: true });
}

/** Save dari sebelum ada akun (kunci lama tanpa nama) → milik pemain baru. */
function adoptLegacySave(player) {
  if (readJSON(saveKey())) return;
  const legacy = readJSON(CONFIG.STORAGE_KEY);
  if (!legacy) return;
  writeJSON(saveKey(), legacy);
  writeJSON(CONFIG.STORAGE_KEY, null);
  if (!player.local) queueSave(legacy, { now: true });
}

/** Kirim snapshot ke server (dibatasi tiap 30 s). `now` = segera. */
export function queueSave(data, { now = false } = {}) {
  const p = currentPlayer();
  if (!p || p.local || !cloudEnabled() || !data) return;
  Cloud.pendingSave = data;
  // Drosseln statt entprellen: das Autosave läuft alle 5 s und würde einen
  // Debounce-Timer sonst nie ablaufen lassen.
  if (saveTimer && !now) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; sendSave(); }, now ? 0 : SAVE_THROTTLE_MS);
}

async function sendSave({ keepalive = false } = {}) {
  const p = currentPlayer();
  const data = Cloud.pendingSave;
  if (!p || p.local || !data || (Cloud.syncing && !keepalive)) return;
  Cloud.syncing = true;
  try {
    await rpc('save_progress', { p_id: p.id, p_data: data }, { keepalive });
    if (Cloud.pendingSave === data) Cloud.pendingSave = null;
    Cloud.lastSyncAt = Date.now();
    Cloud.lastError = null;
    window.dispatchEvent(new CustomEvent('cloud:saved', { detail: { at: Cloud.lastSyncAt } }));
  } catch (err) {
    Cloud.lastError = err;
    scheduleRetry();
  } finally {
    Cloud.syncing = false;
  }
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (Cloud.pendingSave) sendSave(); }, RETRY_MS);
}

/** Segera kirim yang tertunda (dipakai saat halaman ditutup). */
export function flushSave() {
  if (!Cloud.pendingSave) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  sendSave({ keepalive: true });
}


// ── Latihan Soal ──────────────────────────────────────────────────

function quizKey() {
  return playerStorageKey(QUIZ_PREFIX);
}

/** { answers: {"1": 3, ...}, current, savedAt, submitted, pendingSubmit } */
export function readQuizState() {
  const s = readJSON(quizKey());
  return s && typeof s === 'object'
    ? { answers: {}, current: 0, savedAt: 0, submitted: false, pendingSubmit: false, ...s }
    : { answers: {}, current: 0, savedAt: 0, submitted: false, pendingSubmit: false };
}

export function writeQuizState(state) {
  writeJSON(quizKey(), { ...state, savedAt: Date.now() });
}

export function isQuizSubmitted() {
  return !!readQuizState().submitted;
}

function reconcileQuiz(remote, resetAt) {
  const local = readQuizState();
  if (!remote) {
    // Direset admin → draft lama di perangkat ini dibuang
    if (local.savedAt && local.savedAt < resetAt) writeJSON(quizKey(), null);
    return;
  }
  if (remote.status === 'submitted') {
    writeQuizState({ ...local, answers: remote.answers || local.answers, submitted: true, pendingSubmit: false });
    return;
  }
  const localCount = Object.keys(local.answers || {}).length;
  const remoteCount = Object.keys(remote.answers || {}).length;
  if (!local.submitted && remoteCount > localCount) {
    writeQuizState({ ...local, answers: remote.answers });
  }
}

let draftTimer = null;
export function queueQuizDraft(answers) {
  const p = currentPlayer();
  if (!p || p.local || !cloudEnabled()) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    rpc('quiz_save_draft', { p_id: p.id, p_answers: answers }).catch(() => {});
  }, DRAFT_DEBOUNCE_MS);
}

/** Kirim jawaban final. Nilai TIDAK dikembalikan. Melempar Error bila gagal. */
export async function submitQuiz(answers) {
  clearTimeout(draftTimer);
  const p = currentPlayer();
  const state = readQuizState();
  writeQuizState({ ...state, answers, pendingSubmit: true });
  if (p && !p.local && cloudEnabled()) {
    await rpc('quiz_submit', { p_id: p.id, p_answers: answers });
  }
  writeQuizState({ ...readQuizState(), answers, submitted: true, pendingSubmit: false });
  window.dispatchEvent(new CustomEvent('quiz:submitted'));
  return true;
}


// ── Admin ─────────────────────────────────────────────────────────

export function adminRpc(fn, password, args = {}) {
  return rpc(fn, { p_pass: password, ...args });
}


// ── Lebenszyklus ──────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('online', () => { if (Cloud.pendingSave) sendSave(); });
  window.__Cloud__ = Cloud;
}
