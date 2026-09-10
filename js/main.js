// ═══════════════════════════════════════════════════════════════════
// js/main.js — ENTRY POINT THREE.JS (Isometric Edition)
// Lukas Abenteuer — Willkommen in Hamburg!
//
// Perubahan Isometrik:
//   - OrthographicCamera menggantikan PerspectiveCamera
//   - Kamera fixed-angle (45° Y, ~35° X) — sudut isometrik sejati
//   - Zone system menggantikan open-world
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';

// Post-processing
import { EffectComposer }    from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }        from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }   from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }        from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass }        from 'three/addons/postprocessing/ShaderPass.js';

// CSS2D untuk label NPC
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

// Konfigurasi
import { CONFIG, EVENTS, COLORS, ZONES } from './config.js';

// World builder (zona)
import { updateWorld } from './world.js';

// Player
import { buildPlayer, teleportPlayer } from './player.js';

// NPCs
import { initNPCSystem } from './npc.js';

// UI (pause menu, mobile, HUD)
import { initUI }    from './ui.js';

// Dialog (Step 8)
import { initDialog } from './dialog.js';

// Zone Manager
import { initZones, loadZone, updateZones } from './zone.js';

// Gameplay Loop Systems
import { ScoreSystem } from './scoring.js';
import { QuestSystem } from './quest.js';
import { clearSave, enableAutosave, readSave, restoreSave } from './savegame.js';


// ═══════════════════════════════════════════════════════════════════
// 1.  GLOBAL GAME STATE
// ═══════════════════════════════════════════════════════════════════

export const Game = {
  // Three.js core
  scene:           null,
  camera:          null,
  renderer:        null,
  composer:        null,
  cssRenderer:     null,

  // Helpers
  clock:           null,
  canvas:          null,

  // Lighting refs
  ambientLight:    null,
  sunLight:        null,
  hemiLight:       null,

  // Containers
  worldGroup:      null,
  npcGroup:        null,
  itemsGroup:      null,
  player:          null,

  // Update callbacks
  updateCallbacks: [],

  // State
  isRunning:       false,
  isBootReady:     false,
  isPaused:        false,
  delta:           0,
  elapsed:         0,
};
window.__GAME__ = Game;


// ═══════════════════════════════════════════════════════════════════
// 2.  LOADING PROGRESS BRIDGE
// ═══════════════════════════════════════════════════════════════════

function setLoadingProgress(percent, status) {
  window.dispatchEvent(new CustomEvent(EVENTS.LOADING_PROGRESS, {
    detail: { percent, status }
  }));
}

function loadingComplete() {
  window.dispatchEvent(new CustomEvent(EVENTS.LOADING_COMPLETE));
}


// ═══════════════════════════════════════════════════════════════════
// 3.  INIT THREE.JS CORE
// ═══════════════════════════════════════════════════════════════════

function initRenderer() {
  Game.canvas = document.getElementById('game-canvas');
  if (!Game.canvas) {
    throw new Error('Canvas #game-canvas tidak ditemukan di DOM.');
  }

  Game.renderer = new THREE.WebGLRenderer({
    canvas:    Game.canvas,
    antialias: true,
    alpha:     false,
    powerPreference: 'high-performance',
  });

  Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));
  Game.renderer.setSize(window.innerWidth, window.innerHeight);

  // Tone mapping cinematic
  Game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  Game.renderer.toneMappingExposure = 1.0;
  Game.renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Shadow
  Game.renderer.shadowMap.enabled = true;
  Game.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  Game.renderer.setClearColor(COLORS.SKY_MID, 1);
}


function initCSSRenderer() {
  Game.cssRenderer = new CSS2DRenderer();
  Game.cssRenderer.setSize(window.innerWidth, window.innerHeight);

  const cssDom = Game.cssRenderer.domElement;
  cssDom.style.position      = 'absolute';
  cssDom.style.top           = '0';
  cssDom.style.left          = '0';
  cssDom.style.pointerEvents = 'none';
  cssDom.style.zIndex        = '40';

  const container = document.getElementById('game-container');
  if (container) container.appendChild(cssDom);
}


