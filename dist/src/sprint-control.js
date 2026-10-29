// Toggle sprint never generates movement: releasing WASD always stops the player.
export class SprintControl{
 constructor(){this.reset();}
 reset(){this.active=false;this.lastW=-Infinity;this.held=0;this.blockHold=false;}
 down(key,time,repeat=false){if(repeat)return;if(key==='shift')this.active=!this.active;if(key==='w'){if(this.active){this.active=false;this.lastW=-Infinity;}else{this.active=time-this.lastW<.30;this.lastW=this.active?-Infinity:time;}}if(key===' '){this.active=false;this.blockHold=true;this.held=0;}}
 update(dt,forward,shift,moving){if(!shift)this.blockHold=false;this.held=forward&&shift&&!this.blockHold?this.held+dt:0;if(this.held>=2)this.active=true;if(!moving){this.active=false;this.held=0;}return this.active;}
}
