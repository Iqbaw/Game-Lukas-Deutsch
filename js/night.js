// ═══════════════════════════════════════════════════════════════════
// js/night.js — SUASANA MALAM
//
// Waktu diturunkan dari kemajuan quest (data/quests.js timeOfDay):
// setelah makan malam Quest 6 → malam (Quest 7), hari berikutnya siang
// (Quest 8–9), malam perpisahan (Quest 10).
//
// Malam hari:
//   • langit biru tua penuh bintang yang berkelip lembut
//   • cahaya bulan, ambient biru, kabut gelap
//   • setiap jendela gedung menyala hangat, setiap lampu jalan/taman
//     menyala dengan lingkaran cahaya di tanah + beberapa lampu sungguhan
//     di dekat Lukas (agar gedung & pemain benar-benar tersinari)
//   • kunang-kunang terang di taman dan kebun
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { Game, registerUpdate } from './main.js';
import { CONFIG, ZONES } from './config.js';
import { World } from './world.js';
import { timeOfDay } from './data/quests.js';

const POOL_SIZE = 6;            // lampu titik sungguhan yang berpindah ke lampu terdekat
const NIGHT_FOG = 0x0b1430;

let day = null;                 // nilai siang yang disimpan untuk dipulihkan
let nightObjects = [];          // objek yang dibuat untuk malam (dibuang tiap zona)
let fireflies = null;
let pool = [];
let poolTimer = 0;
let skyTex = null;
let glowTex = null;
let active = false;

export const Night = {
  get active() { return active; },
};

export function isNight() {
  return timeOfDay((typeof window !== 'undefined' && window.__questState__) || {}) === 'night';
}

function captureDay() {
  if (day || !Game.scene) return;
  day = {
    ambient: { color: Game.ambientLight.color.clone(), intensity: Game.ambientLight.intensity },
    sun:     { color: Game.sunLight.color.clone(), intensity: Game.sunLight.intensity },
    hemi:    { sky: Game.hemiLight.color.clone(), ground: Game.hemiLight.groundColor.clone(), intensity: Game.hemiLight.intensity },
    background: Game.scene.background,
    fog:     Game.scene.fog ? Game.scene.fog.color.clone() : null,
    exposure: Game.renderer.toneMappingExposure,
    bloom:   Game.bloomPass ? { strength: Game.bloomPass.strength, threshold: Game.bloomPass.threshold } : null,
  };
}

function restoreDay() {
  if (!day) return;
  Game.ambientLight.color.copy(day.ambient.color); Game.ambientLight.intensity = day.ambient.intensity;
  Game.sunLight.color.copy(day.sun.color); Game.sunLight.intensity = day.sun.intensity;
  Game.hemiLight.color.copy(day.hemi.sky); Game.hemiLight.groundColor.copy(day.hemi.ground);
  Game.hemiLight.intensity = day.hemi.intensity;
  Game.scene.background = day.background;
  if (Game.scene.fog && day.fog) Game.scene.fog.color.copy(day.fog);
  Game.renderer.toneMappingExposure = day.exposure;
  if (Game.bloomPass && day.bloom) {
    Game.bloomPass.strength = day.bloom.strength;
    Game.bloomPass.threshold = day.bloom.threshold;
  }
  document.body.classList.remove('is-night', 'night-indoor');
}

/**
 * Pita langit berbintang di tepi atas layar. Kamera isometrik tidak pernah
 * melihat langit, jadi bintang ditampilkan sebagai lapisan lembut di atas
 * kanvas (di bawah label & HUD) yang memudar ke bawah.
 */
function ensureSkyBand() {
  if (document.getElementById('night-sky')) return;
  const host = document.getElementById('game-container');
  if (!host) return;
  const el = document.createElement('div');
  el.id = 'night-sky';
  el.className = 'night-sky';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="ns-stars ns-a"></div><div class="ns-stars ns-b"></div><div class="ns-moon"></div>';
  host.appendChild(el);
}

