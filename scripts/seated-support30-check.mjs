import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {loadHumanCharacter} from '../dist/src/human-character.js';
const actor=await loadHumanCharacter('xiaosi'),samples=[],v=new THREE.Vector3();
actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {position:p,skinIndex:si,skinWeight:sw}=mesh.geometry.attributes,ids=[];
 for(let i=0;i<p.count;i++){if(p.getY(i)<=.5||p.getY(i)>=.85||Math.abs(p.getX(i))>=.20)continue;let weight=0;for(let k=0;k<4;k++)if(/^(Hips|LeftUpperLeg|RightUpperLeg)$/.test(mesh.skeleton.bones[si.getComponent(i,k)].name))weight+=sw.getComponent(i,k);if(weight>.8)ids.push(i);}
 if(ids.length)samples.push({mesh,ids});});
assert(samples.reduce((n,p)=>n+p.ids.length,0)>2000,'Use the actual shorts/pelvis skin, including the hem');
const report=[];
for(const natural of [false,true])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 actor.root.position.set(3,2.7,-4);actor.root.rotation.y=yaw;
 let bottom=Infinity,top=-Infinity;
 for(let frame=0;frame<300;frame++){actor.update(1/60,{grounded:true,speed:0,sitting:!natural,idle:natural?121:0});if(frame<180)continue;
  actor.root.updateMatrixWorld(true);for(const sk of actor.skeletons)sk.update();let lowest=Infinity;
  for(const {mesh,ids}of samples)for(const i of ids)lowest=Math.min(lowest,mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).y-actor.root.position.y);
  bottom=Math.min(bottom,lowest);top=Math.max(top,lowest);
 }
 assert(bottom>.003&&top<.015,`Real seated fabric must rest above the support plane: ${bottom}..${top}`);
 report.push({natural,yaw,min:bottom,max:top});
}
console.log(JSON.stringify({realShortsSupport:'PASS',manualAndNaturalSit:'PASS',translatedPlatformAndFourHeadings:'PASS',measurements:report},null,2));
