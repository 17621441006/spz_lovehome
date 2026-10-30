import * as THREE from 'three';
const V=()=>new THREE.Vector3(),smooth=t=>t*t*(3-2*t),clamp=THREE.MathUtils.clamp;

// One bounded route graph, authored on real branches. Progress uses simulation
// dt, not wall time: menus, background tabs and distant LOD cannot skip a landing.
export class DengweirongCanopy{
 constructor(npc,habitat){
  this.npc=npc;this.habitat=habitat;this.index=habitat.low;this.next=null;this.mode='perch';this.elapsed=0;this.wait=5;this.hold=false;this.direction=1;this.completed=0;this.flight=null;this.crouch=0;this.pitch=0;this.tuck=0;
  npc.position.copy(habitat.perches[this.index].position);npc.group.rotation.y=.65;this.sync();
 }
 get perched(){return this.mode==='perch';}
 get low(){return this.index===this.habitat.low&&this.perched;}
 settle(){this.hold=true;}
 release(){this.hold=false;this.wait=Math.max(this.wait,3);}
 sync(){const n=this.npc;n.state=this.mode==='perch'?(this.hold?'settled':'perch'):this.mode;n.speed=0;n.moving=false;n.collider.x=n.position.x;n.collider.z=n.position.z;n.collider.bottom=n.position.y;n.collider.top=n.position.y+.58;}
 surface(x,z){return this.habitat.surface(x,z,this.index);}
 wantsLow(player){return this.hold||(player&&Math.hypot(player.x-this.npc.home.x,player.z-this.npc.home.z)<5.7);}
 begin(index){
  const from=this.habitat.perches[this.index],to=this.habitat.perches[index];if(!from.neighbors.includes(index))return false;
  const d=from.position.distanceTo(to.position);this.flight={from:from.position.clone(),to:to.position.clone(),duration:clamp(d/3.5,.85,1.3),height:.65+Math.abs(to.position.y-from.position.y)*.22};
  this.next=index;this.mode='prepare';this.elapsed=0;return true;
 }
 update(dt,player,{paused=false,busy=false,weather='sun'}={}){
  const n=this.npc;if(paused||busy){this.sync();return;}
  this.elapsed+=dt;
  if(this.mode==='perch'){
   this.crouch=this.pitch=this.tuck=0;const low=this.wantsLow(player);if(low&&this.index!==this.habitat.low){this.begin(this.index-1);}
   else if(!low){this.wait-=dt;if(this.wait<=0){if(this.index===2)this.direction=-1;else if(this.index===0)this.direction=1;this.begin(this.index+this.direction);}}
   else if(player)n.turnToward(player,dt,.8);
  }else if(this.mode==='prepare'){
   const angle=n.turnToward(this.flight.to,dt,3.2);this.crouch=.065*smooth(Math.min(this.elapsed/.3,1));this.tuck=.08;
   // A visitor can stop a prepared jump before take-off, never mid-air.
   if(this.wantsLow(player)&&this.index===0){this.mode='perch';this.elapsed=0;this.crouch=this.tuck=0;this.wait=4;}
   else if(this.elapsed>=.35&&angle<.08){this.mode='jump';this.elapsed=0;}
  }else if(this.mode==='jump'){
   const t=clamp(this.elapsed/this.flight.duration,0,1),arc=4*t*(1-t);
   n.position.lerpVectors(this.flight.from,this.flight.to,t);n.position.y+=this.flight.height*arc;
   this.crouch=0;this.tuck=Math.sin(Math.PI*t)*.14;this.pitch=.12*Math.cos(Math.PI*t);
   if(t===1){n.position.copy(this.flight.to);this.index=this.next;this.next=null;this.mode='land';this.elapsed=0;this.completed++;this.pitch=this.tuck=0;}
  }else if(this.mode==='land'){
   const t=clamp(this.elapsed/.38,0,1);this.crouch=.055*Math.sin(Math.PI*t);this.pitch=0;this.tuck=0;
   if(t===1){this.mode='perch';this.elapsed=0;this.wait=(weather==='rain'?10:6)+n.random()*4;this.crouch=0;}
  }
  this.sync();
 }
 applyPose(){
  const n=this.npc;
  // Move the existing rig, never scale the animal. Feet receive their own branch
  // contact afterwards, so crouching cannot push paws through the supporting bark.
  const body=n.nodes.Body.getWorldPosition(V());body.y-=this.crouch;n.nodes.Body.parent.worldToLocal(body);n.nodes.Body.position.copy(body);
  if(this.mode==='jump'){
   n.model.rotation.x=this.pitch;
   const flightT=clamp(this.elapsed/this.flight.duration,0,1),fold=Math.sin(Math.PI*flightT);
   for(const foot of n.feet){const p=foot.bone.getWorldPosition(V());p.y+=this.tuck;foot.bone.parent.worldToLocal(p);foot.bone.position.copy(p);const front=foot.bone.name.includes('_F');foot.bone.rotation.x+=(front?-.36:.48)*fold;}
   n.nodes.Head.rotation.x+=.16*Math.sin(Math.PI*flightT);
  }else n.model.rotation.x=0;
  const airborne=this.mode==='jump',bounce=this.mode==='land'?Math.sin(Math.PI*clamp(this.elapsed/.38,0,1)):0;
  if(n.nodes.Tail){n.nodes.Tail.rotation.x+=airborne?-this.pitch*.9:.045*Math.sin(n.time*1.4);n.nodes.Tail.rotation.z+=.06*Math.sin(n.time*1.1);}
  if(n.nodes.Ear_L)n.nodes.Ear_L.rotation.y+=airborne?.24*this.tuck/.14:.04*Math.sin(n.time*1.7)+bounce*.13;
  if(n.nodes.Ear_R)n.nodes.Ear_R.rotation.y-=airborne?.21*this.tuck/.14:.04*Math.sin(n.time*1.7+.8)+bounce*.13;
  if(this.perched){n.nodes.Head.rotation.z+=.055*Math.sin(n.time*.75);}
 }
}
