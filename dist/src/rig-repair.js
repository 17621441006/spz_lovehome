import * as THREE from 'three';
import {finishGarmentDetail} from './garment-detail.js';
import {finishCatAppearance} from './cat-appearance.js';
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const V=()=>new THREE.Vector3();
export function repairRig(model){
 const parts=new Map(),bones={};model.traverse(o=>{if(o.isSkinnedMesh)parts.set(Number(o.name.replace('tripo_part_','')),o);if(o.isBone)bones[o.name.replace('mixamorig','')]=o;});
 const template=parts.get(0),skeleton=template.skeleton;
 const index=name=>skeleton.bones.indexOf(bones[name]);
 function rigid(mesh,bone){mesh.geometry=mesh.geometry.clone();const n=mesh.geometry.attributes.position.count;const ids=new Uint16Array(n*4),w=new Float32Array(n*4);for(let i=0;i<n;i++){ids[i*4]=index(bone);w[i*4]=1;}mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(w,4));}
 // Keep the face, ear, whisker and ponytail on the skull. Original automatic weights
 // stretched these rigid features across neck/shoulder/finger bones.
 for(const id of [0,2,29,32,38,44,48,51])if(parts.has(id))rigid(parts.get(id),'Head');
 for(const id of [17,27])rigid(parts.get(id),'Hips');
 rigid(parts.get(7),'RightForeArm');
 // The lower part of the imported 'head' is actually a chest bib. Skin it to
 // the chest so the stabilized skull cannot pull it out through the collar.
 const hp=parts.get(0).geometry.attributes.position, hi=parts.get(0).geometry.attributes.skinIndex, hw=parts.get(0).geometry.attributes.skinWeight;
 for(let i=0;i<hp.count;i++){const chest=(1-smooth(.55,.65,hp.getY(i)))*(1-smooth(.085,.14,Math.abs(hp.getX(i)+.015)));const headWeight=1-chest;hi.setXYZW(i,index('Head'),index('Spine2'),0,0);hw.setXYZW(i,headWeight,1-headWeight,0,0);if(headWeight<1){const z=hp.getZ(i),maxZ=.300+.035*headWeight;hp.setZ(i,z>maxZ?z-(z-maxZ)*.88*chest:z);}}
 // The ivory lapels and red chest panels were assigned to hips/shoulders by
 // the auto-rigger. Torso-only weights keep the neckline flush while running.
 for(const id of [6,19,20,33]){const mesh=parts.get(id);mesh.geometry=mesh.geometry.clone();const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++){const chest=smooth(.405,.535,p.getY(i));si.setXYZW(i,index('Spine1'),index('Spine2'),0,0);sw.setXYZW(i,0,1,0,0);}}
 // No finger/neck/hip influences on either sleeve: they caused local creases
 // to balloon when the hands crossed the torso. Preserve only the arm chain.
 for(const [side,ids] of [['Left',[4,40]],['Right',[12,23,25]]]){for(const id of ids){const mesh=parts.get(id);mesh.geometry=mesh.geometry.clone();const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++){let arm=0,fore=0;for(let j=0;j<4;j++){const n=skeleton.bones[si.getComponent(i,j)].name;if(n.endsWith(side+'Arm'))arm+=sw.getComponent(i,j);if(n.endsWith(side+'ForeArm'))fore+=sw.getComponent(i,j);}const total=arm+fore;arm=total>.001?arm/total:smooth(.42,.55,p.getY(i));si.setXYZW(i,index(side+'Arm'),index(side+'ForeArm'),0,0);sw.setXYZW(i,arm,1-arm,0,0);const cx=side==='Left'?.235:-.263;p.setX(i,cx+(p.getX(i)-cx)*.89);}mesh.geometry.computeVertexNormals();}}
 const head=parts.get(0).geometry,p=head.attributes.position;
 for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const crown=smooth(.55,.67,y)*(1-smooth(.84,.9,y));const back=1-smooth(.08,.21,z);z-=.075*back*crown;x=-.035+(x+.035)*(1+.025*crown);y+=.012*crown*(1-smooth(.22,.34,z));p.setXYZ(i,x,y,z);}head.computeVertexNormals();head.computeBoundingBox();head.computeBoundingSphere();
 // A tail is not a leg: remove leg/foot influences, and lift it gently for floor sitting.
 const tail=parts.get(1);rigid(tail,'Hips');const tp=tail.geometry.attributes.position,delta=new Float32Array(tp.count*3);for(let i=0;i<tp.count;i++)delta[i*3+1]=.22*smooth(.02,-.43,tp.getZ(i));tail.geometry.morphTargetsRelative=true;tail.geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(delta,3)];tail.updateMorphTargets();
 // The imported robe is several open, single-sided fragments. Close the body behind
 // them with skinned volumes; keep the original textured collar/sleeves outside.
 const patches=[];
 function volume(name,center,radii,bone,color,fur=false){const g=new THREE.SphereGeometry(1,32,24);g.scale(...radii);g.translate(...center);const n=g.attributes.position.count,ids=new Uint16Array(n*4),w=new Float32Array(n*4);for(let i=0;i<n;i++){ids[i*4]=index(bone);w[i*4]=1;}g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(w,4));const m=new THREE.MeshStandardMaterial({color,roughness:.95,metalness:0,side:THREE.DoubleSide});if(fur){const col=[];for(let i=0;i<n;i++){const py=g.attributes.position.getY(i),pz=g.attributes.position.getZ(i);const c=new THREE.Color('#c9843c').lerp(new THREE.Color('#f5e8c9'),smooth(.16,.28,pz)*smooth(.35,.48,py));col.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));m.color.set('#ffffff');m.map=template.material.map;m.userData={...template.material.userData};const uv=g.attributes.uv;for(let i=0;i<n;i++){const px=g.attributes.position.getX(i),py=g.attributes.position.getY(i);uv.setXY(i,.64+(px-center[0]+radii[0])/(2*radii[0])*.15,(name==='chest_fur_fill'?.735:.72)-(py-center[1]+radii[1])/(2*radii[1])*(name==='chest_fur_fill'?.09:.14));}}
 const mesh=new THREE.SkinnedMesh(g,m);mesh.name=name;mesh.bind(skeleton,template.bindMatrix.clone());mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;model.add(mesh);patches.push(mesh);return mesh;}
 const innerTorso=volume('robe_inner_torso',[-.012,.405,.178],[.155,.155,.137],'Spine1','#9a3025');
 // The hidden red liner must stay behind the original chest bib, including
 // its narrower upper edge. A round liner previously poked through the fur.
 const liner=innerTorso.geometry.attributes.position;for(let i=0;i<liner.count;i++){const w=smooth(.42,.47,liner.getY(i));liner.setZ(i,Math.min(liner.getZ(i),THREE.MathUtils.lerp(.32,.25,w)));}innerTorso.geometry.computeVertexNormals();
 volume('robe_inner_haunch',[-.012,.265,.145],[.178,.110,.148],'Hips','#a83e27');
 volume('chest_fur_fill',[-.015,.475,.222],[.113,.119,.073],'Spine2','#ffffff',true);
 // Close the torn left paw and remove paper-like finger shards from the auto-rig.
 parts.get(8).visible=false;parts.get(11).visible=false;
 volume('left_wrist_fur',[.242,.392,.18],[.054,.065,.055],'LeftForeArm','#ffffff',true);
 volume('left_closed_paw',[.285,.306,.17],[.052,.063,.058],'LeftHand','#ffffff',true);
 volume('right_closed_paw',[-.251,.531,.475],[.038,.039,.04],'RightHand','#ffffff',true);
 for(const mesh of parts.values()){const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const m of mats)m.side=THREE.DoubleSide;}
 // Replace all shattered paper fragments with a single rigid, ribbed folding fan.
 const oldFan=[21,30,34,35,37,39,41,42,50];oldFan.forEach(id=>{if(parts.has(id))parts.get(id).visible=false;});
 const fan=new THREE.Group();fan.name='rigid_paper_fan';const pos=[],colors=[],indices=[],segments=12,R=.270,inner=.028;
 const colorA=new THREE.Color('#f5e6c1'),colorB=new THREE.Color('#d5c19a');
 for(let i=0;i<=segments;i++){const a=-1.03+2.06*i/segments,z=i%2?.008:-.008,c=i%2?colorB:colorA;pos.push(Math.sin(a)*inner,Math.cos(a)*inner,0,Math.sin(a)*R,Math.cos(a)*R,z);colors.push(c.r,c.g,c.b,c.r,c.g,c.b);if(i<segments){const j=i*2;indices.push(j,j+1,j+3,j,j+3,j+2);}}
 const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));fg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));fg.setIndex(indices);fg.computeVertexNormals();fan.add(new THREE.Mesh(fg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide})));
 const ribs=[];const ribMat=new THREE.MeshStandardMaterial({color:'#795030',roughness:.9});for(let i=0;i<=segments;i++){const a=-1.03+2.06*i/segments;const rib=new THREE.Mesh(new THREE.CylinderGeometry(.002,.003,R,5),ribMat);rib.position.set(Math.sin(a)*R/2,Math.cos(a)*R/2,.009);rib.rotation.z=-a;fan.add(rib);ribs.push(rib);}const grip=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.055,8),ribMat);grip.position.y=-.017;fan.add(grip);
 model.updateMatrixWorld(true);fan.position.set(-.268,.55,.49);model.add(fan);model.updateMatrixWorld(true);// Keep the paper rigid in a controlled outward-facing frame; its grip follows the hand.
 fan.traverse(o=>{if(o.isMesh)o.castShadow=true;});
 const feet={};for(const side of ['Left','Right'])feet[side]=bones[side+'Foot'].getWorldQuaternion(new THREE.Quaternion());
 fan.visible=false;
 const setFanOpen=(open)=>{const spread=.035+.965*THREE.MathUtils.clamp(open,0,1),p=fg.attributes.position;for(let i=0;i<=segments;i++){const a=(-1.03+2.06*i/segments)*spread;p.setXYZ(i*2,Math.sin(a)*inner,Math.cos(a)*inner,0);p.setXYZ(i*2+1,Math.sin(a)*R,Math.cos(a)*R,(i%2?.008:-.008)*spread);ribs[i].position.set(Math.sin(a)*R/2,Math.cos(a)*R/2,.009);ribs[i].rotation.z=-a;}p.needsUpdate=true;fg.computeVertexNormals();fg.computeBoundingSphere();};
 const rig={parts,bones,skeleton,patches,fan,tail,feet,setFanOpen};finishCatAppearance(model,rig);finishGarmentDetail(model,rig);return rig;
}
function aim(bone,child,target){const from=bone.getWorldPosition(V()),to=child.getWorldPosition(V()).sub(from).normalize(),desired=target.clone().sub(from).normalize();const dq=new THREE.Quaternion().setFromUnitVectors(to,desired);const q=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(dq);const pq=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(pq.multiply(q));bone.updateWorldMatrix(false,true);}
export function solveLimb(upper,lower,end,target,pole){
 const a=upper.getWorldPosition(V()),b=lower.getWorldPosition(V()),c=end.getWorldPosition(V()),l1=a.distanceTo(b),l2=b.distanceTo(c);const u=target.clone().sub(a),distance=THREE.MathUtils.clamp(u.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);u.normalize();const side=pole.clone().sub(a);side.addScaledVector(u,-side.dot(u)).normalize();const co=THREE.MathUtils.clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);const elbow=a.clone().addScaledVector(u,co*l1).addScaledVector(side,Math.sqrt(1-co*co)*l1);aim(upper,lower,elbow);aim(lower,end,a.clone().addScaledVector(u,distance));
}
export function setWorldQuaternion(bone,q){const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(q));bone.updateWorldMatrix(false,true);}
