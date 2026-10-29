import {lazyOutfit,OUTFITS} from './outfits.js';
import {loadModelCat} from './modelcat.js';
import {loadHumanCharacter} from './human-character.js';

export const CHARACTER_DEFS={
 xiaosi:{name:'小司',subtitle:'发间系着风，指尖藏着星光',image:'assets/characters/xiaosi-preview.png?v=20',walk:1.15*4/3,run:3*4/3,cameraHeight:.85,actions:[['mesh_kick','踢腿'],['mesh_dance','跳舞']]},
 xiaoyong:{name:'小涌',subtitle:'和风同行，随处发现',image:'assets/characters/xiaoyong-preview.png',walk:2.5,run:9.2*2/3,cameraHeight:.95,actions:[['stretch','伸懒腰'],['hug','抱抱']]},
 zangzangbao:{name:'脏脏包',subtitle:'一身红衣，慢慢巡山',image:'assets/characters/zangzangbao-front-v24.png',walk:1.65,run:3.8,cameraHeight:.75,actions:[['front_kick_01','前踢'],['front_kick_02','回旋踢']]},
};
export class CharacterRoster{
 constructor(scene,loader=null){this.scene=scene;this.loader=loader||(async(id)=>{const actor=lazyOutfit(await(id==='zangzangbao'?loadModelCat('assets/cat-rig.glb',1.25):loadHumanCharacter(id)),id);let saved;try{saved=JSON.parse(localStorage.getItem('zzb-outfits-v12')||'{}')[id];}catch{}if(saved&&saved===OUTFITS[id]?.id)await actor.ensureOutfit();return actor;});this.cache=new Map();this.pending=new Map();this.generation=0;this.id=null;this.active=null;}
 async ensure(id){
  if(!this.cache.has(id)){if(!this.pending.has(id))this.pending.set(id,this.loader(id).then(actor=>{this.cache.set(id,actor);this.pending.delete(id);return actor;},error=>{this.pending.delete(id);throw error;}));await this.pending.get(id);}
  const actor=this.cache.get(id);if(!actor.root.parent)this.scene.add(actor.root);return actor;
 }
 async select(id){
  if(!CHARACTER_DEFS[id])throw new Error('未知角色');const ticket=++this.generation;
  await this.ensure(id);
  if(ticket!==this.generation)return false;
  const next=this.cache.get(id);if(!next.root.parent)this.scene.add(next.root);this.active=next;
  this.id=id;this.active.oneShot=null;this.active.queuedAction=null;this.active.chainReady=null;this.active.cooldown=0;
  return true;
 }
}
