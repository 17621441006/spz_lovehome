// 通用 NPC 对话框：底部的纸质对话气泡，打字机效果，最后一句可给出选项。
// showDialog(...) 返回 Promise，resolve 为所选选项的 value（Esc / 关闭为 null）。

const STYLE = `
#npcDialog{position:fixed;inset:0;z-index:88;background:linear-gradient(0deg,#0b1a20b0,#0b1a2000 55%);animation:ndFade .3s ease-out}
#npcDialog .nd-wrap{position:absolute;left:50%;bottom:clamp(16px,6vh,60px);transform:translateX(-50%);width:min(700px,calc(100vw - 24px));display:flex;gap:16px;align-items:flex-end;animation:ndRise .45s ease-out}
#npcDialog .nd-face{flex:none;width:clamp(80px,13vw,124px);filter:drop-shadow(0 8px 18px #0008);animation:ndBob 2.6s ease-in-out infinite}
#npcDialog .nd-face svg{display:block;width:100%;height:auto}
#npcDialog .nd-speech{position:relative;flex:1;background:linear-gradient(180deg,#fdf8e8,#f2efd9);border:1px solid #fffbea;border-radius:24px 24px 24px 6px;padding:18px 22px 16px;box-shadow:0 16px 46px #0a1d1680,inset 0 0 0 4px #fffaf04d;cursor:pointer;color:#3f5338}
#npcDialog .nd-name{display:inline-block;font-size:12px;letter-spacing:3px;color:#fffaf0;border-radius:999px;padding:3px 12px;margin-bottom:8px}
#npcDialog .nd-line{margin:0;min-height:3.4em;font-size:16px;line-height:1.75}
#npcDialog .nd-next{position:absolute;right:18px;bottom:10px;font-size:12px;color:#a0a782;animation:ndBlink 1.2s infinite}
#npcDialog .nd-choices{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
#npcDialog .nd-btn{border:0;border-radius:999px;padding:11px 22px;font:inherit;font-size:15px;letter-spacing:2px;cursor:pointer;background:#e4e9ca;color:#40583c;box-shadow:0 3px 0 #b7bf98}
#npcDialog .nd-btn.main{background:linear-gradient(180deg,#f0c06c,#d4913d);color:#fffaf0;box-shadow:0 3px 0 #a96d2c;text-shadow:0 1px 1px #8d5a22}
#npcDialog .nd-btn:focus-visible{outline:2px solid #e8b964;outline-offset:2px}
#npcDialog [hidden]{display:none!important}
@keyframes ndFade{from{opacity:0}}@keyframes ndRise{from{opacity:0;transform:translate(-50%,24px)}}
@keyframes ndBob{50%{transform:translateY(-6px) rotate(-2deg)}}@keyframes ndBlink{50%{opacity:.2}}
@media(max-width:600px){#npcDialog .nd-line{font-size:14px}}
`;
let openCount = 0;
export const isDialogOpen = () => openCount > 0;

