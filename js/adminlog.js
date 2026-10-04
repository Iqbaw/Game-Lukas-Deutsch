// ═══════════════════════════════════════════════════════════════════
// js/adminlog.js — SPIELPROTOKOLL-ANSICHT (nur Admin-Modus)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Zeigt das von js/activitylog.js aufgezeichnete Protokoll übersichtlich:
//   • Aktivitäten  — Zeitleiste, nach Quest gruppiert
//   • Gespräche    — jedes Gespräch als Chatverlauf (NPC links, Lukas rechts)
//   • Antworten    — alle gewählten Antworten mit richtig/falsch & Punkten
// Mit Kennzahlen, Suche, Quest-Filter, Sitzungswahl und Export (TXT/JSON).
// Wird ausschließlich aus dem entsperrten Admin-Fenster geöffnet.
// ═══════════════════════════════════════════════════════════════════

import { ActivityLog, subscribe, clearLog, questTitle, ZONE_LABELS } from './activitylog.js';

const View = {
  root:      null,
  open:      false,
  tab:       'acts',
  session:   null,
  follow:    true,      // automatisch der laufenden Sitzung folgen
  search:    '',
  quest:     '',
  expanded:  new Set(),
  collapsed: new Set(),
  canOpen:   () => false,
  onToggle:  () => {},
  timer:     null,
};

const CUTSCENE_LABELS = {
  bus: 'Busfahrt in die Stadt', kino: 'Im Kino (Film)', restaurant: 'Im Restaurant',
  finale: 'Finale', dinner: 'Abendessen — es wird Nacht', nextday: 'Am nächsten Morgen',
  evening: 'Die Sonne geht unter',
};
const MODE_LABELS = { new: 'Neues Spiel gestartet', continue: 'Spiel fortgesetzt (Weiterspielen)', auto: 'Sitzung begonnen' };


// ── Formatierung ──────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(t) { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function fmtDate(t) { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
function questLabel(qid) {
  const q = questTitle(qid);
  return q ? `Quest ${q.n} · ${q.title}` : 'Ohne Quest';
}
function zoneLabel(z) { return ZONE_LABELS[z]?.de || z || '—'; }
function pts(p) {
  if (!p) return '';
  return `<span class="alog-pts ${p < 0 ? 'neg' : ''}">${p > 0 ? '+' : ''}${p}</span>`;
}
/** Text mit hervorgehobenen Vokabeln (Tooltip = Übersetzung). */
function withVocab(text, vocab) {
  let html = esc(text);
  for (const [w, tr] of vocab || []) {
    const re = new RegExp(`(^|[^\\wäöüß])(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\wäöüß])`, 'i');
    html = html.replace(re, `$1<u class="alog-vocab" title="${esc(tr)}">$2</u>`);
  }
  return html;
}


// ── Daten aufbereiten ─────────────────────────────────────────────

function sessionEntries() {
  return ActivityLog.entries.filter((e) => e.s === View.session);
}

/** Gespräche einer Sitzung: { id, open, items[], close, skipped, ok, wrong, lines } */
function buildConversations(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.conv) continue;
    let c = map.get(e.conv);
    if (!c) { c = { id: e.conv, open: null, items: [], close: null, skipped: false, ok: 0, wrong: 0, lines: 0 }; map.set(e.conv, c); }
    if (e.k === 'dlg_open') c.open = e;
    else if (e.k === 'dlg_close') c.close = e;
    else {
      c.items.push(e);
      if (e.k === 'dlg_line') c.lines++;
      if (e.k === 'dlg_skip') c.skipped = true;
      if (e.k === 'dlg_choice') { if (e.result === 'ok') c.ok++; if (e.result === 'wrong') c.wrong++; }
    }
  }
  return [...map.values()].filter((c) => c.open);
}

function matchesSearch(...parts) {
  if (!View.search) return true;
  const s = View.search.toLowerCase();
  return parts.some((p) => String(p ?? '').toLowerCase().includes(s));
}
function matchesQuest(q) { return !View.quest || q === View.quest; }

