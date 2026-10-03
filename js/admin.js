// ═══════════════════════════════════════════════════════════════════
// js/admin.js — VERSTECKTER ADMIN-MODUS
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Für Lehrkraft und Entwicklung: in jede Zone und jede Quest springen,
// Gespräche vorspulen. Für Spielende unsichtbar.
//
// Öffnen:
//   • Tastatur  : Strg + Umschalt + A
//   • Touch     : fünfmal kurz hintereinander auf den Spieltitel tippen
//   • Konsole   : window.LukasAdmin.prompt()
//
// ACHTUNG — das ist eine Abdeckung, kein Schutz:
// Das Spiel ist eine reine Browser-Anwendung ohne Server. Jede Prüfung
// läuft im Browser der spielenden Person und lässt sich mit den
// Entwicklerwerkzeugen umgehen. Hinterlegt ist nur der SHA-256-Abdruck,
// damit das Passwort nicht im Quelltext steht — wer es ernsthaft darauf
// anlegt, kommt trotzdem hinein. Also: nichts hierhinter legen, was
// wirklich geheim bleiben muss.
// ═══════════════════════════════════════════════════════════════════

// SHA-256 des Admin-Passworts
const PASSWORD_HASH = '33606b36c7aa4ac03db6d3c8266206c293178646bdae5c8b6be44990c7890c7e';

const SESSION_KEY = 'lukas_admin_unlocked';

// Zonen mit lesbaren Namen — Reihenfolge wie im Spielverlauf
const ZONE_LIST = [
  { id: 'haus_interior',        label: 'Haus — innen',        stage: 'Stufe 1' },
  { id: 'haus',                 label: 'Haus — außen',        stage: 'Stufe 1' },
  { id: 'stadt',               label: 'Die Stadt',            stage: 'Stufe 2' },
  { id: 'supermarkt',          label: 'Supermarkt — außen',   stage: 'Stufe 2' },
  { id: 'supermarket_interior', label: 'Supermarkt — innen',  stage: 'Stufe 2' },
  { id: 'schule',              label: 'Schule',               stage: 'Stufe 2' },
  { id: 'stadtpark',           label: 'Stadtpark',            stage: 'Stufe 2' },
  { id: 'hafen',               label: 'Hafen',                stage: 'Stufe 3' },
  { id: 'wochenmarkt',         label: 'Wochenmarkt',          stage: 'Stufe 3' },
  { id: 'buecherei',           label: 'Bücherei',             stage: 'Stufe 3' },
  { id: 'apotheke',            label: 'Apotheke',             stage: 'Stufe 3' },
  { id: 'restaurant',          label: 'Restaurant',           stage: 'Stufe 3' },
  { id: 'elbe',                label: 'Elbufer',              stage: 'Stufe 3' },
  { id: 'haus_night',          label: 'Haus — nachts',        stage: 'Stufe 3' },
];

const QUEST_COUNT = 10;


export const Admin = {
  root:        null,
  unlocked:    false,
  panelOpen:   false,
  autoSkip:    false,
  _initialized: false,
};


// ═══════════════════════════════════════════════════════════════════
// PASSWORT
// ═══════════════════════════════════════════════════════════════════

