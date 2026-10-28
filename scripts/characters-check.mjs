import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadHumanCharacter} from '../dist/src/human-character.js';
import {loadModelCat} from '../dist/src/modelcat.js';
import {CharacterRoster,CHARACTER_DEFS} from '../dist/src/characters.js';

const report={humans:{},kicks:{},selection:{}};
for(const id of ['xiaoyong','xiaosi']){
 const actor=await loadHumanCharacter(id),v=new THREE.Vector3();assert(actor.contacts.some(c=>c.ids.length>20));const states={idle:{speed:0,idle:0},walk:{speed:CHARACTER_DEFS[id].walk,idle:0},run:{speed:CHARACTER_DEFS[id].run,idle:0},sit:{speed:0,idle:10}};const result={};
 for(const [name,s]of Object.entries(states)){let min=Infinity,max=-Infinity,bodyMin=Infinity;
  for(let i=0;i<150;i++){actor.update(1/60,{...s,grounded:true,vy:0});actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();if(i<60)continue;let bottom=Infinity;for(const {mesh,ids}of actor.contacts){for(const j of ids){mesh.getVertexPosition(j,v).applyMatrix4(mesh.matrixWorld);bottom=Math.min(bottom,v.y);}if(i%15===0)for(let j=0;j<mesh.geometry.attributes.position.count;j+=17){mesh.getVertexPosition(j,v).applyMatrix4(mesh.matrixWorld);assert(Number.isFinite(v.x+v.y+v.z));bodyMin=Math.min(bodyMin,v.y);}}
  min=Math.min(min,bottom);max=Math.max(max,bottom);
  }
  assert(min>-.015&&max<.09,`${id} ${name} soles ${min}..${max}`);assert(bodyMin>-.08,`${id} ${name} penetrates ground: ${bodyMin}`);result[name]={soleRange:[min,max],bodyMin};
 }
 for(const [action]of CHARACTER_DEFS[id].actions){assert(actor.triggerAction(action));assert(!actor.triggerAction(action));for(let i=0;i<450;i++)actor.update(1/60,{grounded:true,speed:0,idle:0,vy:0});assert(!actor.isPerforming);assert.equal(actor.state,'idle');}
 report.humans[id]={sourceActions:Object.keys(actor.actions),poses:result};
}
const cat=await loadModelCat('assets/cat-rig.glb',1.25);
for(const action of ['front_kick_01','front_kick_02']){assert(cat.triggerAction(action));let seconds=0;while(cat.isPerforming&&seconds<5){cat.update(1/120,{grounded:true,speed:0,idle:0,vy:0});seconds+=1/120;}assert(seconds<1.4,`${action} still slow: ${seconds}`);report.kicks[action]=seconds;for(let n=0;n<20;n++)cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});}
for(const next of ['front_kick_01','front_kick_02']){assert(cat.triggerAction('front_kick_01'));assert(cat.triggerAction(next));assert(!cat.triggerAction(next));let steps=0,seenQueued=false;while(cat.isPerforming&&steps<500){cat.update(1/120,{grounded:true,speed:0,idle:0,vy:0});steps++;if(!cat.queuedAction&&cat.isPerforming)seenQueued=true;}assert(seenQueued);assert(steps>200&&steps<350,'combo duration or completion');assert(!cat.isPerforming);for(let n=0;n<20;n++)cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});}
// Sustained idle must not accumulate head/torso IK changes between constant tracks.
let lastHead=null,maxHeadStep=0;for(let i=0;i<600;i++){cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});cat.root.updateMatrixWorld(true);const head=cat.head.getWorldPosition(new THREE.Vector3());if(lastHead)maxHeadStep=Math.max(maxHeadStep,head.distanceTo(lastHead));lastHead=head;assert(Number.isFinite(head.y));}assert(maxHeadStep<.05);report.kicks.combo='PASS';report.headMaxFrameTravel=maxHeadStep;
// A slow first request must never overwrite a newer selection. Failed loads keep
// the current avatar and its transform instead of leaving the world empty.
const scene=new THREE.Scene(),pending={};const roster=new CharacterRoster(scene,id=>new Promise((resolve,reject)=>pending[id]={resolve,reject}));const make=()=>({root:new THREE.Group()});
const first=roster.select('zangzangbao');pending.zangzangbao.resolve(make());assert(await first);roster.active.root.position.set(4,2,-3);
const slow=roster.select('xiaoyong'),fast=roster.select('xiaosi');pending.xiaosi.resolve(make());assert(await fast);pending.xiaoyong.resolve(make());assert.equal(await slow,false);assert.equal(roster.id,'xiaosi');assert.deepEqual(roster.cache.get('zangzangbao').root.position.toArray(),[4,2,-3]);assert.equal(scene.children.length,3);
await roster.select('xiaoyong');assert.equal(scene.children.length,3);await roster.select('zangzangbao');assert.equal(scene.children.length,3);
const failedRoster=new CharacterRoster(scene,()=>Promise.reject(new Error('offline')));await assert.rejects(failedRoster.select('xiaosi'),/offline/);assert.equal(failedRoster.active,null);assert.equal(scene.children.length,3);
report.selection={latestChoiceWins:true,cachedSwitch:true,independentPositionsPreserved:true,threeResidentAvatars:true};
console.log(JSON.stringify(report,null,2));
