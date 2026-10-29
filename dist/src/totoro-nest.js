import * as THREE from 'three';
import {heightAt} from './terrain.js';
// An open, hollow fallen trunk: sculpted bark outside, warm wood and moss inside.
export function createTotoroNest(scene,home,yaw,colliders){
 const root=new THREE.Group();root.name='龙猫的空心古木睡窝';root.position.copy(home);root.rotation.y=yaw;
 const bark=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),wood=new THREE.MeshStandardMaterial({color:'#ad8b59',roughness:1,side:THREE.DoubleSide}),moss=new THREE.MeshStandardMaterial({color:'#65824a',roughness:1});
 const positions=[],colors=[],indices=[],rows=32,cols=48;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const z=-3.25+j/rows*6.15,a=-Math.PI/2+i/cols*Math.PI,flare=1+.07*Math.sin(z*.8),ridge=.035*Math.sin(a*27+z*.7)+.018*Math.sin(a*47-z*2);
  const x=Math.sin(a)*(3.0*flare+ridge),y=.08+(1-Math.cos(a))*1.7+ridge*.5;
  positions.push(x,y,z);const c=new THREE.Color('#574633').lerp(new THREE.Color('#b18b58'),.45+.24*Math.sin(a*27+z*.7));if(Math.abs(a)>1.32)c.lerp(new THREE.Color('#647f43'),.65);colors.push(c.r,c.g,c.b);
  if(i<cols&&j<rows){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const hollow=new THREE.Mesh(geo,bark);hollow.name='向上敞开的树干内槽';root.add(hollow);
 const tube=(points,r,material)=>{const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,r,8,false),m=new THREE.Mesh(g,material);if(material===rootMat){const p=g.attributes.position,n=g.attributes.normal,c=[];for(let i=0;i<p.count;i++){const wave=Math.sin(p.getY(i)*9+p.getZ(i)*3+Math.atan2(p.getZ(i),p.getX(i))*23);const shade=new THREE.Color('#483b2b').lerp(new THREE.Color('#94754f'),.5+.28*wave);c.push(shade.r,shade.g,shade.b);p.setXYZ(i,p.getX(i)+n.getX(i)*wave*.018,p.getY(i)+n.getY(i)*wave*.018,p.getZ(i)+n.getZ(i)*wave*.018);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();}root.add(m);return m;};
 // Twisted roots cradle the head. The front stays open for reaching the belly.
 const rootMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
 for(const s of [-1,1]){
  tube([[s*2.6,.1,2.5],[s*3,1.5,1.3],[s*2.85,1.9,-1.4],[s*2.5,2.8,-2.8],[s*2.1,4.3,-3.4]],.34,rootMat);
  tube([[s*3.2,.03,2.9],[s*3,.5,.5],[s*2.9,1.8,-1.9],[s*3.5,3.8,-3.1]],.20,rootMat);
  for(let i=0;i<3;i++)tube([[s*(2.84+i*.07),1.55,-2.7],[s*(3.05+i*.03),1.7,-.8],[s*(3.1-i*.06),1.3,1.9]],.035,moss);
 }
 // Visible end grain makes the silhouette read as a hollow trunk, not a bowl.
 for(const z of [-3.26,2.91])for(let r=0;r<3;r++){const p=[];for(let i=0;i<=38;i++){const a=-Math.PI/2+i/38*Math.PI;p.push([Math.sin(a)*(3.0-r*.08),.08+(1-Math.cos(a))*(1.7-r*.08),z]);}tube(p,.025,wood);}
 const bed=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),moss);bed.position.set(0,.025,.35);bed.scale.set(2.15,.12,2.7);bed.name='柔软苔藓床垫';root.add(bed);
 const pillow=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),moss);pillow.position.set(0,.6,-2.5);pillow.scale.set(1.5,.52,.8);root.add(pillow);
 // Small mushrooms and ferns on the outer roots leave the body unobstructed.
 for(let i=0;i<9;i++){const s=i%2?1:-1,z=-2.8+i*.6,x=s*(2.95+.12*Math.sin(i)),stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,.24,6),wood),cap=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:i%3?'#b66c4a':'#d4b66f',roughness:.9}));stem.position.set(x,1.65,z);cap.position.set(x,1.77,z);root.add(stem,cap);}
 root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(root);root.updateMatrixWorld(true);
 for(const [x,z]of [[-2.85,-2.5],[2.85,-2.5],[-3,0],[3,0]]){const p=root.localToWorld(new THREE.Vector3(x,0,z));colliders.push({type:'circle',x:p.x,z:p.z,r:.25,top:heightAt(p.x,p.z)+3,totoroNest:true});}
 root.userData.nest={openFront:true};return root;
}
