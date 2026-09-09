// ═══════════════════════════════════════════════════════════════════
// js/story.js — STORY-INTRO (Prolog im Stil einer alten Handschrift)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Läuft zwischen Hauptmenü und Gameplay:
//   'menu:start'  →  Prolog öffnen
//   Los geht's! / Überspringen  →  'game:start' + Spielfläche einblenden
//
// Gestaltung: Pergamentrolle im Fackellicht, Goldornamente, Kapitel in
// römischen Ziffern. Die Texte selbst sind unverändert übernommen.
//
// Bedienung: ← → blättern, Enter/Leertaste weiter, ESC überspringen.
// Die Buttons klingen wie im Hauptmenü (js/sfx.js).
// ═══════════════════════════════════════════════════════════════════

import { playSfx } from './sfx.js';

const SLIDES = [
  {
    numeral: 'I',
    icon: '✈️',
    heading: 'Hamburg, Deutschland',
    text: `Setelah 10 tahun tidak berkunjung, <strong>Lukas</strong> — seorang remaja Indonesia —
           akhirnya kembali ke kota Hamburg untuk menemui kakek dan neneknya.`,
  },
  {
    numeral: 'II',
    icon: '🏡',
    heading: 'Haus der Großeltern',
    text: `Di rumah kakek-nenek yang hangat, Oma Helga dan Opa Klaus sudah menunggu
           dengan masakan khas Jerman dan cerita-cerita lama.`,
  },
  {
    numeral: 'III',
    icon: '🗺️',
    heading: 'Ein neues Abenteuer',
    text: `Bersama keluarga dan teman masa kecil, Lukas akan menjelajahi kota —
           dari supermarket hingga pelabuhan Elbe — sambil belajar bahasa Jerman
           melalui petualangan seru!`,
  },
  {
    numeral: 'IV',
    icon: '📖',
    heading: 'Bist du bereit?',
    text: `10 quest menanti. Bicaralah dengan penduduk, jelajahi setiap sudut kota,
           dan buktikan bahwa bahasa Jerman itu menyenangkan!`,
  },
];

const TURN_MS = 240;   // Dauer des "Umblätterns"


export const Story = {
  root:    null,
  index:   0,
  isOpen:  false,
  isTurning: false,
  _initialized: false,
  _finished: false,
};


// ═══════════════════════════════════════════════════════════════════
// TEMPLATE
// ═══════════════════════════════════════════════════════════════════

function render() {
  Story.root.innerHTML = `
    <div class="story-scene" aria-hidden="true">
      <span class="story-torch story-torch-left"></span>
      <span class="story-torch story-torch-right"></span>
      <span class="story-dust"></span>
    </div>

    <button type="button" class="story-skip" id="story-skip">Überspringen ⏭</button>

    <div class="story-stage">
      <article class="story-scroll" id="story-scroll">
        <span class="story-corner story-corner-tl" aria-hidden="true"></span>
        <span class="story-corner story-corner-tr" aria-hidden="true"></span>
        <span class="story-corner story-corner-bl" aria-hidden="true"></span>
        <span class="story-corner story-corner-br" aria-hidden="true"></span>

        <div class="story-page" id="story-page" aria-live="polite">
          ${pageMarkup(0)}
        </div>
      </article>

      <nav class="story-nav" aria-label="Prolog">
        <button type="button" class="story-btn story-btn-ghost" id="story-prev">
          <span aria-hidden="true">‹</span> Zurück
        </button>

        <ol class="story-marks" id="story-marks">
          ${SLIDES.map((s, i) => `
            <li>
              <button type="button" class="story-mark ${i === 0 ? 'is-current' : ''}"
                      data-goto="${i}" aria-label="Kapitel ${s.numeral}"
                      aria-current="${i === 0}">${s.numeral}</button>
            </li>
          `).join('')}
        </ol>

        <button type="button" class="story-btn story-btn-primary" id="story-next">
          Weiter <span aria-hidden="true">›</span>
        </button>
      </nav>

      <p class="story-keyhint">
        <kbd>←</kbd><kbd>→</kbd> blättern &nbsp;·&nbsp; <kbd>Enter</kbd> weiter &nbsp;·&nbsp; <kbd>ESC</kbd> überspringen
      </p>
    </div>
  `;
}

/**
 * Die Initiale darf nur auf einen Buchstaben fallen. Beginnt der Text
 * mit einer Ziffer, würde sie die Zahl zerreißen ("10 quest" wird sonst
 * als großes "1" plus "0 quest" gelesen) — dann bleibt sie weg.
 */
function startsWithLetter(html) {
  const plain = html.replace(/<[^>]*>/g, '').trimStart();
  return /^[\p{L}]/u.test(plain);
}

function pageMarkup(i) {
  const s = SLIDES[i];
  return `
    <p class="story-chapter">
      <span class="story-rule" aria-hidden="true"></span>
      Kapitel ${s.numeral}
      <span class="story-rule" aria-hidden="true"></span>
    </p>
    <div class="story-medallion" aria-hidden="true"><span>${s.icon}</span></div>
    <h2 class="story-heading">${s.heading}</h2>
    <p class="story-text${startsWithLetter(s.text) ? ' has-initial' : ''}">${s.text}</p>
  `;
}


