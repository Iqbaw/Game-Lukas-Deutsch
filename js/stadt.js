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
//        z=-6   Apotheke*  Schule* Bäckerei Kino │ Tourist-Info  Hotel
//        z= 0  ════════ Ampel ═══ Hauptstraße ═══╪═══════════════════════
//               Kirche   │ EDEKA  P  Allee  Café │  Post   Restaurant
//               Mall*    │                 Eis   │═══ Deichstraße ═════
//               (Eingang)│   Stadtpark    Blumen │
//        z=30  ~~~~~~~~[Alte Brücke]~~~~~~ Elbe (lebar, kapal) ~~ Elbblick ~~
//              ~~~~~~~~[ → Omas Haus ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//        z=39   tepi seberang: jalan setapak, alang-alang, mercusuar
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
const LIND_Z  = 23;    // Deichstraße (E-W, mulai dari Bachstraße ke timur, dekat Elbe)
const CANAL_Z = -20;   // kanal utara (air z -21.8..-18.2)
const RIVER_Z = 34.7;  // Elbe di selatan (air z 30.4..39.0) — lebar, ada kapal
const CANAL_HW = 1.8, RIVER_HW = 4.3;

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
  if (!_glass) {
    _glass = new THREE.MeshLambertMaterial({ color: 0x9fd0ec, emissive: 0x2a5874, emissiveIntensity: 0.45 });
    _glass.userData.nightWindow = true;          // menyala hangat di malam hari (js/night.js)
  }
  return _glass;
}
/** Daftarkan lampu untuk malam hari (halo, lingkaran cahaya, lampu titik). */
function nightLamp(x, z, y, head, o = {}) {
  (World.nightLamps || (World.nightLamps = [])).push({ x, z, y, head, ...o });
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
  // Lampu dinding di samping pintu — setiap gedung punya cahaya di malam hari
  if (door && o.doorLamp !== false) {
    const lx = doorX + (doorX > 0 ? -1 : 1) * (doorHalf + 0.32);
    let lantern = null;
    if (!awning) {            // di bawah markise cahaya berasal dari etalase
      add(front, B(0.1, 0.1, 0.3), mat(0x2b2b2b), lx, 2.62, 0.15, false);
      lantern = add(front, B(0.24, 0.32, 0.24), glow(0xffe2a8, 0.35), lx, 2.44, 0.3, false);
    }
    const lz = d / 2 + 0.7;
    const wx = facing === 'E' ? x + lz : x + lx, wz = facing === 'E' ? z - lx : z + lz;
    nightLamp(wx, wz, 2.4, lantern, { pool: 2.3, power: 7, range: 7, color: 0xffd08a });
  }
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
  const head = add(l, B(0.36, 0.12, 0.36), glow(0xfff2c0, 0.6), 0, 3.54, 0, false);
  l.position.set(x, 0, z);
  Game.worldGroup.add(l);
  blockPost(x, z, 0.15);
  nightLamp(x, z, 3.4, head);
}
/** Lampu taman bergaya klasik (tiang hijau, kap kaca bundar). */
function parkLamp(x, z) {
  const l = new THREE.Group();
  add(l, new THREE.CylinderGeometry(0.05, 0.08, 2.5, 6), mat(0x2f4a3a), 0, 1.25, 0);
  add(l, new THREE.CylinderGeometry(0.16, 0.12, 0.12, 8), mat(0x2f4a3a), 0, 2.55, 0, false);
  const head = add(l, new THREE.SphereGeometry(0.24, 10, 8), glow(0xfff0c8, 0.5), 0, 2.8, 0, false);
  add(l, new THREE.ConeGeometry(0.2, 0.16, 8), mat(0x2f4a3a), 0, 3.08, 0, false);
  l.position.set(x, 0, z);
  Game.worldGroup.add(l);
  blockPost(x, z, 0.12);
  nightLamp(x, z, 2.8, head, { pool: 2.8, power: 10, range: 9, color: 0xffd894 });
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
// ── Air beranimasi (Elbe & kanal) ────────────────────────────────
// Fungsi animasi kota (air, busa, kapal, mercusuar) — dijalankan lewat
// World._updateRiver, dikosongkan setiap kali kota dibangun ulang.
const _anims = [];
const WATER = {
  elbe:  { edge: '#5fc2e4', mid: '#3d9dd2', deep: '#2b79b5' },
  kanal: { edge: '#66c6e6', mid: '#4aaad9', deep: '#3b93c9' },
};
function rng(seed) { let v = (seed * 9301 + 49297) % 233280 || 1; return () => (v = (v * 16807) % 2147483647) / 2147483647; }
const isNightNow = () => document.body.classList.contains('is-night');

/** Tekstur air yang bisa diulang ke samping: gradasi tepi→tengah + riak terang. */
function waterCanvas(seed, colors) {
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const r = rng(seed);
  if (colors) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, colors.edge); g.addColorStop(0.22, colors.mid); g.addColorStop(0.5, colors.deep);
    g.addColorStop(0.78, colors.mid); g.addColorStop(1, colors.edge);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {                   // bidang gelap lembut (kedalaman)
      ctx.fillStyle = `rgba(10,50,95,${0.04 + r() * 0.07})`;
      const x = r() * W, y = 30 + r() * (H - 60), rx = 18 + r() * 50, ry = 4 + r() * 9;
      for (const dx of [0, -W, W]) { ctx.beginPath(); ctx.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  for (let i = 0; i < (colors ? 64 : 44); i++) {     // riak terang
    const x = r() * W, y = 6 + r() * (H - 12), len = 10 + r() * 44, th = 0.8 + r() * 1.9;
    ctx.fillStyle = `rgba(235,250,255,${(colors ? 0.1 : 0.34) + r() * 0.3})`;
    for (const dx of [0, -W]) { ctx.beginPath(); ctx.ellipse(x + dx + len / 2, y, len / 2, th, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * Permukaan air beranimasi + kaimauer batu bertutup dan garis busa.
 * o.gaps: [[x0, x1, sisi?], …] — kaimauer dipotong (jembatan, teras);
 *         sisi -1 = tepi utara, +1 = tepi selatan, kosong = keduanya.
 * o.south: 'wall' (default) atau 'natural' (tepi berpasir tanpa tembok).
 */
function water(x0, z0, x1, z1, o = {}) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const tile = o.tile || 10, seed = o.seed || 11, flow = o.flow ?? 0.008;
  const tex = waterCanvas(seed, o.colors || WATER.elbe);
  tex.repeat.set(w / tile, 1);
  const surf = flat(w, d, new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.3, metalness: 0.05, emissive: 0x0b5f8f, emissiveIntensity: 0.2,
  }), cx, cz, 0.035);
  surf.name = o.name || 'wasser';
  const sh = waterCanvas(seed + 5, null);
  sh.repeat.set(w / (tile * 0.7), 1);
  const shMat = new THREE.MeshBasicMaterial({ map: sh, transparent: true, opacity: 0.42, depthWrite: false });
  flat(w, d, shMat, cx, cz, 0.04);
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, depthWrite: false });
  _anims.push((dt, t) => {
    tex.offset.x = (t * flow) % 1;
    sh.offset.x = (t * flow * 1.8) % 1;
    const night = isNightNow();
    shMat.opacity = (night ? 0.1 : 0.4) + Math.sin(t * 0.9) * 0.05;
    foamMat.opacity = (night ? 0.07 : 0.24) + Math.sin(t * 1.6) * 0.06;
  });
  for (const [zz, side] of [[z0, -1], [z1, 1]]) {
    const segs = [];
    let xa = x0;
    for (const [g0, g1, gs] of (o.gaps || []).slice().sort((a, b) => a[0] - b[0])) {
      if (gs && gs !== side) continue;
      if (g0 > xa) segs.push([xa, g0]);
      xa = Math.max(xa, g1);
    }
    if (xa < x1) segs.push([xa, x1]);
    const natural = side > 0 && o.south === 'natural';
    for (const [a, b] of segs) {
      const sw = b - a, sx = (a + b) / 2;
      if (natural) {
        flat(sw, 0.9, 0xd8c79c, sx, zz + 0.3, 0.03);                         // pasir
        flat(sw, 0.3, foamMat, sx, zz - 0.12, 0.045);
        continue;
      }
      add(Game.worldGroup, B(sw, 0.3, 0.46), mat(0x8c867b), sx, 0.15, zz, false);           // tembok
      add(Game.worldGroup, B(sw, 0.07, 0.56), mat(0xbdb6a8), sx, 0.33, zz - side * 0.02, false); // batu tutup
      flat(sw, 0.26, foamMat, sx, zz - side * 0.38, 0.045);                                  // busa
    }
  }
  return surf;
}
function bridge(cx, z0, z1, width, name, o = {}) {
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
  // Tiang lentera di ujung jembatan — mudah dikenali, juga di malam hari
  const ends = o.lanterns === 'north' ? [-1] : o.lanterns === false ? [] : [-1, 1];
  for (const e of ends) for (const s of [-1, 1]) {
    const px = s * (width / 2 + 0.05), pz = e * (len / 2 - 0.1);
    add(g, B(0.3, 1.3, 0.3), mat(0x9a948a), px, 0.65, pz);
    add(g, B(0.38, 0.08, 0.38), mat(0xbdb6a8), px, 1.34, pz, false);
    const head = add(g, B(0.22, 0.3, 0.22), glow(0xffe2a0, 0.55), px, 1.55, pz, false);
    add(g, new THREE.ConeGeometry(0.22, 0.18, 4), mat(0x2f3438), px, 1.79, pz, false).rotation.y = Math.PI / 4;
    nightLamp(cx + px, (z0 + z1) / 2 + pz, 1.5, head, { pool: 2.2, power: 7, range: 7, color: 0xffd894 });
  }
  // Jembatan panjang (Alte Brücke di atas Elbe) bertumpu pada pilar batu
  if (len > 7) {
    const n = Math.round(len / 3.6);
    for (let i = 1; i < n; i++) {
      const pz = -len / 2 + i * len / n;
      add(g, B(width + 0.3, 0.5, 0.8), mat(0x8c867b), 0, -0.12, pz, false);
      for (const s of [-1, 1]) {                       // pemecah arus runcing
        const cw = add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.5, 4), mat(0x8c867b), s * (width / 2 + 0.15), -0.12, pz, false);
        cw.rotation.y = Math.PI / 4;
      }
      add(g, B(width + 0.4, 0.08, 0.9), mat(0xbdb6a8), 0, 0.15, pz, false);
    }
  }
  g.position.set(cx, 0, (z0 + z1) / 2);
  g.name = name;
  Game.worldGroup.add(g);
  // Pagar jembatan tidak bisa ditembus (air di bawahnya juga diblok)
  for (const s of [-1, 1]) blockBox(cx + s * width / 2 - 0.12, z0, cx + s * width / 2 + 0.12, z1, `${name}-rail`, 1.1);
}

