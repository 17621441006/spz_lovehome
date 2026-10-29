import assert from 'node:assert/strict';
import {setupTitleSelection} from '../dist/src/title-selection.js';
import {THREE} from './headless.mjs';
import {buildLake} from '../dist/src/lake.js';
const choices=['xiaosi','xiaoyong','zangzangbao'].map(character=>({dataset:{character}})),nodes={coverCharacters:{setAttribute(){}},characterInvite:{textContent:''}};
let ready=false,entries=0,selected=[],release;
setupTitleSelection({document:{getElementById:id=>nodes[id],querySelectorAll:()=>choices},isReady:()=>ready,selectCharacter:async id=>{selected.push(id);if(id==='xiaoyong')await new Promise(r=>release=r);return true;},startGame:()=>entries++});
await choices[0].onclick();assert.equal(entries,0);ready=true;await choices[0].onclick();assert.equal(entries,1);
const loading=choices[1].onclick();await choices[2].onclick();assert.equal(entries,1,'Block duplicate clicks during model loading');release();await loading;await choices[2].onclick();assert.deepEqual(selected,['xiaosi','xiaoyong','zangzangbao']);assert.equal(entries,3);
const lake=buildLake(new THREE.Scene(),[]),k=lake.keeper,rod=k.root.getObjectByName('阿渔伯 · 落地扶竿');assert(rod);const rodBase=new THREE.Vector3(0,-1.25,0),v=new THREE.Vector3(),base=new THREE.Vector3();let maxGrip=0;
for(let i=0;i<300;i++){if(i%60===0)lake.talk(2.5);lake.update(1/60,k.root.position.clone().add(new THREE.Vector3(0,0,3)),0);k.root.updateMatrixWorld(true);rod.localToWorld(base.copy(rodBase));assert(Math.abs(base.y-k.root.position.y)<1e-6);k.arms[0].localToWorld(v.set(0,-.64,0));k.root.worldToLocal(v);maxGrip=Math.max(maxGrip,Math.hypot(v.x-rod.position.x,v.z-rod.position.z));assert(v.y>.5&&v.y<1.1);}
assert(maxGrip<.04,'Supporting palm stays around the planted rod while talking');
console.log({clickEachWallpaperCharacter:'PASS',waitForModelAndPreventDoubleEntry:'PASS',keeperRodGroundContact:'PASS',maxGripOffset:maxGrip});
