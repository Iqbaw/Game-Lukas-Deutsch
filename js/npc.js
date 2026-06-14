// ═══════════════════════════════════════════════════════════════════
// js/npc.js — SISTEM NPC
//
// Tugas Step 6:
//   - Build NPC humanoid (mirip Lukas tapi dengan atribut variabel:
//     warna baju, rambut, kacamata, kumis, topi, dll)
//   - Spawn NPC sesuai zone awal (saat ini ZONES.HAUS = Oma & Opa & Onkel & Tante)
//   - Animasi idle: nafas pelan + kepala goyang halus
//   - Label CSS2D di atas kepala dengan nama + ! quest indicator
//   - Proximity detection: kalau pemain dekat (<= INTERACTION_RADIUS),
//     show interaction prompt + mark NPC sebagai "active"
//   - Tombol E saat dekat NPC → fire EVENTS.NPC_INTERACT (di-handle dialog.js Step 8)
//
// API publik:
//   - buildAllNPCs()        → spawn semua NPC di zona aktif
//   - updateNPCs(delta)     → animasi + proximity check
//   - getActiveNPC()        → NPC yang sedang dalam jangkauan (atau null)
//   - spawnNPC(npcData)     → spawn satu NPC manual (dipakai di Step 16 zone load)
//   - despawnNPC(id)        → hapus NPC by id
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { Game, registerUpdate } from './main.js';
import { CONFIG, EVENTS, COLORS, ZONES } from './config.js';
import { Player }                        from './player.js';
import { World }                         from './world.js';
import { NPC_DATA, getNPCsInZone }       from './data/npcs.js';


// ═══════════════════════════════════════════════════════════════════
// 0. STATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Map id NPC → object berisi semua reference Three.js yang dibutuhkan
 *   {
 *     data:      NPC data static (dari npcs.js)
 *     group:     THREE.Group root NPC
 *     head:      ref kepala (untuk lookAt-pemain saat dekat)
 *     body:      ref body (untuk bob)
 *     leftArm:   ref lengan kiri (untuk gerakan halus)
 *     rightArm:  ref lengan kanan
 *     labelObj:  CSS2DObject
 *     labelEl:   HTMLDivElement
 *     idlePhase: random offset agar tidak semua NPC bergerak serempak
 *     basePos:   posisi awal (untuk reset dari bob)
 *     baseFacing:facing awal
 *     interactBox: bounding sphere radius untuk proximity
 *   }
 */
const NPCs = new Map();

// NPC yang saat ini "active" (dalam jangkauan E) — null kalau tidak ada
let activeNPC = null;

// Throttle proximity check (gak perlu 60Hz)
let _proximityAccumulator = 0;
const PROXIMITY_INTERVAL = 0.1; // cek tiap 100ms

// Reusable temp
const _tmpDist2 = new THREE.Vector2();
const _interactionRadius2 = CONFIG.INTERACTION_RADIUS * CONFIG.INTERACTION_RADIUS;


// ═══════════════════════════════════════════════════════════════════
// 1. BUILD NPC MESH (humanoid modular)
// ═══════════════════════════════════════════════════════════════════

