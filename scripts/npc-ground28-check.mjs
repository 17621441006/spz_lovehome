import assert from 'node:assert/strict';
import './headless.mjs';
import {resolveSmallTotoroCollisions} from '../dist/src/totoro.js';

// Frozen pre-optimization resolver: deliberately queries at every obstacle.
function previous(pos,oldX,oldZ,radius,obstacles,heightAt){
 let blocked=false;
 for(const c of obstacles){if(c.top<heightAt(pos.x,pos.z)+.5)continue;
  if(c.type==='circle'){const ox=pos.x-c.x,oz=pos.z-c.z,od=Math.hypot(ox,oz),rr=c.r+radius;if(od<rr){pos.x=c.x+(od>1e-5?ox/od:1)*rr;pos.z=c.z+(od>1e-5?oz/od:0)*rr;blocked=true;}}
  else if(pos.x>c.minX-radius&&pos.x<c.maxX+radius&&pos.z>c.minZ-radius&&pos.z<c.maxZ+radius){pos.x=oldX;pos.z=oldZ;blocked=true;}
 }return blocked;
}
function compare(name,pos,old,radius,obstacles,height){
 const a={...pos},b={...pos},queries=[];let before=0;
 const blockedBefore=previous(a,...old,radius,obstacles,(x,z)=>{before++;return height(x,z);});
 const blockedAfter=resolveSmallTotoroCollisions(b,...old,radius,obstacles,(x,z)=>{queries.push([x,z]);return height(x,z);});
 assert.deepEqual(b,a,`${name}: position changed`);assert.equal(blockedAfter,blockedBefore,`${name}: blocked state changed`);
 assert.equal(before,obstacles.length);assert(queries.length<=before,`${name}: more height queries`);
 return {name,before,after:queries.length,position:b,queries};
}
const far=Array.from({length:1241},(_,i)=>({type:'circle',x:40+i*.01,z:40,r:.5,top:999}));
const unchanged=compare('1241 distant colliders',{x:.1,z:.2},[0,0],.4,far,(x,z)=>x+z);
assert.equal(unchanged.after,1);
const uphill=compare('push uphill filters a now-low circle',{x:.1,z:0},[0,0],.4,[{type:'circle',x:0,z:0,r:1,top:999},{type:'circle',x:1.5,z:0,r:.1,top:2.5}],x=>x*3);
assert.equal(uphill.after,2);assert.equal(uphill.position.x,1.4);
const downhill=compare('push downhill enables low box and rollback',{x:1.9,z:0},[.5,0],.4,[{type:'circle',x:3,z:0,r:1,top:999},{type:'box',minX:1.4,maxX:1.8,minZ:-.2,maxZ:.2,top:3.8},{type:'circle',x:.6,z:0,r:.1,top:2}],x=>x*2);
assert.equal(downhill.after,3);assert(downhill.position.x<.5);
const rollback=compare('box rollback refreshes height for next collider',{x:.1,z:0},[-.2,0],.4,[{type:'circle',x:0,z:0,r:1,top:999},{type:'box',minX:1.3,maxX:1.5,minZ:-.2,maxZ:.2,top:999},{type:'circle',x:-.2,z:0,r:.1,top:.3}],x=>x*3);
assert.equal(rollback.after,3);
compare('exact center recovery',{x:0,z:0},[0,0],.62,[{type:'circle',x:0,z:0,r:1,top:999},...far],()=>0);
assert.equal(compare('empty colliders',{x:0,z:0},[0,0],.4,[],()=>0).after,0);
let seed=28001;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let oldCalls=0,newCalls=0;
for(let i=0;i<240;i++){
 const pos={x:(random()-.5)*8,z:(random()-.5)*8},old=[pos.x+(random()-.5)*.3,pos.z+(random()-.5)*.3],r=.4+random()*.22;
 const obstacles=Array.from({length:80},()=>{const x=(random()-.5)*10,z=(random()-.5)*10,top=random()<.3?999:(random()-.3)*5;return random()<.6?{type:'circle',x,z,r:.1+random(),top}:{type:'box',minX:x-.4,maxX:x+.4,minZ:z-.5,maxZ:z+.5,top};});
 const result=compare(`slope scene ${i}`,pos,old,r,obstacles,(x,z)=>.7*x-.35*z+.2*Math.sin(x*2+z));oldCalls+=result.before;newCalls+=result.after;
}
assert(newCalls<oldCalls*.15);
console.log(JSON.stringify({equivalence:'PASS: exact positions and blocked flags',slopeCases:240,unchangedPosition:{before:unchanged.before,after:unchanged.after},randomSlopes:{before:oldCalls,after:newCalls},pushAndRollbackQueries:[uphill.after,downhill.after,rollback.after]},null,2));
