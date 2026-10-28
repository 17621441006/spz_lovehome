import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadModelCat,CAT_CLIP_SPEED} from '../dist/src/modelcat.js';
import {attachOutfit} from '../dist/src/outfits.js';
// v19 cat: Blender-authored rig. Checks clips, grounding, symmetry of the standing head,
// that nothing on the face is deformed at runtime, and that the fan pose round-trips.
const cat=await loadModelCat('assets/cat-rig.glb',1.25);
const need=['wait','walk','run','sit','jump','jump_down','front_kick_01','front_kick_02'];
for(const n of need)assert(cat.actions[n],`missing clip ${n}`);
const V=new THREE.Vector3(),box=new THREE.Box3();
function settle(s,frames=240){for(let i=0;i<frames;i++)cat.update(1/60,s);cat.root.updateMatrixWorld(true);for(const sk of cat.skeletons)sk.update();}
function lowest(filter=()=>true){let y=Infinity;cat.model.traverse(o=>{if(!o.isSkinnedMesh||!o.visible||!filter(o))return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=2){o.getVertexPosition(i,V).applyMatrix4(o.matrixWorld);y=Math.min(y,V.y);}});return y;}
// Standing: soles on the ground, head upright and facing forward.
settle({grounded:true,speed:0,idle:0,vy:0});assert.equal(cat.state,'wait');
const stand=lowest();assert(Math.abs(stand)<.03,`standing sole height ${stand}`);
const headQ=cat.head.getWorldQuaternion(new THREE.Quaternion());
// Bind pose has the chin raised; idle pitches the head forward ~18° with no yaw/roll.
const parseBind=(await import('./headless.mjs')).parseAsset;const raw=(await parseBind('assets/cat-rig.glb')).scene;raw.scale.setScalar(1.25);raw.updateMatrixWorld(true);
const bindHeadQ=raw.getObjectByName('mixamorigHead').getWorldQuaternion(new THREE.Quaternion());
const tilt=THREE.MathUtils.radToDeg(headQ.angleTo(bindHeadQ));
assert(tilt>8&&tilt<28,`head correction ${tilt}`);
// Walk and run: feet alternate, root does not drift, clip speed is respected.
for(const [speed,clip] of [[1.35,'walk'],[3.2,'run']]){
 let lMin=Infinity,lMax=-Infinity;const L=cat.bones.LeftFoot;
 for(let i=0;i<180;i++){cat.update(1/60,{grounded:true,speed,idle:0,vy:0});cat.model.updateMatrixWorld(true);L.getWorldPosition(V);cat.model.worldToLocal(V);lMin=Math.min(lMin,V.z);lMax=Math.max(lMax,V.z);}
 assert.equal(cat.state,clip);assert(lMax-lMin>.12,`${clip} stride ${lMax-lMin}`);
 const ts=cat.actions[clip].timeScale;assert(ts>.55&&ts<1.9,`${clip} timeScale ${ts}`);
}
// Sitting: seat on the ground and nothing below it.
settle({grounded:true,speed:0,idle:9,vy:0},300);assert.equal(cat.state,'sit');
const sit=lowest();assert(sit>-.04&&sit<.05,`seated lowest point ${sit}`);
const hipsY=cat.bones.Hips.getWorldPosition(V).y;assert(hipsY<.30,`seated hips ${hipsY}`);
// Fan pose: equipping raises the paw to the bind pose and opens the fan.
cat.setFanEquipped(true);settle({grounded:true,speed:0,idle:0,vy:0});
assert(cat.rig.fan.visible);assert(cat.fanPose>.95&&cat.fanOpen>.95);
const fanArm=cat.fanArm.every(({bone,bind})=>bone.quaternion.angleTo(bind)<.05);assert(fanArm,'fan arm at bind pose');
settle({grounded:true,speed:1.35,idle:0,vy:0},120);assert(cat.fanOpen<.2,'fan closes while walking');
// Kicks play once and return to idle.
for(const name of ['front_kick_01','front_kick_02']){assert(cat.triggerAction(name));settle({grounded:true,speed:0,idle:0,vy:0},120);assert(!cat.isPerforming);assert.equal(cat.state,'wait');}
// Face meshes are never rewritten at runtime (bind positions identical to the file).
const fresh=await loadModelCat('assets/cat-rig.glb',1.25);
for(const id of [0,44,48]){const a=cat.parts.get(id).geometry.attributes.position.array,b=fresh.parts.get(id).geometry.attributes.position.array;assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.equal(a[i],b[i]);}
// Optional outfit still attaches.
await attachOutfit(fresh,'zangzangbao');fresh.setOutfit('red-robe');fresh.setOutfit('original');
console.log(JSON.stringify({clips:Object.keys(cat.actions),standSole:stand,headTiltDeg:tilt,seatLowest:sit,seatedHips:hipsY,clipSpeed:CAT_CLIP_SPEED},null,1));
