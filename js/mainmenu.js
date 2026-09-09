// ═══════════════════════════════════════════════════════════════════
// js/mainmenu.js — HAUPTMENÜ (Main Menu)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Cozy-Countryside-Menü im Konsolen-Stil:
//   - Vollbild-Kulisse (assets/images/main-menu-bg.webp, cover)
//   - Logo oben links, cremefarbenes Panel darunter
//   - Sage-grüne Pill wandert zur aktiven Auswahl
//   - Tastatur: ↑ ↓ zum Wählen, Enter zum Bestätigen, ESC = zurück
//
// Bewusst OHNE Import aus main.js/ui.js: das Menü muss auch dann
// erscheinen, wenn die Three.js-Bootstrap fehlschlägt.
// Kommunikation läuft über CustomEvents:
//   → 'menu:start'           Spieler will das Abenteuer starten
//   → 'settings:change'      Einstellungen wurden im Menü geändert
// ═══════════════════════════════════════════════════════════════════

const BG_IMAGE     = 'assets/images/main-menu-bg.webp';
const SETTINGS_KEY = 'lukas_settings';

const DEFAULT_SETTINGS = {
  volume:       0.7,
  graphicLevel: 'high',   // 'low' | 'medium' | 'high'
  musicOn:      true,
  showHint:     true,
};

// Reihenfolge = Reihenfolge im Panel
const MENU_ITEMS = [
  { id: 'start',    icon: '▶', label: 'Abenteuer beginnen', sub: 'Mulai bermain'  },
  { id: 'settings', icon: '⚙', label: 'Einstellungen',      sub: 'Pengaturan'     },
  { id: 'about',    icon: '❔', label: 'Über das Spiel',     sub: 'Tentang game'   },
];


export const MainMenu = {
  root:        null,
  isOpen:      false,
  panel:       'main',   // 'main' | 'settings' | 'about'
  activeIndex: 0,
  items:       [],       // <button class="mm-item">
  settings:    { ...DEFAULT_SETTINGS },
  _initialized: false,
};


// ═══════════════════════════════════════════════════════════════════
// SETTINGS — gleicher localStorage-Key wie ui.js ('lukas_settings')
// ═══════════════════════════════════════════════════════════════════

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) Object.assign(MainMenu.settings, JSON.parse(saved));
  } catch (_) {}
  // musicOn kann in alten Speicherständen fehlen
  if (MainMenu.settings.musicOn === undefined) MainMenu.settings.musicOn = true;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(MainMenu.settings));
  } catch (_) {}

  // Lautstärke sofort auf das vorhandene Audio-Element anwenden
  const audioEl = document.getElementById('bgm');
  if (audioEl) audioEl.volume = MainMenu.settings.musicOn === false ? 0 : MainMenu.settings.volume;
  if (window.Howler) window.Howler.volume(MainMenu.settings.volume);

  // ui.js hört mit und synchronisiert sein eigenes Pause-Menü
  window.dispatchEvent(new CustomEvent('settings:change', {
    detail: { ...MainMenu.settings, source: 'mainmenu' }
  }));
}


// ═══════════════════════════════════════════════════════════════════
// TEMPLATE
// ═══════════════════════════════════════════════════════════════════

