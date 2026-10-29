import {createTotoroNest} from './totoro-nest.js';
import {projectObstacles,clearGround,companionSearch} from './creature-navigation.js';
// Totoro family: big Totoro (with leaf umbrella), Chu & Chibi Totoro, and soot sprites (susuwatari)
import * as THREE from 'three';
import { makeFur } from './fur.js';
import { toon } from './toon.js';
import { heightAt, LAYOUT } from './terrain.js';
import { colliders } from './world.js';

function sphereGeo(rx, ry, rz, w = 24, h = 16) { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); return g; }

function leafGeometry(R, notch = 0.22, rings = 9, segs = 40, droop = 0.35) {
  const pos = [], col = [], idx = [];
  const light = new THREE.Color('#7fb54c'), dark = new THREE.Color('#4f8a33'), vein = new THREE.Color('#a9d36d');
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * R;
    for (let j = 0; j <= segs; j++) {
      const a = notch + (j / segs) * (Math.PI * 2 - notch * 2);
      const edge = 1 - 0.06 * Math.abs(Math.sin(a * 6));
      const rr = r * edge;
      const t = r / R;
      const y = -droop * R * t * t + 0.04 * R * Math.sin(a * 5) * t;
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const c = dark.clone().lerp(light, 0.4 + 0.6 * t);
      if (j % 5 === 0) c.lerp(vein, 0.45);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + segs + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export const leafMat = () => toon('#ffffff', { vertexColors: true, side: THREE.DoubleSide });

function chevronGeo(w) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -w * 0.12); s.lineTo(0, w * 0.22); s.lineTo(w / 2, -w * 0.12);
  s.lineTo(w * 0.36, -w * 0.18); s.lineTo(0, w * 0.06); s.lineTo(-w * 0.36, -w * 0.18); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  return g;
}

