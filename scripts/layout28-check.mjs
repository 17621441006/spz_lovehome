// Layout acceptance against the generated full scene. Coordinates are discovered
// from scene objects/collectibles; reachability uses actual collision and pickup
// code, including legal run-jumps, rather than a duplicate list of expected spots.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {buildWorld,colliders,groundAt,Acorns,lilyPads} from '../dist/src/world.js';
import {buildLake,PIER,onPier} from '../dist/src/lake.js';
import {loadDreamWorld} from '../dist/src/dream.js';
import {addEnchantedGrove} from '../dist/src/enchanted-grove.js';
import {addElderTree,onElderBridge,ELDER_BRIDGE} from '../dist/src/elder-tree.js';
import {addFantasyEcology} from '../dist/src/fantasy-ecology.js';
import {BigTotoro} from '../dist/src/totoro.js';
import {CatBus} from '../dist/src/catbus.js';
import {heightAt,edgeRadius} from '../dist/src/terrain.js';
import {LAYOUT,centralMeadow} from '../dist/src/world-layout.js';
import {BUILDING_COLLISIONS} from '../dist/src/building-collisions.js';
import {hazardousWater} from '../dist/src/water-recovery.js';
import {moveWithCollisions} from '../dist/src/collision.js';
import {CHARACTER_DEFS} from '../dist/src/characters.js';
import {VILLAGE_CURVES,villageLaneDistance} from '../dist/src/village-routes.js';

// Snapshot the same startup curves as laneBins. CatBus later increases the
// shared curves' arc-length integration precision for its driving samples.
const roadSegments=VILLAGE_CURVES.flatMap(curve=>{const p=curve.getSpacedPoints(320);return p.slice(1).map((b,i)=>[p[i],b]);});
const scene=new THREE.Scene();buildWorld(scene);const lake=buildLake(scene,colliders);
await loadDreamWorld(scene,false);await addEnchantedGrove(scene,false);
const ecology=await addFantasyEcology(scene),acorns=new Acorns(scene),totoro=new BigTotoro(scene);
const elder=await addElderTree(scene),bus=await CatBus.create(scene,colliders);scene.updateMatrixWorld(true);
const errors=[],checks={},round=n=>+n.toFixed(3),point=o=>o.getWorldPosition(new THREE.Vector3());
function check(ok,message){if(!ok)errors.push(message);}
let roadSamples=0,roadError=0;
for(let x=-64;x<=64;x+=1.75)for(let z=-64;z<=48;z+=1.75){
 let brute=Infinity;for(const [a,b]of roadSegments){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));brute=Math.min(brute,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}
 if(brute<=12){roadSamples++;roadError=Math.max(roadError,Math.abs(brute-villageLaneDistance(x,z)));}
}
check(roadError<1e-8,'Optimized lane distance differs from all 640 curve segments near roads');checks.roadDistance={samplesWithin12m:roadSamples,maxError:roadError};
const architectural=scene.children.filter(o=>o.userData.buildingId||o.name==='脏脏包的森林树屋');
const trees=[];scene.traverse(o=>{if(o.userData.treeAsset||o.userData.groveKind||o.userData.gladeModel)trees.push(o);});
const decorations=ecology.group?.children||scene.getObjectByName('奇幻森林生态 · 原创生物与植物').children;
const substantial=[...architectural,...trees,...decorations,elder,totoro.group];
const centralViolations=substantial.filter(o=>{const p=point(o);return centralMeadow(p.x,p.z);}).map(o=>({name:o.name,position:point(o).toArray().map(round)}));
check(!centralViolations.length,'Central meadow contains a major building, tree or fantasy decoration');
checks.centralMeadow={majorObjects:substantial.length,violations:centralViolations};

