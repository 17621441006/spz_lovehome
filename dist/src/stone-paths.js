import * as THREE from 'three';
import {heightAt,roadDist,terrainSnow,inLakeWater} from './terrain.js';
import {WALK_PATHS} from './world-layout.js';
import {inElderRiver} from './elder-tree.js';
import {rng} from './toon.js';

// Thin, terrain-conforming paving: it changes the surface, never adds hundreds
// of box colliders or forces a bobbing camera onto tiny steps.
export const STONE_ROUTES=[
 {id:'elder',from:3,to:15.4,width:1.14,spacing:.78,style:'moss'},
 {id:'temple',from:5,to:24,width:1.12,spacing:.76,style:'warm'},
 {id:'town',from:12,to:22,width:.72,spacing:1.12,style:'moss'},
 {id:'moon-wood',from:8,to:18,width:.58,spacing:1.16,style:'moss'},
];
function samplePath(points,distance){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(distance<=length||i===points.length-1){const t=THREE.MathUtils.clamp(distance/length,0,1);return{x:THREE.MathUtils.lerp(a[0],b[0],t),z:THREE.MathUtils.lerp(a[1],b[1],t),dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length};}distance-=length;
 }
}
export function addStonePaths(scene){
 const root=new THREE.Group();root.name='苔石古道与浅砂岩铺路';scene.add(root);
 const R=rng(310902),data={moss:{p:[],c:[],i:[]},warm:{p:[],c:[],i:[]}},samples=[];
 for(const route of STONE_ROUTES){
  const path=WALK_PATHS.find(p=>p.id===route.id);if(!path)continue;
  for(let d=route.from;d<route.to;d+=route.spacing){
   const p=samplePath(path.points,d),rows=route.width>.9?3:1;
   for(let row=0;row<rows;row++){
    const offset=rows===1?(R()-.5)*.18:(row-1)*.65;
    const x=p.x+p.dz*offset,z=p.z-p.dx*offset;
    if(roadDist(x,z)<2.3||inElderRiver(x,z)||inLakeWater(x,z,-.2))continue;
    const side=rows===1?.38:.30,forward=rows===1?.39:.32,angle=R()*.22-.11,n=7;
    const points=[];
    for(let k=0;k<n;k++){const a=k/n*Math.PI*2+angle,r=.88+R()*.12,u=Math.cos(a)*side*r,v=Math.sin(a)*forward*r;points.push([x+p.dz*u+p.dx*v,z-p.dx*u+p.dz*v]);}
    const heights=points.map(([px,pz])=>heightAt(px,pz));
    if(Math.max(...heights)-Math.min(...heights)>.23)continue;
    const target=data[route.style],base=target.p.length/3,color=new THREE.Color(route.style==='warm'?'#b8ad93':'#839590').multiplyScalar(.88+R()*.18);
    target.p.push(x,heightAt(x,z)+.025,z);target.c.push(color.r,color.g,color.b);
    for(let ring=0;ring<2;ring++)for(let k=0;k<n;k++){
     const [px,pz]=points[k],inset=ring===0?.91:1,wx=x+(px-x)*inset,wz=z+(pz-z)*inset;
     target.p.push(wx,heightAt(wx,wz)+(ring===0?.023:-.009),wz);
     const edge=color.clone().multiplyScalar(ring===0?1:.72);target.c.push(edge.r,edge.g,edge.b);
    }
    for(let k=0;k<n;k++){const a=base+1+k,b=base+1+(k+1)%n,c=a+n,e=b+n;target.i.push(base,b,a,a,b,c,b,e,c);}
    samples.push({route:route.id,x,z,ground:heightAt(x,z),top:heightAt(x,z)+.025});
   }
  }
 }
 for(const [style,d]of Object.entries(data)){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(d.c,3));g.setIndex(d.i);g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  m.onBeforeCompile=sh=>{sh.uniforms.uPavingSnow=terrainSnow;sh.vertexShader='varying vec3 vPaving;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaving=position;');sh.fragmentShader='uniform float uPavingSnow;varying vec3 vPaving;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=sin(vPaving.x*57.3+sin(vPaving.z*37.1))*sin(vPaving.z*61.7);
   float moss=smoothstep(.25,.85,sin(vPaving.x*3.3)*cos(vPaving.z*4.1));
   diffuseColor.rgb*=.97+grain*.035;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.75,.96,.66),moss*.22);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.95,.98),uPavingSnow*.95);
  `);};m.customProgramCacheKey=()=> 'conforming-paving31';
  const mesh=new THREE.Mesh(g,m);mesh.name=style==='moss'?'苔石踏步':'寺前浅砂岩';mesh.receiveShadow=true;root.add(mesh);
 }
 const stats={stones:samples.length,drawCalls:root.children.length,triangles:Object.values(data).reduce((n,d)=>n+d.i.length/3,0),samples};
 root.userData.stats=stats;return{root,stats,dispose(){root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}};
}
