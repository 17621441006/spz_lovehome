// Terrain height field, ground mesh, wind-swept grass & flowers
import * as THREE from 'three';
import {villageLaneDistance} from './village-routes.js';
import { toon, rng } from './toon.js';

import {LAYOUT,WALK_PATHS,centralMeadow,forestDepth} from './world-layout.js';
export {LAYOUT} from './world-layout.js';

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function polyDist(px, pz, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, ...pts[i], ...pts[i + 1]));
  return d;
}
export function roadDist(x,z){return villageLaneDistance(x,z);}
export function trailDist(x,z){let d=Infinity;for(const p of WALK_PATHS)d=Math.min(d,polyDist(x,z,p.points));return d;}
export function trailEdge(x,z){let d=Infinity;for(const p of WALK_PATHS)d=Math.min(d,polyDist(x,z,p.points)-p.width);return d;}
// The island edge bulges north to make room for the lake (radius varies with direction only).
const LAKE_DIR = Math.atan2(LAYOUT.lake.z, LAYOUT.lake.x);
export function edgeRadius(x, z) { let d = Math.atan2(z, x) - LAKE_DIR; d = Math.atan2(Math.sin(d), Math.cos(d)); let summit=Math.atan2(z,x)-Math.atan2(40,23);summit=Math.atan2(Math.sin(summit),Math.cos(summit));return LAYOUT.playRadius+6*Math.exp(-((summit/.23)**2))+LAYOUT.lakeLobe*Math.exp(-((d/LAYOUT.lakeLobeWidth)**2)); }
// Organic shoreline radius of the lake for a given direction from its centre.
export function lakeShore(x, z) { const L = LAYOUT.lake, a = Math.atan2(z - L.z, x - L.x); return L.r * (1 + 0.07 * Math.sin(3 * a + 0.6) + 0.045 * Math.sin(5 * a + 2.1)); }
export function lakeDist(x, z) { return Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z); }
/** true where the lake is too deep to walk (the pier is handled by colliders). */
export function inLakeWater(x, z, pad = 0) { return lakeDist(x, z) < lakeShore(x, z) - 0.35 - pad; }
/** random point inside the playable island (main disc or the lake lobe). */
export function randomIslandPoint(R, maxR = 47) {
  if (R() < 0.2) for (let i = 0; i < 12; i++) { const x = LAYOUT.lake.x + (R() - 0.5) * 60, z = LAYOUT.lake.z + (R() - 0.5) * 46; if (Math.hypot(x, z) > maxR && Math.hypot(x, z) < edgeRadius(x, z) - 2.5) return [x, z]; }
  const a = R() * Math.PI * 2, r = Math.sqrt(R()) * maxR; return [Math.cos(a) * r, Math.sin(a) * r];
}
export const catbusRouteDist=villageLaneDistance;

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Shared by the soil, short meadow blades and clover. Snow changes their surface
// only: the established height field and every tree contact remain identical.
export const terrainSnow = { value: 0 };
export function setTerrainSnow(amount) { terrainSnow.value = THREE.MathUtils.clamp(amount, 0, 1); }

const meadowFragment = /* glsl */`
uniform float uTerrainSnow;
varying vec2 vMeadowXZ;
varying float vMeadowSlope;
float meadowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(meadowHash(i),meadowHash(i+vec2(1,0)),f.x),mix(meadowHash(i+vec2(0,1)),meadowHash(i+vec2(1,1)),f.x),f.y);}
`;

