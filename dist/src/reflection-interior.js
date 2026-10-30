import * as THREE from 'three';
import {LAYOUT,heightAt} from './terrain.js';

// A dry pocket inside the submerged house. Water recovery is bypassed only
// inside this bounded room or on the supported island approach, never pond-wide.
export class ReflectionInterior {
 constructor(scene,colliders){
  this.b=LAYOUT.reflection;this.active=false;this.transition=null;this.onMove=()=>{};
  const b=this.b;this.center=new THREE.Vector3(b.x,b.y-2.74,b.z-5.6);this.floor=this.center.y;
  this.entry=new THREE.Vector3(b.x,b.y+.62,b.z+.65);
  this.exit=new THREE.Vector3(b.x,b.y+.62,b.z+1.05);
  const root=scene.getObjectByName(b.name);if(root){root.userData.walkableDeck={y:this.floor};root.userData.occlusionRevision=1;}
  const wall=(minX,maxX,minZ,maxZ)=>({type:'box',minX,maxX,minZ,maxZ,top:b.y-.80,bottom:this.floor-.10,noFloor:true,reflectionRoom:true});
  colliders.push(wall(b.x-2.22,b.x-2.06,this.center.z-1.77,this.center.z+1.77),wall(b.x+2.06,b.x+2.22,this.center.z-1.77,this.center.z+1.77),wall(b.x-2.22,b.x+2.22,this.center.z-1.77,this.center.z-1.59),wall(b.x-2.22,b.x-.70,this.center.z+1.59,this.center.z+1.77),wall(b.x+.70,b.x+2.22,this.center.z+1.59,this.center.z+1.77));
  colliders.push({type:'box',minX:b.x-2.1,maxX:b.x+2.1,minZ:this.center.z-1.6,maxZ:this.center.z+1.6,top:this.floor,floorOnly:true,reflectionRoom:true});
  colliders.push({type:'box',minX:b.x-.625,maxX:b.x+.625,minZ:this.center.z-1.425,maxZ:this.center.z-.875,bottom:this.floor,top:this.floor+.41,noFloor:true,reflectionRoom:true});
  // Continuous dry approach replaces tiny disconnected stones: no step jitter.
  const rampStart=b.z+4.2,rampEnd=b.z+1.5,base=heightAt(b.x,rampStart),top=b.y+.62;
  this.ramp={minX:b.x-1.05,maxX:b.x+1.05,minZ:rampEnd,maxZ:rampStart,base,top};
  const positions=[b.x-1.05,top,rampEnd,b.x+1.05,top,rampEnd,b.x-1.05,base,rampStart,b.x+1.05,base,rampStart];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex([0,2,1,1,2,3]);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#b9b7a0',roughness:.96}));mesh.name='倒影池 · 连续石坡';mesh.receiveShadow=true;scene.add(mesh);
  colliders.push({type:'heightfield',floorOnly:true,reflectionApproach:true,sample:(x,z)=>this.rampHeight(x,z)});
  for(const sign of [-1,1])colliders.push({type:'box',minX:b.x+sign*.98-.11,maxX:b.x+sign*.98+.11,minZ:b.z-.11,maxZ:b.z+.11,top:b.y+3.0,bottom:b.y+.6,noFloor:true});
  this.light=new THREE.PointLight('#ffd59d',7,5,2);this.light.position.set(b.x+.7,this.floor+1.35,this.center.z-.4);scene.add(this.light);
 }
 rampHeight(x,z){const r=this.ramp;if(x<r.minX||x>r.maxX||z<r.minZ||z>r.maxZ)return -Infinity;return THREE.MathUtils.lerp(r.top,r.base,(z-r.minZ)/(r.maxZ-r.minZ));}
 surfaceSafe(p){const b=this.b,ramp=this.rampHeight(p.x,p.z);return (Number.isFinite(ramp)&&p.y>ramp-.35)||(Math.abs(p.x-b.x)<1.65&&Math.abs(p.z-b.z)<1.68&&p.y>b.y+.27);}
 roomContains(p){return Math.abs(p.x-this.center.x)<2.15&&Math.abs(p.z-this.center.z)<1.8&&p.y>=this.floor-.4&&p.y<this.b.y-.8;}
 safe(p){return this.surfaceSafe(p)||(this.active&&this.roomContains(p));}
 near(p){
  if(this.transition)return null;
  if(this.active&&Math.hypot(p.x-this.b.x,p.z-(this.center.z+1.35))<2)return {kind:'reflection-exit',label:'从倒影门回到岸上'};
  if(!this.active&&Math.hypot(p.x-this.entry.x,p.z-this.entry.z)<1.65&&Math.abs(p.y-this.entry.y)<.65)return {kind:'reflection-enter',label:'穿过倒影门，拜访水下之家'};
  return null;
 }
 begin(p){const near=this.near(p);if(!near)return false;this.transition={enter:near.kind==='reflection-enter',time:0,moved:false};return true;}
 update(dt,active=true){
  const t=this.transition;if(!t||!active)return;t.time+=Math.max(0,dt);
  if(t.time>=.38&&!t.moved){t.moved=true;this.active=t.enter;this.onMove(t.enter?this.center.clone().add(new THREE.Vector3(0,0,.55)):this.exit.clone(),t.enter?Math.PI:0);}
  if(t.time>=.9)this.transition=null;
 }
 constrain(p){if(!this.active)return;p.x=THREE.MathUtils.clamp(p.x,this.center.x-1.61,this.center.x+1.61);p.z=THREE.MathUtils.clamp(p.z,this.center.z-1.13,this.center.z+1.13);}
 get busy(){return !!this.transition;}
 get fade(){const t=this.transition;if(!t)return 0;return t.moved?Math.max(0,1-(t.time-.38)/.5):Math.min(1,t.time/.25);}
}
