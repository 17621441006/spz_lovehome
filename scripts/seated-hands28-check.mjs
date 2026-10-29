import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadHumanCharacter} from '../dist/src/human-character.js';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
const reports=[];
for(const id of ['xiaosi','xiaoyong']){
 const actor=await loadHumanCharacter(id),surfaces={},wristEdges=[];
 actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();
 for(const [side,sign]of [['Left',1],['Right',-1]]){
  const hand=actor.bones[side+'Hand'],knee=actor.bones[side+'LowerLeg'].getWorldPosition(V()),parts=[];
  actor.model.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,p=g.attributes.position,leg=[],palm=[],joint=[];
   const handSamples=[];
   for(let i=0;i<p.count;i++){
    let legWeight=0,handWeight=0,foreWeight=0;
    for(let k=0;k<4;k++){const name=mesh.skeleton.bones[si.getComponent(i,k)].name,w=sw.getComponent(i,k);if(name===side+'UpperLeg'||name===side+'LowerLeg')legWeight+=w;if(name===side+'Hand')handWeight+=w;if(name===side+'ForeArm')foreWeight+=w;}
    const at=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);leg.push(legWeight>.95&&at.distanceTo(knee)<.14);joint.push({sum:handWeight+foreWeight,hand:handWeight});
    if(handWeight>.95)handSamples.push({i,p:hand.worldToLocal(at)});
   }
   if(handSamples.length){const length=Math.max(...handSamples.map(x=>x.p.y));for(const {i,p}of handSamples)if(p.y>length*.25&&p.y<length*.75)palm.push(i);}
   const triangles=[],edges=[],seen=new Set();
   for(let n=0;n<g.index.count;n+=3){const tri=[g.index.getX(n),g.index.getX(n+1),g.index.getX(n+2)];if(tri.every(i=>leg[i]))triangles.push(tri);
    for(const [ea,eb]of [[0,1],[1,2],[2,0]]){const a=tri[ea],b=tri[eb],key=a<b?`${a}:${b}`:`${b}:${a}`;if(seen.has(key)||joint[a].sum<.999||joint[b].sum<.999||Math.abs(joint[a].hand-joint[b].hand)<.02)continue;seen.add(key);const rest=V().fromBufferAttribute(p,a).distanceTo(V().fromBufferAttribute(p,b));if(rest>.002)edges.push({a,b,rest});}
   }
   if(palm.length||triangles.length)parts.push({mesh,palm,triangles});if(edges.length)wristEdges.push({mesh,edges});
  });
  surfaces[side]={parts,sign};
 }
 const report={id,palmDown:1,maxWristBend:0,kneeGap:[Infinity,-Infinity],palmRootGap:[Infinity,-Infinity],palmCenterGap:[Infinity,-Infinity],contactSamples:0,wristSkinRatio:[Infinity,-Infinity],maxShoulderChange:0,restoredVertices:0,ringSurfaceDrift:0,transitions:[]};
 let previous={};
 function inspectContact(){
  actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();const inv=actor.model.matrixWorld.clone().invert();
  for(const [side,{parts,sign}]of Object.entries(surfaces)){
   const hand=actor.bones[side+'Hand'],q=hand.getWorldQuaternion(Q()),down=new THREE.Vector3(sign,0,0).applyQuaternion(q).dot(new THREE.Vector3(0,-1,0));report.palmDown=Math.min(report.palmDown,down);
   report.maxWristBend=Math.max(report.maxWristBend,THREE.MathUtils.radToDeg(hand.quaternion.angleTo(actor.seatedHands[side].handRest)));
   const knees=parts.flatMap(({mesh,triangles})=>triangles.map(t=>t.map(i=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv)))),palms=parts.flatMap(({mesh,palm})=>palm.map(i=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv)));
   let minimum=Infinity,hits=0;
   for(const p of palms){let top=-Infinity;
    for(const [a,b,c]of knees){const denominator=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(denominator)<1e-9)continue;const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/denominator,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/denominator,w=1-u-v;if(Math.min(u,v,w)<0)continue;top=Math.max(top,u*a.y+v*b.y+w*c.y);}
    if(Number.isFinite(top)){minimum=Math.min(minimum,p.y-top);hits++;}
   }
   assert(hits>5,`${id} ${side}: palm must overlap the actual knee surface`);report.contactSamples+=hits;report.kneeGap[0]=Math.min(report.kneeGap[0],minimum);report.kneeGap[1]=Math.max(report.kneeGap[1],minimum);
   // Check several supporting vertices in BOTH the palm heel and palm center.
   // A lone fingertip near the knee must not hide a floating palm.
   const shape=actor.seatedHands[side].shape,groups={palmRootGap:[],palmCenterGap:[]};
   for(const {mesh,vertices}of shape.parts)for(const v of vertices){const u=v.local.y/(shape.start+shape.length);if(u<.15||u>.62||v.weight<.95)continue;const p=mesh.getVertexPosition(v.i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);let top=-Infinity;
    for(const [a,b,c]of knees){const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-9)continue;const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/d,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/d,w=1-u-v;if(Math.min(u,v,w)>=0)top=Math.max(top,u*a.y+v*b.y+w*c.y);}
    if(Number.isFinite(top))groups[u<.35?'palmRootGap':'palmCenterGap'].push(p.y-top);
   }
   for(const [name,values]of Object.entries(groups)){values.sort((a,b)=>a-b);assert(values.length>=3,`${id} ${side} ${name}: missing palm support`);const contact=values.slice(0,3).reduce((a,b)=>a+b)/3;report[name][0]=Math.min(report[name][0],values[0]);report[name][1]=Math.max(report[name][1],contact);}
   if(shape.ring){let original=Infinity,current=Infinity;for(const {mesh,vertices}of shape.parts)for(const v of vertices){if(v.weight<.99)continue;original=Math.min(original,v.local.distanceTo(shape.ringBase));const actual=hand.worldToLocal(mesh.getVertexPosition(v.i,V()).applyMatrix4(mesh.matrixWorld));current=Math.min(current,actual.distanceTo(shape.ring.position));}report.ringSurfaceDrift=Math.max(report.ringSurfaceDrift,Math.abs(current-original));}
  }
  for(const {mesh,edges}of wristEdges)for(const {a,b,rest}of edges){const ratio=mesh.getVertexPosition(a,V()).distanceTo(mesh.getVertexPosition(b,V()))/rest;report.wristSkinRatio[0]=Math.min(report.wristSkinRatio[0],ratio);report.wristSkinRatio[1]=Math.max(report.wristSkinRatio[1],ratio);}
 }
 function phase(label,speed,sitting,frames,running=false){
  const stats={label,maxHandStep:0,maxHandRotation:0};report.transitions.push(stats);
  for(let frame=0;frame<frames;frame++){
   actor.update(1/60,{speed,sitting,grounded:true,running,idle:0,actualVelocity:new THREE.Vector3(0,0,speed)});actor.root.updateMatrixWorld(true);
   for(const side of ['Left','Right']){const hand=actor.bones[side+'Hand'],p=hand.getWorldPosition(V()),q=hand.getWorldQuaternion(Q());if(previous[side]){stats.maxHandStep=Math.max(stats.maxHandStep,p.distanceTo(previous[side].p));stats.maxHandRotation=Math.max(stats.maxHandRotation,THREE.MathUtils.radToDeg(q.angleTo(previous[side].q)));}previous[side]={p,q};
    // Shoulders, sleeves and backward arm swings retain their authored local
    // transforms. Hands/forearms also return to source motion after standing.
    for(const part of ['Clavicle','UpperArm']){const bone=actor.bones[side+part],source=actor.pose.find(p=>p.bone===bone);report.maxShoulderChange=Math.max(report.maxShoulderChange,bone.quaternion.clone().normalize().angleTo(source.q.clone().normalize()));}
    if(!sitting&&actor.sitBlend<.01){for(const part of ['ForeArm','Hand']){const bone=actor.bones[side+part],source=actor.pose.find(p=>p.bone===bone);assert(bone.quaternion.clone().normalize().angleTo(source.q.clone().normalize())<.001,`${id} ${label}: standing arm track changed`);}
     const shape=actor.seatedHands[side].shape;for(const {mesh,vertices}of shape.parts)for(const v of vertices){assert(V().fromBufferAttribute(mesh.geometry.attributes.position,v.i).equals(v.base),`${id}: hand position did not restore exactly`);assert(V().fromBufferAttribute(mesh.geometry.attributes.normal,v.i).equals(v.normal),`${id}: hand normal did not restore exactly`);report.restoredVertices++;}if(shape.ring)assert(shape.ring.position.equals(shape.ringBase),'ring did not return to its source placement');
    }
   }
   if(sitting&&frame>120&&frame%30===0)inspectContact();
  }
 }
 phase('idle',0,false,30);phase('sit',0,true,180);phase('stand-walk',id==='xiaosi'?1.533333:2.5,false,120);phase('run',id==='xiaosi'?4:6.133333,false,120,true);phase('idle',0,false,90);phase('sit',0,true,180);
 const localPose=Object.fromEntries(['LeftHand','RightHand'].map(n=>[n,actor.model.worldToLocal(actor.bones[n].getWorldPosition(V()))]));
 for(const yaw of [Math.PI/2,Math.PI,-Math.PI/2]){actor.root.rotation.y=yaw;for(let i=0;i<90;i++)actor.update(1/60,{speed:0,sitting:true,grounded:true,idle:0});actor.root.updateMatrixWorld(true);for(const n of Object.keys(localPose))assert(actor.model.worldToLocal(actor.bones[n].getWorldPosition(V())).distanceTo(localPose[n])<.003,`${id} ${n}: seating changes with camera direction`);}
 console.log(JSON.stringify(report,null,2));
 assert(report.palmDown>.98,`${id}: palms tilt up`);
 assert(report.maxWristBend<35,`${id}: bent wrist ${report.maxWristBend}`);
 assert(report.kneeGap[0]>-.008&&report.kneeGap[1]<.018,`${id}: palm/knee clearance ${report.kneeGap}`);
 for(const region of ['palmRootGap','palmCenterGap'])assert(report[region][0]>-.002&&report[region][1]<.020,`${id}: ${region} ${report[region]}`);
 assert(report.wristSkinRatio[0]>.55&&report.wristSkinRatio[1]<1.5,`${id}: wrist skin distorted ${report.wristSkinRatio}`);
 assert(report.maxShoulderChange<.001,`${id}: shoulder animation changed`);
 assert(report.ringSurfaceDrift<.003,`${id}: ring no longer follows its finger surface`);
 for(const t of report.transitions.filter(t=>t.label==='sit'||t.label==='stand-walk')){assert(t.maxHandStep<.07,`${id} ${t.label}: wrist jumped`);assert(t.maxHandRotation<20,`${id} ${t.label}: wrist snapped`);}
 reports.push(report);
}
console.log('PASS: both seated palms, real knee contact, wrists, shoulder preservation and transitions');