// ═══════════════════════════════════════════════════════════════════
// HALTESTELLE, ELBBLICK, BOOT, PINTU MASUK
// ═══════════════════════════════════════════════════════════════════

/** Halte bus beratap kaca menghadap Hauptstraße (utara) + tiang "H". */
function busStop(x, z) {
  const g = new THREE.Group(); g.name = 'haltestelle';
  const steel = mat(0x4a5560);
  for (const sx of [-1.55, 1.55]) for (const sz of [-0.55, 0.55]) add(g, B(0.1, 2.5, 0.1), steel, sx, 1.25, sz);
  add(g, B(3.5, 0.12, 1.5), mat(0x2e7d4f), 0, 2.56, 0);                   // atap hijau
  add(g, B(3.2, 1.9, 0.05), glassMat(), 0, 1.25, 0.6, false);              // dinding kaca belakang
  for (const sx of [-1.55, 1.55]) add(g, B(0.05, 1.6, 1.0), glassMat(), sx, 1.15, 0.05, false);
  add(g, B(2.4, 0.08, 0.42), mat(0x9a6a3a), 0, 0.5, 0.3);                  // bangku
  for (const sx of [-1, 1]) add(g, B(0.06, 0.5, 0.36), steel, sx, 0.25, 0.3, false);
  const fahrplan = signBoard('Linie 5 · Hauptstraße', 1.3, 0.34, { bg: '#2e7d4f', fg: '#ffffff' });
  fahrplan.position.set(-0.8, 1.75, 0.56); g.add(fahrplan);
  const roofLight = add(g, B(2.6, 0.05, 0.2), glow(0xf6f2dc, 0.4), 0, 2.48, 0, false);
  g.position.set(x, 0, z);
  Game.worldGroup.add(g);
  blockBox(x - 1.7, z + 0.45, x + 1.7, z + 0.75, 'haltestelle', 2.5);
  for (const sx of [-1.55, 1.55]) blockPost(x + sx, z - 0.55, 0.12);
  nightLamp(x, z - 0.2, 2.4, roofLight, { pool: 2.6, power: 9, range: 8, color: 0xfff1d0 });
  // Tiang H (Haltestelle) di tepi trotoar
  const p = new THREE.Group();
  add(p, new THREE.CylinderGeometry(0.06, 0.06, 2.9, 6), mat(0x8a8f96), 0, 1.45, 0);
  const h = add(p, new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20), mat(0xf6d500), 0, 2.85, 0, false);
  h.rotation.x = Math.PI / 2;
  const hs = signPlane('H', 0.55, 0.55, { bg: '#f6d500', fg: '#1f7a3e', scale: 0.8 });
  hs.position.set(0, 2.85, 0.035); p.add(hs);
  const hs2 = signPlane('H', 0.55, 0.55, { bg: '#f6d500', fg: '#1f7a3e', scale: 0.8 });
  hs2.position.set(0, 2.85, -0.035); hs2.rotation.y = Math.PI; p.add(hs2);
  p.rotation.y = Math.PI / 4;
  p.position.set(x - 2.4, 0, z - 1.0);
  Game.worldGroup.add(p);
  blockPost(x - 2.4, z - 1.0, 0.12);
}

