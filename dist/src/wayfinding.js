import * as THREE from 'three';
import {heightAt} from './terrain.js';

// Small wayposts at real forks; paths and distant landmarks do the rest.
export function addWayfinding(scene){
 const group=new THREE.Group();group.name='林间岔路 · 木制指路牌';
 const wood=new THREE.MeshStandardMaterial({color:'#70634a',roughness:1});
 const forks=[
  {x:-2.8,z:7.3,labels:['↑ 星湖 · 樟树神社','← 云冠古树','↓ 树屋 · 听风亭']},
  {x:13.9,z:9.3,labels:['→ 稻荷山道 · 寺院','↑ 龙猫车站 · 东岬']},
  {x:-19.8,z:10.2,labels:['← 樱影町屋','↓ 听风亭 · 草甸']},
  {x:10.3,z:-42.2,labels:['↗ 露灯小径 · 灯尾茸']},
 ];
 for(const fork of forks){
  const post=new THREE.Group();post.position.set(fork.x,heightAt(fork.x,fork.z),fork.z);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,1.45,7),wood);stem.position.y=.725;post.add(stem);
  fork.labels.forEach((label,i)=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=144;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#b9a27b';ctx.fillRect(0,0,640,144);ctx.strokeStyle='#8f7956';ctx.lineWidth=3;ctx.strokeRect(8,8,624,128);
   ctx.fillStyle='#343d2c';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 42px serif';ctx.fillText(label,320,75);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   const sign=new THREE.Mesh(new THREE.BoxGeometry(1.35,.30,.065),new THREE.MeshStandardMaterial({map,roughness:.95}));
   sign.position.set(0,1.30-i*.34,0);sign.rotation.y=i%2?.14:-.10;post.add(sign);
  });
  post.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});group.add(post);
 }
 scene.add(group);return group;
}
