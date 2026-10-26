/**
 * ═══════════════════════════════════════════════════════════════════
 * google-sheets/Code.gs — SERVER & REKAP NILAI · Lukas Abenteuer
 *
 * Google Apps Script yang menempel di sebuah Google Spreadsheet dan
 * dipublikasikan sebagai Web App. Script ini adalah satu-satunya server
 * game (tanpa Supabase):
 *
 *   • API untuk game (doPost): login dengan nama, simpan progress,
 *     draft & kirim Latihan Soal, fungsi admin (lihat nilai, reset).
 *   • Data mentah disimpan di sheet tersembunyi _players, _saves, _quiz.
 *     Sheet ini jangan diedit manual.
 *   • KUNCI JAWABAN hanya ada di file ini (server). Browser siswa tidak
 *     pernah menerimanya, dan nilai dihitung di sini.
 *   • Rekap rapi yang dibangun ulang otomatis (pemicu 1 menit, hanya
 *     kalau ada perubahan):
 *       1. Rekap          — satu baris per siswa + ringkasan kelas
 *       2. Detail Jawaban — siswa × soal (A–E), hijau benar / merah salah
 *       3. Analisis Soal  — % benar per soal, sebaran, pengecoh terbanyak
 *
 * Pemasangan: lihat SETUP-ONLINE.md (jalankan setup() sekali, lalu
 * Deploy → Web app: Execute as „Me“, Who has access „Anyone“).
 *
 * Password admin: sama dengan password admin di dalam game. Ganti lewat
 * menu „🎓 Lukas › Admin-Passwort ändern“.
 * ═══════════════════════════════════════════════════════════════════
 */

var QUESTIONS = [
  'Lukas möchte Wurst zum Frühstück. Wo ist die Wurst?',
  'Wo liegt das Ei?',
  'Wo liegt das Messer?',
  'Wo steht das Salz?',
  'Wo liegt die Pfanne?',
  'Wo liegt vielleicht das Spielzeug von Felix?',
  'Wo sind die Sachen in der Küche?',
  'Warum schreibt Oma eine SMS an Lukas?',
  'Wo liegt der Teller wahrscheinlich?',
  'Wo liegt das Spielzeug von Felix?',
  'Wo liegt die Eisdiele?',
  'Wo liegt das Kino?',
  'Wo liegt die Schule?',
  'Wo liegt der Supermarkt?',
  'Wo liegt der Supermarkt im Verhältnis zur Apotheke?',
  'Wo liegt Omas Haus?',
  'Wie beschreibt der Text die Gebäude in der Stadt?',
  'Wie findet man Orte in einer fremden Stadt am besten?',
  'Wo liegt das Kino genau?',
  'Wo liegt die Apotheke im Verhältnis zum Supermarkt?'
];
var LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Kunci jawaban dari SOAL.docx (✅) — 0 = A … 4 = E. Soal 1–10 = Teil 1, 11–20 = Teil 2.
var ANSWER_KEY = [3, 4, 3, 3, 2, 4, 3, 3, 2, 3,  2, 3, 3, 3, 4, 3, 3, 4, 4, 4];
var TOTAL = ANSWER_KEY.length;

// SHA-256 password admin awal = js/admin.js → PASSWORD_HASH
var DEFAULT_ADMIN_HASH = '33606b36c7aa4ac03db6d3c8266206c293178646bdae5c8b6be44990c7890c7e';

// Farben wie im Spiel
var C = {
  forest:  '#24402c',
  forestL: '#33573d',
  sage:    '#6c9057',
  sageT:   '#e7f0df',
  cream:   '#f8f1de',
  creamD:  '#efe5cb',
  paper:   '#fffaf0',
  yellow:  '#f4c430',
  ink:     '#24342a',
  muted:   '#7a8578',
  okBg:    '#d6ecd0', okFg: '#1f5a24',
  badBg:   '#f6d2cd', badFg: '#8a2318',
  midBg:   '#fbecc0', midFg: '#6b4c06',
  none:    '#f1eee6'
};

var SHEET_REKAP = 'Rekap';
var SHEET_DETAIL = 'Detail Jawaban';
var SHEET_ANALISIS = 'Analisis Soal';

