import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {buildWorld,colliders} from '../dist/src/world.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {addEnchantedGrove} from '../dist/src/enchanted-grove.js';
import {addFantasyEcology} from '../dist/src/fantasy-ecology.js';
import {buildLake} from '../dist/src/lake.js';
import {heightAt,inLakeWater} from '../dist/src/terrain.js';
import {villageLaneDistance} from '../dist/src/village-routes.js';
import {LAYOUT,WALK_PATHS,centralMeadow} from '../dist/src/world-layout.js';
import {createDengweirongNavigation} from '../dist/src/dengweirong.js';
import {moveWithCollisions} from '../dist/src/collision.js';
const s=new THREE.Scene();buildWorld(s);buildLake(s,colliders);await loadDreamWorld(s,false);await addEnchantedGrove(s,false);await addFantasyEcology(s);
const d=(x,z,c)=>c.type==='circle'?Math.hypot(x-c.x,z-c.z)-c.r:Math.hypot(Math.max(c.minX-x,0,x-c.maxX),Math.max(c.minZ-z,0,z-c.maxZ));
const glade=LAYOUT.dewGlade,home=glade.home,nav=createDengweirongNavigation(),points=[home,...glade.dew.map(([x,z])=>({x,z}))],metrics=[];
for(const [i,a]of glade.dew.entries())for(const b of glade.dew.slice(i+1))assert(Math.hypot(a[0]-b[0],a[1]-b[1])>=1.2,'Dew points must remain distinct and reachable');
for(const p of points){const {x,z}=p,y=heightAt(x,z),near=colliders.filter(c=>!c.floorOnly&&['box','circle'].includes(c.type)&&c.top>y+.18&&(c.bottom===undefined||c.bottom<y+1.3)).sort((a,b)=>d(x,z,a)-d(x,z,b));assert(nav.safePoint(p));assert(!centralMeadow(x,z));assert(!inLakeWater(x,z,-1));assert(villageLaneDistance(x,z)>4.7);assert(d(x,z,near[0])>(p===home?.55:1.2),'player capsule retains clearance beside the low greeting branch');metrics.push({x,z,ground:+y.toFixed(3),lane:+villageLaneDistance(x,z).toFixed(2),solidClearance:+d(x,z,near[0]).toFixed(2)});}
for(let i=1;i<points.length;i++)assert(nav.safeSegment(points[i-1],points[i]),'Creature route must sweep the full footprint');
const walks=[];
for(const route of WALK_PATHS.filter(p=>p.id.startsWith('dew')))for(const reverse of [false,true]){
 const pp=reverse?[...route.points].reverse():route.points,pos={x:pp[0][0],z:pp[0][1],y:heightAt(...pp[0])};let travelled=0;
 for(const [x,z] of pp.slice(1)){
  let done=false;for(let frame=0;frame<1800;frame++){const dx=x-pos.x,dz=z-pos.z,distance=Math.hypot(dx,dz);if(distance<.05){done=true;break;}const step=Math.min(distance,.035);moveWithCollisions(pos,dx/distance*step,dz/distance*step,.42,colliders);pos.y=heightAt(pos.x,pos.z);travelled+=step;}
  assert(done,route.name+' must be physically walkable in both directions');
 }
 walks.push({path:route.id,direction:reverse?'return':'outward',metres:+travelled.toFixed(2)});
}
console.log(JSON.stringify({fullWorldGlade:'PASS',points:metrics,walks,mainMeadow:'unchanged',waterAndBusClearance:'PASS'},null,2));