function initScene() {
  Game.scene = new THREE.Scene();

  // Background — gradient sore Hamburg
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 2; bgCanvas.height = 256;
  const bgCtx = bgCanvas.getContext('2d');
  const grad = bgCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0,  '#ffd89b');
  grad.addColorStop(0.45, '#ff9a44');
  grad.addColorStop(0.85, '#c85d8a');
  grad.addColorStop(1.0,  '#6b3a6b');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, 2, 256);

  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  Game.scene.background = bgTex;

  // FOG
  Game.scene.fog = new THREE.Fog(COLORS.SKY_TOP, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);

  // Containers
  Game.worldGroup = new THREE.Group(); Game.worldGroup.name = 'worldGroup';
  Game.npcGroup   = new THREE.Group(); Game.npcGroup.name   = 'npcGroup';
  Game.itemsGroup = new THREE.Group(); Game.itemsGroup.name = 'itemsGroup';
  Game.scene.add(Game.worldGroup, Game.npcGroup, Game.itemsGroup);
}


// ═══════════════════════════════════════════════════════════════════
// 3.5  ISOMETRIC CAMERA (OrthographicCamera)
// ═══════════════════════════════════════════════════════════════════

function initCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const zoom   = CONFIG.ISO_ZOOM;

  // OrthographicCamera — kunci tampilan isometrik
  Game.camera = new THREE.OrthographicCamera(
    -zoom * aspect,  // left
     zoom * aspect,  // right
     zoom,           // top
    -zoom,           // bottom
    CONFIG.CAMERA_NEAR,
    CONFIG.CAMERA_FAR
  );

  // Posisikan kamera di sudut isometrik
  // Posisi awal (akan di-update tiap frame oleh updateIsoCamera)
  const dist = CONFIG.ISO_CAM_HEIGHT;
  Game.camera.position.set(dist, dist, dist);
  Game.camera.lookAt(0, 0, 0);

  // Update rotation ke isometric angle
  updateIsoCameraRotation();
}

/**
 * Set rotasi kamera ke sudut isometrik fixed.
 * Dipanggil sekali saat init dan saat resize.
 */
function updateIsoCameraRotation() {
  // Kita posisikan kamera berdasarkan sudut isometrik
  // Tidak perlu lookAt setiap frame — cukup set rotation sekali
  // dan update position (translation) setiap frame mengikuti player
  const angleY = CONFIG.ISO_ANGLE_Y;  // 45°
  const angleX = CONFIG.ISO_ANGLE_X;  // ~35.26°
  const dist   = CONFIG.ISO_CAM_HEIGHT;

  // Hitung posisi kamera relatif ke target (0,0,0)
  const camX = dist * Math.sin(angleY) * Math.cos(angleX);
  const camY = dist * Math.sin(angleX);
  const camZ = dist * Math.cos(angleY) * Math.cos(angleX);

  Game.camera.position.set(camX, camY, camZ);
  Game.camera.lookAt(0, 0, 0);

  // Simpan offset awal untuk dipakai di updateIsoCamera
  Game._isoCamOffset = new THREE.Vector3(camX, camY, camZ);
  Game._isoCamLookTarget = new THREE.Vector3(0, 0, 0);
}


// Camera follow state
const _camFollowPos = new THREE.Vector3();
let _camInitialized = false;

/**
 * Update posisi kamera isometrik mengikuti player.
 * Dipanggil setiap frame dari game loop.
 */