function computeStats(entries, convs) {
  const first = entries[0]?.t, last = entries[entries.length - 1]?.t;
  const count = (k) => entries.filter((e) => e.k === k).length;
  const answers = entries.filter((e) => (e.k === 'dlg_choice' || e.k === 'sms') && e.result);
  const ok = answers.filter((e) => e.result === 'ok').length;
  return {
    time:   first ? fmtDur(last - first) : '0:00',
    quests: new Set(entries.filter((e) => e.k === 'quest_done').map((e) => e.quest)).size,
    convs:  convs.filter((c) => c.open.npcId !== 'lukas' && c.open.npc !== 'Lukas').length,
    self:   convs.filter((c) => c.open.npcId === 'lukas' || c.open.npc === 'Lukas').length,
    ok, wrong: answers.length - ok,
    rate:   answers.length ? Math.round((ok / answers.length) * 100) : null,
    items:  count('item'),
    vocab:  count('vocab'),
    hints:  count('hint'),
  };
}


// ── Darstellung ───────────────────────────────────────────────────

function actRow(e, start, convs) {
  let ic = '•', txt = '', badge = '', cls = '', attrs = '';
  switch (e.k) {
    case 'session':     ic = '🎮'; txt = `<b>${esc(MODE_LABELS[e.mode] || 'Sitzung')}</b>`; cls = 'k-session'; break;
    case 'zone':        ic = '🗺️'; txt = `Betritt <b>${esc(e.name || zoneLabel(e.zone))}</b>${e.nameID ? ` <i>${esc(e.nameID)}</i>` : ''}`; cls = 'k-zone'; break;
    case 'quest_start': ic = '📜'; txt = `Quest ${esc(e.n)} gestartet: <b>${esc(e.title)}</b>${e.subtitle ? ` <i>${esc(e.subtitle)}</i>` : ''}`; cls = 'k-quest'; break;
    case 'quest_step':  ic = '➡️'; txt = `Schritt ${esc(e.step)}/${esc(e.total)}: ${esc(e.desc)}${e.restored ? ' <span class="alog-tag">fortgesetzt</span>' : ''}`; cls = 'k-step'; break;
    case 'quest_done':  ic = '🏆'; txt = `Quest ${esc(e.n)} abgeschlossen: <b>${esc(e.title)}</b>`; badge = pts(e.points); cls = 'k-done'; break;
    case 'item':        ic = '🧺'; txt = `Gefunden: <b>${esc(e.item)}</b>`; badge = pts(e.points); cls = 'k-item'; break;
    case 'hint':        ic = '💡'; txt = `Tipp angesehen: ${esc(e.desc)}`; cls = 'k-hint'; break;
    case 'vocab':       ic = '📖'; txt = `Vokabel nachgeschlagen: <b>${esc(e.word)}</b> → ${esc(e.trans)}`; cls = 'k-vocab'; break;
    case 'cutscene':    ic = '🎬'; txt = `${e.transition ? 'Übergang' : 'Zwischensequenz'}: ${esc(CUTSCENE_LABELS[e.name] || e.name)}`; cls = 'k-cut'; break;
    case 'sms':         ic = '💌'; txt = `SMS an Tante Maria: ${e.result === 'ok' ? '<span class="alog-ok">✓ richtig</span>' : '<span class="alog-bad">✗ falsch</span>'}`; badge = pts(e.points); cls = 'k-sms'; break;
    case 'admin':       ic = '🔧'; txt = `Admin: ${esc(e.label || e.action)}`; cls = 'k-admin'; break;
    case 'dlg_open': {
      const c = convs.get(e.conv);
      const self = e.npcId === 'lukas' || e.npc === 'Lukas';
      ic = esc(e.emoji || '💬');
      txt = self ? '<b>Lukas denkt nach</b>' : `Gespräch mit <b>${esc(e.npc)}</b>`;
      if (c) txt += ` <span class="alog-meta">${c.lines} Zeilen${c.ok || c.wrong ? ` · <span class="alog-ok">✓${c.ok}</span> <span class="alog-bad">✗${c.wrong}</span>` : ''}${c.skipped ? ' · vorgespult' : ''}</span>`;
      txt += ' <span class="alog-link">ansehen ›</span>';
      cls = 'k-dlg'; attrs = ` data-conv="${esc(e.conv)}" tabindex="0" role="button"`;
      break;
    }
    default: return '';
  }
  return `<div class="alog-row ${cls}"${attrs}>
    <time>${fmtTime(e.t)}</time><span class="alog-gt">+${fmtDur(e.t - start)}</span>
    <span class="alog-ic">${ic}</span><div class="alog-txt">${txt}</div>${badge}</div>`;
}