/** Generic Totoro body builder. size = overall height. */
function buildTotoro(o) {
  const H = o.size;
  const k = H / 4.5;
  const time = { value: 0 }, displace = { value: new THREE.Vector3() };
  const furOpts = { time, displace };
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const prof = [[0.01, 0], [1.2, 0.05], [1.75, 0.55], [1.92, 1.4], [1.85, 2.3], [1.55, 3.2], [1.2, 3.9], [0.7, 4.35], [0.01, 4.5]];
  const curve = new THREE.SplineCurve(prof.map(p => new THREE.Vector2(p[0] * k, p[1] * k)));
  const pts = curve.getPoints(48);
  const rAt = (y) => { for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].y >= y) { const t = (y - pts[i].y) / (pts[i + 1].y - pts[i].y || 1); return pts[i].x + (pts[i + 1].x - pts[i].x) * t; } return 0; };
  const ZS = 0.85;
  const surfZ = (x, y) => ZS * Math.sqrt(Math.max(0, rAt(y) ** 2 - x * x));
  const bodyG = new THREE.LatheGeometry(pts, 48);
  bodyG.scale(1, 1, ZS);
  const furLen = 0.035 * k + 0.012;
  const body = makeFur(bodyG, { ...furOpts, length: furLen, shells: 10, density: [260, 130], thick: 0.72, gravity: 0.2, color: o.color, colorFn: () => [o.color, 1] });
  inner.add(body);
  // belly
  const by = 1.75 * k, bz = 0.72 * k, BR = [1.5 * k, 1.65 * k, 1.0 * k];
  const belly = makeFur(sphereGeo(...BR, 36, 24), { ...furOpts, length: furLen * 0.8, shells: 10, density: [190, 105], thick: 0.72, gravity: 0.2, colorFn: () => [o.belly, 1] });
  belly.position.set(0, by, bz);
  inner.add(belly);
  const bellySurf = (dx, dy) => {
    const q = 1 - (dx / BR[0]) ** 2 - (dy / BR[1]) ** 2;
    const z = BR[2] * Math.sqrt(Math.max(0, q));
    const n = new THREE.Vector3(dx / BR[0] ** 2, dy / BR[1] ** 2, z / BR[2] ** 2).normalize();
    return { p: new THREE.Vector3(dx, by + dy, bz + z + furLen * 0.55), n };
  };
  if (o.chevrons) {
    const cg = chevronGeo(0.42 * k);
    const cm = toon(o.color.getStyle ? '#' + o.color.getHexString() : o.color);
    for (const [dx, dy] of o.chevrons) {
      const { p, n } = bellySurf(dx * k, dy * k);
      const m = new THREE.Mesh(cg, cm);
      m.position.copy(p);
      m.lookAt(p.clone().add(n));
      inner.add(m);
    }
  }
  // ears
  for (const sx of [-1, 1]) {
    const eg = new THREE.ConeGeometry(o.earR * k, o.earH * k, 16); eg.scale(1, 1, 0.65);
    const ear = makeFur(eg, { ...furOpts, length: furLen * 0.7, shells: 8, density: [40, 30], colorFn: () => [o.color, 1] });
    ear.position.set(sx * o.earX * k, (4.3 + o.earH * 0.4) * k, -0.05 * k);
    ear.rotation.z = -sx * o.earTilt;
    inner.add(ear);
  }
  // face
  const face = new THREE.Group();
  inner.add(face);
  const white = new THREE.MeshBasicMaterial({ color: '#fbfaf2' }), black = new THREE.MeshBasicMaterial({ color: '#141414' });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const ex = sx * o.eyeX * k, ey = o.eyeY * k;
    const e = new THREE.Group();
    e.position.set(ex, ey, surfZ(ex, ey) + furLen * 0.5);
    e.rotation.y = sx * 0.35;
    const R = o.eyeR * k;
    const w = new THREE.Mesh(sphereGeo(R, R, R * 0.45), white);
    const rim = new THREE.Mesh(sphereGeo(R * 1.12, R * 1.12, R * 0.4), black); rim.position.z = -R * 0.08;
    const pu = new THREE.Mesh(sphereGeo(R * 0.42, R * 0.42, R * 0.2), black); pu.position.z = R * 0.38;
    const hi = new THREE.Mesh(new THREE.SphereGeometry(R * 0.12, 8, 6), white); hi.position.set(R * 0.12, R * 0.12, R * 0.5);
    e.add(w, rim, pu, hi);
    face.add(e);
    eyes.push(e);
  }
  // nose
  const ny = o.noseY * k;
  const nose = new THREE.Mesh(sphereGeo(0.2 * k, 0.07 * k, 0.08 * k), toon('#2a2826'));
  nose.position.set(0, ny, surfZ(0, ny) + furLen * 0.6);
  nose.rotation.x = -0.3;
  face.add(nose);
  // mouth (opens for roar)
  const my = o.mouthY * k;
  const mouth = new THREE.Group();
  mouth.position.set(0, my, surfZ(0, my) + furLen * 0.3);
  const mIn = new THREE.Mesh(sphereGeo(0.72 * k, 0.4 * k, 0.12 * k), toon('#5a1f1f'));
  const tongue = new THREE.Mesh(sphereGeo(0.4 * k, 0.15 * k, 0.08 * k), toon('#c0545a')); tongue.position.set(0, -0.2 * k, 0.05 * k);
  const teeth = new THREE.Group();
  for (let i = -4; i <= 4; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.045 * k, 0.1 * k, 5), white);
    const a = i / 4.5;
    t.position.set(a * 0.62 * k, 0.33 * k * Math.sqrt(1 - a * a) - 0.04 * k, 0.07 * k); t.rotation.x = Math.PI;
    teeth.add(t);
  }
  mouth.add(mIn, tongue, teeth);
  mouth.scale.y = 0.04;
  mouth.visible = false;
  face.add(mouth);
  // whiskers
  const wp = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y = ny - 0.1 * k - i * 0.12 * k;
    const x0 = sx * 0.4 * k;
    wp.push(x0, y, surfZ(x0, y) + 0.05, sx * 1.65 * k, y + (0.15 - i * 0.18) * k, surfZ(x0, y) - 0.25 * k);
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  face.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#1d1d1d' })));
  // feet & arms
  const clawMat = toon('#3a3734');
  const footColor = o.color;
  const feet=[];
  for (const sx of [-1, 1]) {
    const foot=new THREE.Group();foot.position.set(sx*.85*k,.15*k,.75*k);inner.add(foot);feet.push(foot);
    const f = makeFur(sphereGeo(0.55 * k, 0.28 * k, 0.72 * k), { ...furOpts, length: furLen * 0.6, shells: 8, density: [40, 20], colorFn: () => [footColor, 1] });
    foot.add(f);
    if (o.claws) for (let c = -1; c <= 1; c++) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.06 * k, 0.22 * k, 6), clawMat);
      cl.rotation.x = Math.PI / 2; cl.position.set(c*.2*k,-.03*k,.67*k);
      foot.add(cl);
    }
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 1.45 * k, 3.25 * k, 0.25 * k);
    const a = makeFur(sphereGeo(0.46 * k, 1.3 * k, 0.52 * k), { ...furOpts, length: furLen * 0.8, shells: 10, density: [50, 40], colorFn: () => [o.color, 1] });
    a.position.set(sx * 0.28 * k, -1.05 * k, 0);
    a.rotation.z = sx * 0.18;
    piv.add(a);
    if (o.claws) for (let c = -1; c <= 1; c++) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.05 * k, 0.24 * k, 6), clawMat);
      cl.rotation.x = Math.PI; cl.position.set(sx * 0.5 * k + c * 0.13 * k, -2.38 * k, 0.1 * k + Math.abs(c) * -0.05 * k);
      piv.add(cl);
    }
    inner.add(piv);
    arms.push(piv);
  }
  // tail nub
  const tail = makeFur(sphereGeo(0.35 * k, 0.3 * k, 0.3 * k), { ...furOpts, length: furLen, shells: 8, density: [30, 16], colorFn: () => [o.color, 1] });
  tail.position.set(0, 0.9 * k, -1.55 * k);
  inner.add(tail);
  // shadow caster
  const sc = new THREE.Mesh(new THREE.LatheGeometry(pts.filter((_, i) => i % 4 === 0), 12), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  sc.scale.z = ZS; sc.castShadow = true; inner.add(sc);

  return { group: g, inner, eyes, mouth, arms, feet, face, time, displace, k, rAt, surfZ };
}

