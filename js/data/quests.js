// ═══════════════════════════════════════════════════════════════════
// js/data/quests.js — DATA SEMUA QUEST
//
// Setiap quest punya:
//   id           : unique
//   title        : judul Jerman
//   subtitle     : subtitle Indonesia (opsional)
//   description  : deskripsi singkat (di toast saat unlock)
//   giver        : NPC id pemberi quest
//   zone         : zona utama dimana quest berlangsung
//   prerequisites: array quest id yang harus selesai dulu
//   steps        : array step — setiap step punya:
//     - id, kind, target, description, complete
//   reward       : { score, journal_entry, vocab_unlock }
//   intro_dialog : ID dialog yang dipicu saat NPC giver pertama kali ditekan E
//                  (dialog tree ada di dialogs.js)
// ═══════════════════════════════════════════════════════════════════

import { ZONES } from '../config.js';


export const QUESTS = {

  // ════════════════════════════════════════════════════════════════
  // STAGE 1 — Omas Haus (Aktivitäten in der Wohnung)
  // Tujuan: Memahami letak benda (in, auf, unter)
  // ════════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────────
  // QUEST 1 — "Lukas macht Frühstück!" (Stage 1, Bagian 1)
  // Lukas lapar, cari 5 benda di dapur dengan petunjuk Oma lewat SMS
  // ────────────────────────────────────────────────────────────────
  quest_1: {
    id:           'quest_1',
    title:        'Lukas macht Frühstück!',
    subtitle:     'Lukas Bikin Sarapan',
    description:  'Lukas baru bangun dan lapar! Pergi ke dapur, telpon Oma untuk minta petunjuk letak benda, kumpulkan semua alat masak.',
    giver:        'lukas',
    zone:         ZONES.HAUS_INTERIOR,
    prerequisites:[],

    steps: [
      {
        id:          'step1_wake_up',
        kind:        'auto',
        description: 'Ich habe Hunger. Wo ist die Pfanne?',
      },
      {
        id:          'step2_reach_phone',
        kind:        'reach_trigger',
        target:      'wired_phone',
        description: 'Geh zum Telefon im Flur',
      },
      {
        id:          'step3_phone_call',
        kind:        'auto',
        description: 'Hör Omas Anweisungen am Telefon',
      },
      {
        id:          'step4_collect_kitchen',
        kind:        'collect_auto',  // PROXIMITY-based, no key needed
        target:      ['pfanne', 'wurst', 'eier', 'teller', 'besteck'],
        description: 'Sammle die 5 Sachen in der Küche',
      },
      {
        id:          'step5_cook',
        kind:        'auto',
        description: 'Koch dein Frühstück',
      },
    ],

    reward: {
      score:         500,
      journal_entry: 'frühstück_notiz',
      vocab_unlock:  ['die Küche', 'die Pfanne', 'der Pfannenwender', 'die Gabel',
                      'das Messer', 'der Teller', 'die Eier', 'die Wurst',
                      'in', 'auf', 'unter',
                      'der Schrank', 'die Schublade', 'der Küchentisch',
                      'der kleine Tisch', 'der Kühlschrank'],
    },

    intro_dialog: 'lukas_bedroom_monologue',
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 2 — "Tantes Anruf — Sachen suchen!" (Stage 1, Bagian 2)
  // FLOW:
  //   1) phone_ring: Tante telpon (auto setelah quest_1 done)
  //   2) find_3_items: cari Socken, Papier, Spielzeug TANPA petunjuk
  //   3) send_message: kuis pilihan ganda (1 benar + 2 salah per item)
  // Materi: Reading + Memory + Lokale Präpositionen (Dativ)
  // ────────────────────────────────────────────────────────────────
  quest_2: {
    id:           'quest_2',
    title:        'Tantes Anruf!',
    subtitle:     'Mencari benda untuk Tante',
    description:  'Tante telpon! Cari kaos kaki, kertas, dan mainan SENDIRI — Tante tidak beri petunjuk lokasi.',
    giver:        'tante_maria',
    zone:         ZONES.HAUS_INTERIOR,
    prerequisites:['quest_1'],

    steps: [
      {
        // Player HARUS jalan ke telepon (reach_trigger), bukan dialog auto-open
        id:          'step1_reach_phone2',
        kind:        'reach_trigger',
        target:      'wired_phone',
        description: 'Geh zum Telefon! Tante ruft an.',
      },
      {
        // Setelah phone reached, Tante dialog auto-open
        id:          'step2_phone_call2',
        kind:        'auto',
        description: 'Hör Tantes Anweisungen am Telefon.',
      },
      {
        // Cari 3 benda (renamed dari step2_find_3_items)
        id:          'step3_find_3_items',
        kind:        'collect_auto',  // proximity-based, NO hints from Tante
        target:      ['socken', 'papier', 'spielzeug'],
        description: 'Such selbst: Socken, Papier, Spielzeug!',
      },
      {
        // SMS panel modal (renamed dari step3_send_message)
        id:          'step4_send_message',
        kind:        'auto',
        description: 'Sag Tante, wo du sie gefunden hast.',
      },
    ],

    reward: {
      score:         500,
      journal_entry: 'wohnzimmer_notiz',
      vocab_unlock:  ['die Socken', 'das Papier', 'das Spielzeug',
                      'das Bett', 'der Tisch', 'der Küchentisch',
                      'auf', 'unter', 'in'],
    },

    // intro_dialog DIHAPUS — supaya startQuest TIDAK auto-open Tante dialog.
    // Tante dialog triggered via step2_phone_call2 (auto) saat phone direach.
  },


  // ════════════════════════════════════════════════════════════════
  // STAGE 2 — Reise (Ortsangaben nennen)
  // Tujuan: Memahami letak tempat (umum & selektif)
  // ════════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────────
  // QUEST 3 — "Leni abholen!" (Stage 2 — Selektif 1)
  // Tante beri arahan tidak jelas → Lukas jemput Leni di sekolah
  // ────────────────────────────────────────────────────────────────
  quest_3: {
    id:           'quest_3',
    title:        'Der Weg zur Schule von Leni',
    subtitle:     'Jemput Leni di Sekolah',
    description:  'Tante menyuruh Lukas menjemput Leni di sekolah. Tante hanya memberikan patokan — dengarkan baik-baik dan ikuti arahnya!',
    giver:        'tante_maria',
    zone:         ZONES.STADT,
    prerequisites:['quest_2'],

    steps: [
      {
        id:          'step1_reach_phone3',
        kind:        'reach_trigger',
        target:      'wired_phone',
        description: 'Geh zum Telefon! Tante ruft an.',
      },
      {
        id:          'step2_get_directions3',
        kind:        'auto',
        description: 'Hör Tantens Wegbeschreibung zu (selektiv)',
      },
      {
        id:          'step3_go_schule',
        kind:        'reach_building',   // gedung Grundschule di kota STADT
        target:      'grundschule',
        description: 'Folge Tantes Weg zum großen gelben Gebäude',
      },
      {
        id:          'step4_meet_leni',
        kind:        'talk_npc',
        target:      'leni',
        description: 'Triff Leni vor der Schule',
      },
      {
        id:          'step5_return_home',
        kind:        'reach_zone',
        target:      ZONES.HAUS,
        description: 'Bring Leni zurück nach Hause',
      },
    ],

    reward: {
      score:         1000,
      journal_entry: 'leni_abholen_notiz',
      vocab_unlock:  ['geradeaus', 'nach rechts', 'an der Ampel',
                      'gegenüber', 'neben', 'die Schule',
                      'das Gebäude', 'abholen'],
    },

    // intro_dialog DIHAPUS — Tante dialog dibuka via step2_phone_call3 (auto)
    // setelah player reach wired_phone (sama pattern dengan Q2).
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 4 — Stage 3 Quest 2: "Ein Brief von Oma"
  // Brief di atas meja makan: Oma minta belanja di EDEKA. Layout kota
  // VARIAN B (Blumenstraße, Wolfgangstraße, Bank, Mall) — beda dari Q1!
  // ────────────────────────────────────────────────────────────────
  quest_4: {
    id:           'quest_4',
    title:        'Ein Brief von Oma',
    subtitle:     'Surat dari Oma',
    description:  'Di atas meja makan ada surat dari Oma: Lukas diminta belanja bahan makan malam di Supermarkt EDEKA. Baca rutenya baik-baik!',
    giver:        'oma_helga',
    zone:         ZONES.STADT,
    prerequisites:['quest_3'],

    steps: [
      {
        id:          'step1_enter_house',
        kind:        'reach_zone',
        target:      ZONES.HAUS_INTERIOR,
        description: 'Geh ins Haus hinein',
      },
      {
        id:          'step2_find_brief',
        kind:        'reach_trigger',
        target:      'brief_oma',
        description: 'Finde den Brief von Oma auf dem Esstisch',
      },
      {
        id:          'step3_read_brief',
        kind:        'auto',
        description: 'Lies Omas Brief genau',
      },
      {
        id:          'step4_go_edeka',
        kind:        'reach_building',
        target:      'edeka',
        description: 'Folge dem Weg aus dem Brief zum EDEKA',
      },
      {
        id:          'step5_shopping',
        kind:        'auto',
        description: 'Kauf ein: Kartoffeln, Fleisch, Salat und Butter',
      },
    ],

    reward: {
      score:         1000,
      journal_entry: 'einkaufen_notiz',
      vocab_unlock:  ['der Brief', 'der Supermarkt', 'die Kreuzung', 'gegenüber',
                      'nach rechts', 'die Kartoffeln', 'das Fleisch', 'der Salat',
                      'die Butter'],
    },

    // intro_dialog TIDAK ADA — quest dimulai dari panel instruksi kiri,
    // dialog kuis dibuka setelah Brief dibaca (step3 auto).
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 5 — "Eis kaufen!" (Stage 2 — Selektif 3)
  // Lukas ingin es krim → tanya orang yang lewat di mana Eisstand
  // ────────────────────────────────────────────────────────────────
  quest_5: {
    id:           'quest_5',
    title:        'Lukas fragt nach dem Weg nach Tantes Haus',
    subtitle:     'Menanyakan Jalan ke Rumah Tante',
    description:  'Lukas ingin mampir ke rumah Tante untuk memberikan sesuatu — tapi ia lupa jalannya! Tanya orang asing di tengah kota. Layout kota VARIAN C (jembatan, taman, perpustakaan tua).',
    giver:        'frau_weber',
    zone:         ZONES.STADT,
    prerequisites:['quest_4'],

    steps: [
      {
        id:          'step1_ask_frau',
        kind:        'talk_npc',
        target:      'frau_weber',
        description: 'Frag die Frau nach dem Weg (E drücken)',
      },
      {
        id:          'step2_go_tantes_haus',
        kind:        'reach_building',
        target:      'tantes_haus',
        description: 'Folge dem Weg: Kreuzung → rechts → Brücke → Park → Bibliothek',
      },
    ],

    reward: {
      score:         1000,
      journal_entry: 'tantes_haus_notiz',
      vocab_unlock:  ['die Brücke', 'der Park', 'die Bibliothek', 'die Kreuzung',
                      'geradeaus', 'nach rechts', 'hindurch', 'daneben'],
    },

    // intro_dialog TIDAK ADA — dialog dibuka saat player bicara dengan
    // Frau Weber (talk_npc step1), bukan otomatis.
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 6 — "Wo bin ich?" (Stage 2 — Umum 1)
  // Lukas tersesat → tanya jalan pulang ke rumah Oma
  // ────────────────────────────────────────────────────────────────
  quest_6: {
    id:           'quest_6',
    title:        'Wo bin ich?',
    subtitle:     'Di Mana Aku Sekarang?',
    description:  'Lukas sudah bepergian terlalu jauh dan tersesat! Tanya orang di sekitar untuk menemukan jalan pulang ke rumah Oma.',
    giver:        'passant_3',
    zone:         ZONES.STADT,
    prerequisites:['quest_5'],

    steps: [
      {
        id:          'step1_ask_way_home',
        kind:        'talk_npc',
        target:      'passant_3',
        description: 'Frag nach dem Weg zu Omas Haus (allgemeines Verständnis)',
      },
      {
        id:          'step2_return_home',
        kind:        'reach_zone',
        target:      ZONES.HAUS,
        description: 'Finde den Weg zurück zu Omas Haus (an der Brücke vorbei)',
      },
    ],

    reward: {
      score:         400,
      journal_entry: 'verloren_notiz',
      vocab_unlock:  ['sich verirren', 'in der Nähe von', 'die Brücke',
                      'das Wahrzeichen', 'überqueren', 'Entschuldigung, wissen Sie...'],
    },

    intro_dialog: 'passant3_quest6_intro',
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 7 — "Ins Kino!" (Stage 2 — Umum 2)
  // Setelah makan malam, Lukas nyasar ke Stadtpark saat mau ke bioskop
  // ────────────────────────────────────────────────────────────────
  quest_7: {
    id:           'quest_7',
    title:        'Ins Kino!',
    subtitle:     'Ke Bioskop!',
    description:  'Setelah makan malam, Lukas ingin nonton bioskop. Tapi dia nyasar ke Stadtpark! Cepat tanya orang asing sebelum filmnya mulai!',
    giver:        'passant_4',
    zone:         ZONES.STADT,
    prerequisites:['quest_6'],

    steps: [
      {
        id:          'step1_arrive_stadtpark',
        kind:        'reach_building',   // taman kota di STADT
        target:      'stadtpark',
        description: 'Du bist im Stadtpark gelandet...',
      },
      {
        id:          'step2_ask_kino',
        kind:        'talk_npc',
        target:      'passant_4',
        description: 'Frag den Fremden nach dem Kino (allgemeines Verständnis)',
      },
      {
        id:          'step3_find_kino',
        kind:        'reach_building',   // gedung Kino di STADT
        target:      'kino',
        description: 'Beeil dich! Geh schnell zum Kino!',
      },
    ],

    reward: {
      score:         450,
      journal_entry: 'kino_notiz',
      vocab_unlock:  ['das Kino', 'schnell', 'sich beeilen', 'der Stadtpark',
                      'die Allee', 'die Hauptstraße', 'die bunten Lichter'],
    },

    intro_dialog: 'passant4_quest7_intro',
  },


  // ════════════════════════════════════════════════════════════════
  // QUEST 8-10 — Penutup (Abschluss)
  // ════════════════════════════════════════════════════════════════

  quest_8: {
    id: 'quest_8',
    title: 'Restaurant Deichstraße',
    subtitle: 'Makan Malam di Deichstraße',
    description: 'Keluarga makan malam di restoran Hamburg klasik. Pesan Fischbrötchen dan baca menu Jerman.',
    giver: 'opa_klaus',
    zone: ZONES.RESTAURANT,
    prerequisites: ['quest_7'],
    steps: [
      { id: 's1', kind: 'talk_npc',   target: 'opa_klaus',      description: 'Folge Opa zum Restaurant' },
      { id: 's2', kind: 'reach_zone', target: ZONES.RESTAURANT, description: 'Geh zum Restaurant' },
    ],
    reward: { score: 400, vocab_unlock: ['das Restaurant', 'bestellen', 'die Speisekarte', 'lecker'] },
    intro_dialog: 'opa_quest8_intro',
  },

  quest_9: {
    id: 'quest_9',
    title: 'Spaziergang an der Elbe',
    subtitle: 'Berjalan di Tepi Elbe',
    description: 'Felix dan Leni mengajak jalan-jalan menjelang malam di tepi sungai Elbe.',
    giver: 'felix',
    zone: ZONES.ELBE,
    prerequisites: ['quest_8'],
    steps: [
      { id: 's1', kind: 'talk_npc',   target: 'felix',    description: 'Sprich mit Felix' },
      { id: 's2', kind: 'reach_zone', target: ZONES.ELBE, description: 'Geh zur Elbe' },
    ],
    reward: { score: 350, vocab_unlock: ['der Fluss', 'der Spaziergang', 'der Sonnenuntergang', 'die Zukunft'] },
    intro_dialog: 'felix_quest9_intro',
  },

  quest_10: {
    id: 'quest_10',
    title: 'Abschiedsabend',
    subtitle: 'Malam Perpisahan',
    description: 'Malam terakhir di Hamburg. Semua keluarga berkumpul di rumah untuk makan malam perpisahan.',
    giver: 'oma_helga',
    zone: ZONES.HAUS_NIGHT,
    prerequisites: ['quest_9'],
    steps: [
      { id: 's1', kind: 'talk_npc',   target: 'oma_helga',      description: 'Komm zum Abendessen' },
      { id: 's2', kind: 'reach_zone', target: ZONES.HAUS_NIGHT, description: 'Geh nach Hause (Nacht)' },
    ],
    reward: { score: 500, vocab_unlock: ['der Abschied', 'die Familie', 'die Erinnerung', 'danke'] },
    intro_dialog: 'oma_quest10_intro',
  },
};


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getQuest(id) {
  return QUESTS[id] || null;
}

export function getAllQuests() {
  return Object.values(QUESTS);
}

export function getQuestsByGiver(npcId) {
  return Object.values(QUESTS).filter(q => q.giver === npcId);
}

/** Cek apakah quest siap dimulai (semua prereq selesai). */
export function isQuestUnlocked(questId, completedQuests) {
  const q = QUESTS[questId];
  if (!q) return false;
  return q.prerequisites.every(req => completedQuests.includes(req));
}
