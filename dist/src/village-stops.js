import * as THREE from 'three';
import {heightAt} from './terrain.js';
export function addVillageStops(scene,routes,obstacles,colliders){
 const wood=new THREE.MeshStandardMaterial({color:'#526a50',roughness:.94}),rim=new THREE.MeshStandardMaterial({color:'#c9ac70',roughness:.7}),paper=new THREE.MeshStandardMaterial({color:'#f3ecd2',roughness:.95});const placed=[];
 for(const route of routes)for(const stop of route.stops){if(placed.some(p=>p.distanceTo(stop.position)<6))continue;placed.push(stop.position);const side=new THREE.Vector3(Math.cos(stop.yaw),0,-Math.sin(stop.yaw));let at;
  for(const sign of [-1,1]){const p=stop.position.clone().addScaledVector(side,sign*3.9);if(!obstacles.some(c=>!c.floorOnly&&(c.type==='circle'?Math.hypot(p.x-c.x,p.z-c.z)<c.r+.45:c.type==='box'&&p.x>c.minX-.45&&p.x<c.maxX+.45&&p.z>c.minZ-.45&&p.z<c.maxZ+.45))){at=p;break;}}if(!at)continue;
  const waterSign=stop.name==='古树桥头';if(waterSign)at=new THREE.Vector3(-20.2,0,2.5);
  const g=new THREE.Group();g.userData.waterSign=waterSign;g.name=stop.name+' · 猫车站牌';g.position.set(at.x,heightAt(at.x,at.z)-(waterSign?.48:0),at.z);g.rotation.y=waterSign?Math.PI/2:stop.yaw+Math.PI/2;const lift=waterSign?.55:0;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,1.65+lift,8),wood);pole.position.y=(1.65+lift)/2;g.add(pole);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.86,.59,.10),rim);frame.position.y=1.65+lift;g.add(frame);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;const ctx=canvas.getContext('2d');ctx.fillStyle='#f2ead2';ctx.fillRect(0,0,512,320);ctx.textAlign='center';ctx.fillStyle='#4e664f';ctx.font='bold 46px serif';ctx.fillText(waterSign?'← 古树桥 · 云冠':stop.name,256,135);ctx.font='28px serif';ctx.fillText(waterSign?'听水声 · 去树顶看风景':'猫车 · 在这里等一会儿',256,210);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(.80,.53),new THREE.MeshStandardMaterial({map:tex,roughness:.95,side:THREE.DoubleSide}));sign.position.set(0,1.65+lift,.057);g.add(sign);
  const hat=new THREE.Mesh(new THREE.ConeGeometry(.55,.18,4),wood);hat.rotation.y=Math.PI/4;hat.scale.z=.42;hat.position.y=2.05+lift;g.add(hat);
  if(waterSign){for(const r of [.3,.53]){const ripple=new THREE.Mesh(new THREE.TorusGeometry(r,.012,5,40),new THREE.MeshBasicMaterial({color:'#b5dfcb',transparent:true,opacity:.45,depthWrite:false}));ripple.rotation.x=Math.PI/2;ripple.position.y=.51;g.add(ripple);}const leaf=new THREE.Mesh(new THREE.CircleGeometry(.23,18),wood);leaf.rotation.x=-Math.PI/2;leaf.position.set(.46,.52,.12);g.add(leaf);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(g);if(!waterSign)colliders.push({type:'circle',x:at.x,z:at.z,r:.16,top:999,busStop:true});
 }
}
