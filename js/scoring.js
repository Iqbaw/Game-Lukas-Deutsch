import { CONFIG, EVENTS } from './config.js';
import { showToast } from './ui.js';

export const ScoreSystem = {
  score: 0,
  streak: 0,
  // Rincian untuk panel skor kanan-atas
  stats: { gained: 0, lost: 0, wrong: 0, history: [] },
  restoreStats(saved, total) { restoreScoreStats(saved, total); },
  
  init() {
    this.score = 0;
    this.streak = 0;
    window.__score__ = this.score;
    window.__SCORE_SYSTEM__ = this;

    window.addEventListener(EVENTS.SCORE_ADD, (e) => {
      this.addScore(e.detail.points, e.detail.label);
    });

    window.addEventListener('score:reset_streak', () => {
      this.resetStreak();
    });
  },

  addScore(points, label) {
    if (points === 0) return;

    let finalPoints = points;
    
    // Apply streak multiplier only if adding positive points
    if (points > 0) {
      this.streak++;
      if (this.streak >= 7) finalPoints *= CONFIG.STREAK_7;
      else if (this.streak >= 5) finalPoints *= CONFIG.STREAK_5;
      else if (this.streak >= 3) finalPoints *= CONFIG.STREAK_3;
      
      finalPoints = Math.round(finalPoints);
      
      // Streak notification
      if (this.streak === 3 || this.streak === 5 || this.streak === 7) {
        showToast({
          title: `🔥 ${this.streak}x Combo!`,
          body: `Multiplikator aktiv!`,
          type: 'success'
        });
      }
    }

    this.score += finalPoints;
    window.__score__ = this.score;
    noteScoreChange(finalPoints, label);

    // Update streak UI
    const streakRow = document.getElementById('streak-row');
    const streakVal = document.getElementById('streak-value');
    if (streakRow && streakVal) {
      if (this.streak >= 3) {
        streakRow.classList.remove('hud-hidden');
        streakVal.textContent = `×${this.streak}`;
      } else {
        streakRow.classList.add('hud-hidden');
      }
    }

    if (label && finalPoints > 0) {
      showToast({ title: label, body: `+${finalPoints} Punkte`, type: 'success', duration: 2000 });
    } else if (label && finalPoints < 0) {
      showToast({ title: label, body: `${finalPoints} Punkte`, type: 'error', duration: 2000 });
    }

    this.saveProgress();
  },

  resetStreak() {
    if (this.streak >= 3) {
      showToast({ title: 'Combo gebrochen!', type: 'error', icon: '❄️' });
    }
    this.streak = 0;
    const streakRow = document.getElementById('streak-row');
    if (streakRow) streakRow.classList.add('hud-hidden');
  },

  saveProgress() {
    window.dispatchEvent(new CustomEvent('save:request'));
  },

  loadProgress() {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.version === 2 && Number.isFinite(data.score)) this.score = data.score;
      }
    } catch (e) {
      console.warn("Could not load from localStorage", e);
    }
  }
};


// ═══════════════════════════════════════════════════════════════════
// PANEL SKOR (kanan-atas) — total, poin didapat, poin hilang karena
// jawaban salah, dan beberapa perubahan terakhir.
// Semua sumber poin (dialog.js, quest.js lewat SCORE_ADD) lewat sini.
// ═══════════════════════════════════════════════════════════════════

const HISTORY_MAX = 30;
const HISTORY_SHOWN = 3;

const fmt = (n) => Math.abs(Math.round(n)).toLocaleString('de-DE');

function cleanLabel(label, delta) {
  const t = String(label || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (t) return t;
  return delta < 0 ? 'Falsche Antwort' : 'Punkte';
}

/** Catat satu perubahan skor dan perbarui panel. */
export function noteScoreChange(delta, label = '') {
  if (!delta) return;
  const st = ScoreSystem.stats;
  if (delta > 0) st.gained += delta;
  else { st.lost += -delta; st.wrong += 1; }
  st.history.unshift({ d: delta, l: cleanLabel(label, delta), t: Date.now() });
  if (st.history.length > HISTORY_MAX) st.history.length = HISTORY_MAX;
  renderScorePanel({ delta });
}

export function resetScoreStats() {
  ScoreSystem.stats = { gained: 0, lost: 0, wrong: 0, history: [] };
  renderScorePanel();
}

/** Dari savegame. Save lama tanpa rincian → skornya dihitung sebagai „didapat". */
export function restoreScoreStats(saved, total = 0) {
  const ok = saved && Number.isFinite(saved.gained) && Number.isFinite(saved.lost);
  ScoreSystem.stats = ok ? {
    gained: saved.gained, lost: saved.lost,
    wrong: Number.isFinite(saved.wrong) ? saved.wrong : 0,
    history: Array.isArray(saved.history) ? saved.history.slice(0, HISTORY_MAX) : [],
  } : { gained: Math.max(0, total), lost: Math.max(0, -total), wrong: 0, history: [] };
  renderScorePanel();
}

export function showScorePanel(on = true) {
  document.getElementById('score-display')?.classList.toggle('hud-hidden', !on);
}

export function renderScorePanel({ delta = 0 } = {}) {
  const st = ScoreSystem.stats;
  const total = Number.isFinite(window.__score__) ? window.__score__ : ScoreSystem.score;
  const $ = (id) => document.getElementById(id);

  const valEl = $('score-value');
  if (valEl) {
    valEl.textContent = (total < 0 ? '−' : '') + fmt(total);
    if (delta) {
      valEl.classList.remove('score-bump');
      void valEl.offsetWidth;
      valEl.classList.add('score-bump');
    }
  }
  if ($('score-gained')) $('score-gained').textContent = '+' + fmt(st.gained);
  if ($('score-lost'))   $('score-lost').textContent = (st.lost ? '−' : '') + fmt(st.lost);
  if ($('score-wrong'))  $('score-wrong').textContent = st.wrong === 1 ? '1× falsch' : `${st.wrong}× falsch`;
  $('score-display')?.classList.toggle('has-mistakes', st.lost > 0);

  const list = $('score-history');
  if (list) {
    list.innerHTML = '';
    st.history.slice(0, HISTORY_SHOWN).forEach((h, i) => {
      const li = document.createElement('li');
      li.className = h.d < 0 ? 'sh-minus' : 'sh-plus';
      if (i === 0 && delta) li.classList.add('sh-new');
      const pts = document.createElement('span');
      pts.className = 'sh-pts';
      pts.textContent = (h.d < 0 ? '−' : '+') + fmt(h.d);
      const lbl = document.createElement('span');
      lbl.className = 'sh-lbl';
      lbl.textContent = h.l;
      li.append(pts, lbl);
      list.appendChild(li);
    });
    list.classList.toggle('hud-hidden', st.history.length === 0);
  }

  // Angka melayang (+50 / −10)
  const box = $('score-display');
  if (box && delta) {
    const el = document.createElement('div');
    el.className = `score-delta${delta < 0 ? ' score-delta-negative' : ''}`;
    el.textContent = (delta > 0 ? '+' : '−') + fmt(delta);
    box.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}
