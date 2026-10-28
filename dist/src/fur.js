// Shell-texturing fur: each furry part is drawn as N instanced shells pushed along normals.
// Strands are generated procedurally in the fragment shader, so no textures are needed.
import * as THREE from 'three';

// Global lighting uniforms shared by every fur material (updated by main loop)
export const furEnv = {
  uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uAmbient: { value: new THREE.Color(0.55, 0.6, 0.65) },
  uFogColor: { value: new THREE.Color(0.8, 0.9, 0.95) },
  uFogNear: { value: 40 },
  uFogFar: { value: 150 },
  uWind: { value: new THREE.Vector3() },
};

const vert = /* glsl */`
attribute float aShell;
attribute float furLen;
attribute vec3 color;
uniform float uLength;
uniform vec3 uGravity;
uniform vec3 uDisplace;
uniform vec3 uWind;
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vN;
varying float vH;
varying float vDepth;
void main(){
  float h = aShell;
  vec3 n = normalize(normal);
  float L = uLength * furLen;
  vec3 p = position + n * L * h;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  float k = h * h;
  vec3 wob = uWind * (0.6 + 0.4 * sin(uTime * 7.0 + wp.x * 9.0 + wp.z * 7.0));
  wp.xyz += (uGravity + uDisplace + wob) * k * L;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vN = normalize(mat3(modelMatrix) * n);
  vUv = uv;
  vColor = color;
  vH = h;
  vDepth = -mv.z;
}`;

const frag = /* glsl */`
uniform vec2 uDensity;
uniform float uThick;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uTint;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vN;
varying float vH;
varying float vDepth;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float strandShade = 1.0;
  if (vH > 0.001) {
    vec2 g = vUv * uDensity;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float r = hash(id);
    float len = mix(0.55, 1.0, r);
    if (vH > len) discard;
    vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
    float d = length(f - o * 0.3);
    float hh = vH / len;
    float rad = uThick * (1.0 - hh * hh * 0.85);
    if (d > rad) discard;
    strandShade = mix(0.9, 1.06, hash(id + 1.7));
  }
  vec3 n = normalize(vN);
  float ndl = dot(n, uSunDir);
  float diff = smoothstep(-0.55, 0.85, ndl);
  float ao = mix(0.68, 1.04, pow(vH, 0.6));
  vec3 base = vColor * uTint * strandShade;
  vec3 amb = uAmbient * (0.82 + 0.25 * n.y);
  vec3 col = base * (amb + uSunColor * diff) * ao;
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * Build a fur mesh.
 * @param {THREE.BufferGeometry} geometry - geometry with baked scale (uv + normal required)
 * @param {object} o - { length, shells, density:[u,v], thick, colorFn(p,n)->[r,g,b,len] , gravity }
 */
export function makeFur(geometry, o = {}) {
  const geo = geometry.index ? geometry : geometry;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const lens = new Float32Array(pos.count);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    let c = o.colorFn ? o.colorFn(p, n) : [o.color || '#ffffff', 1];
    tmp.set(c[0]);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    lens[i] = c[1] ?? 1;
  }
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = geo.index;
  ig.setAttribute('position', pos);
  ig.setAttribute('normal', nor);
  ig.setAttribute('uv', geo.attributes.uv);
  ig.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ig.setAttribute('furLen', new THREE.BufferAttribute(lens, 1));
  const shells = o.shells ?? 18;
  const sh = new Float32Array(shells);
  for (let i = 0; i < shells; i++) sh[i] = i / (shells - 1);
  ig.setAttribute('aShell', new THREE.InstancedBufferAttribute(sh, 1));
  ig.instanceCount = shells;

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      ...furEnv,
      uLength: { value: o.length ?? 0.1 },
      uDensity: { value: new THREE.Vector2(...(o.density || [60, 30])) },
      uThick: { value: o.thick ?? 0.72 },
      uGravity: { value: new THREE.Vector3(0, -(o.gravity ?? 0.35), 0) },
      uDisplace: o.displace || { value: new THREE.Vector3() },
      uTime: o.time || { value: 0 },
      uTint: o.tint || { value: new THREE.Color(1, 1, 1) },
    },
  });
  const mesh = new THREE.Mesh(ig, mat);
  mesh.frustumCulled = false;
  return mesh;
}
