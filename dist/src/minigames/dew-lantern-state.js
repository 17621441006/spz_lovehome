// One versioned record owns progress and the unique reward. Claiming replaces
// that record once; it never increments the main forest acorn collection.
export const DEW_SAVE_KEY='zzb.dewLantern.v1';
export const DEW_COOLDOWN_MS=45000;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,max=1e6)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const fresh=()=>({v:1,reward:{owned:false,equipped:false},completions:0,lastCompletedAt:0,cooldownUntil:0,lastClaimedRun:null,run:null});
export function parseDewSave(raw,routeKey,now=Date.now()){
 let v;try{v=typeof raw==='string'?JSON.parse(raw):raw;}catch{return fresh();}
 if(!object(v)||v.v!==1)return fresh();
 const out=fresh();out.reward.owned=v.reward?.owned===true;out.reward.equipped=out.reward.owned&&v.reward?.equipped===true;
 out.completions=integer(v.completions)?v.completions:0;
 out.lastCompletedAt=Number.isFinite(v.lastCompletedAt)&&v.lastCompletedAt>=0?v.lastCompletedAt:0;
 out.cooldownUntil=Number.isFinite(v.cooldownUntil)?Math.max(0,Math.min(v.cooldownUntil,now+DEW_COOLDOWN_MS)):0;
 out.lastClaimedRun=typeof v.lastClaimedRun==='string'&&v.lastClaimedRun.length<=80?v.lastClaimedRun:null;
 const r=v.run;
 if(object(r)&&typeof r.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(r.id)&&r.routeKey===routeKey&&integer(r.next,5)&&['collecting','paused','return'].includes(r.status)&&Number.isFinite(r.startedAt)&&r.startedAt>=0&&(out.completions===0||r.startedAt>out.lastCompletedAt)&&Number.isFinite(r.elapsed)&&r.elapsed>=0&&r.elapsed<1e8&&r.id!==out.lastClaimedRun){
  out.run={id:r.id,routeKey,next:r.next,status:r.next===5?'return':r.status==='return'?'paused':r.status,startedAt:r.startedAt,elapsed:r.elapsed,reason:typeof r.reason==='string'?r.reason.slice(0,32):''};
 }
 return out;
}
function browserStorage(){try{return globalThis.localStorage||null;}catch{return null;}}
export class DewLanternState{
 constructor({routeKey,storage=browserStorage(),now=()=>Date.now(),makeId=()=>globalThis.crypto?.randomUUID?.()||`dew_${Date.now()}_${Math.random().toString(36).slice(2)}`,onStorageUnavailable}={}){
  this.routeKey=routeKey;this.storage=storage;this.now=now;this.makeId=makeId;this.onStorageUnavailable=onStorageUnavailable;this.persistent=!!storage;this.invited=false;this.claiming=false;
  this.data=this.read()||fresh();
  if(this.data.run?.status==='collecting'){this.data.run.status='paused';this.data.run.reason='reload';this.persist();}
 }
 read(){if(!this.storage)return null;try{const raw=this.storage.getItem(DEW_SAVE_KEY);return raw===null?null:parseDewSave(raw,this.routeKey,this.now());}catch{this.unavailable();return null;}}
 unavailable(){this.persistent=false;if(!this.storageNotice){this.storageNotice=true;this.onStorageUnavailable?.();}}
 persist({equipmentChanged=false,endingRunId=null}={}){
  if(!this.storage){this.unavailable();return false;}
  try{
   const latest=this.persistent?this.read():null;
   if(latest){
    // An older tab cancelling/collecting must never erase a permanent reward,
    // shorten cooldown, revive an already-claimed run, or cancel a newer run.
    const newer=latest.completions>this.data.completions||latest.lastCompletedAt>this.data.lastCompletedAt;
    if(latest.reward.owned){if(!this.data.reward.owned||!equipmentChanged)this.data.reward.equipped=latest.reward.equipped;this.data.reward.owned=true;}
    if(this.data.run&&(latest.lastClaimedRun===this.data.run.id||(latest.completions>0&&latest.lastCompletedAt>=this.data.run.startedAt)))this.data.run=latest.run;
    if(endingRunId&&latest.run&&latest.run.id!==endingRunId)this.data.run=latest.run;
    if(newer)this.data.lastClaimedRun=latest.lastClaimedRun;
    this.data.completions=Math.max(this.data.completions,latest.completions);this.data.lastCompletedAt=Math.max(this.data.lastCompletedAt,latest.lastCompletedAt);this.data.cooldownUntil=Math.max(this.data.cooldownUntil,latest.cooldownUntil);
   }
   this.storage.setItem(DEW_SAVE_KEY,JSON.stringify(this.data));return true;
  }catch{this.unavailable();return false;}
 }
 get active(){return !!this.data.run;}
 get phase(){return this.data.run?.status||'idle';}
 get progress(){return this.data.run?.next||0;}
 get cooldown(){return Math.max(0,this.data.cooldownUntil-this.now());}
 invite(){if(this.active||this.cooldown>0)return false;this.invited=true;return true;}
 decline(){this.invited=false;}
 accept(nearNpc){const latest=this.persistent?this.read():null;if(latest?.run||latest?.cooldownUntil>this.now()){this.data=latest;this.invited=false;return false;}if(!this.invited||!nearNpc||this.active||this.cooldown>0){this.invited=false;return false;}this.invited=false;this.data.run={id:this.makeId(),routeKey:this.routeKey,next:0,status:'collecting',startedAt:this.now(),elapsed:0,reason:''};this.persist();return true;}
 pause(reason='rest'){if(this.phase!=='collecting')return false;this.data.run.status='paused';this.data.run.reason=reason;this.persist();return true;}
 resume(nearNpc){if(!nearNpc||this.phase!=='paused')return false;this.data.run.status='collecting';this.data.run.reason='';this.persist();return true;}
 tick(dt){if(this.phase==='collecting'&&Number.isFinite(dt)&&dt>0)this.data.run.elapsed+=Math.min(dt,.1);}
 collect(index){if(this.phase!=='collecting'||index!==this.progress||index>=5)return false;this.data.run.next++;if(this.progress===5)this.data.run.status='return';this.persist();return true;}
 cancel(){if(!this.active)return false;const id=this.data.run.id;this.data.run=null;this.invited=false;this.data.cooldownUntil=Math.max(this.data.cooldownUntil,this.now()+2500);this.persist({endingRunId:id});return true;}
 claim(nearNpc){
  if(this.claiming||!nearNpc||this.phase!=='return'||this.progress!==5)return null;
  this.claiming=true;
  try{
   const run=this.data.run,latest=this.persistent?this.read():null;
   // A second instance/tab must not claim the same completed run again.
   if(latest&&(latest.lastClaimedRun===run.id||!latest.run||latest.run.id!==run.id)){this.data=latest;return null;}
   const first=!(this.data.reward.owned||latest?.reward.owned),count=Math.max(this.data.completions,latest?.completions||0)+1;
   this.data={...this.data,reward:{owned:true,equipped:first?true:this.data.reward.equipped},completions:Math.min(1e6,count),lastCompletedAt:this.now(),cooldownUntil:this.now()+DEW_COOLDOWN_MS,lastClaimedRun:run.id,run:null};
   this.persist();return {first,completions:this.data.completions,elapsed:run.elapsed,persistent:this.persistent};
  }finally{this.claiming=false;}
 }
 equip(value){if(!this.data.reward.owned)return false;this.data.reward.equipped=!!value;this.persist({equipmentChanged:true});return true;}
}
