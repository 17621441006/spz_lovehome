import * as THREE from 'three';

// The C haircut is baked by prepare-xiaosi-c.py, retaining the face and UVs.
// Accessories are fitted in mesh bind space, then attached to the actual bones.
export function dressXiaosi(actor){
 let body;actor.model.traverse(o=>{if(o.isSkinnedMesh&&!body)body=o;});
 actor.root.updateMatrixWorld(true);
 const makeMat=(color,metalness=0,roughness=.6)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const gold=makeMat('#edb850',.72,.25),silver=makeMat('#e1e9ed',.8,.18),ivory=makeMat('#fff0d6',0,.85),hair=makeMat('#563727',0,.88);
 const diamond=new THREE.MeshPhysicalMaterial({color:'#effcff',metalness:.15,roughness:.05,clearcoat:1,clearcoatRoughness:.03,flatShading:true,emissive:'#c1e8ff',emissiveIntensity:.22});
 const group=(name)=>{const a=new THREE.Group();a.name=name;return a;};
 const mesh=(geo,mat,parent,position=[0,0,0])=>{const m=new THREE.Mesh(geo,mat);m.position.fromArray(position);m.castShadow=true;m.frustumCulled=false;parent.add(m);return m;};
 const tube=(points,r,mat,parent,closed=false)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)),closed),48,r,6,closed),mat,parent);
 // An identity bind-space group becomes bone-local without losing its fitted placement.
 const attach=(a,bone)=>{a.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(body.matrixWorld));bone.add(a);};

 // The original atlas/mesh has no clean shirt behind the long curls. Close that
 // small hidden area with a fitted, skinned back panel after the haircut.
 const panelP=[],panelI=[],panelJ=[],panelW=[],cols=24,rows=12;
 const boneIndex=name=>body.skeleton.bones.findIndex(b=>b.name===name);
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const v=j/rows,y=.74+v*.35,t=Math.PI/2+i/cols*Math.PI;
  const width=.150*(1-.55*THREE.MathUtils.smoothstep(v,.70,1));
  panelP.push(Math.sin(t)*width,y,-.020+Math.cos(t)*(.096-.025*v));
  const chest=THREE.MathUtils.smoothstep(y,.85,1.02);
  panelJ.push(boneIndex('Spine'),boneIndex('Chest'),0,0);panelW.push(1-chest,chest,0,0);
  if(i<cols&&j<rows){const n=j*(cols+1)+i;panelI.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
 }
 const panelGeo=new THREE.BufferGeometry();panelGeo.setAttribute('position',new THREE.Float32BufferAttribute(panelP,3));panelGeo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(panelJ,4));panelGeo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(panelW,4));panelGeo.setIndex(panelI);panelGeo.computeVertexNormals();
 const cloth=makeMat('#102653',0,.92);cloth.side=THREE.DoubleSide;
 const panel=new THREE.SkinnedMesh(panelGeo,cloth);panel.name='齐肩发下的完整衣背';panel.bind(body.skeleton,body.bindMatrix);panel.frustumCulled=false;panel.castShadow=true;body.parent.add(panel);

 const halfUp=group('小司 · C款半扎齐肩微卷');
 // Narrow swept sections meet above the nape, with a small ponytail over the loose curls.
 for(const sign of [-1,1])for(let i=0;i<3;i++){
  const y=1.355+i*.014;
  tube([[sign*.16,y,-.145],[sign*.135,y+.017,-.22],[.065,1.415+i*.004,-.255],[.08,1.405,-.265]],.0045,hair,halfUp);
 }
 for(let i=0;i<9;i++){
  const x=.08+(i-4)*.007;
  const mat=makeMat(['#674733','#73503a','#5f402f'][i%3],0,.88);
  tube([[.08,1.41,-.265],[x+.014,1.39,-.30],[x+.025*Math.sin(i),1.32,-.302],[x-.008,1.25,-.285]],.007,mat,halfUp);
 }
 const bow=group('象牙色半扎发带');bow.position.set(.082,1.417,-.283);halfUp.add(bow);
 for(const s of [-1,1]){
  tube([[s*.009,0,0],[s*.037,.021,-.008],[s*.057,.006,-.006],[s*.033,-.011,0],[s*.009,0,0]],.006,ivory,bow);
  tube([[s*.008,-.006,0],[s*.016,-.040,-.010],[s*.031,-.079,-.008]],.006,ivory,bow);
 }
 mesh(new THREE.SphereGeometry(.009,16,12),ivory,bow).scale.set(.75,1,1);
 halfUp.position.z=.115;
 attach(halfUp,actor.bones.Head);

 const necklace=group('金叶项链');
 const chain=[];
 for(let i=0;i<=64;i++){
  const t=i/64*Math.PI*2,front=Math.max(0,Math.cos(t));
  chain.push([Math.sin(t)*.064,1.110-front*.058,Math.cos(t)*.046+.007+front*.010]);
 }
 tube(chain,.0020,gold,necklace,true);
 const leafShape=new THREE.Shape();leafShape.moveTo(0,.014);leafShape.bezierCurveTo(.017,.003,.012,-.012,0,-.022);leafShape.bezierCurveTo(-.012,-.008,-.015,.006,0,.014);
 const leaf=mesh(new THREE.ExtrudeGeometry(leafShape,{depth:.003,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,steps:1}),gold,necklace,[0,1.035,.067]);leaf.rotation.z=-.18;
 tube([[0,1.052,.066],[0,1.025,.071]],.0011,makeMat('#fff0a1',.6,.2),necklace);
 attach(necklace,actor.bones.Chest);

 const ring=group('璀璨 · 椭圆钻戒');ring.position.set(.251,.636,.043);ring.rotation.z=.13;
 const band=mesh(new THREE.TorusGeometry(.008,.0013,8,32),silver,ring);band.rotation.x=Math.PI/2;
 const gemP=[],gemI=[],segments=16;
 for(const [radius,z]of [[.60,.005],[1,.001],[.82,-.001],[.12,-.006]])for(let i=0;i<segments;i++){
  const t=i/segments*Math.PI*2;gemP.push(Math.cos(t)*.0075*radius,Math.sin(t)*.0105*radius,z);
 }
 for(let j=0;j<3;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;gemI.push(a,b,a+segments,b,b+segments,a+segments);}
 for(let i=1;i<segments-1;i++)gemI.push(0,i,i+1);
 const gemGeo=new THREE.BufferGeometry();gemGeo.setAttribute('position',new THREE.Float32BufferAttribute(gemP,3));gemGeo.setIndex(gemI);gemGeo.computeVertexNormals();
 const stone=mesh(gemGeo,diamond,ring,[0,0,.012]);
 for(const sx of [-1,1])for(const sy of [-1,1])mesh(new THREE.SphereGeometry(.0013,8,6),silver,ring,[sx*.0054,sy*.0073,.016]);
 for(let i=-3;i<=3;i++){
  const t=i*.29,gem=mesh(new THREE.OctahedronGeometry(.0014,0),diamond,ring,[Math.sin(t)*.0085,0,Math.cos(t)*.0085]);gem.rotation.y=t;
 }
 const sparkleMat=new THREE.MeshBasicMaterial({color:'#fff8dd',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const starShape=new THREE.Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.13:1,x=Math.cos(a)*r,y=Math.sin(a)*r;if(!i)starShape.moveTo(x,y);else starShape.lineTo(x,y);}starShape.closePath();
 const glint=mesh(new THREE.ShapeGeometry(starShape),sparkleMat,ring,[.002,.005,.022]);glint.scale.setScalar(.016);glint.castShadow=false;
 attach(ring,actor.bones.LeftHand);
 let elapsed=0;
 actor.appearance={hair:halfUp,necklace,ring,stone,glint,hairTriangles:34675,update(dt){
  elapsed+=dt;const t=elapsed%4.8;
  const pulse=Math.pow(Math.max(0,1-Math.abs(t-1.2)/.40),2)+.65*Math.pow(Math.max(0,1-Math.abs(t-1.76)/.22),2);
  sparkleMat.opacity=pulse*.95;glint.scale.setScalar(.010+pulse*.015);glint.rotation.z=elapsed*.24;diamond.emissiveIntensity=.18+pulse*.70;
 }};
 return actor.appearance;
}
