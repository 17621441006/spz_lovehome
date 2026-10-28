import assert from 'node:assert/strict';
import {THREE,parseAsset} from './headless.mjs';
import {loadModelCat} from '../dist/src/modelcat.js';
import {loadHumanCharacter} from '../dist/src/human-character.js';
import {CHARACTER_DEFS} from '../dist/src/characters.js';
const raw=(await parseAsset('assets/cat-rig.glb')).scene.getObjectByName('tripo_part_0');
const cat=await loadModelCat('assets/cat-rig.glb',1.25);
assert.equal(cat.rig.parts.get(0).geometry.index.count,raw.geometry.index.count,'keep every original chin/head triangle');
assert(!cat.rig.parts.get(29).visible&&!cat.rig.parts.get(32).visible);
for(const state of [{speed:0,idle:0},{speed:4,idle:0},{speed:0,idle:10},{speed:0,idle:0}]){
 for(let i=0;i<180;i++)cat.update(1/60,{...state,grounded:true,vy:0});cat.root.updateMatrixWorld(true);for(const sk of cat.skeletons)sk.update();
 for(const side of ['Left','Right']){const sleeve=cat.model.getObjectByName('natural_'+side+'_sleeve'),cap=cat.model.getObjectByName('closed_'+side+'_shoulder');assert(sleeve.visible&&cap.visible);assert.equal(sleeve.geometry.groups.at(-1).count,32*3);assert(sleeve.geometry.attributes.position.array.every(Number.isFinite));assert.equal(sleeve.material[0].userData.image,cat.rig.parts.get(6).material.userData.image);}
 let sole=Infinity;const v=new THREE.Vector3();for(const {mesh,ids}of cat.contacts)for(const i of ids){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);sole=Math.min(sole,v.y-cat.root.position.y);}assert(Math.abs(sole-.008)<.025,`soles ${sole}`);
 if(state.idle>7){for(const p of cat.neutralPose)assert(p.bone.quaternion.angleTo(p.q)<.001,'seated torso stays upright');const hip=cat.model.worldToLocal(cat.rig.bones.Hips.getWorldPosition(new THREE.Vector3()));assert(hip.y<.13&&hip.y>.07,`seated hip ${hip.y}`);}
}
const y=await loadHumanCharacter('xiaoyong');assert.equal(CHARACTER_DEFS.xiaoyong.walk,2.5);assert.equal(CHARACTER_DEFS.xiaoyong.run,9.2);
for(const t of y.actions.mesh_run.getClip().tracks){const n=t.getValueSize();for(let k=0;k<n;k++)assert(Math.abs(t.values[k]-t.values.at(-n+k))<1e-6,'continuous run-loop seam');}
for(const [speed,running]of [[2.5,false],[9.2,true],[0,false]])for(let i=0;i<120;i++){y.update(1/60,{speed,running,idle:0,grounded:true,vy:0});assert(Number.isFinite(y.gaitRate));}
console.log('PASS: original chin retained; sealed shoulders; grounded upright sit; 2x walk / 4x run with continuous loop');