function buildNPCMesh(npcData) {
  const cfg   = npcData.body;
  const group = new THREE.Group();
  group.name  = `npc-${npcData.id}`;

  // Material reuse dengan caching per warna untuk hemat draw call
  const skinMat = getOrCacheMat('skin_'  + cfg.skinColor.toString(16),
                                () => new THREE.MeshStandardMaterial({
                                  color: cfg.skinColor, roughness: 0.85,
                                }));
  const bodyMat = getOrCacheMat('body_'  + cfg.bodyColor.toString(16),
                                () => new THREE.MeshStandardMaterial({
                                  color: cfg.bodyColor, roughness: 0.7,
                                }));
  const pantsMat = getOrCacheMat('pants_' + cfg.pantsColor.toString(16),
                                () => new THREE.MeshStandardMaterial({
                                  color: cfg.pantsColor, roughness: 0.85,
                                }));
  const hairMat = getOrCacheMat('hair_'  + cfg.hairColor.toString(16),
                                () => new THREE.MeshStandardMaterial({
                                  color: cfg.hairColor, roughness: 0.6,
                                }));
  const shoesMat = getOrCacheMat('shoes_' + cfg.shoesColor.toString(16),
                                () => new THREE.MeshStandardMaterial({
                                  color: cfg.shoesColor, roughness: 0.5,
                                }));

  // Skala tinggi (anak-anak NPC seperti Leni lebih kecil)
  const H = cfg.height;

  // ── BODY (torso) ──
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55 * H, 0.85 * H, 0.32 * H),
    bodyMat
  );
  body.position.y = 1.05 * H;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // ── APRON (celemek) — Oma punya ──
  if (cfg.hasApron) {
    const apronMat = getOrCacheMat('apron_' + cfg.apronColor.toString(16),
                                   () => new THREE.MeshStandardMaterial({
                                     color: cfg.apronColor, roughness: 0.8,
                                   }));
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * H, 0.7 * H, 0.05),
      apronMat
    );
    apron.position.set(0, 0.95 * H, 0.18 * H);
    apron.castShadow = true;
    group.add(apron);

    // Tali leher celemek
    const tieGeo = new THREE.BoxGeometry(0.04, 0.2 * H, 0.04);
    const tie = new THREE.Mesh(tieGeo, apronMat);
    tie.position.set(0, 1.45 * H, 0.18 * H);
    group.add(tie);
  }

  // ── HEAD ──
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42 * H, 0.42 * H, 0.42 * H),
    skinMat
  );
  head.position.y = 1.72 * H;
  head.castShadow = true;
  group.add(head);

  // ── HAIR (varies by style) ──
  buildHair(group, cfg, hairMat, H);

  // ── HAT (Opa: topi pelaut) ──
  if (cfg.hasSailorHat) {
    const hatMat = getOrCacheMat('hat_' + cfg.hatColor.toString(16),
                                 () => new THREE.MeshStandardMaterial({
                                   color: cfg.hatColor, roughness: 0.6,
                                 }));
    // Crown (kotak atas topi)
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(0.46 * H, 0.16 * H, 0.46 * H),
      hatMat
    );
    crown.position.y = 1.97 * H;
    crown.castShadow = true;
    group.add(crown);

    // Brim (tepi topi yang menonjol depan)
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * H, 0.04 * H, 0.55 * H),
      hatMat
    );
    brim.position.set(0, 1.89 * H, 0.04 * H);
    brim.castShadow = true;
    group.add(brim);

    // Lambang jangkar kuning emas di depan crown
    const anchor = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.02),
      new THREE.MeshStandardMaterial({
        color: COLORS.ACCENT,
        emissive: COLORS.ACCENT,
        emissiveIntensity: 0.3,
      })
    );
    anchor.position.set(0, 1.97 * H, 0.235 * H);
    group.add(anchor);
  }

  // ── EYES + MOUTH (semua NPC) ──
  const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.01);
  const eyeMat = getOrCacheMat('eye_dark', () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08 * H, 1.74 * H, 0.215 * H);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08 * H;
  group.add(eyeR);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.015, 0.01),
    eyeMat
  );
  mouth.position.set(0, 1.62 * H, 0.215 * H);
  group.add(mouth);

  // ── KACAMATA (Oma & Tante) ──
  if (cfg.hasGlasses) {
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
    });
    // Lens kiri
    const lensL = new THREE.Mesh(
      new THREE.RingGeometry(0.05 * H, 0.07 * H, 12),
      lensMat
    );
    lensL.position.set(-0.08 * H, 1.74 * H, 0.225 * H);
    group.add(lensL);
    // Lens kanan
    const lensR = lensL.clone();
    lensR.position.x = 0.08 * H;
    group.add(lensR);
    // Bridge
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.012, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    bridge.position.set(0, 1.74 * H, 0.225 * H);
    group.add(bridge);
  }

  // ── KUMIS (Opa) ──
  if (cfg.hasMustache) {
    const muMat = getOrCacheMat('mustache_white',
                                () => new THREE.MeshStandardMaterial({
                                  color: 0xeeeeee, roughness: 0.7,
                                }));
    const mustache = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * H, 0.04 * H, 0.04 * H),
      muMat
    );
    mustache.position.set(0, 1.66 * H, 0.225 * H);
    group.add(mustache);
  }

  // ── HEADPHONES (Felix) ──
  if (cfg.hasHeadphones) {
    const hpMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.4,
    });
    // Band atas
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.22 * H, 0.025, 6, 16, Math.PI),
      hpMat
    );
    band.position.set(0, 1.55 * H, -0.05 * H);
    band.rotation.x = -Math.PI / 2;
    band.rotation.y = 0;
    band.rotation.z = 0;
    band.position.set(0, 1.92 * H, 0);
    band.rotation.set(0, 0, 0);
    group.add(band);
    // Cup kiri
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07 * H, 8, 8), hpMat);
    cup.position.set(-0.22 * H, 1.74 * H, 0);
    group.add(cup);
    const cupR = cup.clone();
    cupR.position.x = 0.22 * H;
    group.add(cupR);
  }

  // ── ARMS (pivot di bahu) ──
  function buildArm(side) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.35 * H, 1.45 * H, 0);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * H, 0.7 * H, 0.18 * H),
      bodyMat
    );
    upper.position.y = -0.35 * H;
    upper.castShadow = true;
    armGroup.add(upper);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * H, 0.16 * H, 0.16 * H),
      skinMat
    );
    hand.position.y = -0.78 * H;
    hand.castShadow = true;
    armGroup.add(hand);

    return armGroup;
  }

  const armL = buildArm(-1);
  const armR = buildArm(+1);
  group.add(armL, armR);

  // ── BACKPACK (Leni) ──
  if (cfg.hasBackpack) {
    const bpMat = getOrCacheMat('bp_' + cfg.backpackColor.toString(16),
                                () => new THREE.MeshStandardMaterial({
                                  color: cfg.backpackColor, roughness: 0.7,
                                }));
    const bp = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 * H, 0.5 * H, 0.18 * H),
      bpMat
    );
    bp.position.set(0, 1.05 * H, -0.22 * H);
    bp.castShadow = true;
    group.add(bp);

    // Tali tas
    const strapGeo = new THREE.BoxGeometry(0.04, 0.4 * H, 0.04);
    const strapMat = bpMat;
    const strapL = new THREE.Mesh(strapGeo, strapMat);
    strapL.position.set(-0.13 * H, 1.25 * H, 0);
    group.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.13 * H;
    group.add(strapR);
  }

  // ── LEGS (pivot di pinggul) ──
  function buildLeg(side) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.13 * H, 0.62 * H, 0);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * H, 0.62 * H, 0.2 * H),
      pantsMat
    );
    upper.position.y = -0.31 * H;
    upper.castShadow = true;
    legGroup.add(upper);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * H, 0.12 * H, 0.32 * H),
      shoesMat
    );
    shoe.position.set(0, -0.68 * H, 0.04 * H);
    shoe.castShadow = true;
    legGroup.add(shoe);

    return legGroup;
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(+1);
  group.add(legL, legR);

  // ── BLOB SHADOW ──
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45 * H, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  const upperParts = group.children.filter(child => (
    child !== armL &&
    child !== armR &&
    child !== legL &&
    child !== legR &&
    child !== shadow
  ));
  upperParts.forEach(part => {
    part.userData.baseY = part.position.y;
    part.userData.baseRotationX = part.rotation.x;
    part.userData.baseRotationZ = part.rotation.z;
  });
  legL.userData.baseY = legL.position.y;
  legR.userData.baseY = legR.position.y;

  // ── SLOUCH (Oma & Opa lansia) ──
  if (cfg.slouch) {
    body.rotation.x = cfg.slouch;
    head.rotation.x = cfg.slouch * 0.6;
  }

  return {
    group,
    body,
    head,
    leftArm: armL,
    rightArm: armR,
    leftLeg: legL,
    rightLeg: legR,
    upperParts,
    height: H,
  };
}


