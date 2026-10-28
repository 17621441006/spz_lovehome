import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadModelCat} from '../dist/src/modelcat.js';
const cat=await loadModelCat('assets/cat-rig.glb',1.25),V=new THREE.Vector3();
const state=(speed=0,grounded=true)=>({speed,grounded,idle:0,vy:grounded?0:3});
assert.equal(cat.fanEquipped,false);assert.equal(cat.rig.fan.visible,false);
const head=cat.rig.parts.get(0),p=head.geometry.attributes.position,w=head.geometry.attributes.skinWeight,indices=head.geometry.attributes.skinIndex;
let chestVertices=0,skullVertices=0;
for(let i=0;i<p.count;i++){
 const a=w.getX(i),b=w.getY(i);assert(Math.abs(a+b-1)<1e-6);
 if(b>.95){assert.equal(cat.rig.skeleton.bones[indices.getY(i)],cat.rig.bones.Spine2);chestVertices++;}
 if(p.getY(i)>.74){assert.equal(a,1);skullVertices++;}
}
assert(chestVertices>10&&skullVertices>50);
for(const id of [6,19,20,33]){
 const g=cat.rig.parts.get(id).geometry;
 for(let i=0;i<g.attributes.skinIndex.count;i++)for(let j=0;j<4;j++)if(g.attributes.skinWeight.getComponent(i,j)>.001)assert(/Spine1|Spine2/.test(cat.rig.skeleton.bones[g.attributes.skinIndex.getComponent(i,j)].name),'Collar must follow torso, never hips or shoulders');
}
const sleeves=[4,12,23,25];let maxSleeveExtent=0;
for(const speed of [0,1.9,4.4])for(let f=0;f<180;f++){
 cat.update(1/60,state(speed));cat.root.updateMatrixWorld(true);for(const sk of cat.skeletons)sk.update();
 if(f%15===0)for(const id of sleeves){const mesh=cat.rig.parts.get(id),box=new THREE.Box3();for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){mesh.getVertexPosition(i,V).applyMatrix4(mesh.matrixWorld);assert(Number.isFinite(V.x+V.y+V.z));box.expandByPoint(V);}const extent=Math.max(...box.getSize(V).toArray());assert(extent<.75,'Sleeve exploded during locomotion');maxSleeveExtent=Math.max(maxSleeveExtent,extent);}
}
cat.setFanEquipped(true);for(let i=0;i<90;i++)cat.update(1/60,state());
assert.equal(cat.rig.fan.visible,true);assert(cat.fanOpen>.99);
const paper=cat.rig.fan.children[0].geometry;paper.computeBoundingBox();const openWidth=paper.boundingBox.getSize(V).x;assert(openWidth>.45);
for(let i=0;i<90;i++)cat.update(1/60,state(4.4));paper.computeBoundingBox();const foldedWidth=paper.boundingBox.getSize(V).x;assert(foldedWidth<.025);assert.equal(cat.rig.fan.visible,true);
cat.update(1/60,state(0,false));assert.equal(cat.rig.fan.visible,false);
cat.update(1/60,state());assert(cat.triggerAction('front_kick_01'));cat.update(1/60,state());assert.equal(cat.rig.fan.visible,false);
assert(cat.setExpression('default'));for(const expression of ['auto','calm','happy','curious','sideeye','worried','invalid'])assert.equal(cat.setExpression(expression),false);for(let i=0;i<480;i++)cat.update(1/60,state());assert.equal(cat.expression,'default');assert.equal(head.geometry.morphAttributes.position,undefined);
cat.setFanEquipped(false);cat.update(1/60,state());assert.equal(cat.rig.fan.visible,false);
assert(cat.rig.face.hairRoot.x<.02&&cat.rig.face.hairRoot.z<.05);
console.log(JSON.stringify({chestVertices,skullVertices,maxSleeveExtent,fanWidth:{open:openWidth,folded:foldedWidth},fanStates:'PASS',expressions:'PASS',hairRoot:cat.rig.face.hairRoot.toArray()},null,2));
