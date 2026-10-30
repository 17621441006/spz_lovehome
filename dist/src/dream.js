import {furnishTemple} from './temple-interior.js';
import {loadGLB,detailStream,replaceDetail} from './asset-stream.js';
import {ASSET_BOUNDS} from './asset-bounds.js';
import {coatTree} from './forest-weather.js';
import {BUILDING_COLLISIONS} from './building-collisions.js';
import {openPavilion} from './pavilion.js';
import * as THREE from 'three';
import {heightAt,LAYOUT,roadDist,trailDist,edgeRadius,catbusRouteDist} from './terrain.js';
import {colliders,createTorii,nearStructure} from './world.js';
import {rng} from './toon.js';
import {focalClearing,FOREST_REGIONS} from './world-layout.js';
import {rootFootprint,rootPlacement,terrainSlope} from './tree-grounding.js';
import {buildDewCanopy} from './dew-canopy.js';
import {buildArrivalClearing} from './arrival-clearing.js';
export let magicTreePrototype=null;
const time={value:0},night={value:0},rain={value:0};
let pondUniforms=null, motes=null;const lanterns=[];
const tex=new THREE.TextureLoader();
const moss=tex.load('assets/textures/mossy-rock.jpg');moss.colorSpace=THREE.SRGBColorSpace;moss.wrapS=moss.wrapT=THREE.RepeatWrapping;moss.repeat.set(1.2,1.2);moss.anisotropy=4;
const stone=new THREE.MeshStandardMaterial({color:'#c5c7a4',map:moss,roughness:1});
function normalizeModel(root,width,reference=null){root.updateMatrixWorld(true);const box=reference||new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const s=width/size.x;const group=new THREE.Group();root.position.sub(new THREE.Vector3(center.x,box.min.y,center.z));group.add(root);group.scale.setScalar(s);root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.92;m.metalnessMap=null;m.roughnessMap=null;m.emissive=new THREE.Color('#d6e7a9');m.emissiveMap=m.map;m.emissiveIntensity=.10;if(m.map)m.map.anisotropy=8;if(m.normalScale)m.normalScale.set(.45,.45);}});return group;}
function lantern(scene,x,z){const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);const base=new THREE.Mesh(new THREE.CylinderGeometry(.32,.44,.22,8),stone);base.position.y=.11;const stem=new THREE.Mesh(new THREE.CylinderGeometry(.10,.15,.72,8),stone);stem.position.y=.55;const glow=new THREE.Mesh(new THREE.BoxGeometry(.38,.40,.38),new THREE.MeshStandardMaterial({color:'#ffdda0',emissive:'#ffb34e',emissiveIntensity:.8}));glow.position.y=1.06;const roof=new THREE.Mesh(new THREE.ConeGeometry(.48,.27,4),stone);roof.rotation.y=Math.PI/4;roof.position.y=1.4;g.add(base,stem,glow,roof);scene.add(g);colliders.push({type:'circle',x,z,r:.28,top:heightAt(x,z)+1.4});lanterns.push(glow.material);}
function stairs(scene){
 const group=new THREE.Group();group.name='稻荷山道 · 48级石阶';const x=LAYOUT.inari.x;
 for(let i=0;i<48;i++){const z=LAYOUT.inari.z+i*.53,top=heightAt(x,z)+.17;const st=new THREE.Mesh(new THREE.BoxGeometry(3.3,.46,.59),stone);st.position.set(x,top-.23,z);st.receiveShadow=true;st.castShadow=true;group.add(st);colliders.push({type:'box',minX:x-1.65,maxX:x+1.65,minZ:z-.295,maxZ:z+.295,top});
  if(i%5===0)group.add(createTorii(x,z,0,top,1.02));
  if(i%12===0){lantern(scene,x-2.25,z);lantern(scene,x+2.25,z);}
 }
 scene.add(group);
}
function wind(root){root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.onBeforeCompile=sh=>{sh.uniforms.uForestTime=time;sh.vertexShader='uniform float uForestTime;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat leafWind=pow(clamp(position.y,0.0,1.0),2.0);\ntransformed.x+=sin(uForestTime*.7+position.y*5.)*.009*leafWind;\ntransformed.z+=cos(uForestTime*.55+position.x*4.)*.006*leafWind;');};m.customProgramCacheKey=()=> 'forest-breeze-v1';}});}
function foundation(scene,x,z,width,depth,y){const base=new THREE.Mesh(new THREE.CylinderGeometry(width*.51,width*.55,.7,24),stone);base.scale.z=depth/width;base.position.set(x,y-.36,z);base.receiveShadow=true;scene.add(base);}
function atmosphere(scene){
 const n=150,p=new Float32Array(n*3),seed=[];for(let i=0;i<n;i++){const x=(Math.random()-.5)*65,z=(Math.random()-.5)*65;p.set([x,heightAt(x,z)+1+Math.random()*4,z],i*3);seed.push([p[i*3],p[i*3+1],p[i*3+2]]);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
 const mat=new THREE.ShaderMaterial({uniforms:{uNight:night},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:'varying float v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);v=position.x;gl_PointSize=clamp(30./-p.z,1.,5.);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform float uNight; varying float v;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(mix(vec3(1.,.9,.5),vec3(.75,1.,.6),uNight),pow(max(0.,1.-d),2.)*.7);}'});
 motes=new THREE.Points(g,mat);motes.userData.seed=seed;scene.add(motes);
}
export async function loadDreamWorld(scene,low,{progressive=false}={}){
 const names=['forest-tree','forest-tree-lod','broadleaf-tree','broadleaf-tree-lod','fantasy-tree','fantasy-tree-lod','treehouse','shrine-lod','pagoda-lod','temple-lod',...LAYOUT.buildings.map(b=>b.id),LAYOUT.reflection.id];
 const streamed=new Set(['shrine','pagoda','temple']);
 const assetUrl=n=>n===LAYOUT.reflection.id?'assets/buildings/reflection-house-v2.glb':'assets/'+(progressive&&streamed.has(n)?n+'-lod':n)+'.glb';
 const urls=[...new Set(names.map(assetUrl))];
 const files=new Map(await Promise.all(urls.map(async u=>[u,(await loadGLB(u)).scene])));
 const assets=Object.fromEntries(names.map(n=>[n,files.get(assetUrl(n)).clone(true)]));
 const originalBox=n=>ASSET_BOUNDS[n]?new THREE.Box3(new THREE.Vector3(...ASSET_BOUNDS[n].min),new THREE.Vector3(...ASSET_BOUNDS[n].max)):null;

 const trees={};for(const name of ['forest-tree','broadleaf-tree','fantasy-tree']){assets[name].updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(assets[name]);const high=normalizeModel(assets[name],8.4,bounds),far=normalizeModel(assets[name+'-lod'],8.4,bounds);wind(high);wind(far);coatTree(high);coatTree(far);trees[name]={high,far,roots:rootFootprint(high,far)};}
 magicTreePrototype=trees['forest-tree'].high;
 function tree(type,x,z,size=1,rotation=0,distant=false){if(focalClearing(x,z,1))return null;if(Math.hypot(x-LAYOUT.elder.x,z-LAYOUT.elder.z)<LAYOUT.elder.flat+2)return null;if(catbusRouteDist(x,z)<3.8)return null;const proto=trees[type];let support=rootPlacement(proto.roots,x,z,size,rotation);
  if(support.spread>.9){const ox=x,oz=z;let found=false;for(let r=1;r<=10&&!found;r++)for(let j=0;j<20;j++){const a=j/20*Math.PI*2,nx=ox+Math.cos(a)*r,nz=oz+Math.sin(a)*r;if(Math.hypot(nx,nz)+4.2*size>LAYOUT.treeLimit||roadDist(nx,nz)<3||trailDist(nx,nz)<2.5||nearStructure(nx,nz,2)||focalClearing(nx,nz,1))continue;if(colliders.some(c=>c.top>900&&c.type==='circle'&&Math.hypot(nx-c.x,nz-c.z)<c.r+1.6))continue;const candidate=rootPlacement(proto.roots,nx,nz,size,rotation);if(candidate.inside&&candidate.spread<.8){x=nx;z=nz;support=candidate;found=true;break;}}if(!found)return null;}
  if(!support.inside||catbusRouteDist(x,z)<3.8)return null;let t;if(distant)t=proto.far.clone(true);else{t=new THREE.LOD();t.addLevel(proto.high.clone(true),0);t.addLevel(proto.far.clone(true),low?17:28);}
  t.name=distant?'远景模型树':'森林模型树';t.userData.treeAsset=type;t.userData.rootSupport=support.contact;t.userData.rootSpread=support.spread;t.position.set(x,support.y,z);t.rotation.y=rotation;t.scale.multiplyScalar(size);if(distant)t.traverse(o=>{if(o.isMesh)o.castShadow=false;});scene.add(t);colliders.push({type:'circle',x,z,r:.52*size,top:999});return t;}
 const near=[[-18,-25,.9],[-24,-19,.85],[-39,-18,.9],[-42,9,.9],[-35,25,.8],[-17,37,.8],[-12,45,.9],[11,41,.8],[34,25,.85],[40,18,.85],[43,-6,.95],[35,-39,.8],[17,-38,.85],[10,-27,.95]];
 near.forEach(([x,z,size],i)=>tree(i%3===0?'broadleaf-tree':'forest-tree',x,z,size,i*2.3));
 // The original shrine keeps its location and gets a full-canopy model tree.
 const great=tree('broadleaf-tree',LAYOUT.camphor.x,LAYOUT.camphor.z,1.65,.3);if(great){great.name='大樟树';colliders[colliders.length-1].r=1.7;}
 for(const [x,z,size] of [[17,21,.65],[30,24,.7],[16,34,.8],[33,36,.65]])tree('fantasy-tree',x,z,size,.4+x);
 // v20: a ring of trees around the new lake, leaving the pier side open towards the island
 {const lk=LAYOUT.lake,R=rng(404);let n=0;for(let i=0;i<90&&n<(low?12:22);i++){const a=R()*Math.PI*2,off=Math.atan2(Math.sin(a-Math.PI/2),Math.cos(a-Math.PI/2));if(Math.abs(off)<.8)continue;const d=lk.r+4.5+R()*10,x=lk.x+Math.cos(a)*d,z=lk.z+Math.sin(a)*d;if(Math.hypot(x,z)>edgeRadius(x,z)-5.5||nearStructure(x,z,2)||trailDist(x,z)<3)continue;const t=tree(n%3===0?'broadleaf-tree':n%5===0?'fantasy-tree':'forest-tree',x,z,.8+R()*.45,R()*6);if(t){t.name='星湖畔的树';n++;}}}
 // Broken woodland patches inside the world, with open meadow/valley sight lines.
 const random=rng(732),planted=scene.children.filter(o=>o.userData.treeAsset).map(o=>o.position.clone());let count=0;
 for(let attempt=0;attempt<900&&count<(low?26:38);attempt++){
  const a=random()*Math.PI*2,r=29+random()*28,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.68+random()*.35;
  if(r+4.2*size>LAYOUT.treeLimit||roadDist(x,z)<3||trailDist(x,z)<2.5||nearStructure(x,z,3)||focalClearing(x,z,2)||terrainSlope(x,z)>.36)continue;
  if((x< -20&&z>21)||(Math.abs(x+7)<6&&z< -22))continue;
  if(planted.some(p=>Math.hypot(x-p.x,z-p.z)<4.3))continue;
  if(colliders.some(c=>c.top>900&&(c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+2:x>c.minX-2&&x<c.maxX+2&&z>c.minZ-2&&z<c.maxZ+2)))continue;
  const type=count%8===0?'fantasy-tree':count%2?'broadleaf-tree':'forest-tree',angle=random()*Math.PI*2;
  if(rootPlacement(trees[type].roots,x,z,size,angle).spread>.85)continue;
  const t=tree(type,x,z,size,angle,true);if(t){planted.push(t.position.clone());count++;}
 }
 // Tall layered groves; all trees still use root support and boundary checks.
 for(const [cx,cz]of [[-31,-25],[12,-39]])for(let i=0;i<(low?4:6);i++){
  const a=i*2.399,r=3+Math.sqrt(i)*2.1,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r,size=1.1+(i%3)*.12;
  if(Math.hypot(x,z)+4.2*size>LAYOUT.treeLimit||nearStructure(x,z,3)||trailDist(x,z)<3||roadDist(x,z)<3)continue;
  if(colliders.some(c=>c.type==='circle'&&Math.hypot(x-c.x,z-c.z)<c.r+1.4))continue;
  const t=tree(i%3?'forest-tree':'broadleaf-tree',x,z,size,a);if(t){t.name='魔法森林 · 高冠层';}
 }
 const house=normalizeModel(assets.treehouse,11);coatTree(house);const {x,z}=LAYOUT.house,y=heightAt(x,z);house.position.set(x,y-.025,z);house.rotation.y=Math.PI;house.name='脏脏包的森林树屋';scene.add(house);foundation(scene,x,z,11,10,y);colliders.push({type:'circle',x,z,r:4.6,top:999});
 for(let i=0;i<4;i++){const sz=z-5.3-i*.6,st=new THREE.Mesh(new THREE.BoxGeometry(2.1,.15,.65),stone);st.position.set(x,heightAt(x,sz)+.05,sz);st.receiveShadow=true;scene.add(st);colliders.push({type:'box',minX:x-1.05,maxX:x+1.05,minZ:sz-.325,maxZ:sz+.325,top:st.position.y+.075});}lantern(scene,x-3.5,z-5.6);lantern(scene,x+3.5,z-5.6);
 for(const b of LAYOUT.buildings){const root=normalizeModel(assets[b.id],b.width,originalBox(b.id));if(assets[b.id+'-lod']){const near=root.children[0],far=assets[b.id+'-lod'];far.position.copy(near.position);const lod=new THREE.LOD();root.remove(near);lod.addLevel(near,0);lod.addLevel(far,low?18:30);root.add(lod);far.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.92;if(m.map)m.map.anisotropy=8;}}});}root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.normalScale)m.normalScale.set(.7,.7);});root.rotation.y=b.rotation;if(b.id==='shrine')root.scale.y/=Math.SQRT2;root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),ground=heightAt(b.x,b.z);root.position.set(b.x,ground-.02,b.z);root.name=b.name;root.userData.buildingId=b.id;scene.add(root);
  if(progressive&&streamed.has(b.id)){const lod=root.children.find(o=>o.isLOD),old=lod.levels[0].object;detailStream.add(b.id,[root],async()=>{const full=(await loadGLB('assets/'+b.id+'.glb')).scene;normalizeModel(full,b.width,originalBox(b.id));replaceDetail(old,full);});}
  foundation(scene,b.x,b.z,size.x,size.z,ground);
  colliders.push(...BUILDING_COLLISIONS[b.id].colliders.map(c=>({...c})));
  if(b.id==='shrine')openPavilion(root,b,scene,colliders);
  if(b.id==='temple')furnishTemple(root,b,scene,colliders);
 }
 // 星湖 · 倒影宅：模型原点就是水线，不套用贴地的 normalizeModel
 {
  const b=LAYOUT.reflection,root=assets[b.id].clone(true);
  root.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=true;const ms=Array.isArray(o.material)?o.material:[o.material];
   for(const m of ms){m.metalness=0;m.roughness=.9;m.side=THREE.FrontSide;
    if(m.name==='RH_Glow'){m.emissive=new THREE.Color('#ffb964');m.emissiveIntensity=1.5;}
    if(m.name==='RH_Paper'){m.emissive=new THREE.Color('#ffd9a6');m.emissiveIntensity=.30;}
   }});
  root.position.set(b.x,b.y,b.z);root.name=b.name;root.userData.buildingId=b.id;scene.add(root);
  colliders.push({type:'box',minX:b.x-1.7,maxX:b.x+1.7,minZ:b.z-1.6,maxZ:b.z+1.7,top:b.y+0.60,floorOnly:true,reflectionIslet:true});
  // 新开的一池静水 + 门前留白：水面、石板、讲规则的木牌
  {
   const water=createDreamWater(b.poolX,b.poolZ,b.poolR+0.35);
   water.position.y=b.y;water.name='倒影池水面';scene.add(water);
   const cv=document.createElement('canvas');cv.width=512;cv.height=256;
   const ctx=cv.getContext('2d');ctx.fillStyle='#cbb489';ctx.fillRect(0,0,512,256);
   ctx.strokeStyle='#8f7956';ctx.lineWidth=7;ctx.strokeRect(11,11,490,234);
   ctx.fillStyle='#3a3126';ctx.textAlign='center';ctx.font='bold 60px serif';ctx.fillText('倒影池',256,100);
   ctx.font='30px serif';ctx.fillText('走近门下 · E 拜访水下之家',256,168);
   const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
   const bx=b.x-3.0,bz=b.z+2.9,by=heightAt(bx,bz);
   const board=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.85,0.07),new THREE.MeshStandardMaterial({map:tex,roughness:.95}));
   board.position.set(bx,by+1.28,bz);board.rotation.y=0.75;board.castShadow=true;scene.add(board);
   const post=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,1.0,7),new THREE.MeshStandardMaterial({color:'#70634a',roughness:1}));
   post.position.set(bx,by+0.5,bz);post.castShadow=true;scene.add(post);
  }
 }
 // Overlapping crowns form woodland rooms instead of evenly spaced park trees.
 // Reuse the low-poly meshes for these background layers; keep all road margins.
 const layerRandom=rng(3031),forestLayers=[];
 for(const region of FOREST_REGIONS){let planted=0;for(let attempt=0;attempt<150&&planted<(low?6:10);attempt++){
  const angle=layerRandom()*Math.PI*2,r=3+Math.sqrt(layerRandom())*9,x=region.x+Math.cos(angle)*r,z=region.z+Math.sin(angle)*r,size=.94+layerRandom()*.29,type=planted%3?'forest-tree':'broadleaf-tree';
  if(Math.hypot(x,z)+4.2*size>LAYOUT.treeLimit||roadDist(x,z)<4.5||trailDist(x,z)<3.6||nearStructure(x,z,3)||focalClearing(x,z,2)||Math.hypot(x-LAYOUT.dewGlade.x,z-LAYOUT.dewGlade.z)<10)continue;
  if(colliders.some(c=>c.type==='circle'&&Math.hypot(x-c.x,z-c.z)<c.r+2.3))continue;
  if(rootPlacement(trees[type].roots,x,z,size,angle).spread>.8)continue;
  const t=tree(type,x,z,size,angle,true);if(!t)continue;t.name='幽林 · 相叠树冠';
  t.traverse(m=>{if(!m.isMesh)return;const shade=material=>{const c=material.clone();c.onBeforeCompile=material.onBeforeCompile;c.customProgramCacheKey=material.customProgramCacheKey;c.color.multiplyScalar(.86);c.emissiveIntensity=.045;return c;};m.material=Array.isArray(m.material)?m.material.map(shade):shade(m.material);});
  forestLayers.push(t);planted++;
 }}
 scene.userData.forestLayers=forestLayers;
 buildArrivalClearing(scene,trees['broadleaf-tree'],colliders);
 buildDewCanopy(scene,trees['broadleaf-tree'],colliders,{low});
 stairs(scene);atmosphere(scene);boundaryMist(scene);

}

