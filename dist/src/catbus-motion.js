import * as THREE from 'three';
// Animate the original one-piece asset in the vertex stage. Upper body and cabin
// remain intact, the lower twelve legs alternate in two phase groups.
export function animateCatBus(model){
 const phase={value:0},stride={value:0};
 const deform=`float leg = 1.0-smoothstep(0.075,0.155,position.y);
 float pair = floor((position.z+0.40)/0.14);
 float wave = busPhase + pair*1.9 + (position.x<0.0?3.14159265:0.0);
 transformed.z += sin(wave)*0.033*leg*busStride;
 transformed.y += max(0.0,cos(wave))*0.018*leg*busStride;`;
 model.traverse(o=>{if(!o.isMesh)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   m.onBeforeCompile=s=>{s.uniforms.busPhase=phase;s.uniforms.busStride=stride;
    s.vertexShader='uniform float busPhase; uniform float busStride; varying vec3 vBusPosition;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBusPosition=position;\n'+deform);
    s.fragmentShader='varying vec3 vBusPosition;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float fur=smoothstep(0.025,0.09,dot(diffuseColor.rgb,vec3(.333)));
    float stripe=(1.0-smoothstep(.20,.29,abs(sin(vBusPosition.z*43.0+vBusPosition.y*6.0))))*(1.0-smoothstep(.19,.25,vBusPosition.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.65,1.30,.88),fur*.68);
    diffuseColor.rgb*=1.0-stripe*.42*fur;`);
   };m.customProgramCacheKey=()=> 'catbus-run-v24';
  }
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});depth.onBeforeCompile=s=>{s.uniforms.busPhase=phase;s.uniforms.busStride=stride;s.vertexShader='uniform float busPhase;uniform float busStride;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+deform);};o.customDepthMaterial=depth;
 });
 const base=model.position.clone();let t=0;
 return(dt,speed)=>{t+=dt;phase.value+=dt*speed*4;stride.value+=(Math.min(1,speed/1.4)-stride.value)*(1-Math.exp(-8*dt));const bound=Math.pow(Math.max(0,Math.sin(t*.65)),14)*.055;model.position.y=base.y+(Math.abs(Math.sin(phase.value))*.018+bound)*stride.value;};
}