function render() {
  const s   = MainMenu.settings;
  const vol = Math.round(s.volume * 100);

  MainMenu.root.innerHTML = `
    <div class="mm-bg">
      <img class="mm-bg-img" id="mm-bg-img" src="${BG_IMAGE}" alt=""
           decoding="async" fetchpriority="high" draggable="false" />
    </div>
    <div class="mm-overlay" aria-hidden="true"></div>

    <div class="mm-layout">
      <header class="mm-brand">
        <p class="mm-brand-eyebrow">Ein interaktives Sprachabenteuer</p>
        <h1 class="mm-brand-title">Lukas Abenteuer</h1>
        <p class="mm-brand-subtitle">— Willkommen in Hamburg! —</p>
      </header>

      <div class="mm-panel-stack">

        <!-- ── Hauptliste ───────────────────────────────────── -->
        <nav class="mm-panel mm-panel-main" id="mm-panel-main" aria-label="Hauptmenü">
          <ul class="mm-list" id="mm-list">
            <span class="mm-pill" id="mm-pill" aria-hidden="true"></span>
            ${MENU_ITEMS.map((it, i) => `
              <li class="mm-list-item">
                <button type="button" class="mm-item" data-action="${it.id}" data-index="${i}">
                  <span class="mm-item-icon" aria-hidden="true">${it.icon}</span>
                  <span class="mm-item-text">
                    <span class="mm-item-label">${it.label}</span>
                    <span class="mm-item-sub">${it.sub}</span>
                  </span>
                </button>
              </li>
            `).join('')}
          </ul>
          <p class="mm-hint">
            <kbd>↑</kbd><kbd>↓</kbd> wählen &nbsp;·&nbsp; <kbd>Enter</kbd> bestätigen
          </p>
        </nav>

        <!-- ── Einstellungen ────────────────────────────────── -->
        <section class="mm-panel mm-panel-sub" id="mm-panel-settings" aria-label="Einstellungen" hidden>
          <button type="button" class="mm-back" data-action="back">← Zurück</button>
          <h2 class="mm-sub-title">Einstellungen</h2>

          <div class="mm-row">
            <label class="mm-row-head" for="mm-volume">
              <span>🔊 Lautstärke</span>
              <span class="mm-row-value" id="mm-volume-value">${vol}%</span>
            </label>
            <input type="range" class="mm-slider" id="mm-volume" min="0" max="100" value="${vol}"
                   aria-label="Lautstärke" />
          </div>

          <div class="mm-row mm-row-inline">
            <span class="mm-row-head"><span>🎵 Musik</span></span>
            <button type="button" class="mm-toggle ${s.musicOn !== false ? 'is-on' : ''}" id="mm-music"
                    aria-pressed="${s.musicOn !== false}">${s.musicOn !== false ? 'An' : 'Aus'}</button>
          </div>

          <div class="mm-row">
            <span class="mm-row-head"><span>🎮 Grafik</span></span>
            <div class="mm-choice" role="group" aria-label="Grafikqualität">
              <button type="button" class="mm-choice-btn ${s.graphicLevel === 'low'    ? 'is-on' : ''}" data-gfx="low">Niedrig</button>
              <button type="button" class="mm-choice-btn ${s.graphicLevel === 'medium' ? 'is-on' : ''}" data-gfx="medium">Mittel</button>
              <button type="button" class="mm-choice-btn ${s.graphicLevel === 'high'   ? 'is-on' : ''}" data-gfx="high">Hoch</button>
            </div>
          </div>

          <div class="mm-row mm-row-inline">
            <span class="mm-row-head"><span>💡 Hinweise zeigen</span></span>
            <button type="button" class="mm-toggle ${s.showHint ? 'is-on' : ''}" id="mm-hint"
                    aria-pressed="${!!s.showHint}">${s.showHint ? 'An' : 'Aus'}</button>
          </div>

          <p class="mm-note">Änderungen werden automatisch gespeichert.</p>
        </section>

        <!-- ── Über das Spiel ───────────────────────────────── -->
        <section class="mm-panel mm-panel-sub" id="mm-panel-about" aria-label="Über das Spiel" hidden>
          <button type="button" class="mm-back" data-action="back">← Zurück</button>
          <h2 class="mm-sub-title">Über das Spiel</h2>

          <p class="mm-about-lead">Lukas Abenteuer — Willkommen in Hamburg!</p>
          <p class="mm-about-tag">In der Stadt &nbsp;·&nbsp; Wohnung &nbsp;·&nbsp; Reise</p>
          <p class="mm-about-text">
            Lukas kehrt nach zehn Jahren zu seinen Großeltern nach Hamburg zurück.
            10 Quests warten: Sprich mit den Bewohnern, erkunde jede Ecke der Stadt
            und lerne dabei Deutsch.
          </p>

          <div class="mm-keys">
            <div class="mm-key-row"><kbd>W A S D</kbd><span>bewegen</span></div>
            <div class="mm-key-row"><kbd>E</kbd><span>sprechen</span></div>
            <div class="mm-key-row"><kbd>Tab</kbd><span>Reisetagebuch</span></div>
            <div class="mm-key-row"><kbd>ESC</kbd><span>Pause</span></div>
          </div>

          <p class="mm-note">
            Lernspiel basierend auf der Skripsi von Yemima · CTL-Ansatz · Klasse XI SMA
          </p>
        </section>
      </div>
    </div>

    <footer class="mm-footer">
      Lernspiel basierend auf der Skripsi von Yemima · CTL-Ansatz · Klasse XI SMA
    </footer>
  `;
}


