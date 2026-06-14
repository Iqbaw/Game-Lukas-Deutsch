import { CONFIG, EVENTS } from './config.js';
import { showToast } from './ui.js';

export const ScoreSystem = {
  score: 0,
  streak: 0,
  
  init() {
    this.loadProgress();
    window.__score__ = this.score;

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

    // Dispatch a generic UI update for score
    const scoreEl = document.getElementById('score-value');
    if (scoreEl) {
      scoreEl.textContent = this.score;
      scoreEl.classList.add('score-bump');
      setTimeout(() => scoreEl.classList.remove('score-bump'), 500);
      
      // Show delta
      const scoreContainer = document.getElementById('score-display');
      if (scoreContainer) {
        const deltaEl = document.createElement('div');
        deltaEl.className = `score-delta${finalPoints < 0 ? ' score-delta-negative' : ''}`;
        deltaEl.textContent = (finalPoints > 0 ? '+' : '') + finalPoints;
        scoreContainer.appendChild(deltaEl);
        setTimeout(() => deltaEl.remove(), 1300);
      }
    }

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
    const data = {
      score: this.score,
      questState: window.__questState__ || {}
    };
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  },

  loadProgress() {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.score) this.score = data.score;
        // JANGAN restore questState dari localStorage — setiap sesi game harus mulai fresh.
        // Quest state hanya dipersist untuk live save, BUKAN antar-sesi.
        // (Educational game: pemain mulai dari awal tiap kali buka)
        // Old behavior: if (data.questState) window.__questState__ = data.questState;
      }
    } catch (e) {
      console.warn("Could not load from localStorage", e);
    }
  }
};