// ── Tekstur kecil untuk Elbblick ──────────────────────────────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** Bendera Hamburg: merah dengan benteng putih bermenara tiga. */
function hamburgFlagTex() {
  return canvasTex(192, 128, (x, W, H) => {
    x.fillStyle = '#c8102e'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffffff';
    x.fillRect(52, 70, 88, 34);                                  // tembok
    x.fillRect(84, 34, 24, 40);                                  // menara tengah
    x.fillRect(58, 50, 18, 24); x.fillRect(116, 50, 18, 24);     // menara samping
    for (const [tx, ty, tw] of [[84, 34, 24], [58, 50, 18], [116, 50, 18]]) {
      for (let i = 0; i < 3; i++) x.fillRect(tx + i * tw / 3 + 1, ty - 7, tw / 3 - 3, 8);   // kerucut/gerigi
    }
    x.fillStyle = '#c8102e';
    x.beginPath(); x.arc(96, 104, 11, Math.PI, 0); x.fillRect(85, 92, 22, 12); x.fill();       // gerbang
  });
}
/** Mawar angin untuk lantai teras. */
function compassTex() {
  return canvasTex(256, 256, (x, W) => {
    const c = W / 2;
    x.fillStyle = '#d9cdb5'; x.fillRect(0, 0, W, W);
    x.strokeStyle = '#8a7a5e'; x.lineWidth = 6; x.beginPath(); x.arc(c, c, 118, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(c, c, 100, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, long = i % 2 === 0 ? 96 : 60;
      x.fillStyle = i % 2 === 0 ? '#2b5f8e' : '#8a7a5e';
      x.beginPath();
      x.moveTo(c + Math.sin(a) * long, c - Math.cos(a) * long);
      x.lineTo(c + Math.sin(a + 0.32) * 18, c - Math.cos(a + 0.32) * 18);
      x.lineTo(c, c);
      x.lineTo(c + Math.sin(a - 0.32) * 18, c - Math.cos(a - 0.32) * 18);
      x.closePath(); x.fill();
    }
    x.fillStyle = '#c8102e'; x.beginPath(); x.arc(c, c, 10, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3a2e1e'; x.font = 'bold 28px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('N', c, 18); x.fillText('S', c, W - 18); x.fillText('O', W - 18, c); x.fillText('W', 18, c);
  });
}
/** Papan informasi Elbblick: judul, gambar sungai dengan kapal & mercusuar. */
function elbInfoTex() {
  return canvasTex(384, 256, (x, W, H) => {
    x.fillStyle = '#f3ead6'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1f4f96'; x.fillRect(0, 0, W, 58);
    x.fillStyle = '#ffffff'; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ELBBLICK', W / 2, 31);
    x.fillStyle = '#9fd3ee'; x.fillRect(22, 74, W - 44, 120);                         // langit
    x.fillStyle = '#3d8ec4'; x.fillRect(22, 150, W - 44, 44);                         // Elbe
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) x.fillRect(32 + i * 38, 166 + (i % 2) * 10, 20, 3);  // riak
    x.fillStyle = '#7bb661'; x.fillRect(22, 138, W - 44, 12);                          // tepi seberang
    x.fillStyle = '#c0392b'; x.fillRect(300, 92, 14, 46); x.fillStyle = '#ffffff'; x.fillRect(300, 104, 14, 10); x.fillRect(300, 124, 14, 8);
    x.fillStyle = '#ffd34d'; x.fillRect(298, 84, 18, 8);                              // mercusuar
    x.fillStyle = '#1d3557'; x.beginPath(); x.moveTo(70, 150); x.lineTo(190, 150); x.lineTo(176, 166); x.lineTo(84, 166); x.closePath(); x.fill();
    x.fillStyle = '#ffffff'; x.fillRect(96, 132, 66, 18); x.fillRect(116, 122, 26, 10);   // kapal feri
    x.fillStyle = '#3a2e1e'; x.font = '20px Georgia, serif';
    x.fillText('Die Elbe fließt bis zur Nordsee.', W / 2, 220);
    x.font = 'italic 16px Georgia, serif';
    x.fillText('Sungai Elbe mengalir sampai Laut Utara', W / 2, 243);
  });
}

/**
 * Elbblick — teras setengah lingkaran yang menjorok ke Elbe: lantai batu
 * dengan mawar angin, pagar besi melengkung, dua teropong koin, tiang
 * bendera Hamburg, papan informasi, dan lentera di kedua sisi masuk.
 * cx = pusat, zq = garis kaimauer utara (riverN).
 */
function elbblick(cx, zq) {
  const g = new THREE.Group(); g.name = 'elbblick';
  const R = 2.6;
  const HALF = [-Math.PI / 2, Math.PI];      // setengah lingkaran ke arah +z (sungai)
  add(g, new THREE.CylinderGeometry(R + 0.2, R + 0.4, 0.55, 40, 1, false, ...HALF), mat(0x8c867b), 0, -0.22, 0, false);
  const pav = canvasTex(256, 256, (x, W) => {
    x.fillStyle = '#d6cbb4'; x.fillRect(0, 0, W, W);
    x.strokeStyle = 'rgba(120,105,80,0.45)'; x.lineWidth = 2;
    for (let r = 20; r < 180; r += 22) { x.beginPath(); x.arc(W / 2, W / 2, r, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * 40, W / 2 + Math.sin(a) * 40); x.lineTo(W / 2 + Math.cos(a) * 180, W / 2 + Math.sin(a) * 180); x.stroke(); }
  });
  const deck = add(g, new THREE.CylinderGeometry(R, R, 0.06, 40, 1, false, ...HALF),
    new THREE.MeshLambertMaterial({ map: pav }), 0, 0.05, 0, false);
  World.walkables.push(deck);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(1.05, 36), new THREE.MeshLambertMaterial({ map: compassTex() }));
  rose.rotation.x = -Math.PI / 2; rose.position.set(0, 0.085, 1.05); g.add(rose);
  // Tepi batu (coping) melengkung + pagar besi dua palang
  add(g, new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.24, 40, 1, true, ...HALF), mat(0xa8a092), 0, 0.12, 0, false);
  const cap = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R + 0.16, 40, 1, Math.PI, Math.PI), mat(0xbdb6a8));
  cap.material.side = THREE.DoubleSide;
  cap.rotation.x = -Math.PI / 2; cap.position.y = 0.245; g.add(cap);
  const iron = mat(0x2f3438);
  const RP = R + 0.02;
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 12;
    add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), iron, Math.sin(a) * RP, 0.72, Math.cos(a) * RP, false);
  }
  for (const y of [1.18, 0.72]) {
    const rail = add(g, new THREE.TorusGeometry(RP, y > 1 ? 0.04 : 0.025, 6, 48, Math.PI), iron, 0, y, 0, false);
    rail.rotation.x = Math.PI / 2;
  }
  // Teropong koin, menghadap sungai
  for (const a of [-0.55, 0.55]) {
    const px = Math.sin(a) * 1.95, pz = Math.cos(a) * 1.95;
    const t = new THREE.Group();
    add(t, new THREE.CylinderGeometry(0.07, 0.12, 0.95, 8), mat(0x2e6f78), 0, 0.5, 0);
    add(t, new THREE.SphereGeometry(0.13, 10, 8), mat(0x2e6f78), 0, 1.0, 0, false);
    const body = add(t, new THREE.CylinderGeometry(0.17, 0.12, 0.62, 10), mat(0x3f97a3), 0, 1.12, 0.08);
    body.rotation.x = Math.PI / 2 - 0.22;
    for (const s of [-1, 1]) add(t, new THREE.CylinderGeometry(0.045, 0.045, 0.14, 8), mat(0x1d2a2e), s * 0.06, 1.05, -0.24, false).rotation.x = Math.PI / 2;
    t.position.set(px, 0.08, pz); t.rotation.y = a;
    g.add(t);
    blockPost(cx + px, zq + pz, 0.2);
  }
  // Tiang bendera (timur) dengan bendera Hamburg yang berkibar
  const pole = new THREE.Group();
  add(pole, new THREE.CylinderGeometry(0.045, 0.06, 4.4, 8), mat(0xf2f2ee), 0, 2.2, 0);
  add(pole, new THREE.SphereGeometry(0.08, 8, 6), mat(0xd4af37), 0, 4.45, 0, false);
  const flagMat = new THREE.MeshLambertMaterial({ map: hamburgFlagTex(), side: THREE.DoubleSide });
  const flagGeo = new THREE.PlaneGeometry(1.2, 0.8, 8, 1); flagGeo.translate(0.6, 0, 0);
  const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.05, 3.95, 0); pole.add(flag);
  const fp = flagGeo.attributes.position, fx0 = Float32Array.from(fp.array);
  pole.position.set(R + 0.55, 0, -0.55); g.add(pole);
  blockPost(cx + R + 0.55, zq - 0.55, 0.14);
  _anims.push((dt, t) => {
    for (let i = 0; i < fp.count; i++) {
      const x = fx0[i * 3];
      fp.setZ(i, Math.sin(t * 3.2 - x * 4) * 0.09 * x);
    }
    fp.needsUpdate = true;
  });
  // Papan informasi (barat), condong ke arah kamera supaya terbaca
  const info = new THREE.Group();
  for (const s of [-1, 1]) add(info, new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), mat(0x5a4630), s * 0.86, 0.85, 0);
  add(info, B(1.92, 1.28, 0.08), mat(0x5a4630), 0, 1.35, 0, false);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshBasicMaterial({ map: elbInfoTex() }));
  board.position.set(0, 1.35, 0.045); info.add(board);
  add(info, B(2.1, 0.08, 0.3), mat(0x5a4630), 0, 2.03, 0.05, false);
  info.position.set(-R - 1.0, 0, -0.75); info.rotation.y = 0.45; g.add(info);
  blockBox(cx - R - 1.95, zq - 1.1, cx - R - 0.05, zq - 0.4, 'elbblick-info', 2);
  // Lentera di kedua ujung pagar (pintu masuk teras)
  for (const s of [-1, 1]) {
    const l = new THREE.Group();
    add(l, B(0.32, 0.5, 0.32), mat(0x9a948a), 0, 0.25, 0);
    add(l, new THREE.CylinderGeometry(0.05, 0.06, 1.4, 6), iron, 0, 1.2, 0);
    const head = add(l, new THREE.CylinderGeometry(0.15, 0.11, 0.32, 6), glow(0xffe2a0, 0.55), 0, 2.02, 0, false);
    add(l, new THREE.ConeGeometry(0.2, 0.2, 6), iron, 0, 2.28, 0, false);
    l.position.set(s * (R + 0.05), 0, 0.12); g.add(l);
    blockPost(cx + s * (R + 0.05), zq + 0.12, 0.22);
    nightLamp(cx + s * (R + 0.05), zq + 0.12, 2.0, head, { pool: 2.2, power: 8, range: 7, color: 0xffd894 });
  }
  // Pot bunga di depan papan & tiang bendera
  for (const [px, pz] of [[-R - 2.25, -0.2], [R + 1.3, -0.25]]) {
    add(g, new THREE.CylinderGeometry(0.32, 0.26, 0.4, 8), mat(0x9a5a3a), px, 0.2, pz);
    for (let i = 0; i < 7; i++) add(g, new THREE.IcosahedronGeometry(0.1, 0), mat([0xe84a5f, 0xffd34d, 0xffffff][i % 3]),
      px + Math.cos(i * 0.9) * 0.18, 0.46 + (i % 2) * 0.06, pz + Math.sin(i * 0.9) * 0.18, false);
    blockPost(cx + px, zq + pz, 0.32);
  }
  g.position.set(cx, 0, zq);
  Game.worldGroup.add(g);
  // Pagar teras = tumbukan: tiang rapat di sepanjang busur
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 12;
    blockPost(cx + Math.sin(a) * (R + 0.15), zq + Math.cos(a) * (R + 0.15), 0.2);
  }
}

