import fs from 'node:fs';
import path from 'node:path';
import {THREE} from './headless.mjs';
import {buildWorld,colliders,groundAt} from '../dist/src/world.js';
import {buildLake} from '../dist/src/lake.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {addEnchantedGrove} from '../dist/src/enchanted-grove.js';
import {addElderTree} from '../dist/src/elder-tree.js';
import {addFantasyEcology} from '../dist/src/fantasy-ecology.js';
import {CatBus} from '../dist/src/catbus.js';
import {heightAt,edgeRadius,inLakeWater,LAYOUT} from '../dist/src/terrain.js';
import {WALK_PATHS} from '../dist/src/world-layout.js';
import {moveWithCollisions} from '../dist/src/collision.js';
import {Landmarks32} from '../dist/src/landmarks32.js';
import {ReflectionInterior} from '../dist/src/reflection-interior.js';

const scene=new THREE.Scene();buildWorld(scene);buildLake(scene,colliders);await loadDreamWorld(scene,false);await addEnchantedGrove(scene,false);await addElderTree(scene);await addFantasyEcology(scene);const bus=await CatBus.create(scene,colliders);scene.updateMatrixWorld(true);
await Landmarks32.create(scene,colliders);new ReflectionInterior(scene,colliders);scene.updateMatrixWorld(true);
const obstacles=colliders.filter(c=>!c.catbus),round=n=>Number(n.toFixed(3));
const distance=(x,z,c)=>c.type==='circle'?Math.hypot(x-c.x,z-c.z)-c.r:Math.hypot(Math.max(c.minX-x,0,x-c.maxX),Math.max(c.minZ-z,0,z-c.maxZ));
const describe=c=>{const out={...c};delete out.onHit;delete out.sample;if(c.type==='circle'){const near=scene.children.filter(o=>o.name&&Math.hypot(o.position.x-c.x,o.position.z-c.z)<.3);if(near.length)out.objects=near.map(o=>o.name);}return out;};
function blockedAt(x,z,pad,busMode=true,y=heightAt(x,z)){
 const hits=[];
 if(busMode){if(Math.hypot(x,z)>edgeRadius(x,z)-3.8)hits.push({reason:'island-edge'});if(inLakeWater(x,z,-pad))hits.push({reason:'lake-water'});if(Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+pad+.1)hits.push({reason:'pond-water'});}
 for(const c of obstacles){if(c.floorOnly||!['box','circle'].includes(c.type)||c.top<=y+(busMode?.10:.30)||(c.bottom!==undefined&&c.bottom>y+(busMode?2.5:1.6)))continue;
  const blocked=busMode&&c.type==='box'?x>c.minX-pad&&x<c.maxX+pad&&z>c.minZ-pad&&z<c.maxZ+pad:distance(x,z,c)<pad;
  if(blocked)hits.push({clearance:round(busMode&&c.type==='box'?Math.max(c.minX-x,x-c.maxX,c.minZ-z,z-c.maxZ)-pad:distance(x,z,c)-pad),collider:describe(c)});
 }return hits;
}
function summarize(samples){const spans=[];for(const row of samples){let span=spans.at(-1);if(!span||row.index>span.lastIndex+1){span={first:row.point,last:row.point,firstIndex:row.index,lastIndex:row.index,count:0,obstacles:new Map()};spans.push(span);}span.last=row.point;span.lastIndex=row.index;span.count++;for(const hit of row.hits){const key=JSON.stringify(hit.collider||hit.reason);if(!span.obstacles.has(key))span.obstacles.set(key,hit);}}
 return spans.map(s=>({...s,obstacles:[...s.obstacles.values()].slice(0,12)}));}
const routes=bus.routes.map(route=>{const blocked=[];for(let index=0;index<route.samples.length;index++){const {p,yaw}=route.samples[index],hits=[];for(const offset of [-1.65,0,1.65])for(const hit of blockedAt(p.x+Math.sin(yaw)*offset,p.z+Math.cos(yaw)*offset,1.2))hits.push({...hit,offset});if(hits.length)blocked.push({index,point:[round(p.x),round(p.y),round(p.z)],hits});}return {name:route.name,length:round(route.length),samples:route.samples.length,unsafeSamples:blocked.length,spans:summarize(blocked)};});
const walks=WALK_PATHS.map(route=>{const blocked=[];let index=0;for(let segment=1;segment<route.points.length;segment++){const a=route.points[segment-1],b=route.points[segment],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25);for(let i=0;i<=n;i++,index++){const t=i/n,x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t),y=groundAt(x,z,heightAt(x,z)+.35,.42),hits=blockedAt(x,z,.42,false,y);if(hits.length)blocked.push({index,point:[round(x),round(y),round(z)],hits});}}return {name:route.name,samples:index,blockedSamples:blocked.length,spans:summarize(blocked)};});
// Follow the path with the real capsule resolver and the previous frame's floor
// height. This admits legal steps and decks instead of resetting to terrain at
// every sample. Dense waypoints keep steering inside the marked path.
function traverseWalk(route,reverse=false){
 const points=reverse?[...route.points].reverse():route.points;
 const pos={x:points[0][0],z:points[0][1],y:groundAt(points[0][0],points[0][1],heightAt(...points[0])+.35,.42)};
 let maxCorrection=0,frames=0;
 for(let segment=1;segment<points.length;segment++){
  const a=points[segment-1],b=points[segment],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25);
  for(let i=1;i<=n;i++){
   const t=i/n,tx=THREE.MathUtils.lerp(a[0],b[0],t),tz=THREE.MathUtils.lerp(a[1],b[1],t);
   let reached=false;
   for(let frame=0;frame<180;frame++,frames++){
    const dx=tx-pos.x,dz=tz-pos.z,d=Math.hypot(dx,dz);if(d<.06){reached=true;break;}
    const step=Math.min(.04,d),wantX=pos.x+dx/d*step,wantZ=pos.z+dz/d*step;
    pos.y-=24/3600;moveWithCollisions(pos,dx/d*step,dz/d*step,.42,obstacles);
    maxCorrection=Math.max(maxCorrection,Math.hypot(pos.x-wantX,pos.z-wantZ));
    pos.y=groundAt(pos.x,pos.z,pos.y,.42);
   }
   if(!reached){const nearby=obstacles.filter(c=>['circle','box'].includes(c.type)&&!c.floorOnly&&c.top>pos.y+.29&&distance(pos.x,pos.z,c)<.85);return {direction:reverse?'return':'outward',reached:false,segment,target:[round(tx),round(tz)],position:[round(pos.x),round(pos.y),round(pos.z)],maxCorrection:round(maxCorrection),frames,nearby:nearby.map(describe)};}
  }
 }
 return {direction:reverse?'return':'outward',reached:true,position:[round(pos.x),round(pos.y),round(pos.z)],maxCorrection:round(maxCorrection),frames};
}
const walkTraversal=WALK_PATHS.map(route=>({name:route.name,traversals:[traverseWalk(route),traverseWalk(route,true)]}));
const report={quality:'high; full world, lake, enchanted grove, elder tree, fantasy ecology, bus stops',colliders:obstacles.length,distinctStops:[...new Set(bus.routes.flatMap(r=>r.stops.map(s=>s.name)))],routes,walks,walkTraversal};
if(process.argv[2]){const file=path.resolve(process.argv[2]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