// ═══════════════════════════════════════════════════════════════════
// BLÄTTERN
// ═══════════════════════════════════════════════════════════════════

function goTo(next, dir = next > Story.index ? 1 : -1) {
  if (Story.isTurning) return;
  next = Math.max(0, Math.min(SLIDES.length - 1, next));
  if (next === Story.index) return;

  const page = Story.root.querySelector('#story-page');
  Story.isTurning = true;
  Story.index = next;

  page.classList.remove('is-entering');
  page.classList.add(dir > 0 ? 'is-leaving-left' : 'is-leaving-right');

  setTimeout(() => {
    page.innerHTML = pageMarkup(Story.index);
    page.classList.remove('is-leaving-left', 'is-leaving-right');
    page.classList.add(dir > 0 ? 'is-entering-right' : 'is-entering-left');

    requestAnimationFrame(() => {
      page.classList.remove('is-entering-right', 'is-entering-left');
      page.classList.add('is-entering');
      Story.isTurning = false;
    });

    syncNav();
  }, TURN_MS);
}

function syncNav() {
  const root  = Story.root;
  const first = Story.index === 0;
  const last  = Story.index === SLIDES.length - 1;

  const prev = root.querySelector('#story-prev');
  prev.disabled = first;
  prev.setAttribute('aria-disabled', String(first));

  const next = root.querySelector('#story-next');
  next.innerHTML = last
    ? `Los geht's! <span aria-hidden="true">🎮</span>`
    : `Weiter <span aria-hidden="true">›</span>`;
  next.classList.toggle('story-btn-seal', last);

  root.querySelectorAll('.story-mark').forEach((b, i) => {
    const on = i === Story.index;
    b.classList.toggle('is-current', on);
    b.classList.toggle('is-done', i < Story.index);
    b.setAttribute('aria-current', String(on));
  });
}


// ═══════════════════════════════════════════════════════════════════
// AKTIONEN
// ═══════════════════════════════════════════════════════════════════

function next() {
  if (Story.index === SLIDES.length - 1) { playSfx('select'); finish(); return; }
  playSfx('select');
  goTo(Story.index + 1, 1);
}

function prev() {
  if (Story.index === 0) return;
  playSfx('back');
  goTo(Story.index - 1, -1);
}

function skip() {
  playSfx('back');
  finish();
}

/** Prolog beenden und das Spiel einblenden. */
function finish() {
  if (Story._finished) return;
  Story._finished = true;
  Story.isOpen = false;

  Story.root.classList.add('story-closing');

  setTimeout(() => {
    Story.root.style.display = 'none';
    Story.root.setAttribute('aria-hidden', 'true');
  }, 420);

  window.dispatchEvent(new CustomEvent('game:start'));

  const container = document.getElementById('game-container');
  if (container) {
    container.setAttribute('aria-hidden', 'false');
    container.classList.add('game-container-active');
  }
}


// ═══════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════

function bindEvents() {
  const root = Story.root;

  root.querySelector('#story-next')?.addEventListener('click', next);
  root.querySelector('#story-prev')?.addEventListener('click', prev);
  root.querySelector('#story-skip')?.addEventListener('click', skip);

  // Kapitelmarken direkt anspringen
  root.querySelector('#story-marks')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    const target = parseInt(btn.dataset.goto, 10);
    if (target === Story.index) return;
    playSfx('select');
    goTo(target);
  });

  // Hover klingt wie im Hauptmenü
  root.addEventListener('mouseover', (e) => {
    if (!Story.isOpen) return;
    if (e.target.closest('.story-btn, .story-mark, .story-skip')) playSfx('hover');
  });

  window.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (!Story.isOpen) return;

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault(); next(); break;
    case 'ArrowLeft':
      e.preventDefault(); prev(); break;
    case 'Enter':
    case ' ':
      // Auf einem Button erledigt das der Browser selbst
      if (!e.target.closest?.('button')) { e.preventDefault(); next(); }
      break;
    case 'Escape':
      e.preventDefault(); skip(); break;
  }
}


// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function initStory(root = document.getElementById('story-intro')) {
  if (!root || Story._initialized) return Story;

  Story.root = root;
  render();
  bindEvents();
  syncNav();

  Story._initialized = true;
  return Story;
}

export function openStory() {
  if (!Story._initialized) initStory();
  if (!Story.root || Story.isOpen || Story._finished) return;

  Story.index  = 0;
  Story.isOpen = true;
  Story.root.style.display = 'flex';
  Story.root.setAttribute('aria-hidden', 'false');

  Story.root.querySelector('#story-page').innerHTML = pageMarkup(0);
  syncNav();

  requestAnimationFrame(() => {
    Story.root.classList.add('story-open');
    Story.root.querySelector('#story-next')?.focus({ preventScroll: true });
  });
}


// ═══════════════════════════════════════════════════════════════════
// AUTO-INIT
// ═══════════════════════════════════════════════════════════════════

function boot() {
  initStory();
  window.addEventListener('menu:start', openStory);
  window.LukasStory = { open: openStory, state: Story };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
