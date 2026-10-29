import * as THREE from 'three';
import {LAYOUT,heightAt} from './terrain.js';
import {createCanopySurface} from './canopy-surface.js';
import {carveGeometry} from './geometry-carve.js';

export function createElderSanctuary(scene,tree,colliders){
 const {x,z}=LAYOUT.elder,ground=heightAt(x,z),hallZ=z+.8,deckY=ground+16.8;
 const hall=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2,nx=Math.cos(a),nz=Math.sin(a);hall.push([nx,0,nz,-nx*x-nz*hallZ-2.23]);}hall.push([0,1,0,-ground-3.55],[0,-1,0,ground-1]);
 // East-facing arched entrance, aligned with the existing bridge.
 const door=[[-1,0,0,x],[1,0,0,-x-7],[0,-1,0,ground-1],[0,0,1,-z-1.32],[0,0,-1,z-1.32]];
 for(let i=0;i<=10;i++){const a=i/10*Math.PI,ny=Math.sin(a),nz=Math.cos(a);door.push([0,ny,nz,-ny*(ground+1.9)-nz*z-1.32]);}
 tree.updateWorldMatrix(true,true);
 // Widen the existing textured root base around the chamber, so the new interior
 // stays inside bark instead of protruding as an untextured cylinder.
 tree.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();const pos=o.geometry.attributes.position,inv=o.matrixWorld.clone().invert(),v=new THREE.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);const h=v.y-ground,dx=v.x-x,dz=v.z-hallZ,r=Math.hypot(dx,dz);if(h<5.7&&r>.05&&r<3.0){const a=Math.atan2(dz,dx),minimum=2.73+.10*Math.sin(a*5)+.055*Math.sin(a*11+h),weight=1-THREE.MathUtils.smoothstep(h,3.45,5.7),radius=r+Math.max(0,minimum-r)*weight;v.x=x+dx*radius/r;v.z=hallZ+dz*radius/r;v.applyMatrix4(inv);pos.setXYZ(i,v.x,v.y,v.z);}}pos.needsUpdate=true;o.geometry.computeVertexNormals();});
 const clearance=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,nx=Math.cos(a),nz=Math.sin(a),px=-nz,pz=nx,t=Math.tan(Math.PI/24),plane=(vx,vz,d)=>[vx,0,vz,-vx*x-vz*z-d];clearance.push([[0,-1,0,deckY-.18],[0,1,0,-deckY-2.25],plane(-nx,-nz,-2.5),plane(nx,nz,6.7),plane(px-t*nx,pz-t*nz,0),plane(-px-t*nx,-pz-t*nz,0)]);}
 let carved=0;tree.traverse(o=>{if(!o.isMesh)return;carveGeometry(o,[hall,door,...clearance],o.matrixWorld);carved++;});
 const g=new THREE.Group();g.name='云冠秘境 · 树洞与观景圆台';scene.add(g);
 const wood=new THREE.MeshStandardMaterial({color:'#90704c',roughness:.95}),dark=new THREE.MeshStandardMaterial({color:'#59452f',roughness:1}),moss=new THREE.MeshStandardMaterial({color:'#798958',roughness:1}),gold=new THREE.MeshStandardMaterial({color:'#c7b87b',metalness:.25,roughness:.65}),bark=new THREE.MeshStandardMaterial({color:'#72563b',roughness:1,side:THREE.DoubleSide});
 const mesh=(geo,mat,p,name)=>{const m=new THREE.Mesh(geo,mat);m.position.set(...p);m.name=name||'';m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const beam=(a,b,r=.06,mat=wood)=>{const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);const m=mesh(new THREE.CylinderGeometry(r,r*1.12,delta.length(),7),mat,va.clone().add(vb).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
 const floorY=ground+.08;
 mesh(new THREE.CylinderGeometry(6.05,6.15,.13,80),moss,[x,ground-.005,z],'过桥后的苔庭');colliders.push({type:'circle',x,z,r:6.05,top:floorY,floorOnly:true,elderGarden:true});
 // Low, wide landing joins the old bridge to a level walking court.
 for(let i=0;i<13;i++)mesh(new THREE.BoxGeometry(.38,.10,1.95),i%3?wood:dark,[x+2.45+i*.39,ground+.07,z],'桥头木步道');
 colliders.push({type:'box',minX:x+2.2,maxX:-22.6,minZ:-1.0,maxZ:1.0,top:ground+.12,floorOnly:true,elderLanding:true});
 mesh(new THREE.CylinderGeometry(2.23,2.23,.12,64),wood,[x,ground+.05,hallZ],'树洞木地板');
 // Inner bark walls are open towards the bridge; broad curved panels hide cut edges.
 for(let i=0;i<56;i++){const a=(i+.5)/56*Math.PI*2,px=x+Math.cos(a)*2.22,pz=hallZ+Math.sin(a)*2.22;if(px>x&&Math.abs(pz-z)<1.4)continue;const wall=mesh(new THREE.CylinderGeometry(2.22,2.29,3.45,1,5,true,Math.PI/2-a-.057,.114),bark,[x,ground+1.78,hallZ],'树洞内壁');tree.attach(wall);
  colliders.push({type:'circle',x:px,z:pz,r:.18,top:ground+3.9,elderWall:true});
 }
 // Collision follows the hollow walls; the previous solid 4.4m trunk is gone.
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2,px=x+Math.cos(a)*3.05,pz=hallZ+Math.sin(a)*3.05;if(px>x&&Math.abs(pz-z)<1.65)continue;colliders.push({type:'circle',x:px,z:pz,r:.34,top:ground+3.9,elderWall:true});}
 const archPoints=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI;archPoints.push(new THREE.Vector3(x+Math.sqrt(2.9**2-(Math.cos(a)*1.37)**2),ground+1.9+Math.sin(a)*1.37,z+Math.cos(a)*1.37));}
 mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints),40,.15,8,false),dark,[0,0,0],'树洞拱门');for(const s of [-1,1])beam([x+2.557,ground+.1,z+s*1.37],[x+2.557,ground+1.9,z+s*1.37],.15,dark);
 mesh(new THREE.CircleGeometry(2.22,48),dark,[x,ground+3.51,hallZ],'树洞穹顶').rotation.x=Math.PI/2;
 const outer=6.2,inner=2.55,N=96;
 // Individual cedar planks make a broad, genuinely walkable annular deck.
 for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+.98)/N*Math.PI*2,shape=new THREE.Shape();shape.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);shape.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);shape.lineTo(Math.cos(b)*outer,Math.sin(b)*outer);shape.lineTo(Math.cos(b)*inner,Math.sin(b)*inner);shape.closePath();const plank=mesh(new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:false}),i%5===0?dark:wood,[x,deckY,z],'环树观景木板');plank.rotation.x=Math.PI/2;}
 colliders.push({type:'annulus',x,z,inner,outer,top:deckY,floorOnly:true,elderDeck:true});
 colliders.push({type:'circle',x,z,r:inner-.12,bottom:deckY-.3,top:deckY+2.3,elderUpperTrunk:true});
 // Open panorama: no fence, posts or invisible rail colliders.
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2,c=Math.cos(a),s=Math.sin(a);beam([x+c*1.8,deckY-3.5,z+s*1.8],[x+c*(outer-.25),deckY-.18,z+s*(outer-.25)],.13,dark);}
 // Warm leaf lanterns around the panorama, and a pair of curved benches.
 const glow=new THREE.MeshStandardMaterial({color:'#f4df9a',emissive:'#e2be6d',emissiveIntensity:.45,roughness:.6});
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;mesh(new THREE.SphereGeometry(.14,12,8),glow,[x+Math.cos(a)*(outer-.05),deckY+.16,z+Math.sin(a)*(outer-.05)],'观景台叶灯');}
 for(const a of [Math.PI*.55,Math.PI*1.1]){const p=[x+Math.cos(a)*5.3,deckY+.4,z+Math.sin(a)*5.3],seat=mesh(new THREE.BoxGeometry(1.8,.12,.48),wood,p,'看风景的长椅');seat.rotation.y=-a-Math.PI/2;for(const s of [-1,1])beam([p[0]+s*.55*Math.sin(a),deckY,p[2]-s*.55*Math.cos(a)],[p[0]+s*.55*Math.sin(a),deckY+.35,p[2]-s*.55*Math.cos(a)],.07,dark);}
 const canopy=createCanopySurface(tree,deckY+3);colliders.push(canopy);
 // Cut a genuine level recess for the return pad, including narrow vertical
 // twigs which a sampled leaf height field can miss between grid points.
 const pad=canopy.returnPad,clearPad=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2,nx=Math.cos(a),nz=Math.sin(a);clearPad.push([nx,0,nz,-nx*pad.x-nz*pad.z-1.04]);}clearPad.push([0,-1,0,pad.y-.09],[0,1,0,-pad.y-8]);tree.traverse(m=>{if(m.isMesh)carveGeometry(m,[clearPad],m.matrixWorld);});
 const leafSample=canopy.sample;canopy.sample=(px,pz)=>Math.hypot(px-pad.x,pz-pad.z)<.98?pad.y+.038:leafSample(px,pz);
 colliders.push({type:'circle',x:pad.x,z:pad.z,r:.98,top:pad.y+.038,floorOnly:true,elderCrownPad:true});
 const pads=[],portals=[new THREE.Vector3(x,floorY,hallZ),new THREE.Vector3(x+4,deckY,z),canopy.returnPad.clone()];
 for(const [i,p]of portals.entries()){const circle=mesh(new THREE.CylinderGeometry(.92,.98,.045,64),dark,[p.x,p.y+.015,p.z],i===2?'回到圆台的传送阵':i?'回到树洞的传送阵':'通往云冠的传送阵');
  const mat=new THREE.MeshBasicMaterial({color:'#b4e6c7',transparent:true,opacity:.68,depthWrite:false,toneMapped:false});const r=mesh(new THREE.TorusGeometry(.76,.018,6,72),mat,[p.x,p.y+.045,p.z]);r.rotation.x=Math.PI/2;
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2,gem=mesh(new THREE.OctahedronGeometry(.048,0),mat,[p.x+Math.cos(a)*.59,p.y+.07,p.z+Math.sin(a)*.59]);gem.scale.y=.4;gem.rotation.y=a;}
  pads.push({ring:r,mat,position:p});
 }
 const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128;const ctx=signCanvas.getContext('2d');ctx.fillStyle='#efe7c8';ctx.fillRect(0,0,512,128);ctx.textAlign='center';ctx.font='38px serif';ctx.fillStyle='#486750';ctx.fillText('云冠观景台 · 站上光环',256,79);const tx=new THREE.CanvasTexture(signCanvas);tx.colorSpace=THREE.SRGBColorSpace;mesh(new THREE.PlaneGeometry(1.55,.39),new THREE.MeshStandardMaterial({map:tx,side:THREE.DoubleSide}),[x+2.83,ground+2.7,z],'古树指路牌').rotation.y=Math.PI/2;
 const lantern=mesh(new THREE.SphereGeometry(.12,16,12),glow,[x,ground+3.0,hallZ]);beam([x,ground+3.5,hallZ],[x,ground+3.08,hallZ],.018,gold);
 const light=new THREE.PointLight('#ffe2aa',1.8,7,2);light.position.set(x,ground+2.4,hallZ);g.add(light);
 const arrivals=[new THREE.Vector3(x+1.2,floorY,hallZ-.7),new THREE.Vector3(x+4,deckY,z+1.55),canopy.seat.clone()];
 let charge=0,lock=true,time=0;
 const sanctuary={group:g,ground,deckY,canopy,portals,arrivals,carved,update(dt,position,enabled=true){time+=dt;for(const p of pads){p.mat.opacity=.5+Math.sin(time*1.6)*.13;p.ring.rotation.z=time*.09;}
  const index=portals.findIndex(p=>Math.abs(p.y-position.y)<.32&&Math.hypot(p.x-position.x,p.z-position.z)<.73);
  if(index<0){charge=0;lock=false;return null;}if(!enabled||lock){charge=0;return null;}charge+=dt;pads[index].mat.opacity=.65+charge*.35;if(charge<.65)return null;lock=true;charge=0;return {position:arrivals[index===2?1:1-index].clone(),upper:index!==1};
 }};
 tree.userData.elderTree.deckHeight=deckY-ground;g.userData.elderSanctuary={deckY,inner,outer,entrance:[x+4,z],hall:[x,hallZ]};return sanctuary;
}
