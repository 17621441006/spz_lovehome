import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {DewLanternState,DEW_SAVE_KEY,DEW_COOLDOWN_MS,parseDewSave} from '../dist/src/minigames/dew-lantern-state.js';
import {DewLanternGame} from '../dist/src/minigames/dew-lantern.js';

function memory(){const data=new Map();return {writes:0,getItem:k=>data.get(k)??null,setItem(k,v){this.writes++;data.set(k,v);}};}
let now=100000,id=0;const save=memory(),options={routeKey:'five-safe-nodes',storage:save,now:()=>now,makeId:()=>`run_${++id}`};
const state=new DewLanternState(options);
assert(!state.accept(true),'Cannot start without an explicit invitation');
assert(state.invite());state.decline();assert(!state.accept(true));
assert(state.invite());assert(!state.accept(false),'Accept away from NPC is rejected');
assert(state.invite());assert(state.accept(true));assert(!state.collect(1),'Cannot skip first dew');
assert(state.collect(0));assert(!state.collect(0),'Cannot collect one node twice');
state.pause('away');assert(!state.collect(1));assert(!state.resume(false));
const restored=new DewLanternState(options);assert.equal(restored.phase,'paused');assert.equal(restored.progress,1);assert(restored.resume(true));
for(let i=1;i<5;i++)assert(restored.collect(i));assert.equal(restored.phase,'return');assert(!restored.data.reward.owned,'Finding dew does not grant reward');assert.equal(restored.claim(false),null);
const otherTab=new DewLanternState(options),beforeWrites=save.writes;
const reward=restored.claim(true);assert(reward.first);assert.equal(save.writes-beforeWrites,1,'Claim is one atomic record replacement');assert.equal(restored.data.completions,1);
assert.equal(restored.claim(true),null);assert.equal(otherTab.claim(true),null);assert.equal(otherTab.data.completions,1,'Stale instance must not award again');
assert(!restored.invite(),'Replay cooldown applies');now+=DEW_COOLDOWN_MS+1;assert(restored.invite());assert(restored.accept(true));for(let i=0;i<5;i++)restored.collect(i);assert.equal(restored.claim(true).first,false);assert.equal(restored.data.completions,2);
assert(restored.equip(false));const reloadReward=new DewLanternState(options);assert(reloadReward.data.reward.owned);assert(!reloadReward.data.reward.equipped);assert.equal(reloadReward.data.completions,2);
const wrongRoute=new DewLanternState({...options,routeKey:'changed-layout'});assert(wrongRoute.data.reward.owned,'Layout changes retain unique reward');assert(!wrongRoute.active);
const concurrentSave=memory(),concurrentOptions={...options,storage:concurrentSave};
const winner=new DewLanternState(concurrentOptions);winner.invite();winner.accept(true);winner.collect(0);
const staleCancel=new DewLanternState(concurrentOptions),staleCollect=new DewLanternState(concurrentOptions),staleEnding=new DewLanternState(concurrentOptions);winner.resume(true);for(let i=1;i<5;i++)winner.collect(i);winner.claim(true);
staleCancel.cancel();assert(new DewLanternState(concurrentOptions).data.reward.owned,'Stale cancel must retain permanent reward');
staleCollect.resume(true);staleCollect.collect(1);const protectedSave=new DewLanternState(concurrentOptions);assert(protectedSave.data.reward.owned);assert.equal(protectedSave.data.completions,1);assert(!protectedSave.active,'Stale collecting cannot revive a claimed run');
now+=DEW_COOLDOWN_MS+1;protectedSave.invite();assert(protectedSave.accept(true));const newerId=protectedSave.data.run.id;staleEnding.cancel();assert.equal(new DewLanternState(concurrentOptions).data.run.id,newerId,'Stale cancel cannot discard a newer run');
for(const bad of ['{','null','[]','{"v":99,"reward":{"owned":true}}','{"v":1,"run":{"next":999}}'])assert.equal(parseDewSave(bad,'route',now).run,null);
const poisoned=parseDewSave('{"v":1,"__proto__":{"polluted":true},"reward":{"owned":"yes"},"completions":-9,"cooldownUntil":1e100}','route',now);assert(!poisoned.reward.owned);assert.equal(poisoned.completions,0);assert(poisoned.cooldownUntil<=now+DEW_COOLDOWN_MS);assert.equal({}.polluted,undefined);
let storageNotice=0;const unavailable=new DewLanternState({...options,storage:{getItem(){throw Error('disabled');},setItem(){throw Error('quota');}},onStorageUnavailable:()=>storageNotice++});unavailable.invite();unavailable.accept(true);for(let i=0;i<5;i++)unavailable.collect(i);assert(unavailable.claim(true).first);assert(unavailable.data.reward.owned);assert(!unavailable.persistent);assert.equal(storageNotice,1);

