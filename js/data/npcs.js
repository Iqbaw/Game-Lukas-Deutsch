// ═══════════════════════════════════════════════════════════════════
// js/data/npcs.js — DATA SEMUA NPC
// 
// Setiap entry mendefinisikan:
//   - id           : unique identifier
//   - name         : nama tampilan (di label & dialog)
//   - title        : peran/profesi (subtitle di label)
//   - zone         : ID zona awal (lihat config.js ZONES)
//   - spawn        : { x, z, facing } posisi spawn dunia
//   - body         : config visual (warna baju, rambut, dll)
//   - greeting     : kalimat sapaan singkat (saat ditekan E pertama kali)
//   - hasQuest     : ada tanda "!" di label kalau true
//   - questId      : reference ke quest.js (Step 9+)
// ═══════════════════════════════════════════════════════════════════

import { ZONES } from '../config.js';
import { QUESTS, timeOfDay } from './quests.js';

// ── Kapan NPC terlihat (cerita harus logis) ────────────────────────
// ctx = { qs: status quest, active: quest aktif, stepIndex: langkah aktif }
const isActive = (...ids) => (ctx) => ids.includes(ctx.active);
const isDone   = (id) => (ctx) => ctx.qs[id] === 'completed';
/** Quest `id` aktif dan sudah sampai langkah `stepId` (atau sudah selesai). */
const fromStep = (id, stepId) => (ctx) => {
  if (ctx.qs[id] === 'completed') return true;
  if (ctx.active !== id) return false;
  const idx = (QUESTS[id]?.steps || []).findIndex(s => s.id === stepId);
  return idx >= 0 && ctx.stepIndex >= idx;
};
const any = (...fns) => (ctx) => fns.some(f => f(ctx));


// ── Palet warna khusus NPC (di luar warna utama Lukas) ─────────────
const NPC_COLORS = {
  // Skin
  SKIN_FAIR:      0xfdd5b1,
  SKIN_LIGHT:     0xf5c5a0,
  SKIN_OLIVE:     0xd9a576,

  // Rambut
  HAIR_WHITE:     0xeeeeee,
  HAIR_GREY:      0xb8b8b8,
  HAIR_BLOND:     0xf5d76e,
  HAIR_BROWN:     0x6b4423,
  HAIR_BLACK:     0x1a1a1a,

  // Pakaian
  WOOL_GREEN:     0x4a6b3a,    // Oma Helga - baju wol hijau tua
  APRON_RED:      0xa83a3a,    // Celemek dapur Oma
  FLANEL_BLUE:    0x4a6f9a,    // Kemeja flanel Opa
  SAILOR_HAT:     0x2d4a6b,    // Topi pelaut biru tua
  HOODIE_RED:     0xc83a3a,    // Hoodie Felix
  YELLOW_BRIGHT:  0xffd84d,    // Baju kuning cerah Leni
  BACKPACK_RED:   0xb83838,    // Tas sekolah Leni
  BLAZER_GREY:    0x6c6c70,    // Blazer Tante Maria
  SHIRT_BLUE:     0x5b9bd5,    // Kemeja Onkel Andre
  SHIRT_GREY:     0xc8c8c8,    // Kemeja abu-abu Onkel Andre

  // Aksen
  GLASSES:        0x1a1a1a,
  PIPE_BROWN:     0x4a3024,

  PANTS_KHAKI:    0xd4c4a0,
  PANTS_GREY:     0x4a4a4a,
  PANTS_DENIM:    0x3a5a7a,
  SKIRT_BROWN:    0x6b4830,

  SHOES_DARK:     0x2a2a2a,
  SHOES_WHITE:    0xf0f0f0,
  SHOES_RED:      0xa83a3a,
};


// ═══════════════════════════════════════════════════════════════════
// SEMUA NPC
// ═══════════════════════════════════════════════════════════════════

