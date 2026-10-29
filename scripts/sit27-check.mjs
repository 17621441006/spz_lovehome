import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadHumanCharacter} from '../dist/src/human-character.js';

const actor=await loadHumanCharacter('xiaosi');
const v=new THREE.Vector3(),w=new THREE.Vector3(),samples=[];
// Measure real skin spanning the lower-leg / foot joint, rather than accepting
// a plausible bone position while the ankle skin collapses around it.
actor.model.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;
 const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,weight=[];
 for(let i=0;i<p.count;i++){
  let lower=0,foot=0;
  for(let k=0;k<4;k++){const name=mesh.skeleton.bones[si.getComponent(i,k)].name,value=sw.getComponent(i,k);if(/^(Left|Right)LowerLeg$/.test(name))lower+=value;if(/^(Left|Right)Foot$/.test(name))foot+=value;}
  weight.push({total:lower+foot,foot});
 }
 const edges=[],seen=new Set(),index=g.index;
 for(let n=0;n<(index?.count??p.count);n+=3)for(const [a,b]of [[0,1],[1,2],[2,0]]){
  const i=index?index.getX(n+a):n+a,j=index?index.getX(n+b):n+b,key=i<j?`${i}:${j}`:`${j}:${i}`;
  if(seen.has(key)||weight[i].total<.999||weight[j].total<.999||Math.abs(weight[i].foot-weight[j].foot)<.02)continue;
  seen.add(key);const rest=v.fromBufferAttribute(p,i).distanceTo(w.fromBufferAttribute(p,j));if(rest>.002)edges.push({i,j,rest});
 }
 if(edges.length)samples.push({mesh,edges});
});
assert(samples.reduce((n,x)=>n+x.edges.length,0)>50,'Need actual ankle skin samples');
const report={ankleSkinEdges:samples.reduce((n,x)=>n+x.edges.length,0),maxAnkleAngle:0,minAnkleAngle:180,maxHeelHeight:-Infinity,minHeelHeight:Infinity,skinLengthRatio:[Infinity,-Infinity],transitions:[]};
const previous={};
let stage=null;
function measure(recordSkin=false){
 actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();
 for(const side of ['Left','Right']){
  const knee=actor.bones[side+'LowerLeg'].getWorldPosition(new THREE.Vector3()),foot=actor.bones[side+'Foot'].getWorldPosition(new THREE.Vector3()),toe=actor.bones[side+'Toe'].getWorldPosition(new THREE.Vector3()),q=actor.bones[side+'Foot'].getWorldQuaternion(new THREE.Quaternion());
  if(previous[side]&&stage){stage.maxFootFrameTravel=Math.max(stage.maxFootFrameTravel,foot.distanceTo(previous[side].p));stage.maxFootFrameRotation=Math.max(stage.maxFootFrameRotation,THREE.MathUtils.radToDeg(q.angleTo(previous[side].q)));}previous[side]={p:foot,q};
  if(recordSkin){const angle=THREE.MathUtils.radToDeg(knee.sub(foot).angleTo(toe.sub(foot)));report.maxAnkleAngle=Math.max(report.maxAnkleAngle,angle);report.minAnkleAngle=Math.min(report.minAnkleAngle,angle);}
 }
 if(!recordSkin)return;
 for(const {mesh,edges}of samples)for(const {i,j,rest}of edges){const ratio=mesh.getVertexPosition(i,v).distanceTo(mesh.getVertexPosition(j,w))/rest;report.skinLengthRatio[0]=Math.min(report.skinLengthRatio[0],ratio);report.skinLengthRatio[1]=Math.max(report.skinLengthRatio[1],ratio);}
 let heel=Infinity;
 // Heel vertices are from the existing shoe's bind-space rear half. The heel
 // should support the tilted shoe; the raised toe must not ground the pelvis.
 for(const {mesh}of actor.contacts){const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++){if(p.getZ(i)>.025||p.getY(i)>.09)continue;let foot=0;for(let k=0;k<4;k++)if(/^(Left|Right)Foot$/.test(mesh.skeleton.bones[si.getComponent(i,k)].name))foot+=sw.getComponent(i,k);if(foot>.8)heel=Math.min(heel,mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).y-actor.root.position.y);}}
 assert(Number.isFinite(heel),'Need actual shoe heel vertices');report.minHeelHeight=Math.min(report.minHeelHeight,heel);report.maxHeelHeight=Math.max(report.maxHeelHeight,heel);
}
function update(label,speed,sitting=false,frames=120,running=false){stage={label,maxFootFrameTravel:0,maxFootFrameRotation:0};report.transitions.push(stage);for(let i=0;i<frames;i++){actor.update(1/60,{speed,sitting,grounded:true,idle:0,running,actualVelocity:new THREE.Vector3(0,0,speed)});measure(sitting&&i>90&&i%15===0);}stage=null;}
update('idle',0,false,30);update('sit',0,true,180);assert.equal(actor.state,'sit_idle');
update('stand-walk',1.533333,false,120);assert.equal(actor.state,'walk');
update('run',4,false,120,true);assert.equal(actor.state,'mesh_run');
update('idle',0,false,90);update('sit',0,true,180);assert.equal(actor.state,'sit_idle');
const stable=Object.fromEntries(['LeftFoot','RightFoot','LeftToe','RightToe'].map(name=>[name,actor.model.worldToLocal(actor.bones[name].getWorldPosition(new THREE.Vector3()))]));
// Rotating the avatar must not change its ankle correction in model space.
for(const yaw of [Math.PI/2,Math.PI,-Math.PI/2]){
 actor.root.rotation.y=yaw;delete previous.Left;delete previous.Right;
 for(let i=0;i<120;i++)actor.update(1/60,{speed:0,sitting:true,grounded:true,idle:0});measure(true);
 for(const name of Object.keys(stable)){const at=actor.model.worldToLocal(actor.bones[name].getWorldPosition(new THREE.Vector3()));assert(at.distanceTo(stable[name])<.003,`${name} changed with facing direction`);}
}
assert(report.minAnkleAngle>110&&report.maxAnkleAngle<125,`Seated ankle angle ${report.minAnkleAngle}–${report.maxAnkleAngle}`);
assert(report.minHeelHeight>-.012&&report.maxHeelHeight<.025,`Heel contact ${report.minHeelHeight}–${report.maxHeelHeight}`);
assert(report.skinLengthRatio[0]>.7&&report.skinLengthRatio[1]<1.25,`Ankle skin strain ${report.skinLengthRatio}`);
for(const phase of report.transitions.filter(p=>p.label==='sit'||p.label==='stand-walk')){
 assert(phase.maxFootFrameTravel<.07,`${phase.label}: foot jumped ${phase.maxFootFrameTravel}m per frame`);
 assert(phase.maxFootFrameRotation<15,`${phase.label}: foot snapped ${phase.maxFootFrameRotation} degrees per frame`);
}
console.log(JSON.stringify(report,null,2));
