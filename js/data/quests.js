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

  // ────────────────────────────────────────────────────────────────
  // QUEST 1 — "Oma braucht Hilfe!" (Oma Butuh Bantuan!)
  // ────────────────────────────────────────────────────────────────
  quest_1: {
    id:           'quest_1',
    title:        'Oma braucht Hilfe!',
    subtitle:     'Oma Butuh Bantuan',
    description:  'Oma sedang memasak Eintopf untuk menyambutmu, tapi kehabisan bahan. Pergi ke EDEKA dan beli Kartoffeln, Würstchen, Hähnchen, dan Ketchup.',
    giver:        'oma_helga',
    zone:         ZONES.HAUS,
    prerequisites:[],

    steps: [
      {
        id:           'step1_talk_oma',
        kind:         'talk_npc',
        target:       'oma_helga',
        description:  'Sprich mit Oma Helga',
      },
      {
        id:           'step2_go_edeka',
        kind:         'reach_zone',
        target:       ZONES.SUPERMARKT,
        description:  'Geh zum EDEKA Supermarkt',
      },
      {
        id:           'step3_buy_items',
        kind:         'collect_items',
        target:       ['kartoffeln', 'wuerstchen', 'haehnchen', 'ketchup'],
        description:  'Kaufe alle Zutaten',
      },
      {
        id:           'step4_return_oma',
        kind:         'talk_npc',
        target:       'oma_helga',
        description:  'Bring die Zutaten zu Oma Helga',
      },
    ],

    reward: {
      score:         500,
      journal_entry: 'oma_first_meeting',
      vocab_unlock:  ['Supermarkt', 'Eingang', 'Ausgang', 'Regal', 'Kasse',
                      'Bäckerei', 'Post', 'Kartoffel', 'Würstchen', 'Hähnchen', 'Ketchup'],
    },

    intro_dialog: 'oma_quest1_intro',
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 2 — "Leni abholen!" (Jemput Leni)
  // ────────────────────────────────────────────────────────────────
  quest_2: {
    id:           'quest_2',
    title:        'Leni abholen!',
    subtitle:     'Jemput Leni di Sekolah',
    description:  'Oma kelelahan setelah quest sebelumnya. Jemput Leni di Grundschule, lalu mampir ke taman tempat Felix menunggu.',
    giver:        'oma_helga',
    zone:         ZONES.SCHULE,
    prerequisites:['quest_1'],

    steps: [
      {
        id:           'step1_talk_oma_q2',
        kind:         'talk_npc',
        target:       'oma_helga',
        description:  'Frag Oma nach den Anweisungen',
      },
      {
        id:           'step2_go_schule',
        kind:         'reach_zone',
        target:       ZONES.SCHULE,
        description:  'Geh zur Grundschule',
      },
      {
        id:           'step3_meet_leni',
        kind:         'talk_npc',
        target:       'leni',
        description:  'Triff Leni vor der Schule',
      },
      {
        id:           'step4_go_park',
        kind:         'reach_zone',
        target:       ZONES.STADTPARK,
        description:  'Geh mit Leni in den Stadtpark',
      },
      {
        id:           'step5_meet_felix',
        kind:         'talk_npc',
        target:       'felix',
        description:  'Triff Felix im Park',
      },
    ],

    reward: {
      score:         400,
      journal_entry: 'leni_felix_meeting',
      vocab_unlock:  ['Schule', 'abholen', 'Park', 'Freund', 'Cousine'],
    },

    intro_dialog: 'oma_quest2_intro',
  },


  // ────────────────────────────────────────────────────────────────
  // QUEST 3-10 — STUB (struktur lengkap, dialog detail nyusul)
  // ────────────────────────────────────────────────────────────────

  quest_3: {
    id: 'quest_3',
    title: 'Felix zeigt den Hafen!',
    subtitle: 'Felix Tunjukkan Pelabuhan',
    description: 'Felix excited mengajak tour pelabuhan Hamburg. Cari Opa Klaus dan dengar cerita pelaut tua.',
    giver: 'felix',
    zone: ZONES.HAFEN,
    prerequisites: ['quest_2'],
    steps: [
      { id: 's1', kind: 'talk_npc',    target: 'felix',     description: 'Sprich mit Felix' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.HAFEN, description: 'Geh zum Hafen' },
      { id: 's3', kind: 'talk_npc',    target: 'opa_klaus', description: 'Triff Opa am Hafen' },
    ],
    reward: { score: 350, vocab_unlock: ['Hafen', 'Schiff', 'Meer', 'Fischer'] },
    intro_dialog: 'felix_quest3_intro',
  },

  quest_4: {
    id: 'quest_4',
    title: 'Wochenmarkt mit Leni',
    subtitle: 'Pasar Mingguan Bersama Leni',
    description: 'Bantu Tante Maria belanja di Wochenmarkt — susun kalimat permintaan yang benar.',
    giver: 'tante_maria',
    zone: ZONES.WOCHENMARKT,
    prerequisites: ['quest_3'],
    steps: [
      { id: 's1', kind: 'talk_npc',    target: 'tante_maria',       description: 'Sprich mit Tante Maria' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.WOCHENMARKT,   description: 'Geh zum Wochenmarkt' },
      { id: 's3', kind: 'collect_items', target: ['apfel', 'kaese', 'wurst'], description: 'Kaufe alle Lebensmittel' },
    ],
    reward: { score: 350, vocab_unlock: ['Markt', 'Apfel', 'Käse', 'Wurst', 'kaufen'] },
    intro_dialog: 'tante_quest4_intro',
  },

  quest_5: {
    id: 'quest_5',
    title: 'Opas alte Geschichte',
    subtitle: 'Cerita Lama Opa',
    description: 'Opa ingin bercerita tentang Hamburg dulu di pelabuhan. Dengar cerita dan jawab pertanyaan.',
    giver: 'opa_klaus',
    zone: ZONES.HAFEN,
    prerequisites: ['quest_3'],
    steps: [
      { id: 's1', kind: 'talk_npc', target: 'opa_klaus', description: 'Hör Opa Klaus zu' },
    ],
    reward: { score: 200, vocab_unlock: ['früher', 'Geschichte', 'erzählen'] },
    intro_dialog: 'opa_quest5_intro',
  },

  quest_6: {
    id: 'quest_6',
    title: 'In der Bücherei',
    subtitle: 'Di Perpustakaan',
    description: 'Leni butuh bantuan mencari buku di perpustakaan. Pelajari kosakata buku dan tulis di Reisetagebuch.',
    giver: 'leni',
    zone: ZONES.BUECHEREI,
    prerequisites: ['quest_4'],
    steps: [
      { id: 's1', kind: 'talk_npc',    target: 'leni',          description: 'Frag Leni' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.BUECHEREI, description: 'Geh zur Bücherei' },
    ],
    reward: { score: 300, vocab_unlock: ['Buch', 'lesen', 'Bücherei', 'leise'] },
    intro_dialog: 'leni_quest6_intro',
  },

  quest_7: {
    id: 'quest_7',
    title: 'Apotheke für Oma',
    subtitle: 'Apotek untuk Oma',
    description: 'Oma sakit kepala. Pergi ke apotek dan jelaskan gejalanya kepada Apotheker Hans.',
    giver: 'oma_helga',
    zone: ZONES.APOTHEKE,
    prerequisites: ['quest_5'],
    steps: [
      { id: 's1', kind: 'talk_npc',    target: 'oma_helga',     description: 'Hör was Oma braucht' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.APOTHEKE,  description: 'Geh zur Apotheke' },
    ],
    reward: { score: 350, vocab_unlock: ['Apotheke', 'Kopfschmerzen', 'Medizin', 'helfen'] },
    intro_dialog: 'oma_quest7_intro',
  },

  quest_8: {
    id: 'quest_8',
    title: 'Restaurant Deichstraße',
    subtitle: 'Makan Malam di Deichstraße',
    description: 'Keluarga makan malam di restoran Hamburg klasik. Pesan Fischbrötchen dan baca menu Jerman.',
    giver: 'opa_klaus',
    zone: ZONES.RESTAURANT,
    prerequisites: ['quest_6', 'quest_7'],
    steps: [
      { id: 's1', kind: 'talk_npc',    target: 'opa_klaus',      description: 'Folge Opa zum Restaurant' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.RESTAURANT, description: 'Geh zum Restaurant' },
    ],
    reward: { score: 400, vocab_unlock: ['Restaurant', 'bestellen', 'Speisekarte', 'lecker'] },
    intro_dialog: 'opa_quest8_intro',
  },

  quest_9: {
    id: 'quest_9',
    title: 'Spaziergang an der Elbe',
    subtitle: 'Berjalan di Tepi Elbe',
    description: 'Felix dan Leni mengajak jalan-jalan menjelang malam di tepi sungai Elbe. Diskusikan masa depan.',
    giver: 'felix',
    zone: ZONES.ELBE,
    prerequisites: ['quest_8'],
    steps: [
      { id: 's1', kind: 'talk_npc',    target: 'felix',     description: 'Sprich mit Felix' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.ELBE,  description: 'Geh zur Elbe' },
    ],
    reward: { score: 350, vocab_unlock: ['Fluss', 'Spaziergang', 'Sonnenuntergang', 'Zukunft'] },
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
      { id: 's1', kind: 'talk_npc',    target: 'oma_helga',     description: 'Komm zum Abendessen' },
      { id: 's2', kind: 'reach_zone',  target: ZONES.HAUS_NIGHT, description: 'Geh nach Hause (Nacht)' },
    ],
    reward: { score: 500, vocab_unlock: ['Abschied', 'Familie', 'Erinnerung', 'danke'] },
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
