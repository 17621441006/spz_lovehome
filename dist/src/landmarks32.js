import * as THREE from 'three';
import {loadGLB} from './asset-stream.js';
import {LAYOUT,heightAt} from './terrain.js';

export const LANDMARK_FILES=['assets/buildings/torii-nest-v1.glb','assets/buildings/kite-house-v1.glb'];
const UP=new THREE.Vector3(0,1,0);
const box=(x,z,hx,hz,bottom,top)=>({type:'box',minX:x-hx,maxX:x+hx,minZ:z-hz,maxZ:z+hz,bottom,top,noFloor:true});
function world(root,x,y,z){return new THREE.Vector3(x,y,z).applyAxisAngle(UP,root.rotation.y).add(root.position);}
function local(root,p){return p.clone().sub(root.position).applyAxisAngle(UP,-root.rotation.y);}
function wallAt(root,x,z,hx,hz,height=3){
 const p=world(root,x,0,z),swap=Math.abs(Math.sin(root.rotation.y))>.5;
 return box(p.x,p.z,swap?hz:hx,swap?hx:hz,root.position.y-.1,root.position.y+height);
}
function setupBuilding(root,id,name,position,yaw){
 root.name=name;root.userData.buildingId=id;root.position.copy(position);root.rotation.y=yaw;
 root.userData.walkableDeck={y:position.y};
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});root.updateMatrixWorld(true);
}
function rope(a,b,material){
 const mid=a.clone().lerp(b,.5);mid.y-=.25;
 const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
 return new THREE.Mesh(new THREE.TubeGeometry(curve,12,.025,5,false),material);
}

