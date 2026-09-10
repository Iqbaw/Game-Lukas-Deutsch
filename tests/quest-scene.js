import * as THREE from 'three';
import {Game} from '../js/main.js';
import {loadZone} from '../js/zone.js';
import {Player, updatePlayer, teleportPlayer} from '../js/player.js';
import {setupTouchControls} from '../js/ui.js';
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
 const portalView=document.createElement('button');portalView.textContent='View portal';portalView.style='position:fixed;top:110px;left:12px;z-index:99999;padding:12px';document.body.append(portalView);
 portalView.onclick=()=>{camera.position.set(9,7,21);camera.lookAt(3,1.6,13.2);Game.renderer.render(Game.scene,camera);};
 const test=document.createElement('button');test.textContent='Test mobile running jump';test.style='position:fixed;top:65px;left:12px;z-index:99999;padding:12px';document.body.append(test);
 test.onclick=()=>{
   Game.isPaused=false;Player.inputEnabled=true;
   setupTouchControls();
   teleportPlayer(-10,7,0);
   const run=document.getElementById('mobile-run'),jump=document.getElementById('mobile-jump');
   run.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,bubbles:true}));
   Player.input.right=1;
   jump.dispatchEvent(new PointerEvent('pointerdown',{pointerId:92,bubbles:true}));
   jump.dispatchEvent(new PointerEvent('pointerup',{pointerId:92,bubbles:true}));
   if(!Player.isJumping||!Player.input.run)throw Error('Mobile controls did not start running jump');
   let peak=0;const start=Player.position.clone();
   for(let i=0;i<60;i++){updatePlayer(1/60);peak=Math.max(peak,Player.jumpHeight);}
   run.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,bubbles:true}));Player.input.right=0;
   if(Player.isJumping||Player.jumpHeight!==0||peak<1.2||Player.position.distanceTo(start)<0.1)throw Error('Running jump failed');
   test.textContent='PASS: mobile run + jump, movement and landing';
   Game.renderer.render(Game.scene,camera);
 };
},100);
