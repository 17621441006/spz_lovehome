// 龙猫大人的小游戏 ——《咚！伞上的雨滴》
// 大龙猫最喜欢雨滴落在伞上的声音。玩家操控撑伞的龙猫在车站大樟树下接雨滴：
// 每一颗雨滴都会敲出一个音符，连击越多旋律越完整；欢喜值满了按空格“跺脚”，
// 整棵树上的雨会一起落下来（电影里最经典的一幕）。小煤球会把伞弄脏、打断连击。
// 自带 DOM / 样式 / 音效，只依赖 main.js 传入的 Sound 实例（尊重静音设置）。

const ROUND = 60;                 // 秒
const STAR_AT = [80, 180, 300];   // 1★ 2★ 3★ 所需欢喜点
const JOURNAL_KEY = 'zzb.forestJournal';
export const TOTORO_REWARDS = [
  { stars: 1, id: 'totoro-acorn', name: '龙猫的橡果', icon: '🌰', count: 3, text: '圆滚滚、亮晶晶，种下去也许会发芽' },
  { stars: 2, id: 'bamboo-parcel', name: '竹叶小包', icon: '🎋', count: 1, text: '竹叶包好的果子，打开是青草的香味' },
  { stars: 3, id: 'leaf-umbrella', name: '龙猫的叶子伞', icon: '🍃', count: 1, unique: true, text: '龙猫大人亲手摘的大叶子，下雨天顶在头上' },
];
const INVITE_LINES = [
  '……嗷呜！嘿嘿，吓到你了吧？呼噜噜～',
  '你听——雨快要来了。车站旁边那棵大樟树上，攒了好多好多雨滴。',
  '我最喜欢雨滴落在伞上的声音了：咚！咚咚！{name}，要不要陪我一起接雨滴？',
];
// 原创五声音阶小旋律（C 宫），每接住一滴就往下走一个音
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
const MELODY = [0, 2, 4, 2, 3, 4, 5, 4, 3, 2, 1, 2, 4, 5, 7, 5, 4, 2, 3, 1, 0, 2, 1, 0];

export function loadJournal() {
  try { const j = JSON.parse(localStorage.getItem(JOURNAL_KEY)); if (j && j.items) return j; } catch { /* ignore */ }
  return { items: {}, stamps: {}, best: {} };
}
function saveJournal(j) { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(j)); } catch { /* ignore */ } }

const TOTORO_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M30 34 L24 4 L42 28Z M90 34 L96 4 L78 28Z" fill="#6f777a"/><ellipse cx="60" cy="70" rx="48" ry="44" fill="#7d8588"/><ellipse cx="60" cy="88" rx="32" ry="26" fill="#efe6cf"/><circle cx="40" cy="58" r="10" fill="#fffdf4"/><circle cx="80" cy="58" r="10" fill="#fffdf4"/><circle cx="40" cy="58" r="4.5" fill="#1d2123"/><circle cx="80" cy="58" r="4.5" fill="#1d2123"/><ellipse cx="60" cy="58" rx="5" ry="2.6" fill="#33393b"/><path d="M38 70 Q60 92 82 70 Q60 80 38 70Z" fill="#5a2a2a"/><g stroke="#3c4244" stroke-width="1.6" stroke-linecap="round"><path d="M28 64 L8 60 M28 69 L7 70 M92 64 L112 60 M92 69 L113 70"/></g><g fill="none" stroke="#7d8588" stroke-width="2.6" stroke-linecap="round"><path d="M50 82 l4 -4 l4 4 M62 82 l4 -4 l4 4"/></g></svg>`;

