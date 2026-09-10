import { CONFIG } from './config.js';

const VERSION = 2;
let enabled = false;
let timer = null;
let interval = null;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || 'null');
    if (!data || data.version !== VERSION || !data.zone || !data.questState) return null;
    if (!data.player || !Number.isFinite(data.player.x) || !Number.isFinite(data.player.z)) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (_) {}
}

export function saveNow() {
  if (!enabled || !window.__GAME__?.isRunning || !window.__QUEST_SYSTEM__) return false;
  const player = window.__PLAYER__;
  const quest = window.__QUEST_SYSTEM__;
  if (!player?.group || !window.__currentZoneId__) return false;

  const data = {
    version: VERSION,
    savedAt: Date.now(),
    zone: window.__currentZoneId__,
    cityVariant: window.__stadtVariant__ || null,
    player: {
      x: finite(player.position.x),
      z: finite(player.position.z),
      facing: finite(player.facing),
    },
    score: finite(window.__score__),
    streak: finite(window.__SCORE_SYSTEM__?.streak),
    questState: { ...(window.__questState__ || {}) },
    activeQuestId: quest.activeQuestId || null,
    activeStep: Math.max(0, finite(quest.activeStep)),
    currentState: quest.currentState || 'IDLE',
    collectedItems: Array.from(quest.collectedItems || []),
    lastRoom: quest.lastRoom || null,
  };

  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('save:complete', { detail: { savedAt: data.savedAt } }));
    return true;
  } catch (error) {
    console.warn('[savegame] Autosave unavailable', error);
    return false;
  }
}

export function scheduleSave() {
  if (!enabled) return;
  clearTimeout(timer);
  timer = setTimeout(saveNow, 80);
}

export function enableAutosave() {
  if (enabled) return;
  enabled = true;
  const events = ['zone:enter', 'quest:start', 'quest:progress', 'quest:complete', 'score:add', 'item:collect'];
  events.forEach(name => window.addEventListener(name, scheduleSave));
  window.addEventListener('save:request', scheduleSave);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  interval = setInterval(saveNow, 5000);
}

export function disableAutosave() {
  enabled = false;
  clearTimeout(timer);
  clearInterval(interval);
  timer = null;
  interval = null;
}

export async function restoreSave(data, { loadZone, teleportPlayer, QuestSystem, ScoreSystem }) {
  if (!data) return false;
  window.__questState__ = { ...data.questState };
  window.__stadtVariant__ = data.cityVariant || undefined;

  await loadZone(data.zone, {
    x: data.player.x,
    z: data.player.z,
    facing: finite(data.player.facing),
  }, true);
  teleportPlayer(data.player.x, data.player.z, finite(data.player.facing));

  ScoreSystem.score = finite(data.score);
  ScoreSystem.streak = Math.max(0, finite(data.streak));
  window.__score__ = ScoreSystem.score;
  const scoreEl = document.getElementById('score-value');
  if (scoreEl) scoreEl.textContent = String(ScoreSystem.score);
  const streakRow = document.getElementById('streak-row');
  const streakValue = document.getElementById('streak-value');
  if (streakRow && streakValue && ScoreSystem.streak >= 3) {
    streakRow.classList.remove('hud-hidden');
    streakValue.textContent = `×${ScoreSystem.streak}`;
  }
  QuestSystem.restoreProgress(data);
  return true;
}
