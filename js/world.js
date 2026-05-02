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

function makeGrundschule(x,z,r){const g=bldg({x,z,w:12,h:5,d:8,color:0xcc5533,rotY:r,name:'grundschule'});addWin(g,12,8,2,5,_gM);
  g.add(mP(new THREE.BoxGeometry(4,3,0.15),lpMat(0x222222),0,1.5,4.2));
  g.add(mP(new THREE.BoxGeometry(12.4,0.3,8.4),lpMat(0x993322),0,5.15,0));
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

  const spawnQItem = (name, x, z, color) => {
    const mesh = mP(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({color}), x, 0.25, z);
    mesh.name = name;
    mesh.userData = { isInteractable: true, questTarget: 'quest_1', itemName: name };
    Game.itemsGroup.add(mesh);
  };

  // LINKS VOM EINGANG: Obst und Gemüse (Green racks)
  const rack1 = createShelf(2, 2, 1, 0x44aa44); rack1.position.set(-6, 0, 4); Game.worldGroup.add(rack1);
  const rack2 = createShelf(2, 2, 1, 0x44aa44); rack2.position.set(-6, 0, 2); Game.worldGroup.add(rack2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-7,0,1.5), new THREE.Vector3(-5,2,4.5)), name:'obst'});
  // Kartoffeln
  spawnQItem('kartoffeln', -5, 3, 0xd4a017); 

  // HINTEN RECHTS: Cooling rack (White shelves)
  const cool1 = createShelf(2, 3, 1, 0xeeeeee); cool1.position.set(6, 0, -6); Game.worldGroup.add(cool1);
  const cool2 = createShelf(2, 3, 1, 0xeeeeee); cool2.position.set(4, 0, -6); Game.worldGroup.add(cool2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(3,0,-6.5), new THREE.Vector3(7,3,-5.5)), name:'cool'});
  // Würstchen
  spawnQItem('wuerstchen', 6, -5, 0xcc3333);
  // Hähnchen
  spawnQItem('haehnchen', 4.5, -5, 0xeeaa55);

  // ZENTRUM: 2 rows of shelves
  const cRack1 = createShelf(4, 2, 1); cRack1.position.set(0, 0, -2); Game.worldGroup.add(cRack1);
  const cRack2 = createShelf(4, 2, 1); cRack2.position.set(0, 0, 1); Game.worldGroup.add(cRack2);
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-2,0,-2.5), new THREE.Vector3(2,2,-1.5)), name:'center1'});
  World.colliders.push({type:'box', box:new THREE.Box3(new THREE.Vector3(-2,0,0.5), new THREE.Vector3(2,2,1.5)), name:'center2'});
  // Senf & Mayo placeholders
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.4, 0.6, 0.4), lpMat(0xdddd22), -1, 0.3, -0.5)); // Senf
  Game.worldGroup.add(mP(new THREE.BoxGeometry(0.4, 0.6, 0.4), lpMat(0xffffff), 1, 0.3, -0.5)); // Mayo
  // Ketchup
  spawnQItem('ketchup', 0, -0.5, 0xdd1111);

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
// 16. API PUBLIK
// ═══════════════════════════════════════════════════════════════════

export function buildZone(zoneId, def) {
  // Cleanup is now handled by zone.js (unloadCurrentZone)
  
  buildGround(zoneId);

  if (zoneId === ZONES.HAUS) {
    buildMainHouse();
    buildHausDiorama();
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
