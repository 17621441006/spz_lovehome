import * as THREE from 'three';
export function finishGarmentDetail(model,rig){
 const {parts,bones}=rig,template=parts.get(0);
 const hidden=[4,40,12,23,25,17,27];hidden.forEach(id=>parts.get(id).visible=false);model.getObjectByName('left_wrist_fur').visible=false;
 // Rebuild each sleeve around the solved arm, not the imported raised-arm shape.
 const sleeves=[];const rows=18,cols=32;
 for(const side of ['Left','Right']){
  const g=new THREE.BufferGeometry(),positions=new Float32Array(((rows+1)*(cols+1)+1)*3),colors=[],uv=[],idx=[];
  const red=new THREE.Color('#ffffff'),cream=new THREE.Color('#ead9ab');
  for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){const c=red;colors.push(c.r,c.g,c.b);uv.push(.08+(k/cols)*.23,.24+(j/rows)*.57);if(j&&k){const n=j*(cols+1)+k;idx.push(n,n-cols-2,n-1,n,n-cols-1,n-cols-2);}}
  const capIndex=(rows+1)*(cols+1),bodyIndexCount=idx.length;colors.push(1,1,1);uv.push(.195,.24);for(let k=0;k<cols;k++)idx.push(capIndex,k+1,k);
  g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const fabric=parts.get(6).material.clone();fabric.userData={...parts.get(6).material.userData};fabric.vertexColors=true;fabric.side=THREE.DoubleSide;fabric.roughness=.96;for(let row=1;row<=rows;row++)g.addGroup((row-1)*cols*6,cols*6,row>=rows-1?1:0);g.addGroup(bodyIndexCount,cols*3,0);const cuff=new THREE.MeshStandardMaterial({color:'#ead9ab',roughness:.96,side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,[fabric,cuff]);mesh.name='natural_'+side+'_sleeve';mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;model.add(mesh);const capGeo=new THREE.SphereGeometry(1,24,16);capGeo.scale(.081,.075,.087);const cuv=capGeo.attributes.uv;for(let i=0;i<cuv.count;i++)cuv.setXY(i,.08+cuv.getX(i)*.23,.24+cuv.getY(i)*.57);const capMat=fabric.clone();capMat.vertexColors=false;capMat.userData={...fabric.userData};const cap=new THREE.Mesh(capGeo,capMat);cap.name='closed_'+side+'_shoulder';cap.castShadow=cap.receiveShadow=true;model.add(cap);sleeves.push({side,mesh,cap});
 }
 rig.updateSleeveMotion=()=>{};
 rig.updateSleeveShape=()=>{
  model.updateWorldMatrix(true,true);const inv=model.matrixWorld.clone().invert();
  hidden.forEach(id=>parts.get(id).visible=false);model.getObjectByName('left_wrist_fur').visible=false;
  for(const {side,mesh,cap}of sleeves){mesh.visible=!model.getObjectByName('red-robe')?.visible;
   const point=n=>bones[side+n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
   const a=point('Arm'),e=point('ForeArm'),h=point('Hand'),tip=e.clone().lerp(h,.94);cap.visible=mesh.visible;cap.position.copy(a);cap.position.x+=side==='Left'?-.025:.025;cap.position.y-=.008;
   const curve=new THREE.QuadraticBezierCurve3(a,e.clone().lerp(a.clone().lerp(tip,.5),.65),tip),frames=curve.computeFrenetFrames(rows,false),p=mesh.geometry.attributes.position;
   for(let j=0;j<=rows;j++){const t=j/rows,c=curve.getPoint(t),d=curve.getTangent(t).normalize();const u=frames.normals[j],v=frames.binormals[j];const radius=.067+.018*Math.sin(Math.PI*t)+.009*t;
    for(let k=0;k<=cols;k++){const angle=k/cols*Math.PI*2,fold=1+.025*Math.sin(angle*6)*Math.sin(t*Math.PI),q=c.clone().addScaledVector(u,Math.cos(angle)*radius*fold).addScaledVector(v,Math.sin(angle)*radius*fold);p.setXYZ(j*(cols+1)+k,q.x,q.y,q.z);}}
   p.setXYZ((rows+1)*(cols+1),a.x,a.y,a.z);p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
  }
 };
 const skeleton=rig.skeleton,index=n=>skeleton.bones.indexOf(bones[n]);
 function skin(g,m,name,weights){const ids=[],ws=[];for(let i=0;i<g.attributes.position.count;i++){const w=weights();ids.push(index(w[0]),index(w[1]),0,0);ws.push(w[2],1-w[2],0,0);}g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(ws,4));const mesh=new THREE.SkinnedMesh(g,m);mesh.name=name;mesh.bind(skeleton,template.bindMatrix);mesh.frustumCulled=false;mesh.castShadow=true;model.add(mesh);return mesh;}
 // Fur follows the existing cheek silhouette. Face landmarks and expression stay untouched.
 const g=template.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,pos=[],tex=[],ids=[];let seed=2881;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let k=0;k<1800;k++){const i=Math.floor(rand()*p.count),base=new THREE.Vector3().fromBufferAttribute(p,i);if(base.y<.65||base.y>.86||Math.abs(base.x+.02)<.11&&base.z>.16)continue;
  const normal=new THREE.Vector3().fromBufferAttribute(n,i).normalize(),flow=new THREE.Vector3(Math.sign(base.x+.02)*.65,-.75,-.08).normalize(),side=new THREE.Vector3().crossVectors(normal,flow).normalize(),width=.0015+rand()*.002,len=.009+rand()*.014,tip=base.clone().addScaledVector(flow,len).addScaledVector(normal,len*.18),j=pos.length/3;
  for(const q of [base.clone().addScaledVector(side,width),base.clone().addScaledVector(side,-width),tip]){pos.push(...q.toArray());tex.push(uv.getX(i),uv.getY(i));}ids.push(j,j+1,j+2);
 }
 const fur=new THREE.BufferGeometry();fur.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));fur.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));fur.setIndex(ids);fur.computeVertexNormals();const mat=template.material.clone();mat.userData={...template.material.userData};mat.side=THREE.DoubleSide;mat.roughness=1;mat.onBeforeCompile=template.material.onBeforeCompile;mat.customProgramCacheKey=template.material.customProgramCacheKey;skin(fur,mat,'flowing_cheek_fur',()=>['Head','Head',1]);
}
