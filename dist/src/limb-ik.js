import * as THREE from 'three';
// Small two-bone IK helpers shared by the human characters.
const V=()=>new THREE.Vector3();
function aim(bone,child,target){const from=bone.getWorldPosition(V()),to=child.getWorldPosition(V()).sub(from).normalize(),desired=target.clone().sub(from).normalize();const dq=new THREE.Quaternion().setFromUnitVectors(to,desired);const q=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(dq);const pq=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(pq.multiply(q));bone.updateWorldMatrix(false,true);}
export function solveLimb(upper,lower,end,target,pole){
 const a=upper.getWorldPosition(V()),b=lower.getWorldPosition(V()),c=end.getWorldPosition(V()),l1=a.distanceTo(b),l2=b.distanceTo(c);const u=target.clone().sub(a),distance=THREE.MathUtils.clamp(u.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);u.normalize();const side=pole.clone().sub(a);side.addScaledVector(u,-side.dot(u)).normalize();const co=THREE.MathUtils.clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);const elbow=a.clone().addScaledVector(u,co*l1).addScaledVector(side,Math.sqrt(1-co*co)*l1);aim(upper,lower,elbow);aim(lower,end,a.clone().addScaledVector(u,distance));
}
export function setWorldQuaternion(bone,q){const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(q));bone.updateWorldMatrix(false,true);}
