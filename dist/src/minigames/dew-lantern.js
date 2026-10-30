import * as THREE from 'three';
import {showDialog} from './dialog.js';
import {DewLanternState} from './dew-lantern-state.js';

const STYLE=`#dewLanternHud{position:fixed;left:16px;bottom:18px;z-index:65;max-width:min(310px,calc(100vw - 32px));padding:12px 16px;border:1px solid #dce6c780;border-radius:17px;background:#f1f3e5e8;color:#395642;box-shadow:0 5px 20px #152d2520;font-family:inherit;font-size:14px;line-height:1.6;pointer-events:none}#dewLanternHud[hidden]{display:none}#dewLanternHud p{margin:0}#dewLanternHud small{display:block;color:#67775a}#dewLanternHud button{pointer-events:auto;margin-top:7px;border:0;border-radius:14px;background:#dce6c8;color:#395642;padding:7px 12px;font:inherit;cursor:pointer}#dewLanternHud button:disabled{opacity:.55;cursor:default}#dewLanternHud button:focus-visible{outline:2px solid #8eaa59;outline-offset:3px}@media(max-width:760px){#dewLanternHud{top:90px;bottom:auto;left:12px;width:220px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:9px 12px;font-size:12.5px;line-height:1.5}#dewLanternHud button{margin-top:5px;padding:6px 10px}body:has(#dewLanternHud:not([hidden])) #toast{top:auto;bottom:150px}}`;
const FACE='<img src="assets/creatures/dengweirong-portrait-v2.png" alt="灯尾茸" style="display:block;width:100%;aspect-ratio:1;object-fit:contain;object-position:center;border-radius:50%;background:radial-gradient(circle,#fff1df,#e4dce5);border:2px solid #eee2d9">';
const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);

/** active means a saved task, not a movement lock. Only modal belongs in busy().
 * main dispatches Escape to handleEscape() after closing its existing menus.
 */
