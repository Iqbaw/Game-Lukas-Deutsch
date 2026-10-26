// ═══════════════════════════════════════════════════════════════════
// js/latihan.js — LATIHAN SOAL (Wechselpräpositionen)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Terbuka setelah Quest 10 (kartu finale, js/cutscene.js) dan dari
// Hauptmenü. Siswa membaca Lesetext dan memilih satu jawaban per soal.
//
// SENGAJA tanpa umpan balik: tidak ada benar/salah, tidak ada skor.
// Siswa hanya menjawab, mundur/maju, lalu mengirim. Penilaian otomatis
// terjadi di database (quiz_submit, supabase/schema.sql) dan hasilnya
// hanya terlihat oleh Admin & di Google Sheets.
//
// Jawaban tersimpan otomatis (localStorage per pemain + draft online),
// jadi refresh atau pindah perangkat tidak menghapus pekerjaan siswa.
//
// Bewusst OHNE Three.js-Abhängigkeiten: öffnet auch aus dem Hauptmenü.
// ═══════════════════════════════════════════════════════════════════

import { LATIHAN_PARTS, LATIHAN_QUESTIONS, LATIHAN_TOTAL, OPTION_LETTERS } from './data/latihan.js';
import { currentPlayer, readQuizState, writeQuizState, queueQuizDraft, submitQuiz, cloudEnabled } from './cloud.js';
import { playSfx } from './sfx.js';
import { logActivity } from './activitylog.js';

const MOBILE_QUERY = '(max-width: 860px)';

