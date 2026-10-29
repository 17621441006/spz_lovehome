import {loadGLB} from './asset-stream.js';
import * as THREE from 'three';
import {solveLimb,setWorldQuaternion} from './limb-ik.js';
import {XIAOYONG_RUN} from './xiaoyong-run.js';
import {dressXiaosi} from './xiaosi-style.js';
import {updateXiaosiWalk} from './xiaosi-walk.js';

export async function loadHumanCharacter(id){return new HumanCharacter(await loadGLB(`assets/characters/${id==='xiaosi'?'xiaosi-c':id}.glb`),id);}

export class HumanCharacter{
 constructor(gltf,id){
  this.id=id;this.root=new THREE.Group();this.model=gltf.scene;this.root.add(this.model);this.materials=[];this.bones={};this.skeletons=new Set();this.contacts=[];this.sitBlend=0;this.oneShot=null;this.cooldown=0;this.lieAmt=0;
  this.model.traverse(o=>{if(o.isBone)this.bones[o.name]=o;if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=.88;m.metalnessMap=null;m.roughnessMap=null;if(m.normalScale)m.normalScale.set(.5,.5);m.emissive=new THREE.Color('#fff3e0');m.emissiveMap=m.map;m.emissiveIntensity=.055;m.userData.forestGlow=.055;this.materials.push(m);}
   if(o.isSkinnedMesh){this.skeletons.add(o.skeleton);const ids=[],idx=o.geometry.attributes.skinIndex,w=o.geometry.attributes.skinWeight;for(let i=0;i<idx.count;i+=5){let total=0;for(let j=0;j<4;j++)if(/^(Left|Right)(Foot|Toe)$/.test(o.skeleton.bones[idx.getComponent(i,j)].name))total+=w.getComponent(i,j);if(total>.4)ids.push(i);}this.contacts.push({mesh:o,ids});}
  });
  if(id==='xiaosi')dressXiaosi(this);
  this.model.updateMatrixWorld(true);this.footRest={};this.toeRest={};this.hairRest=[];for(const b of Object.values(this.bones))if(b.name.startsWith('Hair'))this.hairRest.push([b,b.quaternion.clone()]);for(const side of ['Left','Right']){this.footRest[side]=this.bones[side+'Foot'].getWorldQuaternion(new THREE.Quaternion());this.toeRest[side]=this.bones[side+'Toe']?.quaternion.clone();}
  this.mixer=new THREE.AnimationMixer(this.model);this.actions={};this.pose=[];const clips=gltf.animations.map(c=>c.clone());
  // Xiaoyong's original file only contains a walking cycle. Retarget the existing
  // run into his bind axes/proportions instead of playing a fast walk indefinitely.
  if(id==='xiaoyong'&&!clips.some(c=>c.name==='mesh_run'))clips.push(new THREE.AnimationClip('mesh_run',XIAOYONG_RUN.duration,XIAOYONG_RUN.tracks.map(t=>new (t.name.endsWith('.quaternion')?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack)(t.name,XIAOYONG_RUN.times,t.values))));
  this.gaitRate=1;
  // Remove the retarget export's terminal bind-pose frame; close every track on its first key.
  if(id==='xiaoyong'){const run=clips.find(c=>c.name==='mesh_run');for(const t of run.tracks){const n=t.getValueSize();for(let k=0;k<n;k++)t.values[t.values.length-n+k]=t.values[k];}}
  this.gaitSpeed=id==='xiaosi'?{walk:1.0,mesh_run:3.3}:{walk:.55,mesh_run:3.65};
  // These gestures use the source upper-body motion over a standing lower body.
  // Seated hip/leg tracks are deliberately excluded rather than hovering in a chair pose.
  for(const [name,source]of [['stretch','seat_stretch'],['hug','hold_cat']]){const src=clips.find(c=>c.name===source),idle=clips.find(c=>c.name==='idle');if(src&&idle){const upper=n=>/^(Chest|Neck|Head|(?:Left|Right)(?:Clavicle|UpperArm|ForeArm|Hand))\./.test(n);const tracks=idle.tracks.filter(t=>!upper(t.name)).map(t=>t.clone()).concat(src.tracks.filter(t=>upper(t.name)).map(t=>t.clone()));clips.push(new THREE.AnimationClip(name,src.duration,tracks));}}
  for(const clip of clips){for(const t of clip.tracks){if(t.name==='Root.position'){for(let i=0;i<t.values.length;i+=3){t.values[i]=0;t.values[i+2]=0;if(clip.name==='hop')t.values[i+1]=0;}}}
   const a=this.mixer.clipAction(clip);if(['hop','mesh_kick','mesh_dance','stretch','hug'].includes(clip.name)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}this.actions[clip.name]=a;
  }
  this.mixer.addEventListener('finished',e=>{if(e.action===this.actions[this.oneShot]){this.oneShot=null;this.cooldown=.12;}});
  this.play('idle',0);this.mixer.update(0);for(const bone of Object.values(this.bones))this.pose.push({bone,p:bone.position.clone(),q:bone.quaternion.clone(),s:bone.scale.clone()});
 }
 get isPerforming(){return !!this.oneShot;}
 get actionQueueFull(){return this.isPerforming;}
 triggerAction(name){if(this.oneShot||this.cooldown>0||!['mesh_kick','mesh_dance','stretch','hug'].includes(name)||!this.actions[name])return false;this.oneShot=name;this.play(name,.16);return true;}
 play(name,fade=.22){if(this.state===name)return;const next=this.actions[name];if(!next)return;const old=this.actions[this.state],stride=['walk','mesh_run'];const phase=old&&stride.includes(name)&&stride.includes(this.state)?old.time/old.getClip().duration:null;next.reset().setEffectiveWeight(1).setEffectiveTimeScale(name==='mesh_kick'?1.25:1).play();if(phase!==null)next.time=phase*next.getClip().duration;if(old)old.crossFadeTo(next,fade,false);this.state=name;}
 land(){}
 doMeow(){}
 getHeadWorld(v=new THREE.Vector3()){return this.bones.Head.getWorldPosition(v);}
 modelPoint(x,y,z){return this.model.localToWorld(new THREE.Vector3(x,y,z));}
 update(dt,s){
  this.appearance?.update(dt);
  this.cooldown=Math.max(0,this.cooldown-dt);if(!s.grounded)this.oneShot=null;
  const moving=s.speed>.12,running=(s.running??s.speed>1.7)&&s.speed>.35,name=this.oneShot||(!s.grounded?'hop':moving?(running?'mesh_run':'walk'):(s.sitting||s.idle>=120)?'sit_idle':'idle');this.play(name);
  if(name==='walk'||name==='mesh_run'){const max=this.id==='xiaoyong'?(name==='walk'?6.2:6.4):(name==='walk'?4.14:1.6),target=THREE.MathUtils.clamp(s.speed/this.gaitSpeed[name],.30,max);this.gaitRate+=(target-this.gaitRate)*(1-Math.exp(-12*dt));this.actions[name].timeScale=this.gaitRate;}
  // The menu turns the parent toward the camera. Correct the model's local yaw
  // to the actual travel vector immediately, while the parent's turn eases out.
  // This prevents a newly selected avatar moonwalking through its first turn.
  const velocity=s.actualVelocity||s.vel;
  if(moving&&velocity&&Math.hypot(velocity.x,velocity.z)>.1){const angle=Math.atan2(velocity.x,velocity.z)-this.root.rotation.y;this.model.rotation.y=Math.atan2(Math.sin(angle),Math.cos(angle));}
  for(const p of this.pose){p.bone.position.copy(p.p);p.bone.quaternion.copy(p.q);p.bone.scale.copy(p.s);}this.mixer.update(dt);for(const p of this.pose){p.p.copy(p.bone.position);p.q.copy(p.bone.quaternion);p.s.copy(p.bone.scale);}
  if(this.id==='xiaosi')for(const [b,q]of this.hairRest)b.quaternion.slerp(q,.72);
  if(this.id==='xiaosi')updateXiaosiWalk(this,dt,name==='walk');
  this.sitBlend+=((name==='sit_idle'?1:0)-this.sitBlend)*(1-Math.exp(-7*dt));this.root.updateMatrixWorld(true);
  if(this.sitBlend>.01){const hips=this.bones.Hips,at=hips.getWorldPosition(new THREE.Vector3());const local=this.model.worldToLocal(at.clone());const desired=this.modelPoint(local.x,this.id==='xiaosi'?.14:.16,local.z);hips.parent.worldToLocal(desired);hips.position.y=THREE.MathUtils.lerp(hips.position.y,desired.y,this.sitBlend);this.root.updateMatrixWorld(true);
   for(const [side,sign]of [['Left',1],['Right',-1]]){const foot=this.bones[side+'Foot'],target=foot.getWorldPosition(new THREE.Vector3()).lerp(this.modelPoint(sign*.115,.078,this.id==='xiaosi'?.25:.48),this.sitBlend);solveLimb(this.bones[side+'UpperLeg'],this.bones[side+'LowerLeg'],foot,target,this.modelPoint(sign*.13,.65,.24));const rest=this.model.getWorldQuaternion(new THREE.Quaternion()).multiply(this.footRest[side]);setWorldQuaternion(foot,foot.getWorldQuaternion(new THREE.Quaternion()).slerp(rest,this.sitBlend));const toe=this.bones[side+'Toe'];if(toe&&this.toeRest[side])toe.quaternion.slerp(this.toeRest[side],this.sitBlend);
    // Keep the authored shoulder and wrist rotations. Only turn the forearm
    // slightly toward the knee; full arm IK introduced unwanted sleeve twist.
    const knee=this.bones[side+'LowerLeg'].getWorldPosition(new THREE.Vector3()),hand=this.bones[side+'Hand'],fore=this.bones[side+'ForeArm'],elbow=fore.getWorldPosition(new THREE.Vector3()),from=hand.getWorldPosition(new THREE.Vector3()).sub(elbow).normalize(),goal=knee.clone().add(new THREE.Vector3(0,.05,-.025)).sub(elbow).normalize();
    const q=fore.getWorldQuaternion(new THREE.Quaternion()),aim=new THREE.Quaternion().setFromUnitVectors(from,goal).multiply(q);setWorldQuaternion(fore,q.slerp(aim,this.sitBlend));}

  }
  this.root.updateMatrixWorld(true);for(const sk of this.skeletons)sk.update();
  if(s.grounded){let bottom=Infinity;const v=new THREE.Vector3();for(const {mesh,ids}of this.contacts)for(const i of ids){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);bottom=Math.min(bottom,v.y-this.root.position.y);}if(Number.isFinite(bottom)){const correction=.008-bottom;this.model.position.y+=correction>0?correction:correction*(1-Math.exp(-25*dt));}}
  else this.model.position.y+=(0-this.model.position.y)*(1-Math.exp(-12*dt));
 }
}
