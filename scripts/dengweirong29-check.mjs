import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THREE,parseAsset} from './headless.mjs';
import {Dengweirong,createDengweirongNavigation,DENGWEIRONG_ASSET,loadDengweirong} from '../dist/src/dengweirong.js';

const flat={ground:()=>0,waterAt:()=>false,laneDistance:()=>Infinity,edgeRadius:()=>Infinity,colliders:[]};
const navigation=createDengweirongNavigation({...flat,colliders:[{type:'circle',x:0,z:0,r:.4,top:999},{type:'box',minX:3,maxX:4,minZ:-1,maxZ:1,top:999}]});
assert(navigation.safePoint({x:-2,z:0}));assert(navigation.safePoint({x:2,z:0}));assert(!navigation.safeSegment({x:-2,z:0},{x:2,z:0}),'swept route must catch a trunk between safe endpoints');
assert(!navigation.safePoint({x:3.5,z:0}));assert(!createDengweirongNavigation({...flat,waterAt:(x)=>x>.5}).safePoint({x:.3,z:0}),'entire footprint stays dry');
assert(!createDengweirongNavigation({...flat,laneDistance:()=>3}).safePoint({x:0,z:0}),'bus lane reserved');
assert(!createDengweirongNavigation({...flat,ground:(x)=>x}).safePoint({x:0,z:0}),'steep hill rejected');
await assert.rejects(()=>loadDengweirong(new THREE.Scene(),{home:{x:0,z:0},navigation:{...flat,waterAt:()=>true}}),/出生点/);

// This minimal rig tests state transitions only. It is never a runtime fallback;
// the actual exported GLB is inspected below whenever its build has completed.
function unitRig(){const scene=new THREE.Group(),body=new THREE.Bone(),head=new THREE.Bone(),lantern=new THREE.Mesh(new THREE.SphereGeometry(.02),new THREE.MeshStandardMaterial({emissive:'#ffd8a0',emissiveIntensity:.2}));body.name='DWR_Body';head.name='DWR_Head';lantern.name='DWR_Lantern';head.position.y=.65;lantern.position.set(0,.5,-.4);body.add(head,lantern);scene.add(body);return {scene,animations:['idle','walk','sniff','greet'].map(name=>new THREE.AnimationClip(name,1.2,[new THREE.NumberKeyframeTrack('DWR_Head.rotation[x]',[0,.6,1.2],[0,.03,0])]))};}
let seed=729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const obstacles=[{type:'circle',x:.8,z:-1.5,r:.4,top:999}],npc=new Dengweirong(unitRig(),{home:{x:0,z:0},roamCenter:{x:0,z:-1},roamRadius:3,random,navigation:{...flat,colliders:obstacles}}),player=new THREE.Vector3(10,0,0),states=new Set();
assert.equal(npc.collider.noFloor,true,'small creature must not become a movable standing platform');
let time=0,travel=0,maxStep=0;const frame=(p=player,options={})=>{const before=npc.position.clone();time+=1/60;npc.update(1/60,time,p,options);const d=before.distanceTo(npc.position);travel+=d;maxStep=Math.max(maxStep,d);assert(npc.navigation.safePoint(npc.position,npc.collider));assert(npc.nodes.Body.scale.equals(npc.bodyScale),'breathing must not change body size');assert.equal(npc.collider.x,npc.position.x);assert.equal(npc.collider.z,npc.position.z);states.add(npc.state);};
for(let i=0;i<7200;i++)frame();assert(travel>8,'wandering must actually move');assert(maxStep<.008,'no teleporting');assert(states.has('sniff')&&states.has('rest')&&states.has('wander'));
const close=npc.position.clone().add(new THREE.Vector3(0,0,1.7));frame(close);assert(npc.canInvite(close));assert(npc.hint.includes('灯尾茸'));assert(!npc.canInvite(new THREE.Vector3(20,0,0)));
npc.release();npc.settle({lookAt:close,duration:Infinity});const settled=npc.position.clone();for(let i=0;i<240;i++)frame(close,{busy:true});assert(npc.position.equals(settled),'settled quest partner stays at its safe location');
npc.setLanternProgress(1);for(let i=0;i<240;i++)frame(close,{busy:true});assert(npc.lightProgress>.99);assert(npc.lanternMaterials.every(x=>x.material.emissiveIntensity>x.base+.04));
npc.release();const near=npc.position.clone().add(new THREE.Vector3(0,0,.4)),separation=npc.position.distanceTo(near);for(let i=0;i<180;i++)frame(near);assert(npc.position.distanceTo(near)>separation+.2,'free partner yields to a nearby player');
const beforeInvalid=npc.position.clone();assert(!npc.leadTo([{x:.8,z:-1.5}]));assert(npc.position.equals(beforeInvalid));
const stop=npc.position.clone();for(let i=0;i<180;i++)frame(new THREE.Vector3(100,0,100));assert(!npc.group.visible);assert(npc.position.equals(stop),'distant wandering pauses');
const ownCollider=npc.collider;npc.dispose();assert(!obstacles.includes(ownCollider));
const guide=new Dengweirong(unitRig(),{home:{x:0,z:0},random,navigation:{...flat,colliders:[]}});assert(guide.leadTo([{x:0,z:1.5},{x:1,z:1.5}]));
const inWay=new THREE.Vector3(0,0,1.35);for(let i=0;i<300;i++){guide.update(1/60,i/60,inWay,{busy:true,playerRadius:.42});assert(guide.position.distanceTo(inWay)>.97,'leading partner stops before the player capsule');}
for(let i=300;i<1500;i++)guide.update(1/60,i/60,new THREE.Vector3(0,0,-3),{busy:true});assert.equal(guide.state,'settled');assert(guide.position.distanceTo(new THREE.Vector3(1,0,1.5))<.10,'safe lead nodes completed');guide.dispose();
const paused=new Dengweirong(unitRig(),{home:{x:0,z:0},random,navigation:{...flat,colliders:[]}});assert(paused.leadTo({x:0,z:2}));paused.update(.1,0,new THREE.Vector3(3,0,0),{weather:{rain:.8}});assert.equal(paused.lastWeather,'rain');const pausedPosition=paused.position.clone(),pausedPose=paused.nodes.Head.quaternion.clone(),animationTime=paused.mixer.time;for(let i=0;i<60;i++)paused.update(1/60,i/60,new THREE.Vector3(3,0,0),{paused:true});assert(paused.position.equals(pausedPosition));assert(paused.nodes.Head.quaternion.equals(pausedPose));assert.equal(paused.mixer.time,animationTime);paused.dispose();