// Datenblätter: Spalten in dieser Reihenfolge. Zeitstempel als Millisekunden.
var DATA = {
  players: { name: '_players', cols: ['id', 'name', 'name_key', 'created_at', 'last_seen', 'progress_reset_at', 'quiz_reset_at'] },
  saves:   { name: '_saves',   cols: ['player_id', 'saved_at', 'updated_at', 'quests_done', 'data'] },
  quiz:    { name: '_quiz',    cols: ['player_id', 'status', 'answers', 'correct', 'total', 'started_at', 'updated_at', 'submitted_at'] }
};

var MAX_SAVE_CHARS = 45000;      // Zellgrenze in Sheets: 50 000 Zeichen
var NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]{1,39}$/u;


// ── Menü & Einrichtung ─────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎓 Lukas')
    .addItem('Jetzt aktualisieren · Perbarui sekarang', 'refresh')
    .addSeparator()
    .addItem('Einrichtung (einmalig) · Setup', 'setup')
    .addItem('Admin-Passwort ändern · Ganti password admin', 'changeAdminPassword')
    .addToUi();
}

/** Einmal ausführen: Datenblätter anlegen, 1-Minuten-Auslöser setzen, Rekap bauen. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(DATA).forEach(function (k) { dataSheet_(DATA[k]); });
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'rebuildIfDirty' || fn === 'refresh') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rebuildIfDirty').timeBased().everyMinutes(1).create();
  refresh();
  ss.setActiveSheet(ss.getSheetByName(SHEET_REKAP));
  try {
    SpreadsheetApp.getUi().alert('✅ Setup selesai',
      'Sheet data & pemicu otomatis sudah dibuat.\n\nLangkah berikutnya: Deploy → New deployment → Web app ' +
      '(Execute as: Me · Who has access: Anyone), lalu salin URL /exec ke SHEETS_API_URL di js/config.js.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (_) {}
}

function changeAdminPassword() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Admin-Passwort ändern', 'Password admin baru (min. 4 karakter).\n' +
    'Ganti juga PASSWORD_HASH di js/admin.js agar login admin di game ikut berubah.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var pass = res.getResponseText();
  if (!pass || pass.length < 4) { ui.alert('Password terlalu pendek.'); return; }
  var hash = sha256Hex_(pass);
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_SHA256', hash);
  ui.alert('✅ Password diganti', 'PASSWORD_HASH untuk js/admin.js:\n\n' + hash, ui.ButtonSet.OK);
}


// ── Web-App-Schnittstelle ──────────────────────────────────────────

var API = {
  player_login: apiLogin_,
  save_progress: apiSaveProgress_,
  quiz_save_draft: apiQuizDraft_,
  quiz_submit: apiQuizSubmit_,
  admin_results: apiAdminResults_,
  admin_reset_quiz: apiAdminResetQuiz_,
  admin_reset_progress: apiAdminResetProgress_,
  admin_delete_player: apiAdminDeletePlayer_,
  admin_reset_all: apiAdminResetAll_
};

/** Body (text/plain): {"fn": "player_login", "args": {"p_name": "…"}} → {"ok": true, "data": …} */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = API[req.fn];
    if (!fn) fail_('unknown_function', 'Unbekannte Funktion: ' + req.fn);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      out = { ok: true, data: fn(req.args || {}) };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    out = { ok: false, error: { code: err.code || 'server_error', message: String(err.message || err) } };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'Lukas Abenteuer', time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  var err = new Error(message || code);
  err.code = code;
  throw err;
}


// ── Datenblätter ───────────────────────────────────────────────────

function dataSheet_(def) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold').setBackground(C.creamD);
    sh.setFrozenRows(1);
    // Alles als Klartext speichern: Sheets soll weder Namen noch JSON umdeuten
    sh.getRange(1, 1, sh.getMaxRows(), def.cols.length).setNumberFormat('@');
    sh.hideSheet();
    try { sh.protect().setDescription('Daten des Spiels — nicht bearbeiten').setWarningOnly(true); } catch (_) {}
  }
  return sh;
}

/** Alle Zeilen als Objekte: [{ _row, id, name, … }] */
function readRows_(def) {
  var sh = dataSheet_(def);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, def.cols.length).getValues();
  return values.map(function (v, i) {
    var o = { _row: i + 2 };
    def.cols.forEach(function (c, j) { o[c] = v[j]; });
    return o;
  }).filter(function (o) { return o[def.cols[0]] !== ''; });
}

