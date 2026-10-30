import * as THREE from 'three';
import {loadGLB} from './asset-stream.js';
import {heightAt,inLakeWater,edgeRadius,LAYOUT} from './terrain.js';
import {villageLaneDistance} from './village-routes.js';
import {inElderRiver} from './elder-tree.js';
import {colliders as worldColliders} from './world.js';
import {DengweirongCanopy} from './dengweirong-canopy.js';

export const DENGWEIRONG_ASSET='assets/creatures/dengweirong-v2.glb';
const clamp=THREE.MathUtils.clamp,TAU=Math.PI*2,V=()=>new THREE.Vector3();
const flatDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=p=>new THREE.Vector3(p.x,Number.isFinite(p.y)?p.y:0,p.z);
const playerPoint=p=>p?.position||p?.pos||p;

// The same swept footprint is used for home validation, wandering and explicit
// lead routes. No endpoint-only shortcuts through a tree, creek or bus lane.
export function createDengweirongNavigation(options={}){
 const ground=options.ground||heightAt,obstacles=options.colliders||worldColliders;
 const radius=options.radius??.43,lane=options.laneDistance||villageLaneDistance;
 const water=options.waterAt||((x,z)=>inLakeWater(x,z,-radius)||inElderRiver(x,z)||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+radius+.3);
 const edge=options.edgeRadius||edgeRadius,maxSlope=options.maxSlope??.38,laneClearance=options.laneClearance??3.8;
 const blocked=(x,z,y,ignore)=>obstacles.some(c=>{
  if(c===ignore||c.floorOnly||c.type==='heightfield'||!(c.top>y+.10)||(c.bottom!==undefined&&c.bottom>y+1.15))return false;
  if(c.type==='circle')return Math.hypot(x-c.x,z-c.z)<c.r+radius+.08;
  if(c.type==='annulus'){const d=Math.hypot(x-c.x,z-c.z);return d>c.inner-radius&&d<c.outer+radius;}
  return c.type==='box'&&x>c.minX-radius&&x<c.maxX+radius&&z>c.minZ-radius&&z<c.maxZ+radius;
 });
 function safePoint(p,ignore){
  if(!p||!Number.isFinite(p.x+p.z))return false;
  const {x,z}=p,y=ground(x,z);if(!Number.isFinite(y)||Math.hypot(x,z)>edge(x,z)-radius-.5||lane(x,z)<laneClearance+radius||water(x,z)||blocked(x,z,y,ignore))return false;
  for(let i=0;i<8;i++){const a=i*TAU/8,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius,h=ground(px,pz);if(!Number.isFinite(h)||water(px,pz)||Math.abs(h-y)>radius*maxSlope)return false;}
  return true;
 }
 function safeSegment(a,b,ignore){const distance=flatDistance(a,b),steps=Math.max(1,Math.ceil(distance/.18));let previous=ground(a.x,a.z);
  for(let i=0;i<=steps;i++){const t=i/steps,p={x:THREE.MathUtils.lerp(a.x,b.x,t),z:THREE.MathUtils.lerp(a.z,b.z,t)},y=ground(p.x,p.z);if(!safePoint(p,ignore)||(i&&Math.abs(y-previous)>distance/steps*maxSlope+.008))return false;previous=y;}return true;
 }
 return {ground,obstacles,radius,safePoint,safeSegment};
}

export async function loadDengweirong(scene,options){
 if(!options?.home)throw new Error('灯尾茸需要明确的 home 草地坐标');
 const navigation=createDengweirongNavigation(options.navigation),home=point(options.home);
 if(!navigation.safePoint(home))throw new Error('灯尾茸出生点被树木、水面、车道或坡度阻挡');
 const gltf=await loadGLB(options.asset||DENGWEIRONG_ASSET);
 const npc=new Dengweirong(gltf,{...options,navigation});scene.add(npc.group);return npc;
}

