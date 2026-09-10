// ═══════════════════════════════════════════════════════════════════
// js/player.js — KARAKTER LUKAS + KONTROL ISOMETRIK + ANIMASI
//
// Perubahan Isometrik:
//   - WASD sekarang relatif ke layar/isometrik (W=atas-kiri, D=atas-kanan)
//   - Tidak ada camera follow di sini (dipindah ke main.js)
//   - Collision masih sama (slide along wall)
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { advanceJump } from './jump.js';
import { buildCharacter, animateCharacter } from './character.js';
import { Game, registerUpdate, resetIsoCamera } from './main.js';
import { CONFIG, COLORS }       from './config.js';
import { World }                from './world.js';


// ═══════════════════════════════════════════════════════════════════
// 0. STATE
// ═══════════════════════════════════════════════════════════════════

export const Player = {
  group:          null,
  body:           null,
  head:           null,
  leftArm:        null,
  rightArm:       null,
  leftLeg:        null,
  rightLeg:       null,
  leftHand:       null,
  rightHand:      null,
  hair:           null,
  shadow:         null,

  position:       new THREE.Vector3(0, 0, 4),
  velocity:       new THREE.Vector3(),
  facing:         0,
  targetFacing:   0,
  isMoving:       false,
  isRunning:      false,
  speed:          0,
  isJumping:      false,
  jumpHeight:     0,
  jumpVelocity:   0,

  walkCycle:      0,
  idleCycle:      0,
  bobAmount:      0,

  input:          { fwd: 0, back: 0, left: 0, right: 0, run: false },
  inputEnabled:   true,
};

// Reusable vectors
const _tmpDir       = new THREE.Vector3();
const _tmpMove      = new THREE.Vector3();
const _raycaster    = new THREE.Raycaster();
const _rayOrigin    = new THREE.Vector3();
const _rayDown      = new THREE.Vector3(0, -1, 0);

// ═══════════════════════════════════════════════════════════════════
// ISOMETRIC DIRECTION VECTORS (fixed, tidak berubah)
// ═══════════════════════════════════════════════════════════════════

// Dalam isometrik 45°, arah "atas" di layar = arah (-1, 0, -1) normalized
// dan arah "kanan" di layar = arah (1, 0, -1) normalized
const ISO_FORWARD = new THREE.Vector3(-1, 0, -1).normalize(); // W (atas layar)
const ISO_RIGHT   = new THREE.Vector3( 1, 0, -1).normalize(); // D (kanan layar)


// ═══════════════════════════════════════════════════════════════════
// 1. BUILD LUKAS — humanoid low-poly
// ═══════════════════════════════════════════════════════════════════

function buildLukasMesh() {
  const rig = buildCharacter({
    height: 1, skinColor: COLORS.SKIN, bodyColor: COLORS.HOODIE_BLUE,
    pantsColor: COLORS.PANTS_KHAKI, hairColor: COLORS.HAIR_BLACK,
    shoesColor: COLORS.SHOES_WHITE, hairStyle: 'messy', hoodie: true,
  });
  Object.assign(Player, rig);
  rig.group.name = 'lukas';
  return rig.group;
}


// ═══════════════════════════════════════════════════════════════════
// 2. INPUT HANDLERS — WASD isometric-relative
// ═══════════════════════════════════════════════════════════════════

function setupInput() {
  const keyMap = {
    // e.code (Physical location)
    KeyW: 'fwd',       ArrowUp:    'fwd',
    KeyS: 'back',      ArrowDown:  'back',
    KeyA: 'left',      ArrowLeft:  'left',
    KeyD: 'right',     ArrowRight: 'right',
    
    // e.key fallback (Case-insensitive)
    w: 'fwd',          W: 'fwd',
    s: 'back',         S: 'back',
    a: 'left',         A: 'left',
    d: 'right',        D: 'right'
  };

  window.addEventListener('keydown', (e) => {
    if (!Player.inputEnabled) return;
    if (Game.isPaused) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) requestJump();
      return;
    }

    const action = keyMap[e.code] || keyMap[e.key];
    if (action) {
      Player.input[action] = 1;
      if (e.code.startsWith('Arrow') || ['w','a','s','d'].includes(e.key.toLowerCase())) {
        // Only prevent default for arrows to avoid scrolling, 
        // WASD usually doesn't need it unless it's a specific browser conflict
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }
    }

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift') {
      Player.input.run = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    // Always clear input on keyup regardless of inputEnabled
    const action = keyMap[e.code] || keyMap[e.key];
    if (action) {
      Player.input[action] = 0;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift') {
      Player.input.run = false;
    }
  });

  window.addEventListener('blur', () => {
    Player.input.fwd = Player.input.back = 0;
    Player.input.left = Player.input.right = 0;
    Player.input.run = false;
  });
}