function writeRow_(def, row, obj) {
  var sh = dataSheet_(def);
  var values = [def.cols.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : String(obj[c]); })];
  if (!row) {
    row = sh.getLastRow() + 1;
    if (row > sh.getMaxRows()) {
      sh.insertRowsAfter(sh.getMaxRows(), 500);
      sh.getRange(row, 1, 500, def.cols.length).setNumberFormat('@');
    }
  }
  sh.getRange(row, 1, 1, def.cols.length).setValues(values);
}

function deleteRows_(def, rows) {
  var sh = dataSheet_(def);
  rows.map(function (r) { return r._row; }).sort(function (a, b) { return b - a; })
    .forEach(function (r) { sh.deleteRow(r); });
}

function find_(def, key, value) {
  var rows = readRows_(def);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][key]) === String(value)) return rows[i];
  return null;
}

function num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function json_(text, fallback) {
  try { return text ? JSON.parse(text) : fallback; } catch (_) { return fallback; }
}

function iso_(ms) {
  return num_(ms) ? new Date(num_(ms)).toISOString() : null;
}

function markDirty_() {
  PropertiesService.getScriptProperties().setProperty('DIRTY', String(Date.now()));
}

function cleanName_(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/** Nur Indizes 0–4 für existierende Fragen. */
function cleanAnswers_(answers) {
  var out = {};
  if (!answers || typeof answers !== 'object') return out;
  for (var q = 1; q <= TOTAL; q++) {
    var a = answers[String(q)];
    if (typeof a === 'number' && a >= 0 && a <= 4 && Math.floor(a) === a) out[String(q)] = a;
  }
  return out;
}

function score_(answers, part) {
  var n = 0;
  for (var q = 1; q <= TOTAL; q++) {
    if (part && (q <= 10 ? 1 : 2) !== part) continue;
    if (answers[String(q)] === ANSWER_KEY[q - 1]) n++;
  }
  return n;
}

function questsDone_(data) {
  var qs = (data && data.questState) || {};
  return Object.keys(qs).filter(function (k) { return qs[k] === 'completed'; }).length;
}

function player_(id) {
  var p = find_(DATA.players, 'id', id);
  if (!p) fail_('unknown_player', 'Spieler unbekannt');
  return p;
}

function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = ((b + 256) % 256).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
}

function adminCheck_(pass) {
  var stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_SHA256') || DEFAULT_ADMIN_HASH;
  if (sha256Hex_(pass) !== stored) fail_('forbidden', 'forbidden');
}


// ── API: Spieler ───────────────────────────────────────────────────

/** Anmelden mit Namen. Gleicher Name (ohne Groß/klein & Leerzeichen) = gleiches Konto. */
function apiLogin_(args) {
  var name = cleanName_(args.p_name);
  if (!NAME_RE.test(name)) fail_('invalid_name', 'invalid_name');
  var key = name.toLowerCase();
  var now = Date.now();
  var p = find_(DATA.players, 'name_key', key);
  var isNew = !p;
  if (isNew) {
    p = { id: Utilities.getUuid(), name: name, name_key: key, created_at: now, last_seen: now, progress_reset_at: 0, quiz_reset_at: 0 };
    writeRow_(DATA.players, null, p);
    markDirty_();
  } else {
    p.last_seen = now;
    writeRow_(DATA.players, p._row, p);
  }
  var save = find_(DATA.saves, 'player_id', p.id);
  var quiz = find_(DATA.quiz, 'player_id', p.id);
  return {
    id: p.id,
    name: p.name,
    isNew: isNew,
    progressResetAt: num_(p.progress_reset_at),
    quizResetAt: num_(p.quiz_reset_at),
    save: save ? json_(save.data, null) : null,
    quiz: quiz ? { status: quiz.status, answers: json_(quiz.answers, {}) } : null
  };
}

