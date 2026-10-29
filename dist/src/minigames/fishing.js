// 星湖钓鱼 —— 第一人称 3D 钓鱼小游戏（灵感：How to Fish 的手感 + 吉卜力的湖）
//
// 玩法与“拉杆力度”设定
//  1. 抛竿：按住左键/空格把竿往后拉，力度条来回摆动；在金色区域松手 = 完美抛竿（更远、更容易遇到稀有鱼）。
//  2. 等待：鱼影会慢慢靠近浮漂，先轻轻“试咬”几下（这时别动！），浮漂猛地沉下去才是真的咬钩。
//  3. 提竿：浮漂沉下的 0.75 秒内点一下左键/空格。太早会吓跑鱼，太晚鱼会偷走鱼饵。
//  4. 搏斗：按住 = 收线（张力上升），松开 = 放线（张力下降、鱼会把线拖远）。
//     · 张力 > 100% 超过 0.45 秒 → 断线；张力太低太久 → 鱼脱钩。
//     · 鼠标左右（或 A/D）是竿的方向：往鱼游动的“反方向”拉杆，张力涨得慢、鱼累得快。
//     · 鱼“猛冲”时张力暴涨，要及时松手或反向拉；鱼“跳出水面”时必须松手，否则线会被扯断。
//     · 鱼体力见底后会翻白肚，这时可以放心狂收线。
//  5. 上岸：鱼会飞到你面前（就像 How to Fish 那样），记录进鱼类图鉴。
import * as THREE from 'three';
import { LAYOUT, lakeDist, lakeShore } from '../terrain.js';
import { toon } from '../toon.js';
import { loadJournal, saveJournal } from './journal.js';

const L = LAYOUT.lake;
export const FISH = [
  { id: 'minnow', name: '溪光小鱼', rar: 1, w: [0.08, 0.35], str: 0.22, sta: 3, spd: 1.3, col: '#9fc4d8', belly: '#eef6f8', shape: [1, 0.32, 0.22], eye: 0.17, text: '像一片会游泳的阳光碎片。' },
  { id: 'crucian', name: '胖头鲫', rar: 1, w: [0.3, 1.3], str: 0.36, sta: 5, spd: 0.9, col: '#a39a55', belly: '#e8dfb0', shape: [1, 0.58, 0.32], eye: 0.16, text: '圆滚滚的，吃饱了就发呆。' },
  { id: 'trout', name: '彩虹鳟', rar: 2, w: [0.8, 2.6], str: 0.55, sta: 7, spd: 1.3, col: '#7d9a8a', belly: '#f3d9d0', stripe: '#e58a9a', shape: [1.25, 0.36, 0.26], eye: 0.13, text: '身侧的彩虹，是雨后留下的颜色。' },
  { id: 'starebass', name: '瞪眼鲈', rar: 2, w: [1, 3.6], str: 0.62, sta: 8, spd: 1.1, col: '#6f9a4e', belly: '#e9eec8', shape: [1.1, 0.5, 0.32], eye: 0.3, text: '从出生起就是这副被吓到的表情。' },
  { id: 'puffer', name: '鼓鼓河豚', rar: 3, w: [0.4, 1.1], str: 0.45, sta: 6, spd: 0.8, col: '#e8c45a', belly: '#fff4c8', shape: [0.8, 0.78, 0.74], eye: 0.2, spikes: true, text: '一紧张就鼓成球。现在它非常紧张。' },
  { id: 'koi', name: '红白锦鲤', rar: 3, w: [2, 5.5], str: 0.68, sta: 9, spd: 1.0, col: '#f6f1e8', belly: '#ffffff', spots: '#e0472f', shape: [1.25, 0.42, 0.3], eye: 0.13, text: '据说是从神社的池子里偷偷游过来的。' },
  { id: 'catfish', name: '大胡子鲶', rar: 3, w: [3, 9], str: 0.85, sta: 12, spd: 0.85, col: '#5a4a3a', belly: '#b8a58a', shape: [1.55, 0.38, 0.38], eye: 0.11, whiskers: true, night: true, text: '湖底的老前辈，夜里才出来散步。' },
  { id: 'goldkoi', name: '湖主 · 金鲤', rar: 4, w: [7, 16], str: 1.0, sta: 22, spd: 1.15, col: '#f2b632', belly: '#ffe9a0', shape: [1.45, 0.46, 0.32], eye: 0.13, glow: true, text: '星湖的主人。被它看一眼，一整年都会走运。' },
  { id: 'boot', name: '旧雨靴', rar: 1, w: [0.5, 0.9], str: 0.14, sta: 1.5, spd: 0.2, junk: true, col: '#3e5a74', text: '不知道是谁的。里面住着一只小螃蟹。' },
  { id: 'soot', name: '湿漉漉的小煤球', rar: 2, w: [0.01, 0.02], str: 0.25, sta: 2.5, spd: 1.6, junk: true, col: '#151515', text: '掉进湖里的小煤球，上岸后抖抖水一溜烟跑了。' },
];
const RARITY = ['', '常见', '少见', '稀有', '传说'];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function pickFish({ dist, perfect, night }) {
  const far = clamp((dist - 5) / 11, 0, 1);
  const w = FISH.map((f) => {
    let v = { 1: 10, 2: 4.2, 3: 1.6, 4: 0.18 }[f.rar];
    if (f.rar >= 2) v *= 0.7 + far * 0.9;
    if (f.rar >= 3) v *= perfect ? 2.2 : 1;
    if (f.rar === 4) v *= (perfect ? 2.5 : 1) * (night > 0.5 ? 2 : 1) * (far > 0.7 ? 1.8 : 0.6);
    if (f.night) v *= night > 0.5 ? 2.4 : 0.35;
    if (f.junk) v *= f.id === 'boot' ? 0.45 : 0.25;
    return v;
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < FISH.length; i++) { r -= w[i]; if (r <= 0) return FISH[i]; }
  return FISH[0];
}

// ---------- low-poly, googly-eyed fish models ----------
const _fishMats = new Map();
function fishMat(color, o = {}) { const k = color + JSON.stringify(o); if (!_fishMats.has(k)) _fishMats.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.62, metalness: 0, ...o })); return _fishMats.get(k); }
export function buildFishMesh(def) {
  const g = new THREE.Group(), flat = (c, o = {}) => fishMat(c, o);
  if (def.id === 'boot') {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 7), flat(def.col)); leg.position.y = 0.2; g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), flat(def.col)); foot.position.set(0.13, -0.08, 0); g.add(foot);
    const crab = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), flat('#e0603a')); crab.position.set(0, 0.5, 0); g.add(crab);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), flat('#111')); e.position.set(s * 0.03, 0.56, 0.05); g.add(e); }
    g.rotation.z = -0.3; return g;
  }
  if (def.id === 'soot') {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), flat('#141414')); g.add(b);
    for (let i = 0; i < 14; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), flat('#141414')); const a = i * 2.4, e = Math.acos(1 - 2 * ((i + 0.5) / 14)); sp.position.setFromSphericalCoords(0.22, e, a); sp.lookAt(0, 0, 0); sp.rotateX(-Math.PI / 2); g.add(sp); }
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), flat('#fff')); w.position.set(0.17, 0.05, s * 0.08); g.add(w); const p = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), flat('#000')); p.position.set(0.22, 0.05, s * 0.08); g.add(p); }
    return g;
  }
  const [lx, ly, lz] = def.shape;
  const bodyMat = flat(def.col, def.glow ? { emissive: '#7a4a00', emissiveIntensity: 0.6 } : {});
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), bodyMat); body.scale.set(lx, ly, lz); g.add(body);
  const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), flat(def.belly)); belly.scale.set(lx * 0.86, ly * 0.62, lz * 0.92); belly.position.y = -ly * 0.16; g.add(belly);
  const tail = new THREE.Group(); tail.position.x = -lx * 0.48; g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(ly * 0.55, lx * 0.38, 4), bodyMat); fin.rotation.z = -Math.PI / 2; fin.scale.z = 0.25; fin.position.x = -lx * 0.16; tail.add(fin);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(lx * 0.18, ly * 0.45, 4), bodyMat); dorsal.scale.z = 0.25; dorsal.position.set(-lx * 0.05, ly * 0.5, 0); g.add(dorsal);
  for (const s of [-1, 1]) { const pec = new THREE.Mesh(new THREE.ConeGeometry(ly * 0.16, ly * 0.4, 3), bodyMat); pec.position.set(lx * 0.12, -ly * 0.12, s * lz * 0.45); pec.rotation.set(s * 1.1, 0, 0.6); g.add(pec); }
  if (def.stripe) { const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), flat(def.stripe)); st.scale.set(lx * 0.8, ly * 0.18, lz * 1.02); g.add(st); }
  if (def.spots) for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.09 + (i % 2) * 0.04, 6, 4), flat(def.spots)); sp.position.set(lx * (0.25 - i * 0.13), ly * (0.18 + (i % 3) * 0.06), (i % 2 ? 1 : -1) * lz * 0.36); sp.scale.z = 0.4; g.add(sp); }
  if (def.spikes) for (let i = 0; i < 18; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), flat('#c7a03a')); sp.position.setFromSphericalCoords(0.5, Math.acos(1 - 2 * ((i + 0.5) / 18)), i * 2.4); sp.position.multiply(new THREE.Vector3(lx, ly, lz)); sp.lookAt(0, 0, 0); sp.rotateX(-Math.PI / 2); g.add(sp); }
  if (def.whiskers) for (const s of [-1, 1]) for (const k of [0, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.45, 4), flat('#2c241c')); w.position.set(lx * 0.55, -ly * 0.1 - k * 0.05, s * lz * 0.25); w.rotation.set(s * (0.7 + k * 0.3), 0, -1.2); g.add(w); }
  // the eyes: big, round and a little bit panicked
  const er = def.id === 'starebass' ? def.eye : Math.min(def.eye, ly * 0.36);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(er, 12, 10), flat('#ffffff')); eye.position.set(lx * 0.3, ly * 0.14, s * lz * 0.42); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(er * 0.42, 10, 8), flat('#111111')); pupil.position.set(lx * 0.3 + er * 0.25, ly * 0.14 + er * 0.1, s * (lz * 0.42 + er * 0.7)); g.add(pupil);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(ly * 0.09, ly * 0.03, 5, 10), flat('#5a2a2a')); mouth.position.set(lx * 0.5, -ly * 0.05, 0); mouth.rotation.y = Math.PI / 2; g.add(mouth);
  g.userData.tail = tail;
  return g;
}

