// ═══════════════════════════════════════════════════════════════════
// js/ui.js — HUD MANAGER, PAUSE MENU, MOBILE ANALOG
// ═══════════════════════════════════════════════════════════════════

import { Game, registerUpdate } from './main.js';
import { CONFIG, EVENTS }       from './config.js';
import { Player, setInputEnabled, teleportPlayer, requestJump } from './player.js';
import { setMusicVolume, setMusicEnabled }        from './music.js';
import { setSfxVolume, setSfxEnabled, playSfx }   from './sfx.js';
import { migrateSettings }                        from './mainmenu.js';

const UI = {
  // Pause state
  isPauseMenuOpen:   false,
  _pauseOpenedAt:    0,
  isSettingsOpen:    false,
  isHelpOpen:        false,
  confirmingRestart: false,

  // Settings state (synced to localStorage)
  settings: {
    musicVolume:  0.7,     // Hintergrundmusik
    sfxVolume:    0.4,     // Menü-Effekte
    graphicLevel: 'high',  // 'low'|'medium'|'high'
    musicOn:      true,
    sfxOn:        true,
    showHint:     true,
  },

  // Mobile joystick state
  joystick: {
    active:    false,
    pointerId: null,
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
    const raw = localStorage.getItem('lukas_settings');
    // Migration auf dem rohen Stand — sonst überdecken die Defaults
    // das alte gemeinsame 'volume'.
    if (raw) Object.assign(UI.settings, migrateSettings(JSON.parse(raw)));
  } catch (_) {}

  // Wire up pause menu buttons
  setupPauseMenu();

  // Eingabemodus bestimmen (Touch vs. Maus/Tastatur) und überwachen
  initInputMode();

  // Quest-Anzeige einklappbar machen
  setupQuestCollapse();

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
        <label class="setting-label" for="slider-music">
          <span>🎵 Musik</span>
          <span id="music-vol-display" class="setting-value">${Math.round(UI.settings.musicVolume*100)}%</span>
        </label>
        <input type="range" class="setting-slider" id="slider-music"
               min="0" max="100" value="${Math.round(UI.settings.musicVolume*100)}"
               aria-label="Lautstärke der Musik" />
      </div>

      <div class="setting-row">
        <label class="setting-label" for="slider-sfx">
          <span>🔔 Soundeffekte</span>
          <span id="sfx-vol-display" class="setting-value">${Math.round(UI.settings.sfxVolume*100)}%</span>
        </label>
        <input type="range" class="setting-slider" id="slider-sfx"
               min="0" max="100" value="${Math.round(UI.settings.sfxVolume*100)}"
               aria-label="Lautstärke der Soundeffekte" />
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
          <span>🔔 Soundeffekte</span>
          <span class="setting-value">${UI.settings.sfxOn!==false?'An':'Aus'}</span>
        </label>
        <button class="setting-toggle-btn ${UI.settings.sfxOn!==false?'active':''}" id="toggle-sfx">
          ${UI.settings.sfxOn!==false?'An':'Aus'}
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
  document.getElementById('slider-music')?.addEventListener('input', (e) => {
    UI.settings.musicVolume = parseInt(e.target.value) / 100;
    document.getElementById('music-vol-display').textContent = e.target.value + '%';
    applyAudioSettings();
  });

  document.getElementById('slider-sfx')?.addEventListener('input', (e) => {
    UI.settings.sfxVolume = parseInt(e.target.value) / 100;
    document.getElementById('sfx-vol-display').textContent = e.target.value + '%';
    applyAudioSettings();
  });
  document.getElementById('slider-sfx')?.addEventListener('change', () => playSfx('toggle'));

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
    playSfx('toggle');
  });

  // Music toggle
  document.getElementById('toggle-music')?.addEventListener('click', (e) => {
    UI.settings.musicOn = UI.settings.musicOn === false;
    e.target.textContent = UI.settings.musicOn ? 'An' : 'Aus';
    e.target.classList.toggle('active', UI.settings.musicOn);
    applyAudioSettings();
  });

  // SFX toggle
  document.getElementById('toggle-sfx')?.addEventListener('click', (e) => {
    UI.settings.sfxOn = UI.settings.sfxOn === false;
    e.target.textContent = UI.settings.sfxOn ? 'An' : 'Aus';
    e.target.classList.toggle('active', UI.settings.sfxOn);
    applyAudioSettings();
    if (UI.settings.sfxOn) playSfx('toggle');
  });

  // Klick auf den Hintergrund schließt — aber nicht der Klick, der das
  // Menü gerade geöffnet hat (er trifft das neue Overlay, nicht mehr
  // den Knopf darunter).
  overlay.addEventListener('click', (e) => {
    if (e.target !== overlay) return;
    if (performance.now() - UI._pauseOpenedAt < 450) return;
    closePauseMenu();
  });
}

