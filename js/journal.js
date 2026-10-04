// ═══════════════════════════════════════════════════════════════════
// js/journal.js — REISETAGEBUCH (buku harian perjalanan, tombol TAB)
//
// Tiga tab:
//   📍 Aufgabe  — quest sekarang: tujuan, daftar langkah (✓), petunjuk dan
//                 teks rute/instruksi yang bisa dibaca ulang kapan saja
//   📓 Tagebuch — satu catatan per quest yang sudah dimulai (+ cap "erledigt")
//   📖 Wörter   — kosakata yang sudah dipelajari, dengan terjemahan
// ═══════════════════════════════════════════════════════════════════

import { getQuest, QUEST_ORDER, questNumber } from './data/quests.js';
import { JOURNAL_ENTRIES } from './data/dialogs.js';
import { setInputEnabled } from './player.js';

const TABS = [
  { id: 'aufgabe',  label: 'Aufgabe',  icon: '📍' },
  { id: 'tagebuch', label: 'Tagebuch', icon: '📓' },
  { id: 'woerter',  label: 'Wörter',   icon: '📖' },
];

// Terjemahan kosakata hadiah quest (data/quests.js reward.vocab_unlock)
const VOCAB_ID = {
  'die Küche': 'dapur', 'die Pfanne': 'wajan', 'der Teller': 'piring', 'die Eier': 'telur',
  'die Wurst': 'sosis', 'das Besteck': 'alat makan', 'der Küchentisch': 'meja dapur',
  'der Serviertisch': 'meja saji', 'das Bett': 'tempat tidur', 'der Tisch': 'meja',
  'die Schule': 'sekolah', 'das Gebäude': 'gedung', 'abholen': 'menjemput', 'der Brief': 'surat',
  'der Supermarkt': 'supermarket', 'die Kartoffeln': 'kentang', 'das Fleisch': 'daging',
  'der Salat': 'selada', 'die Butter': 'mentega', 'der Park': 'taman', 'die Bibliothek': 'perpustakaan',
  'der Bus': 'bus', 'sich verlaufen': 'tersesat', 'rechts': 'kanan', 'das Kino': 'bioskop',
  'der Film': 'film', 'die Hauptstraße': 'jalan utama', 'die bunten Lichter': 'lampu warna-warni',
  'das Restaurant': 'restoran', 'bestellen': 'memesan', 'die Rechnung': 'tagihan', 'der Fluss': 'sungai',
  'der Spaziergang': 'jalan-jalan', 'die Erinnerung': 'kenangan', 'danke': 'terima kasih',
};

