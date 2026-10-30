import * as THREE from 'three';
import {loadGLB} from './asset-stream.js';
import {createDengweirongNavigation} from './dengweirong.js';

export const YUEDAI_HOME={x:-34,z:-22};
export const YUEDAI_ASSET='assets/creatures/yuedai-v1.glb';
const V=()=>new THREE.Vector3(),flat=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export async function loadYuedai(scene,options={}){
 const gltf=await loadGLB(YUEDAI_ASSET),npc=new Yuedai(gltf,options);scene.add(npc.root);return npc;
}
export class Yuedai{
 constructor(gltf,options={}){
  this.nav=options.navigation||createDengweirongNavigation({radius:.34});this.random=options.random||Math.random;
  this.home=new THREE.Vector3(YUEDAI_HOME.x,0,YUEDAI_HOME.z);this.home.y=this.nav.ground(this.home.x,this.home.z);
  if(!this.nav.safePoint(this.home))throw new Error('月袋的林间空地被阻挡');
  this.root=new THREE.Group();this.root.name='月袋 · 把月光放进口袋';this.root.position.copy(this.home);this.position=this.root.position;
  this.model=gltf.scene;this.model.scale.setScalar(.8);this.root.add(this.model);this.root.rotation.y=2.1;
  this.materials=[];this.blinks=[];this.authored=[];this.feet=[];
  this.model.traverse(o=>{if(o.isBone)this.authored.push({node:o,p:o.position.clone(),q:o.quaternion.clone()});if(!o.isMesh)return;
   o.castShadow=o.receiveShadow=true;const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();this.materials.push(c);return c;});o.material=Array.isArray(o.material)?mats:mats[0];
   if(o.morphTargetDictionary?.Blink!==undefined)this.blinks.push({mesh:o,index:o.morphTargetDictionary.Blink});
  });
  this.head=this.model.getObjectByName('YD_Head');this.mixer=new THREE.AnimationMixer(this.model);this.actions={};
  for(const clip of gltf.animations){const key=clip.name.toLowerCase().replace(/^yd_/,''),copy=clip.clone(),start=Math.min(...copy.tracks.map(t=>t.times[0]));if(start>0){copy.tracks.forEach(t=>t.shift(-start));copy.resetDuration();}this.actions[key]=this.mixer.clipAction(copy);}
  if(!['idle','walk','greet','pocket'].every(k=>this.actions[k]))throw new Error('月袋缺少独立骨骼动画');
  this.state='idle';this.time=0;this.wait=2.8;this.target=null;this.lastGreeting=-20;this.gestureTime=0;this.play('idle',0);this.mixer.update(0);this.root.updateMatrixWorld(true);
  for(const side of ['L','R']){const bone=this.model.getObjectByName('YD_Foot_'+side),samples=[];if(!bone)continue;
   this.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){let weight=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[si.getComponent(i,k)]===bone)weight+=sw.getComponent(i,k);if(weight>.55)samples.push({mesh,index:i,y:mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).y});}});
   samples.sort((a,b)=>a.y-b.y);this.feet.push({bone,samples:samples.slice(0,8)});
  }
  this.collider={type:'circle',x:this.position.x,z:this.position.z,r:.27,bottom:this.position.y,top:this.position.y+.8,dynamic:true,noFloor:true,owner:'yuedai'};this.nav.obstacles.push(this.collider);
 }
 play(name,fade=.28){const action=this.actions[name];if(action===this.action)return;action.reset().setEffectiveWeight(1).play();this.action?.crossFadeTo(action,fade,false);this.action=action;}
 canInvite(p){return !!p&&flat(this.position,p)<2.4&&Math.abs(p.y-this.position.y)<1.1;}
 showPocket(){this.target=null;this.state='pocket';this.gestureTime=4;this.play('pocket');}
 chooseTarget(){
  const candidates=[[-34,-23],[-35,-23],[-34,-21],[-34,-22]];
  const offset=Math.floor(this.random()*candidates.length);
  for(let i=0;i<candidates.length;i++){const [x,z]=candidates[(i+offset)%candidates.length],p=new THREE.Vector3(x,this.nav.ground(x,z),z);if(flat(p,this.position)>.45&&this.nav.safeSegment(this.position,p,this.collider)){this.target=p;this.state='walk';return;}}
  this.wait=3;this.state='idle';
 }
 update(dt,player,{paused=false,busy=false,night=0}={}){
  dt=THREE.MathUtils.clamp(dt,0,.06);const distance=flat(this.position,player);this.root.visible=distance<60;if(paused||distance>32)return;this.time+=dt;
  let travel=0;
  if(this.gestureTime>0){this.gestureTime-=dt;if(this.gestureTime<=0){this.state='idle';this.wait=3;}}
  else if(!busy){
   if(distance<3.2&&this.time-this.lastGreeting>12){this.state='greet';this.gestureTime=3;this.lastGreeting=this.time;this.target=null;}
   else if(distance>2.3){this.wait-=dt;if(!this.target&&this.wait<=0)this.chooseTarget();}
   else{this.target=null;this.state='idle';this.wait=2;}
  }
  const look=this.target||(distance<4?player:null);
  if(look){const wanted=Math.atan2(look.x-this.position.x,look.z-this.position.z),delta=Math.atan2(Math.sin(wanted-this.root.rotation.y),Math.cos(wanted-this.root.rotation.y));this.root.rotation.y+=THREE.MathUtils.clamp(delta,-dt*1.5,dt*1.5);
   if(this.target&&!busy&&Math.abs(delta)<.30){const d=flat(this.target,this.position),step=Math.min(d,.30*dt),next=this.position.clone().lerp(this.target,step/Math.max(d,1e-6));
    if(flat(next,player)>.9&&this.nav.safeSegment(this.position,next,this.collider)){this.position.copy(next);this.position.y=this.nav.ground(next.x,next.z);travel=step;}
    else{this.target=null;this.state='idle';this.wait=2;}
    if(d<.035){this.target=null;this.state='idle';this.wait=3+this.random()*3;}
   }
  }
  this.collider.x=this.position.x;this.collider.z=this.position.z;this.collider.bottom=this.position.y;this.collider.top=this.position.y+.8;
  for(const p of this.authored){p.node.position.copy(p.p);p.node.quaternion.copy(p.q);}
  const clip=this.gestureTime>0?this.state:travel>0?'walk':'idle';this.play(clip);this.mixer.update(dt);
  for(const p of this.authored){p.p.copy(p.node.position);p.q.copy(p.node.quaternion);}
  const blink=(this.time+1.3)%4.6,amount=blink<.18?Math.sin(blink/.18*Math.PI)**2:0;for(const b of this.blinks)b.mesh.morphTargetInfluences[b.index]=amount;
  this.root.updateMatrixWorld(true);
  // Only correct penetration; a deliberately lifted swing foot keeps its lift.
  for(const foot of this.feet){let y=Infinity,x=0,z=0;for(const s of foot.samples){const p=s.mesh.getVertexPosition(s.index,V()).applyMatrix4(s.mesh.matrixWorld);if(p.y<y){y=p.y;x=p.x;z=p.z;}}
   if(!Number.isFinite(y))continue;const ground=this.nav.ground(x,z),correction=THREE.MathUtils.clamp(ground+.006-y,0,.09);if(correction){const p=foot.bone.getWorldPosition(V());p.y+=correction;foot.bone.parent.worldToLocal(p);foot.bone.position.copy(p);}}
  this.root.updateMatrixWorld(true);
 }
 dispose(){this.root.removeFromParent();const i=this.nav.obstacles.indexOf(this.collider);if(i>=0)this.nav.obstacles.splice(i,1);this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);for(const m of this.materials)m.dispose();}
}
