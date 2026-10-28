import * as THREE from 'three';
export function cameraBasis(camera,forward,right){
 camera.getWorldDirection(forward);forward.y=0;
 if(forward.lengthSq()<1e-8)forward.set(0,0,-1);else forward.normalize();
 right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
}
export function removeReverseInertia(velocity,direction){const backwards=velocity.dot(direction);if(backwards<0)velocity.addScaledVector(direction,-backwards);}
