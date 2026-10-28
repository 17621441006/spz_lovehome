import {loadGLB} from './asset-stream.js';
import * as THREE from 'three';
import {repairRig,solveLimb,setWorldQuaternion} from './rig-repair.js';
export async function loadModelCat(url,scale=1.25){const gltf=await loadGLB(url);if(!gltf.animations.length)throw new Error('Missing rig animations');return new ModelCat(gltf,scale);}
export class ModelCat{
 constructor(gltf,scale){
  this.root=new THREE.Group();this.model=gltf.scene;this.root.add(this.model);this.rig=repairRig(this.model);this.model.scale.setScalar(scale);this.scale=scale;
  this.neutralPose=['Hips','Spine','Spine1','Spine2','Neck'].map(n=>({bone:this.rig.bones[n],q:this.rig.bones[n].quaternion.clone()}));this.neutralHips=this.rig.bones.Hips.position.clone();this.handRest={Left:this.rig.bones.LeftHand.getWorldQuaternion(new THREE.Quaternion()),Right:this.rig.bones.RightHand.getWorldQuaternion(new THREE.Quaternion())};this.standBlend=0;
  this.head=this.rig.bones.Head;this.materials=[];this.contacts=[];this.skeletons=new Set();this.contactV=new THREE.Vector3();this.lieAmt=0;this.meow=0;this.sitBlend=0;this.cooldown=0;this.oneShot=null;this.queuedAction=null;this.chainReady=null;this.moveBlend=0;this.time=0;this.lastHeading=0;this.tailSway=0;this.fanEquipped=false;this.fanOpen=0;this.expression='default';
  this.model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.isSkinnedMesh)this.skeletons.add(o.skeleton);
   // Ground the soles, not the tail, fan, rope or dangling clothing.
   if(['tripo_part_3','tripo_part_22'].includes(o.name)){const ids=[];for(let i=0;i<o.geometry.attributes.position.count;i+=3)ids.push(i);this.contacts.push({mesh:o,ids});}
   for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.9;m.metalnessMap=null;m.roughnessMap=null;m.emissive=m.map?new THREE.Color('#fff3e0'):m.color.clone();m.emissiveMap=m.map;m.emissiveIntensity=m.map?.10:.025;m.userData.forestGlow=m.map?.10:.025;if(m.normalScale)m.normalScale.set(.25,.25);if(m.map)m.map.anisotropy=8;this.materials.push(m);}
  });
  this.mixer=new THREE.AnimationMixer(this.model);this.actions={};const origin=this.rig.bones.Hips.position.clone();
  for(const original of gltf.animations){const clip=original.clone();for(const track of clip.tracks){
    if(!/Hips.position$/.test(track.name))continue;const v=track.values,a=[v[0],v[1],v[2]],end=[v[v.length-3],v[v.length-2],v[v.length-1]],duration=track.times[track.times.length-1]||1;
    for(let i=0;i<v.length;i+=3){const f=track.times[i/3]/duration;v[i]=origin.x+(v[i]-a[0]-(end[0]-a[0])*f);v[i+2]=origin.z+(v[i+2]-a[2]-(end[2]-a[2])*f);if(['jump','jump_down','climb'].includes(clip.name))v[i+1]=origin.y+THREE.MathUtils.clamp(v[i+1]-a[1],-.045,.055);}
   }
   const action=this.mixer.clipAction(clip);if(['jump','jump_down','front_kick_01','front_kick_02'].includes(clip.name)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}this.actions[clip.name]=action;
  }
  this.mixer.addEventListener('finished',e=>{if(this.oneShot&&e.action===this.actions[this.oneShot]){this.oneShot=null;this.chainReady=this.queuedAction;this.queuedAction=null;this.cooldown=.06;}});
  this.play('wait',0);this.mixer.update(0);this.model.updateMatrixWorld(true);this.model.position.y=.02;this.baseY=.02;this.animationPose=Object.values(this.rig.bones).map(b=>({bone:b,p:b.position.clone(),q:b.quaternion.clone()}));
 }
 setFanEquipped(value){this.fanEquipped=!!value;this.rig.fan.visible=this.fanEquipped;return this.fanEquipped;}
 setExpression(id){if(id!=='default')return false;this.expression=id;return true;}
 get isPerforming(){return !!this.oneShot;}
 get actionQueueFull(){return !!this.queuedAction;}
 triggerAction(name){if(!['front_kick_01','front_kick_02'].includes(name))return false;if(this.oneShot){if(this.queuedAction)return false;this.queuedAction=name;return true;}if(this.cooldown>0)return false;this.oneShot=name;this.play(name,.09);return true;}
 play(name,fade=.25,force=false){if((this.state===name&&!force)||!this.actions[name])return;const next=this.actions[name],old=this.actions[this.state];const rate=name==='front_kick_01'?1.85:name==='front_kick_02'?1.6:1;next.reset().setEffectiveTimeScale(rate).setEffectiveWeight(1).play();if(old&&old!==next)old.crossFadeTo(next,fade,false);else if(!old)next.fadeIn(fade);this.state=name;}
 land(){}
 doMeow(){this.meow=.6;}
 getHeadWorld(v=new THREE.Vector3()){return this.head.getWorldPosition(v);}
 modelPoint(x,y,z){return this.model.localToWorld(new THREE.Vector3(x,y,z));}
 update(dt,s){
  this.cooldown=Math.max(0,this.cooldown-dt);this.meow=Math.max(0,this.meow-dt);if(!s.grounded){this.oneShot=null;this.queuedAction=null;this.chainReady=null;}
  const locomotion=s.grounded?(s.speed>.14?(s.speed>2.7?'run':'walk'):(s.idle>7?'sit':'wait')):(s.vy>0?'jump':'jump_down');
  const name=this.oneShot||locomotion;this.play(name);const a=this.actions[name];if(name==='walk'||name==='run')a.timeScale=THREE.MathUtils.clamp(s.speed/(name==='walk'?1.5:3.8),.6,1.8);
  for(const p of this.animationPose){p.bone.position.copy(p.p);p.bone.quaternion.copy(p.q);}
  this.mixer.update(dt);if(this.chainReady){const chained=this.chainReady;this.chainReady=null;this.oneShot=chained;this.play(chained,.07,true);this.mixer.update(0);}
  for(const p of this.animationPose){p.p.copy(p.bone.position);p.q.copy(p.bone.quaternion);}
  this.time+=dt;const sitting=name==='sit';this.sitBlend+=((sitting?1:0)-this.sitBlend)*(1-Math.exp(-9*dt));this.moveBlend+=((['walk','run'].includes(name)?1:0)-this.moveBlend)*(1-Math.exp(-7*dt));
  this.rig.updateSleeveMotion?.(this.moveBlend);
  const travel=s.actualVelocity||s.vel;if(s.speed>.12&&travel&&Math.hypot(travel.x,travel.z)>.1)this.model.rotation.y=Math.atan2(Math.sin(Math.atan2(travel.x,travel.z)-this.root.rotation.y),Math.cos(Math.atan2(travel.x,travel.z)-this.root.rotation.y));
  const B=this.rig.bones;
  this.standBlend+=((name==='wait'?1:0)-this.standBlend)*(1-Math.exp(-9*dt));
  if(this.standBlend>.001){for(const p of this.neutralPose)p.bone.quaternion.slerp(p.q,this.standBlend);B.Hips.position.lerp(this.neutralHips.clone().add(new THREE.Vector3(0,Math.sin(this.time*1.6)*.0015,0)),this.standBlend);}
  if(this.sitBlend>.001){for(const p of this.neutralPose)p.bone.quaternion.slerp(p.q,this.sitBlend);B.Hips.position.lerp(this.neutralHips.clone().add(new THREE.Vector3(0,-.20,0)),this.sitBlend);}const turn=THREE.MathUtils.clamp(Math.atan2(Math.sin(this.root.rotation.y-this.lastHeading),Math.cos(this.root.rotation.y-this.lastHeading))/Math.max(dt,.001),-3,3);this.lastHeading=this.root.rotation.y;const sway=Math.sin(this.time*(s.speed>.2?2.3:.85))*(.3+this.moveBlend*.3)-turn*.14;this.tailSway+=(sway-this.tailSway)*(1-Math.exp(-5*dt));for(const mesh of this.rig.tailMeshes){mesh.morphTargetInfluences[0]=this.sitBlend;mesh.morphTargetInfluences[1]=this.tailSway;mesh.morphTargetInfluences[2]=Math.sin(this.time*1.35)*.55;}
  this.root.updateMatrixWorld(true);
  if(!this.oneShot){const modelQ=this.model.getWorldQuaternion(new THREE.Quaternion()),headQ=this.head.getWorldQuaternion(new THREE.Quaternion());const delta=modelQ.clone().invert().multiply(headQ).multiply(this.rig.headRest.clone().invert());const e=new THREE.Euler().setFromQuaternion(delta,'YXZ');e.x=THREE.MathUtils.clamp(e.x*.10,-.035,.035);e.y=THREE.MathUtils.clamp(e.y*.16,-.07,.07);e.z=THREE.MathUtils.clamp(e.z*.06,-.015,.015);setWorldQuaternion(this.head,modelQ.multiply(new THREE.Quaternion().setFromEuler(e)).multiply(this.rig.headRest));}
  if(this.head&&this.meow>0)this.head.rotation.x-=Math.sin(this.meow/.6*Math.PI)*.04;
  this.root.updateMatrixWorld(true);
  if(this.standBlend>.001){
   for(const [side,sign]of [['Left',1],['Right',-1]]){const foot=B[side+'Foot'],target=foot.getWorldPosition(new THREE.Vector3()).lerp(this.modelPoint(sign>0?.186:-.201,.085,.117+sign*.019),this.standBlend);solveLimb(B[side+'UpLeg'],B[side+'Leg'],foot,target,this.modelPoint(sign*.22,.22,.34));setWorldQuaternion(foot,foot.getWorldQuaternion(new THREE.Quaternion()).slerp(this.model.getWorldQuaternion(new THREE.Quaternion()).multiply(this.rig.feet[side]),this.standBlend));}
  }
  if(this.sitBlend>.02){
   for(const [side,sign] of [['Left',1],['Right',-1]]){const foot=B[side+'Foot'],original=foot.getWorldPosition(new THREE.Vector3()),desired=this.modelPoint(sign*.195,.085,.37);const target=original.lerp(desired,this.sitBlend);
    solveLimb(B[side+'UpLeg'],B[side+'Leg'],foot,target,this.modelPoint(sign*.42,.10,.28));
    const worldRest=this.model.getWorldQuaternion(new THREE.Quaternion()).multiply(this.rig.feet[side]);const q=foot.getWorldQuaternion(new THREE.Quaternion()).slerp(worldRest,this.sitBlend);setWorldQuaternion(foot,q);
   }
  }
  // The arm on the same side swings opposite to that leg, at the leg's actual phase.
  // This also keeps the hand-held fan outside the torso and thigh.
  if(!this.oneShot&&s.grounded){
   const inverse=this.model.matrixWorld.clone().invert();
   for(const [side,sign] of [['Left',1],['Right',-1]]){const foot=B[side+'Foot'].getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);const hand=B[side+'Hand'],original=hand.getWorldPosition(new THREE.Vector3());const swing=THREE.MathUtils.clamp((foot.z-.19)*-.65,-.085,.085);
    const walking=this.modelPoint(sign*.285,.29,.20+swing),seated=this.modelPoint(sign*.28,.20,.32),held=this.modelPoint(-.31,.48,.38);
    const target=this.modelPoint(sign*.285,.29,.20);target.lerp(walking,this.moveBlend);target.lerp(seated,this.sitBlend);
    if(side==='Right'&&this.fanEquipped)target.lerp(held,(1-this.moveBlend)*(1-this.sitBlend)*.85);

    solveLimb(B[side+'Arm'],B[side+'ForeArm'],hand,target,this.modelPoint(sign*.40,side==='Right'?THREE.MathUtils.lerp(.40,.32,this.moveBlend):.40,.18));if(this.standBlend>.01)setWorldQuaternion(hand,hand.getWorldQuaternion(new THREE.Quaternion()).slerp(this.model.getWorldQuaternion(new THREE.Quaternion()).multiply(this.handRest[side]),this.standBlend));
   }
  }
  this.root.updateMatrixWorld(true);this.rig.updateSleeveShape?.();
  const grip=B.RightHand.getWorldPosition(new THREE.Vector3());this.model.worldToLocal(grip);this.rig.fan.position.copy(grip).add(new THREE.Vector3(-.018,0,.018));const showFan=this.fanEquipped&&s.grounded&&!this.oneShot;this.rig.fan.visible=showFan;const openTarget=s.speed>.14?0:1;this.fanOpen+=(openTarget-this.fanOpen)*(1-Math.exp(-12*dt));this.rig.setFanOpen(this.fanOpen);this.rig.fan.rotation.set(.05,-.10+Math.sin(this.time*1.8)*.10*this.fanOpen,-.16*this.fanOpen);
  this.rig.updateExpression?.(this.time,dt,this.expression,this.meow>0);
  if(s.grounded){this.root.updateMatrixWorld(true);for(const skeleton of this.skeletons)skeleton.update();let bottom=Infinity;
   for(const {mesh,ids} of this.contacts)for(const i of ids){mesh.getVertexPosition(i,this.contactV).applyMatrix4(mesh.matrixWorld);bottom=Math.min(bottom,this.contactV.y-this.root.position.y);}
   if(Number.isFinite(bottom)){const correction=.008-bottom;this.model.position.y+=correction>0?correction:correction*(1-Math.exp(-30*dt));}
  }else this.model.position.y+=(this.baseY-this.model.position.y)*(1-Math.exp(-12*dt));
 }
}