// ═══════════════════════════════════════════════════════════════════
// 1.5. HAIR STYLES (variasi)
// ═══════════════════════════════════════════════════════════════════

function buildHair(parent, cfg, hairMat, H) {
  switch (cfg.hairStyle) {

    case 'short': {
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * H, 0.16 * H, 0.46 * H),
        hairMat
      );
      top.position.y = 1.92 * H;
      top.castShadow = true;
      parent.add(top);
      break;
    }

    case 'long': {
      // Block atas + ekstensi turun ke bahu
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * H, 0.18 * H, 0.46 * H),
        hairMat
      );
      top.position.y = 1.93 * H;
      top.castShadow = true;
      parent.add(top);

      // Bagian belakang turun ke bahu
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.44 * H, 0.5 * H, 0.16 * H),
        hairMat
      );
      back.position.set(0, 1.7 * H, -0.16 * H);
      back.castShadow = true;
      parent.add(back);
      break;
    }

    case 'bun': {
      // Sanggul Oma — block tipis + sanggul bulat di belakang
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * H, 0.12 * H, 0.46 * H),
        hairMat
      );
      top.position.y = 1.9 * H;
      top.castShadow = true;
      parent.add(top);

      const bun = new THREE.Mesh(
        new THREE.SphereGeometry(0.13 * H, 10, 8),
        hairMat
      );
      bun.position.set(0, 1.9 * H, -0.22 * H);
      bun.castShadow = true;
      parent.add(bun);
      break;
    }

    case 'twintails': {
      // Leni — kuncir dua di samping kepala
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * H, 0.16 * H, 0.46 * H),
        hairMat
      );
      top.position.y = 1.92 * H;
      top.castShadow = true;
      parent.add(top);

      // Twintail kiri
      const tailGeo = new THREE.CylinderGeometry(0.06 * H, 0.04 * H, 0.4 * H, 6);
      const tailL = new THREE.Mesh(tailGeo, hairMat);
      tailL.position.set(-0.27 * H, 1.55 * H, 0);
      tailL.rotation.z = 0.3;
      tailL.castShadow = true;
      parent.add(tailL);

      const tailR = tailL.clone();
      tailR.position.x = 0.27 * H;
      tailR.rotation.z = -0.3;
      parent.add(tailR);

      // Pita merah
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xc83a3a });
      const ribbonL = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 * H, 0.06 * H, 0.06 * H),
        ribbonMat
      );
      ribbonL.position.set(-0.27 * H, 1.78 * H, 0);
      parent.add(ribbonL);
      const ribbonR = ribbonL.clone();
      ribbonR.position.x = 0.27 * H;
      parent.add(ribbonR);
      break;
    }

    case 'messy': {
      // Felix — rambut berantakan: top + tufts acak
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * H, 0.18 * H, 0.46 * H),
        hairMat
      );
      top.position.y = 1.94 * H;
      top.rotation.z = 0.06;        // miring sedikit
      top.castShadow = true;
      parent.add(top);

      // Tufts ngacak
      for (let i = 0; i < 3; i++) {
        const tuft = new THREE.Mesh(
          new THREE.BoxGeometry(0.1 * H, 0.1 * H, 0.1 * H),
          hairMat
        );
        tuft.position.set(
          (Math.random() - 0.5) * 0.4 * H,
          2.04 * H + Math.random() * 0.05,
          (Math.random() - 0.5) * 0.3 * H
        );
        tuft.rotation.set(
          Math.random() * 0.4,
          Math.random() * 0.6,
          Math.random() * 0.6
        );
        parent.add(tuft);
      }

      // Poni miring
      const fringe = new THREE.Mesh(
        new THREE.BoxGeometry(0.43 * H, 0.1 * H, 0.06 * H),
        hairMat
      );
      fringe.position.set(0, 1.85 * H, 0.21 * H);
      fringe.rotation.z = 0.1;
      parent.add(fringe);
      break;
    }

    default: {
      // Fallback — block standar
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.46 * H, 0.16 * H, 0.46 * H),
        hairMat
      );
      top.position.y = 1.92 * H;
      top.castShadow = true;
      parent.add(top);
    }
  }

  // Poni standar untuk yang punya rambut "biasa"
  if (cfg.hairStyle !== 'messy' && cfg.hairStyle !== 'bun') {
    const fringe = new THREE.Mesh(
      new THREE.BoxGeometry(0.43 * H, 0.08 * H, 0.06 * H),
      hairMat
    );
    fringe.position.set(0, 1.85 * H, 0.21 * H);
    fringe.castShadow = true;
    parent.add(fringe);
  }
}


