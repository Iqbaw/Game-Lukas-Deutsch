// ═══════════════════════════════════════════════════════════════════
// js/world.js — KOTA HAMBURG MEDIEVAL
// Layout tidak teratur khas desa Jerman abad pertengahan:
// jalan sempit berkelok, bangunan di tepi jalan, selalu ada bangunan.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { buildQuestItem, buildOpenStorage } from './items.js';
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
  ASPHALT: 0x4a4a4a,
  LINE: 0xffffff,
  CROSSWALK: 0xdddddd,
  SIDEWALK: 0x999999,
  GRASS: 0xa8d973, // light vibrant green
};

// ═══════════════════════════════════════════════════════════════════
// 2. GROUND
// ═══════════════════════════════════════════════════════════════════

function buildGround(zoneId) {
  const size = CONFIG.ZONE_SIZE || 80;

  if (zoneId === ZONES.HAFEN) {
    // Harbor zone builds its own ground in buildHarborGround()
    return;
  }

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
    // Kota terpadu — ground rumput besar (84×64)
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(88, 68),
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
// 3. JALAN COBBLESTONE
// ═══════════════════════════════════════════════════════════════════

function buildRoads() {
  const roadW = 8;
  const gridW = 40; // Spacing between roads

  const roadMat = lpMat(MODERN_COLORS.ASPHALT);
  const lineMat = lpMat(MODERN_COLORS.LINE);
  const sideMat = lpMat(MODERN_COLORS.SIDEWALK);
  
  function createRoad(isX, centerPos) {
    const len = 60;
    const w = roadW;
    
    // Main asphalt
    const rGeo = new THREE.PlaneGeometry(isX ? len : w, isX ? w : len);
    const rMesh = new THREE.Mesh(rGeo, roadMat);
    rMesh.rotation.x = -Math.PI/2;
    rMesh.position.set(isX ? 0 : centerPos, 0.02, isX ? centerPos : 0);
    rMesh.receiveShadow = true;
    Game.worldGroup.add(rMesh);

    // Center dash lines
    const dashL = 2;
    const dashSpace = 2;
    const numDashes = Math.floor(len / (dashL + dashSpace));
    const start = -len/2 + dashL/2;
    
    for (let i=0; i<numDashes; i++) {
      const dPos = start + i * (dashL + dashSpace);
      // Skip intersection area
      if (Math.abs(dPos) < roadW/2 + 2) continue;
      
      const lGeo = new THREE.PlaneGeometry(isX ? dashL : 0.2, isX ? 0.2 : dashL);
      const lMesh = new THREE.Mesh(lGeo, lineMat);
      lMesh.rotation.x = -Math.PI/2;
      lMesh.position.set(isX ? dPos : centerPos, 0.025, isX ? centerPos : dPos);
      Game.worldGroup.add(lMesh);
    }
    
    // Sidewalks
    for (const dir of [-1, 1]) {
      const swGeo = new THREE.BoxGeometry(isX ? len : 1.5, 0.15, isX ? 1.5 : len);
      const swMesh = new THREE.Mesh(swGeo, sideMat);
      const off = (w/2 + 0.75) * dir;
      swMesh.position.set(isX ? 0 : centerPos+off, 0.075, isX ? centerPos+off : 0);
      swMesh.receiveShadow = true;
      Game.worldGroup.add(swMesh);
      World.walkables.push(swMesh);
    }
  }

  // Create grid
  createRoad(true, -16);
  createRoad(true, 16);
  createRoad(false, -16);
  createRoad(false, 16);
  
  // Crosswalks at intersections
  function addCrosswalk(x, z, rotY) {
    const cwGrp = new THREE.Group();
    for (let i=-2.5; i<=2.5; i+=1) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, roadW - 1), lineMat);
      p.rotation.x = -Math.PI/2;
      p.position.set(i, 0.03, 0);
      cwGrp.add(p);
    }
    cwGrp.position.set(x, 0, z);
    cwGrp.rotation.y = rotY;
    Game.worldGroup.add(cwGrp);
  }
  
  // Intersections
  const inters = [[-16, -16], [-16, 16], [16, -16], [16, 16]];
  inters.forEach(([ix, iz]) => {
    addCrosswalk(ix - roadW/2 - 1.5, iz, 0);
    addCrosswalk(ix + roadW/2 + 1.5, iz, 0);
    addCrosswalk(ix, iz - roadW/2 - 1.5, Math.PI/2);
    addCrosswalk(ix, iz + roadW/2 + 1.5, Math.PI/2);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 4. BUILDING GENERATORS — All specific Hamburg buildings
// ═══════════════════════════════════════════════════════════════════

function makeSign(text, bg, fg, w=3, h=0.7) {
  const c=document.createElement('canvas'); c.width=512; c.height=128;
  const ctx=c.getContext('2d');
  ctx.fillStyle=bg||'#222'; ctx.fillRect(0,0,512,128);
  ctx.fillStyle=fg||'#fff'; ctx.font='bold 48px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,256,64);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:0.2}));
}

// Helper: create mesh and set position (Object.assign can't overwrite .position in Three.js 0.158+)
function mP(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function addWin(grp,w,d,floors,perRow,gM) {
  for(let f=0;f<floors;f++){const y=1.8+f*2.2;for(let i=0;i<perRow;i++){
    const xx=-w/2+(w/(perRow+1))*(i+1);
    grp.add(mP(new THREE.BoxGeometry(0.85,1.05,0.06),lpMat(0xdddddd),xx,y,d/2+0.03));
    grp.add(mP(new THREE.BoxGeometry(0.7,0.9,0.06),gM,xx,y,d/2+0.06));
  }}
}

function bldg(o) {
  const {x=0,z=0,w=6,h=5,d=5,color=0x888888,rotY=0,name='b'}=o;
  const g=new THREE.Group(); g.name=name;
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lpMat(color));
  body.position.y=h/2; body.castShadow=true; body.receiveShadow=true; g.add(body);
  g.add(mP(new THREE.BoxGeometry(w+0.2,0.3,d+0.2),lpMat(0x777777),0,0.15,0));
  g.add(mP(new THREE.BoxGeometry(1.2,2.2,0.1),lpMat(0x6B4226),0,1.1,d/2+0.02));
  g.position.set(x,0,z); g.rotation.y=rotY;
  Game.worldGroup.add(g);
  World.colliders.push({type:'box',box:new THREE.Box3(new THREE.Vector3(x-w/2,0,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)),name});
  return g;
}

const _gM=new THREE.MeshStandardMaterial({color:0x88ccff,roughness:0.15,metalness:0.8});
const _gW=new THREE.MeshStandardMaterial({color:0xffeecc,emissive:0xffcc88,emissiveIntensity:0.15,roughness:0.2,transparent:true,opacity:0.85});

function makeGrundschule(x,z,r,color=0xcc5533,roof=0x993322){const g=bldg({x,z,w:12,h:5,d:8,color,rotY:r,name:'grundschule'});addWin(g,12,8,2,5,_gM);
  g.add(mP(new THREE.BoxGeometry(4,3,0.15),lpMat(0x222222),0,1.5,4.2));
  g.add(mP(new THREE.BoxGeometry(12.4,0.3,8.4),lpMat(roof),0,5.15,0));
  const s=makeSign('GRUNDSCHULE','#cc3311','#fff');s.position.set(0,4.2,4.1);g.add(s);return g;}

function makeBuecherei(x,z,r){const g=bldg({x,z,w:10,h:7,d:8,color:0x4488aa,rotY:r,name:'buecherei'});addWin(g,10,8,3,4,_gM);
  g.add(mP(new THREE.BoxGeometry(8,5,0.1),_gM,0,3.5,4.08));
  g.add(mP(new THREE.BoxGeometry(10.4,0.3,8.4),lpMat(0x336688),0,7.15,0));
  const s=makeSign('BÜCHEREI','#224466','#fff');s.position.set(0,6,4.12);g.add(s);return g;}

function makePost(x,z,r){const g=bldg({x,z,w:7,h:4.5,d:6,color:0xffcc00,rotY:r,name:'post'});addWin(g,7,6,1,3,_gM);
  g.add(mP(new THREE.BoxGeometry(7.4,0.3,6.4),lpMat(0xddaa00),0,4.65,0));
  const s=makeSign('POST','#ddaa00','#222');s.position.set(0,3.8,3.12);g.add(s);return g;}

function makeEdeka(x,z,r){const g=bldg({x,z,w:14,h:5,d:10,color:0xeeeedd,rotY:r,name:'edeka'});addWin(g,14,10,1,6,_gM);
  g.add(mP(new THREE.BoxGeometry(12,3.5,0.1),_gM,0,2,5.08));
  // Entrance is in front of the glazing, rather than buried behind it.
  const entry = new THREE.Group();
  const frame = lpMat(0x1144cc), glass = lpMat(0x79b9cc);
  for (const side of [-1,1]) {
    entry.add(mP(new THREE.BoxGeometry(0.08,2.5,0.14),frame,side*0.95,1.25,5.2));
    entry.add(mP(new THREE.BoxGeometry(0.86,2.28,0.05),glass,side*0.46,1.18,5.21));
    entry.add(mP(new THREE.BoxGeometry(0.035,0.5,0.08),lpMat(0xeeeeee),side*0.12,1.1,5.27));
  }
  entry.add(mP(new THREE.BoxGeometry(2,0.1,0.16),frame,0,2.48,5.2));
  entry.add(mP(new THREE.BoxGeometry(2.6,0.12,0.9),frame,0,2.7,5.45));
  g.add(entry);
  g.add(mP(new THREE.BoxGeometry(14.4,0.3,10.4),lpMat(0x1144cc),0,5.15,0));
  const s=makeSign('EDEKA','#1144cc','#ffdd00',5,1);s.position.set(0,4.5,5.12);g.add(s);return g;}

function makeBaeckerei(x,z,r){const g=bldg({x,z,w:6,h:4,d:5,color:0xdd9955,rotY:r,name:'baeckerei'});addWin(g,6,5,1,2,_gW);
  g.add(mP(new THREE.BoxGeometry(5,0.08,1.5),lpMat(0xcc4422),0,2.8,3.2));
  const p=new THREE.Mesh(new THREE.TorusGeometry(0.8,0.2,8,16),lpMat(0xcc8833));p.position.set(0,4.8,0);p.rotation.x=0.5;g.add(p);
  const s=makeSign('BÄCKEREI','#8B4513','#ffeecc');s.position.set(0,3.2,2.6);g.add(s);return g;}

function makeApotheke(x,z,r){const g=bldg({x,z,w:7,h:5,d:6,color:0xffffff,rotY:r,name:'apotheke'});addWin(g,7,6,2,3,_gM);
  g.add(mP(new THREE.BoxGeometry(7.4,0.3,6.4),lpMat(0xdddddd),0,5.15,0));
  const cG=new THREE.Group();const cM=lpMat(0x00aa44);
  cG.add(new THREE.Mesh(new THREE.BoxGeometry(1.5,0.4,0.15),cM));cG.add(new THREE.Mesh(new THREE.BoxGeometry(0.4,1.5,0.15),cM));
  cG.position.set(0,4,3.1);g.add(cG);
  const s=makeSign('ROSEN-APOTHEKE','#006633','#fff');s.position.set(0,4.5,3.12);g.add(s);return g;}

function makeArztpraxis(x,z,r){const g=bldg({x,z,w:7,h:5,d:6,color:0xeeeeff,rotY:r,name:'arztpraxis'});addWin(g,7,6,2,3,_gM);
  g.add(mP(new THREE.BoxGeometry(7.4,0.3,6.4),lpMat(0xccccdd),0,5.15,0));
  const s=makeSign('ARZTPRAXIS','#334488','#fff');s.position.set(0,4.2,3.12);g.add(s);return g;}

function makeBlumenladen(x,z,r){const g=bldg({x,z,w:5,h:3.5,d:5,color:0x88bb55,rotY:r,name:'blumenladen'});addWin(g,5,5,1,2,_gW);
  g.add(mP(new THREE.BoxGeometry(4,0.06,1.2),lpMat(0xff7799),0,2.5,3.1));
  for(let i=-1;i<=1;i++){g.add(mP(new THREE.CylinderGeometry(0.25,0.2,0.4,8),lpMat(0x884422),i*1.2,0.2,3.5));
    g.add(mP(new THREE.SphereGeometry(0.3,6,6),lpMat([0xff4466,0xffaa33,0xff66cc][i+1]),i*1.2,0.6,3.5));}
  const s=makeSign('BLUMENLADEN','#336622','#ffeecc');s.position.set(0,2.8,2.6);g.add(s);return g;}

function makeRestaurant(x,z,r){const g=bldg({x,z,w:10,h:5,d:7,color:0x884422,rotY:r,name:'restaurant'});addWin(g,10,7,2,4,_gW);
  const pitch=2.5,hw=5.3,sl=Math.sqrt(hw*hw+pitch*pitch),ang=Math.atan2(pitch,hw);
  const rG=new THREE.BoxGeometry(sl,0.2,7.6);
  const r1=mP(rG,lpMat(0x553311),-hw/2,5+pitch/2,0); r1.rotation.set(0,0,ang); g.add(r1);
  const r2=mP(rG,lpMat(0x553311),hw/2,5+pitch/2,0); r2.rotation.set(0,0,-ang); g.add(r2);
  for(let i=-2;i<=2;i+=2){g.add(mP(new THREE.BoxGeometry(1,0.06,0.6),lpMat(0xddccaa),i,0.7,5));
    g.add(mP(new THREE.CylinderGeometry(0.04,0.04,0.7,4),lpMat(0x555555),i,0.35,5));}
  const s=makeSign('ZUR ALTEN SCHMIEDE','#442211','#f4c430');s.position.set(0,4.2,3.62);g.add(s);return g;}

function makeCafe(x,z,r){const g=bldg({x,z,w:6,h:3.5,d:5,color:0xddaa77,rotY:r,name:'cafe'});addWin(g,6,5,1,2,_gW);
  g.add(mP(new THREE.BoxGeometry(5,0.06,1.2),lpMat(0xcc3322),0,2.6,3.1));
  const s=makeSign('CAFÉ DEICH','#663311','#fff');s.position.set(0,3,2.6);g.add(s);return g;}

function makeImbiss(x,z,r){const g=bldg({x,z,w:4,h:3,d:3,color:0x2288cc,rotY:r,name:'imbiss'});
  g.add(mP(new THREE.BoxGeometry(3,1.2,0.1),lpMat(0xdddddd),0,1.5,1.55));
  const s=makeSign('FISCHBRÖTCHEN','#115588','#ffeecc',3.5,0.6);s.position.set(0,2.7,1.6);g.add(s);return g;}

function makeKirche(x,z,r){const g=bldg({x,z,w:8,h:8,d:12,color:0xbbaa88,rotY:r,name:'kirche'});addWin(g,8,12,3,3,_gW);
  const tower=new THREE.Mesh(new THREE.BoxGeometry(3,12,3),lpMat(0xaa9977));tower.position.set(0,6,-4.5);tower.castShadow=true;g.add(tower);
  const spire=new THREE.Mesh(new THREE.ConeGeometry(1.8,5,4),lpMat(0x556655));spire.position.set(0,14.5,-4.5);spire.castShadow=true;g.add(spire);
  g.add(mP(new THREE.BoxGeometry(0.15,1.2,0.15),lpMat(0xddcc00),0,17.5,-4.5));
  g.add(mP(new THREE.BoxGeometry(0.8,0.15,0.15),lpMat(0xddcc00),0,17.2,-4.5));return g;}

function makeLagerhaus(x,z,r){const g=bldg({x,z,w:8,h:7,d:6,color:0x993322,rotY:r,name:'lagerhaus'});addWin(g,8,6,3,3,_gM);
  const s=makeSign('LAGERHAUS','#661100','#ffccaa');s.position.set(0,5.5,3.1);g.add(s);return g;}

function makeKaufmannshaus(x,z,r){const g=bldg({x,z,w:5,h:6,d:5,color:0xcc8855,rotY:r,name:'kaufmannshaus'});addWin(g,5,5,2,2,_gW);
  for(let i=0;i<3;i++){g.add(mP(new THREE.BoxGeometry(5-i*1.5,1,0.3),lpMat(0xbb7744),0,6+i*0.8,2.5));}return g;}

function makeLeuchtturm(x,z){const g=new THREE.Group();g.name='leuchtturm';
  const t1=mP(new THREE.CylinderGeometry(1,1.8,10,8),lpMat(0xeeeeee),0,5,0); t1.castShadow=true; g.add(t1);
  for(let i=0;i<3;i++)g.add(mP(new THREE.CylinderGeometry(1.05+i*0.15,1.25+i*0.15,1.5,8),lpMat(0xcc2222),0,2+i*3,0));
  g.add(mP(new THREE.CylinderGeometry(1.3,1.2,1.5,8),_gM,0,10.5,0));
  const t2=mP(new THREE.ConeGeometry(1.5,1.5,8),lpMat(0x333333),0,12,0); t2.castShadow=true; g.add(t2);
  g.position.set(x,0,z);Game.worldGroup.add(g);World.colliders.push({type:'cylinder',x,z,radius:2});return g;}

function makeGrauerTurm(x,z){const g=new THREE.Group();g.name='grauer-turm';
  const t1=mP(new THREE.BoxGeometry(4,12,4),lpMat(0x777777),0,6,0); t1.castShadow=true; g.add(t1);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)if((i+j)%2===0)g.add(mP(new THREE.BoxGeometry(0.8,0.8,0.8),lpMat(0x666666),-1.5+i,12.4,-1.5+j));
  g.position.set(x,0,z);Game.worldGroup.add(g);World.colliders.push({type:'box',box:new THREE.Box3(new THREE.Vector3(x-2.5,0,z-2.5),new THREE.Vector3(x+2.5,14,z+2.5)),name:'grauer-turm'});return g;}

// ═══════════════════════════════════════════════════════════════════
// 8. CITY LAYOUT
// ═══════════════════════════════════════════════════════════════════

function buildModernCity() {
  // Commercial zone (NW quadrant)
  // Quest 1 Layout: EDEKA in the middle of Bäckerei and Post
  makeBaeckerei(-20, -18, 0);
  makeEdeka(-8, -18, 0); // Center
  makePost(4, -18, 0);
  
  makeApotheke(-18,-11,Math.PI);
  makeArztpraxis(-12,-11,Math.PI);
  makeBlumenladen(-6,-11,Math.PI);

  // ── QUEST 1 SPECIFIC PROPS ──
  // 2 EinkaufsWagen (Shopping carts) VOR dem Eingang
  const cartMat = lpMat(0xcccccc);
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.8, 1.0, 1.2), cartMat, -9, 0.5, -12.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.8, 1.0, 1.2), cartMat, -7, 0.5, -12.5));

  // Interactable Door for EDEKA
  const doorGeo = new THREE.BoxGeometry(2, 3, 0.2);
  const doorMat = new THREE.MeshLambertMaterial({color: 0x333333});
  const edekaDoor = new THREE.Mesh(doorGeo, doorMat);
  edekaDoor.position.set(-8, 1.5, -12.9);
  edekaDoor.userData = { isDoor: true, targetZone: ZONES.SUPERMARKET_INTERIOR };
  Game.worldGroup.add(edekaDoor);
  Game.itemsGroup.add(edekaDoor); // Add to itemsGroup so it can be raycasted

  // Education zone (NE quadrant)
  makeGrundschule(15,-18,0);
  makeBuecherei(24,-18,0);

  // Culture & dining (SW quadrant)
  makeKirche(-18,18,0);
  makeRestaurant(-8,15,Math.PI);
  makeCafe(-2,15,Math.PI);
  makeKaufmannshaus(-24,15,Math.PI);
  makeKaufmannshaus(-28,15,Math.PI);

  // Harbor & history (SE quadrant)
  makeLagerhaus(15,18,Math.PI);
  makeLagerhaus(24,18,Math.PI);
  makeLeuchtturm(28,-22);
  makeGrauerTurm(20,-11);
  makeImbiss(26,-4,Math.PI);
  makeBaeckerei(15,11,Math.PI);

  // Fill buildings
  const fc=[0xaadd55,0xffdd44,0x55cccc,0xff8855,0x88aaee,0xddaa77,0xcc8866,0x77bbaa];
  [{x:-26,z:-4},{x:26,z:-4},{x:-26,z:4},{x:26,z:4},{x:-2,z:-26},{x:2,z:-26},{x:-2,z:26},{x:2,z:26},{x:12,z:4},{x:-20,z:4},{x:12,z:-4},{x:-20,z:-4}].forEach((f,i)=>{
    bldg({x:f.x,z:f.z,w:5+Math.random()*2,h:3+Math.random()*3,d:5,color:fc[i%fc.length],rotY:Math.floor(Math.random()*4)*Math.PI/2,name:`fill-${i}`});
  });
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
  // Deck — raised higher so it sits well above the water
  const deckMat = lpMat(0xeeddcc);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.5), deckMat);
  deck.position.y = 0.45; deck.castShadow=true; deck.receiveShadow=true;
  bridgeGrp.add(deck);
  World.walkables.push(deck); // Allow player to walk on bridge
  // Planks detail
  for(let i=-2;i<=2;i++){
    const plank=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.05,2.5),lpMat(0xccb090));
    plank.position.set(i*0.9,0.58,0); bridgeGrp.add(plank);
  }
  // Railings
  const railMat = lpMat(0xf5ede0);
  for(const zs of [-1.2,1.2]){
    // Posts
    for(const xp of [-1.8,-0.6,0.6,1.8]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.2,0.12),railMat);
      post.position.set(xp,1.05,zs); post.castShadow=true; bridgeGrp.add(post);
    }
    // Horizontal rail
    const rail=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.1,0.08),railMat);
    rail.position.set(0,1.45,zs); bridgeGrp.add(rail);
    const rail2=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.1,0.08),railMat);
    rail2.position.set(0,0.85,zs); bridgeGrp.add(rail2);
  }
  // Bridge support pillars (wooden legs under deck)
  const pillarMat = lpMat(0x6B4226);
  for(const xp of [-1.5, 1.5]) {
    for(const zp of [-0.8, 0.8]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 5), pillarMat);
      pillar.position.set(xp, 0.2, zp);
      pillar.castShadow = true;
      bridgeGrp.add(pillar);
    }
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
  bridgeWater.position.set(-7, 0.15, 2);
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
  // Ramp toward bridge (gradually rising to bridge deck height)
  const rampPath=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.35,2),pathMat);
  rampPath.position.set(-4.2,0.18,2); rampPath.receiveShadow=true;
  Game.worldGroup.add(rampPath);
  World.walkables.push(rampPath);

  // Near-bridge landing (raised to bridge level)
  const nearBridgeLanding = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.6), pathMat);
  nearBridgeLanding.position.set(-5.0, 0.25, 2);
  nearBridgeLanding.receiveShadow = true;
  Game.worldGroup.add(nearBridgeLanding);
  World.walkables.push(nearBridgeLanding);

  const farBridgeLanding = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.6), lpMat(0x5aa43a));
  farBridgeLanding.position.set(-8.9, 0.25, 2);
  farBridgeLanding.receiveShadow = true;
  Game.worldGroup.add(farBridgeLanding);
  World.walkables.push(farBridgeLanding);

  // ── 4b. JALAN SISI KIRI RUMAH (cermin dari jalan sisi kanan/jembatan) ──
  // Cobblestone path yang sama di sisi satunya rumah nenek, supaya kedua
  // sisi rumah punya jalan (sesuai instruksi "nach links / nach rechts").
  const leftPathNS = new THREE.Mesh(new THREE.BoxGeometry(2, 0.04, 8), pathMat);
  leftPathNS.position.set(2, 0.03, 2); leftPathNS.receiveShadow = true;
  Game.worldGroup.add(leftPathNS);
  World.walkables.push(leftPathNS);
  const leftPathEW = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 2), pathMat);
  leftPathEW.position.set(7, 0.03, 2); leftPathEW.receiveShadow = true;
  Game.worldGroup.add(leftPathEW);
  World.walkables.push(leftPathEW);

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
  // Rocks (moved away from river which runs X=-5 to X=-9)
  [[-4.5,0.2,-6,0.8],[-4.2,0.15,5,0.6],[-4.0,0.1,-3,1.0],[8,0.3,-8,0.7],
   [10,0.2,6,0.5],[-4.8,0.15,8,0.4],[7,0.4,8,0.6]].forEach(([x,y,z,s])=>{
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
    {x:3,z:-10,s:1.2},{x:-4,z:10,s:1.0},
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

  // ── QUEST ITEMS: Stage 1 ────────────────────────────────────────
  // Item-item ini diletakkan di sekitar rumah Oma.
  // Hanya bisa diambil saat quest yang sesuai sedang aktif.
  if (!Game.itemsGroup) {
    Game.itemsGroup = new THREE.Group();
    Game.itemsGroup.name = 'itemsGroup';
    Game.scene.add(Game.itemsGroup);
  }

  const spawnHausItem = (name, questTarget, x, z, color, symbol) => {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5, z);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.userData = { isInteractable: true, questTarget, itemName: name };

    // Label kecil di atas item (simbol teks)
    if (symbol) {
      const labelGeo = new THREE.PlaneGeometry(0.4, 0.4);
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.font = '36px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(symbol, 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const label = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      label.position.set(0, 0.55, 0);
      label.rotation.x = -Math.PI / 2;
      mesh.add(label);
    }

    Game.itemsGroup.add(mesh);
    return mesh;
  };

  // Quest items dipindah ke HAUS_INTERIOR (buildHausInterior).
  // Eksterior tidak menyimpan item — Stage 1 quest sepenuhnya di dalam rumah.
}

