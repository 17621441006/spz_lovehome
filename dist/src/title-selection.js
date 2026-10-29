export function setupTitleSelection({document,selectCharacter,startGame,isReady}){
 const svg=document.getElementById('coverCharacters');const fit=()=>svg.setAttribute('preserveAspectRatio',globalThis.matchMedia?.('(max-aspect-ratio:4/5)').matches?'xMidYMid meet':'xMidYMid slice');fit();globalThis.addEventListener?.('resize',fit);
 const options=[...document.querySelectorAll('.cover-character')];let pending=false,pointer=null,focused=null;
 const preview=()=>{const active=pointer||focused;svg.classList?.toggle('has-preview',!!active);for(const b of options)b.classList?.toggle('is-preview',b===active);};
 const busy=value=>{svg.setAttribute('aria-busy',String(value));for(const b of options)b.setAttribute?.('aria-disabled',String(value));};
 const activate=async button=>{if(pending||!isReady())return;pending=true;busy(true);document.getElementById('characterInvite').textContent='正在走进森林…';try{if(await selectCharacter(button.dataset.character)){startGame();document.getElementById('characterInvite').textContent='请选择你的角色';}else document.getElementById('characterInvite').textContent='角色还没准备好，请再点一次';}catch{document.getElementById('characterInvite').textContent='角色还没准备好，请再点一次';}finally{pending=false;busy(false);}};
 for(const b of options){
  b.onpointerenter=()=>{pointer=b;preview();};b.onpointerleave=()=>{if(pointer===b)pointer=null;preview();};
  b.onfocus=()=>{focused=b;preview();};b.onblur=()=>{if(focused===b)focused=null;preview();};
  b.onclick=()=>activate(b);b.onkeydown=e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();return activate(b);}
   const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];
   if(step||e.key==='Home'||e.key==='End'){e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?options.length-1:(options.indexOf(b)+step+options.length)%options.length;options[index].focus?.();}
  };
 }
}