// Material cache (anti-bocor — kita simpan strong ref di Map sederhana)
const _matCache = new Map();
function getOrCacheMat(key, factory) {
  if (!_matCache.has(key)) _matCache.set(key, factory());
  return _matCache.get(key);
}


// ═══════════════════════════════════════════════════════════════════
// 2. CSS2D LABEL di atas kepala
// ═══════════════════════════════════════════════════════════════════

function makeLabel(npcData) {
  const div = document.createElement('div');
  div.className = 'npc-label';
  if (npcData.hasQuest) div.classList.add('npc-label-quest');

  // Inner wrapper — semua styling visual di sini supaya CSS2DRenderer
  // bebas pakai transform di element root tanpa konflik animasi.
  const inner = document.createElement('div');
  inner.className = 'npc-label-inner';
  inner.innerHTML = `
    <div class="npc-label-name">${npcData.name}</div>
    <div class="npc-label-title">${npcData.title}</div>
  `;
  div.appendChild(inner);

  const obj = new CSS2DObject(div);
  // Anchor di TENGAH posisi 3D (default). Inner wrapper digeser ke atas
  // dengan translateY(-100%) di CSS supaya label muncul di ATAS posisi.
  obj.center.set(0.5, 0.5);

  return { obj, el: div };
}


// ═══════════════════════════════════════════════════════════════════
// 3. SPAWN NPC
// ═══════════════════════════════════════════════════════════════════

export function spawnNPC(npcData) {
  if (NPCs.has(npcData.id)) {
    if (CONFIG.DEBUG) console.warn(`[npc] ${npcData.id} sudah di-spawn`);
    return;
  }

  // Build mesh
  const { group, body, head, leftArm, rightArm, leftLeg, rightLeg, upperParts, height } = buildNPCMesh(npcData);

  // Posisi & facing
  // Sitting NPCs need a Y offset so they sit ON the bench instead of sinking
  const spawnY = npcData.activity === 'sitting' ? 0.38 : 0;
  group.position.set(npcData.spawn.x, spawnY, npcData.spawn.z);
  group.rotation.y = npcData.spawn.facing;

  // Mount ke npcGroup (sudah di scene)
  Game.npcGroup.add(group);

  // Label
  const label = makeLabel(npcData);
  // Posisi label: di atas kepala, dengan offset world Y absolut.
  // Mount ke head supaya saat group di-rotate untuk auto-face player,
  // label tetap di posisi yang sama (head hanya rotate sedikit untuk idle look).
  // Kepala di Y = 1.72 * height + breathe. Tambah ~0.55 supaya cukup di atas.
  label.obj.position.set(0, 0.55, 0);
  head.add(label.obj);

  // Simpan record
  const collider = {
    type:   'cylinder',
    x:      npcData.spawn.x,
    z:      npcData.spawn.z,
    radius: 0.4,
    name:   `npc-${npcData.id}`,
  };
  World.colliders.push(collider);

  // Wander config — radius sekitar spawn point dimana NPC boleh berjalan
  // Anak-anak (Leni) wander lebih luas, lansia (Oma/Opa) lebih sedikit
  const wanderRadius =
    npcData.activity === 'sitting' ? 0 :
    npcData.body.height < 0.8 ? 4.0 :   // anak — aktif
    npcData.body.slouch    ? 1.8 :       // lansia — sedikit
                              3.0;       // dewasa — sedang

  NPCs.set(npcData.id, {
    data:        npcData,
    group,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    upperParts,
    labelObj:    label.obj,
    labelEl:     label.el,
    idlePhase:   Math.random() * Math.PI * 2,
    basePos:     group.position.clone(),
    baseFacing:  npcData.spawn.facing,
    height,
    collider,

    // === Wander state machine ===
    state:       npcData.activity === 'sitting' ? 'sitting' : 'idle',
    stateTimer:  Math.random() * 3 + 2,  // detik tersisa di state ini
    walkTarget:  null,                   // {x, z}
    facing:      npcData.spawn.facing,   // current facing (Y rotation)
    walkCycle:   0,                      // animasi walk phase
    wanderRadius,
    walkSpeed:   1.2 + Math.random() * 0.4,
  });

  const rec = NPCs.get(npcData.id);
  if (npcData.activity === 'sitting') {
    applySittingPose(rec);
  }
  if (npcData.activity === 'repairing_windmill') {
    applyRepairPose(rec);
  }

  if (CONFIG.DEBUG) {
    console.log(`[npc] Spawned ${npcData.id} at (${npcData.spawn.x}, ${npcData.spawn.z})`);
  }
}


