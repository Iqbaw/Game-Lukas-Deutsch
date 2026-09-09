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

// ═══════════════════════════════════════════════════════════════════
// 0. ZONE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Setiap zona punya:
 *   id       : ZONES constant
 *   name     : nama tampilan
 *   size     : { w, h } ukuran area
 *   spawn    : { x, z, facing } titik spawn pemain
 *   portals  : array portal → { x, z, w, d, target, targetSpawn, label }
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
        x: -10, z: 2, w: 2, d: 2, rotY: -0.3, // Match bridge diagonal
        target: ZONES.STADT,                  // → Kota terpadu (Stage 2)
        targetSpawn: { x: -24, z: 26, facing: Math.PI }, // masuk di ujung Schillerstraße
        label:  '→ In die Stadt',
        labelDE: 'Zur Stadt',
      },
      {
        // PORTAL MASUK rumah — tepat di DEPAN pintu kayu cabin (door world pos = 0, 2.06)
        // Trigger zone: x=[-1.5..1.5], z=[1.5..3.7]. Spawn jauh di selatan (z=4.8) supaya
        // player tidak langsung terjebak loop di portal.
        x: 0, z: 2.6, w: 2.0, d: 1.4,
        target: ZONES.HAUS_INTERIOR,
        // Spawn di Wohnzimmer, JAUH dari pintu exit (z<11.4) supaya tidak loop
        targetSpawn: { x: 3, z: 9, facing: 0 },
        label:  '↑ Haus betreten',
        labelDE: 'Haus betreten',
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
        x: 3, z: 13.2, w: 3.8, d: 2.6,
        target: ZONES.HAUS,
        // Spawn JAUH di selatan pintu masuk (z=4.8 > portal masuk z=3.3 max),
        // supaya player tidak langsung re-enter portal masuk
        targetSpawn: { x: 0, z: 4.8, facing: 0 },
        label:  '↓ Haus verlassen',
        labelDE: 'Hinausgehen',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // STADT — Kota terpadu (Stage 2). Satu peta besar, hanya 1 portal
  // navigasi (kembali ke rumah Oma) + pintu masuk EDEKA (interior).
  // ═══════════════════════════════════════════════════════════════
  [ZONES.STADT]: {
    id:     ZONES.STADT,
    name:   'Die Stadt',
    nameID: 'Kota',
    size:   { w: 84, h: 64 },
    // Masuk dari ujung selatan Schillerstraße (di jalan, bukan di taman)
    spawn:  { x: -24, z: 26, facing: Math.PI },
    portals: [
      {
        // SATU-SATUNYA portal navigasi: kembali ke rumah Oma
        // Ditaruh di UJUNG JALAN Schillerstraße (x=-24), bukan di Stadtpark
        x: -24, z: 29.5, w: 4, d: 2,
        target: ZONES.HAUS,
        // Spawn di UJUNG TIMUR jembatan (sisi rumah) — BUKAN di sungai (x -9..-5)!
        targetSpawn: { x: -3.5, z: 2.2, facing: Math.PI / 2 },
        label:  '↓ Nach Hause',
        labelDE: 'Nach Hause',
      },
      {
        // Pintu masuk EDEKA → interior (bukan navigasi kota)
        x: -2, z: 6.5, w: 2, d: 1.5,
        target: ZONES.SUPERMARKET_INTERIOR,
        targetSpawn: { x: 0, z: 5, facing: Math.PI },
        label:  '→ EDEKA betreten',
        labelDE: 'Eintreten',
      },
    ],
  },

  [ZONES.SUPERMARKT]: {
    id:     ZONES.SUPERMARKT,
    name:   'Stadt A — Supermarkt & Markt',
    nameID: 'Kota A — Supermarket & Pasar',
    size:   { w: 35, h: 30 },
    spawn:  { x: 12, z: 0, facing: -Math.PI / 2 },
    portals: [
      {
        x: 14, z: 0, w: 2, d: 2,
        target: ZONES.HAUS,
        label:  '← Zurück zum Haus',
        labelDE: 'Zum Haus',
      },
      {
        x: -14, z: 0, w: 2, d: 2,
        target: ZONES.SCHULE,
        label:  '→ Zur Stadt B',
        labelDE: 'Stadt B',
      },
      {
        x: -12, z: -6.5, w: 2, d: 1.5,
        target: ZONES.SUPERMARKET_INTERIOR,
        label:  '→ EDEKA betreten',
        labelDE: 'Eintreten',
      },
    ],
  },

  [ZONES.SUPERMARKET_INTERIOR]: {
    id:     ZONES.SUPERMARKET_INTERIOR,
    name:   'EDEKA Innenraum',
    nameID: 'Interior Supermarket',
    size:   { w: 15, h: 15 },
    spawn:  { x: 0, z: 5, facing: Math.PI }, // Facing into the room from the entrance
    // Entrance/Exit portal to go back out
    portals: [
      {
        x: 0, z: 6.5, w: 2, d: 2,
        target: ZONES.STADT,
        targetSpawn: { x: -2, z: 4, facing: Math.PI }, // Keluar di depan pintu EDEKA (STADT)
        label:  '← Ausgang',
        labelDE: 'Ausgang',
      }
    ],
  },

  [ZONES.SCHULE]: {
    id:     ZONES.SCHULE,
    name:   'Stadt B — Schule & Park',
    nameID: 'Kota B — Sekolah & Taman',
    size:   { w: 35, h: 30 },
    spawn:  { x: 12, z: 0, facing: -Math.PI / 2 },
    portals: [
      {
        x: 14, z: 0, w: 2, d: 2,
        target: ZONES.SUPERMARKT,
        label:  '← Zurück zur Stadt A',
        labelDE: 'Stadt A',
      },
      {
        x: -14, z: 0, w: 2, d: 2,
        target: ZONES.HAFEN,
        label:  '→ Zur Stadt C',
        labelDE: 'Stadt C',
      },
    ],
  },

  [ZONES.HAFEN]: {
    id:     ZONES.HAFEN,
    name:   'Stadt C — Hafen & Elbe',
    nameID: 'Kota C — Pelabuhan & Sungai Elbe',
    size:   { w: 35, h: 30 },
    spawn:  { x: 12, z: 0, facing: -Math.PI / 2 },
    portals: [
      {
        x: 14, z: 0, w: 2, d: 2,
        target: ZONES.SCHULE,
        label:  '← Zurück zur Stadt B',
        labelDE: 'Stadt B',
      },
      {
        x: -14, z: 0, w: 2, d: 2,
        target: ZONES.HAUS,
        label:  '← Zurück zum Haus',
        labelDE: 'Zum Haus',
      },
    ],
  },
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
  const def = ZONE_DEFS[zoneId];
  if (!def) {
    console.error('[zone] Zone not found:', zoneId);
    return;
  }

  if (_transitionBusy) return;
  _transitionBusy = true;

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

    // Spawn NPC untuk zona ini
    const zoneNPCs = getNPCsInZone(zoneId);
    zoneNPCs.forEach(npcData => spawnNPC(npcData));

    // Spawn portal meshes
    buildPortals(def);

    // Teleport pemain
    const sp = customSpawn || def.spawn;
    teleportPlayer(sp.x, sp.z, sp.facing);

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
  }
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