// ── Tekstur ──────────────────────────────────────────────────────
function starrySky() {
  if (skyTex) return skyTex;
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#040817');
  g.addColorStop(0.45, '#0b1534');
  g.addColorStop(0.8, '#1a2a5c');
  g.addColorStop(1, '#2b3a6e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Bimasakti tipis
  ctx.save();
  ctx.translate(W * 0.5, H * 0.35); ctx.rotate(-0.35);
  const mw = ctx.createRadialGradient(0, 0, 10, 0, 0, W * 0.55);
  mw.addColorStop(0, 'rgba(160,170,255,0.10)'); mw.addColorStop(1, 'rgba(160,170,255,0)');
  ctx.fillStyle = mw; ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(0, 0, W * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Bintang (acak tetap)
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = rnd() * H * 0.92;
    const r = rnd() < 0.08 ? 1.6 + rnd() * 1.1 : 0.5 + rnd() * 0.8;
    const a = 0.45 + rnd() * 0.55;
    const tint = rnd();
    ctx.fillStyle = tint < 0.15 ? `rgba(255,226,180,${a})` : tint < 0.3 ? `rgba(190,210,255,${a})` : `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (r > 1.5) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      halo.addColorStop(0, 'rgba(255,255,255,0.35)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Bulan sabit
  const mx = W * 0.8, my = H * 0.18;
  const moon = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
  moon.addColorStop(0, 'rgba(255,248,220,0.35)'); moon.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(mx, my, 60, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d1838'; ctx.beginPath(); ctx.arc(mx + 8, my - 5, 16, 0, Math.PI * 2); ctx.fill();
  skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  return skyTex;
}

function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function track(obj) {
  nightObjects.push(obj);
  Game.scene.add(obj);
  return obj;
}

/** Lingkaran cahaya di tanah + halo di kepala lampu. */
function lampGlow(x, z, headY, color = 0xffc878, radius = 3.2, halo = true) {
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, 0.07, z);
  pool.renderOrder = 2;
  track(pool);
  if (!halo) return;
  const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  haloSprite.scale.set(1.6, 1.6, 1);
  haloSprite.position.set(x, headY, z);
  track(haloSprite);
}

// ── Kunang-kunang ────────────────────────────────────────────────
function buildFireflies(areas) {
  const per = [];
  for (const a of areas) {
    const n = a.n || Math.round(Math.max(6, (a.x1 - a.x0) * (a.z1 - a.z0) / 7));
    for (let i = 0; i < n; i++) per.push(a);
  }
  if (!per.length) return null;
  const pos = new Float32Array(per.length * 3);
  const phase = new Float32Array(per.length);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  per.forEach((a, i) => {
    pos[i * 3] = a.x0 + rnd() * (a.x1 - a.x0);
    pos[i * 3 + 1] = 0.5 + rnd() * 1.6;
    pos[i * 3 + 2] = a.z0 + rnd() * (a.z1 - a.z0);
    phase[i] = rnd();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: 15 * Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: `
      attribute float phase;
      uniform float uTime;
      uniform float uSize;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * 0.55 + phase * 40.0;
        p.x += sin(t * 0.9 + phase * 6.28) * 0.9 + sin(t * 2.1) * 0.15;
        p.z += cos(t * 0.7 + phase * 4.0) * 0.9;
        p.y += sin(t * 1.6 + phase * 9.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = 0.5 + 0.5 * sin(uTime * (1.6 + phase) + phase * 25.0);
        vAlpha = smoothstep(0.05, 0.9, blink);
        gl_PointSize = uSize * (0.55 + 0.6 * vAlpha);
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float glow = smoothstep(0.5, 0.0, d);
        float core = smoothstep(0.14, 0.0, d);
        vec3 col = mix(vec3(0.62, 0.95, 0.18), vec3(1.0, 1.0, 0.6), core);
        gl_FragColor = vec4(col * (0.85 + core * 0.9), glow * glow * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return pts;
}

// ── Lampu titik sungguhan di sekitar Lukas ───────────────────────
function buildPool() {
  pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const l = new THREE.PointLight(0xffbf6e, 0, 11, 1.6);
    l.castShadow = false;
    track(l);
    pool.push(l);
  }
}

function updatePool() {
  const lamps = (World.nightLamps || []).filter(l => !l.noPool && l.power !== 0);
  if (!pool.length || !Game.player) return;
  const p = Game.player.position;
  const near = lamps
    .map(l => ({ l, d: (l.x - p.x) ** 2 + (l.z - p.z) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, POOL_SIZE);
  pool.forEach((light, i) => {
    const n = near[i];
    if (!n) { light.intensity = 0; return; }
    light.position.set(n.l.x, (n.l.y || 3.4) - 0.4, n.l.z);
    light.color.setHex(n.l.color || 0xffbf6e);
    light.intensity = (n.l.power || 14) * 0.5;
    light.distance = n.l.range || 11;
  });
}

function disposeNight() {
  for (const o of nightObjects) {
    if (o.parent) o.parent.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.dispose) o.material.dispose();
  }
  nightObjects = [];
  fireflies = null;
  pool = [];
}

/**
 * Dipanggil world.js setiap kali zona selesai dibangun.
 * Zona baru selalu dibangun dalam keadaan "siang"; di sini diubah ke malam.
 */
export function applyTimeOfDay(zoneId) {
  if (!Game.scene || !Game.ambientLight) return;
  captureDay();
  disposeNight();
  restoreDay();
  active = isNight();
  if (!active) return;

  const interior = zoneId === ZONES.HAUS_INTERIOR || zoneId === ZONES.SUPERMARKET_INTERIOR;
  document.body.classList.add('is-night');
  document.body.classList.toggle('night-indoor', interior);
  ensureSkyBand();

  Game.scene.background = starrySky();
  if (Game.scene.fog) Game.scene.fog.color.setHex(NIGHT_FOG);
  if (interior) {
    // Di dalam rumah/toko lampu menyala: hanya sedikit lebih hangat & redup
    Game.ambientLight.color.setHex(0xffe2c0); Game.ambientLight.intensity = day.ambient.intensity * 0.85;
    Game.sunLight.color.setHex(0xcfd8ff); Game.sunLight.intensity = day.sun.intensity * 0.45;
    Game.hemiLight.color.setHex(0xffe6c8); Game.hemiLight.intensity = day.hemi.intensity;
    return;
  }

  // Cahaya bulan
  Game.ambientLight.color.setHex(0x6c7cc0); Game.ambientLight.intensity = 0.24;
  Game.sunLight.color.setHex(0x9fb6ff);     Game.sunLight.intensity = 0.4;
  Game.hemiLight.color.setHex(0x3a4c86);    Game.hemiLight.groundColor.setHex(0x1c1a24);
  Game.hemiLight.intensity = 0.34;
  Game.renderer.toneMappingExposure = day.exposure;
  if (Game.bloomPass) {
    Game.bloomPass.strength = 0.5;
    Game.bloomPass.threshold = 0.7;
  }

  // Jendela menyala hangat (semua material kaca yang ditandai)
  const lit = new Set();
  Game.worldGroup.traverse(o => {
    const m = o.material;
    if (!m || lit.has(m) || !m.userData?.nightWindow) return;
    lit.add(m);
    m.emissive.setHex(m.userData.nightColor || 0xffb04a);
    m.emissiveIntensity = m.userData.nightIntensity || 0.8;
  });
  World.windowLights.forEach(m => {
    if (lit.has(m)) return;
    m.emissive?.setHex(0xffc46a);
    m.emissiveIntensity = 0.8;
  });
  // Lampu jalan lama (world.js)
  World.streetLamps.forEach(l => {
    if (l.head?.material?.emissive) l.head.material.emissiveIntensity = 1.4;
  });

  // Lampu jalan & taman: kepala menyala, halo + lingkaran cahaya
  for (const l of World.nightLamps || []) {
    if (l.head?.material) {
      l.head.material.emissive?.setHex(l.color || 0xfff0c0);
      l.head.material.emissiveIntensity = 2.4;
    }
    if (l.noPool) {
      // Bohlam kecil (Lichterkette): hanya halo kecil
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: l.color || 0xffd27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      halo.scale.set(0.55, 0.55, 1);
      halo.position.set(l.x, l.y, l.z);
      track(halo);
      continue;
    }
    lampGlow(l.x, l.z, l.y || 3.4, l.color || 0xffc878, l.pool || 3.2, !!l.head);
  }
  buildPool();
  updatePool();

  // Kunang-kunang di taman & kebun
  fireflies = buildFireflies(World.fireflyAreas || []);
  if (fireflies) track(fireflies);
}

let _registered = false;
export function initNight() {
  if (_registered) return;
  _registered = true;
  registerUpdate((delta, elapsed) => {
    if (!active) return;
    if (fireflies) fireflies.material.uniforms.uTime.value = elapsed ?? performance.now() / 1000;
    poolTimer += delta;
    if (poolTimer > 0.4) { poolTimer = 0; updatePool(); }
  });
}

if (CONFIG.DEBUG && typeof window !== 'undefined') window.__night = { applyTimeOfDay, isNight };