export function despawnNPC(id) {
  const rec = NPCs.get(id);
  if (!rec) return;

  // Hapus collider
  const cIdx = World.colliders.indexOf(rec.collider);
  if (cIdx !== -1) World.colliders.splice(cIdx, 1);

  // Hapus label dari DOM (CSS2DObject akan auto-clean saat parent removed,
  // tapi kita pastikan)
  if (rec.labelObj.parent) rec.labelObj.parent.remove(rec.labelObj);
  if (rec.labelEl.parentNode) rec.labelEl.parentNode.removeChild(rec.labelEl);

  // Hapus group
  Game.npcGroup.remove(rec.group);
  rec.group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    // material di-cache, JANGAN dispose di sini
  });

  NPCs.delete(id);

  if (activeNPC && activeNPC.data.id === id) {
    setActiveNPC(null);
  }
}


export function despawnAllNPCs() {
  const ids = Array.from(NPCs.keys());
  ids.forEach(id => despawnNPC(id));
}

/** Set NPC mengikuti Lukas (mis. Leni pulang bersama). */
export function setNPCFollowing(id, following = true) {
  const rec = NPCs.get(id);
  if (!rec) return false;
  rec._following = following;

  if (following) {
    // PENTING: hapus collider NPC follower supaya TIDAK menjebak/menghalangi
    // Lukas. Companion tidak boleh punya collision dengan player.
    if (rec.collider) {
      const idx = World.colliders.indexOf(rec.collider);
      if (idx !== -1) World.colliders.splice(idx, 1);
      rec._colliderRemoved = true;
    }
  } else {
    // Restore collider saat berhenti mengikuti (mis. Leni berhenti/masuk rumah)
    if (rec._colliderRemoved && rec.collider) {
      // Update posisi collider ke posisi sekarang sebelum dipasang lagi
      rec.collider.x = rec.group.position.x;
      rec.collider.z = rec.group.position.z;
      if (World.colliders.indexOf(rec.collider) === -1) {
        World.colliders.push(rec.collider);
      }
      rec._colliderRemoved = false;
    }
  }
  return true;
}
// Expose ke window untuk dipanggil dari quest.js tanpa import circular
if (typeof window !== 'undefined') {
  window.__setNPCFollowing__ = setNPCFollowing;
  window.__despawnNPC__ = despawnNPC;
}

export function initNPCSystem() {
  // Daftar update ke loop
  registerUpdate(updateNPCs);

  // Daftar handler tombol E
  setupInteractionInput();

  if (CONFIG.DEBUG) {
    console.log(`[npc] System initialized`);
  }
}

/**
 * Spawn NPC tambahan saat quest tertentu selesai.
 * Dipanggil dari dialog.js / quest.js.
 */
export function spawnNPCById(npcId) {
  const { NPC_DATA } = window.__npcData__ || {};
  // Fallback: cari dari data yang sudah di-load
  import('./data/npcs.js').then(({ NPC_DATA: data }) => {
    const npcData = data.find(n => n.id === npcId);
    if (npcData) spawnNPC(npcData);
  });
}


// ═══════════════════════════════════════════════════════════════════
// 4. UPDATE per frame: state machine + animasi + proximity check
// ═══════════════════════════════════════════════════════════════════

const _tmpVec3 = new THREE.Vector3();

