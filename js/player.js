// ═══════════════════════════════════════════════════════════════════
// js/player.js — KARAKTER LUKAS + KONTROL ISOMETRIK + ANIMASI
//
// Perubahan Isometrik:
//   - WASD sekarang relatif ke layar/isometrik (W=atas-kiri, D=atas-kanan)
//   - Tidak ada camera follow di sini (dipindah ke main.js)
//   - Collision masih sama (slide along wall)
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
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
  const group = new THREE.Group();
  group.name = 'lukas';

  const skinMat = new THREE.MeshStandardMaterial({
    color: COLORS.SKIN, roughness: 0.85, metalness: 0.0,
  });
  const hoodieMat = new THREE.MeshStandardMaterial({
    color: COLORS.HOODIE_BLUE, roughness: 0.7, metalness: 0.0,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: COLORS.PANTS_KHAKI, roughness: 0.85, metalness: 0.0,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: COLORS.HAIR_BLACK, roughness: 0.6, metalness: 0.0,
  });
  const shoesMat = new THREE.MeshStandardMaterial({
    color: COLORS.SHOES_WHITE, roughness: 0.5, metalness: 0.0,
  });

  // ── BODY ──
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.32), hoodieMat
  );
  body.position.y = 1.05;
  body.castShadow = true; body.receiveShadow = true;
  body.name = 'lukas-body';
  group.add(body);
  Player.body = body;

  // Hoodie strings
  const stringGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5);
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const stringL = new THREE.Mesh(stringGeo, stringMat);
  stringL.position.set(-0.05, 1.32, 0.165);
  group.add(stringL);
  const stringR = stringL.clone();
  stringR.position.x = 0.05;
  group.add(stringR);

  // Hood
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.22), hoodieMat
  );
  hood.position.set(0, 1.5, -0.08);
  hood.castShadow = true;
  group.add(hood);

  // ── HEAD ──
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat
  );
  head.position.y = 1.72;
  head.castShadow = true;
  head.name = 'lukas-head';
  group.add(head);
  Player.head = head;

  // Hair
  const hairTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.18, 0.46), hairMat
  );
  hairTop.position.y = 1.92;
  hairTop.castShadow = true;
  group.add(hairTop);
  Player.hair = hairTop;

  // Fringe
  const fringe = new THREE.Mesh(
    new THREE.BoxGeometry(0.43, 0.08, 0.06), hairMat
  );
  fringe.position.set(0, 1.85, 0.21);
  fringe.castShadow = true;
  group.add(fringe);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.01);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 1.74, 0.215);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  group.add(eyeR);

  // Mouth
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.015, 0.01), eyeMat
  );
  mouth.position.set(0, 1.62, 0.215);
  group.add(mouth);

  // ── ARMS ──
  function buildArm(side) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.35, 1.45, 0);
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.7, 0.18), hoodieMat
    );
    upper.position.y = -0.35;
    upper.castShadow = true;
    armGroup.add(upper);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.16, 0.16), skinMat
    );
    hand.position.y = -0.78;
    hand.castShadow = true;
    armGroup.add(hand);

    return { group: armGroup, hand };
  }

  const armL = buildArm(-1);
  const armR = buildArm(+1);
  group.add(armL.group, armR.group);
  Player.leftArm  = armL.group;
  Player.rightArm = armR.group;
  Player.leftHand  = armL.hand;
  Player.rightHand = armR.hand;

  // ── LEGS ──
  function buildLeg(side) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.13, 0.62, 0);
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.62, 0.2), pantsMat
    );
    upper.position.y = -0.31;
    upper.castShadow = true;
    legGroup.add(upper);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.12, 0.32), shoesMat
    );
    shoe.position.set(0, -0.68, 0.04);
    shoe.castShadow = true;
    legGroup.add(shoe);
    return legGroup;
  }

  const legL = buildLeg(-1);
  const legR = buildLeg(+1);
  group.add(legL, legR);
  Player.leftLeg  = legL;
  Player.rightLeg = legR;

  // ── BLOB SHADOW ──
  const shadowGeo = new THREE.CircleGeometry(0.45, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.renderOrder = 1;
  group.add(shadow);
  Player.shadow = shadow;

  return group;
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
  Player.idleCycle += dt * 1.6;

  const bob = Math.sin(Player.idleCycle) * 0.02;
  Player.body.position.y = 1.05 + bob;
  Player.head.position.y = 1.72 + bob;
  Player.hair.position.y = 1.92 + bob;

  const armSway = Math.sin(Player.idleCycle * 0.7) * 0.04;
  Player.leftArm.rotation.x  = armSway;
  Player.rightArm.rotation.x = -armSway;

  Player.leftLeg.rotation.x  = THREE.MathUtils.lerp(Player.leftLeg.rotation.x,  0, 0.15);
  Player.rightLeg.rotation.x = THREE.MathUtils.lerp(Player.rightLeg.rotation.x, 0, 0.15);

  // Reset lean
  Player.body.rotation.x = THREE.MathUtils.lerp(Player.body.rotation.x, 0, 0.1);
  Player.head.rotation.x = THREE.MathUtils.lerp(Player.head.rotation.x, 0, 0.1);
}


function animateWalk(dt, speedFactor) {
  const cycleSpeed = speedFactor * (Player.isRunning ? 11 : 7);
  Player.walkCycle += dt * cycleSpeed;

  const swing = Math.sin(Player.walkCycle);
  const armSwing = swing * (Player.isRunning ? 1.0 : 0.7);
  const legSwing = swing * (Player.isRunning ? 1.1 : 0.8);

  Player.leftArm.rotation.x  =  armSwing;
  Player.rightArm.rotation.x = -armSwing;
  Player.leftLeg.rotation.x  = -legSwing;
  Player.rightLeg.rotation.x =  legSwing;

  const bob = Math.abs(Math.sin(Player.walkCycle)) * 0.06 * speedFactor;
  Player.body.position.y = 1.05 + bob;
  Player.head.position.y = 1.72 + bob;
  Player.hair.position.y = 1.92 + bob;

  if (Player.isRunning) {
    Player.body.rotation.x = THREE.MathUtils.lerp(Player.body.rotation.x, 0.12, 0.1);
    Player.head.rotation.x = THREE.MathUtils.lerp(Player.head.rotation.x, 0.05, 0.1);
  } else {
    Player.body.rotation.x = THREE.MathUtils.lerp(Player.body.rotation.x, 0, 0.1);
    Player.head.rotation.x = THREE.MathUtils.lerp(Player.head.rotation.x, 0, 0.1);
  }
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
    const moveDist = Player.speed * delta;

    Player.targetFacing = Math.atan2(_tmpMove.x, _tmpMove.z);

    moveWithCollision(_tmpMove.x * moveDist, _tmpMove.z * moveDist);

    // Clamp ke batas zona
    const halfW = (CONFIG.ZONE_SIZE / 2) - 0.5;
    Player.position.x = THREE.MathUtils.clamp(Player.position.x, -halfW, halfW);
    Player.position.z = THREE.MathUtils.clamp(Player.position.z, -halfW, halfW);
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
  Player.group.position.y = Player.position.y;

  // ── 5.6 Animasi ──
  if (Player.isMoving) {
    const speedFactor = Player.speed / CONFIG.PLAYER_SPEED;
    animateWalk(delta, Math.min(1.5, speedFactor));
  } else {
    animateIdle(delta);
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