function renderActivities(entries, convMap) {
  const start = entries[0]?.t || Date.now();
  const SHOWN = new Set(['session', 'zone', 'quest_start', 'quest_step', 'quest_done', 'item', 'hint', 'vocab', 'cutscene', 'sms', 'admin', 'dlg_open']);
  let html = '', lastQ = undefined, n = 0;
  for (const e of entries) {
    if (!SHOWN.has(e.k) || !matchesQuest(e.q)) continue;
    if (View.search) {
      const c = e.k === 'dlg_open' ? convMap.get(e.conv) : null;
      const hay = [e.name, e.title, e.desc, e.item, e.word, e.trans, e.npc, e.label, ...(c ? c.items.map((i) => i.text) : [])];
      if (!matchesSearch(...hay)) continue;
    }
    if (e.q !== lastQ) {
      lastQ = e.q;
      html += `<h4 class="alog-group">${esc(questLabel(e.q))}</h4>`;
    }
    html += actRow(e, start, convMap);
    n++;
  }
  return n ? html : emptyState();
}

function convCard(c, idx, total) {
  const o = c.open;
  const self = o.npcId === 'lukas' || o.npc === 'Lukas';
  const isOpen = View.expanded.has(c.id) || (!View.collapsed.has(c.id) && (idx >= total - 2 || !!View.search));
  const dur = (c.close?.t || c.items[c.items.length - 1]?.t || o.t) - o.t;
  const q = questTitle(o.q);
  let body = '';
  if (isOpen) {
    for (const it of c.items) {
      if (it.k === 'dlg_line') {
        body += it.lukas
          ? `<div class="alog-msg me"><div class="alog-bubble">${withVocab(it.text, it.vocab)}</div><span class="alog-who">Lukas · ${fmtTime(it.t)}</span></div>`
          : `<div class="alog-msg"><span class="alog-who">${esc(it.who)} · ${fmtTime(it.t)}</span><div class="alog-bubble">${withVocab(it.text, it.vocab)}</div></div>`;
      } else if (it.k === 'dlg_choice') {
        const res = it.result === 'ok' ? '<span class="alog-ok">✓ richtig</span>'
          : it.result === 'wrong' ? '<span class="alog-bad">✗ falsch</span>' : '<span class="alog-neu">Auswahl</span>';
        body += `<div class="alog-msg me choice"><div class="alog-bubble"><span class="alog-choice-k">Antwort${it.attempt > 1 ? ` (Versuch ${it.attempt})` : ''}</span>${esc(it.text)}</div>
          <span class="alog-who">${res} ${pts(it.points)} · ${fmtTime(it.t)}</span></div>`;
      } else if (it.k === 'dlg_skip') {
        body += `<div class="alog-sys">⏩ Vom Admin vorgespult</div>`;
      }
    }
    if (!body) body = '<div class="alog-sys">(keine Zeilen)</div>';
  }
  return `<article class="alog-conv ${isOpen ? 'open' : ''}" id="conv-${esc(c.id)}">
    <header class="alog-conv-head" data-toggle="${esc(c.id)}" tabindex="0" role="button" aria-expanded="${isOpen}">
      <span class="alog-avatar">${esc(o.emoji || '💬')}</span>
      <div class="alog-conv-title"><b>${self ? 'Lukas (Gedanken)' : esc(o.npc)}</b>
        <span class="alog-meta">${fmtTime(o.t)} · ${fmtDur(dur)} · ${esc(zoneLabel(o.z))}</span></div>
      <div class="alog-conv-chips">
        ${q ? `<span class="alog-chip">Q${q.n}</span>` : ''}
        <span class="alog-chip">${c.lines} Zeilen</span>
        ${c.ok || c.wrong ? `<span class="alog-chip ok">✓ ${c.ok}</span><span class="alog-chip bad">✗ ${c.wrong}</span>` : ''}
        ${c.skipped ? '<span class="alog-chip skip">vorgespult</span>' : ''}
      </div>
      <span class="alog-caret">${isOpen ? '▾' : '▸'}</span>
    </header>
    ${isOpen ? `<div class="alog-conv-body">${body}</div>` : ''}
  </article>`;
}

