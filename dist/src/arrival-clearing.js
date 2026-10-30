import * as THREE from 'three';
import {heightAt,trailEdge} from './terrain.js';
import {villageLaneDistance} from './village-routes.js';
import {rootPlacement} from './tree-grounding.js';

// One welcoming tree beside the crossroads. The actual tree asset supplies the
// bark, roots and canopy; only private vertex copies lean its upper silhouette.
export const ARRIVAL_CLEARING={tree:{x:-5.5,z:7.5,size:.76,yaw:.68},seat:{x:-4.4,z:8.0},radius:3.2};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=THREE.MathUtils.clamp;
function distanceToSolid(x,z,c,pad){
 if(c.floorOnly||c.type==='heightfield')return Infinity;
 if(c.type==='circle')return Math.hypot(x-c.x,z-c.z)-c.r-pad;
 if(c.type==='box')return Math.hypot(Math.max(c.minX-x,0,x-c.maxX),Math.max(c.minZ-z,0,z-c.maxZ))-pad;
 return Infinity;
}
function leanCrown(prototype){
 const tree=prototype.clone(true);tree.updateMatrixWorld(true);const p=V();
 tree.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();const pos=o.geometry.attributes.position,inv=o.matrixWorld.clone().invert();
  for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);const t=THREE.MathUtils.smoothstep(p.y,1.25,4.2);p.x-=.65*t;p.y-=.26*t;p.z*=1-.05*t;p.applyMatrix4(inv);pos.setXYZ(i,p.x,p.y,p.z);}
  pos.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();o.castShadow=o.receiveShadow=true;
 });return tree;
}
function stoneGeometry(){
 const g=new THREE.SphereGeometry(1,24,14),p=g.attributes.position,colors=[],base=new THREE.Color('#b6a996'),shade=new THREE.Color('#8b8174');
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ripple=1+.045*Math.sin(x*7+z*4)*Math.cos(z*8-y*3);
  p.setXYZ(i,x*.72*ripple,Math.min(.62,y)*.24,z*.49*ripple);
  const color=shade.clone().lerp(base,clamp((y+.5)/1.2,0,1));colors.push(color.r,color.g,color.b);
 }g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function rootGeometry(points){
 const curve=new THREE.CatmullRomCurve3(points),g=new THREE.TubeGeometry(curve,28,1,8,false),p=g.attributes.position,colors=[];
 for(let i=0;i<p.count;i++){const t=Math.floor(i/9)/28,c=curve.getPointAt(t),offset=V().fromBufferAttribute(p,i).sub(c),r=.115*(1-t)**.7+.009;offset.multiplyScalar(r);p.setXYZ(i,c.x+offset.x,c.y+offset.y*.58,c.z+offset.z);const shade=new THREE.Color('#82715a').lerp(new THREE.Color('#a18e70'),Math.max(0,offset.y/r));colors.push(shade.r,shade.g,shade.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function petalGeometry(){
 const positions=[0,0,0],indices=[];
 for(let i=0;i<=40;i++){const angle=i/40*Math.PI*2,r=.72+.28*Math.cos(angle*5);positions.push(Math.cos(angle)*r,Math.sin(angle)*r,.12*(1-r));if(i>0)indices.push(0,i,i+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function addFlowers(group,owned){
 const centers=[[-6.9,8.2],[-7.5,7.4],[-7.3,6.9],[-5.8,8.9],[-4.0,8.9]],points=[];
 for(const [j,[cx,cz]] of centers.entries())for(let i=0;i<8;i++){const a=i*2.399+j,r=.18+((i*17+j*7)%19)/19*.44,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
  if(trailEdge(x,z)<.25||villageLaneDistance(x,z)<3.2||Math.hypot(x-ARRIVAL_CLEARING.seat.x,z-ARRIVAL_CLEARING.seat.z)<.98)continue;
  points.push({x,z,y:heightAt(x,z),h:.15+((i*11+j*3)%13)/13*.14,color:j%3===0?'#e4bd96':j%3===1?'#f5e4be':'#d8c4d5'});
 }
 const stemGeo=new THREE.CylinderGeometry(.005,.007,1,5),stemMat=new THREE.MeshStandardMaterial({color:'#727b49',roughness:1}),petalGeo=petalGeometry(),petalMat=new THREE.MeshStandardMaterial({roughness:1,side:THREE.DoubleSide}),centerGeo=new THREE.SphereGeometry(1,7,5),centerMat=new THREE.MeshStandardMaterial({color:'#c39a50',roughness:1});
 const stems=new THREE.InstancedMesh(stemGeo,stemMat,points.length),heads=new THREE.InstancedMesh(petalGeo,petalMat,points.length),centersMesh=new THREE.InstancedMesh(centerGeo,centerMat,points.length),dummy=new THREE.Object3D();
 for(const [i,p] of points.entries()){
  dummy.position.set(p.x,p.y+p.h/2,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
  dummy.position.set(p.x,p.y+p.h,p.z);dummy.rotation.set(-Math.PI/2+.24*Math.sin(i),0,i*2.4);dummy.scale.setScalar(.055+(i%3)*.009);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);heads.setColorAt(i,new THREE.Color(p.color));
  dummy.position.y+=.006;dummy.rotation.set(0,0,0);dummy.scale.set(.014,.008,.014);dummy.updateMatrix();centersMesh.setMatrixAt(i,dummy.matrix);
 }
 stems.name='迎风树 · 疏朗野花茎';heads.name='迎风树 · 奶白杏粉花弧';centersMesh.name='迎风树 · 花心';group.add(stems,heads,centersMesh);owned.push(stemGeo,stemMat,petalGeo,petalMat,centerGeo,centerMat);return points;
}

export function buildArrivalClearing(scene,prototype,colliders){
 if(scene.userData.arrivalClearing)return scene.userData.arrivalClearing;
 if(!prototype?.high||!prototype?.far||!prototype?.roots?.length)throw new Error('迎风树需要已落地的真实双 LOD 树木原型');
 const def=ARRIVAL_CLEARING.tree,s=ARRIVAL_CLEARING.seat;
 if(trailEdge(def.x,def.z)<1.2||villageLaneDistance(def.x,def.z)<4.2)throw new Error('迎风树侵入步道或猫车通道');
 if(colliders.some(c=>c.top>heightAt(def.x,def.z)+.3&&distanceToSolid(def.x,def.z,c,.58)<0))throw new Error('迎风树位置已有实体');
 const root=new THREE.Group();root.name='初晴草甸 · 迎风树下';const owned=[],ownedColliders=[];
 const support=rootPlacement(prototype.roots,def.x,def.z,def.size,def.yaw),tree=new THREE.LOD();tree.addLevel(leanCrown(prototype.high),0);tree.addLevel(leanCrown(prototype.far),28);tree.position.set(def.x,support.y,def.z);tree.scale.setScalar(def.size);tree.rotation.y=def.yaw;tree.name='迎风树 · 偏冠';tree.userData.occludingTree=true;tree.userData.rootSupport=support.contact;tree.userData.rootSpread=support.spread;root.add(tree);
 root.updateMatrixWorld(true);const treeBounds=new THREE.Box3().setFromObject(tree);
 const trunk={type:'circle',x:def.x,z:def.z,r:.48,bottom:heightAt(def.x,def.z)-.15,top:treeBounds.max.y,noFloor:true,owner:'arrival-tree'};colliders.push(trunk);ownedColliders.push(trunk);
 const stoneG=stoneGeometry(),stoneM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),stone=new THREE.Mesh(stoneG,stoneM),ground=heightAt(s.x,s.z);
 stone.position.set(s.x,ground+.19,s.z);stone.name='迎风树 · 暖石坐点';stone.castShadow=stone.receiveShadow=true;root.add(stone);owned.push(stoneG,stoneM);
 const seatY=ground+.19+.62*.24;
 const solid={type:'circle',x:s.x,z:s.z,r:.66,bottom:ground-.06,top:seatY,owner:'arrival-seat'};colliders.push(solid);ownedColliders.push(solid);
 const bark=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});owned.push(bark);
 for(const points of [[[-5.5,7.5],[-5.68,7.9],[-5.88,8.4],[-6.3,8.7]],[[-5.5,7.5],[-5.95,7.25],[-6.55,7.1],[-6.95,6.9]]]){
  const curvePoints=points.map(([x,z],i)=>V(x,heightAt(x,z)+(i===0?.08:i===points.length-1?-.015:.025),z)),g=rootGeometry(curvePoints),mesh=new THREE.Mesh(g,bark);mesh.name='迎风树 · 顺坡细根';mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);owned.push(g);
 }
 const flowers=addFlowers(root,owned);scene.add(root);root.updateMatrixWorld(true);
 const seat={position:V(s.x,seatY,s.z),yaw:Math.atan2(-s.x,6-s.z),radius:1.75,approach:V(s.x+.95,heightAt(s.x+.95,s.z-.45),s.z-.45),ground,mesh:stone};
 const result={root,tree,seat,flowers,support,colliders:ownedColliders,dispose(){root.removeFromParent();tree.traverse(o=>{if(o.isMesh)o.geometry.dispose();});for(const item of owned)item.dispose();for(const c of ownedColliders){const i=colliders.indexOf(c);if(i>=0)colliders.splice(i,1);}if(scene.userData.arrivalClearing===result)delete scene.userData.arrivalClearing;}};
 scene.userData.arrivalClearing=result;return result;
}