// Small DOM supports the actual HUD; the dialog is controlled explicitly so
// consent, interruption and modal ordering are tested without timing a typewriter.
const makeCanvas=globalThis.document.createElement.bind(globalThis.document);
function documentStub(){
 const elements=[];
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.isConnected=true;elements.push(this);}setAttribute(){}appendChild(el){this.children.push(el);el.parent=this;return el;}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}focus(){doc.activeElement=this;}set innerHTML(_){this.children=['p','small','button'].map(tag=>new Element(tag));}querySelector(tag){return this.children.find(e=>e.tagName===tag);}}
 const doc={createElement:tag=>tag==='canvas'?makeCanvas('canvas'):new Element(tag),getElementById:id=>elements.find(e=>e.id===id),exitPointerLock(){},activeElement:null};doc.head=new Element('head');doc.body=new Element('body');return doc;
}
function fixture(storage=memory()){
 const scene=new THREE.Scene(),player=new THREE.Vector3(),home=new THREE.Vector3(),group=new THREE.Group();scene.add(group);
 const nodes=[[2,0,0],[4,0,0],[4,0,2],[2,0,3],[0,0,3]].map(p=>new THREE.Vector3(...p));
 const npc={group,position:group.position,home,inviteRange:2.5,settled:0,released:0,setLanternProgress(n){this.light=n;},settle(){this.settled++;},release(){this.released++;}};
 const answers=[],dialogs=[],busy=[],toasts=[],doc=documentStub();let deferred=null;
 const game=new DewLanternGame({scene,npc,nodes,home,getPlayerPosition:()=>player,storage,now:()=>now,document:doc,onBusyChange:v=>busy.push(v),onToast:v=>toasts.push(v),dialog:args=>{dialogs.push(args);return deferred?new Promise(r=>{deferred.resolve=r;}):Promise.resolve(answers.shift()??null);}});
 const step=(target,enabled=true)=>{const d=target.clone().sub(player),n=Math.ceil(d.length()/.08);for(let i=0;i<n;i++){player.addScaledVector(d,1/n);game.update(1/60,player,{enabled});}for(let i=0;i<18;i++)game.update(1/60,player,{enabled});};
 return {game,scene,player,home,nodes,npc,answers,dialogs,busy,toasts,doc,storage,step,defer(){deferred={};return deferred;},undefer(){deferred=null;}};
}
const f=fixture();f.answers.push(null);await f.game.interact();assert(!f.game.active);assert(!f.npc.settled);
const occupied=fixture();occupied.npc.position.copy(occupied.nodes[0]);occupied.player.set(1,0,0);let leadTarget=null;occupied.npc.leadTo=points=>{leadTarget=points[0].clone();return true;};occupied.answers.push('start');await occupied.game.interact();assert(leadTarget.equals(occupied.home),'NPC occupying a dew must return home before settling');assert.equal(occupied.npc.settled,0);occupied.game.dispose();
const held=f.defer(),inviting=f.game.interact();assert(f.game.modal);assert(!f.game.active);f.game.update(.1,f.player,{enabled:false});held.resolve('start');await inviting;f.undefer();assert(f.game.active);assert.equal(f.game.state.phase,'collecting');assert(!f.game.modal);assert.equal(f.npc.settled,1);assert.deepEqual(f.busy,[true,false,true,false]);
f.step(f.nodes[4]);assert.equal(f.game.state.progress,0,'A later visible location cannot collect out of sequence');f.step(f.home);
for(let i=0;i<5;i++){f.step(f.nodes[i]);assert.equal(f.game.state.progress,i+1);}
assert.equal(f.game.state.phase,'return');assert(!f.game.state.data.reward.owned);assert.equal(f.npc.light,1);
f.answers.push('claim');assert(!await f.game.interact(),'Reward requires talking close to the NPC');f.answers.pop();f.step(f.home);f.answers.push('claim');await f.game.interact();assert(f.game.state.data.reward.owned);assert(!f.game.active);assert.equal(f.game.state.data.completions,1);f.game.update(.016);assert(f.game.rewardGlow.visible);
f.game.update(.016,f.player,{enabled:false,visible:false});assert(f.game.hud.hidden);assert(!f.game.rewardGlow.visible);f.game.update(.016,f.player,{visible:true});assert(f.game.rewardGlow.visible);
f.answers.push('token','toggle');await f.game.interact();f.game.update(.016);assert(!f.game.state.data.reward.equipped);assert(!f.game.rewardGlow.visible);assert(f.dialogs.at(-1).lines.some(x=>x.includes('露光信物')));
const g=fixture(f.storage);assert(g.game.state.data.reward.owned);assert(!g.game.state.data.reward.equipped);assert.equal(g.npc.light,.45,'Owned reward gently lights NPC immediately after reload');g.game.dispose();