function renderConversations(convs) {
  const list = convs.filter((c) => matchesQuest(c.open.q) &&
    matchesSearch(c.open.npc, ...c.items.map((i) => i.text), ...c.items.map((i) => i.who)));
  return list.length ? list.map((c, i) => convCard(c, i, list.length)).join('') : emptyState();
}

function renderAnswers(entries, convMap) {
  const rows = [];
  for (const e of entries) {
    if (e.k !== 'dlg_choice' && e.k !== 'sms') continue;
    if (!matchesQuest(e.q)) continue;
    let partner = 'Tante Maria (SMS)', question = 'Welche Nachricht stimmt?';
    if (e.k === 'dlg_choice') {
      const c = convMap.get(e.conv);
      partner = c?.open?.npc || '—';
      // Frage = die Zeile, die direkt vor der Auswahl stand (der Knoten mit den Antworten)
      const before = c ? c.items.filter((i) => i.k === 'dlg_line' && i.i < e.i) : [];
      const q = before[before.length - 1];
      question = q ? (q.lukas ? `Lukas: ${q.text}` : q.text) : '—';
    }
    if (!matchesSearch(partner, question, e.text)) continue;
    rows.push({ e, partner, question });
  }
  if (!rows.length) return emptyState();
  const graded = rows.filter((r) => r.e.result);
  const ok = graded.filter((r) => r.e.result === 'ok').length;
  return `<p class="alog-answers-sum">${graded.length} bewertete Antworten · <span class="alog-ok">✓ ${ok} richtig</span> · <span class="alog-bad">✗ ${graded.length - ok} falsch</span>${graded.length ? ` · Trefferquote <b>${Math.round(ok / graded.length * 100)} %</b>` : ''}</p>
  <div class="alog-table-wrap"><table class="alog-table">
    <thead><tr><th>Zeit</th><th>Quest</th><th>Mit</th><th>Frage / Situation</th><th>Antwort von Lukas</th><th>Ergebnis</th><th>Punkte</th></tr></thead>
    <tbody>${rows.map(({ e, partner, question }) => `<tr class="${e.result === 'ok' ? 'r-ok' : e.result === 'wrong' ? 'r-bad' : ''}">
      <td>${fmtTime(e.t)}</td><td>${questTitle(e.q) ? 'Q' + questTitle(e.q).n : '—'}</td><td>${esc(partner)}</td>
      <td class="alog-q">${esc(question)}</td><td>${esc(e.text)}${e.attempt > 1 ? ` <span class="alog-tag">Versuch ${e.attempt}</span>` : ''}</td>
      <td>${e.result === 'ok' ? '<span class="alog-ok">✓ richtig</span>' : e.result === 'wrong' ? '<span class="alog-bad">✗ falsch</span>' : '<span class="alog-neu">Auswahl</span>'}</td>
      <td>${pts(e.points) || '0'}</td></tr>`).join('')}</tbody></table></div>`;
}

function emptyState() {
  return `<div class="alog-empty">${View.search || View.quest ? 'Keine Einträge für diesen Filter.' : 'Noch keine Einträge — spiel ein wenig, dann erscheint hier alles, was Lukas tut.'}</div>`;
}

