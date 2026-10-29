import * as THREE from 'three';
import {heightAt} from './terrain.js';
export const canopySnow={value:0};
const coated=new WeakSet();
export function coatTree(root){root.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.normal)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(coated.has(m))continue;coated.add(m);const previous=m.onBeforeCompile,oldKey=m.customProgramCacheKey();m.onBeforeCompile=sh=>{previous.call(m,sh);sh.uniforms.uCanopySnow=canopySnow;sh.uniforms.uCanopyRange={value:new THREE.Vector2(box.min.y,box.max.y)};sh.vertexShader='varying vec3 vSnowWorld,vSnowNormal;varying float vSnowHeight;uniform vec2 uCanopyRange;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSnowWorld=(modelMatrix*vec4(position,1.0)).xyz;vSnowNormal=normalize(mat3(modelMatrix)*objectNormal);vSnowHeight=(position.y-uCanopyRange.x)/max(.001,uCanopyRange.y-uCanopyRange.x);');sh.fragmentShader='uniform float uCanopySnow;varying vec3 vSnowWorld,vSnowNormal;varying float vSnowHeight;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float snowNoise=.5+.25*sin(vSnowWorld.x*3.7+sin(vSnowWorld.z*2.1))+.25*cos(vSnowWorld.z*4.3-vSnowWorld.x);
 float snowUp=smoothstep(.12,.68,abs(normalize(vSnowNormal).y));
 float snowCrown=smoothstep(.18,.55,vSnowHeight);
 float snowCover=uCanopySnow*snowUp*snowCrown*(.72+.28*snowNoise);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.96,.98,1.0),snowCover);
 `);};m.customProgramCacheKey=()=>oldKey+'-canopy-snow-v13';m.needsUpdate=true;}});return root;}
export class SunShafts{
 constructor(scene,low=false){
  this.group=new THREE.Group();this.group.name='树冠下的林隙阳光';this.anchors=[];this.uniforms={uAmount:{value:0},uTime:{value:0},uCamera:{value:new THREE.Vector3()}};
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:this.uniforms,
   vertexShader:`varying vec2 vUv;varying vec3 vNormal,vView,vWorld;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;vView=-p.xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}`,
   fragmentShader:`uniform float uAmount,uTime;uniform vec3 uCamera;varying vec2 vUv;varying vec3 vNormal,vView,vWorld;void main(){float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),2.);float ends=smoothstep(0.,.22,vUv.y)*(1.-smoothstep(.72,1.,vUv.y));float nearby=1.-smoothstep(12.,28.,distance(vWorld,uCamera));float shimmer=.95+.05*sin(uTime*.24+vUv.y*5.);gl_FragColor=vec4(1.,.94,.77,edge*ends*.042*uAmount*shimmer*nearby);
    #include <colorspace_fragment>
   }`});
  const axis=new THREE.Vector3(.55,.62,.35).normalize(),trees=scene.children.filter(o=>o.userData.treeAsset||o.userData.groveKind==='sakura');scene.updateMatrixWorld(true);
  for(const tree of trees){if(this.anchors.length>=(low?6:12))break;const box=new THREE.Box3().setFromObject(tree),center=box.getCenter(new THREE.Vector3()),h=box.max.y-box.min.y;if(h<4||h>18||this.anchors.some(a=>a.tree.position.distanceTo(tree.position)<5))continue;
   for(const offset of [[-1.5,-.9],[-2,.6],[.8,-1.6]]){const x=center.x+offset[0],z=center.z+offset[1],origin=new THREE.Vector3(x,heightAt(x,z)+.15,z),ray=new THREE.Raycaster(origin,axis,.5,12),sides=[];tree.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){sides.push([m,m.side]);m.side=THREE.DoubleSide;}});const hit=ray.intersectObject(tree,true).find(hit=>hit.distance>2&&hit.point.y>box.min.y+h*.35);for(const [m,side]of sides)m.side=side;if(!hit)continue;
    // Both ends are inside the forest: the top must meet a real leaf triangle.
    const top=hit.point.clone().addScaledVector(axis,-.08),length=Math.min(5.5,hit.distance-.18),bottom=top.clone().addScaledVector(axis,-length),beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.36,length,10,1,true),mat);beam.position.copy(top).add(bottom).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);beam.name='从真实树隙透下的柔光';beam.userData.canopyTop=top.clone();this.group.add(beam);this.anchors.push({tree,top,bottom,beam});break;
   }
  }
  scene.add(this.group);this.group.visible=false;
 }
 update(t,sun,night,rain,snow,camera){this.uniforms.uTime.value=t;this.uniforms.uAmount.value=sun*(1-night)*(1-rain)*(1-snow);if(camera)this.uniforms.uCamera.value.copy(camera);this.group.visible=this.uniforms.uAmount.value>.005;for(const a of this.anchors)a.beam.visible=!camera||camera.y<a.top.y+.5&&camera.distanceTo(a.beam.position)<30;}
}