const L = {
  root:     null,
  open:     false,
  screen:   'intro',    // intro | quiz | review | done
  index:    0,          // aktuelle Frage (0 … 19)
  answers:  {},         // { "1": 3, … }  0 = A
  seenPart: new Set(),
  tab:      'question', // mobil: 'text' | 'question'
  sending:  false,
  error:    null,
  onClose:  null,
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const answeredCount = () => LATIHAN_QUESTIONS.filter((q) => Number.isInteger(L.answers[q.n])).length;
const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches;


// ═══════════════════════════════════════════════════════════════════
// ZUSTAND
// ═══════════════════════════════════════════════════════════════════

function loadState() {
  const s = readQuizState();
  L.answers = {};
  for (const [k, v] of Object.entries(s.answers || {})) {
    if (Number.isInteger(v) && v >= 0 && v < OPTION_LETTERS.length) L.answers[k] = v;
  }
  L.index = Math.max(0, Math.min(LATIHAN_TOTAL - 1, Number(s.current) || 0));
  return s;
}

function persist() {
  const s = readQuizState();
  writeQuizState({ ...s, answers: { ...L.answers }, current: L.index });
  queueQuizDraft({ ...L.answers });
}


// ═══════════════════════════════════════════════════════════════════
// MARKUP
// ═══════════════════════════════════════════════════════════════════

function shell() {
  return `
    <div class="lt-backdrop" aria-hidden="true"></div>
    <div class="lt-frame" id="lt-frame"></div>
    <div class="lt-modal" id="lt-modal" hidden></div>`;
}

function topBar({ progress = true } = {}) {
  const done = answeredCount();
  const pct = Math.round((done / LATIHAN_TOTAL) * 100);
  return `
    <header class="lt-top">
      <div class="lt-brand">
        <span class="lt-eyebrow">Latihan Soal</span>
        <span class="lt-brand-title">Wechselpräpositionen</span>
      </div>
      ${progress ? `
        <div class="lt-progress" aria-label="${done} von ${LATIHAN_TOTAL} Fragen beantwortet">
          <div class="lt-progress-track"><span class="lt-progress-fill" style="width:${pct}%"></span></div>
          <span class="lt-progress-label"><b>${done}</b> / ${LATIHAN_TOTAL} beantwortet</span>
        </div>` : '<span></span>'}
      <button type="button" class="lt-close" data-act="close" title="Jawaban tersimpan otomatis"
              aria-label="${progress ? 'Pause — Antworten bleiben gespeichert' : 'Schließen'}">
        <span aria-hidden="true">✕</span><span class="lt-close-text">${progress ? 'Pause' : 'Schließen'}</span>
      </button>
    </header>`;
}

function introScreen(state) {
  const player = currentPlayer();
  const done = answeredCount();
  const resume = done > 0;
  return `
    ${topBar({ progress: false })}
    <main class="lt-center">
      <section class="lt-card lt-intro" aria-labelledby="lt-intro-title">
        <div class="lt-intro-badge" aria-hidden="true">✎</div>
        <p class="lt-kicker">${player ? `Hallo, ${esc(player.name)}!` : 'Hallo!'}</p>
        <h1 class="lt-intro-title" id="lt-intro-title">Latihan Soal</h1>
        <p class="lt-intro-sub">Wechselpräpositionen · <i>in, auf, unter, an, neben …</i></p>

        <ul class="lt-facts">
          <li><span aria-hidden="true">📖</span><b>2</b> Lesetexte</li>
          <li><span aria-hidden="true">❓</span><b>${LATIHAN_TOTAL}</b> Fragen</li>
          <li><span aria-hidden="true">⏳</span>ohne Zeitlimit</li>
        </ul>

        <ol class="lt-rules">
          <li><b>Lies den Text</b> genau. <span>Baca teksnya dengan teliti.</span></li>
          <li><b>Wähle eine Antwort</b> (A–E) pro Frage. <span>Pilih satu jawaban untuk setiap soal.</span></li>
          <li><b>Zurück &amp; Weiter</b> — du kannst jederzeit ändern. <span>Jawaban bisa diubah sebelum dikirim.</span></li>
          <li><b>Automatisch gespeichert.</b> Am Ende: <b>Abgeben</b>. <span>Tersimpan otomatis. Nilai tidak ditampilkan.</span></li>
        </ol>

        <button type="button" class="lt-btn lt-btn-primary lt-btn-lg" data-act="start">
          ${resume ? `Weitermachen · ${done}/${LATIHAN_TOTAL}` : 'Los geht\'s'} <span aria-hidden="true">→</span>
        </button>
        ${state.pendingSubmit ? '<p class="lt-note lt-note-warn">Deine Abgabe wurde noch nicht gesendet. Bitte unten erneut abgeben.</p>' : ''}
      </section>
    </main>`;
}

function textCard(part, { fresh = false } = {}) {
  return `
    <article class="lt-text ${fresh ? 'is-fresh' : ''}" id="lt-text" lang="de" aria-label="Lesetext ${part.label}">
      <div class="lt-text-scroll" tabindex="0">
        <p class="lt-text-label"><span>${part.subtitle}</span>${fresh ? '<em class="lt-new">Neuer Text</em>' : ''}</p>
        <h2 class="lt-text-title">${part.title}</h2>
        ${part.text.map((t) => `<p class="lt-text-p">${esc(t)}</p>`).join('')}
        <p class="lt-text-instr">${part.instruction}</p>
        <button type="button" class="lt-btn lt-to-question" data-tab="question">Zur Frage <span aria-hidden="true">→</span></button>
      </div>
    </article>`;
}

function questionCard(q) {
  const part = LATIHAN_PARTS[q.part];
  const picked = L.answers[q.n];
  return `
    <section class="lt-qcard" id="lt-qcard" aria-labelledby="lt-q-title">
      <p class="lt-qmeta">
        <span class="lt-qpart">${part.label} · ${part.title}</span>
        <span class="lt-qcount">Frage <b>${L.index + 1}</b> von ${LATIHAN_TOTAL}</span>
      </p>
      <h3 class="lt-q" id="lt-q-title"><span class="lt-qnum">${q.n}.</span> ${esc(q.q)}</h3>
      <div class="lt-options" role="radiogroup" aria-labelledby="lt-q-title">
        ${q.options.map((opt, i) => `
          <button type="button" class="lt-opt ${picked === i ? 'is-picked' : ''}" role="radio"
                  aria-checked="${picked === i}" data-opt="${i}" tabindex="${picked === i || (picked === undefined && i === 0) ? 0 : -1}">
            <span class="lt-opt-letter" aria-hidden="true">${OPTION_LETTERS[i]}</span>
            <span class="lt-opt-text">${esc(opt)}</span>
            <span class="lt-opt-mark" aria-hidden="true"></span>
          </button>`).join('')}
      </div>
      <p class="lt-keys"><kbd>A</kbd>–<kbd>E</kbd> wählen &nbsp;·&nbsp; <kbd>←</kbd> <kbd>→</kbd> blättern</p>
    </section>`;
}

function dots() {
  return LATIHAN_PARTS.map((part, p) => `
    <div class="lt-dots-group" role="group" aria-label="${part.label}">
      ${LATIHAN_QUESTIONS.filter((q) => q.part === p).map((q) => {
        const i = LATIHAN_QUESTIONS.indexOf(q);
        const answered = Number.isInteger(L.answers[q.n]);
        return `<button type="button" class="lt-dot ${answered ? 'is-done' : ''} ${i === L.index ? 'is-current' : ''}"
                  data-go="${i}" aria-label="Frage ${q.n}${answered ? ', beantwortet' : ''}"
                  ${i === L.index ? 'aria-current="step"' : ''}>${q.n}</button>`;
      }).join('')}
    </div>`).join('<span class="lt-dots-sep" aria-hidden="true"></span>');
}

function quizScreen() {
  const q = LATIHAN_QUESTIONS[L.index];
  const part = LATIHAN_PARTS[q.part];
  const fresh = !L.seenPart.has(q.part) && q.part > 0;
  L.seenPart.add(q.part);
  const last = L.index === LATIHAN_TOTAL - 1;
  return `
    ${topBar()}
    <div class="lt-tabs" role="tablist" aria-label="Ansicht">
      <button type="button" role="tab" class="lt-tab ${L.tab === 'text' ? 'is-on' : ''}" data-tab="text" aria-selected="${L.tab === 'text'}">📖 Text</button>
      <button type="button" role="tab" class="lt-tab ${L.tab === 'question' ? 'is-on' : ''}" data-tab="question" aria-selected="${L.tab === 'question'}">❓ Frage ${L.index + 1}</button>
    </div>
    <main class="lt-main" data-tab="${L.tab}">
      ${textCard(part, { fresh })}
      ${questionCard(q)}
    </main>
    <footer class="lt-nav">
      <button type="button" class="lt-btn lt-btn-ghost" data-act="prev" ${L.index === 0 ? 'disabled' : ''}>
        <span aria-hidden="true">←</span> Zurück
      </button>
      <div class="lt-dots" aria-label="Fragenübersicht">${dots()}</div>
      <button type="button" class="lt-btn lt-btn-compact lt-btn-ghost lt-overview-btn" data-act="review" aria-label="Übersicht">
        ${L.index + 1}<span>/${LATIHAN_TOTAL}</span>
      </button>
      <button type="button" class="lt-btn lt-btn-primary" data-act="${last ? 'review' : 'next'}">
        ${last ? 'Überprüfen' : 'Weiter'} <span aria-hidden="true">→</span>
      </button>
    </footer>`;
}

function reviewScreen() {
  const done = answeredCount();
  const open = LATIHAN_TOTAL - done;
  return `
    ${topBar()}
    <main class="lt-center">
      <section class="lt-card lt-review" aria-labelledby="lt-review-title">
        <p class="lt-kicker">${open === 0 ? 'Alles beantwortet' : 'Fast geschafft'}</p>
        <h2 class="lt-review-title" id="lt-review-title">Übersicht deiner Antworten</h2>
        <p class="lt-review-sub">${open === 0
          ? 'Kamu sudah menjawab semua soal. Periksa sekali lagi, lalu kirim.'
          : `Masih ada <b>${open}</b> soal yang belum dijawab. Klik nomornya untuk kembali.`}</p>

        ${LATIHAN_PARTS.map((part, p) => `
          <div class="lt-review-part">
            <p class="lt-review-part-label">${part.label} · ${part.title}</p>
            <div class="lt-review-grid">
              ${LATIHAN_QUESTIONS.filter((q) => q.part === p).map((q) => {
                const a = L.answers[q.n];
                const has = Number.isInteger(a);
                return `<button type="button" class="lt-tile ${has ? 'is-done' : 'is-open'}" data-go="${LATIHAN_QUESTIONS.indexOf(q)}"
                          aria-label="Frage ${q.n}: ${has ? `Antwort ${OPTION_LETTERS[a]}` : 'nicht beantwortet'}">
                  <span class="lt-tile-n">${q.n}</span>
                  <span class="lt-tile-a">${has ? OPTION_LETTERS[a] : '—'}</span>
                </button>`;
              }).join('')}
            </div>
          </div>`).join('')}

        ${L.error ? `<p class="lt-note lt-note-warn" role="alert">${esc(L.error)}</p>` : ''}

        <div class="lt-review-actions">
          <button type="button" class="lt-btn lt-btn-ghost" data-act="back-to-quiz"><span aria-hidden="true">←</span> Zurück zu den Fragen</button>
          <button type="button" class="lt-btn lt-btn-primary lt-btn-lg" data-act="confirm" ${L.sending ? 'disabled' : ''}>
            ${L.sending ? 'Wird gesendet …' : 'Abgeben'} <span aria-hidden="true">✓</span>
          </button>
        </div>
      </section>
    </main>`;
}

function doneScreen({ already = false } = {}) {
  const player = currentPlayer();
  return `
    ${topBar({ progress: false })}
    <main class="lt-center">
      <section class="lt-card lt-done" aria-labelledby="lt-done-title">
        <div class="lt-done-seal" aria-hidden="true"><span>✓</span></div>
        <h2 class="lt-done-title" id="lt-done-title">Vielen Dank${player ? `, ${esc(player.name)}` : ''}!</h2>
        <p class="lt-done-de">${already ? 'Du hast die Latihan Soal schon abgegeben.' : 'Deine Antworten wurden gespeichert.'}</p>
        <p class="lt-done-id">Jawabanmu sudah ${already ? 'terkirim sebelumnya' : 'terkirim'} dan akan diperiksa oleh guru.</p>
        <p class="lt-done-note">Bis bald in Hamburg! 👋</p>
        <button type="button" class="lt-btn lt-btn-primary lt-btn-lg" data-act="close">Schließen</button>
      </section>
    </main>`;
}

function confirmModal() {
  const open = LATIHAN_TOTAL - answeredCount();
  return `
    <div class="lt-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="lt-confirm-title" aria-describedby="lt-confirm-text">
      <h3 class="lt-modal-title" id="lt-confirm-title">Jetzt abgeben?</h3>
      <p class="lt-modal-text" id="lt-confirm-text">
        ${open > 0 ? `<b>${open} Frage${open > 1 ? 'n' : ''}</b> noch ohne Antwort. ` : ''}
        Setelah dikirim, jawaban <b>tidak bisa diubah</b> lagi.
      </p>
      <div class="lt-modal-actions">
        <button type="button" class="lt-btn lt-btn-ghost" data-act="cancel-confirm">Abbrechen</button>
        <button type="button" class="lt-btn lt-btn-primary" data-act="submit">Ja, abgeben</button>
      </div>
    </div>`;
}


// ═══════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════

function render({ focus = null } = {}) {
  const frame = L.root.querySelector('#lt-frame');
  const state = readQuizState();
  let html;
  if (L.screen === 'intro') html = introScreen(state);
  else if (L.screen === 'quiz') html = quizScreen();
  else if (L.screen === 'review') html = reviewScreen();
  else html = doneScreen({ already: L.alreadyDone });
  frame.innerHTML = html;
  frame.dataset.screen = L.screen;

  if (focus) requestAnimationFrame(() => frame.querySelector(focus)?.focus({ preventScroll: true }));
}

/** Nur die Frage tauschen (ohne die Lesetext-Spalte neu zu laden). */
function goTo(i, { dir = 0 } = {}) {
  const next = Math.max(0, Math.min(LATIHAN_TOTAL - 1, i));
  const prevPart = LATIHAN_QUESTIONS[L.index].part;
  L.index = next;
  persist();
  const nextPart = LATIHAN_QUESTIONS[next].part;
  if (L.screen !== 'quiz' || prevPart !== nextPart) {
    L.screen = 'quiz';
    // Mobil: bei einem neuen Text zuerst den Text zeigen
    if (prevPart !== nextPart && !L.seenPart.has(nextPart)) L.tab = 'text';
    render({ focus: '.lt-opt[tabindex="0"]' });
    return;
  }
  const frame = L.root.querySelector('#lt-frame');
  if (L.tab === 'text' && isMobile()) setTab('question');
  const card = frame.querySelector('#lt-qcard');
  card.outerHTML = questionCard(LATIHAN_QUESTIONS[next]);
  const fresh = frame.querySelector('#lt-qcard');
  if (dir) fresh.classList.add(dir > 0 ? 'enter-next' : 'enter-prev');
  updateChrome();
  if (!isMobile() || L.tab === 'question') fresh.querySelector('.lt-opt[tabindex="0"]')?.focus({ preventScroll: true });
}

function updateChrome() {
  const frame = L.root.querySelector('#lt-frame');
  const done = answeredCount();
  const fill = frame.querySelector('.lt-progress-fill');
  if (fill) fill.style.width = `${Math.round((done / LATIHAN_TOTAL) * 100)}%`;
  const lbl = frame.querySelector('.lt-progress-label');
  if (lbl) lbl.innerHTML = `<b>${done}</b> / ${LATIHAN_TOTAL} beantwortet`;
  const dotsEl = frame.querySelector('.lt-dots');
  if (dotsEl) dotsEl.innerHTML = dots();
  const prev = frame.querySelector('[data-act="prev"]');
  if (prev) prev.disabled = L.index === 0;
  const last = L.index === LATIHAN_TOTAL - 1;
  const next = frame.querySelector('.lt-nav .lt-btn-primary');
  if (next) {
    next.dataset.act = last ? 'review' : 'next';
    next.innerHTML = `${last ? 'Überprüfen' : 'Weiter'} <span aria-hidden="true">→</span>`;
  }
  const ov = frame.querySelector('.lt-overview-btn');
  if (ov) ov.innerHTML = `${L.index + 1}<span>/${LATIHAN_TOTAL}</span>`;
  const tab = frame.querySelector('[data-tab="question"]');
  if (tab) tab.textContent = `❓ Frage ${L.index + 1}`;
}

function pick(i) {
  const q = LATIHAN_QUESTIONS[L.index];
  if (!q || i < 0 || i >= q.options.length) return;
  const changed = L.answers[q.n] !== i;
  L.answers[q.n] = i;
  persist();
  if (changed) playSfx('toggle');
  const card = L.root.querySelector('#lt-qcard');
  card?.querySelectorAll('.lt-opt').forEach((b, j) => {
    const on = j === i;
    b.classList.toggle('is-picked', on);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && changed) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  });
  card?.querySelector(`.lt-opt[data-opt="${i}"]`)?.focus({ preventScroll: true });
  updateChrome();
}


