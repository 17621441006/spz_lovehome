// Numerical QA harness: stubs only browser image/canvas IO, retains real Three scene,
// geometries, skeletons, mixers, world builders and movement code. No GPU claims.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../node_modules/three/build/three.module.js';
import {GLTFLoader} from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
export {THREE};
global.ProgressEvent=class{constructor(type,values){Object.assign(this,values)}};
global.document={createElement(){return {width:64,height:64,getContext(){return new Proxy({createRadialGradient(){return{addColorStop(){}}}}, {get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true;}});}};}};
THREE.TextureLoader.prototype.load=function(url,onLoad){const t=new THREE.Texture();t.userData.file=url;onLoad?.(t);return t;};
export async function parseAsset(url){
 const b=fs.readFileSync(path.resolve('dist',url)),n=b.readUInt32LE(12),d=JSON.parse(b.subarray(20,20+n));const materials=d.materials;const images=d.images,textures=d.textures,bin=b.subarray(n+28);
 delete d.images;delete d.textures;d.materials=d.materials.map((m)=>({pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]}}));
 d.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(d),'');
 gltf.scene.traverse(o=>{if(!o.isMesh)return;const i=gltf.parser.associations.get(o.material)?.materials||0;const ti=materials[i].pbrMetallicRoughness?.baseColorTexture?.index;const image=ti!==undefined?images[textures[ti].source]:null;if(image){const v=d.bufferViews[image.bufferView];o.material.userData.image=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);o.material.userData.mime=image.mimeType;}});
 return gltf;
}
GLTFLoader.prototype.loadAsync=parseAsset;
