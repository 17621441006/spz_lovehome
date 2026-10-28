import * as THREE from 'three';
import {loadGLB,detailStream} from './asset-stream.js';
import {rootFootprint,rootPlacement} from './tree-grounding.js';
import {heightAt,LAYOUT,terrainSnow} from './terrain.js';
import {coatTree} from './forest-weather.js';
import {colliders} from './world.js';
import {rng} from './toon.js';
const streamTime={value:0},gladeGlow=[];
export function updateElderGlade(time,night=0){streamTime.value=time;for(const m of gladeGlow)m.emissiveIntensity=.08+night*.3;}
export async function addElderTree(scene){
 const root=(await loadGLB('assets/elder-tree.glb')).scene;root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 let tallest=0;for(const o of scene.children)if(o.userData.treeAsset||o.userData.groveKind==='sakura'){const b=new THREE.Box3().setFromObject(o);tallest=Math.max(tallest,b.max.y-b.min.y);}
 const height=Math.max(42,tallest*3.05),scale=height/size.y;root.scale.setScalar(scale);root.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
 const group=new THREE.Group();group.add(root);const {x,z}=LAYOUT.elder;group.position.set(x,heightAt(x,z)-.20,z);group.name='云冠古树';group.userData.occludingTree=true;group.userData.elderTree={height,ordinaryMaxHeight:tallest,originalTriangles:46643,location:[x,z]};
 root.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.95;if(m.map)m.map.anisotropy=8;}});coatTree(group);scene.add(group);group.updateMatrixWorld(true);
 colliders.push({type:'circle',x,z,r:4.4,top:999,elderTree:true});
 // The height field itself is flat under the entire root spread. This broad,
 // low moss bed closes tiny gaps between the uneven root tips and that soil.
 const bed=new THREE.Mesh(new THREE.SphereGeometry(1,48,12),new THREE.MeshStandardMaterial({color:'#657544',roughness:1}));bed.scale.set(8.4,.22,7.8);bed.position.set(x,heightAt(x,z)-.11,z);bed.name='古树的平底苔原';bed.receiveShadow=true;scene.add(bed);
 const glade=buildGlade();scene.add(glade);
 await addGladeModels(glade);

 return group;
}
async function addGladeModels(glade){
 const placements={
  'glade-tree':[[-1,8,6.8,.4],[-7.1,2.4,4.5,1.7],[7,4.3,5.2,-.6]],
  'glade-rock':[[-6.8,-6.5,1.3,.6],[7.7,-5.5,1.6,2.1],[4.6,8.2,.9,1.2]],
  'crystal':[[-5.7,6.5,1,.3],[5.8,-7.7,.9,1.2]]
 };
 function prototype(source,id,h){const m=source.clone(true);m.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(m),c=box.getCenter(new THREE.Vector3()),k=h/box.getSize(new THREE.Vector3()).y;m.scale.setScalar(k);m.position.set(-c.x*k,-box.min.y*k,-c.z*k);m.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.roughness=id==='glade-tree'?.95:.8;o.material.metalness=0;if(o.material.map)o.material.map.anisotropy=8;o.castShadow=o.receiveShadow=true;if(id!=='glade-tree'){o.material.emissive=new THREE.Color(id==='glade-rock'?'#75508a':'#678eb6');o.material.emissiveMap=o.material.map;gladeGlow.push(o.material);}});if(id==='glade-tree')coatTree(m);return m;}
 await Promise.all(Object.entries(placements).map(async([id,positions])=>{
  try{const base=(await loadGLB('assets/'+id+'-lod.glb')).scene,anchors=[];
   for(const [dx,dz,h,a]of positions){const m=prototype(base,id,h),lod=new THREE.LOD(),px=LAYOUT.elder.x+dx,pz=LAYOUT.elder.z+dz,support=rootPlacement(rootFootprint(m),px,pz,1,a);lod.addLevel(m,0);lod.addLevel(m.clone(true),22);lod.position.set(px,support.y,pz);lod.rotation.y=a;lod.userData.occludingTree=id==='glade-tree';lod.userData.gladeModel=id;lod.userData.gladeHeight=h;lod.userData.rootSupport=support.contact;lod.name=id==='glade-tree'?'溪畔的蘑菇古树':id==='glade-rock'?'暮光魔法岩':'溪畔月晶';glade.add(lod);anchors.push(lod);colliders.push({type:'circle',x:px,z:pz,r:id==='glade-tree'?h*.16:h*.42,top:999});}
   detailStream.add(id+'-elder-glade',anchors,async()=>{const high=(await loadGLB('assets/'+id+'.glb')).scene;for(const lod of anchors){const old=lod.levels[0].object,next=prototype(high,id,lod.userData.gladeHeight);lod.remove(old);lod.add(next);lod.levels[0].object=next;const support=rootPlacement(rootFootprint(next),lod.position.x,lod.position.z,1,lod.rotation.y);lod.position.y=support.y;lod.userData.rootSupport=support.contact;}});
  }catch(error){console.warn('古树摆件加载失败：'+id,error);}
 }));
}
function buildGlade(){
 const g=new THREE.Group();g.name='古树秘境 · 萤光蘑菇与浅溪';const {x,z}=LAYOUT.elder,R=rng(18028),ground=heightAt(x,z);
 const curve=new THREE.CatmullRomCurve3([[-8,-3],[-7,-6],[-3,-8.7],[2,-8.9],[6.1,-7],[8.9,-3.2]].map(([dx,dz])=>new THREE.Vector3(x+dx,ground+.032,z+dz)));
 const positions=[],uv=[],indices=[],left=[],right=[],steps=160;
 for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPoint(t),dir=curve.getTangent(t),n=new THREE.Vector3(-dir.z,0,dir.x).normalize(),w=.45+.12*Math.sin(t*13)+.1*Math.sin(t*25),a=p.clone().addScaledVector(n,-w),b=p.clone().addScaledVector(n,w);left.push(a.clone().addScaledVector(n,-.10));right.push(b.clone().addScaledVector(n,.10));for(const [j,v]of [a,b].entries()){positions.push(...v.toArray());uv.push(t*18,j);}if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
 const water=new THREE.ShaderMaterial({uniforms:{uTime:streamTime,uSnow:terrainSnow},side:THREE.DoubleSide,transparent:true,depthWrite:false,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;uniform float uSnow;varying vec2 vUv;void main(){float wave=sin(vUv.x*8.-uTime*2.1+sin(vUv.y*15.))* .5+.5;float glint=pow(wave,16.)*(.35+.65*sin(vUv.y*3.14159));float edge=pow(abs(vUv.y-.5)*2.,9.);vec3 c=mix(vec3(.21,.49,.43),vec3(.47,.72,.64),wave*.36);c+=vec3(.45,.57,.48)*glint*.55+vec3(.2,.22,.13)*edge;c=mix(c,vec3(.71,.84,.85),uSnow*.5);gl_FragColor=vec4(c,.94);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
 const mesh=new THREE.Mesh(geo,water);mesh.name='缓缓流动的浅溪';mesh.renderOrder=2;g.add(mesh);
 const bankMat=new THREE.MeshStandardMaterial({color:'#7c8060',roughness:1});for(const side of [left,right]){const bank=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side),160,.11,6,false),bankMat);bank.position.y=-.045;bank.receiveShadow=true;g.add(bank);}
 // Soft mossy stones and low rounded banks keep the stream approachable.
 const stoneGeo=new THREE.IcosahedronGeometry(1,2),stoneMat=new THREE.MeshStandardMaterial({color:'#a5ac86',roughness:1}),stones=new THREE.InstancedMesh(stoneGeo,stoneMat,72),dummy=new THREE.Object3D();
 for(let i=0;i<72;i++){const t=(i+.5)/72,p=curve.getPoint(t),n=new THREE.Vector3(-curve.getTangent(t).z,0,curve.getTangent(t).x).normalize(),side=i%2?1:-1;p.addScaledVector(n,side*(.63+R()*.15));dummy.position.copy(p);dummy.position.y=ground+.03;dummy.rotation.set(R(),R()*6,R());dummy.scale.set(.07+R()*.13,.045+R()*.055,.08+R()*.15);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);stones.setColorAt(i,new THREE.Color().setHSL(.15+R()*.07,.16,.42+R()*.18));}stones.castShadow=stones.receiveShadow=true;g.add(stones);
 const capGeo=new THREE.LatheGeometry([new THREE.Vector2(0,.32),new THREE.Vector2(.12,.31),new THREE.Vector2(.24,.25),new THREE.Vector2(.34,.13),new THREE.Vector2(.39,.035),new THREE.Vector2(.35,0),new THREE.Vector2(.10,.045),new THREE.Vector2(0,.055)],24),capMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8,emissive:'#293624',emissiveIntensity:.12});gladeGlow.push(capMat);
 const caps=new THREE.InstancedMesh(capGeo,capMat,40),stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.065,.10,.55,12),new THREE.MeshStandardMaterial({color:'#eee2ba',roughness:.95}),40),spots=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:'#fff2cc',roughness:1}),200);
 const patches=[[-8.5,1.8],[-7,6],[4.8,7.5],[8.8,1.4],[-2,-10],[6.7,-8.4],[-8.5,-5.3],[1.7,8.3]],palette=['#bf704c','#b08b5c','#8da895','#b192b7'];
 for(let i=0;i<40;i++){const [dx,dz]=patches[Math.floor(i/5)],px=x+dx+(R()-.5)*1.5,pz=z+dz+(R()-.5)*1.5,k=.4+R()*.9,py=heightAt(px,pz),yaw=R()*6.28;dummy.position.set(px,py+.275*k,pz);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(k);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);dummy.position.y=py+.53*k;dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);caps.setColorAt(i,new THREE.Color(palette[Math.floor(i/5)%4]));
  for(let j=0;j<5;j++){const a=j*2.399+yaw,r=.12+R()*.16;dummy.position.set(px+Math.cos(a)*r*k,py+(.53+.31-.19*(r/.28)**2)*k,pz+Math.sin(a)*r*k);dummy.rotation.set(0,a,0);dummy.scale.set(.026*k,.012*k,.037*k);dummy.updateMatrix();spots.setMatrixAt(i*5+j,dummy.matrix);}}
 for(const m of [caps,stems,spots]){m.castShadow=m.receiveShadow=true;g.add(m);}caps.name='溪边的彩色蘑菇';
 g.userData.elderGlade={streamLength:curve.getLength(),mushrooms:40,flatGround:ground};return g;
}