/**
 * Zieht die Regler im Pause-Menü auf den aktuellen UI.settings-Stand nach.
 * Nötig, weil das Hauptmenü dieselben Einstellungen schreiben kann.
 */
function syncSettingsUI() {
  const setSlider = (sliderId, displayId, value) => {
    const pct = Math.round(value * 100);
    const slider = document.getElementById(sliderId);
    if (slider) slider.value = pct;
    const display = document.getElementById(displayId);
    if (display) display.textContent = pct + '%';
  };
  setSlider('slider-music', 'music-vol-display', UI.settings.musicVolume);
  setSlider('slider-sfx',   'sfx-vol-display',   UI.settings.sfxVolume);

  const musicBtn = document.getElementById('toggle-music');
  if (musicBtn) {
    const on = UI.settings.musicOn !== false;
    musicBtn.textContent = on ? 'An' : 'Aus';
    musicBtn.classList.toggle('active', on);
  }

  const sfxBtn = document.getElementById('toggle-sfx');
  if (sfxBtn) {
    const on = UI.settings.sfxOn !== false;
    sfxBtn.textContent = on ? 'An' : 'Aus';
    sfxBtn.classList.toggle('active', on);
  }

  const hintBtn = document.getElementById('toggle-hint');
  if (hintBtn) {
    hintBtn.textContent = UI.settings.showHint ? 'An' : 'Aus';
    hintBtn.classList.toggle('active', !!UI.settings.showHint);
  }

  document.querySelectorAll('[data-gfx]').forEach((b) => {
    b.classList.toggle('active', b.dataset.gfx === UI.settings.graphicLevel);
  });
}

/**
 * Schiebt Lautstärke und An/Aus an die Audio-Module weiter.
 * Effekte laufen bewusst leiser als die Musik.
 */
function applyAudioSettings() {
  setMusicEnabled(UI.settings.musicOn !== false);
  setMusicVolume(UI.settings.musicVolume);
  setSfxEnabled(UI.settings.sfxOn !== false);
  setSfxVolume(UI.settings.sfxVolume);
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
  UI._pauseOpenedAt = performance.now();
  releaseAllInput();

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
  try { localStorage.setItem('lukas_settings', JSON.stringify(UI.settings)); } catch (_) {}
  applyAudioSettings();
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
// QUEST-ANZEIGE EIN-/AUSKLAPPEN
// Auf dem Handy nimmt die Auftragstafel mit Notiz und Checkliste viel
// Platz weg — ein Tipp auf den Pfeil schrumpft alles auf ein Symbol.
// ═══════════════════════════════════════════════════════════════════

const QUEST_COLLAPSE_KEY = 'lukas_quest_collapsed';

function setupQuestCollapse() {
  const tracker = document.getElementById('quest-tracker');
  const toggle  = document.getElementById('quest-collapse');
  if (!tracker || !toggle) return;

  // Auf dem Handy ist die volle Tafel mit Notiz und Checkliste beim
  // ersten Start zugeklappt — sonst deckt sie halb den Schirm zu.
  // Wer sie aufklappt, bekommt sie beim nächsten Mal wieder offen.
  let stored = null;
  try { stored = localStorage.getItem(QUEST_COLLAPSE_KEY); } catch (_) {}

  const smallScreen = window.matchMedia('(max-width: 768px)').matches;
  const collapsed = (stored === null) ? smallScreen : (stored === '1');
  applyQuestCollapse(collapsed);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    applyQuestCollapse(!document.body.classList.contains('hud-collapsed'));
  });

  // Im eingeklappten Zustand öffnet ein Tipp auf die Tafel selbst wieder
  tracker.addEventListener('click', () => {
    if (document.body.classList.contains('hud-collapsed')) applyQuestCollapse(false);
  });
}

