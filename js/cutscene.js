// ═══════════════════════════════════════════════════════════════════
// js/cutscene.js — CUTSCENE & TRANSISI WAKTU
//
//   Cutscene.play('bus')        Quest 5: naik bus dari rumah Oma ke kota
//   Cutscene.play('kino')       Quest 7: masuk bioskop, beli tiket, nonton, keluar
//   Cutscene.play('restaurant') Quest 8: duduk di restoran, memesan makanan
//   Cutscene.play('finale')     Akhir permainan
//   Cutscene.transition(type)   'dinner' (→ malam), 'nextday' (→ pagi), 'evening' (→ malam)
//
// Semua berupa lapisan HTML di atas kanvas (z-index di bawah kotak dialog,
// sehingga dialog bisa tampil di atas latar cutscene). Dunia 3D dimuat ulang
// di balik lapisan saat perlu (zona baru / siang-malam).
// ═══════════════════════════════════════════════════════════════════

import { Game, resetIsoCamera } from './main.js';
import { ZONES } from './config.js';
import { setInputEnabled, teleportPlayer } from './player.js';
import { openDialog, Dialog, skipDialog } from './dialog.js';
import { getDialog } from './data/dialogs.js';
import { QUEST_ORDER } from './data/quests.js';
import { setMusicOverride } from './music.js';
import { logActivity } from './activitylog.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function waitDialogClosed() {
  return new Promise(resolve => {
    const tick = () => (Dialog.isOpen ? setTimeout(tick, 150) : resolve());
    tick();
  });
}

let root = null;
let skipRequested = false;

function overlay() {
  if (root) root.remove();
  root = document.createElement('div');
  root.id = 'cutscene';
  root.className = 'cutscene';
  // Di dalam #game-container (konteks tumpukan sendiri) agar kotak dialog
  // (z 70) dan menu pause tetap di atas cutscene (z 66)
  (document.getElementById('game-container') || document.body).appendChild(root);
  document.body.classList.add('cutscene-active');
  skipRequested = false;
  return root;
}

async function closeOverlay() {
  if (!root) return;
  const el = root;
  root = null;
  el.classList.add('cs-out');
  await wait(650);
  el.remove();
  document.body.classList.remove('cutscene-active');
}

/** Satu "adegan": isi HTML, fade in, tunggu. */
async function scene(html, ms, cls = '') {
  const el = root;
  if (!el) return;
  const s = document.createElement('div');
  s.className = `cs-scene ${cls}`;
  s.innerHTML = html;
  el.querySelectorAll('.cs-scene').forEach(old => {
    old.classList.add('cs-leave');
    setTimeout(() => old.remove(), 700);
  });
  el.appendChild(s);
  requestAnimationFrame(() => s.classList.add('cs-in'));
  await sleepSkippable(ms);
  return s;
}

/** Tunggu, tapi bisa dilewati dengan tombol "Überspringen". */
async function sleepSkippable(ms) {
  // Waktu nyata (bukan jumlah putaran) — tetap tepat walau frame lambat
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (skipRequested) return;
    await wait(Math.min(100, end - performance.now()));
  }
}

function addSkipButton(label = 'Überspringen ⏭') {
  if (!root) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cs-skip';
  b.textContent = label;
  b.addEventListener('click', () => { skipRequested = true; });
  root.appendChild(b);
}

async function loadZoneUnder(zoneId, spawn) {
  const { loadZone } = await import('./zone.js');
  await loadZone(zoneId, spawn, true);
  resetIsoCamera();
}

function placePlayer(x, z, facing) {
  teleportPlayer(x, z, facing);
  resetIsoCamera();
}

function openStepDialog(id, speaker) {
  const dlg = getDialog(id);
  if (!dlg) return Promise.resolve();
  openDialog(dlg, speaker);
  return waitDialogClosed().then(() => setInputEnabled(false, 'cutscene'));
}

// ═══════════════════════════════════════════════════════════════════
// CUTSCENE
// ═══════════════════════════════════════════════════════════════════

