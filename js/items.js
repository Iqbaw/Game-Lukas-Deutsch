import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// All props use a bottom-center origin: placement Y is the supporting surface.
export function buildQuestItem(name, color) {
  const group = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({color:c, roughness:0.65});
  const base=mat(color), metal=mat(0xb8bec4), dark=mat(0x30343b);
  function mesh(geo,m,x,y,z) { const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o; }
  const box=(w,h,d,m,x,y,z)=>mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*0.15),m,x,y,z);
  const ball=(x,y,z,sx,sy,sz,m)=>{const o=mesh(new THREE.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
  const disc=(r,h,m,x,y,z)=>mesh(new THREE.CylinderGeometry(r,r,h,24),m,x,y,z);
  if(name==='pfanne') {
    disc(0.23,0.045,dark,0,0.025,0);
    const rim=mesh(new THREE.TorusGeometry(0.215,0.018,6,24),metal,0,0.055,0);rim.rotation.x=Math.PI/2;
    box(0.31,0.055,0.065,dark,0.34,0.04,0);
  } else if(name==='teller') {
    disc(0.25,0.035,base,0,0.022,0);
    const rim=mesh(new THREE.TorusGeometry(0.224,0.02,6,24),base,0,0.041,0);rim.rotation.x=Math.PI/2;
  } else if(name==='wurst'||name==='fleisch') {
    box(0.55,0.035,0.32,mat(0xf1e6d5),0,0.02,0);
    if(name==='wurst') for(const z of [-0.075,0.075]) ball(0,0.095,z,0.22,0.06,0.055,base);
    else {ball(0,0.095,0,0.22,0.065,0.12,base);ball(0.07,0.15,0,0.045,0.008,0.035,mat(0xffe9d5));}
  } else if(name==='eier') {
    box(0.48,0.045,0.3,mat(0xb59f7f),0,0.025,0);
    for(const x of [-0.15,0,0.15])for(const z of [-0.07,0.07])ball(x,0.12,z,0.06,0.09,0.06,base);
  } else if(name==='besteck') {
    box(0.48,0.025,0.46,mat(0xb59264),0,0.018,0);
    for(const x of [-0.12,0.12])box(0.035,0.025,0.27,metal,x,0.045,0.025);
    box(0.085,0.025,0.13,metal,0.12,0.045,-0.12);
    box(0.09,0.025,0.035,metal,-0.12,0.045,-0.105);
    for(const x of [-0.153,-0.12,-0.087])box(0.013,0.025,0.085,metal,x,0.045,-0.155);
  } else if(name==='papier') {
    for(let i=0;i<3;i++)box(0.4,0.007,0.3,base,i*0.012,0.006+i*0.009,0);
    for(let i=0;i<4;i++)box(0.22,0.002,0.009,mat(0x8493a5),0,0.029,-0.08+i*0.045);
  } else if(name==='socken') {
    for(const x of [-0.11,0.11]) {box(0.13,0.04,0.27,base,x,0.025,0);box(0.2,0.04,0.1,base,x+0.035,0.025,0.12);box(0.13,0.01,0.045,mat(0xffffff),x,0.05,-0.105);}
  } else if(name==='spielzeug') {
    ball(0,0.22,0,0.13,0.17,0.1,base);ball(0,0.43,0,0.14,0.13,0.11,base);
    for(const s of [-1,1]){ball(s*0.11,0.53,0,0.055,0.06,0.045,base);ball(s*0.15,0.26,0,0.06,0.1,0.055,base);ball(s*0.09,0.06,0.05,0.075,0.06,0.095,base);ball(s*0.045,0.45,0.104,0.012,0.015,0.008,dark);}
    ball(0,0.4,0.105,0.055,0.04,0.025,mat(0xf0c798));ball(0,0.42,0.13,0.018,0.015,0.012,dark);
  } else if(name==='brot') {
    ball(0,0.14,0,0.29,0.14,0.16,base);
    for(const x of [-0.14,0,0.14])box(0.025,0.015,0.19,mat(0xf1d09b),x,0.267,0);
  } else if(name==='gemuese') {
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ball(Math.cos(a)*0.09,0.12,Math.sin(a)*0.09,0.11,0.12,0.11,base);}
    ball(0,0.2,0,0.12,0.14,0.12,mat(0x81b94b));
  } else if(name==='eis') {
    mesh(new THREE.ConeGeometry(0.1,0.27,12),mat(0xc89b64),0,0.135,0).rotation.z=Math.PI;
    ball(0,0.32,0,0.13,0.13,0.13,base);
  }
  group.name=name;
  return group;
}

// A hollow cabinet instead of a solid block. Shelf tops are explicit anchors.
export function buildOpenStorage(width,height,depth,color,shelfY) {
  const g=new THREE.Group();const m=new THREE.MeshStandardMaterial({color,roughness:0.8});
  function panel(w,h,d,x,y,z){const o=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,0.012),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);}
  panel(width,height,0.06,0,height/2,-depth/2+0.03);
  for(const x of [-width/2+0.035,width/2-0.035])panel(0.07,height,depth,x,height/2,0);
  for(const y of [0.04,shelfY-0.025,height-0.04])panel(width-0.14,0.05,depth-0.06,0,y,0.015);
  return g;
}