// One pavilion, two moorings. The stable deck is independent of kite/rope sway.
// Travel uses active wall-clock seconds, never physics' clamped frame delta.
export class Landmarks32 {
 static async create(scene,colliders){
  const [nest,kite]=await Promise.all(LANDMARK_FILES.map(loadGLB));
  return new Landmarks32(scene,colliders,nest.scene,kite.scene);
 }
 constructor(scene,colliders,nest,kite){
  this.scene=scene;this.colliders=colliders;this.nest=nest;this.kite=kite;
  this.dockIndex=0;this.aboard=false;this.transition=null;this.dynamicColliders=[];
  this.onMove=()=>{};this.onWake=()=>{};
  const n=LAYOUT.toriiNest,y=heightAt(n.x,n.z)+.28;
  setupBuilding(nest,'torii-nest-v1','千本鸟居巢',new THREE.Vector3(n.x,y,n.z),n.rotation);scene.add(nest);
  colliders.push({type:'circle',x:n.x,z:n.z,r:5.65,top:y,floorOnly:true,landmark:'torii-nest'});
  // Tight overlapping wall segments follow the shell, with a real 2.5 m door.
  for(let i=0;i<64;i++){
   const a=i/64*Math.PI*2,x=Math.sin(a)*4.82,z=Math.cos(a)*4.82;
   if(z>0&&Math.abs(x)<1.48)continue;
   const p=world(nest,x,0,z);colliders.push({type:'circle',x:p.x,z:p.z,r:.27,top:y+5,bottom:y-.15,noFloor:true,landmark:'torii-nest'});
  }
  // A shallow landing aligns with the continuous porch in the Blender asset.
  const porch=world(nest,0,0,5.45);colliders.push({type:'box',minX:porch.x-.65,maxX:porch.x+.65,minZ:porch.z-1.3,maxZ:porch.z+1.3,top:y,floorOnly:true,landmark:'torii-nest'});
  colliders.push({...wallAt(nest,0,-2.45,1.175,.36,.36),noFloor:false,landmark:'nest-tea-bench'});
  this.docks=LAYOUT.kiteDocks.map(d=>({...d,y:heightAt(d.anchorX,d.anchorZ)+1.85}));
  this.ropeMaterial=new THREE.MeshStandardMaterial({color:'#c6a66d',roughness:1});
  this.dockRoot=new THREE.Group();this.dockRoot.name='系风亭 · 崖边系缆石';scene.add(this.dockRoot);
  const stone=new THREE.MeshStandardMaterial({color:'#a6aa98',roughness:1});
  for(const d of this.docks){
   const peg=new THREE.Mesh(new THREE.CylinderGeometry(.17,.28,.62,8),stone);
   peg.position.set(d.anchorX,heightAt(d.anchorX,d.anchorZ)+.29,d.anchorZ+1.2);peg.castShadow=true;this.dockRoot.add(peg);
  }
  setupBuilding(kite,'kite-house-v1','系风亭',new THREE.Vector3(),0);scene.add(kite);this.setDock(0);
 }
 get busy(){return !!this.transition;}
 get sleeping(){return this.transition?.kind==='sleep'&&!this.transition.moved;}
 get dock(){return this.docks[this.dockIndex];}
 setDock(index){
  this.dockIndex=index;const d=this.dock;
  this.kite.position.set(d.x,d.y,d.z);this.kite.rotation.y=d.rotation;
  this.kite.userData.walkableDeck.y=d.y;this.kite.userData.occlusionRevision=(this.kite.userData.occlusionRevision||0)+1;
  this.kite.updateMatrixWorld(true);
  for(const c of this.dynamicColliders){const i=this.colliders.indexOf(c);if(i>=0)this.colliders.splice(i,1);}
  this.dynamicColliders=[{type:'box',minX:d.x-2.05,maxX:d.x+2.05,minZ:d.z-2.05,maxZ:d.z+2.05,top:d.y,floorOnly:true,landmark:'kite-house'},
   wallAt(this.kite,-1.86,0,.09,1.86),wallAt(this.kite,1.86,0,.09,1.86),wallAt(this.kite,0,-1.86,1.86,.09)];
  this.colliders.push(...this.dynamicColliders);
  if(this.mooring){this.mooring.removeFromParent();this.mooring.children.forEach(m=>m.geometry.dispose());}
  this.mooring=new THREE.Group();this.mooring.name='系风亭 · 三根系缆';this.scene.add(this.mooring);
  for(const offset of [-1,0,1])this.mooring.add(rope(world(this.kite,offset*1.5,.07,1.85),new THREE.Vector3(d.anchorX,heightAt(d.anchorX,d.anchorZ)+.38,d.anchorZ+offset*.6),this.ropeMaterial));
 }
 near(p){
  if(this.busy)return null;
  if(this.aboard)return {kind:'kite-inside',label:'在系风亭小憩 / 下亭'};
  const i=this.docks.findIndex(d=>Math.hypot(p.x-d.anchorX,p.z-d.anchorZ)<2.4&&Math.abs(p.y-heightAt(d.anchorX,d.anchorZ))<1);
  if(i>=0)return {kind:i===this.dockIndex?'kite-board':'kite-recall',dock:i,label:i===this.dockIndex?'沿绳梯登上系风亭':'拉响风铃，唤回系风亭'};
  return null;
 }
 begin(kind,p){
  if(this.busy)return false;
  if(kind==='sleep'&&!this.aboard)return false;
  if(kind==='board'&&(this.aboard||this.near(p)?.kind!=='kite-board'))return false;
  if(kind==='exit'&&!this.aboard)return false;
  if(!['sleep','board','exit'].includes(kind))return false;
  this.transition={kind,time:0,duration:kind==='sleep'?5:.38,moved:false};
  if(kind==='sleep')this.onMove(world(this.kite,.65,.12,-.35),this.kite.rotation.y+Math.PI,true);
  return true;
 }
 recall(p){const near=this.near(p);if(near?.kind!=='kite-recall')return false;this.setDock(near.dock);return true;}
 update(realDt,active=true){
  const t=this.transition;if(!t||!active)return;
  t.time+=Math.max(0,realDt);
  if(!t.moved&&t.time>=t.duration){
   t.moved=true;
   if(t.kind==='sleep'){this.setDock((this.dockIndex+1)%this.docks.length);this.onMove(world(this.kite,0,0,.35),this.kite.rotation.y+Math.PI,false);this.onWake(this.dock.name);}
   if(t.kind==='board'){this.aboard=true;this.onMove(world(this.kite,0,0,.65),this.kite.rotation.y+Math.PI,false);}
   if(t.kind==='exit'){this.aboard=false;const d=this.dock;this.onMove(new THREE.Vector3(d.anchorX,heightAt(d.anchorX,d.anchorZ),d.anchorZ),d.rotation,false);}
  }
  if(t.time>=t.duration+.55)this.transition=null;
 }
 constrain(p){
  if(!this.aboard)return;
  const q=local(this.kite,p);q.x=THREE.MathUtils.clamp(q.x,-1.35,1.35);q.z=THREE.MathUtils.clamp(q.z,-1.35,1.36);
  p.copy(world(this.kite,q.x,q.y,q.z));
 }
 floor(p){return this.aboard?this.dock.y:null;}
 ceiling(p){return this.aboard?this.dock.y+.65:null;}
 get sleepRemaining(){return this.sleeping?Math.max(0,Math.ceil(5-this.transition.time)):0;}
 get fade(){const t=this.transition;if(!t)return 0;return t.moved?Math.max(0,1-(t.time-t.duration)/.5):Math.min(1,t.time/(t.kind==='sleep'?1.2:.25));}
}
