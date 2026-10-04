// ═══════════════════════════════════════════════════════════════════
// js/world.js — BUILDER DUNIA PER ZONA
// Tanah, rumah Oma (eksterior + interior), interior EDEKA, awan.
// Kota Stage 2 (Die Stadt) dibangun di js/stadt.js.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { buildQuestItem, buildOpenStorage } from './items.js';
import { buildStadt }       from './stadt.js';
import { buildHausYard }    from './haus.js';
import { Game }             from './main.js';
import { CONFIG, COLORS, ZONES } from './config.js';

export const World = {
  ground: null, road: null, house: null, garage: null, garden: null, river: null,
  zones:  {},
  colliders:    [],
  walkables:    [],     // Array of meshes for terrain/floor raycasting
  streetLamps:  [],
  windowLights: [],
  _updateRiver:  null,
  _updateClouds: null,
};

// ═══════════════════════════════════════════════════════════════════
// 1. TEXTURES
// ═══════════════════════════════════════════════════════════════════

// ── LOW POLY MATERIAL HELPER ──
export function lpMat(colorCode) {
  return new THREE.MeshLambertMaterial({ color: colorCode, flatShading: true });
}

const MODERN_COLORS = {
  GRASS: 0xa8d973, // light vibrant green
};

// ═══════════════════════════════════════════════════════════════════
// 2. GROUND
// ═══════════════════════════════════════════════════════════════════

function buildGround(zoneId) {
  const size = CONFIG.ZONE_SIZE || 80;

  if (zoneId === ZONES.HAUS) {
    // Medan low-poly di sekeliling halaman (js/haus.js). Sungai (x ≈ −7)
    // mengalir menembus SELURUH medan dalam lembah landai, jadi dari sudut
    // kamera mana pun sungai tidak pernah terlihat terputus. Bukit baru naik
    // perlahan jauh dari halaman & sungai (tanpa tebing di tepi halaman).
    const SIZE = 110, segments = 66, RX = -7;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
    const pos = geo.attributes.position;
    const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dr = Math.abs(x - RX);
      // Bukit, diredam dekat sungai dan dekat halaman (±14)
      const hills = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 1.8 + Math.sin(x * 0.4 + y * 0.4) * 0.3;
      const awayYard = smooth(15, 24, Math.max(Math.abs(x), Math.abs(y)));
      const awayRiver = smooth(4.5, 11, dr);
      // Halaman & tepi sungai rata (dasar + air sungai dibuat di haus.js)
      pos.setZ(i, Math.max(0, hills + 0.6) * awayYard * awayRiver - 0.01);
    }
    geo.computeVertexNormals();
    
    const mat = new THREE.MeshLambertMaterial({
      color: 0x72ad44,  // sama dengan platform halaman
      flatShading: true,
    });
    const g = new THREE.Mesh(geo, mat);
    g.rotation.x = -Math.PI/2;
    g.receiveShadow = true;
    g.name = 'ground';
    Game.worldGroup.add(g);
    World.ground = g;
    World.walkables = [g];
  } else if (zoneId === ZONES.SUPERMARKET_INTERIOR) {
    // Light grey floor for interior
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      lpMat(0xeeeeee)
    );
    g.rotation.x = -Math.PI/2;
    g.receiveShadow = true;
    g.name = 'ground_interior';
    Game.worldGroup.add(g);
    World.ground = g;
    World.walkables = [g];
  } else if (zoneId === ZONES.HAUS_INTERIOR) {
    // Warna lantai dasar — akan ditimpa floor per-ruangan
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 32),
      lpMat(0xc9a880)  // wood-ish base
    );
    g.rotation.x = -Math.PI/2;
    g.receiveShadow = true;
    g.name = 'ground_haus_interior';
    Game.worldGroup.add(g);
    World.ground = g;
    World.walkables = [g];
  } else if (zoneId === ZONES.STADT) {
    // Kota terpadu — rumput jauh lebih luas dari batas zona (84×70) supaya
    // tepi dunia tidak pernah terlihat oleh kamera isometrik.
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 130),
      lpMat(MODERN_COLORS.GRASS)
    );
    g.rotation.x = -Math.PI/2; g.receiveShadow = true; g.name = 'ground_stadt';
    Game.worldGroup.add(g); World.ground = g;
    World.walkables = [g];
  } else {
    // Flat vibrant grass ground for modern city
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      lpMat(MODERN_COLORS.GRASS)
    );
    g.rotation.x = -Math.PI/2; g.receiveShadow = true; g.name = 'ground';
    Game.worldGroup.add(g); World.ground = g;
    World.walkables = [g];
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. HELPERS
// (Kota Stage 2 dibangun di js/stadt.js)
// ═══════════════════════════════════════════════════════════════════

// Helper: create mesh and set position (Object.assign can't overwrite .position in Three.js 0.158+)
function mP(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}


// 5. Rumah kakek-nenek & halamannya dibangun di js/haus.js

// ═══════════════════════════════════════════════════════════════════
// 6. GARASI
// ═══════════════════════════════════════════════════════════════════

function buildGarage() {
  const g=new THREE.Group(); g.name='garage';
  const W=4.5,H=3,D=5.5;
  const mat=lpMat(0x8B5E3C);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+0.3,0.2,D+0.3),lpMat(0x3a2818));
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),mat);
  body.position.y=H/2; body.castShadow=body.receiveShadow=true; g.add(body);
  roof.position.y=H+0.1; roof.castShadow=true; g.add(roof);
  const door=new THREE.Mesh(new THREE.BoxGeometry(3,2.4,0.1),lpMat(0x5a5248));
  door.position.set(0,1.2,D/2+0.06); g.add(door);
  for (let i=-1;i<=1;i++) {
    const sl=new THREE.Mesh(new THREE.BoxGeometry(0.04,2.3,0.01),lpMat(0x3a3228));
    sl.position.set(i*0.8,1.2,D/2+0.12); g.add(sl);
  }
  g.position.set(12,0,-4); Game.worldGroup.add(g); World.garage=g;
  World.colliders.push({type:'box',box:new THREE.Box3(
    new THREE.Vector3(9.5,0,-6.8),new THREE.Vector3(14.5,5,-1.2)),name:'garage'});
}

// ═══════════════════════════════════════════════════════════════════
// 7. TAMAN DEPAN
// ═══════════════════════════════════════════════════════════════════

function buildGarden() {
  const g=new THREE.Group(); g.name='garden';

  // Patch rumput hijau lush
  const patch=new THREE.Mesh(new THREE.PlaneGeometry(12,8),lpMat(0x5a9a3c));
  patch.rotation.x=-Math.PI/2; patch.position.set(2,0.015,2); patch.receiveShadow=true; g.add(patch);

  // Pagar besi rendah (sisi depan)
  const pMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,metalness:0.5,roughness:0.5});
  const postGeo=new THREE.CylinderGeometry(0.045,0.045,0.95,6);
  const railGeo=new THREE.BoxGeometry(1.05,0.04,0.04);
  // Tiang-tiang
  for (let i=-3;i<=3;i++) {
    const p=new THREE.Mesh(postGeo,pMat); p.position.set(2+i,0.47,6.0); p.castShadow=true; g.add(p);
  }
  for (const y of [0.8,0.2]) {
    for (let i=-3;i<3;i++) {
      const r=new THREE.Mesh(railGeo,pMat); r.position.set(2.5+i,y,6.0); g.add(r);
    }
  }
  // Tiang pagar sisi (kiri & kanan)
  for (const xs of [-1.5, 5.5]) {
    for (let z=0;z<=6;z+=1.5) {
      const p=new THREE.Mesh(postGeo,pMat); p.position.set(xs,0.47,z); p.castShadow=true; g.add(p);
    }
    const sideRailGeo=new THREE.BoxGeometry(0.04,0.04,6.5);
    for (const y of [0.8,0.2]) {
      const r=new THREE.Mesh(sideRailGeo,pMat); r.position.set(xs,y,3); g.add(r);
    }
  }
  // Tiang gerbang lebih tinggi
  const gtGeo=new THREE.CylinderGeometry(0.065,0.065,1.3,8);
  for (const gx of [0.5,3.5]) {
    const gt=new THREE.Mesh(gtGeo,pMat); gt.position.set(gx,0.65,6.0); gt.castShadow=true; g.add(gt);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),
      new THREE.MeshStandardMaterial({color:COLORS.ACCENT,metalness:0.5,roughness:0.4}));
    ball.position.set(gx,1.38,6.0); g.add(ball);
  }

  // Semak-semak
  const bushGeo=new THREE.IcosahedronGeometry(0.45,1);
  const bushMat=new THREE.MeshStandardMaterial({color:0x3a7228,roughness:0.8});
  for (const bp of [{x:-0.8,z:4.5},{x:5.2,z:4.5},{x:-0.8,z:1.5},{x:5.2,z:1.5},{x:2,z:7}]) {
    const b=new THREE.Mesh(bushGeo,bushMat); b.position.set(bp.x,0.42,bp.z); b.scale.setScalar(0.8+Math.random()*0.4);
    b.castShadow=true; g.add(b);
    const t=new THREE.Mesh(bushGeo,bushMat); t.position.set(bp.x,0.72,bp.z); t.scale.setScalar(0.55); t.castShadow=true; g.add(t);
  }

  // Bunga
  const flowerMat=new THREE.MeshStandardMaterial({color:COLORS.ACCENT,emissive:COLORS.ACCENT,emissiveIntensity:0.25});
  const stemMat=new THREE.MeshStandardMaterial({color:0x3a7228});
  for (let i=0;i<18;i++) {
    const fx=-3+Math.random()*10, fz=Math.random()*5;
    if (Math.abs(fx-2)<1.5 && fz<1) continue;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.25,5),stemMat);
    stem.position.set(fx,0.13,fz); g.add(stem);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.065,7,6),flowerMat);
    head.position.set(fx,0.3,fz); g.add(head);
  }

  Game.worldGroup.add(g); World.garden=g;
}



// ═══════════════════════════════════════════════════════════════════
// 9. POHON — di luar jalur jalan
// ═══════════════════════════════════════════════════════════════════

function buildTrees() {
  const trunkMat=new THREE.MeshStandardMaterial({color:0x4a3020,roughness:0.9});
  const leafMat=new THREE.MeshStandardMaterial({color:0x3a7228,roughness:0.85});

  // Modern city trees: align along sidewalks
  const treePos = [];
  const coords = [-22, -10, 10, 22]; // Sidewalk lines
  coords.forEach(cx => {
    for (let cz = -20; cz <= 20; cz += 10) {
      if (Math.abs(cz - 16) < 6 || Math.abs(cz + 16) < 6) continue; // Skip intersections
      treePos.push({x: cx, z: cz, s: 0.8 + Math.random()*0.4});
      treePos.push({x: cz, z: cx, s: 0.8 + Math.random()*0.4}); // Horizontal
    }
  });

  const N = treePos.length;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18,0.25,2.4,7), trunkMat, N);
  trunkInst.castShadow=true; trunkInst.receiveShadow=true;
  const leafInst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.2,1), leafMat, N*3);
  leafInst.castShadow=true;

  const dummy=new THREE.Object3D();
  treePos.forEach((p,i) => {
    dummy.position.set(p.x, 1.2*p.s, p.z);
    dummy.scale.setScalar(p.s);
    dummy.rotation.set(0,Math.random()*Math.PI,0);
    dummy.updateMatrix(); trunkInst.setMatrixAt(i,dummy.matrix);
    const baseY=2.4*p.s;
    [{dx:0,dy:0,dz:0,ls:1.0},{dx:0.4,dy:0.35,dz:-0.3,ls:0.68},{dx:-0.35,dy:0.4,dz:0.35,ls:0.62}].forEach((l,j) => {
      dummy.position.set(p.x+l.dx,baseY+l.dy,p.z+l.dz);
      dummy.scale.setScalar(p.s*l.ls);
      dummy.rotation.set(Math.random()*0.4,Math.random()*Math.PI*2,Math.random()*0.4);
      dummy.updateMatrix(); leafInst.setMatrixAt(i*3+j,dummy.matrix);
    });
    World.colliders.push({type:'cylinder',x:p.x,z:p.z,radius:0.4});
  });
  trunkInst.instanceMatrix.needsUpdate=true;
  leafInst.instanceMatrix.needsUpdate=true;
  Game.worldGroup.add(trunkInst,leafInst);
}

// ═══════════════════════════════════════════════════════════════════
// 10. LAMPU JALAN
// ═══════════════════════════════════════════════════════════════════

function buildLamps() {
  const poleMat = lpMat(0x333333);
  const headMat = new THREE.MeshStandardMaterial({
    color:0xffffff, emissive:0xffffff, emissiveIntensity:0.0, roughness:0.1
  });

  const lamps = [];
  const coords = [-20.5, -11.5, 11.5, 20.5]; // Inner and outer sidewalk edges
  coords.forEach(cx => {
    for (let cz = -25; cz <= 25; cz += 15) {
      if (Math.abs(cz - 16) < 6 || Math.abs(cz + 16) < 6) continue;
      lamps.push({x: cx, z: cz, rotY: cx > 0 ? Math.PI : 0});
      lamps.push({x: cz, z: cx, rotY: cx > 0 ? -Math.PI/2 : Math.PI/2});
    }
  });

  lamps.forEach(p => {
    const g = new THREE.Group();
    // Modern sleek pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), poleMat);
    pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
    // Arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), poleMat);
    arm.position.set(-0.6, 4.9, 0); g.add(arm);
    // Head (flat LED panel style)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.4), headMat.clone());
    head.position.set(-1.0, 4.85, 0); g.add(head);
    
    const light = new THREE.PointLight(0xffffff, 0, 10, 1.5);
    light.position.copy(head.position); light.position.y -= 0.1; g.add(light);
    
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rotY;
    Game.worldGroup.add(g);
    World.streetLamps.push({group:g, head, light});
    World.colliders.push({type:'cylinder', x:p.x, z:p.z, radius:0.2});
  });
}

// ═══════════════════════════════════════════════════════════════════
// 11. SUNGAI + AWAN + BORDER FOG
// ═══════════════════════════════════════════════════════════════════