export function updateIsoCamera(delta) {
  if (!Game.camera || !Game._isoCamOffset) return;

  // Import player position (lazy to avoid circular)
  const playerPos = Game.player?.position || new THREE.Vector3(0, 0, 0);
  
  // Target: player position + offset tetap
  let targetX = playerPos.x + Game._isoCamOffset.x;
  const targetY = Game._isoCamOffset.y;
  let targetZ = playerPos.z + Game._isoCamOffset.z;

  // Camera bounds for Supermarket Interior (15x15 room)
  if (Game.activeZoneId === 'supermarket_interior') {
    // The camera should not pan past the walls.
    // Given the room bounds: x in [-7.5, 7.5], z in [-7.5, 7.5]
    // The player's effective position that the camera is looking at should be clamped.
    const lookClampX = Math.max(-5, Math.min(5, playerPos.x));
    const lookClampZ = Math.max(-5, Math.min(5, playerPos.z));
    targetX = lookClampX + Game._isoCamOffset.x;
    targetZ = lookClampZ + Game._isoCamOffset.z;
  }

  if (!_camInitialized) {
    _camFollowPos.set(targetX, targetY, targetZ);
    _camInitialized = true;
  }

  // Smooth follow (exponential decay — frame-rate independent)
  const t = 1 - Math.exp(-CONFIG.ISO_CAM_FOLLOW_SPEED * delta);
  _camFollowPos.x += (targetX - _camFollowPos.x) * t;
  _camFollowPos.y += (targetY - _camFollowPos.y) * t;
  _camFollowPos.z += (targetZ - _camFollowPos.z) * t;

  Game.camera.position.copy(_camFollowPos);

  // LookAt = player position (with Y offset)
  Game._isoCamLookTarget.set(
    playerPos.x,
    CONFIG.CAMERA_LOOK_AT_OFFSET_Y,
    playerPos.z
  );
  // Smooth look target juga
  Game.camera.lookAt(
    _camFollowPos.x - Game._isoCamOffset.x,
    CONFIG.CAMERA_LOOK_AT_OFFSET_Y,
    _camFollowPos.z - Game._isoCamOffset.z
  );
}

/**
 * Reset camera position (teleport instan tanpa lerp).
 */
export function resetIsoCamera() {
  _camInitialized = false;
}


function initLighting() {
  // 1. Ambient
  Game.ambientLight = new THREE.AmbientLight(
    CONFIG.AMBIENT_COLOR,
    CONFIG.AMBIENT_INTENSITY
  );
  Game.scene.add(Game.ambientLight);

  // 2. Sun (DirectionalLight) — matahari sore
  Game.sunLight = new THREE.DirectionalLight(
    CONFIG.SUN_COLOR,
    CONFIG.SUN_INTENSITY
  );
  Game.sunLight.position.set(
    CONFIG.SUN_POSITION.x,
    CONFIG.SUN_POSITION.y,
    CONFIG.SUN_POSITION.z
  );
  Game.sunLight.castShadow = true;

  const s = CONFIG.SHADOW_CAMERA_SIZE;
  Game.sunLight.shadow.mapSize.width  = CONFIG.SHADOW_MAP_SIZE;
  Game.sunLight.shadow.mapSize.height = CONFIG.SHADOW_MAP_SIZE;
  Game.sunLight.shadow.camera.left    = -s;
  Game.sunLight.shadow.camera.right   =  s;
  Game.sunLight.shadow.camera.top     =  s;
  Game.sunLight.shadow.camera.bottom  = -s;
  Game.sunLight.shadow.camera.near    = 0.5;
  Game.sunLight.shadow.camera.far     = 100;
  Game.sunLight.shadow.bias           = -0.0008;
  Game.sunLight.shadow.normalBias     = 0.04;
  Game.sunLight.shadow.camera.updateProjectionMatrix();

  Game.scene.add(Game.sunLight);
  Game.scene.add(Game.sunLight.target);

  // 3. Hemisphere
  Game.hemiLight = new THREE.HemisphereLight(
    CONFIG.HEMI_SKY_COLOR,
    CONFIG.HEMI_GROUND_COLOR,
    CONFIG.HEMI_INTENSITY
  );
  Game.hemiLight.position.set(0, 50, 0);
  Game.scene.add(Game.hemiLight);

  if (CONFIG.DEBUG) {
    const helper = new THREE.DirectionalLightHelper(Game.sunLight, 5);
    const camHelper = new THREE.CameraHelper(Game.sunLight.shadow.camera);
    Game.scene.add(helper, camHelper);
  }
}


// ═══════════════════════════════════════════════════════════════════
// 4.  POST-PROCESSING
// ═══════════════════════════════════════════════════════════════════

