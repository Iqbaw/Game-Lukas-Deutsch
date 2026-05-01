// ═══════════════════════════════════════════════════════════════════
// js/world.js — KOTA HAMBURG MEDIEVAL
// Layout tidak teratur khas desa Jerman abad pertengahan:
// jalan sempit berkelok, bangunan di tepi jalan, selalu ada bangunan.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
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

function makeBrickTex(size=256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3a2a'; ctx.fillRect(0,0,size,size);
  const rows=12, cols=6, bw=size/cols, bh=size/rows;
  for (let r=0; r<rows; r++) {
    for (let col=0; col<cols; col++) {
      const offset = (r%2)*(bw/2);
      const x=col*bw+offset, y=r*bh;
      const v = 0.75+Math.random()*0.4;
      const R=Math.floor(179*v), G=Math.floor(92*v), B=Math.floor(68*v);
      ctx.fillStyle=`rgb(${R},${G},${B})`;
      ctx.fillRect(x+1.5, y+1.5, bw-3, bh-3);
      ctx.fillStyle=`rgba(255,200,150,${0.1+Math.random()*0.12})`;
      ctx.fillRect(x+1.5, y+1.5, bw-3, 1.5);
      ctx.fillStyle=`rgba(30,15,5,0.18)`;
      ctx.fillRect(x+1.5, y+bh-3, bw-3, 1.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  return t;
}

function makeGrassTex(size=256) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#5a8a3c'; ctx.fillRect(0,0,size,size);
  for (let i=0;i<1200;i++) {
    const x=Math.random()*size, y=Math.random()*size;
    ctx.strokeStyle=Math.random()<0.5?`rgba(40,70,20,0.4)`:`rgba(130,190,80,0.35)`;
    ctx.lineWidth=0.7;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()-.5)*1.5,y-2-Math.random()*2); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  return t;
}

function makeCobbleTex(size=256) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#2a2620'; ctx.fillRect(0,0,size,size);
  const rows=8, cols=8, cw=size/cols, ch=size/rows;
  for (let r=0;r<rows;r++) {
    for (let col=0;col<cols;col++) {
      const offset=(r%2)*(cw/2);
      const x=col*cw+offset, y=r*ch;
      const v=0.5+Math.random()*0.4;
      const base=Math.floor(75*v);
      ctx.fillStyle=`rgb(${base+10},${base+5},${base})`;
      ctx.beginPath();
      const rx=cw*0.38, ry=ch*0.38;
      ctx.ellipse(x+cw/2,y+ch/2,rx,ry,Math.random()*0.4,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle=`rgba(255,220,180,${0.05+Math.random()*0.08})`;
      ctx.beginPath();
      ctx.ellipse(x+cw/2-2,y+ch/2-2,rx*0.3,ry*0.3,0,0,Math.PI*2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  return t;
}

function makeRoofTex(size=128) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#3a2a1a'; ctx.fillRect(0,0,size,size);
  for (let y=0;y<size;y+=8) {
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,y,size,1);
    ctx.fillStyle='rgba(255,180,100,0.06)'; ctx.fillRect(0,y+1,size,1);
    const off=(Math.floor(y/8)%2)*6;
    for (let x=0;x<size;x+=10) {
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x+off,y+1,1,6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// Cache textures
let _brickTex=null, _grassTex=null, _cobbleTex=null, _roofTex=null;

function getBrickTex()   { if(!_brickTex)   _brickTex=makeBrickTex();   return _brickTex; }
function getGrassTex()   { if(!_grassTex)   _grassTex=makeGrassTex();   return _grassTex; }
function getCobbleTex()  { if(!_cobbleTex)  _cobbleTex=makeCobbleTex(); return _cobbleTex; }
function getRoofTex()    { if(!_roofTex)    _roofTex=makeRoofTex();     return _roofTex; }

// ═══════════════════════════════════════════════════════════════════
// 2. GROUND
// ═══════════════════════════════════════════════════════════════════

function buildGround(zoneId) {
  const size = CONFIG.ZONE_SIZE || 80;

  if (zoneId === ZONES.HAUS) {
    // Low poly undulating terrain
    const segments = 40;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geo.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      // River bed on the left (x < -6)
      if (x < -5) {
        const depth = Math.max(-1.5, (x + 5) * 0.4); 
        pos.setZ(i, depth + (Math.sin(y*0.5)*0.1));
      } else {
        // Hills
        const h1 = Math.sin(x*0.15) * Math.cos(y*0.15) * 1.8;
        const h2 = Math.sin(x*0.4 + y*0.4) * 0.3;
        
        // Flatten center for house (-4 to +12)
        let flat = 1.0;
        if (x > -4 && x < 12 && y > -8 && y < 8) {
          flat = 0.1; 
        }
        pos.setZ(i, (h1 + h2) * flat);
      }
    }
    geo.computeVertexNormals();
    
    const mat = new THREE.MeshLambertMaterial({
      color: 0x7ab648, // Lebih hijau terang
      flatShading: true,
    });
    const g = new THREE.Mesh(geo, mat);
    g.rotation.x = -Math.PI/2;
    g.receiveShadow = true;
    g.name = 'ground';
    Game.worldGroup.add(g);
    World.ground = g;
    World.walkables = [g];
  } else {
    // Flat ground untuk zona lain
    const tex = getGrassTex(); tex.repeat.set(30,30);
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({map:tex})
    );
    g.rotation.x = -Math.PI/2; g.receiveShadow = true; g.name = 'ground';
    Game.worldGroup.add(g); World.ground = g;
    World.walkables = [g];
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. JALAN COBBLESTONE
// ═══════════════════════════════════════════════════════════════════

function buildRoads() {
  const cobbleTex = getCobbleTex();

  // Helper: buat satu segmen jalan (horizontal atau vertikal)
  function addRoad(axis, center, length, width=5.5) {
    const t2 = cobbleTex.clone();
    t2.needsUpdate=true;
    if (axis==='z') { t2.repeat.set(width/4, length/4); }
    else            { t2.repeat.set(length/4, width/4); }
    const geo = axis==='z'
      ? new THREE.PlaneGeometry(width, length)
      : new THREE.PlaneGeometry(length, width);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({map:t2}));
    mesh.rotation.x=-Math.PI/2; mesh.position.y=0.02;
    if (axis==='z') mesh.position.set(center, 0.02, 0);
    else            mesh.position.set(0, 0.02, center);
    mesh.receiveShadow=true;
    Game.worldGroup.add(mesh);
  }

  // === JALAN-JALAN KOTA MEDIEVAL HAMBURG ===
  // Layout: tidak teratur, semua jalan mengarah ke titik-titik penting

  // Hauptstraße — vertikal, depan rumah kakek-nenek
  addRoad('z', -12, 200, 5.5);
  // Hafenstraße — vertikal, menuju pelabuhan di timur
  addRoad('z',  32, 200, 6);
  // Kleine Gasse — vertikal kecil, kuartal barat
  addRoad('z', -48, 120, 4.5);

  // Nordallee — horizontal atas
  addRoad('x', -38, 100, 5.5);
  // Am Markt — horizontal tengah
  addRoad('x',   4, 200, 5.5);
  // Südgasse — horizontal bawah
  addRoad('x',  42, 100, 5.5);
  // Hafendamm — horizontal pelabuhan
  addRoad('x',  70, 80,  6);

  // Verbindungsgasse — diagonal simulation via diagonal pendek
  addRoad('z', -28, 60, 4.5);   // gasse tengah-barat
  addRoad('x',  -16, 60, 4.5);  // cross gasse kecil

  // Gang setapak ke rumah kakek-nenek
  const pathT = cobbleTex.clone(); pathT.needsUpdate=true; pathT.repeat.set(1,3);
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 10),
    new THREE.MeshLambertMaterial({map:pathT})
  );
  path.rotation.x=-Math.PI/2; path.position.set(-3.5, 0.03, 2.5);
  path.receiveShadow=true;
  Game.worldGroup.add(path);
}

// ═══════════════════════════════════════════════════════════════════
// 4. BUILDING GENERATOR — Atap gable benar
// ═══════════════════════════════════════════════════════════════════

/**
 * Bangun satu bangunan dengan atap pelana yang benar.
 * facing: arah pintu menghadap.
 *   0       → pintu ke +Z (selatan)
 *   Math.PI → pintu ke -Z (utara)
 *   Math.PI/2 → pintu ke +X (timur)
 *  -Math.PI/2 → pintu ke -X (barat)
 */
function makeBuilding(opts) {
  const {
    x=0, z=0, w=6, h=5, d=5,
    color=COLORS.BRICK, brick=true,
    floors=1,          // jumlah lantai (mempengaruhi style jendela)
    roofType='gable',  // 'gable'|'flat'|'half_hip'
    roofColor=COLORS.ROOF,
    windows=2,         // jendela per baris per sisi depan
    facing=0,
    sign=null,
    name='bldg',
    doorColor=0x4a3024,
    trimColor=0xf5ede0,
    hasShutters=true,
  } = opts;

  const group = new THREE.Group();
  group.name = `building-${name}`;

  // ── MATERIAL ──
  let wallMat;
  if (brick) {
    const t = getBrickTex().clone();
    t.needsUpdate=true;
    t.repeat.set(Math.round(w/3), Math.round(h/2));
    wallMat = new THREE.MeshStandardMaterial({map:t, roughness:0.9});
  } else {
    wallMat = new THREE.MeshStandardMaterial({color, roughness:0.85});
  }

  const roofMat = new THREE.MeshStandardMaterial({
    map: getRoofTex(), roughness:0.85, color:roofColor,
  });
  const trimMat = new THREE.MeshStandardMaterial({color:trimColor, roughness:0.7});
  const doorMat = new THREE.MeshStandardMaterial({color:doorColor, roughness:0.7});
  const glassMat = new THREE.MeshStandardMaterial({
    color:0xffeedd, emissive:0xffcc88, emissiveIntensity:0.0,
    roughness:0.2, transparent:true, opacity:0.85,
  });
  const shutterMat = new THREE.MeshStandardMaterial({color:0x2a5a2a, roughness:0.8});

  // ── BADAN BANGUNAN ──
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h/2;
  body.castShadow=body.receiveShadow=true;
  group.add(body);

  // ── ATAP GABLE (fix: pakai BoxGeometry tipis yang dirotasi) ──
  if (roofType === 'gable') {
    // Atap pelana: ridge di tengah, dua sisi miring kiri-kanan
    // Bangunan: lebar W di sumbu X, dalam D di sumbu Z
    // Ridge: sejajar sumbu Z, puncak di tengah (X=0), tinggi "pitch" di atas bangunan
    const pitch = Math.max(1.5, w * 0.28);
    const halfW = w/2 + 0.3;  // overhang horizontal
    const halfD = d/2 + 0.35; // overhang depan-belakang

    // Panjang slope dari dinding atas ke ridge = sqrt((halfW)^2 + pitch^2)
    const slopeW = Math.sqrt(halfW*halfW + pitch*pitch);
    const slopeAngle = Math.atan2(pitch, halfW); // sudut dari horizontal

    const sGeo = new THREE.BoxGeometry(slopeW, 0.25, halfD*2);
    const rTex = getRoofTex().clone();
    rTex.needsUpdate=true; rTex.repeat.set(slopeW/2, halfD*2/2);
    const slopeMat = new THREE.MeshStandardMaterial({map:rTex, color:roofColor, roughness:0.85});

    // Sisi KIRI atap (X negatif → miring ke kiri-bawah)
    const sL = new THREE.Mesh(sGeo, slopeMat);
    sL.rotation.z =  slopeAngle;  // rotate +Z axis supaya kiri terangkat ke ridge
    // Posisi pivot: ujung bawah sisi kiri di X = -(w/2), ujung atas di ridge X=0
    // Center slope di X = -w/4, Y = h + pitch/2
    sL.position.set(-halfW/2, h + pitch/2, 0);
    sL.castShadow=true;
    group.add(sL);

    // Sisi KANAN atap (X positif → miring ke kanan-bawah)
    const sR = new THREE.Mesh(sGeo, slopeMat);
    sR.rotation.z = -slopeAngle;
    sR.position.set( halfW/2, h + pitch/2, 0);
    sR.castShadow=true;
    group.add(sR);

    // Gable depan (segitiga bata)
    const gShape = new THREE.Shape();
    gShape.moveTo(-w/2-0.25, 0);
    gShape.lineTo( w/2+0.25, 0);
    gShape.lineTo( 0, pitch+0.1);
    gShape.closePath();
    const gGeo = new THREE.ShapeGeometry(gShape);
    const gF = new THREE.Mesh(gGeo, wallMat);
    gF.position.set(0, h, d/2+0.001);
    group.add(gF);
    const gB = new THREE.Mesh(gGeo, wallMat);
    gB.position.set(0, h, -d/2-0.001);
    gB.rotation.y=Math.PI;
    group.add(gB);

    // Ridge cap (balok di puncak atap, memanjang)
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.3, halfD*2+0.2),
      new THREE.MeshStandardMaterial({color:0x2a1a0a, roughness:0.7})
    );
    ridge.position.set(0, h+pitch+0.1, 0);
    ridge.castShadow=true;
    group.add(ridge);

  } else if (roofType === 'flat') {
    const flatRoof = new THREE.Mesh(
      new THREE.BoxGeometry(w+0.4, 0.3, d+0.4),
      new THREE.MeshStandardMaterial({color:roofColor, roughness:0.8})
    );
    flatRoof.position.y = h+0.15;
    flatRoof.castShadow=true;
    group.add(flatRoof);

    // Parapet (tembok rendah di tepi atap datar)
    const parapetMat = new THREE.MeshStandardMaterial({color:0xc8a070, roughness:0.85});
    for (const [px,pz,pw,pd] of [
      [0,    -(d/2+0.5), w+1.2, 0.3],
      [0,     (d/2+0.5), w+1.2, 0.3],
      [-(w/2+0.5), 0, 0.3, d+0.6],
      [ (w/2+0.5), 0, 0.3, d+0.6],
    ]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(pw,0.7,pd), parapetMat);
      p.position.set(px, h+0.5, pz); group.add(p);
    }
  } else if (roofType === 'half_hip') {
    // Atap perisai (hip roof) — seperti gable tapi ujung segitiga juga miring
    const pitch = Math.max(1.5, w*0.28);
    const sL = new THREE.Mesh(
      new THREE.BoxGeometry(Math.sqrt((w/2+0.3)**2+pitch**2)+0.1, 0.25, d),
      new THREE.MeshStandardMaterial({color:roofColor, roughness:0.85})
    );
    const ang = Math.atan2(pitch, w/2+0.3);
    sL.rotation.z= ang; sL.position.set(-(w/2+0.3)/2, h+pitch/2, 0); sL.castShadow=true; group.add(sL);
    const sR = sL.clone(); sR.rotation.z=-ang; sR.position.x=(w/2+0.3)/2; group.add(sR);
    // Hip ends
    const endAng = Math.atan2(pitch, d/2+0.3);
    const sEnd = new THREE.Mesh(
      new THREE.BoxGeometry(w-1, 0.25, Math.sqrt((d/2+0.3)**2+pitch**2)+0.1),
      new THREE.MeshStandardMaterial({color:roofColor, roughness:0.85})
    );
    sEnd.rotation.x=-endAng; sEnd.position.set(0,h+pitch/2,-(d/2+0.3)/2); sEnd.castShadow=true; group.add(sEnd);
    const sEnd2=sEnd.clone(); sEnd2.rotation.x=endAng; sEnd2.position.z=(d/2+0.3)/2; group.add(sEnd2);
  }

  // ── JENDELA ──
  const winRows = floors;
  const winSpacing = w / (windows+1);
  const startY = h * 0.3;
  const rowStep = h * 0.5;

  for (let row=0; row<winRows; row++) {
    const wy = startY + row*rowStep;
    for (let i=0; i<windows; i++) {
      const wx = -w/2 + winSpacing*(i+1);
      // Frame putih
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.06), trimMat);
      fr.position.set(wx, wy, d/2+0.04); group.add(fr);
      // Kaca (emissive)
      const wn = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.06), glassMat.clone());
      wn.position.set(wx, wy, d/2+0.07); group.add(wn);
      World.windowLights.push(wn.material);
      // Mullion salib
      const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.04,1.05,0.08),trimMat);
      m1.position.set(wx,wy,d/2+0.09); group.add(m1);
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.85,0.04,0.08),trimMat);
      m2.position.set(wx,wy,d/2+0.09); group.add(m2);
      // Shutters
      if (hasShutters) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.38,1.0,0.04),shutterMat);
        sh.position.set(wx-0.62, wy, d/2+0.04); group.add(sh);
        const sh2=sh.clone(); sh2.position.x=wx+0.62; group.add(sh2);
      }
    }
  }

  // ── PINTU ──
  const doorH = Math.min(2.4, h*0.45);
  const dFrame = new THREE.Mesh(new THREE.BoxGeometry(1.4,doorH+0.15,0.06),trimMat);
  dFrame.position.set(0,doorH/2,d/2+0.03); group.add(dFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1,doorH,0.08),doorMat);
  door.position.set(0,doorH/2,d/2+0.06); group.add(door);
  // Lengkungan di atas pintu
  const archGeo = new THREE.CylinderGeometry(0.6,0.6,0.08,12,1,false,0,Math.PI);
  const arch = new THREE.Mesh(archGeo, trimMat);
  arch.rotation.z=Math.PI/2; arch.rotation.y=Math.PI/2;
  arch.position.set(0, doorH, d/2+0.06); group.add(arch);
  // Knob
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8),
    new THREE.MeshStandardMaterial({color:0xd4a017, metalness:0.7, roughness:0.3}));
  knob.position.set(0.35, doorH*0.45, d/2+0.11); group.add(knob);

  // ── SIGN ──
  if (sign) {
    const sc = document.createElement('canvas');
    sc.width=512; sc.height=128;
    const sctx=sc.getContext('2d');
    sctx.fillStyle=sign.bg||'#1a1410'; sctx.fillRect(0,0,512,128);
    sctx.strokeStyle=sign.fg||'#f4c430'; sctx.lineWidth=4; sctx.strokeRect(6,6,500,116);
    sctx.fillStyle=sign.fg||'#f4c430';
    sctx.font='bold 52px Georgia,serif';
    sctx.textAlign='center'; sctx.textBaseline='middle';
    sctx.fillText(sign.text,256,64);
    const st=new THREE.CanvasTexture(sc); st.colorSpace=THREE.SRGBColorSpace;
    const sm=new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w*0.75,3.5),0.9),
      new THREE.MeshStandardMaterial({map:st,emissiveMap:st,emissive:0xffffff,emissiveIntensity:0.3})
    );
    sm.position.set(0, h*0.82, d/2+0.12); group.add(sm);
  }

  // ── DETAIL TAMBAHAN: Windowsill, Foundation ──
  // Windowsill (ambang jendela batu)
  const wsill = new THREE.Mesh(new THREE.BoxGeometry(w*0.95,0.12,0.25),
    new THREE.MeshStandardMaterial({color:0x9a8870,roughness:0.8}));
  wsill.position.set(0,h*0.18,d/2+0.1); group.add(wsill);

  // Foundation (batu lebih gelap di bawah)
  const fnd = new THREE.Mesh(new THREE.BoxGeometry(w+0.1,0.4,d+0.1),
    new THREE.MeshStandardMaterial({color:0x5a4a3a,roughness:0.95}));
  fnd.position.set(0,0.2,0); group.add(fnd);

  // ── COLLIDER ──
  World.colliders.push({
    type:'box',
    box: new THREE.Box3(
      new THREE.Vector3(x-w/2-0.3, 0,     z-d/2-0.3),
      new THREE.Vector3(x+w/2+0.3, h+4,   z+d/2+0.3)
    ),
    name:`building-${name}`,
  });

  group.position.set(x, 0, z);
  group.rotation.y = facing;
  Game.worldGroup.add(group);
  return group;
}

