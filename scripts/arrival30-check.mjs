import assert from 'node:assert/strict';
import {THREE,parseAsset} from './headless.mjs';
import {rootFootprint} from '../dist/src/tree-grounding.js';
import {heightAt,trailEdge} from '../dist/src/terrain.js';
import {villageLaneDistance} from '../dist/src/village-routes.js';
import {ARRIVAL_CLEARING,buildArrivalClearing} from '../dist/src/arrival-clearing.js';

const high=(await parseAsset('assets/broadleaf-tree.glb')).scene,far=(await parseAsset('assets/broadleaf-tree-lod.glb')).scene;
high.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(high),center=bounds.getCenter(new THREE.Vector3()),scale=8.4/bounds.getSize(new THREE.Vector3()).x;
function normalize(model){const g=new THREE.Group();model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));g.add(model);g.scale.setScalar(scale);return g;}
const prototype={high:normalize(high),far:normalize(far)};prototype.roots=rootFootprint(prototype.high,prototype.far);
const original=[];prototype.high.traverse(o=>{if(o.isMesh)original.push({o,data:o.geometry.attributes.position.array.slice()});});
const scene=new THREE.Scene(),obstacles=[],arrival=buildArrivalClearing(scene,prototype,obstacles);
assert.equal(buildArrivalClearing(scene,prototype,obstacles),arrival,'repeat loading must be idempotent');
for(const {o,data}of original)assert.deepEqual(o.geometry.attributes.position.array,data,'shared tree prototype must not be reshaped');
for(const c of obstacles){assert(trailEdge(c.x,c.z)-c.r>.55,'solid footprint clips a walking path');assert(villageLaneDistance(c.x,c.z)-c.r>3.4,'solid footprint clips catbus envelope');}
const support=arrival.support.contact;assert(support.every(p=>p.y<=heightAt(p.x,p.z)+.015),'tree root floats');assert(arrival.support.spread<.16,'root spans too much height');
const ray=new THREE.Raycaster(arrival.seat.position.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));
const hit=ray.intersectObject(arrival.seat.mesh,false)[0];assert(hit);assert(Math.abs(hit.point.y-arrival.seat.position.y)<.002,'seating anchor must match actual mesh surface');
assert(arrival.flowers.length>12&&arrival.flowers.length<45);assert(arrival.flowers.every(p=>trailEdge(p.x,p.z)>.25),'flowers occupy walking path');
assert.equal(arrival.tree.levels.length,2);assert.equal(scene.children.length,1);
const report={realTreeGLB:true,treePosition:arrival.tree.position.toArray(),seat:arrival.seat.position.toArray(),seatYaw:arrival.seat.yaw,rootHeightSpread:arrival.support.spread,flowers:arrival.flowers.length,solidClearance:obstacles.map(c=>({owner:c.owner,path:trailEdge(c.x,c.z)-c.r,bus:villageLaneDistance(c.x,c.z)-c.r})),sharedPrototypePreserved:true,seatMeshContact:true};
arrival.dispose();assert.equal(scene.children.length,0);assert.equal(obstacles.length,0);assert(!scene.userData.arrivalClearing);console.log(JSON.stringify(report,null,2));
