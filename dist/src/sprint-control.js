export const movementKey=e=>({KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ShiftLeft:'shift',ShiftRight:'shift',Space:' '}[e.code]||e.key.toLowerCase());
export class SprintControl{
 constructor(){this.reset();}
 reset(){this.active=false;this.lastW=-Infinity;this.held=0;this.blockHold=false;this.resumeCancel=false;this.wasMoving=false;}
 down(key,time,repeat=false){if(repeat)return;
  if(key==='shift'){this.active=!this.active;this.resumeCancel=false;this.blockHold=!this.active;}
  if(key==='w'){if(this.resumeCancel){this.active=false;this.resumeCancel=false;this.blockHold=true;this.lastW=-Infinity;}else{if(time-this.lastW<.32)this.active=true;this.lastW=time;}}
  if(key===' '){this.active=false;this.blockHold=true;this.held=0;this.resumeCancel=false;}
 }
 update(dt,forward,shift,moving){
  if(!shift)this.blockHold=false;
  this.held=forward&&shift&&!this.blockHold?this.held+dt:0;
  if(this.held>=2)this.active=true;
  if(!moving&&this.wasMoving){this.resumeCancel=this.active;this.held=0;}
  this.wasMoving=moving;
  return moving&&(this.active||(shift&&!this.blockHold));
 }
}
