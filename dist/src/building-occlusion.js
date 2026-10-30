import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast,CENTER} from '../vendor/three-mesh-bvh.module.js';
import {BUILDING_COLLISIONS} from './building-collisions.js';

// Architecture needs a cutaway, rather than making its floor and rear walls
// transparent along with the outside shell. All changes are runtime materials.
const FADED_ALPHA=.12;
const materialsOf=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const within=(root,ancestor)=>{for(let node=root;node;node=node.parent)if(node===ancestor)return true;return false;};
const visibleWithin=(root,scene)=>{for(let node=root;node;node=node.parent){if(!node.visible)return false;if(node===scene)return true;}return false;};
const cutawayMask=`
 float aboveBuildingFloor=smoothstep(uBuildingFloor+.07,uBuildingFloor+.22,vBuildingWorld.y);
 float cameraSide=smoothstep(-.30,.12,dot(vBuildingWorld-uBuildingTarget,uBuildingView));`;
function addCutawayUniforms(shader,entry){
 Object.assign(shader.uniforms,entry.uniforms);
 shader.vertexShader='varying vec3 vBuildingWorld;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBuildingWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
 shader.fragmentShader='uniform float uBuildingReveal,uBuildingFloor;uniform vec3 uBuildingTarget,uBuildingView;varying vec3 vBuildingWorld;\n'+shader.fragmentShader;
}
function releaseMaterialRecord(entry,record){
 if(record.mesh.material===record.assignedMaterial)record.mesh.material=record.originalMaterial;
 record.mesh.remove(record.depthMesh);
 entry.known.delete(record.mesh);
 for(const {material}of record.list)material.dispose();
 for(const material of materialsOf(record.depthMesh))material.dispose();
}

