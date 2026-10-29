// Static world: sky, clouds, trees, camphor tree & shrine, house, bus stop, pond, platforms, particles
import * as THREE from 'three';
import { toon, rng, wobble, ellipsoid } from './toon.js';
import { LAYOUT, heightAt, roadDist, catbusRouteDist } from './terrain.js';
import { createDreamWater } from './dream.js';
import { nearLake } from './lake.js';

export const colliders = []; // {type:'circle'|'box', x,z,r | minX..., top, bounce?, onBounce?}
export const lilyPads = [];

export function groundAt(x, z, y = Infinity, catR = 0) {
  let g = heightAt(x, z);
  for (const c of colliders) {
    if(c.type==='heightfield'){const top=c.sample(x,z);if(top<=y+.35&&top>g)g=top;continue;}
    if (c.top > y + 0.35) continue;
    if (c.top <= g) continue;
    if(c.type==='annulus'){const d=Math.hypot(x-c.x,z-c.z);if(d>=c.inner&&d<=c.outer)g=c.top;}
    else if (c.type === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + catR * 0.4) g = c.top;
    } else if (x > c.minX - catR * 0.4 && x < c.maxX + catR * 0.4 && z > c.minZ - catR * 0.4 && z < c.maxZ + catR * 0.4) g = c.top;
  }
  return g;
}

// ---------- geometry helpers ----------
export function mergeGeos(items) {
  let vCount = 0, iCount = 0;
  const prepared = items.map(({ geo, color }) => {
    const g = geo.index ? geo : indexify(geo);
    vCount += g.attributes.position.count; iCount += g.index.count;
    return { g, color: new THREE.Color(color) };
  });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const { g, color } of prepared) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (vo + i) * 3);
      nor.set([n.getX(i), n.getY(i), n.getZ(i)], (vo + i) * 3);
      col.set([color.r, color.g, color.b], (vo + i) * 3);
    }
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
    vo += p.count; io += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function indexify(g) {
  const n = g.attributes.position.count;
  const idx = []; for (let i = 0; i < n; i++) idx.push(i);
  g.setIndex(idx);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
const vcMat = () => toon('#ffffff', { vertexColors: true });

function blob(r, x, y, z, seed, sy = 0.85) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('uv');
  wobble(g, 0.12, seed, 2.6);
  g.scale(r, r * sy, r);
  g.translate(x, y, z);
  return g;
}

// ---------- sky ----------
export const skyUniforms = {
  uTop: { value: new THREE.Color('#367fca') },
  uHorizon: { value: new THREE.Color('#b3d9ed') },
  uBottom: { value: new THREE.Color('#bed6cb') },
  uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  uNight: { value: 0 },
  uRain: { value: 0 },
};
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uBottom, uSunDir; uniform float uNight, uRain;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(uHorizon, uTop, pow(clamp(y,0.0,1.0), 0.42));
        if (y < 0.0) col = mix(uHorizon, uBottom, smoothstep(0.0, 0.25, -y));
        float sd = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0, 0.88, 0.70) * pow(sd, 72.0) * 0.24 * (1.0 - uRain);
        // moon
        col = mix(col, vec3(1.0, 0.98, 0.85), smoothstep(0.9985, 0.999, sd) * uNight * (1.0 - uRain));
        col += vec3(0.6,0.7,1.0) * pow(sd, 200.0) * uNight * 0.4;
        // stars
        vec2 uv = vec2(atan(d.z, d.x) * 90.0, asin(clamp(y,-1.0,1.0)) * 90.0);
        vec2 id = floor(uv);
        float h = hash(id);
        float star = step(0.993, h) * smoothstep(0.45, 0.0, length(fract(uv) - 0.5));
        col += vec3(star) * uNight * (1.0 - uRain) * smoothstep(0.05, 0.3, y);
        // World-stable paper grain and broad blue washes, with no camera shake.
        float grain=hash(floor(d.xz*4200.0+d.y*730.0))-.5;
        float wash=sin(d.x*11.0+d.y*5.0)*sin(d.z*8.0-d.y*3.0);
        col+=(grain*.0035+wash*.006)*(1.0-uNight)*(1.0-uRain);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

