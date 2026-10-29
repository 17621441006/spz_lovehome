// 星湖 · 北边新开辟的一大片湖水：水面、木栈桥、钓具小屋、芦苇睡莲、小船，
// 以及湖守「阿渔伯」（致敬 How to Fish 的大眼睛低多边形渔夫）和水下的鱼影。
import * as THREE from 'three';
import { LAYOUT, heightAt, lakeShore, lakeDist } from './terrain.js';
import { toon, rng } from './toon.js';
import { createDreamWater } from './dream.js';

const L = LAYOUT.lake;
// The pier runs from the south-facing shore (towards the main island) out over the water.
export const PIER = { x: L.x, z0: L.z + L.r + 1.2, z1: L.z + 5.2, w: 1.9, top: 0.4 };
export const KEEPER_POS = { x: L.x + 2.4, z: L.z + L.r + 2.6 };
export const HUT = { x: L.x - 7.5, z: L.z + L.r + 4.5, w: 3.6, d: 3.0 };
export const FISHING_SPOT = { x: PIER.x, z: PIER.z1 + 0.6, y: PIER.top, yaw: Math.PI }; // looking -z (over the lake)

export function onPier(x, z, pad = 0) { return Math.abs(x - PIER.x) < PIER.w / 2 + pad && z < PIER.z0 + pad && z > PIER.z1 - pad; }
/** the lake keeps the meadow, flowers and trees off its pier, hut and shoreline */
export function nearLake(x, z, pad = 0) {
  if (lakeDist(x, z) < lakeShore(x, z) + 0.6 + pad) return true;
  if (onPier(x, z, 0.8 + pad)) return true;
  if (Math.abs(x - HUT.x) < HUT.w / 2 + 1 + pad && Math.abs(z - HUT.z) < HUT.d / 2 + 1 + pad) return true;
  return Math.hypot(x - KEEPER_POS.x, z - KEEPER_POS.z) < 1.2 + pad;
}

const wood = () => toon('#a77b4f'), woodDark = () => toon('#6f4f33');

function buildPier(g, colliders) {
  const len = PIER.z0 - PIER.z1, planks = Math.round(len / 0.32);
  const plankGeo = new THREE.BoxGeometry(PIER.w, 0.08, 0.28), R = rng(51);
  for (let i = 0; i < planks; i++) {
    const p = new THREE.Mesh(plankGeo, i % 4 === 1 ? woodDark() : wood());
    p.position.set(PIER.x + (R() - 0.5) * 0.05, PIER.top - 0.04, PIER.z0 - (i + 0.5) * (len / planks));
    p.rotation.y = (R() - 0.5) * 0.03; p.receiveShadow = true; p.castShadow = true; g.add(p);
  }
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 2.9, 7);
  for (let z = PIER.z0 - 0.2; z > PIER.z1 - 0.1; z -= 1.8) for (const s of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, woodDark()); post.position.set(PIER.x + s * (PIER.w / 2 - 0.05), PIER.top - 1.35, z); post.castShadow = true; g.add(post);
  }
  // little rail + lantern at the far end
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 2.4), wood()); rail.position.set(PIER.x + s * (PIER.w / 2 - 0.05), PIER.top + 0.62, PIER.z1 + 1.3); g.add(rail);
    for (const z of [PIER.z1 + 0.15, PIER.z1 + 2.45]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6), woodDark()); p.position.set(PIER.x + s * (PIER.w / 2 - 0.05), PIER.top + 0.32, z); g.add(p); }
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), woodDark()); pole.position.set(PIER.x + PIER.w / 2 - 0.05, PIER.top + 0.8, PIER.z1 + 0.15); g.add(pole);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffb648', emissiveIntensity: 0.8 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), lampMat); lamp.position.set(PIER.x + PIER.w / 2 - 0.05, PIER.top + 1.55, PIER.z1 + 0.15); g.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 8), woodDark()); cap.position.copy(lamp.position).y += 0.15; g.add(cap);
  // walkable deck (floor only) – the lake-water check in main.js lets the player stand here
  colliders.push({ type: 'box', minX: PIER.x - PIER.w / 2, maxX: PIER.x + PIER.w / 2, minZ: PIER.z1, maxZ: PIER.z0, top: PIER.top, floorOnly: true });
  for (const s of [-1, 1]) colliders.push({ type: 'box', minX: PIER.x + s * (PIER.w / 2 - 0.05) - 0.05, maxX: PIER.x + s * (PIER.w / 2 - 0.05) + 0.05, minZ: PIER.z1, maxZ: PIER.z1 + 2.5, top: 999 });
  return lampMat;
}

