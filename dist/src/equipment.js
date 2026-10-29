import {OUTFITS} from './outfits.js';
import * as THREE from 'three';

// One renderer, two views: the paper wardrobe shows the actual active avatar.
// Restore the world transform immediately after drawing the portrait viewport.
export class EquipmentPanel {
 constructor({renderer,getActor,getCharacter,getAcorns=()=>({count:0,total:14}),onToggle}) {
  this.renderer=renderer;this.getActor=getActor;this.getCharacter=getCharacter;this.onToggle=onToggle;this.getAcorns=getAcorns;this.tab="all";this.selected="fan";
  this.el=document.getElementById('equipmentModal');this.stage=document.getElementById('equipmentStage');this.open=false;this.angle=.18;
  this.outfits={};try{this.outfits=JSON.parse(localStorage.getItem('zzb-outfits-v12')||'{}');}catch{}
  this.fan=false;this.expression='default';
  try{this.fan=localStorage.getItem('zzb-fan-equipped')==='true';localStorage.setItem('zzb-expression','default');}catch{}
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e9eddb');
  this.scene.add(new THREE.HemisphereLight('#fff5dc','#789571',2.2));
  const light=new THREE.DirectionalLight('#fff5e6',2.6);light.position.set(-2,4,4);this.scene.add(light);
  this.camera=new THREE.PerspectiveCamera(31,1,.01,20);
  document.getElementById('equipmentClose').onclick=()=>this.setOpen(false);
  document.getElementById('fanEquip').onclick=()=>{this.fan=!this.fan;this.apply();this.sync();this.save();};
  document.getElementById('outfitEquip').onclick=async()=>{const {id}=this.getCharacter(),def=OUTFITS[id],actor=this.getActor();if(!def)return;const button=document.getElementById('outfitEquip');if(actor.ensureOutfit&&!actor.outfitMeshes){button.disabled=true;button.textContent='加载衣装…';try{await actor.ensureOutfit();}catch(error){button.disabled=false;button.textContent='加载失败 · 点击重试';return;}if(actor!==this.getActor()){button.disabled=false;this.sync();return;}}this.outfits[id]=actor.outfit===def.id?'original':def.id;this.apply();this.sync();this.save();button.disabled=false;};
  document.getElementById('expressionChoice').onchange=e=>{this.expression=e.target.value;this.apply();this.save();};
  document.getElementById('portraitFull').onclick=()=>{this.jewelryFocus=null;this.sync();};
  document.getElementById('portraitLeft').onclick=()=>{this.angle-=Math.PI/4;};
  document.getElementById('portraitRight').onclick=()=>{this.angle+=Math.PI/4;};
  this.el.addEventListener('click',e=>{if(e.target===this.el)this.setOpen(false);});
  this.el.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();this.setOpen(false);}
   if(e.key==='Tab'){const a=[...this.el.querySelectorAll('button:not(:disabled),select:not(:disabled)')].filter(x=>!x.closest('[hidden]'));const first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  for(const b of this.el.querySelectorAll('[data-bag-tab]'))b.onclick=()=>{this.tab=b.dataset.bagTab;this.sync();};
  this.stage.addEventListener('pointerdown',e=>{this.dragX=e.clientX;this.stage.setPointerCapture(e.pointerId);});
  this.stage.addEventListener('pointermove',e=>{if(this.dragX===undefined)return;this.angle+=(e.clientX-this.dragX)*.012;this.dragX=e.clientX;});
  for(const ev of ['pointerup','pointercancel'])this.stage.addEventListener(ev,()=>this.dragX=undefined);
  this.apply();this.sync();
 }
 save(){try{localStorage.setItem('zzb-fan-equipped',String(this.fan));localStorage.setItem('zzb-expression',this.expression);localStorage.setItem('zzb-outfits-v12',JSON.stringify(this.outfits));}catch{}}
 apply(){const actor=this.getActor();actor.setFanEquipped?.(this.fan);actor.setExpression?.(this.expression);actor.setOutfit?.(this.outfits[this.getCharacter().id]||'original');}
 sync(){
  const {id,name}=this.getCharacter(),isCat=id==='zangzangbao';
  document.getElementById('portraitFull').hidden=!this.jewelryFocus;
  document.getElementById('equipmentName').textContent=name;
  document.getElementById('fanEquip').disabled=!isCat;
  document.getElementById('fanEquip').textContent=isCat?(this.fan?'卸下折扇':'装备折扇'):'脏脏包的折扇';
  document.getElementById('fanEquip').setAttribute('aria-pressed',String(isCat&&this.fan));
  document.getElementById('fanSlot').classList.toggle('equipped',isCat&&this.fan);
  document.getElementById('equipmentStatus').textContent=isCat?(this.fan?'已装备 · 站定摇扇，跑动收拢':'已收纳 · 轻装出发'):'换成脏脏包，即可使用它的折扇';
  document.getElementById('expressionField').hidden=!isCat;
  document.getElementById('expressionChoice').value=this.expression;
  const collected=this.getAcorns();
  document.getElementById('bagCount').textContent=`橡果 ${collected.count} / ${collected.total}`;
  document.getElementById('heldSlot').innerHTML=this.fan&&isCat?document.querySelector('.fan-icon').outerHTML+'<small>已装备</small>':'<span class="empty-hand">手持空位</span>';
  for(const b of this.el.querySelectorAll('[data-bag-tab]')){b.classList.toggle('active',b.dataset.bagTab===this.tab);b.setAttribute('aria-pressed',String(b.dataset.bagTab===this.tab));}
  const items=[];if(id==='xiaosi'&&this.tab!=='collection')items.push({id:'diamond',icon:'💍',name:'璀璨钻戒',count:1},{id:'necklace',icon:'✧',name:'金叶项链',count:1});const outfit=OUTFITS[id];if(outfit&&this.tab!=='collection')items.push({id:'outfit',icon:'👘',name:outfit.name,count:1});if(this.tab!=='collection')items.push({id:'fan',icon:'🪭',name:'清风折扇',count:1});if(this.tab!=='equipment'&&collected.count>0)items.push({id:'acorn',icon:'🌰',name:'橡果',count:collected.count});
  if(!items.some(i=>i.id===this.selected))this.selected=items[0]?.id||null;
  const grid=document.getElementById('bagGrid');grid.replaceChildren();
  for(let i=0;i<12;i++){const item=items[i],b=document.createElement(item?'button':'div');b.className='bag-cell'+(item?.id===this.selected?' selected':'');if(item){b.setAttribute('aria-label',`${item.name}，${item.count}个`);b.innerHTML=`<span>${item.id==='fan'?document.querySelector('.fan-icon').outerHTML:item.icon}</span><small>${(item.id==='fan'&&isCat&&this.fan)||(item.id==='outfit'&&this.getActor().outfit===outfit?.id)||['diamond','necklace'].includes(item.id)?'✓':item.count}</small>`;b.onclick=()=>{this.selected=item.id;this.jewelryFocus=['diamond','necklace'].includes(item.id)?item.id:null;this.sync();};}else b.setAttribute('aria-hidden','true');grid.appendChild(b);}
  document.getElementById('jewelrySlot').innerHTML=id==='xiaosi'?'首饰<br>💍<small>钻戒 · 金项链</small>':'挂饰<br>〰';
  const fanSelected=this.selected==='fan';document.getElementById('itemName').textContent=fanSelected?'清风折扇':this.selected==='acorn'?'林间橡果':'行囊里还没有收集物';
  document.getElementById('itemDescription').textContent=fanSelected?'站定轻摇，跑动收拢。':this.selected==='acorn'?`已找到 ${collected.count} 颗，集齐 ${collected.total} 颗会发生森林魔法。`:'沿着林间小路，去找一颗橡果吧。';
  document.getElementById('fanEquip').hidden=!fanSelected;document.getElementById('fanSlot').hidden=!fanSelected;
  document.getElementById('equipmentStatus').hidden=!fanSelected;
  const outfitSelected=this.selected==='outfit'&&outfit,equipped=outfit&&this.getActor().outfit===outfit.id;
  document.getElementById('outfitEquip').hidden=!outfitSelected;
  document.getElementById('outfitEquip').textContent=equipped?'换回原装':'穿上'+(outfit?.name||'');
  document.getElementById('outfitEquip').setAttribute('aria-pressed',String(!!equipped));
  document.getElementById('outfitSlot').innerHTML='衣装<br>👘<small>'+(equipped?outfit.name:'原装')+'</small>';
  if(this.selected==='diamond'){document.getElementById('itemName').textContent='璀璨钻戒 · 已佩戴';document.getElementById('itemDescription').textContent='椭圆主钻，细碎铺镶。指尖的星光，会在散步时轻轻闪亮。左侧可近看钻戒。';}
  if(this.selected==='necklace'){document.getElementById('itemName').textContent='金叶项链 · 已佩戴';document.getElementById('itemDescription').textContent='一片金色的小叶子，陪你走进森林。左侧可近看项链。';}
  if(outfitSelected){document.getElementById('itemName').textContent=outfit.name;document.getElementById('itemDescription').textContent=outfit.description+(equipped?' 当前已穿上。':' 点击穿上，左侧可旋转查看。');}


 }
 setOpen(value){
  if(value===this.open)return;this.open=value;this.el.hidden=!value;document.body.classList.toggle('equipment-open',value);
  document.getElementById('bEquipment').setAttribute('aria-expanded',String(value));
  this.onToggle(value);
  if(value){this.jewelryFocus=null;if(document.pointerLockElement)document.exitPointerLock();this.apply();this.sync();document.getElementById('equipmentClose').focus();}else document.getElementById('bEquipment').focus();
 }
 render(){
  if(!this.open)return;
  if(!this.previewRenderer){try{this.previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.previewRenderer.outputColorSpace=THREE.SRGBColorSpace;this.stage.appendChild(this.previewRenderer.domElement);}catch{this.stage.textContent='人物预览暂不可用，请关闭后重试';return;}}
  const renderer=this.previewRenderer,actor=this.getActor(),root=actor.root,r=this.stage.getBoundingClientRect();if(r.width<1||r.height<1)return;
  const parent=root.parent,p=root.position.clone(),q=root.quaternion.clone(),s=root.scale.clone(),mq=actor.model?.quaternion.clone();
  const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),auto=renderer.autoClear;
  try{
   this.scene.add(root);root.position.set(0,0,0);root.rotation.set(0,this.angle,0);if(actor.model)actor.model.rotation.y=0;root.updateMatrixWorld(true);
   this.camera.aspect=r.width/r.height;this.camera.position.set(0,.84,3.15);this.camera.lookAt(0,.73,0);
   if(actor.id==='xiaosi'&&this.jewelryFocus==='diamond'){const focus=actor.appearance.stone.getWorldPosition(new THREE.Vector3());this.camera.position.copy(focus).add(new THREE.Vector3(0,.025,.29));this.camera.lookAt(focus);}
   if(actor.id==='xiaosi'&&this.jewelryFocus==='necklace'){const focus=actor.bones.Chest.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.075,.04));this.camera.position.copy(focus).add(new THREE.Vector3(0,.035,.70));this.camera.lookAt(focus);}
   this.camera.updateProjectionMatrix();
   renderer.setSize(r.width,r.height,false);renderer.setViewport(0,0,r.width,r.height);renderer.setScissorTest(false);renderer.autoClear=true;renderer.render(this.scene,this.camera);
  }finally{
   parent.add(root);root.position.copy(p);root.quaternion.copy(q);root.scale.copy(s);if(mq)actor.model.quaternion.copy(mq);root.updateMatrixWorld(true);
   renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=auto;
  }
 }
}