const STYLE = `
#totoroGame{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 60%,#16303a99,#0b1a20d9);font-family:inherit;color:#40583c;animation:tgFade .35s ease-out}
#totoroGame[hidden]{display:none}
#totoroGame [hidden]{display:none!important}
.tg-invite{position:absolute;left:50%;bottom:clamp(16px,6vh,60px);transform:translateX(-50%);width:min(680px,calc(100vw - 24px));display:flex;gap:16px;align-items:flex-end;animation:tgRise .5s ease-out}
.tg-face{flex:none;width:clamp(84px,14vw,128px);filter:drop-shadow(0 8px 18px #0008);animation:tgBob 2.6s ease-in-out infinite}
.tg-speech{position:relative;flex:1;background:linear-gradient(180deg,#fdf8e8,#f2efd9);border:1px solid #fffbea;border-radius:24px 24px 24px 6px;padding:18px 22px 16px;box-shadow:0 16px 46px #0a1d1680,inset 0 0 0 4px #fffaf04d;cursor:pointer}
.tg-speech b{display:inline-block;font-size:12px;letter-spacing:3px;color:#fffaf0;background:#7d8588;border-radius:999px;padding:3px 12px;margin-bottom:8px}
.tg-line{margin:0;min-height:3.4em;font-size:16px;line-height:1.75;color:#3f5338}
.tg-next{position:absolute;right:18px;bottom:10px;font-size:12px;color:#a0a782;animation:tgBlink 1.2s infinite}
.tg-choices{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
.tg-btn{border:0;border-radius:999px;padding:11px 22px;font:inherit;font-size:15px;letter-spacing:2px;cursor:pointer;background:#e4e9ca;color:#40583c;box-shadow:0 3px 0 #b7bf98}
.tg-btn.main{background:linear-gradient(180deg,#f0c06c,#d4913d);color:#fffaf0;box-shadow:0 3px 0 #a96d2c;text-shadow:0 1px 1px #8d5a22}
.tg-btn:hover{filter:brightness(1.05)}.tg-btn:active{transform:translateY(2px)}
.tg-stage{position:relative;width:min(980px,96vw,calc(88vh * 1.6));aspect-ratio:16/10;border-radius:22px;overflow:hidden;box-shadow:0 0 0 6px #f8f2dc,0 0 0 7px #c9c49a,0 26px 80px #000a;animation:tgRise .45s ease-out;touch-action:none}
.tg-stage canvas{display:block;width:100%;height:100%;cursor:none}
.tg-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,88%);max-height:90%;overflow:auto;box-sizing:border-box;background:linear-gradient(180deg,#fdf8e8f7,#f2efd9f2);border-radius:22px;padding:22px 26px;box-shadow:0 18px 50px #0007;text-align:center}
.tg-card h2{margin:0 0 4px;font-family:'STKaiti','KaiTi','Kaiti SC',serif;font-weight:500;font-size:30px;letter-spacing:6px;color:#3b5a46}
.tg-card .tg-sub{margin:0 0 14px;font-size:12px;letter-spacing:3px;color:#8a8f72}
.tg-rules{display:grid;grid-template-columns:auto 1fr;gap:8px 12px;text-align:left;font-size:13px;line-height:1.6;margin:0 0 14px}
.tg-rules i{font-style:normal;font-size:18px;text-align:center}
.tg-rules kbd{font-size:11px;padding:0 5px;border:1px solid #c9c49a;border-bottom-width:2px;border-radius:5px;background:#fff}
.tg-goal{display:flex;justify-content:center;gap:8px;margin:0 0 16px;flex-wrap:wrap}
.tg-goal span{font-size:12px;background:#ecebd3;border-radius:999px;padding:5px 11px;color:#5d7653}
.tg-stars{font-size:40px;letter-spacing:6px;margin:6px 0 2px;color:#d7d3b3}
.tg-stars .on{color:#e8a93c;text-shadow:0 0 14px #ffd27a}
.tg-score{font-size:14px;color:#6f7d63;margin:0 0 12px;letter-spacing:1px}
.tg-score b{font-size:22px;color:#a0622c}
.tg-rewards{display:grid;gap:8px;margin:0 0 16px;text-align:left}
.tg-reward{display:flex;gap:12px;align-items:center;background:#fffdf3;border:1px solid #e3dfbf;border-radius:14px;padding:8px 12px;font-size:13px}
.tg-reward.locked{opacity:.45;filter:grayscale(1)}
.tg-reward .ic{font-size:26px}.tg-reward small{display:block;color:#8a8f72;font-size:11px}
.tg-reward .new{margin-left:auto;font-size:11px;color:#fff;background:#d4913d;border-radius:999px;padding:2px 8px}
.tg-close{position:absolute;right:12px;top:10px;width:34px;height:34px;border-radius:50%;border:0;background:#f8f2dccc;color:#5d7653;font-size:20px;cursor:pointer;z-index:2}
.tg-stomp{position:absolute;right:16px;bottom:16px;width:84px;height:84px;border-radius:50%;border:0;font:inherit;font-size:16px;font-weight:700;letter-spacing:2px;color:#fffaf0;background:radial-gradient(circle at 40% 35%,#f6cf7f,#d4913d);box-shadow:0 4px 0 #a96d2c,0 0 26px #ffd27a;animation:tgPulse 1s infinite}
@keyframes tgFade{from{opacity:0}}@keyframes tgRise{from{opacity:0;transform:translate(-50%,24px)}}
.tg-stage{animation-name:tgPop}@keyframes tgPop{from{opacity:0;transform:scale(.94)}}
@keyframes tgBob{50%{transform:translateY(-6px) rotate(-2deg)}}@keyframes tgBlink{50%{opacity:.2}}@keyframes tgPulse{50%{transform:scale(1.08)}}
@media(max-width:600px){.tg-line{font-size:14px}.tg-card{padding:16px}.tg-card h2{font-size:24px}.tg-rules{font-size:12px}}
`;

