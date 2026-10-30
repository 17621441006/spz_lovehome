import * as THREE from 'three';
import {heightAt} from './terrain.js';
import {rootPlacement} from './tree-grounding.js';

// Three small trees frame the existing clearing; all dew / walking coordinates
// stay unchanged. A branch is one smooth, tapered, textured mesh, with its actual
// surface used for paw contact rather than an invisible floating platform.
export const DEW_TREES=[
 {x:13,z:-46.2,size:.64,angle:1.1,perch:[14.35,-46,1.15]},
 {x:19.9,z:-46.4,size:.70,angle:3.7,perch:[18,-46.8,2.05]},
 {x:20.8,z:-51.5,size:.76,angle:2.5,perch:[18.8,-50.5,2.55]},
];
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function barkTexture(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
 const c=canvas.getContext('2d');c.fillStyle='#786350';c.fillRect(0,0,128,256);
 for(let i=0;i<60;i++){const x=(i*37)%128;c.beginPath();c.moveTo(x,0);for(let y=0;y<=256;y+=8)c.lineTo(x+Math.sin(y*.035+i)*2.4,y);c.strokeStyle=i%3?'#665441':'#988269';c.lineWidth=i%4?.8:2;c.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,2);return map;
}
function branchGeometry(curve){
 const geometry=new THREE.TubeGeometry(curve,56,1,16,false),p=geometry.attributes.position,colors=[];
 const bark=new THREE.Color('#b4a18c'),top=new THREE.Color('#a6a184');
 for(let i=0;i<p.count;i++){const t=Math.floor(i/17)/56,center=curve.getPointAt(t),offset=V().fromBufferAttribute(p,i).sub(center),radius=t<.82?.37-.035*t:.34*(1-(t-.82)/.18)+.012;
  offset.multiplyScalar(radius);p.setXYZ(i,center.x+offset.x,center.y+offset.y*.58,center.z+offset.z);
  const color=bark.clone().lerp(top,Math.max(0,offset.y/radius)*.6);colors.push(color.r,color.g,color.b);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function pruneFlightCorridor(scene,habitat){
 const samples=[];
 for(const a of habitat.perches)for(const j of a.neighbors){if(j<a.id)continue;const b=habitat.perches[j],height=.65+Math.abs(b.position.y-a.position.y)*.22;
  for(let i=0;i<=40;i++){const t=i/40,p=a.position.clone().lerp(b.position,t);p.y+=4*t*(1-t)*height+.62;samples.push(p);}
 }
 const bounds=new THREE.Box3().setFromPoints(samples).expandByScalar(1);
 const inCorridor=p=>bounds.containsPoint(p)&&samples.some(s=>((p.x-s.x)/.92)**2+((p.y-s.y)/.88)**2+((p.z-s.z)/.92)**2<1);
 const trees=[...scene.children.filter(o=>o.userData.treeAsset&&Math.hypot(o.position.x-17,o.position.z+48)<12),...habitat.perches.map(p=>p.tree)];let removed=0;
 for(const tree of trees)tree.traverse(mesh=>{
  if(!mesh.isMesh)return;const source=mesh.geometry,p=source.attributes.position,index=source.index,world=Array.from({length:p.count},(_,i)=>V().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
  const clipped=world.map(v=>inCorridor(v)&&v.y>heightAt(v.x,v.z)+1.45),keep=[];let count=0;
  for(let i=0;i<(index?.count||p.count);i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
   if(clipped[a]||clipped[b]||clipped[c]||inCorridor(world[a].clone().add(world[b]).add(world[c]).multiplyScalar(1/3))){count++;continue;}keep.push(a,b,c);
  }
  if(count){mesh.geometry=source.clone();mesh.geometry.setIndex(keep);mesh.geometry.computeBoundingSphere();mesh.userData.dewPrunedTriangles=count;removed+=count;}
 });
 habitat.prunedTriangles=removed;
}
export function buildDewCanopy(scene,prototype,obstacles,{low=false}={}){
 const root=new THREE.Group();root.name='露灯小径 · 灯尾茸的三株栖树';const bark=new THREE.MeshStandardMaterial({map:barkTexture(),roughness:1,vertexColors:true});
 const perches=[],branches=[],trunks=[],ownedColliders=[];
 for(const [index,def] of DEW_TREES.entries()){
  const support=rootPlacement(prototype.roots,def.x,def.z,def.size,def.angle),tree=new THREE.LOD();tree.addLevel(prototype.high.clone(true),0);tree.addLevel(prototype.far.clone(true),low?18:28);tree.position.set(def.x,support.y,def.z);tree.scale.setScalar(def.size);tree.rotation.y=def.angle;tree.name='露灯栖树 '+(index+1);root.add(tree);
  tree.userData.occludingTree=true;
  const trunk={type:'circle',x:def.x,z:def.z,r:.42,top:heightAt(def.x,def.z)+5.5,noFloor:true,owner:'dew-tree'};obstacles.push(trunk);ownedColliders.push(trunk);trunks.push(trunk);
  const [x,z,h]=def.perch,y=heightAt(x,z)+h,dir=V(x-def.x,0,z-def.z).normalize(),end=V(x,y-.20,z);
  const curve=new THREE.CatmullRomCurve3([V(def.x,heightAt(def.x,def.z)+h*.42,def.z),V(def.x+dir.x*.7,y-.44,def.z+dir.z*.7),end.clone().addScaledVector(dir,-.6),end,end.clone().addScaledVector(dir,index===0?.40:.7),end.clone().addScaledVector(dir,index===0?.66:1.0).add(V(0,-.10,0))]);
  const branch=new THREE.Mesh(branchGeometry(curve),bark);branch.name='真实承托枝 '+(index+1);branch.castShadow=branch.receiveShadow=true;root.add(branch);branches.push(branch);
  // Low branch needs horizontal collision too, but never acts as a magic floor.
  if(index===0){for(let t=.1;t<.92;t+=.13){const q=curve.getPointAt(t),c={type:'circle',x:q.x,z:q.z,r:.32,bottom:q.y-.22,top:q.y+.22,noFloor:true,owner:'dew-branch'};obstacles.push(c);ownedColliders.push(c);}}
  perches.push({id:index,position:V(x,y,z),branch,tree,neighbors:index===1?[0,2]:[1]});
 }
 scene.add(root);root.updateMatrixWorld(true);const ray=new THREE.Raycaster();ray.ray.direction.set(0,-1,0);
 function surface(x,z,index){const p=perches[index];ray.set(V(x,p.position.y+.7,z),V(0,-1,0));ray.far=1.4;return ray.intersectObject(p.branch,false)[0]?.point.y??p.position.y-.02;}
 for(const p of perches)p.position.y=surface(p.position.x,p.position.z,p.id);
 const canopy={root,perches,trunks,branches,surface,low:0,dispose(){root.removeFromParent();for(const c of ownedColliders){const i=obstacles.indexOf(c);if(i>=0)obstacles.splice(i,1);}for(const b of branches)b.geometry.dispose();bark.map.dispose();bark.dispose();}};
 // Trim only the small local twig/leaf corridor in both LODs. Original GLBs and
 // shared prototype geometry are preserved, and whole trees never flicker away.
 pruneFlightCorridor(scene,canopy);
 scene.userData.dewCanopy=canopy;return canopy;
}