const actual=fs.existsSync('dist/'+DENGWEIRONG_ASSET);if(actual){
 const gltf=await parseAsset(DENGWEIRONG_ASSET),real=new Dengweirong(gltf,{home:{x:0,z:0},navigation:{...flat,colliders:[]}});assert(real.feet.length===4,'four skinned feet required');assert(real.actions.walk&&real.actions.idle,'actual gait clips required');let skins=0,triangles=0;real.model.traverse(o=>{if(o.isSkinnedMesh)skins++;if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});assert(skins>0,'must load a real skinned model');
 const original=new THREE.Box3().setFromObject(real.model,true),limits=original.clone().expandByScalar(.18),gait=[];let tick=0;
 for(const mode of ['idle','walk','idle','greet','sniff']){
  real.settle({duration:Infinity});if(mode==='walk')assert(real.leadTo({x:0,z:3}));else{real.state=mode==='idle'?'settled':mode;real.nextDecision=Infinity;}
  const stats={mode,maxStanceGap:0,maxStanceStep:0,frontPawLift:0,bottom:Infinity,top:-Infinity},previous=new Map();
  for(let i=0;i<240;i++){real.update(1/60,tick++/60,new THREE.Vector3(6,0,0),{busy:true});assert(real.nodes.Body.scale.equals(real.bodyScale));
   for(const foot of real.feet){let bottom=Infinity,center=new THREE.Vector3();for(const {mesh,index}of foot.samples){const p=mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);bottom=Math.min(bottom,p.y);center.add(p);}center.divideScalar(foot.samples.length);if(/DWR_Foot_F[LR]$/.test(foot.bone.name))stats.frontPawLift=Math.max(stats.frontPawLift,bottom-.006);if(foot.stance)stats.maxStanceGap=Math.max(stats.maxStanceGap,Math.abs(bottom-.006));const old=previous.get(foot);if(mode==='walk'&&i>60&&foot.stance&&old?.stance)stats.maxStanceStep=Math.max(stats.maxStanceStep,Math.hypot(center.x-old.center.x,center.z-old.center.z));previous.set(foot,{center,stance:foot.stance});}
   if(i%20===0){const box=new THREE.Box3().setFromObject(real.model,true);box.min.sub(real.position);box.max.sub(real.position);stats.bottom=Math.min(stats.bottom,box.min.y);stats.top=Math.max(stats.top,box.max.y);assert(limits.containsBox(box),`${mode}: animation drifts outside the body envelope`);}
  }
  assert(stats.maxStanceGap<.012,`${mode}: planted feet leave the ground ${stats.maxStanceGap}`);assert(stats.bottom>-.012,`${mode}: model goes below ground`);if(mode==='walk')assert(stats.maxStanceStep<.005,`walking feet slide ${stats.maxStanceStep}`);if(mode==='greet')assert(stats.frontPawLift>.04,'greeting must retain the deliberately raised paw');gait.push(stats);
 }
 real.dispose();console.log({actualGLB:'PASS',skins,triangles,clips:gait});
}
console.log({safeNavigation:'PASS: swept trunks, boxes, water, lanes, slopes',states:[...states],travel,maxStep,settledAndLight:'PASS',playerYield:'PASS',farBehavior:'PASS',actualGLB:actual?'checked':'asset build pending; state tests only'});