// ═══════════════════════════════════════════════════════════════════
// PILL — gleitet zur aktiven Auswahl
// ═══════════════════════════════════════════════════════════════════

function movePill(index, animate = true) {
  const pill = MainMenu.root?.querySelector('#mm-pill');
  const btn  = MainMenu.items[index];
  if (!pill || !btn) return;

  if (!animate) pill.classList.add('mm-pill-instant');
  pill.style.height    = `${btn.offsetHeight}px`;
  pill.style.transform = `translateY(${btn.parentElement.offsetTop}px)`;
  pill.classList.add('is-ready');
  if (!animate) {
    // Transition erst im nächsten Frame wieder erlauben
    requestAnimationFrame(() => pill.classList.remove('mm-pill-instant'));
  }
}

function setActive(index, { focus = true } = {}) {
  const max = MainMenu.items.length - 1;
  MainMenu.activeIndex = Math.max(0, Math.min(max, index));

  MainMenu.items.forEach((btn, i) => {
    const on = i === MainMenu.activeIndex;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-current', on ? 'true' : 'false');
  });

  movePill(MainMenu.activeIndex);
  if (focus) MainMenu.items[MainMenu.activeIndex]?.focus({ preventScroll: true });
}


// ═══════════════════════════════════════════════════════════════════
// PANEL-WECHSEL
// ═══════════════════════════════════════════════════════════════════

function showPanel(name, { focus = true } = {}) {
  MainMenu.panel = name;
  ['main', 'settings', 'about'].forEach((p) => {
    const el = MainMenu.root.querySelector(`#mm-panel-${p}`);
    if (el) el.hidden = (p !== name);
  });

  if (name === 'main') {
    // Fokus zurück auf den Eintrag, der das Panel geöffnet hat
    requestAnimationFrame(() => {
      movePill(MainMenu.activeIndex, false);
      setActive(MainMenu.activeIndex, { focus });
    });
  } else if (focus) {
    requestAnimationFrame(() => {
      MainMenu.root.querySelector(`#mm-panel-${name} .mm-back`)?.focus({ preventScroll: true });
    });
  }
}


// ═══════════════════════════════════════════════════════════════════
// AKTIONEN
// ═══════════════════════════════════════════════════════════════════

function activate(action) {
  switch (action) {
    case 'start':
      startGame();
      break;
    case 'settings':
      showPanel('settings');
      break;
    case 'about':
      showPanel('about');
      break;
    case 'back':
      showPanel('main');
      break;
  }
}

function startGame() {
  closeMainMenu();
  // index.html hört darauf und zeigt das Story-Intro
  window.dispatchEvent(new CustomEvent('menu:start'));
}


// ═══════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════

