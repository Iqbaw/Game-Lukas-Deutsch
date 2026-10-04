// ═══════════════════════════════════════════════════════════════════
// js/zone.js — ZONE MANAGER (Isometric Zone System)
//
// Mengelola pemuatan dan pembongkaran zona.
// Setiap zona adalah "diorama" kecil yang berdiri sendiri.
// Transisi antar zona menggunakan fade-to-black.
//
// API publik:
//   - initZones()             → setup awal
//   - loadZone(zoneId)        → muat zona baru (unload lama, load baru)
//   - getCurrentZone()        → id zona aktif
//   - ZONE_DEFS               → definisi semua zona
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { Game }                     from './main.js';
import { CONFIG, ZONES, COLORS }    from './config.js';
import { World }                    from './world.js';
import { Player, teleportPlayer }   from './player.js';
import { spawnNPC, despawnAllNPCs }  from './npc.js';
import { getNPCsInZone }            from './data/npcs.js';
import { showToast }                from './ui.js';
import { applyTimeOfDay }           from './night.js';

// ═══════════════════════════════════════════════════════════════════
// 0. ZONE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Setiap zona punya:
 *   id       : ZONES constant
 *   name     : nama tampilan
 *   size     : { w, h } ukuran area
 *   spawn    : { x, z, facing } titik spawn pemain
 *   portals  : array portal → { kind, x, y, z, w, d, rotY, target, targetSpawn, label }
 *              kind 'gate' = gerbang antar zona, 'door' = pintu gedung (lihat buildPortals)
 *   builder  : string nama fungsi builder di world.js
 */
