import {loadGLB} from './asset-stream.js';
import * as THREE from 'three';
import {heightAt,LAYOUT} from './terrain.js';
export class CatBus{
 static pending(){return{ready:false,root:{position:new THREE.Vector3(1e5,0,1e5)},riding:false,stopping:false,speed:0,update(){}};}
 static async create(scene,colliders){const gltf=await loadGLB('assets/catbus.glb');return new CatBus(scene,colliders,gltf.scene);}
 constructor(scene,colliders,model){this.ready=true;this.root=new THREE.Group();this.root.name='林间猫车';this.root.add(model);const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(c.x,b.min.y,c.z));this.root.scale.setScalar(5.8/size.z);this.root.updateMatrixWorld(true);this.root.scale.setScalar(1);model.scale.setScalar(5.8/size.z);model.position.multiplyScalar(5.8/size.z);
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.9;if(m.map)m.map.anisotropy=8;}});

 this.staticColliders=colliders.slice();this.speed=0;this.yaw=0;this.riding=false;this.paused=false;this.stopping=false;this.wait=1.2;this.visited=0;
 // The reserved southeast meadow has one fixed, wide elliptical circuit.
 // Planting excludes its corridor, while full-body validation still protects
 // buildings, water and the map edge. No random route changes at each lap.
 this.routes=[{...LAYOUT.catbusRoute}];
 for(let i=0;i<360;i++){const r=this.routes[0],t=i/360*Math.PI*2,p=this.routePoint(r,t),yaw=Math.atan2(-r.rx*Math.sin(t),r.rz*Math.cos(t));if(!this.footprintSafe(p.x,p.z,yaw))throw new Error('猫车巡游环线被障碍物挡住');}
 this.nodes=new Map();this.routes.forEach((r,i)=>{for(let k=0;k<60;k++)this.nodes.set(i+':'+k,this.routePoint(r,k/60*Math.PI*2));});
 this.currentRoute=this.routes[0];this.theta=0;const start=this.routePoint(this.currentRoute,0);this.root.position.copy(start);this.root.rotation.y=this.yaw=0;

 this.colliders=[-1.65,0,1.65].map(()=>({type:'circle',x:start.x,z:start.z,r:1.03,top:999,catbus:true}));colliders.push(...this.colliders);this.syncColliders();scene.add(this.root);}
 safe(x,z,pad=1.25){if(Math.hypot(x-LAYOUT.spawn.x,z-LAYOUT.spawn.z)<12||Math.hypot(x,z)>43||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+pad+.1)return false;const h=heightAt(x,z);for(const [dx,dz]of [[3,0],[-3,0],[0,3],[0,-3]])if(Math.abs(heightAt(x+dx,z+dz)-h)>.65)return false;return !this.staticColliders.some(c=>c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+pad:x>c.minX-pad&&x<c.maxX+pad&&z>c.minZ-pad&&z<c.maxZ+pad);}
 footprintSafe(x,z,yaw){return [-1.65,0,1.65].every(d=>this.safe(x+Math.sin(yaw)*d,z+Math.cos(yaw)*d,1.2));}
 clear(a,b){const n=Math.ceil(a.distanceTo(b)/.3);for(let i=0;i<=n;i++){const t=i/Math.max(n,1);if(!this.safe(THREE.MathUtils.lerp(a.x,b.x,t),THREE.MathUtils.lerp(a.z,b.z,t)))return false;}return true;}
 routePoint(r,t){const x=r.x+Math.cos(t)*r.rx,z=r.z+Math.sin(t)*r.rz;return new THREE.Vector3(x,heightAt(x,z),z);}
 route(){this.theta%=Math.PI*2;this.visited++;}
 syncColliders(){for(let i=0;i<3;i++){const z=(i-1)*1.65;this.colliders[i].x=this.root.position.x+Math.sin(this.yaw)*z;this.colliders[i].z=this.root.position.z+Math.cos(this.yaw)*z;}}
 seat(out=new THREE.Vector3()){return out.set(0,1.08,-.25).applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw).add(this.root.position);}
 exitPoint(){for(const side of [-1,1])for(const off of [2,2.6,3.2]){const p=this.root.position.clone().add(new THREE.Vector3(Math.cos(this.yaw)*side*off,0,-Math.sin(this.yaw)*side*off));const blocked=this.staticColliders.some(c=>c.type==='circle'?Math.hypot(p.x-c.x,p.z-c.z)<c.r+.55:p.x>c.minX-.55&&p.x<c.maxX+.55&&p.z>c.minZ-.55&&p.z<c.maxZ+.55);if(!blocked){p.y=heightAt(p.x,p.z);return p;}}return null;}
 update(dt,people=[]){
 dt=Math.min(.1,Math.max(0,dt));this.wait=Math.max(0,this.wait-dt);
 const r=this.currentRoute,t=this.theta,metric=Math.hypot(r.rx*Math.sin(t),r.rz*Math.cos(t));
 const stop=this.paused||this.stopping||this.wait>0;
 const look=(t+(this.speed*this.speed/1.6+.5)/metric)%(Math.PI*2),ahead=this.routePoint(r,look);
 const blocked=people.some(p=>Math.hypot(p.x-ahead.x,p.z-ahead.z)<3.5);
 const target=stop||blocked?0:Math.min(2.4,.40*Math.min(r.rx,r.rz)**2/Math.max(r.rx,r.rz));
 this.speed+=THREE.MathUtils.clamp(target-this.speed,-.8*dt,.65*dt);
 const nextT=t+this.speed*dt/metric,next=this.routePoint(r,nextT),angle=Math.atan2(-r.rx*Math.sin(nextT),r.rz*Math.cos(nextT));
 const diff=Math.atan2(Math.sin(angle-this.yaw),Math.cos(angle-this.yaw));
 if(this.footprintSafe(next.x,next.z,angle)){this.theta=nextT;this.root.position.x=next.x;this.root.position.z=next.z;this.yaw+=diff;}else this.speed=0;
 this.root.position.y+=(heightAt(this.root.position.x,this.root.position.z)-this.root.position.y)*(1-Math.exp(-2*dt));this.root.rotation.y=this.yaw;this.syncColliders();
 if(this.theta>=Math.PI*2)this.route();
 }
}
