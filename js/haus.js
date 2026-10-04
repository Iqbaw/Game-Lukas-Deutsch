// ═══════════════════════════════════════════════════════════════════
// js/haus.js — HALAMAN RUMAH OMA & OPA (zona HAUS)
//
// Diorama pedesaan dekat Hamburg (gaya "Altes Land"):
//   • rumah Fachwerk (rangka kayu gelap, dinding putih) beratap jerami
//     (Reetdach), jendela berdaun hijau + kotak bunga, cerobong berasap
//   • kincir angin Belanda (Galerieholländer): dasar bata, balkon kayu,
//     badan sirap, topi berputar, empat sayap kisi-kisi menghadap kamera
//   • sungai dengan tepian batu, alang-alang, daun teratai, dermaga kecil
//   • jembatan kayu melengkung (Bogenbrücke) dengan pangkal batu & lentera
//   • pohon campuran (pinus, ek/linden, birch, pohon apel Oma), semak, bunga
//
// Kamera isometrik melihat dari TENGGARA (+x, +z): sisi depan (selatan)
// dan kanan (timur) setiap bangunan dibuat paling detail.
// Posisi penting tetap: pintu rumah (0, 2.06) ↔ portal (0, 2.6), jembatan
// di z = 2 melintasi sungai x −9…−5, gerbang kota di (−10, 2).
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { Game } from './main.js';
import { World } from './world.js';
import { ZONES } from './config.js';

// ── Material & mesh helpers ───────────────────────────────────────
let _mats = new Map();
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = _mats.get(key);
  if (!m) {
    m = o.std
      ? new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o.std })
      : new THREE.MeshLambertMaterial({ color, flatShading: true, ...o });
    _mats.set(key, m);
  }
  return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
/** Material kaca jendela — menyala hangat di malam hari (js/night.js). */
function windowGlass() {
  const m = new THREE.MeshLambertMaterial({ color: 0x9cc4d6, emissive: 0x23465a, emissiveIntensity: 0.35 });
  World.windowLights.push(m);
  return m;
}
function nightLamp(x, z, y, head, o = {}) {
  (World.nightLamps || (World.nightLamps = [])).push({ x, z, y, head, ...o });
}
// Acak deterministik (tata letak sama setiap kali zona dimuat)
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** Banyak salinan satu bentuk dalam satu draw call. */
function scatter(geo, mat, items, { shadow = false } = {}) {
  if (!items.length) return null;
  const inst = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y || 0, it.z), q, new THREE.Vector3(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1));
    inst.setMatrixAt(i, m);
    if (it.color !== undefined && inst.setColorAt) inst.setColorAt(i, new THREE.Color(it.color));
  });
  inst.castShadow = shadow;
  inst.receiveShadow = true;
  Game.worldGroup.add(inst);
  return inst;
}

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _updates = [];

// ═══════════════════════════════════════════════════════════════════
// RUMAH FACHWERK BERATAP JERAMI
// ═══════════════════════════════════════════════════════════════════

const HOUSE = { W: 6.4, D: 4.6, H: 2.9, FZ: 2.0 };   // depan di z = 2