// ═══════════════════════════════════════════════════════════════════
// 12. SHARED CITY INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════════

function buildCityRoads() {
  const roadW = 6;
  const roadMat = lpMat(MODERN_COLORS.ASPHALT);
  const lineMat = lpMat(MODERN_COLORS.LINE);
  const sideMat = lpMat(MODERN_COLORS.SIDEWALK);

  // Main horizontal road
  const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(50, roadW), roadMat);
  hRoad.rotation.x = -Math.PI/2; hRoad.position.set(0, 0.02, 0);
  hRoad.receiveShadow = true; Game.worldGroup.add(hRoad);

  // Center dashes
  for (let i = -24; i <= 24; i += 4) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15), lineMat);
    d.rotation.x = -Math.PI/2; d.position.set(i, 0.025, 0);
    Game.worldGroup.add(d);
  }

  // Sidewalks
  for (const dir of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(50, 0.15, 1.8), sideMat);
    sw.position.set(0, 0.075, (roadW/2 + 0.9) * dir);
    sw.receiveShadow = true; Game.worldGroup.add(sw);
    World.walkables.push(sw);
  }
}

function buildForestEntrance(side) {
  // Trees lining the entrance from the portal
  const x0 = side > 0 ? 16 : -16;
  const trunkMat = lpMat(0x6B4226);
  const leafCols = [0x2d6e1e, 0x3a8a2c, 0x2a5e18];
  for (let i = 0; i < 6; i++) {
    for (const zOff of [-4, 4]) {
      const tree = new THREE.Group();
      const s = 0.7 + Math.random() * 0.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1*s, 0.15*s, 1.5*s, 5), trunkMat);
      trunk.position.y = 0.75*s; trunk.castShadow = true; tree.add(trunk);
      for (let l = 0; l < 3; l++) {
        const r = (1.0 - l*0.25)*s, h = (1.2 - l*0.15)*s;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), lpMat(leafCols[l]));
        cone.position.y = (1.2 + l*0.7)*s; cone.castShadow = true; tree.add(cone);
      }
      tree.position.set(x0 + side * i * 1.5, 0, zOff + (Math.random()-0.5)*1.5);
      Game.worldGroup.add(tree);
    }
  }
}

