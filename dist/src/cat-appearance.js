import * as THREE from 'three';
import {finishCatFace,updateCatExpression} from './cat-face.js';
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// Reconstruct the missing garment surface in bind space, retaining the imported
// red/gold fabric atlas. It deforms with the torso instead of exposing filler.
export function finishCatAppearance(model,rig){
 const {parts,bones,skeleton}=rig;
 model.updateMatrixWorld(true);
 rig.headRest=bones.Head.getWorldQuaternion(new THREE.Quaternion());
 // Eye-line landmarks in the source atlas show ~21° yaw and 8° roll baked
 // into the mesh itself. Correct that bind-space lean, not only the animation.
 const pivot=new THREE.Vector3(.0075,.727,.265);const orient=new THREE.Matrix4().makeTranslation(pivot.x-.02,pivot.y,pivot.z).multiply(new THREE.Matrix4().makeRotationZ(.14)).multiply(new THREE.Matrix4().makeRotationY(-.36)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
 for(const id of [0,2,29,32,38,44,48,51]){const g=parts.get(id).geometry;g.applyMatrix4(orient);g.computeBoundingBox();g.computeBoundingSphere();}

 const skull=parts.get(0).geometry,skp=skull.attributes.position;for(let i=0;i<skp.count;i++){const y=skp.getY(i),z=skp.getZ(i),round=Math.exp(-(((y-.72)/.13)**2))*(1-smooth(.10,.19,z));skp.setZ(i,z-.022*round);}skull.computeVertexNormals();
 finishCatFace(model,rig);rig.updateExpression=(time,dt,id)=>updateCatExpression(rig,time,dt,id);
 const bind=parts.get(0).bindMatrix.clone(),boneIndex=n=>skeleton.bones.indexOf(bones[n]);
 function skin(geo,name,material,weights){
  const ids=[],values=[];for(let i=0;i<geo.attributes.position.count;i++){const w=weights(i,geo.attributes.position);ids.push(...w.map(v=>boneIndex(v[0])));values.push(...w.map(v=>v[1]));}
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));
  const mesh=new THREE.SkinnedMesh(geo,material);mesh.name=name;mesh.bind(skeleton,bind);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);return mesh;
 }
 function weightAt(y){const chest=smooth(.40,.55,y),hips=1-smooth(.28,.42,y);return [['Spine2',chest],['Hips',hips],['Spine1',1-chest-hips],['Hips',0]];}
 const rows=[[.575,.135,.128],[.55,.163,.165],[.535,.185,.19],[.50,.195,.205],[.47,.195,.21],[.44,.187,.196],[.42,.18,.18],[.37,.165,.15],[.325,.169,.151],[.27,.195,.164],[.205,.196,.16]];
 function panel(name,levels,source,uvRect,inflate=0){
  const pos=[],uv=[],idx=[],cols=36;
  levels.forEach(([y,rx,rz],j)=>{for(let i=0;i<=cols;i++){const t=i/cols,a=1.32+t*(Math.PI*2-2*1.32);const ripple=Math.sin(t*Math.PI*12)*.0025*smooth(.34,.22,y);pos.push(-.012+Math.sin(a)*(rx+inflate+ripple),y,.17+Math.cos(a)*(rz+inflate+ripple));uv.push(uvRect[0]+t*uvRect[2],uvRect[1]+j/(levels.length-1)*uvRect[3]);if(j&&i){const k=j*(cols+1)+i;idx.push(k,k-1,k-cols-2,k,k-cols-2,k-cols-1);}}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const m=source.clone();m.userData={...source.userData};m.side=THREE.DoubleSide;m.roughness=.97;m.metalness=0;
  return skin(g,name,m,(i,p)=>weightAt(p.getY(i)));
 }
 panel('continuous_red_kimono_back',rows,parts.get(6).material,[.08,.24,.23,.57]);
 panel('gold_cloud_lower_robe',rows.slice(5),parts.get(10).material,[.08,.45,.26,.36],.004);
 const beltMaterial=new THREE.MeshStandardMaterial({color:'#3f281e',roughness:.92,side:THREE.DoubleSide});
 panel('kimono_back_obi',[[.387,.17,.157],[.354,.167,.157],[.327,.174,.159]],beltMaterial,[0,0,1,1],.009);
 // Reduce specular faceting across the UV seams on the skull and tail.
 smoothSeamNormals(parts.get(0).geometry);
 const oldHeadMat=parts.get(0).material;const headMat=parts.get(0).material=oldHeadMat.clone();headMat.userData={...oldHeadMat.userData};
 headMat.onBeforeCompile=sh=>{
  sh.vertexShader='varying vec3 vHeadLocal;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHeadLocal=position;');
  sh.fragmentShader='varying vec3 vHeadLocal;\n'+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float rear=(1.-smoothstep(.06,.20,vHeadLocal.z))*smoothstep(.59,.67,vHeadLocal.y)*(1.-smoothstep(.85,.91,vHeadLocal.y));
   float dark=1.-smoothstep(.12,.43,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.68,.30,.075),rear*dark*.68);`);
 };headMat.customProgramCacheKey=()=> 'cat-rear-fur-v16';


 // Tail fullness follows its curved centreline; the attachment stays narrow.
 const tail=rig.tail,g=tail.geometry,p=g.attributes.position,slices=32,centres=[];
 for(let k=0;k<=slices;k++){const z=.05-k*.54/slices;let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i)-z)<.027){loX=Math.min(loX,p.getX(i));hiX=Math.max(hiX,p.getX(i));loY=Math.min(loY,p.getY(i));hiY=Math.max(hiY,p.getY(i));}centres.push(new THREE.Vector2((loX+hiX)/2,(loY+hiY)/2));}
 for(let i=0;i<p.count;i++){const z=p.getZ(i),s=clamp((.05-z)/.54,0,1),f=s*slices,k=Math.min(slices-1,Math.floor(f)),c=centres[k].clone().lerp(centres[k+1],f-k),fullness=1+.26*smooth(.08,.50,s);p.setXY(i,c.x+(p.getX(i)-c.x)*fullness,c.y+(p.getY(i)-c.y)*fullness);}
 g.computeVertexNormals();smoothSeamNormals(g);
 function addTailMorphs(mesh){const a=mesh.geometry.attributes.position,up=[],sway=[],curl=[];for(let i=0;i<a.count;i++){const s=smooth(.035,-.47,a.getZ(i));up.push(0,.22*s,0);sway.push(.10*s*s,0,.024*s);curl.push(0,.036*s*Math.sin(s*Math.PI*.9),-.015*s*s);}mesh.geometry.morphTargetsRelative=true;mesh.geometry.morphAttributes.position=[up,sway,curl].map(a=>new THREE.Float32BufferAttribute(a,3));mesh.updateMorphTargets();}
 addTailMorphs(tail);
 // Fine tapered fur geometry gives a soft silhouette without a transparent shell.
 const hairPos=[],hairUV=[],hairIdx=[],hairNormals=[],norm=g.attributes.normal,uv=g.attributes.uv;
 let seed=867;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1400;i++){const j=Math.floor(random()*p.count),base=new THREE.Vector3().fromBufferAttribute(p,j),s=smooth(.035,-.47,base.z);if(s<.06)continue;const n=new THREE.Vector3().fromBufferAttribute(norm,j).normalize(),t=new THREE.Vector3(0,0,-1).addScaledVector(n,n.z).normalize(),side=new THREE.Vector3().crossVectors(n,t).normalize();const width=.0007+random()*.0012,len=(.010+random()*.014)*(.6+s*.4),tip=base.clone().addScaledVector(n,len*.32).addScaledVector(t,len*.95);const k=hairPos.length/3;for(const q of [base.clone().addScaledVector(side,-width),base.clone().addScaledVector(side,width),tip]){hairPos.push(q.x,q.y,q.z);hairNormals.push(n.x,n.y,n.z);hairUV.push(uv.getX(j),uv.getY(j));}hairIdx.push(k,k+1,k+2);}
 const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(hairPos,3));hg.setAttribute('uv',new THREE.Float32BufferAttribute(hairUV,2));hg.setIndex(hairIdx);hg.setAttribute('normal',new THREE.Float32BufferAttribute(hairNormals,3));const hm=tail.material.clone();hm.userData={...tail.material.userData};hm.side=THREE.DoubleSide;
 const fur=skin(hg,'tail_fine_fur',hm,()=>[['Hips',1],['Hips',0],['Hips',0],['Hips',0]]);addTailMorphs(fur);rig.tailMeshes=[tail,fur];
}

function smoothSeamNormals(g){
 const p=g.attributes.position,n=g.attributes.normal,buckets=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e5)).join(',');let b=buckets.get(key);if(!b){b={v:new THREE.Vector3(),ids:[]};buckets.set(key,b);}b.v.add(new THREE.Vector3().fromBufferAttribute(n,i));b.ids.push(i);}
 for(const b of buckets.values()){b.v.normalize();for(const i of b.ids)n.setXYZ(i,b.v.x,b.v.y,b.v.z);}n.needsUpdate=true;
}