function buildFarmhouse() {
  const { W, D, H, FZ } = HOUSE;
  const BZ = FZ - D, CZ = (FZ + BZ) / 2;
  const g = new THREE.Group(); g.name = 'house-grosseltern';
  const plaster = M(0xf3ead7), timber = M(0x4a2d1b), brick = M(0x8f4a35), white = M(0xf8f4ec);
  const green = M(0x2e6a45), greenD = M(0x24553a);

  // Fondasi bata + dinding plester
  add(g, B(W + 0.26, 0.46, D + 0.26), brick, 0, 0.23, CZ);
  add(g, B(W + 0.3, 0.06, D + 0.3), M(0x7a3d2c), 0, 0.47, CZ, false);
  add(g, B(W, H - 0.46, D), plaster, 0, 0.46 + (H - 0.46) / 2, CZ);

  // ── Rangka kayu (Fachwerk) — balok sedikit menonjol dari dinding ──
  const T = 0.13, P = 0.05;   // lebar balok, tonjolan
  const front = (x, y, w, h) => add(g, B(w, h, P * 2), timber, x, y, FZ + P * 0.6, false);
  const right = (z, y, d, h) => add(g, B(P * 2, h, d), timber, W / 2 + P * 0.6, y, z, false);
  const left = (z, y, d, h) => add(g, B(P * 2, h, d), timber, -W / 2 - P * 0.6, y, z, false);
  const back = (x, y, w, h) => add(g, B(w, h, P * 2), timber, x, y, BZ - P * 0.6, false);
  const braceXY = (x1, y1, x2, y2, z) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const b = add(g, B(T, len, P * 2), timber, (x1 + x2) / 2, (y1 + y2) / 2, z, false);
    b.rotation.z = -Math.atan2(x2 - x1, y2 - y1);
  };
  const braceZY = (z1, y1, z2, y2, x) => {
    const len = Math.hypot(z2 - z1, y2 - y1);
    const b = add(g, B(P * 2, len, T), timber, x, (y1 + y2) / 2, (z1 + z2) / 2, false);
    b.rotation.x = Math.atan2(z2 - z1, y2 - y1);
  };
  const yS = 0.55, yT = H - 0.08, yM = 2.28;
  // Depan: ambang, balok atas, palang tengah, tiang
  front(0, yS, W + 0.08, T); front(0, yT, W + 0.08, T + 0.04); front(0, yM, W, T * 0.8);
  for (const x of [-W / 2 + T / 2, -2.8, -0.8, 0.8, 2.8, W / 2 - T / 2]) front(x, (yS + yT) / 2, T, yT - yS);
  // Silang St. Andreas di bidang atas samping pintu
  braceXY(-2.75, yM + 0.06, -0.85, yT - 0.06, FZ + P * 0.6);
  braceXY(2.75, yM + 0.06, 0.85, yT - 0.06, FZ + P * 0.6);
  // Kanan (timur, terlihat kamera): tiang, ambang, silang di dua bidang
  const zs = [BZ + T / 2, BZ + 1.5, FZ - 1.5, FZ - T / 2];
  right(CZ, yS, D + 0.08, T); right(CZ, yT, D + 0.08, T + 0.04);
  for (const z of zs) right(z, (yS + yT) / 2, T, yT - yS);
  for (const [a, b] of [[zs[0], zs[1]], [zs[2], zs[3]]]) {
    braceZY(a + 0.08, yS + 0.08, b - 0.08, yT - 0.08, W / 2 + P * 0.6);
    braceZY(b - 0.08, yS + 0.08, a + 0.08, yT - 0.08, W / 2 + P * 0.6);
  }
  // Belakang & kiri: cukup tiang dan ambang
  back(0, yS, W + 0.08, T); back(0, yT, W + 0.08, T);
  for (const x of [-W / 2 + T / 2, -1, 1, W / 2 - T / 2]) back(x, (yS + yT) / 2, T, yT - yS);
  left(CZ, yS, D + 0.08, T); left(CZ, yT, D + 0.08, T);
  for (const z of zs) left(z, (yS + yT) / 2, T, yT - yS);

  // ── Jendela: bingkai putih, kaca, daun jendela hijau, kotak bunga ──
  const flowerCols = [0xe0344a, 0xff6f91, 0xfff2f2, 0xff9a3c];
  const windowFront = (x, y, w, h, z, axis = 'z', sign = 1, shutters = true, box = true) => {
    const grp = new THREE.Group();
    grp.position.set(axis === 'z' ? x : z, y, axis === 'z' ? z : x);
    if (axis === 'x') grp.rotation.y = sign * Math.PI / 2;
    else if (sign < 0) grp.rotation.y = Math.PI;
    add(grp, B(w + 0.14, h + 0.14, 0.07), white, 0, 0, 0.02, false);
    add(grp, B(w, h, 0.03), windowGlass(), 0, 0, 0.06, false);
    add(grp, B(0.05, h, 0.04), white, 0, 0, 0.08, false);
    add(grp, B(w, 0.05, 0.04), white, 0, h * 0.12, 0.08, false);
    if (shutters) for (const s of [-1, 1]) {
      add(grp, B(w / 2 + 0.02, h + 0.06, 0.05), green, s * (w * 0.75 + 0.1), 0, 0.04, false);
      for (const yy of [-h * 0.25, h * 0.25]) add(grp, B(w / 2 - 0.06, 0.04, 0.02), greenD, s * (w * 0.75 + 0.1), yy, 0.075, false);
    }
    if (box) {
      add(grp, B(w + 0.2, 0.2, 0.26), M(0x7a4a2a), 0, -h / 2 - 0.16, 0.14);
      for (let i = 0; i < 6; i++) {
        add(grp, new THREE.IcosahedronGeometry(0.075, 0), M(flowerCols[i % flowerCols.length]),
          -w / 2 + 0.05 + i * (w - 0.1) / 5, -h / 2 - 0.02 + (i % 2) * 0.03, 0.15, false);
        add(grp, new THREE.IcosahedronGeometry(0.06, 0), M(0x3f8a34), -w / 2 + 0.12 + i * (w - 0.1) / 5, -h / 2 - 0.06, 0.2, false);
      }
    }
    g.add(grp);
  };
  windowFront(-1.8, 1.45, 0.9, 1.0, FZ + 0.02);
  windowFront(1.8, 1.45, 0.9, 1.0, FZ + 0.02);
  windowFront(CZ, 1.45, 0.8, 0.95, W / 2 + 0.02, 'x', 1);                 // kanan
  windowFront(CZ, 1.45, 0.8, 0.95, -W / 2 - 0.02, 'x', -1, true, false);   // kiri
  windowFront(-1.5, 1.45, 0.8, 0.9, BZ - 0.02, 'z', -1, false, false);     // belakang
  windowFront(1.5, 1.45, 0.8, 0.9, BZ - 0.02, 'z', -1, false, false);

  // ── Pintu hijau (Klöntür) dengan kanopi, anak tangga, pot bunga ──
  add(g, B(1.3, 2.18, 0.08), white, 0, 0.46 + 1.04, FZ + 0.03, false);
  add(g, B(1.04, 1.98, 0.08), green, 0, 0.46 + 0.99, FZ + 0.07, false);
  add(g, B(1.08, 0.06, 0.1), greenD, 0, 1.55, FZ + 0.1, false);
  add(g, B(0.44, 0.34, 0.03), windowGlass(), 0, 2.0, FZ + 0.12, false);
  add(g, new THREE.SphereGeometry(0.055, 8, 6), M(0xd8b04a, { std: { metalness: 0.7, roughness: 0.3 } }), 0.38, 1.38, FZ + 0.14, false);
  const canopy = add(g, B(1.75, 0.09, 0.72), M(0x6a4a2e), 0, 2.72, FZ + 0.34);
  canopy.rotation.x = 0.18;
  for (const s of [-1, 1]) {
    const br = add(g, B(0.07, 0.5, 0.07), timber, s * 0.72, 2.48, FZ + 0.32, false);
    br.rotation.x = -0.7;
  }
  add(g, B(1.5, 0.14, 0.34), M(0x9a968c), 0, 0.07, FZ + 0.17);   // anak tangga batu (rendah, alas pintu tetap terlihat)
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.17, 0.13, 0.34, 10), M(0xb5643c), s * 1.0, 0.17, FZ + 0.42);
    add(g, new THREE.IcosahedronGeometry(0.22, 0), M(0x3d8a35), s * 1.0, 0.48, FZ + 0.42);
    for (let i = 0; i < 3; i++) add(g, new THREE.IcosahedronGeometry(0.06, 0), M(flowerCols[(i + (s > 0 ? 1 : 0)) % 4]), s * 1.0 + (i - 1) * 0.1, 0.66, FZ + 0.48 + (i % 2) * 0.05, false);
  }
  // Lentera teras di samping pintu (menyala di malam hari)
  add(g, B(0.08, 0.08, 0.26), timber, 0.95, 2.32, FZ + 0.13, false);
  const lantern = add(g, B(0.2, 0.28, 0.2), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffd08a, emissiveIntensity: 0.3 }), 0.95, 2.12, FZ + 0.26, false);
  nightLamp(0.95, FZ + 0.9, 2.12, lantern, { pool: 2.4, power: 8, range: 7, color: 0xffd08a });

  // ── Atap jerami (Reetdach) berbentuk perisai ──
  const ov = 0.6, E = H - 0.12, PK = 2.95, RH = 1.6;
  const x0 = -W / 2 - ov, x1 = W / 2 + ov, zF = FZ + ov, zB = BZ - ov, zC = CZ;
  const A = [x0, E, zF], Bv = [x1, E, zF], C = [x1, E, zB], Dv = [x0, E, zB], R1 = [-RH, E + PK, zC], R2 = [RH, E + PK, zC];
  const tris = [A, Bv, R2, A, R2, R1, Bv, C, R2, C, Dv, R1, C, R1, R2, Dv, A, R1];
  const pos = new Float32Array(tris.flat());
  const uv = new Float32Array(tris.length * 2);
  tris.forEach((v, i) => { uv[i * 2] = (v[0] + v[2] * 0.6) * 0.45; uv[i * 2 + 1] = v[1] * 0.55; });
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  roofGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  roofGeo.computeVertexNormals();
  const thatchTex = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b48d55'; ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, len = 6 + r() * 14;
      ctx.strokeStyle = r() < 0.5 ? `rgba(120,88,44,${0.25 + r() * 0.3})` : `rgba(220,190,130,${0.2 + r() * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 2, y + len); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,64,30,0.18)';
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 2);
  });
  const thatch = new THREE.MeshLambertMaterial({ map: thatchTex, color: 0xffffff, side: THREE.DoubleSide });
  add(g, roofGeo, thatch);
  // Tepi jerami yang tebal di sekeliling atap
  const rim = M(0x8f6b3c);
  add(g, B(x1 - x0 + 0.12, 0.32, 0.34), rim, 0, E - 0.08, zF - 0.08);
  add(g, B(x1 - x0 + 0.12, 0.32, 0.34), rim, 0, E - 0.08, zB + 0.08);
  add(g, B(0.34, 0.32, zF - zB), rim, x0 + 0.08, E - 0.08, zC);
  add(g, B(0.34, 0.32, zF - zB), rim, x1 - 0.08, E - 0.08, zC);
  // Bubungan dari rumput/heide
  add(g, B(RH * 2 + 0.5, 0.34, 0.62), M(0x5d4a31), 0, E + PK + 0.06, zC);
  for (const s of [-1, 1]) {
    const cap = add(g, new THREE.ConeGeometry(0.42, 0.5, 4), M(0x5d4a31), s * (RH + 0.3), E + PK - 0.02, zC);
    cap.rotation.y = Math.PI / 4;
  }

  // Jendela atap (Gaube) di tengah sisi depan
  const slopeY = (z) => E + (zF - z) * (PK / (zF - zC));
  const dzF = FZ - 0.25, dzB = zC + 0.2;
  const dg = new THREE.Group(); g.add(dg);
  const dBot = slopeY(dzF) - 0.2, dTop = slopeY(dzF) + 0.75;
  add(dg, B(1.3, dTop - dBot, dzF - dzB), plaster, 0, (dTop + dBot) / 2, (dzF + dzB) / 2);
  add(dg, B(1.42, 0.1, 0.06), timber, 0, dTop - 0.04, dzF + 0.02, false);
  add(dg, B(0.66, 0.5, 0.06), white, 0, dBot + 0.5, dzF + 0.02, false);
  add(dg, B(0.54, 0.4, 0.03), windowGlass(), 0, dBot + 0.5, dzF + 0.05, false);
  const dShape = new THREE.Shape();
  dShape.moveTo(-0.88, 0); dShape.lineTo(0.88, 0); dShape.lineTo(0, 0.55); dShape.closePath();
  const dRoof = new THREE.ExtrudeGeometry(dShape, { depth: dzF - dzB + 0.35, bevelEnabled: false });
  const dr = add(dg, dRoof, thatch, 0, dTop - 0.02, dzB - 0.05);
  void dr;

  // Cerobong bata + asap
  const chX = 1.7, chZ = CZ - 0.9;
  add(g, B(0.6, 1.9, 0.6), brick, chX, E + PK - 0.45, chZ);
  add(g, B(0.74, 0.14, 0.74), M(0x6e3628), chX, E + PK + 0.55, chZ);
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0xe8e4de, transparent: true, opacity: 0.55, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const p = add(g, new THREE.IcosahedronGeometry(0.22, 1), smokeMat.clone(), chX, 0, chZ, false);
    p.userData.phase = i / 6;
    puffs.push(p);
  }
  _updates.push((d, t) => {
    for (const p of puffs) {
      const k = (t * 0.18 + p.userData.phase) % 1;
      p.position.set(chX + k * 0.9 + Math.sin(t + p.userData.phase * 9) * 0.08, E + PK + 0.7 + k * 2.6, chZ - k * 0.3);
      const s = 0.7 + k * 1.6;
      p.scale.set(s, s, s);
      p.material.opacity = 0.5 * (1 - k);
    }
  });

  g.position.set(0, 0, 0);
  Game.worldGroup.add(g);
  World.house = g;
  World.zones[ZONES.HAUS] = new THREE.Box3(new THREE.Vector3(-8, 0, -12), new THREE.Vector3(12, 12, 12));
  World.colliders.push({ type: 'box', name: 'main-house',
    box: new THREE.Box3(new THREE.Vector3(-W / 2 - 0.25, 0, BZ - 0.25), new THREE.Vector3(W / 2 + 0.25, 6, FZ + 0.22)) });
}

// ═══════════════════════════════════════════════════════════════════
// KINCIR ANGIN BELANDA (Galerieholländer)
// ═══════════════════════════════════════════════════════════════════

function buildWindmill(x, z) {
  const g = new THREE.Group(); g.name = 'windmuehle';
  g.position.set(x, 0, z);
  const brick = M(0x9b5139), brickD = M(0x7e3f2c), shingle = M(0x8a7352), shingleD = M(0x6e5b41);
  const wood = M(0x6b4a2e), white = M(0xf3efe6), capM = M(0x7a3b28), sailM = M(0xefe6d2), frameM = M(0x8a6a48);
  const oct = (geo) => { geo.rotateY(Math.PI / 8); return geo; };   // satu sisi menghadap kamera (+x+z)
  const FACE = Math.PI / 4;
  const out = (r, y) => [Math.sin(FACE) * r, y, Math.cos(FACE) * r];

  // Dasar bata (0 … 1.7)
  const BASE_H = 1.7, TOP_H = 7.1;
  add(g, oct(new THREE.CylinderGeometry(1.95, 2.08, BASE_H, 8)), brick, 0, BASE_H / 2, 0);
  for (const yy of [0.45, 0.9, 1.35]) add(g, oct(new THREE.CylinderGeometry(2.0 - yy * 0.06, 2.02 - yy * 0.06, 0.05, 8)), brickD, 0, yy, 0, false);
  // Pintu melengkung menghadap kamera
  const door = new THREE.Group();
  door.position.set(...out(1.98, 0)); door.rotation.y = FACE; g.add(door);
  add(door, B(1.05, 1.5, 0.08), white, 0, 0.75, 0.02, false);
  add(door, B(0.85, 1.38, 0.08), wood, 0, 0.71, 0.05, false);
  const arch = add(door, new THREE.CylinderGeometry(0.52, 0.52, 0.08, 14, 1, false, -Math.PI / 2, Math.PI), white, 0, 1.5, 0.02, false);
  arch.rotation.x = Math.PI / 2;
  add(door, B(0.04, 1.3, 0.1), M(0x4a3220), 0, 0.68, 0.08, false);
  // Galeri kayu + pagar + penyangga
  add(g, oct(new THREE.CylinderGeometry(2.65, 2.65, 0.13, 8)), wood, 0, BASE_H + 0.06, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.sin(a) * 2.55, pz = Math.cos(a) * 2.55;
    add(g, B(0.08, 0.85, 0.08), wood, px, BASE_H + 0.5, pz, false);
    const strut = add(g, B(0.08, 0.95, 0.08), wood, Math.sin(a) * 2.25, BASE_H - 0.35, Math.cos(a) * 2.25, false);
    strut.rotation.set(Math.cos(a) * 0.65, 0, -Math.sin(a) * 0.65);
    const a2 = a + Math.PI / 8 + Math.PI / 8;
    const nx = Math.sin(a2) * 2.55, nz = Math.cos(a2) * 2.55;
    const len = Math.hypot(nx - px, nz - pz);
    for (const ry of [BASE_H + 0.9, BASE_H + 0.5]) {
      const rail = add(g, B(len, 0.06, 0.06), wood, (px + nx) / 2, ry, (pz + nz) / 2, false);
      rail.rotation.y = -Math.atan2(nz - pz, nx - px);
    }
  }
  // Badan atas bersirap (1.7 … 7.1), meruncing
  const bodyH = TOP_H - BASE_H;
  add(g, oct(new THREE.CylinderGeometry(1.2, 1.78, bodyH, 8)), shingle, 0, BASE_H + bodyH / 2, 0);
  for (let k = 1; k < 6; k++) {
    const yy = BASE_H + bodyH * k / 6, r = 1.78 - (1.78 - 1.2) * k / 6;
    add(g, oct(new THREE.CylinderGeometry(r + 0.04, r + 0.06, 0.08, 8)), shingleD, 0, yy, 0, false);
  }
  // Jendela kecil
  for (const yy of [3.3, 5.3]) {
    const r = 1.78 - (1.78 - 1.2) * (yy - BASE_H) / bodyH;
    const w = new THREE.Group();
    w.position.set(...out(r + 0.02, yy)); w.rotation.y = FACE;
    w.rotation.x = -0.1;
    add(w, B(0.5, 0.62, 0.06), white, 0, 0, 0, false);
    add(w, B(0.38, 0.5, 0.03), windowGlass(), 0, 0, 0.04, false);
    g.add(w);
  }
  // Pintu kecil ke galeri
  { const r = 1.72; const w = new THREE.Group(); w.position.set(...out(r, BASE_H + 0.65)); w.rotation.y = FACE; w.rotation.x = -0.1;
    add(w, B(0.7, 1.1, 0.06), white, 0, 0, 0, false); add(w, B(0.58, 1.0, 0.05), wood, 0, -0.03, 0.03, false); g.add(w); }

  // Topi (Kappe) menghadap kamera, poros sayap, kipas angin di belakang
  const cap = new THREE.Group();
  cap.position.y = TOP_H; cap.rotation.y = FACE; g.add(cap);
  add(cap, new THREE.CylinderGeometry(1.32, 1.3, 0.22, 16), M(0x4a3220), 0, 0.1, 0);
  const dome = add(cap, new THREE.SphereGeometry(1.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, 0.2, 0);
  dome.scale.set(1, 0.95, 1.22);
  add(cap, B(0.18, 0.35, 0.3), capM, 0, 1.45, 0.2);
  const axle = add(cap, new THREE.CylinderGeometry(0.17, 0.2, 1.3, 10), M(0x3e2a1a), 0, 0.62, 1.3);
  axle.rotation.x = Math.PI / 2 - 0.12;
  const blades = new THREE.Group();
  blades.position.set(0, 0.7, 2.0); blades.rotation.x = -0.12;
  cap.add(blades);
  add(blades, new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12), M(0x3e2a1a), 0, 0, 0).rotation.x = Math.PI / 2;
  const SAIL_L = 4.8;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (Math.PI / 2) * i + Math.PI / 4;
    blades.add(arm);
    add(arm, B(0.16, SAIL_L + 0.5, 0.13), M(0x5a3d26), 0, SAIL_L / 2 - 0.15, 0);          // tiang sayap
    // Kisi-kisi di satu sisi tiang
    const r0 = 0.95, r1 = SAIL_L, wSail = 0.95;
    for (const xx of [0.12, wSail]) add(arm, B(0.05, r1 - r0, 0.05), frameM, xx, (r0 + r1) / 2, 0.02, false);
    for (let k = 0; k <= 9; k++) add(arm, B(wSail - 0.08, 0.04, 0.04), frameM, (wSail + 0.12) / 2, r0 + (r1 - r0) * k / 9, 0.03, false);
    add(arm, B(wSail - 0.14, (r1 - r0) * 0.72, 0.02), sailM, (wSail + 0.12) / 2, r0 + (r1 - r0) * 0.6, -0.01, false);
  }
  // Kipas angin (Windrose) di belakang topi
  const fan = new THREE.Group();
  fan.position.set(0, 0.95, -1.75); cap.add(fan);
  add(cap, B(0.08, 0.08, 0.9), M(0x3e2a1a), 0, 0.85, -1.35, false);
  for (let i = 0; i < 6; i++) {
    const vane = add(fan, B(0.06, 0.55, 0.18), white, 0, 0.32, 0, false);
    vane.geometry.translate(0, 0, 0);
    const pivot = new THREE.Group(); pivot.rotation.x = (Math.PI * 2 * i) / 6; pivot.add(vane); fan.add(pivot);
  }

  // Karung tepung & gerobak di dekat pintu
  const [dx, , dz] = out(2.5, 0);
  for (let i = 0; i < 3; i++) {
    const sack = add(g, new THREE.SphereGeometry(0.28, 8, 6), M(0xe2d6b8), dx + 0.75 + (i % 2) * 0.32, 0.24 + (i > 1 ? 0.3 : 0), dz - 0.85 + i * 0.12);
    sack.scale.set(1, 0.85, 0.8);
  }
  Game.worldGroup.add(g);
  World.colliders.push({ type: 'cylinder', x, z, radius: 2.45 });

  _updates.push((d) => {
    blades.rotation.z -= d * 0.38;
    fan.rotation.x += d * 0.5;
  });
  return g;
}

// ═══════════════════════════════════════════════════════════════════
// SUNGAI: air, tepian batu, alang-alang, teratai, dermaga
// ═══════════════════════════════════════════════════════════════════

// Sungai menembus seluruh medan (len 100) — tidak ada ujung air yang terlihat
const RIVER = { x: -7, w: 4, len: 100, x0: -9, x1: -5 };
const RIVER_END = 48;   // batas sebar batu/alang-alang di sepanjang tepi

function buildRiver() {
  const { x: RX, w, len } = RIVER;
  const geo = new THREE.PlaneGeometry(w, len, 10, 90);
  const waterTex = canvasTex(256, 256, (ctx, W, H) => {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#2f8fb8'); grad.addColorStop(0.5, '#3aa6cc'); grad.addColorStop(1, '#2f8fb8');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    const r = rng(3);
    for (let i = 0; i < 46; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + r() * 0.14})`;
      ctx.lineWidth = 1 + r() * 1.6;
      const y = r() * H, x = r() * W * 0.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 6 + r() * 12, x + 50 + r() * 60, y); ctx.stroke();
    }
  }, [1.2, 19]);
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex, color: 0x9fe0f2, emissive: 0x0b4d70, emissiveIntensity: 0.18,
    roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.94, depthWrite: false,
  });
  // Dasar sungai yang lebih gelap (kedalaman)
  add(Game.worldGroup, B(w + 0.4, 0.06, len + 0.4), M(0x1f5f7d, { std: { roughness: 0.8 } }), RX, 0.05, 0, false);
  const water = new THREE.Mesh(geo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(RX, 0.17, 0);
  water.renderOrder = 2;
  Game.worldGroup.add(water);
  World._updateRiver = (d, t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.4 + t * 2.0) * 0.05 + Math.cos(p.getY(i) * 0.75 + t * 1.3) * 0.04);
    p.needsUpdate = true;
    geo.computeVertexNormals();
    waterTex.offset.y = t * 0.07;
  };
  // Air terbuka: tepi sungai tidak bisa ditembus kecuali lewat jembatan
  World.colliders.push({ type: 'box', name: 'river-water-north', box: new THREE.Box3(new THREE.Vector3(-9.25, 0, -16.5), new THREE.Vector3(-4.75, 1.2, 0.5)) });
  World.colliders.push({ type: 'box', name: 'river-water-south', box: new THREE.Box3(new THREE.Vector3(-9.25, 0, 3.5), new THREE.Vector3(-4.75, 1.2, 16.5)) });

  const r = rng(11);
  const inBridge = (z) => z > -0.2 && z < 4.2;
  // Tanah tepian (pasir/lumpur) di kedua sisi
  for (const bx of [RIVER.x0 - 0.15, RIVER.x1 + 0.15]) {
    add(Game.worldGroup, B(0.55, 0.12, len), M(0x8f7d58), bx, 0.07, 0, false);
  }
  // Batu tepian (satu draw call)
  const stones = [];
  for (const bx of [RIVER.x0, RIVER.x1]) {
    for (let z = -RIVER_END; z < RIVER_END; z += 0.42 + r() * 0.3) {
      if (inBridge(z)) continue;
      const s = 0.16 + r() * 0.24;
      stones.push({ x: bx + (r() - 0.5) * 0.35, y: 0.1, z, s, sy: s * 0.65, ry: r() * 6, rx: r(), color: [0x9a9a8e, 0x8a8a7e, 0xa9a596, 0x7d7f74][Math.floor(r() * 4)] });
    }
  }
  scatter(new THREE.DodecahedronGeometry(1, 0), M(0xffffff), stones, { shadow: true });
  // Batu besar di dalam air dengan riak busa
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
  for (const [bx, bz, s] of [[-6.2, -7.5, 0.55], [-7.9, 9.5, 0.45], [-7.4, -12.5, 0.4], [-6.4, -21, 0.5], [-7.7, 18.5, 0.5],
                             [-6.1, 26, 0.42], [-8.0, -29, 0.46], [-6.6, 34, 0.5], [-7.8, -38, 0.44]]) {
    const b = add(Game.worldGroup, new THREE.DodecahedronGeometry(s, 0), M(0x7d8077), bx, 0.12, bz);
    b.scale.set(1.2, 0.75, 1);
    const foam = add(Game.worldGroup, new THREE.TorusGeometry(s * 1.15, 0.05, 6, 18), foamMat, bx, 0.2, bz, false);
    foam.rotation.x = Math.PI / 2;
  }
  // Alang-alang & ekor kucing (cattail)
  const reeds = [], tops = [];
  for (let i = 0; i < 76; i++) {
    const side = i % 2 ? RIVER.x0 + 0.25 : RIVER.x1 - 0.25;
    let z = -RIVER_END + r() * RIVER_END * 2;
    if (inBridge(z)) z += 5;
    for (let k = 0; k < 5; k++) {
      const h = 0.5 + r() * 0.5;
      reeds.push({ x: side + (r() - 0.5) * 0.4, y: h / 2 + 0.1, z: z + (r() - 0.5) * 0.5, sx: 1, sy: h, sz: 1, rx: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.3, color: r() < 0.5 ? 0x5c8f34 : 0x6fa23f });
      if (k < 2) tops.push({ x: side + (r() - 0.5) * 0.4, y: h + 0.18, z: z + (r() - 0.5) * 0.5, s: 1 });
    }
  }
  scatter(new THREE.CylinderGeometry(0.018, 0.03, 1, 4), M(0xffffff), reeds);
  scatter(new THREE.CapsuleGeometry(0.045, 0.16, 2, 6), M(0x6b4628), tops);
  // Daun teratai + bunga
  const pads = [], blossoms = [];
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? RIVER.x0 + 0.7 : RIVER.x1 - 0.7;
    let z = -RIVER_END + 2 + r() * (RIVER_END - 2) * 2;
    if (inBridge(z)) continue;
    const s = 0.22 + r() * 0.16;
    pads.push({ x: side + (r() - 0.5) * 0.6, y: 0.2, z, sx: s, sy: 1, sz: s, ry: r() * 6 });
    if (i % 3 === 0) blossoms.push({ x: side + (r() - 0.5) * 0.3, y: 0.26, z: z + 0.05, s: 1, color: r() < 0.5 ? 0xff9ec4 : 0xfff3f6 });
  }
  scatter(new THREE.CylinderGeometry(1, 1, 0.02, 10, 1, false, 0.4, Math.PI * 1.75), M(0x3f8f3a), pads);
  scatter(new THREE.IcosahedronGeometry(0.08, 0), M(0xffffff), blossoms);

  // Dermaga kecil tempat Nachbar Hans memancing (tepi timur, z ≈ 8)
  const jetty = new THREE.Group(); jetty.position.set(-4.75, 0, 8.2); Game.worldGroup.add(jetty);
  const plank = M(0x8a6440), post = M(0x5a3d26);
  for (let i = 0; i < 6; i++) add(jetty, B(0.26, 0.07, 1.5), plank, -0.75 + i * 0.3, 0.24, 0);
  for (const px of [-0.85, 0.65]) for (const pz of [-0.65, 0.65]) add(jetty, new THREE.CylinderGeometry(0.06, 0.07, 0.5, 6), post, px, 0.06, pz);
  // Joran Hans (berdiri di tepi, x ≈ −3.6) menjulur ke atas air
  const rod = add(jetty, new THREE.CylinderGeometry(0.015, 0.025, 2.2, 5), M(0x3e2a1a), 0.25, 0.9, 0.3, false);
  rod.rotation.z = 1.05;
  add(jetty, new THREE.CylinderGeometry(0.16, 0.13, 0.3, 10), M(0x7a8a99), 1.15, 0.15, -0.55);   // ember di tepi
}