// ═══════════════════════════════════════════════════════════════════
// 5. RUMAH KAKEK-NENEK (spesial, lebih detail)
// ═══════════════════════════════════════════════════════════════════

function buildMainHouse() {
  const grp = new THREE.Group(); grp.name='house-grosseltern';

  // ── LOW-POLY LOG CABIN ──
  const W=5, H=3.5, D=4;

  // Materials — warm wood tones, flat shading for low-poly look
  const logMat = new THREE.MeshLambertMaterial({color: 0x8B5E3C, flatShading: true});
  const logDarkMat = new THREE.MeshLambertMaterial({color: 0x6B4226, flatShading: true});
  const roofMat = new THREE.MeshLambertMaterial({color: 0xC4956A, flatShading: true});
  const trimMat = new THREE.MeshLambertMaterial({color: 0xDEC9A0, flatShading: true});
  const glassMat = new THREE.MeshStandardMaterial({
    color:0xffcc66, emissive:0xffaa22, emissiveIntensity:0.6,
    roughness:0.2, transparent:true, opacity:0.85
  });
  const doorMat = new THREE.MeshLambertMaterial({color: 0x5a3a1a, flatShading: true});

  // ── LOG WALLS (horizontal cylinders stacked) ──
  const logRadius = 0.22;
  const logCount = Math.floor(H / (logRadius * 2));
  for (let i = 0; i < logCount; i++) {
    const y = logRadius + i * logRadius * 2;
    const mat = i % 2 === 0 ? logMat : logDarkMat;

    // Front & Back walls
    for (const zOff of [D/2, -D/2]) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(logRadius, logRadius, W + 0.3, 6),
        mat
      );
      log.rotation.z = Math.PI / 2;
      log.position.set(0, y, zOff);
      log.castShadow = true;
      grp.add(log);
    }

    // Left & Right walls
    for (const xOff of [W/2, -W/2]) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(logRadius, logRadius, D + 0.3, 6),
        mat
      );
      log.rotation.x = Math.PI / 2;
      log.position.set(xOff, y, 0);
      log.castShadow = true;
      grp.add(log);
    }
  }

  // Fill body for collision/visual
  const bodyFill = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.1, H, D - 0.1),
    new THREE.MeshLambertMaterial({color: 0x7a4e2e, flatShading: true})
  );
  bodyFill.position.y = H/2;
  bodyFill.castShadow = true; bodyFill.receiveShadow = true;
  grp.add(bodyFill);

  // ── STEEP GABLE ROOF ──
  const pitch = 3.2;
  const roofOverhang = 0.8;
  const halfW = W/2 + roofOverhang;
  const halfD = D/2 + roofOverhang;
  const slopeLen = Math.sqrt(halfW*halfW + pitch*pitch);
  const slopeAng = Math.atan2(pitch, halfW);

  // Roof planks (thicker slabs for low-poly feel)
  const roofGeo = new THREE.BoxGeometry(slopeLen, 0.2, halfD * 2);
  const sL = new THREE.Mesh(roofGeo, roofMat);
  sL.rotation.z = slopeAng;
  sL.position.set(-halfW/2, H + pitch/2, 0);
  sL.castShadow = true;
  grp.add(sL);

  const sR = new THREE.Mesh(roofGeo, roofMat);
  sR.rotation.z = -slopeAng;
  sR.position.set(halfW/2, H + pitch/2, 0);
  sR.castShadow = true;
  grp.add(sR);

  // Gable triangles (front & back)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-W/2 - 0.1, 0);
  gableShape.lineTo(W/2 + 0.1, 0);
  gableShape.lineTo(0, pitch);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);

  const gF = new THREE.Mesh(gableGeo, logMat);
  gF.position.set(0, H, D/2 + roofOverhang * 0.1);
  grp.add(gF);
  const gB = new THREE.Mesh(gableGeo, logMat);
  gB.position.set(0, H, -D/2 - roofOverhang * 0.1);
  gB.rotation.y = Math.PI;
  grp.add(gB);

  // Ridge beam
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.25, halfD * 2 + 0.3),
    new THREE.MeshLambertMaterial({color: 0x5a3a1a, flatShading: true})
  );
  ridge.position.set(0, H + pitch + 0.05, 0);
  ridge.castShadow = true;
  grp.add(ridge);

  // ── CHIMNEY ──
  const chim = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 2, 0.6),
    new THREE.MeshLambertMaterial({color: 0x888888, flatShading: true})
  );
  chim.position.set(W*0.25, H + pitch - 0.3, 0);
  chim.castShadow = true;
  grp.add(chim);
  const chimCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.12, 0.8),
    new THREE.MeshLambertMaterial({color: 0x666666, flatShading: true})
  );
  chimCap.position.set(W*0.25, H + pitch + 0.7, 0);
  grp.add(chimCap);

  // ── WINDOWS (glowing, warm light) ──
  const winPositions = [
    {x: -1.2, y: 1.8, z: D/2 + 0.01},
    {x:  1.2, y: 1.8, z: D/2 + 0.01},
    {x:  W/2 + 0.01, y: 1.8, z: 0, side: true},
    {x: -W/2 - 0.01, y: 1.8, z: 0, side: true, flip: true},
  ];
  winPositions.forEach(wp => {
    const frameGeo = new THREE.BoxGeometry(wp.side ? 0.06 : 1.0, 1.0, wp.side ? 1.0 : 0.06);
    const frame = new THREE.Mesh(frameGeo, trimMat);
    frame.position.set(wp.x, wp.y, wp.z);
    grp.add(frame);

    const glassGeo = new THREE.BoxGeometry(wp.side ? 0.04 : 0.8, 0.8, wp.side ? 0.8 : 0.04);
    const glass = new THREE.Mesh(glassGeo, glassMat.clone());
    glass.position.set(
      wp.x + (wp.side ? (wp.flip ? -0.02 : 0.02) : 0),
      wp.y,
      wp.z + (wp.side ? 0 : 0.02)
    );
    grp.add(glass);
    World.windowLights.push(glass.material);

    // Crossbar
    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(wp.side ? 0.05 : 0.04, 0.8, wp.side ? 0.04 : 0.05),
      trimMat
    );
    crossV.position.copy(glass.position);
    grp.add(crossV);
  });

  // ── DOOR ──
  const doorH = 2.2;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, doorH, 0.1), doorMat);
  door.position.set(0, doorH/2, D/2 + 0.06);
  grp.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, doorH + 0.15, 0.06), trimMat);
  doorFrame.position.set(0, doorH/2, D/2 + 0.03);
  grp.add(doorFrame);

  // Knob
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshStandardMaterial({color: 0xd4a017, metalness: 0.7, roughness: 0.3})
  );
  knob.position.set(0.3, doorH * 0.4, D/2 + 0.12);
  grp.add(knob);

  // ── SMALL PORCH ROOF ──
  const porch = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.1, 0.8),
    roofMat
  );
  porch.position.set(0, doorH + 0.1, D/2 + 0.4);
  porch.castShadow = true;
  grp.add(porch);

  // Porch supports
  for (const px of [-0.8, 0.8]) {
    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, doorH + 0.1, 5),
      logDarkMat
    );
    support.position.set(px, (doorH + 0.1)/2, D/2 + 0.7);
    support.castShadow = true;
    grp.add(support);
  }

  // ── FOUNDATION ──
  const fnd = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.3, 0.35, D + 0.3),
    new THREE.MeshLambertMaterial({color: 0x5a5a5a, flatShading: true})
  );
  fnd.position.set(0, 0.17, 0);
  grp.add(fnd);

  // ── Position the house at center of diorama ──
  grp.position.set(0, 0, 0);
  Game.worldGroup.add(grp);
  World.house = grp;

  // Zone trigger
  World.zones[ZONES.HAUS] = new THREE.Box3(
    new THREE.Vector3(-8, 0, -12), new THREE.Vector3(12, 12, 12)
  );
  // Collider
  World.colliders.push({
    type:'box',
    box: new THREE.Box3(
      new THREE.Vector3(-W/2 - 0.3, 0, -D/2 - 0.3),
      new THREE.Vector3( W/2 + 0.3, H + pitch, D/2 + 0.3)
    ),
    name:'main-house'
  });
}