function buildRiver() {
  const wc=document.createElement('canvas'); wc.width=wc.height=256;
  const wctx=wc.getContext('2d');
  const grad=wctx.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#67e8ff');
  grad.addColorStop(0.55,'#22bdf4');
  grad.addColorStop(1,'#0c86cc');
  wctx.fillStyle=grad; wctx.fillRect(0,0,256,256);
  for(let i=0;i<70;i++){
    wctx.strokeStyle=`rgba(255,255,255,${0.1+Math.random()*0.22})`;
    wctx.lineWidth=1+Math.random()*2;
    wctx.beginPath();
    const y=Math.random()*256;
    wctx.moveTo(Math.random()*80,y);
    wctx.quadraticCurveTo(120+Math.random()*40,y-8+Math.random()*16,240,y);
    wctx.stroke();
  }
  const wTex=new THREE.CanvasTexture(wc);
  wTex.wrapS=wTex.wrapT=THREE.RepeatWrapping; wTex.repeat.set(3,8);
  const water=new THREE.Mesh(
    new THREE.PlaneGeometry(60,200,12,40),
    new THREE.MeshStandardMaterial({map:wTex,color:0x35d7ff,emissive:0x0b6fa8,emissiveIntensity:0.1,roughness:0.18,metalness:0.15,transparent:true,opacity:0.92})
  );
  water.rotation.x=-Math.PI/2; water.position.set(75,0.05,0);
  Game.worldGroup.add(water); World.river=water;
  const pos=water.geometry.attributes.position;
  World._updateRiver=(delta,elapsed)=>{
    wTex.offset.y=elapsed*0.08;
    wTex.offset.x=Math.sin(elapsed*0.7)*0.03;
    for(let i=0;i<pos.count;i++){
      pos.setZ(i, Math.sin(pos.getX(i)*0.35+elapsed*1.8)*0.08+Math.cos(pos.getY(i)*0.18+elapsed*1.1)*0.06);
    }
    pos.needsUpdate=true;
    water.geometry.computeVertexNormals();
  };
}

function buildClouds() {
  const cc=document.createElement('canvas'); cc.width=cc.height=128;
  const cctx=cc.getContext('2d');
  const cg=cctx.createRadialGradient(64,64,8,64,64,60);
  cg.addColorStop(0,'rgba(255,240,220,0.85)'); cg.addColorStop(0.5,'rgba(255,220,180,0.55)'); cg.addColorStop(1,'rgba(255,200,160,0)');
  cctx.fillStyle=cg; cctx.fillRect(0,0,128,128);
  const cTex=new THREE.CanvasTexture(cc); cTex.colorSpace=THREE.SRGBColorSpace;
  const cMat=new THREE.SpriteMaterial({map:cTex,transparent:true,opacity:0.65,depthWrite:false,fog:false});
  const cloudGrp=new THREE.Group(); cloudGrp.name='clouds';
  for(let i=0;i<28;i++){
    const sp=new THREE.Sprite(cMat.clone());
    const s=10+Math.random()*18;
    sp.scale.set(s,s*0.6,1);
    // Tinggi di atas kamera isometrik (y≈29) supaya awan tidak menutupi gedung
    sp.position.set(-120+Math.random()*240,40+Math.random()*12,-120+Math.random()*240);
    cloudGrp.add(sp);
  }
  Game.worldGroup.add(cloudGrp);
  World._updateClouds=(delta)=>{
    cloudGrp.children.forEach((s,i)=>{
      s.position.x+=delta*(0.2+(i%3)*0.12);
      if(s.position.x>140) s.position.x=-140;
    });
  };
}

// ═══════════════════════════════════════════════════════════════════
// 11.5 DIORAMA RUMAH KAKEK-NENEK (BEAUTIFUL LOW POLY)
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// 15.5 SUPERMARKET INTERIOR
// ═══════════════════════════════════════════════════════════════════

function createShelf(w, h, d, color = 0xeeeeee) {
  // Rak terbuka: panel belakang di tengah, papan rak di tiga tingkat,
  // produk berwarna di KEDUA sisi supaya terlihat dari kamera.
  const group = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color });
  const shelfMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  group.add(mP(new THREE.BoxGeometry(w, h, 0.08), frameMat, 0, h / 2, 0));
  for (const sx of [-1, 1]) group.add(mP(new THREE.BoxGeometry(0.08, h, d), frameMat, sx * (w / 2 - 0.04), h / 2, 0));
  group.add(mP(new THREE.BoxGeometry(w, 0.18, d), frameMat, 0, 0.09, 0));
  const palette = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71, 0xe67e22, 0x9b59b6, 0xffffff];
  let k = Math.floor(w * 7 + h * 3);
  for (let i = 0; i < 3; i++) {
    const y = 0.18 + i * (h - 0.2) / 3;
    group.add(mP(new THREE.BoxGeometry(w - 0.1, 0.05, d), shelfMat, 0, y, 0));
    for (const side of [-1, 1]) {
      for (let x = -w / 2 + 0.25; x <= w / 2 - 0.2; x += 0.32) {
        const ph = 0.22 + ((k * 13) % 5) * 0.03;
        group.add(mP(new THREE.BoxGeometry(0.24, ph, 0.22), new THREE.MeshLambertMaterial({ color: palette[k++ % palette.length] }),
          x, y + 0.03 + ph / 2, side * d / 4));
      }
    }
  }
  return group;
}

function createKasse() {
  const group = new THREE.Group();
  group.add(mP(new THREE.BoxGeometry(2, 0.95, 0.9), new THREE.MeshLambertMaterial({ color: 0x1d4fb8 }), 0, 0.475, 0));
  group.add(mP(new THREE.BoxGeometry(2.05, 0.06, 0.95), new THREE.MeshLambertMaterial({ color: 0x333333 }), 0, 0.98, 0));
  group.add(mP(new THREE.BoxGeometry(0.4, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: 0x222222 }), 0.55, 1.25, 0));
  group.add(mP(new THREE.BoxGeometry(0.06, 0.25, 0.06), new THREE.MeshLambertMaterial({ color: 0x555555 }), 0.55, 1.05, 0));
  return group;
}

function interiorSign(text, bg, fg, w, h) {
  const c = document.createElement('canvas'); c.width = Math.round(128 * w / h); c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, 128);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 80;
  do { ctx.font = `900 ${size}px Arial, sans-serif`; size -= 2; } while (ctx.measureText(text).width > c.width * 0.86 && size > 16);
  ctx.fillText(text, c.width / 2, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}

function buildSupermarktInterior() {
  // Ruang 15×15. Dinding belakang (utara) & kiri (barat) tinggi; dinding yang
  // menghadap kamera (selatan & timur) hanya setinggi lutut supaya isi toko
  // dan pemain selalu terlihat. Pintu di dinding TIMUR — sama seperti fasad
  // EDEKA di kota yang menghadap Parkplatz.
  const wallMat = lpMat(0xf6f4ee), kneeMat = lpMat(0xd9d6cc), blue = lpMat(0x1d4fb8), yellow = lpMat(0xffd400);
  const H = 4.2, K = 0.9;

  // Lantai keramik
  const tc = document.createElement('canvas'); tc.width = tc.height = 64;
  const tctx = tc.getContext('2d');
  tctx.fillStyle = '#ecebe6'; tctx.fillRect(0, 0, 64, 64);
  tctx.fillStyle = '#d6d4cc'; tctx.fillRect(0, 0, 32, 32); tctx.fillRect(32, 32, 32, 32);
  const tTex = new THREE.CanvasTexture(tc); tTex.wrapS = tTex.wrapT = THREE.RepeatWrapping; tTex.repeat.set(7.5, 7.5);
  tTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshLambertMaterial({ map: tTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; floor.receiveShadow = true;
  Game.worldGroup.add(floor);

  // Dinding belakang + kiri (tinggi) dengan pita biru-kuning EDEKA.
  // Tidak ada dua permukaan yang sebidang (pita lebih rendah & lebih pendek
  // dari dinding, dinding tidak saling tumpang) — sebidang = kedip-kedip.
  Game.worldGroup.add(mP(new THREE.BoxGeometry(15.5, H, 0.5), wallMat, 0, H / 2, -7.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.5, H, 14.75), wallMat, -7.5, H / 2, 0.125));
  const bandTop = H - 0.04;
  Game.worldGroup.add(mP(new THREE.BoxGeometry(15.42, 0.9, 0.56), blue, 0, bandTop - 0.45, -7.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.56, 0.9, 14.6), blue, -7.5, bandTop - 0.45, 0.13));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(15.36, 0.12, 0.6), yellow, 0, bandTop - 0.96, -7.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.6, 0.12, 14.55), yellow, -7.5, bandTop - 0.96, 0.13));
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-7.5,0,-8), new THREE.Vector3(7.5,5,-7)), name:'wall-b'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-8,0,-7.5), new THREE.Vector3(-7,5,7.5)), name:'wall-l'});
  const logo = interiorSign('EDEKA', '#1d4fb8', '#ffd400', 3.4, 0.8);
  logo.position.set(0, bandTop - 0.45, -7.2); Game.worldGroup.add(logo);
  const obst = interiorSign('Obst & Gemüse', '#2e8b3d', '#ffffff', 3.2, 0.6);
  obst.rotation.y = Math.PI / 2; obst.position.set(-7.22, 2.6, 3); Game.worldGroup.add(obst);
  const kuehl = interiorSign('Fleisch & Kühlung', '#2a6fb0', '#ffffff', 3.4, 0.6);
  kuehl.position.set(5, 2.9, -7.22); Game.worldGroup.add(kuehl);

  // Dinding depan (selatan) & kanan (timur): setinggi lutut, celah pintu di timur z 1..3
  Game.worldGroup.add(mP(new THREE.BoxGeometry(14.6, K, 0.4), kneeMat, 0, K / 2, 7.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.4, K, 8.25), kneeMat, 7.5, K / 2, -3.125));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.4, K, 4.7), kneeMat, 7.5, K / 2, 5.35));
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-7.5,0,7.2), new THREE.Vector3(7.5,2,7.8)), name:'wall-f'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(7.2,0,-7.5), new THREE.Vector3(7.8,2,1)), name:'wall-r1'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(7.2,0,3), new THREE.Vector3(7.8,2,7.5)), name:'wall-r2'});
  // Bingkai pintu otomatis + papan AUSGANG
  for (const zz of [1, 3]) Game.worldGroup.add(mP(new THREE.BoxGeometry(0.22, 2.7, 0.22), lpMat(0x3a4048), 7.5, 1.35, zz));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.3, 0.3, 2.3), lpMat(0x3a4048), 7.5, 2.75, 2));
  const exit = interiorSign('AUSGANG', '#1f9d55', '#ffffff', 1.8, 0.42);
  exit.rotation.y = Math.PI / 2; exit.position.set(7.67, 2.75, 2); Game.worldGroup.add(exit);

  // Cahaya toko yang terang
  const pl = new THREE.PointLight(0xffffff, 1.2, 30);
  pl.position.set(0, 5, 0);
  Game.worldGroup.add(pl);

  if (!Game.itemsGroup) {
    Game.itemsGroup = new THREE.Group();
    Game.itemsGroup.name = 'itemsGroup';
    Game.scene.add(Game.itemsGroup);
  }

  const spawnQItem = (name, x, z, color, questTarget, symbol) => {
    const mesh = buildQuestItem(name, color);
    mesh.position.set(x, 0.026, z);
    mesh.name = name;
    mesh.userData = { isInteractable: true, questTarget: questTarget || 'quest_4', itemName: name };
    Game.itemsGroup.add(mesh);
    // Emoji billboard
    if (symbol) {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.font = '48px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(symbol, 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      spr.scale.set(0.6, 0.6, 1);
      spr.position.set(x, 1.0, z);
      Game.itemsGroup.add(spr);
      mesh.userData.labelSprite = spr;
    }
  };

  // Obst & Gemüse di dinding barat (rak hijau)
  const rack1 = createShelf(2, 2, 1, 0x44aa44); rack1.position.set(-6.2, 0, 4); rack1.rotation.y = Math.PI / 2; Game.worldGroup.add(rack1);
  const rack2 = createShelf(2, 2, 1, 0x44aa44); rack2.position.set(-6.2, 0, 1.8); rack2.rotation.y = Math.PI / 2; Game.worldGroup.add(rack2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-6.8,0,0.7), new THREE.Vector3(-5.6,2,5.1)), name:'obst'});
  // Kartoffeln & Salat (Quest 4) di depan rak Obst & Gemüse
  spawnQItem('kartoffeln', -4.95, 1.9, 0xc8a26a, 'quest_4', '🥔');
  spawnQItem('salat', -4.95, 4.1, 0x6cc04a, 'quest_4', '🥬');

  // Kühlregale di dinding utara (kanan belakang)
  const cool1 = createShelf(2, 2.6, 1, 0xeeeeee); cool1.position.set(6, 0, -6.3); Game.worldGroup.add(cool1);
  const cool2 = createShelf(2, 2.6, 1, 0xeeeeee); cool2.position.set(4, 0, -6.3); Game.worldGroup.add(cool2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(3,0,-6.8), new THREE.Vector3(7,3,-5.8)), name:'cool'});
  // Fleisch & Butter (Quest 4) di depan rak pendingin
  spawnQItem('fleisch', 5.3, -5.0, 0xcc4444, 'quest_4', '🥩');
  spawnQItem('butter', 3.3, -5.0, 0xf3d65a, 'quest_4', '🧈');

  // Tengah: 2 deret rak
  const cRack1 = createShelf(4, 1.8, 1); cRack1.position.set(-0.5, 0, -2); Game.worldGroup.add(cRack1);
  const cRack2 = createShelf(4, 1.8, 1); cRack2.position.set(-0.5, 0, 1); Game.worldGroup.add(cRack2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-2.5,0,-2.5), new THREE.Vector3(1.5,2,-1.5)), name:'center1'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-2.5,0,0.5), new THREE.Vector3(1.5,2,1.5)), name:'center2'});

  // Kasse tepat di samping pintu keluar (timur)
  const kasse = createKasse(); kasse.position.set(4.6, 0, 5); Game.worldGroup.add(kasse);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(3.6,0,4.5), new THREE.Vector3(5.6,1,5.5)), name:'kasse'});
  const zeitung = createShelf(1.2, 1.2, 0.5, 0xaa2222); zeitung.position.set(-3.5, 0, 6.7); Game.worldGroup.add(zeitung);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-4.1,0,6.45), new THREE.Vector3(-2.9,1.2,6.95)), name:'zeitung'});
}
// ═══════════════════════════════════════════════════════════════════
// 15.5  HAUS INTERIOR — 7 ruangan (3 Schlafzimmer, Küche, Wohnzimmer,
//       Badezimmer, Flur) untuk Stage 1
// ═══════════════════════════════════════════════════════════════════
//
// Tata letak (top-down, X horizontal, Z depth):
//
//   ┌──────────┬──────────┬──────────┐   z = -10
//   │ Schlaf 1 │ Schlaf 2 │ Schlaf 3 │
//   │  Lukas   │  Oma/Opa │  Tante   │
//   │ (-13..-4)│  (-3..6) │  (6..13) │
//   ├──────────┴──────────┴──────────┤   z = -3
//   │           FLUR (lorong)        │
//   ├──────────┬──────────┬──────────┤   z = 3
//   │  Küche   │ Wohnzim. │ Badezim. │
//   │ (-13..-2)│  (-2..8) │  (8..13) │
//   └──────────┴──────────┴──────────┘   z = 10  (pintu depan)
//
// Quest 1 items diletakkan di Küche:
//   • Pfanne          → di dalam Schrank
//   • Pfannenwender   → di dalam Schublade
//   • Gabel           → di dalam Schublade
//   • Messer          → di dalam Schublade
//   • Teller          → AUF dem Küchentisch
//   • Eier            → UNTER dem kleinen Tisch
//   • Wurst           → AUF dem Serviertisch