function render() {
  if (!View.root || !View.open) return;
  // Sitzungen (neueste zuerst)
  if (View.follow || !ActivityLog.sessions.some((s) => s.id === View.session)) {
    View.session = ActivityLog.current || ActivityLog.sessions[ActivityLog.sessions.length - 1]?.id || null;
  }
  const sel = View.root.querySelector('#alog-session');
  sel.innerHTML = [...ActivityLog.sessions].reverse().map((s) => {
    const n = ActivityLog.entries.filter((e) => e.s === s.id).length;
    const mode = s.mode === 'continue' ? 'Weiterspielen' : s.mode === 'new' ? 'Neues Spiel' : 'Sitzung';
    return `<option value="${esc(s.id)}" ${s.id === View.session ? 'selected' : ''}>${fmtDate(s.start)} · ${mode} · ${n} Einträge${s.id === ActivityLog.current ? ' (aktuell)' : ''}</option>`;
  }).join('') || '<option>Keine Sitzung</option>';

  const entries = sessionEntries();
  const convs = buildConversations(entries);
  const convMap = new Map(convs.map((c) => [c.id, c]));
  const st = computeStats(entries, convs);

  View.root.querySelector('#alog-stats').innerHTML = [
    ['⏱️', st.time, 'Spielzeit', 'waktu bermain'],
    ['🏆', `${st.quests}/10`, 'Quests', 'quest selesai'],
    ['💬', st.convs, 'Gespräche', `percakapan · ${st.self}× berpikir`],
    ['✅', `${st.ok} / ${st.wrong}`, 'Richtig / Falsch', st.rate === null ? 'jawaban' : `${st.rate} % benar`],
    ['🧺', st.items, 'Gegenstände', 'barang ditemukan'],
    ['📖', st.vocab, 'Vokabeln', 'kosakata diklik'],
    ['💡', st.hints, 'Tipps', 'tip dibuka'],
  ].map(([ic, v, l, s]) => `<div class="alog-stat"><span class="alog-stat-ic">${ic}</span><b>${esc(v)}</b><span>${l}</span><small>${esc(s)}</small></div>`).join('');

  const counts = {
    acts: entries.filter((e) => !e.conv || e.k === 'dlg_open').length,
    convs: convs.length,
    answers: entries.filter((e) => e.k === 'dlg_choice' || e.k === 'sms').length,
  };
  View.root.querySelectorAll('.alog-tab').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.tab === View.tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === View.tab));
    b.querySelector('.alog-count').textContent = counts[b.dataset.tab];
  });

  const qsel = View.root.querySelector('#alog-quest');
  const qs = [...new Set(entries.map((e) => e.q).filter(Boolean))];
  qsel.innerHTML = `<option value="">Alle Quests</option>` +
    qs.map((q) => `<option value="${esc(q)}" ${q === View.quest ? 'selected' : ''}>${esc(questLabel(q))}</option>`).join('');

  const body = View.root.querySelector('#alog-body');
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  const prev = body.scrollTop;
  body.innerHTML = View.tab === 'convs' ? renderConversations(convs)
    : View.tab === 'answers' ? renderAnswers(entries, convMap)
    : renderActivities(entries, convMap);
  body.scrollTop = atBottom ? body.scrollHeight : prev;
}

function scheduleRender() {
  clearTimeout(View.timer);
  View.timer = setTimeout(render, 250);
}