function buildHut(g, colliders) {
  const { x, z, w, d } = HUT, y = heightAt(x, z);
  const hut = new THREE.Group(); hut.position.set(x, y, z); g.add(hut);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3), toon('#8d8c84')); base.position.y = 0.05; hut.add(base);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 2.0, d), toon('#c9a978')); walls.position.y = 1.15; walls.castShadow = true; walls.receiveShadow = true; hut.add(walls);
  for (const s of [-1, 1]) { const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.12, d / 2 + 0.6), toon('#5d6f4a')); roof.position.set(0, 2.55, s * (d / 4 + 0.08)); roof.rotation.x = s * 0.55; roof.castShadow = true; hut.add(roof); }
  const gable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, d / 2 + 0.05, w, 3, 1), toon('#b8986a')); gable.rotation.z = Math.PI / 2; gable.rotation.x = Math.PI / 2; gable.position.y = 2.3; gable.scale.set(1, 1, 0.55); hut.add(gable);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.06), woodDark()); door.position.set(0.6, 0.9, d / 2 + 0.02); hut.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.06), new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffbe5c', emissiveIntensity: 0.5 })); win.position.set(-0.8, 1.35, d / 2 + 0.02); hut.add(win);
  // signboard "星湖钓场"
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d');
  c.fillStyle = '#f2e3c2'; c.fillRect(0, 0, 256, 96); c.strokeStyle = '#6f4f33'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 88);
  c.fillStyle = '#3f3226'; c.font = '600 46px STKaiti,KaiTi,serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('星湖钓场', 128, 50);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(-0.3, 2.05, d / 2 + 0.05); hut.add(sign);
  // rods leaning on the wall + a bucket
  for (let i = 0; i < 3; i++) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 2.4, 5), woodDark()); rod.position.set(w / 2 + 0.1, 1.15, -0.6 + i * 0.35); rod.rotation.z = 0.25; hut.add(rod); }
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 10, 1, true), toon('#6e8fa8', { side: THREE.DoubleSide })); bucket.position.set(1.5, 0.2, d / 2 + 0.5); hut.add(bucket);
  hut.rotation.y = 0.15;
  colliders.push({ type: 'box', minX: x - w / 2 - 0.1, maxX: x + w / 2 + 0.1, minZ: z - d / 2 - 0.1, maxZ: z + d / 2 + 0.1, top: 999 });
  return win.material;
}

function buildShore(g, colliders) {
  const R = rng(77);
  // reeds and cattails hugging the shoreline (instanced)
  const reedGeo = new THREE.CylinderGeometry(0.012, 0.02, 1, 4); reedGeo.translate(0, 0.5, 0);
  const reeds = new THREE.InstancedMesh(reedGeo, toon('#5a7d34'), 260), tips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.035, 0.14, 2, 5), toon('#6b4a2a'), 90);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  let n = 0, t = 0;
  for (let i = 0; i < 1200 && n < 260; i++) {
    const a = R() * Math.PI * 2, sx = L.x + Math.cos(a), sz = L.z + Math.sin(a), shore = lakeShore(sx, sz), d = shore + (R() - 0.65) * 1.6;
    const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    if (Math.abs(x - PIER.x) < 2.2 && z > L.z) continue; // keep the pier mouth clear
    if (Math.sin(a * 3 + 1) < -0.35 && R() < 0.8) continue; // clumps, not a hedge
    const h = 0.7 + R() * 0.9, y = Math.max(heightAt(x, z), L.level - 0.05);
    m.compose(p.set(x, y, z), q.setFromEuler(e.set((R() - 0.5) * 0.25, R() * 6, (R() - 0.5) * 0.25)), s.set(1, h, 1)); reeds.setMatrixAt(n++, m);
    if (t < 90 && R() < 0.4) { m.compose(p.set(x, y + h, z), q, s.set(1, 1, 1)); tips.setMatrixAt(t++, m); }
  }
  reeds.count = n; tips.count = t; g.add(reeds, tips);
  // lily pads with a few pink flowers
  const padMat = toon('#4f8a35'), flowerMat = toon('#f6c3d6', { side: THREE.DoubleSide });
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, d = lakeShore(L.x + Math.cos(a), L.z + Math.sin(a)) * (0.55 + R() * 0.35);
    const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d, r = 0.35 + R() * 0.35;
    if (Math.abs(x - PIER.x) < 2.5 && z > L.z - 8) continue; // keep the casting lane open
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 18, 1, false, 0.3, Math.PI * 2 - 0.6), padMat);
    pad.position.set(x, L.level + 0.02, z); pad.rotation.y = R() * 6; pad.receiveShadow = true; g.add(pad);
    if (R() > 0.6) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 6, 1, true), flowerMat); fl.rotation.x = Math.PI; fl.position.set(x + 0.1, L.level + 0.1, z); g.add(fl); }
  }
  // shoreline rocks
  const rockMat = toon('#8d8c84');
  for (let i = 0; i < 22; i++) {
    const a = R() * Math.PI * 2, d = lakeShore(L.x + Math.cos(a), L.z + Math.sin(a)) + 0.4 + R() * 1.2;
    const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    if (Math.abs(x - PIER.x) < 2.4 && z > L.z) continue;
    const rr = 0.25 + R() * 0.45, rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), rockMat);
    rock.scale.set(1, 0.6, 0.9); rock.rotation.y = R() * 6; rock.position.set(x, heightAt(x, z) - 0.05, z); rock.castShadow = true; g.add(rock);
    if (rr > 0.5) colliders.push({ type: 'circle', x, z, r: rr * 0.8, top: heightAt(x, z) + rr * 0.5 });
  }
  // a small rowboat tied next to the pier
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#8a5a3a', { side: THREE.DoubleSide }));
  hull.scale.set(0.75, 0.38, 1.8); boat.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), wood()); seat.position.y = -0.08; boat.add(seat);
  boat.position.set(PIER.x - 2.0, L.level + 0.18, PIER.z1 + 3.2); boat.rotation.y = 0.18; g.add(boat);
  return boat;
}