function buildCityTrees(zoneId) {
  const trunkMat = lpMat(0x4a3020);
  const leafMat = lpMat(0x3a7228);
  const treePositions = [];

  // Sidewalk trees along the main road
  for (let x = -20; x <= 20; x += 8) {
    if (x === -12 && zoneId === ZONES.SUPERMARKT) {
      // Skip the tree directly in front of EDEKA door
    } else {
      treePositions.push({x, z: -6, s: 0.7 + Math.random()*0.3});
    }
    treePositions.push({x, z: 6, s: 0.7 + Math.random()*0.3});
  }

  const N = treePositions.length;
  if (N === 0) return;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.25, 2.4, 7), trunkMat, N);
  trunkInst.castShadow = true;
  const leafInst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.2, 1), leafMat, N*3);
  leafInst.castShadow = true;

  const dummy = new THREE.Object3D();
  treePositions.forEach((p, i) => {
    dummy.position.set(p.x, 1.2*p.s, p.z);
    dummy.scale.setScalar(p.s);
    dummy.rotation.set(0, Math.random()*Math.PI, 0);
    dummy.updateMatrix(); trunkInst.setMatrixAt(i, dummy.matrix);
    [{dx:0,dy:0,dz:0,ls:1.0},{dx:0.4,dy:0.35,dz:-0.3,ls:0.68},{dx:-0.35,dy:0.4,dz:0.35,ls:0.62}].forEach((l, j) => {
      dummy.position.set(p.x+l.dx, 2.4*p.s+l.dy, p.z+l.dz);
      dummy.scale.setScalar(p.s*l.ls);
      dummy.rotation.set(Math.random()*0.4, Math.random()*Math.PI*2, Math.random()*0.4);
      dummy.updateMatrix(); leafInst.setMatrixAt(i*3+j, dummy.matrix);
    });
    World.colliders.push({type:'cylinder', x:p.x, z:p.z, radius:0.4});
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  leafInst.instanceMatrix.needsUpdate = true;
  Game.worldGroup.add(trunkInst, leafInst);
}

function buildCityLamps() {
  const poleMat = lpMat(0x333333);
  const headMat = new THREE.MeshStandardMaterial({
    color:0xffffff, emissive:0xffffff, emissiveIntensity:0.0, roughness:0.1
  });
  const positions = [];
  for (let x = -18; x <= 18; x += 12) {
    positions.push({x, z: -5.5}); positions.push({x, z: 5.5});
  }
  positions.forEach(p => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), poleMat);
    pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), poleMat);
    arm.position.set(-0.6, 4.9, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.4), headMat.clone());
    head.position.set(-1.0, 4.85, 0); g.add(head);
    const light = new THREE.PointLight(0xffffff, 0, 10, 1.5);
    light.position.copy(head.position); light.position.y -= 0.1; g.add(light);
    g.position.set(p.x, 0, p.z);
    Game.worldGroup.add(g);
    World.streetLamps.push({group:g, head, light});
    World.colliders.push({type:'cylinder', x:p.x, z:p.z, radius:0.2});
  });
}

