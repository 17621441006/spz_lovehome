// Fit the supplied reference on a private geometry copy. Keep the original GLB,
// UV atlas, bone weights and animation clips reusable in Blender.
export function fitXiaosiReference(root){
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const geometry=mesh.geometry.clone();geometry.computeBoundingBox();const looseHair=geometry.boundingBox.min.y>.8&&geometry.boundingBox.max.y<1.3,p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(looseHair){p.setXYZ(i,x*.88,y,z<-.12?-.12+(z+.12)*.68:z);continue;}
   const front=Math.max(0,Math.min(1,(z-.015)/.08)),lower=Math.exp(-Math.pow((y-1.22)/.065,2))*front,cheek=Math.exp(-Math.pow((Math.abs(x)-.075)/.042,2)-Math.pow((y-1.245)/.055,2))*front,upper=Math.max(0,Math.min(1,(y-1.34)/.16));
   p.setXYZ(i,x*(1+.12*lower),y+.016*Math.exp(-Math.pow((y-1.155)/.04,2))*front-.018*upper,z+.006*cheek);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 });
}