// ── Pagar kaimauer & dermaga ──────────────────────────────────────
/** Pagar besi rendah di atas kaimauer (satu InstancedMesh per ruas). */
function quayRail(x0, x1, z, gaps = []) {
  const iron = mat(0x2f3a3a);
  const segs = [];
  let xa = x0;
  for (const [g0, g1] of gaps.slice().sort((a, b) => a[0] - b[0])) { if (g0 > xa) segs.push([xa, g0]); xa = Math.max(xa, g1); }
  if (xa < x1) segs.push([xa, x1]);
  const posts = [];
  for (const [a, b] of segs) {
    const n = Math.max(1, Math.round((b - a) / 1.6));
    for (let i = 0; i <= n; i++) posts.push(a + (b - a) * i / n);
    for (const y of [1.16, 0.78]) add(Game.worldGroup, B(b - a, y > 1 ? 0.07 : 0.04, y > 1 ? 0.08 : 0.04), iron, (a + b) / 2, y, z, false);
  }
  const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.045, 0.82, 6), iron, posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach((px, i) => { m4.makeTranslation(px, 0.78, z); inst.setMatrixAt(i, m4); });
  Game.worldGroup.add(inst);
}

/** Ponton Fähre (dermaga apung) dengan jembatan penghubung & halte kecil. */
function pontoon(cx, zq, label) {
  const g = new THREE.Group(); g.name = 'anleger';
  const L = 5;
  add(g, B(L, 0.34, 1.3), mat(0x56616b), 0, 0.12, 1.7, false);                 // badan apung
  add(g, B(L - 0.1, 0.04, 1.2), mat(0x9a8668), 0, 0.31, 1.7, false);           // lantai papan
  add(g, B(L, 0.08, 0.08), mat(0xf2c230), 0, 0.33, 2.33, false);                // tepi kuning
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.08, 0.1, 0.32, 8), mat(0x222222), s * (L / 2 - 0.35), 0.46, 2.2, false);
  // Jembatan penghubung miring dari kaimauer
  const ramp = add(g, B(1.0, 0.06, 1.3), mat(0x7a7f86), 0, 0.36, 0.45, false);
  ramp.rotation.x = 0.05;
  for (const s of [-1, 1]) add(g, B(0.05, 0.05, 1.3), mat(0xeeeeee), s * 0.5, 0.95, 0.45, false);
  // Halte beratap di ponton
  for (const sx of [-1.6, 0.2]) for (const sz of [1.25, 2.1]) add(g, B(0.08, 1.7, 0.08), mat(0xeeeeee), sx, 1.18, sz, false);
  add(g, B(2.2, 0.1, 1.15), mat(0x1f4f96), -0.7, 2.06, 1.68, false);
  add(g, B(1.7, 0.08, 0.32), mat(0x9a6a3a), -0.7, 0.72, 1.35, false);           // bangku
  const sign = signBoard(`Fähre · ${label}`, 1.9, 0.38, { bg: '#1f4f96', fg: '#ffffff', both: true });
  sign.position.set(-0.7, 2.38, 1.68); g.add(sign);
  // Pelampung oranye
  const ring = add(g, new THREE.TorusGeometry(0.2, 0.06, 6, 14), mat(0xff7a1a), 1.6, 0.85, 1.12, false);
  add(g, B(0.06, 0.9, 0.06), mat(0xeeeeee), 1.6, 0.75, 1.08, false);
  ring.rotation.y = 0;
  g.position.set(cx, 0, zq);
  Game.worldGroup.add(g);
  // Rantai penutup di ujung jembatan (pemain tetap di promenade)
  for (const s of [-1, 1]) add(Game.worldGroup, new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), mat(0x2f3a3a), cx + s * 0.55, 0.4, zq - 0.25, false);
  add(Game.worldGroup, B(1.1, 0.05, 0.05), mat(0xd62828), cx, 0.62, zq - 0.25, false);
}