function applyQuestCollapse(collapsed) {
  document.body.classList.toggle('hud-collapsed', collapsed);

  const toggle = document.getElementById('quest-collapse');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Auftrag einblenden' : 'Auftrag ausblenden');
    toggle.textContent = collapsed ? '▸' : '▾';
  }

  try { localStorage.setItem(QUEST_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (_) {}
}


// ═══════════════════════════════════════════════════════════════════
// EINGABEMODUS — Touch-Steuerung nur auf echten Touch-Geräten
//
// 'ontouchstart' und maxTouchPoints sind auf Laptops mit Touchscreen
// ebenfalls gesetzt — danach zu gehen blendete den Joystick auf dem
// Desktop ein. Ausschlaggebend ist der PRIMÄRE Zeiger: grob und ohne
// Hover = Handy/Tablet.
// ═══════════════════════════════════════════════════════════════════

const TOUCH_MODE_QUERY = '(pointer: coarse) and (hover: none)';

function initInputMode() {
  const mq = window.matchMedia(TOUCH_MODE_QUERY);
  applyInputMode(mq.matches);

  // Moderne Browser: 'change'; ältere WebKit-Versionen: addListener
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', (e) => applyInputMode(e.matches));
  } else if (typeof mq.addListener === 'function') {
    mq.addListener((e) => applyInputMode(e.matches));
  }

  // Während eines Dialogs liegt die Sprechblase über den Touch-Knöpfen
  // (z-index 70 vs. 55) — sie wären unerreichbar. Also ausblenden und
  // die Bewegung stoppen, solange geredet wird.
  window.addEventListener(EVENTS.DIALOG_OPEN, () => {
    document.body.classList.add('dialog-open');
    releaseAllInput();
  });
  window.addEventListener(EVENTS.DIALOG_CLOSE, () => {
    document.body.classList.remove('dialog-open');
  });

  // Steckengebliebene Eingaben lösen, wenn das Spiel den Fokus verliert
  window.addEventListener('blur', releaseAllInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllInput();
  });
}

function applyInputMode(isTouch) {
  UI.isMobile = isTouch;

  // Sichtbarkeit liegt allein bei CSS (body.input-touch) — sonst
  // gewinnt ein inline gesetztes display gegen jede Media Query.
  document.body.classList.toggle('input-touch', isTouch);
  document.body.classList.toggle('input-pointer', !isTouch);

  const container = document.getElementById('mobile-controls');
  if (container) container.setAttribute('aria-hidden', String(!isTouch));

  if (isTouch) setupTouchControls();
  else         releaseAllInput();
}

/** Alle Bewegungseingaben zurücksetzen — gegen "Lukas läuft weiter". */
function releaseAllInput() {
  Player.input.fwd = Player.input.back = Player.input.left = Player.input.right = 0;
  Player.input.run = false;
  UI.joystick.active  = false;
  UI.joystick.pointerId = null;
  UI.joystick.dx = UI.joystick.dy = 0;
  resetJoystickVisual();
}

function resetJoystickVisual() {
  const base  = document.getElementById('joystick-base');
  const stick = document.getElementById('joystick-stick');
  if (base) {
    base.classList.remove('joystick-active');
    base.style.left = '';
    base.style.top  = '';
  }
  if (stick) {
    stick.style.left = '50%';
    stick.style.top  = '50%';
  }
}


// ═══════════════════════════════════════════════════════════════════
// TOUCH-STEUERUNG — Joystick & Aktionsknöpfe
// ═══════════════════════════════════════════════════════════════════

let touchControlsReady = false;

