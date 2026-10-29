export const movementKey=e=>({KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ShiftLeft:'shift',ShiftRight:'shift',Space:' '}[e.code]||e.key.toLowerCase());
// Running speed and forward motion are separate: autoForward survives W key-up.
export class SprintControl{
 constructor(){this.reset();}
 reset(){this.active=false;this.autoForward=false;this.lastW=-Infinity;this.held=0;this.blockHold=false;this.blockedTime=0;}
 cancel(){this.active=false;this.autoForward=false;this.held=0;this.lastW=-Infinity;this.blockHold=true;this.blockedTime=0;}
 down(key,time,repeat=false){if(repeat)return;
  if(key==='shift'){if(this.active)this.cancel();else{this.active=true;this.blockHold=false;}}
  if(key==='w'||key==='arrowup'){
   if(this.autoForward)this.cancel();
   else{if(time-this.lastW<.42){this.active=true;this.autoForward=true;}this.lastW=time;}
  }
  if(key===' '||key==='s'||key==='arrowdown')this.cancel();
 }
 update(dt,forward,shift,moving){
  if(!shift)this.blockHold=false;
  this.held=forward&&shift&&!this.blockHold?this.held+dt:0;
  if(this.held>=2){this.active=true;this.autoForward=true;}
  return (moving||this.autoForward)&&(this.active||(shift&&!this.blockHold));
 }
 observeProgress(distance,dt,grounded){
  this.blockedTime=this.autoForward&&grounded&&distance<dt*.12?this.blockedTime+dt:0;
  if(this.blockedTime>.7){this.cancel();return true;}return false;
 }
}