export class BuildingOcclusion {
 constructor(scene){
  this.scene=scene;this.entries=[];this.seen=new WeakSet();this.scanClock=0;this.sampleClock=0;
  this.ray=new THREE.Raycaster();this.ray.firstHitOnly=true;
  this.origin=new THREE.Vector3();this.right=new THREE.Vector3();this.direction=new THREE.Vector3();this.broad=new THREE.Vector3();
 }
 scan(){
  this.scene.traverse(root=>{
   if(!root.userData.buildingId||this.seen.has(root))return;
   this.seen.add(root);root.updateWorldMatrix(true,true);
   const floor=root.userData.templeInterior?.floor??root.userData.walkableDeck?.y??BUILDING_COLLISIONS[root.userData.buildingId]?.deck??root.position.y;
   this.entries.push({root,box:new THREE.Box3().setFromObject(root),floor,alpha:1,desired:1,blockedTime:0,clearTime:0,coverage:0,active:false,known:new WeakSet(),meshes:[],uniforms:{
    uBuildingReveal:{value:0},uBuildingFloor:{value:floor},uBuildingTarget:{value:new THREE.Vector3()},uBuildingView:{value:new THREE.Vector3(0,0,1)},
   }});
  });
 }
 prepare(entry){
  // Also runs while fading so a streamed high-detail replacement is treated
  // before its first rendered frame, with the same reveal amount as its LOD.
  entry.root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.userData.buildingDepthOnly||entry.known.has(mesh)||mesh.name.includes('Details'))return;
   entry.known.add(mesh);
   const originalMaterial=mesh.material,original=materialsOf(mesh),list=original.map(source=>{
    const material=source.clone(),previous=source.onBeforeCompile,key=source.customProgramCacheKey();
    material.onBeforeCompile=shader=>{
     previous.call(material,shader);
     addCutawayUniforms(shader,entry);
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',cutawayMask+`
      diffuseColor.a*=1.0-uBuildingReveal*aboveBuildingFloor*cameraSide;
      #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>key+'-building-cutaway-v27';
    return {material,transparent:source.transparent,depthWrite:source.depthWrite};
   });
   // The opaque floor/rear wall must write depth before the transparent shell.
   // Otherwise a later-drawn exterior platform can paint over the wood floor.
   // Share geometry and discard the fading region in this colorless pass; the
   // near walls therefore never block deeper transparent layers or the avatar.
   const depthMaterials=original.map(source=>{
    const depth=new THREE.MeshDepthMaterial({side:source.side,map:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest});
    depth.colorWrite=false;depth.depthWrite=true;depth.visible=!source.transparent&&source.opacity>=.999&&source.depthWrite;
    depth.onBeforeCompile=shader=>{addCutawayUniforms(shader,entry);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+cutawayMask+'\nif(uBuildingReveal*aboveBuildingFloor*cameraSide>.002)discard;');};
    depth.customProgramCacheKey=()=> 'building-cutaway-depth-v27';
    return depth;
   });
   const depthMesh=new THREE.Mesh(mesh.geometry,Array.isArray(originalMaterial)?depthMaterials:depthMaterials[0]);
   depthMesh.name=mesh.name+' · retained surface depth';depthMesh.userData.buildingDepthOnly=true;depthMesh.renderOrder=-1;depthMesh.frustumCulled=mesh.frustumCulled;
   mesh.add(depthMesh);
   mesh.material=Array.isArray(mesh.material)?list.map(x=>x.material):list[0].material;
   entry.meshes.push({mesh,list,depthMesh,originalMaterial,assignedMaterial:mesh.material});
  });
  entry.meshes=entry.meshes.filter(record=>{
   if(within(record.mesh,entry.root))return true;
   releaseMaterialRecord(entry,record);
   return false;
  });
 }
 measure(camera,head,feet,dt){
  camera.getWorldPosition(this.origin);
  this.right.setFromMatrixColumn(camera.matrixWorld,0);this.right.y=0;this.right.normalize();
  const samples=[];
  for(const h of [.30,.62,.94])for(const x of [-.20,0,.20])samples.push(feet.clone().lerp(head,h).addScaledVector(this.right,x));
  for(const entry of this.entries){
   if(!visibleWithin(entry.root,this.scene))continue;
   let blocked=0;
   entry.root.updateWorldMatrix(true,true);
   for(const target of samples){
    const distance=this.origin.distanceTo(target);if(distance<.3)continue;
    this.ray.set(this.origin,this.direction.copy(target).sub(this.origin).normalize());this.ray.near=.04;this.ray.far=distance-.10;
    if(!entry.box.containsPoint(this.origin)){
     const hit=this.ray.ray.intersectBox(entry.box,this.broad);
     if(!hit||hit.distanceTo(this.origin)>this.ray.far)continue;
    }
    let obstructed=false;
    entry.root.traverseVisible(mesh=>{
     if(obstructed||!mesh.isMesh||mesh.isSkinnedMesh||mesh.userData.buildingDepthOnly||mesh.name.includes('Details'))return;
     const materials=materialsOf(mesh);if(materials.every(m=>m.opacity<.1))return;
     // Defer the one-off BVH build until a camera/body segment actually enters
     // this building's bounds; distant architecture does no triangle work.
     if(!mesh.geometry.boundsTree)mesh.geometry.boundsTree=new MeshBVH(mesh.geometry,{strategy:CENTER,targetLeafSize:12,indirect:true});
     mesh.raycast=acceleratedRaycast;
     const sides=materials.map(m=>m.side),hits=[];
     try{materials.forEach(m=>m.side=THREE.DoubleSide);mesh.raycast(this.ray,hits);}
     finally{materials.forEach((m,i)=>m.side=sides[i]);}
     obstructed=hits.some(hit=>hit.point.y>entry.floor+.07);
    });
    if(obstructed)blocked++;
   }
   entry.coverage=blocked/9;
   // One narrow pillar is not enough to switch the entire room. The separate
   // enter/leave delays keep doorways and orbiting cameras from flashing.
   entry.blockedTime=blocked>=5?entry.blockedTime+dt:0;
   entry.clearTime=blocked<=2?entry.clearTime+dt:0;
   if(entry.blockedTime>=.16)entry.active=true;
   if(entry.clearTime>=.30)entry.active=false;
   entry.desired=entry.active?FADED_ALPHA:1;
  }
 }
 update(dt,camera,head,feet){
  // Scene removal must release our material clones and weak registration, so
  // retained assets can safely be reused without stale fading or ray tests.
  this.entries=this.entries.filter(entry=>{
   if(within(entry.root,this.scene))return true;
   for(const record of entry.meshes)releaseMaterialRecord(entry,record);
   this.seen.delete(entry.root);return false;
  });
  this.scanClock-=dt;
  if(this.scanClock<=0){this.scan();for(const entry of this.entries)entry.box.setFromObject(entry.root);this.scanClock=1;}
  for(const entry of this.entries){
   const floor=entry.root.userData.walkableDeck?.y,revision=entry.root.userData.occlusionRevision;
   if((floor!==undefined&&floor!==entry.floor)||revision!==entry.revision){
    if(floor!==undefined){entry.floor=floor;entry.uniforms.uBuildingFloor.value=floor;}
    entry.root.updateWorldMatrix(true,true);entry.box.setFromObject(entry.root);entry.revision=revision;
    entry.blockedTime=entry.clearTime=0;
   }
  }
  this.sampleClock+=dt;
  if(this.sampleClock>=.10){this.measure(camera,head,feet,this.sampleClock);this.sampleClock=0;}
  camera.getWorldPosition(this.origin);
  for(const entry of this.entries){
   if(!visibleWithin(entry.root,this.scene)){
    entry.alpha=entry.desired=1;entry.active=false;entry.coverage=entry.blockedTime=entry.clearTime=0;
   }
   entry.alpha+=(entry.desired-entry.alpha)*(1-Math.exp(-(entry.desired<1?9:5)*dt));
   if(Math.abs(entry.alpha-entry.desired)<.002)entry.alpha=entry.desired;
   const faded=entry.alpha<.999;
   if(faded)this.prepare(entry);
   entry.uniforms.uBuildingReveal.value=1-entry.alpha;
   entry.uniforms.uBuildingTarget.value.copy(feet).lerp(head,.58);
   entry.uniforms.uBuildingView.value.copy(this.origin).sub(entry.uniforms.uBuildingTarget.value).normalize();
   for(const meshRecord of entry.meshes){
    meshRecord.depthMesh.visible=faded;
    for(const record of meshRecord.list){
    const transparent=faded||record.transparent,material=record.material;
    if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
    material.depthWrite=faded?false:record.depthWrite;
    }
   }
  }
 }
}