function buildPortals(zoneDef) {
  if (!zoneDef.portals) return;

  zoneDef.portals.forEach(portal => {
    const group = new THREE.Group();
    group.name = `portal-${portal.target}`;
    group.position.set(portal.x, 0, portal.z);
    if (portal.rotY) group.rotation.y = portal.rotY;

    // Platform bercahaya
    const platformGeo = new THREE.BoxGeometry(portal.w || 2, 0.15, portal.d || 2);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0xf4c430,
      emissive: 0xf4c430,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.7,
      roughness: 0.3,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, 0.08, 0);
    platform.receiveShadow = true;
    group.add(platform);

    // Tiang portal (dua sisi)
    const pillarGeo = new THREE.BoxGeometry(0.2, 3.5, 0.2);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xd4a882,
      roughness: 0.6,
    });
    const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
    pillarL.position.set(-1, 1.75, 0);
    pillarL.castShadow = true;
    group.add(pillarL);

    const pillarR = pillarL.clone();
    pillarR.position.x = 1;
    group.add(pillarR);

    // Arch atas
    const archGeo = new THREE.BoxGeometry(2.4, 0.3, 0.3);
    const arch = new THREE.Mesh(archGeo, pillarMat);
    arch.position.set(0, 3.5, 0);
    arch.castShadow = true;
    group.add(arch);

    // Papan nama tujuan
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 128;
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#f4c430';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#f4c430';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(portal.label || portal.target, 256, 64);

    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.5),
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissiveMap: signTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
      })
    );
    signMesh.position.set(0, 4.0, 0);
    group.add(signMesh);

    // Partikel cahaya (glow di atas platform)
    const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xf4c430,
      transparent: true,
      opacity: 0.6,
    });
    for (let i = 0; i < 5; i++) {
      const glow = new THREE.Mesh(glowGeo, glowMat.clone());
      glow.position.set(
        portal.x + (Math.random() - 0.5) * 1.5,
        0.5 + Math.random() * 2.5,
        portal.z + (Math.random() - 0.5) * 1.5
      );
      glow.userData.floatOffset = Math.random() * Math.PI * 2;
      glow.userData.floatSpeed = 0.5 + Math.random() * 0.5;
      group.add(glow);
    }

    Game.worldGroup.add(group);

    // Simpan untuk collision check
    portalMeshes.push({
      mesh: platform,
      portal: portal,
      group: group,
    });
  });
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
        child.position.y = 0.5 + Math.sin(elapsed * child.userData.floatSpeed + child.userData.floatOffset) * 1.2;
        child.material.opacity = 0.3 + Math.sin(elapsed * 2 + child.userData.floatOffset) * 0.3;
      }
    });
  });

  // Platform pulse
  portalMeshes.forEach(({ mesh }) => {
    if (mesh.material.emissiveIntensity !== undefined) {
      mesh.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 2) * 0.15;
    }
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
      px >= portal.x - hw && px <= portal.x + hw &&
      pz >= portal.z - hd && pz <= portal.z + hd
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
