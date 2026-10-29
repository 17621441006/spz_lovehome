import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {THREE,parseAsset} from './headless.mjs';
for(const f of fs.readdirSync('dist/src').filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',`dist/src/${f}`]);
const {loadModelCat}=await import('../dist/src/modelcat.js');
const {buildWorld,colliders,groundAt,Acorns}=await import('../dist/src/world.js');
const {loadDreamWorld}=await import('../dist/src/dream.js');
const {SmallTotoro}=await import('../dist/src/totoro.js');
const {heightAt,buildTerrain,LAYOUT}=await import('../dist/src/terrain.js');
const scene=new THREE.Scene();scene.add(buildTerrain());buildWorld(scene);await loadDreamWorld(scene,false);
assert(scene.getObjectByName('脏脏包的森林树屋'));assert(scene.getObjectByName('稻荷山道 · 48级石阶'));
const cat=await loadModelCat('assets/cat-rig.glb',1.25);scene.add(cat.root);assert.equal(Object.keys(cat.actions).length,8);
let skinned=0;cat.root.traverse(o=>{if(o.isSkinnedMesh)skinned++});assert(skinned>0);
const hips=cat.model.getObjectByName('mixamorigHips'),leg=cat.model.getObjectByName('mixamorigLeftLeg');let maxDrift=0,minRot=Infinity,maxRot=-Infinity;
for(let frame=0;frame<1200;frame++){cat.update(1/60,{grounded:true,speed:2.5,idle:0,vy:0});maxDrift=Math.max(maxDrift,Math.abs(hips.position.z-.182228729));minRot=Math.min(minRot,leg.quaternion.x);maxRot=Math.max(maxRot,leg.quaternion.x);}
assert(maxDrift<.25,`root drift ${maxDrift}`);assert(maxRot-minRot>.02,'Leg must actually move');
for(const [s,expected] of [[{speed:4.4,grounded:true,idle:0,vy:0},'run'],[{speed:0,grounded:true,idle:0,sitting:true,vy:0},'sit'],[{speed:0,grounded:false,idle:0,vy:4},'jump'],[{speed:0,grounded:false,idle:0,vy:-4},'jump_down'],[{speed:0,grounded:true,idle:0,vy:0},'wait']]){cat.update(.2,s);assert.equal(cat.state,expected);}
// Both kick clips play once, reject repeat spam and return to locomotion.
for(const name of ['front_kick_01','front_kick_02']){assert(cat.triggerAction(name));assert(cat.triggerAction(name),'one buffered kick');assert(!cat.triggerAction(name),'buffer must remain bounded');cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});assert.equal(cat.state,name);for(let n=0;n<240;n++)cat.update(1/60,{grounded:true,speed:0,idle:0,vy:0});assert(!cat.isPerforming);assert.equal(cat.state,'wait');}
// Three minutes of independent wandering, including moving player avoidance.
const chu=new SmallTotoro(scene,'chu',{x:-8,z:-4}),chibi=new SmallTotoro(scene,'chibi',{x:-1,z:-7});let minDistance=Infinity,movedA=0,movedB=0;
for(let i=0;i<10800;i++){const player=new THREE.Vector3(Math.sin(i/700)*9,0,Math.cos(i/700)*9);const a=chu.pos.clone(),b=chibi.pos.clone();chu.update(1/60,player,chibi);chibi.update(1/60,player,chu);minDistance=Math.min(minDistance,chu.pos.distanceTo(chibi.pos));movedA+=a.distanceTo(chu.pos);movedB+=b.distanceTo(chibi.pos);for(const t of [chu,chibi]){assert(Number.isFinite(t.pos.x+t.pos.z+t.heading));assert(Math.abs(t.group.position.y-heightAt(t.pos.x,t.pos.z))<.1);}}
assert(minDistance>=chu.radius+chibi.radius+.19,`NPC overlap ${minDistance}`);assert(movedA>20&&movedB>20,'Both companions must move independently');
// Walk the new mountain approach and stairs in both directions with player clearance.
let maxStep=0;
for(const direction of [1,-1]){let prev=groundAt(23,direction>0?10:36,Infinity,.42);for(let n=1;n<=520;n++){const z=direction>0?10+n*.05:36-n*.05;const g=groundAt(23,z,prev,.42);maxStep=Math.max(maxStep,g-prev);assert(g-prev<.301,`unwalkable riser at ${z}: ${g-prev}`);for(const c of colliders){if(c.top<900)continue;const d=c.type==='circle'?Math.hypot(23-c.x,z-c.z)-c.r:Math.hypot(Math.max(c.minX-23,0,23-c.maxX),Math.max(c.minZ-z,0,z-c.maxZ));assert(d>.42,`blocked mountain route ${z}`);}prev=g;}}
for(const b of LAYOUT.buildings){const mesh=scene.getObjectByName(b.name);assert(mesh,b.name);const box=new THREE.Box3().setFromObject(mesh);assert(Math.abs(box.min.y-heightAt(b.x,b.z))<.05,`${b.name} floating`);}
const far=scene.children.filter(o=>o.name==='远景模型树');assert(far.length>=12&&far.length<=52);assert(far.every(o=>o.userData.treeAsset));
const acorns=new Acorns(scene);assert.equal(acorns.total,14);for(const a of acorns.list){for(const c of colliders){if(c.top<900)continue;const x=a.position.x,z=a.position.z;if(c.type==='circle')assert(Math.hypot(x-c.x,z-c.z)>c.r+.42-.75,`acorn inside solid at ${x},${z}`);else assert(x<c.minX-.1||x>c.maxX+.1||z<c.minZ-.1||z>c.maxZ+.1,'acorn inside building');}}
// Index bounds after mesh simplification.
for(const name of ['forest-tree','treehouse','broadleaf-tree','fantasy-tree','forest-tree-lod','broadleaf-tree-lod','fantasy-tree-lod','shrine','pagoda','temple','japanese-house']){const g=await parseAsset(`assets/${name}.glb`);g.scene.traverse(o=>{if(o.isMesh)for(const idx of o.geometry.index.array)assert(idx<o.geometry.attributes.position.count);});}
console.log(JSON.stringify({syntax:'PASS',models:'PASS',backgroundModelTrees:far.length,buildings:LAYOUT.buildings.length,kickLifecycle:'PASS',skinnedMeshes:skinned,animations:Object.keys(cat.actions),rootDrift:maxDrift,legQuaternionRange:maxRot-minRot,independentNpcSeconds:180,npcMinSeparation:minDistance,npcTravel:[movedA,movedB],maxStairRise:maxStep,colliders:colliders.length,renderValidation:'Numerical harness only; real browser GPU validation is separate'},null,2));
