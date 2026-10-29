import assert from 'node:assert/strict';
import {THREE,parseAsset} from './headless.mjs';
import {BuildingOcclusion} from '../dist/src/building-occlusion.js';
import {ASSET_BOUNDS} from '../dist/src/asset-bounds.js';
import {BUILDING_COLLISIONS} from '../dist/src/building-collisions.js';
import {replaceDetail} from '../dist/src/asset-stream.js';

const camera=new THREE.PerspectiveCamera(),feet=new THREE.Vector3(),head=new THREE.Vector3(0,1.4,0);
function tick(scene,occ,frames=120){for(let i=0;i<frames;i++){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);occ.update(1/60,camera,head,feet);}}
const aim=(x,y,z)=>{camera.position.set(x,y,z);camera.lookAt(head);camera.updateMatrixWorld(true);};

// A real hole between two walls must remain a hole, even though the bounding
// box intersects all nine rays. Geometry behind the player is also excluded.
const scene=new THREE.Scene(),room=new THREE.Group();room.userData.buildingId='test-room';room.userData.templeInterior={floor:0};scene.add(room);
const material=new THREE.MeshStandardMaterial({color:0xa87555});
const front=new THREE.Mesh(new THREE.BoxGeometry(5,3,.2),material);front.position.set(0,1.5,3);room.add(front);
const floor=new THREE.Mesh(new THREE.BoxGeometry(5,.1,6),material);floor.position.y=-.05;room.add(floor);
const occ=new BuildingOcclusion(scene);aim(0,1.6,6);tick(scene,occ);
const entry=occ.entries[0];assert(entry.alpha<.13);assert.equal(entry.coverage,1);assert.equal(front.material.transparent,true);assert.equal(front.material.opacity,1,'Cutaway alpha is spatial; source opacity stays unchanged');
assert.equal(material.transparent,false,'Shared original material is not changed');
for(const record of entry.meshes){assert.equal(record.depthMesh.geometry,record.mesh.geometry,'Depth pass shares geometry, with no duplicated model data');assert(record.depthMesh.visible);for(const mat of Array.isArray(record.depthMesh.material)?record.depthMesh.material:[record.depthMesh.material]){assert.equal(mat.colorWrite,false);assert.equal(mat.depthWrite,true);assert.equal(mat.transparent,false);}}

front.position.z=-3;tick(scene,occ);assert.equal(entry.alpha,1,'Geometry behind the avatar is opaque');assert.equal(front.material.transparent,false);assert.equal(front.material.depthWrite,true);assert(entry.meshes.every(record=>!record.depthMesh.visible),'Restored architecture has no extra depth draw');
front.position.set(-3,1.5,3);front.scale.x=.35;const side=front.clone();side.position.x=3;room.add(side);tick(scene,occ);assert.equal(entry.coverage,0);assert.equal(entry.alpha,1,'A clear doorway does not fade');
const pillar=new THREE.Mesh(new THREE.BoxGeometry(.10,3,.10),material);pillar.position.set(0,1.5,3);room.add(pillar);tick(scene,occ);assert(entry.coverage<=1/3);assert.equal(entry.alpha,1,'A narrow pillar does not flash the whole room');room.remove(pillar,side);front.scale.x=1;front.position.set(0,1.5,3);tick(scene,occ);assert(entry.alpha<.13);
front.position.z=-3;tick(scene,occ,6);assert(entry.alpha<.13,'A brief clear glimpse does not reset opacity');tick(scene,occ);assert.equal(entry.alpha,1);