now+=DEW_COOLDOWN_MS+1;const interrupted=fixture();interrupted.answers.push('start');await interrupted.game.interact();interrupted.step(interrupted.nodes[0]);assert.equal(interrupted.game.state.progress,1);
interrupted.player.set(20,0,0);interrupted.game.update(.016);assert.equal(interrupted.game.state.phase,'paused');assert.equal(interrupted.game.state.progress,1);interrupted.player.copy(interrupted.home);interrupted.game.update(.016);assert.equal(interrupted.game.state.phase,'paused','Returning never auto-starts');
interrupted.answers.push('resume');await interrupted.game.interact();interrupted.player.copy(interrupted.nodes[1]);interrupted.game.update(.016);assert.equal(interrupted.game.state.phase,'paused','Teleport cannot collect or farm progress');assert.equal(interrupted.game.state.progress,1);
interrupted.player.copy(interrupted.home);interrupted.answers.push('resume');await interrupted.game.interact();interrupted.game.update(.016,interrupted.player,{enabled:false,visible:false});assert.equal(interrupted.game.state.phase,'paused');assert(interrupted.game.hud.hidden);
interrupted.answers.push('cancel');assert(interrupted.game.handleEscape());await new Promise(r=>setTimeout(r,0));assert(!interrupted.game.active);assert(!interrupted.game.state.data.reward.owned);assert(!interrupted.game.handleEscape());
interrupted.game.dispose();f.game.dispose();assert(!f.scene.getObjectByName('灯尾茸 · 当前露珠'));assert(!f.scene.getObjectByName('露光信物 · 随身柔光'));
console.log(JSON.stringify({consent:'PASS',orderedDewAndReturnConversation:'PASS',leaveAndResume:'PASS',teleportAndInterrupt:'PASS',uniqueAtomicReward:'PASS',reloadAndCooldown:'PASS',storageUnavailable:'PASS',hudAndRewardVisibility:'PASS',noMainAcornMutation:'Dedicated save key only',storageKey:DEW_SAVE_KEY},null,2));