export function setupTouchControls() {
  if (touchControlsReady) return;          // nur einmal verdrahten
  const zone = document.getElementById('joystick-zone');
  const base  = document.getElementById('joystick-base');
  const stick = document.getElementById('joystick-stick');
  if (!zone || !base || !stick) return;
  touchControlsReady = true;

  const RADIUS = 58;      // maximaler Ausschlag in px
  const DEAD   = 0.14;    // Totzone

  // ── Joystick: reagiert auf die GANZE linke Zone, nicht nur auf den
  //    kleinen Kreis. Vorher musste man den Kreis exakt treffen —
  //    daneben getippt passierte gar nichts.
  zone.addEventListener('pointerdown', (e) => {
    if (UI.joystick.active) return;
    e.preventDefault();

    UI.joystick.active    = true;
    UI.joystick.pointerId = e.pointerId;
    UI.joystick.baseX     = e.clientX;
    UI.joystick.baseY     = e.clientY;

    // Basis unter den Finger legen
    const zRect = zone.getBoundingClientRect();
    const half  = base.offsetWidth / 2;
    base.style.left = (e.clientX - zRect.left - half) + 'px';
    base.style.top  = (e.clientY - zRect.top  - half) + 'px';
    base.classList.add('joystick-active');

    // Folgeereignisse landen sicher hier, auch außerhalb der Zone
    try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    updateStick(e.clientX, e.clientY);
  });

  zone.addEventListener('pointermove', (e) => {
    if (!UI.joystick.active || e.pointerId !== UI.joystick.pointerId) return;
    e.preventDefault();
    updateStick(e.clientX, e.clientY);
  });

  // pointercancel ist der wichtige Teil: ohne ihn blieb die Figur
  // laufen, wenn das System die Berührung abbrach (Anruf, Geste …).
  const endJoystick = (e) => {
    if (e.pointerId !== UI.joystick.pointerId) return;
    releaseAllInput();
  };
  zone.addEventListener('pointerup',     endJoystick);
  zone.addEventListener('pointercancel', endJoystick);
  zone.addEventListener('lostpointercapture', endJoystick);

  function updateStick(cx, cy) {
    const dx = cx - UI.joystick.baseX;
    const dy = cy - UI.joystick.baseY;
    const dist    = Math.hypot(dx, dy);
    const clamped = Math.min(dist, RADIUS);
    const ang     = Math.atan2(dy, dx);

    const ox = Math.cos(ang) * clamped;
    const oy = Math.sin(ang) * clamped;

    stick.style.left = (50 + (ox / RADIUS) * 42) + '%';
    stick.style.top  = (50 + (oy / RADIUS) * 42) + '%';

    UI.joystick.dx = ox / RADIUS;
    UI.joystick.dy = oy / RADIUS;

    const nx = UI.joystick.dx;
    const ny = UI.joystick.dy;
    Player.input.fwd   = ny < -DEAD ? Math.min(1, -ny) : 0;
    Player.input.back  = ny >  DEAD ? Math.min(1,  ny) : 0;
    Player.input.left  = nx < -DEAD ? Math.min(1, -nx) : 0;
    Player.input.right = nx >  DEAD ? Math.min(1,  nx) : 0;
  }

  // ── Aktionsknöpfe ────────────────────────────────────────────
  // Pointer Events statt touchstart/touchend: dieselbe Logik für
  // Finger und Stift, und 'pointercancel' kommt zuverlässig an.
  const onPress = (el, down, up) => {
    if (!el) return;
    let held = false;

    el.addEventListener('pointerdown', (e) => {
      if (held) return;
      e.preventDefault();
      held = true;
      el.classList.add('is-pressed');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      down?.();
    });

    // 'pointerup' und das darauf folgende 'lostpointercapture' feuerten
    // beide — bei einem Umschalter wie Pause hieß das: aufmachen und
    // sofort wieder zu. Das Flag lässt das Loslassen nur einmal durch.
    const release = (e) => {
      if (!held) return;
      held = false;
      el.classList.remove('is-pressed');
      if (e?.pointerId !== undefined) {
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      up?.();
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  };

  onPress(document.getElementById('mobile-jump'), () => {
    requestJump();
  });

  // Rennen: mit Pointer-Capture bleibt es auch dann gedrückt, wenn der
  // Finger vom Knopf rutscht — und wird beim Loslassen sicher beendet.
  onPress(document.getElementById('mobile-run'),
    () => { Player.input.run = true; },
    () => { Player.input.run = false; });

  onPress(document.getElementById('mobile-interact'), () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
  });

  // Beim LOSLASSEN auslösen, nicht beim Drücken: sonst öffnet der
  // Druck das Menü und der Klick danach schließt es wieder.
  onPress(document.getElementById('mobile-pause-btn'), null, () => {
    if (UI.isPauseMenuOpen) closePauseMenu();
    else openPauseMenu();
  });
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

// Meldungen wurden bisher unbegrenzt untereinander gehängt: bei mehreren
// Ereignissen kurz nacheinander wuchs der Stapel über den halben Schirm,
// verdeckte Lukas und fing als klickbare Fläche die Tipps auf die
// Steuerknöpfe ab. Jetzt läuft immer nur eine Meldung, die nächste
// wartet in der Schlange.

const toastQueue = [];
let activeToast  = null;
let toastTimer   = null;

const TOAST_ICONS = { success: '✅', error: '❌', info: '💬', vocab: '📖' };

export function showToast({ title, body = '', type = 'info', icon = '', duration = 3500 }) {
  if (!document.getElementById('toast-container')) return;

  // Gleiche Meldung direkt hintereinander nicht doppelt anzeigen
  const last = toastQueue[toastQueue.length - 1];
  if (last && last.title === title && last.body === body) return;

  toastQueue.push({ title, body, type, icon, duration });
  if (toastQueue.length > 6) toastQueue.splice(0, toastQueue.length - 6);
  if (!activeToast) nextToast();
}

function nextToast() {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const item = toastQueue.shift();
  if (!item) { activeToast = null; return; }

  const toast = document.createElement('div');
  toast.className = `toast toast-${item.type}`;
  toast.innerHTML = `
    <div class="toast-icon">${item.icon || TOAST_ICONS[item.type] || '💬'}</div>
    <div class="toast-copy">
      <div class="toast-title">${item.title}</div>
      ${item.body ? `<div class="toast-body">${item.body}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);
  activeToast = toast;
  // Solange eine Meldung läuft, tritt die Auftragstafel darunter zurück —
  // sonst liegen zwei Kästen übereinander.
  document.body.classList.add('toast-active');

  makeToastSwipeable(toast);

  toastTimer = setTimeout(() => dismissToast(toast), item.duration);
}

function dismissToast(toast, direction = 0) {
  if (!toast || toast._leaving) return;
  toast._leaving = true;
  clearTimeout(toastTimer);

  if (direction) {
    toast.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    toast.style.transform  = `translateX(${direction * 120}%)`;
    toast.style.opacity    = '0';
  } else {
    toast.classList.add('toast-out');
  }

  setTimeout(() => {
    toast.remove();
    if (activeToast === toast) activeToast = null;
    nextToast();          // nächste Meldung nachrücken
    if (!activeToast) document.body.classList.remove('toast-active');
  }, 260);
}

/** Wischen (seitwärts oder nach oben) blendet die Meldung sofort aus. */
function makeToastSwipeable(toast) {
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

  toast.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    dx = dy = 0;
    toast.style.transition = 'none';
    try { toast.setPointerCapture(e.pointerId); } catch (_) {}
  });

  toast.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    toast.style.transform = `translate(${dx}px, ${Math.min(0, dy)}px)`;
    toast.style.opacity   = String(Math.max(0.2, 1 - Math.max(Math.abs(dx), Math.abs(Math.min(0, dy))) / 160));
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) > 60)      dismissToast(toast, Math.sign(dx));
    else if (dy < -50)          dismissToast(toast);
    else {
      toast.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
      toast.style.transform  = '';
      toast.style.opacity    = '';
    }
  };
  toast.addEventListener('pointerup', end);
  toast.addEventListener('pointercancel', end);

  // Antippen blendet ebenfalls aus — praktisch, wenn es schnell gehen soll
  toast.addEventListener('click', () => {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) dismissToast(toast);
  });
}