// ── Kapal-kapal di Elbe ───────────────────────────────────────────
/** Feri pelabuhan (dua ujung sama) — lambung biru tua, kabin putih, dek atas. */
function makeFerry(name = 'Elbe 7') {
  const g = new THREE.Group(); g.name = 'faehre';
  const L = 4.6, Bw = 1.5;
  const hull = mat(0x1d3557), white = mat(0xf4f4f0);
  add(g, B(L, 0.55, Bw), hull, 0, 0.12, 0);
  for (const s of [-1, 1]) {
    const end = add(g, new THREE.CylinderGeometry(Bw / 2, Bw / 2 - 0.12, 0.55, 14, 1, false, s > 0 ? 0 : Math.PI, Math.PI), hull, s * L / 2, 0.12, 0);
    end.scale.x = 1.25;
    const band = add(g, new THREE.CylinderGeometry(Bw / 2 + 0.01, Bw / 2 + 0.01, 0.09, 14, 1, false, s > 0 ? 0 : Math.PI, Math.PI), mat(0xc0392b), s * L / 2, -0.06, 0, false);
    band.scale.x = 1.25;
  }
  add(g, B(L + 0.02, 0.09, Bw + 0.02), mat(0xc0392b), 0, -0.06, 0, false);       // garis air merah
  add(g, B(L + 0.02, 0.07, Bw + 0.02), white, 0, 0.36, 0, false);                 // garis putih
  add(g, B(L + 1.0, 0.05, Bw - 0.1), mat(0x7a6a55), 0, 0.42, 0, false);           // dek
  // Kabin panjang berjendela lebar
  add(g, B(3.4, 0.8, Bw - 0.25), white, 0, 0.84, 0);
  for (const s of [-1, 1]) add(g, B(3.0, 0.36, 0.02), glassMat(), 0, 0.9, s * (Bw - 0.25) / 2 + s * 0.012, false);
  for (const s of [-1, 1]) add(g, B(0.02, 0.36, 0.9), glassMat(), s * 1.71, 0.9, 0, false);
  // Dek atas dengan pagar + ruang kemudi di tengah
  add(g, B(3.6, 0.06, Bw - 0.15), mat(0xdedcd4), 0, 1.27, 0, false);
  for (const s of [-1, 1]) {
    add(g, B(3.6, 0.04, 0.04), white, 0, 1.58, s * (Bw - 0.2) / 2, false);
    for (let i = -4; i <= 4; i++) add(g, B(0.03, 0.3, 0.03), white, i * 0.44, 1.43, s * (Bw - 0.2) / 2, false);
  }
  add(g, B(1.0, 0.6, 0.8), white, 0, 1.6, 0);
  add(g, B(1.02, 0.24, 0.82), glassMat(), 0, 1.72, 0, false);
  add(g, B(1.2, 0.07, 0.95), mat(0x1d3557), 0, 1.93, 0, false);
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), mat(0x555555), 0, 2.38, 0, false);
  add(g, new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }), 0, 2.85, 0, false);
  // Bangku penumpang di dek atas
  for (const x of [-1.25, 1.25]) add(g, B(0.7, 0.14, 0.9), mat(0x9a6a3a), x, 1.38, 0, false);
  // Pelampung & papan nama di kedua sisi
  for (const s of [-1, 1]) {
    const lr = add(g, new THREE.TorusGeometry(0.13, 0.04, 6, 12), mat(0xff7a1a), 0.9, 0.86, s * ((Bw - 0.25) / 2 + 0.05), false);
    lr.rotation.y = 0;
    const plate = signPlane(name, 1.0, 0.2, { bg: '#1d3557', fg: '#ffffff' });
    plate.position.set(-0.4, 0.15, s * (Bw / 2 + 0.012)); if (s < 0) plate.rotation.y = Math.PI;
    g.add(plate);
  }
  // Lampu navigasi merah/hijau
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff3b30 : 0x34c759 }), 0, 1.98, s * 0.5, false);
  return g;
}

/** Perahu layar kecil berlabuh, layar putih bergaris merah. */
function makeSailboat() {
  const g = new THREE.Group(); g.name = 'segelboot';
  add(g, B(1.7, 0.35, 0.78), mat(0xf7f7f2), 0, 0.12, 0);
  const bow = add(g, new THREE.CylinderGeometry(0.39, 0.3, 0.35, 10, 1, false, 0, Math.PI), mat(0xf7f7f2), 0.85, 0.12, 0);
  bow.scale.x = 1.6;
  add(g, B(1.72, 0.06, 0.8), mat(0x1f4f96), 0, -0.02, 0, false);
  add(g, B(1.5, 0.04, 0.6), mat(0xb08a5a), 0.1, 0.31, 0, false);
  add(g, new THREE.CylinderGeometry(0.03, 0.035, 2.9, 6), mat(0xdddddd), 0.15, 1.75, 0, false);
  add(g, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), mat(0xdddddd), -0.5, 0.75, 0, false).rotation.z = Math.PI / 2;
  const sailMat = new THREE.MeshLambertMaterial({ color: 0xfbfbf6, side: THREE.DoubleSide });
  const main = new THREE.Shape(); main.moveTo(0, 0); main.lineTo(-1.25, 0); main.lineTo(0, 2.6); main.closePath();
  const ms = new THREE.Mesh(new THREE.ShapeGeometry(main), sailMat); ms.position.set(0.12, 0.8, 0); g.add(ms);
  const jib = new THREE.Shape(); jib.moveTo(0, 0); jib.lineTo(0.95, 0); jib.lineTo(0, 2.2); jib.closePath();
  const js = new THREE.Mesh(new THREE.ShapeGeometry(jib), sailMat); js.position.set(0.2, 0.75, 0.01); g.add(js);
  const stripe = new THREE.Shape(); stripe.moveTo(0, 0.55); stripe.lineTo(-0.99, 0.55); stripe.lineTo(-0.92, 0.7); stripe.lineTo(0, 0.7); stripe.closePath();
  const st = new THREE.Mesh(new THREE.ShapeGeometry(stripe), new THREE.MeshLambertMaterial({ color: 0xc0392b, side: THREE.DoubleSide }));
  st.position.set(0.12, 0.8, 0.005); g.add(st);
  return g;
}

