// Shared toon-shading helpers (Ghibli-ish cel look)
import * as THREE from 'three';

let _grad = null;
export function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([90, 150, 205, 255]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.minFilter = THREE.NearestFilter;
  _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}

const cache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...stripOpts(opts) });
  if (!opts.unique) cache.set(key, m);
  return m;
}
function stripOpts(o) { const c = { ...o }; delete c.unique; return c; }

// Inverted-hull outline for convex-ish meshes
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a2620, side: THREE.BackSide });
export function addOutline(mesh, thickness = 0.03) {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const r = geo.boundingSphere.radius || 1;
  const o = new THREE.Mesh(geo, outlineMat);
  const s = 1 + thickness / r;
  o.scale.setScalar(s);
  o.position.copy(geo.boundingSphere.center).multiplyScalar(1 - s);
  mesh.add(o);
  return o;
}

export function ellipsoid(rx, ry, rz, mat, w = 24, h = 18) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return new THREE.Mesh(g, mat);
}

// cheap deterministic random
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jitter vertices of a geometry for organic, painterly blobs
export function wobble(geo, amount, seed = 1, freq = 2.0) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * freq + seed) * Math.cos(v.y * freq * 1.3 + seed * 2.1) * Math.sin(v.z * freq * 0.9 + seed * 0.7);
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
