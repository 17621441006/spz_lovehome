// Local forest layers: rooted curved leaves, fern fans and sparse warm flowers.
// Plants share geometry/materials and never introduce movement colliders.
import * as THREE from 'three';
import {heightAt,trailDist,trailEdge,roadDist,catbusRouteDist,inLakeWater,edgeRadius} from './terrain.js';
import {LAYOUT,focalClearing} from './world-layout.js';
import {inElderRiver} from './elder-tree.js';
import {colliders} from './world.js';
import {rng} from './toon.js';

export const UNDERSTORY_ZONES=Object.freeze([
 {id:'west',name:'西北蕨谷',x:-31,z:-25,rx:14.5,rz:12.5},
 {id:'moon',name:'月光林带',x:12,z:-39,rx:13.5,rz:11.5},
]);
const TAU=Math.PI*2,clamp=THREE.MathUtils.clamp;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const greenDark=new THREE.Color('#234d3a'),greenMid=new THREE.Color('#40714d'),greenLight=new THREE.Color('#829a59');

class PlantGeometry{
 constructor(){this.positions=[];this.colors=[];this.indices=[];}
 vertex(p,c){const i=this.positions.length/3;this.positions.push(p.x,p.y,p.z);this.colors.push(c.r,c.g,c.b);return i;}
 surface(rows,columns,sample){const offset=this.positions.length/3;for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){const {p,c}=sample(i/rows,j/columns);this.vertex(p,c);}for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=offset+i*(columns+1)+j,b=a+columns+1;this.indices.push(a,b,a+1,b,b+1,a+1);}}
 tube(points,radius,color,segments=7){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,radius,4,false),p=g.attributes.position,offset=this.positions.length/3;for(let i=0;i<p.count;i++)this.vertex(V(p.getX(i),p.getY(i),p.getZ(i)),color);for(const i of g.index.array)this.indices.push(offset+i);g.dispose();}
 finish(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();let footprint=0;for(let i=0;i<this.positions.length;i+=3)footprint=Math.max(footprint,Math.hypot(this.positions[i],this.positions[i+2]));g.userData.footprint=footprint;return g;}
}

function broadleaf(){
 const g=new PlantGeometry(),cross=[-1,-.09,0,.09,1];
 for(let k=0;k<6;k++){
  const angle=k*2.399,dir=V(Math.sin(angle),0,Math.cos(angle)),side=V(Math.cos(angle),0,-Math.sin(angle));
  const length=.70+(k%3)*.13,width=.25+(k%2)*.06,stem=.30+(k%3)*.17;
  const center=t=>dir.clone().multiplyScalar(.07+length*t).add(V(0,stem+.50*Math.sin(t*Math.PI*.72)-.25*t*t,0));
  const at=(t,s)=>center(t).addScaledVector(side,s*Math.max(.004,Math.sin(t*Math.PI)**.72*width)).add(V(0,-.055*s*s*Math.sin(t*Math.PI),0));
  g.surface(8,4,(t,u)=>{const s=cross[Math.round(u*4)],edge=Math.abs(s),c=greenDark.clone().lerp(greenMid,.35+t*.4).lerp(greenLight,(edge*.18)+(s===0?.46:0));return{p:at(t,s),c};});
  g.tube([V(),dir.clone().multiplyScalar(.035).add(V(0,stem*.55,0)),center(0)],.012,greenDark,4);
  // Thin raised leaf veins are geometry, avoiding a full texture/alpha pass.
  for(const t of [.24,.42,.61])for(const sign of [-1,1])g.surface(1,1,(u,v)=>{const p=at(t+u*.16,sign*u*.83);p.y+=.004;p.addScaledVector(side,(v-.5)*.007);return{p,c:greenLight.clone().lerp(greenMid,.30)};});
 }
 return g.finish();
}

function fern(){
 const g=new PlantGeometry();
 for(let k=0;k<5;k++){
  const a=k*2.399,dir=V(Math.sin(a),0,Math.cos(a)),side=V(Math.cos(a),0,-Math.sin(a));
  const center=t=>dir.clone().multiplyScalar(t*(.89+(k%2)*.10)).add(V(0,.055+.66*Math.sin(t*Math.PI*.71),0));
  g.tube([center(0),center(.28),center(.6),center(1)],.009,greenLight.clone().lerp(greenDark,.4),8);
  for(let j=0;j<8;j++)for(const sign of [-1,1]){
   const t=.16+j*.095,base=center(t),reach=(.29*(1-t)+.025),tip=base.clone().addScaledVector(side,sign*reach).addScaledVector(dir,.11*(1-t));
   g.surface(4,2,(u,v)=>{const s=v*2-1,p=base.clone().lerp(tip,u).addScaledVector(dir,s*.047*Math.sin(Math.PI*u));p.y+=.042*Math.sin(Math.PI*u)-s*s*.012;const c=greenDark.clone().lerp(greenMid,.52+u*.18).lerp(greenLight,v===.5?.36:.10);return{p,c};});
  }
 }
 return g.finish();
}

