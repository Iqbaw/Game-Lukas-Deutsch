// ═══════════════════════════════════════════════════════════════════
// js/ui.js — HUD MANAGER, PAUSE MENU, MOBILE ANALOG
// ═══════════════════════════════════════════════════════════════════

import { Game, registerUpdate } from './main.js';
import { CONFIG, EVENTS }       from './config.js';
import { Player, setInputEnabled, teleportPlayer } from './player.js';

const UI = {
  // Pause state
  isPauseMenuOpen:   false,
  isSettingsOpen:    false,
  isHelpOpen:        false,
  confirmingRestart: false,

  // Settings state (synced to localStorage)
  settings: {
    volume:       0.7,
    graphicLevel: 'high',  // 'low'|'medium'|'high'
    showHint:     true,
  },

  // Mobile joystick state
  joystick: {
    active:  false,
    touchId: null,
    baseX:   0,   baseY:   0,
    currX:   0,   currY:   0,
    dx:      0,   dy:      0,   // normalized -1..1
  },
  isMobile: false,

  updateObjective: (text) => {
    const tracker = document.getElementById('quest-tracker');
    const nameEl = document.getElementById('quest-name');
    if (tracker && nameEl) {
      nameEl.textContent = text;
      tracker.classList.remove('hud-hidden');
    }
  }
};

export { UI };


// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function initUI() {
  // Load settings dari localStorage
  try {
    const saved = localStorage.getItem('lukas_settings');
    if (saved) Object.assign(UI.settings, JSON.parse(saved));
  } catch (_) {}

  // Detect mobile
  UI.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Wire up pause menu buttons
  setupPauseMenu();

  // Setup mobile controls
  if (UI.isMobile) setupMobileControls();
  // Juga tampilkan di desktop kalau ada touch screen
  if (window.matchMedia('(pointer: coarse)').matches) setupMobileControls();

  // ESC toggle pause — nicht, solange das Hauptmenü offen ist
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (document.body.classList.contains('main-menu-open')) return;
      if (UI.isPauseMenuOpen) closePauseMenu();
      else openPauseMenu();
    }
  });

  // Einstellungen aus dem Hauptmenü übernehmen (js/mainmenu.js)
  window.addEventListener('settings:change', (e) => {
    if (!e.detail || e.detail.source !== 'mainmenu') return;
    const { source, ...incoming } = e.detail;
    Object.assign(UI.settings, incoming);
    syncSettingsUI();
    applyGraphicQuality(UI.settings.graphicLevel);
  });

  // Listen event dari main.js pause/resume
  window.addEventListener(EVENTS.GAME_PAUSE,  openPauseMenu);
  window.addEventListener(EVENTS.GAME_RESUME, closePauseMenu);

  // Daftar update untuk HUD
  registerUpdate(updateHUD);
}


// ═══════════════════════════════════════════════════════════════════
// PAUSE MENU
// ═══════════════════════════════════════════════════════════════════