// ── Export ────────────────────────────────────────────────────────

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function exportText() {
  const entries = sessionEntries();
  const s = ActivityLog.sessions.find((x) => x.id === View.session);
  const convs = new Map(buildConversations(entries).map((c) => [c.id, c]));
  const out = [
    'LUKAS ABENTEUER — SPIELPROTOKOLL',
    `Sitzung: ${s ? fmtDate(s.start) : '—'} (${MODE_LABELS[s?.mode] || '—'})`,
    '═'.repeat(60), '',
  ];
  let lastQ;
  for (const e of entries) {
    if (e.q !== lastQ && !e.conv) { lastQ = e.q; out.push('', `── ${questLabel(e.q)} ──`); }
    const t = `[${fmtTime(e.t)}]`;
    switch (e.k) {
      case 'session':     out.push(`${t} ${MODE_LABELS[e.mode] || 'Sitzung'}`); break;
      case 'zone':        out.push(`${t} Betritt: ${e.name || zoneLabel(e.zone)}`); break;
      case 'quest_start': out.push(`${t} Quest ${e.n} gestartet: ${e.title}`); break;
      case 'quest_step':  out.push(`${t} Schritt ${e.step}/${e.total}: ${e.desc}`); break;
      case 'quest_done':  out.push(`${t} Quest ${e.n} abgeschlossen: ${e.title} (+${e.points || 0})`); break;
      case 'item':        out.push(`${t} Gefunden: ${e.item}`); break;
      case 'hint':        out.push(`${t} Tipp angesehen: ${e.desc}`); break;
      case 'vocab':       out.push(`${t} Vokabel: ${e.word} → ${e.trans}`); break;
      case 'cutscene':    out.push(`${t} Zwischensequenz: ${CUTSCENE_LABELS[e.name] || e.name}`); break;
      case 'sms':         out.push(`${t} SMS an Tante Maria: ${e.result === 'ok' ? 'richtig' : 'falsch'} (${e.points})`); break;
      case 'admin':       out.push(`${t} Admin: ${e.label || e.action}`); break;
      case 'dlg_open': {
        const c = convs.get(e.conv);
        const self = e.npcId === 'lukas' || e.npc === 'Lukas';
        out.push(`${t} ── ${self ? 'Lukas denkt nach' : `Gespräch mit ${e.npc}`} ──`);
        for (const it of c?.items || []) {
          if (it.k === 'dlg_line') out.push(`    ${it.who}: ${it.text}`);
          else if (it.k === 'dlg_choice') out.push(`    → Lukas antwortet: „${it.text}" ${it.result === 'ok' ? '✓ richtig' : it.result === 'wrong' ? '✗ falsch' : ''}${it.points ? ` (${it.points > 0 ? '+' : ''}${it.points})` : ''}`);
          else if (it.k === 'dlg_skip') out.push('    (vom Admin vorgespult)');
        }
        break;
      }
      default: break;
    }
  }
  const stamp = s ? new Date(s.start).toISOString().slice(0, 16).replace(/[:T]/g, '-') : 'protokoll';
  download(`lukas-protokoll-${stamp}.txt`, out.join('\n'), 'text/plain;charset=utf-8');
}

function exportJSON() {
  const s = ActivityLog.sessions.find((x) => x.id === View.session);
  download(`lukas-protokoll-${s ? s.id : 'alle'}.json`,
    JSON.stringify({ session: s || null, entries: sessionEntries() }, null, 2), 'application/json');
}


// ── Öffnen / Schließen ────────────────────────────────────────────

function markup() {
  return `
  <div class="alog-card" role="dialog" aria-modal="true" aria-label="Spielprotokoll">
    <header class="alog-head">
      <div class="alog-title">
        <span class="adm-badge">ADMIN</span>
        <div><h2>📜 Spielprotokoll</h2><p>Log aktivitas &amp; percakapan Lukas</p></div>
      </div>
      <label class="alog-session-wrap"><span>Sitzung</span><select id="alog-session" class="alog-select"></select></label>
      <button type="button" class="adm-icon-btn" id="alog-close" aria-label="Schließen">×</button>
    </header>
    <div class="alog-stats" id="alog-stats"></div>
    <div class="alog-toolbar">
      <nav class="alog-tabs" role="tablist">
        <button type="button" class="alog-tab" data-tab="acts" role="tab">🧭 Aktivitäten <span class="alog-count"></span></button>
        <button type="button" class="alog-tab" data-tab="convs" role="tab">💬 Gespräche <span class="alog-count"></span></button>
        <button type="button" class="alog-tab" data-tab="answers" role="tab">✅ Antworten <span class="alog-count"></span></button>
      </nav>
      <div class="alog-filters">
        <input type="search" id="alog-search" class="alog-input" placeholder="Suchen … (cari)" aria-label="Protokoll durchsuchen">
        <select id="alog-quest" class="alog-select" aria-label="Quest filtern"></select>
      </div>
    </div>
    <main class="alog-body" id="alog-body"></main>
    <footer class="alog-foot">
      <div class="alog-foot-actions">
        <button type="button" class="adm-btn" id="alog-txt">⬇ Als Text</button>
        <button type="button" class="adm-btn" id="alog-json">⬇ JSON</button>
        <button type="button" class="adm-btn alog-danger" id="alog-clear">🗑 Protokoll löschen</button>
      </div>
      <span class="alog-note">Nur in diesem Browser gespeichert · hanya tersimpan di browser ini · <kbd>Strg</kbd>+<kbd>⇧</kbd>+<kbd>L</kbd></span>
    </footer>
  </div>`;
}

