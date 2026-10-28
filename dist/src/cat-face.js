import * as THREE from 'three';

// Keep the accepted pre-expression face. Only the ponytail is repositioned.
export function finishCatFace(model,rig){
 if(rig.face)return;
 const {parts}=rig,head=parts.get(0);
 // The source ponytail grows sideways. Re-anchor the complete hair/ribbon cluster
 // at the rear crown and rotate its fall toward the back, preserving the tied roots.
 const oldRoot=new THREE.Vector3(.085,.854,.080),newRoot=new THREE.Vector3(-.014,.858,.028);
 const transform=new THREE.Matrix4().makeTranslation(newRoot.x,newRoot.y,newRoot.z)
  .multiply(new THREE.Matrix4().makeRotationY(1.08))
  .multiply(new THREE.Matrix4().makeTranslation(-oldRoot.x,-oldRoot.y,-oldRoot.z));
 for(const id of [2,29,32,38]){
  const mesh=parts.get(id);mesh.geometry.applyMatrix4(transform);
  mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 }
 // Loose ribbon tails were embedded in the skull; keep the tied crown band only.
 parts.get(29).visible=false;parts.get(32).visible=false;
 rig.face={head,expression:'default',hairRoot:newRoot.clone()};
}

export function updateCatExpression(rig){
 // Legacy saved moods must never re-enable the rejected face deformation.
 if(rig.face)rig.face.expression='default';
}