export function updateNPCs(delta, elapsed) {
  // Cek pemain dekat dengan NPC mana → freeze yang itu
  const activeId = activeNPC ? activeNPC.data.id : null;

  NPCs.forEach((rec, id) => {
    const isFrozen = (id === activeId);

    // ── FOLLOW behavior (mis. Leni mengikuti Lukas pulang) ──
    if (rec._following && Game.player) {
      const px = Game.player.position.x;
      const pz = Game.player.position.z;
      const gx = rec.group.position.x;
      const gz = rec.group.position.z;
      const dx = px - gx;
      const dz = pz - gz;
      const dist = Math.hypot(dx, dz);
      const FOLLOW_GAP = 1.6;       // jaga jarak di belakang Lukas
      if (dist > FOLLOW_GAP) {
        const speed = Math.min(3.2, 1.6 + dist * 0.4); // sedikit lebih cepat jika tertinggal
        const step = speed * delta;
        const nx = gx + (dx / dist) * step;
        const nz = gz + (dz / dist) * step;
        rec.group.position.x = nx;
        rec.group.position.z = nz;
        // hadap arah jalan
        rec.group.rotation.y = Math.atan2(dx, dz);
        // animasi kaki jalan
        rec.walkCycle = (rec.walkCycle || 0) + delta * 8;
        const swing = Math.sin(rec.walkCycle) * 0.5;
        if (rec.leftLeg)  rec.leftLeg.rotation.x  =  swing;
        if (rec.rightLeg) rec.rightLeg.rotation.x = -swing;
        if (rec.leftArm)  rec.leftArm.rotation.x  = -swing * 0.6;
        if (rec.rightArm) rec.rightArm.rotation.x =  swing * 0.6;
        // update collider posisi
        if (rec.collider) { rec.collider.x = nx; rec.collider.z = nz; }
      } else {
        animateNPCIdle(rec, elapsed);
      }
      return; // skip state machine normal saat following
    }

    if (rec.data.activity === 'sitting') {
      animateNPCSitting(rec, elapsed);
    } else if (rec.data.activity === 'repairing_windmill') {
      if (isFrozen) {
        // Opa berdiri normal saat diajak ngomong oleh Lukas
        resetRepairPose(rec);
        animateNPCIdle(rec, elapsed);
        faceTowardPlayer(rec);
      } else {
        // Lanjutkan pekerjaan reparasi
        animateNPCRepairing(rec, elapsed);
      }
    } else if (isFrozen) {
      // Pemain dekat — NPC berhenti, hadap pemain, idle anim
      animateNPCIdle(rec, elapsed);
      faceTowardPlayer(rec);
    } else {
      // Update state machine
      updateNPCStateMachine(rec, delta);

      if (rec.state === 'walking') {
        animateNPCWalk(rec, delta);
      } else {
        animateNPCIdle(rec, elapsed);
      }
    }
  });

  // Throttle proximity check
  _proximityAccumulator += delta;
  if (_proximityAccumulator >= PROXIMITY_INTERVAL) {
    _proximityAccumulator = 0;
    checkProximity();
  }
}


// ── State machine: idle ↔ walking ──
function updateNPCStateMachine(rec, delta) {
  if (rec.data.activity === 'sitting' || rec.data.activity === 'repairing_windmill') {
    rec.state = rec.data.activity;
    return;
  }

  rec.stateTimer -= delta;

  if (rec.state === 'idle') {
    if (rec.stateTimer <= 0) {
      // Pilih target wander baru dalam radius
      const angle = Math.random() * Math.PI * 2;
      const dist  = rec.wanderRadius * (0.5 + Math.random() * 0.5);
      rec.walkTarget = {
        x: rec.basePos.x + Math.cos(angle) * dist,
        z: rec.basePos.z + Math.sin(angle) * dist,
      };
      rec.state = 'walking';
      rec.stateTimer = 6 + Math.random() * 3; // max waktu walking
    }
  } else if (rec.state === 'walking') {
    // Move toward target
    const dx = rec.walkTarget.x - rec.group.position.x;
    const dz = rec.walkTarget.z - rec.group.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.15 || rec.stateTimer <= 0) {
      // Sampai atau timeout — kembali idle
      rec.state = 'idle';
      rec.stateTimer = 3 + Math.random() * 4;  // 3-7 detik idle
      // Reset rotasi kaki dan lengan ke 0 supaya animasi idle natural
      rec.leftArm.rotation.x = 0;
      rec.rightArm.rotation.x = 0;
    } else {
      const moveDist = rec.walkSpeed * delta;
      const nx = dx / dist;
      const nz = dz / dist;

      // Cek collision sebelum move
      const newX = rec.group.position.x + nx * moveDist;
      const newZ = rec.group.position.z + nz * moveDist;

      if (!isNPCCollidingAt(rec, newX, newZ)) {
        rec.group.position.x = newX;
        rec.group.position.z = newZ;
        // Update collider position juga
        rec.collider.x = newX;
        rec.collider.z = newZ;
      } else {
        // Hit obstacle — abort walking, kembali idle
        rec.state = 'idle';
        rec.stateTimer = 1.5;
      }

      // Smooth rotate facing ke arah target
      const targetFacing = Math.atan2(nx, nz);
      let dF = targetFacing - rec.facing;
      while (dF >  Math.PI) dF -= 2 * Math.PI;
      while (dF < -Math.PI) dF += 2 * Math.PI;
      rec.facing += dF * Math.min(1, delta * 6.0);
      rec.group.rotation.y = rec.facing;
    }
  }
}