// Four genuinely painted silhouettes share one compressed alpha atlas.
const cloudAtlas=new THREE.TextureLoader().load('assets/clouds-painted.webp');cloudAtlas.colorSpace=THREE.SRGBColorSpace;
export const cloudMat = new THREE.MeshBasicMaterial({map:cloudAtlas,color:'#ffffff',transparent:true,alphaTest:.025,depthWrite:false,fog:false,toneMapped:false});
function buildClouds(){
 const g=new THREE.Group();g.name='手绘晴空 · 积云与薄云';const R=rng(22109);
 const rects=[[72,124,565,610],[693,276,1226,567],[57,812,571,1133],[681,847,1206,1119]],kinds=['tower','bank','small','wisp'];
 for(let i=0;i<22;i++){const type=[0,2,1,3,2,1,3][i%7],rect=rects[type].map((v,k)=>v+(k<2?-6:6)),a=i/22*Math.PI*2+(R()-.5)*.18,dist=265+R()*65,w=(type===0?65:type===1?85:type===2?27:100)*(.8+R()*.4),h=w*(rect[3]-rect[1])/(rect[2]-rect[0]);
  const geo=new THREE.PlaneGeometry(w,h),uv=geo.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,THREE.MathUtils.lerp(rect[0]/1254,rect[2]/1254,uv.getX(j)),THREE.MathUtils.lerp(1-rect[3]/1254,1-rect[1]/1254,uv.getY(j)));
  const m=new THREE.Mesh(geo,cloudMat);m.name='手绘'+kinds[type];m.position.set(Math.cos(a)*dist,(type===3?23:type===2?45+R()*48:35)+h*.5,Math.sin(a)*dist);m.lookAt(0,m.position.y,0);m.renderOrder=-2;m.userData.cloudKind=kinds[type];g.add(m);
 }
 g.userData.cloudKinds=kinds;return g;
}

// ---------- trees ----------
function roundTree(R, seed, scale = 1) {
  const grp = new THREE.Group();
  const th = 2.2 + R() * 1.2;
  const tg = new THREE.CylinderGeometry(0.22, 0.38, th, 7);
  tg.translate(0, th / 2, 0);
  const trunk = new THREE.Mesh(tg, toon('#6e5039'));
  trunk.castShadow = true;
  grp.add(trunk);
  const parts = [];
  const greens = ['#4f7f2c', '#5f9433', '#3f6c28', '#6fa23c'];
  const n = 5 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = R() * 1.3;
    const r = 1.1 + R() * 0.9;
    const y = th + 0.6 + R() * 1.6;
    parts.push({ geo: blob(r, Math.cos(a) * d, y, Math.sin(a) * d, seed + i), color: greens[Math.floor(R() * greens.length)] });
  }
  parts.push({ geo: blob(1.6, 0, th + 2.4, 0, seed + 20), color: '#6aa03a' });
  const canopy = new THREE.Mesh(mergeGeos(parts), vcMat());
  canopy.castShadow = true;
  grp.add(canopy);
  grp.scale.setScalar(scale);
  return grp;
}
function cedarTree(R, scale = 1) {
  const grp = new THREE.Group();
  const tg = new THREE.CylinderGeometry(0.15, 0.3, 2, 6); tg.translate(0, 1, 0);
  const trunk = new THREE.Mesh(tg, toon('#5a3e2c')); trunk.castShadow = true; grp.add(trunk);
  const parts = [];
  const tiers = 4 + Math.floor(R() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = 1.9 * (1 - i / (tiers + 1)) + 0.2;
    const cg = new THREE.ConeGeometry(r, 2.4, 9);
    cg.translate(0, 2.2 + i * 1.35, 0);
    parts.push({ geo: cg, color: i % 2 ? '#2f5a2c' : '#38663a' });
  }
  const c = new THREE.Mesh(mergeGeos(parts), vcMat()); c.castShadow = true; grp.add(c);
  grp.scale.setScalar(scale);
  return grp;
}
function bush(R, seed, s = 1) {
  const parts = [];
  for (let i = 0; i < 4; i++) parts.push({ geo: blob(0.5 + R() * 0.4, (R() - 0.5) * 1.2, 0.35 + R() * 0.3, (R() - 0.5) * 1.2, seed + i), color: R() > 0.5 ? '#4e8a2e' : '#5f9a36' });
  const m = new THREE.Mesh(mergeGeos(parts), vcMat());
  m.castShadow = true; m.scale.setScalar(s);
  return m;
}

