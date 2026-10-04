// ═══════════════════════════════════════════════════════════════════
// js/stadt.js — DIE STADT (Stage 2)
//
// Satu peta kota untuk Quest 3–7. Kamera isometrik melihat dari TENGGARA
// (+x, +z), jadi hanya sisi SELATAN dan TIMUR gedung yang terlihat.
// Aturan tata letak:
//   • Gedung di UTARA jalan E-W menghadap selatan (pintu ke jalan, terlihat).
//   • Gedung di BARAT jalan N-S menghadap timur (pintu ke jalan, terlihat).
//   • Di selatan/timur jalan hanya benda rendah (taman, parkir, pohon) atau
//     gedung yang mundur cukup jauh — supaya tidak menutupi pemain di jalan.
//
// Peta (utara = atas, x ke kanan):
//
//        z=-36  Bank*        Sportplatz     Bibliothek  Tantes Haus  Häuser
//               │            ~~~~~~~~~ Kanal ~~~~[Brücke]~~~~~~~~~~~~~~~~~~
//        z=-6   Apotheke*  Schule* Bäckerei Kino │ Hotel  Tourist-Info
//        z= 0  ════════ Ampel ═══ Hauptstraße ═══╪═══════════════════════
//               Kirche   │ EDEKA  P  Allee  Café │  Post   Restaurant
//               Mall*    │                 Eis   │═══ Lindenstraße ════
//               (Eingang)│   Stadtpark    Blumen │
//        z=32  ~~~~~~~~[Alte Brücke → Omas Haus]~~~~~~~ Fluss ~~~~~~~~~~~~
//                    x=-24 (Schillerstr.)       x=18 (Bachstr.)
//
//   * Varian B menukar Apotheke↔Bank dan Schule↔Mall (lihat VARIANTS),
//     sehingga setiap gedung tetap ada TEPAT SATU KALI di setiap varian.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { Game }   from './main.js';
import { World }  from './world.js';
import { CONFIG } from './config.js';

// ── Konstanta jaringan jalan ──────────────────────────────────────
const RW = 6;          // lebar jalan
const SW = 1.6;        // lebar trotoar
const MAIN_Z  = 0;     // Hauptstraße (E-W)
const WEST_X  = -24;   // Schillerstraße / Blumenstraße (N-S)
const EAST_X  = 18;    // Bachstraße (N-S)
const LIND_Z  = 23;    // Lindenstraße (E-W, mulai dari Bachstraße ke timur)
const CANAL_Z = -20;   // kanal utara (air z -21.8..-18.2)
const RIVER_Z = 32.2;  // sungai selatan (air z 30.4..34.0)
const CANAL_HW = 1.8, RIVER_HW = 1.8;

// Nama jalan & gedung yang bertukar per varian quest (lihat quest.js)
const VARIANTS = {
  A: { main: 'Gutenbergstraße', west: 'Schillerstraße', corner: 'apotheke', north2: 'bank',     opposite: 'grundschule', south2: 'mall' },
  B: { main: 'Wolfgangstraße',  west: 'Blumenstraße',   corner: 'bank',     north2: 'apotheke', opposite: 'mall',        south2: 'grundschule' },
  C: { main: 'Hauptstraße',     west: 'Schillerstraße', corner: 'apotheke', north2: 'bank',     opposite: 'grundschule', south2: 'mall' },
};

// ── Material & mesh helpers ───────────────────────────────────────
let _mats = new Map();
function mat(color) {
  let m = _mats.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); _mats.set(color, m); }
  return m;
}
function glow(color, intensity = 0.9) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}
let _glass = null;
function glassMat() {
  if (!_glass) _glass = new THREE.MeshLambertMaterial({ color: 0x9fd0ec, emissive: 0x2a5874, emissiveIntensity: 0.45 });
  return _glass;
}
function shade(c, f) {
  const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f);
  return (r << 16) | (g << 8) | b;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function add(parent, geo, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function flat(w, d, color, x, z, y = 0.02, walk = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), color instanceof THREE.Material ? color : mat(color));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
  Game.worldGroup.add(m);
  if (walk) World.walkables.push(m);
  return m;
}
function blockBox(minX, minZ, maxX, maxZ, name, h = 3) {
  World.colliders.push({ type: 'box', name, box: new THREE.Box3(new THREE.Vector3(minX, 0, minZ), new THREE.Vector3(maxX, h, maxZ)) });
}
function blockPost(x, z, radius = 0.25) {
  World.colliders.push({ type: 'cylinder', x, z, radius });
}

// ── Papan nama: teks auto-fit, material unlit supaya selalu terbaca ──
function signTexture(text, aspect, o = {}) {
  const H = 128;
  const W = Math.max(128, Math.min(1024, Math.round(H * aspect)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = o.bg || '#22324a'; ctx.fillRect(0, 0, W, H);
  if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 7; ctx.strokeRect(6, 6, W - 12, H - 12); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const font = o.font || 'Arial, Helvetica, sans-serif';
  let size = Math.round(H * (o.scale || 0.62));
  do {
    ctx.font = `${o.weight || '800'} ${size}px ${font}`;
    if (ctx.measureText(text).width <= W * 0.86) break;
    size -= 2;
  } while (size > 14);
  ctx.fillStyle = o.fg || '#ffffff';
  ctx.fillText(text, W / 2, H / 2 + size * 0.05);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function signPlane(text, w, h, o) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, w / h, o) }));
}
/** Papan bertebal; teks di sisi +z (dan -z bila o.both). */
function signBoard(text, w, h, o = {}) {
  const g = new THREE.Group();
  add(g, B(w + 0.14, h + 0.14, 0.1), mat(o.frame ?? 0x2b2b2b), 0, 0, 0, false);
  const p = signPlane(text, w, h, o); p.position.z = 0.056; g.add(p);
  if (o.both) { const p2 = signPlane(text, w, h, o); p2.rotation.y = Math.PI; p2.position.z = -0.056; g.add(p2); }
  return g;
}

// ── Atap ──────────────────────────────────────────────────────────
function roofFlat(g, w, d, h, color) {
  add(g, B(w + 0.3, 0.34, d + 0.3), mat(color), 0, h + 0.17, 0);
}
/** Atap pelana, bubungan sejajar fasad depan (sumbu x lokal). */
function roofGable(g, w, d, h, color, wallColor, pitch = Math.min(2.4, d * 0.42)) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, pitch); shape.closePath();
  const attic = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  attic.rotateY(-Math.PI / 2); attic.translate(w / 2, h, 0);
  add(g, attic, mat(wallColor), 0, 0, 0);
  const ov = 0.35, a = Math.atan2(pitch, d / 2);
  const L = (d / 2 + ov) / Math.cos(a);
  const cy = (h + pitch + h - ov * Math.tan(a)) / 2;
  for (const s of [1, -1]) {
    const slab = add(g, B(w + 2 * ov, 0.2, L), mat(color), 0, cy, s * (d / 2 + ov) / 2);
    slab.rotation.x = s * a;
  }
  add(g, B(w + 2 * ov, 0.18, 0.34), mat(shade(color, 0.8)), 0, h + pitch + 0.06, 0);
}
function roofHip(g, w, d, h, color, pitch = 2) {
  const geo = new THREE.ConeGeometry(1, 1, 4); geo.rotateY(Math.PI / 4);
  const r = add(g, geo, mat(color), 0, h + pitch / 2, 0);
  r.scale.set((w + 0.6) / Math.SQRT2, pitch, (d + 0.6) / Math.SQRT2);
}

