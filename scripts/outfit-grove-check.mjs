import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadModelCat} from '../dist/src/modelcat.js';
import {loadHumanCharacter} from '../dist/src/human-character.js';
import {attachOutfit} from '../dist/src/outfits.js';
import {buildWorld,colliders} from '../dist/src/world.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {addEnchantedGrove} from '../dist/src/enchanted-grove.js';
import {heightAt} from '../dist/src/terrain.js';
const report={};
for(const id of ['zangzangbao','xiaoyong']){
 const a=id==='zangzangbao'?await loadModelCat('assets/cat-rig.glb',1.25):await loadHumanCharacter(id);let originalCount=0;a.model.traverse(o=>{if(o.isMesh)originalCount++;});await attachOutfit(a,id);const name=id==='zangzangbao'?'red-robe':'monk-robe';const head=a.getHeadWorld().clone();a.setOutfit(name);assert(a.getHeadWorld().distanceTo(head)<1e-6);assert(a.model.getObjectByName(name).visible);
 let min=Infinity,max=-Infinity;for(const [speed,idle]of [[0,0],[3.2,0],[0,12]])for(let n=0;n<150;n++){a.update(1/60,{speed,idle,grounded:true,vy:0,running:speed>2,actualVelocity:new THREE.Vector3(0,0,speed)});if(n%30)continue;a.root.updateMatrixWorld(true);for(const m of a.outfitMeshes){m.skeleton.update();const p=m.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i+=43){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);assert(Number.isFinite(v.x+v.y+v.z));min=Math.min(min,v.y);max=Math.max(max,v.y);}}}
 a.setOutfit('original');assert(!a.model.getObjectByName(name).visible);a.setOutfit(name);assert(a.model.getObjectByName(name).visible);report[id]={sameHead:true,toggle:true,min,max};
}
const scene=new THREE.Scene();buildWorld(scene);await loadDreamWorld(scene,true);const placed=await addEnchantedGrove(scene,true);assert(placed.treesPlaced>=6);assert(placed.crystalsPlaced>=3);for(const o of scene.children.filter(o=>o.userData.groveKind))for(const p of o.userData.rootSupport){assert(p.y-heightAt(p.x,p.z)<-.06);assert(Math.hypot(p.x,p.z)<47);}report.grove=placed;console.log(JSON.stringify(report,null,2));