// ---------- the great camphor tree ----------
function camphorTree() {
  const { x, z } = LAYOUT.camphor;
  const grp = new THREE.Group();
  grp.position.set(x, heightAt(x, z) - 0.1, z);
  const prof = [];
  const pts = [[3.0, 0], [2.6, 0.4], [2.4, 1.2], [2.1, 3], [1.9, 6], [2.2, 8.5], [2.8, 10]];
  const curve = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1])));
  for (const p of curve.getPoints(30)) prof.push(p);
  const tg = new THREE.LatheGeometry(prof, 20);
  const pp = tg.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const vx = pp.getX(i), vy = pp.getY(i), vz = pp.getZ(i);
    const a = Math.atan2(vz, vx);
    const k = 1 + 0.12 * Math.sin(a * 5 + vy * 0.6) + (vy < 1.5 ? 0.15 * Math.max(0, Math.sin(a * 4)) * (1.5 - vy) : 0);
    pp.setXYZ(i, vx * k, vy, vz * k);
  }
  tg.computeVertexNormals();
  const bark = toon('#6b5544');
  const trunk = new THREE.Mesh(tg, bark); trunk.castShadow = true; trunk.receiveShadow = true;
  grp.add(trunk);
  // big branches
  const R = rng(5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const len = 6 + R() * 2;
    const bg = new THREE.CylinderGeometry(0.45, 0.9, len, 7);
    bg.translate(0, len / 2, 0);
    const b = new THREE.Mesh(bg, bark);
    b.position.set(Math.cos(a) * 1.2, 8.5, Math.sin(a) * 1.2);
    b.rotation.set(0, -a, 0); b.rotateZ(-0.85 - R() * 0.25);
    b.castShadow = true;
    grp.add(b);
  }
  // canopy
  const parts = [];
  const greens = ['#3f6f2a', '#4c7f30', '#5a9236', '#366226', '#6a9f3c'];
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 9;
    const y = 12 + R() * 6 - d * 0.35;
    const r = 3 + R() * 2.4;
    parts.push({ geo: blob(r, Math.cos(a) * d, y, Math.sin(a) * d, i * 3.3, 0.75), color: greens[Math.floor(R() * greens.length)] });
  }
  for (let i = 0; i < 6; i++) parts.push({ geo: blob(3.4, (R() - 0.5) * 6, 18 + R() * 2, (R() - 0.5) * 6, 50 + i, 0.8), color: '#74a843' });
  const canopy = new THREE.Mesh(mergeGeos(parts), vcMat());
  canopy.castShadow = true;
  grp.add(canopy);
  // shimenawa rope with shide paper
  const rope = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.16, 8, 40), toon('#d8c084'));
  rope.rotation.x = Math.PI / 2; rope.position.y = 2.7;
  grp.add(rope);
  const paperMat = toon('#ffffff', { side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const zig = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), paperMat);
      p.position.set(k % 2 ? 0.07 : -0.03, -0.15 - k * 0.2, 0);
      zig.add(p);
    }
    zig.position.set(Math.cos(a) * 2.35, 2.65, Math.sin(a) * 2.35);
    zig.rotation.y = -a + Math.PI / 2;
    grp.add(zig);
  }
  // the hollow (Totoro's den entrance)
  const hole = ellipsoid(0.8, 1.0, 0.3, toon('#2a1f17'));
  hole.position.set(0.537 * 2.45, 0.9, 0.844 * 2.45);
  hole.rotation.y = Math.atan2(0.537, 0.844);
  grp.add(hole);
  colliders.push({ type: 'circle', x, z, r: 3.2, top: 999 });
  return grp;
}

export function createTorii(x=-8.6, z=-7.6, rotation=Math.atan2(-5,-6), ground=heightAt(x,z), scale=1) {
  const g = new THREE.Group();
  const red = toon('#c8402c'), black = toon('#2b2622');
  for (const sx of [-1.3, 1.3]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.1, 10), red);
    p.position.set(sx, 1.55, 0); p.castShadow = true; g.add(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10), black);
    base.position.set(sx, 0.15, 0); g.add(base);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 0.32), black); top.position.y = 3.15; g.add(top);
  const top2 = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 0.28), red); top2.position.y = 2.97; g.add(top2);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 0.18), red); nuki.position.y = 2.45; g.add(nuki);
  g.position.set(x, ground, z);
  g.rotation.y = rotation; g.scale.setScalar(scale);
  g.updateMatrixWorld();
  for (const sx of [-1.3, 1.3]) {
    const v = new THREE.Vector3(sx, 0, 0).applyMatrix4(g.matrixWorld);
    colliders.push({ type: 'circle', x: v.x, z: v.z, r: 0.2, top: 999 });
  }
  return g;
}