const esc = (t) => String(t ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const nl2br = (t) => String(t || '').replace(/\n/g, '<br>');

export const Journal = {
  quests: null,       // QuestSystem
  tab: 'aufgabe',
  selected: null,     // quest id yang dibuka di tab Tagebuch
  unread: false,
  root: null,

  init(questSystem) {
    this.quests = questSystem;
    this.root = document.getElementById('reisetagebuch');
    if (!this.root || this.root._wired) return;
    this.root._wired = true;
    this.root.innerHTML = `
      <div class="rtb-book" role="dialog" aria-label="Reisetagebuch">
        <div class="rtb-tabs" role="tablist">
          ${TABS.map(t => `<button type="button" class="rtb-tab" role="tab" data-tab="${t.id}">
            <span class="rtb-tab-icon">${t.icon}</span>${t.label}</button>`).join('')}
        </div>
        <div class="rtb-spread">
          <section class="rtb-page rtb-left" id="rtb-left"></section>
          <section class="rtb-page rtb-right" id="rtb-right"></section>
        </div>
        <div class="rtb-foot"><kbd>Tab</kbd> / <kbd>Esc</kbd> schließen</div>
        <button type="button" id="reisetagebuch-close" class="reisetagebuch-close" aria-label="Schließen">×</button>
      </div>`;
    this.root.querySelectorAll('.rtb-tab').forEach(btn =>
      btn.addEventListener('click', () => { this.tab = btn.dataset.tab; this.render(); }));
    this.root.querySelector('#reisetagebuch-close').addEventListener('click', () => this.toggle(false));
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.toggle(false);
      const entry = e.target.closest('[data-entry]');
      if (entry) { this.selected = entry.dataset.entry; this.render(); }
    });
    // Esc menutup buku (bukan membuka menu pause)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isOpen()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.toggle(false);
      }
    }, true);
  },

  reset() {
    this.tab = 'aufgabe';
    this.selected = null;
    this.setUnread(false);
  },

  isOpen() {
    return !!this.root && !this.root.classList.contains('hud-hidden');
  },

  toggle(force) {
    if (!this.root) return;
    const open = force === undefined ? !this.isOpen() : !!force;
    if (open && document.getElementById('dialog-box')?.classList.contains('hud-hidden') === false) return;
    this.root.classList.toggle('hud-hidden', !open);
    this.root.setAttribute('aria-hidden', String(!open));
    setInputEnabled(!open);
    if (open) {
      this.setUnread(false);
      this.render();
    }
  },

  onQuestStart(quest) {
    this.selected = quest.id;
    this.setUnread(true);
    this.refresh();
  },

  onQuestComplete(quest) {
    this.selected = quest.id;
    this.setUnread(true);
    this.refresh();
  },

  refresh() {
    if (this.isOpen()) this.render();
  },

  /** Titik merah di tombol/hint bila ada catatan baru. */
  setUnread(on) {
    this.unread = on;
    document.body.classList.toggle('journal-unread', on);
  },

  // ─────────────────────────────────────────────────────────────────
  render() {
    if (!this.root) return;
    this.root.querySelectorAll('.rtb-tab').forEach(b => {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    const left = this.root.querySelector('#rtb-left');
    const right = this.root.querySelector('#rtb-right');
    const [l, r] = this.tab === 'tagebuch' ? this.renderDiary()
      : this.tab === 'woerter' ? this.renderWords()
      : this.renderTask();
    left.innerHTML = l;
    right.innerHTML = r;
    left.scrollTop = 0;
    right.scrollTop = 0;
  },

  /** Quest yang sudah dimulai/selesai, urut. */
  startedQuests() {
    const qs = window.__questState__ || {};
    return QUEST_ORDER.filter(id => qs[id] === 'active' || qs[id] === 'completed').map(getQuest);
  },

  renderTask() {
    const sys = this.quests;
    const quest = getQuest(sys?.activeQuestId);
    if (!quest) {
      const done = this.startedQuests().filter(q => window.__questState__?.[q.id] === 'completed').length;
      return [
        `<h2 class="rtb-h">Mein Reisetagebuch</h2>
         <p class="rtb-muted">Gerade gibt es keine Aufgabe.</p>`,
        `<div class="rtb-progress-big">${done} / ${QUEST_ORDER.length}</div>
         <p class="rtb-muted rtb-center">Quests abgeschlossen</p>`,
      ];
    }
    const n = questNumber(quest.id);
    const steps = quest.steps.map((s, i) => {
      const state = i < sys.activeStep ? 'done' : i === sys.activeStep ? 'now' : 'todo';
      return `<li class="rtb-step rtb-step-${state}">
        <span class="rtb-step-dot">${state === 'done' ? '✓' : i + 1}</span>
        <span class="rtb-step-text">${esc(s.description)}
          ${state === 'now' && s.hint ? `<span class="rtb-step-hint">${esc(s.hint)}</span>` : ''}</span>
      </li>`;
    }).join('');
    const step = quest.steps[sys.activeStep];
    // Panel instruksi yang masih relevan: langkah sekarang, atau panel terakhir sebelumnya
    let panel = null;
    for (let i = sys.activeStep; i >= 0 && !panel; i--) panel = quest.steps[i]?.panel || null;
    const items = step?.items ? `<div class="rtb-items">${step.items.map(it =>
      `<span class="rtb-item${sys.collectedItems?.has(it.id) ? ' got' : ''}">${it.emoji} ${esc(it.label)}</span>`).join('')}</div>` : '';
    return [
      `<div class="rtb-kicker">Quest ${n} / ${QUEST_ORDER.length}</div>
       <h2 class="rtb-h">${esc(quest.title)}</h2>
       <div class="rtb-sub">${esc(quest.subtitle || '')}</div>
       <p class="rtb-desc">${esc(quest.description || '')}</p>
       <div class="rtb-progress"><span style="width:${Math.round(sys.activeStep / quest.steps.length * 100)}%"></span></div>
       <ol class="rtb-steps">${steps}</ol>`,
      `${step ? `<div class="rtb-now">
          <div class="rtb-now-label">Jetzt</div>
          <div class="rtb-now-text">${step.icon || '🎯'} ${esc(step.description)}</div>
        </div>` : ''}
       ${items}
       ${panel ? `<div class="rtb-note">
          <div class="rtb-note-title">${esc(panel.title)}</div>
          <div class="rtb-note-body">${panel.html}</div>
        </div>` : `<p class="rtb-muted">Tipp: Der 💡-Knopf unten rechts zeigt einen Hinweis.</p>`}`,
    ];
  },

  renderDiary() {
    const qs = window.__questState__ || {};
    const started = this.startedQuests();
    if (!started.length) {
      return [`<h2 class="rtb-h">Tagebuch</h2><p class="rtb-muted">Noch keine Einträge.</p>`, ''];
    }
    if (!started.some(q => q.id === this.selected)) this.selected = started[started.length - 1].id;
    const list = started.map(q => {
      const done = qs[q.id] === 'completed';
      return `<button type="button" class="rtb-entry${q.id === this.selected ? ' active' : ''}" data-entry="${q.id}">
        <span class="rtb-entry-num">${questNumber(q.id)}</span>
        <span class="rtb-entry-title">${esc(q.title)}</span>
        <span class="rtb-entry-state">${done ? '✓' : '…'}</span>
      </button>`;
    }).join('');
    const quest = getQuest(this.selected);
    const entry = JOURNAL_ENTRIES[quest?.reward?.journal_entry] || null;
    const done = qs[quest.id] === 'completed';
    const words = (entry?.words || []).map(([de, id]) =>
      `<span class="rtb-word"><b>${esc(de)}</b> — ${esc(id)}</span>`).join('');
    return [
      `<h2 class="rtb-h">Tagebuch</h2>
       <p class="rtb-muted">Hamburg, Sommerferien</p>
       <div class="rtb-entries">${list}</div>`,
      `<div class="rtb-entry-page">
        ${done ? '<div class="rtb-stamp">erledigt</div>' : ''}
        <div class="rtb-kicker">Quest ${questNumber(quest.id)}</div>
        <h3 class="rtb-h3">${esc(entry?.title || quest.title)}</h3>
        <div class="rtb-sub">${esc(entry?.subtitle || quest.subtitle || '')}</div>
        <div class="rtb-body">${nl2br(entry?.body || quest.description)}</div>
        ${done && entry?.done ? `<div class="rtb-done">${nl2br(entry.done)}</div>` : ''}
        ${words ? `<div class="rtb-words-mini">${words}</div>` : ''}
      </div>`,
    ];
  },

  renderWords() {
    const qs = window.__questState__ || {};
    const map = new Map();
    for (const q of this.startedQuests()) {
      const entry = JOURNAL_ENTRIES[q.reward?.journal_entry];
      for (const [de, id] of entry?.words || []) if (!map.has(de)) map.set(de, id);
      if (qs[q.id] === 'completed') {
        for (const de of q.reward?.vocab_unlock || []) if (!map.has(de)) map.set(de, VOCAB_ID[de] || '');
      }
    }
    const all = [...map.entries()];
    if (!all.length) return [`<h2 class="rtb-h">Wörter</h2><p class="rtb-muted">Noch keine Wörter.</p>`, ''];
    const half = Math.ceil(all.length / 2);
    const card = ([de, id]) => `<div class="rtb-vocab"><span class="rtb-vocab-de">${esc(de)}</span>${id ? `<span class="rtb-vocab-id">${esc(id)}</span>` : ''}</div>`;
    return [
      `<h2 class="rtb-h">Wörter <span class="rtb-count">${all.length}</span></h2>
       <div class="rtb-vocab-list">${all.slice(0, half).map(card).join('')}</div>`,
      `<div class="rtb-vocab-list rtb-vocab-right">${all.slice(half).map(card).join('')}</div>`,
    ];
  },
};