// ═══════════════════════════════════════════════════════════════════
// JEMBATAN KAYU MELENGKUNG
// ═══════════════════════════════════════════════════════════════════

function buildBridge() {
  const CX = -7, CZ = 2, L = 5.0, WID = 2.5;
  const g = new THREE.Group(); g.name = 'bruecke';
  g.position.set(CX, 0, CZ);
  const yEnd = 0.5, rise = 0.42;
  const deckY = (x) => yEnd + rise * Math.cos((Math.PI * x) / L);      // x ∈ [−L/2, L/2]
  const slope = (x) => -rise * (Math.PI / L) * Math.sin((Math.PI * x) / L);
  const wood = M(0x7d5434), woodD = M(0x5a3a22), stone = M(0x8f8a80), stoneD = M(0x7a756c);

  // Dek melengkung yang bisa dipijak (permukaan atas = tinggi pijakan)
  const deckGeo = new THREE.BoxGeometry(L, 0.16, WID, 20, 1, 1);
  const p = deckGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + deckY(p.getX(i)) - 0.08);
  deckGeo.computeVertexNormals();
  const deck = add(g, deckGeo, woodD);
  World.walkables.push(deck);
  // Papan melintang mengikuti lengkung
  const N = 17;
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + 0.15 + (i * (L - 0.3)) / (N - 1);
    const pl = add(g, B(0.26, 0.05, WID - 0.06), i % 2 ? wood : M(0x86603c), x, deckY(x) + 0.02, 0, false);
    pl.rotation.z = Math.atan(slope(x));
  }
  // Balok lengkung di sisi samping (terlihat dari kamera)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const xa = -L / 2 + (i * L) / 10, xb = xa + L / 10;
      const ya = deckY(xa) - 0.2, yb = deckY(xb) - 0.2;
      const seg = add(g, B(Math.hypot(xb - xa, yb - ya) + 0.02, 0.18, 0.12), woodD, (xa + xb) / 2, (ya + yb) / 2, s * (WID / 2 + 0.02), false);
      seg.rotation.z = Math.atan2(yb - ya, xb - xa);
    }
  }
  // Pagar: tiang & pegangan mengikuti lengkung
  const postsX = [-2.3, -1.5, -0.75, 0, 0.75, 1.5, 2.3];
  for (const s of [-1, 1]) {
    const zz = s * (WID / 2 - 0.08);
    postsX.forEach((x, i) => {
      const end = i === 0 || i === postsX.length - 1;
      const h = end ? 1.25 : 0.9;
      add(g, B(end ? 0.18 : 0.11, h, end ? 0.18 : 0.11), end ? woodD : wood, x, deckY(x) + h / 2, zz);
      if (end) {
        // Lentera di tiang ujung
        const lant = add(g, B(0.2, 0.26, 0.2), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffd08a, emissiveIntensity: 0.3 }), x, deckY(x) + h + 0.16, zz, false);
        add(g, B(0.26, 0.05, 0.26), woodD, x, deckY(x) + h + 0.31, zz, false);
        if (s > 0) nightLamp(CX + x, CZ + zz, deckY(x) + h + 0.16, lant, { pool: 2.2, power: 6, range: 6, color: 0xffd08a });
        else nightLamp(CX + x, CZ + zz, deckY(x) + h + 0.16, lant, { pool: 0.01, power: 0, noPool: true, color: 0xffd08a });
      }
    });
    for (let i = 0; i < postsX.length - 1; i++) {
      const xa = postsX[i], xb = postsX[i + 1];
      for (const off of [0.86, 0.45]) {
        const ya = deckY(xa) + off, yb = deckY(xb) + off;
        const rail = add(g, B(Math.hypot(xb - xa, yb - ya), 0.07, 0.07), wood, (xa + xb) / 2, (ya + yb) / 2, zz, false);
        rail.rotation.z = Math.atan2(yb - ya, xb - xa);
      }
    }
  }
  // Pangkal batu di kedua tepi
  for (const s of [-1, 1]) {
    add(g, B(0.9, 0.62, WID + 0.5), stone, s * (L / 2 + 0.1), 0.24, 0);
    for (let k = 0; k < 4; k++) add(g, B(0.92, 0.04, WID + 0.52), stoneD, s * (L / 2 + 0.1), 0.05 + k * 0.15, 0, false);
  }
  Game.worldGroup.add(g);
  // Pagar jembatan tidak bisa ditembus
  World.colliders.push({ type: 'box', name: 'bruecke-rail-n', box: new THREE.Box3(new THREE.Vector3(CX - L / 2, 0, CZ - WID / 2 - 0.4), new THREE.Vector3(CX + L / 2, 2, CZ - WID / 2 + 0.05)) });
  World.colliders.push({ type: 'box', name: 'bruecke-rail-s', box: new THREE.Box3(new THREE.Vector3(CX - L / 2, 0, CZ + WID / 2 - 0.05), new THREE.Vector3(CX + L / 2, 2, CZ + WID / 2 + 0.4)) });
}