function hokora() {
  const g = new THREE.Group();
  const stone = toon('#9a9a8e');
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.8), stone); base.position.y = 0.25; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), toon('#7d6a52')); body.position.y = 0.75; g.add(body);
  const hrG = new THREE.ConeGeometry(0.62, 0.35, 4); hrG.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(hrG, toon('#4f5560')); roof.position.y = 1.17; roof.scale.set(1.2, 1, 1); g.add(roof);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const x = -10, z = -11.2;
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = 0.7;
  colliders.push({ type: 'circle', x, z, r: 0.55, top: heightAt(x, z) + 1.0 });
  return g;
}

// ---------- house ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export const windowMats = [];
function house() {
  const { x, z } = LAYOUT.house;
  const g = new THREE.Group();
  const gy = heightAt(x, z);
  g.position.set(x, gy, z);
  const W = 9, D = 6, H = 2.7, F = 0.45;
  const wood = toon('#6a4a32'), plaster = toon('#efe6d2'), darkWood = toon('#4d3626');
  const found = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, F, D + 0.2), toon('#8b8578')); found.position.y = F / 2; g.add(found);
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), plaster); body.position.y = F + H / 2; g.add(body);
  // posts
  for (let i = 0; i <= 6; i++) {
    const px = -W / 2 + (i / 6) * W;
    for (const pz of [-D / 2 - 0.01, D / 2 + 0.01]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.06), wood); p.position.set(px, F + H / 2, pz); g.add(p);
    }
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.18, D + 0.1), wood); beam.position.y = F + H - 0.1; g.add(beam);
  // shoji front
  const shoji = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f6f0de'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6a4a32'; ctx.lineWidth = 6;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); }
    for (let i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 6); ctx.lineTo(w, i * h / 6); ctx.stroke(); }
  });
  const shojiMat = new THREE.MeshToonMaterial({ map: shoji, emissive: '#ffb860', emissiveIntensity: 0 });
  windowMats.push(shojiMat);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.35, H - 0.4), shojiMat);
    p.position.set(-W / 2 + 0.75 + i * 1.5, F + (H - 0.4) / 2 + 0.05, -D / 2 - 0.04);
    p.rotation.y = Math.PI;
    g.add(p);
  }
  // engawa veranda (standable)
  const eng = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 1.3), toon('#a07b52'));
  eng.position.set(0, F + 0.05, -D / 2 - 0.65); g.add(eng);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, F, 0.12), darkWood);
    leg.position.set(-W / 2 + 0.2 + i * (W - 0.4) / 4, F / 2, -D / 2 - 1.2); g.add(leg);
  }
  // hip roof
  const roofG = new THREE.ConeGeometry(1, 1, 4, 1); roofG.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofG, toon('#55606e'));
  roof.scale.set((W + 2.2) * 0.7071, 2.4, (D + 2.4) * 0.7071);
  roof.position.y = F + H + 1.2;
  g.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.45, 0.2, 0.3), toon('#3d4550')); ridge.position.y = F + H + 2.35; g.add(ridge);
  // western annex with red roof
  const ax = W / 2 + 1.6;
  const annex = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 3.2), toon('#efe0bf')); annex.position.set(ax, F + 2.1, -0.8); g.add(annex);
  const aroof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.0, 4), toon('#b9472f'));
  aroof.rotation.y = Math.PI / 4; aroof.position.set(ax, F + 5.2, -0.8); g.add(aroof);
  const winMat = new THREE.MeshToonMaterial({ color: '#cfe3ea', emissive: '#ffc070', emissiveIntensity: 0 });
  windowMats.push(winMat);
  const frame = toon('#3f6aa8');
  for (const wy of [1.6, 3.4]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.08), frame); f.position.set(ax, F + wy, -2.42); g.add(f);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.85), winMat); w.position.set(ax, F + wy, -2.47); w.rotation.y = Math.PI; g.add(w);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.04), frame); bar.position.set(ax, F + wy, -2.5); g.add(bar);
  }
  // chimney-ish & steps
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.6), toon('#8f8a80')); step.position.set(0, 0.11, -D / 2 - 1.6); g.add(step);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  colliders.push({ type: 'box', minX: x - W / 2, maxX: x + W / 2 + 3.2, minZ: z - D / 2, maxZ: z + D / 2, top: 999 });
  colliders.push({ type: 'box', minX: x - W / 2, maxX: x + W / 2, minZ: z - D / 2 - 1.3, maxZ: z - D / 2, top: gy + F + 0.11 });
  colliders.push({ type: 'box', minX: x - 0.6, maxX: x + 0.6, minZ: z - D / 2 - 1.9, maxZ: z - D / 2 - 1.3, top: gy + 0.22 });
  return g;
}