const bounds=architectural.map(o=>({name:o.name,id:o.userData.buildingId,root:o,box:new THREE.Box3().setFromObject(o)}));
const gaps=[];
for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
 const a=bounds[i],b=bounds[j],gap=Math.hypot(Math.max(a.box.min.x-b.box.max.x,b.box.min.x-a.box.max.x,0),Math.max(a.box.min.z-b.box.max.z,b.box.min.z-a.box.max.z,0));
 gaps.push({pair:[a.name,b.name],gap:round(gap)});check(gap>=8,`Architecture lacks an 8m visible gap: ${a.name} / ${b.name}: ${gap}`);
}
checks.buildingClearance={minGap:Math.min(...gaps.map(g=>g.gap)),pairs:gaps};
for(const b of bounds.filter(b=>b.id)){
 const expected=LAYOUT.buildings.find(x=>x.id===b.id),world=point(b.root),cs=BUILDING_COLLISIONS[b.id].colliders;
 check(Math.hypot(world.x-expected.x,world.z-expected.z)<.01,`${b.id}: relocated root does not match layout`);
 check(Math.abs(b.box.min.y-heightAt(world.x,world.z))<.06,`${b.id}: building floor floats above terrain`);
 check(cs.every(c=>c.type!=='box'||(c.minX>=b.box.min.x-1&&c.maxX<=b.box.max.x+1&&c.minZ>=b.box.min.z-1&&c.maxZ<=b.box.max.z+1)),`${b.id}: baked collision left at previous location`);
}

const blossoms=trees.filter(o=>o.userData.groveKind==='sakura'),minerals=trees.filter(o=>o.userData.groveKind==='crystal'||o.userData.gladeModel==='glade-rock');
const extent=objects=>{const pts=objects.map(point);return {count:pts.length,minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minZ:Math.min(...pts.map(p=>p.z)),maxZ:Math.max(...pts.map(p=>p.z))};};
check(blossoms.length>0&&blossoms.every(o=>point(o).x<-30&&point(o).z>0),'Sakura should form the western village grove');
check(minerals.length>0&&minerals.every(o=>point(o).x>10&&point(o).z<-35),'Crystals/rocks should stay in the northeast moonlight grove');
const reeds=decorations.filter(o=>o.name==='泡泡水琴草').map(o=>({position:point(o).toArray().map(round),ground:round(heightAt(point(o).x,point(o).z))}));
check(reeds.length>=2,'Wetlands and lake both retain melody reeds');
for(const {position:[x,y,z]}of reeds){const pondDistance=Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z),lakeDistance=Math.hypot(x-LAYOUT.lake.x,z-LAYOUT.lake.z);check(pondDistance<LAYOUT.pond.r+1||lakeDistance<LAYOUT.lake.r+2,'Melody reed moved out of its water habitat');check(y-heightAt(x,z)>-.12,'Melody reed buried in dry terrain');}
checks.themes={sakura:extent(blossoms),moonlight:extent(minerals),reeds};