// ═══════════════════════════════════════════════════════════════════
// AKTIONEN
// ═══════════════════════════════════════════════════════════════════

function showModal(html) {
  const m = L.root.querySelector('#lt-modal');
  m.innerHTML = html;
  m.hidden = false;
  requestAnimationFrame(() => m.querySelector('.lt-btn-primary')?.focus());
}

function hideModal() {
  const m = L.root.querySelector('#lt-modal');
  m.hidden = true;
  m.innerHTML = '';
}

async function doSubmit() {
  hideModal();
  if (L.sending) return;
  L.sending = true;
  L.error = null;
  render();
  try {
    await submitQuiz({ ...L.answers });
    try { logActivity('quiz_submit', { answered: answeredCount(), total: LATIHAN_TOTAL }); } catch (_) {}
    playSfx('select');
    L.sending = false;
    L.alreadyDone = false;
    L.screen = 'done';
    render({ focus: '[data-act="close"]' });
  } catch (err) {
    L.sending = false;
    L.error = err?.status === undefined
      ? 'Keine Verbindung. Jawabanmu aman tersimpan di perangkat ini — periksa internet, lalu tekan „Abgeben“ lagi.'
      : 'Senden fehlgeschlagen. Bitte noch einmal „Abgeben“ drücken. · Gagal mengirim, coba lagi.';
    render({ focus: '[data-act="confirm"]' });
  }
}