// ── Fasad ─────────────────────────────────────────────────────────
/** Sub-grup untuk satu sisi gedung: x lokal = sepanjang sisi, +z = keluar. */
function faceGroup(g, side, w, d) {
  const f = new THREE.Group();
  if (side === 'front') f.position.set(0, 0, d / 2);
  if (side === 'back')  { f.position.set(0, 0, -d / 2); f.rotation.y = Math.PI; }
  if (side === 'right') { f.position.set(w / 2, 0, 0);  f.rotation.y = Math.PI / 2; }
  if (side === 'left')  { f.position.set(-w / 2, 0, 0); f.rotation.y = -Math.PI / 2; }
  g.add(f);
  return f;
}
function windowAt(f, x, y, w = 0.9, h = 1.1, frame = 0xf3efe4) {
  add(f, B(w + 0.16, h + 0.16, 0.06), mat(frame), x, y, 0.03, false);
  add(f, B(w, h, 0.07), glassMat(), x, y, 0.05, false);
  add(f, B(w + 0.26, 0.08, 0.18), mat(frame), x, y - h / 2 - 0.1, 0.09, false);
}
function spread(a, b, minGap) {
  const n = Math.max(1, Math.floor((b - a) / minGap));
  return Array.from({ length: n }, (_, i) => a + (b - a) * (i + 0.5) / n);
}
function doorAt(f, kind, color, x = 0) {
  if (kind === 'glass') {
    add(f, B(2.7, 2.65, 0.12), mat(0x3a4048), x, 1.325, 0.06, false);
    for (const s of [-1, 1]) add(f, B(1.1, 2.3, 0.08), glassMat(), x + s * 0.6, 1.2, 0.11, false);
    add(f, B(0.08, 2.3, 0.1), mat(0x3a4048), x, 1.2, 0.13, false);
    for (const s of [-1, 1]) add(f, B(0.05, 0.6, 0.08), mat(0xdddddd), x + s * 0.2, 1.15, 0.18, false);
    add(f, B(3.4, 0.14, 1.3), mat(color), x, 2.8, 0.65);
  } else if (kind === 'arch') {
    add(f, B(1.9, 2.4, 0.14), mat(0x6e6252), x, 1.2, 0.07, false);
    const top = add(f, new THREE.CylinderGeometry(0.95, 0.95, 0.14, 16, 1, false, 0, Math.PI), mat(0x6e6252), x, 2.4, 0.07, false);
    top.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    add(f, B(1.5, 2.3, 0.1), mat(color), x, 1.15, 0.12, false);
    const topIn = add(f, new THREE.CylinderGeometry(0.75, 0.75, 0.1, 16, 1, false, 0, Math.PI), mat(color), x, 2.3, 0.12, false);
    topIn.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    add(f, B(2.4, 0.16, 0.8), mat(0x9a9284), x, 0.08, 0.4, false);
  } else {
    add(f, B(1.55, 2.5, 0.12), mat(0x4a3a2a), x, 1.25, 0.06, false);
    add(f, B(1.25, 2.25, 0.08), mat(color), x, 1.15, 0.11, false);
    add(f, new THREE.SphereGeometry(0.07, 6, 4), mat(0xd8c070), x + 0.42, 1.1, 0.19, false);
    add(f, B(1.9, 0.16, 0.7), mat(0x9a9284), x, 0.08, 0.35, false);
    add(f, B(2.0, 0.1, 0.85), mat(shade(color, 0.85)), x, 2.7, 0.42);
  }
}
function awningAt(f, x, w, y, color, stripe = 0xffffff) {
  const a = new THREE.Group();
  const n = Math.max(3, Math.round(w / 0.5));
  for (let i = 0; i < n; i++) {
    add(a, B(w / n, 0.08, 1.15), mat(i % 2 ? stripe : color), -w / 2 + (i + 0.5) * w / n, 0, 0.55);
  }
  for (let i = 0; i < n; i++) {
    add(a, B(w / n, 0.3, 0.05), mat(i % 2 ? stripe : color), -w / 2 + (i + 0.5) * w / n, -0.2, 1.12, false);
  }
  a.rotation.x = 0.28; a.position.set(x, y, 0);
  f.add(a);
}

/**
 * Gedung generik. Frame lokal: depan = +z, lebar w di sumbu x, dalam d di z.
 * facing 'S' → depan ke selatan (+z dunia); 'E' → depan ke timur (+x dunia).
 */
function building(o) {
  const {
    name, x, z, facing = 'S', w, d, h, wall,
    roof = 'flat', roofColor = shade(wall, 0.72), pitch,
    door = 'single', doorColor = 0x7a4f2c, doorX = 0,
    shopWindows = false, sign = null, signY = 3.2, signW,
    awning = null, upperFrom = 4.75, frame = 0xf3efe4,
  } = o;
  const g = new THREE.Group(); g.name = name;
  add(g, B(w, h, d), mat(wall), 0, h / 2, 0);
  add(g, B(w + 0.18, 0.4, d + 0.18), mat(shade(wall, 0.6)), 0, 0.2, 0);

  if (roof === 'flat') roofFlat(g, w, d, h, roofColor);
  else if (roof === 'gable') roofGable(g, w, d, h, roofColor, wall, pitch);
  else if (roof === 'hip') roofHip(g, w, d, h, roofColor, pitch);

  const front = faceGroup(g, 'front', w, d);
  if (door) doorAt(front, door, doorColor, doorX);
  const doorHalf = door === 'glass' ? 1.5 : 0.95;
  // Erdgeschoss
  const gw = shopWindows ? 1.7 : 0.95, gh = shopWindows ? 1.55 : 1.15, gy = shopWindows ? 1.45 : 1.55;
  if (o.groundWindows !== false) {
    for (const [a, b] of [[-w / 2 + 0.5, doorX - doorHalf - 0.3], [doorX + doorHalf + 0.3, w / 2 - 0.5]]) {
      if (b - a < gw + 0.3) continue;
      for (const xx of spread(a, b, gw + 0.7)) windowAt(front, xx, gy, gw, gh, frame);
    }
  }
  if (awning) {
    for (const [a, b] of [[-w / 2 + 0.4, doorX - doorHalf - 0.15], [doorX + doorHalf + 0.15, w / 2 - 0.4]]) {
      if (b - a > 1.2) awningAt(front, (a + b) / 2, b - a, 2.75, awning.color, awning.stripe);
    }
  }
  // Obergeschosse
  for (let y = upperFrom; y + 0.65 <= h - 0.3; y += 2.35) {
    for (const xx of spread(-w / 2 + 0.4, w / 2 - 0.4, 1.9)) windowAt(front, xx, y, 0.9, 1.1, frame);
  }
  // Seitenfenster (beide Seiten; nur eine ist für die Kamera sichtbar)
  for (const side of ['left', 'right']) {
    const f = faceGroup(g, side, w, d);
    for (let y = 1.55; y + 0.65 <= h - 0.3; y += (y < 2 ? upperFrom - 1.55 : 2.35)) {
      for (const xx of spread(-d / 2 + 0.6, d / 2 - 0.6, 2.2)) windowAt(f, xx, y, 0.85, 1.05, frame);
    }
  }
  if (sign) {
    const sw = signW || Math.min(w - 0.6, Math.max(2.6, sign.text.length * 0.42));
    const s = signBoard(sign.text, sw, sign.h || 0.8, sign);
    s.position.set(0, signY, d / 2 + 0.08);
    g.add(s);
  }
  if (o.extra) o.extra(g, { w, d, h, front });

  g.rotation.y = facing === 'E' ? Math.PI / 2 : 0;
  g.position.set(x, 0, z);
  Game.worldGroup.add(g);
  const fx = facing === 'E' ? d : w, fz = facing === 'E' ? w : d;
  blockBox(x - fx / 2, z - fz / 2, x + fx / 2, z + fz / 2, name, h);
  // Titik "di depan pintu" (dipakai registry quest)
  g.userData.front = facing === 'E' ? { x: x + d / 2, z: z + 0, nx: 1, nz: 0, along: w } : { x: x + 0, z: z + d / 2, nx: 0, nz: 1, along: w };
  return g;
}

// ═══════════════════════════════════════════════════════════════════
// GEDUNG KHUSUS
// ═══════════════════════════════════════════════════════════════════