function flowers(){
 const g=new PlantGeometry(),petal=new THREE.Color('#d99b6b'),edge=new THREE.Color('#edc89b'),center=new THREE.Color('#d1a24b');
 for(let k=0;k<3;k++){
  const a=k*2.399,base=V(Math.sin(a)*.14,0,Math.cos(a)*.14),top=base.clone().add(V(Math.sin(a)*.07,.34+k*.12,Math.cos(a)*.07));
  g.tube([base,base.clone().lerp(top,.55),top],.008,greenDark,4);
  for(let j=0;j<5;j++){
   const d=V(Math.sin(j*TAU/5),0,Math.cos(j*TAU/5)),s=V(d.z,0,-d.x);
   g.surface(4,2,(u,v)=>{const p=top.clone().addScaledVector(d,.014+.13*u).addScaledVector(s,(v*2-1)*.052*Math.sin(Math.PI*u));p.y+=.065*u*u;return{p,c:petal.clone().lerp(edge,u*.8)};});
  }
  const bud=new THREE.SphereGeometry(.028,7,4),p=bud.attributes.position,offset=g.positions.length/3;
  for(let i=0;i<p.count;i++)g.vertex(V(p.getX(i),p.getY(i),p.getZ(i)).add(top).add(V(0,.011,0)),center);
  for(const i of bud.index.array)g.indices.push(offset+i);bud.dispose();
 }
 return g.finish();
}

/** Whole foliage footprint, rather than only its stem, must leave the path clear. */
export function understoryClearance(x,z,radius=.9,{checkColliders=true}={}){
 if(![x,z,radius].every(Number.isFinite)||radius<0)return false;
 if(focalClearing(x,z,radius+.25)||trailDist(x,z)<radius+.80||trailEdge(x,z)<radius+.28||roadDist(x,z)<radius+2.85||catbusRouteDist(x,z)<radius+2.85)return false;
 if(Math.hypot(x,z)>edgeRadius(x,z)-radius-3||Math.hypot(x-LAYOUT.elder.x,z-LAYOUT.elder.z)<LAYOUT.elder.flat+2+radius||Math.hypot(x-LAYOUT.camphor.x,z-LAYOUT.camphor.z)<4+radius)return false;
 if(inLakeWater(x,z,-radius-.6)||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+radius+1)return false;
 const y=heightAt(x,z);let low=y,high=y;
 for(let i=0;i<12;i++){const a=i*TAU/12,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius,h=heightAt(px,pz);if(inElderRiver(px,pz)||inLakeWater(px,pz,-.4))return false;low=Math.min(low,h);high=Math.max(high,h);}
 if(inElderRiver(x,z)||high-low>.55)return false;
 if(checkColliders&&colliders.some(c=>!c.floorOnly&&!c.dynamic&&c.top>y+.15&&(c.bottom===undefined||c.bottom<y+1.3)&&(c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+.32:c.type==='box'&&x>c.minX-.40&&x<c.maxX+.40&&z>c.minZ-.40&&z<c.maxZ+.40)))return false;
 return true;
}