function setTab(tab) {
  L.tab = tab;
  const main = L.root.querySelector('.lt-main');
  if (main) main.dataset.tab = tab;
  L.root.querySelectorAll('.lt-tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
}

function onClick(e) {
  const t = e.target.closest('[data-act], [data-opt], [data-go], [data-tab]');
  if (!t || t.disabled) return;
  if (t.dataset.opt !== undefined) { pick(Number(t.dataset.opt)); return; }
  if (t.dataset.go !== undefined) {
    playSfx('hover');
    const target = Number(t.dataset.go);
    goTo(target, { dir: Math.sign(target - L.index) });
    return;
  }
  if (t.dataset.tab) {
    playSfx('hover');
    setTab(t.dataset.tab);
    return;
  }
  switch (t.dataset.act) {
    case 'start':
      playSfx('select');
      L.screen = 'quiz';
      L.tab = L.index === 0 || isMobile() ? 'text' : 'question';
      render({ focus: '.lt-opt[tabindex="0"]' });
      break;
    case 'next':
      playSfx('hover');
      goTo(L.index + 1, { dir: 1 });
      break;
    case 'prev':
      playSfx('hover');
      goTo(L.index - 1, { dir: -1 });
      break;
    case 'review':
      playSfx('select');
      L.screen = 'review';
      render({ focus: '[data-act="confirm"]' });
      break;
    case 'back-to-quiz': {
      playSfx('back');
      const firstOpen = LATIHAN_QUESTIONS.findIndex((q) => !Number.isInteger(L.answers[q.n]));
      L.screen = 'quiz';
      L.index = firstOpen >= 0 ? firstOpen : L.index;
      render({ focus: '.lt-opt[tabindex="0"]' });
      break;
    }
    case 'confirm':
      playSfx('select');
      showModal(confirmModal());
      break;
    case 'cancel-confirm':
      playSfx('back');
      hideModal();
      L.root.querySelector('[data-act="confirm"]')?.focus();
      break;
    case 'submit':
      doSubmit();
      break;
    case 'close':
      playSfx('back');
      closeLatihan();
      break;
  }
}

function onKeyDown(e) {
  if (!L.open) return;
  // Spiel, Pausenmenü und Hauptmenü bekommen die Tasten nicht
  e.stopImmediatePropagation();
  const modalOpen = !L.root.querySelector('#lt-modal').hidden;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (modalOpen) hideModal();
    else if (L.screen === 'review') { L.screen = 'quiz'; render({ focus: '.lt-opt[tabindex="0"]' }); }
    else closeLatihan();
    return;
  }
  if (modalOpen || L.screen !== 'quiz') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  const k = e.key.toLowerCase();
  const letter = OPTION_LETTERS.findIndex((l) => l.toLowerCase() === k);
  const digit = /^[1-5]$/.test(k) ? Number(k) - 1 : -1;
  if (letter >= 0 || digit >= 0) { e.preventDefault(); pick(letter >= 0 ? letter : digit); return; }

  const inOptions = e.target?.classList?.contains('lt-opt');
  if (inOptions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    const opts = [...L.root.querySelectorAll('.lt-opt')];
    const i = opts.indexOf(e.target);
    opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]?.focus();
    return;
  }
  if (e.key === 'ArrowRight') { e.preventDefault(); if (L.index < LATIHAN_TOTAL - 1) goTo(L.index + 1, { dir: 1 }); else L.root.querySelector('[data-act="review"]')?.click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); if (L.index > 0) goTo(L.index - 1, { dir: -1 }); }
}