// ======================= Big Totoro =======================
export class BigTotoro {
  constructor(scene) {
    const t = buildTotoro({
      size: 4.6, color: new THREE.Color('#6f716c'), belly: new THREE.Color('#ece0bb'),
      chevrons: [[-0.45, 0.95], [0, 1.0], [0.45, 0.95], [-0.72, 0.55], [-0.24, 0.6], [0.24, 0.6], [0.72, 0.55]],
      earR: 0.3, earH: 1.15, earX: 0.5, earTilt: 0.12, eyeX: 0.56, eyeY: 3.5, eyeR: 0.24, noseY: 3.74, mouthY: 3.05, claws: true,
    });
    Object.assign(this, t);
    const { x, z } = LAYOUT.totoro;
    this.group.position.set(x, heightAt(x, z) - 0.05, z);
    this.baseYaw = Math.atan2(-0.8, 0.6);
    this.group.rotation.y = this.baseYaw;
    scene.add(this.group);
    const k = this.k;
    // little leaf on the head
    const sl = new THREE.Mesh(leafGeometry(0.42, 0.3, 5, 20, 0.1), leafMat());
    sl.position.set(0.05, 4.62 * k, 0.15); sl.rotation.set(0.15, 0.6, 0.1);
    this.inner.add(sl);
    const stemS = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 5), toon('#5d8f35'));
    stemS.position.set(0.05, 4.75 * k, 0.15); this.inner.add(stemS);
    // umbrella: held in the right arm (-x side)
    this.umbrella = new THREE.Group();
    const arm = this.arms[0];
    this.umbrella.position.set(-0.45 * k, -2.25 * k, 0.15);
    arm.add(this.umbrella);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6), toon('#5f8f38'));
    stem.position.y = 1.6;
    this.umbrella.add(stem);
    const leaf = new THREE.Mesh(leafGeometry(2.6, 0.22, 10, 44, 0.33), leafMat());
    leaf.position.set(0.6, 3.35, 0.3);
    leaf.rotation.set(0.12, 0, -0.18);
    leaf.castShadow = true;
    this.umbrella.add(leaf);
    this.umbrellaAmt = 0;
    this.umbrella.scale.setScalar(0.001);
    this.wobble = 0; this.wobbleV = 0;
    this.grin = 0; this.roarT = 0; this.blinkT = 3; this.t = 0;
    this.bounceCD = 0;this.restClock=45;this.sleep=0;this.sleeping=false;this.occupied=false;this.path=[];this.repath=0;this.home=this.group.position.clone();this.nest=createTotoroNest(scene,this.home,this.baseYaw,colliders);
  }
  bellyPoint(out=new THREE.Vector3()){this.group.updateMatrixWorld(true);return this.inner.localToWorld(out.set(0,1.75*this.k,1.72*this.k+.10));}
  exitPoint(){for(let r=4.6;r<8;r+=.6)for(let i=0;i<16;i++){const a=i*Math.PI/8,p=this.group.position.clone();p.x+=Math.sin(a)*r;p.z+=Math.cos(a)*r;if(clearGround(p.x,p.z,.5,colliders,this.collider)){p.y=heightAt(p.x,p.z);return p;}}return null;}
  roar() { if (this.roarT <= 0) { this.roarT = 2.2; return true; } return false; }
  bounce() { if (this.bounceCD > 0) return false; this.bounceCD = 0.4; this.wobbleV += 3.5; this.grin = 1.4; return true; }
  update(dt, catPos, rain) {
    this.t += dt; this.time.value = this.t;
    this.restClock-=dt;if(!this.occupied){if(rain>.3){this.sleeping=false;this.restClock=45;}else if(this.restClock<=0&&this.group.position.distanceTo(this.home)<.12){this.sleeping=!this.sleeping;this.restClock=this.sleeping?65:100+Math.random()*70;}}
    this.sleep+=(+(this.sleeping||this.occupied)-this.sleep)*(1-Math.exp(-1.4*dt));
    let moving=false;this.repath-=dt;
    const returning=rain<=.3&&this.group.position.distanceTo(this.home)>.35;
    if(this.returning!==returning){this.returning=returning;this.search=null;this.path=[];this.repath=0;}
    if(!this.occupied&&this.sleep<.02&&this.roarT<=0&&(returning||rain>.3&&Math.abs(catPos.y-this.group.position.y)<3)){
     const goal=returning?this.home:catPos,arrival=returning?.35:3.1,d=Math.hypot(goal.x-this.group.position.x,goal.z-this.group.position.z);
     if(d>arrival&&this.repath<=0){if(!this.search)this.search=companionSearch(this.group.position.clone(),goal.clone(),colliders,this.collider,returning?.6:3.25);this.repath=3;}
     if(this.search)for(let batch=0;batch<2;batch++){const result=this.search.next();if(result.done){this.path=result.value;this.search=null;break;}}
     if(returning&&d<1.3)this.path=[{x:this.home.x,z:this.home.z}];
     if(d>arrival&&this.path.length){const p=this.path[0],dx=p.x-this.group.position.x,dz=p.z-this.group.position.z,dist=Math.hypot(dx,dz),step=Math.min(dist,dt*1.5);const x=this.group.position.x+dx/(dist||1)*step,z=this.group.position.z+dz/(dist||1)*step;if(clearGround(x,z,1.9,colliders,this.collider)){this.group.position.x=x;this.group.position.z=z;moving=true;this.moveYaw=Math.atan2(dx,dz);}else{this.path=[];this.repath=0;}if(dist<.18)this.path.shift();}
    }
    if(this.occupied||rain<=.3&&!returning){this.search=null;this.path=[];if(!this.occupied)this.group.position.lerp(this.home,1-Math.exp(-4*dt));}
    this.group.position.y=heightAt(this.group.position.x,this.group.position.z)-.05;
    if(this.collider){this.collider.x=this.group.position.x;this.collider.z=this.group.position.z;this.collider.r=1.9+this.sleep*.6;}

    this.bounceCD -= dt;
    // breathe & belly wobble
    this.wobbleV += (-this.wobble * 90 - this.wobbleV * 6) * dt;
    this.wobble += this.wobbleV * dt;
    const br = Math.sin(this.t * 1.2) * 0.012;
    this.inner.scale.set(1 + this.wobble * 0.1, 1 + br - this.wobble * 0.08, 1 + this.wobble * 0.12+this.sleep*(.035+.035*Math.sin(this.t*1.4)));
    // look at the cat
    const dx = catPos.x - this.group.position.x, dz = catPos.z - this.group.position.z;
    const d = Math.hypot(dx, dz);
    let target = moving?this.moveYaw:rain>.3?Math.atan2(dx,dz):this.baseYaw;
    if (d < 12 && rain<=.3&&!moving&&this.restClock>4&&!this.sleeping) {
      let a = Math.atan2(dx, dz) - this.baseYaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      target = this.baseYaw + Math.max(-0.8, Math.min(0.8, a));
    }
    if(this.sleeping||this.sleep>.02||this.occupied)target=this.baseYaw;
    this.group.rotation.y += Math.atan2(Math.sin(target-this.group.rotation.y),Math.cos(target-this.group.rotation.y))*Math.min(1,dt*1.5);
    // blink
    this.blinkT -= dt;
    let eyeS = this.sleep>.5?.06:1;
    if (this.blinkT < 0.15) eyeS = 0.1;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 4;
    // roar
    let open = 0;
    if (this.roarT > 0) {
      this.roarT -= dt;
      const p = 1 - this.roarT / 2.2;
      open = Math.min(1, p * 5) * Math.min(1, this.roarT * 2.5);
      eyeS = 1.15;
    }
    this.grin = Math.max(0, this.grin - dt);
    open = Math.max(open, Math.min(this.grin, 1) * 0.3);
    this.mouth.visible = open > 0.03;
    this.mouth.scale.set(0.6 + open * 0.4, open, 1);
    for (const e of this.eyes) e.scale.y += (eyeS - e.scale.y) * Math.min(1, dt * 25);
    this.inner.rotation.x = open*.12-this.sleep*1.466;
    this.inner.position.set(0,this.sleep*1.66+(moving?Math.abs(Math.sin(this.t*5))*.035:0),this.sleep*2.1);
    this.inner.rotation.z=moving?Math.sin(this.t*5)*.035:0;
    for(const [i,foot]of this.feet.entries()){foot.position.set((i?1:-1)*.85*this.k,(.15-.45*this.sleep)*this.k,THREE.MathUtils.lerp(.75,-1.2/this.inner.scale.z,this.sleep)*this.k);foot.rotation.x=this.sleep*1.466;}
    // Bend the arms toward the moss instead of keeping the standing pose aloft.
    // umbrella in the rain
    this.umbrellaAmt += ((rain > 0.3 && this.sleep<.1 ? 1 : 0) - this.umbrellaAmt) * Math.min(1, dt * 2);
    const u = this.umbrellaAmt;
    this.arms[0].rotation.x = -1.15*u+.45*this.sleep;
    this.arms[0].rotation.z = 0.1 * u;
    this.umbrella.rotation.x = 1.15 * u;
    this.umbrella.scale.setScalar(Math.max(0.001, u));
    this.arms[1].rotation.x = -.6*open+.45*this.sleep;
    this.arms[1].rotation.z = 0.5 * open;
  }
}