/** Barkasse — perahu wisata pelabuhan: lambung kayu, kabin rendah, tenda belang. */
function makeBarkasse() {
  const g = new THREE.Group(); g.name = 'barkasse';
  const L = 3.0, Bw = 0.95;
  const wood = mat(0x6b4426);
  add(g, B(L, 0.45, Bw), wood, 0, 0.12, 0);
  for (const s of [-1, 1]) {
    const e = add(g, new THREE.CylinderGeometry(Bw / 2, Bw / 2 - 0.08, 0.45, 12, 1, false, s > 0 ? 0 : Math.PI, Math.PI), wood, s * L / 2, 0.12, 0);
    e.scale.x = s > 0 ? 1.7 : 0.7;
  }
  add(g, B(L + 0.02, 0.1, Bw + 0.02), mat(0x1a1a1a), 0, -0.05, 0, false);
  add(g, B(L + 0.02, 0.05, Bw + 0.02), mat(0xf4f4f0), 0, 0.33, 0, false);
  add(g, B(1.3, 0.42, 0.8), mat(0xf4f4f0), 0.45, 0.55, 0);
  for (const s of [-1, 1]) add(g, B(1.1, 0.18, 0.02), glassMat(), 0.45, 0.6, s * 0.41, false);
  add(g, B(1.4, 0.05, 0.9), mat(0x7a2f2f), 0.45, 0.78, 0, false);
  // Tenda belang merah-putih di dek belakang
  for (let i = 0; i < 4; i++) add(g, B(0.25, 0.04, 0.86), mat(i % 2 ? 0xffffff : 0xd62828), -0.55 - i * 0.25, 0.92, 0, false);
  for (const sx of [-0.45, -1.4]) for (const sz of [-0.38, 0.38]) add(g, B(0.03, 0.6, 0.03), mat(0xeeeeee), sx, 0.62, sz, false);
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), mat(0xdddddd), -1.5, 0.7, 0, false);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshLambertMaterial({ map: hamburgFlagTex(), side: THREE.DoubleSide }));
  fl.position.set(-1.67, 0.9, 0); g.add(fl);
  return g;
}

/** Feri bolak-balik antar dua ponton: keluar ke jalur, melaju, merapat, menunggu. */
function runFerry(g, xa, xb, dockZ, laneZ) {
  const T = Math.abs(xb - xa) / 1.8 + 5, WAIT = 7;
  let phase = 'wait', time = 3, dir = 1;
  _anims.push((dt, t) => {
    time += dt;
    let x = dir > 0 ? xa : xb, z = dockZ, yaw = 0;
    if (phase === 'wait' && time > WAIT) { phase = 'go'; time = 0; }
    if (phase === 'go') {
      const s = Math.min(1, time / T);
      const e = s * s * (3 - 2 * s);
      x = dir > 0 ? xa + (xb - xa) * e : xb + (xa - xb) * e;
      const k = Math.min(1, Math.min(s, 1 - s) / 0.2);
      z = dockZ + (laneZ - dockZ) * k * k * (3 - 2 * k);
      yaw = (s < 0.2 ? 1 : s > 0.8 ? -1 : 0) * Math.sin(Math.PI * k) * 0.12 * -dir;
      if (s >= 1) { phase = 'wait'; time = 0; dir = -dir; }
    }
    g.position.set(x, Math.sin(t * 1.6) * 0.03, z);
    g.rotation.set(0, yaw, Math.sin(t * 1.1) * 0.015);
  });
}

/** Perahu berkeliling pada lintasan "stadion" (dua jalur lurus + dua putaran). */
function runLoop(g, x0, x1, zA, zB, speed) {
  const r = Math.abs(zB - zA) / 2, zm = (zA + zB) / 2, straight = x1 - x0, arc = Math.PI * r;
  const total = 2 * straight + 2 * arc;
  let d = straight * 0.35;
  _anims.push((dt, t) => {
    d = (d + dt * speed) % total;
    let x, z, h;
    if (d < straight) { x = x0 + d; z = zA; h = 0; }
    else if (d < straight + arc) { const a = (d - straight) / r; x = x1 + Math.sin(a) * r; z = zm - Math.cos(a) * r * Math.sign(zm - zA); h = -a * Math.sign(zB - zA); }
    else if (d < 2 * straight + arc) { x = x1 - (d - straight - arc); z = zB; h = Math.PI; }
    else { const a = (d - 2 * straight - arc) / r; x = x0 - Math.sin(a) * r; z = zm + Math.cos(a) * r * Math.sign(zm - zA); h = Math.PI - a * Math.sign(zB - zA); }
    g.position.set(x, Math.sin(t * 2.1) * 0.03, z);
    g.rotation.set(0, h, Math.sin(t * 1.4) * 0.03);
  });
}

/** Mercusuar merah-putih di tepi seberang; malam hari cahayanya berputar. */
function lighthouse(x, z) {
  const g = new THREE.Group(); g.name = 'leuchtturm';
  add(g, new THREE.CylinderGeometry(1.1, 1.3, 0.5, 10), mat(0x8c867b), 0, 0.25, 0);
  const rings = 5, hTower = 3.8;
  for (let i = 0; i < rings; i++) {
    const y0 = 0.5 + i * hTower / rings, r0 = 0.62 - i * 0.05, r1 = 0.62 - (i + 1) * 0.05;
    add(g, new THREE.CylinderGeometry(r1, r0, hTower / rings, 12), mat(i % 2 ? 0xffffff : 0xd62828), 0, y0 + hTower / rings / 2, 0);
  }
  add(g, new THREE.CylinderGeometry(0.6, 0.6, 0.08, 12), mat(0x2f3438), 0, 4.34, 0, false);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(g, B(0.03, 0.3, 0.03), mat(0x2f3438), Math.cos(a) * 0.56, 4.5, Math.sin(a) * 0.56, false); }
  const lampHead = add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.45, 10), glow(0xfff1b0, 0.5), 0, 4.62, 0, false);
  add(g, new THREE.ConeGeometry(0.42, 0.4, 10), mat(0xd62828), 0, 5.05, 0, false);
  add(g, new THREE.SphereGeometry(0.06, 6, 4), mat(0x2f3438), 0, 5.28, 0, false);
  add(g, B(0.3, 0.5, 0.05), mat(0x5a3a22), 0, 0.75, 0.62, false);                // pintu
  // Berkas cahaya (hanya malam): kerucut tipis yang berputar pelan
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const beamGeo = new THREE.ConeGeometry(0.9, 7, 12, 1, true); beamGeo.rotateZ(Math.PI / 2); beamGeo.translate(3.5, 0, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(0, 4.62, 0); beam.visible = false; g.add(beam);
  g.position.set(x, 0, z);
  Game.worldGroup.add(g);
  blockPost(x, z, 1.3);
  nightLamp(x, z, 4.6, lampHead, { noPool: true, power: 6, range: 9, color: 0xfff1b0 });
  _anims.push((dt, t) => {
    const night = isNightNow();
    beam.visible = night;
    if (night) beam.rotation.y = t * 0.6;
  });
}

/**
 * Tepi seberang Elbe: pasir, batu & alang-alang, jalan setapak dengan
 * lentera rendah, bangku, beberapa pohon rendah (tidak menutupi sungai),
 * jalan tanah lanjutan Alte Brücke ke arah rumah Oma, dan mercusuar.
 */
