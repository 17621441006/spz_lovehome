// 脏脏包 — a fluffy ginger & white Persian, built from fur-shell parts and animated procedurally
import * as THREE from 'three';
import { makeFur } from './fur.js';
import { toon } from './toon.js';

const C = (h) => new THREE.Color(h);
const ORANGE = C('#e0954b'), LIGHT = C('#f0b673'), DARK = C('#c27536'), WHITE = C('#fffaf1'), CREAM = C('#f1cf9c'), STAIN = C('#94552a');
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
function stripes(p, freq = 26, amt = 0.4) {
  const s = Math.sin(p.z * freq + Math.sin(p.x * 9 + p.y * 4) * 1.6);
  return ss(0.35, 0.9, s) * amt;
}

function sphereGeo(rx, ry, rz, w = 28, h = 20) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}

export class Cat {
  constructor() {
    this.root = new THREE.Group();
    this.lie = new THREE.Group();
    this.hip = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.lie);
    this.lie.add(this.hip);
    this.hip.position.set(0, 0.36, -0.28);
    this.body.position.set(0, -0.36, 0.28);
    this.hip.add(this.body);

    this.uDisplace = { value: new THREE.Vector3() };
    this.uTime = { value: 0 };
    this.uTint = { value: new THREE.Color(1, 1, 1) };
    const shared = { displace: this.uDisplace, time: this.uTime, tint: this.uTint };
    const fur = (geo, o) => makeFur(geo, { ...shared, ...o });

    // ---- torso ----
    const torso = fur(sphereGeo(0.36, 0.31, 0.5), {
      length: 0.13, shells: 22, density: [135, 69], colorFn: (p, n) => {
        let c = mix(ORANGE, LIGHT, ss(0.1, 0.3, p.y) * 0.4);
        c = mix(c, DARK, stripes(p));
        c = mix(c, WHITE, ss(-0.08, -0.26, p.y));
        c = mix(c, CREAM, ss(0.25, 0.48, p.z) * ss(0.05, -0.2, p.y));
        return [c, 1];
      },
    });
    torso.position.set(0, 0.5, 0);
    this.body.add(torso);
    this.torso = torso;

    const chest = fur(sphereGeo(0.24, 0.23, 0.18), {
      length: 0.14, shells: 20, density: [105, 54], colorFn: (p) => [mix(WHITE, CREAM, ss(0.05, 0.25, p.y) * 0.6), 1],
    });
    chest.position.set(0, 0.4, 0.4);
    this.body.add(chest);

    const mane = fur(sphereGeo(0.35, 0.3, 0.24), {
      length: 0.14, shells: 22, density: [120, 60], gravity: 0.5, colorFn: (p, n) => {
        let c = mix(ORANGE, LIGHT, 0.35);
        c = mix(c, DARK, stripes(p, 30, 0.25));
        c = mix(c, WHITE, ss(0.0, -0.2, p.y) * ss(-0.1, 0.4, n.z));
        return [c, 1.1];
      },
    });
    mane.position.set(0, 0.6, 0.36);
    this.body.add(mane);

    // ---- head ----
    this.head = new THREE.Group();
    this.head.position.set(0, 0.8, 0.6);
    this.body.add(this.head);
    const headFur = fur(sphereGeo(0.32, 0.29, 0.27, 36, 26), {
      length: 0.075, shells: 20, density: [165, 82], colorFn: (p, n) => {
        let c = mix(ORANGE, DARK, stripes(p, 34, 0.3) * ss(0.05, 0.2, p.y));
        c = mix(c, LIGHT, ss(0.3, 0.9, n.z) * 0.45);
        // white muzzle & chin
        c = mix(c, WHITE, ss(-0.04, -0.13, p.y) * ss(0.2, 0.7, n.z));
        // persian tear-stain / dark bridge between the eyes
        const st = ss(0.07, 0.0, Math.abs(p.x)) * ss(-0.1, -0.02, p.y) * ss(0.08, -0.02, p.y) * ss(0.6, 0.9, n.z);
        c = mix(c, STAIN, st * 0.55);
        const len = 1 - 0.8 * ss(0.35, 0.8, n.z) * ss(0.24, 0.02, Math.abs(p.y - 0.0));
        return [c, len];
      },
    });
    this.head.add(headFur);
    for (const sx of [-1, 1]) {
      const cheek = fur(sphereGeo(0.15, 0.14, 0.14), {
        length: 0.11, shells: 18, density: [75, 39], gravity: 0.45, colorFn: (p, n) => [mix(mix(ORANGE, LIGHT, 0.4), WHITE, ss(0.02, -0.1, p.y) + ss(0.3, 0.9, n.z) * 0.3), 1],
      });
      cheek.position.set(sx * 0.21, -0.08, 0.05);
      this.head.add(cheek);
      const pad = fur(sphereGeo(0.058, 0.048, 0.045, 16, 12), {
        length: 0.025, shells: 8, density: [36, 18], colorFn: () => [WHITE, 1],
      });
      pad.position.set(sx * 0.044, -0.09, 0.238);
      this.head.add(pad);
    }

