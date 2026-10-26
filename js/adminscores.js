// ═══════════════════════════════════════════════════════════════════
// js/adminscores.js — ERGEBNISSE ALLER SPIELER (nur Admin-Modus)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Zeigt alle Spieler aus Supabase: Fortschritt im Spiel und Ergebnis der
// Latihan Soal (automatisch korrigiert in der Datenbank). Pro Spieler:
// Latihan zurücksetzen, Fortschritt zurücksetzen, löschen. Dazu Export
// als CSV und Link zur Google-Sheets-Übersicht.
//
// Alle Daten kommen über RPC-Funktionen mit Admin-Passwort
// (supabase/schema.sql) — der Browser der Schüler sieht keine Ergebnisse.
// ═══════════════════════════════════════════════════════════════════

import { CONFIG } from './config.js';
import { adminRpc, cloudEnabled } from './cloud.js';
import { LATIHAN_QUESTIONS, OPTION_LETTERS } from './data/latihan.js';

const View = {
  root:     null,
  open:     false,
  loading:  false,
  error:    null,
  data:     null,       // { key: [...], players: [...] }
  search:   '',
  status:   'all',      // all | submitted | in_progress | none
  sort:     'name',     // name | score_desc | score_asc | recent | quests
  expanded: new Set(),
  canOpen:  () => false,
  onToggle: () => {},
  getPassword: () => null,
  setPassword: () => {},
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  submitted:   { label: 'Selesai',     cls: 'is-done', ic: '✅' },
  in_progress: { label: 'Mengerjakan', cls: 'is-busy', ic: '⏳' },
  none:        { label: 'Belum',       cls: 'is-none', ic: '—'  },
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const grade = (p) => (p.quiz_status === 'submitted' && p.total ? Math.round((p.correct / p.total) * 100) : null);

const gradeClass = (g) => (g === null ? '' : g >= 80 ? 'g-high' : g >= 60 ? 'g-mid' : 'g-low');


// ── Daten ─────────────────────────────────────────────────────────

async function load() {
  if (!cloudEnabled()) { render(); return; }
  const pass = View.getPassword();
  if (!pass) { View.error = 'password'; render(); return; }
  View.loading = true;
  View.error = null;
  render();
  try {
    View.data = await adminRpc('admin_results', pass);
  } catch (err) {
    View.error = err.code === '42501' || /forbidden/.test(err.message) ? 'password' : (err.message || 'Fehler');
  } finally {
    View.loading = false;
    render();
  }
}

function filtered() {
  const players = View.data?.players || [];
  const q = View.search.toLowerCase();
  const list = players.filter((p) =>
    (View.status === 'all' || p.quiz_status === View.status) &&
    (!q || p.name.toLowerCase().includes(q)));
  const by = {
    name:       (a, b) => a.name_key.localeCompare(b.name_key, 'de'),
    score_desc: (a, b) => (grade(b) ?? -1) - (grade(a) ?? -1) || a.name_key.localeCompare(b.name_key, 'de'),
    score_asc:  (a, b) => (grade(a) ?? 999) - (grade(b) ?? 999) || a.name_key.localeCompare(b.name_key, 'de'),
    recent:     (a, b) => String(b.submitted_at || b.last_seen).localeCompare(String(a.submitted_at || a.last_seen)),
    quests:     (a, b) => (b.quests_done || 0) - (a.quests_done || 0),
  }[View.sort];
  return list.sort(by);
}


// ── Darstellung ───────────────────────────────────────────────────

function markup() {
  return `
  <div class="alog-card asc-card" role="dialog" aria-modal="true" aria-label="Ergebnisse aller Spieler">
    <header class="alog-head">
      <div class="alog-title">
        <span class="adm-badge">ADMIN</span>
        <div><h2>📊 Ergebnisse</h2><p>Nilai Latihan Soal &amp; progress semua pemain</p></div>
      </div>
      <button type="button" class="adm-btn" id="asc-refresh">↻ Aktualisieren</button>
      <button type="button" class="adm-icon-btn" id="asc-close" aria-label="Schließen">×</button>
    </header>
    <div class="alog-stats asc-stats" id="asc-stats"></div>
    <div class="alog-toolbar">
      <div class="asc-filter" role="group" aria-label="Status">
        ${[['all', 'Semua'], ['submitted', '✅ Selesai'], ['in_progress', '⏳ Mengerjakan'], ['none', '— Belum']].map(([v, l]) =>
          `<button type="button" class="alog-tab" data-status="${v}">${l}</button>`).join('')}
      </div>
      <div class="alog-filters">
        <input type="search" id="asc-search" class="alog-input" placeholder="Nama suchen … (cari)" aria-label="Spieler suchen">
        <select id="asc-sort" class="alog-select" aria-label="Sortieren">
          <option value="name">Nama A–Z</option>
          <option value="score_desc">Nilai tertinggi</option>
          <option value="score_asc">Nilai terendah</option>
          <option value="recent">Terbaru</option>
          <option value="quests">Quest terbanyak</option>
        </select>
      </div>
    </div>
    <main class="alog-body" id="asc-body"></main>
    <footer class="alog-foot">
      <div class="alog-foot-actions">
        <button type="button" class="adm-btn" id="asc-csv">⬇ CSV</button>
        ${CONFIG.SHEETS_URL ? `<a class="adm-btn" id="asc-sheets" href="${esc(CONFIG.SHEETS_URL)}" target="_blank" rel="noopener">📗 Google Sheets</a>` : ''}
        <button type="button" class="adm-btn alog-danger" id="asc-reset-all">🗑 Alle zurücksetzen</button>
      </div>
      <span class="alog-note">Nilai dihitung otomatis di server · Siswa tidak melihat nilai</span>
    </footer>
  </div>`;
}

function renderStats() {
  const players = View.data?.players || [];
  const done = players.filter((p) => p.quiz_status === 'submitted');
  const grades = done.map(grade);
  const avg = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
  const max = grades.length ? Math.max(...grades) : null;
  const min = grades.length ? Math.min(...grades) : null;
  const allQuests = players.filter((p) => (p.quests_done || 0) >= 10).length;
  View.root.querySelector('#asc-stats').innerHTML = [
    ['👥', players.length, 'Pemain', 'terdaftar'],
    ['🏁', allQuests, 'Tamat', '10 / 10 Quest'],
    ['✅', done.length, 'Sudah kirim', `${players.length - done.length} belum`],
    ['📈', avg ?? '—', 'Rata-rata', 'nilai 0–100'],
    ['🔝', max ?? '—', 'Tertinggi', ''],
    ['🔻', min ?? '—', 'Terendah', ''],
  ].map(([ic, v, l, s]) => `<div class="alog-stat"><span class="alog-stat-ic">${ic}</span><b>${esc(v)}</b><span>${l}</span><small>${esc(s)}</small></div>`).join('');
}

function detailRow(p) {
  const key = Object.fromEntries((View.data?.key || []).map((k) => [k.q, k.correct]));
  const cells = LATIHAN_QUESTIONS.map((q) => {
    const a = p.answers?.[q.n];
    const has = Number.isInteger(a);
    const ok = has && a === key[q.n];
    const cls = p.quiz_status !== 'submitted' ? (has ? 'is-draft' : 'is-empty') : (!has ? 'is-empty' : ok ? 'is-ok' : 'is-bad');
    return `<div class="asc-ans ${cls}" title="${esc(q.q)}">
      <span class="asc-ans-n">${q.n}</span>
      <b>${has ? OPTION_LETTERS[a] : '—'}</b>
      <small>Kunci ${OPTION_LETTERS[key[q.n]] ?? '?'}</small>
    </div>`;
  }).join('');
  return `<tr class="asc-detail"><td colspan="11">
    <div class="asc-answers">${cells}</div>
    <div class="asc-row-actions">
      <span class="alog-meta">Terdaftar ${fmtTime(p.created_at)} · Terakhir aktif ${fmtTime(p.last_seen)}${p.active_quest ? ` · Quest aktif: ${esc(p.active_quest.replace('quest_', 'Quest '))}` : ''}</span>
      <span class="asc-row-btns">
        <button type="button" class="adm-btn" data-reset-quiz="${p.id}">↺ Reset Latihan</button>
        <button type="button" class="adm-btn" data-reset-progress="${p.id}">↺ Reset Progress</button>
        <button type="button" class="adm-btn alog-danger" data-delete="${p.id}">🗑 Hapus</button>
      </span>
    </div>
  </td></tr>`;
}

function renderBody() {
  const body = View.root.querySelector('#asc-body');
  if (!cloudEnabled()) {
    body.innerHTML = `<div class="alog-empty asc-empty">
      <p class="asc-empty-ic">☁️</p>
      <p><b>Supabase belum diatur.</b></p>
      <p>Isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> di <code>js/config.js</code>.<br>
         Panduan lengkap ada di <code>SETUP-ONLINE.md</code>.</p>
    </div>`;
    return;
  }
  if (View.error === 'password') {
    body.innerHTML = `<form class="alog-empty asc-empty" id="asc-pass-form">
      <p class="asc-empty-ic">🔐</p>
      <p>Admin-Passwort bestätigen, um die Ergebnisse vom Server zu laden.</p>
      <p><input type="password" class="adm-input asc-pass" id="asc-pass" aria-label="Admin-Passwort" autocomplete="off">
         <button type="submit" class="adm-btn adm-btn-primary">Laden</button></p>
    </form>`;
    body.querySelector('#asc-pass-form').addEventListener('submit', (e) => {
      e.preventDefault();
      View.setPassword(body.querySelector('#asc-pass').value);
      load();
    });
    setTimeout(() => body.querySelector('#asc-pass')?.focus(), 30);
    return;
  }
  if (View.error) {
    body.innerHTML = `<div class="alog-empty">⚠️ ${esc(View.error)}<br><br><button type="button" class="adm-btn" data-retry>Erneut versuchen</button></div>`;
    return;
  }
  if (!View.data) {
    body.innerHTML = `<div class="alog-empty">${View.loading ? 'Lade Ergebnisse …' : ''}</div>`;
    return;
  }
  const list = filtered();
  if (!list.length) {
    body.innerHTML = `<div class="alog-empty">${(View.data.players || []).length ? 'Keine Treffer.' : 'Belum ada pemain. Sobald sich jemand mit Namen anmeldet, erscheint er hier.'}</div>`;
    return;
  }
  body.innerHTML = `<div class="alog-table-wrap"><table class="alog-table asc-table">
    <thead><tr>
      <th>#</th><th>Nama</th><th>Status</th><th class="num">Benar</th><th class="num">Nilai</th>
      <th class="num">Teil 1</th><th class="num">Teil 2</th><th class="num">Quest</th><th class="num">Poin</th><th>Dikirim</th><th></th>
    </tr></thead>
    <tbody>${list.map((p, i) => {
      const st = STATUS[p.quiz_status] || STATUS.none;
      const g = grade(p);
      const open = View.expanded.has(p.id);
      const sub = p.quiz_status === 'submitted';
      return `<tr class="asc-row ${open ? 'open' : ''}" data-row="${p.id}" tabindex="0" aria-expanded="${open}">
        <td>${i + 1}</td>
        <td class="asc-name">${esc(p.name)}</td>
        <td><span class="asc-status ${st.cls}">${st.ic} ${st.label}${p.quiz_status === 'in_progress' ? ` · ${p.answered}/${p.total}` : ''}</span></td>
        <td class="num">${sub ? `${p.correct}/${p.total}` : '—'}</td>
        <td class="num"><span class="asc-grade ${gradeClass(g)}">${g ?? '—'}</span></td>
        <td class="num">${sub ? `${p.part1}/10` : '—'}</td>
        <td class="num">${sub ? `${p.part2}/10` : '—'}</td>
        <td class="num">${p.quests_done ?? 0}/10</td>
        <td class="num">${p.game_score ?? '—'}</td>
        <td>${fmtTime(p.submitted_at)}</td>
        <td class="asc-caret">${open ? '▾' : '▸'}</td>
      </tr>${open ? detailRow(p) : ''}`;
    }).join('')}</tbody>
  </table></div>`;
}

function render() {
  if (!View.root) return;
  renderStats();
  renderBody();
  View.root.querySelectorAll('[data-status]').forEach((b) => b.classList.toggle('is-active', b.dataset.status === View.status));
  View.root.querySelector('#asc-refresh').disabled = View.loading;
}


// ── Aktionen ──────────────────────────────────────────────────────

async function act(fn, args, confirmText) {
  if (!confirm(confirmText)) return;
  try {
    await adminRpc(fn, View.getPassword(), args);
    await load();
  } catch (err) {
    alert(`Fehler: ${err.message}`);
  }
}

function playerName(id) {
  return View.data?.players?.find((p) => p.id === id)?.name || '';
}

function exportCSV() {
  const players = filtered();
  const head = ['Nr', 'Nama', 'Status', 'Benar', 'Total', 'Nilai', 'Teil 1', 'Teil 2', 'Quest selesai', 'Poin game', 'Dikirim', 'Terakhir aktif',
    ...LATIHAN_QUESTIONS.map((q) => `S${q.n}`)];
  const rows = players.map((p, i) => [
    i + 1, p.name, (STATUS[p.quiz_status] || STATUS.none).label,
    p.quiz_status === 'submitted' ? p.correct : '', p.total, grade(p) ?? '',
    p.quiz_status === 'submitted' ? p.part1 : '', p.quiz_status === 'submitted' ? p.part2 : '',
    p.quests_done ?? 0, p.game_score ?? '', p.submitted_at ? fmtTime(p.submitted_at) : '', fmtTime(p.last_seen),
    ...LATIHAN_QUESTIONS.map((q) => (Number.isInteger(p.answers?.[q.n]) ? OPTION_LETTERS[p.answers[q.n]] : '')),
  ]);
  const cell = (v) => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // Semikolon + BOM: öffnet sich in Excel (de/id) direkt in Spalten
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `latihan-soal-nilai-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}


// ── Öffnen / Schließen ────────────────────────────────────────────

export function initScoresViewer(container, { canOpen, onToggle, getPassword, setPassword } = {}) {
  if (View.root) return;
  View.canOpen = canOpen || View.canOpen;
  View.onToggle = onToggle || View.onToggle;
  View.getPassword = getPassword || View.getPassword;
  View.setPassword = setPassword || View.setPassword;

  const el = document.createElement('div');
  el.className = 'alog asc';
  el.id = 'asc';
  el.hidden = true;
  el.innerHTML = markup();
  container.appendChild(el);
  View.root = el;

  el.querySelector('#asc-close').addEventListener('click', closeScoresViewer);
  el.querySelector('#asc-refresh').addEventListener('click', load);
  el.querySelector('#asc-csv').addEventListener('click', exportCSV);
  el.querySelector('#asc-reset-all').addEventListener('click', async () => {
    const typed = prompt('Semua pemain, progress, dan nilai akan DIHAPUS PERMANEN.\nKetik RESET untuk melanjutkan:');
    if (typed !== 'RESET') return;
    try {
      const n = await adminRpc('admin_reset_all', View.getPassword());
      View.expanded.clear();
      await load();
      alert(`${n} Spieler gelöscht.`);
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  });
  el.querySelector('#asc-sort').addEventListener('change', (e) => { View.sort = e.target.value; render(); });
  let st = null;
  el.querySelector('#asc-search').addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => { View.search = e.target.value.trim(); render(); }, 140);
  });

  el.addEventListener('click', (e) => {
    if (e.target === el) { closeScoresViewer(); return; }
    const t = e.target.closest('[data-status], [data-reset-quiz], [data-reset-progress], [data-delete], [data-retry], [data-row]');
    if (!t) return;
    if (t.dataset.status) { View.status = t.dataset.status; render(); return; }
    if (t.dataset.retry !== undefined) { load(); return; }
    if (t.dataset.resetQuiz) {
      act('admin_reset_quiz', { p_id: t.dataset.resetQuiz },
        `Latihan Soal von „${playerName(t.dataset.resetQuiz)}“ zurücksetzen?\nJawaban & nilai dihapus, siswa bisa mengerjakan ulang.`);
      return;
    }
    if (t.dataset.resetProgress) {
      act('admin_reset_progress', { p_id: t.dataset.resetProgress },
        `Gesamten Fortschritt von „${playerName(t.dataset.resetProgress)}“ zurücksetzen?\nProgress game & Latihan Soal dihapus, mulai dari awal.`);
      return;
    }
    if (t.dataset.delete) {
      act('admin_delete_player', { p_id: t.dataset.delete },
        `Spieler „${playerName(t.dataset.delete)}“ endgültig löschen?\nAkun, progress, dan nilai dihapus permanen.`);
      return;
    }
    if (t.dataset.row) {
      const id = t.dataset.row;
      if (View.expanded.has(id)) View.expanded.delete(id); else View.expanded.add(id);
      renderBody();
    }
  });
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-row]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && View.open) { e.preventDefault(); e.stopImmediatePropagation(); closeScoresViewer(); }
  }, true);
}

export function openScoresViewer() {
  if (!View.root || !View.canOpen()) return false;
  View.open = true;
  View.root.hidden = false;
  View.onToggle(true);
  render();
  load();
  return true;
}

export function closeScoresViewer() {
  if (!View.root || !View.open) return;
  View.open = false;
  View.root.hidden = true;
  View.onToggle(false);
}

export function isScoresViewerOpen() { return View.open; }