// ═══════════════════════════════════════════════════════════════════
// POHON, SEMAK, BUNGA, BATU
// ═══════════════════════════════════════════════════════════════════

function tree(kind, x, z, s = 1, seed = 1) {
  const r = rng(seed * 97 + 3);
  const t = new THREE.Group();
  t.position.set(x, 0, z);
  t.rotation.y = r() * Math.PI * 2;
  if (kind === 'pine') {
    add(t, new THREE.CylinderGeometry(0.1 * s, 0.17 * s, 1.4 * s, 6), M(0x5e3d22), 0, 0.7 * s, 0);
    const cols = [0x2a5e22, 0x316d27, 0x3b7d2e, 0x438a33];
    for (let l = 0; l < 4; l++) {
      const cone = add(t, new THREE.ConeGeometry((1.25 - l * 0.24) * s, (1.25 - l * 0.12) * s, 7), M(cols[l]), 0, (1.05 + l * 0.68) * s, 0);
      cone.rotation.y = l * 0.4;
    }
  } else if (kind === 'birch') {
    add(t, new THREE.CylinderGeometry(0.08 * s, 0.11 * s, 2.6 * s, 6), M(0xeeeae0), 0, 1.3 * s, 0);
    for (let k = 0; k < 5; k++) add(t, B(0.2 * s, 0.05 * s, 0.05), M(0x2b2b2b), 0, (0.4 + k * 0.45) * s, 0.09 * s, false).rotation.y = k;
    for (let k = 0; k < 4; k++) {
      add(t, new THREE.IcosahedronGeometry((0.6 + r() * 0.25) * s, 0), M(k % 2 ? 0x8cc456 : 0x7ab448),
        (r() - 0.5) * 0.8 * s, (2.4 + r() * 0.9) * s, (r() - 0.5) * 0.8 * s);
    }
  } else if (kind === 'apple') {
    add(t, new THREE.CylinderGeometry(0.13 * s, 0.2 * s, 1.3 * s, 6), M(0x6a4428), 0, 0.65 * s, 0);
    for (let k = 0; k < 4; k++) {
      const br = add(t, new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.8 * s, 5), M(0x6a4428), 0, 1.4 * s, 0, false);
      br.rotation.set(0.7, k * Math.PI / 2, 0);
      br.position.set(Math.sin(k * Math.PI / 2) * 0.25 * s, 1.5 * s, Math.cos(k * Math.PI / 2) * 0.25 * s);
    }
    const canopy = [[0, 2.15, 0, 1.05], [0.6, 1.9, 0.2, 0.7], [-0.55, 1.95, -0.25, 0.72], [0.1, 2.5, -0.35, 0.65]];
    for (const [cx, cy, cz2, cr] of canopy) add(t, new THREE.IcosahedronGeometry(cr * s, 1), M(0x4f9a3a), cx * s, cy * s, cz2 * s);
    const apples = [];
    for (let k = 0; k < 16; k++) {
      const a = r() * Math.PI * 2, el = 0.2 + r() * 0.9;
      apples.push([Math.cos(a) * Math.cos(el) * 1.05 * s, (2.0 + Math.sin(el) * 0.6) * s, Math.sin(a) * Math.cos(el) * 1.05 * s]);
    }
    for (const [ax, ay, az] of apples) add(t, new THREE.SphereGeometry(0.08 * s, 6, 4), M(0xd8302a), ax, ay, az, false);
  } else {
    // Pohon daun bulat (ek / linden)
    add(t, new THREE.CylinderGeometry(0.15 * s, 0.24 * s, 1.6 * s, 6), M(0x5e3d22), 0, 0.8 * s, 0);
    const greens = [0x3f8a30, 0x4a9a38, 0x56a640, 0x3a7d2c];
    const blobs = [[0, 2.35, 0, 1.15], [0.75, 2.0, 0.3, 0.8], [-0.7, 2.05, -0.2, 0.85], [0.2, 2.9, -0.3, 0.8], [-0.3, 2.6, 0.6, 0.7]];
    blobs.forEach(([bx, by, bz, br], k) => add(t, new THREE.IcosahedronGeometry(br * s, 1), M(greens[k % 4]), bx * s, by * s, bz * s));
  }
  Game.worldGroup.add(t);
  World.colliders.push({ type: 'cylinder', x, z, radius: (kind === 'birch' ? 0.18 : 0.3) * Math.max(0.8, s) });
}