    // ears
    const earMat = toon('#c97a35'), innerMat = toon('#e9a99c');
    for (const sx of [-1, 1]) {
      const eg = new THREE.ConeGeometry(0.095, 0.2, 12); eg.scale(1, 1, 0.55);
      const ear = new THREE.Mesh(eg, earMat);
      ear.position.set(sx * 0.2, 0.28, 0.0);
      ear.rotation.set(0.25, 0, -sx * 0.55);
      const ig = new THREE.ConeGeometry(0.065, 0.14, 10); ig.scale(1, 1, 0.4);
      const inner = new THREE.Mesh(ig, innerMat); inner.position.set(0, -0.015, 0.02);
      ear.add(inner);
      this.head.add(ear);
    }

    // eyes (big copper eyes, heavy grumpy lids)
    const irisMat = new THREE.MeshPhongMaterial({ color: '#de7d2a', emissive: '#6a3008', shininess: 120, specular: '#ffffff' });
    const pupilMat = new THREE.MeshPhongMaterial({ color: '#120804', shininess: 120, specular: '#888' });
    const hiMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const lidMat = toon('#c27532');
    this.lids = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.125, 0.035, 0.228);
      eye.rotation.y = sx * 0.28;
      const iris = new THREE.Mesh(sphereGeo(0.07, 0.07, 0.05, 20, 14), irisMat);
      const ring = new THREE.Mesh(sphereGeo(0.075, 0.075, 0.045, 20, 14), pupilMat); ring.position.z = -0.006;
      const pupil = new THREE.Mesh(sphereGeo(0.026, 0.032, 0.012, 14, 10), pupilMat); pupil.position.z = 0.044;
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), hiMat); hi.position.set(sx * 0.012 + 0.008, 0.024, 0.052);
      const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 4), hiMat); hi2.position.set(-0.018, -0.02, 0.05);
      const lidG = new THREE.SphereGeometry(0.079, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      lidG.scale(1, 1, 0.8);
      const lid = new THREE.Mesh(lidG, lidMat);
      lid.userData.sx = sx;
      eye.add(iris, ring, pupil, hi, hi2, lid);
      this.lids.push(lid);
      this.head.add(eye);
    }
    // nose, mouth, whiskers
    const nose = new THREE.Mesh(sphereGeo(0.036, 0.024, 0.018, 12, 8), toon('#b8726a'));
    nose.position.set(0, -0.03, 0.282);
    this.head.add(nose);
    const lineMat = toon('#5b3a30');
    const mouthG = new THREE.TorusGeometry(0.026, 0.0045, 5, 12, Math.PI * 0.75);
    const mouth = new THREE.Mesh(mouthG, lineMat);
    mouth.rotation.z = (Math.PI - Math.PI * 0.75) / 2;
    mouth.position.set(0, -0.15, 0.284);
    this.head.add(mouth);
    const phil = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4), lineMat);
    phil.position.set(0, -0.065, 0.284);
    this.head.add(phil);
    this.mouthOpen = new THREE.Mesh(sphereGeo(0.03, 0.025, 0.012, 12, 8), toon('#8c3f3f'));
    this.mouthOpen.position.set(0, -0.14, 0.28);
    this.mouthOpen.scale.y = 0.01;
    this.head.add(this.mouthOpen);
    const wpos = [];
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = -0.08 - i * 0.012;
      wpos.push(sx * 0.07, y, 0.25, sx * 0.34, y + 0.04 - i * 0.04, 0.19 - i * 0.02);
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    this.head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#fbf6ea', transparent: true, opacity: 0.85 })));

    // ---- legs ----
    const legColor = (top, bottomY) => (p) => [mix(top, WHITE, ss(bottomY + 0.05, bottomY - 0.05, p.y)), 1];
    this.legs = {};
    const mkFront = (sx, key) => {
      const piv = new THREE.Group(); piv.position.set(sx * 0.16, 0.34, 0.3);
      const leg = fur(sphereGeo(0.085, 0.17, 0.09), { length: 0.07, shells: 14, density: [54, 45], colorFn: legColor(mix(ORANGE, CREAM, 0.5), -0.02) });
      leg.position.set(0, -0.13, 0);
      const paw = fur(sphereGeo(0.088, 0.06, 0.11), { length: 0.05, shells: 12, density: [54, 30], colorFn: () => [WHITE, 1] });
      paw.position.set(0, -0.28, 0.035);
      piv.add(leg, paw);
      this.body.add(piv);
      this.legs[key] = piv;
    };
    const mkHind = (sx, key) => {
      const piv = new THREE.Group(); piv.position.set(sx * 0.18, 0.4, -0.3);
      const thigh = fur(sphereGeo(0.14, 0.19, 0.17), {
        length: 0.12, shells: 18, density: [75, 51], colorFn: (p, n) => [mix(mix(ORANGE, DARK, stripes(p, 30, 0.3)), CREAM, ss(-0.2, -0.6, n.z) * 0.6), 1],
      });
      thigh.position.set(0, -0.06, 0);
      const shin = fur(sphereGeo(0.075, 0.14, 0.08), { length: 0.07, shells: 12, density: [45, 39], colorFn: legColor(ORANGE, -0.06) });
      shin.position.set(0, -0.24, 0.02);
      const paw = fur(sphereGeo(0.088, 0.06, 0.11), { length: 0.05, shells: 12, density: [54, 30], colorFn: () => [WHITE, 1] });
      paw.position.set(0, -0.34, 0.04);
      piv.add(thigh, shin, paw);
      this.body.add(piv);
      this.legs[key] = piv;
    };
    mkFront(1, 'FL'); mkFront(-1, 'FR'); mkHind(1, 'HL'); mkHind(-1, 'HR');

    // ---- tail: a big plume ----
    this.tail = [];
    let parent = new THREE.Group();
    parent.position.set(0, 0.62, -0.44);
    this.body.add(parent);
    this.tailBase = parent;
    const radii = [0.085, 0.105, 0.115, 0.12, 0.115, 0.1, 0.075];
    const segLen = 0.1;
    radii.forEach((r, i) => {
      const seg = new THREE.Group();
      if (i > 0) seg.position.z = -segLen;
      const g = sphereGeo(r, r, segLen * 0.95, 18, 12);
      g.translate(0, 0, -segLen * 0.5);
      const f = fur(g, {
        length: 0.15, shells: 18, density: [51, 21], gravity: 0.5, colorFn: (p, n) => {
          let c = mix(ORANGE, DARK, i % 2 ? 0.25 : 0);
          c = mix(c, CREAM, ss(-0.2, -0.7, n.y) * 0.7);
          if (i === radii.length - 1) c = mix(c, LIGHT, 0.5);
          return [c, 1];
        },
      });
      seg.add(f);
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    });

    // ---- invisible shadow casters ----
    const shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (const [geo, pos, parentObj] of [
      [sphereGeo(0.42, 0.38, 0.58, 12, 8), [0, 0.5, 0], this.body],
      [sphereGeo(0.36, 0.33, 0.3, 12, 8), [0, 0, 0], this.head],
    ]) {
      const m = new THREE.Mesh(geo, shadowMat);
      m.position.set(...pos); m.castShadow = true;
      parentObj.add(m);
    }

    // ---- animation state ----
    this.t = 0; this.phase = 0;
    this.squash = 0; this.squashV = 0;
    this.sit = 0; this.lieAmt = 0;
    this.blinkT = 2; this.blink = 0;
    this.meow = 0;
    this.headLook = new THREE.Vector2();
  }

  land(impact) { this.squashV -= Math.min(impact, 14) * 0.25; }
  doMeow() { this.meow = 0.9; }

  update(dt, s) {
    // s: { speed, grounded, vy, idle, vel(Vector3) }
    this.t += dt;
    this.uTime.value = this.t;
    const move = Math.min(s.speed / 2.4, 1);
    const run = Math.max(0, Math.min((s.speed - 3.0) / 2.2, 1));
    if (s.speed > 0.05) this.phase += dt * (5.5 + s.speed * 2.0);

    // idle -> sit -> lie down ("我先躺了")
    const sitT = s.grounded && s.speed < 0.05 && s.idle > 4 ? 1 : 0;
    const lieT = s.grounded && s.speed < 0.05 && s.idle > 14 ? 1 : 0;
    this.sit += (sitT - this.sit) * Math.min(1, dt * 4);
    this.lieAmt += (lieT - this.lieAmt) * Math.min(1, dt * 2.5);
    const sit = this.sit * (1 - this.lieAmt), lie = this.lieAmt;

    // gait
    const p = this.phase;
    const amp = (0.55 + run * 0.35) * move;
    const walk = { FL: Math.sin(p), FR: Math.sin(p + Math.PI), HL: Math.sin(p + Math.PI), HR: Math.sin(p) };
    const gal = { FL: Math.sin(p), FR: Math.sin(p + 0.6), HL: Math.sin(p + Math.PI), HR: Math.sin(p + Math.PI + 0.6) };
    const air = s.grounded ? 0 : 1;
    this.airBlend = (this.airBlend || 0) + (air - (this.airBlend || 0)) * Math.min(1, dt * 12);
    const ab = this.airBlend;
    for (const k of ['FL', 'FR', 'HL', 'HR']) {
      const front = k[0] === 'F';
      let a = (walk[k] * (1 - run) + gal[k] * run) * amp;
      const airPose = front ? -0.9 + Math.min(0, s.vy) * -0.05 : 0.85;
      a = a * (1 - ab) + airPose * ab;
      // sitting: front legs straight, hind folded
      a += front ? 0.55 * sit : -1.15 * sit;
      a += front ? -0.9 * lie : 0.7 * lie;
      this.legs[k].rotation.x = a;
      this.legs[k].scale.y = front ? 1 + 0.4 * sit : 1;
    }

    // body motion
    const bob = (Math.abs(Math.sin(p)) * 0.035 * (1 - run) + Math.sin(p * 1) * 0.05 * run) * move * (1 - ab);
    this.squashV += (-this.squash * 180 - this.squashV * 14) * dt;
    this.squash += this.squashV * dt;
    const breathe = Math.sin(this.t * 2.2) * 0.012 * (1 - move);
    this.body.position.y = -0.36 + bob - 0.05 * sit;
    this.body.scale.set(1 - this.squash * 0.5 + breathe, 1 + this.squash + breathe * 0.5, 1 - this.squash * 0.3);
    const pitchAir = Math.max(-0.4, Math.min(0.4, -s.vy * 0.035)) * ab;
    this.hip.rotation.x = pitchAir + Math.sin(p + Math.PI / 2) * 0.07 * run * (1 - ab) - 0.5 * sit;
    this.lie.rotation.z = 1.42 * lie;
    this.lie.position.set(0.12 * lie, 0.24 * lie, 0);

    // head: look around when idle, look up when meowing
    this.meow = Math.max(0, this.meow - dt);
    const m = this.meow > 0 ? Math.sin(Math.min(1, (0.9 - this.meow) / 0.9) * Math.PI) : 0;
    const idleLook = (1 - move) * (1 - lie);
    this.head.rotation.y = Math.sin(this.t * 0.45) * 0.35 * idleLook * Math.min(1, s.idle / 2);
    this.head.rotation.x = -0.3 * m + 0.42 * sit * 0.6 + 0.05 * Math.sin(p * 2) * move - 0.25 * pitchAir;
    this.head.rotation.z = Math.sin(this.t * 0.3) * 0.08 * idleLook + 0.25 * lie;
    this.mouthOpen.scale.y = 0.01 + m * 1.4;

    // eyelids: grumpy by default, wider on meow, closed when sleeping, blink
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 0.14; this.blinkT = 2 + Math.random() * 4; }
    this.blink = Math.max(0, this.blink - dt);
    let lid = -0.28;
    lid += (-0.35) * m + 0.35 * sit * Math.min(1, Math.max(0, (s.idle - 8) / 4)) + 1.6 * lie;
    if (this.blink > 0) lid = 1.3;
    lid = Math.min(1.35, lid);
    for (const l of this.lids) {
      l.rotation.x += (lid - l.rotation.x) * Math.min(1, dt * 20);
      l.rotation.z = l.userData.sx * 0.32;
    }

    // tail
    const raised = (0.95 * move + 0.2) * (1 - sit) * (1 - lie) * (1 - ab) + ab * 0.3 - 0.35 * sit;
    this.tailBase.rotation.x = raised;
    this.tail.forEach((seg, i) => {
      const sway = Math.sin(this.t * (1.6 + move * 3) - i * 0.6) * (0.12 + 0.12 * (1 - move));
      seg.rotation.y = sway + (sit > 0.1 ? 0.28 * sit : 0);
      seg.rotation.x = i === 0 ? 0 : (move > 0.3 ? 0.12 : -0.1) * (1 - sit) + (s.vy * 0.015 * ab);
    });

    // fur inertia
    const target = new THREE.Vector3(-s.vel.x * 0.18, -s.vy * 0.08, -s.vel.z * 0.18);
    this.uDisplace.value.lerp(target, Math.min(1, dt * 6));
  }

  getHeadWorld(v = new THREE.Vector3()) { return this.head.getWorldPosition(v); }
}