// ═══════════════════════════════════════════════════════════════════
// 6. GARASI
// ═══════════════════════════════════════════════════════════════════

function buildGarage() {
  const g=new THREE.Group(); g.name='garage';
  const W=4.5,H=3,D=5.5;
  const bt=getBrickTex().clone(); bt.needsUpdate=true; bt.repeat.set(2,1.5);
  const mat=new THREE.MeshStandardMaterial({map:bt,roughness:0.9});
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+0.3,0.2,D+0.3),
    new THREE.MeshStandardMaterial({color:0x3a2818,roughness:0.8}));
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),mat);
  body.position.y=H/2; body.castShadow=body.receiveShadow=true; g.add(body);
  roof.position.y=H+0.1; roof.castShadow=true; g.add(roof);
  // Pintu garasi
  const dM=new THREE.MeshStandardMaterial({color:0x5a5248,roughness:0.7});
  const door=new THREE.Mesh(new THREE.BoxGeometry(3,2.4,0.1),dM);
  door.position.set(0,1.2,D/2+0.06); g.add(door);
  for (let i=-1;i<=1;i++) {
    const sl=new THREE.Mesh(new THREE.BoxGeometry(0.04,2.3,0.01),
      new THREE.MeshStandardMaterial({color:0x3a3228}));
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
  const lt=getGrassTex().clone(); lt.needsUpdate=true; lt.repeat.set(4,3);
  const patch=new THREE.Mesh(new THREE.PlaneGeometry(12,8),
    new THREE.MeshLambertMaterial({map:lt}));
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
// 8. KOTA MEDIEVAL — bangunan di tepi semua jalan
// ═══════════════════════════════════════════════════════════════════

function buildMedievalCity() {
  // =======================================================
  // FUNGSI HELPER: buat deretan bangunan di tepi jalan
  // axis: 'x'|'z', roadCenter: X/Z tengah jalan, side: 'pos'|'neg'
  // start/end: range koordinat sepanjang jalan
  // facing: arah pintu menghadap ke jalan
  // =======================================================
  function rowAlongRoad(axis, roadCenter, side, start, end, facing, configs) {
    const roadHalf = 2.8; // setengah lebar jalan + trotoar
    let pos = start;
    let ci = 0;
    while (pos < end && ci < configs.length) {
      const cfg = configs[ci % configs.length];
      const bw = cfg.w || 6;
      const bd = cfg.d || 5;
      const bh = cfg.h || (4.5 + Math.random());
      const gap = cfg.gap || 0.4;

      // Posisi bangunan: dinding depan menempel ke tepi jalan + offset kecil
      const wallOffset = roadHalf + bd/2 + 0.1;
      let bx, bz;
      if (axis === 'z') {
        bz = pos + bw/2;
        bx = roadCenter + (side==='pos' ? wallOffset : -wallOffset);
      } else {
        bx = pos + bw/2;
        bz = roadCenter + (side==='pos' ? wallOffset : -wallOffset);
      }

      // Skip kalau posisi ini tabrakan dengan rumah kakek-nenek
      if (Math.abs(bx-2)<10 && Math.abs(bz+4)<10 && cfg.skipNearHome) {
        pos += bw + gap; ci++; continue;
      }

      makeBuilding({
        x: bx, z: bz,
        w: bw, h: bh, d: bd,
        color: cfg.color || COLORS.BRICK,
        brick: cfg.brick !== false,
        floors: cfg.floors || 1,
        roofType: cfg.roofType || 'gable',
        windows: cfg.windows || Math.ceil(bw/3),
        facing,
        sign: cfg.sign || null,
        name: cfg.name || `row_${axis}${Math.round(roadCenter)}_${Math.round(pos)}`,
        hasShutters: cfg.hasShutters !== false,
        roofColor: cfg.roofColor || 0x3a2818,
        doorColor: cfg.doorColor || 0x4a3024,
      });

      pos += bw + gap;
      ci++;
    }
  }

  // ════════════════════════════════════════════════════
  // HAUPTSTRASSE (X=-12) — jalan utama di depan rumah
  // ════════════════════════════════════════════════════

  // Sisi BARAT (pintu menghadap TIMUR = +X = Math.PI/2)
  const hauptW_configs = [
    {w:6.5,h:5.5,d:4.5,color:0x9a4a3a,roofType:'gable',floors:2,windows:2,roofColor:0x2a1a0e},
    {w:7,  h:6,  d:5,  color:0xb05848,roofType:'gable',floors:2,windows:3,
     sign:{text:'BÄCKEREI',bg:'#3a1a08',fg:'#f4c430'}},
    {w:5.5,h:5,  d:4,  color:0xa04838,roofType:'gable',floors:1,windows:2},
    {w:8,  h:7,  d:5.5,color:0x884030,roofType:'half_hip',floors:2,windows:3,roofColor:0x2a1a0e},
    {w:6,  h:5.5,d:4.5,color:0xb85a45,roofType:'gable',floors:1,windows:2},
    {w:7,  h:6,  d:5,  color:0x904a38,roofType:'gable',floors:2,windows:2,
     sign:{text:'GASTHOF',bg:'#1a1a0a',fg:'#d4a017'}},
    {w:5,  h:5,  d:4,  color:0xa04030,roofType:'gable',floors:1,windows:2},
    {w:7,  h:6.5,d:5,  color:0x9a4838,roofType:'half_hip',floors:2,windows:3},
    {w:6.5,h:5.5,d:4.5,color:0xb04840,roofType:'gable',floors:1,windows:2},
    {w:7,  h:6,  d:5,  color:0x984030,roofType:'gable',floors:2,windows:2},
  ];
  rowAlongRoad('z',-12,'neg',-88, 80, Math.PI/2, hauptW_configs);

  // Sisi TIMUR dari Hauptstraße (X > -12, pintu ke barat = -Math.PI/2)
  // Tapi area dekat rumah kakek (X=-6..-1, Z=-10..10) harus skip
  const hauptE_configs = [
    {w:6,h:5,d:4.5,color:0xb04838,roofType:'gable',floors:1,windows:2},
    {w:7,h:6,d:5,  color:0x9a4030,roofType:'gable',floors:2,windows:3},
    {w:5.5,h:5,d:4,color:0xa84840,roofType:'gable',floors:1,windows:2},
    {w:7,h:5.5,d:4.5,color:0x884030,roofType:'half_hip',floors:2,windows:3,
     sign:{text:'METZGER',bg:'#1a0a0a',fg:'#f4c430'}},
    {w:6,h:5.5,d:4.5,color:0x9a3830,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5,  color:0xa04840,roofType:'gable',floors:2,windows:3},
    {w:6,h:5,d:4,    color:0xb05040,roofType:'gable',floors:1,windows:2},
    {w:7,h:6,d:5,    color:0x984038,roofType:'gable',floors:2,windows:2},
  ];
  // Utara rumah (Z < -12)
  rowAlongRoad('z',-12,'pos',-88,-14, -Math.PI/2, hauptE_configs);
  // Selatan rumah (Z > 10)
  rowAlongRoad('z',-12,'pos', 10, 80, -Math.PI/2, hauptE_configs);

  // ════════════════════════════════════════════════════
  // HAFENSTRASSE (X=+32) — jalan ke pelabuhan
  // ════════════════════════════════════════════════════

  const hafenW_configs = [
    {w:6,h:5,d:4.5,color:0x7a4030,roofType:'flat',floors:1,windows:3,
     sign:{text:'FISCHWAREN',bg:'#0a2a3a',fg:'#aaffee'}},
    {w:8,h:7,d:6,  color:0x6a3828,roofType:'flat',floors:2,windows:4}, // Speicherstadt style
    {w:7,h:8,d:6,  color:0x6e3a28,roofType:'flat',floors:2,windows:3,
     sign:{text:'HAFEN LAGER',bg:'#0a1a2a',fg:'#f4c430'}},
    {w:9,h:9,d:7,  color:0x5a3020,roofType:'flat',floors:3,windows:4},
    {w:6,h:5.5,d:5,color:0x783828,roofType:'flat',floors:1,windows:2},
    {w:8,h:8,d:6,  color:0x6a3422,roofType:'flat',floors:2,windows:3},
    {w:7,h:6,d:5,  color:0x5a2a1a,roofType:'flat',floors:2,windows:2,
     sign:{text:'HAFEN',bg:'#0a1a3a',fg:'#ffdd88'}},
    {w:9,h:9,d:7,  color:0x622e1e,roofType:'flat',floors:3,windows:4},
  ];
  rowAlongRoad('z',32,'neg',-88, 85,  Math.PI/2, hafenW_configs);
  rowAlongRoad('z',32,'pos',-88, 85, -Math.PI/2, hafenW_configs.slice(0,5));

  // ════════════════════════════════════════════════════
  // KLEINE GASSE (X=-48) — kuartal barat
  // ════════════════════════════════════════════════════

  const kleineConfigs = [
    {w:5,h:4.5,d:4,color:0xa04838,roofType:'gable',floors:1,windows:1},
    {w:5.5,h:5,d:4,color:0x984030,roofType:'gable',floors:1,windows:2},
    {w:6,h:5.5,d:4.5,color:0xb04840,roofType:'gable',floors:2,windows:2},
    {w:5,h:5,d:4,color:0xa03828,roofType:'gable',floors:1,windows:1,
     sign:{text:'SCHULE',bg:'#2a1808',fg:'#f4c430'}},
    {w:6,h:5.5,d:4.5,color:0x984038,roofType:'gable',floors:2,windows:2},
    {w:5.5,h:4.5,d:4,color:0xb04030,roofType:'gable',floors:1,windows:1},
  ];
  rowAlongRoad('z',-48,'neg',-55, 50,  Math.PI/2, kleineConfigs);
  rowAlongRoad('z',-48,'pos',-55, 50, -Math.PI/2, kleineConfigs);

  // ════════════════════════════════════════════════════
  // AM MARKT (Z=+4) — jalan horizontal utama
  // ════════════════════════════════════════════════════

  const amMarktS_configs = [
    {w:6,h:5,d:4.5,color:0xa04838,roofType:'gable',floors:1,windows:2},
    {w:7,h:6,d:5,  color:0x904030,roofType:'gable',floors:2,windows:3},
    {w:5.5,h:5,d:4,color:0xb04840,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5,color:0x884038,roofType:'half_hip',floors:2,windows:3,
     sign:{text:'EDEKA',bg:'#1a4dd1',fg:'#ffd84d'}},
    {w:6.5,h:5.5,d:5,color:0x9a4030,roofType:'gable',floors:1,windows:2},
    {w:7,h:6.5,d:5, color:0xb04840,roofType:'gable',floors:2,windows:3},
    {w:6,h:5,d:4.5, color:0xa04030,roofType:'gable',floors:1,windows:2},
    {w:5.5,h:5,d:4, color:0x984038,roofType:'gable',floors:1,windows:2},
  ];
  const amMarktN_configs = [
    {w:7,h:6,d:5,  color:0x9a4838,roofType:'gable',floors:2,windows:2},
    {w:6,h:5.5,d:4.5,color:0xa04030,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5, color:0x884030,roofType:'half_hip',floors:2,windows:3,
     sign:{text:'RATHAUS',bg:'#1a1a0a',fg:'#d4a017'}},
    {w:5.5,h:5,d:4, color:0xb04840,roofType:'gable',floors:1,windows:2},
    {w:7,h:6.5,d:5, color:0x9a4038,roofType:'gable',floors:2,windows:2},
    {w:6,h:5,d:4.5, color:0xa84038,roofType:'gable',floors:1,windows:1},
    {w:7,h:6,d:5,   color:0x984030,roofType:'gable',floors:2,windows:3},
  ];
  // Sisi selatan (Z > 4), pintu menghadap utara (-Math.PI)
  rowAlongRoad('x', 4,'pos',-88, 85, Math.PI, amMarktS_configs);
  // Sisi utara (Z < 4), pintu menghadap selatan (0)
  rowAlongRoad('x', 4,'neg',-88, 85, 0,       amMarktN_configs);

  // ════════════════════════════════════════════════════
  // NORDALLEE (Z=-38) — jalan atas
  // ════════════════════════════════════════════════════

  rowAlongRoad('x',-38,'pos',-88,85, Math.PI, [
    {w:7,h:6,d:5,color:0x9a4030,roofType:'gable',floors:2,windows:2},
    {w:6,h:5.5,d:4.5,color:0xa84040,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5,color:0x884030,roofType:'half_hip',floors:2,windows:3,
     sign:{text:'BIBLIOTHEK',bg:'#1a1a0a',fg:'#f4c430'}},
    {w:5.5,h:5,d:4,color:0x9a3838,roofType:'gable',floors:1,windows:1},
    {w:7,h:6.5,d:5,color:0xa04038,roofType:'gable',floors:2,windows:3},
    {w:6,h:5,d:4.5,color:0xb04840,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5,color:0x884038,roofType:'flat',floors:2,windows:3,
     sign:{text:'APOTHEKE',bg:'#083a10',fg:'#88ff88'}},
  ]);
  rowAlongRoad('x',-38,'neg',-88,85, 0, [
    {w:6,h:5,d:4.5,color:0xa04030,roofType:'gable',floors:1,windows:2},
    {w:7,h:6,d:5,color:0x984038,roofType:'gable',floors:2,windows:3},
    {w:5.5,h:5,d:4,color:0xb04840,roofType:'gable',floors:1,windows:1},
    {w:8,h:7,d:6,color:0x884030,roofType:'half_hip',floors:2,windows:3},
    {w:6,h:5.5,d:4.5,color:0xa84838,roofType:'gable',floors:1,windows:2},
    {w:7,h:6.5,d:5,color:0x9a3830,roofType:'gable',floors:2,windows:2},
  ]);

  // ════════════════════════════════════════════════════
  // SUEDGASSE (Z=+42) — jalan bawah
  // ════════════════════════════════════════════════════

  rowAlongRoad('x',42,'pos',-88,85, Math.PI, [
    {w:7,h:6,d:5,color:0x9a4030,roofType:'gable',floors:2,windows:2},
    {w:6,h:5.5,d:4.5,color:0xa04838,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5,color:0x884040,roofType:'half_hip',floors:2,windows:3,
     sign:{text:'RESTAURANT',bg:'#1a0a0a',fg:'#f4c430'}},
    {w:6,h:5.5,d:4.5,color:0xb04030,roofType:'gable',floors:1,windows:2},
    {w:7,h:6,d:5,color:0x984038,roofType:'gable',floors:2,windows:3},
    {w:5.5,h:5,d:4,color:0xa84838,roofType:'gable',floors:1,windows:1},
    {w:8,h:6.5,d:5.5,color:0x884030,roofType:'flat',floors:2,windows:3},
    {w:6,h:5,d:4.5,color:0xa04030,roofType:'gable',floors:1,windows:2},
  ]);
  rowAlongRoad('x',42,'neg',-88,85, 0, [
    {w:6,h:5,d:4.5,color:0xa04838,roofType:'gable',floors:1,windows:2},
    {w:7,h:6.5,d:5,color:0x984030,roofType:'gable',floors:2,windows:3},
    {w:8,h:7,d:6,color:0x884038,roofType:'flat',floors:2,windows:4},
    {w:5.5,h:5,d:4,color:0xb04838,roofType:'gable',floors:1,windows:1},
    {w:7,h:6,d:5,color:0x9a4030,roofType:'gable',floors:2,windows:2},
    {w:6,h:5.5,d:4.5,color:0xa84040,roofType:'gable',floors:1,windows:2},
    {w:8,h:7,d:5.5,color:0x884028,roofType:'half_hip',floors:2,windows:3},
  ]);

  // ════════════════════════════════════════════════════
  // GASSE KECIL (Z=-16, X range) & (X=-28)
  // ════════════════════════════════════════════════════

  rowAlongRoad('x',-16,'pos',-50,-14, Math.PI, [
    {w:5,h:4.5,d:4,color:0xa04030,roofType:'gable',floors:1,windows:1},
    {w:5.5,h:5,d:4,color:0x984038,roofType:'gable',floors:1,windows:2},
    {w:6,h:5.5,d:4.5,color:0xb04838,roofType:'gable',floors:2,windows:2},
  ]);
  rowAlongRoad('x',-16,'neg',-50,-14, 0, [
    {w:5.5,h:5,d:4,color:0xa04838,roofType:'gable',floors:1,windows:2},
    {w:6,h:5.5,d:4.5,color:0x984030,roofType:'gable',floors:2,windows:2},
    {w:5,h:4.5,d:4,color:0xb04030,roofType:'gable',floors:1,windows:1},
  ]);

  rowAlongRoad('z',-28,'neg',-38, 5,  Math.PI/2, [
    {w:5.5,h:5,d:4,color:0xa04030,roofType:'gable',floors:1,windows:2},
    {w:6,h:5.5,d:4.5,color:0xb04838,roofType:'gable',floors:2,windows:2},
    {w:5,h:4.5,d:4,color:0x984038,roofType:'gable',floors:1,windows:1},
  ]);
  rowAlongRoad('z',-28,'pos',-38, 5, -Math.PI/2, [
    {w:5.5,h:5,d:4,color:0xa84030,roofType:'gable',floors:1,windows:2},
    {w:6,h:5,d:4.5,color:0x984838,roofType:'gable',floors:2,windows:2},
    {w:5.5,h:4.5,d:4,color:0xb03028,roofType:'gable',floors:1,windows:1},
  ]);

  // ════════════════════════════════════════════════════
  // TEPI DUNIA: tembok/bangunan rapat supaya tidak bisa lihat ujung
  // Baris bangunan tebal di X = -92, +92, Z = -92, +92
  // ════════════════════════════════════════════════════

  // Tembok kota di keempat sisi (bangunan besar rapat)
  function addWallRow(axis, atCoord, from, to, side) {
    const d=8;
    const wallConfigs=[
      {w:10,h:9,d,color:0x6a3828,roofType:'flat',windows:2,hasShutters:false},
      {w:12,h:10,d,color:0x5a3020,roofType:'flat',windows:3,hasShutters:false},
      {w:10,h:9,d,color:0x6a3020,roofType:'flat',windows:2,hasShutters:false},
      {w:11,h:11,d,color:0x5a2a18,roofType:'flat',windows:2,hasShutters:false},
      {w:10,h:9,d,color:0x623020,roofType:'flat',windows:2,hasShutters:false},
    ];
    rowAlongRoad(axis, atCoord, side, from, to, 0, wallConfigs);
  }
  addWallRow('x', -90, -100, 100,'pos');
  addWallRow('x',  90, -100, 100,'neg');
  addWallRow('z', -90, -100, 100,'pos');
  addWallRow('z',  90, -100, 100,'neg');
}

// ═══════════════════════════════════════════════════════════════════
// 9. POHON — di luar jalur jalan
// ═══════════════════════════════════════════════════════════════════

function buildTrees() {
  const trunkMat=new THREE.MeshStandardMaterial({color:0x4a3020,roughness:0.9});
  const leafMat=new THREE.MeshStandardMaterial({color:0x3a7228,roughness:0.85});

  // Posisi pohon — di area yang TIDAK di jalan (dibuat manual untuk terkontrol)
  const treePos = [
    // Taman kota (sekitar Z=-55 s/d Z=-75, X=-20 s/d X=+10)
    {x:-15,z:-55,s:1.3},{x:-5,z:-60,s:1.5},{x:5,z:-58,s:1.2},{x:-10,z:-68,s:1.6},
    {x:3,z:-70,s:1.4},{x:-18,z:-65,s:1.1},{x:8,z:-65,s:1.3},{x:-8,z:-55,s:1.0},
    // Sekitar rumah kakek-nenek
    {x:7,z:-8,s:1.2},{x:7,z:-14,s:1.1},{x:15,z:-10,s:1.3},
    // Koridor di antara jalan (X: -47..-30, Z: -38..4)
    {x:-38,z:-30,s:1.0},{x:-35,z:-20,s:1.2},{x:-40,z:-10,s:1.1},
    {x:-36,z:0,s:1.3},{x:-38,z:10,s:1.0},
    // Area antara Hafenstraße dan tepi dunia
    {x:50,z:-25,s:1.0},{x:55,z:-10,s:1.1},{x:52,z:5,s:1.2},
    {x:50,z:20,s:1.0},{x:55,z:35,s:1.1},
    // Taman selatan kota
    {x:-20,z:55,s:1.2},{x:-5,z:58,s:1.4},{x:10,z:55,s:1.1},
    {x:20,z:60,s:1.3},{x:-12,z:65,s:1.0},
  ];

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
  const poleMat=new THREE.MeshStandardMaterial({color:0x1a1a18,metalness:0.5,roughness:0.5});
  const headMat=new THREE.MeshStandardMaterial({
    color:0xffe8b0, emissive:0xffcc44, emissiveIntensity:0.0, roughness:0.3});
  const armGeo=new THREE.BoxGeometry(0.55,0.04,0.04);

  // Posisi di tepi jalan (antara jalan dan bangunan, bukan di tengah)
  const lamps=[
    // Hauptstraße kiri (X=-10.5)
    ...[[-10.5,-60],[-10.5,-48],[-10.5,-36],[-10.5,-24],[-10.5,-12],[-10.5,0],[-10.5,12],[-10.5,24],[-10.5,36],[-10.5,50]].map(([x,z])=>({x,z,m:true})),
    // Hauptstraße kanan (X=-13.5)
    ...[[-13.5,-60],[-13.5,-40],[-13.5,-20],[-13.5,0],[-13.5,20],[-13.5,40],[-13.5,60]].map(([x,z])=>({x,z,m:false})),
    // Am Markt north (Z=1.5)
    ...[[-75,1.5],[-60,1.5],[-45,1.5],[-30,1.5],[-15,1.5],[5,1.5],[20,1.5],[35,1.5],[55,1.5],[70,1.5]].map(([x,z])=>({x,z,m:false})),
    // Hafenstraße (X=29.5)
    ...[[29.5,-65],[29.5,-45],[29.5,-25],[29.5,-5],[29.5,15],[29.5,35],[29.5,55],[29.5,72]].map(([x,z])=>({x,z,m:false})),
  ];

  lamps.forEach(p=>{
    if(!isFinite(p.x)||!isFinite(p.z)) return;
    const g=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,4.8,8),poleMat);
    pole.position.y=2.4; pole.castShadow=true; g.add(pole);
    const arm=new THREE.Mesh(armGeo,poleMat);
    arm.position.set(p.m?0.3:-0.3,4.5,0); g.add(arm);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.18,10,10),headMat.clone());
    head.position.set(p.m?0.55:-0.55,4.4,0); g.add(head);
    const light=new THREE.PointLight(0xffcc44,0,8,1.5);
    light.position.copy(head.position); g.add(light);
    g.position.set(p.x,0,p.z);
    Game.worldGroup.add(g);
    World.streetLamps.push({group:g,head,light});
    World.colliders.push({type:'cylinder',x:p.x,z:p.z,radius:0.2});
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
    sp.position.set(-120+Math.random()*240,22+Math.random()*12,-120+Math.random()*240);
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

