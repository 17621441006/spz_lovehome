import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THREE,parseAsset} from './headless.mjs';
import {Landmarks32} from '../dist/src/landmarks32.js';
import {ReflectionInterior} from '../dist/src/reflection-interior.js';
import {BuildingOcclusion} from '../dist/src/building-occlusion.js';
import {LAYOUT,heightAt} from '../dist/src/terrain.js';
import {moveWithCollisions} from '../dist/src/collision.js';

const stats=[],models=[];
for(const name of ['torii-nest-v1','kite-house-v1','reflection-house-v2']){
 const file=`assets/buildings/${name}.glb`,g=await parseAsset(file);let tris=0,draws=0;
 g.scene.traverse(o=>{if(!o.isMesh)return;draws++;const geo=o.geometry;tris+=geo.index.count/3;for(const i of geo.index.array)assert(i<geo.attributes.position.count);});
 const bytes=fs.statSync('dist/'+file).size;assert(tris<40000&&draws<=20&&bytes<2_000_000);models.push(g.scene);stats.push({name,tris,draws,bytes});
}
function openPassage(root,z,far,floor){
 root.updateMatrixWorld(true);for(const y of [.45,1.05,1.70])for(const x of [-.35,0,.35]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,floor+y,z),new THREE.Vector3(0,0,-1),.01,far);
  assert.equal(ray.intersectObject(root,true).length,0,`Actual GLB doorway blocked at ${x},${floor+y},${z}`);
 }
}
openPassage(models[0],6.1,2.3,0);openPassage(models[2],-3.55,1.25,-2.74);
const scene=new THREE.Scene(),colliders=[],lm=new Landmarks32(scene,colliders,models[0],models[1]);
models[2].name=LAYOUT.reflection.name;models[2].position.set(LAYOUT.reflection.x,LAYOUT.reflection.y,LAYOUT.reflection.z);scene.add(models[2]);
const reflection=new ReflectionInterior(scene,colliders);
let p=new THREE.Vector3(33,lm.nest.position.y,20);
for(let i=0;i<180;i++)moveWithCollisions(p,.05,0,.42,colliders);assert(p.x>40,'Torii entrance must allow full player radius');
moveWithCollisions(p,4,0,.42,colliders);assert(p.x<45.5,'Torii rear wall must remain solid');
let moves=0;lm.onMove=point=>{p.copy(point);moves++;};
p.set(lm.dock.anchorX,heightAt(lm.dock.anchorX,lm.dock.anchorZ),lm.dock.anchorZ);
assert(lm.begin('board',p));lm.update(1);assert(lm.aboard);
assert(lm.begin('sleep',p));lm.update(4.9);assert.equal(lm.dockIndex,0);lm.update(30,false);assert.equal(lm.dockIndex,0);lm.update(.11);assert.equal(lm.dockIndex,1);lm.update(.6);assert(!lm.busy);
assert.equal(colliders.filter(c=>c.landmark==='kite-house').length,1,'No stale deck remains at the old cliff');assert.equal(moves,3);
const camera=new THREE.PerspectiveCamera();camera.position.copy(lm.kite.position).add(new THREE.Vector3(7,4,0));camera.lookAt(lm.kite.position);camera.updateMatrixWorld(true);
const cutaway=new BuildingOcclusion(scene);cutaway.update(.2,camera,p.clone().add(new THREE.Vector3(0,1.6,0)),p);
lm.setDock(0);cutaway.update(.1,camera,p.clone().add(new THREE.Vector3(0,1.6,0)),p);
const entry=cutaway.entries.find(e=>e.root===lm.kite);assert.equal(entry.uniforms.uBuildingFloor.value,lm.dock.y);assert(entry.box.containsPoint(lm.kite.position),'Moving cutaway bounds follow the pavilion immediately');
assert(reflection.surfaceSafe(reflection.entry));assert(!reflection.safe(new THREE.Vector3(LAYOUT.reflection.poolX,0,LAYOUT.reflection.poolZ)),'Pond water remains hazardous away from the dry passage');
console.log(JSON.stringify({assets:stats,actualMeshDoorways:'PASS',nestCollisionDoorAndRear:'PASS',sleepClockAndFocus:'PASS',relocatedFloorAndOcclusion:'PASS',scopedWaterSafety:'PASS'},null,2));
