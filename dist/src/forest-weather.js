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
 constructor(scene,low=false){this.group=new THREE.Group();this.group.name='林隙阳光';this.uniforms={uAmount:{value:0},uTime:{value:0}};const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;varying vec3 vNormal,vView;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float uAmount,uTime;varying vec2 vUv;varying vec3 vNormal,vView;void main(){float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),1.4);float ends=smoothstep(0.,.14,vUv.y)*(1.-smoothstep(.84,1.,vUv.y));float shimmer=.92+.08*sin(uTime*.35+vUv.y*7.);float a=edge*ends*.095*uAmount*shimmer;gl_FragColor=vec4(1.,.91,.65,a);#include <colorspace_fragment>\n}`.replace('#include','\n#include')});
 const anchors=[[-7,2],[-12,-8],[-25,-13],[4,-25],[9,-18],[-18,8],[3,13],[16,19],[25,27],[-25,24],[-2,-16],[28,-5]];const axis=new THREE.Vector3(.55,.62,.35).normalize();
 for(const [i,[x,z]]of anchors.entries()){if(low&&i%2)continue;const length=8+(i%4),beam=new THREE.Mesh(new THREE.CylinderGeometry(.12,.55+(i%3)*.22,length,12,1,true),mat);beam.position.set(x,heightAt(x,z)+.1,z).addScaledVector(axis,length/2);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);beam.name='斜照树隙光束';this.group.add(beam);}scene.add(this.group);this.group.visible=false;}
 update(t,sun,night,rain,snow){this.uniforms.uTime.value=t;this.uniforms.uAmount.value=sun*(1-night)*(1-rain)*(1-snow);this.group.visible=this.uniforms.uAmount.value>.005;}
}
