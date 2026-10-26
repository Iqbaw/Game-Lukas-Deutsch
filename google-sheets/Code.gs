/**
 * ═══════════════════════════════════════════════════════════════════
 * google-sheets/Code.gs — REKAP NILAI · Lukas Abenteuer
 *
 * Google Apps Script yang menempel di sebuah Google Spreadsheet.
 * Menarik data semua pemain dari Supabase (fungsi admin_results) lalu
 * MEMBANGUN ULANG tiga sheet yang rapi:
 *
 *   1. Rekap          — satu baris per siswa: status, benar, nilai, Teil 1/2,
 *                       quest, poin game, waktu kirim + ringkasan kelas
 *   2. Detail Jawaban — matriks siswa × soal (A–E), hijau benar / merah salah
 *   3. Analisis Soal  — % benar per soal, sebaran jawaban, pengecoh terbanyak
 *
 * Kapan diperbarui:
 *   • otomatis setiap ada siswa yang mengirim jawaban / admin reset
 *     (Supabase memanggil doPost lewat webhook — lihat SETUP-ONLINE.md)
 *   • setiap 5 menit (pemicu waktu, menu „Lukas › Aktualisierung …“)
 *   • manual lewat menu „🎓 Lukas › Jetzt aktualisieren“
 *
 * Script Properties (Project Settings → Script properties):
 *   SUPABASE_URL       https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY  anon / publishable key
 *   ADMIN_PASSWORD     password admin game (sama seperti di dalam game)
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


// ── Menü & Auslöser ────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎓 Lukas')
    .addItem('Jetzt aktualisieren · Perbarui sekarang', 'refresh')
    .addSeparator()
    .addItem('Aktualisierung alle 5 Min. einschalten', 'installTimer')
    .addItem('Aktualisierung alle 5 Min. ausschalten', 'removeTimer')
    .addSeparator()
    .addItem('Einrichtung prüfen · Cek pengaturan', 'checkSetup')
    .addToUi();
}

/** Webhook dari Supabase (lihat trigger _notify_sheets di schema.sql). */
function doPost(e) {
  refresh();
  return ContentService.createTextOutput('ok');
}

/** Untuk tes di browser: membuka URL Web App = perbarui. */
function doGet(e) {
  refresh();
  return ContentService.createTextOutput('Lukas Rekap diperbarui: ' + new Date());
}

function installTimer() {
  removeTimer();
  ScriptApp.newTrigger('refresh').timeBased().everyMinutes(5).create();
  toast_('Aktualisierung alle 5 Minuten ist eingeschaltet.');
}

function removeTimer() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refresh') ScriptApp.deleteTrigger(t);
  });
}

function checkSetup() {
  var ui = SpreadsheetApp.getUi();
  try {
    var data = fetchResults_();
    ui.alert('✅ Verbindung OK', 'Supabase erreichbar. ' + data.players.length + ' Spieler gefunden.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('⚠️ Problem', String(err.message || err), ui.ButtonSet.OK);
  }
}


// ── Daten ─────────────────────────────────────────────────────────

function props_() {
  var p = PropertiesService.getScriptProperties();
  var url = String(p.getProperty('SUPABASE_URL') || '').replace(/\/+$/, '');
  var key = String(p.getProperty('SUPABASE_ANON_KEY') || '');
  var pass = String(p.getProperty('ADMIN_PASSWORD') || '');
  if (!url || !key || !pass) {
    throw new Error('Script properties SUPABASE_URL, SUPABASE_ANON_KEY dan ADMIN_PASSWORD belum diisi (Project Settings → Script properties).');
  }
  return { url: url, key: key, pass: pass };
}

function fetchResults_() {
  var cfg = props_();
  var headers = { apikey: cfg.key };
  if (cfg.key.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + cfg.key;
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/rpc/admin_results', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ p_pass: cfg.pass }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code === 403 || /forbidden/.test(body)) throw new Error('ADMIN_PASSWORD salah (forbidden).');
  if (code >= 300) throw new Error('Supabase ' + code + ': ' + body.slice(0, 300));
  return JSON.parse(body);
}


// ── Aufbau ────────────────────────────────────────────────────────

function refresh() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var data = fetchResults_();
    var ss = SpreadsheetApp.getActive();
    var key = {};
    (data.key || []).forEach(function (k) { key[k.q] = k.correct; });
    var players = (data.players || []).slice().sort(function (a, b) {
      return a.name_key.localeCompare(b.name_key, 'de');
    });
    var stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd.MM.yyyy HH:mm');

    buildRekap_(sheet_(ss, SHEET_REKAP, 0), players, stamp);
    buildDetail_(sheet_(ss, SHEET_DETAIL, 1), players, key, stamp);
    buildAnalisis_(sheet_(ss, SHEET_ANALISIS, 2), players, key, stamp);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
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


function toast_(msg) {
  try { SpreadsheetApp.getActive().toast(msg, 'Lukas', 5); } catch (_) {}
}