// ---------- bus stop ----------
export let lampLight = null, lampBulbMat = null;
function busStop() {
  const g = new THREE.Group();
  const { x, z } = LAYOUT.bus;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), toon('#7a6a58'));
  pole.position.set(x, heightAt(x, z) + 1.15, z); g.add(pole);
  const tex = canvasTex(128, 320, (ctx, w, h) => {
    ctx.fillStyle = '#f2ead6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c23b2a'; ctx.beginPath(); ctx.arc(w / 2, 58, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('バス', w / 2, 60);
    ctx.fillStyle = '#2a2a2a'; ctx.font = 'bold 54px serif';
    ['稲', '荷', '前'].forEach((ch, i) => ctx.fillText(ch, w / 2, 145 + i * 60));
    ctx.strokeStyle = '#555'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  });
  const signMat = new THREE.MeshToonMaterial({ map: tex });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.04), [toon('#ddd'), toon('#ddd'), toon('#ddd'), toon('#ddd'), signMat, signMat]);
  sign.position.set(x, heightAt(x, z) + 2.0, z);
  sign.rotation.y = -0.9;
  g.add(sign);
  colliders.push({ type: 'circle', x, z, r: 0.12, top: 999 });
  // lamp post
  const lx = LAYOUT.roadX - 1.3, lz = -10.5, ly = heightAt(lx, lz);
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 8), toon('#5d4a3a')); lp.position.set(lx, ly + 2.3, lz); g.add(lp);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), toon('#5d4a3a')); arm.position.set(lx - 0.4, ly + 4.4, lz); g.add(arm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 12, 1, true), toon('#3b4a3e', { side: THREE.DoubleSide })); shade.position.set(lx - 0.8, ly + 4.3, lz); g.add(shade);
  lampBulbMat = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lampBulbMat); bulb.position.set(lx - 0.8, ly + 4.17, lz); g.add(bulb);
  lampLight = new THREE.PointLight('#ffcf7a', 0, 16, 1.6);
  lampLight.position.set(lx - 0.8, ly + 4.0, lz);
  g.add(lampLight);
  colliders.push({ type: 'circle', x: lx, z: lz, r: 0.18, top: 999 });
  // bench
  const bx = x - 1.0, bz = z + 2.2, by = heightAt(bx, bz);
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), toon('#9a7650')); seat.position.y = 0.5; bench.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.07), toon('#9a7650')); back.position.set(0, 0.85, 0.22); bench.add(back);
  for (const sx of [-0.75, 0.75]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.45), toon('#6a4f35')); l.position.set(sx, 0.25, 0); bench.add(l); }
  bench.position.set(bx, by, bz);
  bench.rotation.y = -Math.PI / 2;
  g.add(bench);
  colliders.push({ type: 'box', minX: bx - 0.25, maxX: bx + 0.25, minZ: bz - 0.9, maxZ: bz + 0.9, top: by + 0.55 });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- pond ----------
