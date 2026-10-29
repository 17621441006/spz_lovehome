// Pure view and browser fullscreen are separate, and both retain an exit route.
export function setupDisplayControls({document,listen,clearMovement,toast}){
 const $=id=>document.getElementById(id),restore=()=>document.body.classList.remove('hidden-ui');
 const sync=()=>{$('fullscreenToggle').textContent=document.fullscreenElement?'退出全屏':'进入全屏';$('fullscreenToggle').setAttribute('aria-pressed',String(!!document.fullscreenElement));};
 $('bSettings').onclick=()=>{const panel=$('settingsPanel');panel.hidden=!panel.hidden;if(!panel.hidden){document.exitPointerLock?.();clearMovement();}};
 $('settingsClose').onclick=()=>{$('settingsPanel').hidden=true;};$('restoreUI').onclick=restore;
 $('fullscreenToggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error('unsupported');$('settingsPanel').hidden=true;}catch{toast('当前窗口不支持全屏，可在独立浏览器窗口打开游戏后按 F11。',5);}sync();};
 document.addEventListener('fullscreenchange',()=>{sync();if(!document.fullscreenElement)restore();});
 listen('keydown',e=>{if(e.key!=='Escape')return;restore();$('settingsPanel').hidden=true;$('actionMenu').hidden=true;document.exitPointerLock?.();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});});sync();
}