const SCENES = {
  // ── Quest 5: dengan bus ke kota ─────────────────────────────────
  async bus() {
    overlay().classList.add('cs-bus');
    setMusicOverride('travel');
    setInputEnabled(false, 'cutscene');
    await scene(`
      <div class="bus-sky"></div>
      <div class="bus-hills"></div>
      <div class="bus-houses"></div>
      <div class="bus-road"><div class="bus-lines"></div></div>
      <div class="bus">
        <div class="bus-body"><span class="bus-route">5 · Hauptstraße</span>
          <div class="bus-windows"><i></i><i></i><i></i><i class="lukas">🧑</i><i></i></div>
        </div>
        <div class="bus-wheel w1"></div><div class="bus-wheel w2"></div>
      </div>
      <div class="cs-caption">
        <div class="cs-cap-de">🚌 Lukas fährt mit dem Bus in die Stadt. Omas Apfelkuchen liegt auf seinem Schoß.</div>
        <div class="cs-cap-id">Lukas naik bus ke kota sambil memangku kue apel Oma.</div>
      </div>`, 5200);
    // Kota dimuat di balik layar: Lukas turun di halte Hauptstraße
    await loadZoneUnder(ZONES.STADT, { x: 35.6, z: 3.9, facing: -Math.PI / 2 });
    await scene(`
      <div class="bus-display">
        <div class="bd-line">Linie 5</div>
        <div class="bd-next">Nächste Haltestelle:</div>
        <div class="bd-stop">Hauptstraße</div>
      </div>
      <div class="cs-caption">
        <div class="cs-cap-de">„Nächste Haltestelle: Hauptstraße." — Lukas steigt aus.</div>
        <div class="cs-cap-id">Halte berikutnya: Hauptstraße. Lukas turun dari bus.</div>
      </div>`, 3200, 'cs-dark');
    placePlayer(35.6, 3.9, -Math.PI / 2);
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },

  // ── Quest 7: di bioskop ─────────────────────────────────────────
  async kino() {
    overlay().classList.add('cs-kino');
    setMusicOverride('shop');                // foyer: musik ceria
    setInputEnabled(false, 'cutscene');
    await scene(`
      <div class="cs-title-card">
        <div class="cs-big">🎬</div>
        <div class="cs-cap-de">Lukas geht ins Kino.</div>
        <div class="cs-cap-id">Lukas masuk ke bioskop.</div>
      </div>`, 1800, 'cs-dark');
    // Foyer: beli tiket di kasir bioskop
    await scene(`
      <div class="foyer">
        <div class="foyer-posters"><i>🚢</i><i>🦖</i><i>🚀</i></div>
        <div class="foyer-counter"><span>KASSE</span></div>
        <div class="foyer-popcorn">🍿</div>
        <div class="foyer-lights"></div>
      </div>`, 900, 'cs-foyer');
    await openStepDialog('kino_karte', { id: 'kinokasse', name: 'Kinokasse' });
    // Saal: nonton film
    addSkipButton();
    const saal = await scene(`
      <div class="saal">
        <div class="screen"><div class="film" id="cs-film"></div></div>
        <div class="saal-glow"></div>
        <div class="seats">
          <div class="row r1">${'<i></i>'.repeat(9)}</div>
          <div class="row r2"><i></i><i></i><i></i><i class="lukas"><b>Lukas</b></i><i class="felix"><b>Felix</b></i><i></i><i></i><i></i></div>
          <div class="row r3">${'<i></i>'.repeat(10)}</div>
        </div>
        <div class="cs-whisper" id="cs-whisper"></div>
      </div>`, 400, 'cs-saal');
    const film = saal?.querySelector('#cs-film');
    const whisper = saal?.querySelector('#cs-whisper');
    const FRAMES = [
      { cls: 'f-title', html: '<div class="ft">Abenteuer an der Elbe</div><div class="fs">Ein Film für die ganze Familie</div>', sub: '', ms: 2600,
        whisper: '😎 Felix: „Psst, Lukas! Der Film fängt an!"' },
      { cls: 'f-ship', html: '<div class="sun"></div><div class="sea"></div><div class="ship">⛵</div><div class="gull">🕊️</div>', sub: 'Kapitän Jan segelt auf der Elbe nach Hamburg.', ms: 3600 },
      { cls: 'f-storm', html: '<div class="rain"></div><div class="sea storm"></div><div class="ship rock">⛵</div><div class="bolt">⚡</div>', sub: 'Plötzlich kommt ein Sturm! Wo ist der Hafen?', ms: 3400,
        whisper: '🧑 Lukas: „Oh nein!" 🍿' },
      { cls: 'f-light', html: '<div class="sea calm"></div><div class="lighthouse">🗼</div><div class="beam"></div><div class="ship">⛵</div>', sub: 'Der Leuchtturm zeigt ihm den Weg — geradeaus, dann links!', ms: 3600 },
      { cls: 'f-end', html: '<div class="ft">ENDE</div><div class="fs">Jan ist zu Hause. 💛</div>', sub: '', ms: 2400 },
    ];
    const FILM_MUSIC = { 'f-title': 'film_title', 'f-ship': 'film_sail', 'f-storm': 'film_storm', 'f-light': 'film_light', 'f-end': 'film_end' };
    for (const f of FRAMES) {
      if (skipRequested || !film) break;
      setMusicOverride(FILM_MUSIC[f.cls], { fade: f.cls === 'f-title' ? 0.6 : 0.35 });
      film.className = `film ${f.cls}`;
      film.innerHTML = `${f.html}${f.sub ? `<div class="film-sub">${f.sub}</div>` : ''}`;
      if (whisper) {
        whisper.textContent = f.whisper || '';
        whisper.classList.toggle('show', !!f.whisper);
      }
      await sleepSkippable(f.ms);
    }
    root?.querySelector('.cs-skip')?.remove();
    skipRequested = false;
    setMusicOverride('film_end', { fade: 0.4 });
    await scene(`
      <div class="cs-title-card cs-lights-on">
        <div class="cs-big">💡</div>
        <div class="cs-cap-de">Das Licht geht an. „Toller Film!", sagt Felix. Die beiden gehen aus dem Kino.</div>
        <div class="cs-cap-id">Lampu menyala. "Filmnya keren!" kata Felix. Mereka keluar dari bioskop.</div>
      </div>`, 3000, 'cs-dark');
    // Keluar: berdiri di trotoar depan Kino
    const door = window.__stadtBuildings__?.kino?.door;
    if (door) placePlayer(door.x, door.z + 1.1, 0);
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },

  // ── Quest 8: makan siang di restoran ────────────────────────────
  async restaurant() {
    overlay().classList.add('cs-restaurant');
    setMusicOverride('tavern');
    setInputEnabled(false, 'cutscene');
    await scene(`
      <div class="cs-title-card">
        <div class="cs-big">🍽️</div>
        <div class="cs-cap-de">Lukas geht ins Restaurant Deichstraße.</div>
        <div class="cs-cap-id">Lukas masuk ke Restaurant Deichstraße.</div>
      </div>`, 1700, 'cs-dark');
    await scene(`
      <div class="resto">
        <div class="resto-window"><div class="resto-elbe"></div><div class="resto-ship">🚢</div></div>
        <div class="resto-lamp"></div>
        <div class="resto-table">
          <div class="resto-family"><span>👴</span><span>👵</span><span>👩</span><span>👧</span><span>🧑</span></div>
          <div class="resto-cloth"></div>
        </div>
        <div class="resto-menu">
          <div class="rm-title">Speisekarte</div>
          <div class="rm-row"><span>Fischbrötchen</span><span>4,50 €</span></div>
          <div class="rm-row"><span>Labskaus</span><span>9,80 €</span></div>
          <div class="rm-row"><span>Rote Grütze</span><span>3,90 €</span></div>
        </div>
      </div>`, 900, 'cs-resto');
    await openStepDialog('restaurant_bestellen', { id: 'kellner', name: 'Kellner' });
    await scene(`
      <div class="cs-title-card">
        <div class="cs-big">🐟😋</div>
        <div class="cs-cap-de">Alle essen zusammen und lachen viel. Danach gehen sie wieder hinaus.</div>
        <div class="cs-cap-id">Semua makan bersama dan banyak tertawa. Lalu mereka keluar lagi.</div>
      </div>`, 2800, 'cs-dark');
    const door = window.__stadtBuildings__?.restaurant?.door;
    if (door) placePlayer(door.x, door.z + 1.1, 0);
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },

  // ── Akhir permainan ─────────────────────────────────────────────
  async finale() {
    overlay().classList.add('cs-finale');
    setMusicOverride('finale', { fade: 2 });
    setInputEnabled(false, 'cutscene');
    const qs = window.__questState__ || {};
    const done = QUEST_ORDER.filter(id => qs[id] === 'completed').length;
    const score = window.__score__ || 0;
    await scene(`
      <div class="finale-sky"></div>
      <div class="finale-card">
        <div class="cs-big">🌟</div>
        <h1>Danke, Lukas!</h1>
        <p class="cs-cap-de">Morgen fliegt Lukas nach Hause. Er wird Hamburg, Oma, Opa, Tante Maria, Leni und Felix nie vergessen.</p>
        <p class="cs-cap-id">Besok Lukas pulang. Ia tidak akan pernah melupakan Hamburg dan keluarganya.</p>
        <div class="finale-stats">
          <span>✅ ${done} / ${QUEST_ORDER.length} Quests</span>
          <span>⭐ ${score} Punkte</span>
        </div>
        <div class="finale-btns">
          <button type="button" class="finale-btn" data-act="stay">Weiter erkunden</button>
          <button type="button" class="finale-btn primary" data-act="menu">Zum Hauptmenü</button>
        </div>
      </div>`, 300, 'cs-dark');
    await new Promise(resolve => {
      root?.querySelectorAll('.finale-btn').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.act === 'menu') { window.location.reload(); return; }
        resolve();
      }));
    });
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },
};