const MAKERS = {
  apotheke: (x, z, facing) => building({
    name: 'apotheke', x, z, facing, w: 9, d: 7, h: 6.2, wall: 0xf5f3ee, roofColor: 0x2f8a4e,
    door: 'glass', doorColor: 0x2f8a4e, shopWindows: true,
    sign: { text: 'APOTHEKE', bg: '#1d8a46', fg: '#ffffff', h: 0.85 }, signY: 3.5, signW: 5.6,
    extra(g, { w, d }) {
      // Apotheken-A-Kreuz: 3D, menyala hijau, menonjol di sudut — terlihat dari segala arah
      const cross = new THREE.Group();
      add(cross, B(1.3, 0.42, 0.28), glow(0x22cc55, 0.8), 0, 0, 0);
      add(cross, B(0.42, 1.3, 0.28), glow(0x22cc55, 0.8), 0, 0, 0);
      cross.rotation.y = Math.PI / 2;
      cross.position.set(-w / 2 - 0.55, 4.3, d / 2 - 0.5);
      g.add(cross);
      add(g, B(0.6, 0.1, 0.1), mat(0x666666), -w / 2 - 0.25, 4.3, d / 2 - 0.5, false);
    },
  }),

  bank: (x, z, facing) => building({
    name: 'bank', x, z, facing, w: 9, d: 7, h: 6.4, wall: 0xc9d1d9, roofColor: 0x5a6878,
    door: 'single', doorColor: 0x2c3e57, groundWindows: true,
    sign: { text: 'BANK', bg: '#1f3b63', fg: '#f2d27a', h: 0.8 }, signY: 3.65, signW: 3.6,
    extra(g, { d }) {
      // Säulenportikus
      for (const xx of [-2.1, -1.0, 1.0, 2.1]) add(g, new THREE.CylinderGeometry(0.18, 0.2, 2.9, 10), mat(0xeeeeea), xx, 1.45, d / 2 + 0.75);
      add(g, B(4.6, 0.32, 1.3), mat(0xe2e2dc), 0, 3.06, d / 2 + 0.6);
      add(g, B(4.8, 0.18, 1.6), mat(0x9a9a92), 0, 0.09, d / 2 + 0.7, false);
    },
  }),

  grundschule: (x, z, facing) => building({
    name: 'grundschule', x, z, facing, w: 12, d: 8, h: 6.6, wall: 0xf2c94c,
    roof: 'hip', roofColor: 0xb5452f, pitch: 2.2, door: 'glass', doorColor: 0xb5452f,
    sign: { text: 'GRUNDSCHULE', bg: '#c0392b', fg: '#ffffff', h: 0.85 }, signY: 3.55, signW: 6,
    extra(g, { w, d }) {
      // Fahrradständer
      for (let i = 0; i < 4; i++) add(g, new THREE.TorusGeometry(0.28, 0.04, 4, 10, Math.PI), mat(0xb8bcc2), w / 2 - 2.2 + i * 0.45, 0, d / 2 + 0.9, false);
    },
  }),

  mall: (x, z, facing) => building({
    name: 'mall', x, z, facing, w: 11, d: 10, h: 8, wall: 0xd88aa0, roofColor: 0x8e3e58,
    door: 'glass', doorColor: 0x8e3e58, shopWindows: true, upperFrom: 99,
    sign: { text: 'MALL', bg: '#8e2f55', fg: '#ffffff', h: 1.1 }, signY: 7.0, signW: 4.2,
    extra(g, { d }) {
      // Atrium kaca tinggi di atas pintu
      add(g, B(4.6, 3.2, 0.1), glassMat(), 0, 4.6, d / 2 + 0.06, false);
      for (const xx of [-2.35, -0.8, 0.8, 2.35]) add(g, B(0.12, 3.3, 0.14), mat(0x5a2238), xx, 4.6, d / 2 + 0.09, false);
      add(g, B(4.8, 0.14, 0.18), mat(0x5a2238), 0, 3.0, d / 2 + 0.09, false);
    },
  }),

  baeckerei: (x, z, facing) => building({
    name: 'baeckerei', x, z, facing, w: 6, d: 5, h: 4.2, wall: 0xe8b77a, roof: 'gable', roofColor: 0x8a4a2a,
    door: 'single', doorColor: 0x8a5a2a, doorX: 1.6, shopWindows: true,
    awning: { color: 0xc0392b, stripe: 0xfff3e0 },
    sign: { text: 'BÄCKEREI', bg: '#6b3a1a', fg: '#ffe9c2', h: 0.62 }, signY: 3.25, signW: 4.2,   // di bawah tritisan atap
    extra(g, { w, d }) {
      // Brezel an einem Ausleger
      add(g, B(0.08, 0.08, 0.9), mat(0x3a2a1a), w / 2 - 0.2, 3.3, d / 2 + 0.45, false);
      const pretzel = add(g, new THREE.TorusGeometry(0.3, 0.1, 6, 14), mat(0xc4823a), w / 2 - 0.2, 2.95, d / 2 + 0.85, false);
      pretzel.rotation.y = Math.PI / 2;
    },
  }),

  kino: (x, z, facing) => building({
    name: 'kino', x, z, facing, w: 10, d: 7, h: 6.6, wall: 0x7656a8, roofColor: 0x45336e,
    door: 'glass', doorColor: 0x2e2448, groundWindows: false, upperFrom: 99,
    extra(g, { w, d }) {
      // Plakat-Vitrinen links & rechts vom Eingang
      const posters = [0xff5a5a, 0x5ab4ff, 0xffd84a, 0x7ee36a];
      [-3.6, -2.3, 2.3, 3.6].forEach((xx, i) => {
        add(g, B(1.0, 1.5, 0.08), mat(0x222222), xx, 1.5, d / 2 + 0.04, false);
        add(g, B(0.84, 1.32, 0.06), glow(posters[i], 0.55), xx, 1.5, d / 2 + 0.08, false);
      });
      // Markise mit BUNTEN LICHTERN (Marquee)
      add(g, B(7.2, 0.5, 1.6), mat(0x241c38), 0, 3.0, d / 2 + 0.8);
      const bulbs = [0xff3b3b, 0xffd23b, 0x3bff6a, 0x3bc8ff, 0xd23bff];
      for (let i = 0; i < 18; i++) {
        add(g, new THREE.SphereGeometry(0.08, 6, 4), glow(bulbs[i % bulbs.length], 1.6), -3.4 + i * 0.4, 2.72, d / 2 + 1.62, false);
      }
      // Großes Schild "KINO" mit Lichterrahmen
      const s = signBoard('KINO', 5.4, 1.5, { bg: '#1c1430', fg: '#ffe066', border: '#ff4fa3', frame: 0x120c20 });
      s.position.set(0, 4.85, d / 2 + 0.1); g.add(s);
      for (let i = 0; i < 16; i++) {
        const t = i / 16, perim = 2 * (5.7 + 1.8), p = t * perim;
        let bx, by;
        if (p < 5.7) { bx = -2.85 + p; by = 5.75; }
        else if (p < 7.5) { bx = 2.85; by = 5.75 - (p - 5.7); }
        else if (p < 13.2) { bx = 2.85 - (p - 7.5); by = 3.95; }
        else { bx = -2.85; by = 3.95 + (p - 13.2); }
        add(g, new THREE.SphereGeometry(0.09, 6, 4), glow(bulbs[i % bulbs.length], 1.6), bx, by, d / 2 + 0.22, false);
      }
    },
  }),

  hotel: (x, z, facing) => building({
    name: 'hotel', x, z, facing, w: 9, d: 9, h: 9.4, wall: 0xdcb890, roofColor: 0x8a5a3c,
    door: 'glass', doorColor: 0x7a2f2f,
    sign: { text: 'HOTEL', bg: '#7a2f2f', fg: '#ffffff', h: 0.9 }, signY: 8.55, signW: 4,
    extra(g, { d }) {
      for (const s of [-1, 1]) {
        add(g, new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), mat(0x888888), s * 2.1, 3.9, d / 2 + 0.7, false);
        add(g, B(0.04, 0.55, 0.85), mat(s < 0 ? 0xc0392b : 0x2e86c1), s * 2.1, 4.7, d / 2 + 1.12, false);
      }
    },
  }),

  tourismus: (x, z, facing) => building({
    name: 'tourismusbuero', x, z, facing, w: 7, d: 6, h: 4.6, wall: 0x6fb3d2, roofColor: 0x2a6f95,
    door: 'glass', doorColor: 0x2a6f95, shopWindows: true,
    sign: { text: 'TOURIST-INFO', bg: '#1f5f8b', fg: '#ffffff', h: 0.75 }, signY: 3.65, signW: 5,
    extra(g, { w, d }) {
      const i = signBoard('i', 0.75, 0.75, { bg: '#1f9d55', fg: '#ffffff', both: true, scale: 0.8 });
      i.rotation.y = Math.PI / 2; i.position.set(w / 2 - 0.3, 3.2, d / 2 + 0.55); g.add(i);
    },
  }),

  post: (x, z, facing) => building({
    name: 'post', x, z, facing, w: 7, d: 6, h: 4.6, wall: 0xffd23f, roofColor: 0x5a6070,
    door: 'glass', doorColor: 0x3a3a3a, shopWindows: true,
    sign: { text: 'POST', bg: '#ffcc00', fg: '#1a1a1a', border: '#1a1a1a', h: 0.8 }, signY: 3.65, signW: 3.4,
    extra(g, { w, d }) {
      // Briefkasten
      add(g, B(0.55, 0.75, 0.4), mat(0xffcc00), w / 2 - 0.7, 1.05, d / 2 + 0.6);
      add(g, B(0.1, 0.7, 0.1), mat(0x333333), w / 2 - 0.7, 0.35, d / 2 + 0.6, false);
    },
  }),

  cafe: (x, z, facing) => building({
    name: 'cafe', x, z, facing, w: 5.5, d: 4.8, h: 3.8, wall: 0xe0b183, roofColor: 0x9a5530,
    door: 'single', doorColor: 0x6b3a1f, doorX: 1.4, shopWindows: true,
    awning: { color: 0xb03a2e, stripe: 0xfff3e0 },
    sign: { text: 'CAFÉ', bg: '#4a2a14', fg: '#ffffff', h: 0.6 }, signY: 3.38, signW: 2.6,
  }),

  blumenladen: (x, z, facing) => building({
    name: 'blumenladen', x, z, facing, w: 4.6, d: 4.5, h: 3.8, wall: 0x9cc96b, roofColor: 0x4f7a2a,
    door: 'single', doorColor: 0x4f7a2a, doorX: 1.2, shopWindows: false,
    awning: { color: 0xe86a9a, stripe: 0xffffff },
    sign: { text: 'BLUMENLADEN', bg: '#3c6b1e', fg: '#fff6e0', h: 0.6 }, signY: 3.38, signW: 3.9,
    extra(g, { d }) {
      const cols = [0xff4d6d, 0xffb347, 0xff7ad9, 0xfff15c];
      for (let i = 0; i < 4; i++) {
        const xx = -1.7 + i * 0.6;
        add(g, new THREE.CylinderGeometry(0.2, 0.16, 0.35, 8), mat(0x6b4a2a), xx, 0.18, d / 2 + 0.45, false);
        add(g, new THREE.IcosahedronGeometry(0.24, 0), mat(cols[i]), xx, 0.5, d / 2 + 0.45, false);
      }
    },
  }),

  restaurant: (x, z, facing) => building({
    name: 'restaurant', x, z, facing, w: 10, d: 7, h: 5, wall: 0xa85a36, roof: 'gable', roofColor: 0x7a3b22,
    door: 'single', doorColor: 0x4a2a1a, frame: 0xf0e2c8,
    sign: { text: 'RESTAURANT', bg: '#3a1e10', fg: '#f4c430', h: 0.75 }, signY: 3.4, signW: 5,
    extra(g, { d }) {
      for (const s of [-1, 1]) {
        add(g, B(0.08, 0.08, 0.5), mat(0x222222), s * 1.3, 2.6, d / 2 + 0.25, false);
        add(g, B(0.26, 0.36, 0.26), glow(0xffc46b, 0.9), s * 1.3, 2.35, d / 2 + 0.5, false);
      }
    },
  }),

  bibliothek: (x, z, facing) => building({
    name: 'buecherei', x, z, facing, w: 10, d: 7, h: 6, wall: 0xc8b896, roof: 'gable', roofColor: 0x6a4f3a,
    door: 'arch', doorColor: 0x5a3a22, frame: 0xe8dcc0,
    sign: { text: 'BIBLIOTHEK', bg: '#3b2a1c', fg: '#f3e2b8', h: 0.75 }, signY: 3.45, signW: 4.6,
    extra(g, { d }) {
      for (const xx of [-2.3, -1.4, 1.4, 2.3]) add(g, new THREE.CylinderGeometry(0.16, 0.18, 2.9, 10), mat(0xece4d0), xx, 1.45, d / 2 + 0.55);
      add(g, B(5.2, 0.28, 1.0), mat(0xd8ccb0), 0, 3.0, d / 2 + 0.45);
    },
  }),

  tantes_haus: (x, z, facing) => building({
    name: 'tantes_haus', x, z, facing, w: 7, d: 6, h: 4.2, wall: 0xeab9bd, roof: 'gable', roofColor: 0x8a3f2e,
    door: 'single', doorColor: 0x9a2f3a, frame: 0xffffff,
    sign: { text: 'TANTES HAUS', bg: '#9a3f55', fg: '#ffffff', h: 0.55 }, signY: 3.2, signW: 2.9,
    extra(g, { d }) {
      for (const xx of [-2.3, 2.3]) {
        add(g, B(1.2, 0.22, 0.3), mat(0x7a4a2a), xx, 0.85, d / 2 + 0.16, false);
        for (let i = -1; i <= 1; i++) add(g, new THREE.SphereGeometry(0.11, 5, 4), mat(i ? 0xff5a7a : 0xffd84a), xx + i * 0.35, 1.02, d / 2 + 0.18, false);
      }
    },
  }),

  wohnhaus: (x, z, facing, i = 0) => building({
    name: `wohnhaus-${i}`, x, z, facing, w: 6, d: 5, h: 4.4,
    wall: [0xe9dcc2, 0xc8d8e8, 0xf0c8a0, 0xd8e8c8][i % 4], roof: 'gable',
    roofColor: [0x8a3f2e, 0x5a4a3a, 0x7a3a2a, 0x6a5040][i % 4],
    door: 'single', doorColor: [0x3a6a8a, 0x8a3a3a, 0x3a7a4a, 0x6a4a8a][i % 4],
  }),
};

