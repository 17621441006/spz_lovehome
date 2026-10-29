// Escape releases the pointer. Fullscreen has a separate visible exit and F11.
export function setupDisplayControls({document,listen,clearMovement,toast,keyboard=globalThis.navigator?.keyboard}){
 const $=id=>document.getElementById(id),restore=()=>document.body.classList.remove('hidden-ui');
 const sync=()=>{const on=!!document.fullscreenElement,b=$('fullscreenToggle');b.textContent=on?'⛶':'⛶';b.setAttribute('aria-label',on?'退出全屏 · F11':'全屏 · F11');b.setAttribute('title',on?'退出全屏 · F11':'全屏 · F11');b.setAttribute('aria-pressed',String(on));};
 $('bSettings').onclick=()=>{const panel=$('settingsPanel');panel.hidden=!panel.hidden;if(!panel.hidden){document.exitPointerLock?.();clearMovement();}};
 $('settingsClose').onclick=()=>{$('settingsPanel').hidden=true;};$('restoreUI').onclick=restore;
 const exit=async()=>{keyboard?.unlock?.();if(document.fullscreenElement)await document.exitFullscreen();sync();};
 $('fullscreenToggle').onclick=async()=>{try{if(document.fullscreenElement)await exit();else{await document.documentElement.requestFullscreen();let locked=false;try{if(keyboard?.lock){await keyboard.lock(['Escape']);locked=true;}}catch{}toast(locked?'F11 或右上角 ⛶ 退出全屏；Esc 释放鼠标。':'F11 切换全屏；Esc 释放鼠标。此浏览器也可能用 Esc 退出网页全屏。',5);}}catch{toast('请按 F11 进入或退出浏览器全屏；笔记本可能需要 Fn + F11。',5);}sync();};
 document.addEventListener('fullscreenchange',()=>{sync();if(!document.fullscreenElement){keyboard?.unlock?.();restore();}});
 listen('keydown',e=>{if(e.key==='F11'&&document.fullscreenElement){e.preventDefault?.();exit();return;}if(e.key!=='Escape')return;e.preventDefault?.();restore();$('settingsPanel').hidden=true;$('actionMenu').hidden=true;document.exitPointerLock?.();clearMovement();});sync();
}