const STYLE = `
#fishHud{position:fixed;inset:0;z-index:70;pointer-events:none;font-family:inherit;color:#fffaf0;user-select:none}
#fishHud .fh-capture{position:absolute;inset:0;pointer-events:auto;cursor:crosshair;touch-action:none}
#fishHud .fh-top{position:absolute;left:18px;top:16px;right:18px;display:flex;align-items:center;gap:10px;pointer-events:none}
#fishHud .fh-top b{font-family:'STKaiti','KaiTi',serif;font-size:22px;letter-spacing:5px;text-shadow:0 2px 6px #0009}
#fishHud .fh-chip{font-size:12px;background:#0d1f1a8c;border-radius:999px;padding:5px 11px;letter-spacing:1px}
#fishHud .fh-exit{margin-left:auto;pointer-events:auto;border:0;border-radius:999px;padding:9px 16px;font:inherit;font-size:13px;background:#f8f2dce6;color:#4d6649;cursor:pointer;box-shadow:0 3px 10px #0004}
#fishHud .fh-cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px;border:2px solid #fffaf0aa;border-radius:50%;box-shadow:0 0 6px #0006}
#fishHud .fh-power{position:absolute;left:calc(50% + 44px);top:calc(50% - 90px);width:16px;height:180px;border-radius:9px;background:#0d1f1a99;box-shadow:inset 0 0 0 2px #fffaf055;overflow:hidden}
#fishHud .fh-power i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,#9ed0a0,#f0c06c 80%,#ff8a5c);border-radius:9px}
#fishHud .fh-power em{position:absolute;left:-2px;right:-2px;height:12%;bottom:84%;border:2px solid #ffd36e;border-radius:4px;box-shadow:0 0 10px #ffd36e}
#fishHud .fh-fight{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);width:min(460px,86vw);display:grid;gap:7px}
#fishHud .fh-row{display:flex;align-items:center;gap:10px;font-size:12px;text-shadow:0 1px 3px #000a}
#fishHud .fh-row span:first-child{width:44px;flex:none}
#fishHud .fh-bar{position:relative;flex:1;height:14px;border-radius:8px;background:#0d1f1aa6;box-shadow:inset 0 0 0 2px #fffaf044;overflow:hidden}
#fishHud .fh-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:8px;transition:background .2s}
#fishHud .fh-bar .zone{position:absolute;top:0;bottom:0;left:30%;width:52%;background:#9ed0a033}
#fishHud .fh-bar.danger{animation:fhShake .12s infinite}
#fishHud .fh-hint{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);font-size:14px;letter-spacing:1px;background:#0d1f1a99;border-radius:999px;padding:8px 18px;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis}
#fishHud .fh-alert{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font-family:'STKaiti','KaiTi',serif;font-size:clamp(28px,4.6vw,52px);font-weight:700;letter-spacing:6px;text-shadow:0 3px 12px #000b,0 0 24px #ffcf6a88;opacity:0;transition:opacity .2s;white-space:nowrap}
#fishHud .fh-alert.show{opacity:1;animation:fhPop .35s ease-out}
#fishHud .fh-card{position:absolute;right:clamp(14px,5vw,70px);top:50%;transform:translateY(-50%);width:min(320px,86vw);pointer-events:auto;background:linear-gradient(180deg,#fdf8e8f7,#f2efd9f2);color:#3f5338;border-radius:22px;padding:20px 22px;box-shadow:0 18px 50px #0007;animation:fhCard .45s ease-out}
#fishHud .fh-card h3{margin:0;font-family:'STKaiti','KaiTi',serif;font-size:28px;letter-spacing:4px;font-weight:500;color:#3b5a46}
#fishHud .fh-card .rar{font-size:13px;color:#e0a443;letter-spacing:2px;margin:2px 0 10px}
#fishHud .fh-card .stats{display:flex;gap:16px;font-size:13px;color:#6f7d63;margin-bottom:10px}
#fishHud .fh-card .stats b{display:block;font-size:22px;color:#a0622c}
#fishHud .fh-card p{font-size:13px;line-height:1.7;margin:0 0 12px}
#fishHud .fh-card .tags span{display:inline-block;font-size:11px;color:#fff;background:#d4913d;border-radius:999px;padding:2px 9px;margin:0 6px 10px 0}
#fishHud .fh-card .btns{display:flex;gap:8px}
#fishHud .fh-card button{flex:1;border:0;border-radius:999px;padding:10px;font:inherit;font-size:14px;letter-spacing:2px;cursor:pointer;background:#e4e9ca;color:#40583c;box-shadow:0 3px 0 #b7bf98}
#fishHud .fh-card button.main{background:linear-gradient(180deg,#f0c06c,#d4913d);color:#fffaf0;box-shadow:0 3px 0 #a96d2c}
#fishHud [hidden]{display:none!important}
@keyframes fhShake{50%{transform:translateX(2px)}}@keyframes fhPop{from{transform:translate(-50%,-50%) scale(1.4)}}
@keyframes fhCard{from{opacity:0;transform:translate(30px,-50%)}}
`;

