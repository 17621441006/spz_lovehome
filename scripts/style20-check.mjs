import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THREE} from './headless.mjs';
import {CHARACTER_DEFS} from '../dist/src/characters.js';
import {loadHumanCharacter} from '../dist/src/human-character.js';
assert.equal(Object.keys(CHARACTER_DEFS)[0],'xiaosi');
assert.equal(CHARACTER_DEFS.xiaosi.walk,1.15*4/3);assert.equal(CHARACTER_DEFS.xiaosi.run,4);
assert.equal(CHARACTER_DEFS.xiaoyong.run,9.2*2/3);assert.equal(CHARACTER_DEFS.xiaoyong.walk,2.5);
const actor=await loadHumanCharacter('xiaosi'),a=actor.appearance;
assert.equal(a.ring.parent,actor.bones.LeftHand);assert.equal(a.necklace.parent,actor.bones.Chest);assert.equal(a.hair.parent,actor.bones.Head);
const local=a.ring.matrix.clone(),opacities=[];
for(const mode of ['idle','walk','run','sit','dance']){
 if(mode==='dance')assert(actor.triggerAction('mesh_dance'));
 const speed=mode==='run'?4:mode==='walk'?CHARACTER_DEFS.xiaosi.walk:0;
 for(let i=0;i<240;i++){
  actor.update(1/60,{speed,running:mode==='run',idle:mode==='sit'?10:0,grounded:true,actualVelocity:new THREE.Vector3(0,0,speed)});actor.root.updateMatrixWorld(true);
  const ringWorld=a.ring.getWorldPosition(new THREE.Vector3()),expected=new THREE.Vector3().setFromMatrixPosition(local).applyMatrix4(actor.bones.LeftHand.matrixWorld);
  assert(ringWorld.distanceTo(expected)<1e-8,mode+' ring detached');
  assert(ringWorld.distanceTo(actor.bones.LeftHand.getWorldPosition(new THREE.Vector3()))<.12,mode+' ring outside hand');
  for(const o of [a.ring,a.necklace,a.hair])assert(o.matrixWorld.elements.every(Number.isFinite));
  opacities.push(a.glint.material.opacity);
 }
}
assert(Math.max(...opacities)>.8&&Math.min(...opacities)<.01,'Diamond must pulse visibly');
const html=fs.readFileSync('dist/index.html','utf8');assert(html.includes('<title>司涌脏·千寻</title>'));assert(html.indexOf('data-character="xiaosi"')<html.indexOf('data-character="xiaoyong"'));assert(html.includes('forest-title.ttf'));assert(html.includes('loading-lite.mp4?v=22'));
console.log({C_hair:'PASS',accessoryBoneBinding:'PASS in idle/walk/run/sit/dance',diamondPulse:[Math.min(...opacities),Math.max(...opacities)],speeds:'PASS exact ratios',firstCharacter:'小司',title:'司涌脏·千寻'});
