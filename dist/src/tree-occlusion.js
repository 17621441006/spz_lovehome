import * as THREE from 'three';
// Per-instance material clones preserve snowfall/wind hooks and never fade unrelated trees.
export class TreeOcclusion{
 constructor(scene){this.scene=scene;this.entries=[];this.seen=new WeakSet();this.scanClock=0;this.ray=new THREE.Raycaster();this.delta=new THREE.Vector3();this.box=new THREE.Box3();}
 scan(){for(const root of this.scene.children){if(this.seen.has(root)||!(root.userData.treeAsset||root.userData.groveKind==='sakura'||root.userData.occludingTree))continue;this.seen.add(root);root.updateWorldMatrix(true,true);this.entries.push({root,box:new THREE.Box3().setFromObject(root),alpha:1,meshes:null});}}
 prepare(e){e.meshes??=[];e.known??=new WeakSet();e.root.traverse(o=>{if(!o.isMesh||e.known.has(o))return;e.known.add(o);const list=Array.isArray(o.material)?o.material:[o.material];o.material=list.map(m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;c.userData={...m.userData,occlusionAlphaTest:m.alphaTest,occlusionOpacity:m.opacity};c.transparent=true;c.depthWrite=false;c.opacity=m.opacity;return c;});if(!Array.isArray(list)||o.material.length===1)o.material=o.material[0];e.meshes.push({mesh:o,materials:Array.isArray(o.material)?o.material:[o.material]});});}
 update(dt,camera,target){this.scanClock-=dt;if(this.scanClock<=0){this.scan();for(const e of this.entries)if(e.meshes)this.prepare(e);this.scanClock=1;}
  const origin=camera.getWorldPosition(new THREE.Vector3()),distance=origin.distanceTo(target);this.ray.set(origin,this.delta.copy(target).sub(origin).normalize());this.ray.far=Math.max(.1,distance-.2);
  for(const e of this.entries){const hit=this.ray.ray.intersectBox(e.box,new THREE.Vector3()),blocked=e.box.containsPoint(origin)||(!!hit&&hit.distanceTo(origin)<distance-.2);const desired=blocked?.23:1;e.alpha+=(desired-e.alpha)*(1-Math.exp(-7*dt));if(Math.abs(e.alpha-desired)<.002)e.alpha=desired;if(e.alpha<.999&&!e.meshes)this.prepare(e);if(!e.meshes)continue;
   for(const {mesh,materials}of e.meshes)for(const m of materials){m.opacity=e.alpha*m.userData.occlusionOpacity;m.alphaTest=m.userData.occlusionAlphaTest*e.alpha;m.depthWrite=e.alpha>.98;}
  }
 }
}
