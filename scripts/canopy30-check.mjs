import assert from 'node:assert/strict';
import {THREE,parseAsset} from './headless.mjs';
import {buildWorld,colliders} from '../dist/src/world.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {heightAt} from '../dist/src/terrain.js';
import {Dengweirong,DENGWEIRONG_ASSET} from '../dist/src/dengweirong.js';
const scene=new THREE.Scene();buildWorld(scene);await loadDreamWorld(scene,false);const canopy=scene.userData.dewCanopy;
const npc=new Dengweirong(await parseAsset(DENGWEIRONG_ASSET),{home:{x:16,z:-46},canopy,random:()=>.4});scene.add(npc.group);
const far=new THREE.Vector3(18,heightAt(18,-38),-38),near=new THREE.Vector3(16,heightAt(16,-44.6),-44.6),states=new Set(),perches=new Set();let time=0,maxStep=0,maxFootError=0,minTrunk=Infinity,previous=npc.position.clone();
function tick(player,context={}){time+=1/60;npc.update(1/60,time,player,context);maxStep=Math.max(maxStep,previous.distanceTo(npc.position));previous.copy(npc.position);states.add(npc.state);perches.add(npc.canopy.index);assert(npc.nodes.Body.scale.equals(npc.bodyScale));
 for(const trunk of canopy.trunks)minTrunk=Math.min(minTrunk,Math.hypot(trunk.x-npc.position.x,trunk.z-npc.position.z)-trunk.r);
 if(npc.canopy.perched)for(const foot of npc.feet){let bottom=new THREE.Vector3(0,Infinity,0);for(const {mesh,index}of foot.samples){const p=mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);if(p.y<bottom.y)bottom.copy(p);}const gap=Math.abs(bottom.y-canopy.surface(bottom.x,bottom.z,npc.canopy.index)-.006);maxFootError=Math.max(maxFootError,gap);}
}
for(let i=0;i<60*90;i++)tick(far);
assert.equal(perches.size,3,'Must actually visit three different trees');assert(npc.canopy.completed>=7);assert(maxStep<.12,'Bounded continuous jump path, no teleport');assert(minTrunk>.65,'Full animal footprint clears every trunk');assert(maxFootError<.04,`Paws must stay supported on real branch surface, gap ${maxFootError}`);
while(npc.canopy.mode!=='jump')tick(far);
const frozen=npc.position.clone(),elapsed=npc.canopy.elapsed,pose=npc.nodes.Body.quaternion.clone();for(let i=0;i<180;i++)tick(far,{busy:true});assert(npc.position.equals(frozen));assert.equal(npc.canopy.elapsed,elapsed);assert(npc.nodes.Body.quaternion.equals(pose));
for(let i=0;i<600;i++)tick(near);assert(npc.canopy.low,'Visitor brings it to the low greeting branch');assert(npc.canInvite(near));
npc.settle({duration:Infinity});const perch=npc.position.clone();for(let i=0;i<1800;i++)tick(far);assert(npc.position.equals(perch),'Accepted quest holds a reliable return location');
npc.release();for(let i=0;i<900;i++)tick(far);assert(npc.canopy.completed>=8);
console.log(JSON.stringify({threeTreeTraversal:'PASS',states:[...states],jumps:npc.canopy.completed,maxStep,maxFootError,minTrunk,menuPause:'PASS',lowBranchGreeting:'PASS',questHoldAndRelease:'PASS',modelScaleInvariant:'PASS'},null,2));
