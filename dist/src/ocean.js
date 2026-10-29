import * as THREE from 'three';
// World-space waves are shared across reused tiles. The horizon is two triangles;
// it never renders a reflection camera or loads distant high-resolution assets.
export class IslandOcean{
 constructor(scene,low=false){
  this.group=new THREE.Group();this.group.name='岛外海洋';scene.add(this.group);this.size=32;this.radius=low?2:3;this.span=(this.radius+.5)*this.size;
  this.uniforms={uTime:{value:0},uAnchor:{value:new THREE.Vector2()},uSpan:{value:this.span},uNight:{value:0},uRain:{value:0},uSky:{value:new THREE.Color('#b3d9ed')}};
  const vertex=`varying vec3 vWorld;varying float vWave;uniform float uTime,uSpan;uniform vec2 uAnchor;
   void main(){vec4 p=modelMatrix*vec4(position,1.);float wave=0.;
   #ifndef FAR_SEA
   float fade=1.-smoothstep(uSpan-20.,uSpan,max(abs(p.x-uAnchor.x),abs(p.z-uAnchor.y)));
   wave=(sin(p.x*.19+p.z*.11+uTime*.65)*.095+sin(p.z*.34-p.x*.08-uTime*.48)*.055+sin(p.x*.48+p.z*.31+uTime*.9)*.025)*fade;p.y+=wave;
   #endif
   vWorld=p.xyz;vWave=wave;gl_Position=projectionMatrix*viewMatrix*p;}`;
  const fragment=`uniform float uTime,uNight,uRain,uSpan;uniform vec2 uAnchor;uniform vec3 uSky;varying vec3 vWorld;varying float vWave;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   void main(){vec2 p=vWorld.xz;float a=atan(p.y,p.x)-atan(-60.,-4.);a=atan(sin(a),cos(a));float coast=49.+34.*exp(-pow(a/.43,2.));float offshore=length(p)-coast;
    if(offshore<-.8)discard;
    #ifdef FAR_SEA
    if(max(abs(p.x-uAnchor.x),abs(p.y-uAnchor.y))<uSpan-.025)discard;
    #endif
    float dist=length(cameraPosition.xz-p);float depth=smoothstep(2.,30.,offshore);vec3 col=mix(vec3(.10,.49,.57),vec3(.045,.26,.48),depth);
    float paper=noise(p*.16+vec2(uTime*.018,0.));col*=.93+.12*paper;
    #ifndef FAR_SEA
    float near=1.-smoothstep(35.,100.,dist);float longWave=sin(p.x*.72+p.y*.23+sin(p.y*.35-uTime*.13)*1.6-uTime*.4);
    float sparse=smoothstep(.73,.88,noise(p*.25+uTime*.015));float line=smoothstep(.97,.998,longWave)*sparse*near;
    float shore=smoothstep(.82,.99,sin(offshore*3.2-uTime*.8+noise(p*.4)))*(1.-smoothstep(2.8,5.,offshore))*smoothstep(1.2,2.4,offshore)*.15;
    col=mix(col,vec3(.72,.86,.86),line*.32+shore);
    col+=vec3(.025,.055,.06)*vWave*near;
    #endif
    col=mix(col,col*vec3(.25,.34,.56),uNight);col=mix(col,col*.7+vec3(.06,.07,.07),uRain*.65);
    col=mix(col,uSky,smoothstep(100.,900.,dist)*.84);gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
   }`;
  this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,fragmentShader:fragment,fog:false});
  this.farMaterial=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,fragmentShader:fragment,defines:{FAR_SEA:1},fog:false});
  this.high=new THREE.PlaneGeometry(32,32,low?10:18,low?10:18).rotateX(-Math.PI/2);this.coarse=new THREE.PlaneGeometry(32,32,4,4).rotateX(-Math.PI/2);this.tiles=[];
  for(let z=-this.radius;z<=this.radius;z++)for(let x=-this.radius;x<=this.radius;x++){const m=new THREE.Mesh(this.high,this.material);m.position.y=-5.8;m.userData.offset=[x,z];m.name='近海复用网格';this.group.add(m);this.tiles.push(m);}
  this.far=new THREE.Mesh(new THREE.PlaneGeometry(2800,2800).rotateX(-Math.PI/2),this.farMaterial);this.far.position.y=-5.8;this.far.name='远海地平线 · 两个三角面';this.group.add(this.far);this.frustum=new THREE.Frustum();this.matrix=new THREE.Matrix4();this.box=new THREE.Box3();
 }
 update(t,camera,night=0,rain=0,sky){this.uniforms.uTime.value=t;this.uniforms.uNight.value=night;this.uniforms.uRain.value=rain;if(sky)this.uniforms.uSky.value.copy(sky);const x=Math.round(camera.position.x/32)*32,z=Math.round(camera.position.z/32)*32;this.uniforms.uAnchor.value.set(x,z);camera.updateMatrixWorld();this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const m of this.tiles){m.position.x=x+m.userData.offset[0]*32;m.position.z=z+m.userData.offset[1]*32;const d=Math.hypot(m.position.x-camera.position.x,m.position.z-camera.position.z);m.geometry=d<64?this.high:this.coarse;this.box.min.set(m.position.x-16,-6.05,m.position.z-16);this.box.max.set(m.position.x+16,-5.55,m.position.z+16);m.visible=this.frustum.intersectsBox(this.box);}
 }
}