function buildVegetation() {
  const T = [
    // Di belakang rumah & kincir (utara)
    ['round', -1.4, -6.4, 1.25], ['pine', 2.0, -9.0, 1.2], ['pine', -4.2, -9.4, 1.35], ['birch', -2.9, -11.6, 1.0],
    ['pine', 9.2, -9.4, 1.4], ['round', 10.6, -4.6, 1.1], ['birch', 12.0, -1.2, 1.0], ['pine', 12.4, -11.8, 1.1],
    ['round', 6.0, -11.6, 1.2], ['pine', -0.2, -12.4, 1.0],
    // Timur
    ['pine', 12.4, 3.2, 1.25], ['birch', 12.2, 7.6, 1.05], ['round', 10.6, 11.2, 1.0], ['pine', 12.8, 12.4, 0.9],
    // Selatan (dekat kamera — kecil & jauh di tepi supaya tidak menutupi pemain)
    ['round', 4.4, 12.8, 0.9], ['pine', 0.6, 13.0, 0.95], ['birch', -2.8, 12.4, 0.85], ['pine', 8.6, 13.0, 0.85],
    // Pohon apel Oma (untuk Apfelkuchen!)
    ['apple', -2.2, 7.2, 0.9],
    // Hutan di seberang sungai
    ['pine', -12.7, -11, 1.3], ['round', -10.8, -8.2, 1.0], ['pine', -12.5, -4.2, 1.2], ['birch', -11.2, -1.6, 0.9],
    ['pine', -10.8, 7.2, 1.1], ['round', -12.6, 10.2, 1.25], ['pine', -10.4, 12.4, 0.9], ['pine', -13.2, -14, 0.9],
    ['round', -11.4, -13.2, 1.1], ['pine', -13.3, -7.2, 1.0], ['birch', -11.9, 9.0, 0.85], ['pine', -13.5, 13.2, 1.1],
    // Di sepanjang sungai di luar halaman (sungai terlihat mengalir terus)
    ['pine', -11.6, -20, 1.1], ['round', -13.8, -25, 1.2], ['birch', -11.2, -31, 0.95], ['pine', -14.2, -36, 1.2],
    ['round', -11.8, 18, 1.0], ['pine', -13.6, 23, 1.15], ['birch', -11.4, 29, 0.9], ['round', -14.5, 34, 1.1],
    ['pine', -2.6, -19, 1.1], ['round', -1.2, -24.5, 1.15], ['pine', -3.0, -30, 1.0], ['birch', 1.5, -21, 0.9],
  ];
  T.forEach(([k, x, z, s], i) => tree(k, x, z, s, i + 1));

  const r = rng(29);
  const nearPath = (x, z) => (z > 1.2 && z < 4.8 && x > -5.5 && x < 11.5);
  const blocked = (x, z) => nearPath(x, z) ||
    (Math.abs(x) < 4 && z > -3.4 && z < 2.8) ||                // rumah
    (Math.hypot(x - 5, z + 5) < 3.1) ||                         // kincir
    (x < -4.4 && x > -9.6) ||                                   // sungai
    (x > 1.4 && x < 8.2 && z > 4.2 && z < 7.4);                 // kebun & meja Oma

  // Semak di sekitar rumah dan pagar hidup
  const bushes = [];
  for (const [bx, bz] of [[-3.9, -1.2], [-3.9, 0.6], [3.9, -2.2], [-2.6, -3.3], [0.4, -3.4], [2.4, -3.3], [8.8, 0.2], [9.8, 6.6], [-3.6, 5.6]]) {
    for (let k = 0; k < 3; k++) bushes.push({ x: bx + (r() - 0.5) * 0.6, y: 0.32, z: bz + (r() - 0.5) * 0.6, s: 0.38 + r() * 0.2, color: [0x3f8a30, 0x4f9a38, 0x377a2a][k] });
  }
  scatter(new THREE.IcosahedronGeometry(1, 1), M(0xffffff), bushes, { shadow: true });

  // Bunga liar di padang rumput
  const flowers = [], stems = [];
  const fcols = [0xffffff, 0xffe14d, 0xe84a5f, 0xb07cff, 0xff9a3c, 0x7ec8ff];
  for (let i = 0; i < 260; i++) {
    const x = -4.2 + r() * 17.8, z = -13 + r() * 26;
    if (blocked(x, z)) continue;
    const c = fcols[Math.floor(r() * fcols.length)];
    flowers.push({ x, y: 0.16, z, s: 0.06 + r() * 0.03, color: c });
  }
  scatter(new THREE.IcosahedronGeometry(1, 0), M(0xffffff), flowers);
  // Rumpun rumput
  for (let i = 0; i < 220; i++) {
    const x = -13.6 + r() * 27.2, z = -13.6 + r() * 27.2;
    if (blocked(x, z) && !(x < -9.6)) continue;
    stems.push({ x, y: 0.1, z, sx: 0.8 + r() * 0.6, sy: 0.6 + r() * 0.8, sz: 0.8 + r() * 0.6, ry: r() * 6, color: r() < 0.5 ? 0x4a9a2a : 0x5fae3a });
  }
  scatter(new THREE.ConeGeometry(0.07, 0.3, 3), M(0xffffff), stems);
  // Batu besar dekoratif
  const rocks = [[-4.0, -6.2, 0.75], [8.2, -8.4, 0.65], [10.4, 6.4, 0.5], [7.4, 8.6, 0.55], [-3.8, -3.0, 0.5]];
  for (const [x, z, s] of rocks) {
    const m = add(Game.worldGroup, new THREE.DodecahedronGeometry(s, 0), M(r() < 0.5 ? 0x8a8f86 : 0x7c8378), x, s * 0.35, z);
    m.scale.set(1, 0.7, 1); m.rotation.set(r(), r() * 6, r());
  }
}

