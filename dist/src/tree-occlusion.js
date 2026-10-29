import * as THREE from 'three';

// A bounding box is only a broad-phase test. Visibility is decided by real
// triangles on nine finite camera → body segments, never the view direction alone.
export class TreeOcclusion {
 constructor(scene){this.scene=scene;this.entries=[];this.seen=new WeakSet();this.scanClock=0;this.sampleClock=0;this.ray=new THREE.Raycaster();this.coverage=0;this.hidden=false;this.blockTime=0;}
 scan(){
  const visit=root=>{if(root.userData.treeAsset||root.userData.groveKind==='sakura'||root.userData.occludingTree){if(!this.seen.has(root)){this.seen.add(root);root.updateWorldMatrix(true,true);this.entries.push({root,box:new THREE.Box3().setFromObject(root),alpha:1,desired:1,meshes:null});}return;}for(const child of root.children)visit(child);};visit(this.scene);
 }
 prepare(e){e.meshes??=[];e.known??=new WeakSet();e.root.traverse(o=>{if(!o.isMesh||e.known.has(o))return;e.known.add(o);const array=Array.isArray(o.material),list=array?o.material:[o.material];const mats=list.map(m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;c.userData={...m.userData,occlusionAlphaTest:m.alphaTest,occlusionOpacity:m.opacity,occlusionTransparent:m.transparent,occlusionDepthWrite:m.depthWrite};return c;});o.material=array?mats:mats[0];e.meshes.push({mesh:o,materials:mats});});}
 measure(camera,head,feet,dt){
  const origin=camera.getWorldPosition(new THREE.Vector3()),right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);right.y=0;right.normalize();
  const base=feet?.clone()||head.clone().add(new THREE.Vector3(0,-1.05,0));
  const samples=[];for(const h of [.35,.67,.98])for(const x of [-.22,0,.22])samples.push(base.clone().lerp(head,h).addScaledVector(right,x));
  const counts=new Map();let blocked=0;
  for(const target of samples){const distance=origin.distanceTo(target);if(distance<.3)continue;this.ray.set(origin,target.clone().sub(origin).normalize());this.ray.near=.04;this.ray.far=distance-.12;const hits=[];
   for(const e of this.entries){const broad=this.ray.ray.intersectBox(e.box,new THREE.Vector3());if(!e.box.containsPoint(origin)&&(!broad||broad.distanceTo(origin)>this.ray.far))continue;
    let nearest=Infinity;
    e.root.traverseVisible(mesh=>{if(!mesh.isMesh)return;const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(mats.every(m=>(m.userData.occlusionOpacity??m.opacity)<.1))return;const sides=mats.map(m=>m.side);mats.forEach(m=>m.side=THREE.DoubleSide);const out=[];mesh.raycast(this.ray,out);mats.forEach((m,i)=>m.side=sides[i]);if(out.length)nearest=Math.min(nearest,...out.map(h=>h.distance));});
    if(Number.isFinite(nearest))hits.push(e);
   }
   if(hits.length){blocked++;for(const e of hits)counts.set(e,(counts.get(e)||0)+1);}
  }
  this.coverage=blocked/9;
  this.blockTime=blocked>=7?this.blockTime+dt:0;
  if(this.blockTime>=.16)this.hidden=true;
  if(blocked<=4)this.hidden=false;
  for(const e of this.entries)e.desired=this.hidden&&(counts.get(e)||0)>=2?.26:1;
 }
 update(dt,camera,head,feet){
  this.scanClock-=dt;if(this.scanClock<=0){this.scan();for(const e of this.entries){if(e.meshes)this.prepare(e);e.box.setFromObject(e.root);}this.scanClock=1;}
  this.sampleClock+=dt;if(this.sampleClock>=.12){this.measure(camera,head,feet,this.sampleClock);this.sampleClock=0;}
  for(const e of this.entries){e.alpha+=(e.desired-e.alpha)*(1-Math.exp(-(e.desired<1?8:5)*dt));if(Math.abs(e.alpha-e.desired)<.002)e.alpha=e.desired;if(e.alpha<.999&&!e.meshes)this.prepare(e);if(!e.meshes)continue;
   for(const {materials}of e.meshes)for(const m of materials){const faded=e.alpha<.999,transparent=faded||m.userData.occlusionTransparent;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}m.opacity=e.alpha*m.userData.occlusionOpacity;m.alphaTest=m.userData.occlusionAlphaTest*(faded?.35:1);m.depthWrite=faded?false:m.userData.occlusionDepthWrite;}
  }
 }
}