function buildHausInterior() {
  const lpMat = (c) => new THREE.MeshLambertMaterial({color:c, flatShading:true});

  // ── PALETTE ──
  const COL = {
    FLOOR_BED:   0xc9a880, // wood for bedrooms
    FLOOR_KITCH: 0xe8d8b8, // tile for kitchen
    FLOOR_LIV:   0xb89978, // dark wood living room
    FLOOR_BATH:  0xddeef0, // light blue tile
    FLOOR_FLUR:  0xc4a472, // hallway wood
    WALL_OUTER:  0xeae0d2, // outer walls
    WALL_INNER:  0xf2e8d8, // inner walls
    WOOD_DARK:   0x5a3a1f,
    WOOD_MED:    0x8a6a3a,
    WOOD_LIGHT:  0xc4956a,
    BED_FRAME:   0x6b4226,
    SHEETS:      0xe8e0d0,
    PILLOW:      0xfff5e8,
    BLANKET_L:   0x4a78aa,  // Lukas blanket — biru
    BLANKET_O:   0xaa4a4a,  // Oma blanket — merah
    BLANKET_T:   0x8a4aaa,  // Tante blanket — ungu
    FRIDGE:      0xf0f0f0,
    CABINET:     0xbb8855,
    DRAWER:      0x9a6b3a,
    STOVE:       0x444444,
    SINK:        0xcccccc,
    SOFA:        0x6a5a8a,
    TV:          0x222222,
    TOILET:      0xffffff,
    TUB:         0xeef5fa,
  };

  // Layout BIGGER (36x28) — ruangan luas agar Lukas leluasa bergerak
  const ROOMS = {
    schlaf_lukas: { x1:-18, x2:-6,  z1:-14, z2:-4,  floor:COL.FLOOR_BED,   label:'Lukas Schlafzimmer' },
    schlaf_oma:   { x1:-6,  x2:6,   z1:-14, z2:-4,  floor:COL.FLOOR_BED,   label:'Oma & Opa Schlafzimmer' },
    schlaf_tante: { x1:6,   x2:18,  z1:-14, z2:-4,  floor:COL.FLOOR_BED,   label:'Tante Schlafzimmer' },
    flur:         { x1:-18, x2:18,  z1:-4,  z2:4,   floor:COL.FLOOR_FLUR,  label:'Flur' },
    kueche:       { x1:-18, x2:-3,  z1:4,   z2:14,  floor:COL.FLOOR_KITCH, label:'Küche' },
    wohnzimmer:   { x1:-3,  x2:9,   z1:4,   z2:14,  floor:COL.FLOOR_LIV,   label:'Wohnzimmer' },
    badezimmer:   { x1:9,   x2:18,  z1:4,   z2:14,  floor:COL.FLOOR_BATH,  label:'Badezimmer' },
  };

  // ── 1. FLOORS per ruangan ──
  Object.values(ROOMS).forEach(r => {
    const w = r.x2 - r.x1, d = r.z2 - r.z1;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      lpMat(r.floor)
    );
    floor.rotation.x = -Math.PI/2;
    floor.position.set((r.x1+r.x2)/2, 0.02, (r.z1+r.z2)/2);
    floor.receiveShadow = true;
    Game.worldGroup.add(floor);
    World.walkables.push(floor);
  });

  // ── 2. CEILING (skip — pakai sky terbuka untuk isometric view) ──

  // ── HELPER: build a wall segment ──
  // wall(x1,z1,x2,z2) — wall from (x1,z1) to (x2,z2) with thickness 0.3, height 2.5
  const WALL_H = 2.5, WALL_T = 0.3;
  const wallMat = lpMat(COL.WALL_OUTER);
  const innerWallMat = lpMat(COL.WALL_INNER);

  const addWall = (x1, z1, x2, z2, mat = wallMat, doorGap = null) => {
    // Wall is axis-aligned. doorGap = {start, end} along the axis to leave open
    const isVertical = (x1 === x2);
    if (doorGap) {
      // Split wall into 2 segments around the gap
      if (isVertical) {
        if (z1 > z2) [z1, z2] = [z2, z1];
        if (doorGap.start > z1) addWall(x1, z1, x1, doorGap.start, mat);
        if (doorGap.end < z2)   addWall(x1, doorGap.end, x1, z2, mat);
      } else {
        if (x1 > x2) [x1, x2] = [x2, x1];
        if (doorGap.start > x1) addWall(x1, z1, doorGap.start, z1, mat);
        if (doorGap.end < x2)   addWall(doorGap.end, z1, x2, z1, mat);
      }
      return;
    }
    const w = Math.abs(x2 - x1) || WALL_T;
    const d = Math.abs(z2 - z1) || WALL_T;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const geo = new THREE.BoxGeometry(w, WALL_H, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, WALL_H/2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    Game.worldGroup.add(mesh);
    // Collider
    World.colliders.push({
      type: 'box',
      box: new THREE.Box3(
        new THREE.Vector3(cx - w/2, 0, cz - d/2),
        new THREE.Vector3(cx + w/2, WALL_H, cz + d/2),
      ),
      name: 'interior-wall',
    });
  };

  // ── 3. OUTER WALLS (zona 36×28) ──
  // North wall (z=-14) — solid
  addWall(-18, -14, 18, -14);
  // South wall (z=14) — PINTU DEPAN ada di Wohnzimmer (LEBAR x=1..5)
  addWall(-18, 14, 18, 14, wallMat, { start: 1, end: 5 });
  // West wall (x=-18) — solid
  addWall(-18, -14, -18, 14);
  // East wall (x=18) — solid
  addWall(18, -14, 18, 14);

  // ── 4. INNER WALLS — 1 pintu per kamar (kecuali Wohnzimmer 2 pintu) ──
  // Tembok antar kamar tidur — SOLID (tidak ada pintu)
  addWall(-6, -14, -6, -4, innerWallMat);   // Schlaf1 ↔ Schlaf2 solid
  addWall(6,  -14, 6,  -4, innerWallMat);   // Schlaf2 ↔ Schlaf3 solid

  // Tembok antara kamar tidur dan Flur (z=-4) — 1 pintu per kamar
  //   Schlaf Lukas door: x=-13..-11
  //   Schlaf Oma door:   x=-1..1
  //   Schlaf Tante door: x=11..13
  addWall(-18, -4, -13, -4, innerWallMat);
  addWall(-11, -4, -1,  -4, innerWallMat);
  addWall(1,   -4, 11,  -4, innerWallMat);
  addWall(13,  -4, 18,  -4, innerWallMat);

  // Tembok antara Flur dan ruangan depan (z=4) — 1 pintu per kamar
  //   Küche door:       x=-13..-11
  //   Wohnzimmer door:  x=2..4 (pintu UTARA — 1 dari 2 pintu Wohnzimmer)
  //   Badezimmer door:  x=12..14
  addWall(-18, 4, -13, 4, innerWallMat);
  addWall(-11, 4, 2,   4, innerWallMat);
  addWall(4,   4, 12,  4, innerWallMat);
  addWall(14,  4, 18,  4, innerWallMat);

  // Tembok antar ruangan depan — SOLID
  addWall(-3, 4, -3, 14, innerWallMat); // Küche ↔ Wohnzimmer
  addWall(9,  4, 9,  14, innerWallMat); // Wohnzimmer ↔ Badezimmer

  // ── 4b. VISIBLE DOOR FRAMES + open doors di setiap pintu ──
  const doorFrameMat = lpMat(COL.WOOD_DARK);
  const doorPanelMat = new THREE.MeshStandardMaterial({color: 0x7a4a2a, roughness: 0.7});

  // doorAt(x, z, axis) — axis 'x' = doorway parallel to X axis (wall along Z), axis 'z' inverse
  const addDoorFrame = (cx, cz, axis, isOpen = true) => {
    // axis 'x' means doorway opens N-S, wall runs E-W along x direction
    const isXWall = (axis === 'x'); // wall runs along X, gap along X → frame visible on X
    // Frame: 2 vertical posts + lintel
    const postH = WALL_H;
    const gapW = 2; // door width
    if (isXWall) {
      // posts at (cx-1, cz), (cx+1, cz)
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.18, postH, 0.4), doorFrameMat);
      postL.position.set(cx-1, postH/2, cz); postL.castShadow = true; Game.worldGroup.add(postL);
      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.18, postH, 0.4), doorFrameMat);
      postR.position.set(cx+1, postH/2, cz); postR.castShadow = true; Game.worldGroup.add(postR);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 0.4), doorFrameMat);
      lintel.position.set(cx, postH - 0.1, cz); Game.worldGroup.add(lintel);
      if (isOpen) {
        // Open door panel — rotated 70° around left post
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.1, 0.05), doorPanelMat);
        const grp = new THREE.Group();
        panel.position.set(0.95, 0, 0);
        grp.add(panel);
        grp.position.set(cx-1, 1.05, cz);
        grp.rotation.y = -1.1; // open angle
        Game.worldGroup.add(grp);
      }
    } else {
      // wall runs along Z, doorway gap is along Z (perpendicular to X axis through door center)
      const postT = new THREE.Mesh(new THREE.BoxGeometry(0.4, postH, 0.18), doorFrameMat);
      postT.position.set(cx, postH/2, cz-1); postT.castShadow = true; Game.worldGroup.add(postT);
      const postB = new THREE.Mesh(new THREE.BoxGeometry(0.4, postH, 0.18), doorFrameMat);
      postB.position.set(cx, postH/2, cz+1); postB.castShadow = true; Game.worldGroup.add(postB);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 2.3), doorFrameMat);
      lintel.position.set(cx, postH - 0.1, cz); Game.worldGroup.add(lintel);
      if (isOpen) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 1.85), doorPanelMat);
        const grp = new THREE.Group();
        panel.position.set(0, 0, 0.95);
        grp.add(panel);
        grp.position.set(cx, 1.05, cz-1);
        grp.rotation.y = -1.1;
        Game.worldGroup.add(grp);
      }
    }
  };

  // Pintu kamar tidur (TERBUKA)
  addDoorFrame(-12, -4, 'x'); // Lukas Schlafzimmer → Flur
  addDoorFrame(0,   -4, 'x'); // Oma Schlafzimmer → Flur
  addDoorFrame(12,  -4, 'x'); // Tante Schlafzimmer → Flur

  // Pintu ruangan depan → Flur
  addDoorFrame(-12, 4, 'x'); // Küche
  addDoorFrame(3,   4, 'x'); // Wohnzimmer (pintu UTARA)
  addDoorFrame(13,  4, 'x'); // Badezimmer

  // Pintu DEPAN rumah — DESAIN SAMA persis dengan pintu kamar tidur Lukas
  // (semuanya pakai doorFrameMat = COL.WOOD_DARK, tidak ada trim terang)
  // Posts di kedua tepi gap (x=1, x=5) + lintel di atas + swing panel
  {
    const frameMat = lpMat(COL.WOOD_DARK);
    // POSTS — dimensi sama dengan addDoorFrame bedroom (0.18 × WALL_H × 0.4)
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.18, WALL_H, 0.4), frameMat);
    postL.position.set(1, WALL_H/2, 14); postL.castShadow = true;
    Game.worldGroup.add(postL);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.18, WALL_H, 0.4), frameMat);
    postR.position.set(5, WALL_H/2, 14); postR.castShadow = true;
    Game.worldGroup.add(postR);
    // LINTEL — sama tinggi 0.25, sama warna gelap (matching bedroom)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.4), frameMat);
    lintel.position.set(3, WALL_H - 0.1, 14);
    lintel.castShadow = true;
    Game.worldGroup.add(lintel);
    // SWING PANEL — sama style dengan addDoorFrame bedroom (open angle -1.1 rad)
    const panelMat = new THREE.MeshStandardMaterial({color: 0x7a4a2a, roughness: 0.7});
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.1, 0.05), panelMat);
    const panelGroup = new THREE.Group();
    panel.position.set(1.85, 0, 0);  // pivot di postL
    panelGroup.add(panel);
    panelGroup.position.set(1, 1.05, 14);
    panelGroup.rotation.y = -1.1;  // swing terbuka
    Game.worldGroup.add(panelGroup);
  }

  // ── 5. ROOM LABELS dihilangkan sesuai permintaan ──

  // ═══════════════════════════════════════════════════════════════
  // FURNITURE BUILDERS
  // ═══════════════════════════════════════════════════════════════

  // ── BED ──
  const buildBed = (x, z, rotY, blanketCol) => {
    const grp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 3.4), lpMat(COL.BED_FRAME));
    frame.position.y = 0.2; frame.castShadow = true; grp.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 3.2), lpMat(COL.SHEETS));
    mattress.position.y = 0.55; mattress.castShadow = true; grp.add(mattress);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 2.0), lpMat(blanketCol));
    blanket.position.set(0, 0.72, 0.3); grp.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.6), lpMat(COL.PILLOW));
    pillow.position.set(0, 0.78, -1.2); grp.add(pillow);
    // Headboard
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 0.18), lpMat(COL.WOOD_DARK));
    headboard.position.set(0, 1.0, -1.7); grp.add(headboard);
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    World.colliders.push({
      type:'box',
      box: new THREE.Box3(new THREE.Vector3(x-1.1,0,z-1.8), new THREE.Vector3(x+1.1,1.2,z+1.8))
    });
    return grp;
  };

  // ── NIGHTSTAND ──
  const buildNightstand = (x, z) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), lpMat(COL.WOOD_MED));
    body.position.y = 0.35; body.castShadow = true; grp.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.8), lpMat(COL.WOOD_LIGHT));
    top.position.y = 0.73; grp.add(top);
    // Lamp
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,0.15,8), lpMat(0x444444));
    lampBase.position.set(0, 0.82, 0); grp.add(lampBase);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.25,8,1,true),
      new THREE.MeshStandardMaterial({color:0xffe8b0, emissive:0xffaa44, emissiveIntensity:0.4, side:THREE.DoubleSide}));
    lampShade.position.set(0, 1.05, 0); grp.add(lampShade);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({
      type:'box', box: new THREE.Box3(new THREE.Vector3(x-0.45,0,z-0.45), new THREE.Vector3(x+0.45,0.85,z+0.45))
    });
    return grp;
  };

  // ── WARDROBE ──
  const buildWardrobe = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.7), lpMat(COL.WOOD_MED));
    body.position.y = 1.2; body.castShadow = true; grp.add(body);
    // Doors
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.2, 0.05), lpMat(COL.WOOD_DARK));
    doorL.position.set(-0.55, 1.2, 0.38); grp.add(doorL);
    const doorR = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.2, 0.05), lpMat(COL.WOOD_DARK));
    doorR.position.set(0.55, 1.2, 0.38); grp.add(doorR);
    // Handles
    [-0.1, 0.1].forEach(hx => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), lpMat(0xddaa44));
      h.position.set(hx, 1.2, 0.43); grp.add(h);
    });
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    const cosR = Math.abs(Math.cos(rotY)), sinR = Math.abs(Math.sin(rotY));
    const halfW = (2.2*cosR + 0.7*sinR)/2;
    const halfD = (2.2*sinR + 0.7*cosR)/2;
    World.colliders.push({
      type:'box', box: new THREE.Box3(
        new THREE.Vector3(x-halfW,0,z-halfD), new THREE.Vector3(x+halfW,2.4,z+halfD))
    });
  };

  // ── BEDROOM: SCHREIBTISCH (study desk) ──
  const buildSchreibtisch = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    // Top
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.85), lpMat(COL.WOOD_LIGHT));
    top.position.y = 0.78; top.castShadow = true; grp.add(top);
    // Legs (4)
    [[-0.8,-0.35],[0.8,-0.35],[-0.8,0.35],[0.8,0.35]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.78,0.1), lpMat(COL.WOOD_DARK));
      leg.position.set(lx, 0.39, lz); grp.add(leg);
    });
    // Side drawer
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.7), lpMat(COL.WOOD_MED));
    drawer.position.set(0.6, 0.4, 0); drawer.castShadow = true; grp.add(drawer);
    const drawerFace = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.04), lpMat(0x7a5a2a));
    drawerFace.position.set(0.6, 0.5, 0.36); grp.add(drawerFace);
    const drawerHandle = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), lpMat(0xddaa44));
    drawerHandle.position.set(0.6, 0.5, 0.4); grp.add(drawerHandle);

    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.95,0,z-0.5), new THREE.Vector3(x+0.95,0.85,z+0.5))});
    return { x, y: 0.82, z }; // top surface for items
  };

  // ── BEDROOM: STUHL (chair) ──
  const buildStuhl = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), lpMat(COL.WOOD_MED));
    seat.position.y = 0.45; seat.castShadow = true; grp.add(seat);
    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.08), lpMat(COL.WOOD_MED));
    back.position.set(0, 0.78, -0.23); grp.add(back);
    // Legs
    [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.45,0.06), lpMat(COL.WOOD_DARK));
      leg.position.set(lx, 0.22, lz); grp.add(leg);
    });
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    World.colliders.push({type:'cylinder', x, z, radius:0.35});
  };

  // ── DESK CLUTTER: books, pencil holder ──
  const buildBook = (x, y, z, color, rotY = 0) => {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.24), lpMat(color));
    book.position.set(x, y, z);
    book.rotation.y = rotY;
    book.castShadow = true;
    Game.worldGroup.add(book);
  };

  const buildPencilHolder = (x, y, z) => {
    const grp = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.18,10), lpMat(0x3a5a8a));
    cup.position.y = 0.09; grp.add(cup);
    // 4 pencils/pens sticking out
    const colors = [0xffcc44, 0x44aaff, 0xff5544, 0x222222];
    colors.forEach((c, i) => {
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), lpMat(c));
      pen.position.set(Math.cos(i*1.5)*0.04, 0.22, Math.sin(i*1.5)*0.04);
      pen.rotation.x = (Math.random()-0.5)*0.2;
      pen.rotation.z = (Math.random()-0.5)*0.2;
      grp.add(pen);
    });
    grp.position.set(x, y, z);
    Game.worldGroup.add(grp);
  };

  // ═══════════════════════════════════════════════════════════════
  // COZY BEDROOM DECOR HELPERS (untuk kamar Lukas diorama style)
  // ═══════════════════════════════════════════════════════════════

  // ── WALL-MOUNTED BOOKSHELF dengan 4 cubbies + buku merah/hijau + plant ──
  const buildWallBookshelf = (cx, cz, rotY = 0) => {
    const grp = new THREE.Group();
    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.3, 0.35),
      lpMat(COL.WOOD_LIGHT)
    );
    body.position.y = 1.15; body.castShadow = true; grp.add(body);
    // Back panel sedikit lebih gelap
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 2.2, 0.03),
      lpMat(COL.WOOD_DARK)
    );
    back.position.set(0, 1.15, -0.16); grp.add(back);
    // 5 horizontal shelf dividers → 4 cubbies
    for (let i = 0; i <= 4; i++) {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(0.94, 0.04, 0.32),
        lpMat(COL.WOOD_DARK)
      );
      shelf.position.set(0, 0.1 + i * 0.55, 0);
      grp.add(shelf);
    }
    // Books (merah & hijau) di 3 cubbies bawah; pot tanaman di cubby atas
    const bookColors = [0xcc4444, 0x44aa55, 0xcc4444];
    for (let cubby = 0; cubby < 3; cubby++) {
      const cy = 0.4 + cubby * 0.55;
      for (let b = 0; b < 4; b++) {
        const bookH = 0.32 + (b % 2) * 0.05;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, bookH, 0.2),
          lpMat(b % 2 === 0 ? 0xcc4444 : 0x44aa55)
        );
        book.position.set(-0.32 + b * 0.16, cy + bookH/2 - 0.15, 0);
        book.rotation.z = (b - 1.5) * 0.05; // sedikit miring
        grp.add(book);
      }
    }
    // Pot tanaman di cubby paling atas (cubby 4)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.1, 0.18, 8),
      lpMat(0xb86a3a)
    );
    pot.position.set(0, 2.05, 0); grp.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      lpMat(0x44aa55)
    );
    leaves.position.set(0, 2.28, 0); leaves.scale.y = 1.2; grp.add(leaves);
    // Daun extra
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.18, 5),
        lpMat(0x55bb66)
      );
      const a = (i / 4) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.13, 2.35, Math.sin(a) * 0.13);
      leaf.rotation.x = 0.4 * Math.sin(a);
      leaf.rotation.z = 0.4 * Math.cos(a);
      grp.add(leaf);
    }

    grp.position.set(cx, 0, cz);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    const cR = Math.abs(Math.cos(rotY)), sR = Math.abs(Math.sin(rotY));
    const halfW = (1.0*cR + 0.35*sR)/2;
    const halfD = (1.0*sR + 0.35*cR)/2;
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(cx-halfW, 0, cz-halfD), new THREE.Vector3(cx+halfW, 2.5, cz+halfD))});
  };

  // ── FLOATING WALL SHELF dengan succulent ──
  const buildFloatingShelf = (cx, cy, cz, rotY = 0) => {
    const grp = new THREE.Group();
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.06, 0.22),
      lpMat(COL.WOOD_LIGHT)
    );
    shelf.castShadow = true; grp.add(shelf);
    // Pot kecil
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.06, 0.1, 6),
      lpMat(0xddaa88)
    );
    pot.position.y = 0.08; grp.add(pot);
    // Succulent cluster (5 daun + center)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.14, 5),
        lpMat(0x66bb55)
      );
      leaf.position.set(Math.cos(a) * 0.055, 0.18, Math.sin(a) * 0.055);
      leaf.rotation.x = 0.3;
      leaf.rotation.z = -0.3 * Math.cos(a);
      grp.add(leaf);
    }
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      lpMat(0x77cc66)
    );
    top.position.y = 0.22; grp.add(top);

    grp.position.set(cx, cy, cz);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
  };

  // ── PICTURE FRAME (white frame, green minimalist landscape art) ──
  const buildPictureFrame = (cx, cy, cz, rotY = 0, w = 0.5, h = 0.6) => {
    const grp = new THREE.Group();
    const frameMat = lpMat(0xfafafa);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), frameMat);
    grp.add(frame);
    // Generated art canvas — minimalist green landscape
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    // Sky cream
    ctx.fillStyle = '#f8f0d8';
    ctx.fillRect(0, 0, 128, 70);
    // Sun (pale)
    ctx.fillStyle = '#fae9b8';
    ctx.beginPath(); ctx.arc(95, 35, 12, 0, Math.PI*2); ctx.fill();
    // Background hills
    ctx.fillStyle = '#88cc77';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.quadraticCurveTo(32, 65, 64, 75);
    ctx.quadraticCurveTo(96, 85, 128, 70);
    ctx.lineTo(128, 128); ctx.lineTo(0, 128);
    ctx.fill();
    // Foreground hills
    ctx.fillStyle = '#5aa84a';
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.quadraticCurveTo(48, 90, 80, 98);
    ctx.quadraticCurveTo(110, 105, 128, 100);
    ctx.lineTo(128, 128); ctx.lineTo(0, 128);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    art.position.z = 0.035;
    grp.add(art);

    grp.position.set(cx, cy, cz);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
  };

  // ── WHITE RUG (soft fabric) ──
  const buildWhiteRug = (cx, cz, w = 1.5, d = 1.0) => {
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0xfaf5e8, roughness: 0.95, metalness: 0
      })
    );
    rug.rotation.x = -Math.PI/2;
    rug.position.set(cx, 0.04, cz);
    rug.receiveShadow = true;
    Game.worldGroup.add(rug);
    // Outer border (slightly darker)
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.12, d + 0.12),
      new THREE.MeshStandardMaterial({
        color: 0xe8dec8, roughness: 0.95
      })
    );
    border.rotation.x = -Math.PI/2;
    border.position.set(cx, 0.035, cz);
    Game.worldGroup.add(border);
  };

  // ── YELLOW TASK LAMP (flexible-neck) ──
  const buildTaskLamp = (cx, cy, cz) => {
    const grp = new THREE.Group();
    // Heavy circular base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.04, 14),
      lpMat(0xbbbbbb)
    );
    grp.add(base);
    // Flexible neck (3 articulated segments)
    const segMat = lpMat(0xbbbbbb);
    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), segMat);
    seg1.position.set(0, 0.12, 0);
    seg1.rotation.z = 0.2;
    grp.add(seg1);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8), segMat);
    seg2.position.set(0.06, 0.28, 0);
    seg2.rotation.z = -0.4;
    grp.add(seg2);
    const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), segMat);
    seg3.position.set(0.02, 0.42, 0);
    seg3.rotation.z = 0.5;
    grp.add(seg3);
    // Yellow lamp shade (cone)
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xffd44a, emissive: 0xffaa22, emissiveIntensity: 0.5,
      side: THREE.DoubleSide, roughness: 0.5
    });
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.2, 10, 1, true),
      shadeMat
    );
    shade.position.set(0.09, 0.55, 0);
    shade.rotation.z = -0.7;
    grp.add(shade);
    // Cord
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.45, 4),
      lpMat(0x222222)
    );
    cord.position.set(-0.08, 0.04, -0.05);
    cord.rotation.x = Math.PI/2.5;
    grp.add(cord);

    grp.position.set(cx, cy, cz);
    Game.worldGroup.add(grp);
  };

  // ── VENETIAN BLINDS (window with yellow horizontal slats) ──
  const buildVenetianBlinds = (cx, cz, rotY = 0, w = 1.4, h = 1.0) => {
    const grp = new THREE.Group();
    const frameMat = lpMat(0x6a4a2a);
    // Outer frame
    const ft = new THREE.Mesh(new THREE.BoxGeometry(w+0.16, 0.1, 0.12), frameMat);
    ft.position.y = h/2+0.05; grp.add(ft);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(w+0.16, 0.1, 0.12), frameMat);
    fb.position.y = -h/2-0.05; grp.add(fb);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.1, h+0.2, 0.12), frameMat);
    fl.position.x = -w/2-0.05; grp.add(fl);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.1, h+0.2, 0.12), frameMat);
    fr.position.x = w/2+0.05; grp.add(fr);
    // Window glass (subtle behind blinds)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe2f5, emissive: 0xa0d0e8, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.55
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), glassMat);
    grp.add(glass);
    // Yellow horizontal venetian slats
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0xffd860, roughness: 0.4, metalness: 0.08
    });
    const slatCount = Math.floor(h / 0.085);
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.06, 0.045, 0.045),
        slatMat
      );
      slat.position.set(0, h/2 - 0.07 - i * 0.085, 0.065);
      slat.rotation.x = 0.18; // slight tilt to show 3D effect
      grp.add(slat);
    }
    // Pull cord at right side
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4),
      lpMat(0xeeeeee)
    );
    cord.position.set(w/2 - 0.12, -h/2 + 0.05, 0.1);
    grp.add(cord);
    const cordBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 6, 6),
      lpMat(0xddaa44)
    );
    cordBall.position.set(w/2 - 0.12, -h/2 - 0.12, 0.1);
    grp.add(cordBall);

    grp.position.set(cx, 1.5, cz);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
  };

  // ── KITCHEN: KÜCHENSCHRANK (cabinet) — for Pfanne ──
  const buildSchrank = (x, z) => {
    const grp = buildOpenStorage(1.6, 1.8, 0.7, COL.CABINET, 1);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box:new THREE.Box3(
      new THREE.Vector3(x-0.8,0,z-0.35), new THREE.Vector3(x+0.8,1.8,z+0.35))});
    return {x, y:1.006, z};
  };

  // ── KITCHEN: SCHUBLADE (drawer block) — for Besteck (Pfannenwender + Gabel + Messer) ──
  const buildSchublade = (x, z) => {
    const grp = buildOpenStorage(1.8, 0.95, 0.7, COL.DRAWER, 0.55);
    // Low drawer front keeps the cutlery visible from the isometric camera.
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 0.045), lpMat(COL.DRAWER));
    front.position.set(0, 0.565, 0.32); grp.add(front);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.045), lpMat(0xddaa44));
    handle.position.set(0, 0.565, 0.365); grp.add(handle);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box:new THREE.Box3(
      new THREE.Vector3(x-0.9,0,z-0.35), new THREE.Vector3(x+0.9,0.95,z+0.35))});
    return {x, y:0.556, z};
  };

  // ── KITCHEN: KÜCHENTISCH (table) — Teller AUF ──
  const buildKuechentisch = (x, z) => {
    const grp = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), lpMat(COL.WOOD_LIGHT));
    top.position.y = 0.85; top.castShadow = true; grp.add(top);
    [[-1.1,-0.6],[1.1,-0.6],[-1.1,0.6],[1.1,0.6]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.85,0.12), lpMat(COL.WOOD_DARK));
      leg.position.set(lx,0.42,lz); grp.add(leg);
    });
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-1.2,0,z-0.7), new THREE.Vector3(x+1.2,0.95,z+0.7))});
    return { x, z, y: 0.906 }; // tabletop upper face + clearance
  };

  // ── KITCHEN: KLEINER TISCH (small side table) — Eier UNTER ──
  const buildKleinerTisch = (x, z) => {
    const grp = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.8), lpMat(COL.WOOD_MED));
    top.position.y = 0.7; top.castShadow = true; grp.add(top);
    [[-0.4,-0.3],[0.4,-0.3],[-0.4,0.3],[0.4,0.3]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.7,0.08), lpMat(COL.WOOD_DARK));
      leg.position.set(lx,0.35,lz); grp.add(leg);
    });
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.5,0,z-0.4), new THREE.Vector3(x+0.5,0.78,z+0.4))});
    return { x, z, y: 0.026 }; // UNDER the table — low Y
  };

  // ── KITCHEN: KÜHLSCHRANK (fridge) — Wurst IN ──
  const buildKuehlschrank = (x, z) => {
    const grp = buildOpenStorage(1, 2.2, 0.8, COL.FRIDGE, 1.2);
    const freezer = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.48, 0.06), lpMat(COL.FRIDGE));
    freezer.position.set(0, 1.9, 0.385); grp.add(freezer);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.05), lpMat(0xaaaaaa));
    handle.position.set(0.32, 1.9, 0.435); grp.add(handle);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box:new THREE.Box3(
      new THREE.Vector3(x-0.5,0,z-0.4), new THREE.Vector3(x+0.5,2.2,z+0.4))});
    return {x, y:1.206, z};
  };

  // ── KITCHEN: STOVE (decorative) ──
  const buildStove = (x, z) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.7), lpMat(COL.STOVE));
    body.position.y = 0.45; body.castShadow = true; grp.add(body);
    const cooktop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.65), lpMat(0x222222));
    cooktop.position.y = 0.93; grp.add(cooktop);
    // 4 burners
    [[-0.3,-0.18],[0.3,-0.18],[-0.3,0.18],[0.3,0.18]].forEach(([bx,bz]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.03,12), lpMat(0x111111));
      b.position.set(bx, 0.95, bz); grp.add(b);
    });
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.65,0,z-0.4), new THREE.Vector3(x+0.65,1.0,z+0.4))});
  };

  // ── KITCHEN: SINK ──
  const buildSink = (x, z) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.7), lpMat(COL.CABINET));
    body.position.y = 0.45; body.castShadow = true; grp.add(body);
    const basin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.55), lpMat(COL.SINK));
    basin.position.y = 0.92; grp.add(basin);
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.4,6), lpMat(0xaaaaaa));
    faucet.position.set(0, 1.15, -0.2); grp.add(faucet);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.25,6), lpMat(0xaaaaaa));
    spout.position.set(0, 1.3, -0.08); spout.rotation.x = Math.PI/2; grp.add(spout);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.75,0,z-0.4), new THREE.Vector3(x+0.75,1.0,z+0.4))});
  };

  // ── LIVING ROOM: SOFA ──
  const buildSofa = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 1.2), lpMat(COL.SOFA));
    seat.position.y = 0.4; seat.castShadow = true; grp.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.3), lpMat(COL.SOFA));
    back.position.set(0, 0.85, -0.45); grp.add(back);
    [-1.35, 1.35].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 1.2), lpMat(COL.SOFA));
      arm.position.set(ax, 0.55, 0); grp.add(arm);
    });
    // Cushions
    [-1.0, 0, 1.0].forEach(cx => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 1.0), lpMat(0x8474a4));
      c.position.set(cx, 0.74, 0.05); grp.add(c);
    });
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    const cosR = Math.abs(Math.cos(rotY)), sinR = Math.abs(Math.sin(rotY));
    const halfW = (3.0*cosR + 1.5*sinR)/2;
    const halfD = (3.0*sinR + 1.5*cosR)/2;
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-halfW,0,z-halfD), new THREE.Vector3(x+halfW,1.0,z+halfD))});
  };

  // ── LIVING ROOM: TV STAND ──
  const buildTVStand = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 0.5), lpMat(COL.WOOD_DARK));
    stand.position.y = 0.27; stand.castShadow = true; grp.add(stand);
    const tv = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.1), lpMat(COL.TV));
    tv.position.set(0, 1.3, 0); grp.add(tv);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.05, 0.02),
      new THREE.MeshStandardMaterial({color:0x224488, emissive:0x4488cc, emissiveIntensity:0.35}));
    screen.position.set(0, 1.3, 0.06); grp.add(screen);
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    // Rough collider — TV is roughly 2.5x0.5 (rotation-aware via abs cos/sin)
    const cR = Math.abs(Math.cos(rotY)), sR = Math.abs(Math.sin(rotY));
    const halfW = (2.5*cR + 0.5*sR)/2;
    const halfD = (2.5*sR + 0.5*cR)/2;
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-halfW,0,z-halfD), new THREE.Vector3(x+halfW,2.0,z+halfD))});
  };

  // ── LIVING ROOM: COFFEE TABLE ──
  const buildCoffeeTable = (x, z) => {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), lpMat(COL.WOOD_LIGHT));
    top.position.set(x, 0.45, z); top.castShadow = true;
    Game.worldGroup.add(top);
    [[-0.7,-0.4],[0.7,-0.4],[-0.7,0.4],[0.7,0.4]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.45,0.08), lpMat(COL.WOOD_DARK));
      leg.position.set(x+lx, 0.22, z+lz);
      Game.worldGroup.add(leg);
    });
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.8,0,z-0.45), new THREE.Vector3(x+0.8,0.5,z+0.45))});
  };

  // ── LIVING ROOM: CARPET ──
  const buildCarpet = (x, z, w, d, col) => {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lpMat(col));
    c.rotation.x = -Math.PI/2;
    c.position.set(x, 0.03, z);
    Game.worldGroup.add(c);
  };

  // ── BATHROOM: TOILET ──
  const buildToilet = (x, z, rotY=0) => {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.7), lpMat(COL.TOILET));
    base.position.y = 0.22; grp.add(base);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.08,16), lpMat(COL.TOILET));
    seat.position.set(0, 0.5, 0.05); grp.add(seat);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.2), lpMat(COL.TOILET));
    tank.position.set(0, 0.75, -0.35); grp.add(tank);
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.35,0,z-0.5), new THREE.Vector3(x+0.35,1.1,z+0.5))});
  };

  // ── BATHROOM: BATHTUB ──
  const buildBathtub = (x, z) => {
    const grp = new THREE.Group();
    const tub = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 0.9), lpMat(COL.TUB));
    tub.position.y = 0.27; grp.add(tub);
    // inner basin (darker)
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.05, 0.78), lpMat(0xc8dde8));
    inner.position.y = 0.55; grp.add(inner);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-1.05,0,z-0.5), new THREE.Vector3(x+1.05,0.6,z+0.5))});
  };

  // ── BATHROOM: WASHBASIN ──
  const buildWashbasin = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,0.85,8), lpMat(COL.TOILET));
    pedestal.position.y = 0.42; grp.add(pedestal);
    const basin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.5), lpMat(COL.TOILET));
    basin.position.y = 0.92; grp.add(basin);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.04),
      new THREE.MeshStandardMaterial({color:0xddeeff, emissive:0x88aacc, emissiveIntensity:0.4}));
    mirror.position.set(0, 1.65, -0.25); grp.add(mirror);
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.4,0,z-0.4), new THREE.Vector3(x+0.4,1.0,z+0.4))});
  };

  // ── WIRED PHONE (wall-mounted) ──
  // Param rotY: hadap mana phone (0=hadap +Z south, PI=hadap -Z north).
  const buildWiredPhone = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    // Backplate (mount on wall)
    const backplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.85, 0.08),
      lpMat(0x2a2a2a)
    );
    backplate.position.y = 1.3;
    backplate.castShadow = true;
    grp.add(backplate);
    // Number-pad area (yellow)
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.4, 0.06),
      lpMat(0xeebb33)
    );
    pad.position.set(0, 1.15, -0.08);
    grp.add(pad);
    // 12 dots for numpad
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const dot = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.06, 0.02),
          lpMat(0x222222)
        );
        dot.position.set(-0.14 + col * 0.14, 1.27 - row * 0.09, -0.12);
        grp.add(dot);
      }
    }
    // Receiver (handset, red)
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.13, 0.18),
      lpMat(0xcc2222)
    );
    receiver.position.set(0, 1.6, -0.05);
    grp.add(receiver);
    const earpiece = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8),
      lpMat(0xaa1818)
    );
    earpiece.position.set(-0.18, 1.6, -0.05);
    earpiece.rotation.x = Math.PI/2;
    grp.add(earpiece);
    const mouthpiece = earpiece.clone();
    mouthpiece.position.x = 0.18;
    grp.add(mouthpiece);
    // Spiral cord (toroidal coils)
    for (let i = 0; i < 5; i++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.05, 0.012, 6, 10),
        lpMat(0x111111)
      );
      coil.position.set(0.18, 1.4 - i * 0.1, 0);
      coil.rotation.x = Math.PI/2;
      grp.add(coil);
    }

    // Glowing ring di lantai sebagai trigger indicator
    const triggerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 24),
      new THREE.MeshStandardMaterial({
        color: 0x44aaee, emissive: 0x2266aa, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.55, side: THREE.DoubleSide
      })
    );
    triggerRing.rotation.x = -Math.PI/2;
    triggerRing.position.set(0, 0.06, 0.8);  // ring di depan phone
    grp.add(triggerRing);

    // Floating "📞" sprite above phone
    const phoneCanvas = document.createElement('canvas');
    phoneCanvas.width = 64; phoneCanvas.height = 64;
    const phoneCtx = phoneCanvas.getContext('2d');
    phoneCtx.font = '48px serif';
    phoneCtx.textAlign = 'center';
    phoneCtx.textBaseline = 'middle';
    phoneCtx.fillText('📞', 32, 32);
    const phoneTex = new THREE.CanvasTexture(phoneCanvas);
    const phoneSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: phoneTex, transparent: true, depthTest: false })
    );
    phoneSprite.scale.set(0.6, 0.6, 1);
    phoneSprite.position.set(0, 2.1, 0);
    phoneSprite.renderOrder = 999;
    grp.add(phoneSprite);
    grp.userData.phoneSprite = phoneSprite;

    // Animate the ring pulse (registered globally via World._updateAmbient hook)
    grp.userData.tickRing = (t) => {
      const s = 1 + Math.sin(t * 3) * 0.15;
      triggerRing.scale.set(s, s, 1);
      triggerRing.material.opacity = 0.4 + Math.sin(t * 3) * 0.25;
    };

    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);

    // Save trigger zone info for quest.js to read
    if (!window.__sceneTriggers__) window.__sceneTriggers__ = {};
    window.__sceneTriggers__.wired_phone = {
      x: x,
      z: z,
      radius: 2.0,         // trigger when player within 2m
      mesh: grp,
      triggered: false,
    };
    // Animate
    const prevUpdate = World._updateAmbient;
    World._updateAmbient = (delta, t) => {
      if (prevUpdate) prevUpdate(delta, t);
      if (grp.userData.tickRing) grp.userData.tickRing(t);
    };
    return grp;
  };
  // Phone di Flur NORTH wall, SEBELAH KIRI (west) pintu kamar Oma (door gap x=-1..1)
  // Position x=-2 (tepat di sebelah kiri pintu kamar #2)
  // Rotation 0 → hadap SOUTH (+Z), terlihat dari Flur.
  buildWiredPhone(-2, -3.85, 0);

  // ── BATHROOM: SHOWER (visible glass stall) ──
  const buildShower = (x, z, rotY = 0) => {
    const grp = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), lpMat(0xa8c5d0));
    tray.position.y = 0.04; grp.add(tray);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.06), lpMat(0xc8dde8));
    backWall.position.set(0, 1.04, -0.7); grp.add(backWall);
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 1.4), lpMat(0xc8dde8));
    sideWall.position.set(-0.7, 1.04, 0); grp.add(sideWall);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xddeef0, transparent: true, opacity: 0.35,
      roughness: 0.05, metalness: 0.0
    });
    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.04), glassMat);
    glassFront.position.set(0, 1.0, 0.7); grp.add(glassFront);
    const frameMat = lpMat(0x888888);
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.08), frameMat);
    fTop.position.set(0, 1.97, 0.7); grp.add(fTop);
    const fBot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.08), frameMat);
    fBot.position.set(0, 0.08, 0.7); grp.add(fBot);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.06,8), lpMat(0xcccccc));
    head.rotation.x = Math.PI/2;
    head.position.set(0, 1.8, -0.6); grp.add(head);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.45,6), lpMat(0xaaaaaa));
    pipe.position.set(0, 1.6, -0.65); grp.add(pipe);
    grp.position.set(x, 0, z);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
    World.colliders.push({type:'box', box: new THREE.Box3(
      new THREE.Vector3(x-0.75,0,z-0.75), new THREE.Vector3(x+0.75,2.0,z+0.75))});
  };

  // ── PAINTING (wall art for Flur) ──
  const buildPainting = (cx, cz, axis, w = 1.2, h = 0.85, palette = ['#b35c44','#f4c430','#3a5a8a']) => {
    // axis 'x' = painting hangs on a wall running along X (so painting faces +Z or -Z direction)
    // Canvas with simple abstract art
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = palette[0]; ctx.fillRect(0,0,256,192);
    ctx.fillStyle = palette[1]; ctx.fillRect(30, 40, 80, 100);
    ctx.fillStyle = palette[2]; ctx.beginPath(); ctx.arc(180, 100, 50, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 160, 256, 8);
    const tex = new THREE.CanvasTexture(canvas);
    const artMat = new THREE.MeshBasicMaterial({ map: tex });
    const frameMat = lpMat(0x3a2a1a);
    const grp = new THREE.Group();
    if (axis === 'x') {
      // Frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w+0.1, h+0.1, 0.06), frameMat);
      grp.add(frame);
      // Art
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
      art.position.z = 0.04; grp.add(art);
    } else {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, h+0.1, w+0.1), frameMat);
      grp.add(frame);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
      art.rotation.y = Math.PI/2;
      art.position.x = 0.04; grp.add(art);
    }
    grp.position.set(cx, 1.4, cz);
    Game.worldGroup.add(grp);
  };

  // ── WINDOW (rectangular cutout look) on outer walls ──
  const buildWindow = (cx, cz, axis, w = 1.4, h = 1.0) => {
    // Window = light blue glass + dark frame, mounted on wall
    const grp = new THREE.Group();
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe2f5, emissive: 0xa0d0e8, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.85, roughness: 0.1
    });
    const frameMat = lpMat(0x6a4a2a);
    if (axis === 'x') {
      // Window on a wall running along X (faces ±Z)
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), glassMat);
      grp.add(glass);
      // Cross frame
      const fH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.1), frameMat);
      fH.position.y = 0; grp.add(fH);
      const fV = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.1), frameMat);
      fV.position.x = 0; grp.add(fV);
      // Outer frame
      const ft = new THREE.Mesh(new THREE.BoxGeometry(w+0.16, 0.1, 0.12), frameMat); ft.position.y = h/2+0.05; grp.add(ft);
      const fb = new THREE.Mesh(new THREE.BoxGeometry(w+0.16, 0.1, 0.12), frameMat); fb.position.y = -h/2-0.05; grp.add(fb);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.1, h+0.2, 0.12), frameMat); fl.position.x = -w/2-0.05; grp.add(fl);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.1, h+0.2, 0.12), frameMat); fr.position.x = w/2+0.05; grp.add(fr);
    } else {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), glassMat);
      grp.add(glass);
      const fH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, w), frameMat); grp.add(fH);
      const fV = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.06), frameMat); grp.add(fV);
      const ft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, w+0.16), frameMat); ft.position.y = h/2+0.05; grp.add(ft);
      const fb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, w+0.16), frameMat); fb.position.y = -h/2-0.05; grp.add(fb);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.12, h+0.2, 0.1), frameMat); fl.position.z = -w/2-0.05; grp.add(fl);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.12, h+0.2, 0.1), frameMat); fr.position.z = w/2+0.05; grp.add(fr);
    }
    grp.position.set(cx, 1.5, cz);
    Game.worldGroup.add(grp);
  };

  // ═══════════════════════════════════════════════════════════════
  // HOMEY DECORATIONS — supaya rumah terasa lebih "hidup" tidak kaku
  // ═══════════════════════════════════════════════════════════════

  // ── WALL CLOCK (jam dinding bundar) ──
  const buildWallClock = (cx, cy, cz, rotY = 0) => {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16),
      lpMat(0xfafafa)
    );
    ring.rotation.x = Math.PI/2;
    grp.add(ring);
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16),
      lpMat(0xeeeeee)
    );
    face.rotation.x = Math.PI/2;
    face.position.z = 0.025;
    grp.add(face);
    // 4 hour markers (12, 3, 6, 9)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.01), lpMat(0x222222));
      m.position.set(Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.05);
      grp.add(m);
    }
    // Hour hand (pointing ~10 o'clock)
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.01), lpMat(0x222222));
    hour.position.set(-0.03, 0.05, 0.06);
    hour.rotation.z = 0.5;
    grp.add(hour);
    // Minute hand (pointing ~2 o'clock)
    const min = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.17, 0.01), lpMat(0x444444));
    min.position.set(0.04, 0.07, 0.06);
    min.rotation.z = -0.4;
    grp.add(min);
    // Center dot (red)
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), lpMat(0xcc4444));
    dot.position.z = 0.07;
    grp.add(dot);
    grp.position.set(cx, cy, cz);
    grp.rotation.y = rotY;
    Game.worldGroup.add(grp);
  };

  // ── CURTAIN (fabric drape next to window) ──
  const buildCurtain = (cx, cz, axis = 'x', sideOffset = 0.7, col = 0xbf6577) => {
    const curtainMat = lpMat(col);
    const w = axis === 'x' ? 0.35 : 0.05;
    const d = axis === 'x' ? 0.05 : 0.35;
    const drape = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, d), curtainMat);
    if (axis === 'x') {
      drape.position.set(cx + sideOffset, 1.85, cz);
    } else {
      drape.position.set(cx, 1.85, cz + sideOffset);
    }
    Game.worldGroup.add(drape);
  };

  // ── STANDING PHOTO FRAME (small framed photo on table) ──
  const buildStandingPhoto = (cx, y, cz, col = 0xff88aa) => {
    const grp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.025), lpMat(0xfafafa));
    grp.add(frame);
    const photo = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.005), lpMat(col));
    photo.position.z = 0.015;
    grp.add(photo);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), lpMat(0xcccccc));
    stand.position.set(0, -0.05, -0.07);
    stand.rotation.x = 0.3;
    grp.add(stand);
    grp.position.set(cx, y + 0.11, cz);
    Game.worldGroup.add(grp);
  };

  // ── FLOOR RUNNER (long narrow rug for Flur) ──
  const buildFloorRunner = (cx, cz, length = 8, width = 1.2, col = 0x884444) => {
    // Outer border
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.15, length + 0.15),
      new THREE.MeshStandardMaterial({ color: (col * 0.7) | 0, roughness: 0.95 })
    );
    border.rotation.x = -Math.PI/2;
    border.position.set(cx, 0.02, cz);
    Game.worldGroup.add(border);
    // Inner rug
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 })
    );
    rug.rotation.x = -Math.PI/2;
    rug.position.set(cx, 0.025, cz);
    Game.worldGroup.add(rug);
  };

  // ═══════════════════════════════════════════════════════════════
  // PLACE FURNITURE
  // ═══════════════════════════════════════════════════════════════

  // Helper untuk setup kamar tidur (semua kamar punya layout serupa, beda warna)
  const buildBedroomSet = (cfg) => {
    // cfg: { x1, x2, z1, z2, blanketCol, deskAccent, plantSide }
    const { x1, x2, z1, z2, blanketCol, deskAccent } = cfg;
    const cx = (x1 + x2) / 2;
    // Kasur di sisi BARAT/dalam (x1 + 3)
    buildBed(x1 + 3, z1 + 5, 0, blanketCol);
    // Nightstand di samping kasur
    buildNightstand(x1 + 5, z1 + 5);
    // Lemari di tembok utara, pojok kanan
    if (x2 - 3 === 3 && z1 + 1.5 === -12.5) {
      const wardrobe = buildOpenStorage(1.6, 2.2, 0.8, COL.WOOD_DARK, 1.0);
      wardrobe.position.set(3, 0, -12.5);
      Game.worldGroup.add(wardrobe);
      World.colliders.push({type:'box',box:new THREE.Box3(new THREE.Vector3(2.2,0,-12.9),new THREE.Vector3(3.8,2.2,-12.1))});
    } else buildWardrobe(x2 - 3, z1 + 1.5, 0);
    // Meja belajar + kursi di sebelah lemari
    const deskAnchor = buildSchreibtisch(x2 - 6, z1 + 1.5, 0);
    buildStuhl(x2 - 6, z1 + 3.2, Math.PI);
    // Buku-buku berserakan di atas meja (warna sesuai accent kamar)
    buildBook(deskAnchor.x - 0.5, deskAnchor.y, deskAnchor.z + 0.15, deskAccent[0], 0.2);
    buildBook(deskAnchor.x - 0.45, deskAnchor.y + 0.08, deskAnchor.z + 0.1, deskAccent[1], -0.15);
    buildBook(deskAnchor.x + 0.2, deskAnchor.y, deskAnchor.z + 0.25, deskAccent[2], 0.5);
    buildPencilHolder(deskAnchor.x + 0.6, deskAnchor.y, deskAnchor.z + 0.1);
  };

  // ── SCHLAFZIMMER 1 (Lukas) — biru, lemari & meja di kanan-atas ──
  buildBedroomSet({
    x1:-18, x2:-6, z1:-14, z2:-4,
    blanketCol: COL.BLANKET_L,
    deskAccent: [0xcc4444, 0x4488cc, 0x44aa55],
  });

  // ── SCHLAFZIMMER 2 (Oma & Opa) — merah, lemari & meja di kanan ──
  buildBedroomSet({
    x1:-6, x2:6, z1:-14, z2:-4,
    blanketCol: COL.BLANKET_O,
    deskAccent: [0xeeaa44, 0x884466, 0x666622],
  });

  // ── SCHLAFZIMMER 3 (Tante) — ungu, lemari & meja di kanan ──
  buildBedroomSet({
    x1:6, x2:18, z1:-14, z2:-4,
    blanketCol: COL.BLANKET_T,
    deskAccent: [0xaa66cc, 0xddaa77, 0x4488aa],
  });

  // ═══════════════════════════════════════════════════════════════
  // KÜCHE — area x=-18..-3, z=4..14 (15 wide × 10 deep)
  // Pintu: x=-13..-11, z=4
  // ATURAN: SEMUA furnitur TEMPEL TEMBOK. Hanya meja makan di TENGAH.
  // Pintu (x=-13..-11) area sampai z=6 dijamin BEBAS dari furnitur.
  //
  //  ┌──Schrank──[ DOOR x=-13..-11 ]──Schublade─Stove─Sink─Kühlschrank──┐ z=4 (north wall)
  //  │                                                                   │
  //  │ Sink(W)                                                           │
  //  │ (-17.3, 9)            Küchentisch + 2 kursi                       │
  //  │  flush W              di TENGAH ruangan (-10, 9)                  │
  //  │                                                                   │
  //  │ Stove(W)                                                          │
  //  │ (-17.3,11.5)                                                      │
  //  │                                  Kleiner Tisch (-7, 13.15)        │
  //  │                                  flush S wall (untuk Eier UNTER)  │
  //  └───────────────────────────────────────────────────────────────────┘ z=14
  //
  // FLUSH calculation: wall thickness 0.3, wall center at z=4 → wall extends
  // z=3.85..4.15. Furniture center at z = 4 + depth/2 + 0.05 buffer.
  // ═══════════════════════════════════════════════════════════════

  // ── NORTH wall, WEST of door (x=-18..-13, 5 unit lebar) ──
  // Schrank: depth 0.7. Flush center z = 4 + 0.35 + 0.1 = 4.45 → z=4.45
  const schrankAnchor   = buildSchrank(-16, 4.45);          // Pfanne IN
  // ── NORTH wall, EAST of door (x=-11..-3) ──
  // Schublade DIPINDAHKAN ke x=-7.5 (jauh dari pintu) supaya Lukas tidak stuck
  // Door east edge x=-11, Schublade west edge x=-8.4 → clearance 2.6m (sangat aman)
  const schubladeAnchor = buildSchublade(-7.5, 4.45);       // Besteck IN
  buildStove(-5.5, 4.45);                                   // dekorasi kompor
  // Kühlschrank di pojok NE — flush ke wall timur Küche (x=-3 inner)
  const kuehlAnchor     = buildKuehlschrank(-4, 4.5);       // Wurst IN
  // Sink dipindahkan ke pojok BARAT-SELATAN (jauh dari jendela dan kleiner Tisch)
  buildSink(-16.5, 13.5);                                   // dekorasi wastafel
  // ── WEST wall (x=-18) — 2 furnitur tambahan untuk variasi visual ──
  // (perlu rotation; sementara kosongkan agar furnitur tidak overlap dengan window di (-17.85, 8))
  // Window already at (-17.85, 8) — leave west wall empty/decorative.
  // ── Kleiner Tisch di ANTARA pintu Küche (x=-13..-11) dan Schublade (x=-8.4..-6.6) ──
  // Posisi tengah-tengah: x=-9.7, flush north wall z=4.45 (in-line dengan Schublade)
  // Collider x=-10.2..-9.2 → 0.8m clearance dari pintu (-11) DAN dari Schublade (-8.4)
  const kleinAnchor     = buildKleinerTisch(-9.7, 4.45);
  // ── CENTER: Meja makan (Küchentisch) + 2 kursi ──
  const tischAnchor     = buildKuechentisch(-10, 9);        // Teller AUF
  buildStuhl(-11.6, 9, Math.PI/2);   // kursi barat menghadap timur (ke meja)
  buildStuhl(-8.4,  9, -Math.PI/2);  // kursi timur menghadap barat (ke meja)

  // ═══════════════════════════════════════════════════════════════
  // WOHNZIMMER — area x=-3..9, z=4..14 (12 wide × 10 deep)
  // 2 pintu: UTARA (x=2..4, z=4) ke Flur + SELATAN (x=1..5, z=14) ke LUAR
  //
  // LAYOUT SIDEWAYS (sofa di kiri ↔ TV di kanan):
  // - Sofa MENEMPEL WEST wall (x=-3), hadap timur
  // - TV MENEMPEL EAST wall (x=9), hadap barat
  // - Coffee table di depan sofa (west-half), TIDAK menghalangi kolom pintu (x=1..5)
  // - Carpet di bawah area duduk
  //
  //   z=4  ──────[ DOOR ke Flur x=2..4 ]──────────────
  //                                                          ┌─ TV ─┐
  //   [Sofa] ──→ [Coffee Tbl]    (path)           ←──        │ stand│
  //   x=-2,z=9    x=0.5,z=9                                  │x=8.6 │
  //   face EAST   face NORTH                                  │z=9   │
  //                                                          └──────┘
  //                                                          face WEST
  //   z=14 ──────[ DOOR ke LUAR x=1..5 ]──────────────
  //
  // Kolom pintu (x=1..5) di tengah TETAP BERSIH dari semua furnitur.
  // ═══════════════════════════════════════════════════════════════

  // ── TV-Sofa-Table cluster di WEST half — semua DEKAT supaya masuk akal ──
  // TV di NORTH (z=5.5) menghadap selatan; Sofa-CoffeeTable-Carpet 2-3m di SELATAN TV
  // Path tengah (x=1..5) tetap BERSIH untuk lintasan 2 pintu

  // TV STAND — TIDAK BERUBAH posisinya (di NW, hadap selatan)
  buildTVStand(-1, 5.5, 0);
  // CARPET di bawah area duduk
  buildCarpet(-1, 7.5, 4, 3.5, 0x884444);
  // COFFEE TABLE — di tengah antara sofa & TV
  buildCoffeeTable(-1.5, 7.0);
  // SOFA — 3m dari TV, HADAP NORTH (Math.PI) ke arah TV
  buildSofa(-1.5, 8.5, Math.PI);

  // ═══════════════════════════════════════════════════════════════
  // BADEZIMMER — area x=9..18, z=4..14 (9 wide × 10 deep)
  // Pintu: x=12..14, z=4
  //
  // SEMUA FURNITUR TERLIHAT (tidak ada yang stacking visually):
  // - Items kecil di NORTH (background): Toilet, Washbasin
  // - Items besar di SOUTH (foreground): Bathtub, Shower
  // - Horizontal spread agar tidak occlude satu sama lain
  //
  //   z=4  ── Toilet ──[ DOOR x=12..14 ]── Washbasin ──
  //         (10.5, 6)                    (15, 5.5)
  //         (NW corner)                  (NE area, mirror N)
  //
  //                              Shower (16.3, 11)
  //                              east wall, hadap barat
  //
  //         Bathtub (12, 12.5)
  //         (SW area, horizontal)
  //   z=14  ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  // Toilet di NW corner — flush north & west walls
  // Toilet depth 0.7. Flush north (z=4): z = 4 + 0.35 + 0.1 = 4.45 → pakai z=5 agar lebih masuk
  buildToilet(10.3, 5.5, 0);
  // Washbasin di NE area — flush north wall, hadap selatan (default rot 0)
  // Washbasin depth 0.5 (mirror at z=-0.25). Flush north: z = 4 + 0.4 = 4.4 → pakai z=5.0
  buildWashbasin(15.5, 4.8, 0);   // default rot — mirror facing north wall
  // Shower di east-tengah-selatan — flush east wall, hadap barat (rot +π/2)
  // Shower 1.4×1.4. Flush east (x=18): cx = 18 - 0.7 = 17.3
  buildShower(17.0, 11, Math.PI/2);
  // Bathtub di SW area — flush south wall
  // Bathtub 2.0w × 0.9d. Flush south (z=14): cz = 14 - 0.45 - 0.1 = 13.45 → 13.0
  buildBathtub(12, 13.0);

  // ═══════════════════════════════════════════════════════════════
  // FLUR — décor: pot tanaman di PINGGIR (tidak menghalangi lorong)
  // ═══════════════════════════════════════════════════════════════
  const buildPlant = (x, z) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.2,0.3,8), lpMat(0x8a4a2a));
    pot.position.set(x, 0.15, z); pot.castShadow = true;
    Game.worldGroup.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4,8,6), lpMat(0x3a8a3a));
    leaf.position.set(x, 0.55, z); leaf.scale.y = 1.3;
    Game.worldGroup.add(leaf);
    World.colliders.push({type:'cylinder', x, z, radius:0.3});
  };
  // Pot HANYA di pinggir tembok (jangan di tengah lorong)
  buildPlant(-17.3, -3);   // pinggir kiri-utara
  buildPlant(-17.3, 3);    // pinggir kiri-selatan
  buildPlant(17.3,  -3);   // pinggir kanan-utara
  buildPlant(17.3,  3);    // pinggir kanan-selatan

  // ═══════════════════════════════════════════════════════════════
  // LUKISAN di tembok Flur (utara z=-4 dan selatan z=4)
  // ═══════════════════════════════════════════════════════════════
  // Tembok utara Flur (z=-4) — di antara pintu kamar tidur
  buildPainting(-7,  -3.85, 'x', 1.2, 0.85, ['#b35c44','#f4c430','#3a5a8a']);  // antara Lukas & Oma
  buildPainting(7,   -3.85, 'x', 1.2, 0.85, ['#3a8a3a','#ffe080','#a04050']);  // antara Oma & Tante
  // Tembok selatan Flur (z=4) — di antara pintu ruangan depan
  buildPainting(-7,   3.85, 'x', 1.2, 0.85, ['#4a6aaa','#f0a0c0','#88c450']);  // antara Küche & Wohnz.
  buildPainting(8,    3.85, 'x', 1.2, 0.85, ['#aa4444','#ddaa66','#226688']);  // antara Wohnz. & Badez.
  // Tembok barat & timur (ujung Flur)
  buildPainting(-17.7,  0,  'z', 1.0, 0.7, ['#884a2a','#ccaa66','#3a5a3a']);
  buildPainting( 17.7,  0,  'z', 1.0, 0.7, ['#445599','#ee8855','#aabb33']);

  // ═══════════════════════════════════════════════════════════════
  // JENDELA di tembok luar (SKIP Badezimmer)
  // North wall (z=-14): 3 jendela, 1 per kamar tidur
  // South wall (z=14): 1 jendela di Küche, 1 di Wohnzimmer (NO Badezimmer)
  // West wall (x=-18): 1 jendela di Lukas Schlafzimmer, 1 di Küche
  // East wall (x=18): 1 jendela di Tante Schlafzimmer
  // ═══════════════════════════════════════════════════════════════
  buildWindow(-12, -13.85, 'x'); // Lukas bedroom north
  buildWindow(0,   -13.85, 'x'); // Oma bedroom north
  buildWindow(12,  -13.85, 'x'); // Tante bedroom north
  buildWindow(-10,  13.85, 'x'); // Küche south
  buildWindow(7,    13.85, 'x'); // Wohnzimmer south — di SEBELAH pintu (gap x=1..5, jendela aman di x=7)
  buildWindow(-17.85, -9, 'z');  // Lukas bedroom west
  buildWindow(-17.85, 8,  'z');  // Küche west
  buildWindow( 17.85, -9, 'z');  // Tante bedroom east

  // ═══════════════════════════════════════════════════════════════
  // QUEST 1 ITEMS — 7 benda di posisi furniture yang tepat
  // ═══════════════════════════════════════════════════════════════

  const spawnInteriorItem = (name, label, questTarget, x, y, z, color, symbol) => {
    const mesh = buildQuestItem(name, color);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData = {
      isInteractable: true,
      questTarget,
      itemName: name,
      itemLabelDE: label
    };
    Game.itemsGroup.add(mesh);

    // Emoji billboard
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const sprMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(sprMat);
    sprite.scale.set(0.6, 0.6, 1);
    sprite.position.set(x, y + 0.6, z);
    Game.itemsGroup.add(sprite);
    mesh.userData.labelSprite = sprite;

    // Physical props stay on their supporting surface. Only the label is a marker.
    mesh.userData.supportY = y;

  };

  // 5 ITEMS (sesuai instruksi Oma di telepon):
  // Pfanne → IN dem Schrank
  spawnInteriorItem('pfanne', 'die Pfanne', 'quest_1',
    schrankAnchor.x, schrankAnchor.y, schrankAnchor.z, 0x999999, '🍳');
  // Wurst on a separate serving table, clear of the north/east walls.
  const wurstTable = buildKuechentisch(-6, 9);
  spawnInteriorItem('wurst', 'die Wurst', 'quest_1',
    wurstTable.x, wurstTable.y, wurstTable.z, 0xcc5544, '🌭');
  // Eier → UNTER dem kleinen Tisch
  spawnInteriorItem('eier', 'die Eier', 'quest_1',
    kleinAnchor.x, kleinAnchor.y, kleinAnchor.z, 0xfff0c0, '🥚');
  // Teller → AUF dem Küchentisch
  spawnInteriorItem('teller', 'der Teller', 'quest_1',
    tischAnchor.x, tischAnchor.y, tischAnchor.z, 0xfafafa, '🍽');
  // Besteck (Gabel + Messer) → IN der Schublade — direpresentasikan sebagai 1 item visual
  spawnInteriorItem('besteck', 'das Besteck', 'quest_1',
    schubladeAnchor.x, schubladeAnchor.y, schubladeAnchor.z, 0xdddddd, '🍴');

  // ═══════════════════════════════════════════════════════════════
  // QUEST 2 ITEMS — Disembunyikan (visible=false) sampai Quest 2 mulai
  // (Lukas tidak diberi petunjuk lokasi → harus mencari sendiri)
  // ═══════════════════════════════════════════════════════════════

  // Socken → IN dem Schrank (Oma's wardrobe di kamar 2)
  // Oma wardrobe pos (buildBedroomSet): x=x2-3=3, z=z1+1.5=-12.5
  // Socken IN wardrobe → y=1.0 (mid-height inside wardrobe)
  const sockenMesh = (() => {
    spawnInteriorItem('socken', 'die Socken', 'quest_2', 3, 1.0, -12.5, 0xddcc44, '🧦');
    return Game.itemsGroup.children[Game.itemsGroup.children.length - 2]; // mesh (sprite is last)
  })();
  // Papier → AUF Coffee Table di Wohnzimmer (-1.5, 7.0)
  // Coffee table top y=0.5 → papier sits at y=0.55
  const papierMesh = (() => {
    spawnInteriorItem('papier', 'das Papier', 'quest_2', -1.5, 0.496, 7.0, 0xffffff, '📄');
    return Game.itemsGroup.children[Game.itemsGroup.children.length - 2];
  })();
  // Spielzeug → UNTER dem Küchentisch (-10, 9)
  // Under table → y=0.1 (close to floor)
  const spielzeugMesh = (() => {
    spawnInteriorItem('spielzeug', 'das Spielzeug', 'quest_2', -10, 0.026, 9, 0xff8844, '🧸');
    return Game.itemsGroup.children[Game.itemsGroup.children.length - 2];
  })();

  // Initially HIDE Quest 2 items + their sprite labels (revealed when Quest 2 starts)
  ['socken', 'papier', 'spielzeug'].forEach(name => {
    Game.itemsGroup.children.forEach(c => {
      if (c.userData?.itemName === name) {
        c.visible = false;
        if (c.userData.labelSprite) c.userData.labelSprite.visible = false;
      }
    });
  });

  // ── BRIEF VON OMA (Stage 3 Quest 2) — surat di atas Küchentisch ──
  // Muncul hanya SETELAH quest_3 selesai dan SEBELUM quest_4 selesai.
  const qs = (typeof window !== 'undefined' && window.__questState__) || {};
  if (qs['quest_3'] === 'completed' && qs['quest_4'] !== 'completed') {
    const briefGrp = new THREE.Group();
    // Kertas surat (putih krem) di atas meja
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.4), lpMat(0xfff6e0));
    paper.position.y = 0.92; briefGrp.add(paper);
    // Garis tulisan halus
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.005, 0.03), lpMat(0x8a7a5a));
      line.position.set(0, 0.935, -0.1 + i * 0.1); briefGrp.add(line);
    }
    // Sprite ✉️ melayang
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 64;
    const bctx = bc.getContext('2d'); bctx.font = '48px serif';
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle'; bctx.fillText('✉️', 32, 32);
    const bspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(bc), transparent: true }));
    bspr.scale.set(0.6, 0.6, 1); bspr.position.set(0, 1.6, 0); briefGrp.add(bspr);
    briefGrp.position.set(-10, 0, 8.5); // di atas Küchentisch (-10, 9)
    Game.worldGroup.add(briefGrp);
    if (!window.__sceneTriggers__) window.__sceneTriggers__ = {};
    window.__sceneTriggers__.brief_oma = {
      x: -10, z: 8.5, radius: 2.0, mesh: briefGrp, triggered: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // DECOY/CLUTTER — Detail benda di setiap ruangan untuk MENGKECOH Lukas
  // (semua decorative, no questTarget, simple visual representations)
  // ═══════════════════════════════════════════════════════════════

  // ── DECOY HELPER FUNCTIONS ──
  const buildBookPile = (x, z, count = 3) => {
    for (let i = 0; i < count; i++) {
      const col = [0xcc4444, 0x4488cc, 0x44aa55, 0xddaa44, 0x884466][i % 5];
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.08, 0.18),
        lpMat(col)
      );
      book.position.set(x + (i-1) * 0.08, 0.04 + i * 0.085, z + (i-1) * 0.05);
      book.rotation.y = (i * 0.3) - 0.4;
      book.castShadow = true;
      Game.worldGroup.add(book);
    }
  };
  const buildClothesPile = (x, z, col = 0x6688aa) => {
    const grp = new THREE.Group();
    const pile = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      lpMat(col)
    );
    pile.scale.set(1.4, 0.5, 1);
    pile.position.y = 0.12;
    grp.add(pile);
    const fold = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 0.25),
      lpMat(col * 0.85 | 0)
    );
    fold.position.set(0.1, 0.18, -0.05);
    fold.rotation.y = 0.3;
    grp.add(fold);
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
  };
  const buildCup = (x, y, z, col = 0xffffff) => {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.1, 8),
      lpMat(col)
    );
    cup.position.set(x, y + 0.05, z);
    cup.castShadow = true;
    Game.worldGroup.add(cup);
    // handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.01, 4, 8, Math.PI),
      lpMat(col)
    );
    handle.position.set(x + 0.06, y + 0.05, z);
    handle.rotation.y = -Math.PI/2;
    Game.worldGroup.add(handle);
  };
  const buildMagazine = (x, y, z, col = 0xffaa44, rotY = 0) => {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.22),
      lpMat(col)
    );
    mag.position.set(x, y + 0.01, z);
    mag.rotation.y = rotY;
    Game.worldGroup.add(mag);
    // small text-line detail
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.025, 0.04),
      lpMat(0x222222)
    );
    line.position.set(x, y + 0.022, z);
    line.rotation.y = rotY;
    Game.worldGroup.add(line);
  };
  const buildRemote = (x, y, z) => {
    const remote = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.03, 0.06),
      lpMat(0x222222)
    );
    remote.position.set(x, y + 0.015, z);
    Game.worldGroup.add(remote);
    // 3 button dots
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.005, 4),
        lpMat(0xcc4444)
      );
      btn.position.set(x - 0.05 + i * 0.05, y + 0.035, z);
      Game.worldGroup.add(btn);
    }
  };
  const buildVase = (x, z, col = 0x4488aa) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.22, 10),
      lpMat(col)
    );
    body.position.y = 0.11;
    grp.add(body);
    // 3 flower bulbs
    const flowerCol = [0xff6699, 0xffcc44, 0xff8844];
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.18, 4),
        lpMat(0x44aa55)
      );
      stem.position.set((i-1) * 0.03, 0.3, 0);
      stem.rotation.z = (i-1) * 0.15;
      grp.add(stem);
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 4),
        lpMat(flowerCol[i])
      );
      flower.position.set((i-1) * 0.05, 0.4 + i*0.02, 0);
      grp.add(flower);
    }
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'cylinder', x, z, radius:0.15});
  };
  const buildBasket = (x, z) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.15, 0.25, 8),
      lpMat(0xa66a3a)
    );
    body.position.y = 0.13;
    grp.add(body);
    // wicker pattern (rings)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.012, 4, 12),
        lpMat(0x884a2a)
      );
      ring.position.y = 0.05 + i * 0.07;
      ring.rotation.x = Math.PI/2;
      grp.add(ring);
    }
    grp.position.set(x, 0, z);
    Game.worldGroup.add(grp);
    World.colliders.push({type:'cylinder', x, z, radius:0.25});
  };
  const buildBread = (x, y, z) => {
    const bread = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.18, 0.18),
      lpMat(0xc8965a)
    );
    bread.position.set(x, y + 0.09, z);
    bread.castShadow = true;
    Game.worldGroup.add(bread);
    // 3 slits
    for (let i = 0; i < 3; i++) {
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.02, 0.16),
        lpMat(0x8a5a2a)
      );
      slit.position.set(x - 0.1 + i * 0.1, y + 0.18, z);
      slit.rotation.y = 0.3;
      Game.worldGroup.add(slit);
    }
  };
  const buildShoes = (x, z, col = 0x222222) => {
    for (let i = 0; i < 2; i++) {
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.06, 0.22),
        lpMat(col)
      );
      shoe.position.set(x + (i === 0 ? -0.08 : 0.08), 0.03, z + (i === 0 ? 0 : 0.05));
      shoe.rotation.y = i === 0 ? 0.15 : -0.2;
      shoe.castShadow = true;
      Game.worldGroup.add(shoe);
    }
  };
  const buildPillow = (x, y, z, col = 0xfaf0d8, rotY = 0) => {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.12, 0.25),
      lpMat(col)
    );
    p.position.set(x, y + 0.06, z);
    p.rotation.y = rotY;
    p.castShadow = true;
    Game.worldGroup.add(p);
  };

  // ── KAMAR OMA (bedroom 2, x=-6..6, z=-14..-4) — decoys ──
  // (bed at -3, -9; nightstand at -1, -9; wardrobe at 3, -12.5; desk at 0, -12.5)
  buildBookPile(-5, -6, 4);                  // books on floor near west wall
  buildClothesPile(-5, -11, 0xaa4040);       // red shirt pile near corner
  buildPillow(2, 0.85, -10, 0xffe0d0, 0.3);  // extra pillow on bed
  buildVase(-1.5, -13, 0x886aaa);            // purple vase on north wall

  // ── KAMAR LUKAS (bedroom 1, x=-18..-6) — decoys ──
  buildBookPile(-16, -6, 3);                 // books near west wall
  buildClothesPile(-16, -11.5, 0x4488aa);    // blue clothes pile

  // ── KAMAR TANTE (bedroom 3, x=6..18) — decoys ──
  buildBookPile(8, -6, 3);
  buildClothesPile(15, -11, 0x8866aa);

  // ── WOHNZIMMER decoys (around sofa/table area) ──
  buildCup(-1.0, 0.5, 7.0, 0xffffff);        // cup on coffee table
  buildMagazine(-2.0, 0.5, 7.0, 0xff8844, 0.3); // magazine on coffee table
  buildRemote(-1.5, 0.5, 7.4);                // remote on coffee table edge
  buildVase(0.5, 5.8, 0x6aaa44);              // vase near TV stand
  buildPillow(-2.5, 0.8, 8.7, 0xddaa66, 0.5); // throw pillow on sofa

  // ── KÜCHE decoys ──
  buildBasket(-13.5, 12);                     // basket near dining table SW corner
  buildBread(-10, 0.9, 9.5, 0xc8965a);        // bread on Küchentisch (decoy near where teller is)
  buildCup(-9, 0.9, 9, 0xeeddcc);             // cup on Küchentisch
  buildMagazine(-11, 0.9, 9, 0xddaa44, 0.2);  // newspaper on Küchentisch

  // ── FLUR decoys ──
  buildShoes(-14, 3.5, 0x553a22);             // pair of brown shoes near Küche door
  buildShoes(2, 3.5, 0x222222);               // black shoes near Wohnzimmer door

  // ═══════════════════════════════════════════════════════════════
  // HOMEY DECORATIONS — membuat rumah terasa lebih hidup, tidak kaku
  // (semua dipanggil SETELAH decoy helpers didefinisikan agar tidak TDZ error)
  // ═══════════════════════════════════════════════════════════════

  // ── FLUR: jam dinding (di antara pintu Lukas dan painting di -7) ──
  // Posisi x=-9 → AMAN: Lukas door (x=-13..-11) di kiri, painting di x=-7
  // TIDAK menghalangi pintu apapun (gap 2m dari pintu Lukas, 2m dari painting)
  buildWallClock(-9, 2.4, -3.85, 0);                      // jam dinding Flur
  // Floor runner DIHAPUS (sesuai permintaan)

  // ── KAMAR LUKAS: wall art (tanpa foto nightstand) ──
  buildPictureFrame(-17.85, 1.6, -7, Math.PI/2, 0.5, 0.65);   // wall art west wall

  // ── KAMAR OMA: wall art (tanpa foto nightstand) ──
  buildPictureFrame(-5.85, 1.6, -8, Math.PI/2, 0.5, 0.65);    // wall art inner wall

  // ── KAMAR TANTE: wall art (tanpa foto nightstand) ──
  buildPictureFrame(6.15, 1.6, -8, -Math.PI/2, 0.5, 0.65);    // wall art inner wall

  // ── WOHNZIMMER: plant corner + pillow tambahan ──
  buildPlant(8, 6);                                            // pohon di pojok NE
  buildPillow(-1.5, 0.85, 7.8, 0xddaa66, -0.2);                // pillow extra di sofa

  // ── KÜCHE: basket dekoratif (jam dinding DIHAPUS sesuai permintaan) ──
  buildBasket(-15, 9);                                        // basket dekoratif di tengah

  // ── LUKISAN TAMBAHAN di dinding setiap ruangan (palette berbeda-beda) ──
  // Format: buildPainting(cx, cz, axis, w, h, palette[3])
  // axis 'x' = wall along X (faces ±Z); axis 'z' = wall along Z (faces ±X)

  // KAMAR LUKAS — 2 lukisan tambahan (selain wall art barat di -17.85)
  buildPainting(-12, -13.85, 'x', 0.9, 0.7, ['#4488cc', '#ffd070', '#cc7755']);  // north wall (kiri jendela)
  buildPainting(-7,  -13.85, 'x', 0.7, 0.55, ['#aa6644', '#88cc88', '#ddaa44']); // north wall (kanan jendela)

  // KAMAR OMA — 2 lukisan tambahan
  buildPainting(2,   -13.85, 'x', 1.0, 0.7, ['#bf6577', '#f4c430', '#3a8a3a']);  // north wall east
  buildPainting(5.85, -10,   'z', 0.7, 0.55, ['#553377', '#ccaa66', '#88bb55']); // east inner wall

  // KAMAR TANTE — 2 lukisan tambahan
  buildPainting(9,   -13.85, 'x', 0.9, 0.65, ['#226688', '#eeaa88', '#aabb55']); // north wall west
  buildPainting(14,  -13.85, 'x', 0.7, 0.55, ['#884466', '#ddaa77', '#5a8a4a']); // north wall east

  // WOHNZIMMER — 2 lukisan
  buildPainting(7,   13.85, 'x', 1.0, 0.7, ['#4a6aaa', '#ee8855', '#88aa66']);   // south wall east of pintu exit
  buildPainting(-3,  13.85, 'x', 0.7, 0.6, ['#aa4444', '#f0e0a0', '#5a8888']);   // south wall west corner

  // KÜCHE — 2 lukisan
  buildPainting(-14, 13.85, 'x', 0.9, 0.65, ['#88aa55', '#ccaa44', '#5a4a8a']);  // south wall west
  buildPainting(-6,  13.85, 'x', 0.7, 0.55, ['#aa6633', '#ccaa66', '#3a8a55']);  // south wall east

  // BADEZIMMER — 2 lukisan
  buildPainting(9.15,  7, 'z', 0.7, 0.5, ['#88ccdd', '#fafafa', '#aabb88']);     // inner wall west
  buildPainting(13,  13.85, 'x', 0.6, 0.5, ['#bbddaa', '#5588aa', '#ddccbb']);   // south wall

  // ── CURTAINS pada jendela utama (kanan-kiri tiap jendela) ──
  buildCurtain(-12, -13.85, 'x', -0.9, 0xb87a8a);             // Lukas bedroom — kiri
  buildCurtain(-12, -13.85, 'x',  0.9, 0xb87a8a);             // Lukas bedroom — kanan
  buildCurtain(0,   -13.85, 'x', -0.9, 0xaa7788);             // Oma bedroom
  buildCurtain(0,   -13.85, 'x',  0.9, 0xaa7788);
  buildCurtain(12,  -13.85, 'x', -0.9, 0x9988aa);             // Tante bedroom
  buildCurtain(12,  -13.85, 'x',  0.9, 0x9988aa);
  buildCurtain(-10, 13.85,  'x', -0.9, 0xcca888);             // Küche south
  buildCurtain(-10, 13.85,  'x',  0.9, 0xcca888);

  // ── EXIT GLOW: tanda jelas di lantai dekat pintu depan (LEBAR x=1..5) ──
  const exitGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xffcc44, emissive: 0xffaa00, emissiveIntensity: 0.85,
      transparent: true, opacity: 0.85
    })
  );
  exitGlow.rotation.x = -Math.PI/2;
  exitGlow.position.set(3, 0.05, 13.6);
  Game.worldGroup.add(exitGlow);

  // Sprite text "AUSGANG" di atas
  const exitCanvas = document.createElement('canvas');
  exitCanvas.width = 256; exitCanvas.height = 64;
  const exitCtx = exitCanvas.getContext('2d');
  exitCtx.fillStyle = 'rgba(60,30,15,0.92)';
  exitCtx.fillRect(0,0,256,64);
  exitCtx.fillStyle = '#ffd070';
  exitCtx.font = 'bold 30px DM Sans, sans-serif';
  exitCtx.textAlign = 'center';
  exitCtx.textBaseline = 'middle';
  exitCtx.fillText('↓ AUSGANG ↓', 128, 32);
  const exitTex = new THREE.CanvasTexture(exitCanvas);
  const exitSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: exitTex, transparent: true, depthTest: false }));
  exitSprite.scale.set(3.0, 0.75, 1);
  exitSprite.position.set(3, 3.0, 13.5);
  exitSprite.renderOrder = 999;
  Game.worldGroup.add(exitSprite);

  if (CONFIG.DEBUG) console.log('[world] buildHausInterior done — 7 items spawned in Küche');
}