export class Dengweirong{
 constructor(gltf,options){
  this.navigation=options.navigation?.safePoint?options.navigation:createDengweirongNavigation(options.navigation);
  this.home=point(options.home);this.home.y=this.navigation.ground(this.home.x,this.home.z);
  this.roamCenter=point(options.roamCenter||options.home);this.roamRadius=clamp(options.roamRadius??3,1,4);
  this.waypoints=(options.waypoints||[]).map(point);this.inviteRange=2.35;this.radius=this.navigation.radius;
  this.group=new THREE.Group();this.group.name='灯尾茸 · 林间露珠伙伴';this.group.position.copy(this.home);this.position=this.group.position;this.root=this.group;
  this.model=gltf.scene;this.group.add(this.model);this.group.updateMatrixWorld(true);
  this.nodes={};for(const name of ['Body','Head','Ear_L','Ear_R','Tail','Lantern','Foot_FL','Foot_FR','Foot_BL','Foot_BR']){const node=this.model.getObjectByName('DWR_'+name);if(node)this.nodes[name]=node;}
  if(!this.nodes.Body||!this.nodes.Head||!this.nodes.Lantern)throw new Error('灯尾茸 GLB 缺少身体、头或尾灯命名节点');
  this.materials=[];this.lanternMaterials=[];this.blinkMeshes=[];this.pose=[];this.feet=[];
  this.model.traverse(o=>{
   if(o.isBone)this.pose.push({node:o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});
   if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;if(o.morphTargetDictionary?.Blink!==undefined)this.blinkMeshes.push({mesh:o,index:o.morphTargetDictionary.Blink});
   const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();this.materials.push(c);return c;});o.material=Array.isArray(o.material)?mats:mats[0];
  });
  const lampParts=['DWR_LanternMesh','DWR_LanternCore','DWR_LanternFilament'].map(name=>this.model.getObjectByName(name)).filter(Boolean);if(!lampParts.length)lampParts.push(this.nodes.Lantern);
  for(const part of lampParts)part.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])if(!this.lanternMaterials.some(x=>x.material===material))this.lanternMaterials.push({material,base:material.emissiveIntensity||.15});});
  this.motes=this.model.getObjectByName('DWR_Motes');
  this.bodyScale=this.nodes.Body.scale.clone();this.model.updateMatrixWorld(true);this.prepareFeet();
  this.mixer=new THREE.AnimationMixer(this.model);this.actions={};
  for(const source of gltf.animations||[]){const clip=source.clone(),start=Math.min(...clip.tracks.map(t=>t.times[0]));
   // Blender's frame-one export adds a held frame before every gait cycle.
   // Start at the first authored key so planted feet never pause and slide.
   if(start>0){for(const track of clip.tracks)track.shift(-start);clip.resetDuration();}
   const name=clip.name.toLowerCase().replace(/^dwr[_-]?/,'');this.actions[name]=this.mixer.clipAction(clip);
  }
  if(!this.actions.idle)throw new Error('灯尾茸 GLB 缺少 idle 动画');
  this.play('idle',0);this.mixer.update(0);
  this.state='rest';this.hint='';this.target=null;this.route=[];this.routeSettles=true;this.lookAt=null;this.settleUntil=0;this.nextDecision=2;
  this.time=0;this.lastGreet=-20;this.phase=0;this.speed=0;this.moving=false;this.farAnimationTime=0;this.lightProgress=0;this.lightTarget=0;
  this.random=options.random||Math.random;this.collider={type:'circle',x:this.position.x,z:this.position.z,r:options.collisionRadius??.28,top:this.position.y+.58,bottom:this.position.y,dynamic:true,noFloor:true,owner:'dengweirong'};
  this.navigation.obstacles.push(this.collider);this.lastWeather='sun';
  this.canopy=options.canopy?new DengweirongCanopy(this,options.canopy):null;
 }
 prepareFeet(){
  for(const [name,offset]of [['Foot_FL',0],['Foot_BR',0],['Foot_FR',.5],['Foot_BL',.5]]){
   const bone=this.nodes[name];if(!bone)continue;const candidates=[];
   this.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[si.getComponent(i,k)]===bone)w+=sw.getComponent(i,k);if(w>.65){const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);candidates.push({mesh,index:i,y:p.y});}}});
   candidates.sort((a,b)=>a.y-b.y);const samples=candidates.slice(0,12);if(samples.length)this.feet.push({bone,offset,samples,baseBottom:samples[0].y-this.position.y,contact:null,stance:false});
  }
 }
 play(name,fade=.32){const action=this.actions[name]||this.actions.idle;if(action===this.currentAction)return;action.reset().setEffectiveWeight(1).play();if(this.currentAction)this.currentAction.crossFadeTo(action,fade,false);this.currentAction=action;}
 canInvite(player){const p=playerPoint(player);return (!this.canopy||this.canopy.low)&&!!p&&flatDistance(this.position,p)<this.inviteRange&&Math.abs((p.y||0)-this.position.y)<1.6&&this.state!=='lead';}
 headAnchor(target=V()){this.nodes.Head.getWorldPosition(target);target.y+=.16;return target;}
 tailAnchor(target=V()){return this.nodes.Lantern.getWorldPosition(target);}
 setLanternProgress(value){this.lightTarget=clamp(Number.isFinite(value)?value:0,0,1);}
 leadTo(nodes,{settleAtEnd=true}={}){
  if(this.canopy){this.settle({duration:Infinity});return true;}
  const route=(Array.isArray(nodes)?nodes:[nodes]).filter(Boolean).map(point);if(!route.length)return false;let previous=this.position;
  for(const p of route){if(flatDistance(p,this.home)>12||!this.navigation.safeSegment(previous,p,this.collider))return false;p.y=this.navigation.ground(p.x,p.z);previous=p;}
  this.route=route;this.routeSettles=settleAtEnd;this.target=this.route.shift();this.state='lead';this.settleUntil=0;return true;
 }
 settle({lookAt=null,duration=Infinity}={}){this.canopy?.settle();this.target=null;this.route=[];this.lookAt=lookAt;this.settleUntil=duration===Infinity?Infinity:this.time+Math.max(0,duration);this.state='settled';this.speed=0;this.play('idle');}
 release(){this.canopy?.release();this.settleUntil=0;this.lookAt=null;this.route=[];this.target=null;this.state='rest';this.nextDecision=this.time+1.5;}
 chooseWander(){
  for(let attempt=0;attempt<16;attempt++){const supplied=this.waypoints.length&&this.random()<.6?this.waypoints[Math.floor(this.random()*this.waypoints.length)]:null,a=this.random()*TAU,r=Math.sqrt(this.random())*this.roamRadius,p=supplied?.clone()||new THREE.Vector3(this.roamCenter.x+Math.cos(a)*r,0,this.roamCenter.z+Math.sin(a)*r);
   if(flatDistance(p,this.roamCenter)>this.roamRadius||flatDistance(p,this.position)<.55||!this.navigation.safeSegment(this.position,p,this.collider))continue;this.target=p;this.state='wander';return;
  }this.state='rest';this.target=null;this.nextDecision=this.time+3;
 }
 turnToward(target,dt,rate=1.25){const desired=Math.atan2(target.x-this.position.x,target.z-this.position.z),delta=Math.atan2(Math.sin(desired-this.group.rotation.y),Math.cos(desired-this.group.rotation.y));this.group.rotation.y+=clamp(delta,-rate*dt,rate*dt);return Math.abs(delta);}
 move(dt,player,context){
  if(!this.target)return 0;const distance=flatDistance(this.position,this.target);if(distance<.09){this.target=null;if(this.state==='yield'){this.state=this.resumeState||'rest';this.target=this.resumeTarget||null;this.resumeState=null;this.resumeTarget=null;this.nextDecision=this.time+2;}else if(this.state==='lead'&&this.route.length)this.target=this.route.shift();else if(this.state==='lead'&&this.routeSettles)this.settle({duration:Infinity,lookAt:player});else{this.state=this.random()<.48?'sniff':'rest';this.nextDecision=this.time+3+this.random()*4;}return 0;}
  const angle=this.turnToward(this.target,dt),desiredSpeed=(this.state==='lead'?.40:this.state==='yield'?.34:.27)*(this.lastWeather==='rain'?.8:1),speed=angle>.8?0:desiredSpeed*clamp(1-angle/.9,.25,1),step=Math.min(distance,speed*dt);
  if(step<=0)return 0;const next=this.position.clone().lerp(this.target,step/distance),keep=this.radius+(context.playerRadius??.4)+.13;
  if(player&&flatDistance(next,player)<keep&&flatDistance(next,player)<flatDistance(this.position,player)-1e-6)return 0;
  if(!this.navigation.safeSegment(this.position,next,this.collider)){this.target=null;this.route=[];this.state='rest';this.nextDecision=this.time+2;return 0;}
  this.position.x=next.x;this.position.z=next.z;this.position.y=this.navigation.ground(next.x,next.z);return step;
 }
 yieldTo(player){
  const away=Math.atan2(this.position.x-player.x,this.position.z-player.z);for(const delta of [0,.65,-.65,1.2,-1.2]){const p=new THREE.Vector3(this.position.x+Math.sin(away+delta)*.65,0,this.position.z+Math.cos(away+delta)*.65);if(flatDistance(p,this.roamCenter)>this.roamRadius+.5||!this.navigation.safeSegment(this.position,p,this.collider))continue;this.resumeState=this.state;this.resumeTarget=this.target;this.target=p;this.state='yield';return;}
 }
 updateFeet(walking){
  if(!this.feet.length)return;this.group.updateMatrixWorld(true);const action=this.actions.walk,cycle=action?((action.time/action.getClip().duration)%1):0;
  const gestureWeight=Math.max(...['greet','sniff'].map(name=>this.actions[name]?.isRunning()?this.actions[name].getEffectiveWeight():0));
  for(const foot of this.feet){let bottom=V(),lowest=Infinity;for(const {mesh,index}of foot.samples){const p=mesh.getVertexPosition(index,V()).applyMatrix4(mesh.matrixWorld);if(p.y<lowest){lowest=p.y;bottom.copy(p);}}
   const phase=(cycle+foot.offset)%1,authoredLift=Math.max(0,lowest-this.position.y-foot.baseBottom),gestureLift=authoredLift*THREE.MathUtils.smoothstep(authoredLift,.005,.018),plannedStance=phase>=.45;
   // A greeting deliberately raises one paw. Preserve that authored lift while
   // the clip blends in/out; only its supporting feet are pinned to the ground.
   const lift=(!walking||gestureWeight>.02)?gestureLift:plannedStance?0:authoredLift,stance=lift<.004&&(!walking||plannedStance),ground=this.canopy?this.canopy.surface(bottom.x,bottom.z):this.navigation.ground(bottom.x,bottom.z),correction=clamp(ground+.006+lift-lowest,-.18,.18);
   const position=foot.bone.getWorldPosition(V());position.y+=correction;foot.bone.parent.worldToLocal(position);foot.bone.position.copy(position);foot.stance=stance;
  }this.group.updateMatrixWorld(true);
 }
 update(dt,time,player,context={}){
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.time=Number.isFinite(time)?time:this.time+dt;const p=playerPoint(player),distance=p?flatDistance(this.position,p):Infinity,weather=context.weather;this.lastWeather=typeof weather==='string'?weather:(weather?.type||(weather?.rain>.35?'rain':weather?.snow>.35?'snow':weather?.night>.45?'night':'sun'));
  const active=distance<38;this.group.visible=distance<78;if(this.motes)this.motes.visible=distance<12;
  if(this.state==='settled'&&this.time>=this.settleUntil)this.release();
  if(this.canopy){if(active)this.canopy.update(dt,p,{...context,weather:this.lastWeather});}
  else if(active&&!context.paused){
   if(p&&distance<this.radius+(context.playerRadius??.4)+.08&&this.state!=='yield'&&this.state!=='settled'&&this.state!=='lead')this.yieldTo(p);
   if(this.state==='yield'&&!this.target){this.state=this.resumeState||'rest';this.target=this.resumeTarget||null;this.resumeState=null;this.resumeTarget=null;}
   if(!context.busy&&this.state!=='settled'&&this.state!=='lead'&&this.state!=='yield'){
    if(p&&distance<2.7&&this.time-this.lastGreet>8){this.state='greet';this.target=null;this.lastGreet=this.time;this.nextDecision=this.time+2.5;}
    else if(!this.target&&this.time>=this.nextDecision){if(distance<2.5){this.state='rest';this.nextDecision=this.time+2;}else this.chooseWander();}
   }
   const step=(!context.busy||this.state==='lead'||this.state==='yield')?this.move(dt,p,context):0;this.speed=dt>0?step/dt:0;this.moving=step>1e-5;
   if(!this.target&&p&&distance<4)this.turnToward(playerPoint(this.lookAt)||p,dt,.75);
  }else{this.speed=0;this.moving=false;}
  this.collider.x=this.position.x;this.collider.z=this.position.z;this.collider.bottom=this.position.y;this.collider.top=this.position.y+.58;
  this.hint=!context.busy&&this.canInvite(p)?'E · 和灯尾茸打招呼':'';
  // Preserve the exact animated pose while a menu is open or the window loses
  // focus; grounding a suspended swing foot here would visibly pop it downward.
  if(context.paused||(this.canopy&&context.busy)){this.hint='';return;}
  if(!this.group.visible)return;
  this.farAnimationTime+=dt;const animate=distance<24||this.farAnimationTime>=.16;if(!animate)return;const elapsed=this.farAnimationTime;this.farAnimationTime=0;
  for(const rest of this.pose){rest.node.position.copy(rest.p);rest.node.quaternion.copy(rest.q);rest.node.scale.copy(rest.s);}
  this.play(this.moving?'walk':this.state==='sniff'?'sniff':this.state==='greet'?'greet':'idle');if(this.actions.walk)this.actions.walk.timeScale=clamp(this.speed/.35,.1,1.5);this.mixer.update(elapsed);
  // Three.js skips writing unchanged track values. Restore the previous authored
  // pose (not bind pose), then remember this frame before terrain corrections.
  for(const rest of this.pose){rest.p.copy(rest.node.position);rest.q.copy(rest.node.quaternion);rest.s.copy(rest.node.scale);}
  this.nodes.Body.scale.copy(this.bodyScale);
  const blinkPhase=(this.time+1.25)%5.4,blink=blinkPhase<.18?Math.sin(blinkPhase/.18*Math.PI)**2:0;for(const {mesh,index}of this.blinkMeshes)mesh.morphTargetInfluences[index]=blink;
  this.lightProgress+=(this.lightTarget-this.lightProgress)*(1-Math.exp(-2.5*elapsed));for(const {material,base}of this.lanternMaterials){if(material.emissive&&material.emissive.getHex()===0)material.emissive.set('#ffd58c');material.emissiveIntensity=base*(.28+.72*this.lightProgress)+.08+Math.sin(this.time*1.15)*.025;}
  this.canopy?.applyPose();
  if(this.canopy?.mode!=='jump')this.updateFeet(this.moving);this.group.updateMatrixWorld(true);
 }
 dispose(){this.group.removeFromParent();const i=this.navigation.obstacles.indexOf(this.collider);if(i>=0)this.navigation.obstacles.splice(i,1);this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);for(const m of this.materials)m.dispose();}
}