function elbeSouthBank(riverS, roadX) {
  const r = rng(77);
  flat(140, 1.3, 0xd9cdb2, 0, riverS + 2.6, 0.028);                              // jalan setapak
  flat(3.2, 30, 0xc9b48a, roadX, riverS + 15.8, 0.03);                            // jalan tanah ke rumah Oma
  // Batu & alang-alang di garis air (instanced)
  const stoneGeo = new THREE.IcosahedronGeometry(0.22, 0);
  const stones = new THREE.InstancedMesh(stoneGeo, mat(0x9a958c), 70);
  const reedGeo = new THREE.ConeGeometry(0.05, 0.9, 4); reedGeo.translate(0, 0.45, 0);
  const reeds = new THREE.InstancedMesh(reedGeo, mat(0x6f8f3a), 220);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let ns = 0, nr = 0;
  for (let i = 0; i < 400 && (ns < 70 || nr < 220); i++) {
    const x = -62 + r() * 124;
    if (Math.abs(x - roadX) < 3.6) continue;
    if (ns < 70 && r() < 0.35) {
      const s = 0.6 + r() * 1.1;
      e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e); v.set(x, 0.06, riverS + 0.1 + r() * 0.6); sc.set(s * 1.3, s * 0.6, s);
      stones.setMatrixAt(ns++, m4.compose(v, q, sc));
    }
    for (let k = 0; k < 3 && nr < 220; k++) {
      e.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4); q.setFromEuler(e);
      v.set(x + (r() - 0.5) * 0.5, 0, riverS + 0.55 + r() * 0.5); const s = 0.6 + r() * 0.7; sc.set(1, s, 1);
      reeds.setMatrixAt(nr++, m4.compose(v, q, sc));
    }
  }
  stones.count = ns; reeds.count = nr;
  Game.worldGroup.add(stones, reeds);
  // Lentera rendah & bangku menghadap sungai di jalan setapak
  for (const lx of [-40, -12, 8, 28, 48]) {
    const l = new THREE.Group();
    add(l, new THREE.CylinderGeometry(0.05, 0.07, 1.8, 6), mat(0x2f3a3a), 0, 0.9, 0);
    const head = add(l, B(0.22, 0.28, 0.22), glow(0xffe2a0, 0.5), 0, 1.92, 0, false);
    add(l, new THREE.ConeGeometry(0.2, 0.16, 4), mat(0x2f3a3a), 0, 2.14, 0, false).rotation.y = Math.PI / 4;
    l.position.set(lx, 0, riverS + 1.75); Game.worldGroup.add(l);
    nightLamp(lx, riverS + 1.75, 1.9, head, { pool: 2.0, power: 6, range: 6, color: 0xffd894 });
  }
  for (const bx of [-30, 0, 18, 38]) bench(bx, riverS + 1.6, Math.PI);
  // Pohon rendah di belakang jalan setapak
  for (let i = 0; i < 16; i++) {
    const tx = -58 + i * 7.8 + (r() - 0.5) * 3;
    if (Math.abs(tx - roadX) < 4.5 || Math.abs(tx - 52) < 3) continue;
    tree(tx, riverS + 4.4 + r() * 2.5, 0.75 + r() * 0.3, r() < 0.3 ? 'pine' : 'round');
  }
  lighthouse(52, riverS + 1.9);
}

/** Alas bercahaya + label di depan pintu gedung yang bisa dimasuki saat quest. */
function entrancePad(x, z, text) {
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.55, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.08, z);
  Game.worldGroup.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 4, 1),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4); ring.scale.set(1.25, 0.8, 1); ring.position.set(x, 0.09, z);
  Game.worldGroup.add(ring);
  const label = signBoard(text, 3.0, 0.5, { bg: '#2b1f4a', fg: '#ffe066', border: '#ffe066', both: true });
  label.position.set(x, 2.75, z + 1.7);
  Game.worldGroup.add(label);
  nightLamp(x, z, 2.4, null, { pool: 2.2, power: 6, range: 6, color: 0xffd34d });
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
  // Lampu taman tertata: empat di sudut diagonal plaza (di rumput, bukan di
  // jalur), lalu berpasangan di kedua tepi jalur utama — tidak ada yang
  // berdiri di tengah jalan.
  const PR = 3.7 / Math.SQRT2;                       // radius plaza + 0.5
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parkLamp(allee.x + sx * PR, cz + sz * PR);
  const edgeN = cz - 0.9 - 0.45, edgeS = cz + 0.9 + 0.45;   // 0,45 di luar tepi jalur
  for (const lx of [x0 + 6, allee.x - 8.5, allee.x + 8.5]) {
    parkLamp(lx, edgeN);
    parkLamp(lx, edgeS);
  }
  (World.fireflyAreas || (World.fireflyAreas = [])).push({ x0: x0 + 0.5, x1: x1 - 0.5, z0: z0 + 0.5, z1: z1 - 0.3, n: 30 });
}

// ═══════════════════════════════════════════════════════════════════
// BUILD
// ═══════════════════════════════════════════════════════════════════