// ---------------- the keeper ----------------
function buildKeeper() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = toon('#e8c39e'), jacket = toon('#3d5a80'), apron = toon('#e07b39'), white = toon('#f7f4ec'), black = toon('#1d2123'), straw = toon('#d9b56a');
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.75, 10), apron); legs.position.y = 0.38; body.add(legs);
  for (const s of [-1, 1]) { const boot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), toon('#3b3b36')); boot.scale.set(1, 0.6, 1.4); boot.position.set(s * 0.13, 0.06, 0.06); body.add(boot); }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.75, 12), jacket); torso.position.y = 1.08; torso.castShadow = true; body.add(torso);
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.08), apron); bib.position.set(0, 1.05, 0.29); body.add(bib);
  for (const s of [-1, 1]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.04), apron); strap.position.set(s * 0.18, 1.32, 0.27); strap.rotation.z = s * 0.15; body.add(strap); }
  const head = new THREE.Group(); head.position.y = 1.72; body.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), skin); skull.scale.set(0.95, 1.12, 0.95); skull.castShadow = true; head.add(skull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon('#d9a07c')); nose.position.set(0, -0.02, 0.32); head.add(nose);
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), white); eye.position.set(s * 0.13, 0.1, 0.25); head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), black); pupil.position.set(s * 0.13, 0.1, 0.36); head.add(pupil); eyes.push(pupil);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 2, 6), white); brow.rotation.z = Math.PI / 2 + s * 0.25; brow.position.set(s * 0.14, 0.26, 0.27); head.add(brow);
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 2, 6), white); stache.rotation.z = Math.PI / 2 - s * 0.45; stache.position.set(s * 0.09, -0.1, 0.3); head.add(stache);
  }
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white); beard.scale.set(1, 0.8, 0.6); beard.position.set(0, -0.24, 0.18); head.add(beard);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 20), straw); brim.position.y = 0.26; head.add(brim);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.34, 16), straw); crown.position.y = 0.44; head.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.06, 16), toon('#b9452f')); band.position.y = 0.33; head.add(band);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.36, 1.38, 0); body.add(arm);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 8), jacket); sleeve.position.y = -0.3; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin); hand.position.y = -0.64; arm.add(hand);
    arm.rotation.z = s * 0.18; arms.push(arm);
  }
  // The rod is planted on the ground; the left palm naturally rests around it.
  arms[0].rotation.set(0,0,-.22);arms[1].rotation.set(0,0,.12);
  const hand=new THREE.Vector3(0,-.64,0).applyEuler(arms[0].rotation).add(arms[0].position);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.012,.028,2.5,10),woodDark());rod.name='阿渔伯 · 落地扶竿';rod.position.set(hand.x,1.25,hand.z+.015);root.add(rod);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(hand.x,2.49,hand.z+.015),new THREE.Vector3(hand.x-.10,2.25,hand.z+.02),new THREE.Vector3(hand.x-.10,.10,hand.z+.02)]),new THREE.LineBasicMaterial({color:'#cbbd9a'}));root.add(line);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, head, eyes, arms };
}

