import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
const {loadModelCat}=await import('../dist/src/modelcat.js');
const cat=await loadModelCat('assets/cat-rig.glb',1.25),v=new THREE.Vector3(),results={};
function bottom(mesh){let low=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);assert(Number.isFinite(v.x+v.y+v.z),'Non-finite posed vertex');low=Math.min(low,v.y);}return low;}
for(const [name,s] of Object.entries({wait:{speed:0,idle:0},walk:{speed:1.9,idle:0},run:{speed:4.4,idle:0},sit:{speed:0,idle:10},front_kick_01:{speed:0,idle:0},front_kick_02:{speed:0,idle:0}})){
 if(name.startsWith('front_kick'))assert(cat.triggerAction(name));let minSole=Infinity,maxSole=-Infinity,minRump=Infinity,maxRump=-Infinity;
 for(let i=0;i<300;i++){cat.update(1/60,{...s,grounded:true,vy:0});cat.root.updateMatrixWorld(true);for(const skel of cat.skeletons)skel.update();if(i<45)continue;
 const sole=Math.min(...cat.contacts.map(c=>bottom(c.mesh)));const rump=bottom(cat.model.getObjectByName('robe_inner_haunch'));
 minSole=Math.min(minSole,sole);maxSole=Math.max(maxSole,sole);minRump=Math.min(minRump,rump);maxRump=Math.max(maxRump,rump);
 // Skull is rigid throughout the pose; paper fan cannot be stretched by skin weights.
 const head=cat.rig.parts.get(0),headIndices=head.geometry.attributes.skinIndex,weights=head.geometry.attributes.skinWeight;
 const pos=head.geometry.attributes.position;for(let j=0;j<pos.count;j+=11){if(pos.getY(j)>.74)assert.equal(weights.getX(j),1,'Skull must remain rigid');assert(Math.abs(weights.getX(j)+weights.getY(j)-1)<1e-6,'Bib/chest blend must stay normalized');}assert(headIndices.getX(0)>=0);assert(!cat.rig.fan.children[0].isSkinnedMesh);
 }
 assert(minSole>-.015&&maxSole<.065,`${name}: sole ${minSole}..${maxSole}`);
 if(name==='sit')assert(minRump>-.03&&maxRump<.06,`Seat not on ground: ${minRump}..${maxRump}`);
 results[name]={sole:[minSole,maxSole],haunch:[minRump,maxRump]};
}
console.log(JSON.stringify({posedGeometry:'PASS',grounding:results},null,2));