export function buildStadt() {
  _mats = new Map(); _glass = null;
  _anims.length = 0;
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
  asphalt(eW, mainS, eE, lindS);                          // Bachstr. Süd (endet an Deichstr.)
  asphalt(eE, lindN, 70, lindS);                          // Deichstraße

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
  water(-70, canalN, 70, canalS, { colors: WATER.kanal, seed: 5, tile: 8, flow: 0.006, name: 'kanal',
    gaps: [[wW + 0.2, wE - 0.2], [eW + 0.2, eE - 0.2]] });
  blockBox(-70, canalN, wW + 0.2, canalS, 'kanal-w', 2);
  blockBox(wE - 0.2, canalN, eW + 0.2, canalS, 'kanal-m', 2);
  blockBox(eE - 0.2, canalN, 70, canalS, 'kanal-o', 2);
  bridge(WEST_X, canalN - 0.6, canalS + 0.6, RW - 0.4, 'kanalbruecke-west');
  bridge(EAST_X, canalN - 0.6, canalS + 0.6, RW - 0.4, 'kanalbruecke-ost');

  // ── Elbe: sungai lebar dengan Elbblick, dua ponton feri dan kapal ──
  const ELB_X = 37, PONT_W = -2, PONT_E = 26.5;
  water(-70, riverN, 70, riverS, { colors: WATER.elbe, seed: 11, tile: 11, flow: 0.01, name: 'elbe', south: 'natural',
    gaps: [[WEST_X - 2.7, WEST_X + 2.7], [ELB_X - 2.6, ELB_X + 2.6, -1]] });
  // Air tidak bisa dimasuki — kecuali teras Elbblick yang menjorok ke sungai
  blockBox(-70, riverN, wW + 0.4, riverS + 3, 'fluss-w', 2);
  blockBox(wE - 0.4, riverN, ELB_X - 2.7, riverS + 3, 'fluss-o1', 2);
  blockBox(ELB_X + 2.7, riverN, 70, riverS + 3, 'fluss-o2', 2);
  blockBox(ELB_X - 2.7, riverN + 2.9, ELB_X + 2.7, riverS + 3, 'fluss-o3', 2);
  bridge(WEST_X, riverN - 0.8, riverS + 0.8, RW - 0.8, 'alte-bruecke', { lanterns: 'north' });
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
  // Elbpromenade di tepi sungai (selatan Deichstraße & taman)
  flat(70 - 13.4, riverN - (lindS + SW), 0xcfc6b2, (13.4 + 70) / 2, (lindS + SW + riverN) / 2, 0.03, true);
  quayRail(wE + 0.3, 70, riverN - 0.05, [[PONT_W - 0.7, PONT_W + 0.7], [PONT_E - 0.7, PONT_E + 0.7], [ELB_X - 2.75, ELB_X + 2.75]]);
  for (const bx of [18.6, 24, 28.8]) bench(bx, riverN - 1.1, 0);
  for (const lx of [16, 21.2, 31.2]) lamp(lx, riverN - 0.6);
  elbblick(ELB_X, riverN);
  reg.elbblick = { x: ELB_X, z: riverN + 0.2, r: 3.2 };
  pontoon(PONT_W, riverN, 'Stadtpark');
  pontoon(PONT_E, riverN, 'Deichstraße');
  { // Kapal: feri bolak-balik, perahu layar berlabuh, Barkasse berkeliling
    const ferry = makeFerry('Elbe 7');
    Game.worldGroup.add(ferry);
    runFerry(ferry, PONT_W, PONT_E, riverN + 3.15, riverN + 4.4);
    const sail = makeSailboat();
    sail.position.set(4, 0, riverN + 6.2);
    Game.worldGroup.add(sail);
    _anims.push((dt, t) => {
      sail.position.y = Math.sin(t * 1.3) * 0.04;
      sail.rotation.set(0, 0.35 + Math.sin(t * 0.13) * 0.25, Math.sin(t * 0.9) * 0.05);
    });
    const bk = makeBarkasse();
    Game.worldGroup.add(bk);
    runLoop(bk, 12, 60, riverN + 6.6, riverN + 8.0, 1.3);
  }
  elbeSouthBank(riverS, WEST_X);

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
  // Tourist-Info (rendah) di sudut Bachstraße, Hotel (tinggi) lebih ke timur:
  // dari sudut kamera Hotel dulu menutupi Kanalbrücke menuju rumah Tante.
  regFront('tourismusbuero', place('tourismus', 27, -9, 'S'));
  regFront('hotel', place('hotel', 38, -10.5, 'S'));

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

  // — Tenggara: menghadap selatan ke Deichstraße —
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
  streetSign(eE + 0.8, lindN - 0.8, 'Deichstraße', 'Bachstraße', 1, -1);

  // Batas peta: palang di ujung jalan (pemain tidak bisa keluar zona)
  const bx = 42.4, bz = 35.4;
  barrier(-bx, MAIN_Z, RW, false); barrier(bx, MAIN_Z, RW, false);
  barrier(bx, LIND_Z, RW, false);
  barrier(WEST_X, -bz, RW, true);
  blockBox(-70, -37, 70, -35, 'nordrand', 3);     // zona lebih tinggi ke selatan (Elbe) — utara tetap sama

  // ═════════════════════════ POHON & LAMPU ════════════════════════
  for (const [tx, tz] of [
    [-16, -17.2], [-8, -17.2], [0, -16.2], [8, -16.2], [24, -16.9], [31, -16.9], [44.5, -16.4],
    [-39.5, -7], [-39.5, -13], [-39, -23], [-39, -31],
    [25, 7.6], [31, 7.6], [37, 7.6], [-41, 5.8],
  ]) tree(tx, tz, 1);
  // Lampu jalan berdiri di tepi trotoar sisi jalan (0,25 dari aspal) —
  // trotoar tetap lapang, tidak ada lampu di persimpangan / zebra cross.
  for (const lx of [-36, -12, 26, 38]) lamp(lx, mainS + 0.25);
  for (const lz of [-12, 12]) lamp(wE + 0.25, lz);
  // Hutan kecil di luar batas peta (mengisi tepi pandangan kamera)
  const rnd = (i) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    const t = rnd(i) * 2 - 1, u = rnd(i + 99);
    let tx, tz;
    if (side === 0) { tx = -44 - u * 14; tz = t * 48; }
    else if (side === 1) { tx = 44 + u * 14; tz = t * 48; }
    else if (side === 2) { tx = t * 56; tz = riverS + 7.5 + u * 9; }
    else { tx = t * 56; tz = -37 - u * 10; }
    if (Math.abs(tx - WEST_X) < 4.5 || Math.abs(tz - MAIN_Z) < 4.5 || Math.abs(tz - CANAL_Z) < 3.5 ||
        (Math.abs(tz - LIND_Z) < 4.5 && tx > 14) || (tz > riverN - 1.5 && tz < riverS + 5)) continue;
    tree(tx, tz, 0.9 + rnd(i + 7) * 0.5, i % 3 ? 'round' : 'pine');
  }

  // Taman kota paling akhir (memakai posisi Allee)
  stadtpark(-19, 22.8, 13.4, riverN - 0.6, ALLEE);
  reg.stadtpark = { x: (-19 + 13.4) / 2, z: (22.8 + riverN - 0.6) / 2, hw: 16.2, hd: 3.6 };
  reg.marktplatz = reg.stadtpark;

  // ═════════════════════════ HALTESTELLE (Quest 5: Lukas kommt mit dem Bus) ══
  busStop(34, mainS + SW + 1.35);
  reg.haltestelle = { x: 34, z: mainS + 1.2, r: 3 };

  // ═════════════════════════ LAMPU MALAM TAMBAHAN ═════════════════
  for (const lx of [-16, ALLEE.x, 24, 32]) lamp(lx, mainN - 0.25);              // Hauptstraße Nord
  for (const lz of [21, -30]) lamp(wE + 0.25, lz);                               // Schillerstraße
  lamp(eW - 0.25, 12.6); lamp(eE + 0.25, 12.6);                                  // Bachstraße (berhadapan)
  lamp(30.8, lindN - 0.25); lamp(41, lindN - 0.25);                              // Deichstraße
  lamp(-4, 21.9);                                                                // Parkplatz EDEKA (tepi selatan, di rumput)
  // Allee: berpasangan di kedua deret pohon, tepat di antara dua pohon
  for (const lz of [8.6, 15.8]) for (const sx of [-1, 1]) parkLamp(ALLEE.x + sx * 2.2, lz);
  // Taman kecil di seberang kanal: empat sudut persimpangan jalur
  { const pcz = (parkN.z0 + parkN.z1) / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parkLamp(EAST_X + sx * 1.75, pcz + sz * 1.35); }
  const ff = World.fireflyAreas || (World.fireflyAreas = []);
  ff.push({ x0: parkN.x0 + 0.5, x1: parkN.x1 - 0.5, z0: parkN.z0 + 0.5, z1: parkN.z1 - 0.5, n: 22 });
  ff.push({ x0: ALLEE.x - 3, x1: ALLEE.x + 3, z0: mainS + SW + 1, z1: 22.5, n: 14 });
  ff.push({ x0: 14, x1: 42, z0: lindS + SW + 0.3, z1: riverN - 0.2, n: 18 });
  ff.push({ x0: -17, x1: 5, z0: -33, z1: canalN - 3, n: 12 });

  // ═════════════════════════ PINTU MASUK QUEST (Kino, Restaurant) ═════
  const qs = (typeof window !== 'undefined' && window.__questState__) || {};
  if (qs.quest_7 === 'active') entrancePad(reg.kino.door.x, reg.kino.door.z - 0.25, '🎬 Kino — Eingang');
  if (qs.quest_8 === 'active') entrancePad(reg.restaurant.door.x, reg.restaurant.door.z - 0.25, '🍽️ Restaurant — Eingang');

  // Animasi air, kapal & bendera
  World._updateRiver = (dt, t) => { for (const fn of _anims) fn(dt, t); };

  if (CONFIG.DEBUG) console.log('[stadt] variant', variant, 'registry', Object.keys(reg));
}