// ═══════════════════════════════════════════════════════════════════
// TANAH, JALAN BATU, KEBUN, BANGKU
// ═══════════════════════════════════════════════════════════════════

function buildGrounds() {
  // Rumput halaman = medan dunia (world.js), rata di sekitar rumah dan
  // sungai — tanpa platform terpisah yang tepinya terlihat sebagai garis.
  // (Padang di seberang sungai = medan dunia, warnanya sama dengan platform —
  //  tanpa kotak rumput terpisah yang dulu terlihat terpotong di ujungnya.)

  // Jalan batu bulat (Kopfsteinpflaster)
  const cobble = (rx, ry) => canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#a99d84'; ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
        const c = 170 + Math.floor(r() * 40);
        ctx.fillStyle = `rgb(${c},${c - 10},${c - 30})`;
        ctx.beginPath();
        ctx.ellipse(x + 8 + (r() - 0.5) * 2, y + 8 + (r() - 0.5) * 2, 6.5, 6, r(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [rx, ry]);
  const pathMat = (rx, ry) => new THREE.MeshLambertMaterial({ map: cobble(rx, ry) });
  const front = add(Game.worldGroup, B(6.2, 0.04, 2.2), pathMat(3.1, 1.1), -0.3, 0.03, 3.0, false);
  const east = add(Game.worldGroup, B(8, 0.04, 2.2), pathMat(4, 1.1), 7, 0.03, 3.0, false);
  const ramp = add(Game.worldGroup, B(2.5, 0.35, 2), pathMat(1.25, 1), -4.2, 0.18, 2, false);
  const landing = add(Game.worldGroup, B(1.4, 0.5, 2.6), pathMat(0.7, 1.3), -4.5, 0.25, 2, false);
  const farLanding = add(Game.worldGroup, B(1.4, 0.5, 2.6), M(0x5aa43a), -9.5, 0.25, 2, false);
  World.walkables.push(front, east, ramp, landing, farLanding);

  // Kebun sayur Oma: bedeng tanah dengan baris kubis & wortel
  add(Game.worldGroup, B(1.6, 0.1, 1.6), M(0x4a3219), 2.4, 0.04, 5.3, false);
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 3; k++) {
      const x = 1.9 + k * 0.5, z = 4.8 + row * 0.5;
      if (row === 1) {
        add(Game.worldGroup, new THREE.ConeGeometry(0.05, 0.22, 4), M(0xff8c2a), x, 0.12, z, false).rotation.x = Math.PI;
        add(Game.worldGroup, new THREE.ConeGeometry(0.1, 0.25, 4), M(0x4f9a38), x, 0.3, z, false);
      } else {
        add(Game.worldGroup, new THREE.IcosahedronGeometry(0.16, 0), M(row ? 0x7dbb4f : 0x5a9a3c), x, 0.2, z, false);
      }
    }
  }

  // Bangku kayu untuk Tante Maria & Onkel Andre (posisi duduk NPC tetap)
  const bench = new THREE.Group();
  const wood = M(0x8a5a32), iron = M(0x3a3a3a);
  add(bench, B(2, 0.1, 0.6), wood, 0, 0.4, 0);
  add(bench, B(2, 0.12, 0.08), wood, 0, 0.62, -0.26);
  add(bench, B(2, 0.12, 0.08), wood, 0, 0.8, -0.26);
  for (const lx of [-0.85, 0.85]) {
    add(bench, B(0.08, 0.42, 0.55), iron, lx, 0.2, 0);
    add(bench, B(0.08, 0.5, 0.08), iron, lx, 0.65, -0.28);
  }
  bench.position.set(6.8, 0, 5.35);
  Game.worldGroup.add(bench);
  World.colliders.push({ type: 'box', name: 'bench', box: new THREE.Box3(new THREE.Vector3(5.65, 0, 4.95), new THREE.Vector3(7.95, 1.2, 5.75)) });

  // Kotak surat & pagar kayu kecil di ujung jalan timur
  const mb = new THREE.Group(); mb.position.set(9.5, 0, 1.4); Game.worldGroup.add(mb);
  add(mb, B(0.08, 1.0, 0.08), M(0x5a3d26), 0, 0.5, 0);
  add(mb, B(0.36, 0.28, 0.5), M(0xd9a52a), 0, 1.1, 0);
  World.colliders.push({ type: 'cylinder', x: 9.5, z: 1.4, radius: 0.15 });
}

