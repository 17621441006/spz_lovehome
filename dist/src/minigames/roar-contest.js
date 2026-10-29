// 龙猫大人的小游戏 ——《月下吼叫大会》
// 电影里小梅和龙猫对着夜空一起“嗷——”的那一幕。龙猫先吼一段节奏，你对着麦克风学他吼：
// 吼得越像（长短、轻重、停顿），龙猫越开心；最后一轮比谁更大声——吼够响，龙猫会被你吼得一屁股坐倒。
// 全程在 3D 世界里进行：龙猫真的张嘴，草地被吼声吹倒。没有麦克风时可以按住空格“吼”。
import { loadJournal, saveJournal, grantRewards } from './journal.js';
import { showDialog, TOTORO_FACE } from './dialog.js';

export const ROAR_REWARDS = [
  { stars: 1, id: 'totoro-acorn', name: '龙猫的橡果', icon: '🌰', count: 3, text: '圆滚滚、亮晶晶，种下去也许会发芽' },
  { stars: 2, id: 'night-ocarina', name: '月夜陶笛', icon: '🎶', count: 1, unique: true, text: '龙猫们在树顶吹的那种，吹一下森林会安静下来' },
  { stars: 3, id: 'totoro-top', name: '龙猫的陀螺', icon: '🌀', count: 1, unique: true, text: '转起来会嗡嗡作响，据说能带人飞过夜空' },
];
const HZ = 20; // envelope samples per second
const seg = (...parts) => { const out = []; for (const [dur, lv] of parts) { const n = Math.round(dur * HZ); for (let i = 0; i < n; i++) { const edge = Math.min(1, Math.min(i, n - 1 - i) / 1.5 + 0.35); out.push(lv * (lv ? edge : 1)); } } return out; };
const ROUNDS = [
  { title: '第一轮 · 长长的嗷——', tip: '一口气，拉长！', env: seg([0.15, 0], [1.7, 0.9], [0.15, 0]) },
  { title: '第二轮 · 嗷！嗷！嗷！', tip: '三下，短促有力', env: seg([0.1, 0], [0.35, 0.95], [0.3, 0], [0.35, 0.95], [0.3, 0], [0.35, 0.95], [0.1, 0]) },
  { title: '第三轮 · 嗷呜～嗷呜～嗷————！', tip: '两小声，再一大声', env: seg([0.1, 0], [0.45, 0.55], [0.25, 0], [0.45, 0.55], [0.3, 0], [1.3, 1.0], [0.1, 0]) },
];
const FINALE = { title: '最终轮 · 比比谁更大声！', tip: '用尽全力吼 3 秒！', len: 3.2 };

