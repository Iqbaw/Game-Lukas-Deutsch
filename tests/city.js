import * as THREE from 'three';
import {Game} from '../js/main.js';
import {loadZone} from '../js/zone.js';
const timer=setInterval(async()=>{
 if(!Game.isBootReady)return;clearInterval(timer);
 await loadZone('stadt',null,true);
 for(const id of ['main-menu','loading-screen','story-intro','hud','dialog-overlay']){const e=document.getElementById(id);if(e)e.style.display='none';}
 document.getElementById('game-container').style.cssText='display:block;visibility:visible;opacity:1;position:fixed;inset:0';
 const c=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,0.1,200);
 function render(x,y,z,tx,ty,tz){c.position.set(x,y,z);c.lookAt(tx,ty,tz);Game.renderer.render(Game.scene,c);}
 const bar=document.createElement('div');bar.style='position:fixed;top:8px;left:8px;z-index:99999;background:white;padding:10px';document.body.append(bar);
 function button(text,fn){const b=document.createElement('button');b.textContent=text;b.style='color:black;padding:12px';b.onclick=fn;bar.append(b);}
 button('City overview',async()=>{await loadZone('stadt',null,true);render(55,65,75,0,0,0);});
 button('EDEKA entrance',async()=>{await loadZone('stadt',null,true);render(4,9,26,-9,2,15);});
 button('Alte Brücke gate',async()=>{await loadZone('stadt',null,true);render(-14,9,42,-24,1.5,33);});
 button('Bridge portal',async()=>{await loadZone('haus',null,true);render(-1,8,13,-8,1,2);});
 render(55,65,75,0,0,0);
},100);
