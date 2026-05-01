// ═══════════════════════════════════════════════════════════════════
// js/config.js — SEMUA konstanta & setting game di satu tempat
// Lukas Adventure — Willkommen in Hamburg!
// ═══════════════════════════════════════════════════════════════════

export const CONFIG = {
  // ── PLAYER ─────────────────────────────────────────────
  PLAYER_SPEED:        5.0,    // unit/detik
  RUN_MULTIPLIER:      1.8,
  PLAYER_TURN_SPEED:   10.0,   // seberapa cepat Lukas berbelok (lerp)
  PLAYER_HEIGHT:       1.8,
  INTERACTION_RADIUS:  2.5,    // jarak max untuk tekan E

  // ── CAMERA (Isometrik) ─────────────────────────────────
  CAMERA_NEAR:         0.1,
  CAMERA_FAR:          200,
  CAMERA_LERP:         0.08,
  CAMERA_LOOK_AT_OFFSET_Y: 1.2,

  // Isometric orthographic camera
  ISO_ZOOM:            7,      // semakin kecil = semakin zoom in
  ISO_ANGLE_Y:         Math.PI / 4,    // 45° rotasi horizontal
  ISO_ANGLE_X:         Math.atan(1 / Math.sqrt(2)), // ~35.26° true isometric
  ISO_CAM_HEIGHT:      20,     // tinggi kamera
  ISO_CAM_FOLLOW_SPEED: 6.0,   // kecepatan kamera mengikuti player

  // ── WORLD (per-zona) ───────────────────────────────────
  ZONE_SIZE:           30,     // ukuran default zona (X × Z)
  GROUND_COLOR:        0x6b6b5a,
  FOG_NEAR:            40,
  FOG_FAR:             80,

  // ── LIGHTING (Hamburg sore keemasan) ───────────────────
  AMBIENT_COLOR:       0xffddaa,
  AMBIENT_INTENSITY:   0.5,
  SUN_COLOR:           0xff9944,
  SUN_INTENSITY:       1.2,
  SUN_POSITION:        { x: -30, y: 35, z: -20 }, // matahari sore dari barat
  HEMI_SKY_COLOR:      0xffd580,
  HEMI_GROUND_COLOR:   0x6b4c2a,
  HEMI_INTENSITY:      0.3,

  // ── POST-PROCESSING ────────────────────────────────────
  BLOOM_THRESHOLD:     0.7,
  BLOOM_STRENGTH:      0.25,
  BLOOM_RADIUS:        0.4,

  // ── PERFORMANCE ────────────────────────────────────────
  MAX_PIXEL_RATIO:     2,
  SHADOW_MAP_SIZE:     2048,
  SHADOW_CAMERA_SIZE:  25,     // area shadow (lebih kecil = presisi lebih tinggi)

  // ── SCORING ────────────────────────────────────────────
  CORRECT_FIRST:       100,
  CORRECT_SECOND:      50,
  CORRECT_THIRD:       20,
  WRONG_ANSWER:        -10,
  HINT_USED:           -20,
  HIDDEN_AREA:         30,
  VOCAB_CLICKED:       15,
  NPC_TALKED:          10,
  SPEED_UNDER_30S:     50,
  SPEED_UNDER_60S:     25,
  SPEED_UNDER_90S:     10,

  // Streak multiplier
  STREAK_3:            1.5,
  STREAK_5:            2.0,
  STREAK_7:            2.5,

  // Bintang threshold
  STAR_3:              0.85,   // 85%+ tanpa hint
  STAR_2:              0.65,   // 65-84%

  // ── STORAGE ────────────────────────────────────────────
  STORAGE_KEY:         'lukas_adventure_save',

  // ── DEBUG ──────────────────────────────────────────────
  DEBUG:               false,  // set true untuk axes helper, stats, dll.
};

// ── EVENT NAMES (CustomEvent — komunikasi antar modul) ─
export const EVENTS = {
  // Loading
  LOADING_PROGRESS:    'loading:progress',
  LOADING_COMPLETE:    'loading:complete',

  // Game lifecycle
  GAME_START:          'game:start',
  GAME_PAUSE:          'game:pause',
  GAME_RESUME:         'game:resume',
  GAME_RESIZE:         'game:resize',

  // Quest
  QUEST_START:         'quest:start',
  QUEST_PROGRESS:      'quest:progress',
  QUEST_COMPLETE:      'quest:complete',

  // Dialog
  DIALOG_OPEN:         'dialog:open',
  DIALOG_CLOSE:        'dialog:close',
  DIALOG_CHOICE:       'dialog:choice',

  // NPC & Interaction
  NPC_INTERACT:        'npc:interact',
  NPC_NEAR:            'npc:near',     // pemain mendekat
  NPC_FAR:             'npc:far',      // pemain menjauh

  // Score
  SCORE_ADD:           'score:add',
  SCORE_STREAK:        'score:streak',

  // Zone
  ZONE_ENTER:          'zone:enter',
  ZONE_LEAVE:          'zone:leave',

  // Item
  ITEM_COLLECT:        'item:collect',
  ITEM_HIGHLIGHT:      'item:highlight',
};

// ── ZONE IDs ──────────────────────────────────────────
export const ZONES = {
  HAUS:        'haus',         // Rumah kakek-nenek
  SUPERMARKT:  'supermarkt',   // EDEKA (Quest 1)
  SCHULE:      'schule',       // Sekolah Leni (Quest 2A)
  STADTPARK:   'stadtpark',    // Taman (Quest 2B)
  HAFEN:       'hafen',        // Pelabuhan (Quest 3, 5)
  WOCHENMARKT: 'wochenmarkt',  // Pasar mingguan (Quest 4)
  BUECHEREI:   'buecherei',    // Perpustakaan (Quest 6)
  APOTHEKE:    'apotheke',     // Apotek (Quest 7)
  RESTAURANT:  'restaurant',   // Restoran Deichstraße (Quest 8)
  ELBE:        'elbe',         // Tepi Sungai Elbe (Quest 9)
  HAUS_NIGHT:  'haus_night',   // Rumah malam hari (Quest 10)
};

// ── PALET WARNA (sinkron dengan style.css) ────────────
export const COLORS = {
  // Sky
  SKY_TOP:       0xffd89b,
  SKY_MID:       0xff9a44,
  SKY_BOT:       0xc85d8a,

  // World
  GROUND:        0x6b6b5a,
  ROAD:          0x4a4a4a,
  WATER:         0x4a8fa8,
  WATER_DEEP:    0x2e6e87,

  // Buildings
  BRICK:         0xb35c44,
  BRICK_DARK:    0x8a4533,
  CREAM:         0xd4a882,
  ROOF:          0x4a3728,
  WINDOW:        0xffeecc,
  WINDOW_GLOW:   0xffcc88,

  // Nature
  LEAF:          0x5a8a3c,
  LEAF_BRIGHT:   0x7ab648,
  TRUNK:         0x6b4c2a,
  GRASS:         0x6e9a4a,

  // UI / Accent
  ACCENT:        0xf4c430,
  ORANGE:        0xff6b35,
  SUCCESS:       0x5dc26b,
  ERROR:         0xe85a5a,

  // Character — Lukas
  SKIN:          0xf5c5a0,
  HOODIE_BLUE:   0x5b9bd5,
  PANTS_KHAKI:   0xd4c4a0,
  HAIR_BLACK:    0x1a1a1a,
  SHOES_WHITE:   0xf0f0f0,
};

// Default export utilities
export default { CONFIG, EVENTS, ZONES, COLORS };
