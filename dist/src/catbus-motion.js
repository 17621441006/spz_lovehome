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
    vec3 original=diffuseColor.rgb;
    float lightness=dot(original,vec3(.2126,.7152,.0722));
    float fur=smoothstep(.035,.14,lightness);
    // Preserve dark cabin windows, pupils and mouth. Cream teeth remain ivory.
    float neutral=1.0-smoothstep(.30,.44,abs(original.r-original.g)/max(.04,original.r));
    float cream=neutral*smoothstep(.12,.28,lightness);
    float eye=neutral*smoothstep(.40,.58,lightness)*(1.0-smoothstep(.48,.72,original.b/max(.04,original.r)));
    float pink=step(original.g*.92,original.b)*step(original.g*1.18,original.r)*smoothstep(.07,.18,lightness);
    float stripes=(1.0-smoothstep(.23,.36,abs(sin(vBusPosition.z*39.0+vBusPosition.y*7.0))))*(1.0-smoothstep(.23,.28,vBusPosition.y));
    vec3 amber=mix(vec3(.38,.105,.012),vec3(.83,.40,.055),clamp(lightness*1.7,0.0,1.0));
    vec3 chestnut=vec3(.19,.065,.018)*(0.65+lightness);
    vec3 coat=mix(amber,chestnut,stripes*.88);
    coat=mix(coat,vec3(.90,.77,.46),cream*.76);
    diffuseColor.rgb=mix(original,coat,fur*.94);
    diffuseColor.rgb=mix(diffuseColor.rgb,original*vec3(1.25,1.20,1.10),cream);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.94,.84,.20)*(0.8+min(.2,lightness)),eye*.9);
    diffuseColor.rgb=mix(diffuseColor.rgb,original*vec3(1.18,1.08,1.06),pink);
`);
   };m.customProgramCacheKey=()=> 'catbus-amber-run-v26';
  }
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});depth.onBeforeCompile=s=>{s.uniforms.busPhase=phase;s.uniforms.busStride=stride;s.vertexShader='uniform float busPhase;uniform float busStride;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+deform);};o.customDepthMaterial=depth;
 });
 const base=model.position.clone();let t=0;
 return(dt,speed)=>{t+=dt;phase.value+=dt*Math.min(speed,4.8)*3.4;stride.value+=(Math.min(1,speed/1.4)-stride.value)*(1-Math.exp(-8*dt));const bound=Math.pow(Math.max(0,Math.sin(t*.65)),14)*.055;model.position.y=base.y+(Math.abs(Math.sin(phase.value))*.018+bound)*stride.value;};
}
