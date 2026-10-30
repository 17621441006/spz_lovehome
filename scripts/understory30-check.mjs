import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {colliders} from '../dist/src/world.js';
import {heightAt,trailEdge,catbusRouteDist,inLakeWater} from '../dist/src/terrain.js';
import {centralMeadow,focalClearing} from '../dist/src/world-layout.js';
import {addForestUnderstory,understoryClearance,UNDERSTORY_ZONES} from '../dist/src/forest-understory.js';
if(process.argv.includes('--world')){
 const world=new THREE.Scene();
 const [{buildWorld},{loadDreamWorld},{buildLake},{addEnchantedGrove}]=await Promise.all([import('../dist/src/world.js'),import('../dist/src/dream.js'),import('../dist/src/lake.js'),import('../dist/src/enchanted-grove.js')]);
 buildWorld(world);buildLake(world,colliders);await loadDreamWorld(world,false);await addEnchantedGrove(world,false);
}
const scene=new THREE.Scene(),before=colliders.length;
const full=addForestUnderstory(scene),low=addForestUnderstory(new THREE.Scene(),{low:true});
assert.equal(colliders.length,before,'soft foliage must not create movement obstacles');
assert(full.stats.plants>40,'both forest regions receive visible understory');
assert(full.stats.batches<=32,'four instanced types per quadrant, including the new upper understory');
assert(full.stats.triangles<280000,'denser silhouettes retain a bounded geometry budget');
assert(low.stats.plants<full.stats.plants,'low mode reduces planting density');
for(const state of [full,low]){
 for(const p of state.stats.placements){assert(understoryClearance(p.x,p.z,p.radius));assert(!centralMeadow(p.x,p.z,p.radius));assert(!focalClearing(p.x,p.z,p.radius+.25));assert(trailEdge(p.x,p.z)>p.radius+.12);assert(catbusRouteDist(p.x,p.z)>p.radius+2.85);assert(!inLakeWater(p.x,p.z,-p.radius));assert(Math.abs(p.y-heightAt(p.x,p.z))<.03);}
 for(const mesh of state.group.children){assert(mesh.isInstancedMesh);assert(mesh.count>0);const g=mesh.geometry;for(const a of Object.values(g.attributes))for(const value of a.array)assert(Number.isFinite(value));assert(g.index.count%3===0);const s={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};mesh.material.onBeforeCompile(s);assert(s.vertexShader.includes('instanceMatrix'));assert(s.fragmentShader.includes('uUnderstorySnow'));}
 state.update(1/60,{x:1000,z:1000});assert.equal(state.stats.visibleBatches,0);state.update(1/60,UNDERSTORY_ZONES[0],{snow:1,rain:.2,night:1});assert(state.stats.visibleBatches>0);assert(state.stats.visibleBatches<=state.stats.batches);
}
assert(!understoryClearance(0,6,.8));assert(!understoryClearance(16,-48,.8));assert(!understoryClearance(-4,-60,.8));
const summary=({placements,...stats})=>stats;
console.log(JSON.stringify({clearance:'PASS',geometry:'PASS',distanceCulling:'PASS',full:summary(full.stats),low:summary(low.stats)},null,2));
full.dispose();low.dispose();assert.equal(scene.children.length,0);