// ═══════════════════════════════════════════════════════════════════
// 13. CITY A — EDEKA, Bäckerei, Apotheke, Blumenladen
//     Compact town, important buildings face the isometric camera
// ═══════════════════════════════════════════════════════════════════

function buildCityA() {
  // ── IMPORTANT BUILDINGS — NORTH side (Z < 0), facing road & camera (rotY = 0) ──
  makeEdeka(-12, -12, 0);           // Supermarkt EDEKA
  makeBaeckerei(2, -10, 0);         // Bäckerei
  makeApotheke(10, -10, 0);         // Apotheke
  makeBlumenladen(17, -10, 0);      // Blumenladen

  // Interactable Door for EDEKA (Visual only, actual teleport via portal)
  const doorGeo = new THREE.BoxGeometry(2, 3, 0.2);
  const doorMat = new THREE.MeshLambertMaterial({color: 0x333333});
  const edekaDoor = new THREE.Mesh(doorGeo, doorMat);
  edekaDoor.position.set(-12, 1.5, -6.9); // Based on makeEdeka(-12, -12) and d=10 (front is at z=-7)
  Game.worldGroup.add(edekaDoor);

  // ── GENERIC BUILDINGS — SOUTH side (Z > 0) & edges for urban density ──
  const fillColors = [
    0xddccaa, 0xcc9966, 0xbbaa88, 0xeeddbb,
    0xd4b896, 0xc8a882, 0xb8a090, 0xe0d0b8
  ];
  const fills = [
    // South side buildings (facing north toward road, rotY = Math.PI)
    {x:-16, z:12, w:6,  h:5,   d:5,  rotY: Math.PI},
    {x:-8,  z:11, w:5,  h:4,   d:5,  rotY: Math.PI},
    {x:0,   z:12, w:4,  h:6,   d:4,  rotY: Math.PI},
    {x:6,   z:11, w:5,  h:3.5, d:5,  rotY: Math.PI},
    {x:14,  z:12, w:5,  h:5.5, d:5,  rotY: Math.PI},
    {x:22,  z:11, w:4,  h:4,   d:4,  rotY: Math.PI},
    // Far left & right edge buildings on north side
    {x:-22, z:-11, w:5,  h:4,   d:5,  rotY: 0},
    {x:24,  z:-10, w:4,  h:3.5, d:4,  rotY: 0},
  ];
  fills.forEach((f, i) => {
    const g = bldg({
      x:f.x, z:f.z, w:f.w, h:f.h, d:f.d,
      color: fillColors[i % fillColors.length],
      rotY: f.rotY, name:`fill-a-${i}`
    });
    // Add windows to fill buildings for realism
    addWin(g, f.w, f.d, Math.max(1, Math.floor(f.h / 2.5)), Math.max(1, Math.floor(f.w / 2)), _gM);
  });

  // Forest entrance from Haus portal (right side)
  buildForestEntrance(1);
}

// ═══════════════════════════════════════════════════════════════════
// 14. CITY B — Grundschule, Bücherei, Post, Arztpraxis
//     Education & services district
// ═══════════════════════════════════════════════════════════════════