// ═══════════════════════════════════════════════════════════════════
// TRANSISI WAKTU
// ═══════════════════════════════════════════════════════════════════

const TRANSITIONS = {
  // Setelah Quest 6: makan malam bersama, lalu malam tiba (Quest 7)
  async dinner() {
    overlay().classList.add('cs-time');
    setMusicOverride('home');
    setInputEnabled(false, 'cutscene');
    await scene(`
      <div class="tt-card tt-dinner">
        <div class="tt-icons">🍲 🥔 🥗 🥧</div>
        <div class="cs-cap-de">Abendessen bei Oma und Opa: Kartoffeln, Fleisch und Salat — und zum Nachtisch Omas Apfelkuchen!</div>
        <div class="cs-cap-id">Makan malam bersama Oma dan Opa — lalu kue apel Oma sebagai pencuci mulut.</div>
      </div>`, 3600, 'cs-warm');
    await scene(`
      <div class="tt-sky tt-to-night"><div class="tt-stars"></div><div class="tt-moon">🌙</div></div>
      <div class="cs-caption">
        <div class="cs-cap-de">Später am Abend … Draußen ist es schon dunkel.</div>
        <div class="cs-cap-id">Malam harinya … di luar sudah gelap.</div>
      </div>`, 1200, 'cs-night');
    await reloadHere();
    await sleepSkippable(1800);
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },

  // Setelah Quest 7: tidur → pagi berikutnya di rumah Oma (Quest 8)
  async nextday() {
    overlay().classList.add('cs-time');
    setMusicOverride('night');
    setInputEnabled(false, 'cutscene');
    await scene(`
      <div class="tt-sky tt-night"><div class="tt-stars"></div><div class="tt-moon">🌙</div></div>
      <div class="cs-caption">
        <div class="cs-cap-de">Lukas geht nach Hause und schläft sofort ein. Gute Nacht! 😴</div>
        <div class="cs-cap-id">Lukas pulang dan langsung tertidur. Selamat malam!</div>
      </div>`, 2600, 'cs-night');
    setMusicOverride('home', { fade: 2.5 });
    await scene(`
      <div class="tt-sky tt-sunrise"><div class="tt-sun">☀️</div></div>
      <div class="cs-caption">
        <div class="cs-cap-de">Am nächsten Morgen … Heute ist Lukas' letzter Tag in Hamburg.</div>
        <div class="cs-cap-id">Keesokan paginya … hari ini hari terakhir Lukas di Hamburg.</div>
      </div>`, 1000, 'cs-morning');
    await loadZoneUnder(ZONES.HAUS, { x: 1.2, z: 4.8, facing: 0 });
    await sleepSkippable(2200);
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },

  // Setelah Quest 9: matahari terbenam → malam perpisahan (Quest 10)
  async evening() {
    overlay().classList.add('cs-time');
    setMusicOverride('farewell', { fade: 2.5 });
    setInputEnabled(false, 'cutscene');
    await scene(`
      <div class="tt-sky tt-sunset"><div class="tt-sun">🌇</div></div>
      <div class="cs-caption">
        <div class="cs-cap-de">Die Sonne geht über der Elbe unter. Leni und Felix gehen schon nach Hause.</div>
        <div class="cs-cap-id">Matahari terbenam di atas Elbe. Leni dan Felix sudah pulang duluan.</div>
      </div>`, 1400, 'cs-sunset');
    await reloadHere();
    await sleepSkippable(2200);
    await closeOverlay();
    setInputEnabled(true, 'cutscene');
  },
};

/** Muat ulang zona sekarang di posisi pemain (mis. siang → malam). */
async function reloadHere() {
  const zone = window.__currentZoneId__;
  const p = Game.player?.position;
  if (!zone || !p) return;
  const facing = window.__PLAYER__?.facing ?? 0;
  await loadZoneUnder(zone, { x: p.x, z: p.z, facing });
}

export const Cutscene = {
  async play(name) {
    const fn = SCENES[name];
    if (!fn) return;
    logActivity('cutscene', { name });
    try { await fn(); }
    finally {
      if (Dialog.isOpen) skipDialog();
      if (root) await closeOverlay();
      setInputEnabled(true, 'cutscene');
      if (name !== 'finale') setMusicOverride(null, { fade: 2 });
    }
  },
  async transition(type) {
    const fn = TRANSITIONS[type];
    if (!fn) return;
    logActivity('cutscene', { name: type, transition: true });
    try { await fn(); }
    finally {
      if (root) await closeOverlay();
      setInputEnabled(true, 'cutscene');
      setMusicOverride(null, { fade: 2.5 });
    }
  },
};

if (typeof window !== 'undefined') window.__Cutscene__ = Cutscene;
