import * as THREE from 'three';
import {heightAt,LAYOUT} from './terrain.js';
// Stable spatial variation: depth does not flicker when moving the camera.
export function snowDepth(x,z){return .5+.25*Math.sin(x*.21+Math.sin(z*.13))+.25*Math.cos(z*.27-x*.09);}
export class SnowTracks{
 constructor(scene){this.time=0;this.cursor=0;this.records=[];this.walkers=new Map();this.limit=2048;
 const g=new THREE.CircleGeometry(1,16);g.rotateX(-Math.PI/2);
 const m=new THREE.MeshBasicMaterial({color:'#a9bed4',transparent:true,opacity:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 this.mesh=new THREE.InstancedMesh(g,m,this.limit);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.name='雪地脚印 · 随深度消融';scene.add(this.mesh);this.dummy=new THREE.Object3D();for(let i=0;i<this.limit;i++)this.hide(i);}
 hide(i){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);}
 walk(id,p,heading,amount,grounded){let s=this.walkers.get(id);if(!s){s={last:p.clone(),distance:0,side:1};this.walkers.set(id,s);return;}const delta=Math.hypot(p.x-s.last.x,p.z-s.last.z);s.last.copy(p);if(amount<.6||!grounded||delta>2){s.distance=0;return;}s.distance+=delta;if(s.distance<.38)return;s.distance=0;s.side*=-1;
 const x=p.x+Math.cos(heading)*s.side*.11,z=p.z-Math.sin(heading)*s.side*.11,y=heightAt(x,z);if(Math.abs(p.y-y)>.15||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+.3)return;
 const i=this.cursor++%this.limit;this.records[i]={x,z,y:y+.018,heading,born:this.time,life:60+60*snowDepth(x,z),cat:id==='zangzangbao'};}
 update(dt,amount){this.time+=dt;this.mesh.visible=amount>.05;for(let i=0;i<this.records.length;i++){const r=this.records[i];if(!r)continue;const age=this.time-r.born;if(age>=r.life||amount<.05){this.records[i]=null;this.hide(i);continue;}const fade=1-THREE.MathUtils.smoothstep(age,r.life*.7,r.life);this.dummy.position.set(r.x,r.y,r.z);const slopeX=(heightAt(r.x+.05,r.z)-heightAt(r.x-.05,r.z))/.1,slopeZ=(heightAt(r.x,r.z+.05)-heightAt(r.x,r.z-.05))/.1;this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-slopeX,1,-slopeZ).normalize());this.dummy.rotateY(r.heading);this.dummy.scale.set(.065*fade,1,(r.cat?.085:.14)*fade);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);}this.mesh.instanceMatrix.needsUpdate=true;}
}