export class DewLanternGame{
 constructor({scene,npc,nodes,home=npc?.home,getPlayerPosition,getRewardAnchor,sound,onToast=()=>{},onBusyChange=()=>{},canPlay=()=>true,isSafePoint=()=>true,storage,now,dialog=showDialog,document:doc=globalThis.document,areaRadius=10}={}){
  if(!scene||!npc||!finite(home)||!Array.isArray(nodes)||nodes.length!==5||nodes.some(p=>!finite(p)||!isSafePoint(p)))throw new Error('灯尾茸需要固定家园和五个安全草地节点');
  this.home=new THREE.Vector3().copy(home);this.nodes=nodes.map(p=>new THREE.Vector3().copy(p));
  if(this.nodes.some((p,i)=>p.distanceTo(this.home)>areaRadius-1||this.nodes.some((q,j)=>j<i&&p.distanceTo(q)<1.2)))throw new Error('露珠节点应在家园附近，并留出逐个寻找的距离');
  Object.assign(this,{scene,npc,getPlayerPosition,getRewardAnchor,sound,onToast,onBusyChange,canPlay,dialog,doc,areaRadius});
  this.modal=false;this.enabled=true;this.visible=true;this.time=0;this.previous=null;this.contact=0;this.disposed=false;
  const routeKey=this.nodes.map(p=>[p.x,p.y,p.z].map(n=>n.toFixed(2)).join(',')).join(';');
  this.state=new DewLanternState({routeKey,storage,now,onStorageUnavailable:()=>{this.storageWarning=true;}});
  this.makeVisuals();this.makeHud();this.refresh();
 }
 get active(){return this.state.active;}
 get hint(){return this.state.phase==='return'?'交还露珠，领取信物':this.state.phase==='paused'?'接着帮灯尾茸找露珠':'和灯尾茸说话';}
 nearNpc(player=this.getPlayerPosition?.()){if(this.npc.canInvite)return this.npc.canInvite(player);const p=this.npc.position||this.npc.group?.position;return finite(player)&&finite(p)&&Math.hypot(player.x-p.x,player.z-p.z)<(this.npc.inviteRange||2.5)&&Math.abs(player.y-p.y)<1.6;}
 canInteract(player=this.getPlayerPosition?.()){return !this.disposed&&!this.modal&&this.canPlay()&&this.nearNpc(player);}
 async ask(lines,choices){
  if(this.disposed)return null;this.modal=true;this.onBusyChange(true);const focus=this.doc?.activeElement;
  try{this.doc?.exitPointerLock?.();const choice=await this.dialog({speaker:'灯尾茸',color:'#90818c',face:FACE,lines,choices});return this.disposed?null:choice;}
  finally{this.modal=false;this.previous=null;this.contact=0;this.onBusyChange(false);if(focus?.isConnected)focus.focus?.({preventScroll:true});this.refresh();}
 }
 async interact(){
  if(!this.canInteract()||this.interacting)return false;this.interacting=true;
  try{
   const phase=this.state.phase;
   if(phase==='return'){
    const choice=await this.ask(['五滴露珠都找到了，尾灯暖起来啦。谢谢你慢慢陪我走这一段路。',this.state.data.reward.owned?'这次也记进我们的散步纪录里。露光信物只有一枚，会一直陪着你。':'我想送你一枚「露光信物」。戴上后，一点柔光会随你散步，也可以随时在我这里关闭。'],[{label:'交还露珠，收下心意',value:'claim',main:true},{label:'等一会儿再来',value:null}]);
    if(choice==='claim'&&this.nearNpc()){const result=this.state.claim(true);if(result){this.npc.release?.();this.sound?.chime?.(5);this.onToast(result.first?'获得露光信物 · 已佩戴，可在灯尾茸处关闭':'又陪灯尾茸散步了一次 · 纪录已更新');}}
   }else if(this.active){this.state.pause('talk');await this.pauseMenu();}
   else{
    const invited=this.state.invite(),choices=[];
    if(invited)choices.push({label:'好呀，一起找五滴露珠',value:'start',main:true});
    if(this.state.data.reward.owned)choices.push({label:'看看我的露光信物',value:'token'});
    choices.push({label:'先去散步',value:null});
    const lines=invited?['我的尾灯有点困了。愿意帮我找五滴露珠吗？它们就在旁边的小径上，一颗一颗亮给你看。','靠近亮着的露珠，稍停一下就能收集。没有倒计时；找齐后回到入口的低枝下，和我说话。离开会保留进度，Esc 可以稍歇或取消。']:[`尾灯还暖着呢，让我再歇 ${Math.ceil(this.state.cooldown/1000)} 秒。信物和散步纪录随时都能看。`];
    const choice=await this.ask(lines,choices);
    if(choice==='start'&&this.state.accept(this.nearNpc())){this.freezeNpc();if(this.state.phase==='collecting')this.onToast('沿着第一滴柔光慢慢走 · 找齐后回来交谈');}
    else{this.state.decline();if(choice==='token')await this.tokenMenu();}
   }
   if(this.storageWarning){this.storageWarning=false;this.onToast('这次无法保存到浏览器，进度和信物仍可在当前游戏中使用。');}
   return true;
  }finally{this.interacting=false;this.refresh();}
 }
 async tokenMenu(){
  const equipped=this.state.data.reward.equipped;
  const choice=await this.ask([`露光信物 · 已陪灯尾茸散步 ${this.state.data.completions} 次。`,equipped?'小小的柔光正随你散步。想安静一点时，可以把它收起来。':'信物好好收着。想让一点柔光陪你走路，可以再戴上。'],[{label:equipped?'收起柔光':'佩戴露光信物',value:'toggle',main:true},{label:'保持这样',value:null}]);
  if(choice==='toggle'){this.state.equip(!equipped);this.onToast(equipped?'露光已收起':'露光信物已佩戴');}
 }
 async pauseMenu(){
  const near=this.nearNpc(),choices=[];
  if(near&&this.state.phase==='paused')choices.push({label:'接着找露珠',value:'resume',main:true});
  choices.push({label:'稍后继续（保留进度）',value:null},{label:'取消本次寻找',value:'cancel'});
  if(this.state.data.reward.owned)choices.push({label:'看看露光信物',value:'token'});
  const choice=await this.ask([`已经找到 ${this.state.progress} / 5 滴露珠。${near?'慢慢来，露珠会等你。':'进度已经保留，回到灯尾茸身边就能继续。'}`,'取消本次会放下这次的露珠；已经获得的信物和纪录都会保留。'],choices);
  if(choice==='resume'&&this.state.resume(this.nearNpc()))this.freezeNpc();
  else if(choice==='cancel'){this.state.cancel();this.npc.release?.();this.onToast('已取消本次寻找 · 随时再来散步');}
  else if(choice==='token')await this.tokenMenu();
 }
 handleEscape(){
  if(this.disposed||this.modal||!this.active||this.interacting)return false;
  this.state.pause('rest');this.previous=null;this.contact=0;this.interacting=true;
  this.pauseMenu().catch(()=>this.onToast('进度已经保留，回到灯尾茸身边可继续。')).finally(()=>{this.interacting=false;this.refresh();});return true;
 }
 freezeNpc(){
  const player=this.getPlayerPosition?.(),at=this.npc.position||this.npc.group?.position;this.previous=finite(player)?new THREE.Vector3().copy(player):null;this.contact=0;
  if(this.npc.canopy){this.npc.settle?.({lookAt:player,duration:Infinity});return;}
  // It may have wandered onto a future dew before the invitation. Return to
  // its safe home instead of freezing its collider over a collectible.
  if(finite(at)&&this.nodes.some(p=>Math.hypot(at.x-p.x,at.z-p.z)<1.15)){
   if(this.npc.leadTo?.([this.home],{settleAtEnd:true}))return;
   this.state.pause('npc-path');this.npc.release?.();this.onToast('灯尾茸先挪到小径旁 · 稍后和它说话继续');return;
  }
  this.npc.settle?.({lookAt:player,duration:Infinity});
 }
 refresh(){
  this.npc.setLanternProgress?.(this.active?this.state.progress/5:(this.state.data.reward.owned ? .45 : 0));
  this.marker.visible=this.visible&&this.state.phase==='collecting';if(this.marker.visible)this.marker.position.copy(this.nodes[this.state.progress]);
  this.rewardGlow.visible=this.visible&&this.state.data.reward.owned&&this.state.data.reward.equipped;
  if(!this.hud)return;this.hud.hidden=!this.active||!this.visible;
  this.ui.title.textContent=this.state.phase==='return'?'露珠收齐了 · 回去交谈':`给尾灯添一点露光 · ${this.state.progress} / 5`;
  this.ui.tip.textContent=this.state.phase==='paused'?'已稍歇 · 回灯尾茸身边按 E 继续':this.state.phase==='return'?'回到灯尾茸身边，按 E 领取心意':'走近亮着的露珠，稍停一下 · Esc 稍歇';
  this.ui.button.textContent=this.state.phase==='collecting'?'稍歇 / 取消':this.state.phase==='return'?'交还露珠':'继续（回灯尾茸处）';
  this.ui.button.disabled=this.state.phase!=='collecting'&&!this.nearNpc();
 }
 update(dt,player=this.getPlayerPosition?.(),{enabled=true,visible=true}={}){
  if(this.disposed||!finite(player))return;dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;this.time+=dt;this.enabled=enabled;this.visible=visible;
  if(this.hud)this.hud.hidden=!this.active||!visible;this.marker.visible=visible&&this.state.phase==='collecting';
  this.rewardGlow.visible=visible&&this.state.data.reward.owned&&this.state.data.reward.equipped;
  const anchor=this.getRewardAnchor?.()||player;this.rewardGlow.position.set(anchor.x+.28*Math.cos(this.time*.45),anchor.y+(this.getRewardAnchor?0:1.02)+Math.sin(this.time*.8)*.025,anchor.z+.24*Math.sin(this.time*.45));
  this.drop.position.y=.38+Math.sin(this.time*1.7)*.035;
  if(this.modal)return;
  if(this.state.phase==='collecting'){
   const far=Math.hypot(player.x-this.home.x,player.z-this.home.z)>this.areaRadius;
   const jumped=this.previous&&this.previous.distanceTo(player)>dt*10+.20;
   if(!enabled||far||jumped){this.state.pause(jumped?'discontinuity':far?'away':'interrupted');this.previous=null;this.contact=0;this.onToast('露珠进度已保留 · 回灯尾茸身边可继续');this.refresh();return;}
   this.state.tick(dt);
   if(this.previous&&dt>0){const node=this.nodes[this.state.progress],near=Math.hypot(player.x-node.x,player.z-node.z)<.58&&Math.abs(player.y-node.y)<.55;this.contact=near?this.contact+dt:0;
    if(this.contact>=.22){const index=this.state.progress;if(this.state.collect(index)){this.sound?.chime?.(index+1);this.contact=0;this.refresh();if(this.state.phase==='return')this.onToast('五滴露珠找齐了 · 回灯尾茸身边交谈吧');}}
   }
   this.previous=(this.previous||new THREE.Vector3()).copy(player);
  }else this.previous=null;
  if(this.ui)this.ui.button.disabled=this.state.phase!=='collecting'&&!this.nearNpc(player);
 }
 makeVisuals(){
  const canvas=this.doc?.createElement?.('canvas');let map=null;
  if(canvas){canvas.width=canvas.height=64;const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(239,250,192,.95)');g.addColorStop(.24,'rgba(211,238,164,.55)');g.addColorStop(1,'rgba(211,238,164,0)');c.fillStyle=g;c.fillRect(0,0,64,64);map=new THREE.CanvasTexture(canvas);}
  this.glowMap=map;this.glowMaterial=new THREE.SpriteMaterial({map,color:'#e5f0bd',transparent:true,opacity:.72,depthWrite:false});
  this.marker=new THREE.Group();this.marker.name='灯尾茸 · 当前露珠';
  this.drop=new THREE.Mesh(new THREE.SphereGeometry(.085,12,10),new THREE.MeshBasicMaterial({color:'#d6eed6',transparent:true,opacity:.9}));this.drop.scale.y=1.4;this.marker.add(this.drop);
  const glow=new THREE.Sprite(this.glowMaterial);glow.scale.setScalar(.65);glow.position.y=.36;this.marker.add(glow);
  this.ring=new THREE.Mesh(new THREE.RingGeometry(.22,.26,32),new THREE.MeshBasicMaterial({color:'#dcebb1',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.035;this.marker.add(this.ring);this.scene.add(this.marker);
  this.rewardGlow=new THREE.Sprite(this.glowMaterial);this.rewardGlow.name='露光信物 · 随身柔光';this.rewardGlow.scale.setScalar(.23);this.rewardGlow.visible=false;this.scene.add(this.rewardGlow);
 }
 makeHud(){
  if(!this.doc?.body)return;if(!this.doc.getElementById('dewLanternStyle')){const st=this.doc.createElement('style');st.id='dewLanternStyle';st.textContent=STYLE;this.doc.head.appendChild(st);}
  this.hud=this.doc.createElement('aside');this.hud.id='dewLanternHud';this.hud.setAttribute('aria-label','灯尾茸的露珠');
  this.hud.innerHTML='<p aria-live="polite"></p><small></small><button type="button">稍歇 / 取消</button>';this.doc.body.appendChild(this.hud);
  this.ui={title:this.hud.querySelector('p'),tip:this.hud.querySelector('small'),button:this.hud.querySelector('button')};
  this.ui.button.onclick=()=>{if(this.state.phase==='collecting')this.handleEscape();else this.interact();};
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.state.pause('interrupted');this.state.decline();this.npc.release?.();this.marker.removeFromParent();this.rewardGlow.removeFromParent();this.drop.geometry.dispose();this.drop.material.dispose();this.ring.geometry.dispose();this.ring.material.dispose();this.glowMaterial.dispose();this.glowMap?.dispose();this.hud?.remove();this.onBusyChange(false);}
}