async function sha256Hex(text) {
  const bytes  = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function checkPassword(input) {
  try {
    return (await sha256Hex(input)) === PASSWORD_HASH;
  } catch (_) {
    return false;   // crypto.subtle fehlt (unsicherer Kontext) → kein Zugang
  }
}


// ═══════════════════════════════════════════════════════════════════
// TEMPLATE
// ═══════════════════════════════════════════════════════════════════

function render() {
  const zonesByStage = ZONE_LIST.reduce((acc, z) => {
    (acc[z.stage] = acc[z.stage] || []).push(z);
    return acc;
  }, {});

  Admin.root.innerHTML = `
    <!-- ── Anmeldung ───────────────────────────────────────── -->
    <div class="adm-login" id="adm-login" hidden>
      <form class="adm-card adm-card-login" id="adm-form" autocomplete="off">
        <h2 class="adm-title">🔐 Admin</h2>
        <p class="adm-sub">Passwort eingeben</p>
        <input type="password" class="adm-input" id="adm-pass"
               autocomplete="off" aria-label="Admin-Passwort" />
        <p class="adm-error" id="adm-error" hidden>Falsches Passwort.</p>
        <div class="adm-login-actions">
          <button type="button" class="adm-btn" id="adm-cancel">Abbrechen</button>
          <button type="submit" class="adm-btn adm-btn-primary">Anmelden</button>
        </div>
      </form>
    </div>

    <!-- ── Werkzeugfenster ─────────────────────────────────── -->
    <div class="adm-panel" id="adm-panel" hidden>
      <header class="adm-panel-head">
        <span class="adm-badge">ADMIN</span>
        <button type="button" class="adm-icon-btn" id="adm-close" aria-label="Schließen">×</button>
      </header>

      <section class="adm-section">
        <h3 class="adm-h3">Zone</h3>
        ${Object.entries(zonesByStage).map(([stage, zones]) => `
          <p class="adm-stage">${stage}</p>
          <div class="adm-grid">
            ${zones.map((z) => `
              <button type="button" class="adm-chip" data-zone="${z.id}">${z.label}</button>
            `).join('')}
          </div>
        `).join('')}
      </section>

      <section class="adm-section">
        <h3 class="adm-h3">Quest</h3>
        <div class="adm-grid adm-grid-quests">
          ${Array.from({ length: QUEST_COUNT }, (_, i) => `
            <button type="button" class="adm-chip" data-quest="quest_${i + 1}">${i + 1}</button>
          `).join('')}
        </div>
        <p class="adm-note">Springt zur Quest; die davor gelten als erledigt.</p>
      </section>

      <section class="adm-section">
        <h3 class="adm-h3">Gespräche</h3>
        <button type="button" class="adm-btn adm-btn-wide" id="adm-skip">
          Laufendes Gespräch vorspulen
        </button>
        <label class="adm-toggle-row">
          <span>Alle Gespräche überspringen</span>
          <button type="button" class="adm-toggle" id="adm-autoskip"
                  aria-pressed="false">Aus</button>
        </label>
        <p class="adm-note">Vorspulen führt die Quest-Effekte trotzdem aus.</p>
      </section>

      <footer class="adm-foot">
        <button type="button" class="adm-btn" id="adm-logout">Abmelden</button>
        <span class="adm-hint"><kbd>Strg</kbd>+<kbd>⇧</kbd>+<kbd>A</kbd> Fenster · <kbd>Strg</kbd>+<kbd>⇧</kbd>+<kbd>D</kbd> vorspulen</span>
      </footer>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════════
// AKTIONEN — Spielmodule erst bei Bedarf laden, damit der Admin-Code
// beim Start nichts mitzieht (und das Hauptmenü ohne Three.js lädt).
// ═══════════════════════════════════════════════════════════════════

async function jumpToZone(zoneId) {
  try {
    const { loadZone } = await import('./zone.js');
    await loadZone(zoneId, null, false);
    notify(`Zone: ${zoneId}`);
  } catch (err) {
    notify(`Zone fehlgeschlagen: ${err.message}`, true);
  }
}

async function jumpToQuest(questId) {
  try {
    const { QuestSystem } = await import('./quest.js');

    // Alles davor als erledigt markieren, damit die Reihenfolge stimmt
    const index = parseInt(questId.split('_')[1], 10);
    window.__questState__ = window.__questState__ || {};
    for (let i = 1; i < index; i++) window.__questState__[`quest_${i}`] = 'completed';
    delete window.__questState__[questId];

    QuestSystem.startQuest(questId);
    notify(`Quest ${index} gestartet`);
  } catch (err) {
    notify(`Quest fehlgeschlagen: ${err.message}`, true);
  }
}

async function skipCurrentDialog() {
  try {
    const { skipDialog } = await import('./dialog.js');
    if (!skipDialog()) notify('Gerade läuft kein Gespräch.');
  } catch (err) {
    notify(`Vorspulen fehlgeschlagen: ${err.message}`, true);
  }
}

function notify(text, isError = false) {
  import('./ui.js')
    .then(({ showToast }) => showToast({
      title: isError ? '⚠️ Admin' : '🔧 Admin',
      body: text,
      type: isError ? 'error' : 'info',
      duration: 2200,
    }))
    .catch(() => console.log('[admin]', text));
}


// ═══════════════════════════════════════════════════════════════════
// AUTO-SKIP
// ═══════════════════════════════════════════════════════════════════

function setAutoSkip(on) {
  Admin.autoSkip = !!on;
  const btn = Admin.root?.querySelector('#adm-autoskip');
  if (btn) {
    btn.textContent = Admin.autoSkip ? 'An' : 'Aus';
    btn.classList.toggle('is-on', Admin.autoSkip);
    btn.setAttribute('aria-pressed', String(Admin.autoSkip));
  }
}

// Jedes neu geöffnete Gespräch sofort vorspulen
window.addEventListener('dialog:open', () => {
  if (!Admin.unlocked || !Admin.autoSkip) return;
  // Einen Tick warten, damit der erste Knoten gesetzt ist
  setTimeout(() => skipCurrentDialog(), 60);
});


// ═══════════════════════════════════════════════════════════════════
// ANZEIGE
// ═══════════════════════════════════════════════════════════════════

export function promptAdmin() {
  if (!Admin._initialized) initAdmin();
  if (!Admin.root) return;

  if (Admin.unlocked) { togglePanel(true); return; }

  Admin.root.hidden = false;
  Admin.root.querySelector('#adm-login').hidden = false;
  Admin.root.querySelector('#adm-error').hidden = true;
  const field = Admin.root.querySelector('#adm-pass');
  field.value = '';
  setTimeout(() => field.focus(), 40);
}

function closeLogin() {
  const login = Admin.root?.querySelector('#adm-login');
  if (login) login.hidden = true;
  if (!Admin.panelOpen) Admin.root.hidden = true;
}

function togglePanel(open) {
  Admin.panelOpen = open ?? !Admin.panelOpen;
  const panel = Admin.root.querySelector('#adm-panel');
  panel.hidden = !Admin.panelOpen;
  Admin.root.hidden = !(Admin.panelOpen || !Admin.root.querySelector('#adm-login').hidden);
}

function unlock() {
  Admin.unlocked = true;
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
  document.body.classList.add('admin-unlocked');
  closeLogin();
  togglePanel(true);
  notify('Admin-Modus aktiv');
}

function logout() {
  Admin.unlocked = false;
  setAutoSkip(false);
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  document.body.classList.remove('admin-unlocked');
  togglePanel(false);
  Admin.root.hidden = true;
}


// ═══════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════

function bindEvents() {
  const root = Admin.root;

  root.querySelector('#adm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const field = root.querySelector('#adm-pass');
    const ok = await checkPassword(field.value);
    if (ok) { unlock(); return; }
    root.querySelector('#adm-error').hidden = false;
    field.value = '';
    field.focus();
  });

  root.querySelector('#adm-cancel').addEventListener('click', closeLogin);
  root.querySelector('#adm-close').addEventListener('click', () => togglePanel(false));
  root.querySelector('#adm-logout').addEventListener('click', logout);
  root.querySelector('#adm-skip').addEventListener('click', skipCurrentDialog);
  root.querySelector('#adm-autoskip').addEventListener('click', () => setAutoSkip(!Admin.autoSkip));

  root.addEventListener('click', (e) => {
    const zone = e.target.closest('[data-zone]');
    if (zone) { jumpToZone(zone.dataset.zone); return; }
    const quest = e.target.closest('[data-quest]');
    if (quest) { jumpToQuest(quest.dataset.quest); }
  });

  // Tastenkürzel
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.shiftKey) return;
    if (e.code === 'KeyA') { e.preventDefault(); promptAdmin(); }
    else if (e.code === 'KeyD' && Admin.unlocked) { e.preventDefault(); skipCurrentDialog(); }
  });
}


// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function initAdmin(root = document.getElementById('admin-overlay')) {
  if (!root || Admin._initialized) return Admin;

  Admin.root = root;
  render();
  bindEvents();

  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      Admin.unlocked = true;
      document.body.classList.add('admin-unlocked');
    }
  } catch (_) {}

  Admin._initialized = true;
  return Admin;
}


// ═══════════════════════════════════════════════════════════════════
// AUTO-INIT
// ═══════════════════════════════════════════════════════════════════

function boot() {
  initAdmin();
  window.LukasAdmin = {
    prompt: promptAdmin,
    skipDialog: skipCurrentDialog,
    state: Admin,
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