/** Spielstand sichern. Ältere Stände als der gespeicherte werden ignoriert. */
function apiSaveProgress_(args) {
  var data = args.p_data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  var text = JSON.stringify(data);
  if (text.length > MAX_SAVE_CHARS) return false;
  var at = num_(data.savedAt) || Date.now();
  var p = find_(DATA.players, 'id', args.p_id);
  if (!p || at < num_(p.progress_reset_at)) return false;

  var s = find_(DATA.saves, 'player_id', p.id);
  if (s && num_(s.saved_at) > at) return false;
  var quests = questsDone_(data);
  if (!s || num_(s.quests_done) !== quests) markDirty_();
  writeRow_(DATA.saves, s ? s._row : null, { player_id: p.id, saved_at: at, updated_at: Date.now(), quests_done: quests, data: text });
  return true;
}

/** Zwischenstand der Latihan Soal. Nach dem Abgeben ohne Wirkung. */
function apiQuizDraft_(args) {
  var p = player_(args.p_id);
  var q = find_(DATA.quiz, 'player_id', p.id);
  if (q && q.status === 'submitted') return 'submitted';
  var now = Date.now();
  writeRow_(DATA.quiz, q ? q._row : null, {
    player_id: p.id, status: 'in_progress', answers: JSON.stringify(cleanAnswers_(args.p_answers)),
    correct: '', total: '', started_at: q ? q.started_at : now, updated_at: now, submitted_at: ''
  });
  if (!q) markDirty_();
  return 'in_progress';
}

/** Abgabe. Die Note wird hier berechnet und NICHT zurückgegeben. */
function apiQuizSubmit_(args) {
  var p = player_(args.p_id);
  var q = find_(DATA.quiz, 'player_id', p.id);
  if (q && q.status === 'submitted') return { ok: true, alreadySubmitted: true };
  var answers = cleanAnswers_(args.p_answers);
  var now = Date.now();
  writeRow_(DATA.quiz, q ? q._row : null, {
    player_id: p.id, status: 'submitted', answers: JSON.stringify(answers),
    correct: score_(answers), total: TOTAL, started_at: q ? q.started_at : now, updated_at: now, submitted_at: now
  });
  markDirty_();
  return { ok: true, alreadySubmitted: false };
}


// ── API: Admin ─────────────────────────────────────────────────────

function apiAdminResults_(args) {
  adminCheck_(args.p_pass);
  return collect_();
}

function apiAdminResetQuiz_(args) {
  adminCheck_(args.p_pass);
  var p = find_(DATA.players, 'id', args.p_id);
  if (!p) return false;
  deleteRows_(DATA.quiz, readRows_(DATA.quiz).filter(function (r) { return r.player_id === p.id; }));
  p.quiz_reset_at = Date.now();
  writeRow_(DATA.players, p._row, p);
  markDirty_();
  return true;
}

function apiAdminResetProgress_(args) {
  adminCheck_(args.p_pass);
  var p = find_(DATA.players, 'id', args.p_id);
  if (!p) return false;
  deleteRows_(DATA.saves, readRows_(DATA.saves).filter(function (r) { return r.player_id === p.id; }));
  deleteRows_(DATA.quiz, readRows_(DATA.quiz).filter(function (r) { return r.player_id === p.id; }));
  p.progress_reset_at = Date.now();
  p.quiz_reset_at = p.progress_reset_at;
  writeRow_(DATA.players, p._row, p);
  markDirty_();
  return true;
}

function apiAdminDeletePlayer_(args) {
  adminCheck_(args.p_pass);
  var p = find_(DATA.players, 'id', args.p_id);
  if (!p) return false;
  deleteRows_(DATA.saves, readRows_(DATA.saves).filter(function (r) { return r.player_id === p.id; }));
  deleteRows_(DATA.quiz, readRows_(DATA.quiz).filter(function (r) { return r.player_id === p.id; }));
  deleteRows_(DATA.players, [p]);
  markDirty_();
  return true;
}

/** Alle Spieler, Spielstände und Ergebnisse löschen. */
function apiAdminResetAll_(args) {
  adminCheck_(args.p_pass);
  var count = readRows_(DATA.players).length;
  Object.keys(DATA).forEach(function (k) {
    var sh = dataSheet_(DATA[k]);
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  });
  markDirty_();
  return count;
}

