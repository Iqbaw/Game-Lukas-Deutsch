// ═══════════════════════════════════════════════════════════════════
// js/data/latihan.js — LATIHAN SOAL Wechselpräpositionen
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Isi dari dokumen SOAL.docx: 2 Lesetext, 20 soal pilihan ganda (A–E).
// Setelah semua Quest selesai, siswa mengerjakan soal ini (js/latihan.js).
//
// SENGAJA TANPA KUNCI JAWABAN: penilaian berjalan di database
// (ANSWER_KEY di google-sheets/Code.gs), supaya kunci tidak bisa
// diintip lewat DevTools. Jawaban disimpan sebagai indeks opsi (0 = A).
// ═══════════════════════════════════════════════════════════════════

export const LATIHAN_ID = 'wechselpraepositionen_v1';

export const LATIHAN_PARTS = [
  {
    id:       'teil1',
    label:    'Teil 1',
    title:    'Omas Haus',
    subtitle: 'Lesetext 1',
    instruction: 'Lies den Text. Markiere bitte die richtige Antwort mit einem Kreuz.',
    text: [
      'Lukas schläft im Zimmer von Oma. Als er aufwacht, hat er großen Hunger. Oma ist nicht zu Hause, aber sie schickt ihm eine SMS: „Guten Morgen! Die Wurst liegt im Kühlschrank. Das Ei ist auch im Kühlschrank. Auf dem Tisch liegt das Messer. Die Pfanne liegt unter dem Herd. Das Salz steht auf dem Regal.“',
      'Lukas liest die Nachricht und sucht alles. Er findet die Wurst und das Ei im Kühlschrank, das Messer auf dem Tisch, und die Pfanne unter dem Herd. Schließlich macht er sein Frühstück fertig.',
      'Kurz danach ruft Tante Hanna an: „Felix hat sein Spielzeug vergessen! Es liegt irgendwo im Wohnzimmer — vielleicht auf dem Regal oder unter dem Sofa.“ Lukas sucht und findet es.',
    ],
    questions: [
      { n: 1, q: 'Lukas möchte Wurst zum Frühstück. Wo ist die Wurst?', options: [
        'Die Wurst liegt auf dem Kühlschrank',
        'Lukas soll die Wurst kaufen',
        'Die Wurst liegt auf dem Tisch',
        'Die Wurst liegt im Kühlschrank',
        'Oma hat die Wurst verloren',
      ] },
      { n: 2, q: 'Wo liegt das Ei?', options: [
        'Das Ei liegt auf dem Kühlschrank',
        'Das Ei liegt unter dem Herd',
        'Lukas muss für das Ei in den Supermarkt gehen',
        'Das Ei ist kaputt',
        'Das Ei liegt im Kühlschrank',
      ] },
      { n: 3, q: 'Wo liegt das Messer?', options: [
        'Das Messer ist im Schrank',
        'Das Messer liegt unter dem Tisch',
        'Lukas muss das Messer kaufen',
        'Das Messer liegt auf dem Tisch',
        'Das Messer liegt auf dem Regal',
      ] },
      { n: 4, q: 'Wo steht das Salz?', options: [
        'Das Salz ist im Kühlschrank',
        'Das Salz liegt unter dem Regal',
        'Das Salz liegt auf dem Tisch',
        'Das Salz steht auf dem Regal',
        'Lukas soll das Salz kaufen',
      ] },
      { n: 5, q: 'Wo liegt die Pfanne?', options: [
        'Die Pfanne hängt an der Wand',
        'Die Pfanne liegt auf dem Herd',
        'Die Pfanne liegt unter dem Herd',
        'Die Pfanne liegt im Schrank',
        'Lukas hat die Pfanne schon gefunden',
      ] },
      { n: 6, q: 'Wo liegt vielleicht das Spielzeug von Felix?', options: [
        'Das Spielzeug ist sicher auf dem Sofa',
        'Tante Hanna weiß genau, wo das Spielzeug liegt',
        'Das Spielzeug liegt im Schrank',
        'Felix hat das Spielzeug mitgenommen',
        'Das Spielzeug liegt unter dem Sofa',
      ] },
      { n: 7, q: 'Wo sind die Sachen in der Küche?', options: [
        'Alles liegt auf dem Tisch',
        'Alles ist im Kühlschrank',
        'Alles liegt unter dem Herd',
        'Die Sachen sind an verschiedenen Orten: im Kühlschrank, auf dem Tisch und unter dem Herd',
        'Alles liegt auf dem Regal',
      ] },
      { n: 8, q: 'Warum schreibt Oma eine SMS an Lukas?', options: [
        'Lukas kennt die Küche schon gut',
        'Alles ist leicht zu finden',
        'Lukas weiß die Orte ohne Hilfe',
        'Oma erklärt, wo die Sachen liegen',
        'Die Küche ist leer',
      ] },
      { n: 9, q: 'Wo liegt der Teller wahrscheinlich?', options: [
        'Im Schrank',
        'Unter dem Tisch',
        'Auf dem Tisch',
        'Im Kühlschrank',
        'Unter dem Regal',
      ] },
      { n: 10, q: 'Wo liegt das Spielzeug von Felix?', options: [
        'Das Spielzeug liegt auf dem Sofa',
        'Das Spielzeug liegt im Schrank',
        'Das Spielzeug liegt auf dem Regal',
        'Das Spielzeug liegt unter dem Sofa',
        'Das Spielzeug liegt auf dem Boden',
      ] },
    ],
  },
  {
    id:       'teil2',
    label:    'Teil 2',
    title:    'In der Stadt',
    subtitle: 'Lesetext 2',
    instruction: 'Lies den Text. Markiere bitte die richtige Antwort mit einem Kreuz.',
    text: [
      'Lukas verlässt Omas Haus und hat viele Aufgaben in der Stadt. Tante Hanna sagt: „Die Schule liegt am Park, am Rand der Stadt.“ Lukas läuft zum Park und findet die Schule.',
      'Danach soll Lukas einkaufen. Ein Passant erklärt: „Der Supermarkt liegt neben der Apotheke, am Marktplatz.“ Lukas findet den Supermarkt und kauft alles ein.',
      'Dann möchte Lukas Eis kaufen. Jemand sagt: „Die Eisdiele liegt im Zentrum der Stadt, neben dem Café.“ Lukas geht dorthin. Auf dem Rückweg verirrt er sich. Er erinnert sich: „Omas Haus liegt am Ende der Lindenstraße, neben dem kleinen Brunnen.“ So findet er den Weg zurück.',
      'Am Abend möchte Lukas ins Kino. Das Kino liegt im Stadtpark, neben dem Rathaus. Lukas findet es rechtzeitig.',
    ],
    questions: [
      { n: 11, q: 'Wo liegt die Eisdiele?', options: [
        'Die Eisdiele ist schwer zu finden',
        'Die Eisdiele liegt am Rand der Stadt',
        'Die Eisdiele liegt im Zentrum der Stadt',
        'Die Eisdiele liegt neben Omas Haus',
        'Die Eisdiele liegt weit vom Supermarkt entfernt',
      ] },
      { n: 12, q: 'Wo liegt das Kino?', options: [
        'Das Kino liegt am Rand des Parks',
        'Das Kino liegt neben dem Park',
        'Das Kino liegt gegenüber dem Park',
        'Das Kino liegt im Stadtpark',
        'Das Kino liegt am Marktplatz',
      ] },
      { n: 13, q: 'Wo liegt die Schule?', options: [
        'Die Schule liegt im Park',
        'Die Schule liegt weit vom Park entfernt',
        'Die Schule liegt unter dem Park',
        'Die Schule liegt am Park',
        'Die Schule liegt auf dem Park',
      ] },
      { n: 14, q: 'Wo liegt der Supermarkt?', options: [
        'Der Supermarkt liegt weit vom Zentrum entfernt',
        'Der Supermarkt liegt im Wald',
        'Der Supermarkt ist schwer zu finden',
        'Der Supermarkt liegt am Marktplatz',
        'Der Supermarkt liegt unter dem Marktplatz',
      ] },
      { n: 15, q: 'Wo liegt der Supermarkt im Verhältnis zur Apotheke?', options: [
        'Der Supermarkt und die Apotheke sind weit voneinander entfernt',
        'Der Supermarkt liegt gegenüber der Apotheke',
        'Die Apotheke ist im Supermarkt',
        'Lukas muss zuerst in die Apotheke gehen',
        'Der Supermarkt liegt neben der Apotheke',
      ] },
      { n: 16, q: 'Wo liegt Omas Haus?', options: [
        'Der Brunnen ist in Omas Garten',
        'Omas Haus ist sehr groß',
        'Lukas muss am Brunnen vorbeigehen und dann weiterlaufen',
        'Omas Haus liegt neben dem kleinen Brunnen',
        'Omas Haus liegt weit vom Brunnen entfernt',
      ] },
      { n: 17, q: 'Wie beschreibt der Text die Gebäude in der Stadt?', options: [
        'Alle Gebäude liegen im Zentrum der Stadt',
        'Alle Gebäude liegen am Park',
        'Alle Gebäude haben eine Straßennummer',
        'Die Gebäude werden mit „neben“ oder „am“ beschrieben',
        'Alle Gebäude liegen auf der gleichen Straße',
      ] },
      { n: 18, q: 'Wie findet man Orte in einer fremden Stadt am besten?', options: [
        'Man soll immer eine Karte kaufen',
        'Man soll nur im Zentrum der Stadt bleiben',
        'Man soll immer jemanden anrufen',
        'Man soll immer zu Fuß gehen',
        'Man soll bekannte Orte wie Park oder Brunnen nutzen',
      ] },
      { n: 19, q: 'Wo liegt das Kino genau?', options: [
        'Das Kino liegt am Rand des Parks',
        'Das Kino liegt neben dem Park',
        'Das Kino liegt auf dem Park',
        'Das Kino liegt am Marktplatz',
        'Das Kino liegt im Park',
      ] },
      { n: 20, q: 'Wo liegt die Apotheke im Verhältnis zum Supermarkt?', options: [
        'Die Apotheke liegt im Supermarkt',
        'Die Apotheke liegt am Marktplatz',
        'Die Apotheke liegt gegenüber dem Supermarkt',
        'Die Apotheke liegt hinter dem Supermarkt',
        'Die Apotheke liegt neben dem Supermarkt',
      ] },
    ],
  },
];

/** Semua soal berurutan, masing-masing dengan referensi ke bagiannya. */
export const LATIHAN_QUESTIONS = LATIHAN_PARTS.flatMap((part, p) =>
  part.questions.map((q) => ({ ...q, part: p })));

export const LATIHAN_TOTAL = LATIHAN_QUESTIONS.length;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
