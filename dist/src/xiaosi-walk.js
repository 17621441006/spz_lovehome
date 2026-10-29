import * as THREE from 'three';
import {solveLimb,setWorldQuaternion} from './limb-ik.js';

// One full gait cycle covers 1.2m. The old 0.43m/s calibration played its
// tiny-step cycle almost four times as fast; this keeps travel speed unchanged.
export function updateXiaosiWalk(actor,dt,active){
 actor.walkBlend??=0;actor.walkBlend+=((active?1:0)-actor.walkBlend)*(1-Math.exp(-9*dt));const blend=actor.walkBlend;if(blend<.002)return;
 const phase=actor.actions.walk.time/actor.actions.walk.getClip().duration,angle=phase*Math.PI*2,hips=actor.bones.Hips;
 hips.position.y-=blend*(.065+.008*Math.cos(angle*2));
 actor.root.updateMatrixWorld(true);
 const hip=actor.model.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
 for(const [side,sign,offset]of [['Left',1,0],['Right',-1,.5]]){
  const f=(phase+offset)%1,stance=.54,span=.648;let z,lift,pitch;
  if(f<stance){const t=f/stance;z=span*(.5-t);lift=0;pitch=THREE.MathUtils.lerp(-.09,.15,THREE.MathUtils.smoothstep(t,.65,1));}
  else{const t=(f-stance)/(1-stance),s=t*t*(3-2*t),m=-span/stance*(1-stance);z=-span/2+span*s+m*(2*t*t*t-3*t*t+t);lift=.085*Math.pow(Math.sin(Math.PI*t),1.4);pitch=-.12*Math.sin(Math.PI*t);}
  const foot=actor.bones[side+'Foot'],target=foot.getWorldPosition(new THREE.Vector3()).lerp(actor.modelPoint(sign*.057,.084+lift,hip.z+z),blend);
  solveLimb(actor.bones[side+'UpperLeg'],actor.bones[side+'LowerLeg'],foot,target,actor.modelPoint(sign*.075,.43,.45));
  const rest=actor.model.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch)).multiply(actor.footRest[side]);
  setWorldQuaternion(foot,foot.getWorldQuaternion(new THREE.Quaternion()).slerp(rest,blend));
  // Preserve the authored upper-body track. Hand-target IK twists the shoulder
  // skin and folds the sleeve when its pole crosses the bind-pose elbow plane.

 }
}