/** Gleiche Form wie früher admin_results: { generatedAt, key, players[] } */
function collect_() {
  var saves = {}, quizzes = {};
  readRows_(DATA.saves).forEach(function (s) { saves[s.player_id] = s; });
  readRows_(DATA.quiz).forEach(function (q) { quizzes[q.player_id] = q; });
  var players = readRows_(DATA.players).map(function (p) {
    var s = saves[p.id], q = quizzes[p.id];
    var data = s ? json_(s.data, {}) : null;
    var answers = q ? json_(q.answers, {}) : {};
    var submitted = q && q.status === 'submitted';
    return {
      id: p.id, name: p.name, name_key: p.name_key,
      created_at: iso_(p.created_at), last_seen: iso_(p.last_seen),
      quests_done: data ? questsDone_(data) : 0,
      active_quest: data ? (data.activeQuestId || null) : null,
      game_score: data && isFinite(Number(data.score)) ? Math.round(Number(data.score)) : null,
      save_updated_at: s ? iso_(s.updated_at) : null,
      quiz_status: q ? q.status : 'none',
      answers: answers,
      correct: submitted ? num_(q.correct) : null,
      part1: submitted ? score_(answers, 1) : null,
      part2: submitted ? score_(answers, 2) : null,
      answered: Object.keys(answers).length,
      total: TOTAL,
      started_at: q ? iso_(q.started_at) : null,
      submitted_at: submitted ? iso_(q.submitted_at) : null
    };
  }).sort(function (a, b) { return a.name_key.localeCompare(b.name_key, 'de'); });
  return {
    generatedAt: new Date().toISOString(),
    key: ANSWER_KEY.map(function (c, i) { return { q: i + 1, part: i < 10 ? 1 : 2, correct: c }; }),
    players: players
  };
}


// ── Aufbau der Übersicht ───────────────────────────────────────────

/** Auslöser (jede Minute): nur neu bauen, wenn sich etwas geändert hat. */
function rebuildIfDirty() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DIRTY')) return;
  props.deleteProperty('DIRTY');
  refresh();
}

function refresh() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { markDirty_(); return; }
  var data;
  try {
    data = collect_();
  } finally {
    lock.releaseLock();
  }
  var ss = SpreadsheetApp.getActive();
  var key = {};
  data.key.forEach(function (k) { key[k.q] = k.correct; });
  var players = data.players;
  var stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd.MM.yyyy HH:mm');

  buildRekap_(sheet_(ss, SHEET_REKAP, 0), players, stamp);
  buildDetail_(sheet_(ss, SHEET_DETAIL, 1), players, key, stamp);
  buildAnalisis_(sheet_(ss, SHEET_ANALISIS, 2), players, key, stamp);
  SpreadsheetApp.flush();
}

function sheet_(ss, name, index) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name, index);
  sh.getBandings().forEach(function (b) { b.remove(); });
  if (sh.getFilter()) sh.getFilter().remove();
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart().clearNote();
  sh.clear();
  sh.setFrozenRows(0);
  sh.setFrozenColumns(0);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setFontFamily('DM Sans').setFontSize(10).setFontColor(C.ink).setVerticalAlignment('middle');
  return sh;
}

function fmt_(iso, tz) {
  if (!iso) return '';
  return Utilities.formatDate(new Date(iso), tz, 'dd.MM.yyyy HH:mm');
}

function grade_(p) {
  return p.quiz_status === 'submitted' && p.total ? Math.round(p.correct / p.total * 100) : '';
}

function statusLabel_(p) {
  if (p.quiz_status === 'submitted') return '✅ Selesai';
  if (p.quiz_status === 'in_progress') return '⏳ Mengerjakan (' + p.answered + '/' + p.total + ')';
  return '— Belum';
}

function title_(sh, cols, title, subtitle) {
  sh.getRange(1, 1, 1, cols).merge().setValue(title)
    .setFontFamily('Playfair Display').setFontSize(18).setFontWeight('bold')
    .setFontColor(C.cream).setBackground(C.forest).setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sh.getRange(2, 1, 1, cols).merge().setValue(subtitle)
    .setFontSize(10).setFontColor('#dfe8d6').setBackground(C.forestL).setFontStyle('italic');
  sh.setRowHeight(1, 44);
  sh.setRowHeight(2, 24);
}

function header_(range) {
  range.setBackground(C.sage).setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
}


// 1 ── Rekap ──────────────────────────────────────────────────────