function buildCityB() {
  // ── IMPORTANT BUILDINGS — NORTH side (Z < 0), facing road & camera (rotY = 0) ──
  makeGrundschule(-12, -12, 0);      // School
  makeBuecherei(2, -12, 0);          // Library
  makePost(12, -10, 0);              // Post office
  makeArztpraxis(20, -10, 0);        // Doctor's office

  // ── GENERIC BUILDINGS — SOUTH side (Z > 0) facing road (rotY = Math.PI) ──
  const fc = [0xccbbaa, 0xbbddbb, 0xddbb99, 0xaabbcc];
  [{x:-18,z:11,w:5,h:4,d:5},{x:-10,z:12,w:5,h:3.5,d:4},
   {x:-2,z:11,w:5,h:4,d:5},{x:6,z:10,w:4,h:3,d:4},
   {x:14,z:11,w:4,h:5,d:5},{x:22,z:10,w:5,h:3,d:4}].forEach((f,i) => {
    const g = bldg({x:f.x, z:f.z, w:f.w, h:f.h, d:f.d, color:fc[i%fc.length],
          rotY: f.rotY || Math.PI, name:`fill-b-${i}`});
    addWin(g, f.w, f.d, Math.max(1, Math.floor(f.h / 2.5)), Math.max(1, Math.floor(f.w / 2)), _gM);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 15. CITY C — Harbor district: Restaurant, Café, Alte Kirche,
//     Lagerhäuser, Kaufmannshäuser, Leuchtturm, Grauer Turm
//     Coastal road with water on one side
// ═══════════════════════════════════════════════════════════════════

function buildHarborGround() {
  const size = CONFIG.ZONE_SIZE || 80;
  // Land on the north half, water on south
  const landGeo = new THREE.PlaneGeometry(size, size * 0.55);
  const land = new THREE.Mesh(landGeo, lpMat(MODERN_COLORS.GRASS));
  land.rotation.x = -Math.PI/2; land.position.set(0, 0, -size*0.12);
  land.receiveShadow = true; land.name = 'ground';
  Game.worldGroup.add(land); World.ground = land;
  World.walkables.push(land);

  // Cobblestone quay
  const quay = new THREE.Mesh(new THREE.BoxGeometry(size, 0.2, 8), lpMat(0x999988));
  quay.position.set(0, 0.1, 8); quay.receiveShadow = true;
  Game.worldGroup.add(quay); World.walkables.push(quay);

  // Water
  const wc = document.createElement('canvas'); wc.width = wc.height = 256;
  const wctx = wc.getContext('2d');
  const grad = wctx.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#67e8ff'); grad.addColorStop(0.5,'#22bdf4'); grad.addColorStop(1,'#0c86cc');
  wctx.fillStyle = grad; wctx.fillRect(0,0,256,256);
  for(let i=0;i<50;i++){
    wctx.strokeStyle=`rgba(255,255,255,${0.1+Math.random()*0.2})`;
    wctx.lineWidth=1+Math.random()*2; wctx.beginPath();
    const y=Math.random()*256;
    wctx.moveTo(Math.random()*80,y);
    wctx.quadraticCurveTo(120+Math.random()*40,y-8+Math.random()*16,240,y);
    wctx.stroke();
  }
  const wTex = new THREE.CanvasTexture(wc);
  wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping; wTex.repeat.set(4,2);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size*0.4, 12, 20),
    new THREE.MeshStandardMaterial({
      map:wTex, color:0x35d7ff, emissive:0x0b6fa8, emissiveIntensity:0.1,
      roughness:0.18, metalness:0.15, transparent:true, opacity:0.92
    })
  );
  water.rotation.x = -Math.PI/2; water.position.set(0, 0.05, 22);
  Game.worldGroup.add(water);

  // Water collider to prevent walking into water
  World.colliders.push({type:'box', box:new THREE.Box3(
    new THREE.Vector3(-30,0,13), new THREE.Vector3(30,2,40)), name:'harbor-water'});

  // Animate water
  const wp = water.geometry.attributes.position;
  World._updateRiver = (d, t) => {
    wTex.offset.y = t*0.06; wTex.offset.x = Math.sin(t*0.5)*0.02;
    for(let i=0;i<wp.count;i++){
      wp.setZ(i, Math.sin(wp.getX(i)*0.3+t*1.5)*0.1+Math.cos(wp.getY(i)*0.2+t*1.0)*0.06);
    }
    wp.needsUpdate=true; water.geometry.computeVertexNormals();
  };

  // Coastal road
  const roadMat = lpMat(MODERN_COLORS.ASPHALT);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(50, 6), roadMat);
  road.rotation.x = -Math.PI/2; road.position.set(0, 0.02, 3);
  road.receiveShadow = true; Game.worldGroup.add(road);

  // Road lines
  const lineMat = lpMat(MODERN_COLORS.LINE);
  for (let i=-24;i<=24;i+=4){
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15), lineMat);
    d.rotation.x = -Math.PI/2; d.position.set(i, 0.025, 3);
    Game.worldGroup.add(d);
  }

  // Sidewalk inland side
  const sideMat = lpMat(MODERN_COLORS.SIDEWALK);
  const sw = new THREE.Mesh(new THREE.BoxGeometry(50, 0.15, 1.8), sideMat);
  sw.position.set(0, 0.075, -0.9); sw.receiveShadow = true;
  Game.worldGroup.add(sw); World.walkables.push(sw);

  // Bollards along quay edge
  const bollardMat = lpMat(0x333333);
  for (let x = -22; x <= 22; x += 4) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6), bollardMat);
    b.position.set(x, 0.5, 11.5); b.castShadow = true;
    Game.worldGroup.add(b);
  }
}

function buildCityC() {
  // Buildings on north side of coastal road (facing south toward harbor/camera)
  makeRestaurant(-12, -6, Math.PI);
  makeCafe(-3, -5, Math.PI);
  makeKirche(10, -10, Math.PI);

  // Lagerhäuser along the quay
  makeLagerhaus(-16, 8, 0);
  makeLagerhaus(-8, 8, 0);

  // Kaufmannshäuser
  makeKaufmannshaus(16, -6, Math.PI);
  makeKaufmannshaus(20, -6, Math.PI);

  // Leuchtturm on the quay
  makeLeuchtturm(22, 9);

  // Grauer Turm
  makeGrauerTurm(-20, -8);

  // Imbiss on the quay
  makeImbiss(6, 8, 0);

  // Fill buildings
  [{x:4,z:-8,w:4,h:3,d:4},{x:-6,z:-12,w:5,h:4,d:5}].forEach((f,i) => {
    bldg({x:f.x, z:f.z, w:f.w, h:f.h, d:f.d,
          color:[0xddaa77,0xccbbaa][i], rotY:Math.PI, name:`fill-c-${i}`});
  });
}
// ═══════════════════════════════════════════════════════════════════
// 15.5 SUPERMARKET INTERIOR
// ═══════════════════════════════════════════════════════════════════

function createShelf(w, h, d, color = 0xeeeeee) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: color });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  frame.position.y = h/2;
  group.add(frame);
  const shelfMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  for (let i = -1; i <= 1; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, d + 0.1), shelfMat);
      shelf.position.y = (h/2) + i * (h / 3);
      group.add(shelf);
      for (let j = -1; j <= 1; j++) {
          if (Math.random() > 0.3) {
            const product = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.3, 0.2),
                new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })
            );
            product.position.set(j * (w / 4), shelf.position.y + 0.18, 0);
            group.add(product);
          }
      }
  }
  return group;
}

function createKasse() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), woodMat);
  counter.position.y = 0.5;
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  monitor.position.set(0.5, 1.2, 0);
  group.add(counter, monitor);
  return group;
}

function buildSupermarktInterior() {
  // 15x15 room, white walls
  const wallMat = lpMat(0xffffff);
  
  // Left wall
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.5, 5, 15), wallMat, -7.5, 2.5, 0));
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-8,0,-7.5), new THREE.Vector3(-7,5,7.5)), name:'wall-l'});
  
  // Right wall
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.5, 5, 15), wallMat, 7.5, 2.5, 0));
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(7,0,-7.5), new THREE.Vector3(8,5,7.5)), name:'wall-r'});
  
  // Back wall
  Game.worldGroup.add(mP(new THREE.BoxGeometry(15, 5, 0.5), wallMat, 0, 2.5, -7.5));
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-7.5,0,-8), new THREE.Vector3(7.5,5,-7)), name:'wall-b'});
  
  // Front wall (with hole for door)
  Game.worldGroup.add(mP(new THREE.BoxGeometry(6, 5, 0.5), wallMat, -4.5, 2.5, 7.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(7, 5, 0.5), wallMat, 4, 2.5, 7.5));
  Game.worldGroup.add(mP(new THREE.BoxGeometry(2, 2, 0.5), wallMat, -0.5, 4, 7.5)); // Above door
  
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-7.5,0,7), new THREE.Vector3(-1.5,5,8)), name:'wall-f1'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(0.5,0,7), new THREE.Vector3(7.5,5,8)), name:'wall-f2'});

  // Bright sterile lighting
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

  // LINKS VOM EINGANG: Obst und Gemüse (Green racks)
  const rack1 = createShelf(2, 2, 1, 0x44aa44); rack1.position.set(-6, 0, 4); Game.worldGroup.add(rack1);
  const rack2 = createShelf(2, 2, 1, 0x44aa44); rack2.position.set(-6, 0, 2); Game.worldGroup.add(rack2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-7,0,1.5), new THREE.Vector3(-5,2,4.5)), name:'obst'});
  // Gemüse (Quest 4)
  spawnQItem('gemuese', -5, 3, 0x44aa44, 'quest_4', '🥬');

  // HINTEN RECHTS: Cooling rack (White shelves)
  const cool1 = createShelf(2, 3, 1, 0xeeeeee); cool1.position.set(6, 0, -6); Game.worldGroup.add(cool1);
  const cool2 = createShelf(2, 3, 1, 0xeeeeee); cool2.position.set(4, 0, -6); Game.worldGroup.add(cool2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(3,0,-6.5), new THREE.Vector3(7,3,-5.5)), name:'cool'});
  // Fleisch (Quest 4)
  spawnQItem('fleisch', 5.5, -5, 0xcc4444, 'quest_4', '🥩');

  // ZENTRUM: 2 rows of shelves
  const cRack1 = createShelf(4, 2, 1); cRack1.position.set(0, 0, -2); Game.worldGroup.add(cRack1);
  const cRack2 = createShelf(4, 2, 1); cRack2.position.set(0, 0, 1); Game.worldGroup.add(cRack2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-2,0,-2.5), new THREE.Vector3(2,2,-1.5)), name:'center1'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-2,0,0.5), new THREE.Vector3(2,2,1.5)), name:'center2'});
  // Senf & Mayo placeholders
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.4, 0.6, 0.4), lpMat(0xdddd22), -1, 0.3, -0.5)); // Senf
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.4, 0.6, 0.4), lpMat(0xffffff), 1, 0.3, -0.5)); // Mayo
  // Brot (Quest 4)
  spawnQItem('brot', 0, -0.5, 0xc8965a, 'quest_4', '🍞');
  // Eis (Quest 5) — di dekat kasir/freezer
  spawnQItem('eis', 2, 5, 0xffccdd, 'quest_5', '🍦');

  // AM AUSGANG: Kasse and Zeitungsregal
  const kasse = createKasse(); kasse.position.set(-3, 0, 6); Game.worldGroup.add(kasse);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-4,0,5.5), new THREE.Vector3(-2,1,6.5)), name:'kasse'});
  const zeitung = createShelf(1, 2, 0.5, 0xaa2222); zeitung.position.set(-1.5, 0, 7); Game.worldGroup.add(zeitung);

  // Exit Door Interactor (Visual only, actual teleport via portal)
  const exitDoorGeo = new THREE.BoxGeometry(2, 3, 0.2);
  const exitDoor = new THREE.Mesh(exitDoorGeo, new THREE.MeshBasicMaterial({visible: false}));
  exitDoor.position.set(0, 1.5, 7.4);
  Game.worldGroup.add(exitDoor);
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
// 15.9  STADT — Kota terpadu (Stage 2). Satu peta besar dengan jaringan
//       jalan ber-perempatan, ~18 gedung berpapan nama, Stadtpark,
//       Kirche landmark, nama jalan tokoh Jerman. Hanya 1 portal.
// ═══════════════════════════════════════════════════════════════════