export function showDialog({ speaker, color = '#7d8588', face = '', lines, choices = null, blip = null }) {
  if (!document.getElementById('npcDialogStyle')) { const st = document.createElement('style'); st.id = 'npcDialogStyle'; st.textContent = STYLE; document.head.appendChild(st); }
  openCount += 1;
  return new Promise((resolve) => {
    const root = document.createElement('div'); root.id = 'npcDialog'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', speaker);
    root.innerHTML = `<div class="nd-wrap"><div class="nd-face">${face}</div><div class="nd-speech"><span class="nd-name" style="background:${color}">${speaker}</span><p class="nd-line" aria-live="polite"></p><span class="nd-next">点击继续 ▾</span><div class="nd-choices" hidden></div></div></div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s), lineEl = q('.nd-line'), next = q('.nd-next'), box = q('.nd-choices');
    let i = 0, typing = false, timer = 0, full = '';
    const done = (v) => { clearInterval(timer); removeEventListener('keydown', onKey, true); root.remove(); openCount -= 1; resolve(v); };
    const finish = () => {
      clearInterval(timer); typing = false; lineEl.textContent = full;
      const last = i === lines.length - 1;
      if (!last) { next.hidden = false; return; }
      if (!choices) { next.hidden = false; next.textContent = '点击结束 ▾'; return; }
      box.hidden = false; box.innerHTML = '';
      choices.forEach((c, k) => { const b = document.createElement('button'); b.className = 'nd-btn' + (c.main ? ' main' : ''); b.textContent = c.label; b.onclick = (e) => { e.stopPropagation(); done(c.value); }; box.appendChild(b); if (k === 0) setTimeout(() => b.focus(), 0); });
    };
    const show = () => {
      full = lines[i]; next.hidden = true; box.hidden = true; lineEl.textContent = ''; typing = true; let n = 0;
      clearInterval(timer);
      timer = setInterval(() => { n += 1; lineEl.textContent = full.slice(0, n); if (n % 3 === 0) blip?.(); if (n >= full.length) finish(); }, 36);
    };
    const advance = () => {
      if (typing) { finish(); return; }
      if (i < lines.length - 1) { i += 1; show(); return; }
      if (!choices) done(true);
    };
    const onKey = (e) => {
      const k = e.key.toLowerCase(); e.stopPropagation();
      if (k === 'escape') { e.preventDefault(); done(null); return; }
      if (e.repeat) return;
      if (k === 'enter' || k === ' ' || k === 'e') {
        if (!box.hidden && document.activeElement?.closest?.('.nd-choices')) { if (k === 'e') { e.preventDefault(); document.activeElement.click(); } return; }
        e.preventDefault(); advance();
      }
      if ((k === 'arrowleft' || k === 'arrowright') && !box.hidden) { const bs = [...box.querySelectorAll('button')], at = bs.indexOf(document.activeElement); bs[(at + (k === 'arrowright' ? 1 : bs.length - 1)) % bs.length]?.focus(); e.preventDefault(); }
    };
    addEventListener('keydown', onKey, true);
    q('.nd-speech').onclick = advance;
    show();
  });
}

export const TOTORO_FACE = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M30 34 L24 4 L42 28Z M90 34 L96 4 L78 28Z" fill="#6f777a"/><ellipse cx="60" cy="70" rx="48" ry="44" fill="#7d8588"/><ellipse cx="60" cy="88" rx="32" ry="26" fill="#efe6cf"/><circle cx="40" cy="58" r="10" fill="#fffdf4"/><circle cx="80" cy="58" r="10" fill="#fffdf4"/><circle cx="40" cy="58" r="4.5" fill="#1d2123"/><circle cx="80" cy="58" r="4.5" fill="#1d2123"/><ellipse cx="60" cy="58" rx="5" ry="2.6" fill="#33393b"/><path d="M38 70 Q60 92 82 70 Q60 80 38 70Z" fill="#5a2a2a"/><g stroke="#3c4244" stroke-width="1.6" stroke-linecap="round"><path d="M28 64 L8 60 M28 69 L7 70 M92 64 L112 60 M92 69 L113 70"/></g><g fill="none" stroke="#7d8588" stroke-width="2.6" stroke-linecap="round"><path d="M50 82 l4 -4 l4 4 M62 82 l4 -4 l4 4"/></g></svg>`;
export const KEEPER_FACE = `<svg viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="36" rx="54" ry="12" fill="#d9b56a"/><path d="M28 36 Q60 -6 92 36Z" fill="#e4c47c"/><rect x="30" y="28" width="60" height="7" rx="3" fill="#b9452f"/><ellipse cx="60" cy="70" rx="34" ry="36" fill="#e8c39e"/><circle cx="45" cy="62" r="13" fill="#fff"/><circle cx="76" cy="62" r="13" fill="#fff"/><circle cx="47" cy="64" r="5.5" fill="#1d2123"/><circle cx="73" cy="61" r="5.5" fill="#1d2123"/><path d="M32 48 q12 -8 24 0 M64 48 q12 -8 24 0" stroke="#f3f0e8" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M38 86 Q60 74 82 86 Q74 98 60 92 Q46 98 38 86Z" fill="#f3f0e8"/><ellipse cx="60" cy="78" rx="6" ry="5" fill="#d9a07c"/><rect x="26" y="104" width="68" height="16" rx="6" fill="#e07b39"/></svg>`;
