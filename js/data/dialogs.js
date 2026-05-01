// ═══════════════════════════════════════════════════════════════════
// js/data/dialogs.js — DIALOG TREES
//
// Struktur:
//   Setiap dialog = sekumpulan "node". Node punya:
//     id        — unique key dalam dialog ini
//     speaker   — npc id yang ngomong (atau 'lukas')
//     text      — kalimat (Jerman). Mendukung tag <vocab title="terjemahan">kata</vocab>
//                 untuk highlight kosakata (di-render Step 8)
//     choices   — [{ text, next, correct?, score? }]   (kalau ada → multiple choice)
//     next      — id node berikutnya (kalau tidak ada choices → linear)
//     onEnter   — efek samping saat node dimasuki:
//                  { type: 'progress_quest', step: 'step1_talk_oma' }
//                  { type: 'add_journal',    entry: 'oma_intro' }
//                  { type: 'add_score',      delta: 50 }
//                  { type: 'unlock_vocab',   words: [...] }
//     end       — true → dialog selesai setelah node ini
//
//   Dialog di-trigger lewat: window dispatchEvent EVENTS.DIALOG_OPEN
//                            { dialogId: 'oma_quest1_intro' }
// ═══════════════════════════════════════════════════════════════════


export const DIALOGS = {

  // ════════════════════════════════════════════════════════════════
  // GREETING DIALOGS — sapaan singkat saat NPC ditekan E pertama kali
  // (tanpa quest progression)
  // ════════════════════════════════════════════════════════════════

  oma_helga_greeting: {
    id:    'oma_helga_greeting',
    start: 'g1',
    nodes: {
      g1: {
        id:      'g1',
        speaker: 'oma_helga',
        text:    'Lukas, mein Schatz! Du bist endlich da. Komm, setz dich!',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'oma_helga',
        text:    'Bist du müde von der Reise? <vocab title="Penerbangan">Der Flug</vocab> war bestimmt anstrengend.',
        end:     true,
      },
    },
  },

  opa_klaus_greeting: {
    id:    'opa_klaus_greeting',
    start: 'g1',
    nodes: {
      g1: {
        id:      'g1',
        speaker: 'opa_klaus',
        text:    'Ah, mein Junge. Schön, dass du wieder hier bist.',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'opa_klaus',
        text:    'Hamburg hat sich verändert, weißt du. Aber das <vocab title="Pelabuhan">Hafen</vocab> riecht immer noch nach Salz und Geschichte.',
        end:     true,
      },
    },
  },

  onkel_andre_greeting: {
    id:    'onkel_andre_greeting',
    start: 'g1',
    nodes: {
      g1: {
        id:      'g1',
        speaker: 'onkel_andre',
        text:    'Hallo Lukas! Wie war dein <vocab title="Penerbangan">Flug</vocab> aus Indonesien?',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'onkel_andre',
        text:    'Leni freut sich schon wahnsinnig auf dich. Sie ist nur noch in der Schule.',
        end:     true,
      },
    },
  },

  tante_maria_greeting: {
    id:    'tante_maria_greeting',
    start: 'g1',
    nodes: {
      g1: {
        id:      'g1',
        speaker: 'tante_maria',
        text:    'Lukas! Du bist so groß geworden! Ich erinnere mich noch, als du sieben warst.',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'tante_maria',
        text:    'Wie geht es deiner <vocab title="Ibu">Mutter</vocab> in Indonesien? Erzähl mir später alles.',
        end:     true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // QUEST 1 — "Oma braucht Hilfe!"
  // ════════════════════════════════════════════════════════════════

  oma_quest1_intro: {
    id:        'oma_quest1_intro',
    start:     'q1_1',
    questId:   'quest_1',
    nodes: {
      q1_1: {
        id:      'q1_1',
        speaker: 'oma_helga',
        text:    'Lukas, mein Schatz, du bist gerade rechtzeitig! Ich koche heute <vocab title="Sup khas Hamburg">Eintopf</vocab> zur Begrüßung.',
        next:    'q1_2',
      },
      q1_2: {
        id:      'q1_2',
        speaker: 'oma_helga',
        text:    'Aber... oh nein, ich habe vergessen, einkaufen zu gehen! <vocab title="Sayang">Liebling</vocab>, ich brauche deine <vocab title="Bantuan">Hilfe</vocab>!',
        next:    'q1_3',
      },
      q1_3: {
        id:      'q1_3',
        speaker: 'oma_helga',
        text:    'Geh bitte zum <vocab title="Supermarket">Supermarkt</vocab> und kauf: <vocab title="Kentang">Kartoffeln</vocab>, <vocab title="Sosis kecil">Würstchen</vocab>, <vocab title="Ayam">Hähnchen</vocab>, und <vocab title="Saus tomat">Ketchup</vocab>.',
        next:    'q1_4',
      },
      q1_4: {
        id:      'q1_4',
        speaker: 'lukas',
        text:    'Klar, Oma! Aber... wo ist der Supermarkt?',
        next:    'q1_5',
      },
      q1_5: {
        id:      'q1_5',
        speaker: 'oma_helga',
        text:    'Oh! Der EDEKA liegt in der <vocab title="Jalan utama">Hauptstraße</vocab>. Schau in dein <vocab title="Buku perjalanan">Reisetagebuch</vocab> — ich habe alles für dich aufgeschrieben.',
        next:    'q1_6',
      },
      q1_6: {
        id:      'q1_6',
        speaker: 'oma_helga',
        text:    'Beeil dich, Liebling! Wenn du etwas vergisst, frag die Nachbarn. Sie helfen dir gerne.',
        onEnter: [
          { type: 'progress_quest',  step: 'step1_talk_oma' },
          { type: 'add_journal',     entry: 'oma_quest1_letter' },
          { type: 'show_quest',      questId: 'quest_1' },
        ],
        end: true,
      },
    },
  },


  // Pulang ke Oma setelah belanja semua bahan
  oma_quest1_return: {
    id:    'oma_quest1_return',
    start: 'r1_1',
    nodes: {
      r1_1: {
        id:      'r1_1',
        speaker: 'oma_helga',
        text:    'Du bist zurück! Hast du alles bekommen?',
        next:    'r1_2',
      },
      r1_2: {
        id:      'r1_2',
        speaker: 'lukas',
        text:    'Ja Oma, hier sind die Kartoffeln, Würstchen, Hähnchen, und Ketchup.',
        next:    'r1_quiz',
      },
      // Quiz: di mana letak kasir?
      r1_quiz: {
        id:      'r1_quiz',
        speaker: 'oma_helga',
        text:    'Sehr gut! Eine Frage noch: Wo war die <vocab title="Kasir">Kasse</vocab> im EDEKA?',
        choices: [
          {
            text:    'Neben dem Eingang',
            correct: false,
            score:   -10,
            next:    'r1_quiz_wrong',
          },
          {
            text:    'Am Ausgang, neben dem Zeitungsregal',
            correct: true,
            score:   100,
            next:    'r1_quiz_correct',
          },
          {
            text:    'In der Mitte des Marktes',
            correct: false,
            score:   -10,
            next:    'r1_quiz_wrong',
          },
        ],
      },
      r1_quiz_correct: {
        id:      'r1_quiz_correct',
        speaker: 'oma_helga',
        text:    '<vocab title="Sangat baik">Ausgezeichnet</vocab>, mein Schatz! Du hast gut aufgepasst.',
        next:    'r1_done',
      },
      r1_quiz_wrong: {
        id:      'r1_quiz_wrong',
        speaker: 'oma_helga',
        text:    'Hmm, schau noch einmal in dein Reisetagebuch... die Kasse war am Ausgang.',
        next:    'r1_done',
      },
      r1_done: {
        id:      'r1_done',
        speaker: 'oma_helga',
        text:    '<vocab title="Terima kasih">Danke</vocab>, Lukas. Jetzt kann der Eintopf kochen. Geh dich ausruhen, Liebling!',
        onEnter: [
          { type: 'complete_quest',  questId: 'quest_1' },
          { type: 'add_score',       delta: 200, label: 'Quest 1 abgeschlossen' },
        ],
        end: true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // QUEST 2 — "Leni abholen!" (intro)
  // ════════════════════════════════════════════════════════════════

  oma_quest2_intro: {
    id:    'oma_quest2_intro',
    start: 'q2_1',
    questId: 'quest_2',
    nodes: {
      q2_1: {
        id:      'q2_1',
        speaker: 'oma_helga',
        text:    'Liebling, ich bin so müde von gestern. Kannst du Leni von der Schule <vocab title="Menjemput">abholen</vocab>?',
        next:    'q2_2',
      },
      q2_2: {
        id:      'q2_2',
        speaker: 'oma_helga',
        text:    'Die <vocab title="Sekolah dasar">Grundschule</vocab> ist nördlich von hier. Sie schließt um 14 Uhr.',
        next:    'q2_3',
      },
      q2_3: {
        id:      'q2_3',
        speaker: 'lukas',
        text:    'Natürlich, Oma. Ich gehe sofort.',
        onEnter: [
          { type: 'progress_quest', step: 'step1_talk_oma_q2' },
          { type: 'show_quest',     questId: 'quest_2' },
        ],
        end: true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STUB DIALOGS untuk Quest 3-10 (placeholder satu node)
  // ════════════════════════════════════════════════════════════════

  felix_quest3_intro: {
    id: 'felix_quest3_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'felix',
            text: 'Alter! Du musst den Hafen sehen. Komm mit!',
            end: true },
    },
  },

  tante_quest4_intro: {
    id: 'tante_quest4_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'tante_maria',
            text: 'Komm, lass uns zum Wochenmarkt gehen.',
            end: true },
    },
  },

  opa_quest5_intro: {
    id: 'opa_quest5_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'opa_klaus',
            text: 'Setz dich, Junge. Ich erzähl dir vom alten Hamburg.',
            end: true },
    },
  },

  leni_quest6_intro: {
    id: 'leni_quest6_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'leni',
            text: 'Lukas! Hilfst du mir in der Bücherei?',
            end: true },
    },
  },

  oma_quest7_intro: {
    id: 'oma_quest7_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'oma_helga',
            text: 'Mir tut der Kopf weh. Holst du was aus der Apotheke?',
            end: true },
    },
  },

  opa_quest8_intro: {
    id: 'opa_quest8_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'opa_klaus',
            text: 'Heute Abend essen wir alle zusammen im Restaurant.',
            end: true },
    },
  },

  felix_quest9_intro: {
    id: 'felix_quest9_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'felix',
            text: 'Komm an die Elbe — der Sonnenuntergang ist genial.',
            end: true },
    },
  },

  oma_quest10_intro: {
    id: 'oma_quest10_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'oma_helga',
            text: 'Heute Abend ist dein letzter. Lass uns alle zusammen feiern.',
            end: true },
    },
  },
};