// ═══════════════════════════════════════════════════════════════════
// 3. ANIMASI — keyframe procedural
// ═══════════════════════════════════════════════════════════════════

function animateIdle(dt) {
  Player.idleCycle += dt;
  animateCharacter(Player, dt, Player.idleCycle);
}

function animateWalk(dt, speedFactor) {
  Player.idleCycle += dt;
  animateCharacter(Player, dt, Player.idleCycle, speedFactor, Player.isRunning);
}


// ═══════════════════════════════════════════════════════════════════
// 4. COLLISION
// ═══════════════════════════════════════════════════════════════════

const PLAYER_RADIUS = 0.4;

function checkCollision(x, z) {
  for (let i = 0; i < World.colliders.length; i++) {
    const c = World.colliders[i];
    if (c.type === 'box') {
      let minX, maxX, minZ, maxZ;

      if (c.box) {
        minX = c.box.min.x;
        maxX = c.box.max.x;
        minZ = c.box.min.z;
        maxZ = c.box.max.z;
      } else if (Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.w) && Number.isFinite(c.d)) {
        minX = c.x - c.w / 2;
        maxX = c.x + c.w / 2;
        minZ = c.z - c.d / 2;
        maxZ = c.z + c.d / 2;
      } else {
        continue;
      }

      if (
        x >= minX - PLAYER_RADIUS &&
        x <= maxX + PLAYER_RADIUS &&
        z >= minZ - PLAYER_RADIUS &&
        z <= maxZ + PLAYER_RADIUS
      ) return c;
    } else if (c.type === 'cylinder') {
      const dx = x - c.x;
      const dz = z - c.z;
      const minDist = c.radius + PLAYER_RADIUS;
      if (dx * dx + dz * dz < minDist * minDist) {
        return c;
      }
    }
  }
  return null;
}


function moveWithCollision(dx, dz) {
  const curX = Player.position.x;
  const curZ = Player.position.z;

  let newX = curX + dx;
  let newZ = curZ + dz;

  if (!checkCollision(newX, newZ)) {
    Player.position.x = newX;
    Player.position.z = newZ;
    return;
  }

  if (!checkCollision(curX + dx, curZ)) {
    Player.position.x = curX + dx;
    return;
  }
  if (!checkCollision(curX, curZ + dz)) {
    Player.position.z = curZ + dz;
    return;
  }
}


// ═══════════════════════════════════════════════════════════════════
// 5. UPDATE per frame — input → movement → animation
// ═══════════════════════════════════════════════════════════════════

