import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';
import {pathToFileURL} from 'node:url';
const {MeshoptSimplifier:S}=await import(pathToFileURL(path.resolve('node_modules/three/examples/jsm/libs/meshopt_simplifier.module.js')));
await S.ready;
const input=process.argv[2]||'input-models',output=process.argv[3]||'dist/assets';fs.mkdirSync(output,{recursive:true});
const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const specs=[{id:'temple',file:'日式寺院 3dモデル.glb',near:240000,far:40000},{id:'pagoda',file:'日式五重塔 3dモデル.glb',near:320000,far:40000}];
const stats=[];
function subtractBox(pos,attrs,indices,box){
 const lists=Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k,Array.from(v)])),out=[],P=lists.POSITION;
 const make=(a,b,t)=>{if(t<1e-7)return a;if(t>1-1e-7)return b;const id=P.length/3;for(const [k,arr]of Object.entries(lists)){const n=attrs[k].length/(pos.length/3);for(let i=0;i<n;i++)arr.push(arr[a*n+i]*(1-t)+arr[b*n+i]*t);}return id;};
 for(let ii=0;ii<indices.length;ii+=3){const tri=[indices[ii],indices[ii+1],indices[ii+2]];let disjoint=false;for(let ax=0;ax<3;ax++){if(tri.every(i=>P[i*3+ax]<box[ax*2])||tri.every(i=>P[i*3+ax]>box[ax*2+1])){disjoint=true;break;}}if(disjoint){out.push(...tri);continue;}
  let inside=tri;
  for(let ax=0;ax<3&&inside.length>=3;ax++)for(let side=0;side<2&&inside.length>=3;side++){
   const sign=side===0?1:-1,edge=box[ax*2+side],positive=[],negative=[];
   for(let j=0;j<inside.length;j++){const a=inside[j],b=inside[(j+1)%inside.length],da=(P[a*3+ax]-edge)*sign,db=(P[b*3+ax]-edge)*sign;
    (da>=0?positive:negative).push(a);if((da<0&&db>0)||(da>0&&db<0)){const id=make(a,b,da/(da-db));positive.push(id);negative.push(id);}
   }
   for(let j=1;j<negative.length-1;j++)out.push(negative[0],negative[j],negative[j+1]);inside=positive;
  }
 }
 return {attributes:Object.fromEntries(Object.entries(lists).map(([k,v])=>[k,new attrs[k].constructor(v)])),indices:new Uint32Array(out)};
}
function boxesGeometry(boxes){const p=[],n=[],uv=[],idx=[];for(const b of boxes){const [cx,cy,cz,sx,sy,sz]=b;for(const [axis,sgn,a1,a2]of [[0,1,1,2],[0,-1,1,2],[1,1,2,0],[1,-1,2,0],[2,1,0,1],[2,-1,0,1]]){const center=[cx,cy,cz],size=[sx,sy,sz],start=p.length/3;for(const [u,v]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const q=[...center],nn=[0,0,0];q[axis]+=sgn*size[axis]/2;q[a1]+=u*size[a1]/2;q[a2]+=v*size[a2]/2;nn[axis]=sgn;p.push(...q);n.push(...nn);uv.push((u+1)/2,(v+1)/2);}if(sgn>0)idx.push(start,start+1,start+2,start,start+2,start+3);else idx.push(start,start+2,start+1,start,start+3,start+2);}}
 return {attributes:{POSITION:new Float32Array(p),NORMAL:new Float32Array(n),TEXCOORD_0:new Float32Array(uv)},indices:new Uint32Array(idx)};
}
for(const spec of specs){
 const file=fs.readFileSync(path.join(input,spec.file)),jl=file.readUInt32LE(12),original=JSON.parse(file.subarray(20,20+jl)),bin=file.subarray(28+jl),originalViews=original.bufferViews,originalAccessors=original.accessors;
 const attr=id=>{const a=originalAccessors[id],v=originalViews[a.bufferView],T=types[a.componentType],n=sizes[a.type],stride=v.byteStride||n*T.BYTES_PER_ELEMENT,out=new T(a.count*n);for(let i=0;i<a.count;i++)new Uint8Array(out.buffer,i*n*T.BYTES_PER_ELEMENT,n*T.BYTES_PER_ELEMENT).set(bin.subarray((v.byteOffset||0)+(a.byteOffset||0)+i*stride,(v.byteOffset||0)+(a.byteOffset||0)+i*stride+n*T.BYTES_PER_ELEMENT));return out;};
 let prims=[];for(const mesh of original.meshes)for(const pr of mesh.primitives){let data={attributes:Object.fromEntries(Object.entries(pr.attributes).map(([k,id])=>[k,attr(id)])),indices:attr(pr.indices),material:pr.material};if(spec.id==='temple'){
  // Real subtractive cut through front door/veranda rail, plus clear room volume.
  data={...subtractBox(data.attributes.POSITION,data.attributes,data.indices,[-.087,.087,.097,.276,.075,.31]),material:pr.material};
  data={...subtractBox(data.attributes.POSITION,data.attributes,data.indices,[-.178,.178,.090,.291,-.200,.080]),material:pr.material};
 }prims.push(data);}
 for(const detail of ['near','far']){const doc=structuredClone(original),chunks=[];let offset=0;doc.bufferViews=[];doc.accessors=[];
  function view(raw){const bytes=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength),id=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return id;}
  function accessor(raw,type){const a={bufferView:view(raw),byteOffset:0,componentType:raw instanceof Float32Array?5126:5125,count:raw.length/sizes[type],type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<raw.length;i++){a.min[i%3]=Math.min(a.min[i%3],raw[i]);a.max[i%3]=Math.max(a.max[i%3],raw[i]);}}doc.accessors.push(a);return doc.accessors.length-1;}
  const destPrims=[];let triangles=0,errorMax=0;
  function append(data,material){const attributes={};for(const [k,raw]of Object.entries(data.attributes))attributes[k]=accessor(raw,k==='TEXCOORD_0'?'VEC2':'VEC3');destPrims.push({attributes,indices:accessor(data.indices,'SCALAR'),material});triangles+=data.indices.length/3;}
  for(const data of prims){const positions=data.attributes.POSITION,uv=data.attributes.TEXCOORD_0;
   const [reduced,error]=S.simplifyWithAttributes(data.indices,positions,3,uv,2,[.08,.08],null,spec[detail]*3,detail==='near'?.003:.008,['LockBorder']);const indices=new Uint32Array(reduced),[remap,count]=S.compactMesh(indices),compact={};
   for(const [key,raw]of Object.entries(data.attributes)){const n=raw.length/(positions.length/3),out=new raw.constructor(count*n);for(let i=0;i<remap.length;i++)if(remap[i]<count)for(let j=0;j<n;j++)out[remap[i]*n+j]=raw[i*n+j];compact[key]=out;}append({attributes:compact,indices},data.material);errorMax=Math.max(errorMax,error);
  }
  if(spec.id==='temple'){
   const material=(name,color)=>{doc.materials.push({name,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:0,roughnessFactor:.92}});return doc.materials.length-1;};
   const plaster=material('Warm plaster interior',[.62,.54,.39]),wood=material('Cedar interior boards',[.23,.105,.045]),dark=material('Cedar joinery',[.10,.040,.018]);
   const room=[[-.183,.196,-.059,.012,.190,.298],[.183,.196,-.059,.012,.190,.298],[0,.196,-.207,.378,.190,.012],[-.136,.196,.089,.096,.190,.012],[.136,.196,.089,.096,.190,.012],[0,.285,.089,.176,.014,.012],[0,.299,-.059,.378,.014,.308]];
   append(boxesGeometry(room),plaster);
   append(boxesGeometry([[0,.099,-.059,.370,.010,.300]]),wood);
   const beams=[[-.091,.187,.110,.009,.180,.022],[.091,.187,.110,.009,.180,.022],[0,.278,.110,.191,.008,.022]];
   for(const x of [-.173,.173])for(const z of [-.194,.077])beams.push([x,.197,z,.013,.194,.013]);
   for(let z=-.199;z<=.086;z+=.019)beams.push([0,.1042,z,.360,.0008,.0008]);
   for(const x of [-.13,0,.13])beams.push([x,.289,-.059,.010,.014,.295]);
   append(boxesGeometry(beams),dark);
   doc.extras={...(doc.extras||{}),interior:{floorY:.1046,ceilingY:.292,beamBottomY:.282,room:{minX:-.177,maxX:.177,minZ:-.201,maxZ:.083},door:{minX:-.0865,maxX:.0865,minY:.1046,maxY:.274,minZ:.075,maxZ:.31},frontAxis:'+Z',worldScaleSuggested:11.6}};
  }
  doc.meshes=[{name:spec.id+'-'+detail,primitives:destPrims}];doc.nodes=[{mesh:0,name:spec.id+'-'+detail}];doc.scenes=[{nodes:[0]}];doc.scene=0;
  for(const im of doc.images||[]){const v=originalViews[im.bufferView];let raw=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);if(detail==='far')raw=execFileSync('python',['-c',`import sys,io\nfrom PIL import Image\nim=Image.open(io.BytesIO(sys.stdin.buffer.read()));im.thumbnail((1024,1024),Image.Resampling.LANCZOS);out=io.BytesIO();im.convert('RGB').save(out,format='JPEG',quality=90);sys.stdout.buffer.write(out.getvalue())`],{input:raw,maxBuffer:5e6});im.bufferView=view(raw);if(detail==='far')im.mimeType='image/jpeg';}
  doc.buffers=[{byteLength:offset}];doc.asset.extras={source:spec.file,detail,textureSize:detail==='near'?4096:1024,triangles,maxSimplificationError:errorMax,doorIsGeometricCut:spec.id==='temple'};
  let j=Buffer.from(JSON.stringify(doc));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const bb=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+bb.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bb.length,0);bh.writeUInt32LE(0x004e4942,4);const dst=path.join(output,spec.id+(detail==='far'?'-lod':'')+'.glb');fs.writeFileSync(dst,Buffer.concat([header,j,bh,bb]));const result={id:spec.id,detail,triangles,errorMax,bytes:fs.statSync(dst).size,path:dst};stats.push(result);console.log(result);
 }
}
fs.writeFileSync(path.join(output,'asset-report.json'),JSON.stringify(stats,null,2));