// Pfeiltasten & Buchstaben dürfen das Spiel nicht bewegen
function swallow(e) { if (L.open) e.stopImmediatePropagation(); }


// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function openLatihan({ onClose } = {}) {
  if (!L.root) {
    L.root = document.createElement('div');
    L.root.className = 'lt';
    L.root.id = 'latihan';
    L.root.setAttribute('role', 'dialog');
    L.root.setAttribute('aria-modal', 'true');
    L.root.setAttribute('aria-label', 'Latihan Soal Wechselpräpositionen');
    L.root.innerHTML = shell();
    L.root.addEventListener('click', onClick);
    document.body.appendChild(L.root);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', swallow, true);
  }
  if (L.open) return;

  const state = loadState();
  L.onClose = onClose || null;
  L.error = null;
  L.sending = false;
  L.seenPart = new Set([LATIHAN_QUESTIONS[L.index].part]);
  L.alreadyDone = !!state.submitted;
  L.screen = state.submitted ? 'done' : 'intro';
  L.open = true;
  hideModal();
  render({ focus: state.submitted ? '[data-act="close"]' : '[data-act="start"]' });

  L.root.hidden = false;
  document.body.classList.add('latihan-open');
  requestAnimationFrame(() => L.root.classList.add('is-open'));
  try { logActivity('quiz_open', { answered: answeredCount(), online: cloudEnabled() }); } catch (_) {}
}

export function closeLatihan() {
  if (!L.open) return;
  persist();
  L.open = false;
  L.root.classList.remove('is-open');
  document.body.classList.remove('latihan-open');
  setTimeout(() => { if (!L.open) L.root.hidden = true; }, 320);
  const cb = L.onClose;
  L.onClose = null;
  cb?.({ submitted: readQuizState().submitted });
}

export function isLatihanOpen() { return L.open; }

if (typeof window !== 'undefined') window.LukasLatihan = { open: openLatihan, close: closeLatihan, state: L };