function updatePlayer(delta) {
  if (!Player.group) return;

  // ── 5.1 Hitung input direction (ISOMETRIK — relatif layar) ──
  // W = maju ke arah ISO_FORWARD (-1, 0, -1)
  // S = mundur
  // A = kiri = -ISO_RIGHT
  // D = kanan = ISO_RIGHT
  const fwdInput   = Player.input.fwd  - Player.input.back;
  const rightInput = Player.input.right - Player.input.left;

  _tmpMove.set(0, 0, 0);
  _tmpMove.addScaledVector(ISO_FORWARD, fwdInput);
  _tmpMove.addScaledVector(ISO_RIGHT, rightInput);

  const inputMagnitude = _tmpMove.length();

  // ── 5.2 Status ──
  Player.isMoving  = inputMagnitude > 0.01;
  Player.isRunning = Player.isMoving && Player.input.run;

  const targetSpeed = Player.isMoving
    ? CONFIG.PLAYER_SPEED * (Player.isRunning ? CONFIG.RUN_MULTIPLIER : 1.0)
    : 0;

  Player.speed = THREE.MathUtils.lerp(Player.speed, targetSpeed, 0.18);

  // ── 5.3 Movement dengan collision ──
  if (inputMagnitude > 0.01) {
    _tmpMove.normalize();
    const moveDist = Player.speed * delta * (Player.isJumping && Player.isRunning ? 1.15 : 1);

    Player.targetFacing = Math.atan2(_tmpMove.x, _tmpMove.z);

    moveWithCollision(_tmpMove.x * moveDist, _tmpMove.z * moveDist);

    // Clamp ke batas zona (per-zona bila tersedia, else global ZONE_SIZE)
    const zb = (typeof window !== 'undefined') ? window.__zoneBounds__ : null;
    const halfX = (zb ? zb.halfW : CONFIG.ZONE_SIZE / 2) - 0.5;
    const halfZ = (zb ? zb.halfH : CONFIG.ZONE_SIZE / 2) - 0.5;
    Player.position.x = THREE.MathUtils.clamp(Player.position.x, -halfX, halfX);
    Player.position.z = THREE.MathUtils.clamp(Player.position.z, -halfZ, halfZ);
  }

  // ── 5.4 Smooth rotate ──
  let dFacing = Player.targetFacing - Player.facing;
  while (dFacing >  Math.PI) dFacing -= 2 * Math.PI;
  while (dFacing < -Math.PI) dFacing += 2 * Math.PI;
  Player.facing += dFacing * Math.min(1, delta * CONFIG.PLAYER_TURN_SPEED);

  // ── 5.5 Apply ke group + terrain following ──
  Player.group.position.x = Player.position.x;
  Player.group.position.z = Player.position.z;
  Player.group.rotation.y = Player.facing;

  // Terrain height sampling — cast ray down to find ground Y
  if (World.walkables && World.walkables.length > 0) {
    _rayOrigin.set(Player.position.x, 10, Player.position.z);
    _rayDown.set(0, -1, 0);
    _raycaster.set(_rayOrigin, _rayDown);
    const hits = _raycaster.intersectObjects(World.walkables, true);
    if (hits.length > 0) {
      const groundY = Math.max(0, hits[0].point.y);
      Player.position.y = THREE.MathUtils.lerp(Player.position.y, groundY, 0.25);
    } else {
      Player.position.y = THREE.MathUtils.lerp(Player.position.y, 0, 0.25);
    }
  }
  advanceJump(Player, delta);
  Player.group.position.y = Player.position.y + Player.jumpHeight;
  // Keep the contact shadow on the terrain while the body rises.
  Player.shadow.position.y = 0.025 - Player.jumpHeight;
  Player.shadow.material.opacity = 0.22 / (1 + Player.jumpHeight * 0.6);

  // ── 5.6 Animasi ──
  if (Player.isMoving) {
    const speedFactor = Player.speed / CONFIG.PLAYER_SPEED;
    animateWalk(delta, Math.min(1.5, speedFactor));
  } else {
    animateIdle(delta);
  }
  if (Player.isJumping) {
    Player.leftLeg.userData.joint.rotation.x = 0.55;
    Player.rightLeg.userData.joint.rotation.x = 0.7;
    Player.leftArm.rotation.x = -0.65;
    Player.rightArm.rotation.x = -0.65;
  }

  // (Camera follow sekarang di main.js → updateIsoCamera)
}


// ═══════════════════════════════════════════════════════════════════
// 6. API PUBLIK
// ═══════════════════════════════════════════════════════════════════

export function buildPlayer() {
  // Hapus placeholder
  const placeholder = Game.worldGroup.getObjectByName('lukas-placeholder');
  if (placeholder) {
    Game.worldGroup.remove(placeholder);
    if (placeholder.geometry) placeholder.geometry.dispose();
    if (placeholder.material) placeholder.material.dispose();
  }

  const lukasGroup = buildLukasMesh();
  Player.group = lukasGroup;

  Player.position.set(0, 0, 4);
  Player.facing = Math.PI;
  Player.targetFacing = Player.facing;

  lukasGroup.position.copy(Player.position);
  lukasGroup.rotation.y = Player.facing;

  Game.scene.add(lukasGroup);
  Game.player = lukasGroup;

  setupInput();
  registerUpdate(updatePlayer);

  if (CONFIG.DEBUG) {
    console.log('[player.js] Lukas built at', Player.position);
  }
}


export function setInputEnabled(enabled) {
  Player.inputEnabled = enabled;
  if (!enabled) {
    Player.input.fwd = Player.input.back = 0;
    Player.input.left = Player.input.right = 0;
    Player.input.run = false;
  }
}


export function teleportPlayer(x, z, facing = 0) {
  Player.isJumping = false;
  Player.jumpHeight = 0;
  Player.jumpVelocity = 0;
  // Safety: prevent NaN from corrupting camera
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(z)) z = 0;
  if (!Number.isFinite(facing)) facing = 0;

  Player.position.set(x, 0, z);
  Player.facing = facing;
  Player.targetFacing = facing;
  if (Player.group) {
    Player.group.position.set(x, 0, z);
    Player.group.rotation.y = facing;
  }
  // Reset isometric camera supaya tidak lerp dari posisi lama
  resetIsoCamera();
}

export { updatePlayer };

export function requestJump() {
  if (!Player.group || !Player.inputEnabled || Game.isPaused || Player.isJumping) return false;
  Player.isJumping = true;
  Player.jumpHeight = 0;
  Player.jumpVelocity = 7;
  return true;
}
