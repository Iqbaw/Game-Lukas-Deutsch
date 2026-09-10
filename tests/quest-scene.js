import * as THREE from 'three';
import {Game} from '../js/main.js';
import {loadZone} from '../js/zone.js';
const until=setInterval(async()=>{
 if(!Game.isBootReady)return;
 clearInterval(until);
 await loadZone('haus_interior', {x:-10,z:7,facing:0}, true);
 for(const id of ['main-menu','loading-screen','story-intro','hud','dialog-overlay']){const el=document.getElementById(id);if(el)el.style.display='none';}
 document.getElementById('game-container').style.cssText='display:block;visibility:visible;opacity:1;position:fixed;inset:0';
 Game.renderer.domElement.style.cssText='display:block;visibility:visible;opacity:1';
 const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.1,100);
 camera.position.set(-4,10,18);camera.lookAt(-10,0.5,6.5);
 Game.renderer.render(Game.scene,camera);
 const result=document.createElement('output');result.style='position:fixed;top:12px;left:12px;background:white;color:black;padding:12px;z-index:99999';
 const names=Game.itemsGroup.children.filter(o=>o.userData.itemName).map(o=>o.userData.itemName);
 let checked=0;
 for(const item of Game.itemsGroup.children.filter(o=>o.userData.itemName)) {
   const bounds=new THREE.Box3().setFromObject(item);
   Game.worldGroup.traverse(o=>{
     if(!o.isMesh || !o.visible) return;
     const other=new THREE.Box3().setFromObject(o);
     if(bounds.intersectsBox(other)) {
       const overlap=bounds.clone().intersect(other).getSize(new THREE.Vector3());
       if(Math.min(overlap.x,overlap.y,overlap.z)>0.005) throw Error(item.userData.itemName+' overlaps furniture by '+overlap.toArray());
     }
   });
   checked++;
 }
 result.textContent=checked+' placed items passed furniture clearance: '+names.join(', ');document.body.append(result);
},100);