function buildHausDiorama() {
  const lpMat = (c) => new THREE.MeshLambertMaterial({color:c, flatShading:true});

  // ── 1. RAISED PLATFORM BASE (like reference diorama) ──
  const baseGeo = new THREE.BoxGeometry(28, 0.6, 28);
  const baseMesh = new THREE.Mesh(baseGeo, lpMat(0xddddcc));
  baseMesh.position.set(0, -0.3, 0);
  baseMesh.receiveShadow = true;
  Game.worldGroup.add(baseMesh);
  World.walkables.push(baseMesh);

  // ── 2. STRAIGHT RIVER CANAL (left side, under the bridge) ──
  const riverW = 4, riverL = 32;
  const riverGeo = new THREE.PlaneGeometry(riverW, riverL, 10, 36);
  const rp = riverGeo.attributes.position;
  for(let i=0;i<rp.count;i++) rp.setZ(i,(Math.random()-0.5)*0.1);
  riverGeo.computeVertexNormals();

  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256;
  waterCanvas.height = 256;
  const waterCtx = waterCanvas.getContext('2d');
  const waterGrad = waterCtx.createLinearGradient(0, 0, 0, 256);
  waterGrad.addColorStop(0, '#65e7ff');
  waterGrad.addColorStop(0.5, '#22bdf4');
  waterGrad.addColorStop(1, '#0d8fd6');
  waterCtx.fillStyle = waterGrad;
  waterCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i++) {
    waterCtx.strokeStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.2})`;
    waterCtx.lineWidth = 1 + Math.random() * 2;
    waterCtx.beginPath();
    const y = Math.random() * 256;
    waterCtx.moveTo(Math.random() * 80, y);
    waterCtx.quadraticCurveTo(120 + Math.random() * 40, y - 10 + Math.random() * 20, 230 + Math.random() * 30, y);
    waterCtx.stroke();
  }
  const waterTex = new THREE.CanvasTexture(waterCanvas);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(1.4, 5.5);
  waterTex.colorSpace = THREE.SRGBColorSpace;

  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    color: 0x35d7ff,
    emissive: 0x0b6fa8,
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.15,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });

  const waterBed = new THREE.Mesh(
    new THREE.BoxGeometry(riverW + 0.35, 0.08, riverL + 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x14bff2,
      emissive: 0x0b79b8,
      emissiveIntensity: 0.18,
      roughness: 0.28,
      metalness: 0.05,
    })
  );
  waterBed.position.set(-7, 0.06, 0);
  waterBed.rotation.y = 0;
  waterBed.receiveShadow = false;
  waterBed.renderOrder = 1;
  Game.worldGroup.add(waterBed);

  const river = new THREE.Mesh(riverGeo, waterMat);
  river.rotation.x=-Math.PI/2;
  river.rotation.z=0;
  river.position.set(-7, 0.18, 0);
  river.renderOrder = 2;
  Game.worldGroup.add(river);

  World.colliders.push({
    type: 'box',
    box: new THREE.Box3(
      new THREE.Vector3(-9.25, 0, -16.5),
      new THREE.Vector3(-4.75, 1.2, 0.5)
    ),
    name: 'river-water-north',
  });
  World.colliders.push({
    type: 'box',
    box: new THREE.Box3(
      new THREE.Vector3(-9.25, 0, 3.5),
      new THREE.Vector3(-4.75, 1.2, 16.5)
    ),
    name: 'river-water-south',
  });

  World._updateRiver = (d, t) => {
    const p=riverGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      p.setZ(i, Math.sin(p.getX(i)*2.4+t*2.2)*0.08+Math.cos(p.getY(i)*0.75+t*1.4)*0.05);
    }
    p.needsUpdate=true;
    riverGeo.computeVertexNormals();
    waterTex.offset.y = t * 0.08;
    waterTex.offset.x = Math.sin(t * 0.7) * 0.03;
  };

  // ── 3. WOODEN BRIDGE over river → leads to portal ──
  const bridgeGrp = new THREE.Group();
  // Deck
  const deckMat = lpMat(0xeeddcc);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 2.5), deckMat);
  deck.position.y = 0.12; deck.castShadow=true; deck.receiveShadow=true;
  bridgeGrp.add(deck);
  World.walkables.push(deck); // Allow player to walk on bridge
  // Planks detail
  for(let i=-2;i<=2;i++){
    const plank=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.05,2.5),lpMat(0xccb090));
    plank.position.set(i*0.9,0.22,0); bridgeGrp.add(plank);
  }
  // Railings
  const railMat = lpMat(0xf5ede0);
  for(const zs of [-1.2,1.2]){
    // Posts
    for(const xp of [-1.8,-0.6,0.6,1.8]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.2,0.12),railMat);
      post.position.set(xp,0.72,zs); post.castShadow=true; bridgeGrp.add(post);
    }
    // Horizontal rail
    const rail=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.1,0.08),railMat);
    rail.position.set(0,1.12,zs); bridgeGrp.add(rail);
    const rail2=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.1,0.08),railMat);
    rail2.position.set(0,0.52,zs); bridgeGrp.add(rail2);
  }
  bridgeGrp.position.set(-7, 0, 2);
  Game.worldGroup.add(bridgeGrp);

  // Water visible under the bridge
  const bridgeWaterMat = waterMat.clone();
  bridgeWaterMat.opacity = 0.86;
  bridgeWaterMat.map = waterTex;
  const bridgeWater = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3),
    bridgeWaterMat
  );
  bridgeWater.rotation.x = -Math.PI/2;
  bridgeWater.position.set(-7, 0.19, 2);
  bridgeWater.renderOrder = 3;
  Game.worldGroup.add(bridgeWater);

  // Grassland on the far side of the bridge.
  const farGrass = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.06, 28),
    lpMat(0x5aa43a)
  );
  farGrass.position.set(-11.5, 0.04, 0);
  farGrass.receiveShadow = true;
  Game.worldGroup.add(farGrass);
  World.walkables.push(farGrass);

  // ── 4. COBBLESTONE PATH from house to bridge ──
  const pathMat = lpMat(0xd4c4a0);
  // Straight path from house front to bridge
  const mainPath=new THREE.Mesh(new THREE.BoxGeometry(2,0.04,8),pathMat);
  mainPath.position.set(-2,0.03,2); mainPath.receiveShadow=true;
  Game.worldGroup.add(mainPath);
  World.walkables.push(mainPath);
  // Turn toward bridge
  const turnPath=new THREE.Mesh(new THREE.BoxGeometry(4,0.04,2),pathMat);
  turnPath.position.set(-5,0.03,2); turnPath.receiveShadow=true;
  Game.worldGroup.add(turnPath);
  World.walkables.push(turnPath);

  const nearBridgeLanding = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 2.6), pathMat);
  nearBridgeLanding.position.set(-5.4, 0.06, 2);
  nearBridgeLanding.receiveShadow = true;
  Game.worldGroup.add(nearBridgeLanding);
  World.walkables.push(nearBridgeLanding);

  const farBridgeLanding = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 2.6), lpMat(0x5aa43a));
  farBridgeLanding.position.set(-8.9, 0.06, 2);
  farBridgeLanding.receiveShadow = true;
  Game.worldGroup.add(farBridgeLanding);
  World.walkables.push(farBridgeLanding);

  // ── 5. WINDMILL (behind-right of house, like reference) ──
  const wmGrp = new THREE.Group();
  // Tower (tapered cylinder)
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.8,7,6),lpMat(0xbbbbaa));
  tower.position.y=3.5; tower.castShadow=true; wmGrp.add(tower);
  // Stone detail bands
  for(const by of [1.5,3.5,5.5]){
    const band=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.55,0.15,6),lpMat(0x999988));
    band.position.y=by; wmGrp.add(band);
  }
  // Window on tower
  const wmWin=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.1),
    new THREE.MeshStandardMaterial({color:0xffcc66,emissive:0xffaa22,emissiveIntensity:0.5,transparent:true,opacity:0.8}));
  wmWin.position.set(0,4.5,1.55); wmGrp.add(wmWin);
  // Roof
  const wmRoof=new THREE.Mesh(new THREE.ConeGeometry(1.6,2,6),lpMat(0x8a4533));
  wmRoof.position.y=8; wmRoof.castShadow=true; wmGrp.add(wmRoof);
  // Blades hub
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.4,6),lpMat(0x6B4226));
  hub.rotation.x=Math.PI/2; hub.position.set(0,6,1.65); wmGrp.add(hub);
  // Blades
  const blades=new THREE.Group();
  for(let i=0;i<4;i++){
    const arm=new THREE.Group();
    // Main beam
    const beam=new THREE.Mesh(new THREE.BoxGeometry(0.15,4.5,0.12),lpMat(0xC4956A));
    beam.position.y=2.25; arm.add(beam);
    // Sail (wider planks)
    const sail=new THREE.Mesh(new THREE.BoxGeometry(0.08,3.5,0.6),lpMat(0xDEC9A0));
    sail.position.set(0,2.5,0); arm.add(sail);
    arm.rotation.z=(Math.PI/2)*i;
    blades.add(arm);
  }
  blades.position.set(0,6,1.8);
  wmGrp.add(blades);
  // Position: behind-right of house
  wmGrp.position.set(5,0,-5);
  Game.worldGroup.add(wmGrp);
  // Windmill collider
  World.colliders.push({type:'cylinder',x:5,z:-5,radius:2});

  // ── 6. ROCKS ──
  const rockGeo=new THREE.DodecahedronGeometry(1,0);
  const rockMat=lpMat(0x889988);
  const rockMat2=lpMat(0x778877);
  [[-5.5,0.2,-6,0.8],[-8,0.1,5,0.6],[-9,-0.1,-3,1.0],[8,0.3,-8,0.7],
   [10,0.2,6,0.5],[-5,0.15,8,0.4],[7,0.4,8,0.6]].forEach(([x,y,z,s])=>{
    const r=new THREE.Mesh(rockGeo, Math.random()>0.5?rockMat:rockMat2);
    r.scale.set(s,s*0.7,s); r.position.set(x,y,z);
    r.rotation.set(Math.random(),Math.random(),Math.random());
    r.castShadow=true; r.receiveShadow=true;
    Game.worldGroup.add(r);
  });

  // ── 7. PINE TREES (scattered around edges like reference) ──
  const pinePositions=[
    {x:-4,z:-9,s:1.3}, {x:0,z:11,s:1.2},
    {x:9,z:-9,s:1.4},{x:10,z:-4,s:1.1},{x:12,z:2,s:1.3},{x:12,z:8,s:1.0},
    {x:-3,z:10,s:0.9},{x:3,z:10,s:1.1},{x:10,z:11,s:0.8},
    {x:3,z:-10,s:1.2},{x:-6,z:10,s:1.0},
    // Small pines near house
    {x:-3,z:-3,s:0.5},{x:12,z:4,s:0.7},
    // Forest across the bridge
    {x:-12.7,z:-11,s:1.3},{x:-10.6,z:-8,s:1.0},{x:-12.5,z:-4,s:1.2},
    {x:-10.8,z:7,s:1.1},{x:-12.8,z:10,s:1.4},{x:-10.2,z:12,s:0.9},
    {x:-13.2,z:-14,s:0.9},{x:-11.4,z:-13,s:1.2},{x:-13.3,z:-7,s:1.0},
    {x:-11.9,z:9,s:0.8},{x:-13.5,z:13,s:1.1},
  ];
  const trunkMat=lpMat(0x6B4226);
  pinePositions.forEach(p=>{
    const tree=new THREE.Group();
    // Trunk
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.1*p.s,0.15*p.s,1.5*p.s,5),trunkMat);
    trunk.position.y=0.75*p.s; trunk.castShadow=true; tree.add(trunk);
    // 3 cone layers (bottom big → top small)
    const leafCol=[0x2d6e1e,0x3a8a2c,0x2a5e18];
    for(let l=0;l<3;l++){
      const r=(1.2-l*0.3)*p.s, h=(1.4-l*0.2)*p.s;
      const cone=new THREE.Mesh(new THREE.ConeGeometry(r,h,6),lpMat(leafCol[l]));
      cone.position.y=(1.2+l*0.8)*p.s; cone.castShadow=true; tree.add(cone);
    }
    tree.position.set(p.x,0,p.z);
    Game.worldGroup.add(tree);
    World.colliders.push({type:'cylinder',x:p.x,z:p.z,radius:0.3});
  });

  // ── 8. GRASS TUFTS ──
  const grassMat=lpMat(0x4a9a2a);
  for(let i=0;i<40;i++){
    const gx=(Math.random()-0.5)*22, gz=(Math.random()-0.5)*22;
    if(Math.abs(gx)<3&&Math.abs(gz)<3) continue; // skip near house
    const tuft=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.3,3),grassMat);
    tuft.position.set(gx,0.15,gz); Game.worldGroup.add(tuft);
  }

  // ── 8.1 NPC ACTIVITY PROPS ──
  // Oma's gardening patch (Dirt patch + some small plants)
  const dirtMat = lpMat(0x4a3219);
  const patch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.5), dirtMat);
  patch.position.set(2, 0.02, 4);
  patch.receiveShadow = true;
  Game.worldGroup.add(patch);
  for(let i=0; i<4; i++){
    const plant = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), lpMat(0x3a8a2c));
    plant.position.set(2 + (Math.random()-0.5)*1, 0.2, 4 + (Math.random()-0.5)*1);
    plant.castShadow = true;
    Game.worldGroup.add(plant);
  }

  // Bench for Tante Maria and Onkel Andre, placed in the open right-side area.
  const benchGrp = new THREE.Group();
  const woodMat = lpMat(0x8a5a32);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.6), woodMat);
  seat.position.set(0, 0.4, 0); seat.castShadow = true; benchGrp.add(seat);
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.1), woodMat);
  backrest.position.set(0, 0.7, -0.25); backrest.castShadow = true; benchGrp.add(backrest);
  const legGeo = new THREE.BoxGeometry(0.1, 0.4, 0.6);
  const legL = new THREE.Mesh(legGeo, woodMat); legL.position.set(-0.8, 0.2, 0); legL.castShadow = true; benchGrp.add(legL);
  const legR = new THREE.Mesh(legGeo, woodMat); legR.position.set(0.8, 0.2, 0); legR.castShadow = true; benchGrp.add(legR);
  benchGrp.position.set(6.8, 0, 5.35);
  benchGrp.rotation.y = 0;
  Game.worldGroup.add(benchGrp);
  World.colliders.push({
    type: 'box',
    box: new THREE.Box3(
      new THREE.Vector3(5.65, 0, 4.95),
      new THREE.Vector3(7.95, 1.2, 5.75)
    ),
    name: 'bench',
  });

  // ── 9. AMBIENT PARTICLES & BIRDS ──
  const partGeo=new THREE.BufferGeometry();
  const pc=40;
  const pp=new Float32Array(pc*3), ph=new Float32Array(pc);
  for(let i=0;i<pc;i++){
    pp[i*3]=(Math.random()-0.5)*20; pp[i*3+1]=1+Math.random()*4;
    pp[i*3+2]=(Math.random()-0.5)*20; ph[i]=Math.random()*Math.PI*2;
  }
  partGeo.setAttribute('position',new THREE.BufferAttribute(pp,3));
  const particles=new THREE.Points(partGeo,
    new THREE.PointsMaterial({color:0xffffcc,size:0.12,transparent:true,opacity:0.5}));
  Game.worldGroup.add(particles);

  // Birds
  const birdGrp=new THREE.Group();
  const bGeo=new THREE.ConeGeometry(0.12,0.35,3); bGeo.rotateX(Math.PI/2);
  for(let i=0;i<5;i++){
    const b=new THREE.Mesh(bGeo,new THREE.MeshBasicMaterial({color:0x333333}));
    b.userData={off:Math.random()*6.28,spd:0.2+Math.random()*0.3,rad:6+Math.random()*5};
    birdGrp.add(b);
  }
  Game.worldGroup.add(birdGrp);

  World._updateAmbient=(d,t)=>{
    blades.rotation.z-=d*0.3; // slow windmill
    // Particles float
    const pa=partGeo.attributes.position;
    for(let i=0;i<pc;i++) pa.setY(i,1+Math.sin(t*1.5+ph[i])*0.5+Math.random()*0.01);
    pa.needsUpdate=true;
    // Birds circle
    birdGrp.children.forEach(b=>{
      const tt=t*b.userData.spd+b.userData.off;
      b.position.set(Math.cos(tt)*b.userData.rad,10+Math.sin(tt*0.5),Math.sin(tt)*b.userData.rad);
      b.rotation.y=-tt; b.scale.x=1+Math.sin(t*12)*0.4;
    });
  };
}

// ═══════════════════════════════════════════════════════════════════
// 12. API PUBLIK
// ═══════════════════════════════════════════════════════════════════

export function buildZone(zoneId, def) {
  // Cleanup is now handled by zone.js (unloadCurrentZone)
  
  buildGround(zoneId);

  if (zoneId === ZONES.HAUS) {
    buildMainHouse();
    buildHausDiorama();
  } else {
    buildRoads();
    buildMedievalCity();
    buildTrees();
    buildLamps();
    buildRiver();
  }

  buildClouds();

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
