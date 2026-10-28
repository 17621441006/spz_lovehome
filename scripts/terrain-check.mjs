import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {heightAt,buildTerrain,LAYOUT} from '../dist/src/terrain.js';
import {buildWorld} from '../dist/src/world.js';
import {loadDreamWorld} from '../dist/src/dream.js';
const scene=new THREE.Scene(),ground=buildTerrain();scene.add(ground);buildWorld(scene);await loadDreamWorld(scene,false);scene.updateMatrixWorld(true);
const trees=scene.children.filter(o=>o.userData.treeAsset);let maxAnalyticGap=-Infinity,maxMeshGap=-Infinity,maxSpread=0,maxRootRadius=0;
// Compare root contacts with the actual rendered triangle surface, not only the
// mathematical height field. Sample throughout each mesh's root footprint.
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
for(const tree of trees){assert(tree.userData.rootSupport.length>3);maxSpread=Math.max(maxSpread,tree.userData.rootSpread);assert(tree.userData.rootSpread<.91,'Tree buried across an unsuitable steep slope');
 const contacts=tree.userData.rootSupport;
 for(const p of contacts){const gap=p.y-heightAt(p.x,p.z);maxAnalyticGap=Math.max(maxAnalyticGap,gap);maxRootRadius=Math.max(maxRootRadius,Math.hypot(p.x,p.z));assert(Math.hypot(p.x,p.z)<LAYOUT.treeLimit);assert(gap<=-.06);}
 for(let i=0;i<contacts.length;i+=Math.max(1,Math.floor(contacts.length/8))){const p=contacts[i];ray.set(new THREE.Vector3(p.x,30,p.z),down);const hit=ray.intersectObject(ground,false)[0];assert(hit,'root outside rendered ground');const gap=p.y-hit.point.y;maxMeshGap=Math.max(maxMeshGap,gap);assert(gap<.015,`Root floating over mesh ${gap}`);}
}
const p=ground.geometry.attributes.position;let maxTerrainRadius=0;for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));maxTerrainRadius=Math.max(r,maxTerrainRadius);assert(r<LAYOUT.terrainRadius+.001);assert(Number.isFinite(p.getY(i)));}
assert(scene.getObjectByName('尽头云海 · 无树区'));assert(maxTerrainRadius>53.9);assert(trees.length<90);
console.log(JSON.stringify({trees:trees.length,maxAnalyticGap,maxMeshGap,maxSpread,maxRootRadius,terrainRadius:maxTerrainRadius,treeFreeEdge:LAYOUT.playRadius-maxRootRadius,landforms:[[-29,-25],[-7,-30],[-42,-3],[-29,29]].map(([x,z])=>({x,z,height:heightAt(x,z)}))},null,2));