/** Cek apakah NPC akan tabrakan dengan obstacle (selain dirinya sendiri). */
function isNPCCollidingAt(rec, x, z) {
  // World bounds
  const half = (CONFIG.WORLD_SIZE / 2) - 1;
  if (x < -half || x > half || z < -half || z > half) return true;

  // Collider check (skip dirinya sendiri)
  for (let i = 0; i < World.colliders.length; i++) {
    const c = World.colliders[i];
    if (c === rec.collider) continue;

    if (c.type === 'cylinder') {
      const dx = x - c.x;
      const dz = z - c.z;
      const minD = c.radius + 0.4; // 0.4 = NPC radius
      if (dx * dx + dz * dz < minD * minD) return true;
    } else if (c.type === 'box') {
      const r = 0.4;
      if (
        x >= c.box.min.x - r && x <= c.box.max.x + r &&
        z >= c.box.min.z - r && z <= c.box.max.z + r
      ) return true;
    }
  }
  return false;
}


// ── Animasi idle (nafas + lengan kecil + kepala) ──
function animateNPCIdle(rec, elapsed) {
  const t = elapsed + rec.idlePhase;
  const breathe = Math.sin(t * 1.5) * 0.015 * rec.height;

  rec.body.position.y = (1.05 * rec.height) + breathe;

  // Lengan ringan ayun (smooth lerp ke target supaya transisi dari walk halus)
  const swayTarget = Math.sin(t * 1.2) * 0.04;
  rec.leftArm.rotation.x  = THREE.MathUtils.lerp(rec.leftArm.rotation.x,   swayTarget, 0.1);
  rec.rightArm.rotation.x = THREE.MathUtils.lerp(rec.rightArm.rotation.x, -swayTarget, 0.1);

  // Head turn halus (look around) — hanya saat tidak frozen
  rec.head.rotation.y = Math.sin(t * 0.4) * 0.15;

  // Slouch reset (kalau Oma/Opa)
  if (rec.data.body.slouch) {
    rec.body.rotation.x = rec.data.body.slouch;
    rec.head.rotation.x = rec.data.body.slouch * 0.6;
  }
}


function applySittingPose(rec, breathe = 0) {
  const H = rec.height;

  // Slight upper-body lower for natural seated look (reduced from 0.28 to 0.12)
  rec.upperParts?.forEach(part => {
    part.position.y = (part.userData.baseY ?? part.position.y) - (0.12 * H) + breathe;
    part.rotation.x = part.userData.baseRotationX ?? part.rotation.x;
    part.rotation.z = part.userData.baseRotationZ ?? part.rotation.z;
  });
  rec.body.rotation.x = 0.06;
  rec.head.rotation.x = 0.02;
  rec.head.rotation.y = 0;

  rec.leftArm.rotation.x = -0.25;
  rec.rightArm.rotation.x = -0.25;
  rec.leftArm.rotation.z = -0.08;
  rec.rightArm.rotation.z = 0.08;

  // Legs bent at hip, positioned at proper sitting height
  rec.leftLeg.position.y = 0.48 * H;
  rec.rightLeg.position.y = 0.48 * H;
  rec.leftLeg.rotation.x = -Math.PI / 2.2;
  rec.rightLeg.rotation.x = -Math.PI / 2.2;
}

function animateNPCSitting(rec, elapsed) {
  const t = elapsed + rec.idlePhase;
  const footSwing = Math.sin(t * 2.4) * 0.12;
  applySittingPose(rec, 0);
  rec.leftLeg.rotation.x = -Math.PI / 2.8 + footSwing;
  rec.rightLeg.rotation.x = -Math.PI / 2.8 - footSwing;
  rec.facing = rec.baseFacing;
  rec.group.rotation.y = rec.baseFacing;
}

function applyRepairPose(rec) {
  const H = rec.height;
  rec.leftArm.rotation.x = -0.8;
  rec.rightArm.rotation.x = -1.1;
  rec.rightArm.rotation.z = -0.35;
  rec.leftLeg.rotation.x = 0.08;
  rec.rightLeg.rotation.x = -0.08;
  rec.body.rotation.x = (rec.data.body.slouch || 0) + 0.08;
  rec.head.rotation.x = 0.02;

  if (!rec.hammer) {
    const hammer = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025 * H, 0.025 * H, 0.48 * H, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 })
    );
    handle.rotation.z = Math.PI / 2;
    hammer.add(handle);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 * H, 0.1 * H, 0.1 * H),
      new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.45, metalness: 0.25 })
    );
    head.position.x = 0.25 * H;
    hammer.add(head);
    hammer.position.set(0, -0.76 * H, 0.08 * H);
    hammer.rotation.z = -0.4;
    rec.rightArm.add(hammer);
    rec.hammer = hammer;
  }
}

/** Reset repair pose back to standing (when player approaches Opa). */
function resetRepairPose(rec) {
  // Reset arm rotations to neutral standing
  rec.leftArm.rotation.z = 0;
  rec.rightArm.rotation.z = 0;
  rec.body.rotation.x = rec.data.body.slouch || 0;
  rec.head.rotation.x = (rec.data.body.slouch || 0) * 0.6;
  rec.leftLeg.rotation.x = 0;
  rec.rightLeg.rotation.x = 0;
}

