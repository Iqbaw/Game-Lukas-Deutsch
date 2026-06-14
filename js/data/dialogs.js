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


  hans_hint_quest1: {
    id:    'hans_hint_quest1',
    start: 'h1',
    nodes: {
      h1: {
        id:      'h1',
        speaker: 'nachbar_hans',
        text:    'Moin Lukas! Du suchst den EDEKA?',
        next:    'h2',
      },
      h2: {
        id:      'h2',
        speaker: 'nachbar_hans',
        text:    'Er liegt in der Hauptstraße, genau zwischen der Bäckerei und der Post!',
        end:     true,
      },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // STAGE 1, QUEST 1 — "Lukas macht Frühstück!"
  // FLOW:
  //   1) lukas_bedroom_monologue  (game start → di Schlafzimmer)
  //   2) lukas_kitchen_monologue  (reach Küche)
  //   3) oma_phone_call           (telpon Oma, dapat petunjuk)
  //   4) collect 7 items
  //   5) lukas_cooking_timeskip   (memasak)
  //   6) oma_quest1_return        (kuis pengulangan)
  // Materi: in / auf / unter
  // ════════════════════════════════════════════════════════════════

  // ── 1. MONOLOG di Schlafzimmer (otomatis saat game start) ──
  //    Lukas baru bangun → merasa lapar → ingin bikin sarapan → telpon Oma
  //    Natural German, A2 level, mempersiapkan player ke quest pertama
  lukas_bedroom_monologue: {
    id:      'lukas_bedroom_monologue',
    start:   'b1',
    questId: 'quest_1',
    nodes: {
      b1: {
        id:      'b1',
        speaker: 'lukas',
        text:    '<i>*gähnt*</i> Mmh... was für ein schöner Morgen! Ich habe gut <vocab title="tidur">geschlafen</vocab>.',
        next:    'b2',
      },
      b2: {
        id:      'b2',
        speaker: 'lukas',
        text:    'Aber mein <vocab title="perut">Bauch</vocab> <vocab title="berbunyi keroncongan">knurrt</vocab> schon. Ich habe <vocab title="lapar">Hunger</vocab>!',
        next:    'b3',
      },
      b3: {
        id:      'b3',
        speaker: 'lukas',
        text:    'Ich möchte <vocab title="sarapan">Frühstück</vocab> machen. Aber wo ist die <vocab title="wajan">Pfanne</vocab>? Wo sind die <vocab title="telur">Eier</vocab>?',
        next:    'b4',
      },
      b4: {
        id:      'b4',
        speaker: 'lukas',
        text:    'Oma ist nicht zu Hause... Ich <vocab title="menelepon">rufe</vocab> sie an! Das <vocab title="telepon">Telefon</vocab> ist im <vocab title="lorong">Flur</vocab>.',
        onEnter: [
          { type: 'progress_quest', step: 'step1_wake_up' },
          { type: 'show_quest',     questId: 'quest_1' },
        ],
        end: true,
      },
    },
  },

  // ── 2. MONOLOG saat tiba di Küche ──
  lukas_kitchen_monologue: {
    id:      'lukas_kitchen_monologue',
    start:   'k1',
    questId: 'quest_1',
    nodes: {
      k1: {
        id:      'k1',
        speaker: 'lukas',
        text:    'Endlich in der Küche! Was brauche ich zum Kochen?',
        next:    'k2',
      },
      k2: {
        id:      'k2',
        speaker: 'lukas',
        text:    'Eine <vocab title="wajan">Pfanne</vocab>, einen <vocab title="spatula">Pfannenwender</vocab>, eine <vocab title="garpu">Gabel</vocab> und ein <vocab title="pisau">Messer</vocab>...',
        next:    'k3',
      },
      k3: {
        id:      'k3',
        speaker: 'lukas',
        text:    '...auch einen <vocab title="piring">Teller</vocab>, <vocab title="telur">Eier</vocab> und eine <vocab title="sosis">Wurst</vocab>.',
        next:    'k4',
      },
      k4: {
        id:      'k4',
        speaker: 'lukas',
        text:    'Aber wo sind alle Sachen?! Ich weiß es nicht...',
        next:    'k5',
      },
      k5: {
        id:      'k5',
        speaker: 'lukas',
        text:    'Ich rufe Oma an! Sie ist heute nicht zu Hause, aber sie wird mir helfen. 📞',
        onEnter: [
          { type: 'progress_quest', step: 'step2_reach_kitchen' },
        ],
        end: true,
      },
    },
  },

  // ── 3. TELPON OMA (auto-trigger setelah kitchen monologue) ──
  oma_phone_call: {
    id:      'oma_phone_call',
    start:   'p1',
    questId: 'quest_1',
    nodes: {
      p1: {
        id:      'p1',
        speaker: 'oma_helga',
        text:    '📞 <i>*klingelt*</i> Hallo Lukas, mein Schatz! Was gibt\'s?',
        next:    'p2',
      },
      p2: {
        id:      'p2',
        speaker: 'lukas',
        text:    'Oma, ich möchte kochen, aber ich finde nichts in der Küche!',
        next:    'p3',
      },
      p3: {
        id:      'p3',
        speaker: 'oma_helga',
        text:    'Kein Problem! Hör gut zu: Die <vocab title="wajan">Pfanne</vocab> ist <vocab title="di dalam">IN</vocab> dem <vocab title="kabinet">Schrank</vocab>.',
        next:    'p4',
      },
      p4: {
        id:      'p4',
        speaker: 'oma_helga',
        text:    'Der <vocab title="spatula">Pfannenwender</vocab>, die <vocab title="garpu">Gabel</vocab> und das <vocab title="pisau">Messer</vocab> sind <vocab title="di dalam">IN</vocab> der <vocab title="laci">Schublade</vocab>.',
        next:    'p5',
      },
      p5: {
        id:      'p5',
        speaker: 'oma_helga',
        text:    'Der <vocab title="piring">Teller</vocab> liegt <vocab title="di atas">AUF</vocab> dem <vocab title="meja dapur">Küchentisch</vocab>.',
        next:    'p6',
      },
      p6: {
        id:      'p6',
        speaker: 'oma_helga',
        text:    'Die <vocab title="telur">Eier</vocab> findest du <vocab title="di bawah">UNTER</vocab> dem kleinen Tisch.',
        next:    'p7',
      },
      p7: {
        id:      'p7',
        speaker: 'oma_helga',
        text:    'Und die <vocab title="sosis">Wurst</vocab> ist <vocab title="di dalam">IN</vocab> dem <vocab title="kulkas">Kühlschrank</vocab>. Viel Spaß, mein Schatz!',
        next:    'p8',
      },
      p8: {
        id:      'p8',
        speaker: 'lukas',
        text:    'Danke, Oma! Ich finde alles! 💪',
        onEnter: [
          { type: 'progress_quest', step: 'step3_phone_call' },
          { type: 'add_journal',    entry: 'frühstück_notiz' },
        ],
        end: true,
      },
    },
  },

  // ── 5. TIME SKIP COOKING (auto-trigger setelah 7 item terkumpul) ──
  lukas_cooking_timeskip: {
    id:    'lukas_cooking_timeskip',
    start: 'c1',
    nodes: {
      c1: {
        id:      'c1',
        speaker: 'lukas',
        text:    'Perfekt! Ich habe alles gefunden! Jetzt kann ich kochen! 🍳',
        next:    'c2',
      },
      c2: {
        id:      'c2',
        speaker: 'lukas',
        text:    '<i>*Lukas kocht die Wurst und macht Spiegeleier...*</i> 🔥',
        next:    'c3',
      },
      c3: {
        id:      'c3',
        speaker: 'lukas',
        text:    '<i>*Zwanzig Minuten später...*</i> ⏰',
        next:    'c4',
      },
      c4: {
        id:      'c4',
        speaker: 'lukas',
        text:    'Lecker! Das war ein <vocab title="sarapan yang enak">leckeres Frühstück</vocab>! Mmmmh~ 😋',
        onEnter: [
          { type: 'progress_quest', step: 'step5_cook' },
          { type: 'complete_quest', questId: 'quest_1' },
          { type: 'add_score',      delta: 500, label: 'Quest 1 abgeschlossen!' },
        ],
        end: true,
      },
    },
  },

  // ── 6. KUIS PENGULANGAN (saat ketemu Oma lagi) ──
  oma_quest1_return: {
    id:    'oma_quest1_return',
    start: 'r1_1',
    nodes: {
      r1_1: {
        id:      'r1_1',
        speaker: 'oma_helga',
        text:    'Lukas! Hast du gut gegessen, mein Schatz?',
        next:    'r1_2',
      },
      r1_2: {
        id:      'r1_2',
        speaker: 'lukas',
        text:    'Ja, Oma! Es war lecker. Danke für die Hilfe!',
        next:    'r1_quiz',
      },
      r1_quiz: {
        id:      'r1_quiz',
        speaker: 'oma_helga',
        text:    'Eine Frage: Wo war die <vocab title="wajan">Pfanne</vocab>?',
        choices: [
          { text: 'Unter dem Tisch',           correct: false, score: -10, next: 'r1_wrong' },
          { text: 'In dem Schrank',            correct: true,  score: 100, next: 'r1_quiz2' },
          { text: 'Auf dem Kühlschrank',       correct: false, score: -10, next: 'r1_wrong' },
        ],
      },
      r1_quiz2: {
        id:      'r1_quiz2',
        speaker: 'oma_helga',
        text:    'Richtig! Noch eine: Wo waren die <vocab title="telur">Eier</vocab>?',
        choices: [
          { text: 'Auf dem Küchentisch',       correct: false, score: -10, next: 'r1_wrong' },
          { text: 'In der Schublade',          correct: false, score: -10, next: 'r1_wrong' },
          { text: 'Unter dem kleinen Tisch',   correct: true,  score: 100, next: 'r1_quiz3' },
        ],
      },
      r1_quiz3: {
        id:      'r1_quiz3',
        speaker: 'oma_helga',
        text:    'Sehr gut! Letzte Frage: Wo war die <vocab title="sosis">Wurst</vocab>?',
        choices: [
          { text: 'In dem Kühlschrank',        correct: true,  score: 100, next: 'r1_correct' },
          { text: 'Auf dem Herd',              correct: false, score: -10, next: 'r1_wrong' },
          { text: 'Unter dem Tisch',           correct: false, score: -10, next: 'r1_wrong' },
        ],
      },
      r1_correct: {
        id:      'r1_correct',
        speaker: 'oma_helga',
        text:    '<vocab title="bagus sekali">Ausgezeichnet</vocab>, Lukas! Du hast alles gelernt: <b>IN, AUF, UNTER</b>!',
        onEnter: [
          { type: 'complete_quest', questId: 'quest_1' },
          { type: 'add_score',      delta: 200, label: 'Stage 1 Quest 1 abgeschlossen' },
        ],
        next: 'r1_done',
      },
      r1_wrong: {
        id:      'r1_wrong',
        speaker: 'oma_helga',
        text:    'Hmm, denk nochmal! Die Pfanne war IM Schrank, die Eier UNTER dem kleinen Tisch, die Wurst IM Kühlschrank.',
        next:    'r1_quiz',
      },
      r1_done: {
        id:      'r1_done',
        speaker: 'oma_helga',
        text:    'Gut gemacht, mein Schatz! 💕',
        end:     true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 1, QUEST 2 — "Tantes Anruf — Sachen suchen!"
  // FLOW:
  //   1) tante_quest2_intro — Tante telpon, minta 3 benda TANPA petunjuk lokasi
  //   2) [proximity collect 3 items: socken/papier/spielzeug]
  //   3) tante_quest2_quiz — kuis pilihan ganda WHERE found each item
  // Materi: Memory + Lokale Präpositionen (auf/unter/in)
  // ════════════════════════════════════════════════════════════════

  tante_quest2_intro: {
    id:      'tante_quest2_intro',
    start:   't2_1',
    questId: 'quest_2',
    nodes: {
      t2_1: {
        id:      't2_1',
        speaker: 'tante_maria',
        text:    '📞 <i>*klingelt*</i> Hallo Lukas! Hier ist <vocab title="Tante">Tante</vocab> Maria!',
        next:    't2_2',
      },
      t2_2: {
        id:      't2_2',
        speaker: 'tante_maria',
        text:    'Kannst du mir bitte 3 Sachen suchen? Ich brauche sie heute.',
        next:    't2_3',
      },
      t2_3: {
        id:      't2_3',
        speaker: 'tante_maria',
        text:    'Such bitte: die <vocab title="kaos kaki">Socken</vocab>, das <vocab title="kertas">Papier</vocab>, und das <vocab title="mainan">Spielzeug</vocab> von Lina.',
        next:    't2_4',
      },
      t2_4: {
        id:      't2_4',
        speaker: 'lukas',
        text:    'Aber Tante... <vocab title="dimana">wo</vocab> sind sie denn?',
        next:    't2_5',
      },
      t2_5: {
        id:      't2_5',
        speaker: 'tante_maria',
        text:    'Hmm, das weiß ich nicht genau! Such selbst im Haus.',
        next:    't2_6',
      },
      t2_6: {
        id:      't2_6',
        speaker: 'tante_maria',
        text:    'Und wenn du sie hast: <vocab title="kirim pesan">schreib mir eine Nachricht</vocab> — sag mir, WO du sie gefunden hast. Viel Erfolg! 💪',
        onEnter: [
          // Setelah dialog Tante selesai → step3 (collect items) mulai
          { type: 'progress_quest', step: 'step2_phone_call2' },
          { type: 'show_quest',     questId: 'quest_2' },
        ],
        end: true,
      },
    },
  },

  // ── Kuis pilihan ganda setelah 3 item terkumpul ──
  // Setiap pertanyaan: 1 jawaban benar + 2 salah. Wrong → retry.
  tante_quest2_quiz: {
    id:      'tante_quest2_quiz',
    start:   'q2_socken',
    questId: 'quest_2',
    nodes: {
      // ── SOCKEN ──
      q2_socken: {
        id:      'q2_socken',
        speaker: 'tante_maria',
        text:    '📱 Schön! Schreib mir: Wo waren die <vocab title="kaos kaki">Socken</vocab>?',
        choices: [
          { text: 'Auf dem Bett',         correct: true,  score: 100, next: 'q2_correct_socken' },
          { text: 'In der Schublade',     correct: false, score: -10, next: 'q2_wrong_socken' },
          { text: 'Unter dem Bett',       correct: false, score: -10, next: 'q2_wrong_socken' },
        ],
      },
      q2_correct_socken: {
        id:      'q2_correct_socken',
        speaker: 'tante_maria',
        text:    'Genau, auf dem Bett! 👍',
        next:    'q2_papier',
      },
      q2_wrong_socken: {
        id:      'q2_wrong_socken',
        speaker: 'tante_maria',
        text:    'Hmm, denk nochmal nach! Wo lagen die Socken wirklich?',
        next:    'q2_socken',
      },

      // ── PAPIER ──
      q2_papier: {
        id:      'q2_papier',
        speaker: 'tante_maria',
        text:    'Und das <vocab title="kertas">Papier</vocab>?',
        choices: [
          { text: 'Auf dem Tisch',        correct: true,  score: 100, next: 'q2_correct_papier' },
          { text: 'Unter dem Sofa',       correct: false, score: -10, next: 'q2_wrong_papier' },
          { text: 'In der Schublade',     correct: false, score: -10, next: 'q2_wrong_papier' },
        ],
      },
      q2_correct_papier: {
        id:      'q2_correct_papier',
        speaker: 'tante_maria',
        text:    'Super, auf dem Tisch! Du erinnerst dich gut. 👍',
        next:    'q2_spielzeug',
      },
      q2_wrong_papier: {
        id:      'q2_wrong_papier',
        speaker: 'tante_maria',
        text:    'Nein, falsch! Versuch nochmal — wo war das Papier?',
        next:    'q2_papier',
      },

      // ── SPIELZEUG ──
      q2_spielzeug: {
        id:      'q2_spielzeug',
        speaker: 'tante_maria',
        text:    'Und das <vocab title="mainan">Spielzeug</vocab> von Lina?',
        choices: [
          { text: 'Unter dem Küchentisch', correct: true,  score: 100, next: 'q2_final' },
          { text: 'Auf dem Sofa',          correct: false, score: -10, next: 'q2_wrong_spielzeug' },
          { text: 'In dem Schrank',        correct: false, score: -10, next: 'q2_wrong_spielzeug' },
        ],
      },
      q2_wrong_spielzeug: {
        id:      'q2_wrong_spielzeug',
        speaker: 'tante_maria',
        text:    'Hmm, das ist falsch! Wo hast du das Spielzeug gefunden?',
        next:    'q2_spielzeug',
      },

      // ── FINAL ──
      q2_final: {
        id:      'q2_final',
        speaker: 'tante_maria',
        text:    '<vocab title="luar biasa">Wunderbar</vocab>, Lukas! Du hast alle 3 Sachen gefunden! Ich hole sie später ab. <vocab title="terima kasih">Danke</vocab>! 💕',
        onEnter: [
          { type: 'progress_quest', step: 'step4_send_message' },
          { type: 'complete_quest', questId: 'quest_2' },
          { type: 'add_score',      delta: 500, label: 'Quest 2 abgeschlossen!' },
        ],
        end: true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2, QUEST 3 — "Leni abholen!" (Selektives Verstehen 1)
  // Materi: arah jalan — geradeaus, links, rechts, an der Ampel
  // ════════════════════════════════════════════════════════════════

  // ── Leni's dialog di sekolah (Q3 step4_meet_leni) ──
  leni_quest3_greeting: {
    id:      'leni_quest3_greeting',
    start:   'lg1',
    questId: 'quest_3',
    nodes: {
      lg1: {
        id:      'lg1',
        speaker: 'leni',
        text:    'Lukas! Du bist gekommen! Endlich! Ich habe schon ewig gewartet!',
        next:    'lg2',
      },
      lg2: {
        id:      'lg2',
        speaker: 'leni',
        text:    'Komm, lass uns nach Hause gehen. Mama hat gesagt, du holst mich ab.',
        next:    'lg3',
      },
      lg3: {
        id:      'lg3',
        speaker: 'lukas',
        text:    'Klar Leni! Folge mir, ich kenne den Weg zurück zu Omas Haus.',
        onEnter: [
          { type: 'progress_quest', step: 'step4_meet_leni' },
          { type: 'add_score',      delta: 100, label: 'Leni getroffen!' },
        ],
        end: true,
      },
    },
  },

  tante_quest3_intro: {
    id:      'tante_quest3_intro',
    start:   't3_1',
    questId: 'quest_3',
    nodes: {
      t3_1: {
        id:      't3_1',
        speaker: 'tante_maria',
        text:    'Lukas, kannst du bitte Leni von der <vocab title="Sekolah">Schule</vocab> <vocab title="menjemput">abholen</vocab>? Sie wartet schon!',
        next:    't3_2',
      },
      t3_2: {
        id:      't3_2',
        speaker: 'tante_maria',
        text:    'Hör gut zu: Geh <vocab title="lurus">geradeaus</vocab> diese Straße entlang. <vocab title="Di lampu merah">An der Ampel</vocab> biegst du <vocab title="kiri">links</vocab> ab.',
        next:    't3_3',
      },
      t3_3: {
        id:      't3_3',
        speaker: 'tante_maria',
        text:    'Dann gehst du noch zwei Straßen weiter. Die Grundschule ist das große rote <vocab title="Gedung">Gebäude</vocab> auf der <vocab title="kanan">rechten</vocab> Seite, neben dem <vocab title="Taman">Park</vocab>.',
        next:    't3_quiz',
      },
      t3_quiz: {
        id:      't3_quiz',
        speaker: 'lukas',
        text:    'Okay, ich habe es! An der Ampel soll ich...',
        choices: [
          { text: 'Rechts abbiegen',           correct: false, score: -10, next: 't3_wrong' },
          { text: 'Links abbiegen',            correct: true,  score: 100, next: 't3_correct' },
          { text: 'Geradeaus weitergehen',      correct: false, score: -10, next: 't3_wrong' },
        ],
      },
      t3_correct: {
        id:      't3_correct',
        speaker: 'tante_maria',
        text:    'Genau! <vocab title="Kiri">Links</vocab> abbiegen! Du hast selektiv gut verstanden.',
        onEnter: [
          { type: 'progress_quest', step: 'step2_get_directions3' },
          { type: 'add_journal',    entry: 'leni_abholen_notiz' },
          { type: 'show_quest',     questId: 'quest_3' },
        ],
        next: 't3_done',
      },
      t3_wrong: {
        id:      't3_wrong',
        speaker: 'tante_maria',
        text:    'Nein! Hör nochmal: An der Ampel LINKS abbiegen! Verstanden?',
        next:    't3_quiz',
      },
      t3_done: {
        id:      't3_done',
        speaker: 'tante_maria',
        text:    'Beeil dich! Leni wartet schon seit einer Stunde.',
        end:     true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2, QUEST 4 — "Einkaufen für Oma!" (Selektives Verstehen 2)
  // Materi: arah ke Supermarkt (entlang, rechts, gegenüber)
  // ════════════════════════════════════════════════════════════════

  oma_quest4_intro: {
    id:      'oma_quest4_intro',
    start:   'q4_1',
    questId: 'quest_4',
    nodes: {
      q4_1: {
        id:      'q4_1',
        speaker: 'oma_helga',
        text:    'Lukas, für das <vocab title="Makan malam">Abendessen</vocab> brauche ich: <vocab title="Daging">Fleisch</vocab>, <vocab title="Sayuran">Gemüse</vocab> und <vocab title="Roti">Brot</vocab>.',
        next:    'q4_2',
      },
      q4_2: {
        id:      'q4_2',
        speaker: 'oma_helga',
        text:    'Kannst du das bitte im <vocab title="Supermarket">Supermarkt</vocab> kaufen? Ich —',
        next:    'q4_3',
      },
      q4_3: {
        id:      'q4_3',
        speaker: 'lukas',
        text:    'Klar, Oma! Ich gehe sofort! ... Warte, wo ist eigentlich der Supermarkt? Ich muss jemanden fragen!',
        onEnter: [
          { type: 'progress_quest', step: 'step1_talk_oma' },
          { type: 'add_journal',    entry: 'einkaufen_notiz' },
          { type: 'show_quest',     questId: 'quest_4' },
        ],
        end: true,
      },
    },
  },

  // Dialog passant_1 saat Lukas tanya arah Supermarkt (quest_4, step2)
  passant1_directions: {
    id:    'passant1_directions',
    start: 'p1_1',
    nodes: {
      p1_1: {
        id:      'p1_1',
        speaker: 'passant_1',
        text:    'Guten Tag! Kann ich Ihnen helfen?',
        next:    'p1_2',
      },
      p1_2: {
        id:      'p1_2',
        speaker: 'lukas',
        text:    'Ja! Entschuldigung, wissen Sie, wo der Supermarkt ist?',
        next:    'p1_3',
      },
      p1_3: {
        id:      'p1_3',
        speaker: 'passant_1',
        text:    'Natürlich! Gehen Sie diese Straße <vocab title="sepanjang">entlang</vocab>, dann biegen Sie <vocab title="kanan">rechts</vocab> an der <vocab title="Gereja">Kirche</vocab> ab.',
        next:    'p1_4',
      },
      p1_4: {
        id:      'p1_4',
        speaker: 'passant_1',
        text:    'Der Supermarkt ist das große Gebäude <vocab title="di seberang">gegenüber</vocab> dem <vocab title="Gedung parkir">Parkhaus</vocab>. Sie können es nicht verfehlen!',
        next:    'p1_quiz',
      },
      p1_quiz: {
        id:      'p1_quiz',
        speaker: 'lukas',
        text:    'Ich habe es! Der Supermarkt liegt gegenüber von...',
        choices: [
          { text: 'Der Kirche',                correct: false, score: -10, next: 'p1_wrong' },
          { text: 'Dem Parkhaus',              correct: true,  score: 100, next: 'p1_correct' },
          { text: 'Der Schule',                correct: false, score: -10, next: 'p1_wrong' },
        ],
      },
      p1_correct: {
        id:      'p1_correct',
        speaker: 'passant_1',
        text:    '<vocab title="Benar">Richtig</vocab>! Gegenüber dem Parkhaus. Guten Einkauf!',
        onEnter: [
          { type: 'progress_quest', step: 'step2_ask_passant' },
        ],
        end: true,
      },
      p1_wrong: {
        id:      'p1_wrong',
        speaker: 'passant_1',
        text:    'Nein, nein! Gegenüber dem PARKHAUS! Nicht der Kirche.',
        next:    'p1_quiz',
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2, QUEST 5 — "Eis kaufen!" (Selektives Verstehen 3)
  // Materi: antara, neben, zwischen (posisi Eisstand)
  // ════════════════════════════════════════════════════════════════

  passant2_quest5_intro: {
    id:      'passant2_quest5_intro',
    start:   'p2_1',
    questId: 'quest_5',
    nodes: {
      p2_1: {
        id:      'p2_1',
        speaker: 'lukas',
        text:    'Entschuldigung! Gibt es hier in der Nähe einen <vocab title="Toko es krim">Eisstand</vocab>?',
        next:    'p2_2',
      },
      p2_2: {
        id:      'p2_2',
        speaker: 'passant_2',
        text:    'Einen Eisstand? Ja! Gehen Sie <vocab title="lurus">geradeaus</vocab>, dann <vocab title="kiri">links</vocab>.',
        next:    'p2_3',
      },
      p2_3: {
        id:      'p2_3',
        speaker: 'passant_2',
        text:    'Der Eisstand ist <vocab title="di antara">zwischen</vocab> dem <vocab title="Toko bunga">Blumenladen</vocab> und dem <vocab title="Kafe">Café</vocab>, <vocab title="di sebelah">neben</vocab> der <vocab title="Toko roti">Bäckerei</vocab>.',
        next:    'p2_quiz',
      },
      p2_quiz: {
        id:      'p2_quiz',
        speaker: 'lukas',
        text:    'Der Eisstand liegt zwischen...',
        choices: [
          { text: 'Der Bäckerei und der Kirche',           correct: false, score: -10, next: 'p2_wrong' },
          { text: 'Dem Blumenladen und dem Café',          correct: true,  score: 100, next: 'p2_correct' },
          { text: 'Dem Park und der Schule',               correct: false, score: -10, next: 'p2_wrong' },
        ],
      },
      p2_correct: {
        id:      'p2_correct',
        speaker: 'passant_2',
        text:    'Genau! Zwischen dem Blumenladen und dem Café. Guten Appetit!',
        onEnter: [
          { type: 'progress_quest', step: 'step1_ask_eisstand' },
          { type: 'show_quest',     questId: 'quest_5' },
        ],
        end: true,
      },
      p2_wrong: {
        id:      'p2_wrong',
        speaker: 'passant_2',
        text:    'Nein! ZWISCHEN dem Blumenladen und dem Café! Nicht woanders.',
        next:    'p2_quiz',
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2, QUEST 6 — "Wo bin ich?" (Allgemeines Verstehen 1)
  // Materi: arah umum — überqueren, zurück, die Brücke
  // ════════════════════════════════════════════════════════════════

  passant3_quest6_intro: {
    id:      'passant3_quest6_intro',
    start:   'p3_1',
    questId: 'quest_6',
    nodes: {
      p3_1: {
        id:      'p3_1',
        speaker: 'lukas',
        text:    'Entschuldigung! Ich habe mich <vocab title="Tersesat">verlaufen</vocab>. Wissen Sie, wo die alte Brücke ist?',
        next:    'p3_2',
      },
      p3_2: {
        id:      'p3_2',
        speaker: 'passant_3',
        text:    'Die alte Brücke? Kein Problem! Gehen Sie <vocab title="kembali">zurück</vocab> zur <vocab title="Jalan utama">Hauptstraße</vocab>, dann links bis zur <vocab title="Jembatan">Brücke</vocab>.',
        next:    'p3_3',
      },
      p3_3: {
        id:      'p3_3',
        speaker: 'passant_3',
        text:    '<vocab title="Menyeberangi">Überqueren</vocab> Sie die Brücke. Dann nehmen Sie die dritte Straße <vocab title="kanan">rechts</vocab>. Das Haus ist das einzige mit dem <vocab title="Pintu gerbang merah">roten Tor</vocab>.',
        next:    'p3_quiz',
      },
      p3_quiz: {
        id:      'p3_quiz',
        speaker: 'lukas',
        text:    'Verstanden! Um nach Hause zu kommen, muss ich... überqueren?',
        choices: [
          { text: 'Den Park überqueren',              correct: false, score: -10, next: 'p3_wrong' },
          { text: 'Die Brücke überqueren',            correct: true,  score: 100, next: 'p3_correct' },
          { text: 'Die Hauptstraße überqueren',       correct: false, score: -10, next: 'p3_wrong' },
        ],
      },
      p3_correct: {
        id:      'p3_correct',
        speaker: 'passant_3',
        text:    'Richtig! Die <vocab title="Jembatan">Brücke</vocab> überqueren. Du hast den allgemeinen Sinn gut verstanden!',
        onEnter: [
          { type: 'progress_quest', step: 'step1_ask_way_home' },
          { type: 'add_journal',    entry: 'verloren_notiz' },
          { type: 'show_quest',     questId: 'quest_6' },
        ],
        next: 'p3_done',
      },
      p3_wrong: {
        id:      'p3_wrong',
        speaker: 'passant_3',
        text:    'Nein! Die BRÜCKE überqueren! Hör nochmal zu...',
        next:    'p3_quiz',
      },
      p3_done: {
        id:      'p3_done',
        speaker: 'passant_3',
        text:    'Viel Glück! Guten <vocab title="Perjalanan pulang">Heimweg</vocab>!',
        end:     true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2, QUEST 7 — "Ins Kino!" (Allgemeines Verstehen 2)
  // Materi: arah darurat — Allee, Hauptstraße, rechts abbiegen
  // ════════════════════════════════════════════════════════════════

  passant4_quest7_intro: {
    id:      'passant4_quest7_intro',
    start:   'p4_1',
    questId: 'quest_7',
    nodes: {
      p4_1: {
        id:      'p4_1',
        speaker: 'lukas',
        text:    'Entschuldigung! Ich bin verloren! Ich muss <vocab title="Segera">schnell</vocab> ins <vocab title="Bioskop">Kino</vocab>! Der Film fängt bald an!',
        next:    'p4_2',
      },
      p4_2: {
        id:      'p4_2',
        speaker: 'passant_4',
        text:    'Oh! Das Kino ist nicht weit. Hören Sie gut zu: Gehen Sie diese <vocab title="Jalan pohon">Allee</vocab> <vocab title="lurus">geradeaus</vocab> entlang bis zum Ende.',
        next:    'p4_3',
      },
      p4_3: {
        id:      'p4_3',
        speaker: 'passant_4',
        text:    'Dann biegen Sie <vocab title="kanan">rechts</vocab> auf die <vocab title="Jalan utama">Hauptstraße</vocab> ab. Das Kino ist das große Gebäude mit den <vocab title="lampu berwarna-warni">bunten Lichtern</vocab> auf der linken Seite.',
        next:    'p4_quiz',
      },
      p4_quiz: {
        id:      'p4_quiz',
        speaker: 'lukas',
        text:    'Okay! Nach der Allee biege ich...',
        choices: [
          { text: 'Links ab',                          correct: false, score: -10, next: 'p4_wrong' },
          { text: 'Geradeaus weiter',                  correct: false, score: -10, next: 'p4_wrong' },
          { text: 'Rechts ab',                         correct: true,  score: 100, next: 'p4_correct' },
        ],
      },
      p4_correct: {
        id:      'p4_correct',
        speaker: 'passant_4',
        text:    'Richtig! RECHTS! <vocab title="Cepat-cepat">Beeil dich</vocab> — der Film fängt gleich an!',
        onEnter: [
          { type: 'progress_quest', step: 'step2_ask_kino' },
          { type: 'add_journal',    entry: 'kino_notiz' },
          { type: 'show_quest',     questId: 'quest_7' },
        ],
        next: 'p4_done',
      },
      p4_wrong: {
        id:      'p4_wrong',
        speaker: 'passant_4',
        text:    'Nein! RECHTS abbiegen! Schnell, du hast keine Zeit!',
        next:    'p4_quiz',
      },
      p4_done: {
        id:      'p4_done',
        speaker: 'passant_4',
        text:    'Los! Du schaffst das! Viel Spaß im <vocab title="Bioskop">Kino</vocab>!',
        end:     true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // QUEST 8-10 — Dialog Penutup
  // ════════════════════════════════════════════════════════════════

  opa_quest8_intro: {
    id: 'opa_quest8_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'opa_klaus',
            text: 'Heute Abend essen wir alle zusammen im <vocab title="Restoran">Restaurant</vocab> Deichstraße. Komm mit!',
            end: true },
    },
  },

  felix_quest9_intro: {
    id: 'felix_quest9_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'felix',
            text: 'Komm schnell an die <vocab title="Sungai Elbe">Elbe</vocab> — der <vocab title="Matahari terbenam">Sonnenuntergang</vocab> ist heute genial!',
            end: true },
    },
  },

  oma_quest10_intro: {
    id: 'oma_quest10_intro', start: 'n1',
    nodes: {
      n1: { id: 'n1', speaker: 'oma_helga',
            text: 'Heute Abend ist dein letzter. Lass uns alle zusammen <vocab title="Merayakan">feiern</vocab>. Die ganze Familie ist hier!',
            end: true },
    },
  },
};


// ═══════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES — teks di Reisetagebuch
// ═══════════════════════════════════════════════════════════════════

export const JOURNAL_ENTRIES = {

  // ── STAGE 1 ───────────────────────────────────────────────────
  frühstück_notiz: {
    title:    'Omas Hinweise für die Küche',
    subtitle: 'Geschrieben von Oma Helga (via SMS)',
    body: `
Mein Schatz Lukas,

Ich bin kurz im Garten. Hier sind die Hinweise für die Küche:

• Die <b>Pfanne</b> liegt <span class="prep-highlight">AUF</span> dem Herd
• Die <b>Wurst</b> ist <span class="prep-highlight">IM</span> Kühlschrank
• Die <b>Eier</b> findest du <span class="prep-highlight">IN</span> der Schublade
• Der <b>Teller</b> ist <span class="prep-highlight">AUF</span> dem Regal
• Das <b>Besteck</b> liegt <span class="prep-highlight">UNTER</span> dem Kochbuch

Viel Spaß beim Kochen! 🍳
Deine Oma Helga
    `.trim(),
  },

  wohnzimmer_notiz: {
    title:    'Das Wohnzimmer',
    subtitle: 'Lukas\' Notizen',
    body: `
Tante Maria hat angerufen. Das Spielzeug von Leni ist irgendwo im Wohnzimmer:

• <span class="prep-highlight">AUF</span> dem Sofa?
• <span class="prep-highlight">UNTER</span> dem Tisch?
• <span class="prep-highlight">NEBEN</span> dem Regal?

Wichtige Wörter:
• das Wohnzimmer = ruang tamu
• das Sofa = sofa
• der Tisch = meja
• das Spielzeug = mainan
    `.trim(),
  },

  // ── STAGE 2 ───────────────────────────────────────────────────
  leni_abholen_notiz: {
    title:    'Wegbeschreibung zur Schule',
    subtitle: 'Tante Marias Anweisungen',
    body: `
So komme ich zur Schule:

1. Diese Straße <span class="prep-highlight">GERADEAUS</span> entlang gehen
2. <span class="prep-highlight">AN DER AMPEL</span> links abbiegen
3. Noch zwei Straßen weiter
4. Die Grundschule ist auf der <span class="prep-highlight">RECHTEN</span> Seite

🏫 Das große ROTE Gebäude — neben dem Park!

Nützliche Wörter:
• geradeaus = lurus
• links abbiegen = belok kiri
• rechts abbiegen = belok kanan
• an der Ecke = di tikungan
    `.trim(),
  },

  einkaufen_notiz: {
    title:    'Omas Einkaufsliste',
    subtitle: 'Für das Abendessen',
    body: `
Was Oma braucht:
• Fleisch (daging)
• Gemüse (sayuran)
• Brot (roti)

Wo ist der Supermarkt?
→ Diese Straße <span class="prep-highlight">ENTLANG</span> gehen
→ Dann <span class="prep-highlight">RECHTS</span> an der Kirche
→ <span class="prep-highlight">GEGENÜBER</span> dem Parkhaus

Tipp: Frag einen Passanten wenn du nicht weißt wo!
    `.trim(),
  },

  verloren_notiz: {
    title:    'Ich habe mich verlaufen!',
    subtitle: 'Lukas\' Notizen',
    body: `
Ich bin verloren... aber ein netter Passant hat mir geholfen:

Um nach Hause zu kommen:
1. Zurück zur <span class="prep-highlight">HAUPTSTRASSE</span>
2. Links bis zur <span class="prep-highlight">BRÜCKE</span>
3. Die Brücke <span class="prep-highlight">ÜBERQUEREN</span>
4. Die dritte Straße <span class="prep-highlight">RECHTS</span>
5. Das Haus mit dem ROTEN TOR

Wichtige Ausdrücke:
• Entschuldigung, wissen Sie... = Permisi, apakah Anda tahu...
• in der Nähe von = di dekat
• sich verirren = tersesat
    `.trim(),
  },

  kino_notiz: {
    title:    'Zum Kino!',
    subtitle: 'Schnell — der Film fängt an!',
    body: `
Ich war im Stadtpark verloren, aber jetzt weiß ich wo das Kino ist:

1. Diese <span class="prep-highlight">ALLEE</span> geradeaus entlang
2. <span class="prep-highlight">RECHTS</span> auf die Hauptstraße
3. Das Kino = großes Gebäude mit <span class="prep-highlight">BUNTEN LICHTERN</span> (links)

Nützliche Wörter:
• das Kino = bioskop
• sich beeilen = terburu-buru / bergegas
• die Allee = jalan beravenue
• die Hauptstraße = jalan utama
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
  oma_helga:    'oma_quest1_intro',
  opa_klaus:    'opa_klaus_greeting',
  onkel_andre:  'onkel_andre_greeting',
  tante_maria:  'tante_maria_greeting',
  nachbar_hans: 'hans_hint_quest1',
  // Stage 2 NPCs
  leni:         'leni_quest3_greeting',
  passant_1:    'passant1_directions',
  passant_2:    'passant2_quest5_intro',
  passant_3:    'passant3_quest6_intro',
  passant_4:    'passant4_quest7_intro',
};