// ======================= Chu & Chibi =======================
export class SmallTotoro {
  constructor(scene, kind, start) {
    const chu = kind === 'chu';
    const t = buildTotoro({
      size: chu ? 1.25 : 0.7,
      color: new THREE.Color(chu ? '#7f9cc4' : '#f1f1ec'), belly: new THREE.Color(chu ? '#e2e8ee' : '#ffffff'),
      chevrons: chu ? [[-0.4, 0.8], [0.4, 0.8], [0, 0.9]] : null,
      earR: chu ? 0.32 : 0.36, earH: chu ? 1.4 : 1.0, earX: 0.45, earTilt: chu ? 0.05 : 0.25,
      eyeX: 0.55, eyeY: 3.4, eyeR: 0.3, noseY: 3.65, mouthY: 3.0, claws: false,
    });
    Object.assign(this, t);
    this.kind = kind;
    this.pos = new THREE.Vector3(start.x, 0, start.z);
    this.target = this.pos.clone();
    this.heading = 0; this.t = Math.random() * 10; this.pause = 0;
    if (chu) {
      // acorn sack
      const sack = new THREE.Mesh(sphereGeo(0.17, 0.2, 0.15), toon('#e9dcc0'));
      sack.position.set(0.32, 0.45, 0.35);
      this.inner.add(sack);
      const knot = new THREE.Mesh(sphereGeo(0.06, 0.08, 0.06), toon('#e9dcc0')); knot.position.set(0.32, 0.66, 0.35); this.inner.add(knot);
    }
    scene.add(this.group);
    this.home = this.pos.clone(); this.radius=chu?.62:.40; this.pause=chu?.8:2.3; this.retarget=0; this.moveBlend=0;
  }
  update(dt, catPos, neighbor) {
    this.t+=dt; this.time.value=this.t; this.pause-=dt; this.retarget-=dt;
    const dc=Math.hypot(catPos.x-this.pos.x,catPos.z-this.pos.z);
    // Each creature owns a home, destination and wait timer. No leader-following.
    if(dc<2.2 && this.retarget<=0){let dx=this.pos.x-catPos.x,dz=this.pos.z-catPos.z;const d=Math.hypot(dx,dz)||1;this.target.set(this.pos.x+dx/d*3.4,0,this.pos.z+dz/d*3.4);this.fleeing=true;this.pause=0;this.retarget=.8;}
    let distance=Math.hypot(this.target.x-this.pos.x,this.target.z-this.pos.z);
    if(distance<.22&&this.pause<=0){this.fleeing=false;this.pause=1.3+Math.random()*3.5;const a=Math.random()*Math.PI*2,r=1.5+Math.random()*4.5;this.target.set(this.home.x+Math.sin(a)*r,0,this.home.z+Math.cos(a)*r);}
    const speed=this.fleeing?2.8:(this.kind==='chu'?.9:1.05);let moved=0;
    if(this.pause<=0&&distance>.12){let dx=this.target.x-this.pos.x,dz=this.target.z-this.pos.z;const d=Math.hypot(dx,dz)||1;dx/=d;dz/=d;
      if(neighbor){const nx=this.pos.x-neighbor.pos.x,nz=this.pos.z-neighbor.pos.z,nd=Math.hypot(nx,nz),safe=this.radius+neighbor.radius+.55;if(nd<safe&&nd>.001){const force=(safe-nd)/safe*1.8;dx+=nx/nd*force;dz+=nz/nd*force;}}
      const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;const oldX=this.pos.x,oldZ=this.pos.z;const step=Math.min(distance,speed*dt);this.pos.x+=dx*step;this.pos.z+=dz*step;
      // Resolve static obstacle penetration. Retarget after a block instead of vibrating against it.
      let blocked=false;
      for(const c of colliders){if(c.top<heightAt(this.pos.x,this.pos.z)+.5)continue;
        if(c.type==='circle'){const ox=this.pos.x-c.x,oz=this.pos.z-c.z,od=Math.hypot(ox,oz),rr=c.r+this.radius;if(od<rr){this.pos.x=c.x+(od>1e-5?ox/od:1)*rr;this.pos.z=c.z+(od>1e-5?oz/od:0)*rr;blocked=true;}}
        else if(this.pos.x>c.minX-this.radius&&this.pos.x<c.maxX+this.radius&&this.pos.z>c.minZ-this.radius&&this.pos.z<c.maxZ+this.radius){this.pos.x=oldX;this.pos.z=oldZ;blocked=true;}
      }
      const pond=LAYOUT.pond,px=this.pos.x-pond.x,pz=this.pos.z-pond.z,pd=Math.hypot(px,pz);if(pd<pond.r+1){this.pos.x=pond.x+px/(pd||1)*(pond.r+1);this.pos.z=pond.z+pz/(pd||1)*(pond.r+1);blocked=true;}
      if(neighbor){const nx=this.pos.x-neighbor.pos.x,nz=this.pos.z-neighbor.pos.z,nd=Math.hypot(nx,nz),rr=this.radius+neighbor.radius+.2;if(nd<rr){this.pos.x=neighbor.pos.x+(nd>.001?nx/nd:1)*rr;this.pos.z=neighbor.pos.z+(nd>.001?nz/nd:0)*rr;}}
      if(blocked&&this.retarget<=0){this.target.copy(this.home);this.retarget=1.4;this.pause=.6;}
      const rr=Math.hypot(this.pos.x,this.pos.z);if(rr>29){this.pos.x*=29/rr;this.pos.z*=29/rr;this.target.copy(this.home);}
      moved=Math.hypot(this.pos.x-oldX,this.pos.z-oldZ)/Math.max(dt,.001);
      if(moved>.04){const a=Math.atan2(this.pos.x-oldX,this.pos.z-oldZ)-this.heading;this.heading+=Math.atan2(Math.sin(a),Math.cos(a))*(1-Math.exp(-6*dt));}
    }
    this.moveBlend+=((moved>.05?1:0)-this.moveBlend)*(1-Math.exp(-8*dt));
    // A tiny grounded waddle, never a hard frame-to-frame height snap.
    const hop=(1-Math.cos(this.t*8))*.015*this.moveBlend;
    this.group.position.set(this.pos.x,heightAt(this.pos.x,this.pos.z)+.035+hop,this.pos.z);
    this.group.rotation.y=this.heading;this.inner.rotation.z=Math.sin(this.t*7)*.035*this.moveBlend;
    const bl=(this.t%4.7)<.11?.12:1;for(const e of this.eyes)e.scale.y=bl;
  }

}

