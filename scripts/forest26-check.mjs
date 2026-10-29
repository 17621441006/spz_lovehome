import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {BigTotoro} from '../dist/src/totoro.js';
import {colliders} from '../dist/src/world.js';
import {addVillageStops} from '../dist/src/village-stops.js';
import {inElderRiver,onElderBridge} from '../dist/src/elder-tree.js';
const scene=new THREE.Scene(),t=new BigTotoro(scene),player=t.home.clone().add(new THREE.Vector3(8,0,0));
t.collider={type:'circle',x:t.home.x,z:t.home.z,r:1.9,top:999};colliders.push(t.collider);
for(let i=0;i<240;i++)t.update(1/60,player,0);
assert(Math.abs(t.group.rotation.y-t.baseYaw)>.3,'Set up sideways gaze before sleep');t.restClock=0;
for(let i=0;i<480;i++)t.update(1/60,player,0);
assert(t.sleep>.99);assert(Math.abs(t.group.rotation.y-t.baseYaw)<.002,'Sleep must align with the fixed trunk');
const inv=t.nest.matrixWorld.clone().invert(),p=new THREE.Vector3();let minGap=Infinity,maxGap=-Infinity;
for(let i=0;i<360;i++){
 t.update(1/60,player,0);scene.updateMatrixWorld(true);
 for(const foot of t.feet){let low=null;foot.traverse(m=>{if(!m.isMesh)return;const matrix=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld);for(let j=0;j<m.geometry.attributes.position.count;j++){p.fromBufferAttribute(m.geometry.attributes.position,j).applyMatrix4(matrix);if(!low||p.y<low.y)low=p.clone();}});const moss=.025+.12*Math.sqrt(Math.max(0,1-(low.x/2.15)**2-((low.z-.35)/2.7)**2)),gap=low.y-moss;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);}
}
assert(minGap>-.035&&maxGap<.055,'Feet stay at moss surface through breathing');
for(let i=0;i<1200;i++)t.update(1/60,player,1);assert(t.group.position.distanceTo(t.home)>2,'Rain companion can leave the nest');
for(let i=0;i<1800;i++)t.update(1/60,player,0);assert(t.group.position.distanceTo(t.home)<.12,'Return home before sleeping');
const signs=new THREE.Scene(),solids=[];addVillageStops(signs,[{stops:[{name:'古树桥头',position:new THREE.Vector3(-15,0,4),yaw:0}]}],[],solids);
const water=signs.children.filter(o=>o.userData.waterSign);assert.equal(water.length,1);const at=water[0].position;
assert(inElderRiver(at.x,at.z));assert(!onElderBridge(at.x,at.z,.6));assert.equal(solids.length,0);
console.log({sleepYaw:'PASS',footMossGap:[minGap,maxGap],rainLeaveAndReturn:'PASS',waterSignClearBridge:'PASS'});
