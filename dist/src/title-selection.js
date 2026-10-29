export function setupTitleSelection({document,selectCharacter,startGame,isReady}){
 const svg=document.getElementById('coverCharacters');const fit=()=>svg.setAttribute('preserveAspectRatio',globalThis.matchMedia?.('(max-aspect-ratio:4/5)').matches?'xMidYMid meet':'xMidYMid slice');fit();globalThis.addEventListener?.('resize',fit);
 const options=[...document.querySelectorAll('.cover-character')];let pending=false;
 const activate=async button=>{if(pending||!isReady())return;pending=true;document.getElementById('characterInvite').textContent='正在走进森林…';try{if(await selectCharacter(button.dataset.character)){startGame();document.getElementById('characterInvite').textContent='请选择你的角色';}else document.getElementById('characterInvite').textContent='角色还没准备好，请再点一次';}catch{document.getElementById('characterInvite').textContent='角色还没准备好，请再点一次';}finally{pending=false;}};
 for(const b of options){b.onclick=()=>activate(b);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(b);}};}
}
