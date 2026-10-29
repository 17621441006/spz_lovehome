import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {parseAsset} from './headless.mjs';
import {fitXiaosiReference,XIAOSI_REFERENCE_VERSION} from '../dist/src/xiaosi-reference.js';

const source='dist/assets/characters/xiaosi-c.glb',hash=()=>crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),beforeHash=hash();
const gltf=await parseAsset('assets/characters/xiaosi-c.glb'),meshes=[];
gltf.scene.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push({mesh,geometry:mesh.geometry,positions:mesh.geometry.attributes.position.array.slice(),normals:mesh.geometry.attributes.normal.array.slice()});});
fitXiaosiReference(gltf.scene);
let faceSeams=0,legVertices=0;
for(const {mesh,geometry:original,positions,normals} of meshes){
 const fitted=mesh.geometry,p=fitted.attributes.position,n=fitted.attributes.normal;
 assert.notEqual(fitted,original,'fitting must use a private geometry');
 assert.deepEqual(original.attributes.position.array,positions,'source geometry positions mutated');
 assert.deepEqual(original.attributes.normal.array,normals,'source geometry normals mutated');
 for(const name of ['uv','skinIndex','skinWeight'])assert.deepEqual(fitted.attributes[name].array,original.attributes[name].array,name+' changed');
 assert.deepEqual(fitted.index.array,original.index.array,'triangle topology changed');
 for(let i=0;i<n.count;i++)assert(Number.isFinite(n.getX(i))&&Number.isFinite(n.getY(i))&&Number.isFinite(n.getZ(i)),'non-finite normal');
 if(original.boundingBox?.min.y>.8)continue; // Detached hair retains its authored hard edges.
 const groups=new Map();
 for(let i=0;i<p.count;i++){
  const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
  if(y<.65){for(let k=0;k<3;k++){assert.equal(p.array[i*3+k],positions[i*3+k],'leg shape changed');assert.equal(n.array[i*3+k],normals[i*3+k],'untouched leg lost its authored normal');}legVertices++;}
  if(y<1.15||y>1.34||z<.03)continue;
  const key=[x,y,z].map(v=>Math.round(v*1e5)).join(',');
  if(groups.has(key)){
   const a=groups.get(key),oldDot=normals[a*3]*normals[i*3]+normals[a*3+1]*normals[i*3+1]+normals[a*3+2]*normals[i*3+2];
   if(oldDot>.999){const dot=n.getX(a)*n.getX(i)+n.getY(a)*n.getY(i)+n.getZ(a)*n.getZ(i);assert(dot>.999,'new face lighting crack across a smooth UV seam');faceSeams++;}
  }else groups.set(key,i);
 }
}
assert(faceSeams>700,'face seam sample is incomplete');assert(legVertices>1000,'leg sample is incomplete');
const geometryAfter=meshes.map(({mesh})=>mesh.geometry);fitXiaosiReference(gltf.scene);
meshes.forEach(({mesh},i)=>assert.equal(mesh.geometry,geometryAfter[i],'baked comparison model fitted twice'));
assert.equal(gltf.scene.userData.xiaosiReferenceFit,XIAOSI_REFERENCE_VERSION);
assert.equal(hash(),beforeHash,'original GLB overwritten');
console.log({faceSmoothSeams:faceSeams,unchangedLegVertices:legVertices,sourceGLB:'unchanged',UVsWeightsTopology:'unchanged',bakedFit:'idempotent'});