function injectStyle() {
  if (document.getElementById('totoroGameStyle')) return;
  const st = document.createElement('style'); st.id = 'totoroGameStyle'; st.textContent = STYLE; document.head.appendChild(st);
}
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TotoroRainGame {
  constructor({ sound, getPlayerName, onOpen, onClose } = {}) {
    this.sound = sound; this.getPlayerName = getPlayerName || (() => '小旅人');
    this.onOpen = onOpen; this.onClose = onClose;
    this.open = false; this.mode = 'idle'; this.root = null; this.raf = 0;
    this._key = (e) => this.onKey(e, true); this._keyUp = (e) => this.onKey(e, false);
    this._resize = () => this.resize();
  }

  // ---------- flow ----------
  invite() {
    if (this.open) return;
    injectStyle(); this.open = true; this.onOpen?.();
    this.build();
    addEventListener('keydown', this._key, true); addEventListener('keyup', this._keyUp, true); addEventListener('resize', this._resize);
    this.lineIndex = 0; this.showLine();
  }
  close(result = null) {
    if (!this.open) return;
    cancelAnimationFrame(this.raf); this.raf = 0;
    removeEventListener('keydown', this._key, true); removeEventListener('keyup', this._keyUp, true); removeEventListener('resize', this._resize);
    this.root?.remove(); this.root = null; this.open = false; this.mode = 'idle';
    this.onClose?.(result);
  }

  build() {
    const r = document.createElement('div');
    r.id = 'totoroGame'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-label', '龙猫大人的小游戏');
    r.innerHTML = `
      <div class="tg-invite">
        <div class="tg-face">${TOTORO_SVG}</div>
        <div class="tg-speech"><b>龙猫大人</b><p class="tg-line" aria-live="polite"></p><span class="tg-next">点击继续 ▾</span><div class="tg-choices" hidden></div></div>
      </div>
      <div class="tg-stage" hidden>
        <canvas></canvas>
        <button class="tg-close" aria-label="回到森林" title="回到森林 (Esc)">×</button>
        <div class="tg-card tg-intro">
          <h2>咚！伞上的雨滴</h2><p class="tg-sub">和龙猫大人一起，在大樟树下接雨</p>
          <div class="tg-rules">
            <i>☂</i><span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> 或拖动画面，让龙猫撑伞接住落下的东西</span>
            <i>💧</i><span>雨滴 +1，每一滴都会“咚”出一个音符；大水珠 +3，橡果 +5</span>
            <i>✦</i><span>不停接住就有连击，连击越高倍率越高（最多 ×4）</span>
            <i>⚫</i><span>小心小煤球！接到会把伞弄脏、打断连击</span>
            <i>🦶</i><span>欢喜值攒满时按 <kbd>空格</kbd> 让龙猫<b>跺脚</b>——整棵树的雨会一起落下来，得分翻倍！</span>
          </div>
          <div class="tg-goal"><span>★ ${STAR_AT[0]} 龙猫的橡果</span><span>★★ ${STAR_AT[1]} 竹叶小包</span><span>★★★ ${STAR_AT[2]} 龙猫的叶子伞</span></div>
          <button class="tg-btn main tg-go">开始接雨！</button>
        </div>
        <div class="tg-card tg-result" hidden></div>
        <button class="tg-stomp" hidden>跺脚！</button>
      </div>`;
    document.body.appendChild(r); this.root = r;
    const q = (s) => r.querySelector(s);
    this.el = { invite: q('.tg-invite'), line: q('.tg-line'), next: q('.tg-next'), choices: q('.tg-choices'), speech: q('.tg-speech'), stage: q('.tg-stage'), canvas: q('canvas'), intro: q('.tg-intro'), result: q('.tg-result'), stomp: q('.tg-stomp') };
    this.ctx = this.el.canvas.getContext('2d');
    this.el.speech.onclick = () => this.advance();
    q('.tg-close').onclick = () => this.close(this.result || null);
    q('.tg-go').onclick = () => this.startRound();
    this.el.stomp.onclick = () => this.stomp();
    const c = this.el.canvas;
    c.addEventListener('pointerdown', (e) => { this.pointer = this.toCanvasX(e); c.setPointerCapture?.(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || this.pointer != null) this.pointer = this.toCanvasX(e); });
    c.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') this.pointer = null; });
    c.addEventListener('pointerleave', () => { this.pointer = null; });
  }

  showLine() {
    const text = INVITE_LINES[this.lineIndex].replace('{name}', this.getPlayerName());
    const last = this.lineIndex === INVITE_LINES.length - 1;
    this.el.next.hidden = true; this.el.choices.hidden = true;
    clearInterval(this.typer); let i = 0; this.typing = true;
    this.el.line.textContent = '';
    this.typer = setInterval(() => {
      i += 1; this.el.line.textContent = text.slice(0, i);
      if (i % 3 === 0) this.blip(330 + Math.random() * 80, 0.05, 0.035);
      if (i >= text.length) this.finishTyping(last);
    }, 38);
    this.fullText = text;
  }
  finishTyping(last) {
    clearInterval(this.typer); this.typing = false; this.el.line.textContent = this.fullText;
    if (!last) { this.el.next.hidden = false; return; }
    this.el.choices.hidden = false;
    this.el.choices.innerHTML = '<button class="tg-btn main">好呀，一起接雨！</button><button class="tg-btn">下次吧</button>';
    const [yes, no] = this.el.choices.querySelectorAll('button');
    yes.onclick = (e) => { e.stopPropagation(); this.toStage(); };
    no.onclick = (e) => { e.stopPropagation(); this.close(null); };
    yes.focus();
  }
  advance() {
    if (this.mode !== 'idle') return;
    const last = this.lineIndex === INVITE_LINES.length - 1;
    if (this.typing) { this.finishTyping(last); return; }
    if (!last) { this.lineIndex += 1; this.showLine(); }
  }
  toStage() {
    this.mode = 'intro';
    this.el.invite.hidden = true; this.el.stage.hidden = false;
    this.resize(); this.reset(); this.loop();
    this.el.intro.querySelector('.tg-go').focus();
  }

  // ---------- round ----------
  reset() {
    this.t = ROUND; this.score = 0; this.combo = 0; this.maxCombo = 0; this.comboTimer = 0; this.caught = 0;
    this.joy = 0; this.fever = 0; this.slow = 0; this.items = []; this.fx = []; this.spawnAcc = 0; this.noteI = 0;
    this.tx = this.W / 2; this.tv = 0; this.jumpT = 0; this.shake = 0; this.happy = 0; this.sad = 0; this.wobble = 0; this.countdown = 0;
    this.keys = { l: false, r: false }; this.pointer = null; this.result = null; this.acorns = 0;
    this.rain = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.9, 1.4) }));
  }
  startRound() {
    this.reset(); this.mode = 'count'; this.countdown = 3.2;
    this.el.intro.hidden = true; this.el.result.hidden = true; this.el.canvas.focus?.();
    this.audio();
  }
  endRound() {
    this.mode = 'result'; this.el.stomp.hidden = true;
    const stars = STAR_AT.filter((s) => this.score >= s).length;
    const j = loadJournal(); const prevBest = j.best.totoroRain || 0; const gained = [];
    if (stars > 0) {
      for (const rw of TOTORO_REWARDS) {
        if (stars < rw.stars) continue;
        const had = j.items[rw.id] || 0;
        if (rw.unique && had) continue;
        j.items[rw.id] = had + rw.count; gained.push({ ...rw, first: !had });
      }
      j.stamps.totoroRain = Math.max(j.stamps.totoroRain || 0, stars);
    }
    j.best.totoroRain = Math.max(prevBest, this.score); saveJournal(j);
    this.result = { stars, score: this.score, best: j.best.totoroRain, newBest: this.score > prevBest, gained, maxCombo: this.maxCombo };
    const title = ['雨停了……', '咚咚，真好听！', '是一首雨之歌！', '龙猫大人开心到打滚！'][stars];
    const rewardsHtml = TOTORO_REWARDS.map((rw) => {
      const got = gained.find((g) => g.id === rw.id), owned = (j.items[rw.id] || 0) > 0;
      const cls = stars >= rw.stars || owned ? '' : ' locked';
      const tag = got ? `<span class="new">${got.first ? '首次获得' : '+' + rw.count}</span>` : (owned && rw.unique ? '<span class="new" style="background:#8fa77f">已拥有</span>' : '');
      return `<div class="tg-reward${cls}"><span class="ic">${rw.icon}</span><div>${'★'.repeat(rw.stars)} ${rw.name}${rw.count > 1 ? ' ×' + rw.count : ''}<small>${rw.text}</small></div>${tag}</div>`;
    }).join('');
    this.el.result.innerHTML = `<h2>${title}</h2>
      <div class="tg-stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('')}</div>
      <p class="tg-score">欢喜点 <b>${this.score}</b>　·　最高连击 ${this.maxCombo}　·　${this.result.newBest ? '<b style="font-size:13px">新纪录！</b>' : '最佳 ' + this.result.best}</p>
      <div class="tg-rewards">${rewardsHtml}</div>
      <p class="tg-sub">${stars ? '礼物已经收进你的「森林手账」啦' : '再接 ' + (STAR_AT[0] - this.score) + ' 点就能拿到第一颗星，再试一次吧'}</p>
      <div class="tg-choices" style="justify-content:center"><button class="tg-btn main tg-again">再玩一次</button><button class="tg-btn tg-home">回到森林</button></div>`;
    this.el.result.hidden = false;
    this.el.result.querySelector('.tg-again').onclick = () => this.startRound();
    this.el.result.querySelector('.tg-home').onclick = () => this.close(this.result);
    this.el.result.querySelector('.tg-again').focus();
    if (stars) this.arpeggio([0, 2, 4, 5, 7].slice(0, 2 + stars), 0.11);
  }

  // ---------- input ----------
  toCanvasX(e) { const b = this.el.canvas.getBoundingClientRect(); return (e.clientX - b.left) / b.width * this.W; }
  onKey(e, down) {
    if (!this.open) return;
    const k = e.key.toLowerCase();
    e.stopPropagation();
    if (k === 'escape' && down) { e.preventDefault(); this.close(this.result || null); return; }
    if (this.mode === 'idle') {
      if (down && !e.repeat && (k === 'enter' || k === ' ' || k === 'e')) {
        if (!this.el.choices.hidden && document.activeElement?.closest?.('.tg-choices')) { if (k === 'e') document.activeElement.click(); return; }
        e.preventDefault(); this.advance();
      }
      return;
    }
    if (k === 'arrowleft' || k === 'a') { this.keys.l = down; e.preventDefault(); }
    if (k === 'arrowright' || k === 'd') { this.keys.r = down; e.preventDefault(); }
    if (k === ' ' && down && this.mode === 'play') { e.preventDefault(); this.stomp(); }
  }
  stomp() {
    if (this.mode !== 'play' || this.joy < 1) return;
    this.joy = 0; this.fever = 6; this.jumpT = 0.7; this.el.stomp.hidden = true;
    setTimeout(() => { if (this.open) { this.shake = 0.6; this.thump(); this.addText(this.W / 2, this.H * 0.32, '整棵树的雨都落下来啦！', '#fff2c4', 1.8, 26); } }, 380);
  }

  // ---------- sim ----------
  resize() {
    if (!this.el) return;
    const b = this.el.stage.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1);
    const oldW = this.W || b.width;
    this.W = b.width; this.H = b.height; this.s = this.H / 600;
    this.el.canvas.width = Math.round(b.width * dpr); this.el.canvas.height = Math.round(b.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.tx != null) this.tx *= this.W / oldW;
    this.ground = this.H * 0.9; this.bg = this.paintBackground();
  }
  get umbrella() {
    const s = this.s, lift = this.jumpOffset();
    return { x: this.tx + 22 * s, y: this.ground - 178 * s - lift, hw: 98 * s };
  }
  jumpOffset() { if (this.jumpT <= 0) return 0; const p = 1 - this.jumpT / 0.7; return Math.sin(Math.min(1, p / 0.55) * Math.PI) * 70 * this.s; }
  spawn() {
    const p = 1 - this.t / ROUND, f = this.fever > 0;
    const r = Math.random(); let type = 'drop';
    if (!f && r < 0.035 + 0.11 * p) type = 'soot';
    else if (r < 0.2) type = Math.random() < 0.28 ? 'acorn' : 'big';
    if (f && Math.random() < 0.3) type = 'big';
    const speed = this.H * (0.3 + 0.22 * p) * { drop: 1, big: 0.85, acorn: 0.9, soot: 0.55 }[type] * (f ? 1.15 : 1);
    this.items.push({ type, x: rand(0.05, 0.95) * this.W, y: this.H * rand(0.1, 0.2), vy: speed, ph: Math.random() * 6.28, sx: 0 });
  }
  update(dt) {
    const s = this.s;
    for (const d of this.rain) { d.y += dt * d.v * (this.fever > 0 ? 1.8 : 1.1); if (d.y > 1) { d.y -= 1; d.x = Math.random(); } }
    this.fx = this.fx.filter((f) => (f.t -= dt) > 0);
    this.happy = Math.max(0, this.happy - dt); this.sad = Math.max(0, this.sad - dt); this.wobble = Math.max(0, this.wobble - dt * 3);
    this.shake = Math.max(0, this.shake - dt); this.jumpT = Math.max(0, this.jumpT - dt);
    if (this.mode === 'count') { this.countdown -= dt; if (this.countdown <= 0) { this.mode = 'play'; this.blip(988, 0.18, 0.08); } else if (Math.ceil(this.countdown) !== Math.ceil(this.countdown + dt)) this.blip(660, 0.12, 0.06); }
    // Totoro moves in every live mode so players can warm up during the countdown
    if (this.mode === 'play' || this.mode === 'count') {
      const max = this.W * 1.05 * (this.slow > 0 ? 0.5 : 1);
      let target = 0;
      if (this.keys.l || this.keys.r) target = ((this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0)) * max;
      else if (this.pointer != null) target = clamp((this.pointer - this.tx) * 9, -max, max);
      this.tv += (target - this.tv) * Math.min(1, dt * 14);
      this.tx = clamp(this.tx + this.tv * dt, 70 * s, this.W - 70 * s);
    }
    if (this.mode !== 'play') return;
    this.t -= dt; this.fever = Math.max(0, this.fever - dt); this.slow = Math.max(0, this.slow - dt);
    this.comboTimer -= dt; if (this.comboTimer <= 0 && this.combo) this.combo = 0;
    const p = 1 - this.t / ROUND;
    this.spawnAcc += dt * ((1.5 + 1.8 * p) + (this.fever > 0 ? 8 : 0));
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawn(); }
    const u = this.umbrella;
    for (const it of this.items) {
      const py = it.y; it.y += it.vy * dt; it.ph += dt * 3;
      if (it.type === 'soot') it.x += Math.sin(it.ph) * 60 * s * dt;
      if (it.type === 'acorn') it.x += Math.sin(it.ph * 1.3) * 30 * s * dt;
      // canopy is a dome: allow a little more height near the centre
      const dx = it.x - u.x, dome = u.y - 34 * s * Math.max(0, 1 - (dx / u.hw) ** 2);
      if (!it.dead && py < dome + 6 * s && it.y >= dome - 4 * s && Math.abs(dx) < u.hw) { it.dead = true; this.catchItem(it); }
      else if (!it.dead && it.y > this.ground - 6 * s) { it.dead = true; this.fx.push({ k: 'ripple', x: it.x, y: this.ground + rand(-4, 10) * s, t: 0.8, d: 0.8 }); }
    }
    this.items = this.items.filter((it) => !it.dead);
    this.el.stomp.hidden = !(this.joy >= 1 && matchMedia('(pointer: coarse)').matches);
    if (this.t <= 0) { this.t = 0; this.items.length = 0; this.endRound(); }
  }
  catchItem(it) {
    const s = this.s, u = this.umbrella;
    if (it.type === 'soot') {
      this.combo = 0; this.slow = 1.6; this.sad = 1.2; this.wobble = 1;
      this.addText(it.x, u.y - 40 * s, '哈啾！伞脏了', '#d6d0c4', 1.1, 18);
      for (let i = 0; i < 8; i++) this.fx.push({ k: 'puff', x: it.x + rand(-20, 20) * s, y: u.y - rand(0, 30) * s, vx: rand(-40, 40) * s, vy: rand(-60, -10) * s, t: 0.7, d: 0.7 });
      this.puff(); return;
    }
    const base = { drop: 1, big: 3, acorn: 5 }[it.type];
    this.combo += 1; this.maxCombo = Math.max(this.maxCombo, this.combo); this.comboTimer = 1.7; this.caught += 1;
    const mult = Math.min(4, 1 + Math.floor(this.combo / 10)) * (this.fever > 0 ? 2 : 1);
    const gain = base * mult; this.score += gain;
    this.joy = Math.min(1, this.joy + { drop: 0.03, big: 0.07, acorn: 0.09 }[it.type] * (this.fever > 0 ? 0 : 1));
    this.happy = 0.45; this.wobble = 1;
    const col = { drop: '#d9f1ff', big: '#a8e2ff', acorn: '#ffd88a' }[it.type];
    this.addText(it.x, u.y - 46 * s, `+${gain}`, col, 0.8, it.type === 'drop' ? 16 : 22);
    if (it.type !== 'acorn' && Math.random() < 0.35) this.addText(u.x + rand(-50, 50) * s, u.y - 70 * s, it.type === 'big' ? '咚！' : '咚', '#ffffffcc', 0.7, it.type === 'big' ? 26 : 18);
    for (let i = 0; i < (it.type === 'drop' ? 4 : 9); i++) this.fx.push({ k: 'splash', x: it.x, y: u.y - 30 * s, vx: rand(-90, 90) * s, vy: rand(-160, -60) * s, t: 0.5, d: 0.5, c: col });
    if (it.type === 'acorn') { this.acorns += 1; this.arpeggio([4, 5, 7], 0.06); }
    else { const n = MELODY[this.noteI++ % MELODY.length]; this.bell(SCALE[n] * (it.type === 'big' ? 0.5 : 1) * (this.combo >= 25 ? 2 : 1), it.type === 'big' ? 0.9 : 0.5); }
    if (this.combo && this.combo % 10 === 0 && this.combo <= 30) this.addText(this.W / 2, this.H * 0.24, `连击 ${this.combo}！倍率 ×${Math.min(4, 1 + this.combo / 10)}`, '#ffe6a0', 1.2, 22);
  }
  addText(x, y, text, color, t, size) { this.fx.push({ k: 'text', x, y, text, c: color, t, d: t, size }); }

  // ---------- render ----------
  paintBackground() {
    const W = this.W, H = this.H, s = this.s, cv = document.createElement('canvas');
    const dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d3a4c'); gr.addColorStop(0.55, '#2f5a5c'); gr.addColorStop(1, '#3d6a4f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // far hills
    g.fillStyle = '#2a4f4a'; g.beginPath(); g.moveTo(0, H * 0.62);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.6 - Math.sin(x / W * 5 + 1) * 26 * s - Math.sin(x / W * 13) * 8 * s);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#284a3c'; g.beginPath(); g.moveTo(0, H * 0.72);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.7 - Math.sin(x / W * 7 + 3) * 18 * s);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
    // lamp glow (left) and bus-stop sign (right)
    const lx = W * 0.1;
    gr = g.createRadialGradient(lx, H * 0.38, 0, lx, H * 0.38, 160 * s); gr.addColorStop(0, '#ffe3a066'); gr.addColorStop(1, '#ffe3a000');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1e2c2c'; g.fillRect(lx - 3 * s, H * 0.38, 6 * s, this.ground - H * 0.38);
    g.fillStyle = '#ffeab0'; g.beginPath(); g.arc(lx, H * 0.38, 9 * s, 0, 7); g.fill();
    const bx = W * 0.88;
    g.fillStyle = '#3a3a36'; g.fillRect(bx - 2.5 * s, H * 0.5, 5 * s, this.ground - H * 0.5);
    g.fillStyle = '#e8e1c8'; g.beginPath(); g.arc(bx, H * 0.5, 22 * s, 0, 7); g.fill();
    g.strokeStyle = '#b5452f'; g.lineWidth = 3 * s; g.stroke();
    g.fillStyle = '#3b3b36'; g.font = `${11 * s}px STKaiti,KaiTi,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('稻荷前', bx, H * 0.5);
    // ground + puddle
    gr = g.createLinearGradient(0, this.ground - 20 * s, 0, H); gr.addColorStop(0, '#2f5a3a'); gr.addColorStop(1, '#22432b');
    g.fillStyle = gr; g.fillRect(0, this.ground - 14 * s, W, H);
    g.fillStyle = '#4d7f8a55'; g.beginPath(); g.ellipse(W * 0.5, this.ground + 16 * s, W * 0.36, 9 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#3c6b3f';
    for (let x = 0; x < W; x += 9 * s) { const h = (8 + Math.sin(x * 0.37) * 5) * s; g.fillRect(x, this.ground - 14 * s - h, 2 * s, h); }
    return cv;
  }
  draw(time) {
    const g = this.ctx, W = this.W, H = this.H, s = this.s;
    g.save();
    if (this.shake > 0) g.translate(rand(-1, 1) * 9 * s * this.shake, rand(-1, 1) * 9 * s * this.shake);
    g.drawImage(this.bg, 0, 0, W, H);
    if (this.fever > 0) { g.fillStyle = `rgba(150,220,255,${0.1 + 0.05 * Math.sin(time * 8)})`; g.fillRect(0, 0, W, H); }
    // background rain streaks
    g.strokeStyle = '#cfe9ff40'; g.lineWidth = 1.2 * s; g.beginPath();
    for (const d of this.rain) { const x = d.x * W, y = d.y * H; g.moveTo(x, y); g.lineTo(x - 3 * s, y + 16 * s); }
    g.stroke();
    // puddle ripples
    for (const f of this.fx) if (f.k === 'ripple') { const p = 1 - f.t / f.d; g.strokeStyle = `rgba(210,235,255,${0.6 * (1 - p)})`; g.lineWidth = 1.5 * s; g.beginPath(); g.ellipse(f.x, f.y, (6 + 26 * p) * s, (2 + 6 * p) * s, 0, 0, 7); g.stroke(); }
    this.drawTotoro(g, time);
    for (const it of this.items) this.drawItem(g, it, time);
    this.drawCanopy(g, time);
    // particles & texts
    for (const f of this.fx) {
      const p = 1 - f.t / f.d;
      if (f.k === 'splash' || f.k === 'puff') { f.x += f.vx * 0.016; f.y += f.vy * 0.016; f.vy += 420 * s * 0.016; g.fillStyle = f.k === 'puff' ? `rgba(30,30,30,${0.7 * (1 - p)})` : f.c; g.globalAlpha = f.k === 'puff' ? 1 : 1 - p; g.beginPath(); g.arc(f.x, f.y, (f.k === 'puff' ? 6 : 2.4) * s, 0, 7); g.fill(); g.globalAlpha = 1; }
      if (f.k === 'text') { g.globalAlpha = Math.min(1, f.t / f.d * 2); g.fillStyle = f.c; g.font = `700 ${f.size * s}px STKaiti,KaiTi,"Microsoft YaHei",serif`; g.textAlign = 'center'; g.shadowColor = '#0008'; g.shadowBlur = 6 * s; g.fillText(f.text, f.x, f.y - p * 30 * s); g.shadowBlur = 0; g.globalAlpha = 1; }
    }
    g.restore();
    if (this.mode === 'play' || this.mode === 'count' || this.mode === 'result') this.drawHud(g, time);
    if (this.mode === 'count') {
      const n = Math.ceil(this.countdown); const p = this.countdown % 1;
      g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#000a'; g.shadowBlur = 12 * s;
      g.font = `700 ${(70 + 40 * p) * s}px STKaiti,KaiTi,serif`; g.fillText(n > 3 ? '准备' : n > 0 ? String(n) : '接！', W / 2, H * 0.42);
      g.font = `${15 * s}px "Microsoft YaHei",sans-serif`; g.fillText('先左右动一动，熟悉一下龙猫的伞', W / 2, H * 0.52); g.shadowBlur = 0; g.textBaseline = 'alphabetic';
    }
  }
  drawCanopy(g, time) {
    const W = this.W, s = this.s, sway = this.fever > 0 ? 6 : 2;
    const blobs = 16;
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? '#2c5a3a' : '#1c3d2c';
      for (let i = 0; i <= blobs; i++) {
        const x = i / blobs * W + Math.sin(time * 0.8 + i) * sway * s, y = (layer ? 38 : 22) * s + Math.sin(i * 2.3) * 16 * s;
        g.beginPath(); g.arc(x, y, (layer ? 52 : 66) * s + Math.sin(i * 1.7) * 12 * s, 0, 7); g.fill();
      }
    }
    // glints of water hanging under the leaves
    g.fillStyle = '#d9f1ff99';
    for (let i = 0; i < 22; i++) { const x = (i * 97.3 % 100) / 100 * W, y = (70 + (i * 37 % 30)) * s; g.beginPath(); g.arc(x, y + Math.sin(time * 2 + i) * 2 * s, 2 * s, 0, 7); g.fill(); }
  }
  drawItem(g, it, time) {
    const s = this.s, x = it.x, y = it.y;
    if (it.type === 'drop' || it.type === 'big') {
      const r = (it.type === 'big' ? 11 : 6.5) * s;
      if (it.type === 'big') { g.fillStyle = '#9fdcff33'; g.beginPath(); g.arc(x, y, r * 2.2, 0, 7); g.fill(); }
      g.fillStyle = it.type === 'big' ? '#9fdcff' : '#d6efff';
      g.beginPath(); g.moveTo(x, y - r * 2); g.bezierCurveTo(x + r * 0.4, y - r, x + r, y - r * 0.2, x + r, y + r * 0.2); g.arc(x, y + r * 0.2, r, 0, Math.PI); g.bezierCurveTo(x - r, y - r * 0.2, x - r * 0.4, y - r, x, y - r * 2); g.fill();
      g.fillStyle = '#ffffffcc'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.05, r * 0.28, 0, 7); g.fill();
    } else if (it.type === 'acorn') {
      g.save(); g.translate(x, y); g.rotate(Math.sin(it.ph) * 0.4);
      g.fillStyle = '#ffd88a44'; g.beginPath(); g.arc(0, 0, 18 * s, 0, 7); g.fill();
      g.fillStyle = '#b86d2e'; g.beginPath(); g.ellipse(0, 3 * s, 8 * s, 10 * s, 0, 0, 7); g.fill();
      g.fillStyle = '#6b4424'; g.beginPath(); g.ellipse(0, -5 * s, 9.5 * s, 5 * s, 0, 0, 7); g.fill();
      g.fillRect(-1 * s, -13 * s, 2 * s, 5 * s);
      g.fillStyle = '#ffffff88'; g.beginPath(); g.arc(-3 * s, 3 * s, 2 * s, 0, 7); g.fill(); g.restore();
    } else {
      g.fillStyle = '#141414'; g.beginPath();
      for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, rr = (i % 2 ? 10 : 13) * s; g.lineTo(x + Math.cos(a + time * 2) * rr, y + Math.sin(a + time * 2) * rr); }
      g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4 * s, y - 1 * s, 3.2 * s, 0, 7); g.arc(x + 4 * s, y - 1 * s, 3.2 * s, 0, 7); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(x - 4 * s, y - 0.5 * s, 1.5 * s, 0, 7); g.arc(x + 4 * s, y - 0.5 * s, 1.5 * s, 0, 7); g.fill();
    }
  }
  drawTotoro(g, time) {
    const s = this.s, x = this.tx, lift = this.jumpOffset(), gy = this.ground - lift;
    const squash = 1 - 0.05 * this.wobble * Math.sin(this.wobble * 12) - (this.jumpT > 0 && this.jumpT < 0.15 ? 0.08 : 0);
    const lean = clamp(this.tv / (this.W || 1), -0.6, 0.6) * 0.18;
    // shadow
    g.fillStyle = '#0003'; g.beginPath(); g.ellipse(x, this.ground + 2 * s, (64 - lift * 0.2 / s) * s, 9 * s, 0, 0, 7); g.fill();
    // umbrella pole sits behind the body, held up by the right paw
    const u0 = this.umbrella;
    g.strokeStyle = '#3a2f26'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(u0.x, u0.y); g.lineTo(u0.x, gy - 96 * s); g.stroke();
    g.save(); g.translate(x, gy); g.rotate(lean); g.scale(1 / squash, squash);
    const fur = '#7d8588', furD = '#6c7477';
    // ears
    g.fillStyle = furD;
    for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * 27 * s, -128 * s, 8 * s, 22 * s, d * 0.18, 0, 7); g.fill(); }
    // body
    g.fillStyle = fur; g.beginPath(); g.ellipse(0, -64 * s, 60 * s, 68 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#efe6cf'; g.beginPath(); g.ellipse(0, -48 * s, 43 * s, 44 * s, 0, 0, 7); g.fill();
    g.strokeStyle = furD; g.lineWidth = 3 * s; g.lineCap = 'round';
    const chev = (cx, cy) => { g.beginPath(); g.moveTo(cx - 6 * s, cy + 4 * s); g.lineTo(cx, cy - 2 * s); g.lineTo(cx + 6 * s, cy + 4 * s); g.stroke(); };
    [-16, 0, 16].forEach((o) => chev(o * s, -78 * s)); [-24, -8, 8, 24].forEach((o) => chev(o * s, -64 * s));
    // feet
    g.fillStyle = furD; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * 26 * s, -3 * s, 16 * s, 7 * s, 0, 0, 7); g.fill(); }
    // face
    const ey = -104 * s, er = (this.happy > 0 ? 11 : 9) * s;
    if (this.sad > 0) {
      g.strokeStyle = '#1d2123'; g.lineWidth = 2.5 * s;
      for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 22 * s - 6 * s, ey - 4 * s); g.lineTo(d * 22 * s + 6 * s * d, ey); g.lineTo(d * 22 * s - 6 * s, ey + 4 * s); g.stroke(); }
    } else {
      const blink = (time % 4) < 0.12;
      for (const d of [-1, 1]) {
        g.fillStyle = '#fffdf4'; g.beginPath(); g.ellipse(d * 22 * s, ey, er, blink ? 1.5 * s : er, 0, 0, 7); g.fill();
        if (!blink) { g.fillStyle = '#1d2123'; g.beginPath(); g.arc(d * 22 * s + clamp(this.tv * 0.004, -3, 3) * s, ey, 4.2 * s, 0, 7); g.fill(); }
      }
    }
    g.fillStyle = '#33393b'; g.beginPath(); g.ellipse(0, -107 * s, 5 * s, 2.6 * s, 0, 0, 7); g.fill();
    g.strokeStyle = '#3c4244'; g.lineWidth = 1.3 * s;
    for (const d of [-1, 1]) for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(d * 30 * s, (-98 + k * 5) * s); g.lineTo(d * 52 * s, (-102 + k * 7) * s); g.stroke(); }
    if (this.happy > 0 || this.fever > 0) { g.fillStyle = '#5a2a2a'; g.beginPath(); g.moveTo(-18 * s, -94 * s); g.quadraticCurveTo(0, -70 * s, 18 * s, -94 * s); g.quadraticCurveTo(0, -86 * s, -18 * s, -94 * s); g.fill(); }
    else { g.strokeStyle = '#3c4244'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(-8 * s, -92 * s); g.quadraticCurveTo(0, -88 * s, 8 * s, -92 * s); g.stroke(); }
    g.restore();
    // umbrella (drawn un-squashed so the catch line stays readable)
    const u = this.umbrella, wob = Math.sin(this.wobble * 16) * this.wobble * 4 * s;
    // raised right arm gripping the pole above the head
    g.strokeStyle = '#6c7477'; g.lineWidth = 15 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 48 * s, gy - 78 * s); g.quadraticCurveTo(x + 62 * s, gy - 130 * s, u.x + 4 * s, gy - 146 * s); g.stroke();
    g.fillStyle = '#7d8588'; g.beginPath(); g.ellipse(u.x + 2 * s, gy - 147 * s, 10 * s, 9 * s, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a2f26'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(u.x, gy - 156 * s); g.lineTo(u.x, u.y); g.stroke();
    g.save(); g.translate(u.x, u.y + wob);
    g.fillStyle = this.slow > 0 ? '#3a3632' : '#262c3a';
    g.beginPath(); g.moveTo(-u.hw, 0); g.quadraticCurveTo(-u.hw * 0.9, -46 * s, 0, -50 * s); g.quadraticCurveTo(u.hw * 0.9, -46 * s, u.hw, 0);
    const sc = 6; for (let i = sc; i > 0; i--) { const x0 = -u.hw + (i / sc) * 2 * u.hw, x1 = -u.hw + ((i - 1) / sc) * 2 * u.hw; g.quadraticCurveTo((x0 + x1) / 2, -9 * s, x1, 0); }
    g.fill();
    g.strokeStyle = '#9fb3c855'; g.lineWidth = 1.4 * s;
    for (const k of [-0.55, 0, 0.55]) { g.beginPath(); g.moveTo(0, -50 * s); g.quadraticCurveTo(k * u.hw * 0.8, -30 * s, k * u.hw, -4 * s); g.stroke(); }
    g.fillStyle = '#c9b48a'; g.beginPath(); g.arc(0, -52 * s, 3.5 * s, 0, 7); g.fill();
    if (this.slow > 0) { g.fillStyle = '#0009'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.sin(i * 2.1) * u.hw * 0.6, -18 * s - (i % 2) * 12 * s, 5 * s, 0, 7); g.fill(); } }
    g.restore();
  }
  drawHud(g, time) {
    const W = this.W, s = this.s;
    g.save(); g.textBaseline = 'middle';
    // star progress bar
    const bw = W * 0.4, bx = (W - bw) / 2, by = 22 * s, max = STAR_AT[2] * 1.08;
    g.fillStyle = '#0d1f1a99'; this.round(g, bx - 8 * s, by - 13 * s, bw + 16 * s, 26 * s, 13 * s); g.fill();
    g.fillStyle = '#f8f2dc33'; this.round(g, bx, by - 4 * s, bw, 8 * s, 4 * s); g.fill();
    const grd = g.createLinearGradient(bx, 0, bx + bw, 0); grd.addColorStop(0, '#9ed0a0'); grd.addColorStop(1, '#f0c06c');
    g.fillStyle = grd; this.round(g, bx, by - 4 * s, Math.max(8 * s, bw * Math.min(1, this.score / max)), 8 * s, 4 * s); g.fill();
    STAR_AT.forEach((v, i) => { const on = this.score >= v; g.font = `${(on ? 20 : 16) * s}px serif`; g.textAlign = 'center'; g.fillStyle = on ? '#ffd36e' : '#f8f2dc88'; g.shadowColor = on ? '#ffbf40' : 'transparent'; g.shadowBlur = on ? 10 * s : 0; g.fillText('★', bx + bw * v / max, by); g.shadowBlur = 0; });
    // score (left), timer + combo (right)
    g.textAlign = 'left'; g.fillStyle = '#fffaf0'; g.shadowColor = '#000a'; g.shadowBlur = 6 * s;
    g.font = `${12 * s}px "Microsoft YaHei",sans-serif`; g.fillText('欢喜点', 20 * s, 20 * s);
    g.font = `700 ${28 * s}px STKaiti,KaiTi,serif`; g.fillText(String(this.score), 20 * s, 46 * s);
    g.textAlign = 'right';
    const tl = Math.ceil(this.t); g.font = `700 ${26 * s}px STKaiti,KaiTi,serif`; g.fillStyle = tl <= 10 && this.mode === 'play' ? (time % 0.5 < 0.25 ? '#ffb38a' : '#fffaf0') : '#fffaf0';
    g.fillText(`☂ ${tl}″`, W - 56 * s, 24 * s);
    if (this.combo >= 2) { g.font = `700 ${16 * s}px "Microsoft YaHei",sans-serif`; g.fillStyle = '#ffe6a0'; g.fillText(`连击 ${this.combo}  ×${Math.min(4, 1 + Math.floor(this.combo / 10)) * (this.fever > 0 ? 2 : 1)}`, W - 56 * s, 52 * s); }
    g.shadowBlur = 0;
    // joy meter (bottom-left)
    const jx = 20 * s, jy = this.H - 26 * s, jw = 150 * s;
    g.fillStyle = '#0d1f1a99'; this.round(g, jx - 6 * s, jy - 14 * s, jw + 12 * s, 28 * s, 14 * s); g.fill();
    g.fillStyle = '#f8f2dc33'; this.round(g, jx + 48 * s, jy - 4 * s, jw - 50 * s, 8 * s, 4 * s); g.fill();
    const full = this.joy >= 1;
    g.fillStyle = this.fever > 0 ? '#9fdcff' : full ? (time % 0.4 < 0.2 ? '#ffd36e' : '#fff2c4') : '#f0c06c';
    this.round(g, jx + 48 * s, jy - 4 * s, Math.max(6 * s, (jw - 50 * s) * (this.fever > 0 ? this.fever / 6 : this.joy)), 8 * s, 4 * s); g.fill();
    g.textAlign = 'left'; g.font = `${12 * s}px "Microsoft YaHei",sans-serif`; g.fillStyle = '#fffaf0'; g.fillText(this.fever > 0 ? '大雨中' : '欢喜值', jx, jy);
    if (full && this.mode === 'play') { g.font = `700 ${16 * s}px "Microsoft YaHei",sans-serif`; g.fillStyle = '#ffe6a0'; g.shadowColor = '#000a'; g.shadowBlur = 6 * s; g.fillText('按 空格 跺脚！', jx + jw + 18 * s, jy); g.shadowBlur = 0; }
    g.restore();
  }
  round(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

  loop() {
    let last = performance.now();
    const tick = (now) => {
      if (!this.open) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.update(dt); this.draw(now / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // ---------- audio ----------
  audio() {
    try {
      if (this.sound) { this.sound.init?.(); if (this.sound.ctx) return { c: this.sound.ctx, out: this.sound.master || this.sound.ctx.destination }; }
      if (!this.ownCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ownCtx = new AC(); }
      return { c: this.ownCtx, out: this.ownCtx.destination };
    } catch { return null; }
  }
  tone(freq, dur, vol, type = 'sine', when = 0, slide = 1) {
    const a = this.audio(); if (!a) return; const { c, out } = a, t = c.currentTime + when;
    const o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  blip(freq, dur, vol) { this.tone(freq, dur, vol, 'triangle'); }
  bell(freq, dur) { this.tone(freq, dur, 0.22, 'sine', 0, 0.985); this.tone(freq * 2.01, dur * 0.5, 0.06, 'sine'); this.tone(freq * 0.5, 0.08, 0.12, 'triangle', 0, 0.6); }
  arpeggio(idx, gap) { idx.forEach((n, i) => this.tone(SCALE[n], 0.5, 0.16, 'sine', i * gap)); }
  thump() { this.tone(90, 0.6, 0.5, 'sine', 0, 0.4); this.noise(0.9, 0.25, 900); }
  puff() { this.noise(0.25, 0.18, 500); this.tone(180, 0.2, 0.1, 'triangle', 0, 0.5); }
  noise(dur, vol, cutoff) {
    const a = this.audio(); if (!a) return; const { c, out } = a, t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain(); src.buffer = b; f.type = 'lowpass'; f.frequency.value = cutoff; gn.gain.value = vol;
    src.connect(f).connect(gn).connect(out); src.start(t);
  }
}
