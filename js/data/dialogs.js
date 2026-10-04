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
        text:    'Lukas, mein Schatz! Schön, dass du da bist.',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'oma_helga',
        text:    'Wenn du nicht weißt, was du tun sollst: Schau in dein <vocab title="Buku harian perjalanan">Reisetagebuch</vocab> (Taste TAB).',
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
        text:    'Hallo Lukas! Schade, dass du morgen schon nach Indonesien <vocab title="terbang">fliegst</vocab>.',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'onkel_andre',
        text:    'Leni redet nur noch von dir. Du musst bald wiederkommen!',
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
        text:    'Lukas! Danke noch einmal für Omas <vocab title="Kue apel">Apfelkuchen</vocab> — er war köstlich!',
        next:    'g2',
      },
      g2: {
        id:      'g2',
        speaker: 'tante_maria',
        text:    'Grüß deine <vocab title="Ibu">Mutter</vocab> in Indonesien von mir, ja?',
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
        text:    'Geh über die alte Brücke in die Stadt und dann geradeaus bis zur Ampel. Dort biegst du rechts ab — der EDEKA ist das Gebäude mit dem großen Parkplatz auf der rechten Seite.',
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
        text:    'Und die <vocab title="sosis">Wurst</vocab> ist <vocab title="di atas">AUF</vocab> dem <vocab title="meja saji">Serviertisch</vocab>. Viel Spaß, mein Schatz!',
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
          { text: 'Auf dem Serviertisch',       correct: true,  score: 100, next: 'r1_correct' },
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
        text:    'Hmm, denk nochmal! Die Pfanne war IM Schrank, die Eier UNTER dem kleinen Tisch, die Wurst AUF dem Serviertisch.',
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
        text:    'Ich bin noch im <vocab title="Kantor">Büro</vocab>. Kannst du mir bitte drei Sachen suchen? Ich brauche sie heute Abend.',
        next:    't2_3',
      },
      t2_3: {
        id:      't2_3',
        speaker: 'tante_maria',
        text:    'Such bitte: die <vocab title="kaos kaki">Socken</vocab>, das <vocab title="kertas">Papier</vocab>, und das <vocab title="mainan">Spielzeug</vocab> von Leni.',
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
        text:    'Mama hat gesagt, du bringst mich zu Oma. Komm, lass uns gehen!',
        next:    'lg3',
      },
      lg3: {
        id:      'lg3',
        speaker: 'lukas',
        text:    'Klar Leni! Folge mir, ich kenne den Weg zurück zu Omas Haus.',
        onEnter: [
          { type: 'progress_quest', step: 'step4_meet_leni' },
        ],
        end: true,
      },
    },
  },

  // Stage 3 Quest 1 — "Der Weg zur Schule von Leni"
  // 7 panel dialog persis sesuai naskah + 2 kuis pilihan ganda (retry bila salah)
  tante_quest3_intro: {
    id:      'tante_quest3_intro',
    start:   't3_1',
    questId: 'quest_3',
    nodes: {
      // Panel 1
      t3_1: {
        id:      't3_1',
        speaker: 'tante_maria',
        text:    'Lukas, ich muss heute länger arbeiten. Kannst du bitte Leni von der <vocab title="Sekolah">Schule</vocab> <vocab title="menjemput">abholen</vocab> und zu Oma bringen? Sie wartet schon!',
        next:    't3_2',
      },
      // Panel 2
      t3_2: {
        id:      't3_2',
        speaker: 'tante_maria',
        text:    'Hör gut zu: Geh zuerst <vocab title="lurus">geradeaus</vocab> bis zur <vocab title="lampu lalu lintas">Ampel</vocab>. An der Ampel siehst du eine große <vocab title="Apotek">Apotheke</vocab>. Dort nimmst du <vocab title="ke kanan">nach rechts</vocab> in die Gutenbergstraße.',
        next:    't3_3',
      },
      // Panel 3
      t3_3: {
        id:      't3_3',
        speaker: 'tante_maria',
        text:    'Geh weiter geradeaus, bis du einen <vocab title="Supermarket">Supermarkt</vocab> siehst. Direkt <vocab title="di seberang">gegenüber</vocab> dem Supermarkt liegt die Schule von Leni. Die Schule ist ein großes gelbes <vocab title="Gedung">Gebäude</vocab> <vocab title="di samping">neben</vocab> einer kleinen Bäckerei.',
        next:    't3_q1',
      },
      // Panel 4 — Kuis 1 (benar = 100 poin; salah boleh coba lagi)
      t3_q1: {
        id:      't3_q1',
        speaker: 'lukas',
        text:    'Okay, ich habe es! An der Ampel soll ich...',
        choices: [
          { text: 'Geradeaus.',           correct: false, score: -10, next: 't3_q1_wrong' },
          { text: 'Nach rechts nehmen.',  correct: true,  score: 100, next: 't3_q2' },
          { text: 'Nach links nehmen.',   correct: false, score: -10, next: 't3_q1_wrong' },
        ],
      },
      t3_q1_wrong: {
        id:      't3_q1_wrong',
        speaker: 'tante_maria',
        text:    'Nein, Lukas! Hör nochmal gut zu: An der Ampel, bei der Apotheke, nimmst du nach rechts. Versuch es noch einmal!',
        next:    't3_q1',
      },
      // Panel 5 — Kuis 2 (benar = 100 poin; salah boleh coba lagi)
      t3_q2: {
        id:      't3_q2',
        speaker: 'lukas',
        text:    'Die Schule von Leni ist ...',
        choices: [
          { text: 'Neben der Bäckerei.',    correct: true,  score: 100, next: 't3_6' },
          { text: 'Neben dem Supermarkt.',  correct: false, score: -10, next: 't3_q2_wrong' },
          { text: 'Neben der Apotheke.',    correct: false, score: -10, next: 't3_q2_wrong' },
        ],
      },
      t3_q2_wrong: {
        id:      't3_q2_wrong',
        speaker: 'tante_maria',
        text:    'Nicht ganz! Die Schule liegt gegenüber dem Supermarkt — und direkt neben der kleinen Bäckerei. Noch einmal!',
        next:    't3_q2',
      },
      // Panel 6
      t3_6: {
        id:      't3_6',
        speaker: 'tante_maria',
        text:    'Genau! Du hast <vocab title="selektif">selektiv</vocab> gut verstanden.',
        next:    't3_7',
      },
      // Panel 7
      t3_7: {
        id:      't3_7',
        speaker: 'tante_maria',
        text:    'Beeil dich! Leni wartet schon seit einer Stunde.',
        onEnter: [
          { type: 'progress_quest', step: 'step2_get_directions3' },
          { type: 'add_journal',    entry: 'leni_abholen_notiz' },
        ],
        end:     true,
      },
    },
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2, QUEST 4 — "Einkaufen für Oma!" (Selektives Verstehen 2)
  // Materi: arah ke Supermarkt (entlang, rechts, gegenüber)
  // ════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════
  // STAGE 3, QUEST 2 — "Ein Brief von Oma"
  // Kuis setelah membaca Brief (2 pertanyaan, retry bila salah)
  // ════════════════════════════════════════════════════════════════
  lukas_brief_quiz: {
    id:      'lukas_brief_quiz',
    start:   'bq1',
    questId: 'quest_4',
    nodes: {
      // Kuis 1 (benar = 100 poin)
      bq1: {
        id:      'bq1',
        speaker: 'lukas',
        text:    'Der Supermarkt EDEKA liegt ...',
        choices: [
          { text: 'In der Blumenstraße.',   correct: false, score: -10, next: 'bq1_wrong' },
          { text: 'Gegenüber dem Mall.',    correct: true,  score: 100, next: 'bq2' },
          { text: 'Neben der Bank.',        correct: false, score: -10, next: 'bq1_wrong' },
        ],
      },
      bq1_wrong: {
        id:      'bq1_wrong',
        speaker: 'lukas',
        text:    'Hmm, das steht anders im Brief... Ich lese noch einmal genau.',
        next:    'bq1',
      },
      // Kuis 2 (benar = 100 poin)
      bq2: {
        id:      'bq2',
        speaker: 'lukas',
        text:    'An der Kreuzung siehst du ...',
        choices: [
          { text: 'Ein Supermarkt.',  correct: false, score: -10, next: 'bq2_wrong' },
          { text: 'Ein Mall.',        correct: false, score: -10, next: 'bq2_wrong' },
          { text: 'Eine Bank.',       correct: true,  score: 100, next: 'bq_done' },
        ],
      },
      bq2_wrong: {
        id:      'bq2_wrong',
        speaker: 'lukas',
        text:    'Moment... das war nicht richtig. Was steht im Brief an der Kreuzung?',
        next:    'bq2',
      },
      bq_done: {
        id:      'bq_done',
        speaker: 'lukas',
        text:    'Alles klar! Ich habe den Weg verstanden. Los geht\'s zum EDEKA!',
        onEnter: [
          { type: 'progress_quest', step: 'step3_read_brief' },
          { type: 'add_journal',    entry: 'einkaufen_notiz' },
        ],
        end:     true,
      },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // STAGE 3, QUEST 3 — "Lukas fragt nach dem Weg nach Tantes Haus"
  // Lukas tersesat di tengah kota, bertanya arah kepada Frau Weber.
  // Rumah TANTE ada di sebelah perpustakaan tua (alte Bibliothek).
  // ════════════════════════════════════════════════════════════════
  frau_weber_weg: {
    id:      'frau_weber_weg',
    start:   'fw1',
    questId: 'quest_5',
    nodes: {
      fw1: {
        id:      'fw1',
        speaker: 'lukas',
        text:    'Entschuldigung, können Sie mir helfen? Ich bin gerade mit dem <vocab title="Bus">Bus</vocab> gekommen und kenne den Weg nicht.',
        next:    'fw2',
      },
      fw2: {
        id:      'fw2',
        speaker: 'frau_weber',
        text:    'Natürlich. Wohin möchtest du denn?',
        next:    'fw3',
      },
      fw3: {
        id:      'fw3',
        speaker: 'lukas',
        text:    'Ich möchte zu meiner Tante. Ihr Haus ist direkt <vocab title="di samping">neben</vocab> der alten <vocab title="perpustakaan">Bibliothek</vocab>.',
        next:    'fw4',
      },
      fw4: {
        id:      'fw4',
        speaker: 'frau_weber',
        text:    'Ah, die Bibliothek kenne ich gut! Also, geh diese Straße <vocab title="lurus">geradeaus</vocab> bis zur großen <vocab title="perempatan">Kreuzung</vocab>. Dann biegst du <vocab title="ke kanan">nach rechts</vocab> ab und gehst immer weiter. Nach der <vocab title="jembatan">Brücke</vocab> siehst du einen Park. Geh <vocab title="menembus">durch</vocab> den Park hindurch. Auf der anderen Seite steht die alte Bibliothek. Das Haus deiner Tante ist gleich <vocab title="di sebelahnya">daneben</vocab>.',
        next:    'fw5',
      },
      fw5: {
        id:      'fw5',
        speaker: 'lukas',
        text:    'Vielen Dank! Jetzt weiß ich, wohin ich gehen muss.',
        next:    'fw6',
      },
      fw6: {
        id:      'fw6',
        speaker: 'frau_weber',
        text:    'Gern geschehen. Viel Spaß bei deiner Tante!',
        onEnter: [
          { type: 'progress_quest', step: 'step3_ask_frau' },
          { type: 'add_journal',    entry: 'tantes_haus_notiz' },
        ],
        end:     true,
      },
    },
  },

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
        text:    'Natürlich! Gehen Sie diese Straße <vocab title="sepanjang">entlang</vocab> bis zur Ampel. Dort biegen Sie an der <vocab title="Gereja">Kirche</vocab> <vocab title="kanan">rechts</vocab> ab.',
        next:    'p1_4',
      },
      p1_4: {
        id:      'p1_4',
        speaker: 'passant_1',
        text:    'Der Supermarkt ist das große Gebäude mit dem blauen Dach, direkt <vocab title="di samping">neben</vocab> dem großen <vocab title="Tempat parkir">Parkplatz</vocab>. Sie können es nicht verfehlen!',
        next:    'p1_quiz',
      },
      p1_quiz: {
        id:      'p1_quiz',
        speaker: 'lukas',
        text:    'Ich habe es! Der Supermarkt liegt neben...',
        choices: [
          { text: 'Der Kirche',                correct: false, score: -10, next: 'p1_wrong' },
          { text: 'Dem Parkplatz',             correct: true,  score: 100, next: 'p1_correct' },
          { text: 'Der Schule',                correct: false, score: -10, next: 'p1_wrong' },
        ],
      },
      p1_correct: {
        id:      'p1_correct',
        speaker: 'passant_1',
        text:    '<vocab title="Benar">Richtig</vocab>! Neben dem Parkplatz. Guten Einkauf!',
        end: true,
      },
      p1_wrong: {
        id:      'p1_wrong',
        speaker: 'passant_1',
        text:    'Nein, nein! NEBEN dem PARKPLATZ! An der Kirche biegen Sie nur ab.',
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
        text:    'Einen Eisstand? Ja! Gehen Sie diese Straße <vocab title="lurus">geradeaus</vocab> bis zum Ende, dann <vocab title="kanan">rechts</vocab> in die Bachstraße.',
        next:    'p2_3',
      },
      p2_3: {
        id:      'p2_3',
        speaker: 'passant_2',
        text:    'Der Eisstand ist <vocab title="di antara">zwischen</vocab> dem <vocab title="Toko bunga">Blumenladen</vocab> und dem <vocab title="Kafe">Café</vocab>, auf der <vocab title="sisi kiri">linken Seite</vocab>.',
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
        text:    'Entschuldigung, Herr Fischer! Wo bin ich hier eigentlich? Ich kenne diesen Teil der Stadt nicht. Wissen Sie, wo die alte Brücke ist? Dort wohnt meine Oma.',
        next:    'p3_2',
      },
      p3_2: {
        id:      'p3_2',
        speaker: 'passant_3',
        text:    'Die alte Brücke? Kein Problem! Geh <vocab title="kembali">zurück</vocab> durch den Park bis zur <vocab title="Jalan utama">Hauptstraße</vocab>. Dort biegst du rechts ab und gehst geradeaus bis zur Ampel.',
        next:    'p3_3',
      },
      p3_3: {
        id:      'p3_3',
        speaker: 'passant_3',
        text:    'An der Ampel gehst du links in die Schillerstraße, immer geradeaus bis zum Fluss. <vocab title="Menyeberangi">Überquere</vocab> die alte <vocab title="Jembatan">Brücke</vocab> — dahinter wohnen deine Großeltern, gleich neben der <vocab title="Kincir angin">Windmühle</vocab>.',
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
        text:    'Entschuldigung! Ich habe mich im Park <vocab title="tersesat">verlaufen</vocab>. Ich muss <vocab title="Segera">schnell</vocab> ins <vocab title="Bioskop">Kino</vocab> — der Film fängt bald an!',
        next:    'p4_2',
      },
      p4_2: {
        id:      'p4_2',
        speaker: 'passant_4',
        text:    'Oh! Das Kino ist nicht weit. Hör gut zu: Geh diese <vocab title="Jalan pohon">Allee</vocab> <vocab title="lurus">geradeaus</vocab> entlang bis zum Ende.',
        next:    'p4_3',
      },
      p4_3: {
        id:      'p4_3',
        speaker: 'passant_4',
        text:    'Dann biegst du <vocab title="kanan">rechts</vocab> in die <vocab title="Jalan utama">Hauptstraße</vocab> ab. Das Kino ist das große Gebäude mit den <vocab title="lampu berwarna-warni">bunten Lichtern</vocab> auf der linken Seite.',
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
          { type: 'progress_quest', step: 'step3_ask_kino' },
          { type: 'add_journal',    entry: 'kino_notiz' },
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

  // ════════════════════════════════════════════════════════════════
  // QUEST 4 — Bezahlen & nach Hause
  // ════════════════════════════════════════════════════════════════

  kasse_bezahlen: {
    id: 'kasse_bezahlen', start: 'k1', questId: 'quest_4',
    nodes: {
      k1: { id: 'k1', speaker: 'kassiererin',
            text: 'Guten Tag! Haben Sie alles gefunden?', next: 'k2' },
      k2: { id: 'k2', speaker: 'lukas',
            text: 'Ja, danke! <vocab title="kentang">Kartoffeln</vocab>, <vocab title="daging">Fleisch</vocab>, <vocab title="selada">Salat</vocab> und <vocab title="mentega">Butter</vocab>.', next: 'k3' },
      k3: { id: 'k3', speaker: 'kassiererin',
            text: '<i>*piep, piep, piep*</i> Das <vocab title="totalnya">macht</vocab> zwölf Euro fünfzig, bitte.', next: 'kq' },
      kq: { id: 'kq', speaker: 'lukas',
            text: 'Wie viel muss ich <vocab title="membayar">bezahlen</vocab>?',
            choices: [
              { text: '2,50 €',  correct: false, score: -10, next: 'kw' },
              { text: '12,50 €', correct: true,  score: 100, next: 'k4' },
              { text: '20,15 €', correct: false, score: -10, next: 'kw' },
            ] },
      kw: { id: 'kw', speaker: 'kassiererin',
            text: 'Nein, nein — <b>zwölf</b> Euro <b>fünfzig</b>. Zwölf = 12, fünfzig = 50.', next: 'kq' },
      k4: { id: 'k4', speaker: 'lukas',
            text: 'Hier sind zwölf Euro fünfzig. Brauche ich eine <vocab title="kantong belanja">Tüte</vocab>?', next: 'k5' },
      k5: { id: 'k5', speaker: 'kassiererin',
            text: 'Die Tüte ist schon dabei. Danke schön und einen schönen Tag noch!',
            onEnter: [ { type: 'progress_quest', step: 'step7_pay' } ],
            end: true },
    },
  },

  oma_einkauf_danke: {
    id: 'oma_einkauf_danke', start: 'o1', questId: 'quest_4',
    nodes: {
      o1: { id: 'o1', speaker: 'oma_helga',
            text: 'Da bist du ja, Lukas! Hast du meinen <vocab title="surat">Brief</vocab> gefunden?', next: 'o2' },
      o2: { id: 'o2', speaker: 'lukas',
            text: 'Ja, Oma! Der EDEKA liegt gegenüber dem Mall. Hier ist die Tüte.', next: 'oq' },
      oq: { id: 'oq', speaker: 'oma_helga',
            text: 'Wunderbar! Und was hast du alles gekauft?',
            choices: [
              { text: 'Kartoffeln, Fleisch, Salat und Butter.', correct: true,  score: 100, next: 'o3' },
              { text: 'Brot, Eier und Milch.',                  correct: false, score: -10, next: 'ow' },
              { text: 'Äpfel, Käse und Wurst.',                 correct: false, score: -10, next: 'ow' },
            ] },
      ow: { id: 'ow', speaker: 'oma_helga',
            text: 'Hm? Schau noch einmal in die Tüte, mein Schatz.', next: 'oq' },
      o3: { id: 'o3', speaker: 'oma_helga',
            text: 'Alles da — danke, mein Schatz! Jetzt koche ich das Abendessen und backe einen <vocab title="kue apel">Apfelkuchen</vocab> für Tante Maria.',
            onEnter: [ { type: 'progress_quest', step: 'step9_give_oma' } ],
            end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // QUEST 5 — Apfelkuchen für Tante Maria
  // ════════════════════════════════════════════════════════════════

  oma_kuchen_bus: {
    id: 'oma_kuchen_bus', start: 'b1', questId: 'quest_5',
    nodes: {
      b1: { id: 'b1', speaker: 'oma_helga',
            text: 'Lukas, der <vocab title="kue apel">Apfelkuchen</vocab> ist fertig! Bringst du ihn bitte zu Tante Maria?', next: 'b2' },
      b2: { id: 'b2', speaker: 'oma_helga',
            text: 'Sie wohnt in der Stadt, direkt <vocab title="di samping">neben</vocab> der alten <vocab title="perpustakaan">Bibliothek</vocab>. Nimm den <vocab title="bus">Bus</vocab> — er hält an der Hauptstraße.', next: 'b3' },
      b3: { id: 'b3', speaker: 'lukas',
            text: 'Neben der alten Bibliothek … Gut, Oma! Den Weg von der <vocab title="halte">Haltestelle</vocab> finde ich schon.',
            onEnter: [ { type: 'progress_quest', step: 'step1_cake' } ],
            end: true },
    },
  },

  tante_kuchen: {
    id: 'tante_kuchen', start: 't1', questId: 'quest_5',
    nodes: {
      t1: { id: 't1', speaker: 'tante_maria_stadt',
            text: 'Lukas! Was für eine Überraschung! Wie hast du mein Haus gefunden?', next: 't2' },
      t2: { id: 't2', speaker: 'lukas',
            text: 'Ich habe eine Frau an der Haltestelle gefragt. Ich bin über die <vocab title="jembatan">Brücke</vocab> und durch den <vocab title="taman">Park</vocab> gegangen.', next: 'tq' },
      tq: { id: 'tq', speaker: 'tante_maria_stadt',
            text: 'Sehr gut! Und welches Gebäude steht direkt neben meinem Haus?',
            choices: [
              { text: 'Die Kirche.',          correct: false, score: -10, next: 'tw' },
              { text: 'Die alte Bibliothek.', correct: true,  score: 100, next: 't3' },
              { text: 'Das Kino.',            correct: false, score: -10, next: 'tw' },
            ] },
      tw: { id: 'tw', speaker: 'tante_maria_stadt',
            text: 'Schau dich noch einmal um, Lukas. Was steht gleich <vocab title="di sebelahnya">daneben</vocab>?', next: 'tq' },
      t3: { id: 't3', speaker: 'lukas',
            text: 'Und das hier ist für dich: ein Apfelkuchen von Oma!', next: 't4' },
      t4: { id: 't4', speaker: 'tante_maria_stadt',
            text: 'Mmh, der riecht herrlich! Danke, Lukas. Leni wird sich freuen.', next: 't5' },
      t5: { id: 't5', speaker: 'tante_maria_stadt',
            text: 'Oh, es wird schon spät, und der letzte Bus ist weg. Frag doch Herrn Fischer, unseren Nachbarn — er steht da drüben im Park und kennt jede Straße.',
            onEnter: [ { type: 'progress_quest', step: 'step5_give_cake' } ],
            end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // QUEST 6 — Zu Hause angekommen
  // ════════════════════════════════════════════════════════════════

  oma_abendessen: {
    id: 'oma_abendessen', start: 'a1', questId: 'quest_6',
    nodes: {
      a1: { id: 'a1', speaker: 'oma_helga',
            text: 'Da bist du ja, Lukas! Ich habe mir schon Sorgen gemacht. Wie war es bei Tante Maria?', next: 'a2' },
      a2: { id: 'a2', speaker: 'lukas',
            text: 'Schön! Aber der Bus fuhr nicht mehr. Ein Nachbar hat mir den Weg erklärt.', next: 'aq' },
      aq: { id: 'aq', speaker: 'oma_helga',
            text: 'Und wie bist du dann nach Hause gekommen?',
            choices: [
              { text: 'Mit dem Taxi.',                                 correct: false, score: -10, next: 'aw' },
              { text: 'Zu Fuß — über die alte Brücke.',                correct: true,  score: 100, next: 'a3' },
              { text: 'Mit dem Boot über die Elbe.',                   correct: false, score: -10, next: 'aw' },
            ] },
      aw: { id: 'aw', speaker: 'oma_helga',
            text: 'Wirklich? Erzähl noch einmal: Was musstest du <vocab title="menyeberangi">überqueren</vocab>?', next: 'aq' },
      a3: { id: 'a3', speaker: 'oma_helga',
            text: 'Ganz allein! Ich bin stolz auf dich. Komm rein — das <vocab title="makan malam">Abendessen</vocab> ist fertig!',
            onEnter: [ { type: 'progress_quest', step: 'step3_dinner' } ],
            end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // QUEST 7 — Kino am Abend
  // ════════════════════════════════════════════════════════════════

  lukas_kino_plan: {
    id: 'lukas_kino_plan', start: 'p1', questId: 'quest_7',
    nodes: {
      p1: { id: 'p1', speaker: 'lukas',
            text: '<i>*Handy vibriert*</i> Eine Nachricht von Felix: „Der Film beginnt um acht Uhr im <vocab title="bioskop">Kino</vocab>. Ich warte drinnen!"', next: 'p2' },
      p2: { id: 'p2', speaker: 'lukas',
            text: 'Schon so spät! Aber wo ist das Kino? Ich gehe in die Stadt und frage jemanden.',
            onEnter: [ { type: 'progress_quest', step: 'step1_plan' } ],
            end: true },
    },
  },

  kino_karte: {
    id: 'kino_karte', start: 'c1', questId: 'quest_7',
    nodes: {
      c1: { id: 'c1', speaker: 'kinokasse',
            text: 'Guten Abend! Was möchtest du sehen?', next: 'c2' },
      c2: { id: 'c2', speaker: 'lukas',
            text: 'Eine <vocab title="tiket">Karte</vocab> für „Abenteuer an der Elbe", bitte. Mein Freund Felix ist schon drin.', next: 'cq' },
      cq: { id: 'cq', speaker: 'kinokasse',
            text: 'Gern. Der Film beginnt um <b>acht Uhr</b> in Saal 2. Das macht acht Euro. — Wann beginnt der Film?',
            choices: [
              { text: 'Um sechs Uhr.', correct: false, score: -10, next: 'cw' },
              { text: 'Um acht Uhr.',  correct: true,  score: 100, next: 'c3' },
              { text: 'Um zehn Uhr.',  correct: false, score: -10, next: 'cw' },
            ] },
      cw: { id: 'cw', speaker: 'kinokasse',
            text: 'Nein — um <b>acht</b> Uhr (20 Uhr). Hör gut zu!', next: 'cq' },
      c3: { id: 'c3', speaker: 'kinokasse',
            text: 'Genau! Hier ist deine Karte. Viel Spaß im Film!', end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // QUEST 8 — Restaurant Deichstraße (am nächsten Tag)
  // ════════════════════════════════════════════════════════════════

  opa_quest8_intro: {
    id: 'opa_quest8_intro', start: 'r1', questId: 'quest_8',
    nodes: {
      r1: { id: 'r1', speaker: 'opa_klaus',
            text: 'Guten Morgen, Lukas! Heute ist dein letzter Tag in Hamburg. Zum <vocab title="makan siang">Mittagessen</vocab> lade ich alle ins <vocab title="restoran">Restaurant</vocab> in der Deichstraße ein!', next: 'r2' },
      r2: { id: 'r2', speaker: 'opa_klaus',
            text: 'Geh schon vor, wir kommen gleich nach. Hör gut zu: Über die alte Brücke und die Schillerstraße <vocab title="lurus">geradeaus</vocab> bis zur Ampel. Dort <vocab title="kanan">rechts</vocab> in die Hauptstraße.', next: 'r3' },
      r3: { id: 'r3', speaker: 'opa_klaus',
            text: 'An der großen Kreuzung <vocab title="kanan">rechts</vocab> in die Bachstraße und dann <vocab title="kiri">links</vocab> in die Deichstraße. Das Restaurant ist auf der <vocab title="sisi kiri">linken Seite</vocab>.', next: 'rq' },
      rq: { id: 'rq', speaker: 'lukas',
            text: 'Also … von der Bachstraße biege ich in die Deichstraße …',
            choices: [
              { text: '… nach links.',    correct: true,  score: 100, next: 'r4' },
              { text: '… nach rechts.',   correct: false, score: -10, next: 'rw' },
              { text: '… gar nicht ab.',  correct: false, score: -10, next: 'rw' },
            ] },
      rw: { id: 'rw', speaker: 'opa_klaus',
            text: 'Nein, mein Junge: von der Bachstraße <b>links</b> in die Deichstraße.', next: 'rq' },
      r4: { id: 'r4', speaker: 'opa_klaus',
            text: 'Genau! Bis gleich im Restaurant.',
            onEnter: [
              { type: 'progress_quest', step: 'step1_talk_opa' },
              { type: 'add_journal',    entry: 'restaurant_notiz' },
            ],
            end: true },
    },
  },

  restaurant_bestellen: {
    id: 'restaurant_bestellen', start: 'e1', questId: 'quest_8',
    nodes: {
      e1: { id: 'e1', speaker: 'kellner',
            text: 'Herzlich willkommen im Restaurant Deichstraße! Ihre Familie sitzt schon am Fenster. Hier ist die <vocab title="daftar menu">Speisekarte</vocab>.', next: 'e2' },
      e2: { id: 'e2', speaker: 'kellner',
            text: 'Heute gibt es: <b>Fischbrötchen</b> (4,50 €), <b>Labskaus</b> (9,80 €) und <b>Rote Grütze</b> zum Nachtisch (3,90 €). Was <vocab title="mau">möchten</vocab> Sie?', next: 'eq' },
      eq: { id: 'eq', speaker: 'lukas',
            text: 'Hmm … Wie bestelle ich höflich ein Fischbrötchen?',
            choices: [
              { text: 'Ich hätte gern ein Fischbrötchen, bitte.', correct: true,  score: 100, next: 'e3' },
              { text: 'Fischbrötchen. Jetzt!',                    correct: false, score: -10, next: 'ew' },
              { text: 'Ich bin ein Fischbrötchen.',               correct: false, score: -10, next: 'ew' },
            ] },
      ew: { id: 'ew', speaker: 'kellner',
            text: 'Wie bitte? Sagen Sie einfach: „Ich <vocab title="ingin (sopan)">hätte gern</vocab> …, bitte."', next: 'eq' },
      e3: { id: 'e3', speaker: 'kellner',
            text: 'Sehr gern. Und was kostet das Fischbrötchen?',
            choices: [
              { text: '4,50 €', correct: true,  score: 100, next: 'e4' },
              { text: '9,80 €', correct: false, score: -10, next: 'ew2' },
              { text: '3,90 €', correct: false, score: -10, next: 'ew2' },
            ] },
      ew2: { id: 'ew2', speaker: 'kellner',
             text: 'Schauen Sie noch einmal auf die Speisekarte: Fischbrötchen …', next: 'e3' },
      e4: { id: 'e4', speaker: 'kellner',
            text: 'Richtig, vier Euro fünfzig. Kommt sofort! <i>*Wenig später …*</i> Guten Appetit!', next: 'e5' },
      e5: { id: 'e5', speaker: 'opa_klaus',
            text: 'Na, Lukas? Ein echtes Hamburger Fischbrötchen! Schmeckt es dir?', next: 'e6' },
      e6: { id: 'e6', speaker: 'lukas',
            text: 'Sehr <vocab title="enak">lecker</vocab>, Opa! Danke für die Einladung!', end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // QUEST 9 — Spaziergang an der Elbe
  // ════════════════════════════════════════════════════════════════

  felix_quest9_intro: {
    id: 'felix_quest9_intro', start: 'f1', questId: 'quest_9',
    nodes: {
      f1: { id: 'f1', speaker: 'felix',
            text: 'Lukas! Leni und ich machen einen <vocab title="jalan-jalan">Spaziergang</vocab> an der <vocab title="sungai Elbe">Elbe</vocab>. Kommst du mit?', next: 'f2' },
      f2: { id: 'f2', speaker: 'felix',
            text: 'Wir gehen die Promenade <vocab title="menyusuri">entlang</vocab>, immer Richtung Osten, bis zum <vocab title="titik pandang">Aussichtspunkt</vocab> mit dem Fernrohr.', next: 'f3' },
      f3: { id: 'f3', speaker: 'lukas',
            text: 'Klar komme ich mit! Geht ihr vor?',
            onEnter: [
              { type: 'progress_quest', step: 'step1_talk_felix' },
              { type: 'add_journal',    entry: 'elbe_notiz' },
            ],
            end: true },
    },
  },

  felix_elbe_gespraech: {
    id: 'felix_elbe_gespraech', start: 'g1', questId: 'quest_9',
    nodes: {
      g1: { id: 'g1', speaker: 'felix',
            text: 'Schau mal, die Schiffe auf der Elbe! Und die Sonne geht bald unter.', next: 'g2' },
      g2: { id: 'g2', speaker: 'leni',
            text: 'Lukas, kommst du nächstes Jahr wieder nach Hamburg?', next: 'gq' },
      gq: { id: 'gq', speaker: 'lukas',
            text: 'Was antwortet Lukas?',
            choices: [
              { text: 'Ja, ich komme bestimmt wieder!',      correct: true, score: 50, next: 'g3' },
              { text: 'Vielleicht — ich hoffe es sehr.',     correct: true, score: 50, next: 'g3' },
            ] },
      g3: { id: 'g3', speaker: 'felix',
            text: 'Super! Und was willst du in der <vocab title="masa depan">Zukunft</vocab> machen? Ich möchte Kapitän werden — auf einem großen Schiff.', next: 'g4' },
      g4: { id: 'g4', speaker: 'lukas',
            text: 'Ich lerne weiter Deutsch. Vielleicht studiere ich später in Hamburg!', next: 'g5' },
      g5: { id: 'g5', speaker: 'leni',
            text: 'Dann wohnst du bei uns! Komm, Oma wartet heute Abend mit dem großen Abschiedsessen.',
            onEnter: [ { type: 'progress_quest', step: 'step3_sunset_talk' } ],
            end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // QUEST 10 — Abschiedsabend
  // ════════════════════════════════════════════════════════════════

  oma_abschied: {
    id: 'oma_abschied', start: 'z1', questId: 'quest_10',
    nodes: {
      z1: { id: 'z1', speaker: 'oma_helga',
            text: 'Da ist ja unser Lukas! Heute ist dein letzter Abend. Die ganze <vocab title="keluarga">Familie</vocab> ist hier.', next: 'z2' },
      z2: { id: 'z2', speaker: 'opa_klaus',
            text: 'Du hast so viel erlebt: die Schule von Leni, der EDEKA, die alte Brücke, das Kino …', next: 'z3' },
      z3: { id: 'z3', speaker: 'tante_maria',
            text: 'Und den Weg zu meinem Haus hast du ganz allein gefunden!', next: 'zq' },
      zq: { id: 'zq', speaker: 'oma_helga',
            text: 'Sag mal, Lukas: Wo war das Kino?',
            choices: [
              { text: 'Neben dem Bahnhof.',                                 correct: false, score: -10, next: 'zw' },
              { text: 'An der Hauptstraße — das Gebäude mit den bunten Lichtern.', correct: true,  score: 100, next: 'z4' },
              { text: 'Hinter der Kirche.',                                 correct: false, score: -10, next: 'zw' },
            ] },
      zw: { id: 'zw', speaker: 'oma_helga',
            text: 'Hmm, denk noch einmal an die bunten Lichter …', next: 'zq' },
      z4: { id: 'z4', speaker: 'lukas',
            text: 'Danke für alles! Ich habe hier so viel Deutsch gelernt. Ich werde euch <vocab title="merindukan">vermissen</vocab>.', next: 'z5' },
      z5: { id: 'z5', speaker: 'oma_helga',
            text: 'Wir dich auch, mein Schatz. Komm bald wieder! <i>*Alle heben die Gläser*</i> Auf Lukas!',
            onEnter: [ { type: 'progress_quest', step: 'step2_farewell' } ],
            end: true },
    },
  },

  // ════════════════════════════════════════════════════════════════
  // NPC tambahan — sapaan di luar langkah quest
  // ════════════════════════════════════════════════════════════════

  kassiererin_greeting: {
    id: 'kassiererin_greeting', start: 'g1',
    nodes: {
      g1: { id: 'g1', speaker: 'kassiererin',
            text: 'Guten Tag! Die <vocab title="kasir">Kasse</vocab> ist hier vorne, wenn Sie fertig sind.', end: true },
    },
  },

  tante_stadt_greeting: {
    id: 'tante_stadt_greeting', start: 'g1',
    nodes: {
      g1: { id: 'g1', speaker: 'tante_maria_stadt',
            text: 'Lukas! Komm gut nach Hause — und grüß Oma von mir!', end: true },
    },
  },

  felix_greeting: {
    id: 'felix_greeting', start: 'g1',
    nodes: {
      g1: { id: 'g1', speaker: 'felix',
            text: 'Hey Lukas! Was für ein schöner Tag an der Elbe.', end: true },
    },
  },

  leni_greeting: {
    id: 'leni_greeting', start: 'g1',
    nodes: {
      g1: { id: 'g1', speaker: 'leni',
            text: 'Lukas! Ich bin so froh, dass du hier bist!', end: true },
    },
  },
};


// ═══════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES — teks di Reisetagebuch
// ═══════════════════════════════════════════════════════════════════

export const JOURNAL_ENTRIES = {
  // Setiap entri: title, subtitle, body (teks catatan, baris baru dipertahankan),
  // words: [[Jerman, Indonesia], …], done: catatan tambahan setelah quest selesai.

  // ── STAGE 1 ───────────────────────────────────────────────────
  frühstück_notiz: {
    title:    'Omas Hinweise für die Küche',
    subtitle: 'Am Telefon mit Oma Helga',
    body: `
Oma ist nicht zu Hause. Am Telefon hat sie mir gesagt, wo alles ist:

• Die <b>Pfanne</b> ist <span class="prep-highlight">IN</span> dem Schrank.
• Die <b>Wurst</b> ist <span class="prep-highlight">AUF</span> dem Serviertisch.
• Die <b>Eier</b> sind <span class="prep-highlight">UNTER</span> dem kleinen Tisch.
• Der <b>Teller</b> ist <span class="prep-highlight">AUF</span> dem Küchentisch.
• Das <b>Besteck</b> ist <span class="prep-highlight">IN</span> der Schublade.
    `.trim(),
    words: [['in', 'di dalam'], ['auf', 'di atas'], ['unter', 'di bawah'], ['der Schrank', 'lemari'], ['die Schublade', 'laci']],
    done: 'Ich habe alles gefunden und ein leckeres Frühstück gekocht! 🍳',
  },

  wohnzimmer_notiz: {
    title:    'Tantes drei Sachen',
    subtitle: 'Tante Maria ruft aus dem Büro an',
    body: `
Tante Maria braucht drei Sachen: die <b>Socken</b>, das <b>Papier</b> und das <b>Spielzeug</b> von Leni.
Sie weiß nicht, wo sie sind — ich muss selbst suchen.

Tipp: Merk dir, WO du jede Sache findest. Du musst es Tante schreiben!
    `.trim(),
    words: [['die Socken', 'kaus kaki'], ['das Papier', 'kertas'], ['das Spielzeug', 'mainan'], ['der Esstisch', 'meja makan']],
    done: `Gefunden:
• Die Socken sind <span class="prep-highlight">IM</span> Schrank.
• Das Papier liegt <span class="prep-highlight">AUF</span> dem Tisch.
• Das Spielzeug ist <span class="prep-highlight">UNTER</span> dem Esstisch.`,
  },

  // ── STAGE 2 ───────────────────────────────────────────────────
  leni_abholen_notiz: {
    title:    'Wegbeschreibung zur Schule',
    subtitle: 'Tante Maria am Telefon',
    body: `
So komme ich zur Schule von Leni:

1. Über die alte Brücke in die Stadt, dann <span class="prep-highlight">geradeaus</span> bis zur Ampel.
2. <span class="prep-highlight">An der Ampel</span> (große Apotheke!) <span class="prep-highlight">nach rechts</span> in die Gutenbergstraße.
3. Weiter geradeaus bis zum Supermarkt.
4. Die Schule liegt <span class="prep-highlight">gegenüber</span> dem Supermarkt — das große gelbe Gebäude <span class="prep-highlight">neben</span> der Bäckerei.
    `.trim(),
    words: [['geradeaus', 'lurus'], ['nach rechts', 'ke kanan'], ['gegenüber', 'di seberang'], ['neben', 'di samping'], ['die Ampel', 'lampu lalu lintas']],
    done: 'Leni ist sicher bei Oma. 👧',
  },

  einkaufen_notiz: {
    title:    'Omas Einkaufsliste',
    subtitle: 'Ein Brief von Oma',
    body: `
Was Oma braucht: Kartoffeln 🥔, Fleisch 🥩, Salat 🥬, Butter 🧈

Wo ist der EDEKA?
→ Aus dem Haus <span class="prep-highlight">nach rechts</span> in die Blumenstraße
→ <span class="prep-highlight">Geradeaus</span> bis zur Kreuzung (dort: eine Bank!)
→ <span class="prep-highlight">Nach rechts</span> in die Wolfgangstraße
→ EDEKA liegt <span class="prep-highlight">gegenüber</span> dem Mall

Im EDEKA: alles einsammeln, an der Kasse bezahlen, dann nach Hause zu Oma.
    `.trim(),
    words: [['die Kreuzung', 'perempatan'], ['die Kasse', 'kasir'], ['bezahlen', 'membayar'], ['zwölf Euro fünfzig', '12,50 €']],
    done: 'Bezahlt: zwölf Euro fünfzig. Oma hat sich gefreut! 🛒',
  },

  tantes_haus_notiz: {
    title:    'Der Weg zu Tantes Haus',
    subtitle: 'Frau Weber an der Bushaltestelle',
    body: `
Ich bringe Tante Maria Omas Apfelkuchen. Von der Haltestelle:

1. Diese Straße <span class="prep-highlight">geradeaus</span> bis zur großen Kreuzung
2. Dort <span class="prep-highlight">nach rechts</span> abbiegen und immer weiter
3. Nach der <span class="prep-highlight">Brücke</span> kommt ein Park
4. <span class="prep-highlight">Durch</span> den Park hindurch
5. Auf der anderen Seite: die alte <span class="prep-highlight">Bibliothek</span>
🏠 Tantes Haus ist gleich <span class="prep-highlight">daneben</span>!
    `.trim(),
    words: [['die Haltestelle', 'halte'], ['die Brücke', 'jembatan'], ['hindurch', 'menembus'], ['daneben', 'di sebelahnya']],
    done: 'Tante hat sich über den Apfelkuchen gefreut. 🥧',
  },

  verloren_notiz: {
    title:    'Wo bin ich?',
    subtitle: 'Herr Fischer erklärt den Heimweg',
    body: `
Der letzte Bus ist weg. Herr Fischer, Tantes Nachbar, hat mir geholfen:

1. <span class="prep-highlight">Zurück</span> durch den Park bis zur Hauptstraße
2. <span class="prep-highlight">Rechts</span> bis zur Ampel
3. An der Ampel <span class="prep-highlight">links</span> in die Schillerstraße
4. Die alte <span class="prep-highlight">Brücke</span> <span class="prep-highlight">überqueren</span>
5. Omas Haus steht neben der Windmühle
    `.trim(),
    words: [['zurück', 'kembali'], ['überqueren', 'menyeberangi'], ['links', 'kiri'], ['die Windmühle', 'kincir angin']],
    done: 'Ich habe den Weg ganz allein gefunden. Dann gab es Abendessen. 🍲',
  },

  kino_notiz: {
    title:    'Zum Kino!',
    subtitle: 'Frau Müller im Stadtpark',
    body: `
Felix wartet im Kino (Film um acht Uhr). Ich war im Stadtpark verloren …

1. Diese <span class="prep-highlight">Allee</span> geradeaus entlang bis zum Ende
2. <span class="prep-highlight">Rechts</span> auf die Hauptstraße
3. Das Kino = großes Gebäude mit <span class="prep-highlight">bunten Lichtern</span> (<span class="prep-highlight">links</span>)

An der Kinokasse: „Eine Karte, bitte."
    `.trim(),
    words: [['das Kino', 'bioskop'], ['die Allee', 'jalan berpohon'], ['die Karte', 'tiket'], ['um acht Uhr', 'jam delapan']],
    done: 'Der Film „Abenteuer an der Elbe" war super! 🎬',
  },

  // ── PENUTUP ───────────────────────────────────────────────────
  restaurant_notiz: {
    title:    'Mittagessen in der Deichstraße',
    subtitle: 'Opas Einladung',
    body: `
Opa lädt alle ins Restaurant ein. Der Weg:

1. Über die alte Brücke, Schillerstraße <span class="prep-highlight">geradeaus</span> bis zur Ampel
2. <span class="prep-highlight">Rechts</span> in die Hauptstraße bis zur großen Kreuzung
3. <span class="prep-highlight">Rechts</span> in die Bachstraße
4. <span class="prep-highlight">Links</span> in die Deichstraße — das Restaurant ist <span class="prep-highlight">links</span>

Höflich bestellen: „Ich hätte gern …, bitte."
    `.trim(),
    words: [['die Speisekarte', 'daftar menu'], ['Ich hätte gern …', 'Saya mau … (sopan)'], ['lecker', 'enak'], ['das Fischbrötchen', 'roti isi ikan']],
    done: 'Mein Fischbrötchen kostete vier Euro fünfzig. Lecker! 🐟',
  },

  elbe_notiz: {
    title:    'Spaziergang an der Elbe',
    subtitle: 'Mit Felix und Leni',
    body: `
Nach dem Essen gehen wir an der Elbe <span class="prep-highlight">entlang</span> — immer Richtung Osten bis zum Aussichtspunkt mit dem Fernrohr.
    `.trim(),
    words: [['die Elbe', 'sungai Elbe'], ['entlang', 'menyusuri'], ['der Aussichtspunkt', 'titik pandang'], ['die Zukunft', 'masa depan']],
    done: 'Felix will Kapitän werden. Ich lerne weiter Deutsch! 🌅',
  },

  abschied_notiz: {
    title:    'Mein letzter Abend',
    subtitle: 'Abschied von der Familie',
    body: `
Heute Abend feiert die ganze Familie im Garten. Morgen fliege ich nach Indonesien zurück.

Danke, Hamburg — für die Schule von Leni, den EDEKA, die alte Brücke, das Kino und die Elbe.
    `.trim(),
    words: [['der Abschied', 'perpisahan'], ['die Familie', 'keluarga'], ['vermissen', 'merindukan'], ['auf Wiedersehen', 'sampai jumpa']],
    done: 'Auf Wiedersehen, Hamburg! Ich komme wieder. 💛',
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
  nachbar_hans: 'hans_hint_quest1',
  // Stage 2 NPCs
  leni:         'leni_quest3_greeting',
  leni_elbe:    'leni_greeting',
  leni_haus:    'leni_greeting',
  frau_weber:   'frau_weber_weg',
  passant_1:    'passant1_directions',
  passant_2:    'passant2_quest5_intro',
  passant_3:    'passant3_quest6_intro',
  passant_4:    'passant4_quest7_intro',
  kassiererin:  'kassiererin_greeting',
  tante_maria_stadt: 'tante_stadt_greeting',
  felix:        'felix_greeting',
};
