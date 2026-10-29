// Export fitted base geometry while preserving the original GLB's embedded
// textures, skeleton, weights and animations byte-for-byte. Game accessories
// and clothing shaders are still supplied by dressXiaosi, as with the original.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {parseAsset} from './headless.mjs';
import {fitXiaosiReference,XIAOSI_REFERENCE_VERSION} from '../dist/src/xiaosi-reference.js';

const source=path.resolve('dist/assets/characters/xiaosi-c.glb');
const output=path.resolve(process.argv[2]||'qa-output/xiaosi-v27-reference-base.glb');
assert.notEqual(output.toLowerCase(),source.toLowerCase(),'never overwrite the original character');
assert(!fs.existsSync(output),'comparison output already exists; choose a new version');
const raw=fs.readFileSync(source),originalHash=crypto.createHash('sha256').update(raw).digest('hex'),jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength)),binLength=raw.readUInt32LE(20+jsonLength),binary=Buffer.from(raw.subarray(28+jsonLength,28+jsonLength+binLength));
const gltf=await parseAsset('assets/characters/xiaosi-c.glb');fitXiaosiReference(gltf.scene);
const changed=[];
gltf.scene.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;
 const association=gltf.parser.associations.get(mesh),primitive=doc.meshes[association.meshes].primitives[association.primitives];
 for(const [semantic,name]of [['POSITION','position'],['NORMAL','normal']]){
  const accessor=doc.accessors[primitive.attributes[semantic]],view=doc.bufferViews[accessor.bufferView],attribute=mesh.geometry.attributes[name];
  assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');assert.equal(accessor.count,attribute.count);assert(!accessor.sparse);
  const stride=view.byteStride||12,start=(view.byteOffset||0)+(accessor.byteOffset||0);
  for(let i=0;i<attribute.count;i++)for(let k=0;k<3;k++)binary.writeFloatLE(attribute.array[i*3+k],start+i*stride+k*4);
  if(semantic==='POSITION'){accessor.min=mesh.geometry.boundingBox.min.toArray();accessor.max=mesh.geometry.boundingBox.max.toArray();}
 }
 changed.push(mesh.name);
});
const scene=doc.scenes[doc.scene||0];scene.extras={...scene.extras,xiaosiReferenceFit:XIAOSI_REFERENCE_VERSION};
doc.asset.extras={...doc.asset.extras,comparisonBase:'xiaosi-c.glb',sourceSHA256:originalHash,note:'v27 fitted base; runtime fit is already baked. Existing game adds the unchanged hair accessories, necklace, ring, clothing shader and pose correction.'};
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.concat([header,json,binHeader,binary]));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),originalHash);
const reread=await parseAsset(output);assert.equal(reread.scene.userData.xiaosiReferenceFit,XIAOSI_REFERENCE_VERSION);
const geometries=[];reread.scene.traverse(mesh=>{if(mesh.isSkinnedMesh)geometries.push(mesh.geometry);});fitXiaosiReference(reread.scene);let i=0;reread.scene.traverse(mesh=>{if(mesh.isSkinnedMesh)assert.equal(mesh.geometry,geometries[i++]);});
assert.equal(reread.animations.length,gltf.animations.length);
console.log({output,bytes:fs.statSync(output).size,meshes:changed,animations:gltf.animations.length,originalSHA256:originalHash,originalUntouched:true,alreadyFitted:XIAOSI_REFERENCE_VERSION});