export class FishingGame {
  constructor({ scene, camera, sound, getNight = () => 0, onOpen, onClose, shadows = [], say = null }) {
    this.scene = scene; this.camera = camera; this.sound = sound; this.getNight = getNight;
    this.onOpen = onOpen; this.onClose = onClose; this.shadows = shadows; this.say = say;
    this.open = false; this.built = false;
    this.spot = new THREE.Vector3(L.x, 0.4, L.z + 5.8); this.baseYaw = Math.PI;
    this._kd = (e) => this.key(e, true); this._ku = (e) => this.key(e, false);
  }

  // ---------- setup ----------
  build() {
    if (this.built) return; this.built = true;
    if (!document.getElementById('fishHudStyle')) { const st = document.createElement('style'); st.id = 'fishHudStyle'; st.textContent = STYLE; document.head.appendChild(st); }
    // rod: a chain of segments so it can bend under tension
    this.rod = new THREE.Group(); this.rod.position.set(0.36, -0.4, -0.62);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 8), toon('#c9a978')); grip.position.y = 0.05; this.rod.add(grip);
    const reel = new THREE.Group(); reel.position.set(-0.05, 0.16, 0); this.rod.add(reel);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.035, 14), toon('#8a8f96')); spool.rotation.z = Math.PI / 2; reel.add(spool);
    this.handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.012), toon('#3a2f26')); this.handle.position.set(-0.03, 0.03, 0); reel.add(this.handle); this.spool = spool;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), toon('#e8c39e')); hand.scale.set(1.1, 1.4, 1); hand.position.set(0.035, 0.0, 0.02); this.rod.add(hand);
    this.segs = []; let parent = this.rod; const N = 9, len = 0.27;
    for (let i = 0; i < N; i++) {
      const seg = new THREE.Group(); seg.position.y = i === 0 ? 0.26 : len;
      const r0 = 0.022 * (1 - i / N) + 0.004, r1 = 0.022 * (1 - (i + 1) / N) + 0.004;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), toon(i % 3 === 2 ? '#d7c9a0' : '#5b3b26')); m.position.y = len / 2; seg.add(m);
      if (i % 3 === 1) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 4, 8), toon('#c0c4c8')); ring.position.set(0, len * 0.5, 0.02); seg.add(ring); }
      parent.add(seg); this.segs.push(seg); parent = seg;
    }
    this.tip = new THREE.Object3D(); this.tip.position.y = len; parent.add(this.tip);
    this.rod.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; o.renderOrder = 5; } });
    // line, bobber, fish, fx
    this.linePts = Array.from({ length: 28 }, () => new THREE.Vector3());
    this.lineGeo = new THREE.BufferGeometry().setFromPoints(this.linePts);
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: '#f4f1e6', transparent: true, opacity: 0.85 })); this.line.frustumCulled = false;
    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#e0472f')); this.bobber.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#fffaf0')); this.bobber.add(bot);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5), toon('#e0472f')); stick.position.y = 0.1; this.bobber.add(stick);
    this.ripples = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: '#e8f6f2', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.userData.t = 0; return m; });
    this.dropN = 80; this.dropPos = new Float32Array(this.dropN * 3); this.dropVel = Array.from({ length: this.dropN }, () => new THREE.Vector3()); this.dropLife = new Float32Array(this.dropN);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3));
    this.drops = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#f2fbff', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false })); this.drops.frustumCulled = false;
    this.fxGroup = new THREE.Group(); this.fxGroup.add(this.line, this.bobber, this.drops, ...this.ripples);
    // HUD
    const hud = document.createElement('div'); hud.id = 'fishHud'; hud.hidden = true;
    hud.innerHTML = `<div class="fh-capture"></div>
      <div class="fh-top"><b>星湖钓场</b><span class="fh-chip fh-dex"></span><span class="fh-chip fh-bag"></span><button class="fh-exit">收竿离开 · Esc</button></div>
      <div class="fh-cross"></div>
      <div class="fh-power" hidden><em></em><i></i></div>
      <div class="fh-fight" hidden>
        <div class="fh-row"><span>张力</span><div class="fh-bar fh-tension"><div class="zone"></div><i></i></div><span class="fh-tv">0%</span></div>
        <div class="fh-row"><span>鱼体力</span><div class="fh-bar"><i class="fh-sta" style="background:#9fdcff"></i></div><span class="fh-len">0m</span></div>
      </div>
      <div class="fh-alert"></div><div class="fh-hint"></div><div class="fh-card" hidden></div>`;
    document.body.appendChild(hud); this.hud = hud;
    const q = (s) => hud.querySelector(s);
    this.el = { cap: q('.fh-capture'), dex: q('.fh-dex'), bag: q('.fh-bag'), power: q('.fh-power'), powerFill: q('.fh-power i'), fight: q('.fh-fight'), tension: q('.fh-tension'), tensionFill: q('.fh-tension i'), tv: q('.fh-tv'), sta: q('.fh-sta'), len: q('.fh-len'), alert: q('.fh-alert'), hint: q('.fh-hint'), card: q('.fh-card') };
    q('.fh-exit').onclick = () => this.close();
    const cap = this.el.cap;
    cap.addEventListener('pointerdown', (e) => { cap.setPointerCapture?.(e.pointerId); this.aimFrom(e); this.press(true); });
    cap.addEventListener('pointermove', (e) => this.aimFrom(e));
    cap.addEventListener('pointerup', () => this.press(false));
    cap.addEventListener('pointercancel', () => this.press(false));
    cap.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  aimFrom(e) { this.aim = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1); }

  start() {
    if (this.open) return;
    this.build(); this.open = true; this.onOpen?.();
    if (!this.camera.parent) this.scene.add(this.camera);
    this.camera.add(this.rod); this.scene.add(this.fxGroup);
    this.hud.hidden = false; this.el.card.hidden = true;
    addEventListener('keydown', this._kd, true); addEventListener('keyup', this._ku, true);
    this.aim = 0; this.camYaw = this.baseYaw; this.camPitch = -0.1; this.down = false; this.keyAim = 0;
    this.toIdle(true); this.refreshChips();
    this.sound?.init?.();
  }
  close() {
    if (!this.open) return;
    this.open = false; this.releaseShadow();
    this.camera.remove(this.rod); this.scene.remove(this.fxGroup); if (this.fish) { this.scene.remove(this.fish); this.fish = null; }
    this.hud.hidden = true;
    removeEventListener('keydown', this._kd, true); removeEventListener('keyup', this._ku, true);
    this.onClose?.(this.session);
  }

  // ---------- input ----------
  key(e, down) {
    const k = e.key.toLowerCase(); e.stopPropagation();
    if (k === 'escape' && down) { e.preventDefault(); if (!this.el.card.hidden) this.keep(true); else this.close(); return; }
    if (k === ' ' || k === 'enter') { e.preventDefault(); if (e.repeat) return; if (!this.el.card.hidden) { if (down) this.keep(true); return; } this.press(down); }
    if (k === 'a' || k === 'arrowleft') { this.keyAim = down ? -1 : (this.keyAim === -1 ? 0 : this.keyAim); e.preventDefault(); }
    if (k === 'd' || k === 'arrowright') { this.keyAim = down ? 1 : (this.keyAim === 1 ? 0 : this.keyAim); e.preventDefault(); }
  }
  press(down) {
    if (down === this.down) return; this.down = down;
    if (!down) { if (this.state === 'charge') this.cast(); return; }
    if (this.state === 'idle') { this.state = 'charge'; this.power = 0; this.powerDir = 1; this.el.power.hidden = false; this.hint('松开鼠标抛竿 · 在金色区域松手是完美抛竿'); }
    else if (this.state === 'waiting') { if (this.nibbling > 0) this.spook(); else this.reelIn('收回浮漂，换个地方试试'); }
    else if (this.state === 'bite') this.hook();
  }

  // ---------- state machine ----------
  toIdle(first = false) {
    this.state = 'idle'; this.el.power.hidden = true; this.el.fight.hidden = true; this.line.visible = false; this.bobber.visible = false;
    this.rodPitch = -1.0; this.bend = 0; this.side = 0;
    this.hint(first ? '按住左键（或空格）把竿往后拉 · 鼠标左右瞄准方向' : '按住左键往后拉竿，再抛一次吧');
  }
  cast() {
    const p = this.power, perfect = p > 0.84 && p < 0.96;
    this.el.power.hidden = true; this.state = 'flying';
    const dist = 3.5 + Math.min(p, 1) * 13 + (perfect ? 1.5 : 0);
    const yaw = this.camYaw;
    this.cast0 = this.tipWorld().clone();
    this.castTo = new THREE.Vector3(this.spot.x + Math.sin(yaw) * dist, L.level + 0.02, this.spot.z + Math.cos(yaw) * dist);
    this.castT = 0; this.castDur = 0.55 + dist * 0.035; this.castDist = dist; this.perfect = perfect;
    this.line.visible = true; this.bobber.visible = true; this.flick = 1;
    this.whoosh();
    if (perfect) this.alert('完美抛竿！', 0.9);
    this.hint('');
  }
  landed() {
    const b = this.castTo;
    if (lakeDist(b.x, b.z) > lakeShore(b.x, b.z) - 0.6) { this.alert('挂到草丛里了…', 1); this.reelIn('浮漂落在岸上了，往湖中间抛'); return; }
    this.state = 'waiting'; this.bobberPos = b.clone(); this.splash(b, 0.6, 8); this.plop(0.5);
    this.species = pickFish({ dist: this.castDist, perfect: this.perfect, night: this.getNight() });
    this.waitT = rand(2.2, 5.5) * (this.perfect ? 0.7 : 1); this.nibbles = 1 + Math.floor(Math.random() * 3); this.nibbling = 0; this.nibbleT = 0;
    this.borrowShadow();
    this.hint('等待鱼儿咬钩…… 浮漂轻轻抖动时别着急，沉下去再提竿');
  }
  borrowShadow() {
    this.releaseShadow();
    const free = this.shadows.filter((s) => !s.locked); if (!free.length) return;
    const near = free.sort((a, b) => a.mesh.position.distanceTo(this.bobberPos) - b.mesh.position.distanceTo(this.bobberPos))[0];
    near.locked = true; this.shadow = near;
    const s = this.species.junk ? 0.5 : 0.4 + clamp(Math.cbrt(this.species.w[1]) * 0.35, 0, 0.9);
    near.mesh.scale.set(s * 0.38, s, 1); near.mesh.material.opacity = 0.34;
  }
  releaseShadow() { if (this.shadow) { this.shadow.locked = false; this.shadow.mesh.material.opacity = 0.28; this.shadow = null; } }
  spook() { this.alert('太心急了！', 0.9); this.releaseShadow(); this.nibbling = 0; this.waitT = rand(2.5, 4.5); this.nibbles = 1 + Math.floor(Math.random() * 2); this.species = pickFish({ dist: this.castDist, perfect: false, night: this.getNight() }); setTimeout(() => this.open && this.state === 'waiting' && this.borrowShadow(), 1500); this.hint('鱼被吓跑了，再等等下一条……'); }
  reelIn(msg) { this.state = 'reel'; this.releaseShadow(); this.hint(msg || ''); this.reelFrom = (this.bobberPos || this.castTo).clone(); this.reelT = 0; }
  hook() {
    const f = this.species;
    this.state = 'fight'; this.releaseShadow(); this.el.fight.hidden = false;
    this.weight = +(rand(f.w[0], f.w[1]) * (Math.random() < 0.12 ? 1.25 : 1)).toFixed(2);
    const heavy = clamp(Math.cbrt(this.weight / f.w[1]), 0.6, 1.15);
    this.fs = { str: f.str * heavy, sta: f.sta * heavy * 1.6, stamina: f.sta * heavy * 1.6, angle: Math.atan2(this.bobberPos.x - this.spot.x, this.bobberPos.z - this.spot.z), lineLen: Math.hypot(this.bobberPos.x - this.spot.x, this.bobberPos.z - this.spot.z), swim: Math.random() < 0.5 ? -1 : 1, swimT: rand(1, 2.5), mode: 'swim', modeT: 0, nextEvent: rand(2.5, 5), pull: f.str, jumpT: 0 };
    this.tension = 0.35; this.overT = 0; this.slackT = 0;
    this.fish = buildFishMesh(f); const sc = f.junk ? 0.7 : clamp(0.3 + Math.cbrt(this.weight) * 0.32, 0.3, 1.3); this.fish.scale.setScalar(sc); this.fish.visible = false; this.scene.add(this.fish);
    this.splash(this.bobberPos, 1, 18); this.plop(1); this.alert('上钩了！', 0.8);
    this.hint('按住收线 · 松开放线 · 鼠标往鱼游动的反方向拉杆');
  }
  lose(text, reason) {
    this.alert(text, 1.3); if (reason === 'snap') this.snapSound(); this.el.fight.hidden = true;
    if (this.fish) { this.scene.remove(this.fish); this.fish = null; }
    this.session.lost += 1;
    this.state = 'cool'; this.coolT = 1.4; this.line.visible = reason !== 'snap'; this.bobber.visible = reason !== 'snap';
    this.reelFrom = this.fishSurface().clone(); this.reelT = 0;
  }
  land() {
    this.state = 'landing'; this.el.fight.hidden = true; this.landT = 0; this.fish.visible = true;
    this.landFrom = this.fishSurface().clone(); this.splash(this.landFrom, 1.2, 30); this.plop(1.2);
    this.line.visible = false; this.bobber.visible = false;
  }
  showCard() {
    const f = this.species, j = loadJournal(), rec = j.fish[f.id] || { count: 0, best: 0 };
    const isNew = rec.count === 0, best = this.weight > rec.best;
    rec.count += 1; rec.best = Math.max(rec.best, this.weight); j.fish[f.id] = rec; saveJournal(j);
    this.session.caught.push({ id: f.id, name: f.name, weight: this.weight, isNew });
    const len = Math.round((f.junk ? 30 : 12 + Math.cbrt(this.weight) * 38) * (0.95 + Math.random() * 0.1));
    const c = this.el.card; c.hidden = false;
    c.innerHTML = `<h3>${f.name}</h3><div class="rar">${'★'.repeat(f.rar)} ${f.junk ? '奇怪的收获' : RARITY[f.rar]}</div>
      <div class="tags">${isNew ? '<span>新发现！已记入图鉴</span>' : ''}${best && !isNew ? '<span style="background:#8fa77f">新纪录！</span>' : ''}</div>
      <div class="stats"><div><b>${f.id === 'soot' ? '0.01' : this.weight}</b>公斤</div><div><b>${len}</b>厘米</div><div><b>${rec.count}</b>次钓到</div></div>
      <p>${f.text}</p><div class="btns"><button class="main fh-keep">${f.junk ? '收下' : '收进鱼篓'}</button><button class="fh-free">${f.junk ? '扔回去' : '放生'}</button></div>`;
    c.querySelector('.fh-keep').onclick = () => this.keep(true);
    c.querySelector('.fh-free').onclick = () => this.keep(false);
    this.refreshChips(); this.fanfare(f.rar);
    this.hint('空格 / 回车 收下');
  }
  keep(keepIt) {
    this.el.card.hidden = true;
    if (!keepIt && this.fish) { this.releaseFish = { t: 0, from: this.fish.position.clone() }; this.hint('扑通——它游走啦'); } else if (this.fish) { this.scene.remove(this.fish); this.fish = null; }
    this.session.kept += keepIt ? 1 : 0;
    this.toIdle();
  }
  refreshChips() {
    const j = loadJournal(), n = FISH.filter((f) => j.fish[f.id]?.count).length;
    this.el.dex.textContent = `图鉴 ${n}/${FISH.length}`; this.el.bag.textContent = `本次 ${this.session?.caught.length || 0} 条`;
  }

  // ---------- per frame ----------
  tipWorld() { return this.tip.getWorldPosition(this._tip || (this._tip = new THREE.Vector3())); }
  fishSurface() { const fs = this.fs; return new THREE.Vector3(this.spot.x + Math.sin(fs.angle) * fs.lineLen, L.level + 0.02, this.spot.z + Math.cos(fs.angle) * fs.lineLen); }
  update(dt) {
    if (!this.open) return;
    const t = (this.time = (this.time || 0) + dt);
    // camera: first person on the pier, gently following the aim / the fish
    if (this.keyAim) this.aim = clamp(this.aim + this.keyAim * dt * 1.4, -1, 1);
    const aim = this.aim;
    let wantYaw = this.baseYaw - aim * 0.55;
    if (this.state === 'fight' || this.state === 'cool') wantYaw = this.baseYaw + ang(this.fs.angle - this.baseYaw) * 0.6 - aim * 0.15;
    this.camYaw += ang(wantYaw - this.camYaw) * Math.min(1, dt * 4);
    const wantPitch = this.state === 'landing' || this.state === 'show' ? -0.02 : -0.1;
    this.camPitch += (wantPitch - this.camPitch) * Math.min(1, dt * 3);
    const cam = this.camera, eye = this.spot.clone(); eye.y = this.spot.y + 1.45 + Math.sin(t * 1.1) * 0.01;
    cam.position.copy(eye);
    cam.rotation.set(0, 0, 0); cam.rotation.order = 'YXZ'; cam.rotation.y = this.camYaw + Math.PI; cam.rotation.x = this.camPitch;
    // rod pose
    let wantRodPitch = -1.0, wantBend = 0.04, wantSide = 0;
    if (this.state === 'charge') {
      this.power += this.powerDir * dt / 1.05; if (this.power > 1.08) { this.power = 1.08; this.powerDir = -1; } if (this.power < 0.05) { this.power = 0.05; this.powerDir = 1; }
      this.el.powerFill.style.height = Math.min(100, this.power * 100) + '%';
      wantRodPitch = -1.0 + this.power * 0.95; wantBend = -0.1 * this.power;
      if (this.power > 0.84 && this.power < 0.96 && !this._ticked) { this._ticked = true; this.tick(1300, 0.04); } if (this.power < 0.8) this._ticked = false;
    }
    if (this.flick > 0) { this.flick = Math.max(0, this.flick - dt * 3); wantRodPitch = -1.35 + (1 - this.flick) * 0.35; wantBend = 0.5 * this.flick; }
    if (this.state === 'waiting' || this.state === 'bite') wantBend = 0.08 + (this.state === 'bite' ? 0.3 : 0);
    if (this.state === 'fight') { wantBend = 0.15 + this.tension * 0.9; wantSide = clamp(ang(this.fs.angle - this.camYaw) * 1.6, -1, 1) * 0.6 - this.aim * 0.4; wantRodPitch = -0.75 + this.tension * 0.25 + (this.down ? 0.12 : 0); }
    this.rodPitch += (wantRodPitch - this.rodPitch) * Math.min(1, dt * (this.state === 'charge' ? 14 : 8));
    this.bend += (wantBend - this.bend) * Math.min(1, dt * 10); this.side += (wantSide - this.side) * Math.min(1, dt * 6);
    this.rod.rotation.set(this.rodPitch, 0, -this.aim * 0.12 + (this.state === 'fight' ? Math.sin(t * 30) * this.tension * 0.01 : 0));
    this.segs.forEach((s, i) => { const k = (i + 1) / this.segs.length; s.rotation.x = -this.bend * k * 0.28; s.rotation.z = this.side * k * 0.16; });
    if (this.down && (this.state === 'fight' || this.state === 'reel')) { this.handle.parent.rotation.x += dt * 18; this.reelTick = (this.reelTick || 0) - dt; if (this.reelTick < 0) { this.reelTick = 0.06; this.tick(2400, 0.02); } }
    this.camera.updateMatrixWorld(true);
    const tip = this.tipWorld();

    // state logic
    let end = null;
    if (this.state === 'flying') {
      this.castT += dt / this.castDur; const k = Math.min(1, this.castT);
      end = this.cast0.clone().lerp(this.castTo, k); end.y += Math.sin(k * Math.PI) * (1.2 + this.castDist * 0.18) * (1 - k * 0.3);
      if (k >= 1) this.landed();
    } else if (this.state === 'waiting' || this.state === 'bite') {
      end = this.bobberPos.clone(); end.y = L.level + 0.02 + Math.sin(t * 2.2) * 0.012;
      if (this.shadow) { const sp = this.shadow.mesh.position, to = new THREE.Vector3(end.x - sp.x, 0, end.z - sp.z), d = to.length(); if (d > 0.35) { to.normalize(); sp.addScaledVector(to, Math.min(d - 0.3, dt * 0.9)); this.shadow.mesh.rotation.z = -Math.atan2(to.x, to.z); } }
      if (this.state === 'waiting') {
        this.waitT -= dt;
        if (this.nibbling > 0) { this.nibbling -= dt; end.y -= Math.sin((0.25 - this.nibbling) / 0.25 * Math.PI) * 0.045; }
        if (this.waitT <= 0) {
          if (this.nibbles > 0) { this.nibbles -= 1; this.nibbling = 0.25; this.waitT = rand(0.6, 1.4); this.ripple(end, 0.35); this.tick(700, 0.05); }
          else { this.state = 'bite'; this.biteT = this.species.rar >= 3 ? 0.62 : 0.78; this.alert('咬钩了！提竿！', 0.7); this.splash(end, 0.5, 10); this.plop(0.8); this.hint('快！点击左键 / 空格'); }
        }
      } else {
        end.y -= 0.12; this.biteT -= dt;
        if (this.biteT <= 0) { this.alert('鱼饵被偷吃了…', 1.1); this.reelIn('慢了一拍，收回来重新抛竿'); }
      }
      this.bobber.position.copy(end);
    } else if (this.state === 'fight') {
      end = this.fightStep(dt);
    } else if (this.state === 'reel' || this.state === 'cool') {
      if (this.state === 'cool') { this.coolT -= dt; if (this.coolT <= 0 && !this.line.visible) { this.toIdle(); return this.finishFx(dt, tip, null); } }
      this.reelT += dt / 0.9; const k = Math.min(1, this.reelT);
      end = this.reelFrom.clone().lerp(tip, k * k); end.y = THREE.MathUtils.lerp(L.level + 0.02, tip.y, k * k * k);
      if (k >= 1) { this.toIdle(); return this.finishFx(dt, tip, null); }
    } else if (this.state === 'landing') {
      this.landT += dt / 0.85; const k = Math.min(1, this.landT);
      const target = new THREE.Vector3(0.05, -0.12, -(0.75 + this.fish.scale.x * 1.1)).applyMatrix4(this.camera.matrixWorld);
      const p = this.landFrom.clone().lerp(target, 1 - Math.pow(1 - k, 2)); p.y += Math.sin(k * Math.PI) * 1.8;
      this.fish.position.copy(p); this.fish.rotation.set(Math.sin(t * 20) * 0.4 * (1 - k), this.camYaw + Math.PI + (1 - k) * 6, 0);
      if (k >= 1) { this.state = 'show'; this.showCard(); }
    } else if (this.state === 'show' && this.fish) {
      const target = new THREE.Vector3(-0.22 - this.fish.scale.x * 0.25, -0.08, -(0.75 + this.fish.scale.x * 1.1)).applyMatrix4(this.camera.matrixWorld);
      this.fish.position.lerp(target, Math.min(1, dt * 4)); this.fish.position.y += Math.sin(t * 9) * 0.004;
      this.fish.rotation.set(Math.sin(t * 7) * 0.2, this.camYaw + Math.PI + Math.sin(t * 2) * 0.35, Math.sin(t * 11) * 0.12);
      if (this.fish.userData.tail) this.fish.userData.tail.rotation.y = Math.sin(t * 16) * 0.5;
    }
    if (this.releaseFish && this.fish) {
      const r = this.releaseFish; r.t += dt / 0.7; const k = Math.min(1, r.t), to = new THREE.Vector3(this.spot.x + Math.sin(this.camYaw) * 3, L.level - 0.3, this.spot.z + Math.cos(this.camYaw) * 3);
      this.fish.position.copy(r.from.clone().lerp(to, k)); this.fish.position.y += Math.sin(k * Math.PI) * 0.8; this.fish.rotation.z = -k * 2;
      if (k >= 1) { this.splash(to.setY(L.level), 0.9, 16); this.plop(0.9); this.scene.remove(this.fish); this.fish = null; this.releaseFish = null; }
    } else if (!this.fish) this.releaseFish = null;
    this.finishFx(dt, tip, end);
  }
  finishFx(dt, tip, end) {
    if (end && this.line.visible) {
      const sag = this.state === 'fight' ? (1 - clamp(this.tension, 0, 1)) * 0.06 * this.fs.lineLen : this.state === 'flying' ? 0.05 : 0.18 + tip.distanceTo(end) * 0.03;
      for (let i = 0; i < this.linePts.length; i++) { const k = i / (this.linePts.length - 1); this.linePts[i].copy(tip).lerp(end, k); this.linePts[i].y -= sag * 4 * k * (1 - k); }
      this.lineGeo.setFromPoints(this.linePts);
      if (this.state === 'flying' || this.state === 'reel' || this.state === 'cool' || this.state === 'fight') this.bobber.position.copy(end);
    }
    // ripples & droplets
    for (const r of this.ripples) if (r.userData.t > 0) { r.userData.t -= dt; const k = 1 - r.userData.t / r.userData.d; r.scale.setScalar(0.1 + k * r.userData.size); r.material.opacity = 0.75 * (1 - k); }
    let any = false;
    for (let i = 0; i < this.dropN; i++) {
      if (this.dropLife[i] <= 0) { this.dropPos[i * 3 + 1] = -99; continue; }
      any = true; this.dropLife[i] -= dt; const v = this.dropVel[i]; v.y -= 9.8 * dt;
      this.dropPos[i * 3] += v.x * dt; this.dropPos[i * 3 + 1] += v.y * dt; this.dropPos[i * 3 + 2] += v.z * dt;
      if (this.dropPos[i * 3 + 1] < L.level) this.dropLife[i] = 0;
    }
    if (any || this._dropsDirty) { this.drops.geometry.attributes.position.needsUpdate = true; this._dropsDirty = any; }
  }
  fightStep(dt) {
    const fs = this.fs, f = this.species, t = this.time;
    // fish behaviour: swim / dash / jump, tired when stamina runs low
    fs.swimT -= dt; if (fs.swimT <= 0) { fs.swim = Math.random() < 0.6 ? -fs.swim : fs.swim; fs.swimT = rand(1, 2.6); }
    fs.nextEvent -= dt;
    const tired = fs.stamina < fs.sta * 0.25;
    if (fs.mode === 'swim' && fs.nextEvent <= 0 && !tired && !f.junk) {
      fs.nextEvent = rand(3, 6);
      if (f.rar >= 2 && Math.random() < 0.45) { fs.mode = 'jump'; fs.modeT = 1.0; this.alert('跳起来了！松手！', 0.8); this.splash(this.fishSurface(), 1, 20); this.plop(1); }
      else { fs.mode = 'dash'; fs.modeT = rand(0.9, 1.8); fs.swim = Math.random() < 0.5 ? -1 : 1; this.alert(fs.swim > 0 ? '猛冲！往右拉竿！' : '猛冲！往左拉竿！', 0.8); }
    }
    if (fs.mode !== 'swim') { fs.modeT -= dt; if (fs.modeT <= 0) fs.mode = 'swim'; }
    const noise = 0.75 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1);
    let pull = fs.str * noise * (fs.mode === 'dash' ? 1.75 : fs.mode === 'jump' ? 0.3 : 1) * (tired ? 0.35 : 1) * (fs.stamina <= 0 ? 0.4 : 1);
    // swimming sideways along an arc around the pier, kept inside the lake
    const spd = f.spd * (fs.mode === 'dash' ? 2.4 : 1) * (tired ? 0.4 : 1);
    let na = fs.angle + fs.swim * spd * 0.16 * dt / Math.max(0.6, fs.lineLen / 8);
    const p = new THREE.Vector3(this.spot.x + Math.sin(na) * fs.lineLen, 0, this.spot.z + Math.cos(na) * fs.lineLen);
    if (lakeDist(p.x, p.z) > lakeShore(p.x, p.z) - 0.8 || Math.abs(ang(na - this.baseYaw)) > 1.25) { fs.swim *= -1; na = fs.angle; }
    fs.angle = na;
    // rod direction vs swim direction: screen-left (aim<0) counters a fish swimming to the right (swim<0 here)
    const counter = clamp(this.aim * fs.swim, -1, 1); // +1 = pulling against the fish
    const reeling = this.down;
    if (reeling) {
      // reeling pulls the tension towards a level set by how hard the fish is pulling right now
      const target = 0.18 + pull * 1.25 * (1 - 0.5 * counter) + (fs.mode === 'jump' ? 1.6 : 0);
      this.tension += (target - this.tension) * Math.min(1, dt * (target > this.tension ? 2.4 : 1.6));
      fs.lineLen -= dt * (tired || fs.stamina <= 0 ? 3.0 : 1.8) * (1 - Math.min(0.8, pull * 0.55));
    } else {
      this.tension -= dt * (0.75 + (fs.mode === 'jump' ? 0.5 : 0));
      fs.lineLen += dt * pull * 1.7 * (tired ? 0.3 : 1);
    }
    // a dashing fish yanks the line even if you let go – only pulling the rod the other way really helps
    this.tension += dt * pull * (fs.mode === 'dash' ? 1.3 * (1 - 0.85 * counter) : 0.08 * (1 - counter));
    this.tension = clamp(this.tension, 0, 1.25);
    fs.stamina = Math.max(0, fs.stamina - dt * (reeling ? 0.85 : 0.3) * (1 + 0.9 * Math.max(0, counter)) * (fs.mode === 'dash' ? 1.4 : 1));
    // fail / win conditions
    if (this.tension >= 1) { this.overT += dt; if (this.overT > 0.45) return this.lose('啪！线断了…', 'snap'), this.fishSurface(); } else this.overT = Math.max(0, this.overT - dt * 2);
    if (this.tension < 0.06 && !tired && fs.stamina > 0) { this.slackT += dt; if (this.slackT > 2.8) return this.lose('鱼脱钩跑掉了…', 'slack'), this.fishSurface(); } else this.slackT = 0;
    if (fs.lineLen > 24) return this.lose('线被拖完了，啪！', 'snap'), this.fishSurface();
    if (fs.lineLen < 1.4) { this.land(); return this.landFrom; }
    // visuals: wake ripples, jumping fish, HUD
    const surf = this.fishSurface();
    fs.rippleT = (fs.rippleT || 0) - dt; if (fs.rippleT < 0) { fs.rippleT = fs.mode === 'dash' ? 0.12 : 0.35; this.ripple(surf, fs.mode === 'dash' ? 0.6 : 0.35); if (fs.mode === 'dash') this.splash(surf, 0.3, 3); }
    if (fs.mode === 'jump' && this.fish) {
      const k = 1 - fs.modeT / 1.0, h = Math.sin(clamp(k, 0, 1) * Math.PI) * (1.1 + fs.str);
      this.fish.visible = k < 1; this.fish.position.copy(surf).setY(L.level + h - 0.1);
      this.fish.rotation.set(0, fs.angle + Math.PI / 2 * fs.swim, (0.5 - k) * 2.2 * fs.swim);
      if (this.fish.userData.tail) this.fish.userData.tail.rotation.y = Math.sin(t * 30) * 0.6;
      if (k > 0.92 && !fs.splashed) { fs.splashed = true; this.splash(surf, 1.1, 22); this.plop(1.1); }
    } else if (this.fish) { this.fish.visible = false; fs.splashed = false; }
    const tv = Math.round(this.tension * 100);
    this.el.tensionFill.style.width = Math.min(100, this.tension * 100 / 1.0 * 0.8) + '%';
    this.el.tensionFill.style.background = this.tension > 0.85 ? '#ff7a59' : this.tension < 0.1 ? '#c9c49a' : '#9ed0a0';
    this.el.tension.classList.toggle('danger', this.tension > 0.9);
    this.el.tv.textContent = tv + '%'; this.el.sta.style.width = (fs.stamina / fs.sta * 100) + '%'; this.el.len.textContent = fs.lineLen.toFixed(1) + 'm';
    if (fs.stamina <= 0) this.hint('鱼没力气了！一口气收线！');
    else if (tired) this.hint('鱼累了，翻出白肚皮——快收线！');
    else if (this.tension < 0.1) this.hint('线太松了，鱼要脱钩——按住收线！');
    else if (this.tension > 0.85) this.hint('张力太大！松手放线，或者反方向拉竿！');
    else this.hint(fs.swim > 0 ? '鱼往左游 → 鼠标往右拉竿' : '鱼往右游 → 鼠标往左拉竿');
    if (this.tension > 0.88) { this.creakT = (this.creakT || 0) - dt; if (this.creakT < 0) { this.creakT = 0.22; this.tone(95 + Math.random() * 30, 0.12, 0.05, 'square'); } }
    return surf;
  }

  // ---------- fx helpers ----------
  ripple(pos, size = 0.5) { const r = this.ripples.find((x) => x.userData.t <= 0) || this.ripples[0]; r.position.set(pos.x, L.level + 0.015, pos.z); r.userData.t = r.userData.d = 0.9; r.userData.size = size * 1.6; }
  splash(pos, power = 1, n = 12) {
    this.ripple(pos, power); this.ripple(pos, power * 0.6);
    let made = 0;
    for (let i = 0; i < this.dropN && made < n; i++) if (this.dropLife[i] <= 0) {
      this.dropLife[i] = 1.2; this.dropPos[i * 3] = pos.x; this.dropPos[i * 3 + 1] = L.level + 0.02; this.dropPos[i * 3 + 2] = pos.z;
      const a = Math.random() * 6.28, s = rand(0.4, 1.4) * power; this.dropVel[i].set(Math.cos(a) * s, rand(1.5, 3.4) * power, Math.sin(a) * s); made++;
    }
    this._dropsDirty = true;
  }
  hint(text) { if (this._hint !== text) { this._hint = text; this.el.hint.textContent = text; this.el.hint.hidden = !text; } }
  alert(text, dur = 1) { const a = this.el.alert; a.textContent = text; a.classList.remove('show'); void a.offsetWidth; a.classList.add('show'); clearTimeout(this._alertT); this._alertT = setTimeout(() => a.classList.remove('show'), dur * 1000); }

  // ---------- audio (routes through the game's master gain so mute works) ----------
  ac() { const s = this.sound; if (!s) return null; s.init?.(); return s.ctx ? { c: s.ctx, out: s.master || s.ctx.destination } : null; }
  tone(freq, dur, vol, type = 'sine', slide = 1, when = 0) {
    const a = this.ac(); if (!a) return; const { c, out } = a, t0 = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(dur, vol, cutoff, type = 'lowpass') {
    const a = this.ac(); if (!a) return; const { c, out } = a, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = type; f.frequency.value = cutoff; g.gain.value = vol; s.connect(f).connect(g).connect(out); s.start();
  }
  tick(freq, vol) { this.noise(0.03, vol * 4, freq, 'highpass'); }
  plop(p = 1) { this.tone(340, 0.16, 0.12 * p, 'sine', 0.4); this.noise(0.35 * p, 0.18 * p, 900); }
  whoosh() { this.noise(0.4, 0.2, 2200, 'bandpass'); }
  snapSound() { this.tone(900, 0.25, 0.12, 'sawtooth', 0.25); this.noise(0.15, 0.2, 3000, 'highpass'); }
  fanfare(rar) { [523, 659, 784, 1046, 1318].slice(0, 2 + rar).forEach((f, i) => this.tone(f, 0.45, 0.13, 'triangle', 1, i * 0.09)); }
}

// session bookkeeping lives on the instance; start() resets it
const _start = FishingGame.prototype.start;
FishingGame.prototype.start = function () { this.session = { caught: [], kept: 0, lost: 0 }; return _start.call(this); };