const pondWater=scene.children.flatMap(o=>o.children).find(o=>o.material?.uniforms?.uCenter?.value?.distanceTo(new THREE.Vector2(LAYOUT.pond.x,LAYOUT.pond.z))<.01);
check(!!pondWater,'Relocated pond water missing');
const waterY=pondWater?.position.y,centerDepth=waterY-heightAt(LAYOUT.pond.x,LAYOUT.pond.z),shoreGaps=[];
for(let i=0;i<32;i++){const a=i*Math.PI/16,x=LAYOUT.pond.x+Math.cos(a)*(LAYOUT.pond.r+.8),z=LAYOUT.pond.z+Math.sin(a)*(LAYOUT.pond.r+.8);shoreGaps.push(heightAt(x,z)-waterY);}
check(centerDepth>.2,'Pond basin no longer lies below water surface');check(Math.min(...shoreGaps)>-.12,'Pond water level extends outside bank');
check(lilyPads.every(p=>Math.hypot(p.x-LAYOUT.pond.x,p.z-LAYOUT.pond.z)<LAYOUT.pond.r&&Math.abs(p.top-waterY)<.12),'Lily pads did not follow relocated pond/water height');
checks.pond={centerDepth:round(centerDepth),minBankAboveWater:round(Math.min(...shoreGaps)),waterY,lilyPads:lilyPads.length};
check(Math.abs(lake.water.position.y-LAYOUT.lake.level)<.001&&onPier(PIER.x,(PIER.z0+PIER.z1)/2),'Lake water/pier removed');
check(elder.sanctuary&&onElderBridge((ELDER_BRIDGE.minX+ELDER_BRIDGE.maxX)/2,ELDER_BRIDGE.z),'Ancient tree sanctuary/bridge removed');
const temple=scene.children.find(o=>o.userData.buildingId==='temple');check(temple?.userData.templeInterior&&scene.getObjectByName('稻荷山道 · 48级石阶'),'Temple interior/stairs removed');
checks.preserved={temple:!!temple,ancientTreeHeight:round(elder.userData.elderTree.height),lakePierLength:round(PIER.z0-PIER.z1),stationCount:new Set(bus.routes.flatMap(r=>r.stops.map(s=>s.name))).size};

// A spatial subset still runs the production resolver. Its collision decisions
// and groundAt/Acorns.update are not replaced with a copied geometry formula.
const solids=colliders.filter(c=>!c.catbus),bins=new Map(),cell=4;
for(const c of solids){if(!['circle','box'].includes(c.type))continue;const minX=c.type==='circle'?c.x-c.r:c.minX,maxX=c.type==='circle'?c.x+c.r:c.maxX,minZ=c.type==='circle'?c.z-c.r:c.minZ,maxZ=c.type==='circle'?c.z+c.r:c.maxZ;
 for(let x=Math.floor((minX-.6)/cell);x<=Math.floor((maxX+.6)/cell);x++)for(let z=Math.floor((minZ-.6)/cell);z<=Math.floor((maxZ+.6)/cell);z++){const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(c);}}