function bindEvents() {
  const root = MainMenu.root;

  // Fehlendes Hintergrundbild → Low-Poly-SVG als Ersatz
  const bgImg = root.querySelector('#mm-bg-img');
  if (bgImg) {
    bgImg.addEventListener('error', () => {
      root.querySelector('.mm-bg')?.classList.add('mm-bg-fallback');
    }, { once: true });
  }

  // Menüeinträge
  MainMenu.items.forEach((btn, i) => {
    btn.addEventListener('click',      () => { setActive(i, { focus: false }); activate(btn.dataset.action); });
    btn.addEventListener('mouseenter', () => setActive(i, { focus: false }));
    btn.addEventListener('focus',      () => setActive(i, { focus: false }));
  });

  // Pill folgt der Maus, springt beim Verlassen zur Auswahl zurück
  root.querySelector('#mm-list')?.addEventListener('mouseleave', () => movePill(MainMenu.activeIndex));

  // Zurück-Buttons
  root.querySelectorAll('.mm-back').forEach((btn) => {
    btn.addEventListener('click', () => activate('back'));
  });

  // ── Einstellungen ──────────────────────────────────────────
  const volume = root.querySelector('#mm-volume');
  volume?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10) / 100;
    MainMenu.settings.volume = v;
    root.querySelector('#mm-volume-value').textContent = e.target.value + '%';
    saveSettings();
  });

  root.querySelector('#mm-music')?.addEventListener('click', (e) => {
    MainMenu.settings.musicOn = MainMenu.settings.musicOn === false;
    e.currentTarget.textContent = MainMenu.settings.musicOn ? 'An' : 'Aus';
    e.currentTarget.classList.toggle('is-on', MainMenu.settings.musicOn);
    e.currentTarget.setAttribute('aria-pressed', String(MainMenu.settings.musicOn));
    saveSettings();
  });

  root.querySelector('#mm-hint')?.addEventListener('click', (e) => {
    MainMenu.settings.showHint = !MainMenu.settings.showHint;
    e.currentTarget.textContent = MainMenu.settings.showHint ? 'An' : 'Aus';
    e.currentTarget.classList.toggle('is-on', MainMenu.settings.showHint);
    e.currentTarget.setAttribute('aria-pressed', String(MainMenu.settings.showHint));
    saveSettings();
  });

  root.querySelectorAll('[data-gfx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-gfx]').forEach((b) => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      MainMenu.settings.graphicLevel = btn.dataset.gfx;
      saveSettings();
    });
  });

  // ── Tastatur ───────────────────────────────────────────────
  window.addEventListener('keydown', onKeyDown);

  // Pill neu vermessen, wenn sich das Layout ändert
  window.addEventListener('resize', () => movePill(MainMenu.activeIndex, false));
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => movePill(MainMenu.activeIndex, false));
  }
}

function onKeyDown(e) {
  if (!MainMenu.isOpen) return;

  // In Unterpanels: nur ESC bringt zurück, damit Slider die Pfeiltasten behalten
  if (MainMenu.panel !== 'main') {
    if (e.key === 'Escape') { e.preventDefault(); showPanel('main'); }
    return;
  }

  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault();
      setActive((MainMenu.activeIndex + 1) % MainMenu.items.length);
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault();
      setActive((MainMenu.activeIndex - 1 + MainMenu.items.length) % MainMenu.items.length);
      break;
    case 'Home':
      e.preventDefault();
      setActive(0);
      break;
    case 'End':
      e.preventDefault();
      setActive(MainMenu.items.length - 1);
      break;
    case 'Enter':
    case ' ':
      // Liegt der Fokus schon auf dem Button, feuert der Browser den Klick selbst
      if (document.activeElement !== MainMenu.items[MainMenu.activeIndex]) {
        e.preventDefault();
        activate(MENU_ITEMS[MainMenu.activeIndex].id);
      }
      break;
  }
}


// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function initMainMenu(root = document.getElementById('main-menu')) {
  if (!root || MainMenu._initialized) return MainMenu;

  MainMenu.root = root;
  loadSettings();
  render();

  MainMenu.items = Array.from(root.querySelectorAll('.mm-item'));
  bindEvents();
  showPanel('main');

  MainMenu._initialized = true;
  return MainMenu;
}

export function openMainMenu() {
  if (!MainMenu._initialized) initMainMenu();
  if (!MainMenu.root || MainMenu.isOpen) return;

  MainMenu.isOpen = true;
  MainMenu.root.hidden = false;
  MainMenu.root.setAttribute('aria-hidden', 'false');
  // ui.js pausiert seinen ESC-Handler, solange das Menü offen ist
  document.body.classList.add('main-menu-open');

  requestAnimationFrame(() => {
    MainMenu.root.classList.add('main-menu-active');
    showPanel('main', { focus: false });
    movePill(0, false);
    setActive(0, { focus: false });
  });
}

export function closeMainMenu() {
  if (!MainMenu.root || !MainMenu.isOpen) return;

  MainMenu.isOpen = false;
  MainMenu.root.classList.remove('main-menu-active');
  MainMenu.root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('main-menu-open');

  setTimeout(() => {
    if (!MainMenu.isOpen) MainMenu.root.hidden = true;
  }, 420);
}


// ═══════════════════════════════════════════════════════════════════
// AUTO-INIT — Menü vorbereiten, sobald das DOM steht
// ═══════════════════════════════════════════════════════════════════

function boot() {
  initMainMenu();
  // Globaler Zugriff für das Bootstrap-Skript in index.html
  window.LukasMainMenu = { open: openMainMenu, close: closeMainMenu, state: MainMenu };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