function makeKirche(x, z) {
  // Kirche menghadap TIMUR ke Schillerstraße: menara + pintu di depan (sisi timur)
  const g = new THREE.Group(); g.name = 'kirche';
  const w = 7, d = 12, h = 6.2, wall = 0xc8b48e;
  add(g, B(w, h, d), mat(wall), 0, h / 2, 0);
  add(g, B(w + 0.18, 0.4, d + 0.18), mat(shade(wall, 0.6)), 0, 0.2, 0);
  // Atap pelana memanjang (bubungan depan→belakang)
  const roof = new THREE.Group(); roof.rotation.y = Math.PI / 2; g.add(roof);
  roofGable(roof, d, w, h, 0x5f6f5a, wall, 2.8);
  // Spitzbogenfenster di sisi samping
  for (const side of ['left', 'right']) {
    const f = faceGroup(g, side, w, d);
    for (const xx of [-3.2, -0.6, 2.0]) {
      add(f, B(0.9, 2.4, 0.06), mat(0xe8dcc0), xx, 3.0, 0.03, false);
      add(f, B(0.7, 2.2, 0.07), glow(0x6aa0d8, 0.35), xx, 2.95, 0.05, false);
    }
  }
  // Menara di depan, tengah
  const tz = d / 2 - 1.3;
  add(g, B(3.2, 11.5, 3.2), mat(0xbda57e), 0, 5.75, tz);
  add(g, B(3.5, 0.3, 3.5), mat(0x9a8662), 0, 11.6, tz);
  const spire = add(g, new THREE.ConeGeometry(2.1, 5.2, 4), mat(0x5f6f5a), 0, 14.35, tz);
  spire.rotation.y = Math.PI / 4;
  add(g, B(0.16, 1.3, 0.16), mat(0xe0b84a), 0, 17.6, tz, false);
  add(g, B(0.75, 0.16, 0.16), mat(0xe0b84a), 0, 17.75, tz, false);
  // Jam & jendela menara
  const tf = new THREE.Group(); tf.position.set(0, 0, tz + 1.6); g.add(tf);
  const clock = add(tf, new THREE.CylinderGeometry(0.7, 0.7, 0.08, 20), mat(0xffffff), 0, 9.6, 0.05, false);
  clock.rotation.x = Math.PI / 2;
  add(tf, B(0.06, 0.5, 0.04), mat(0x222222), 0, 9.75, 0.11, false);
  add(tf, B(0.38, 0.06, 0.04), mat(0x222222), 0.15, 9.6, 0.11, false);
  add(tf, B(0.8, 1.4, 0.06), glow(0x6aa0d8, 0.35), 0, 6.9, 0.04, false);
  doorAt(tf, 'arch', 0x5a3a22, 0);
  const s = signBoard('KIRCHE', 2.4, 0.55, { bg: '#4a3c2a', fg: '#f6ead0' });
  s.position.set(0, 3.95, 0.08); tf.add(s);
  // Fensterrose am Giebel samping menara
  for (const xx of [-2.6, 2.6]) {
    const ring = add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14), glow(0xd86a6a, 0.35), xx, 4.6, d / 2 + 0.05, false);
    ring.rotation.x = Math.PI / 2;
  }

  g.rotation.y = Math.PI / 2;
  g.position.set(x, 0, z);
  Game.worldGroup.add(g);
  blockBox(x - d / 2, z - w / 2, x + d / 2, z + w / 2, 'kirche', h);
  g.userData.front = { x: x + d / 2, z, nx: 1, nz: 0, along: 3.2 };
  return g;
}

