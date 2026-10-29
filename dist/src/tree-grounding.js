import * as THREE from 'three';
import {heightAt,LAYOUT,edgeRadius,lakeDist,lakeShore} from './terrain.js';

// Samples are taken from the actual root mesh, including both LODs, in normalized
// prototype space. A centre-point height cannot support a root spreading downhill.
export function rootFootprint(...prototypes){
 const cells=new Map(),v=new THREE.Vector3();
 for(const root of prototypes){root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>.24)continue;const key=Math.round(v.x*8)+','+Math.round(v.z*8);if(!cells.has(key)||cells.get(key).y>v.y)cells.set(key,v.clone());}});}
 return [...cells.values()];
}
export function rootPlacement(samples,x,z,size,rotation){
 const c=Math.cos(rotation),s=Math.sin(rotation),contact=samples.map(p=>({x:x+size*(c*p.x+s*p.z),z:z+size*(-s*p.x+c*p.z),y:size*p.y}));
 let y=Infinity,high=-Infinity,low=Infinity;
 for(const p of contact){const h=heightAt(p.x,p.z);y=Math.min(y,h-p.y-.065);high=Math.max(high,h);low=Math.min(low,h);}
 return {y,spread:high-low,contact:contact.map(p=>({x:p.x,y:p.y+y,z:p.z})),inside:contact.every(p=>Math.hypot(p.x,p.z)<edgeRadius(p.x,p.z)-(LAYOUT.playRadius-LAYOUT.treeLimit)&&lakeDist(p.x,p.z)>lakeShore(p.x,p.z)+.6)};
}
export function terrainSlope(x,z){return Math.hypot(heightAt(x+.5,z)-heightAt(x-.5,z),heightAt(x,z+.5)-heightAt(x,z-.5));}
