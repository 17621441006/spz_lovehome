import {loadGLB,detailStream,replaceDetail} from './asset-stream.js';
import {ASSET_BOUNDS} from './asset-bounds.js';
import {coatTree} from './forest-weather.js';
import * as THREE from 'three';
import {heightAt,LAYOUT,roadDist,trailDist} from './terrain.js';
import {rootFootprint,rootPlacement} from './tree-grounding.js';
import {nearStructure,colliders} from './world.js';
const crystalMaterials=[];
export async function addEnchantedGrove(scene,low=false,{progressive=false}={}){
 const ids=['sakura','sakura-lod','crystal','crystal-lod'];
 const urls=[...new Set(ids.map(n=>'assets/'+(progressive&&!n.endsWith('-lod')?n+'-lod':n)+'.glb'))];
 const files=new Map(await Promise.all(urls.map(async u=>[u,(await loadGLB(u)).scene])));
 const assets=Object.fromEntries(ids.map(n=>[n,files.get('assets/'+(progressive&&!n.endsWith('-lod')?n+'-lod':n)+'.glb').clone(true)]));
 const detailInstances={sakura:[],crystal:[]};

 function pair(name,height){const high=assets[name],far=assets[name+'-lod'];high.updateMatrixWorld(true);const box=new THREE.Box3(new THREE.Vector3(...ASSET_BOUNDS[name].min),new THREE.Vector3(...ASSET_BOUNDS[name].max)),c=box.getCenter(new THREE.Vector3()),s=height/box.getSize(new THREE.Vector3()).y;
  for(const root of [high,far]){root.position.sub(new THREE.Vector3(c.x,box.min.y,c.z));root.scale.setScalar(s);root.position.multiplyScalar(s);root.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=name==='crystal'?.48:.92;if(m.map)m.map.anisotropy=8;if(name==='crystal'){m.emissive=new THREE.Color('#836ac1');m.emissiveMap=m.map;m.emissiveIntensity=.11;crystalMaterials.push(m);}}});}
  if(name==='sakura'){coatTree(high);coatTree(far);}
  return{high,far,roots:rootFootprint(high,far)};}
 const trees=pair('sakura',6.8),crystals=pair('crystal',1.8);let treesPlaced=0,crystalsPlaced=0;
 function place(proto,x,z,size,angle,kind){if(Math.hypot(x,z)>LAYOUT.treeLimit-4||nearStructure(x,z,kind==='sakura'?2.5:1)||roadDist(x,z)<2.3||trailDist(x,z)<1.8)return false;if(Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+1.5)return false;
  if(colliders.some(c=>c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+(kind==='sakura'?2.1:1.2):x>c.minX-1.5&&x<c.maxX+1.5&&z>c.minZ-1.5&&z<c.maxZ+1.5))return false;
  const support=rootPlacement(proto.roots,x,z,size,angle);if(!support.inside||support.spread>.65)return false;const lod=new THREE.LOD();lod.addLevel(proto.high.clone(true),0);lod.addLevel(proto.far.clone(true),low?15:25);lod.scale.setScalar(size);lod.position.set(x,support.y,z);lod.rotation.y=angle;lod.name=kind==='sakura'?'樱花小径 · 模型树':'月光水晶';lod.userData.groveKind=kind;lod.userData.rootSupport=support.contact;scene.add(lod);detailInstances[kind].push(lod);colliders.push({type:'circle',x,z,r:(kind==='sakura'?.55:.65)*size,top:999});return true;}
 const anchors=[[3,14],[-11,12],[-22,5],[-22,-18],[10,-17],[0,-24],[10,25],[32,-2],[-29,-28],[31,14]];
 for(let i=0;i<anchors.length;i++){const [x,z]=anchors[i];for(let j=0;j<16;j++){const a=j*2.399,r=Math.sqrt(j)*1.2;if(place(trees,x+Math.sin(a)*r,z+Math.cos(a)*r,.85+(i%4)*.12,i*1.7,'sakura')){treesPlaced++;break;}}}
 for(const [i,[x,z]]of [[35,-14],[-34,-24],[-12,-35],[33,18],[-32,28]].entries())for(let j=0;j<12;j++){const a=j*2.399,r=Math.sqrt(j);if(place(crystals,x+Math.sin(a)*r,z+Math.cos(a)*r,.55+(i%3)*.25,i,'crystal')){crystalsPlaced++;break;}}
 if(progressive)for(const name of ['sakura','crystal'])detailStream.add(name,detailInstances[name],async()=>{
  const original=assets[name];assets[name]=(await loadGLB('assets/'+name+'.glb')).scene;const proto=pair(name,name==='sakura'?6.8:1.8).high;
  for(const lod of detailInstances[name])replaceDetail(lod.levels[0].object,proto.clone(true));assets[name]=original;
 });
 return{treesPlaced,crystalsPlaced};
}
export function updateCrystals(t,night){for(const m of crystalMaterials)m.emissiveIntensity=.09+night*.18+Math.sin(t*.55)*.025;}
