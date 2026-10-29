import * as THREE from 'three';

// The source rigs have a single hand bone and pre-curled fingers. A small,
// seated-only corrective shape opens that curl without changing the GLB or arm.
// Positions and normals are prepared once; only hand vertices update at runtime.
export function prepareHandShape(actor,side,points){
 const hand=actor.bones[side+'Hand'],sign=side==='Left'?1:-1;
 const bounds=new THREE.Box3().setFromPoints(points),start=Math.max(0,bounds.min.y),length=bounds.max.y-start,parts=[];
 const shape=p=>{const q=p.clone(),u=THREE.MathUtils.smoothstep((p.y-start)/length,.12,.72);q.x=sign*(sign*p.x*(1-.36*u)-.004*u);q.y+=length*.13*u;return q;};
 actor.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const original=mesh.geometry,si=original.attributes.skinIndex,sw=original.attributes.skinWeight,indices=[];
  for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[si.getComponent(i,k)]===hand)w+=sw.getComponent(i,k);if(w>.65)indices.push({i,w});}
  if(!indices.length)return;
  const g=mesh.geometry=original.clone(),p=g.attributes.position,n=g.attributes.normal,toHand=hand.matrixWorld.clone().invert().multiply(mesh.matrixWorld),fromHand=toHand.clone().invert();
  const vertices=indices.map(({i,w})=>{const base=new THREE.Vector3().fromBufferAttribute(p,i),local=base.clone().applyMatrix4(toHand),target=shape(local).applyMatrix4(fromHand);target.lerp(base,1-THREE.MathUtils.smoothstep(w,.65,.98));return {i,base,target,local,weight:w,normal:new THREE.Vector3().fromBufferAttribute(n,i)};});
  for(const v of vertices)p.setXYZ(v.i,v.target.x,v.target.y,v.target.z);
  g.computeVertexNormals();
  for(const v of vertices)v.targetNormal=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,v.i);
  // Preserve all authored normals, including the face's corrected normals.
  g.attributes.normal.copy(original.attributes.normal);
  for(const v of vertices)p.setXYZ(v.i,v.base.x,v.base.y,v.base.z);
  const ranges=[];for(const {i}of vertices){const last=ranges.at(-1);if(last&&last.start+last.count===i*3)last.count+=3;else ranges.push({start:i*3,count:3});}
  parts.push({mesh,vertices,ranges});
 });
 const ring=side==='Left'?actor.appearance?.ring:null,ringBase=ring?.position.clone(),ringTarget=ringBase&&shape(ringBase);
 return {shape,parts,ring,ringBase,ringTarget,start,length,blend:0};
}

export function updateHandShape(data,blend){
 if(data.blend===blend)return;data.blend=blend;
 for(const {mesh,vertices,ranges}of data.parts){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  for(const v of vertices){const at=v.base.clone().lerp(v.target,blend),normal=blend===0?v.normal:v.normal.clone().lerp(v.targetNormal,blend).normalize();p.setXYZ(v.i,at.x,at.y,at.z);n.setXYZ(v.i,normal.x,normal.y,normal.z);}
  // Upload only changed hand spans. The two hands share a geometry, so preserve
  // the other hand's pending ranges until Three.js consumes them.
  for(const attribute of [p,n]){for(const range of ranges)if(!attribute.updateRanges.some(r=>r.start===range.start&&r.count===range.count))attribute.addUpdateRange(range.start,range.count);attribute.needsUpdate=true;}
 }
 if(data.ring)data.ring.position.copy(data.ringBase).lerp(data.ringTarget,blend);
}