function setupPauseMenu() {
  const overlay = document.getElementById('pause-menu');
  if (!overlay) return;

  // Render konten pause menu yang lengkap
  overlay.innerHTML = `
    <div class="pause-card" id="pause-card-main">
      <div class="pause-logo">
        <div class="pause-logo-icon">▶</div>
        <div>
          <h2 class="pause-title">Pause</h2>
          <p class="pause-subtitle">Lukas Abenteuer</p>
        </div>
      </div>

      <div class="pause-buttons">
        <button class="pause-btn pause-btn-primary" id="btn-resume">
          <span class="pause-btn-icon">▶</span> Weiterspielen
        </button>
        <button class="pause-btn" id="btn-settings">
          <span class="pause-btn-icon">⚙</span> Einstellungen
        </button>
        <button class="pause-btn" id="btn-help">
          <span class="pause-btn-icon">?</span> Steuerung / Hilfe
        </button>
        <button class="pause-btn pause-btn-danger" id="btn-restart">
          <span class="pause-btn-icon">↺</span> Neu starten
        </button>
      </div>

      <p class="pause-hint">Drücke <kbd>ESC</kbd> um fortzufahren</p>
    </div>

    <!-- Settings Panel -->
    <div class="pause-card pause-sub-card" id="pause-card-settings" style="display:none">
      <button class="pause-back-btn" id="btn-settings-back">← Zurück</button>
      <h3 class="pause-sub-title">Einstellungen</h3>

      <div class="setting-row">
        <label class="setting-label">
          <span>🔊 Lautstärke</span>
          <span id="vol-display" class="setting-value">${Math.round(UI.settings.volume*100)}%</span>
        </label>
        <input type="range" class="setting-slider" id="slider-volume"
               min="0" max="100" value="${Math.round(UI.settings.volume*100)}" />
      </div>

      <div class="setting-row">
        <label class="setting-label">
          <span>🎮 Grafik</span>
          <span class="setting-value">${UI.settings.graphicLevel}</span>
        </label>
        <div class="setting-btn-group">
          <button class="setting-opt-btn ${UI.settings.graphicLevel==='low'?'active':''}"    data-gfx="low">Niedrig</button>
          <button class="setting-opt-btn ${UI.settings.graphicLevel==='medium'?'active':''}" data-gfx="medium">Mittel</button>
          <button class="setting-opt-btn ${UI.settings.graphicLevel==='high'?'active':''}"   data-gfx="high">Hoch</button>
        </div>
      </div>

      <div class="setting-row">
        <label class="setting-label">
          <span>🎵 Musik</span>
          <span class="setting-value">${UI.settings.musicOn!==false?'An':'Aus'}</span>
        </label>
        <button class="setting-toggle-btn ${UI.settings.musicOn!==false?'active':''}" id="toggle-music">
          ${UI.settings.musicOn!==false?'An':'Aus'}
        </button>
      </div>

      <div class="setting-row">
        <label class="setting-label">
          <span>💡 Hinweise zeigen</span>
          <span class="setting-value">${UI.settings.showHint?'An':'Aus'}</span>
        </label>
        <button class="setting-toggle-btn ${UI.settings.showHint?'active':''}" id="toggle-hint">
          ${UI.settings.showHint?'An':'Aus'}
        </button>
      </div>

      <button class="pause-btn pause-btn-primary" id="btn-settings-save" style="margin-top:24px">
        Speichern ✓
      </button>
    </div>

    <!-- Help Panel -->
    <div class="pause-card pause-sub-card" id="pause-card-help" style="display:none">
      <button class="pause-back-btn" id="btn-help-back">← Zurück</button>
      <h3 class="pause-sub-title">Steuerung & Hilfe</h3>

      <div class="help-grid">
        <div class="help-section">
          <h4 class="help-section-title">🎮 Bewegung</h4>
          <div class="help-row"><kbd>W A S D</kbd><span>Laufen / Gehen</span></div>
          <div class="help-row"><kbd>Shift</kbd><span>Rennen</span></div>
          <div class="help-row"><kbd>Space</kbd><span>Springen</span></div>
          <div class="help-row"><kbd>↑ ↓ ← →</kbd><span>Alternativ bewegen</span></div>
        </div>
        <div class="help-section">
          <h4 class="help-section-title">📷 Kamera</h4>
          <div class="help-row"><span>🖱 Rechtsklick + Drag</span><span>Kamera drehen</span></div>
          <div class="help-row"><span>🖱 Scrollrad</span><span>Zoom</span></div>
        </div>
        <div class="help-section">
          <h4 class="help-section-title">💬 Interaktion</h4>
          <div class="help-row"><kbd>E</kbd><span>Mit NPC sprechen</span></div>
          <div class="help-row"><kbd>Tab</kbd><span>Reisetagebuch</span></div>
          <div class="help-row"><kbd>ESC</kbd><span>Pause / Weiter</span></div>
        </div>
        <div class="help-section">
          <h4 class="help-section-title">📚 Lerntipps</h4>
          <div class="help-tip">Klicke auf gelb unterstrichene Wörter, um die Übersetzung zu sehen.</div>
          <div class="help-tip">Antworte beim ersten Versuch für mehr Punkte!</div>
          <div class="help-tip">3 richtige Antworten = 🔥 Combo-Streak!</div>
        </div>
      </div>

      <div class="help-about">
        <p>Lukas Abenteuer — Willkommen in Hamburg!</p>
        <p class="help-credit">Lernspiel basierend auf Skripsi von Yemima · CTL-Ansatz</p>
      </div>
    </div>

    <!-- Restart Confirm -->
    <div class="pause-card pause-sub-card" id="pause-card-confirm" style="display:none">
      <div class="confirm-icon">↺</div>
      <h3 class="pause-sub-title">Wirklich neu starten?</h3>
      <p class="confirm-body">Dein Fortschritt in dieser Sitzung geht verloren.<br>Gespeicherte Punkte bleiben erhalten.</p>
      <div class="confirm-buttons">
        <button class="pause-btn pause-btn-danger" id="btn-confirm-yes">Ja, neu starten</button>
        <button class="pause-btn" id="btn-confirm-no">Abbrechen</button>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-resume')?.addEventListener('click', closePauseMenu);

  document.getElementById('btn-settings')?.addEventListener('click', () => showSubPanel('settings'));
  document.getElementById('btn-settings-back')?.addEventListener('click', () => showSubPanel('main'));
  document.getElementById('btn-settings-save')?.addEventListener('click', saveSettings);

  document.getElementById('btn-help')?.addEventListener('click', () => showSubPanel('help'));
  document.getElementById('btn-help-back')?.addEventListener('click', () => showSubPanel('main'));

  document.getElementById('btn-restart')?.addEventListener('click', () => showSubPanel('confirm'));
  document.getElementById('btn-confirm-no')?.addEventListener('click', () => showSubPanel('main'));
  document.getElementById('btn-confirm-yes')?.addEventListener('click', restartGame);

  // Volume slider live preview
  document.getElementById('slider-volume')?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value) / 100;
    document.getElementById('vol-display').textContent = e.target.value + '%';
    UI.settings.volume = v;
    
    // Update audio element if present
    const audioEl = document.getElementById('bgm');
    if (audioEl) audioEl.volume = v;
  });

  // Graphic quality buttons
  document.querySelectorAll('[data-gfx]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-gfx]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      UI.settings.graphicLevel = btn.dataset.gfx;
      applyGraphicQuality(btn.dataset.gfx);
    });
  });

  // Hint toggle
  document.getElementById('toggle-hint')?.addEventListener('click', (e) => {
    UI.settings.showHint = !UI.settings.showHint;
    e.target.textContent = UI.settings.showHint ? 'An' : 'Aus';
    e.target.classList.toggle('active', UI.settings.showHint);
  });

  // Music toggle
  document.getElementById('toggle-music')?.addEventListener('click', (e) => {
    UI.settings.musicOn = UI.settings.musicOn !== false ? false : true;
    e.target.textContent = UI.settings.musicOn ? 'An' : 'Aus';
    e.target.classList.toggle('active', UI.settings.musicOn);
    
    // Toggle audio
    const audioEl = document.getElementById('bgm');
    if (audioEl) {
      if (UI.settings.musicOn) {
        audioEl.play().catch(e=>console.warn("Audio play blocked",e));
      } else {
        audioEl.pause();
      }
    }
  });

  // Click backdrop to resume
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePauseMenu();
  });
}

/**
 * Zieht die Regler im Pause-Menü auf den aktuellen UI.settings-Stand nach.
 * Nötig, weil das Hauptmenü dieselben Einstellungen schreiben kann.
 */
function syncSettingsUI() {
  const vol = Math.round(UI.settings.volume * 100);

  const slider = document.getElementById('slider-volume');
  if (slider) slider.value = vol;
  const volDisplay = document.getElementById('vol-display');
  if (volDisplay) volDisplay.textContent = vol + '%';

  const musicBtn = document.getElementById('toggle-music');
  if (musicBtn) {
    const on = UI.settings.musicOn !== false;
    musicBtn.textContent = on ? 'An' : 'Aus';
    musicBtn.classList.toggle('active', on);
  }

  const hintBtn = document.getElementById('toggle-hint');
  if (hintBtn) {
    hintBtn.textContent = UI.settings.showHint ? 'An' : 'Aus';
    hintBtn.classList.toggle('active', !!UI.settings.showHint);
  }

  document.querySelectorAll('[data-gfx]').forEach((b) => {
    b.classList.toggle('active', b.dataset.gfx === UI.settings.graphicLevel);
  });

  const audioEl = document.getElementById('bgm');
  if (audioEl) audioEl.volume = UI.settings.musicOn === false ? 0 : UI.settings.volume;
}

function showSubPanel(panel) {
  const cards = ['main', 'settings', 'help', 'confirm'];
  cards.forEach(p => {
    const el = document.getElementById(`pause-card-${p}`);
    if (el) el.style.display = (p === panel) ? 'flex' : 'none';
  });
}

export function openPauseMenu() {
  if (UI.isPauseMenuOpen) return;
  UI.isPauseMenuOpen = true;

  const overlay = document.getElementById('pause-menu');
  if (!overlay) return;
  showSubPanel('main');
  overlay.classList.remove('hud-hidden');
  overlay.classList.add('pause-active');

  // Stop game (tapi jangan dispatch event lagi untuk hindari loop)
  if (!Game.isPaused) {
    Game.isPaused = true;
    Game.clock?.stop();
  }
  setInputEnabled(false);

  // Animasi GSAP
  if (window.gsap) {
    gsap.from('#pause-card-main', {
      opacity: 0, scale: 0.9, duration: 0.3, ease: 'back.out(1.5)'
    });
  }
}

export function closePauseMenu() {
  if (!UI.isPauseMenuOpen) return;
  UI.isPauseMenuOpen = false;

  const overlay = document.getElementById('pause-menu');
  if (!overlay) return;

  const finish = () => {
    overlay.classList.add('hud-hidden');
    overlay.classList.remove('pause-active');
    if (Game.isPaused) {
      Game.isPaused = false;
      Game.clock?.start();
    }
    setInputEnabled(true);
    window.dispatchEvent(new CustomEvent(EVENTS.GAME_RESUME));
  };

  if (window.gsap) {
    gsap.to('#pause-card-main', {
      opacity: 0, scale: 0.9, duration: 0.2, ease: 'power2.in', onComplete: finish
    });
  } else {
    finish();
  }
}

function saveSettings() {
  UI.settings.volume = parseInt(document.getElementById('slider-volume')?.value || 70) / 100;
  try { localStorage.setItem('lukas_settings', JSON.stringify(UI.settings)); } catch (_) {}
  if (window.Howler) window.Howler.volume(UI.settings.volume);
  applyGraphicQuality(UI.settings.graphicLevel);
  // Flash success
  const btn = document.getElementById('btn-settings-save');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Gespeichert!';
    btn.style.background = '#5dc26b';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
  }
}

function applyGraphicQuality(level) {
  if (!Game.renderer) return;
  const ratios = { low: 0.5, medium: 1.0, high: Math.min(window.devicePixelRatio, 2) };
  Game.renderer.setPixelRatio(ratios[level] || 1.0);
  if (Game.composer) {
    Game.composer.passes.forEach(pass => {
      if (pass.constructor.name === 'UnrealBloomPass') {
        pass.strength = level === 'low' ? 0 : (level === 'medium' ? 0.15 : CONFIG.BLOOM_STRENGTH);
      }
    });
  }
}

function restartGame() {
  closePauseMenu();
  // Teleport Lukas ke spawn dan reset score
  teleportPlayer(0, 4, Math.PI);
  window.location.reload(); // Simple: reload halaman
}


// ═══════════════════════════════════════════════════════════════════
// MOBILE ANALOG JOYSTICK
// ═══════════════════════════════════════════════════════════════════

function setupMobileControls() {
  const container = document.getElementById('mobile-controls');
  if (!container) return;

  container.style.display = 'flex';
  container.setAttribute('aria-hidden', 'false');

  const stick    = document.getElementById('joystick-stick');
  const base     = document.getElementById('joystick-base');
  const jumpBtn  = document.getElementById('mobile-jump');
  const runBtn   = document.getElementById('mobile-run');
  const interBtn = document.getElementById('mobile-interact');
  const pauseBtn = document.getElementById('mobile-pause-btn');

  if (!stick || !base) return;

  const RADIUS = 55;  // maksimal jarak stick dari tengah

  function getBaseCenter() {
    const rect = base.getBoundingClientRect();
    return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  }

  base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    UI.joystick.touchId = touch.identifier;
    UI.joystick.active = true;
    UI.joystick.baseX = touch.clientX;
    UI.joystick.baseY = touch.clientY;

    // Reposisi base ke titik touch
    const cRect = container.getBoundingClientRect();
    base.style.left = (touch.clientX - cRect.left - 60) + 'px';
    base.style.top  = (touch.clientY - cRect.top  - 60) + 'px';
    base.classList.add('joystick-active');
    updateStickPos(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!UI.joystick.active) return;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === UI.joystick.touchId);
    if (!touch) return;
    e.preventDefault();
    updateStickPos(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    const touch = Array.from(e.changedTouches).find(t => t.identifier === UI.joystick.touchId);
    if (!touch) return;
    UI.joystick.active = false;
    UI.joystick.touchId = null;
    UI.joystick.dx = 0;
    UI.joystick.dy = 0;
    stick.style.transform = 'translate(-50%, -50%)';
    stick.style.left = '50%';
    stick.style.top  = '50%';
    base.classList.remove('joystick-active');

    // Reset player input
    Player.input.fwd = Player.input.back = Player.input.left = Player.input.right = 0;
  });

  function updateStickPos(cx, cy) {
    const bx = UI.joystick.baseX;
    const by = UI.joystick.baseY;
    let dx = cx - bx;
    let dy = cy - by;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, RADIUS);
    const ang = Math.atan2(dy, dx);

    const ox = Math.cos(ang) * clamped;
    const oy = Math.sin(ang) * clamped;

    // Tampilkan stick visual (relative ke base)
    stick.style.left = (50 + (ox/RADIUS)*45) + '%';
    stick.style.top  = (50 + (oy/RADIUS)*45) + '%';

    // Normalized input (-1..1)
    UI.joystick.dx = ox / RADIUS;
    UI.joystick.dy = oy / RADIUS;

    // Map ke Player input berdasarkan kamera yaw
    // (import dinamis untuk hindari circular dep saat file load)
    const DEAD = 0.15;
    const absX = Math.abs(UI.joystick.dx);
    const absY = Math.abs(UI.joystick.dy);

    // fwd/back dari Y (atas joystick = maju)
    Player.input.fwd  = absY > DEAD && UI.joystick.dy < 0 ? Math.min(1, -UI.joystick.dy) : 0;
    Player.input.back = absY > DEAD && UI.joystick.dy > 0 ? Math.min(1,  UI.joystick.dy) : 0;
    Player.input.left  = absX > DEAD && UI.joystick.dx < 0 ? Math.min(1, -UI.joystick.dx) : 0;
    Player.input.right = absX > DEAD && UI.joystick.dx > 0 ? Math.min(1,  UI.joystick.dx) : 0;
  }

  // Action buttons
  if (jumpBtn) {
    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!Player.isJumping) {
        Player.isJumping    = true;
        Player.jumpVelocity = 7.0;
      }
    });
  }

  if (runBtn) {
    runBtn.addEventListener('touchstart', (e) => { e.preventDefault(); Player.input.run = true; });
    runBtn.addEventListener('touchend',   (e) => { e.preventDefault(); Player.input.run = false; });
  }

  if (interBtn) {
    interBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (UI.isPauseMenuOpen) closePauseMenu();
      else openPauseMenu();
    });
  }
}


// ═══════════════════════════════════════════════════════════════════
// HUD UPDATES
// ═══════════════════════════════════════════════════════════════════

function updateHUD(delta, elapsed) {
  // Update score display
  // (score.js akan set window.__score__ untuk dibaca di sini)
  const scoreEl = document.getElementById('score-value');
  if (scoreEl && window.__score__ !== undefined) {
    scoreEl.textContent = window.__score__;
  }
}


// ═══════════════════════════════════════════════════════════════════
// TOAST NOTIFIKASI
// ═══════════════════════════════════════════════════════════════════

export function showToast({ title, body='', type='info', icon='', duration=3500 }) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = { success: '✅', error: '❌', info: '💬', vocab: '📖' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon || iconMap[type] || '💬'}</div>
    <div>
      <div class="toast-title">${title}</div>
      ${body ? `<div class="toast-body">${body}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}