function buildStadt() {
  const roadMat = lpMat(MODERN_COLORS.ASPHALT);
  const lineMat = lpMat(MODERN_COLORS.LINE);
  const sideMat = lpMat(MODERN_COLORS.SIDEWALK);

  // Registry gedung untuk quest reach_building (diisi saat gedung dibuat)
  window.__stadtBuildings__ = {};
  const reg = (name, x, z, r) => { window.__stadtBuildings__[name] = { x, z, r }; };

  // ── VARIAN LAYOUT PER-QUEST (Stage 3) ──
  // Setiap quest kota punya tata letak berbeda supaya siswa TIDAK menghafal
  // peta, melainkan membaca teks deskriptif dengan teliti.
  //   'A' = Quest 1 (Der Weg zur Schule): Ampel, Apotheke, Gutenbergstraße,
  //         Schule kuning gegenüber EDEKA, neben Bäckerei.
  //   'B' = Quest 2 (Ein Brief von Oma): Blumenstraße, Wolfgangstraße,
  //         Bank an der Kreuzung, EDEKA gegenüber dem Mall.
  //   'C' = Quest 3 (Weg nach Tantes Haus): Kreuzung → rechts → Brücke →
  //         Park → alte Bibliothek → Tantes Haus daneben.
  const variant = (typeof window !== 'undefined' && window.__stadtVariant__) || 'A';

  // ── HELPER: segmen jalan aspal E-W atau N-S ──
  const roadEW = (cx, cz, len, w = 6) => {
    const r = mP(new THREE.PlaneGeometry(len, w), roadMat, cx, 0.021, cz);
    r.rotation.x = -Math.PI/2; r.receiveShadow = true; Game.worldGroup.add(r); World.walkables.push(r);
    // garis tengah putus-putus
    for (let i = -len/2 + 2; i <= len/2 - 2; i += 4) {
      if ([-24,18].some(junction => Math.abs(cx+i-junction)<4.2)) continue;
      const d = mP(new THREE.PlaneGeometry(2, 0.18), lineMat, cx + i, 0.03, cz);
      d.rotation.x = -Math.PI/2; Game.worldGroup.add(d);
    }
  };
  const roadNS = (cx, cz, len, w = 6) => {
    for (const [a,b] of [[cz-len/2,Math.min(-3,cz+len/2)],[Math.max(3,cz-len/2),cz+len/2]]) {
      if(b<=a)continue;
      const r=mP(new THREE.PlaneGeometry(w,b-a),roadMat,cx,0.021,(a+b)/2);
      r.rotation.x=-Math.PI/2;r.receiveShadow=true;Game.worldGroup.add(r);World.walkables.push(r);
    }
    for (let i = -len/2 + 2; i <= len/2 - 2; i += 4) {
      if (Math.abs(cz+i)<5.8 || (cx===-24 && Math.abs(cz+i-26)<4.2)) continue;
      const d = mP(new THREE.PlaneGeometry(0.18, 2), lineMat, cx, 0.03, cz + i);
      d.rotation.x = -Math.PI/2; Game.worldGroup.add(d);
    }
  };

  // ── HELPER: papan nama jalan (Straßenschild biru) ──
  const streetSign = (x, z, text, rotY = 0) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), lpMat(0x777777));
    pole.position.y = 1.3; pole.castShadow = true; g.add(pole);
    const sign = makeSign(text, '#2a5a9a', '#ffffff', 2.6, 0.55);
    sign.position.set(0, 2.4, 0); g.add(sign);
    const sign2 = makeSign(text, '#2a5a9a', '#ffffff', 2.6, 0.55);
    sign2.position.set(0, 2.4, 0); sign2.rotation.y = Math.PI; g.add(sign2);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    Game.worldGroup.add(g);
    World.colliders.push({ type:'cylinder', x, z, radius:0.2 });
  };

  // ── HELPER: gedung generic + papan nama (untuk gedung tanpa maker) ──
  const namedBldg = (name, x, z, w, h, d, color, rotY, signText, signBg) => {
    const g = bldg({ x, z, w, h, d, color, rotY, name });
    addWin(g, w, d, Math.max(1, Math.floor(h / 2.5)), Math.max(2, Math.floor(w / 2.5)), _gM);
    // atap trim
    g.add(mP(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), lpMat((color * 0.7) & 0xffffff), 0, h + 0.15, 0));
    // papan nama di depan (+z lokal)
    const s = makeSign(signText, signBg || '#333333', '#ffffff', Math.min(w - 0.5, 5), 0.9);
    s.position.set(0, h - 0.8, d / 2 + 0.12); g.add(s);
    return g;
  };

  // ═══════════════════════════════════════════════════════════════
  // JARINGAN JALAN — 1 utama E-W + 2 vertikal (perempatan)
  // ═══════════════════════════════════════════════════════════════
  roadEW(0, 0, 84);        // Jalan utama E-W
  roadNS(-24, 0, 58);      // Jalan vertikal barat (rute dari rumah Oma)
  if (variant === 'C') {
    // Varian C: Bachstraße berhenti di tepi kanal (jembatan menyambungnya)
    roadNS(18, 9, 40);     // z -11..29
  } else {
    roadNS(18, 0, 58);     // Bachstraße penuh
  }
  // Jalan ke KIRI (barat) di samping gerbang rumah Oma — supaya di pintu masuk
  // kota ada dua arah (kiri & kanan) dan instruksi "nach links/rechts" bermakna.
  // Pendek saja (berhenti sebelum Kino di x=-31), tidak mengubah peta lain.
  roadEW(-28, 26, 2);
  // Trotoar sepanjang jalan utama (dipotong di perempatan)
  for (const seg of [[-42, -27.2], [-20.8, 14.8], [21.2, 42]]) {
    const len = seg[1] - seg[0], cx = (seg[0] + seg[1]) / 2;
    for (const dz of [-1, 1]) {
      const sw = mP(new THREE.BoxGeometry(len, 0.12, 1.6), sideMat, cx, 0.06, (3 + 0.8) * dz);
      sw.receiveShadow = true; Game.worldGroup.add(sw); World.walkables.push(sw);
    }
  }
  // Zebra cross di 2 perempatan
  const zebra = (cx, cz) => {
    for (let i = -2; i <= 2; i++) {
      const zb = mP(new THREE.PlaneGeometry(0.5, 2.2), lpMat(MODERN_COLORS.CROSSWALK), cx + i * 0.9, 0.04, cz - 4.2);
      zb.rotation.x = -Math.PI/2; Game.worldGroup.add(zb);
      const zb2 = mP(new THREE.PlaneGeometry(0.5, 3), lpMat(MODERN_COLORS.CROSSWALK), cx + i * 0.9, 0.04, cz + 4.2);
      zb2.rotation.x = -Math.PI/2; Game.worldGroup.add(zb2);
    }
  };
  zebra(-24, 0); zebra(18, 0);

  // ── HELPER: Ampel (lampu lalu lintas) ──
  const makeAmpel = (x, z, rotY = 0) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), lpMat(0x444444));
    pole.position.y = 1.8; pole.castShadow = true; g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.35), lpMat(0x222222));
    box.position.set(0, 3.6, 0); box.castShadow = true; g.add(box);
    // 3 lampu: merah, kuning, hijau (hijau menyala)
    const lamps = [[0xaa2222, 0.45, 0.12], [0xaaaa22, 0, 0.12], [0x22ff44, -0.45, 0.9]];
    for (const [col, dy, glow] of lamps) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: glow }));
      lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 3.6 + dy, 0.2); g.add(lamp);
    }
    g.position.set(x, 0, z); g.rotation.y = rotY;
    Game.worldGroup.add(g);
    World.colliders.push({ type:'cylinder', x, z, radius:0.25 });
    return g;
  };
  if (variant === 'A') {
    // Ampel di perempatan Schillerstraße × Gutenbergstraße (hanya varian A)
    makeAmpel(-20, 4, 0);   // sudut tenggara, menghadap jalan
    makeAmpel(-28, -4, 0);        // sudut barat-laut
    window.__stadtBuildings__['ampel'] = { x: -24, z: 0, r: 6 };
  }

  // Papan nama jalan di sudut-sudut (nama berbeda per varian)
  const ewName = variant === 'B' ? 'Wolfgangstr.' : (variant === 'C' ? 'Hauptstr.' : 'Gutenbergstr.');
  const nsName = variant === 'B' ? 'Blumenstr.'   : 'Schillerstr.';
  streetSign(-30, 4, ewName, 0);
  streetSign(6,   4, ewName, 0);
  streetSign(-27, -8, nsName, Math.PI/2);
  streetSign(15, -8, 'Bachstr.', Math.PI/2);
  streetSign(-27, 10, variant === 'B' ? 'Blumenstr.' : 'Kantstr.', Math.PI/2);
  streetSign(15, 10, 'Dürergasse', Math.PI/2);
  streetSign(-40, -6, 'Humboldtallee', 0);

  // ═══════════════════════════════════════════════════════════════
  // GEDUNG — UTARA jalan (rotY=0, depan menghadap selatan/jalan)
  // ═══════════════════════════════════════════════════════════════
  namedBldg('bahnhof', -36, -16, 14, 6, 8, 0xb0857a, 0, 'BAHNHOF', '#884433');
  reg('bahnhof', -36, -16, 8);
  if (variant === 'A') {
    // GRUNDSCHULE — gedung KUNING besar, tepat di seberang EDEKA
    // ("Direkt gegenüber dem Supermarkt ... ein großes gelbes Gebäude")
    makeGrundschule(-7, -16, 0, 0xf2c94c, 0xd4a017); reg('grundschule', -7, -16, 6);
    // BÄCKEREI kecil — persis di samping sekolah ("neben einer kleinen Bäckerei")
    makeBaeckerei(-17, -16, 0); reg('baeckerei', -17, -16, 5);
    // APOTHEKE besar — di perempatan dekat Ampel
    makeApotheke(-31, -8, 0); reg('apotheke', -31, -8, 6);
  } else if (variant === 'B') {
    // ── VARIAN B (Quest 2: Ein Brief von Oma) ──
    // MALL besar — TEPAT di seberang EDEKA (-2,14), bebas dari semua jalan
    // ("Der Supermarkt liegt gegenüber dem Mall")
    namedBldg('mall', -7, -16, 12, 8, 10, 0xcc7788, 0, 'MALL', '#993355');
    reg('mall', -7, -16, 7);
    // BANK — terlihat dari Kreuzung ("An der Kreuzung siehst du eine Bank")
    namedBldg('bank', -31, -8, 8, 6, 6, 0xaabbcc, 0, 'BANK', '#335577');
    reg('bank', -31, -8, 6);
    // Apotheke kembali ke timur (jauh dari rute)
    makeApotheke(37, -13, 0); reg('apotheke', 37, -13, 6);
  } else {
    // ── VARIAN C (Quest 3: Weg nach Tantes Haus) ──
    // Apotheke di barat (netral, bukan bagian rute)
    makeApotheke(-31, -8, 0); reg('apotheke', -31, -8, 6);
  }
  namedBldg('rathaus', 6, -16, 12, 7, 8, 0xd8c8a8, 0, 'RATHAUS', '#8a6a2a');
  reg('rathaus', 6, -16, 8);
  if (variant !== 'C') {
    // Hotel & bank timur hanya varian A/B — di varian C area ini jadi kanal+taman
    namedBldg('hotel', 26, -17, 10, 8, 8, 0xccaa88, 0, 'HOTEL', '#775533');
    reg('hotel', 26, -17, 7);
  }
  if (variant === 'A') {
    namedBldg('bank', 37, -24, 8, 6, 7, 0xaabbcc, 0, 'BANK', '#335577');
    reg('bank', 37, -24, 6);
  }
  if (variant !== 'C') {
    // Bücherei barat-laut hanya A/B — di varian C, Bibliothek tua ada di
    // seberang taman (bagian dari rute Quest 3)
    makeBuecherei(-36, -25, 0); reg('buecherei', -36, -25, 7);
  }

  // ═══════════════════════════════════════════════════════════════
  // VARIAN C — KANAL + BRÜCKE + PARK + ALTE BIBLIOTHEK + TANTES HAUS
  // Rute: Hauptstr. → große Kreuzung (18,0) → rechts (nach Norden) →
  // Brücke über den Kanal → Park → hindurch → Bibliothek → Tantes Haus
  // ═══════════════════════════════════════════════════════════════
  if (variant === 'C') {
    // ── KANAL (air) melintang timur, z -16..-12, x 13..43 ──
    const water = mP(new THREE.PlaneGeometry(30, 4), new THREE.MeshStandardMaterial({
      color: 0x35b7ef, emissive: 0x0b6fa8, emissiveIntensity: 0.3, roughness: 0.2,
    }), 28, 0.05, -14);
    water.rotation.x = -Math.PI/2; Game.worldGroup.add(water);
    // Tepian kanal
    for (const dz of [-2.3, 2.3]) {
      const bank = mP(new THREE.BoxGeometry(30, 0.25, 0.5), lpMat(0x9a9a8a), 28, 0.12, -14 + dz);
      Game.worldGroup.add(bank);
    }
    // Collider air: blokir masuk kanal KECUALI celah jembatan (x 16..20)
    World.colliders.push({ type:'box', box:new THREE.Box3(new THREE.Vector3(13, 0, -16.3), new THREE.Vector3(16.2, 2, -11.7)), name:'kanal-west' });
    World.colliders.push({ type:'box', box:new THREE.Box3(new THREE.Vector3(19.8, 0, -16.3), new THREE.Vector3(43, 2, -11.7)), name:'kanal-ost' });

    // ── BRÜCKE (jembatan kayu) di Bachstraße, melintasi kanal ──
    const deck = mP(new THREE.BoxGeometry(3.6, 0.22, 8), lpMat(0xb08a5a), 18, 0.14, -14);
    deck.receiveShadow = true; Game.worldGroup.add(deck); World.walkables.push(deck);
    for (const dx of [-1.7, 1.7]) {
      const rail = mP(new THREE.BoxGeometry(0.14, 0.5, 8), lpMat(0x8a6a42), 18 + dx, 0.62, -14);
      Game.worldGroup.add(rail);
      for (let pz = -17.5; pz <= -10.5; pz += 1.75) {
        const post = mP(new THREE.BoxGeometry(0.16, 0.9, 0.16), lpMat(0x7a5a38), 18 + dx, 0.45, pz);
        Game.worldGroup.add(post);
      }
    }
    // Jalur pendek dari jembatan ke taman
    const walk = mP(new THREE.BoxGeometry(3, 0.05, 3), lpMat(0xd4c4a0), 18, 0.03, -17.5);
    walk.receiveShadow = true; Game.worldGroup.add(walk); World.walkables.push(walk);

    // ── PARK — setelah jembatan ("Nach der Brücke siehst du einen Park") ──
    buildStadtpark(18, -22.5, 12, 7);

    // ── ALTE BIBLIOTHEK — di seberang taman ("auf der anderen Seite") ──
    makeBuecherei(12, -30, 0); reg('buecherei', 12, -30, 6);
    // ── TANTES HAUS — persis di sebelah Bibliothek ("gleich daneben") ──
    const th = namedBldg('tantes_haus', 22, -30, 7, 4.5, 6, 0xe8b4b8, 0, 'TANTES HAUS', '#aa5566');
    // atap pelana kecil supaya tampak seperti rumah
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 4), lpMat(0x8a4533));
    roof.rotation.y = Math.PI/4; roof.position.set(0, 5.6, 0); th.add(roof);
    reg('tantes_haus', 22, -30, 6.5);
  }

  // ═══════════════════════════════════════════════════════════════
  // GEDUNG — SELATAN jalan (rotY=π, depan menghadap utara/jalan)
  // ═══════════════════════════════════════════════════════════════
  // KIRCHE — landmark menara tinggi (pindah ke barat-daya, bekas lokasi sekolah)
  const kirche = makeKirche(-36, 15, 0);
  { const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 6), lpMat(0x8a6a4a));
    spire.position.set(0, 11, 4); kirche.add(spire);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), lpMat(0xbbaa88));
    tower.position.set(0, 8, 4); kirche.add(tower);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), lpMat(0xffd700));
    cross.position.set(0, 14.5, 4); kirche.add(cross);
    const s = makeSign('KIRCHE', '#665544', '#fff'); s.position.set(0, 6, 6.1); kirche.add(s); }
  reg('kirche', -36, 15, 7);
  namedBldg('kino', -36, 27, 10, 6, 7, 0x554466, 0, 'KINO', '#332244');
  reg('kino', -36, 27, 5);
  // EDEKA — JAUH dari perempatan (22 unit ke timur), bebas dari semua jalan.
  // r=10 supaya reach_building terpicu SEBELUM player masuk portal interior
  makeEdeka(-2, 14, 0); reg('edeka', -2, 14, 10);
  makeCafe(10, 14, 0); reg('cafe', 10, 14, 5);
  makeRestaurant(32, 16, 0); reg('restaurant', 32, 16, 7);
  makeBlumenladen(24, 15, 0); reg('blumenladen', 24, 15, 5);
  makePost(24, 26, 0); reg('post', 24, 26, 6);
  namedBldg('tourismusbuero', 34, 26, 8, 4.5, 6, 0x66aacc, 0, 'TOURISMUS', '#2266aa');
  reg('tourismusbuero', 34, 26, 6);

  // ── EISSTAND (kios kecil, "neben dem Café") ──
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.0), lpMat(0xffd0e0));
    body.position.y = 1.1; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 8, 1, false, 0, 0), lpMat(0xdd4477));
    roof.rotation.z = Math.PI/2; roof.position.set(0, 2.4, 1.0); g.add(roof);
    // payung
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), lpMat(0x8a8a8a));
    pole.position.set(1.6, 1.5, 0); g.add(pole);
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 8), lpMat(0xff6688));
    umbrella.position.set(1.6, 3.1, 0); g.add(umbrella);
    const s = makeSign('EIS', '#ff4488', '#fff', 1.6, 0.7); s.position.set(0, 2.0, 1.02); g.add(s);
    g.position.set(12, 0, 20);
    Game.worldGroup.add(g);
    World.colliders.push({ type:'box', box:new THREE.Box3(new THREE.Vector3(11, 0, 19), new THREE.Vector3(13, 2.4, 21)), name:'eisstand' });
    reg('eisstand', 12, 20, 4);
    // (Item Eis lama DIHAPUS — Quest 5 sekarang "Weg nach Tantes Haus",
    //  Eisstand tinggal sebagai dekorasi kota.)
  }

  // ═══════════════════════════════════════════════════════════════
  // STADTPARK + MARKTPLATZ — pusat kota (dekat pintu masuk selatan)
  // ═══════════════════════════════════════════════════════════════
  buildStadtpark(0, 24, 16, 9);
  reg('stadtpark', 0, 24, 8);
  reg('marktplatz', 0, 24, 8);

  // ── Pohon jalanan (sedikit, di trotoar; hindari jalan) ──
  const trunkMat = lpMat(0x5a3a1f), leafMat = lpMat(0x3a7a2c);
  const treeSpots = [[-30,6],[6,6],[30,6],[34,-6],[8,-6],[30,-6],[-10,10],[40,-14]]
    .filter(([tx,tz]) => !(variant === 'C' && tz < -10 && tx > 12)); // hindari kanal/taman C
  treeSpots.forEach(([tx,tz]) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,2.2,6), trunkMat);
    trunk.position.y = 1.1; trunk.castShadow = true; t.add(trunk);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1,1), leafMat);
    leaf.position.y = 2.6; leaf.castShadow = true; t.add(leaf);
    t.position.set(tx, 0, tz); Game.worldGroup.add(t);
    World.colliders.push({ type:'cylinder', x:tx, z:tz, radius:0.35 });
  });

  // ── Pintu EDEKA glow + tanda masuk ──
  {
    const glow = mP(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshStandardMaterial({
      color:0x44cc44, emissive:0x22aa22, emissiveIntensity:0.7, transparent:true, opacity:0.85
    }), -2, 0.05, 19.65);
    glow.rotation.x = -Math.PI/2; Game.worldGroup.add(glow);
  }

  if (CONFIG.DEBUG) console.log('[world] buildStadt done — buildings:', Object.keys(window.__stadtBuildings__).length);
}

