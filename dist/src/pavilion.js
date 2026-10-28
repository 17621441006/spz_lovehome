import * as THREE from 'three';
import {heightAt} from './terrain.js';
// Only floor, stairs and pillars collide; the pavilion's interior remains open.
export function openPavilion(root,b,scene,colliders){
 root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),s=box.getSize(new THREE.Vector3()),ray=new THREE.Raycaster(new THREE.Vector3(b.x,box.max.y+1,b.z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(root,true).filter(h=>h.point.y<box.min.y+s.y*.35&&h.point.y>box.min.y+.05);const deck=hits.length?Math.max(...hits.map(h=>h.point.y)):box.min.y+s.y*.16;
 const wx=s.x*.37,wz=s.z*.30;
 const front=b.z-wz,base=heightAt(b.x,front-2.5),steps=Math.max(4,Math.ceil((deck-base)/.18)),depth=2.5/steps;const mat=new THREE.MeshStandardMaterial({color:'#846c4a',roughness:1});
 for(let i=0;i<steps;i++){const top=THREE.MathUtils.lerp(base,deck,(i+1)/steps),z=front-2.5+depth*(i+.5);const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.3,Math.max(.12,top-base),depth+.015),mat);mesh.position.set(b.x,top-Math.max(.12,top-base)/2,z);mesh.receiveShadow=mesh.castShadow=true;scene.add(mesh);colliders.push({type:'box',minX:b.x-1.15,maxX:b.x+1.15,minZ:z-depth/2,maxZ:z+depth/2,top,pavilion:true});}
 root.userData.walkableDeck={y:deck,width:wx*2,depth:wz*2};
}