function initPostProcessing() {
  Game.composer = new EffectComposer(Game.renderer);
  Game.composer.setSize(window.innerWidth, window.innerHeight);
  Game.composer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));

  Game.composer.addPass(new RenderPass(Game.scene, Game.camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.BLOOM_STRENGTH,
    CONFIG.BLOOM_RADIUS,
    CONFIG.BLOOM_THRESHOLD
  );
  Game.composer.addPass(bloomPass);

  // Vignette ringan
  const vignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      offset:   { value: 1.05 },
      darkness: { value: 1.15 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float offset;
      uniform float darkness;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec2 uv    = (vUv - vec2(0.5)) * vec2(offset);
        float vig  = smoothstep(0.8, 0.4, length(uv));
        texel.rgb *= mix(1.0, vig, darkness * 0.35);
        gl_FragColor = texel;
      }
    `,
  };
  Game.composer.addPass(new ShaderPass(vignetteShader));
  Game.composer.addPass(new OutputPass());
}


// ═══════════════════════════════════════════════════════════════════
// 5.  RESIZE HANDLER
// ═══════════════════════════════════════════════════════════════════

function onWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const zoom = CONFIG.ISO_ZOOM;

  // Update OrthographicCamera frustum
  Game.camera.left   = -zoom * aspect;
  Game.camera.right  =  zoom * aspect;
  Game.camera.top    =  zoom;
  Game.camera.bottom = -zoom;
  Game.camera.updateProjectionMatrix();

  Game.renderer.setSize(w, h);
  Game.composer.setSize(w, h);
  if (Game.cssRenderer) Game.cssRenderer.setSize(w, h);

  window.dispatchEvent(new CustomEvent(EVENTS.GAME_RESIZE, {
    detail: { width: w, height: h }
  }));
}


// ═══════════════════════════════════════════════════════════════════
// 6.  GAME LOOP
// ═══════════════════════════════════════════════════════════════════

function gameLoop() {
  if (!Game.isRunning) return;
  requestAnimationFrame(gameLoop);
  if (Game.isPaused) return;

  Game.delta   = Game.clock.getDelta();
  Game.elapsed = Game.clock.getElapsedTime();

  // Cap delta
  if (Game.delta > 0.1) Game.delta = 0.1;

  // Update callbacks (player, npc, dll)
  for (let i = 0; i < Game.updateCallbacks.length; i++) {
    Game.updateCallbacks[i](Game.delta, Game.elapsed);
  }

  // Isometric camera follow
  updateIsoCamera(Game.delta);

  // Zone portal checks & animations
  updateZones(Game.delta, Game.elapsed);

  // World animations (sungai, awan)
  updateWorld(Game.delta, Game.elapsed);

  // Render
  Game.composer.render();
  if (Game.cssRenderer) Game.cssRenderer.render(Game.scene, Game.camera);
}


export function registerUpdate(fn) {
  if (typeof fn === 'function' && !Game.updateCallbacks.includes(fn)) {
    Game.updateCallbacks.push(fn);
  }
}

export function unregisterUpdate(fn) {
  const idx = Game.updateCallbacks.indexOf(fn);
  if (idx !== -1) Game.updateCallbacks.splice(idx, 1);
}


// ═══════════════════════════════════════════════════════════════════
// 7.  PAUSE / RESUME
// ═══════════════════════════════════════════════════════════════════

function pauseGame() {
  Game.isPaused = true;
  Game.clock?.stop();
}

function resumeGame() {
  Game.isPaused = false;
  Game.clock?.start();
}


// ═══════════════════════════════════════════════════════════════════
// 8.  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════

async function bootstrap() {
  try {
    setLoadingProgress(5, 'Three.js wird initialisiert…');
    initRenderer();

    setLoadingProgress(20, 'Szene wird aufgebaut…');
    initScene();
    initCamera();

    setLoadingProgress(40, 'Hamburg wird beleuchtet…');
    initLighting();

    setLoadingProgress(60, 'Effekte werden vorbereitet…');
    initPostProcessing();
    initCSSRenderer();

    setLoadingProgress(75, 'Lukas wird vorbereitet…');
    buildPlayer();

    setLoadingProgress(80, 'NPC-System wird geladen…');
    initNPCSystem();

    setLoadingProgress(85, 'Zonen werden vorbereitet…');
    initZones();

    setLoadingProgress(90, 'Erste Zone wird geladen…');
    await loadZone(ZONES.HAUS_INTERIOR, null, true); // Spawn di kamar tidur Lukas (Stage 1)

    setLoadingProgress(95, 'UI wird eingerichtet…');
    initUI();
    initDialog();

    // Expose quest data
    const { QUESTS } = await import('./data/quests.js');
    window.__questData__  = QUESTS;

    // Initialize gameplay systems
    ScoreSystem.init();
    QuestSystem.init();

    // Setup clock & event listeners
    Game.clock = new THREE.Clock(false);
    window.addEventListener('resize', onWindowResize);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.isRunning && !Game.isPaused) {
        pauseGame();
      }
    });

    setLoadingProgress(100, 'Bereit!');
    loadingComplete();

    // Bootstrap fertig — falls der Spieler im Menü schon auf
    // "Abenteuer beginnen" geklickt hat, jetzt nachholen.
    Game.isBootReady = true;
    if (startRequested) startGame(startRequested.mode, startRequested.save);

    if (CONFIG.DEBUG) {
      console.log('[Lukas Abenteuer] Init complete.', Game);
    }

  } catch (err) {
    console.error('[Lukas Abenteuer] Init error:', err);
    setLoadingProgress(0, '⚠️ Fehler: ' + err.message);
  }
}


/**
 * Wird beim Klick auf "Abenteuer beginnen" gefeuert. Weil das Hauptmenü
 * der erste Bildschirm ist, kann das passieren, bevor die Bootstrap durch
 * ist — dann wird der Start gemerkt und am Ende der Bootstrap nachgeholt.
 */
let startRequested = null;

function requestStart(mode = 'new', save = null) {
  if (Game.isBootReady) startGame(mode, save);
  else startRequested = { mode, save };
}

window.addEventListener(EVENTS.GAME_START, () => requestStart('new'), { once: true });
window.addEventListener('menu:continue', (event) => {
  const save = event.detail?.save || readSave();
  window.__pendingContinueSave__ = null;
  requestStart('continue', save);
}, { once: true });

// Continue dapat ditekan saat dependency Three.js masih dimuat. Dalam kasus
// itu event terjadi lebih dulu dan snapshot-nya dititipkan oleh mainmenu.js.
if (window.__pendingContinueSave__) {
  const pendingSave = window.__pendingContinueSave__;
  window.__pendingContinueSave__ = null;
  requestStart('continue', pendingSave);
}


async function startGame(mode = 'new', save = null) {
  if (Game.isRunning) return;
  if (mode === 'new') {
    clearSave();
    ScoreSystem.score = 0;
    ScoreSystem.streak = 0;
    window.__score__ = 0;
  } else {
    const restored = await restoreSave(save, { loadZone, teleportPlayer, QuestSystem, ScoreSystem });
    if (!restored) {
      clearSave();
      mode = 'new';
      window.dispatchEvent(new CustomEvent(EVENTS.GAME_START));
      return;
    }
  }
  Game.isRunning = true;
  enableAutosave();
  Game.clock.start();
  requestAnimationFrame(gameLoop);

  const container = document.getElementById('game-container');
  if (container) {
    container.setAttribute('aria-hidden', 'false');
    container.classList.add('game-container-active');
  }

  const hintEl = document.getElementById('controls-hint');
  if (hintEl) hintEl.classList.remove('hud-hidden');

  // Import UI and set initial objective
  if (mode === 'new') import('./ui.js').then(({ UI }) => {
    UI.updateObjective('Ich habe Hunger. Wo ist die Pfanne?');
  });

  if (CONFIG.DEBUG) console.log('[Lukas Abenteuer] Game loop started.');
}


// ═══════════════════════════════════════════════════════════════════
// 9. AUTO-START
// ═══════════════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

if (CONFIG.DEBUG) {
  window.__GAME__ = Game;
}