const STYLE = `
#roarHud{position:fixed;left:0;right:0;bottom:0;z-index:72;pointer-events:none;display:flex;flex-direction:column;align-items:center;padding-bottom:clamp(14px,4vh,40px);font-family:inherit;color:#fffaf0}
#roarHud .rh-head{position:fixed;left:0;right:0;top:clamp(14px,4vh,40px);text-align:center}
#roarHud .rh-round{font-family:'STKaiti','KaiTi',serif;font-size:clamp(22px,3.4vw,34px);letter-spacing:5px;text-shadow:0 2px 10px #000b}
#roarHud .rh-tip{font-size:14px;letter-spacing:2px;margin:4px 0 0;text-shadow:0 1px 4px #000b}
#roarHud .rh-panel{position:relative;width:min(560px,92vw);background:#0d1f1ab8;border-radius:20px;padding:12px 14px 10px;box-shadow:0 10px 34px #0007;backdrop-filter:blur(6px)}
#roarHud canvas{display:block;width:100%;height:84px}
#roarHud .rh-legend{display:flex;gap:16px;font-size:11px;opacity:.85;margin-top:4px}
#roarHud .rh-legend i{display:inline-block;width:18px;height:4px;border-radius:2px;vertical-align:middle;margin-right:5px}
#roarHud .rh-who{position:absolute;right:14px;top:10px;font-size:12px;background:#f0c06c;color:#4a3a20;border-radius:999px;padding:3px 11px}
#roarHud .rh-score{font-family:'STKaiti','KaiTi',serif;font-size:clamp(24px,3.6vw,36px);letter-spacing:4px;min-height:1.3em;margin-bottom:6px;text-shadow:0 2px 10px #000b,0 0 20px #ffd27a88}
#roarHud .rh-hold{pointer-events:auto;margin-top:10px;border:0;border-radius:999px;padding:14px 28px;font:inherit;font-size:16px;letter-spacing:3px;color:#fffaf0;background:radial-gradient(circle at 40% 35%,#f6cf7f,#d4913d);box-shadow:0 4px 0 #a96d2c;touch-action:none}
#roarHud .rh-quit{position:fixed;right:18px;top:16px;pointer-events:auto;border:0;border-radius:999px;padding:9px 16px;font:inherit;font-size:13px;background:#f8f2dce6;color:#4d6649;cursor:pointer}
#roarHud .rh-card{pointer-events:auto;width:min(460px,90vw);background:linear-gradient(180deg,#fdf8e8f7,#f2efd9f2);color:#3f5338;border-radius:22px;padding:20px 24px;box-shadow:0 18px 50px #0007;text-align:center;margin-bottom:6vh}
#roarHud .rh-card h2{margin:0;font-family:'STKaiti','KaiTi',serif;font-weight:500;font-size:30px;letter-spacing:5px;color:#3b5a46}
#roarHud .rh-card .stars{font-size:38px;letter-spacing:6px;color:#d7d3b3;margin:4px 0}
#roarHud .rh-card .stars .on{color:#e8a93c;text-shadow:0 0 14px #ffd27a}
#roarHud .rh-card ul{list-style:none;padding:0;margin:8px 0 12px;font-size:13px;line-height:1.9;color:#6f7d63}
#roarHud .rh-card .gift{display:flex;gap:10px;align-items:center;text-align:left;background:#fffdf3;border:1px solid #e3dfbf;border-radius:14px;padding:8px 12px;margin:6px 0;font-size:13px}
#roarHud .rh-card .gift small{display:block;color:#8a8f72;font-size:11px}
#roarHud .rh-card .gift b.new{margin-left:auto;font-size:11px;color:#fff;background:#d4913d;border-radius:999px;padding:2px 8px;font-weight:400}
#roarHud .rh-card button{border:0;border-radius:999px;padding:11px 22px;font:inherit;font-size:15px;letter-spacing:2px;cursor:pointer;background:#e4e9ca;color:#40583c;box-shadow:0 3px 0 #b7bf98;margin:4px}
#roarHud .rh-card button.main{background:linear-gradient(180deg,#f0c06c,#d4913d);color:#fffaf0;box-shadow:0 3px 0 #a96d2c}
#roarHud [hidden]{display:none!important}
`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RoarContest {
  /** totoro: BigTotoro; shot(on): frame the camera on the player+Totoro; gust(level): grass gust from the player */
  constructor({ totoro, sound, shot, onOpen, onClose, say, totoroHead, soot }) {
    Object.assign(this, { totoro, sound, shot, onOpen, onClose, say, totoroHead, soot });
    this.open = false; this.level = 0; this.totoroLevel = 0; this.lean = 0; this.knock = 0;
    this._kd = (e) => this.key(e, true); this._ku = (e) => this.key(e, false);
  }

  async invite(name) {
    if (this.open) return;
    this.open = true; this.onOpen?.();
    const choice = await showDialog({
      speaker: '龙猫大人', face: TOTORO_FACE, blip: () => this.blip(),
      lines: ['……嗷呜！嘿嘿，吓到你了吧？呼噜噜～', '以前有个小女孩，站在我肚子上，吼得比我还大声呢。', `${name}，敢不敢跟我比一比？我吼一段，你学一段——学得越像，我越开心！`, '（这个游戏要用到麦克风。没有麦克风的话，按住空格也可以“吼”哦）'],
      choices: [{ label: '来比！嗷——', value: 'go', main: true }, { label: '下次吧', value: null }],
    });
    if (choice !== 'go') { this.finish(null); return; }
    this.run().catch((e) => { console.error(e); this.finish(null); });
  }

  // ---------- flow ----------
  async run() {
    this.buildHud(); this.shot?.(true);
    addEventListener('keydown', this._kd, true); addEventListener('keyup', this._ku, true);
    this.ui.round.textContent = '准备一下'; this.ui.tip.textContent = '正在打开麦克风……';
    this.mic = await this.openMic();
    if (this.mic) {
      this.ui.tip.textContent = '安静一秒，测一下周围的声音……'; this.ui.who.textContent = '校准中';
      await this.calibrate();
      this.ui.hold.hidden = true;
    } else {
      this.ui.tip.textContent = '没有麦克风也没关系：按住空格（或下面的按钮）就是“吼”';
      this.ui.hold.hidden = false; await sleep(1600);
    }
    const scores = [];
    for (const r of ROUNDS) { if (!this.open) return; scores.push(await this.playRound(r)); }
    if (!this.open) return;
    const finale = await this.playFinale();
    this.showResult(scores, finale);
  }
  async playRound(r) {
    this.ui.round.textContent = r.title; this.ui.tip.textContent = '先听龙猫大人吼——'; this.ui.score.textContent = '';
    this.target = r.env; this.trace = []; this.draw();
    await sleep(700);
    // Totoro's turn: his mouth follows the envelope and a synthesized growl plays along
    this.ui.who.textContent = '龙猫'; this.phase = 'totoro'; this.playGrowl(r.env);
    await this.follow(r.env.length / HZ, (k) => { this.totoroLevel = r.env[Math.min(r.env.length - 1, Math.floor(k * HZ))]; });
    this.totoroLevel = 0; this.phase = 'gap';
    this.ui.tip.textContent = r.tip + ' · 轮到你了！'; this.ui.who.textContent = '你'; this.chime(880);
    await sleep(350);
    // player's turn: record the voice envelope, then align it to the target and compare shapes
    this.phase = 'player'; this.trace = [];
    const dur = r.env.length / HZ + 1.8;
    await this.follow(dur, () => { this.trace.push(this.level); }, () => this.trace.length > HZ * 1.2 && this.silentTail(r.env.length));
    this.phase = 'gap';
    const s = this.compare(r.env, this.trace);
    this.ui.score.textContent = s === 0 ? '没听见你的声音哦～' : s >= 85 ? `${s} 分 · 一模一样！` : s >= 65 ? `${s} 分 · 很像！` : s >= 45 ? `${s} 分 · 有点意思` : `${s} 分 · 再大胆一点`;
    if (s >= 65) { this.totoro.grin = 1.6; this.say?.(s >= 85 ? '呼噜噜噜！！' : '呼噜～', this.totoroHead, 1.6, true); }
    this.chime(s >= 65 ? 1320 : 660);
    await sleep(1500);
    return s;
  }
  async playFinale() {
    this.ui.round.textContent = FINALE.title; this.ui.tip.textContent = '龙猫大人先来——'; this.ui.score.textContent = '';
    this.target = seg([0.1, 0], [2.2, 1], [0.1, 0]); this.trace = []; this.draw(); await sleep(600);
    this.ui.who.textContent = '龙猫'; this.phase = 'totoro'; this.playGrowl(this.target, 1.25);
    await this.follow(2.4, (k) => { this.totoroLevel = k < 2.3 ? 1 : 0; });
    this.totoroLevel = 0; this.ui.tip.textContent = FINALE.tip + ' 3、2、1——吼！'; this.ui.who.textContent = '你'; this.chime(990); await sleep(500);
    this.phase = 'player'; this.trace = [];
    let peak = 0, loud = 0;
    await this.follow(FINALE.len, (k, dt) => { this.trace.push(this.level); peak = Math.max(peak, this.level); if (this.level > 0.6) loud += dt; this.lean = Math.max(this.lean, this.level * 0.12); });
    this.phase = 'gap';
    const score = Math.round(Math.min(100, peak * 55 + loud * 22));
    if (score >= 75) {
      this.knock = 1; this.ui.score.textContent = `${score} 分 · 龙猫大人被你吼倒了！`;
      this.soot?.(); this.say?.('哇啊——！', this.totoroHead, 2, true); this.thump();
    } else this.ui.score.textContent = score >= 45 ? `${score} 分 · 龙猫大人的毛都被吹起来了！` : `${score} 分 · 再大声一点点！`;
    await sleep(2400);
    return score;
  }
  showResult(scores, finale) {
    const avg = (scores.reduce((a, b) => a + b, 0) + finale) / (scores.length + 1);
    const stars = avg >= 78 ? 3 : avg >= 60 ? 2 : avg >= 38 ? 1 : 0;
    const j = loadJournal(), gained = stars ? grantRewards(j, ROAR_REWARDS, stars) : [];
    j.best.totoroRoar = Math.max(j.best.totoroRoar || 0, Math.round(avg)); if (stars) j.stamps.totoroRoar = Math.max(j.stamps.totoroRoar || 0, stars); saveJournal(j);
    this.result = { stars, score: Math.round(avg), gained };
    const title = ['龙猫大人歪着头…', '嗷呜！还不错！', '你也是一只龙猫吧！', '森林之王的吼声！'][stars];
    const gifts = gained.map((g) => `<div class="gift"><span style="font-size:24px">${g.icon}</span><div>${g.name}${g.count > 1 ? ' ×' + g.count : ''}<small>${g.text}</small></div>${g.first ? '<b class="new">首次获得</b>' : ''}</div>`).join('');
    this.ui.panel.hidden = true; this.ui.round.textContent = ''; this.ui.tip.textContent = ''; this.ui.score.textContent = ''; this.ui.hold.hidden = true;
    this.ui.card.hidden = false;
    this.ui.card.innerHTML = `<h2>${title}</h2><div class="stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('')}</div>
      <ul><li>长嗷 ${scores[0]} · 三连嗷 ${scores[1]} · 嗷呜嗷 ${scores[2]}</li><li>最终大声 ${finale}　|　平均 <b>${Math.round(avg)}</b></li></ul>
      ${gifts || (stars ? '<p style="font-size:13px;color:#8a8f72">这一档的礼物你已经拥有啦</p>' : '<p style="font-size:13px;color:#8a8f72">平均 38 分就能拿到第一颗星，再来一次？</p>')}
      <div><button class="main rh-again">再比一次</button><button class="rh-done">回到森林</button></div>`;
    this.ui.card.querySelector('.rh-again').onclick = () => { this.ui.card.hidden = true; this.ui.panel.hidden = false; this.run2(); };
    this.ui.card.querySelector('.rh-done').onclick = () => this.finish(this.result);
    this.ui.card.querySelector('.rh-again').focus();
  }
  async run2() { const scores = []; for (const r of ROUNDS) { if (!this.open) return; scores.push(await this.playRound(r)); } if (!this.open) return; this.showResult(scores, await this.playFinale()); }
  finish(result) {
    if (!this.open) return;
    this.open = false; this.phase = null; this.totoroLevel = 0; this.level = 0;
    removeEventListener('keydown', this._kd, true); removeEventListener('keyup', this._ku, true);
    this.mic?.stream.getTracks().forEach((t) => t.stop()); this.mic = null;
    this.hud?.remove(); this.hud = null; this.shot?.(false);
    this.lean = 0; this.knock = 0; this.gust = 0; this.totoro.group.rotation.x = 0;
    this.onClose?.(result);
  }

  // ---------- per-frame (called by main before totoro.update) ----------
  update(dt) {
    if (!this.open) return;
    // voice level: microphone RMS in dB above the room's noise floor, or the hold-to-roar fallback
    let raw = 0;
    if (this.mic) {
      this.mic.an.getFloatTimeDomainData(this.mic.buf); let s = 0; for (const v of this.mic.buf) s += v * v;
      const rms = Math.sqrt(s / this.mic.buf.length), db = 20 * Math.log10(rms + 1e-7);
      raw = Math.max(0, Math.min(1, (db - (this.mic.floorDb + 7)) / 28));
    } else raw = this.holding ? Math.min(1, (this.holdT = (this.holdT || 0) + dt * 6)) : (this.holdT = 0);
    this.level += (raw - this.level) * Math.min(1, dt * (raw > this.level ? 18 : 7));
    // Totoro: mouth follows his own envelope (roarT drives BigTotoro's mouth), leans back from your roar
    const t = this.totoro;
    if (this.totoroLevel > 0.02) t.roarT = 0.4 * this.totoroLevel + dt;
    else if (t.roarT > 0 && t.roarT < 0.45) t.roarT = 0;
    const push = this.phase === 'player' ? this.level : 0;
    this.knock = Math.max(0, this.knock - dt * 0.45);
    const want = push * 0.1 + (this.knock > 0 ? Math.sin(Math.min(1, (1 - this.knock) * 4) * Math.PI / 2) * 0.55 * Math.min(1, this.knock * 2.5) : 0);
    this.lean += (want - this.lean) * Math.min(1, dt * 6);
    t.group.rotation.order = 'YXZ'; t.group.rotation.x = -this.lean;
    if (push > 0.5) t.blinkT = Math.min(t.blinkT, 0.1);
    this.gust = push; // main.js turns this into a grass gust from the player towards Totoro
    if (this.ui && this.phase) this.draw();
  }

  // ---------- helpers ----------
  follow(seconds, step, stopEarly = null) {
    return new Promise((res) => {
      let last = performance.now(), t = 0;
      const tick = (now) => {
        if (!this.open) return res();
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        step?.(t, dt);
        if (t >= seconds || stopEarly?.()) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  silentTail(targetLen) {
    // stop listening once the player has roared something at least as long as the target and gone quiet
    const tr = this.trace, on = tr.findIndex((v) => v > 0.22); if (on < 0) return false;
    if (tr.length - on < targetLen * 0.8) return false;
    return tr.slice(-10).every((v) => v < 0.12);
  }
  compare(target, trace) {
    const on = trace.findIndex((v) => v > 0.22); if (on < 0) return 0;
    const start = Math.max(0, on - Math.round(0.1 * HZ)) - target.findIndex((v) => v > 0.1) + 1;
    const p = target.map((_, i) => trace[start + i] || 0);
    const peak = Math.max(...p, 0.0001), norm = p.map((v) => Math.min(1, v / Math.max(peak, 0.45)));
    let diff = 0, n = 0;
    for (let i = 0; i < target.length; i++) { const tv = target[i] > 0.05 ? target[i] / Math.max(...target) : 0, pv = norm[i] > 0.18 ? norm[i] : 0; if (tv > 0 || pv > 0) { diff += Math.abs((tv > 0 ? 1 : 0) - (pv > 0 ? 1 : 0)) * 0.7 + Math.abs(tv - pv) * 0.3; n++; } }
    const sim = 1 - diff / Math.max(1, n);
    const loudness = Math.min(1, peak / 0.4);
    return Math.round(Math.max(0, Math.min(1, (sim - 0.3) / 0.6)) * 100 * loudness);
  }
  async openMic() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      this.sound?.init?.(); const c = this.sound?.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 1024; src.connect(an);
      return { stream, an, buf: new Float32Array(an.fftSize), floorDb: -60 };
    } catch (e) { console.warn('mic unavailable', e); return null; }
  }
  async calibrate() {
    const vals = [];
    await this.follow(1.0, () => { const b = this.mic.buf; this.mic.an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; vals.push(20 * Math.log10(Math.sqrt(s / b.length) + 1e-7)); });
    vals.sort((a, b) => a - b); this.mic.floorDb = Math.max(-75, Math.min(-30, vals[Math.floor(vals.length * 0.6)] || -60));
  }
  key(e, down) {
    const k = e.key.toLowerCase();
    if (k === 'escape' && down) { e.stopPropagation(); e.preventDefault(); this.finish(this.result || null); return; }
    if (k === ' ') { e.stopPropagation(); e.preventDefault(); this.holding = down; }
    else if (this.ui && !this.ui.card.hidden) return; // let Enter/Tab work on the result buttons
    else e.stopPropagation();
  }
  buildHud() {
    if (!document.getElementById('roarHudStyle')) { const st = document.createElement('style'); st.id = 'roarHudStyle'; st.textContent = STYLE; document.head.appendChild(st); }
    this.hud?.remove();
    const h = document.createElement('div'); h.id = 'roarHud';
    h.innerHTML = `<button class="rh-quit">结束比赛 · Esc</button><div class="rh-head"><div class="rh-round"></div><div class="rh-tip"></div></div><div class="rh-score"></div>
      <div class="rh-panel"><span class="rh-who">准备</span><canvas></canvas><div class="rh-legend"><span><i style="background:#c9d2cf"></i>龙猫的吼声</span><span><i style="background:#f0c06c"></i>你的吼声</span></div></div>
      <button class="rh-hold" hidden>按住 · 吼！</button><div class="rh-card" hidden></div>`;
    document.body.appendChild(h); this.hud = h;
    const q = (s) => h.querySelector(s);
    this.ui = { round: q('.rh-round'), tip: q('.rh-tip'), score: q('.rh-score'), panel: q('.rh-panel'), who: q('.rh-who'), canvas: q('canvas'), hold: q('.rh-hold'), card: q('.rh-card') };
    q('.rh-quit').onclick = () => this.finish(this.result || null);
    const hold = this.ui.hold;
    hold.addEventListener('pointerdown', (e) => { e.preventDefault(); this.holding = true; hold.setPointerCapture?.(e.pointerId); });
    hold.addEventListener('pointerup', () => { this.holding = false; }); hold.addEventListener('pointercancel', () => { this.holding = false; });
  }
  draw() {
    const cv = this.ui.canvas, b = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(b.width * dpr)) { cv.width = Math.round(b.width * dpr); cv.height = Math.round(b.height * dpr); }
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, T = this.target || [], n = Math.max(T.length + HZ * 1.8, 10);
    g.clearRect(0, 0, W, H);
    const x = (i) => (i / n) * W, y = (v) => H - 8 * dpr - v * (H - 22 * dpr);
    g.strokeStyle = '#ffffff22'; g.lineWidth = 1; for (const v of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(0, y(v)); g.lineTo(W, y(v)); g.stroke(); }
    // target envelope (filled ghost); progress marker while Totoro roars
    g.fillStyle = '#c9d2cf55'; g.strokeStyle = '#c9d2cf'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(0, y(0));
    T.forEach((v, i) => g.lineTo(x(i), y(v))); g.lineTo(x(T.length), y(0)); g.closePath(); g.fill(); g.stroke();
    // player's trace (aligned on its onset so the overlap is easy to read)
    const tr = this.trace || [], on = Math.max(0, tr.findIndex((v) => v > 0.22) - 2), off = on >= 0 ? on : 0;
    g.strokeStyle = '#f0c06c'; g.lineWidth = 3 * dpr; g.beginPath();
    tr.slice(off).forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)))); g.stroke();
    // live level meter on the right
    const lv = this.phase === 'totoro' ? this.totoroLevel : this.level;
    g.fillStyle = this.phase === 'totoro' ? '#c9d2cf' : '#f0c06c'; g.fillRect(W - 10 * dpr, y(lv), 6 * dpr, y(0) - y(lv));
  }

  // ---------- audio: a soft, furry growl (sawtooth through a vowel-ish filter + breath noise) ----------
  ac() { const s = this.sound; s?.init?.(); return s?.ctx ? { c: s.ctx, out: s.master || s.ctx.destination } : null; }
  playGrowl(env, boost = 1) {
    const a = this.ac(); if (!a) return; const { c, out } = a, t0 = c.currentTime + 0.02, dur = env.length / HZ;
    const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'bandpass'; f.frequency.value = 560; f.Q.value = 2.2; f2.type = 'lowpass'; f2.frequency.value = 1500;
    o.frequency.setValueAtTime(92, t0); o2.frequency.setValueAtTime(46, t0);
    g.gain.setValueAtTime(0.0001, t0);
    env.forEach((v, i) => { const tt = t0 + i / HZ; g.gain.linearRampToValueAtTime(0.0001 + v * 0.42 * boost, tt); o.frequency.linearRampToValueAtTime(80 + v * 40 + Math.sin(i * 0.9) * 6, tt); f.frequency.linearRampToValueAtTime(420 + v * 380, tt); });
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.08);
    const n = Math.floor(c.sampleRate * (dur + 0.1)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const ns = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain(); ns.buffer = buf; nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.8;
    ng.gain.setValueAtTime(0, t0); env.forEach((v, i) => ng.gain.linearRampToValueAtTime(v * 0.18 * boost, t0 + i / HZ)); ng.gain.linearRampToValueAtTime(0, t0 + dur + 0.08);
    o.connect(f); o2.connect(f); f.connect(f2).connect(g).connect(out); ns.connect(nf).connect(ng).connect(out);
    o.start(t0); o2.start(t0); ns.start(t0); o.stop(t0 + dur + 0.15); o2.stop(t0 + dur + 0.15); ns.stop(t0 + dur + 0.15);
  }
  tone(freq, dur, vol, type = 'sine', when = 0) { const a = this.ac(); if (!a) return; const { c, out } = a, t0 = c.currentTime + when, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05); }
  chime(f) { this.tone(f, 0.35, 0.12, 'triangle'); this.tone(f * 1.5, 0.3, 0.06, 'sine', 0.08); }
  blip() { this.tone(300 + Math.random() * 60, 0.05, 0.03, 'triangle'); }
  thump() { this.tone(70, 0.6, 0.4, 'sine'); }
}