function meadowMaterial(texture) {
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:texture});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uTerrainSnow=terrainSnow;
    shader.vertexShader='varying vec2 vMeadowXZ;\nvarying float vMeadowSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMeadowXZ=position.xz;vMeadowSlope=normal.y;');
    shader.fragmentShader=meadowFragment+shader.fragmentShader;
    // Standard materials multiply vertex color after the map. Apply the snow
    // after that multiply, otherwise the grass vertex colors tint it green.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',/* glsl */`
      #include <color_fragment>
      // Broad watercolor washes stay visible beneath close-up grassy brushwork.
      float wash=meadowNoise(vMeadowXZ*.42)*.62+meadowNoise(vMeadowXZ*1.65)*.38;
      float fibers=meadowNoise(vMeadowXZ*vec2(17.0,7.0));
      float textureDetail=dot(texture2D(map,vMapUv).rgb,vec3(.299,.587,.114));
      vec3 meadowColor=diffuseColor.rgb;
      meadowColor*=.79+wash*.37+textureDetail*.18;
      meadowColor=mix(meadowColor,meadowColor*vec3(.86,1.055,.88),smoothstep(.42,.78,wash)*.44);
      meadowColor+=vec3(.065,.055,.018)*smoothstep(.66,.93,fibers);
      // Tiny irregular clover/leaf shadows bridge the soil and the instanced plants.
      vec2 cell=vMeadowXZ*3.1, id=floor(cell), q=fract(cell)-.5;
      float angle=meadowHash(id+31.0)*6.283185;
      q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
      float leaves=min(length((q-vec2(.12,.06))*vec2(1.0,1.3)),min(length((q-vec2(-.1,.07))*vec2(1.1,1.2)),length((q-vec2(0,-.12))*vec2(1.2,1.0))));
      float leaf=(1.0-smoothstep(.08,.155,leaves))*step(.52,meadowHash(id));
      meadowColor*=1.0-leaf*.12;
      float powder=uTerrainSnow*smoothstep(.35,.85,vMeadowSlope);
      powder*=.97+wash*.03;
      vec3 snowColor=mix(vec3(.87,.92,1.0),vec3(1.0,.995,.98),.5+.25*sin(vMeadowXZ.x*.21+sin(vMeadowXZ.y*.13))+.25*cos(vMeadowXZ.y*.27-vMeadowXZ.x*.09));
      diffuseColor.rgb=mix(meadowColor,snowColor,powder);
    `);
  };
  mat.customProgramCacheKey=()=> 'painted-meadow-snow-v6-after-color';
  return mat;
}

function rawHeightAt(x, z) {
  const rd=roadDist(x,z),td=trailDist(x,z);
  let h = 0.35 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4)
    + 0.18 * Math.sin((x + z) * 0.21) + 0.08 * Math.cos(x * 0.37 - z * 0.29);
  // flatten around structures & road
  const L = LAYOUT;
  let f = 1;
  f = Math.min(f, ss(7, 12, Math.hypot(x - L.house.x, z - L.house.z)));
  f = Math.min(f, ss(4, 8, Math.hypot(x - L.totoro.x, z - L.totoro.z)));
  f = Math.min(f, ss(1.5, 5, rd));
  h = h * (0.25 + 0.75 * f);
  h += 4.7 * ss(10,38,z) * Math.exp(-Math.pow((x-23)/8,4));
  const r = Math.hypot(x, z);
  // Local landforms leave the original central garden and eastern shrine route intact.
  const west=1-ss(8,16,x),outer=ss(16,25,r),pathClear=ss(1.4,4,Math.min(rd,td));
  const hill=(cx,cz,sx,sz)=>Math.exp(-(((x-cx)/sx)**2+((z-cz)/sz)**2));
  const land=3.0*hill(-32,-28,15,12)+2.1*hill(-30,40,18,12)-1.2*hill(-7,-30,7,13)+3.1*hill(-48,-5,7,21);
  h+=land*west*outer*pathClear;
  h+=1.7*hill(43,-31,12,13)*ss(1.6,4,td);
  // A quiet, low central meadow; relief and woodland belong between clearings.
  h*=1-.6*(1-ss(10,18,Math.hypot(x,z-5)));
  // A shallow rise behind the welcoming tree, fading completely off every
  // path and bus lane. The crossroads and original building pads stay level.
  h+=.38*Math.exp(-(((x+7.5)/4.3)**2+((z-9.3)/3.6)**2))*ss(1.6,3.4,td)*ss(2.4,4.3,rd);
  // A finite grassy plateau falls into cloud-filled ravines beyond the play edge.
  const edge=edgeRadius(x,z);
  h-=11*ss(edge,edge+L.terrainRadius-L.playRadius,r);
  // lake: calm the meadow around it, lift a soft rim, then carve the basin
  const dl=lakeDist(x,z);
  if(dl<L.lake.r+22){const shore=lakeShore(x,z),calm=ss(shore+18,shore+6,dl);h=THREE.MathUtils.lerp(h,h*.35+.32,calm);h=THREE.MathUtils.lerp(h,-2.4,ss(shore+1.1,shore-3.2,dl));}
  // 林间倒影池：新开的一小片静水，中央留一口深井给倒着的屋子
  if (L.reflection) {
    const rp = L.reflection, d = Math.hypot(x - rp.poolX, z - rp.poolZ);
    if (d < rp.poolR + 4.5) {
      const bank = 1 - ss(rp.poolR - 2.0, rp.poolR + 1.2, d);
      h = THREE.MathUtils.lerp(h, rp.y - 0.35, bank);
      const deep = 1 - ss(rp.poolR * 0.24, rp.poolR * 0.72, d);
      h -= deep * 6.3;
    }
  }
  const dp = Math.hypot(x - L.pond.x, z - L.pond.z);
  if (dp < L.pond.r + 1.5) h -= 0.75 * ss(L.pond.r + 1.5, L.pond.r - 0.8, dp);
  if (rd < 1.6) h -= 0.05 * ss(1.6, 0.8, rd);
  return h;
}

export function heightAt(x,z){
 let h=rawHeightAt(x,z);
 const nest=LAYOUT.toriiNest,nd=Math.hypot(x-nest.x,z-nest.z);
 if(nd<nest.flat+3)h=THREE.MathUtils.lerp(h,.25,1-ss(nest.flat,nest.flat+3,nd));
 const e=LAYOUT.elder,d=Math.hypot(x-e.x,z-e.z),w=1-ss(e.flat,e.blend,d);
 if(w>0)h=THREE.MathUtils.lerp(h,rawHeightAt(e.x,e.z),w);
 for(const b of LAYOUT.buildings){const d=Math.hypot(x-b.x,z-b.z),w=1-ss(b.flat,b.flat+3,d);if(w>0)h=THREE.MathUtils.lerp(h,rawHeightAt(b.x,b.z),w);}
 return h;
}
export function buildTerrain() {
  const rings=132,sectors=320,verts=[0,heightAt(0,0),0],uv=[.5,.5],indices=[];
  for(let ring=1;ring<=rings;ring++)for(let j=0;j<sectors;j++){const a=j/sectors*Math.PI*2,R0=edgeRadius(Math.cos(a),Math.sin(a))+LAYOUT.terrainRadius-LAYOUT.playRadius,r=R0*ring/rings,x=Math.cos(a)*r,z=Math.sin(a)*r;verts.push(x,heightAt(x,z),z);uv.push(.5+x/108,.5+z/108);}
  for(let j=0;j<sectors;j++)indices.push(0,1+(j+1)%sectors,1+j);
  for(let r=2;r<=rings;r++)for(let j=0;j<sectors;j++){const a=1+(r-2)*sectors+j,b=1+(r-2)*sectors+(j+1)%sectors,c=1+(r-1)*sectors+j,d=1+(r-1)*sectors+(j+1)%sectors;indices.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#7d9c4b'), grassB = new THREE.Color('#a1b765'), grassC = new THREE.Color('#557d50');
  const cliff = new THREE.Color('#899284'),dirt = new THREE.Color('#b59a6a'), mud = new THREE.Color('#5a5a3a'), forest = new THREE.Color('#355e2b');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5 + Math.sin(x * 1.3 + z * 0.7) * 0.15;
    c.copy(grassA).lerp(grassB, Math.max(0, Math.min(1, n)));
    const r = Math.hypot(x, z);
    c.lerp(forest, .35*ss(30, 43, r));
    c.lerp(new THREE.Color('#45655a'),forestDepth(x,z)*.38);
    const slope=Math.hypot(heightAt(x+.3,z)-heightAt(x-.3,z),heightAt(x,z+.3)-heightAt(x,z-.3))/.6;
    c.lerp(cliff,ss(.5,1.3,slope)*.72);
    c.lerp(forest,ss(.45,1.2,slope)*forestDepth(x,z)*.38);
    const edge=edgeRadius(x,z);c.lerp(cliff,ss(edge,edge+LAYOUT.terrainRadius-LAYOUT.playRadius-.5,r));
    const dl=lakeDist(x,z),shore=lakeShore(x,z);c.lerp(dirt,.5*ss(shore+1.8,shore+.3,dl));c.lerp(mud,ss(shore-.1,shore-1.4,dl));
    const dc = Math.hypot(x - LAYOUT.camphor.x, z - LAYOUT.camphor.z);
    c.lerp(grassC, ss(12, 4, dc) * 0.7);
    const rd = roadDist(x, z);
    c.lerp(dirt, .38*ss(2.05, 1.25, rd + Math.sin(x * 2 + z) * 0.15));
    const td = trailEdge(x, z);
    c.lerp(dirt, .88*ss(.3,-.2,td+Math.sin(x*3.1+z*2.3)*.10));
    const dp = Math.hypot(x - LAYOUT.pond.x, z - LAYOUT.pond.z);
    c.lerp(mud, ss(LAYOUT.pond.r + 0.8, LAYOUT.pond.r - 0.2, dp));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const texture=new THREE.TextureLoader().load('assets/textures/forest-floor.jpg'); texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(42,42);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const mat=meadowMaterial(texture);
  const m = new THREE.Mesh(g, mat);
  m.name='草坡、谷地与云海断崖';m.receiveShadow = true;
  return m;
}

// ---------- grass ----------
const grassVert = /* glsl */`
attribute vec3 aOffset;
attribute float aRot;
attribute float aScale;
attribute float aHue;
uniform float uTime;
uniform vec3 uCat;
uniform vec4 uRoar; // x,z,strength,time
uniform float uRain;
varying float vH;
varying float vHue;
varying float vDepth;
void main(){
  vec3 p = position;
  float hgt = p.y;
  p.y *= aScale;
  p.xz *= 0.8 + aScale * 0.6;
  float c = cos(aRot), s = sin(aRot);
  p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  vec3 wp = aOffset + p;
  float bend = hgt * hgt;
  float w = sin(uTime * 1.6 + aOffset.x * 0.33 + aOffset.z * 0.21) * 0.6 + sin(uTime * 3.3 + aOffset.x * 1.3 + aOffset.z) * 0.18;
  w *= 1.0 + uRain * 0.6;
  wp.x += w * 0.13 * bend * aScale * 2.0;
  wp.z += w * 0.06 * bend * aScale * 2.0;
  // push away from the cat
  vec2 d = aOffset.xz - uCat.xz;
  float dist = length(d);
  float push = (1.0 - smoothstep(0.15, 0.85, dist)) * bend;
  wp.xz += normalize(d + 1e-4) * push * 0.4;
  wp.y -= push * 0.18;
  // totoro roar gust
  vec2 rd = aOffset.xz - uRoar.xy;
  float rdist = length(rd);
  float gust = uRoar.z * exp(-rdist * 0.08) * (0.7 + 0.3 * sin(uTime * 20.0 + rdist));
  wp.xz += normalize(rd + 1e-4) * gust * bend * 0.6;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  vH = hgt;
  vHue = aHue;
  vDepth = -mv.z;
}`;
const grassFrag = /* glsl */`
uniform vec3 uBase;
uniform vec3 uTip;
uniform vec3 uLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uSnow;
varying float vH;
varying float vHue;
varying float vDepth;
void main(){
  vec3 tip = uTip * (0.85 + vHue * 0.35);
  tip = mix(tip, vec3(0.75, 0.72, 0.25), smoothstep(0.85, 1.0, vHue) * 0.5);
  vec3 col = mix(uBase, tip, smoothstep(0.0, 1.0, vH));
  col = mix(col,vec3(.96,.98,1.0),uSnow*smoothstep(.03,.42,vH)*.92);
  col *= uLight;
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export const grassUniforms = {
  uTime: { value: 0 },
  uCat: { value: new THREE.Vector3() },
  uRoar: { value: new THREE.Vector4(0, 0, 0, 0) },
  uRain: { value: 0 },
  uSnow: terrainSnow,
  uBase: { value: new THREE.Color('#456b32') },
  uTip: { value: new THREE.Color('#a3b86b') },
  uLight: { value: new THREE.Color(1, 1, 1) },
  uFogColor: { value: new THREE.Color() },
  uFogNear: { value: 40 },
  uFogFar: { value: 150 },
};

function tuftGeometry() {
  const verts = [], idx = [];
  const blades = 5;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI + (b * 0.37);
    const ca = Math.cos(a), sa = Math.sin(a);
    const ox = Math.sin(b*2.4)*.09, oz = Math.cos(b*2.4)*.09;
    const lean = 0.22 + b * 0.04;
    const base = verts.length / 3;
    const segs = 2;
    for (let s = 0; s <= segs; s++) {
      const y = s / segs;
      const w = 0.014 * (1 - y * 0.8);
      const fwd = y * y * lean;
      for (const side of [-1, 1]) {
        if (s === segs && side === 1) continue;
        const lx = s === segs ? 0 : side * w;
        verts.push(ox + lx * ca - fwd * sa, y, oz + lx * sa + fwd * ca);
      }
    }
    for (let s = 0; s < segs - 1; s++) {
      const i0 = base + s * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
    const last = base + (segs - 1) * 2;
    idx.push(last, last + 1, last + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  return g;
}

export function buildGrass(count, exclude) {
  const base = tuftGeometry();
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  const off = new Float32Array(count * 3), rot = new Float32Array(count), sc = new Float32Array(count), hue = new Float32Array(count);
  const R = rng(42);
  let n = 0, tries = 0;
  while (n < count && tries < count * 4) {
    tries++;
    const [x, z] = randomIslandPoint(R, LAYOUT.treeLimit);
    if (lakeDist(x, z) < lakeShore(x, z) + 0.3) continue;
    if (roadDist(x, z) < 1.2) continue;
    if (trailEdge(x,z)<.1) continue;
    if (Math.hypot(x - LAYOUT.pond.x, z - LAYOUT.pond.z) < LAYOUT.pond.r + 0.2) continue;
    if (exclude && exclude(x, z)) continue;
    off[n * 3] = x; off[n * 3 + 1] = heightAt(x, z) - 0.02; off[n * 3 + 2] = z;
    rot[n] = R() * Math.PI * 2;
    const patch = 0.5 + 0.5 * Math.sin(x * 0.25 + 2) * Math.cos(z * 0.21);
    sc[n] = 0.11 + R() * 0.10 + patch * 0.12;
    hue[n] = R();
    n++;
  }
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  g.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 1));
  g.setAttribute('aScale', new THREE.InstancedBufferAttribute(sc, 1));
  g.setAttribute('aHue', new THREE.InstancedBufferAttribute(hue, 1));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({ vertexShader: grassVert, fragmentShader: grassFrag, uniforms: grassUniforms, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.name='风中的细草';
  const meadow=new THREE.Group();meadow.name='细草与三叶草';meadow.add(mesh,buildClover(Math.floor(count*.13),exclude));
  return meadow;
}

function buildClover(count,exclude){
  const vertices=[],indices=[],colors=[],green=new THREE.Color('#718e4c'),light=new THREE.Color('#a5ba76');
  // Three rounded, slightly folded leaves, close to the soil; 18 triangles/plant.
  for(let leaf=0;leaf<3;leaf++){
    const a=leaf*Math.PI*2/3,cx=Math.cos(a)*.045,cz=Math.sin(a)*.045,start=vertices.length/3;
    vertices.push(cx,.04,cz);colors.push(light.r,light.g,light.b);
    for(let j=0;j<6;j++){const b=j/6*Math.PI*2,x=cx+Math.cos(b)*.047,z=cz+Math.sin(b)*.037;vertices.push(x,.025+Math.sin(b)*.012,z);colors.push(green.r,green.g,green.b);}
    for(let j=0;j<6;j++)indices.push(start,start+1+j,start+1+(j+1)%6);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
  mat.onBeforeCompile=shader=>{shader.uniforms.uTerrainSnow=terrainSnow;shader.fragmentShader='uniform float uTerrainSnow;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.97,.98,1.0),uTerrainSnow*.95);');};
  mat.customProgramCacheKey=()=> 'meadow-clover-snow-v6';
  const mesh=new THREE.InstancedMesh(geo,mat,count),R=rng(194),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),scale=new THREE.Vector3();let n=0,tries=0;
  while(n<count&&tries<count*8){tries++;const [x,z]=randomIslandPoint(R,LAYOUT.treeLimit-2);if(lakeDist(x,z)<lakeShore(x,z)+.4)continue;
    if(roadDist(x,z)<1.35||trailEdge(x,z)<.15||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+.3||(exclude&&exclude(x,z)))continue;
    const patch=.5+.5*Math.sin(x*.73+z*.13)*Math.cos(z*.48);if(R()>patch*.85+.1)continue;
    const s=.7+R()*1.2;matrix.compose(p.set(x,heightAt(x,z)+.012,z),q.setFromAxisAngle(new THREE.Vector3(0,1,0),R()*Math.PI*2),scale.setScalar(s));mesh.setMatrixAt(n++,matrix);
  }
  mesh.count=n;mesh.name='草甸里的三叶草';mesh.receiveShadow=true;mesh.frustumCulled=false;return mesh;
}

export function buildFlowers(count, exclude) {
  const group = new THREE.Group();
  const R = rng(7);
  const headGeo = new THREE.IcosahedronGeometry(0.06, 0);
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.01, 1, 3);
  stemGeo.translate(0, 0.5, 0);
  const cols = ['#ffffff', '#fff3a8', '#f7c6d9', '#c9b8f0', '#ffd27a'];
  const heads = new THREE.InstancedMesh(headGeo, toon('#ffffff'), count);
  const stems = new THREE.InstancedMesh(stemGeo, toon('#4c7a2a'), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  let n = 0;
  while (n < count) {
    // clustered patches
    const [cx, cz] = randomIslandPoint(R, LAYOUT.treeLimit-2);
    for (let k = 0; k < 8 && n < count; k++) {
      const x = cx + (R() - 0.5) * 3, z = cz + (R() - 0.5) * 3;
      if (Math.hypot(x, z) > edgeRadius(x, z) - 3 || lakeDist(x, z) < lakeShore(x, z) + 0.6 || roadDist(x, z) < 1.4 || Math.hypot(x - LAYOUT.pond.x, z - LAYOUT.pond.z) < LAYOUT.pond.r + 0.4) continue;
      if (trailEdge(x,z)<.25 || (centralMeadow(x,z)&&R()<.8) || (exclude && exclude(x, z))) continue;
      const h = 0.25 + R() * 0.25, y = heightAt(x, z);
      m.compose(p.set(x, y, z), q.identity(), s.set(1, h, 1));
      stems.setMatrixAt(n, m);
      m.compose(p.set(x, y + h, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), s.setScalar(0.8 + R() * 0.6).setY(0.6));
      heads.setMatrixAt(n, m);
      heads.setColorAt(n, c.set(cols[Math.floor(R() * cols.length)]));
      n++;
    }
  }
  group.add(heads, stems);
  return group;
}
