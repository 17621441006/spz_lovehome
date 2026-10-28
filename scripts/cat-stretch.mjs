// Per-triangle edge stretch (current / bind) over all clips; prints worst meshes.
import {THREE} from './headless.mjs';
const {loadModelCat}=await import('../dist/src/modelcat.js');
const cat=await loadModelCat('assets/cat-rig.glb',1);
const meshes=[];cat.model.traverse(o=>{if(o.isSkinnedMesh&&o.visible)meshes.push(o)});const V=[0,1,2].map(()=>new THREE.Vector3());
const bind=new Map();for(const m of meshes){const p=m.geometry.attributes.position,ix=m.geometry.index,L=[];const A=new THREE.Vector3(),B=new THREE.Vector3();for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){A.fromBufferAttribute(p,ix.getX(i+k));B.fromBufferAttribute(p,ix.getX(i+(k+1)%3));L.push(A.distanceTo(B));}bind.set(m,L);}
const worstAll=new Map();
function measure(tag){cat.root.updateMatrixWorld(true);for(const s of cat.skeletons)s.update();const res=[];for(const m of meshes){const ix=m.geometry.index,L=bind.get(m);let w=0;for(let i=0;i<ix.count;i+=3){for(let k=0;k<3;k++)m.getVertexPosition(ix.getX(i+k),V[k]);for(let k=0;k<3;k++){const b=L[i+k];if(b>.003)w=Math.max(w,V[k].distanceTo(V[(k+1)%3])/b);}}res.push([m.name,w]);if(w>(worstAll.get(m.name)?.[0]||0))worstAll.set(m.name,[w,tag]);}return res;}
const run=(s,n,tag,every=3)=>{for(let i=0;i<n;i++){cat.update(1/60,{grounded:true,vy:0,idle:0,speed:0,...s});if(i%every===0)measure(tag);}};
run({},90,'wait');run({speed:1.35},60,'walk');run({speed:3.2},60,'run');run({idle:9},240,'sit',10);run({},60,'wait');
cat.triggerAction('front_kick_01');run({},50,'kick1',2);cat.triggerAction('front_kick_02');run({},60,'kick2',2);
cat.setFanEquipped(true);run({},90,'fan');run({grounded:false,vy:3},30,'jump');run({grounded:false,vy:-3},30,'fall');
const list=[...worstAll].sort((a,b)=>b[1][0]-a[1][0]).slice(0,10).map(([n,[w,t]])=>`${n}:${w.toFixed(2)}@${t}`);
console.log(list.join('\n'));