export function addForestUnderstory(scene,{low=false}={}){
 const group=new THREE.Group();group.name='层叠蕨谷 · 大叶与暖花';scene.add(group);
 const uniforms={uUnderstoryTime:{value:0},uUnderstoryRain:{value:0},uUnderstorySnow:{value:0}};
 function material(isFlower=false){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,side:THREE.DoubleSide,emissive:isFlower?'#b37333':'#000000',emissiveIntensity:isFlower?.015:0});
  m.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,uniforms);
   sh.vertexShader='uniform float uUnderstoryTime,uUnderstoryRain;varying float vUnderstoryTop;varying vec3 vUnderstoryWorld;\n'+sh.vertexShader;
   sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 underRoot=vec3(instanceMatrix[3].x,instanceMatrix[3].y,instanceMatrix[3].z);
    float underWind=sin(uUnderstoryTime*.72+underRoot.x*.63+underRoot.z*.38);
    float underBend=position.y*position.y*.025*(1.+uUnderstoryRain*.35);
    transformed.x+=underWind*underBend;transformed.z+=underWind*underBend*.45;
    vUnderstoryWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
    vUnderstoryTop=smoothstep(.12,.72,abs(objectNormal.y))*smoothstep(.09,.40,position.y);
   `);
   sh.fragmentShader='uniform float uUnderstorySnow;varying float vUnderstoryTop;varying vec3 vUnderstoryWorld;\n'+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float underMottle=.97+.03*sin(vUnderstoryWorld.x*12.7+sin(vUnderstoryWorld.z*9.1));
    diffuseColor.rgb*=underMottle;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.96,1.),uUnderstorySnow*vUnderstoryTop*.9);
   `);
  };
  m.customProgramCacheKey=()=> 'forest-understory30-v1';return m;
 }
 const leafy=material(),warm=material(true),prototypes={broadleaf:broadleaf(),fern:fern(),flowers:flowers()};
 const batches=[],placements=[],counts={broadleaf:0,fern:0,flowers:0};
 const dummy=new THREE.Object3D(),R=rng(300731);
 for(const zone of UNDERSTORY_ZONES){
  const accepted=[],cells=new Map(),target=low?60:110;
  for(let i=0;i<target*40&&accepted.length<target;i++){
   const a=R()*TAU,d=Math.sqrt(R()),x=zone.x+Math.cos(a)*zone.rx*d,z=zone.z+Math.sin(a)*zone.rz*d;
   const kind=R()<.51?'broadleaf':'fern',scale=(kind==='broadleaf'?.80:.76)+R()*.36;
   const radius=prototypes[kind].userData.footprint*scale+.10;
   // A meandering walk-through gap remains inside each dense planting patch.
   const gap=z-zone.z-.24*(x-zone.x)-.65*Math.sin((x-zone.x)*.5);
   if(Math.abs(gap)<1.0+radius||!understoryClearance(x,z,radius)||accepted.some(p=>Math.hypot(x-p.x,z-p.z)<(p.radius+radius)*.69))continue;
   const entry={kind,x,z,y:heightAt(x,z)-.018,scale,radius,angle:R()*TAU,zone:zone.id};accepted.push(entry);placements.push(entry);counts[kind]++;
   const cellKey=(x<zone.x?0:1)+':'+(z<zone.z?0:1),key=cellKey+':'+kind;
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry);
   if(accepted.length%11===3){const flower={...entry,kind:'flowers',scale:.8+R()*.3,radius:prototypes.flowers.userData.footprint*.4+.1};flower.x+=.28;flower.z-=.18;flower.y=heightAt(flower.x,flower.z)-.015;flower.radius=prototypes.flowers.userData.footprint*flower.scale+.10;if(understoryClearance(flower.x,flower.z,flower.radius)){const key=cellKey+':flowers';if(!cells.has(key))cells.set(key,[]);cells.get(key).push(flower);placements.push(flower);counts.flowers++;}}
  }
  for(const [key,entries]of cells){
   const kind=entries[0].kind,mesh=new THREE.InstancedMesh(prototypes[kind],kind==='flowers'?warm:leafy,entries.length);
   mesh.name=zone.name+' · '+({broadleaf:'弯叶',fern:'羽蕨',flowers:'暖花'}[kind]);mesh.castShadow=false;mesh.receiveShadow=true;
   for(let i=0;i<entries.length;i++){const p=entries[i];dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color().setRGB(.91+R()*.09,.94+R()*.06,.89+R()*.11));}
   mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();mesh.userData.understory={zone:zone.id,kind,count:entries.length,cell:key};group.add(mesh);
   const center=mesh.boundingSphere.center.clone(),radius=mesh.boundingSphere.radius;
   batches.push({mesh,center,radius,range:kind==='flowers'?(low?21:27):kind==='fern'?(low?30:39):(low?43:54)});
  }
 }
 const stats={zones:UNDERSTORY_ZONES.map(z=>({id:z.id,x:z.x,z:z.z,plants:placements.filter(p=>p.zone===z.id).length})),...counts,plants:placements.length,batches:batches.length,drawCalls:batches.length,triangles:batches.reduce((n,b)=>n+(b.mesh.geometry.index.count/3)*b.mesh.count,0),placements,collidersAdded:0,visibleBatches:batches.length};
 let elapsed=0;
 return{group,stats,
  update(dt,player,env={}){
   elapsed+=clamp(Number.isFinite(dt)?dt:0,0,.1);uniforms.uUnderstoryTime.value=elapsed;uniforms.uUnderstoryRain.value=clamp(env.rain||0,0,1);uniforms.uUnderstorySnow.value=clamp(env.snow||0,0,1);leafy.roughness=.98-(env.rain||0)*.12;warm.emissiveIntensity=.015+(env.night||0)*.075;
   const p=player?.pos||player?.position||player;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return;
   let visible=0;for(const b of batches){const d=Math.hypot(p.x-b.center.x,p.z-b.center.z)-b.radius,limit=b.range+(b.mesh.visible?2:0);b.mesh.visible=d<limit;if(b.mesh.visible)visible++;}stats.visibleBatches=visible;
  },
  dispose(){group.removeFromParent();for(const b of batches)b.mesh.dispose();for(const g of Object.values(prototypes))g.dispose();leafy.dispose();warm.dispose();}
 };
}