// High detail can arrive between two sample ticks. It must get the currently
// active fade before the very next render, without touching its original mats.
front.position.z=3;tick(scene,occ);const replacement=new THREE.Mesh(front.geometry,material);replacement.position.copy(front.position);room.remove(front);room.add(replacement);tick(scene,occ,1);assert.equal(replacement.material.transparent,true);assert.equal(replacement.material.opacity,1);assert.equal(entry.meshes.some(x=>x.mesh===front),false);
assert.equal(front.material,material,'A removed mesh gets its original material back');
room.remove(replacement);room.add(front);tick(scene,occ,1);assert.equal(front.material.transparent,true,'A previously removed mesh can participate again');
aim(0,1.2,1.5);tick(scene,occ);assert.equal(entry.alpha,1,'A camera inside the room with a clear body view needs no cutaway');aim(0,1.6,6);tick(scene,occ);assert(entry.alpha<.13);
room.visible=false;tick(scene,occ,1);assert.equal(entry.alpha,1);assert.equal(front.material.transparent,false);room.visible=true;tick(scene,occ);assert(entry.alpha<.13);
const hiddenParent=new THREE.Group();scene.add(hiddenParent);hiddenParent.add(room);hiddenParent.visible=false;tick(scene,occ,1);assert.equal(entry.alpha,1,'Hidden ancestors stop fading as well');hiddenParent.visible=true;tick(scene,occ);assert(entry.alpha<.13);
hiddenParent.remove(room);tick(scene,occ,1);assert.equal(occ.entries.length,0,'Detached buildings leave the controller immediately');assert.equal(front.material,material);scene.add(room);tick(scene,occ);assert.equal(occ.entries.length,1);assert(occ.entries[0].alpha<.13,'A detached and reattached root is registered again');
const distant=new THREE.Group();distant.userData.buildingId='distant-room';distant.position.x=1000;const farWall=new THREE.Mesh(new THREE.BoxGeometry(5,3,.2),material);distant.add(farWall);scene.add(distant);tick(scene,occ);assert.equal(farWall.geometry.boundsTree,undefined,'Distant buildings do not build or query a triangle BVH');

// The actual v26 temple has separate inner walls/ceiling and an outer shell.
// Cover both near/far geometry, front and side walls, and an elevated camera.
const bounds=ASSET_BOUNDS.temple,scale=11.6/(bounds.max[0]-bounds.min[0]),deck=BUILDING_COLLISIONS.temple.deck;
const makeTemple=async suffix=>{
 const asset=(await parseAsset('assets/temple'+suffix+'.glb')).scene;
 asset.position.set(-(bounds.min[0]+bounds.max[0])/2,-bounds.min[1],-(bounds.min[2]+bounds.max[2])/2);
 const root=new THREE.Group();root.add(asset);root.scale.setScalar(scale);root.rotation.y=Math.PI;root.position.set(23,deck-.1046*scale,40);root.userData.buildingId='temple';root.userData.templeInterior={floor:deck};return {root,asset};
};
const results=[];
for(const suffix of ['-lod','']){
 const world=new THREE.Scene(),{root,asset}=await makeTemple(suffix);world.add(root);const cutaway=new BuildingOcclusion(world);
 feet.set(24.05,deck,40.7);head.copy(feet).y+=1.4;
 for(const [name,pos]of [['front',[24.05,deck+2.3,33]],['left',[16,deck+2.0,40.7]],['right',[30,deck+2.0,40.7]],['roof',[24.05,deck+8.5,36]]]){
  aim(...pos);tick(world,cutaway);const record=cutaway.entries[0];assert(record.alpha<.15,`${suffix||'near'} ${name}: coverage ${record.coverage}, alpha ${record.alpha}`);results.push({detail:suffix||'near',view:name,coverage:record.coverage});
 }
 let materials=0;asset.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.buildingDepthOnly)return;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){assert(m.transparent,'Both original shell and added room primitives participate');materials++;}});assert(materials>=4);
 // Leaving the temple with the entire building behind the avatar restores all
 // material flags instead of leaving an invisible building in the landscape.
 feet.set(23,deck,30);head.copy(feet).y+=1.4;aim(23,deck+2.3,24);tick(world,cutaway);assert.equal(cutaway.entries[0].alpha,1);asset.traverse(mesh=>{if(mesh.isMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.equal(m.transparent,false);});
}

// Exercise the actual replaceDetail() LOD path rather than just adding a mesh.
const world=new THREE.Scene(),{root,asset}=await makeTemple('-lod'),lod=new THREE.LOD();root.remove(asset);root.add(lod);lod.addLevel(asset,0);world.add(root);const cutaway=new BuildingOcclusion(world);feet.set(24.05,deck,40.7);head.copy(feet).y+=1.4;aim(30,deck+2,40.7);tick(world,cutaway);const next=(await parseAsset('assets/temple.glb')).scene;replaceDetail(asset,next);tick(world,cutaway,1);assert(cutaway.entries[0].alpha<.13);next.traverse(mesh=>{if(mesh.isMesh&&!mesh.userData.buildingDepthOnly)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.equal(m.transparent,true);});
console.log(JSON.stringify({synthetic:'PASS: finite rays, doorway, narrow pillar, hysteresis, restore, shared materials, inside camera, hidden ancestors, detach/reattach, distant BVH avoidance',temple:results,lodReplacement:'PASS',gpu:'Shader compilation, floor preservation and rear-wall appearance require browser verification'},null,2));