export let waterMat = null;
function pond() {
  const g = new THREE.Group();
  const { x, z, r } = LAYOUT.pond;
  const water=createDreamWater(x,z,r); waterMat=water.material;
  g.add(water);
  const R = rng(11);
  const padMat = toon('#4f8a35');
  const pads = [[x - 1.6, z + 0.8, 0.62], [x - 0.2, z - 0.4, 0.7], [x + 1.3, z + 0.9, 0.6], [x + 1.6, z - 1.2, 0.55], [x - 1.1, z - 1.8, 0.5]];
  for (const [px, pz, pr] of pads) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, 0.05, 20, 1, false, 0.3, Math.PI * 2 - 0.6), padMat);
    pad.position.set(px, -0.19, pz); pad.rotation.y = R() * 6;
    pad.receiveShadow = true;
    g.add(pad);
    lilyPads.push({ x: px, z: pz, r: pr, top: -0.16, mesh: pad });
    colliders.push({ type: 'circle', x: px, z: pz, r: pr * 0.85, top: -0.16 });
    if (R() > 0.4) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 6, 1, true), toon('#f6c3d6', { side: THREE.DoubleSide }));
      fl.rotation.x = Math.PI; fl.position.set(px + 0.15, -0.08, pz + 0.1); g.add(fl);
    }
  }
  // rocks & reeds
  const rockMat = toon('#8d8c84');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + R() * 0.3, d = r + 0.5 + R() * 0.4;
    const rx = x + Math.cos(a) * d, rz = z + Math.sin(a) * d;
    const rg = new THREE.IcosahedronGeometry(0.25 + R() * 0.25, 1); wobble(rg, 0.2, i, 3);
    const rock = new THREE.Mesh(rg, rockMat); rock.scale.y = 0.6;
    rock.position.set(rx, heightAt(rx, rz) - 0.05, rz); rock.castShadow = true;
    g.add(rock);
  }
  const reedMat = toon('#5a7d34'), tipMat = toon('#6b4a2a');
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, d = r + 0.2 + R() * 0.6;
    const rx = x + Math.cos(a) * d, rz = z + Math.sin(a) * d, h = 0.8 + R() * 0.6;
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 4), reedMat);
    reed.position.set(rx, heightAt(rx, rz) + h / 2, rz); reed.rotation.z = (R() - 0.5) * 0.2; g.add(reed);
    if (R() > 0.5) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), tipMat); t.position.set(rx, heightAt(rx, rz) + h - 0.05, rz); g.add(t); }
  }
  return g;
}

// ---------- jumping course ----------
function platforms() {
  const g = new THREE.Group();
  const stumpSide = toon('#7a5a3e'), stumpTop = toon('#d6b27c');
  const stumps = [[2.2, -2.8, 0.45, 0.45], [3.7, -4.3, 0.5, 0.9], [4.8, -6.1, 0.55, 1.4], [-7, 3, 0.5, 0.5], [-14, -4, 0.6, 0.7], [20.5, -2, 0.45, 0.5]];
  for (const [x, z, r, h] of stumps) {
    const y = heightAt(x, z);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h + 0.3, 12), [stumpSide, stumpTop, stumpSide]);
    s.position.set(x, y + (h + 0.3) / 2 - 0.3, z); s.castShadow = true; s.receiveShadow = true;
    g.add(s);
    colliders.push({ type: 'circle', x, z, r, top: y + h });
  }
  // big mossy rock
  const rx = 6.8, rz = -8.8, ry = heightAt(rx, rz);
  const rg = new THREE.IcosahedronGeometry(1.3, 2); wobble(rg, 0.12, 3, 2);
  rg.scale(1, 1.15, 1);
  const rock = new THREE.Mesh(rg, toon('#8e8d82')); rock.position.set(rx, ry + 0.45, rz); rock.castShadow = true; rock.receiveShadow = true;
  g.add(rock);
  const moss = new THREE.Mesh(blob(1.0, 0, 0, 0, 7, 0.35), toon('#5f8f36')); moss.position.set(rx, ry + 1.75, rz); g.add(moss);
  colliders.push({ type: 'circle', x: rx, z: rz, r: 1.15, top: ry + 1.95 });
  // fallen log
  const lx = -3, lz = -9, ly = heightAt(lx, lz);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 4, 12), [stumpSide, stumpTop, stumpTop]);
  log.rotation.z = Math.PI / 2; log.rotation.y = 0.5; log.position.set(lx, ly + 0.35, lz); log.castShadow = true;
  g.add(log);
  const dir = new THREE.Vector3(Math.cos(0.5), 0, -Math.sin(0.5));
  for (let t = -1.6; t <= 1.6; t += 0.4) colliders.push({ type: 'circle', x: lx + dir.x * t, z: lz + dir.z * t, r: 0.4, top: ly + 0.78 });
  // stepping stones by the house
  for (let i = 0; i < 5; i++) {
    const sx = 4 - i * 1.6, sz = 15.5 + Math.sin(i) * 0.3;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.12, 9), toon('#a3a196'));
    st.position.set(sx, heightAt(sx, sz) + 0.03, sz); st.receiveShadow = true; g.add(st);
  }
  return g;
}

