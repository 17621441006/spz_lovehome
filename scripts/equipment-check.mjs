import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EquipmentPanel} from '../dist/src/equipment.js';
globalThis.innerHeight=844;
const scene=new THREE.Scene(),root=new THREE.Group(),model=new THREE.Group();root.add(model);scene.add(root);root.position.set(5,2,-9);root.rotation.y=2.7;model.rotation.y=.23;
const original=root.matrix.clone(),position=root.position.clone(),rotation=root.quaternion.clone(),modelRotation=model.quaternion.clone();
const viewport=new THREE.Vector4(0,0,390,844),scissor=new THREE.Vector4(0,0,390,844);
let enabled=false,draws=0,fail=false;
const renderer={autoClear:false,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>enabled,setViewport:(...a)=>viewport.copy(a.length===1?a[0]:new THREE.Vector4(...a)),setScissor:(...a)=>scissor.copy(a.length===1?a[0]:new THREE.Vector4(...a)),setScissorTest:v=>enabled=v,setSize:()=>{},render:s=>{draws++;assert.equal(root.parent,s);assert.equal(model.rotation.y,0);assert.equal(viewport.w,250);if(fail)throw Error('render failure');}};
const panel=Object.create(EquipmentPanel.prototype);Object.assign(panel,{open:true,renderer,previewRenderer:renderer,getActor:()=>({root,model}),stage:{getBoundingClientRect:()=>({left:20,bottom:570,width:150,height:250})},scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(31,1,.01,20),angle:.3});
function restored(){assert.equal(root.parent,scene);assert.deepEqual(root.position.toArray(),position.toArray());assert(root.quaternion.angleTo(rotation)<1e-6);assert(model.quaternion.angleTo(modelRotation)<1e-6);assert.deepEqual(viewport.toArray(),[0,0,390,844]);assert.deepEqual(scissor.toArray(),[0,0,390,844]);assert.equal(enabled,false);assert.equal(renderer.autoClear,false);}
panel.render();restored();fail=true;assert.throws(()=>panel.render(),/render failure/);restored();panel.open=false;panel.render();assert.equal(draws,2);
console.log(JSON.stringify({equipment:'PASS',worldTransformRestored:true,rendererStateRestored:true,failureRecovery:true}));
