import * as THREE from 'three';
import {heightAt,LAYOUT} from './terrain.js';
import {rng} from './toon.js';

// A small camera-following volume of slow flakes. Positions are kept in world
// space so walking through the snow does not drag a sheet of particles along.
export class Snow {
  constructor(scene,{low=false,pixelRatio=1}={}){
    this.count=low?650:1300;this.radius=18;this.random=rng(28010);this.time=0;
    this.positions=new Float32Array(this.count*3);this.phases=new Float32Array(this.count);this.sizes=new Float32Array(this.count);this.speeds=new Float32Array(this.count);this.ground=new Float32Array(this.count);this.initialized=false;
    for(let i=0;i<this.count;i++){this.phases[i]=this.random()*Math.PI*2;this.sizes[i]=.55+this.random()*.85;this.speeds[i]=.32+this.random()*.42;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1));
    this.uniforms={uAmount:{value:0},uNight:{value:0},uPixelRatio:{value:Math.min(2,pixelRatio)}};
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:this.uniforms,
      vertexShader:`attribute float aSize;uniform float uPixelRatio;varying float vDistance;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;vDistance=-mv.z;gl_PointSize=clamp(aSize*35.0*uPixelRatio/max(1.0,-mv.z),1.5,10.0*uPixelRatio);}`,
      fragmentShader:`uniform float uAmount,uNight;varying float vDistance;
      void main(){
        float d=length(gl_PointCoord-.5);
        float a=(1.0-smoothstep(.12,.5,d))*.72*uAmount;
        a*=smoothstep(.6,1.8,vDistance)*(1.0-smoothstep(16.0,27.0,vDistance));
        if(a<.01)discard;
        gl_FragColor=vec4(mix(vec3(.98,.98,.95),vec3(.63,.75,.87),uNight*.65),a);
        #include <colorspace_fragment>
      }`});
    this.mesh=new THREE.Points(geometry,material);this.mesh.name='缓缓落下的雪';this.mesh.visible=false;this.mesh.frustumCulled=false;scene.add(this.mesh);
  }
  spawn(i,center,full=false){
    const a=this.random()*Math.PI*2,r=Math.sqrt(this.random())*this.radius,x=center.x+Math.cos(a)*r,z=center.z+Math.sin(a)*r;
    const floor=heightAt(x,z)+.035;this.ground[i]=floor;
    this.positions[i*3]=x;this.positions[i*3+1]=full?floor+.4+this.random()*11:Math.max(floor+7,center.y+8+this.random()*4);this.positions[i*3+2]=z;
  }
  update(dt,center,amount,night=0){
    const a=THREE.MathUtils.clamp(amount,0,1);this.uniforms.uAmount.value=a;this.uniforms.uNight.value=THREE.MathUtils.clamp(night,0,1);this.mesh.visible=a>.005;
    if(!this.mesh.visible){this.initialized=false;return;}
    if(!this.initialized){for(let i=0;i<this.count;i++)this.spawn(i,center,true);this.initialized=true;}
    const step=Math.min(.1,Math.max(0,dt));this.time+=step;
    for(let i=0;i<this.count;i++){
      const k=i*3,phase=this.phases[i];
      this.positions[k]+=step*(.12+Math.sin(this.time*.65+phase)*.18);
      this.positions[k+1]-=step*this.speeds[i];
      this.positions[k+2]+=step*Math.cos(this.time*.47+phase)*.16;
      // Resample sparsely as flakes drift over the unchanged hills.
      if((i+Math.floor(this.time*60))%30===0)this.ground[i]=heightAt(this.positions[k],this.positions[k+2])+.035;
      if(this.positions[k+1]<this.ground[i]||Math.hypot(this.positions[k]-center.x,this.positions[k+2]-center.z)>this.radius+2||Math.hypot(this.positions[k],this.positions[k+2])>LAYOUT.terrainRadius+4)this.spawn(i,center);
    }
    this.mesh.geometry.attributes.position.needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