// ═══════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES — teks di Reisetagebuch
// ═══════════════════════════════════════════════════════════════════

export const JOURNAL_ENTRIES = {

  oma_quest1_letter: {
    title:    'Omas Einkaufsliste',
    subtitle: 'Geschrieben von Oma Helga',
    body: `
Mein Schatz Lukas,

der EDEKA-Supermarkt liegt in der <vocab title="Jalan utama">Hauptstraße</vocab>. Er befindet sich <vocab title="Di antara">zwischen</vocab> der Bäckerei und der Post.

<vocab title="Di depan">Vor</vocab> dem Eingang stehen zwei große Einkaufswagen. <vocab title="Sebelah kiri dari">Links vom</vocab> Eingang sind das Obst und das Gemüse.

Die Kasse befindet sich <vocab title="Di">am</vocab> Ausgang, <vocab title="Sebelah">neben</vocab> dem Zeitungsregal.

Was ich brauche:
• Kartoffeln
• Würstchen
• Hähnchen
• Ketchup

Beeil dich, Liebling!
    `.trim(),
  },
};


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getDialog(id) {
  return DIALOGS[id] || null;
}

export function getJournalEntry(id) {
  return JOURNAL_ENTRIES[id] || null;
}


// Map: NPC id → dialog id default (greeting saat tidak ada quest aktif)
export const NPC_DEFAULT_DIALOG = {
  oma_helga:    'oma_helga_greeting',
  opa_klaus:    'opa_klaus_greeting',
  onkel_andre:  'onkel_andre_greeting',
  tante_maria:  'tante_maria_greeting',
};