// ═══════════════════════════════════════════════════════════════════
// LAMPU KEBUN, KUNANG-KUNANG, MEJA PERPISAHAN (Quest 10)
// ═══════════════════════════════════════════════════════════════════

function buildGardenLights() {
  const pole = M(0x2f4a3a);
  const gardenLamp = (x, z) => {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6), pole, 0, 0.95, 0);
    const head = add(g, new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xfff0c8, emissiveIntensity: 0.4 }), 0, 2.05, 0, false);
    add(g, new THREE.ConeGeometry(0.18, 0.14, 8), pole, 0, 2.3, 0, false);
    g.position.set(x, 0, z);
    Game.worldGroup.add(g);
    World.colliders.push({ type: 'cylinder', x, z, radius: 0.12 });
    nightLamp(x, z, 2.05, head, { pool: 2.6, power: 10, range: 8, color: 0xffd894 });
  };
  // Berpasangan, tepat di luar tepi jalan batu (z 1.9…4.1): mengapit pangkal
  // jembatan dan ujung jalan timur — tidak ada yang berdiri di jalan.
  // Jembatan sudah punya lentera di tiang ujungnya; lampu taman mengapit
  // ujung jalan timur dan menerangi jalan depan rumah dari sisi selatan.
  gardenLamp(-2.6, 4.55);
  gardenLamp(10.9, 1.45); gardenLamp(10.9, 4.55);

  World.fireflyAreas = World.fireflyAreas || [];
  World.fireflyAreas.push(
    { x0: 1.5, x1: 11, z0: 6.5, z1: 12, n: 18 },
    { x0: -4, x1: 1.5, z0: 5.5, z1: 11, n: 10 },
    { x0: -12, x1: -5, z0: -9, z1: 9, n: 16 },
    { x0: 6, x1: 12, z0: -11, z1: -2, n: 12 },
  );

  const qs = (typeof window !== 'undefined' && window.__questState__) || {};
  if (qs.quest_10 !== 'active' && qs.quest_10 !== 'completed') return;
  const wood = M(0x8a5a34), cloth = M(0xf3ead6);
  const table = new THREE.Group();
  add(table, B(1.8, 0.08, 1.0), wood, 0, 0.76, 0);
  add(table, B(1.84, 0.02, 0.7), cloth, 0, 0.81, 0, false);
  for (const lx of [-0.8, 0.8]) for (const lz of [-0.4, 0.4]) add(table, B(0.07, 0.74, 0.07), wood, lx, 0.37, lz);
  for (const [px, pz] of [[-0.55, -0.22], [0, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]]) add(table, new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), M(0xffffff), px, 0.83, pz, false);
  add(table, new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16), M(0xd9a05b), 0, 0.89, 0.18, false);
  const lantern = add(table, B(0.14, 0.2, 0.14), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffc060, emissiveIntensity: 0.6 }), -0.3, 0.92, 0.12, false);
  table.position.set(4.2, 0, 5.65);
  Game.worldGroup.add(table);
  World.colliders.push({ type: 'box', name: 'abschied-tisch', box: new THREE.Box3(new THREE.Vector3(3.25, 0, 5.1), new THREE.Vector3(5.15, 1, 6.2)) });
  nightLamp(4.2, 5.65, 1.2, lantern, { pool: 2.6, power: 12, range: 8, color: 0xffc46a });

  const postL = { x: 2.7, z: 4.4 }, postR = { x: 6.0, z: 4.4 };
  for (const pp of [postL, postR]) {
    add(Game.worldGroup, new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), wood, pp.x, 1.25, pp.z);
    World.colliders.push({ type: 'cylinder', x: pp.x, z: pp.z, radius: 0.1 });
  }
  const colors = [0xffd27a, 0xff8a7a, 0x9ad8ff, 0xb8ff9a, 0xffe08a];
  const N = 13;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = postL.x + (postR.x - postL.x) * t, y = 2.45 - Math.sin(Math.PI * t) * 0.45;
    const c = colors[i % colors.length];
    const bulb = add(Game.worldGroup, new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }), x, y, postL.z, false);
    if (i % 4 === 0) nightLamp(x, postL.z, y, bulb, { pool: 1.6, power: 4, range: 5, color: c });
    else nightLamp(x, postL.z, y, bulb, { pool: 0.01, power: 0, color: c, noPool: true });
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUASANA: serbuk serbuk cahaya, burung, kupu-kupu
// ═══════════════════════════════════════════════════════════════════