export const NPC_DATA = [

  // ── 1. OMA HELGA — Nenek (Quest 1 & 2 giver) ──────────────────
  {
    id:        'oma_helga',
    name:      'Oma Helga',
    title:     'Großmutter',
    zone:      ZONES.HAUS,
    spawn:     { x: 2, z: 3, facing: Math.PI },   // depan pintu rumah
    // Q1–Q4: "Oma ist nicht zu Hause" (telepon, surat). Ia kembali saat
    // Lukas pulang membawa belanjaan (Quest 4, langkah 8).
    when:      fromStep('quest_4', 'step8_go_home'),
    // Malam perpisahan: Oma duduk di meja kebun
    spawnWhen: [{ when: any(isActive('quest_10'), isDone('quest_10')), spawn: { x: 4.2, z: 4.6, facing: 0 } }],
    activity:  'gardening',
    greeting:  'Lukas! Mein Schatz, du bist endlich da!',
    hasQuest:  true,
    questId:   'quest_1',

    body: {
      height:      0.92,           // sedikit pendek (lansia, agak bungkuk)
      bodyColor:   NPC_COLORS.WOOL_GREEN,
      apronColor:  NPC_COLORS.APRON_RED,    // celemek dapur
      hasApron:    true,
      hairColor:   NPC_COLORS.HAIR_WHITE,
      hairStyle:   'bun',          // sanggul/kepang dibulatkan
      skinColor:   NPC_COLORS.SKIN_FAIR,
      pantsColor:  NPC_COLORS.SKIRT_BROWN,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  true,
      slouch:      0.1,            // lean ke depan sedikit (lansia)
    },
  },


  // ── 2. OPA KLAUS — Kakek (Quest 3 & 5 giver) ──────────────────
  {
    id:        'opa_klaus',
    name:      'Opa Klaus',
    title:     'Großvater',
    zone:      ZONES.HAUS,
    spawn:     { x: 7.5, z: -5, facing: -Math.PI / 2 }, // di luar, sebelah kanan kincir angin
    // Malam perpisahan: Opa duduk bersama keluarga di meja taman
    spawnWhen: [{ when: any(isActive('quest_10'), isDone('quest_10')), spawn: { x: 5.4, z: 6.7, facing: -Math.PI * 0.75 } }],
    activity:  'repairing_windmill',
    greeting:  'Ah, mein Junge! Komm, schau mal mein altes Boot.',
    hasQuest:  false,                // belum aktif sampai Quest 3 unlocked
    questId:   null,

    body: {
      height:      0.98,
      bodyColor:   NPC_COLORS.FLANEL_BLUE,
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_WHITE,
      hairStyle:   'short',
      skinColor:   NPC_COLORS.SKIN_LIGHT,
      pantsColor:  NPC_COLORS.PANTS_GREY,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  false,
      hasMustache: true,             // kumis tebal putih
      hasSailorHat:true,
      hatColor:    NPC_COLORS.SAILOR_HAT,
      slouch:      0.05,
    },
  },


  // ── 3. ONKEL ANDRE — Paman Lukas, ayah Leni ───────────────────
  // Spawn-nya di rumah kakek-nenek (kunjungan), tidak ada quest.
  {
    id:        'onkel_andre',
    name:      'Onkel Andre',
    title:     'Onkel',
    zone:      ZONES.HAUS,
    spawn:     { x: 6.35, z: 5.35, facing: 0 }, // duduk di area kanan dekat pohon
    when:      any(isActive('quest_10'), isDone('quest_10')),   // datang untuk malam perpisahan
    activity:  'sitting',
    greeting:  'Hallo Lukas! Wie war dein Flug?',
    hasQuest:  false,
    questId:   null,

    body: {
      height:      1.0,
      bodyColor:   NPC_COLORS.SHIRT_GREY,
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BROWN,
      hairStyle:   'short',
      skinColor:   NPC_COLORS.SKIN_LIGHT,
      pantsColor:  NPC_COLORS.SHOES_WHITE,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  false,
    },
  },


  // ── 4. TANTE MARIA — Tante Lukas, ibu Leni ────────────────────
  {
    id:        'tante_maria',
    name:      'Tante Maria',
    title:     'Tante',
    zone:      ZONES.HAUS,
    spawn:     { x: 7.25, z: 5.35, facing: 0 }, // duduk di area kanan dekat pohon
    // Tante bekerja / tinggal di kota; di rumah Oma hanya saat malam perpisahan
    when:      any(isActive('quest_10'), isDone('quest_10')),
    activity:  'sitting',
    greeting:  'Lukas! Du bist so groß geworden!',
    hasQuest:  false,
    questId:   null,

    body: {
      height:      0.98,
      bodyColor:   NPC_COLORS.BLAZER_GREY,
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BLOND,
      hairStyle:   'long',
      skinColor:   NPC_COLORS.SKIN_FAIR,
      pantsColor:  NPC_COLORS.SKIRT_BROWN,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  true,
    },
  },


  // ── 4.5. NACHBAR HANS — Tetangga yang memberi info EDEKA ──────────
  {
    id:        'nachbar_hans',
    name:      'Nachbar Hans',
    title:     'Nachbar',
    zone:      ZONES.HAUS,
    spawn:     { x: -5, z: 8, facing: Math.PI / 2 }, // Di luar, sebelah kiri jalan
    level:     1,
    activity:  'idle',
    greeting:  'Der EDEKA ist in der Stadt — an der Ampel rechts!',
    hasQuest:  false,
    questId:   null,

    body: {
      height:      1.0,
      bodyColor:   0x7a8aa0,
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_GREY,
      hairStyle:   'short',
      skinColor:   NPC_COLORS.SKIN_LIGHT,
      pantsColor:  NPC_COLORS.PANTS_GREY,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  false,
    },
  },


  // ─── NPC di bawah ini DI-DEFINE tapi NOT spawned awal ─────────
  // Mereka di-spawn saat zona/quest mereka aktif (Step 16+).
  // Default zone-nya bukan HAUS, jadi npc.js skip saat awal.

  // ── 5. LENI — Sepupu kecil ────────────────────────────────────
  {
    id:        'leni',
    name:      'Leni',
    title:     'Cousine',
    zone:      ZONES.STADT,            // di depan pintu Grundschule kuning (kota, Quest 3)
    spawn:     { x: -10.4, z: -4.6, facing: 0 }, // di samping pintu, menghadap jalan (selatan)
    hideAfterQuest: 'quest_3',         // setelah Q3 selesai, Leni tidak spawn lagi di kota
    when:      isActive('quest_3'),
    greeting:  'Lukas! Du bist gekommen! Endlich!',
    hasQuest:  true,
    questId:   'quest_3',

    body: {
      height:      0.7,                 // anak kecil
      bodyColor:   NPC_COLORS.YELLOW_BRIGHT,
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BLOND,
      hairStyle:   'twintails',         // kuncir dua
      skinColor:   NPC_COLORS.SKIN_FAIR,
      pantsColor:  NPC_COLORS.PANTS_DENIM,
      shoesColor:  NPC_COLORS.SHOES_RED,
      hasBackpack: true,
      backpackColor: NPC_COLORS.BACKPACK_RED,
    },
  },

  // ── 6. FELIX — Teman SD ───────────────────────────────────────
  {
    id:        'felix',
    name:      'Felix',
    title:     'Alter Freund',
    zone:      ZONES.STADT,
    spawn:     { x: 22, z: 28.6, facing: Math.PI },   // promenade Elbe, seberang Deichstraße
    when:      isActive('quest_9'),
    greeting:  'Alter! Lukas! Bist du das wirklich?',
    hasQuest:  true,
    questId:   'quest_9',

    body: {
      height:      1.0,
      bodyColor:   NPC_COLORS.HOODIE_RED,
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BROWN,
      hairStyle:   'messy',
      skinColor:   NPC_COLORS.SKIN_LIGHT,
      pantsColor:  NPC_COLORS.PANTS_DENIM,
      shoesColor:  NPC_COLORS.SHOES_WHITE,
      hasHeadphones: true,
    },
  },

  // ════════════════════════════════════════════════════════════════
  // STAGE 2 — PASSANTEN (Orang yang ditanya arah)
  // Muncul di zona-zona luar untuk quest navigasi
  // ════════════════════════════════════════════════════════════════

  // ── FRAU WEBER — Orang asing yang ditanya arah (Stage 3 Quest 3) ──
  // Lukas tersesat di tengah kota dan bertanya jalan ke rumah Tante.
  {
    id:        'frau_weber',
    name:      'Frau Weber',
    title:     'Passantin',
    zone:      ZONES.STADT,
    spawn:     { x: 34, z: 3.8, facing: Math.PI / 2 }, // halte bus di Hauptstraße, menghadap Lukas
    when:      isActive('quest_5'),
    greeting:  'Ja? Kann ich dir helfen?',
    hasQuest:  true,
    questId:   'quest_5',
    hideAfterQuest: 'quest_5',

    body: {
      height:      0.99,
      bodyColor:   0x8a5a8a,           // mantel ungu
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_GREY,
      hairStyle:   'bun',
      skinColor:   NPC_COLORS.SKIN_LIGHT,
      pantsColor:  NPC_COLORS.PANTS_GREY,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  true,
    },
  },

  // ── 8. PASSANT 1 — Tanya arah ke Supermarkt (Quest 4) ─────────
  {
    id:        'passant_1',
    name:      'Herr Bauer',
    title:     'Passant',
    zone:      ZONES.STADT,            // Schillerstraße, dekat Alte Brücke (pintu masuk kota)
    spawn:     { x: -20.2, z: 25, facing: -Math.PI / 2 },
    when:      isActive('quest_4'),          // membantu kalau rute surat Oma terlupa
    level:     4,                       // muncul saat quest_4 aktif
    greeting:  'Guten Tag! Kann ich Ihnen helfen?',
    hasQuest:  true,
    questId:   'quest_4',

    body: {
      height:      1.0,
      bodyColor:   0x3a5a3a,           // jaket hijau tua
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BROWN,
      hairStyle:   'short',
      skinColor:   NPC_COLORS.SKIN_LIGHT,
      pantsColor:  NPC_COLORS.PANTS_GREY,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  true,
    },
  },

  // ── 9. PASSANT 2 — Tanya lokasi Eisstand (Quest 5) ────────────
  {
    id:        'passant_2',
    name:      'Frau Schmidt',
    title:     'Passantin',
    zone:      ZONES.STADT,            // Lindenstraße, depan Restaurant (arah ke Eisstand)
    spawn:     { x: 30, z: 19.2, facing: -Math.PI / 2 },
    when:      (ctx) => timeOfDay(ctx.qs) === 'day',   // pejalan kaki siang hari
    level:     5,
    greeting:  'Ja bitte? Wie kann ich helfen?',
    hasQuest:  true,
    questId:   'quest_5',

    body: {
      height:      0.97,
      bodyColor:   0x9a4a8a,           // baju ungu
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BLOND,
      hairStyle:   'long',
      skinColor:   NPC_COLORS.SKIN_FAIR,
      pantsColor:  NPC_COLORS.PANTS_DENIM,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  false,
    },
  },

  // ── 10. PASSANT 3 — Tanya jalan pulang (Quest 6) ──────────────
  {
    id:        'passant_3',
    name:      'Herr Fischer',
    title:     'Passant',
    zone:      ZONES.STADT,            // taman di depan Tantes Haus (Quest 6 mulai di sana)
    spawn:     { x: 18, z: -27.4, facing: Math.PI / 2 },
    when:      isActive('quest_6'),
    level:     6,
    greeting:  'Hallo! Sie sehen verloren aus...',
    hasQuest:  true,
    questId:   'quest_6',

    body: {
      height:      1.02,
      bodyColor:   0x5a3a2a,           // jaket coklat
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_GREY,
      hairStyle:   'short',
      skinColor:   NPC_COLORS.SKIN_OLIVE,
      pantsColor:  NPC_COLORS.PANTS_KHAKI,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  false,
      hasMustache: true,
    },
  },

  // ── 11. PASSANT 4 — Tanya jalan ke Kino (Quest 7) ─────────────
  {
    id:        'passant_4',
    name:      'Frau Müller',
    title:     'Passantin',
    zone:      ZONES.STADT,            // Stadtpark, di ujung selatan Allee (Quest 7)
    spawn:     { x: 5.8, z: 24, facing: -Math.PI / 2 },
    when:      isActive('quest_7'),
    level:     7,
    greeting:  'Hallo! Ich kenne diesen Park sehr gut.',
    hasQuest:  true,
    questId:   'quest_7',

    body: {
      height:      0.96,
      bodyColor:   0x4a5a8a,           // baju biru dongker
      hasApron:    false,
      hairColor:   NPC_COLORS.HAIR_BLACK,
      hairStyle:   'short',
      skinColor:   NPC_COLORS.SKIN_FAIR,
      pantsColor:  NPC_COLORS.PANTS_GREY,
      shoesColor:  NPC_COLORS.SHOES_DARK,
      hasGlasses:  true,
    },
  },

  // ════════════════════════════════════════════════════════════════
  // NPC TAMBAHAN — alur Quest 4, 5, 9, 10
  // ════════════════════════════════════════════════════════════════

  // Kasir EDEKA (Quest 4: bezahlen)
  {
    id:        'kassiererin',
    name:      'Kassiererin',
    title:     'EDEKA',
    zone:      ZONES.SUPERMARKET_INTERIOR,
    spawn:     { x: 4.6, z: 6.25, facing: Math.PI },   // di belakang kasir, menghadap toko
    activity:  'sitting',
    greeting:  'Guten Tag!',
    body: {
      height: 0.98, bodyColor: 0x1d4fb8, hasApron: true, apronColor: 0xffd400,
      hairColor: NPC_COLORS.HAIR_BROWN, hairStyle: 'bun', skinColor: NPC_COLORS.SKIN_OLIVE,
      pantsColor: NPC_COLORS.PANTS_GREY, shoesColor: NPC_COLORS.SHOES_DARK, hasGlasses: false,
    },
  },

  // Tante Maria di depan rumahnya sendiri di kota (Quest 5–6)
  {
    id:        'tante_maria_stadt',
    name:      'Tante Maria',
    title:     'Tante',
    zone:      ZONES.STADT,
    spawn:     { x: 25.2, z: -28.9, facing: 0 },
    when:      isActive('quest_5', 'quest_6'),
    greeting:  'Lukas!',
    body: {
      height: 0.98, bodyColor: NPC_COLORS.BLAZER_GREY, hasApron: false,
      hairColor: NPC_COLORS.HAIR_BLOND, hairStyle: 'long', skinColor: NPC_COLORS.SKIN_FAIR,
      pantsColor: NPC_COLORS.SKIRT_BROWN, shoesColor: NPC_COLORS.SHOES_DARK, hasGlasses: false,
    },
  },

  // Leni ikut Felix ke Elbe (Quest 9)
  {
    id:        'leni_elbe',
    name:      'Leni',
    title:     'Cousine',
    zone:      ZONES.STADT,
    spawn:     { x: 23.6, z: 28.8, facing: Math.PI },
    when:      isActive('quest_9'),
    greeting:  'Lukas!',
    body: {
      height: 0.7, bodyColor: NPC_COLORS.YELLOW_BRIGHT, hasApron: false,
      hairColor: NPC_COLORS.HAIR_BLOND, hairStyle: 'twintails', skinColor: NPC_COLORS.SKIN_FAIR,
      pantsColor: NPC_COLORS.PANTS_DENIM, shoesColor: NPC_COLORS.SHOES_RED,
      hasBackpack: false,
    },
  },

  // Leni & Opa di meja taman pada malam perpisahan (Quest 10)
  {
    id:        'leni_haus',
    name:      'Leni',
    title:     'Cousine',
    zone:      ZONES.HAUS,
    spawn:     { x: 3.0, z: 6.6, facing: Math.PI * 0.75 },
    when:      any(isActive('quest_10'), isDone('quest_10')),
    greeting:  'Lukas!',
    body: {
      height: 0.7, bodyColor: NPC_COLORS.YELLOW_BRIGHT, hasApron: false,
      hairColor: NPC_COLORS.HAIR_BLOND, hairStyle: 'twintails', skinColor: NPC_COLORS.SKIN_FAIR,
      pantsColor: NPC_COLORS.PANTS_DENIM, shoesColor: NPC_COLORS.SHOES_RED,
    },
  },
];


/** Konteks cerita saat ini (dipakai aturan `when`). */
export function storyContext() {
  const qs = (typeof window !== 'undefined' && window.__questState__) || {};
  const sys = (typeof window !== 'undefined' && window.__QUEST_SYSTEM__) || {};
  return { qs, active: sys.activeQuestId || null, stepIndex: sys.activeStep || 0 };
}

/** Helper: ambil semua NPC yang seharusnya ada di zona ini sekarang. */
export function getNPCsInZone(zoneId) {
  const ctx = storyContext();
  return NPC_DATA
    .filter(npc =>
      npc.zone === zoneId &&
      !(npc.hideAfterQuest && ctx.qs[npc.hideAfterQuest] === 'completed') &&
      (!npc.when || npc.when(ctx)))
    .map(npc => {
      const alt = (npc.spawnWhen || []).find(a => a.when(ctx));
      return alt ? { ...npc, spawn: alt.spawn } : npc;
    });
}

/** Helper: ambil 1 NPC by id. */
export function getNPCById(id) {
  return NPC_DATA.find(npc => npc.id === id) || null;
}

export { NPC_COLORS };
