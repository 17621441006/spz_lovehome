import {loadGLB} from './asset-stream.js';
import * as THREE from 'three';
import {heightAt,LAYOUT,edgeRadius,inLakeWater} from './terrain.js';
import {VILLAGE_LINES,VILLAGE_CURVES} from './village-routes.js';
import {addVillageStops} from './village-stops.js';
export class CatBus{
 static pending(){return{ready:false,root:{position:new THREE.Vector3(1e5,0,1e5)},riding:false,stopping:false,speed:0,update(){}};}
 static async create(scene,colliders){const gltf=await loadGLB('assets/catbus.glb');return new CatBus(scene,colliders,gltf.scene);}
 constructor(scene,colliders,model){this.ready=true;this.root=new THREE.Group();this.root.name='林间猫车';this.root.add(model);const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(c.x,b.min.y,c.z));this.root.scale.setScalar(5.8/size.z);this.root.updateMatrixWorld(true);this.root.scale.setScalar(1);model.scale.setScalar(5.8/size.z);model.position.multiplyScalar(5.8/size.z);
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.9;if(m.map)m.map.anisotropy=8;}});

 this.staticColliders=colliders.slice();this.speed=0;this.yaw=0;this.riding=false;this.paused=false;this.stopping=false;this.wait=4;this.visited=0;this.completedLines=0;this.stationHistory=[];this.personHold=0;
 this.routes=VILLAGE_LINES.map((line,n)=>{
  const curve=VILLAGE_CURVES[n];curve.arcLengthDivisions=2500;curve.updateArcLengths();const length=curve.getLength(),count=Math.ceil(length/.18),points=curve.getSpacedPoints(count);const samples=points.map((p,i)=>{const t=i/count,d=curve.getTangentAt(Math.min(1,t)),angle=Math.atan2(d.x,d.z);return {p:p.setY(heightAt(p.x,p.z)),yaw:angle};});
  const ds=length/count;
  for(let i=0;i<=count;i++){const here=samples[i],a=samples[(i-1+count)%count],b=samples[(i+1)%count],turn=Math.max(Math.abs(Math.atan2(Math.sin(here.yaw-a.yaw),Math.cos(here.yaw-a.yaw))),Math.abs(Math.atan2(Math.sin(b.yaw-here.yaw),Math.cos(b.yaw-here.yaw))));const grade=Math.abs(b.p.y-a.p.y)/(2*ds);here.limit=Math.min(3,.33/Math.max(.001,turn/ds),.58/Math.max(.01,grade));}
  // Propagate braking limits backwards around the whole line, including the seam.
  for(let pass=0;pass<3;pass++)for(let i=count;i>=0;i--)samples[i].limit=Math.min(samples[i].limit,Math.sqrt(samples[(i+1)%count].limit**2+2*.66*ds));
  const stops=line.stops.map(stop=>{const [x,z]=line.points[stop.point];let index=0,best=Infinity;for(let i=0;i<count;i++){const d=Math.hypot(samples[i].p.x-x,samples[i].p.z-z);if(d<best){best=d;index=i;}}return {...stop,s:index/count*length,position:samples[index].p.clone(),yaw:samples[index].yaw};}).sort((a,b)=>a.s-b.s);
  return {...line,length,count,samples,stops};
 });
 this.lineIndex=0;this.currentRoute=this.routes[0];this.distance=0;this.nextStop=1;this.stationName=this.currentRoute.stops[0].name;
 this.nodes=new Map();for(const [n,r]of this.routes.entries())for(const [i,p]of r.samples.entries())this.nodes.set(n+':'+i,p.p);
 const start=this.sample(0);this.root.position.copy(start.p);this.root.rotation.y=this.yaw=start.yaw;
 this.colliders=[-1.65,0,1.65].map(()=>({type:'circle',x:start.p.x,z:start.p.z,r:1.03,top:999,catbus:true}));colliders.push(...this.colliders);this.syncColliders();scene.add(this.root);addVillageStops(scene,this.routes,this.staticColliders,colliders);
 }
 safe(x,z,pad=1.25){if(Math.hypot(x,z)>edgeRadius(x,z)-3.8||inLakeWater(x,z,-pad)||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+pad+.1)return false;const h=heightAt(x,z);return !this.staticColliders.some(c=>!c.floorOnly&&(c.bottom===undefined||c.bottom<h+2.5)&&c.top>h+.10&&(c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+pad:c.type==='box'&&x>c.minX-pad&&x<c.maxX+pad&&z>c.minZ-pad&&z<c.maxZ+pad));}
 footprintSafe(x,z,yaw){return [-1.65,0,1.65].every(d=>this.safe(x+Math.sin(yaw)*d,z+Math.cos(yaw)*d,1.2));}
 sample(distance,route=this.currentRoute){const s=THREE.MathUtils.clamp(distance,0,route.length)/route.length*route.count,i=Math.min(route.count-1,Math.floor(s)),f=s-i,a=route.samples[i],b=route.samples[i+1],delta=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));return {p:a.p.clone().lerp(b.p,f),yaw:a.yaw+delta*f,limit:Math.min(a.limit,b.limit)};}
 personDistance(people){let nearest=Infinity;const horizon=4.2+this.speed*this.speed/1.7;for(const p of people){if(Math.abs(p.y-this.root.position.y)>2.6||p.distanceToSquared(this.root.position)>(horizon+3)**2)continue;for(let d=0;d<=horizon;d+=.35){const at=this.sample(Math.min(this.currentRoute.length,this.distance+d)).p;if(Math.hypot(p.x-at.x,p.z-at.z)<1.65){nearest=Math.min(nearest,d-3.25);break;}}}return nearest;}
 syncColliders(){for(let i=0;i<3;i++){const z=(i-1)*1.65;this.colliders[i].x=this.root.position.x+Math.sin(this.yaw)*z;this.colliders[i].z=this.root.position.z+Math.cos(this.yaw)*z;}}
 seat(out=new THREE.Vector3()){return out.set(0,1.08,-.25).applyQuaternion(this.root.quaternion).add(this.root.position);}
 exitPoint(){for(const side of [-1,1])for(const off of [2,2.6,3.2]){const p=this.root.position.clone().add(new THREE.Vector3(Math.cos(this.yaw)*side*off,0,-Math.sin(this.yaw)*side*off));const blocked=!this.safe(p.x,p.z,.55);if(!blocked){p.y=heightAt(p.x,p.z);return p;}}return null;}
 update(dt,people=[]){
  dt=Math.min(.1,Math.max(0,dt));this.wait=Math.max(0,this.wait-dt);const route=this.currentRoute,stop=route.stops[this.nextStop],end=stop?.s??route.length,remaining=Math.max(0,end-this.distance);
  let target=3;for(let d=0;d<=8;d+=.65){const at=this.sample(this.distance+d);target=Math.min(target,Math.sqrt(at.limit*at.limit+2*.85*d));}
  target=Math.min(target,Math.sqrt(2*.85*Math.max(0,remaining-.025)));
  const pedestrian=this.personDistance(people);this.blocked=Number.isFinite(pedestrian);if(pedestrian<1.0)this.personHold=.7;else this.personHold=Math.max(0,this.personHold-dt);
  target=Math.min(target,Math.sqrt(2*.85*Math.max(0,pedestrian-.9)));
  if(this.paused||this.stopping||this.wait>0||this.personHold>0)target=0;
  const oldSpeed=this.speed;this.speed+=THREE.MathUtils.clamp(target-this.speed,-.85*dt,.62*dt);
  let step=(oldSpeed+this.speed)*.5*dt;if(pedestrian<.25){this.speed=0;step=0;}
  const nextDistance=Math.min(end,this.distance+step),next=this.sample(nextDistance);
  if(this.footprintSafe(next.p.x,next.p.z,next.yaw)){this.distance=nextDistance;this.root.position.copy(next.p);const turn=Math.atan2(Math.sin(next.yaw-this.yaw),Math.cos(next.yaw-this.yaw));this.yaw+=turn;}else this.speed=0;
  const fore=heightAt(this.root.position.x+Math.sin(this.yaw)*1.65,this.root.position.z+Math.cos(this.yaw)*1.65),back=heightAt(this.root.position.x-Math.sin(this.yaw)*1.65,this.root.position.z-Math.cos(this.yaw)*1.65);const pitch=-Math.atan2(fore-back,3.3);this.pitch=(this.pitch||0)+(pitch-(this.pitch||0))*(1-Math.exp(-3*dt));this.root.rotation.set(this.pitch,this.yaw,0,'YXZ');this.root.position.y=(fore+back)*.5;this.syncColliders();
  if(remaining<.055&&this.speed<.0001&&!this.paused&&!this.stopping&&!this.blocked&&this.wait===0){
   this.speed=0;this.wait=6;this.visited++;
   if(stop){this.stationName=stop.name;this.nextStop++;}else{this.completedLines++;this.lineIndex=(this.lineIndex+1)%this.routes.length;this.currentRoute=this.routes[this.lineIndex];this.distance=0;this.nextStop=1;this.stationName=this.currentRoute.stops[0].name;}
   this.stationHistory.push(this.stationName);if(this.stationHistory.length>24)this.stationHistory.shift();
  }
 }
}