function animateNPCRepairing(rec, elapsed) {
  const t = elapsed + rec.idlePhase;
  applyRepairPose(rec);
  rec.rightArm.rotation.x = -1.1 + Math.sin(t * 5.5) * 0.28;
  rec.leftArm.rotation.x = -0.75 + Math.sin(t * 2.2) * 0.08;
  rec.head.rotation.y = Math.sin(t * 0.8) * 0.05;
  rec.facing = rec.baseFacing;
  rec.group.rotation.y = rec.baseFacing;
}


// ── Animasi walking (lebih ringan dari Lukas, NPC jalan santai) ──
function animateNPCWalk(rec, delta) {
  rec.walkCycle += delta * 5.5;
  const swing = Math.sin(rec.walkCycle);

  rec.leftArm.rotation.x  =  swing * 0.5;
  rec.rightArm.rotation.x = -swing * 0.5;

  // Body bob ringan saat jalan
  const bob = Math.abs(Math.sin(rec.walkCycle)) * 0.04 * rec.height;
  rec.body.position.y = (1.05 * rec.height) + bob;

  // Reset head turn (fokus ke depan saat jalan)
  rec.head.rotation.y = THREE.MathUtils.lerp(rec.head.rotation.y, 0, 0.1);
}


// ── Putar NPC menghadap pemain (saat pemain dekat) ──
function faceTowardPlayer(rec) {
  if (!Player.group) return;
  const dx = Player.position.x - rec.group.position.x;
  const dz = Player.position.z - rec.group.position.z;
  const targetFacing = Math.atan2(dx, dz);

  let dF = targetFacing - rec.facing;
  while (dF >  Math.PI) dF -= 2 * Math.PI;
  while (dF < -Math.PI) dF += 2 * Math.PI;
  rec.facing += dF * 0.08;
  rec.group.rotation.y = rec.facing;
}


function checkProximity() {
  if (!Player.group) return;

  let closest = null;
  let closestDist2 = _interactionRadius2;

  NPCs.forEach((rec) => {
    _tmpDist2.x = rec.group.position.x - Player.position.x;
    _tmpDist2.y = rec.group.position.z - Player.position.z;
    const d2 = _tmpDist2.x * _tmpDist2.x + _tmpDist2.y * _tmpDist2.y;
    if (d2 < closestDist2) {
      closestDist2 = d2;
      closest = rec;
    }
  });

  if (closest !== activeNPC) {
    setActiveNPC(closest);
  }
  // (auto-face player sekarang di faceTowardPlayer, dipanggil per-frame
  //  dari updateNPCs untuk smoothness yang lebih baik)
}


function setActiveNPC(rec) {
  // Visual feedback: kembalikan label sebelumnya ke normal
  if (activeNPC) {
    activeNPC.labelEl.classList.remove('npc-label-active');
  }

  activeNPC = rec;

  const promptEl     = document.getElementById('interaction-prompt');
  const promptTextEl = document.getElementById('interaction-prompt-text');

  if (rec) {
    // Tampilkan interaction prompt
    rec.labelEl.classList.add('npc-label-active');
    if (promptEl)     promptEl.classList.remove('hud-hidden');
    if (promptTextEl) promptTextEl.textContent = `Mit ${rec.data.name} sprechen`;

    // Fire event NPC_NEAR (Step 8 dialog akan listen)
    window.dispatchEvent(new CustomEvent(EVENTS.NPC_NEAR, {
      detail: { npc: rec.data }
    }));
  } else {
    if (promptEl) promptEl.classList.add('hud-hidden');
    window.dispatchEvent(new CustomEvent(EVENTS.NPC_FAR));
  }
}


// ═══════════════════════════════════════════════════════════════════
// 5. INPUT — tombol E untuk interaksi
// ═══════════════════════════════════════════════════════════════════

let _interactionListenerSet = false;

function setupInteractionInput() {
  if (_interactionListenerSet) return;
  _interactionListenerSet = true;

  window.addEventListener('keydown', (e) => {
    if (Game.isPaused) return;
    if (e.code !== 'KeyE' && e.code !== 'Space') return;
    if (!activeNPC) return;

    // Prevent default supaya space tidak scroll page
    e.preventDefault();

    // Fire event ke dialog system (Step 8)
    window.dispatchEvent(new CustomEvent(EVENTS.NPC_INTERACT, {
      detail: { npc: activeNPC.data, npcId: activeNPC.data.id }
    }));

    if (CONFIG.DEBUG) {
      console.log(`[npc] Interact with ${activeNPC.data.id}`);
    }
  });
}


// ═══════════════════════════════════════════════════════════════════
// 6. PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/** NPC yang sedang dalam jangkauan (atau null). */
export function getActiveNPC() {
  return activeNPC ? activeNPC.data : null;
}

/** Ambil record NPC by id (dengan refs Three.js). */
export function getNPCRecord(id) {
  return NPCs.get(id) || null;
}

/** List semua NPC yang sedang ter-spawn. */
export function getAllNPCs() {
  return Array.from(NPCs.values()).map(r => r.data);
}
