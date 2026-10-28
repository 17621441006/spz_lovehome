import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadModelCat} from '../dist/src/modelcat.js';
const a=await loadModelCat('assets/cat-rig.glb',1.25);let maxStep=0;
for(const fan of [false,true]){a.setFanEquipped(fan);for(let n=0;n<180;n++)a.update(1/60,{grounded:true,speed:3.5,idle:0,vy:0,actualVelocity:new THREE.Vector3(0,0,3.5)});for(let n=0;n<300;n++){a.update(1/60,{grounded:true,speed:0,idle:0,vy:0});if(n<100)continue;a.root.updateMatrixWorld(true);const l=a.model.worldToLocal(a.rig.bones.LeftFoot.getWorldPosition(new THREE.Vector3())),r=a.model.worldToLocal(a.rig.bones.RightFoot.getWorldPosition(new THREE.Vector3()));maxStep=Math.max(maxStep,Math.abs(l.z-r.z));assert(Math.abs(l.z-r.z)<.05);assert(Math.abs(l.y-r.y)<.01);for(const p of a.neutralPose)assert(p.bone.quaternion.angleTo(p.q)<.015);}}
assert(!a.rig.parts.get(17).visible&&!a.rig.parts.get(27).visible);assert(!a.model.getObjectByName('attached_Left_tassel_cord'));assert(!a.model.getObjectByName('attached_Right_tassel_cord'));console.log({idleFeetForeAft:maxStep,neutralTorso:'PASS',removedSleeveOrnaments:'PASS',fanOnAndOff:'PASS'});