// ---------------- fish shadows ----------------
function buildShadows(g, count) {
  const geo = new THREE.CircleGeometry(0.5, 18), list = [], R = rng(9);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: '#0b2526', transparent: true, opacity: 0.28, depthWrite: false });
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
    const size = 0.35 + R() * 0.6; m.scale.set(size * 0.38, size, 1);
    const a = R() * 6.28, d = R() * (L.r - 3);
    m.position.set(L.x + Math.cos(a) * d, L.level + 0.012, L.z + Math.sin(a) * d); g.add(m);
    list.push({ mesh: m, size, heading: R() * 6.28, speed: 0.4 + R() * 0.5, turn: 0, wait: R() * 2, target: null });
  }
  return list;
}

export function buildLake(scene, colliders) {
  const g = new THREE.Group(); g.name = '星湖 · 阿渔伯的钓场';
  const water = createDreamWater(L.x, L.z, L.r * 1.08); water.position.y = L.level; water.name = '星湖水面'; g.add(water);
  const lampMat = buildPier(g, colliders), winMat = buildHut(g, colliders), boat = buildShore(g, colliders);
  const keeper = buildKeeper();
  keeper.root.position.set(KEEPER_POS.x, heightAt(KEEPER_POS.x, KEEPER_POS.z), KEEPER_POS.z);
  keeper.root.rotation.y = 0.4; g.add(keeper.root);
  colliders.push({ type: 'circle', x: KEEPER_POS.x, z: KEEPER_POS.z, r: 0.45, top: 999 });
  const shadows = buildShadows(g, 8);
  scene.add(g);
  let t = 0, talkT = 0;
  return {
    group: g, water, keeper, shadows,
    talk(seconds = 2.5) { talkT = seconds; },
    keeperHead: () => keeper.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.75, 0)),
    update(dt, playerPos, night = 0) {
      t += dt;
      lampMat.emissiveIntensity = 0.5 + night * 2.2; winMat.emissiveIntensity = 0.35 + night * 1.6;
      boat.position.y = L.level + 0.18 + Math.sin(t * 1.3) * 0.025; boat.rotation.z = Math.sin(t * 0.9) * 0.03;
      // keeper: breathing, looks at the player when nearby, little nods while talking
      const k = keeper, dx = playerPos.x - k.root.position.x, dz = playerPos.z - k.root.position.z, d = Math.hypot(dx, dz);
      const want = d < 7 ? Math.atan2(dx, dz) : 0.4 + Math.sin(t * 0.15) * 0.6;
      let dy = want - k.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); k.root.rotation.y += dy * Math.min(1, dt * 2.5);
      k.body.scale.y = 1 + Math.sin(t * 1.6) * 0.012;
      talkT = Math.max(0, talkT - dt);
      k.head.rotation.x = talkT > 0 ? Math.sin(t * 9) * 0.08 : Math.sin(t * 0.7) * 0.04;
      k.arms[1].rotation.x = talkT > 0 ? -0.4 + Math.sin(t * 6) * 0.3 : Math.sin(t * 1.6) * 0.05;
      const jitter = Math.sin(t * 13.7) * Math.sin(t * 3.1) > 0.92 ? 0.02 : 0; // the famous nervous eyes
      for (const [i, e] of k.eyes.entries()) e.position.x = (i ? 0.13 : -0.13) + jitter;
      // fish shadows wander lazily inside the shoreline (unless the fishing game borrowed one)
      for (const f of shadows) {
        if (f.locked) continue;
        const p = f.mesh.position;
        f.wait -= dt;
        if (f.wait < 0) { f.wait = 1.5 + Math.random() * 3; f.turn = (Math.random() - 0.5) * 1.6; }
        f.heading += f.turn * dt;
        const nx = p.x + Math.sin(f.heading) * f.speed * dt, nz = p.z + Math.cos(f.heading) * f.speed * dt;
        if (lakeDist(nx, nz) > lakeShore(nx, nz) - 1.6) { f.heading += Math.PI * dt * 2; continue; }
        p.x = nx; p.z = nz; f.mesh.rotation.z = -f.heading;
      }
    },
  };
}