// Stadtpark — taman kota: rumput, air mancur, bangku, pohon, bunga, jalur
function buildStadtpark(cx, cz, w, d) {
  const lp = (c) => lpMat(c);
  // rumput
  const grass = mP(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color:0x6ab04a, roughness:0.95 }), cx, 0.03, cz);
  grass.rotation.x = -Math.PI/2; grass.receiveShadow = true; Game.worldGroup.add(grass); World.walkables.push(grass);
  // jalur setapak salib (beige)
  const pathH = mP(new THREE.PlaneGeometry(w, 1.6), lp(0xd4c4a0), cx, 0.04, cz); pathH.rotation.x = -Math.PI/2; Game.worldGroup.add(pathH);
  const pathV = mP(new THREE.PlaneGeometry(1.6, d), lp(0xd4c4a0), cx, 0.04, cz); pathV.rotation.x = -Math.PI/2; Game.worldGroup.add(pathV);
  // air mancur (Brunnen)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 16), lp(0xbbbbbb));
  basin.position.set(cx, 0.25, cz); basin.castShadow = true; Game.worldGroup.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 16), new THREE.MeshStandardMaterial({ color:0x44aadd, emissive:0x2288bb, emissiveIntensity:0.3 }));
  water.position.set(cx, 0.5, cz); Game.worldGroup.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.2, 8), lp(0xcccccc));
  spout.position.set(cx, 1.1, cz); Game.worldGroup.add(spout);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color:0x66ccee, emissive:0x3399cc, emissiveIntensity:0.4, transparent:true, opacity:0.8 }));
  drop.position.set(cx, 1.9, cz); Game.worldGroup.add(drop);
  World.colliders.push({ type:'cylinder', x:cx, z:cz, radius:1.7 });
  // 4 bangku mengelilingi
  [[cx+4, cz - 3, 0], [cx, cz + 3, 0], [cx - 4, cz, Math.PI/2], [cx + 4, cz, Math.PI/2]].forEach(([bx, bz, rot]) => {
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.5), lp(0x8a5a2a)); seat.position.y = 0.45; b.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), lp(0x8a5a2a)); back.position.set(0, 0.7, -0.2); b.add(back);
    b.position.set(bx, 0, bz); b.rotation.y = rot; Game.worldGroup.add(b);
    World.colliders.push({ type:'cylinder', x:bx, z:bz, radius:0.5 });
  });
  // pohon di 4 sudut taman
  const trunkMat = lp(0x5a3a1f), leafMat = lp(0x3a8a3a);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const tx = cx + sx * (w/2 - 1.2), tz = cz + sz * (d/2 - 1.2);
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2, 6), trunkMat); trunk.position.y = 1; t.add(trunk);
    for (let l = 0; l < 3; l++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1 - l*0.28, 1.2, 6), lp([0x2d7a1e, 0x3a9a2c, 0x2a6a18][l]));
      cone.position.y = 1.9 + l*0.7; cone.castShadow = true; t.add(cone);
    }
    t.position.set(tx, 0, tz); Game.worldGroup.add(t);
    World.colliders.push({ type:'cylinder', x:tx, z:tz, radius:0.3 });
  });
  // petak bunga (patch warna) di tepi
  [[cx - w/2 + 1, cz], [cx + w/2 - 1, cz]].forEach(([fx, fz], i) => {
    const col = [0xff5577, 0xffcc33][i % 2];
    const bed = mP(new THREE.PlaneGeometry(1.4, 2.2), lp(0x5a8a3a), fx, 0.04, fz); bed.rotation.x = -Math.PI/2; Game.worldGroup.add(bed);
    for (let k = 0; k < 6; k++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), lp(col));
      fl.position.set(fx + (Math.random()-0.5), 0.15, fz + (Math.random()-0.5)*1.6); Game.worldGroup.add(fl);
    }
  });
  // pagar hedge rendah keliling
  const hedgeMat = lp(0x2f6a2a);
  const hedge = (hx, hz, hw, hd) => { const m = mP(new THREE.BoxGeometry(hw, 0.5, hd), hedgeMat, hx, 0.25, hz); Game.worldGroup.add(m); };
  // Leave an entrance aligned with the EDEKA doors at x=-2.
  hedge(cx-w/4-1.75, cz-d/2, w/2-3.5, 0.3);
  hedge(cx+w/4-0.25, cz-d/2, w/2+0.5, 0.3);
  hedge(cx, cz + d/2, w, 0.3);
  const entryPath=mP(new THREE.PlaneGeometry(2.4,3.5),lp(0xd4c4a0),cx-2,0.045,cz-d/2+1.5);
  entryPath.rotation.x=-Math.PI/2;Game.worldGroup.add(entryPath);World.walkables.push(entryPath);
  hedge(cx - w/2, cz, 0.3, d); hedge(cx + w/2, cz, 0.3, d);
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
    buildMainHouse();
    buildHausDiorama();
  } else if (zoneId === ZONES.HAUS_INTERIOR) {
    buildHausInterior();
  } else if (zoneId === ZONES.SUPERMARKET_INTERIOR) {
    buildSupermarktInterior();
  } else if (zoneId === ZONES.SUPERMARKT) {
    buildCityRoads();
    buildCityA();
    buildCityTrees(zoneId);
    buildCityLamps();
  } else if (zoneId === ZONES.SCHULE) {
    buildCityRoads();
    buildCityB();
    buildCityTrees(zoneId);
    buildCityLamps();
  } else if (zoneId === ZONES.HAFEN) {
    buildHarborGround();
    buildCityC();
    buildCityTrees(zoneId);
    buildCityLamps();
  } else {
    // Fallback for any other zone
    buildCityRoads();
    buildCityTrees(zoneId);
    buildCityLamps();
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