const nearby=(x,z)=>bins.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[];
const grid=.5,nodes=new Map(),key=(x,z)=>Math.round(x/grid)+','+Math.round(z/grid);
function node(x,z){x=Math.round(x/grid)*grid;z=Math.round(z/grid)*grid;const k=key(x,z);if(nodes.has(k))return nodes.get(k);
 let out=null;if(Math.hypot(x,z)<edgeRadius(x,z)-.6&&!hazardousWater(x,z)){
  const y=groundAt(x,z,heightAt(x,z)+.35,.42),p={x,y,z};moveWithCollisions(p,0,0,.42,nearby(x,z));
  if(Math.hypot(p.x-x,p.z-z)<.02)out={x,y,z,key:k};
 }nodes.set(k,out);return out;
}
function collectionAt(a,p){const u=a.userData;for(const phase of [0,Math.PI/4.4,-Math.PI/4.4]){u.t=phase;u.taken=false;Acorns.prototype.update.call({list:[a],count:0,total:1},0,p,()=>{});const hit=u.taken;u.taken=false;if(hit)return true;}return false;}
function runJump(a,start){
 const speed=CHARACTER_DEFS.xiaosi.run,dx=a.userData.x-start.x,dz=a.userData.z-start.z,d=Math.hypot(dx,dz);if(d<.1)return null;
 const p={x:start.x,y:start.y,z:start.z};let vy=8.4;
 for(let frame=0;frame<72;frame++){
  const oldY=p.y;vy-=24/60;p.y+=vy/60;moveWithCollisions(p,dx/d*speed/60,dz/d*speed/60,.42,nearby(p.x,p.z));
  if(hazardousWater(p.x,p.z)&&p.y<Math.max(heightAt(p.x,p.z)+1,LAYOUT.lake.level+.3))return null;
  const floor=groundAt(p.x,p.z,p.y,.42);if(p.y<=floor&&vy<=0){p.y=floor;vy=0;}else if(p.y<floor)p.y=floor;
  if(collectionAt(a,p))return {frames:frame+1,collect:[p.x,p.y,p.z].map(round)};
  if(vy===0&&frame>4||p.y<start.y-3||!Number.isFinite(oldY))return null;
 }return null;
}
class Heap{a=[];push(v){let i=this.a.push(v)-1;while(i){const p=(i-1)>>1;if(this.a[p].f<=v.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const first=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1].f<this.a[j].f)j++;if(this.a[j].f>=v.f)break;this.a[i]=this.a[j];i=j;}this.a[i]=v;}return first;}}
function walkTo(target){
 const start=node(LAYOUT.spawn.x,LAYOUT.spawn.z),open=new Heap(),visited=new Set(),cost=new Map([[start.key,0]]),parents=new Map();open.push({...start,f:0});let expanded=0;
 while(open.a.length&&expanded<18000){const p=open.pop();if(visited.has(p.key))continue;visited.add(p.key);expanded++;
  if(p.key===target.key){let length=0,k=p.key;while(parents.has(k)){length++;k=parents.get(k);}return {steps:length,expanded};}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
   const q=node(p.x+dx*grid,p.z+dz*grid);if(!q||visited.has(q.key))continue;
   const test={x:p.x,y:p.y-24/3600,z:p.z};moveWithCollisions(test,q.x-p.x,q.z-p.z,.42,[...new Set([...nearby(p.x,p.z),...nearby(q.x,q.z)])]);
   if(Math.hypot(test.x-q.x,test.z-q.z)>.04)continue;
   const y=groundAt(test.x,test.z,test.y,.42);if(Math.abs(y-q.y)>.15)continue;
   const next=cost.get(p.key)+Math.hypot(dx,dz);if(next>=(cost.get(q.key)??Infinity))continue;cost.set(q.key,next);parents.set(q.key,p.key);open.push({...q,f:next+Math.hypot(q.x-target.x,q.z-target.z)/grid});
  }
 }return null;
}
const collected=[];
for(const [index,a]of acorns.list.entries()){
 const u=a.userData,candidates=[];
 for(let x=Math.floor((u.x-.7)/grid)*grid;x<=u.x+.7;x+=grid)for(let z=Math.floor((u.z-.7)/grid)*grid;z<=u.z+.7;z+=grid){const p=node(x,z);if(p&&collectionAt(a,p))candidates.push({p,mode:'walk'});}
 if(!candidates.length)for(let x=Math.floor((u.x-5)/grid)*grid;x<=u.x+5;x+=grid)for(let z=Math.floor((u.z-5)/grid)*grid;z<=u.z+5;z+=grid){const p=node(x,z);if(!p||Math.hypot(x-u.x,z-u.z)>5)continue;const jump=runJump(a,p);if(jump)candidates.push({p,mode:'run-jump',jump});}
 candidates.sort((a,b)=>Math.hypot(a.p.x-LAYOUT.spawn.x,a.p.z-LAYOUT.spawn.z)-Math.hypot(b.p.x-LAYOUT.spawn.x,b.p.z-LAYOUT.spawn.z));
 let success=null;for(const c of candidates.slice(0,10)){const walk=walkTo(c.p);if(walk){success={mode:c.mode,launch:[c.p.x,c.p.y,c.p.z].map(round),...walk,...(c.jump?{jump:c.jump}:{})};break;}}
 const result={index:index+1,position:[u.x,u.y,u.z].map(round),reachable:!!success,candidates:candidates.length,...success};collected.push(result);check(!!success,`Acorn ${index+1} has no verified walking/jump pickup route: ${u.x},${u.z}`);console.log('acorn',JSON.stringify(result));
}
check(acorns.total===14,'All 14 collectible acorns must be retained');checks.acorns=collected;
const report={checks,errors};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: generated layout, themed clearings, water and 14 actual pickup routes');
