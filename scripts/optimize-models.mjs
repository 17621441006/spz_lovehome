import fs from 'node:fs';
import {MeshoptSimplifier as S} from '../node_modules/three/examples/jsm/libs/meshopt_simplifier.module.js';
await S.ready;
const specs=[[process.argv[2]||'raw/tree-original.glb','dist/assets/forest-tree.glb',42000],[process.argv[3]||'raw/treehouse-original.glb','dist/assets/treehouse.glb',85000]];
for(const [src,dst,target] of specs){
 const file=fs.readFileSync(src), jl=file.readUInt32LE(12), doc=JSON.parse(file.subarray(20,20+jl)), bin=file.subarray(28+jl);
 const originalViews=doc.bufferViews; const originalAccessors=doc.accessors;
 const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}, sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 function attr(id){const a=originalAccessors[id],v=originalViews[a.bufferView],T=types[a.componentType],n=sizes[a.type],stride=v.byteStride||n*T.BYTES_PER_ELEMENT;let out=new T(a.count*n);for(let i=0;i<a.count;i++){const raw=bin.subarray((v.byteOffset||0)+(a.byteOffset||0)+i*stride,(v.byteOffset||0)+(a.byteOffset||0)+i*stride+n*T.BYTES_PER_ELEMENT);new Uint8Array(out.buffer,i*n*T.BYTES_PER_ELEMENT,n*T.BYTES_PER_ELEMENT).set(raw);}return out;}
 const chunks=[];let offset=0;doc.bufferViews=[];doc.accessors=[];
 function view(raw){const bytes=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength);const id=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;let pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return id;}
 function accessor(raw,old){const a={...old,bufferView:view(raw),byteOffset:0,count:raw.length/sizes[old.type]};delete a.min;delete a.max;if(old.type==='VEC3'&&old.min){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<raw.length;i++) {a.min[i%3]=Math.min(a.min[i%3],raw[i]);a.max[i%3]=Math.max(a.max[i%3],raw[i]);}}doc.accessors.push(a);return doc.accessors.length-1;}
 let totalBefore=0,totalAfter=0;
 for(const mesh of doc.meshes)for(const p of mesh.primitives){
  const positions=attr(p.attributes.POSITION),uv=attr(p.attributes.TEXCOORD_0),idx=attr(p.indices);
  const [simplified,error]=S.simplifyWithAttributes(idx,positions,3,uv,2,[0.05,0.05],null,Math.min(target*3,idx.length),0.02,['Permissive']);
  const [remap,n]=S.compactMesh(simplified);totalBefore+=idx.length/3;totalAfter+=simplified.length/3;
  for(const [semantic,id] of Object.entries(p.attributes)){const old=originalAccessors[id],src=attr(id),k=sizes[old.type],compact=new src.constructor(n*k);for(let i=0;i<remap.length;i++)if(remap[i]<n)for(let j=0;j<k;j++)compact[remap[i]*k+j]=src[i*k+j];p.attributes[semantic]=accessor(compact,old);}
  p.indices=accessor(simplified,{...originalAccessors[p.indices],componentType:5125});
  console.log(dst,{triangles:simplified.length/3,vertices:n,error});
 }
 for(const im of doc.images){const v=originalViews[im.bufferView];im.bufferView=view(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}
 doc.buffers=[{byteLength:offset}];doc.asset.extras={optimization:'meshoptimizer UV-aware simplification; original textures preserved',trianglesBefore:totalBefore,trianglesAfter:totalAfter};
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const b=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+b.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(b.length,0);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(dst,Buffer.concat([header,json,bh,b]));console.log('saved',dst,fs.statSync(dst).size);
}
