import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadHumanCharacter} from '../dist/src/human-character.js';
import {CHARACTER_DEFS} from '../dist/src/characters.js';
const report={};
for(const id of ['xiaosi','xiaoyong']){
 const actor=await loadHumanCharacter(id),speed=CHARACTER_DEFS[id].run;
 assert(actor.actions.mesh_run,`${id} requires a real run clip`);
 const run=actor.actions.mesh_run.getClip();assert(run.duration<.8);
 const rootTrack=run.tracks.find(t=>t.name==='Root.position');
 if(rootTrack)for(let i=0;i<rootTrack.values.length;i+=3){assert.equal(rootTrack.values[i],0);assert.equal(rootTrack.values[i+2],0);}
 // Screen input/world travel has one forward convention (+Z), even directly
 // after the menu faces the model toward the camera or after a sharp turn.
 let minFacing=1;
 for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  actor.root.rotation.y=heading+Math.PI;const velocity=new THREE.Vector3(Math.sin(heading)*speed,0,Math.cos(heading)*speed);
  actor.update(1/60,{speed,grounded:true,vy:0,idle:0,running:true,actualVelocity:velocity});actor.root.updateMatrixWorld(true);
  const forward=new THREE.Vector3(0,0,1).applyQuaternion(actor.model.getWorldQuaternion(new THREE.Quaternion()));forward.y=0;forward.normalize();const facing=forward.dot(velocity.clone().normalize());minFacing=Math.min(minFacing,facing);assert(facing>.999,`${id} runs backward at heading ${heading}`);
 }
 actor.root.rotation.y=0;actor.root.position.set(0,0,0);actor.model.rotation.y=0;
 const frames=[],v=new THREE.Vector3(),velocity=new THREE.Vector3(0,0,speed);
 for(let i=0;i<240;i++){
  actor.root.position.addScaledVector(velocity,1/60);actor.update(1/60,{speed,grounded:true,vy:0,idle:0,running:true,actualVelocity:velocity});actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();
  if(i<60)continue;const frame={};for(const side of ['Left','Right']){for(const part of ['Foot','Hand']){const p=actor.bones[side+part].getWorldPosition(new THREE.Vector3()).sub(actor.root.position);assert(Number.isFinite(p.x+p.y+p.z));frame[side+part]=p;}}
  let sole=Infinity;for(const {mesh,ids}of actor.contacts)for(const n of ids){mesh.getVertexPosition(n,v).applyMatrix4(mesh.matrixWorld);sole=Math.min(sole,v.y-actor.root.position.y);}assert(sole>-.015&&sole<.1,`${id} sole ${sole}`);frame.sole=sole;frames.push(frame);
 }
 assert.equal(actor.state,'mesh_run');assert(Math.abs(actor.root.position.z-speed*4)<1e-7);
 const footSpan=side=>Math.max(...frames.map(f=>f[side+'Foot'].z))-Math.min(...frames.map(f=>f[side+'Foot'].z));
 assert(footSpan('Left')>.45&&footSpan('Right')>.45,`${id} not taking full running strides`);
 let stanceCount=0,correctStance=0;const localStanceSpeeds=[];
 for(let i=1;i<frames.length;i++)for(const side of ['Left','Right']){const p=frames[i][side+'Foot'],old=frames[i-1][side+'Foot'];if(p.y<.18&&old.y<.18){const vz=(p.z-old.z)*60;stanceCount++;if(vz<-.1)correctStance++;if(vz<-.1)localStanceSpeeds.push(-vz);}}
 // The ankle also enters this height band before heel strike, so demand a
 // clear backward majority rather than treating the whole band as planted.
 assert(correctStance/stanceCount>.6,`${id} stance feet must travel backward for forward locomotion`);
 // Collision-stop uses actual displacement, even if the input velocity persists.
 actor.update(1/60,{speed:0,grounded:true,vy:0,idle:0,running:true,actualVelocity:new THREE.Vector3(),vel:velocity});assert.equal(actor.state,'idle');
 report[id]={runDuration:run.duration,minFacingDot:minFacing,fullStride:[footSpan('Left'),footSpan('Right')],stanceForwardRatio:correctStance/stanceCount,travel:speed*4,blockedState:actor.state};
}
console.log(JSON.stringify(report,null,2));