function boundaryMist(scene){
 const g=new THREE.RingGeometry(51.5,125,128,5);g.rotateX(-Math.PI/2);
 const m=new THREE.ShaderMaterial({uniforms:{uTime:time,uNight:night},transparent:true,depthWrite:false,side:THREE.DoubleSide,
 vertexShader:'varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
 fragmentShader:`varying vec3 vWorld;uniform float uTime,uNight;void main(){float r=length(vWorld.xz);float flow=sin(vWorld.x*.12+uTime*.035)*cos(vWorld.z*.10-uTime*.025);float a=smoothstep(51.5,56.,r)*(1.-smoothstep(95.,125.,r))*(.52+.14*flow);vec3 c=mix(vec3(.77,.86,.78),vec3(.11,.19,.25),uNight);gl_FragColor=vec4(c,a);
 #include <colorspace_fragment>
 }`});const mist=new THREE.Mesh(g,m);mist.name='尽头云海 · 无树区';mist.position.y=-7.8;scene.add(mist);
}

export function createDreamWater(x,z,r){
 pondUniforms={uTime:time,uNight:night,uRain:rain,uCenter:{value:new THREE.Vector2(x,z)},uRadius:{value:r}};
 const mat=new THREE.ShaderMaterial({uniforms:pondUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
 vertexShader:`varying vec3 vWorld;uniform float uTime;void main(){vec3 p=position;vec4 w=modelMatrix*vec4(p,1.);w.y+=sin(w.x*2.2+uTime*.8)*sin(w.z*2.8-uTime*.6)*.012;vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec3 vWorld;uniform float uTime,uNight,uRain,uRadius;uniform vec2 uCenter;
 float wave(vec2 p){return sin(p.x*2.7+p.y*1.4+uTime*.65)*sin(p.y*3.2-p.x*.7-uTime*.8);}
 void main(){vec2 p=vWorld.xz-uCenter;float d=length(p);float edge=1.-smoothstep(uRadius-.2,uRadius+.6,d);float w=wave(p);float ripple=pow(.5+.5*sin(d*12.-uTime*1.6+w),14.);float glint=pow(max(0.,sin(p.x*9.+w+uTime)*sin(p.y*11.-uTime*.8)),28.);
 vec3 col=mix(vec3(.12,.40,.37),vec3(.44,.76,.66),.5+w*.25);float cloud=pow(max(0.,sin(p.x*.6+uTime*.025)*cos(p.y*.75)),3.);col=mix(col,vec3(.85,.91,.81),cloud*.28);col+=vec3(.40,.48,.3)*ripple*.16+vec3(1.,.91,.62)*glint*.65;col=mix(col,col*vec3(.27,.42,.6),uNight*.82);col=mix(col,vec3(.28,.43,.44),uRain*.3);float foam=smoothstep(uRadius-.1,uRadius+.25,d)*(1.-smoothstep(uRadius+.3,uRadius+.55,d));col+=foam*.24;gl_FragColor=vec4(col,edge*.89);#include <colorspace_fragment>}
 `.replace('#include <colorspace_fragment>}', '\n#include <colorspace_fragment>\n}')});
 // Compatibility with the shared environment palette setter; shader controls water color.
 mat.color=new THREE.Color('#5eaba2');const water=new THREE.Mesh(new THREE.CircleGeometry(r+.6,96),mat);water.rotation.x=-Math.PI/2;water.position.set(x,-.22,z);water.renderOrder=1;return water;
}
export function updateDream(t,n,r){time.value=t;night.value=n;rain.value=r;for(const m of lanterns)m.emissiveIntensity=.55+n*1.8;if(motes){const p=motes.geometry.attributes.position;for(let i=0;i<p.count;i++){const a=motes.userData.seed[i];p.setXYZ(i,a[0]+Math.sin(t*.18+i)*.7,a[1]+Math.sin(t*.45+i)*.3,a[2]+Math.cos(t*.12+i)*.6);}p.needsUpdate=true;}}