export function initLogViewer(container, { canOpen, onToggle } = {}) {
  if (View.root) return;
  View.canOpen = canOpen || (() => false);
  View.onToggle = onToggle || (() => {});
  const el = document.createElement('div');
  el.className = 'alog';
  el.id = 'alog';
  el.hidden = true;
  el.innerHTML = markup();
  container.appendChild(el);
  View.root = el;

  el.querySelector('#alog-close').addEventListener('click', closeLogViewer);
  el.addEventListener('click', (e) => {
    if (e.target === el) { closeLogViewer(); return; }
    const tab = e.target.closest('.alog-tab');
    if (tab) { View.tab = tab.dataset.tab; render(); return; }
    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      const id = tog.dataset.toggle;
      const isOpen = tog.parentElement.classList.contains('open');
      if (isOpen) { View.expanded.delete(id); View.collapsed.add(id); }
      else { View.collapsed.delete(id); View.expanded.add(id); }
      render();
      return;
    }
    const row = e.target.closest('[data-conv]');
    if (row) {
      const id = row.dataset.conv;
      View.tab = 'convs'; View.collapsed.delete(id); View.expanded.add(id);
      render();
      View.root.querySelector(`#conv-${CSS.escape(id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-toggle], [data-conv]')) { e.preventDefault(); e.target.click(); }
  });
  el.querySelector('#alog-session').addEventListener('change', (e) => {
    View.session = e.target.value;
    View.follow = View.session === ActivityLog.current;
    View.expanded.clear(); View.collapsed.clear();
    render();
  });
  el.querySelector('#alog-quest').addEventListener('change', (e) => { View.quest = e.target.value; render(); });
  let st = null;
  el.querySelector('#alog-search').addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => { View.search = e.target.value.trim(); render(); }, 160);
  });
  el.querySelector('#alog-txt').addEventListener('click', exportText);
  el.querySelector('#alog-json').addEventListener('click', exportJSON);
  el.querySelector('#alog-clear').addEventListener('click', () => {
    if (!confirm('Das gesamte Spielprotokoll in diesem Browser löschen?\nHapus seluruh log di browser ini?')) return;
    clearLog();
    render();
  });
  // Esc schließt das Protokoll (und öffnet nicht das Pausenmenü)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && View.open) { e.preventDefault(); e.stopImmediatePropagation(); closeLogViewer(); }
  }, true);

  subscribe((entry) => {
    if (!View.open) return;
    if (!entry || entry.s === View.session || (View.follow && entry.s === ActivityLog.current)) scheduleRender();
  });
}

export function openLogViewer() {
  if (!View.root || !View.canOpen()) return false;
  View.open = true;
  View.follow = true;
  View.root.hidden = false;
  View.onToggle(true);
  render();
  const body = View.root.querySelector('#alog-body');
  body.scrollTop = body.scrollHeight;
  return true;
}

export function closeLogViewer() {
  if (!View.root || !View.open) return;
  View.open = false;
  View.root.hidden = true;
  View.onToggle(false);
}

export function toggleLogViewer() {
  return View.open ? (closeLogViewer(), false) : openLogViewer();
}

export function isLogViewerOpen() { return View.open; }

/** Kurzinfo für das Admin-Fenster. */
export function logSummary() {
  const sid = ActivityLog.current;
  const entries = ActivityLog.entries.filter((e) => e.s === sid);
  return {
    entries: entries.length,
    convs: entries.filter((e) => e.k === 'dlg_open').length,
    answers: entries.filter((e) => e.k === 'dlg_choice' || e.k === 'sms').length,
  };
}