// ---------- particles: dandelion fluff by day, fireflies by night ----------
export const floatUniforms = { uTime: { value: 0 }, uNight: { value: 0 }, uPix: { value: 1 } };
function floaters() {
  const N = 380, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const R = rng(3);
  for (let i = 0; i < N; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 34;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.set([x, heightAt(x, z) + 0.4 + R() * 2.6, z], i * 3); seed[i] = R() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: floatUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uTime, uNight, uPix; varying float vA;
      void main(){ vec3 p = position;
        p.x += sin(uTime*0.3 + aSeed)*1.2 + uTime*0.15*(1.0-uNight); p.z += cos(uTime*0.25 + aSeed*1.3)*1.2;
        p.x = mod(p.x + 40.0, 80.0) - 40.0;
        p.y += sin(uTime*0.8 + aSeed*2.0)*0.35;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        float blink = mix(0.55, 0.5 + 0.5*sin(uTime*2.5 + aSeed*7.0), uNight);
        vA = blink;
        gl_PointSize = mix(6.0, 13.0, uNight) * uPix * (12.0 / -mv.z);
      }`,
    fragmentShader: `uniform float uNight; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(vec3(1.0,1.0,0.95), vec3(0.75,1.0,0.35), uNight);
        gl_FragColor = vec4(c * a * vA * mix(0.55, 1.4, uNight), 1.0); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

// ---------- rain ----------
export class Rain {
  constructor(scene) {
    this.N = 6000;
    const pos = new Float32Array(this.N * 6);
    this.drops = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * 60;
      this.drops[i * 3 + 1] = Math.random() * 30;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: '#cfe0ea', transparent: true, opacity: 0, depthWrite: false });
    this.mesh = new THREE.LineSegments(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(dt, center, amount) {
    this.mat.opacity = amount * 0.45;
    this.mesh.visible = amount > 0.01;
    if (!this.mesh.visible) return;
    const p = this.geo.attributes.position.array, d = this.drops;
    for (let i = 0; i < this.N; i++) {
      d[i * 3 + 1] -= dt * 22;
      if (d[i * 3 + 1] < -2) { d[i * 3 + 1] += 30; d[i * 3] = (Math.random() - 0.5) * 60; d[i * 3 + 2] = (Math.random() - 0.5) * 60; }
      const x = center.x + d[i * 3], y = center.y + d[i * 3 + 1] - 8, z = center.z + d[i * 3 + 2];
      p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
      p[i * 6 + 3] = x - 0.04; p[i * 6 + 4] = y - 0.55; p[i * 6 + 5] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------- acorns ----------
export class Acorns {
  constructor(scene) {
    this.list = [];
    const spots = [[4.8, -6.1], [6.8, -8.8], [LAYOUT.pond.x - 0.2, LAYOUT.pond.z - 0.4], [-10, -9.5], [-4, 15.1],
      [-12, 4], [23, 31], [21, 9], [-3, 29], [24, -15], [-3.6, -8.6], [15.5, -3.8], [-22, 14], [11, 22]];
    const nutMat = toon('#9a6332'), capMat = toon('#5b3d22');
    this.glowTex = canvasTex(64, 64, (ctx) => {
      const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,240,170,0.9)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
    });
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      const nut = ellipsoid(0.1, 0.13, 0.1, nutMat, 14, 10); nut.position.y = -0.03; g.add(nut);
      const capG = new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(1, 0.75, 1);
      const cap = new THREE.Mesh(capG, capMat); cap.position.y = 0.03; g.add(cap);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.07, 5), capMat); stem.position.y = 0.13; g.add(stem);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(0.9); g.add(glow);
      g.scale.setScalar(1.5);
      const y = groundAt(x, z, 50) + 0.45;
      g.position.set(x, y, z);
      g.userData = { x, y, z, taken: false, t: Math.random() * 6 };
      nut.castShadow = true;
      scene.add(g);
      this.list.push(g);
    }
    this.total = this.list.length;
    this.count = 0;
  }
  update(dt, catPos, onCollect) {
    for (const a of this.list) {
      const u = a.userData;
      u.t += dt;
      if (u.taken) {
        u.anim = (u.anim || 0) + dt;
        a.position.y += dt * 3;
        a.scale.setScalar(Math.max(0, 1.5 * (1 - u.anim * 2)));
        if (u.anim > 0.5) a.visible = false;
        continue;
      }
      a.position.y = u.y + Math.sin(u.t * 2.2) * 0.08;
      a.rotation.y += dt * 1.5;
      const d = Math.hypot(catPos.x - u.x, catPos.z - u.z);
      if (d < 0.75 && Math.abs(catPos.y + 0.4 - a.position.y) < 0.9) {
        u.taken = true; this.count++;
        onCollect(a, this.count, this.total);
      }
    }
  }
}

// ---------- the magic sprouting tree ----------
export function sproutTree(prototype) {
  const { x, z } = LAYOUT.sprout;
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z) - 0.1, z);
  const R = rng(77);
  const big=new THREE.Group();
  if(prototype){const tree=prototype.clone(true);tree.scale.multiplyScalar(.46);big.add(tree);}else big.add(roundTree(R,300,1));
  big.scale.setScalar(0.001);
  g.add(big);
  // little seedlings marking the spot
  const sprouts = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.25, 4), toon('#5d8f2e')); st.position.y = 0.12; s.add(st);
    for (const sx of [-1, 1]) { const l = ellipsoid(0.07, 0.015, 0.04, toon('#7fbf3f')); l.position.set(sx * 0.06, 0.25, 0); l.rotation.z = sx * 0.4; s.add(l); }
    s.position.set((R() - 0.5) * 1.6, 0, (R() - 0.5) * 1.6);
    sprouts.add(s);
  }
  g.add(sprouts);
  return { group: g, big, sprouts, grown: 0 };
}