function makeEdeka(x, z) {
  // EDEKA menghadap TIMUR ke Parkplatz sendiri (pintu kaca otomatis + kanopi).
  return building({
    name: 'edeka', x, z, facing: 'E', w: 12, d: 10, h: 4.6, wall: 0xf3f1ea, roofColor: 0x1d4fb8,
    door: 'glass', doorColor: 0x1d4fb8, groundWindows: false, upperFrom: 99,
    sign: { text: 'EDEKA', bg: '#1d4fb8', fg: '#ffd400', h: 1.0, weight: '900' }, signY: 3.65, signW: 5.4,
    extra(g, { w, d }) {
      // Etalase kaca selebar fasad di kiri-kanan pintu
      for (const s of [-1, 1]) {
        add(g, B(3.9, 2.3, 0.08), glassMat(), s * 3.55, 1.45, d / 2 + 0.05, false);
        for (const xx of [1.6, 3.55, 5.5]) add(g, B(0.1, 2.4, 0.12), mat(0x3a4048), s * xx, 1.45, d / 2 + 0.07, false);
      }
      add(g, B(w - 0.6, 0.12, 0.14), mat(0x3a4048), 0, 2.62, d / 2 + 0.07, false);
      // Garis kuning khas di atas atap
      add(g, B(w + 0.32, 0.12, d + 0.32), mat(0xffd400), 0, 4.4, 0, false);
      // Einkaufswagen-Box di samping pintu
      const cart = new THREE.Group();
      add(cart, B(1.6, 0.06, 1.0), mat(0x1d4fb8), 0, 1.6, 0);
      for (const sx of [-0.75, 0.75]) add(cart, B(0.06, 1.6, 0.06), mat(0x777777), sx, 0.8, 0.45, false);
      for (let i = 0; i < 3; i++) add(cart, B(0.5, 0.45, 0.8), mat(0xb8bcc2), -0.4 + i * 0.35, 0.55, 0, false);
      cart.position.set(-w / 2 + 1.2, 0, d / 2 + 0.7);
      g.add(cart);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════

function tree(x, z, s = 1, kind = 'round') {
  const t = new THREE.Group();
  add(t, new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.6 * s, 6), mat(0x6b4a2a), 0, 0.8 * s, 0);
  if (kind === 'pine') {
    [0x2d7a1e, 0x3a8f2c, 0x2a6a18].forEach((c, l) => add(t, new THREE.ConeGeometry((1.15 - l * 0.3) * s, 1.3 * s, 6), mat(c), 0, (1.7 + l * 0.75) * s, 0));
  } else {
    add(t, new THREE.IcosahedronGeometry(1.05 * s, 0), mat(0x4f9a3a), 0, 2.25 * s, 0);
    add(t, new THREE.IcosahedronGeometry(0.7 * s, 0), mat(0x5fae45), 0.35 * s, 2.75 * s, 0.2 * s);
  }
  t.position.set(x, 0, z);
  Game.worldGroup.add(t);
  blockPost(x, z, 0.32 * s);
}
function bench(x, z, rotY = 0) {
  const b = new THREE.Group();
  add(b, B(1.7, 0.1, 0.5), mat(0x9a6a3a), 0, 0.45, 0);
  add(b, B(1.7, 0.42, 0.08), mat(0x9a6a3a), 0, 0.72, -0.22);
  for (const s of [-0.7, 0.7]) add(b, B(0.08, 0.45, 0.45), mat(0x333333), s, 0.22, 0, false);
  b.rotation.y = rotY; b.position.set(x, 0, z);
  Game.worldGroup.add(b);
  blockPost(x, z, 0.5);
}
function lamp(x, z) {
  const l = new THREE.Group();
  add(l, new THREE.CylinderGeometry(0.06, 0.09, 3.6, 6), mat(0x3a3f45), 0, 1.8, 0);
  add(l, B(0.5, 0.14, 0.5), mat(0x3a3f45), 0, 3.65, 0);
  add(l, B(0.36, 0.12, 0.36), glow(0xfff2c0, 0.6), 0, 3.54, 0, false);
  l.position.set(x, 0, z);
  Game.worldGroup.add(l);
  blockPost(x, z, 0.15);
}
function hedge(x0, z0, x1, z1, h = 0.6) {
  const w = Math.abs(x1 - x0) || 0.4, d = Math.abs(z1 - z0) || 0.4;
  add(Game.worldGroup, B(w, h, d), mat(0x3d7a32), (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  blockBox(Math.min(x0, x1) - (w === 0.4 ? 0.2 : 0), Math.min(z0, z1) - (d === 0.4 ? 0.2 : 0),
           Math.max(x0, x1) + (w === 0.4 ? 0.2 : 0), Math.max(z0, z1) + (d === 0.4 ? 0.2 : 0), 'hedge', h);
}
function flowerBed(x, z, w, d, color) {
  add(Game.worldGroup, B(w, 0.18, d), mat(0x7a5a3a), x, 0.09, z, false);
  for (let i = 0; i < Math.round(w * d * 2.2); i++) {
    add(Game.worldGroup, new THREE.IcosahedronGeometry(0.13, 0), mat(i % 3 ? color : 0xffffff),
      x + (((i * 37) % 100) / 100 - 0.5) * (w - 0.3), 0.3, z + (((i * 61) % 100) / 100 - 0.5) * (d - 0.3), false);
  }
}
function car(x, z, rotY, color) {
  const c = new THREE.Group();
  add(c, B(1.7, 0.6, 3.4), mat(color), 0, 0.55, 0);
  add(c, B(1.5, 0.55, 1.8), mat(shade(color, 0.85)), 0, 1.1, -0.2);
  add(c, B(1.52, 0.4, 1.6), glassMat(), 0, 1.12, -0.2, false);
  for (const sx of [-0.85, 0.85]) for (const sz of [-1.1, 1.1]) {
    const wh = add(c, new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), mat(0x222222), sx, 0.3, sz, false);
    wh.rotation.z = Math.PI / 2;
  }
  c.rotation.y = rotY; c.position.set(x, 0, z);
  Game.worldGroup.add(c);
  const hw = Math.abs(Math.sin(rotY)) > 0.5 ? 1.7 : 0.85, hd = Math.abs(Math.sin(rotY)) > 0.5 ? 0.85 : 1.7;
  blockBox(x - hw, z - hd, x + hw, z + hd, 'car', 1.4);
}
function barrier(x, z, len, alongX) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) add(g, B(0.12, 1.0, 0.12), mat(0x555555), s * len / 2, 0.5, 0, false);
  const n = Math.round(len / 0.5);
  for (let i = 0; i < n; i++) add(g, B(len / n, 0.32, 0.08), mat(i % 2 ? 0xffffff : 0xd62828), -len / 2 + (i + 0.5) * len / n, 0.8, 0, false);
  g.rotation.y = alongX ? 0 : Math.PI / 2; g.position.set(x, 0, z);
  Game.worldGroup.add(g);
}
/** Tiang nama jalan: papan sepanjang x (jalan E-W) dan sepanjang z (jalan N-S). */
// Kedua papan dipasang seperti bendera ke arah berlawanan (dirX, dirZ) supaya
// tidak saling menutupi dari sudut kamera isometrik.
function streetSign(x, z, nameEW, nameNS, dirX = 1, dirZ = -1) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), mat(0x8a8f96), 0, 1.7, 0);
  const o = { bg: '#1f4f96', fg: '#ffffff', border: '#ffffff', both: true, frame: 0xffffff };
  if (nameEW) { const s = signBoard(nameEW, 2.4, 0.48, o); s.position.set(dirX * 1.27, 2.7, 0); g.add(s); }
  if (nameNS) { const s = signBoard(nameNS, 2.4, 0.48, o); s.rotation.y = Math.PI / 2; s.position.set(0, 3.2, dirZ * 1.27); g.add(s); }
  g.position.set(x, 0, z);
  Game.worldGroup.add(g);
  blockPost(x, z, 0.15);
}
function ampel(x, z, faceRot) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8), mat(0x3a3f45), 0, 1.7, 0);
  const head = new THREE.Group(); head.position.set(0, 3.25, 0); head.rotation.y = faceRot; g.add(head);
  add(head, B(0.5, 1.3, 0.32), mat(0x1e1e1e), 0, 0, 0);
  [[0xff3b30, 0.4, 0.15], [0xffcc00, 0, 0.15], [0x34ff6a, -0.4, 1.4]].forEach(([c, dy, e]) => {
    const l = add(head, new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), glow(c, e), 0, dy, 0.18, false);
    l.rotation.x = Math.PI / 2;
  });
  g.position.set(x, 0, z);
  Game.worldGroup.add(g);
  blockPost(x, z, 0.2);
}

// ═══════════════════════════════════════════════════════════════════
// JALAN, TROTOAR, AIR
// ═══════════════════════════════════════════════════════════════════

function asphalt(x0, z0, x1, z1) {
  flat(x1 - x0, z1 - z0, 0x484a4f, (x0 + x1) / 2, (z0 + z1) / 2, 0.021, true);
}
function sidewalk(x0, z0, x1, z1) {
  const m = add(Game.worldGroup, B(x1 - x0, 0.12, z1 - z0), mat(0xb4b0a6), (x0 + x1) / 2, 0.06, (z0 + z1) / 2, false);
  World.walkables.push(m);
}
function dashesX(z, x0, x1, skip) {
  for (let xx = x0 + 1.5; xx <= x1 - 1.5; xx += 4) {
    if (skip.some(([a, b]) => xx > a - 1.5 && xx < b + 1.5)) continue;
    flat(2, 0.16, 0xf2f2f2, xx, z, 0.03);
  }
}
function dashesZ(x, z0, z1, skip) {
  for (let zz = z0 + 1.5; zz <= z1 - 1.5; zz += 4) {
    if (skip.some(([a, b]) => zz > a - 1.5 && zz < b + 1.5)) continue;
    flat(0.16, 2, 0xf2f2f2, x, zz, 0.03);
  }
}
/** Zebrastreifen melintang jalan. alongX=true → garis-garis berjajar di x (menyeberangi jalan N-S). */
function zebra(cx, cz, alongX) {
  for (let i = -2; i <= 2; i++) {
    if (alongX) flat(0.45, 2.2, 0xeeeeee, cx + i * 0.9, cz, 0.032);
    else flat(2.2, 0.45, 0xeeeeee, cx, cz + i * 0.9, 0.032);
  }
}
function water(x0, z0, x1, z1) {
  const m = new THREE.MeshStandardMaterial({ color: 0x3fb4e6, emissive: 0x0b5f8f, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0.1 });
  flat(x1 - x0, z1 - z0, m, (x0 + x1) / 2, (z0 + z1) / 2, 0.035);
  // Kaimauer (stone embankment) di kedua tepi
  for (const zz of [z0, z1]) add(Game.worldGroup, B(x1 - x0, 0.3, 0.45), mat(0x9a968c), (x0 + x1) / 2, 0.15, zz, false);
}
function bridge(cx, z0, z1, width, name) {
  const g = new THREE.Group();
  const len = z1 - z0;
  const deck = add(g, B(width, 0.26, len), mat(0xb59a74), 0, 0.13, 0);
  World.walkables.push(deck);
  for (let zz = -len / 2 + 0.4; zz < len / 2; zz += 0.8) add(g, B(width - 0.2, 0.04, 0.1), mat(0x9a7f5a), 0, 0.28, zz, false);
  for (const s of [-1, 1]) {
    add(g, B(0.16, 0.12, len), mat(0xeae4d6), s * (width / 2 - 0.08), 1.0, 0);
    add(g, B(0.12, 0.08, len), mat(0xeae4d6), s * (width / 2 - 0.08), 0.6, 0, false);
    for (let zz = -len / 2 + 0.1; zz <= len / 2; zz += len / Math.round(len / 1.2)) add(g, B(0.16, 1.0, 0.16), mat(0xeae4d6), s * (width / 2 - 0.08), 0.5, zz);
  }
  g.position.set(cx, 0, (z0 + z1) / 2);
  g.name = name;
  Game.worldGroup.add(g);
  // Pagar jembatan tidak bisa ditembus (air di bawahnya juga diblok)
  for (const s of [-1, 1]) blockBox(cx + s * width / 2 - 0.12, z0, cx + s * width / 2 + 0.12, z1, `${name}-rail`, 1.1);
}