export const ZONE_DEFS = {

  [ZONES.HAUS]: {
    id:     ZONES.HAUS,
    name:   'Haus der Großeltern',
    nameID: 'Rumah Kakek-Nenek',
    size:   { w: 28, h: 28 },
    // Default spawn 1.5m selatan pintu rumah, di luar trigger zone portal masuk
    spawn:  { x: 0, z: 4.8, facing: 0 },
    portals: [
      {
        // Gerbang kota di ujung BARAT jembatan kayu. Lebar gerbang = lebar
        // jembatan (pagar di z 0.8 & 3.2); lorong menghadap arah jalan (timur-barat).
        kind: 'gate',
        x: -10, y: 0.5, z: 2, w: 2.5, d: 1.2, rotY: Math.PI / 2,
        target: ZONES.STADT,                  // → Kota terpadu (Stage 2)
        targetSpawn: { x: -24, z: 27.6, facing: Math.PI }, // ujung kota dari Alte Brücke
        label:  'Zur Stadt',
      },
      {
        // PINTU rumah — hanya alas bercahaya di depan pintu kayu (door world pos = 0, 2.06).
        // Trigger zone: x=[-1.5..1.5], z=[1.5..3.7]. Spawn jauh di selatan (z=4.8).
        kind: 'door',
        x: 0, z: 2.6, w: 2.0, d: 1.4,
        target: ZONES.HAUS_INTERIOR,
        // Spawn di Wohnzimmer, JAUH dari pintu exit (z<11.4) supaya tidak loop
        targetSpawn: { x: 3, z: 9, facing: 0 },
        label:  'Haus betreten',
      },
    ],
  },

  [ZONES.HAUS_INTERIOR]: {
    id:     ZONES.HAUS_INTERIOR,
    name:   'Omas Haus — Innen',
    nameID: 'Interior Rumah Oma',
    size:   { w: 40, h: 32 },
    // Spawn di samping kasur Lukas (kamar pojok kiri-atas)
    spawn:  { x: -11, z: -9, facing: Math.PI/2 },
    portals: [
      {
        // Pintu depan rumah ada di Wohnzimmer (south wall, gap x=1..5)
        kind: 'door',
        x: 3, z: 13.2, w: 3.8, d: 2.6,
        target: ZONES.HAUS,
        // Spawn JAUH di selatan pintu masuk (z=4.8 > portal masuk z=3.3 max),
        // supaya player tidak langsung re-enter portal masuk
        targetSpawn: { x: 0, z: 4.8, facing: 0 },
        label:  'Hinausgehen',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // STADT — Kota terpadu (Stage 2), dibangun oleh js/stadt.js.
  // Satu gerbang navigasi (Alte Brücke → rumah Oma) + pintu EDEKA.
  // ═══════════════════════════════════════════════════════════════
  [ZONES.STADT]: {
    id:     ZONES.STADT,
    name:   'Die Stadt',
    nameID: 'Kota',
    size:   { w: 84, h: 82 },     // ke selatan sampai ujung Alte Brücke di atas Elbe yang lebar
    // Masuk di ujung selatan Schillerstraße, tepat setelah Alte Brücke
    spawn:  { x: -24, z: 27.6, facing: Math.PI },
    portals: [
      {
        // Gerbang di ujung selatan Alte Brücke: kembali ke rumah Oma
        kind: 'gate',
        x: -24, y: 0.26, z: 39.6, w: 4.4, d: 1.4,      // y = tinggi dek jembatan (ujung selatan)
        target: ZONES.HAUS,
        // Spawn di UJUNG TIMUR jembatan (sisi rumah) — BUKAN di sungai (x -9..-5)!
        targetSpawn: { x: -3.5, z: 2.2, facing: Math.PI / 2 },
        label:  'Nach Hause',
      },
      {
        // Pintu kaca EDEKA (fasad timur, menghadap Parkplatz) → interior
        kind: 'door',
        x: -8.3, z: 15, w: 2.4, d: 1.0, rotY: Math.PI / 2,
        target: ZONES.SUPERMARKET_INTERIOR,
        targetSpawn: { x: 5, z: 2, facing: -Math.PI / 2 },
        label:  'EDEKA betreten',
      },
    ],
  },

  [ZONES.SUPERMARKET_INTERIOR]: {
    id:     ZONES.SUPERMARKET_INTERIOR,
    name:   'EDEKA Innenraum',
    nameID: 'Interior Supermarket',
    size:   { w: 15, h: 15 },
    // Masuk lewat pintu di dinding timur (sama seperti fasad EDEKA di kota)
    spawn:  { x: 5, z: 2, facing: -Math.PI / 2 },
    portals: [
      {
        kind: 'door',
        x: 6.9, z: 2, w: 2.2, d: 1.0, rotY: Math.PI / 2,
        target: ZONES.STADT,
        targetSpawn: { x: -6, z: 15, facing: Math.PI / 2 }, // di depan pintu EDEKA, menghadap Parkplatz
        label:  'Ausgang',
      },
    ],
  },
};

// Zona lama (kota A/B/C terpisah) sudah digabung ke STADT. Simpanan lama
// yang masih menyebut zona itu diarahkan ke kota terpadu.
if (typeof window !== 'undefined') window.__ZONE_DEFS__ = ZONE_DEFS;

const LEGACY_ZONES = {
  [ZONES.SUPERMARKT]: ZONES.STADT,
  [ZONES.SCHULE]:     ZONES.STADT,
  [ZONES.HAFEN]:      ZONES.STADT,
};


// ═══════════════════════════════════════════════════════════════════
// 1. STATE
// ═══════════════════════════════════════════════════════════════════

let currentZoneId = null;
let portalMeshes  = [];       // array of { mesh, portal } untuk collision check
let _transitionBusy = false;  // lock supaya tidak double-trigger

// Fade overlay
let $fadeOverlay = null;


// ═══════════════════════════════════════════════════════════════════
// 2. INIT
// ═══════════════════════════════════════════════════════════════════

export function initZones() {
  // Buat fade overlay element
  $fadeOverlay = document.createElement('div');
  $fadeOverlay.id = 'zone-fade-overlay';
  $fadeOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: #0a0808;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
  `;
  document.body.appendChild($fadeOverlay);
}


// ═══════════════════════════════════════════════════════════════════
// 3. LOAD ZONE
// ═══════════════════════════════════════════════════════════════════

/**
 * Muat zona baru. Kalau sudah ada zona lama, unload dulu.
 * @param {string} zoneId - ID zona dari ZONES constant
 * @param {object} [customSpawn] - override spawn { x, z, facing }
 * @param {boolean} [instant] - true = tanpa fade (saat pertama kali)
 */
export async function loadZone(zoneId, customSpawn = null, instant = false) {
  if (!ZONE_DEFS[zoneId] && LEGACY_ZONES[zoneId]) {
    zoneId = LEGACY_ZONES[zoneId];
    customSpawn = null;
  }
  const def = ZONE_DEFS[zoneId];
  if (!def) {
    console.error('[zone] Zone not found:', zoneId);
    return;
  }

  if (_transitionBusy) return;
  _transitionBusy = true;
  window.__zoneTransitionBusy__ = true;
  let usedSpawn = null;

  try {
    if (!instant && currentZoneId) {
      // Fade out
      await fadeOut();
    }

    // Unload zona lama
    if (currentZoneId) {
      unloadCurrentZone();
    }

    // Set zona baru
    currentZoneId = zoneId;
    // Expose ke window untuk quest.js reach_zone step detection
    window.__currentZoneId__ = zoneId;
    // Expose batas zona untuk clamp player per-zona (kota besar butuh ini)
    if (def.size) {
      window.__zoneBounds__ = { halfW: def.size.w / 2, halfH: def.size.h / 2 };
    } else {
      window.__zoneBounds__ = null;
    }
    // Reset registry gedung kota (diisi ulang oleh buildStadt bila zona STADT)
    if (zoneId !== ZONES.STADT) window.__stadtBuildings__ = null;

    // Import world builder dan panggil builder zona
    try {
      const worldModule = await import('./world.js');
      worldModule.buildZone(zoneId, def);
    } catch (buildErr) {
      console.error('[zone] buildZone error:', buildErr);
    }
    // Siang / malam sesuai kemajuan cerita (js/night.js)
    try {
      applyTimeOfDay(zoneId);
    } catch (buildErr) {
      console.error('[zone] buildZone error:', buildErr);
    }

    // Spawn NPC untuk zona ini
    const zoneNPCs = getNPCsInZone(zoneId);
    zoneNPCs.forEach(npcData => spawnNPC(npcData));

    // Spawn portal meshes
    buildPortals(def);

    // Teleport pemain (spawn kustom yang kini berada di dalam gedung —
    // mis. dari simpanan versi lama — diganti spawn default zona)
    const sp = (customSpawn && isSpawnFree(customSpawn.x, customSpawn.z)) ? customSpawn : def.spawn;
    teleportPlayer(sp.x, sp.z, sp.facing);
    usedSpawn = sp;

    // Toast notification
    if (!instant) {
      showToast({
        title: def.name,
        body:  def.nameID,
        type:  'info',
        icon:  '🗺️',
        duration: 3000,
      });
    }

    // Dispatch zone event
    window.dispatchEvent(new CustomEvent('zone:enter', {
      detail: { zoneId, zoneName: def.name }
    }));

    if (!instant) {
      // Fade in
      await fadeIn();
    }

    if (CONFIG.DEBUG) console.log('[zone] Loaded:', zoneId);

  } catch (err) {
    console.error('[zone] loadZone fatal error:', err);
    // Force clear fade overlay on any error
    if ($fadeOverlay) {
      $fadeOverlay.style.opacity = '0';
      $fadeOverlay.style.pointerEvents = 'none';
    }
  } finally {
    _transitionBusy = false;
    window.__zoneTransitionBusy__ = false;
  }
  return usedSpawn;   // titik spawn yang benar-benar dipakai (atau null bila gagal)
}


// ═══════════════════════════════════════════════════════════════════
// 4. UNLOAD ZONE
// ═══════════════════════════════════════════════════════════════════

function unloadCurrentZone() {
  // Hapus semua object dari worldGroup
  while (Game.worldGroup.children.length > 0) {
    const child = Game.worldGroup.children[0];
    Game.worldGroup.remove(child);
    disposeObject(child);
  }

  // Hapus semua quest items dari itemsGroup (cegah duplikasi antar zona)
  if (Game.itemsGroup) {
    while (Game.itemsGroup.children.length > 0) {
      const child = Game.itemsGroup.children[0];
      Game.itemsGroup.remove(child);
      disposeObject(child);
    }
  }

  // Hapus semua NPC
  despawnAllNPCs();

  // Clear colliders
  World.colliders.length = 0;
  World.walkables.length = 0;
  World.streetLamps.length = 0;
  World.windowLights.length = 0;
  World.nightLamps = [];
  World.fireflyAreas = [];

  // Clear portal meshes
  portalMeshes.forEach(p => {
    if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    if (p.label && p.label.parent) p.label.parent.remove(p.label);
  });
  portalMeshes = [];

  // Reset world refs
  World.ground = null;
  World.road = null;
  World.house = null;
  World.garage = null;
  World.garden = null;
  World.river = null;
  World._updateRiver = null;
  World._updateClouds = null;
  World._updateAmbient = null;
}


// Sama dengan uji tabrakan pemain (player.js, radius 0.4): titik yang gagal
// di sini akan membuat pemain terkunci dan tidak bisa bergerak.
function isSpawnFree(x, z) {
  const r = 0.4;
  return !World.colliders.some(c => {
    if (c.type === 'cylinder') return (x - c.x) ** 2 + (z - c.z) ** 2 < (c.radius + r) ** 2;
    if (c.type === 'box' && c.box) {
      return x >= c.box.min.x - r && x <= c.box.max.x + r && z >= c.box.min.z - r && z <= c.box.max.z + r;
    }
    return false;
  });
}

function disposeObject(obj) {
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}


// ═══════════════════════════════════════════════════════════════════
// 5. PORTAL SYSTEM
// ═══════════════════════════════════════════════════════════════════

/**
 * Dua jenis portal:
 *   kind 'gate' — perjalanan antar zona: gerbang batu dengan balok kayu,
 *                 papan tujuan dua sisi dan tirai cahaya di lorongnya.
 *   kind 'door' — masuk/keluar gedung: hanya alas bercahaya di depan pintu,
 *                 karena pintu gedungnya sendiri sudah menunjukkan jalan masuk.
 * Frame lokal: lebar lorong (w) di sumbu x, arah berjalan (d) di sumbu z.
 */
function buildPortals(zoneDef) {
  if (!zoneDef.portals) return;

  zoneDef.portals.forEach(portal => {
    const kind = portal.kind || 'gate';
    const w = portal.w || 2, d = portal.d || 2;
    const group = new THREE.Group();
    group.name = `portal-${portal.target}`;
    group.position.set(portal.x, portal.y || 0, portal.z);
    if (portal.rotY) group.rotation.y = portal.rotY;

    // Alas bercahaya persegi = area pemicu yang sebenarnya
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.3, d + 0.3),
      new THREE.MeshBasicMaterial({ map: padTexture((w + 0.3) / (d + 0.3)), transparent: true, opacity: 0.85, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.045;
    pad.renderOrder = 2;
    group.add(pad);

    if (kind === 'gate') buildGate(group, portal, w);

    // Partikel cahaya di dalam lorong
    const moteGeo = new THREE.SphereGeometry(0.045, 6, 6);
    for (let i = 0; i < (kind === 'gate' ? 7 : 4); i++) {
      const mote = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.6 }));
      mote.position.set((Math.random() - 0.5) * w * 0.8, 0.5 + Math.random() * 2, (Math.random() - 0.5) * d * 0.5);
      mote.userData.floatOffset = Math.random() * Math.PI * 2;
      mote.userData.floatSpeed = 0.5 + Math.random() * 0.5;
      group.add(mote);
    }

    Game.worldGroup.add(group);
    portalMeshes.push({ mesh: pad, portal, group });
  });
}

function padTexture(aspect) {
  const H = 128, W = Math.max(64, Math.min(512, Math.round(H * aspect)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const r = Math.min(W, H) * 0.22;
  const rr = (x, y, w, h) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  ctx.fillStyle = 'rgba(244,196,48,0.16)'; rr(10, 10, W - 20, H - 20); ctx.fill();
  ctx.shadowColor = 'rgba(255,214,90,0.9)'; ctx.shadowBlur = 14;
  ctx.strokeStyle = 'rgba(255,220,110,0.95)'; ctx.lineWidth = 7; rr(12, 12, W - 24, H - 24); ctx.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#f4c430'; ctx.lineWidth = 6; ctx.strokeRect(7, 7, 498, 114);
  ctx.fillStyle = '#ffd966'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 64;
  do { ctx.font = `bold ${size}px Georgia, serif`; size -= 2; } while (ctx.measureText(text).width > 440 && size > 20);
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function buildGate(group, portal, w) {
  const lift = portal.y || 0;               // tiang tetap berdiri di tanah walau alas dinaikkan
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const box = (bw, bh, bd, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const stone = lam(0x9c9284), stoneDark = lam(0x7a7166), wood = lam(0x5b3b22);
  const postX = w / 2 + 0.25;
  for (const s of [-1, 1]) {
    box(0.6, 0.35 + lift, 0.6, stoneDark, s * postX, (0.35 + lift) / 2 - lift, 0);
    box(0.44, 2.95, 0.44, stone, s * postX, 1.82, 0);
    box(0.6, 0.18, 0.6, stoneDark, s * postX, 3.38, 0);
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84a, emissiveIntensity: 0.9 }));
    lantern.position.set(s * postX, 3.62, 0);
    group.add(lantern);
    // Tiang gerbang tidak bisa ditembus
    const rot = portal.rotY || 0;
    World.colliders.push({ type: 'cylinder', x: portal.x + s * postX * Math.cos(rot), z: portal.z - s * postX * Math.sin(rot), radius: 0.3 });
  }
  box(w + 1.2, 0.28, 0.38, wood, 0, 3.12, 0);
  box(w + 0.6, 0.12, 0.24, wood, 0, 2.92, 0);

  // Papan tujuan menggantung, tulisan di kedua sisi
  const bw = Math.min(w + 0.2, 2.6), bh = bw * 0.25;
  box(bw + 0.12, bh + 0.12, 0.08, wood, 0, 2.55, 0);
  const chainTop = 2.86, chainBottom = 2.55 + bh / 2;
  for (const s of [-1, 1]) box(0.03, chainTop - chainBottom, 0.03, lam(0x333333), s * bw * 0.4, (chainTop + chainBottom) / 2, 0);
  const tex = labelTexture(portal.label || portal.target);
  for (const s of [1, -1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0, 2.55, s * 0.045);
    if (s < 0) face.rotation.y = Math.PI;
    group.add(face);
  }

  // Tirai cahaya lembut di lorong (dianimasikan di updateZones)
  const cc = document.createElement('canvas'); cc.width = 4; cc.height = 128;
  const cx = cc.getContext('2d');
  const grad = cx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,214,90,0)');
  grad.addColorStop(1, 'rgba(255,214,90,0.55)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 4, 128);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, 2.2), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cc), transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  curtain.position.y = 1.15;
  curtain.userData.curtain = true;
  group.add(curtain);
}


// ═══════════════════════════════════════════════════════════════════
// 6. PORTAL PROXIMITY CHECK (dipanggil dari game loop)
// ═══════════════════════════════════════════════════════════════════

let _portalAccum = 0;

export function updateZones(delta, elapsed) {
  // Animasi glow partikel di portal
  portalMeshes.forEach(({ group }) => {
    group.children.forEach(child => {
      if (child.userData.floatOffset !== undefined) {
        child.position.y = 1.2 + Math.sin(elapsed * child.userData.floatSpeed + child.userData.floatOffset) * 0.8;
        child.material.opacity = 0.3 + Math.sin(elapsed * 2 + child.userData.floatOffset) * 0.3;
      }
    });
  });

  // Alas & tirai berdenyut pelan
  portalMeshes.forEach(({ mesh, group }) => {
    mesh.material.opacity = 0.7 + Math.sin(elapsed * 2) * 0.2;
    group.children.forEach(child => {
      if (child.userData.curtain) child.material.opacity = 0.42 + Math.sin(elapsed * 1.6) * 0.14;
    });
  });

  // Cek proximity pemain ke portal (throttle)
  _portalAccum += delta;
  if (_portalAccum >= 0.15) {
    _portalAccum = 0;
    checkPortalProximity();
  }
}


function checkPortalProximity() {
  if (_transitionBusy || !Player.group) return;

  const px = Player.position.x;
  const pz = Player.position.z;

  for (const { portal } of portalMeshes) {
    const hw = (portal.w || 2) / 2 + 0.5;
    const hd = (portal.d || 2) / 2 + 0.5;

    if (
      Math.abs((px-portal.x)*Math.cos(portal.rotY||0) - (pz-portal.z)*Math.sin(portal.rotY||0)) <= hw &&
      Math.abs((px-portal.x)*Math.sin(portal.rotY||0) + (pz-portal.z)*Math.cos(portal.rotY||0)) <= hd
    ) {
      // Pemain masuk portal!
      const targetDef = ZONE_DEFS[portal.target];
      if (targetDef) {
        // Cari spawn point: jika ada targetSpawn, pakai itu
        const spawnPoint = portal.targetSpawn || targetDef.spawn;
        loadZone(portal.target, spawnPoint);
      }
      return;
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
// 7. FADE EFFECTS
// ═══════════════════════════════════════════════════════════════════

function fadeOut() {
  return new Promise(resolve => {
    if (!$fadeOverlay) { resolve(); return; }
    $fadeOverlay.style.pointerEvents = 'all';
    $fadeOverlay.style.opacity = '1';
    setTimeout(resolve, 550);
  });
}

function fadeIn() {
  return new Promise(resolve => {
    if (!$fadeOverlay) { resolve(); return; }
    $fadeOverlay.style.opacity = '0';
    setTimeout(() => {
      $fadeOverlay.style.pointerEvents = 'none';
      resolve();
    }, 550);
  });
}


// ═══════════════════════════════════════════════════════════════════
// 8. HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getCurrentZone() {
  return currentZoneId;
}

export function getZoneDef(zoneId) {
  return ZONE_DEFS[zoneId] || null;
}
