import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {THREE} from './headless.mjs';
const originalCreate=document.createElement;
class El{constructor(id=''){this.id=id;this.hidden=/Panel|Dialog|Prompt|Modal/.test(id);this.style={};this.children=[];this.dataset={};this.textContent='0';this.values=new Set();this.classList={add:(...x)=>x.forEach(v=>this.values.add(v)),remove:(...x)=>x.forEach(v=>this.values.delete(v)),toggle:(x,v)=>{if(v===undefined)v=!this.values.has(x);v?this.values.add(x):this.values.delete(x);},contains:x=>this.values.has(x)};}remove(){}addEventListener(){}setAttribute(k,v){this[k]=v;}querySelectorAll(){return [];}contains(e){return e===this;}appendChild(v){this.children.push(v);}replaceChildren(){this.children=[];}focus(){}getBoundingClientRect(){return{width:400,height:300,left:0,top:0};}}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id);};document.getElementById=el;document.querySelectorAll=()=>[];document.querySelector=()=>({outerHTML:'<svg></svg>'});document.body=new El();document.body.classList.add('is-loading');document.addEventListener=()=>{};document.createElement=n=>n==='canvas'?originalCreate(n):new El();
global.window=globalThis;global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;global.location={search:''};global.matchMedia=()=>({matches:false});global.localStorage={getItem:()=>null,setItem(){}};const inputHandlers={};global.addEventListener=(type,fn)=>(inputHandlers[type]??=[]).push(fn);Object.defineProperty(global,'navigator',{value:{maxTouchPoints:0,userAgent:'qa'},configurable:true});let nextFrame;global.requestAnimationFrame=f=>{nextFrame=f;};
global.__BootRenderer=class{constructor(){this.domElement=new El();this.shadowMap={};}setPixelRatio(v){this.pixel=v;}getPixelRatio(){return this.pixel;}setSize(){}setClearColor(){}render(){}};
let source=fs.readFileSync('dist/src/main.js','utf8').replace(/from '\.\/([^']+)'/g,(_,f)=>`from '${pathToFileURL(process.cwd()+'/dist/src/'+f)}'`).replace('new THREE.WebGLRenderer(', 'new globalThis.__BootRenderer(');source=source.replace("import * as THREE from 'three'",`import * as THREE from '${pathToFileURL(process.cwd()+'/node_modules/three/build/three.module.js')}'`);
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(el('loadProgress').value,100);assert(!document.body.classList.contains('is-loading'));assert(!__game.catbus.ready);assert(!__game.cat.outfitMeshes);for(let i=0;i<3;i++)nextFrame();
el('bWeather').onclick();assert(!el('weatherPanel').hidden);el('bSnow').onclick();assert.equal(__game.env.snowT,1);assert.equal(__game.env.sunT,0);assert(el('weatherPanel').hidden);el('bSun').onclick();assert.equal(__game.env.sunT,1);assert.equal(__game.env.snowT,0);el('bHelp').onclick();assert(!el('helpPanel').hidden);el('helpClose').onclick();assert(el('helpPanel').hidden);
console.log({mainInitialization:'PASS',firstFrames:'PASS',realModelStartup:true,lazyBus:true,lazyWardrobe:true,weatherMenu:'PASS',helpMenu:'PASS',progressAtReady:el('loadProgress').value,webgl:'NOT TESTED: renderer substituted'});

// Exercise the actual lazy-entry chain and the portal transition in the main loop.
const gameFrame=nextFrame;el('startBtn').onclick();nextFrame();
for(let i=0;i<100&&!__game.detailStream.enabled;i++)await new Promise(resolve=>setTimeout(resolve,30));
assert(__game.catbus.ready);assert(__game.elderSanctuary);assert(__game.detailStream.enabled);
let clock=performance.now();Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
const draw=()=>{clock+=1000/60;gameFrame();};for(let i=0;i<20;i++)draw();
const sanctuary=__game.elderSanctuary;__game.P.pos.copy(sanctuary.portals[0]);__game.P.vel.set(0,0,0);__game.P.vy=0;__game.P.grounded=true;
for(let i=0;i<100;i++)draw();assert(Math.abs(__game.P.pos.y-sanctuary.deckY)<.02,'Main loop must deliver the player onto the deck');
__game.P.pos.copy(sanctuary.portals[1]);for(let i=0;i<100;i++)draw();assert(__game.P.pos.y<sanctuary.ground+.2,'Return portal must restore ground exploration');
console.log({lazyWorldEntry:'PASS',catbusRoutes:__game.catbus.routes.length,mainLoopPortalRoundTrip:'PASS',framesAfterEntry:220});

__game.P.pos.copy(sanctuary.arrivals[1]);__game.P.grounded=true;draw();assert.equal(el('actPrompt').dataset.target,'canopy');el('actPrompt').onclick();for(let i=0;i<100;i++)draw();assert(__game.P.pos.distanceTo(sanctuary.canopy.seat)<.08,'Leaf seating must work through the actual UI action');assert(__game.P.idle>=9&&__game.P.idle<12,'Sit stays seated without falling asleep');
__game.P.pos.copy(sanctuary.portals[2]);for(let i=0;i<100;i++)draw();assert(Math.abs(__game.P.pos.y-sanctuary.deckY)<.05,'Canopy return must land on deck');console.log({crownInteraction:'PASS',stableSitting:'PASS',canopyReturn:'PASS'});
// The belly seat is a moving attachment, with a safe explicit dismount.
__game.totoro.sleeping=true;__game.totoro.restClock=200;__game.P.pos.copy(__game.totoro.group.position).add(new THREE.Vector3(4,0,0));__game.P.grounded=true;for(let i=0;i<360;i++)draw();assert(__game.totoro.sleep>.99);__game.useTotoroBed();assert(__game.totoro.occupied);let y0=Infinity,y1=-Infinity;for(let i=0;i<240;i++){draw();y0=Math.min(y0,__game.P.pos.y);y1=Math.max(y1,__game.P.pos.y);}assert(y1-y0>.08);__game.useTotoroBed();assert(!__game.totoro.occupied&&__game.P.grounded);assert(__game.P.pos.distanceTo(__game.totoro.group.position)>4);console.log({bellyBoardBreatheExit:'PASS',verticalTravel:y1-y0});
__game.totoro.sleeping=false;__game.totoro.occupied=false;__game.totoro.restClock=100;el('bRain').onclick();const startDistance=__game.P.pos.distanceTo(__game.totoro.group.position);for(let i=0;i<900;i++)draw();assert(__game.totoro.umbrellaAmt>.95);assert(__game.P.pos.distanceTo(__game.totoro.group.position)<startDistance-.3,'Rain companion must actually approach');console.log({rainCompanionApproach:'PASS',from:startDistance,to:__game.P.pos.distanceTo(__game.totoro.group.position)});

// Physical keyboard events through the real main handlers, including IME key text.
const key=(type,code,value)=>{for(const fn of inputHandlers[type]||[])fn({code,key:value,repeat:false,target:{tagName:'BODY'},preventDefault(){}});};
const resetInput=()=>{for(const fn of inputHandlers.blur||[])fn();};
resetInput();key('keydown','ShiftLeft','Shift');draw();assert(__game.sprint.active,'Shift-before-W must survive an idle frame');key('keydown','KeyW','Unidentified');for(let i=0;i<130;i++)draw();key('keyup','ShiftLeft','Shift');draw();assert(__game.sprint.active&&!el('sprintStatus').hidden,'Sprint must stay latched after releasing Shift');key('keydown','Space',' ');draw();assert(!__game.sprint.active&&el('sprintStatus').hidden);key('keyup','Space',' ');key('keyup','KeyW','Unidentified');draw();
resetInput();key('keydown','KeyW','Unidentified');draw();key('keyup','KeyW','Unidentified');draw();key('keydown','KeyW','Unidentified');draw();assert(__game.sprint.active&&!el('sprintStatus').hidden,'Double-W must survive the intermediate key-up frame');key('keyup','KeyW','Unidentified');draw();assert(el('sprintStatus').hidden);key('keydown','KeyW','Unidentified');draw();assert(!__game.sprint.active,'Single W after stopping restores walking');resetInput();draw();
console.log({physicalKeySprint:'PASS',shiftBeforeW:'PASS',releaseShiftLatch:'PASS',doubleW:'PASS',spaceAndRestartCancel:'PASS'});
// Drop vertically from tree-height into three water bodies in the actual loop.
const {hazardousWater}=await import('../dist/src/water-recovery.js');
const {heightAt,LAYOUT}=await import('../dist/src/terrain.js');
for(const [name,x,z] of [['elder stream',-28,8.2],['lake',-4,-60],['pond',8,5]]){
 assert(hazardousWater(x,z));__game.P.pos.set(x,heightAt(x,z)+12,z);__game.P.vel.set(0,0,0);__game.P.vy=0;__game.P.grounded=false;
 for(let i=0;i<180;i++)draw();assert(!hazardousWater(__game.P.pos.x,__game.P.pos.z),name+' must recover onto dry land');assert(__game.P.grounded);assert(__game.waterRecovery.safe(__game.P.pos.x,__game.P.pos.z));
 const origin=__game.P.pos.clone();key('keydown','KeyW','w');for(let i=0;i<20;i++)draw();key('keyup','KeyW','w');assert(__game.P.pos.distanceTo(origin)>.1,name+' must allow movement after recovery');resetInput();
}
assert(!hazardousWater(-19.8,0),'Elder bridge must stay walkable');assert(!hazardousWater(-4,-53.5),'Fishing pier must stay walkable');
console.log({treeHeightFalls:'PASS: stream, lake, pond',resumeMovement:'PASS',bridgeAndPier:'PASS'});