// ═══════════════════════════════════════════════════════════════════
// 16. API PUBLIK
// ═══════════════════════════════════════════════════════════════════

export function buildZone(zoneId, def) {
  // Cleanup is now handled by zone.js (unloadCurrentZone)

  buildGround(zoneId);

  if (zoneId === ZONES.STADT) {
    buildStadt();
  } else if (zoneId === ZONES.HAUS) {
    buildHausYard();
  } else if (zoneId === ZONES.HAUS_INTERIOR) {
    buildHausInterior();
  } else if (zoneId === ZONES.SUPERMARKET_INTERIOR) {
    buildSupermarktInterior();
  }

  // Awan hanya di diorama rumah (alam terbuka). Di kota awan transparan
  // menutupi gedung dan papan nama; di interior tidak masuk akal.
  if (zoneId === ZONES.HAUS) buildClouds();

  if(CONFIG.DEBUG) console.log('[world] built zone:', zoneId, 'colliders:', World.colliders.length);
}

export function updateWorld(delta,elapsed) {
  if(World._updateRiver) World._updateRiver(delta,elapsed);
  if(World._updateClouds) World._updateClouds(delta,elapsed);
  if(World._updateAmbient) World._updateAmbient(delta,elapsed);
}

export function getZoneSpawnPoint(zoneId) {
  const pts={[ZONES.HAUS]:new THREE.Vector3(0,0,4)};
  return pts[zoneId]||new THREE.Vector3(0,0,0);
}

export function setNightMode(isNight) {
  World.streetLamps.forEach(l=>{
    l.head.material.emissiveIntensity=isNight?1.0:0.0;
    l.light.intensity=isNight?1.8:0.0;
  });
  World.windowLights.forEach(m=>{
    m.emissiveIntensity=isNight?0.8:0.0;
  });
}
