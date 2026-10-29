import * as THREE from 'three';
import {setWorldQuaternion} from './limb-ik.js';
import {prepareHandShape,updateHandShape} from './seated-hand-shape.js';

const vec=()=>new THREE.Vector3();
const rotation=()=>new THREE.Quaternion();
const fingerDip=.025;

// Keep the authored shoulders and elbows. Fit the real palm thickness and knee
// surface once, then solve the forearm's reachable wrist height while sitting.
export function prepareSeatedHands(actor){
 actor.seatedHands={};actor.root.updateMatrixWorld(true);
 for(const [side,sign]of [['Left',1],['Right',-1]]){
  const hand=actor.bones[side+'Hand'],fore=actor.bones[side+'ForeArm'],knee=actor.bones[side+'LowerLeg'],kneeAt=knee.getWorldPosition(vec()),palms=[],knees=[];
  actor.model.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
   for(let i=0;i<si.count;i++){
    let handWeight=0,legWeight=0;
    for(let k=0;k<4;k++){const name=mesh.skeleton.bones[si.getComponent(i,k)].name,w=sw.getComponent(i,k);if(name===side+'Hand')handWeight+=w;if(name===side+'UpperLeg'||name===side+'LowerLeg')legWeight+=w;}
    if(handWeight>.95)palms.push(hand.worldToLocal(mesh.getVertexPosition(i,vec()).applyMatrix4(mesh.matrixWorld)));
    if(legWeight>.95&&mesh.getVertexPosition(i,vec()).applyMatrix4(mesh.matrixWorld).distanceTo(kneeAt)<.105)knees.push({mesh,index:i});
   }
  });
  const shape=prepareHandShape(actor,side,palms),relaxed=palms.map(p=>shape.shape(p));
  const box=new THREE.Box3().setFromPoints(relaxed),length=box.max.y,contact=relaxed.filter(p=>p.y>length*.25&&p.y<length*.60);
  const center=contact.reduce((v,p)=>v.add(p),vec()).multiplyScalar(1/contact.length);
  const norm=Math.hypot(1,fingerDip),palmBottom=Math.min(...contact.map(p=>(-sign*p.x-fingerDip*p.y)/norm));
  const stride=Math.max(1,Math.floor(knees.length/120));
  // The source left/right palms have different folds. These millimetre-scale
  // fits are checked against both palm-heel and palm-center skin, not a fingertip.
  actor.seatedHands[side]={hand,fore,knee,sign,center,contact,palmBottom,shape,surfaceOffset:actor.id==='xiaosi'?(side==='Left'?.004:-.001):(side==='Left'?-.010:-.001),handRest:hand.quaternion.clone(),knees:knees.filter((_,i)=>i%stride===0)};
 }
}

export function updateSeatedHands(actor,blend){
 const modelRotation=actor.model.getWorldQuaternion(rotation()),inverse=modelRotation.clone().invert(),weight=blend*blend*(3-2*blend);
 for(const data of Object.values(actor.seatedHands))updateHandShape(data.shape,blend<.01?0:weight);
 if(blend<.01)return;
 actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();
 for(const data of Object.values(actor.seatedHands)){
  const {hand,fore,knee,sign,center,palmBottom,handRest,knees,surfaceOffset}=data;
  const kneeAt=knee.getWorldPosition(vec()),elbow=fore.getWorldPosition(vec()),wrist=hand.getWorldPosition(vec()),authoredHand=hand.getWorldQuaternion(rotation()),length=elbow.distanceTo(wrist);
  let surface=0;const sample=vec();
  for(const {mesh,index}of knees){const p=mesh.getVertexPosition(index,sample).applyMatrix4(mesh.matrixWorld).sub(kneeAt).applyQuaternion(inverse);if(Math.abs(p.x)<.04&&p.z>-.06&&p.z<.06)surface=Math.max(surface,p.y);}
  // Local +Y points toward the fingers; the inward side of each source palm is
  // +/-X. Let the fingers follow the forearm's horizontal direction instead of
  // forcing both hands straight ahead and bending their wrists sideways.
  let heading=kneeAt.clone().sub(elbow).applyQuaternion(inverse);heading.y=0;heading.normalize();
  let handTarget,direction,height=surface-palmBottom+surfaceOffset;
  for(let fit=0;fit<3;fit++){
   const fingers=new THREE.Vector3(heading.x,-fingerDip,heading.z).normalize(),palm=new THREE.Vector3(0,-1,0).addScaledVector(fingers,fingers.y).normalize(),x=palm.clone().multiplyScalar(sign),z=x.clone().cross(fingers).normalize();
   const handLocal=rotation().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,fingers,z)),palmCenter=center.clone().applyQuaternion(handLocal);handTarget=modelRotation.clone().multiply(handLocal);
   const desired=kneeAt.clone().add(new THREE.Vector3(-palmCenter.x,height,-palmCenter.z).applyQuaternion(modelRotation)),delta=desired.sub(elbow).applyQuaternion(inverse);
   // Solve on the existing forearm-length sphere. This keeps contact height
   // without moving the upper arm or introducing an unstable arm-IK pole.
   const planar=Math.hypot(delta.x,delta.y),limit=length*.96;if(planar>limit){delta.x*=limit/planar;delta.y*=limit/planar;}
   delta.z=Math.sqrt(Math.max(0,length*length-delta.x*delta.x-delta.y*delta.y));
   direction=delta.normalize().applyQuaternion(modelRotation);
   heading.copy(direction).applyQuaternion(inverse);heading.y=0;heading.normalize();
  }
  const from=wrist.clone().sub(elbow).normalize(),authored=fore.getWorldQuaternion(rotation()),aim=rotation().setFromUnitVectors(from,direction).multiply(authored);
  // Share palm pronation along the forearm; making only the wrist turn ninety
  // degrees pinched its skin. Limit the roll and leave shoulder rotations alone.
  const desiredFore=handTarget.clone().multiply(handRest.clone().invert()),difference=desiredFore.multiply(aim.clone().invert());
  if(difference.w<0){difference.x*=-1;difference.y*=-1;difference.z*=-1;difference.w*=-1;}
  const along=difference.x*direction.x+difference.y*direction.y+difference.z*direction.z,twist=THREE.MathUtils.clamp(2*Math.atan2(along,difference.w),-Math.PI*.75,Math.PI*.75);
  aim.premultiply(rotation().setFromAxisAngle(direction,twist));setWorldQuaternion(fore,authored.slerp(aim,weight));
  // Blend once from the authored world pose; blending again from the corrected
  // forearm compounds rotation and makes the first sit-down frame snap.
  setWorldQuaternion(hand,authoredHand.slerp(handTarget,weight));
 }
}
