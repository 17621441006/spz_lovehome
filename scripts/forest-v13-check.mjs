import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THREE} from './headless.mjs';
import {coatTree,canopySnow,SunShafts} from '../dist/src/forest-weather.js';
import {buildWorld,colliders} from '../dist/src/world.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {addEnchantedGrove} from '../dist/src/enchanted-grove.js';
import {detailStream} from '../dist/src/asset-stream.js';
import {ASSET_SIZES} from '../dist/src/asset-sizes.js';
import {loadModelCat} from '../dist/src/modelcat.js';
const scene=new THREE.Scene();buildWorld(scene);await loadDreamWorld(scene,true,{progressive:true});await addEnchantedGrove(scene,true,{progressive:true});
assert.equal(detailStream.jobs.length,5);const anchors=detailStream.jobs.flatMap(j=>j.anchors),transforms=anchors.map(a=>[a,a.position.toArray(),a.scale.toArray()]);
const beforeColliders=JSON.stringify(colliders);for(const j of detailStream.jobs)await j.run();assert.equal(JSON.stringify(colliders),beforeColliders);for(const [a,p,s]of transforms){assert.deepEqual(a.position.toArray(),p);assert.deepEqual(a.scale.toArray(),s);if(a.isLOD){assert.equal(a.levels[0].object.parent,a);assert(a.children.includes(a.levels[0].object));}}
let snowMaterials=0;scene.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m.customProgramCacheKey().includes('canopy-snow'))continue;snowMaterials++;const sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh);assert.equal(sh.uniforms.uCanopySnow,canopySnow);assert(sh.fragmentShader.includes('snowCover'));assert(sh.vertexShader.includes('vSnowNormal=normalize'));}});assert(snowMaterials>80);
const shafts=new SunShafts(scene,true);shafts.update(2,1,0,0,0);assert(shafts.group.visible);for(const x of [[1,0,0],[0,1,0],[0,0,1]]){shafts.update(2,1,...x);assert(!shafts.group.visible);}
const cat=await loadModelCat('assets/cat-rig.glb',1.25);cat.setFanEquipped(true);const sleeve=cat.rig.parts.get(23),g=sleeve.geometry;const edges=()=>{cat.root.updateMatrixWorld(true);cat.rig.skeleton.update();let mx=0;for(let i=0;i<g.index.count;i+=3){const v=[0,1,2].map(k=>sleeve.getVertexPosition(g.index.getX(i+k),new THREE.Vector3()).applyMatrix4(sleeve.matrixWorld));mx=Math.max(mx,v[0].distanceTo(v[1]),v[1].distanceTo(v[2]),v[2].distanceTo(v[0]));}return mx;};
// The original textured sleeve stays visible and is not stretched while running or standing.
for(let i=0;i<10;i++)cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});const restEdge=edges();for(let i=0;i<120;i++)cat.update(1/60,{grounded:true,speed:3.2,idle:0,vy:0});assert(sleeve.visible);let maxEdge=edges();assert(maxEdge<restEdge*1.35,'No long stretched sleeve triangle');for(let i=0;i<150;i++)cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});assert(sleeve.visible);maxEdge=Math.max(maxEdge,edges());assert(maxEdge<restEdge*1.35);
const names=['forest-tree','forest-tree-lod','broadleaf-tree','broadleaf-tree-lod','fantasy-tree','fantasy-tree-lod','treehouse','shrine-lod','pagoda-lod','temple-lod','japanese-house'];const sum=arr=>arr.reduce((s,n)=>s+(ASSET_SIZES[n]||0),0);const base=sum(names.map(n=>'assets/'+n+'.glb')),before=base+sum(['shrine','pagoda','temple','sakura','sakura-lod','crystal','crystal-lod','catbus','cat-rig'].map(n=>'assets/'+n+'.glb'))+ASSET_SIZES['assets/characters/red-robe.glb'],after=base+sum(['sakura-lod','crystal-lod','cat-rig'].map(n=>'assets/'+n+'.glb'));assert(after<before*.4);
console.log({streamedDetails:detailStream.jobs.length,unchangedColliders:true,snowMeshes:snowMaterials,sunbeams:shafts.group.children.length,sleeveMaxTriangleEdge:maxEdge,startupModelMB:{before:before/1e6,after:after/1e6,reductionPercent:100*(1-after/before)}});