// ═══════════════════════════════════════════════════════════════════
// STADTPARK
// ═══════════════════════════════════════════════════════════════════

function stadtpark(x0, z0, x1, z1, allee) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  flat(x1 - x0, z1 - z0, 0x7cc35a, cx, cz, 0.025);
  // Jalur utama E-W (Schillerstr. ↔ Bachstr.) + plaza bundar di ujung Allee
  flat(x1 - x0, 1.8, 0xd9c9a3, cx, cz, 0.035, true);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), mat(0xd9c9a3));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(allee.x, 0.036, cz); Game.worldGroup.add(plaza);
  flat(allee.w, cz - z0, 0xd9c9a3, allee.x, (z0 + cz) / 2, 0.035, true);
  // Brunnen
  add(Game.worldGroup, new THREE.CylinderGeometry(1.45, 1.6, 0.5, 16), mat(0xbdbab2), allee.x, 0.25, cz);
  add(Game.worldGroup, new THREE.CylinderGeometry(1.2, 1.2, 0.08, 16), glow(0x49b6e6, 0.35), allee.x, 0.5, cz, false);
  add(Game.worldGroup, new THREE.CylinderGeometry(0.12, 0.18, 1.3, 8), mat(0xd0cdc5), allee.x, 1.0, cz);
  add(Game.worldGroup, new THREE.SphereGeometry(0.32, 10, 8), glow(0x7fd4f2, 0.45), allee.x, 1.8, cz, false);
  blockPost(allee.x, cz, 1.6);
  // Bangku menghadap plaza
  bench(allee.x - 4.3, cz - 1.6, 0); bench(allee.x + 4.3, cz - 1.6, 0);
  bench(allee.x - 4.3, cz + 1.6, Math.PI); bench(allee.x + 4.3, cz + 1.6, Math.PI);
  // Beet & pohon di halaman barat dan timur
  flowerBed(x0 + 2.6, cz - 2.2, 3, 1.1, 0xff5577);
  flowerBed(x0 + 2.6, cz + 2.2, 3, 1.1, 0xffcc33);
  flowerBed(x1 - 3.2, cz - 2.2, 2.4, 1.1, 0xff77cc);
  for (const tx of [x0 + 7, x0 + 13]) { tree(tx, z0 + 1.3, 0.95); tree(tx + 2.6, z1 - 1.3, 0.95, 'pine'); }
  tree(x1 - 1.5, z1 - 1.3, 0.9);
  // Hecke keliling dengan bukaan: barat (jalur), utara (Allee), timur (jalur)
  const gap = (a, b, holes) => {
    let s = a;
    for (const [h0, h1] of holes) { if (h0 > s) hedge(s, z0, h0, z0); s = h1; }
    if (b > s) hedge(s, z0, b, z0);
  };
  gap(x0, x1, [[allee.x - allee.w / 2 - 0.2, allee.x + allee.w / 2 + 0.2]]);
  hedge(x0, z0, x0, cz - 1.1); hedge(x0, cz + 1.1, x0, z1);
  hedge(x1, z0, x1, cz - 1.1); hedge(x1, cz + 1.1, x1, z1);
}

// ═══════════════════════════════════════════════════════════════════
// BUILD
// ═══════════════════════════════════════════════════════════════════

