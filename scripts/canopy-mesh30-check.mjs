import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {buildWorld} from '../dist/src/world.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {acceleratedRaycast,computeBoundsTree} from 'three-mesh-bvh';
const scene=new THREE.Scene();buildWorld(scene);await loadDreamWorld(scene,false);scene.updateMatrixWorld(true);const h=scene.userData.dewCanopy,meshes=[];
function addTree(o){const source=o.isLOD?o.levels[0].object:o;source.traverse(m=>{if(m.isMesh){m.geometry.computeBoundsTree=computeBoundsTree;if(!m.geometry.boundsTree)m.geometry.computeBoundsTree();m.raycast=acceleratedRaycast;meshes.push(m);}});}
for(const t of scene.children)if(t.userData.treeAsset&&Math.hypot(t.position.x-17,t.position.z+48)<12)addTree(t);
for(const p of h.perches)addTree(p.tree);
const ray=new THREE.Raycaster(),hits=[];
for(const a of h.perches)for(const bi of a.neighbors){const b=h.perches[bi],height=.65+Math.abs(b.position.y-a.position.y)*.22;
 for(const off of [[0,.45,0],[-.4,.65,0],[.4,.65,0],[0,1.15,0],[0,.3,.35],[0,.3,-.35]]){
  let previous=null;for(let i=0;i<=40;i++){const t=i/40,p=a.position.clone().lerp(b.position,t);p.y+=4*t*(1-t)*height;p.add(new THREE.Vector3(...off));if(previous){const d=p.clone().sub(previous);ray.set(previous,d.clone().normalize());ray.far=d.length();for(const hit of ray.intersectObjects(meshes,false))hits.push({edge:[a.id,bi],offset:off,point:hit.point.toArray()});}previous=p;}
 }
}
console.log(JSON.stringify({meshCount:meshes.length,canopyIntersections:hits.length,examples:hits.slice(0,18)},null,2));
assert.equal(hits.length,0,'The actual tree meshes must leave the swept body/ears/lantern flight corridor open');