// ======================= Soot sprites =======================
export class SootSprites {
  constructor(scene, count = 14) {
    this.list = [];
    const time = { value: 0 };
    this.time = time;
    const proto = makeFur(sphereGeo(0.11, 0.11, 0.11, 16, 12), { time, length: 0.09, shells: 12, density: [22, 11], thick: 0.32, gravity: 0.1, colorFn: () => ['#1b1a1a', 1] });
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' }), black = new THREE.MeshBasicMaterial({ color: '#000' });
    const home = new THREE.Vector3(LAYOUT.house.x + 1, 0, LAYOUT.house.z - 5.8);
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const f = new THREE.Mesh(proto.geometry, proto.material); f.frustumCulled = false; g.add(f);
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), white); e.position.set(sx * 0.045, 0.03, 0.1); e.scale.z = 0.5;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), black); p.position.set(sx * 0.045, 0.03, 0.118);
        g.add(e, p);
      }
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.6;
      const h = home.clone().add(new THREE.Vector3(Math.cos(a) * r * 1.8, 0, Math.sin(a) * r * 0.6));
      g.userData = { home: h, pos: h.clone(), vel: new THREE.Vector3(), seed: Math.random() * 10, scatter: 0 };
      const s = 0.8 + Math.random() * 0.5; g.scale.setScalar(s);
      scene.add(g);
      this.list.push(g);
    }
  }
  scatter(from, radius = 6) {
    for (const g of this.list) {
      const u = g.userData;
      if (u.pos.distanceTo(from) < radius) u.scatter = 2.5 + Math.random();
    }
  }
  update(dt, catPos) {
    this.time.value += dt;
    const zMax = LAYOUT.house.z - 3 - 1.4;
    for (const g of this.list) {
      const u = g.userData;
      const t = this.time.value + u.seed;
      const dc = Math.hypot(catPos.x - u.pos.x, catPos.z - u.pos.z);
      u.scatter = Math.max(0, u.scatter - dt);
      let desired = new THREE.Vector3();
      if (dc < 2.6 || u.scatter > 0) {
        desired.set(u.pos.x - catPos.x, 0, u.pos.z - catPos.z).normalize().multiplyScalar(4.5);
        desired.x += Math.sin(t * 7) * 2;
      } else {
        desired.set(u.home.x - u.pos.x, 0, u.home.z - u.pos.z);
        const d = desired.length();
        if (d > 0.1) desired.multiplyScalar(Math.min(1.2, d) / d);
        desired.x += Math.sin(t * 1.3) * 0.3; desired.z += Math.cos(t * 1.1) * 0.2;
      }
      u.vel.lerp(desired, Math.min(1, dt * 5));
      u.pos.addScaledVector(u.vel, dt);
      if (u.pos.z > zMax && Math.abs(u.pos.x - LAYOUT.house.x) < 6) u.pos.z = zMax;
      projectObstacles(u.pos,.22*g.scale.x,colliders);
      const sp = u.vel.length();
      const hop = Math.abs(Math.sin(t * (sp > 1.5 ? 16 : 5))) * (sp > 1.5 ? 0.25 : 0.06);
      g.position.set(u.pos.x, heightAt(u.pos.x, u.pos.z) + 0.12 + hop, u.pos.z);
      if (sp > 0.2) g.rotation.y = Math.atan2(u.vel.x, u.vel.z);
      else { const a = Math.atan2(catPos.x - u.pos.x, catPos.z - u.pos.z); g.rotation.y += (a - g.rotation.y) * 0.05; }
    }
    for(let pass=0;pass<4;pass++){
     for(let i=0;i<this.list.length;i++)for(let j=i+1;j<this.list.length;j++){const a=this.list[i],b=this.list[j],p=a.userData.pos,q=b.userData.pos,dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz),rr=.22*(a.scale.x+b.scale.x)+.025;if(d<rr){const nx=d>1e-6?dx/d:Math.cos(i*2.4),nz=d>1e-6?dz/d:Math.sin(i*2.4),push=(rr-d)/2;p.x+=nx*push;p.z+=nz*push;q.x-=nx*push;q.z-=nz*push;}}
     for(const g of this.list)projectObstacles(g.userData.pos,.22*g.scale.x,colliders);
    }
    for(const g of this.list){g.position.x=g.userData.pos.x;g.position.z=g.userData.pos.z;g.position.y=Math.max(g.position.y,heightAt(g.position.x,g.position.z)+.21*g.scale.x);}
  }
}
