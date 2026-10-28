import * as THREE from 'three';
import {heightAt,LAYOUT} from './terrain.js';
import {CHARACTER_DEFS} from './characters.js';
import {rng} from './toon.js';
export class ForestLife{
 constructor(roster,colliders){this.roster=roster;this.colliders=colliders;this.random=rng(971);this.states=new Map();}
 safe(x,z){if(Math.hypot(x,z)>LAYOUT.playRadius-3||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+1)return false;return !this.colliders.some(c=>c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+.65:x>c.minX-.6&&x<c.maxX+.6&&z>c.minZ-.6&&z<c.maxZ+.6);}
 async populate(){for(const id of Object.keys(CHARACTER_DEFS)){const existed=this.roster.cache.has(id);const a=await this.roster.ensure(id);if(!existed&&this.roster.id!==id){let i=0;do{a.root.position.set(-3+this.random()*9,0,4+this.random()*7);}while(!this.safe(a.root.position.x,a.root.position.z)&&++i<100);a.root.position.y=heightAt(a.root.position.x,a.root.position.z);}this.states.set(id,{timer:2+this.random()*5,idle:0,mode:'watch',target:a.root.position.clone()});}}
 update(dt,player){for(const [id,a]of this.roster.cache){let s=this.states.get(id);if(!s)continue;if(a===this.roster.active){s.timer=0;s.idle=0;continue;}
 s.timer-=dt;const p=a.root.position,velocity=new THREE.Vector3();
 if(s.timer<=0&&!a.isPerforming){const choice=this.random();s.mode=choice<.55?'wander':choice<.76?'sit':choice<.9?'gesture':'watch';s.timer=4+this.random()*9;s.idle=0;
 if(s.mode==='wander'){for(let n=0;n<30;n++){const t=this.random()*Math.PI*2,r=2+this.random()*6,x=p.x+Math.sin(t)*r,z=p.z+Math.cos(t)*r;if(this.safe(x,z)){s.target.set(x,heightAt(x,z),z);break;}}}
 if(s.mode==='gesture')a.triggerAction(CHARACTER_DEFS[id].actions[Math.floor(this.random()*2)][0]);}
 if(s.mode==='wander'&&!a.isPerforming){const d=s.target.clone().sub(p);d.y=0;if(d.length()<.3){s.timer=0;}else{d.normalize();const speed=CHARACTER_DEFS[id].walk*.65,n=p.clone().addScaledVector(d,speed*dt);const crowded=[...this.roster.cache.values()].some(b=>b!==a&&b.root.position.distanceTo(n)<1.1);if(this.safe(n.x,n.z)&&!crowded&&Math.abs(heightAt(n.x,n.z)-p.y)<.18){velocity.copy(d).multiplyScalar(speed);p.copy(n);p.y=heightAt(p.x,p.z);a.root.rotation.y=Math.atan2(d.x,d.z);}else s.timer=0;}}
 s.idle=s.mode==='sit'?10:0;a.update(dt,{speed:velocity.length(),running:false,grounded:true,vy:0,idle:s.idle,vel:velocity,actualVelocity:velocity});
 a.root.userData.activity=s.mode;
 }}
}