// ---------- build everything ----------
export function buildWorld(scene) {
  scene.add(buildSky());
  scene.add(buildClouds());
  // The great tree is now a supplied textured model, placed by dream.js.
  scene.add(createTorii());
  scene.add(hokora());
  // Main treehouse is loaded by dream.js with a grounded foundation.
  scene.add(busStop());
  scene.add(pond());
  scene.add(platforms());
  scene.add(floaters());

  const R = rng(21);
  // The full forest ring is made of model assets in dream.js.
  // bushes
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI * 2, r = 12 + R() * 22;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roadDist(x, z) < 2.5 || nearStructure(x, z, 3)) continue;
    const b = bush(R, i * 3, 0.8 + R() * 0.7);
    b.position.set(x, heightAt(x, z) - 0.15, z);
    scene.add(b);
  }
  // little scattered rocks
  for (let i = 0; i < 25; i++) {
    const a = R() * Math.PI * 2, r = 6 + R() * 28;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roadDist(x, z) < 2 || nearStructure(x, z, 2.5)) continue;
    const rg = new THREE.IcosahedronGeometry(0.2 + R() * 0.3, 1); wobble(rg, 0.2, i, 3);
    const m = new THREE.Mesh(rg, toon('#93918a')); m.scale.y = 0.6;
    m.position.set(x, heightAt(x, z), z); m.castShadow = true;
    scene.add(m);
  }
}

export function nearStructure(x, z, pad = 0) {
  const L = LAYOUT;
  if(Math.hypot(x-L.elder.x,z-L.elder.z)<L.elder.flat+pad)return true;
  if(catbusRouteDist(x,z)<2.9+pad)return true;
  if(Math.abs(x-L.inari.x)<2.2+pad && z>L.inari.z-2-pad && z<42+pad) return true;
  for(const b of L.buildings)if(Math.hypot(x-b.x,z-b.z)<b.flat+pad)return true;
  if (Math.hypot(x - L.camphor.x, z - L.camphor.z) < 3.5 + pad) return true;
  if (x > L.house.x - 4.7 - pad && x < L.house.x + 8 + pad && z > L.house.z - 5 - pad && z < L.house.z + 3.2 + pad) return true;
  if (Math.hypot(x - L.totoro.x, z - L.totoro.z) < 2.2 + pad) return true;
  if (Math.hypot(x - L.pond.x, z - L.pond.z) < L.pond.r + 0.5 + pad) return true;
  if (Math.hypot(x - L.sprout.x, z - L.sprout.z) < 1.2 + pad) return true;
  if (nearLake(x, z, pad)) return true;
  return false;
}
