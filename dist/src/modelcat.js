import {loadGLB} from './asset-stream.js';
import * as THREE from 'three';
import {solveLimb,setWorldQuaternion} from './limb-ik.js';

// 脏脏包 v19: the rig, skin weights and every clip are authored offline in Blender
// (see scripts/blender/). Runtime only blends clips, fan pose and gentle secondary motion;
// it no longer rebuilds or deforms any part of the mesh, so face and robe keep their shape.
//
// Ground speed (in game metres/second at scale 1.25) at which each loop has no foot slide.
export const CAT_CLIP_SPEED={walk:1.161,run:2.757};
// The two kicks are the model's own Tripo clips; they read best a little faster than authored.
const RATE={front_kick_01:1.85,front_kick_02:1.6};
const FAN_MESH=/^fan_part_/;
const ONE_SHOTS=['jump','front_kick_01','front_kick_02'];
const FADE={sit:.55,wait:.35,walk:.22,run:.18,jump:.08,jump_down:.18,front_kick_01:.09,front_kick_02:.09};

export async function loadModelCat(url,scale=1.25){const gltf=await loadGLB(url);if(!gltf.animations.length)throw new Error('Missing rig animations');return new ModelCat(gltf,scale);}

export class ModelCat{
 constructor(gltf,scale){
  this.root=new THREE.Group();this.model=gltf.scene;this.root.add(this.model);this.model.scale.setScalar(scale);this.scale=scale;
  this.materials=[];this.fanMeshes=[];this.skeletons=new Set();this.parts=new Map();this.bones={};
  this.model.traverse(o=>{
   if(o.isBone)this.bones[o.name.replace('mixamorig','')]=o;
   if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.isSkinnedMesh)this.skeletons.add(o.skeleton);
   if(FAN_MESH.test(o.name))this.fanMeshes.push(o);
   const m=/^tripo_part_(\d+)$/.exec(o.name);if(m)this.parts.set(Number(m[1]),o);
   for(const mat of Array.isArray(o.material)?o.material:[o.material]){mat.side=THREE.DoubleSide;mat.metalness=0;mat.roughness=.9;mat.metalnessMap=null;mat.roughnessMap=null;mat.emissive=mat.map?new THREE.Color('#fff3e0'):mat.color.clone();mat.emissiveMap=mat.map;mat.emissiveIntensity=mat.map?.10:.025;mat.userData.forestGlow=mat.emissiveIntensity;if(mat.normalScale)mat.normalScale.set(.35,.35);if(mat.map)mat.map.anisotropy=8;this.materials.push(mat);}
  });
  const B=this.bones;this.head=B.Head;
  // Bind pose = the original fan-holding pose; used to raise the right paw when the fan is out.
  this.fanArm=['RightShoulder','RightArm','RightForeArm','RightHand'].map(n=>({bone:B[n],bind:B[n].quaternion.clone()}));
  this.fanBone=B.Fan;
  const fanMeshes=this.fanMeshes;
  this.rig={parts:this.parts,bones:B,skeleton:[...this.skeletons][0],fan:{get visible(){return fanMeshes.some(m=>m.visible);},set visible(v){for(const m of fanMeshes)m.visible=!!v;}}};
  this.mixer=new THREE.AnimationMixer(this.model);this.actions={};
  for(const clip of gltf.animations){const a=this.mixer.clipAction(clip);if(ONE_SHOTS.includes(clip.name)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}this.actions[clip.name]=a;}
  this.mixer.addEventListener('finished',e=>{if(this.oneShot&&e.action===this.actions[this.oneShot]){this.oneShot=null;this.chainReady=this.queuedAction;this.queuedAction=null;this.cooldown=.06;}});
  this.state=null;this.oneShot=null;this.queuedAction=null;this.chainReady=null;this.cooldown=0;
  this.time=0;this.meow=0;this.lieAmt=0;this.sitBlend=0;this.moveBlend=0;this.fanEquipped=false;this.fanPose=0;this.fanOpen=0;this.expression='default';
  this.lastHeading=0;this.turnLean=0;
  this.setFanEquipped(true);
  this.play('wait',0);this.mixer.update(0);this.model.position.y=this.baseY=.004;
 }
 setFanEquipped(value){this.fanEquipped=!!value;this.rig.fan.visible=this.fanEquipped;return this.fanEquipped;}
 setExpression(id){if(id!=='default')return false;this.expression=id;return true;}
 get isPerforming(){return !!this.oneShot;}
 get actionQueueFull(){return !!this.queuedAction;}
 triggerAction(name){if(!['front_kick_01','front_kick_02'].includes(name))return false;if(this.oneShot){if(this.queuedAction)return false;this.queuedAction=name;return true;}if(this.cooldown>0)return false;this.oneShot=name;this.play(name);return true;}
 play(name,fade=FADE[name]??.25,force=false){
  if((this.state===name&&!force)||!this.actions[name])return;
  const next=this.actions[name],old=this.actions[this.state];
  next.reset().setEffectiveTimeScale(RATE[name]??1).setEffectiveWeight(1).play();
  if(old&&old!==next)old.crossFadeTo(next,fade,true);else if(!old)next.fadeIn(fade);
  this.state=name;
 }
 land(){}
 doMeow(){this.meow=.6;}
 getHeadWorld(v=new THREE.Vector3()){return this.head.getWorldPosition(v);}
 update(dt,s){
  this.cooldown=Math.max(0,this.cooldown-dt);this.meow=Math.max(0,this.meow-dt);this.time+=dt;
  if(!s.grounded){this.oneShot=null;this.queuedAction=null;this.chainReady=null;}
  const speed=s.speed||0;
  const locomotion=s.grounded?(speed>.14?(speed>2.1?'run':'walk'):((s.sitting||s.idle>=120)?'sit':'wait')):(s.vy>0?'jump':'jump_down');
  const name=this.oneShot||locomotion;this.play(name);
  const a=this.actions[name];
  if(name==='walk'||name==='run')a.timeScale=THREE.MathUtils.clamp(speed/CAT_CLIP_SPEED[name],.55,1.9);
  this.mixer.update(dt);
  if(this.chainReady){const chained=this.chainReady;this.chainReady=null;this.oneShot=chained;this.play(chained,.07,true);this.mixer.update(0);}
  // Preserve the authored fore/aft stride and ankle orientation; bring each foot
  // toward its own hip so the short legs no longer splay sideways when running.
  if(name==='run'){
   this.root.updateMatrixWorld(true);
   for(const side of ['Left','Right']){const up=this.bones[side+'UpLeg'],leg=this.bones[side+'Leg'],foot=this.bones[side+'Foot'];
    const q=foot.getWorldQuaternion(new THREE.Quaternion()),p=this.model.worldToLocal(foot.getWorldPosition(new THREE.Vector3())),hip=this.model.worldToLocal(up.getWorldPosition(new THREE.Vector3()));
    p.x=THREE.MathUtils.lerp(p.x,hip.x,.62);const pole=this.model.worldToLocal(leg.getWorldPosition(new THREE.Vector3()));pole.x=hip.x;pole.z+=.18;
    solveLimb(up,leg,foot,this.model.localToWorld(p),this.model.localToWorld(pole));setWorldQuaternion(foot,q);
   }
  }
  const k=1-Math.exp(-8*dt);
  this.sitBlend+=((name==='sit'?1:0)-this.sitBlend)*k;
  this.moveBlend+=((name==='walk'||name==='run'?1:0)-this.moveBlend)*k;
  // Face the direction of travel inside the root (camera/heading logic lives in main.js).
  const travel=s.actualVelocity||s.vel;
  if(speed>.12&&travel&&Math.hypot(travel.x,travel.z)>.1){const want=Math.atan2(travel.x,travel.z)-this.root.rotation.y;this.model.rotation.y=Math.atan2(Math.sin(want),Math.cos(want));}
  // Lean gently into turns while moving.
  const turn=THREE.MathUtils.clamp(Math.atan2(Math.sin(this.root.rotation.y-this.lastHeading),Math.cos(this.root.rotation.y-this.lastHeading))/Math.max(dt,1e-3),-3,3);this.lastHeading=this.root.rotation.y;
  this.turnLean+=(-turn*.035*this.moveBlend-this.turnLean)*(1-Math.exp(-6*dt));
  if(this.bones.Spine)this.bones.Spine.rotateZ(this.turnLean);
  // Fan: out and raised to the bind (fan) pose only while standing; closed while moving.
  const standing=s.grounded&&!this.oneShot&&name==='wait';
  this.fanPose+=((this.fanEquipped&&standing?1:0)-this.fanPose)*(1-Math.exp(-6*dt));
  if(this.fanPose>.001){for(const {bone,bind} of this.fanArm)bone.quaternion.slerp(bind,this.fanPose);
   const hand=this.bones.RightHand;if(hand)hand.rotateZ(Math.sin(this.time*1.8)*.12*this.fanPose);}
  this.fanOpen+=((this.fanEquipped&&speed<=.14&&!this.oneShot?1:0)-this.fanOpen)*(1-Math.exp(-10*dt));
  if(this.fanBone)this.fanBone.scale.set(.12+.88*this.fanOpen,1,1);
  this.rig.fan.visible=this.fanEquipped&&s.grounded&&!this.oneShot;
  if(this.meow>0&&this.head)this.head.rotateX(-Math.sin(this.meow/.6*Math.PI)*.08);
  this.model.position.y=this.baseY;
 }
}
