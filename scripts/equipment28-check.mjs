import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadHumanCharacter} from '../dist/src/human-character.js';
import {loadModelCat} from '../dist/src/modelcat.js';
import {EquipmentPanel} from '../dist/src/equipment.js';

const world=new THREE.Scene();
let fail=false;
const renderer={autoClear:false,getViewport:v=>v.set(0,0,400,300),getScissor:v=>v.set(0,0,400,300),getScissorTest:()=>false,setViewport(){},setScissor(){},setScissorTest(){},setSize(){},render(scene){scene.updateMatrixWorld(true);const skeletons=new Set();scene.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.update();if(fail)throw Error('portrait rendering failed');}};
const checks=[];
for(const id of ['xiaosi','xiaoyong','zangzangbao']){
 const actor=id==='zangzangbao'?await loadModelCat('assets/cat-rig.glb',1.25):await loadHumanCharacter(id);world.add(actor.root);actor.root.position.set(8,2,-4);
 const panel=Object.assign(Object.create(EquipmentPanel.prototype),{open:true,previewRenderer:renderer,getActor:()=>actor,stage:{getBoundingClientRect:()=>({width:300,height:400})},scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),angle:.18});
 for(const yaw of [2.7,-2.7,Math.PI,-Math.PI/2,0]){
  actor.root.rotation.set(0,yaw,0);actor.model.rotation.set(.04,-yaw*.8,-.03);actor.root.updateMatrixWorld(true);for(const skeleton of actor.skeletons)skeleton.update();
  const rootEuler=actor.root.rotation.clone(),modelEuler=actor.model.rotation.clone(),worldQuaternion=actor.model.getWorldQuaternion(new THREE.Quaternion());
  const bones=[...actor.skeletons].map(skeleton=>({skeleton,matrices:skeleton.boneMatrices.slice()}));
  for(let cycle=0;cycle<3;cycle++){
   panel.angle=cycle*.8-1;panel.render();
   assert.equal(actor.root.parent,world);assert.deepEqual(actor.root.rotation.toArray(),rootEuler.toArray(),`${id}: preserve the yaw controller's Euler branch`);assert.deepEqual(actor.model.rotation.toArray(),modelEuler.toArray());
   assert(actor.model.getWorldQuaternion(new THREE.Quaternion()).angleTo(worldQuaternion)<1e-6);
   for(const {skeleton,matrices}of bones)assert.deepEqual(skeleton.boneMatrices,matrices,`${id}: preview must return GPU bone matrices to world space`);
  }
  // The gameplay controller edits only Y on the next frame. Equivalent
  // quaternions are not enough if restoring one silently introduced X/Z=PI.
  actor.root.rotation.y=yaw+.12;actor.model.rotation.y=.15;
  const expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw+.12,0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.04,.15,-.03)));
  assert(actor.model.getWorldQuaternion(new THREE.Quaternion()).angleTo(expected)<1e-6,`${id}: subsequent Y-only steering must be unchanged`);
  const before=actor.root.rotation.toArray();fail=true;assert.throws(()=>panel.render(),/portrait rendering failed/);fail=false;assert.deepEqual(actor.root.rotation.toArray(),before);assert.equal(actor.root.parent,world);
 }
 world.remove(actor.root);checks.push({id,headings:5,previewCycles:15,followingYaw:'PASS',skeletonRestoration:'PASS',exceptionRestoration:'PASS'});
}
console.log(JSON.stringify({equipmentPreviewIsolation:checks},null,2));