function buildAmbient() {
  const r = rng(41);
  const pc = 40;
  const pp = new Float32Array(pc * 3), ph = new Float32Array(pc);
  for (let i = 0; i < pc; i++) {
    pp[i * 3] = (r() - 0.5) * 20; pp[i * 3 + 1] = 1 + r() * 4; pp[i * 3 + 2] = (r() - 0.5) * 20; ph[i] = r() * Math.PI * 2;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  Game.worldGroup.add(new THREE.Points(partGeo, new THREE.PointsMaterial({ color: 0xffffcc, size: 0.12, transparent: true, opacity: 0.5 })));

  const birds = new THREE.Group();
  const bGeo = new THREE.ConeGeometry(0.12, 0.35, 3); bGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
    b.userData = { off: r() * 6.28, spd: 0.2 + r() * 0.3, rad: 6 + r() * 5 };
    birds.add(b);
  }
  Game.worldGroup.add(birds);

  // Kupu-kupu di sekitar kebun & bunga
  const flies = [];
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.12);
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Group();
    const col = [0xffe14d, 0xffffff, 0xff9a3c][i % 3];
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const l = new THREE.Mesh(wingGeo, mat); l.position.x = -0.08; f.add(l);
    const rr = new THREE.Mesh(wingGeo, mat); rr.position.x = 0.08; f.add(rr);
    f.userData = { l, r: rr, cx: 1 + r() * 8, cz: 5 + r() * 5, off: r() * 6.28 };
    Game.worldGroup.add(f);
    flies.push(f);
  }

  _updates.push((d, t) => {
    const pa = partGeo.attributes.position;
    for (let i = 0; i < pc; i++) pa.setY(i, 1 + Math.sin(t * 1.5 + ph[i]) * 0.5);
    pa.needsUpdate = true;
    birds.children.forEach(b => {
      const tt = t * b.userData.spd + b.userData.off;
      b.position.set(Math.cos(tt) * b.userData.rad, 10 + Math.sin(tt * 0.5), Math.sin(tt) * b.userData.rad);
      b.rotation.y = -tt; b.scale.x = 1 + Math.sin(t * 12) * 0.4;
    });
    for (const f of flies) {
      const u = f.userData, tt = t * 0.5 + u.off;
      f.position.set(u.cx + Math.sin(tt * 1.3) * 1.4, 0.7 + Math.sin(tt * 3.1) * 0.25, u.cz + Math.cos(tt * 0.9) * 1.2);
      f.rotation.y = tt;
      const flap = Math.sin(t * 18 + u.off) * 0.9;
      u.l.rotation.y = flap; u.r.rotation.y = -flap;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════

export function buildHausYard() {
  _mats = new Map();
  _updates.length = 0;
  buildGrounds();
  buildRiver();
  buildBridge();
  buildFarmhouse();
  buildWindmill(5, -5);
  buildVegetation();
  buildGardenLights();
  buildAmbient();
  World._updateAmbient = (d, t) => { for (const fn of _updates) fn(d, t); };
}