function buildRekap_(sh, players, stamp) {
  var tz = sh.getParent().getSpreadsheetTimeZone();
  var cols = 11;
  title_(sh, cols, 'Rekap Nilai · Latihan Soal Wechselpräpositionen',
    'Lukas Abenteuer — Willkommen in Hamburg!  ·  diperbarui ' + stamp + '  ·  otomatis dari game');

  var done = players.filter(function (p) { return p.quiz_status === 'submitted'; });
  var grades = done.map(grade_);
  var avg = grades.length ? Math.round(grades.reduce(function (a, b) { return a + b; }, 0) / grades.length) : '–';
  var max = grades.length ? Math.max.apply(null, grades) : '–';
  var min = grades.length ? Math.min.apply(null, grades) : '–';
  var tamat = players.filter(function (p) { return (p.quests_done || 0) >= 10; }).length;

  // Ringkasan: Kacheln in Zeile 4–5
  var tiles = [
    ['Pemain', players.length], ['Tamat (10 Quest)', tamat], ['Sudah kirim', done.length],
    ['Rata-rata nilai', avg], ['Tertinggi', max], ['Terendah', min]
  ];
  sh.setRowHeight(3, 10);
  tiles.forEach(function (t, i) {
    var col = i + 2;
    sh.getRange(4, col).setValue(t[0]).setFontSize(9).setFontColor(C.muted).setBackground(C.creamD)
      .setHorizontalAlignment('center');
    sh.getRange(5, col).setValue(t[1]).setFontSize(16).setFontWeight('bold').setFontColor(C.forest)
      .setBackground(C.cream).setHorizontalAlignment('center');
  });
  sh.getRange(4, 2, 2, tiles.length).setBorder(true, true, true, true, true, false, '#d8ccad', SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(5, 34);
  sh.setRowHeight(6, 12);

  var head = ['No', 'Nama', 'Status', 'Benar', 'Nilai\n(0–100)', 'Teil 1\nOmas Haus', 'Teil 2\nIn der Stadt',
    'Quest\nselesai', 'Poin\ngame', 'Waktu kirim', 'Terakhir aktif'];
  var hr = 7;
  sh.getRange(hr, 1, 1, cols).setValues([head]);
  header_(sh.getRange(hr, 1, 1, cols));
  sh.setRowHeight(hr, 40);

  var rows = players.map(function (p, i) {
    var sub = p.quiz_status === 'submitted';
    return [
      i + 1, p.name, statusLabel_(p),
      sub ? p.correct + ' / ' + p.total : '',
      grade_(p),
      sub ? p.part1 + ' / 10' : '',
      sub ? p.part2 + ' / 10' : '',
      (p.quests_done || 0) + ' / 10',
      p.game_score === null || p.game_score === undefined ? '' : p.game_score,
      fmt_(p.submitted_at, tz),
      fmt_(p.last_seen, tz)
    ];
  });

  if (rows.length) {
    var body = sh.getRange(hr + 1, 1, rows.length, cols);
    body.setValues(rows);
    sh.setRowHeights(hr + 1, rows.length, 28);
    sh.getRange(hr + 1, 1, rows.length, 1).setHorizontalAlignment('center').setFontColor(C.muted);
    sh.getRange(hr + 1, 2, rows.length, 1).setFontWeight('bold');
    sh.getRange(hr + 1, 4, rows.length, 6).setHorizontalAlignment('center');
    sh.getRange(hr + 1, 5, rows.length, 1).setFontWeight('bold').setFontSize(12).setNumberFormat('0');
    sh.getRange(hr + 1, 10, rows.length, 2).setHorizontalAlignment('center').setFontColor(C.muted);
    sh.getRange(hr, 1, rows.length + 1, cols)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
      .setHeaderRowColor(C.sage).setFirstRowColor('#ffffff').setSecondRowColor(C.paper);

    var g = sh.getRange(hr + 1, 5, rows.length, 1);
    var st = sh.getRange(hr + 1, 3, rows.length, 1);
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(80)
        .setBackground(C.okBg).setFontColor(C.okFg).setRanges([g]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(60, 79)
        .setBackground(C.midBg).setFontColor(C.midFg).setRanges([g]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(60)
        .setBackground(C.badBg).setFontColor(C.badFg).setRanges([g]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('✅')
        .setFontColor(C.okFg).setRanges([st]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('⏳')
        .setFontColor(C.midFg).setRanges([st]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('—')
        .setFontColor(C.muted).setRanges([st]).build()
    ]);
    sh.getRange(hr, 1, rows.length + 1, cols).createFilter();
  } else {
    sh.getRange(hr + 1, 1, 1, cols).merge().setValue('Belum ada pemain.')
      .setHorizontalAlignment('center').setFontColor(C.muted).setFontStyle('italic');
  }

  var legend = hr + Math.max(rows.length, 1) + 2;
  sh.getRange(legend, 2, 1, 6).merge()
    .setValue('Nilai = jumlah benar ÷ 20 × 100   ·   hijau ≥ 80   ·   kuning 60–79   ·   merah < 60')
    .setFontSize(9).setFontColor(C.muted).setFontStyle('italic');

  [48, 220, 190, 80, 84, 96, 96, 80, 80, 130, 130].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(hr);
  sh.setFrozenColumns(2);
}


// 2 ── Detail Jawaban ─────────────────────────────────────────────

function buildDetail_(sh, players, key, stamp) {
  var n = QUESTIONS.length;
  var cols = 3 + n;
  title_(sh, cols, 'Detail Jawaban · per Soal',
    'Huruf = jawaban siswa  ·  hijau benar  ·  merah salah  ·  abu-abu belum dijawab  ·  diperbarui ' + stamp);

  var head = ['No', 'Nama', 'Benar'];
  for (var q = 1; q <= n; q++) head.push(String(q));
  var hr = 4;
  sh.getRange(hr, 1, 1, cols).setValues([head]);
  header_(sh.getRange(hr, 1, 1, cols));
  for (var q2 = 1; q2 <= n; q2++) sh.getRange(hr, 3 + q2).setNote(q2 + '. ' + QUESTIONS[q2 - 1]);
  sh.getRange(hr, 4, 1, 10).setBackground(C.sage);
  sh.getRange(hr, 14, 1, 10).setBackground('#5b7d49');

  var keyRow = ['', 'KUNCI JAWABAN', ''];
  for (var q3 = 1; q3 <= n; q3++) keyRow.push(LETTERS[key[q3]] || '?');
  sh.getRange(hr + 1, 1, 1, cols).setValues([keyRow])
    .setBackground('#fdf1c7').setFontWeight('bold').setFontColor('#5a4210').setHorizontalAlignment('center');
  sh.getRange(hr + 1, 2).setHorizontalAlignment('left');

  var shown = players.filter(function (p) { return p.quiz_status !== 'none'; });
  if (shown.length) {
    var values = [], bgs = [], fgs = [];
    shown.forEach(function (p, i) {
      var sub = p.quiz_status === 'submitted';
      var row = [i + 1, p.name + (sub ? '' : '  (draft)'), sub ? p.correct + '/' + p.total : ''];
      var bg = ['#ffffff', '#ffffff', '#ffffff'], fg = [C.muted, C.ink, C.forest];
      for (var q = 1; q <= n; q++) {
        var a = p.answers ? p.answers[String(q)] : undefined;
        var has = typeof a === 'number';
        row.push(has ? LETTERS[a] : '–');
        if (!has) { bg.push(C.none); fg.push('#b3ad9f'); }
        else if (!sub) { bg.push('#ffffff'); fg.push(C.ink); }
        else if (a === key[q]) { bg.push(C.okBg); fg.push(C.okFg); }
        else { bg.push(C.badBg); fg.push(C.badFg); }
      }
      values.push(row); bgs.push(bg); fgs.push(fg);
    });
    var r = sh.getRange(hr + 2, 1, values.length, cols);
    r.setValues(values).setBackgrounds(bgs).setFontColors(fgs).setHorizontalAlignment('center');
    sh.getRange(hr + 2, 2, values.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
    sh.getRange(hr + 2, 4, values.length, n).setFontWeight('bold');
    sh.setRowHeights(hr + 2, values.length, 26);
    sh.getRange(hr, 1, values.length + 2, cols)
      .setBorder(true, true, true, true, true, true, '#e4dcc6', SpreadsheetApp.BorderStyle.SOLID);
  }

  sh.setColumnWidth(1, 44);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 64);
  for (var c = 4; c <= cols; c++) sh.setColumnWidth(c, 36);
  sh.setRowHeight(hr, 30);
  sh.setFrozenRows(hr + 1);
  sh.setFrozenColumns(3);
}


// 3 ── Analisis Soal ──────────────────────────────────────────────

function buildAnalisis_(sh, players, key, stamp) {
  var cols = 12;
  var done = players.filter(function (p) { return p.quiz_status === 'submitted'; });
  title_(sh, cols, 'Analisis Soal',
    done.length + ' siswa sudah mengirim  ·  soal dengan % benar rendah perlu dibahas lagi  ·  diperbarui ' + stamp);

  var head = ['No', 'Teil', 'Pertanyaan', 'Kunci', '% Benar', 'Grafik', 'A', 'B', 'C', 'D', 'E', 'Pengecoh terbanyak'];
  var hr = 4;
  sh.getRange(hr, 1, 1, cols).setValues([head]);
  header_(sh.getRange(hr, 1, 1, cols));
  sh.setRowHeight(hr, 30);

  var rows = QUESTIONS.map(function (text, i) {
    var q = i + 1;
    var counts = [0, 0, 0, 0, 0], ok = 0;
    done.forEach(function (p) {
      var a = p.answers ? p.answers[String(q)] : undefined;
      if (typeof a === 'number') { counts[a]++; if (a === key[q]) ok++; }
    });
    var wrong = counts.map(function (c, j) { return j === key[q] ? -1 : c; });
    var top = Math.max.apply(null, wrong);
    var distractor = top > 0 ? LETTERS[wrong.indexOf(top)] + ' (' + top + ' siswa)' : '–';
    var pct = done.length ? ok / done.length : '';
    return [q, q <= 10 ? 'Teil 1' : 'Teil 2', text, LETTERS[key[q]] || '?', pct, '',
      counts[0], counts[1], counts[2], counts[3], counts[4], distractor];
  });

  var body = sh.getRange(hr + 1, 1, rows.length, cols);
  body.setValues(rows);
  sh.setRowHeights(hr + 1, rows.length, 28);
  sh.getRange(hr + 1, 5, rows.length, 1).setNumberFormat('0%').setFontWeight('bold');
  sh.getRange(hr + 1, 1, rows.length, 2).setHorizontalAlignment('center').setFontColor(C.muted);
  sh.getRange(hr + 1, 4, rows.length, 9).setHorizontalAlignment('center');
  sh.getRange(hr + 1, 3, rows.length, 1).setWrap(true);
  sh.getRange(hr + 1, 4, rows.length, 1).setFontWeight('bold').setBackground('#fdf1c7').setFontColor('#5a4210');

  // Balken: SPARKLINE des Prozentwerts
  var formulas = rows.map(function (r, i) {
    var cell = 'E' + (hr + 1 + i);
    return ['=IF(' + cell + '="","",SPARKLINE(' + cell + ',{"charttype","bar";"max",1;"color1",IF(' + cell +
      '>=0.8,"' + C.sage + '",IF(' + cell + '>=0.6,"' + C.yellow + '","#d96b5b"))}))'];
  });
  sh.getRange(hr + 1, 6, rows.length, 1).setFormulas(formulas);

  // Richtige Option in der Verteilung grün hinterlegen
  for (var i = 0; i < rows.length; i++) {
    var k = key[i + 1];
    if (typeof k === 'number') sh.getRange(hr + 1 + i, 7 + k).setBackground(C.okBg).setFontColor(C.okFg).setFontWeight('bold');
  }

  var pr = sh.getRange(hr + 1, 5, rows.length, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0.8)
      .setFontColor(C.okFg).setRanges([pr]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.6, 0.7999)
      .setFontColor(C.midFg).setRanges([pr]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.6)
      .setFontColor(C.badFg).setBackground(C.badBg).setRanges([pr]).build()
  ]);
  sh.getRange(hr, 1, rows.length + 1, cols)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(C.sage).setFirstRowColor('#ffffff').setSecondRowColor(C.paper);

  [44, 60, 360, 56, 72, 150, 40, 40, 40, 40, 40, 150].forEach(function (w, j) { sh.setColumnWidth(j + 1, w); });
  sh.setFrozenRows(hr);
}