export function buildStadt() {
  _mats = new Map(); _glass = null;
  const variant = (typeof window !== 'undefined' && window.__stadtVariant__) || 'A';
  const V = VARIANTS[variant] || VARIANTS.A;

  // Registry posisi untuk step quest 'reach_building'. Setiap entri adalah
  // area DI DEPAN PINTU (lingkaran {x,z,r} atau kotak {x,z,hw,hd}).
  const reg = window.__stadtBuildings__ = {};
  const regFront = (name, g, depth = 3.2) => {
    const f = g.userData.front;
    reg[name] = f.nx
      ? { x: f.x + depth / 2, z: f.z, hw: depth / 2, hd: f.along / 2 }
      : { x: f.x, z: f.z + depth / 2, hw: f.along / 2, hd: depth / 2 };
    reg[name].door = { x: f.x + f.nx * 1.2, z: f.z + f.nz * 1.2 };
  };

  // ── Tanah (lebih luas dari batas zona supaya tepi peta tidak terlihat) ──
  // (ground plane dibuat oleh world.js buildGround)

  // ═════════════════════════ JALAN ═════════════════════════════════
  const mainN = MAIN_Z - RW / 2, mainS = MAIN_Z + RW / 2;
  const wW = WEST_X - RW / 2, wE = WEST_X + RW / 2, eW = EAST_X - RW / 2, eE = EAST_X + RW / 2;
  const canalN = CANAL_Z - CANAL_HW, canalS = CANAL_Z + CANAL_HW;
  const riverN = RIVER_Z - RIVER_HW, riverS = RIVER_Z + RIVER_HW;
  const lindN = LIND_Z - RW / 2, lindS = LIND_Z + RW / 2;

  asphalt(-70, mainN, 70, mainS);                         // Hauptstraße
  asphalt(wW, mainS, wE, riverN - 0.8);                   // Schillerstr. Süd (bis Alte Brücke)
  asphalt(wW, canalS + 0.6, wE, mainN);                   // Schillerstr. Nord (bis Kanal)
  asphalt(wW, -70, wE, canalN - 0.6);                     // Schillerstr. jenseits Kanal
  asphalt(eW, canalS + 0.6, eE, mainN);                   // Bachstr. Nord (bis Kanalbrücke)
  asphalt(eW, mainS, eE, lindS);                          // Bachstr. Süd (endet an Lindenstr.)
  asphalt(eE, lindN, 70, lindS);                          // Lindenstraße

  dashesX(MAIN_Z, -70, 70, [[wW, wE], [eW, eE]]);
  dashesZ(WEST_X, mainS, riverN - 0.8, []);
  dashesZ(WEST_X, canalS + 0.6, mainN, []);
  dashesZ(WEST_X, -70, canalN - 0.6, []);
  dashesZ(EAST_X, canalS + 0.6, mainN, []);
  dashesZ(EAST_X, mainS, lindN, []);
  dashesX(LIND_Z, eE, 70, []);

  // Trotoar (dipotong rapi di setiap persimpangan)
  for (const [z0, z1] of [[mainN - SW, mainN], [mainS, mainS + SW]]) {
    sidewalk(-70, z0, wW, z1); sidewalk(wE, z0, eW, z1); sidewalk(eE, z0, 70, z1);
  }
  for (const [x0, x1] of [[wW - SW, wW], [wE, wE + SW]]) {
    sidewalk(x0, -70, x1, canalN - 0.6);
    sidewalk(x0, canalS + 0.6, x1, mainN - SW);
    sidewalk(x0, mainS + SW, x1, riverN - 0.8);
  }
  sidewalk(eW - SW, canalS + 0.6, eW, mainN - SW);
  sidewalk(eE, canalS + 0.6, eE + SW, mainN - SW);
  sidewalk(eW - SW, mainS + SW, eW, lindS + SW);
  sidewalk(eE, mainS + SW, eE + SW, lindN - SW);
  sidewalk(eE, lindN - SW, 70, lindN);
  sidewalk(eW, lindS, 70, lindS + SW);

  // Zebrastreifen di setiap lengan persimpangan
  zebra(WEST_X, mainN - 1.4, true); zebra(WEST_X, mainS + 1.4, true);
  zebra(wW - 1.4, MAIN_Z, false);   zebra(wE + 1.4, MAIN_Z, false);
  zebra(EAST_X, mainN - 1.4, true); zebra(EAST_X, mainS + 1.4, true);
  zebra(eW - 1.4, MAIN_Z, false);   zebra(eE + 1.4, MAIN_Z, false);
  zebra(eE + 1.4, LIND_Z, false);

  // ═════════════════════════ AIR & JEMBATAN ═══════════════════════
  water(-70, canalN, 70, canalS);
  blockBox(-70, canalN, wW + 0.2, canalS, 'kanal-w', 2);
  blockBox(wE - 0.2, canalN, eW + 0.2, canalS, 'kanal-m', 2);
  blockBox(eE - 0.2, canalN, 70, canalS, 'kanal-o', 2);
  bridge(WEST_X, canalN - 0.6, canalS + 0.6, RW - 0.4, 'kanalbruecke-west');
  bridge(EAST_X, canalN - 0.6, canalS + 0.6, RW - 0.4, 'kanalbruecke-ost');

  water(-70, riverN, 70, riverS);
  blockBox(-70, riverN, wW + 0.4, riverS + 3, 'fluss-w', 2);
  blockBox(wE - 0.4, riverN, 70, riverS + 3, 'fluss-o', 2);
  bridge(WEST_X, riverN - 0.8, riverS + 0.8, RW - 0.8, 'alte-bruecke');
  { // Papan nama "Alte Brücke" di pangkal jembatan
    const s = signBoard('Alte Brücke', 2.2, 0.45, { bg: '#5a4630', fg: '#fff3d6', both: true });
    s.position.set(wE + 0.25, 1.45, riverN - 1.0); Game.worldGroup.add(s);
    add(Game.worldGroup, new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), mat(0x5a4630), wE + 0.25, 0.65, riverN - 1.0, false);
  }
  // Ortsschild kuning saat masuk kota dari jembatan
  {
    const s = signBoard('Hamburg', 1.8, 0.7, { bg: '#ffd400', fg: '#111111', border: '#111111', frame: 0x111111, both: true });
    s.position.set(wW - 0.9, 2.2, riverN - 2.4); Game.worldGroup.add(s);
    add(Game.worldGroup, new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), mat(0x8a8f96), wW - 0.9, 1.0, riverN - 2.4, false);
    blockPost(wW - 0.9, riverN - 2.4, 0.15);
  }
  // Promenade di tepi sungai (selatan Lindenstraße & taman)
  flat(70 - 13.4, riverN - (lindS + SW), 0xcfc6b2, (13.4 + 70) / 2, (lindS + SW + riverN) / 2, 0.03, true);
  for (const bx of [24, 32, 40]) bench(bx, riverN - 1.1, 0);
  for (const lx of [20, 28, 36]) lamp(lx, riverN - 0.6);

  // ═════════════════════════ GEDUNG ════════════════════════════════
  const place = (kind, x, z, facing, i) => MAKERS[kind](x, z, facing, i);

  // — Blok barat-laut (menghadap timur ke Schillerstraße) —
  const corner = place(V.corner, -32.5, -10, 'E');                     // di Ampel
  regFront(V.corner, corner);
  const north2 = place(V.north2, -32.5, -28, 'E');                     // seberang kanal
  regFront(V.north2, north2);

  // — Deret utara Hauptstraße (menghadap selatan) —
  const opp = place(V.opposite, -12.5, V.opposite === 'mall' ? -11 : -10, 'S');   // TEPAT di seberang EDEKA
  regFront(V.opposite, opp);
  regFront('baeckerei', place('baeckerei', -2.5, -8.5, 'S'));
  regFront('kino', place('kino', 8.5, -9.5, 'S'));
  regFront('hotel', place('hotel', 27, -10.5, 'S'));
  regFront('tourismusbuero', place('tourismus', 37, -9, 'S'));

  // — Blok barat-daya (menghadap timur ke Schillerstraße) —
  const kirche = makeKirche(-35.5, 12);
  regFront('kirche', kirche, 3.6);
  const south2 = place(V.south2, V.south2 === 'mall' ? -34.5 : -33.5, 23.5, 'E');
  regFront(V.south2, south2);

  // — EDEKA + Parkplatz (selatan Hauptstraße, pintu menghadap timur) —
  const EDEKA_X = -14, EDEKA_Z = 15;
  makeEdeka(EDEKA_X, EDEKA_Z);
  {
    const px0 = -8.6, px1 = 0.6, pz0 = mainS + SW + 0.4, pz1 = 21.4;
    flat(px1 - px0, pz1 - pz0, 0x55585e, (px0 + px1) / 2, (pz0 + pz1) / 2, 0.022, true);
    // Garis parkir: deret utara & selatan, lorong tengah bebas di depan pintu
    for (const zz of [pz0 + 0.2, pz1 - 0.2]) {
      for (let xx = -5.7; xx <= 0.7; xx += 2.1) flat(0.1, 4.2, 0xffffff, xx, zz + (zz < EDEKA_Z ? 2.1 : -2.1), 0.03);
    }
    // Trotoar depan toko di sepanjang fasad (lorong tengah bebas di depan pintu)
    flat(1.8, 12, 0xc9c4b8, -8.1, EDEKA_Z, 0.028, true);
    car(-2.55, pz0 + 2.3, 0, 0xd64541);
    car(0.6 - 1.05 - 0.1, pz1 - 2.3, Math.PI, 0x3b7dd8);
    car(-4.65, pz1 - 2.3, Math.PI, 0xf2f2f2);
    // Pylon EDEKA di sudut parkir dekat jalan — selalu menghadap kamera
    const pylon = new THREE.Group();
    add(pylon, B(0.3, 3.6, 0.3), mat(0x2f3540), 0, 1.8, 0);
    const ps = signBoard('EDEKA', 2.2, 0.9, { bg: '#1d4fb8', fg: '#ffd400', weight: '900', frame: 0xffd400, both: true });
    ps.position.y = 4.0; pylon.add(ps);
    const pp = signBoard('P', 0.6, 0.6, { bg: '#1f5fbf', fg: '#ffffff', frame: 0xffffff, both: true, scale: 0.8 });
    pp.position.set(0.55, 2.85, 0); pylon.add(pp);          // di samping tiang, tidak tertutup
    add(pylon, B(0.3, 0.08, 0.08), mat(0x2f3540), 0.3, 2.85, 0, false);
    pylon.rotation.y = Math.PI / 4;
    pylon.position.set(-8.0, 0, mainS + SW + 0.8);
    Game.worldGroup.add(pylon);
    blockPost(-8.0, mainS + SW + 0.8, 0.25);
  }
  // Area quest Q4: EDEKA + parkir + trotoar di depannya
  reg.edeka = { x: -9.2, z: 13, hw: 10.4, hd: 10, door: { x: -5.6, z: EDEKA_Z } };   // door: di luar pemicu portal

  // — Allee (jalur berpohon dari Hauptstraße ke Stadtpark) —
  const ALLEE = { x: 3.5, w: 3 };
  flat(ALLEE.w, 22.8 - (mainS + SW), 0xd9c9a3, ALLEE.x, (mainS + SW + 22.8) / 2, 0.034, true);
  for (let zz = mainS + SW + 2.2; zz < 22; zz += 3.6) { tree(ALLEE.x - 2.2, zz, 0.85); tree(ALLEE.x + 2.2, zz, 0.85); }
  { const s = signBoard('Allee', 1.4, 0.4, { bg: '#2c5a2a', fg: '#ffffff', both: true });
    s.position.set(ALLEE.x + 1.9, 1.5, mainS + SW + 0.45); Game.worldGroup.add(s);
    add(Game.worldGroup, new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), mat(0x555555), ALLEE.x + 1.9, 0.7, mainS + SW + 0.45, false); }

  // — Deretan toko di sisi barat Bachstraße (menghadap timur) —
  regFront('cafe', place('cafe', 10.8, 10.2, 'E'));
  {
    // EISSTAND — kios kecil TEPAT di antara Café dan Blumenladen
    const g = new THREE.Group(); g.name = 'eisstand';
    add(g, B(2.4, 2.2, 2.0), mat(0xffd3e2), 0, 1.1, 0);
    add(g, B(1.6, 0.9, 0.08), glassMat(), 0, 1.35, 1.02, false);
    add(g, B(2.2, 0.1, 0.5), mat(0xffffff), 0, 0.92, 1.2, false);
    for (let i = 0; i < 5; i++) add(g, B(0.48, 0.1, 1.0), mat(i % 2 ? 0xffffff : 0xe8467c), -0.96 + i * 0.48, 2.45, 1.0);
    add(g, B(2.6, 0.18, 2.3), mat(0xe8467c), 0, 2.3, 0);
    const cone = add(g, new THREE.ConeGeometry(0.32, 0.9, 8), mat(0xd9a05b), 0, 2.85, 0); cone.rotation.x = Math.PI;
    add(g, new THREE.SphereGeometry(0.38, 10, 8), mat(0xff9ec4), 0, 3.4, 0);
    add(g, new THREE.SphereGeometry(0.3, 10, 8), mat(0xfff3c4), 0.12, 3.75, 0.05);
    const s = signBoard('EIS', 1.3, 0.45, { bg: '#e8467c', fg: '#ffffff' });
    s.position.set(0, 1.95, 1.06); g.add(s);
    g.rotation.y = Math.PI / 2;
    g.position.set(12.0, 0, 15.1);
    Game.worldGroup.add(g);
    blockBox(11.0, 13.9, 13.0, 16.3, 'eisstand', 2.4);
    reg.eisstand = { x: 14.2, z: 15.1, r: 2.6 };
  }
  regFront('blumenladen', place('blumenladen', 10.95, 19.4, 'E'));

  // — Tenggara: menghadap selatan ke Lindenstraße —
  regFront('post', place('post', 25.5, 15.2, 'S'));
  regFront('restaurant', place('restaurant', 35.5, 14.7, 'S'));

  // — Seberang kanal: taman kecil, Bibliothek, Tantes Haus, rumah tepi kanal —
  // Lebar taman mencakup kedua pintu (Bibliothek x 12.6, Tantes Haus x 23.4)
  const parkN = { x0: 9.6, x1: 26.4, z0: canalN - 0.6 - 7, z1: canalN - 0.6 };
  flat(parkN.x1 - parkN.x0, parkN.z1 - parkN.z0, 0x7cc35a, (parkN.x0 + parkN.x1) / 2, (parkN.z0 + parkN.z1) / 2, 0.025);
  flat(2.4, parkN.z1 - parkN.z0, 0xd9c9a3, EAST_X, (parkN.z0 + parkN.z1) / 2, 0.035, true);
  flat(parkN.x1 - parkN.x0, 1.6, 0xd9c9a3, (parkN.x0 + parkN.x1) / 2, (parkN.z0 + parkN.z1) / 2, 0.035, true);
  // Bagian utara taman tetap lapang (jalan ke kedua pintu); hiasan di sisi kanal
  flowerBed(parkN.x0 + 2.8, parkN.z1 - 1.2, 1.8, 0.9, 0xff6688);
  flowerBed(parkN.x1 - 2.8, parkN.z1 - 1.2, 1.8, 0.9, 0xffcc44);
  tree(parkN.x0 + 1.0, parkN.z1 - 1.0, 0.9); tree(parkN.x1 - 1.0, parkN.z1 - 1.0, 0.9, 'pine');
  bench(EAST_X - 3.4, (parkN.z0 + parkN.z1) / 2 + 1.6, Math.PI);
  bench(EAST_X + 3.4, (parkN.z0 + parkN.z1) / 2 + 1.6, Math.PI);
  hedge(parkN.x0, parkN.z1, EAST_X - 1.5, parkN.z1); hedge(EAST_X + 1.5, parkN.z1, parkN.x1, parkN.z1);
  hedge(parkN.x0, parkN.z0 + 0.1, parkN.x0, parkN.z1);  hedge(parkN.x1, parkN.z0 + 0.1, parkN.x1, parkN.z1);
  reg.park_nord = { x: EAST_X, z: (parkN.z0 + parkN.z1) / 2, hw: (parkN.x1 - parkN.x0) / 2, hd: 3.5 };

  const libZ = parkN.z0 - 0.4 - 3.5;
  regFront('buecherei', place('bibliothek', 12.6, libZ, 'S'));
  reg.bibliothek = reg.buecherei;
  const th = place('tantes_haus', 23.4, parkN.z0 - 0.4 - 3, 'S');
  regFront('tantes_haus', th, 2.6);
  flat(1.6, 0.8, 0xd9c9a3, EAST_X, parkN.z0 - 0.4, 0.035);      // jalan setapak antara keduanya
  place('wohnhaus', 31, parkN.z0 + 0.6 - 2.5, 'S', 0);
  place('wohnhaus', 39, parkN.z0 + 0.6 - 2.5, 'S', 1);
  flat(70 - parkN.x1, 2.0, 0xcfc6b2, (parkN.x1 + 70) / 2, canalN - 1.6, 0.03, true);  // Uferweg

  // — Sportplatz (belakang sekolah, seberang kanal) —
  {
    const sx0 = -18, sx1 = 6, sz0 = -34, sz1 = canalN - 2.2;
    flat(sx1 - sx0, sz1 - sz0, 0x5fae45, (sx0 + sx1) / 2, (sz0 + sz1) / 2, 0.026);
    const line = (w, d, x, z) => flat(w, d, 0xffffff, x, z, 0.031);
    line(sx1 - sx0 - 1, 0.12, (sx0 + sx1) / 2, sz0 + 0.5); line(sx1 - sx0 - 1, 0.12, (sx0 + sx1) / 2, sz1 - 0.5);
    line(0.12, sz1 - sz0 - 1, sx0 + 0.5, (sz0 + sz1) / 2); line(0.12, sz1 - sz0 - 1, sx1 - 0.5, (sz0 + sz1) / 2);
    line(0.12, sz1 - sz0 - 1, (sx0 + sx1) / 2, (sz0 + sz1) / 2);
    for (const gx of [sx0 + 0.7, sx1 - 0.7]) {
      const gz = (sz0 + sz1) / 2;
      for (const s of [-1, 1]) add(Game.worldGroup, B(0.1, 1.2, 0.1), mat(0xffffff), gx, 0.6, gz + s * 1.2, false);
      add(Game.worldGroup, B(0.1, 0.1, 2.5), mat(0xffffff), gx, 1.2, gz, false);
    }
    for (let xx = sx0; xx <= sx1; xx += 3) add(Game.worldGroup, B(0.08, 1.0, 0.08), mat(0x777777), xx, 0.5, sz1 + 0.4, false);
    add(Game.worldGroup, B(sx1 - sx0, 0.06, 0.04), mat(0x999999), (sx0 + sx1) / 2, 0.95, sz1 + 0.4, false);
  }

  // ═════════════════════════ AMPEL, SCHILDER ══════════════════════
  ampel(wW - 0.7, mainN - 0.7, Math.PI / 2);     // sudut barat-laut, menghadap jalan masuk
  ampel(wE + 0.7, mainS + 0.7, 0);                // sudut tenggara, menghadap Lukas dari selatan
  reg.ampel = { x: WEST_X, z: MAIN_Z, r: 6 };
  reg.kreuzung = reg.ampel;
  reg.grosse_kreuzung = { x: EAST_X, z: MAIN_Z, r: 6 };

  streetSign(wE + 0.8, mainN - 0.8, V.main, V.west, 1, -1);
  streetSign(wW - 0.8, mainS + 0.8, V.main, V.west, 1, 1);
  streetSign(eW - 0.8, mainS + 0.8, V.main, 'Bachstraße', 1, 1);
  streetSign(eE + 0.8, mainN - 0.8, V.main, 'Bachstraße', 1, -1);
  streetSign(eE + 0.8, lindN - 0.8, 'Lindenstraße', 'Bachstraße', 1, -1);

  // Batas peta: palang di ujung jalan (pemain tidak bisa keluar zona)
  const bx = 42.4, bz = 35.4;
  barrier(-bx, MAIN_Z, RW, false); barrier(bx, MAIN_Z, RW, false);
  barrier(bx, LIND_Z, RW, false);
  barrier(WEST_X, -bz, RW, true);

  // ═════════════════════════ POHON & LAMPU ════════════════════════
  for (const [tx, tz] of [
    [-16, -17.2], [-8, -17.2], [0, -16.2], [8, -16.2], [24, -16.9], [31, -16.9], [37, -15.2],
    [-39.5, -7], [-39.5, -13], [-39, -23], [-39, -31],
    [25, 7.6], [31, 7.6], [37, 7.6], [-41, 5.8],
  ]) tree(tx, tz, 1);
  for (const lx of [-36, -12, 26, 38]) lamp(lx, mainS + SW - 0.3);
  for (const lz of [-12, 12]) lamp(wE + SW - 0.3, lz);
  // Hutan kecil di luar batas peta (mengisi tepi pandangan kamera)
  const rnd = (i) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    const t = rnd(i) * 2 - 1, u = rnd(i + 99);
    let tx, tz;
    if (side === 0) { tx = -44 - u * 14; tz = t * 48; }
    else if (side === 1) { tx = 44 + u * 14; tz = t * 48; }
    else if (side === 2) { tx = t * 56; tz = 36.5 + u * 12; }
    else { tx = t * 56; tz = -37 - u * 10; }
    if (Math.abs(tx - WEST_X) < 4.5 || Math.abs(tz - MAIN_Z) < 4.5 || Math.abs(tz - CANAL_Z) < 3.5 ||
        (Math.abs(tz - LIND_Z) < 4.5 && tx > 14)) continue;
    tree(tx, tz, 0.9 + rnd(i + 7) * 0.5, i % 3 ? 'round' : 'pine');
  }

  // Taman kota paling akhir (memakai posisi Allee)
  stadtpark(-19, 22.8, 13.4, riverN - 0.6, ALLEE);
  reg.stadtpark = { x: (-19 + 13.4) / 2, z: (22.8 + riverN - 0.6) / 2, hw: 16.2, hd: 3.6 };
  reg.marktplatz = reg.stadtpark;

  if (CONFIG.DEBUG) console.log('[stadt] variant', variant, 'registry', Object.keys(reg));
}
