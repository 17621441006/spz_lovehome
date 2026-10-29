import * as THREE from 'three';
import {heightAt,LAYOUT,edgeRadius,lakeDist,lakeShore} from './terrain.js';

// Samples are taken from the actual root mesh, including both LODs, in normalized
// prototype space. A centre-point height cannot support a root spreading downhill.
// Elevated root arches and uneven trunk base cutouts are pulled down to baseY first
// so no angular sector around the trunk base floats above sloped terrain.
export function groundTreeBase(...prototypes){
 const v=new THREE.Vector3(),n=new THREE.Vector3(),NUM_SEC=24;
 for(const root of prototypes){
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),baseY=box.min.y;
  if(box.max.y-baseY<3)continue;
  const secMinY=Array(NUM_SEC).fill(Infinity);
  root.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);const dy=v.y-baseY;if(dy>.95)continue;const sIdx=Math.floor(((Math.atan2(v.z,v.x)+Math.PI)/(2*Math.PI))*NUM_SEC)%NUM_SEC;if(dy<secMinY[sIdx])secMinY[sIdx]=dy;}});
  root.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();const pos=o.geometry.attributes.position,nor=o.geometry.attributes.normal,invMat=o.matrixWorld.clone().invert();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);const dy=v.y-baseY;if(dy>.78)continue;const sIdx=Math.floor(((Math.atan2(v.z,v.x)+Math.PI)/(2*Math.PI))*NUM_SEC)%NUM_SEC,sMin=secMinY[sIdx];let ny=0;if(nor){n.fromBufferAttribute(nor,i);ny=n.y;}if((ny<-.15&&dy<.75)||(sMin<.75&&dy<=sMin+.22)){v.y=baseY;v.applyMatrix4(invMat);pos.setXYZ(i,v.x,v.y,v.z);}}pos.needsUpdate=true;});
 }
}
export function rootFootprint(...prototypes){
 groundTreeBase(...prototypes);
 const cells=new Map(),v=new THREE.Vector3();
 for(const root of prototypes){root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>.24)continue;const key=Math.round(v.x*8)+','+Math.round(v.z*8);if(!cells.has(key)||cells.get(key).y>v.y)cells.set(key,v.clone());}});}
 return [...cells.values()];
}
export function rootPlacement(samples,x,z,size,rotation){
 const c=Math.cos(rotation),s=Math.sin(rotation),contact=samples.map(p=>({x:x+size*(c*p.x+s*p.z),z:z+size*(-s*p.x+c*p.z),y:size*p.y}));
 let y=Infinity,high=-Infinity,low=Infinity;
 for(const p of contact){const h=heightAt(p.x,p.z);y=Math.min(y,h-p.y-.085);high=Math.max(high,h);low=Math.min(low,h);}
 return {y,spread:high-low,contact:contact.map(p=>({x:p.x,y:p.y+y,z:p.z})),inside:contact.every(p=>Math.hypot(p.x,p.z)<edgeRadius(p.x,p.z)-(LAYOUT.playRadius-LAYOUT.treeLimit)&&lakeDist(p.x,p.z)>lakeShore(p.x,p.z)+.6)};
}
export function terrainSlope(x,z){return Math.hypot(heightAt(x+.5,z)-heightAt(x-.5,z),heightAt(x,z+.5)-heightAt(x,z-.5));}
