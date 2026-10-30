import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {THREE} from './headless.mjs';
const originalCreate=document.createElement;
class El{constructor(id=''){this.id=id;this.isConnected=true;this.queries=new Map();this.hidden=/Panel|Dialog|Prompt|Modal/.test(id);this.style={};this.children=[];this.dataset={};this.textContent='0';this.values=new Set();this.classList={add:(...x)=>x.forEach(v=>this.values.add(v)),remove:(...x)=>x.forEach(v=>this.values.delete(v)),toggle:(x,v)=>{if(v===undefined)v=!this.values.has(x);v?this.values.add(x):this.values.delete(x);},contains:x=>this.values.has(x)};}remove(){this.isConnected=false;}addEventListener(){}setAttribute(k,v){this[k]=v;}querySelectorAll(){return [];}querySelector(selector){if(!this.queries.has(selector)){const child=new El();child.tagName=selector.toUpperCase();this.queries.set(selector,child);}return this.queries.get(selector);}contains(e){return e===this;}appendChild(v){this.children.push(v);}replaceChildren(){this.children=[];}focus(){document.activeElement=this;}getBoundingClientRect(){return{width:400,height:300,left:0,top:0};}}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id);};document.getElementById=el;document.querySelectorAll=()=>[];document.querySelector=()=>({outerHTML:'<svg></svg>'});document.body=new El();document.head=new El();document.body.classList.add('is-loading');document.addEventListener=()=>{};document.createElement=n=>n==='canvas'?originalCreate(n):new El();
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
// Use an open lane and assert actual travel after releasing BOTH keys.
resetInput();__game.P.pos.set(0,0,6);__game.P.vel.set(0,0,0);__game.P.grounded=true;draw();
key('keydown','ShiftLeft','Shift');draw();assert(__game.sprint.active);key('keydown','KeyW','Unidentified');for(let i=0;i<125;i++)draw();assert(__game.sprint.autoForward);key('keyup','ShiftLeft','Shift');key('keyup','KeyW','Unidentified');const afterRelease=__game.P.pos.clone();for(let i=0;i<20;i++)draw();assert(__game.P.pos.distanceTo(afterRelease)>.6,'Shift+W must keep travelling after both keys are released');assert(!el('sprintStatus').hidden);key('keydown','Space',' ');draw();assert(!__game.sprint.autoForward);key('keyup','Space',' ');resetInput();
__game.P.pos.set(0,0,6);__game.P.vel.set(0,0,0);draw();key('keydown','KeyW','Unidentified');draw();key('keyup','KeyW','Unidentified');draw();key('keydown','KeyW','Unidentified');draw();key('keyup','KeyW','Unidentified');const doubleRelease=__game.P.pos.clone();for(let i=0;i<20;i++)draw();assert(__game.sprint.autoForward&&__game.P.pos.distanceTo(doubleRelease)>.6,'Double W keeps actual forward motion after key-up');key('keydown','KeyW','Unidentified');draw();assert(!__game.sprint.active&&!__game.sprint.autoForward,'Single W cancels automatic movement');key('keyup','KeyW','Unidentified');resetInput();draw();
console.log({physicalKeyAutoForward:'PASS',shiftBeforeW:'PASS',releaseBothKeysTravel:'PASS',doubleWReleaseTravel:'PASS',spaceAndWCancel:'PASS'});
// Drop vertically from tree-height into three water bodies in the actual loop.
const {hazardousWater}=await import('../dist/src/water-recovery.js');
const {heightAt,LAYOUT}=await import('../dist/src/terrain.js');
for(const [name,x,z] of [['elder stream',LAYOUT.elder.x,LAYOUT.elder.z+8.2],['lake',LAYOUT.lake.x,LAYOUT.lake.z],['pond',LAYOUT.pond.x,LAYOUT.pond.z]]){
 assert(hazardousWater(x,z));__game.P.pos.set(x,heightAt(x,z)+12,z);__game.P.vel.set(0,0,0);__game.P.vy=0;__game.P.grounded=false;
 for(let i=0;i<180;i++)draw();assert(!hazardousWater(__game.P.pos.x,__game.P.pos.z),name+' must recover onto dry land');assert(__game.P.grounded);assert(__game.waterRecovery.safe(__game.P.pos.x,__game.P.pos.z));
 const origin=__game.P.pos.clone();key('keydown','KeyW','w');for(let i=0;i<20;i++)draw();key('keyup','KeyW','w');assert(__game.P.pos.distanceTo(origin)>.1,name+' must allow movement after recovery');resetInput();
}
assert(!hazardousWater(-19.8,0),'Elder bridge must stay walkable');assert(!hazardousWater(-4,-53.5),'Fishing pier must stay walkable');
console.log({treeHeightFalls:'PASS: stream, lake, pond',resumeMovement:'PASS',bridgeAndPier:'PASS'});

// Passing the lake starts the real nearby-NPC promise. Await its actual HUD
// construction so a late DOM error cannot hide behind the earlier assertions.
if(__game.dewLoading)await __game.dewLoading;
assert(__game.dewNpc&&__game.dewGame,'Nearby lamp-tail NPC and dew HUD must finish loading');
assert(__game.dewGame.hud&&__game.dewGame.ui.title&&__game.dewGame.ui.button);
console.log({lazyDewNpcAndHud:'PASS',realCreatureGLB:true});

// v32: use the real main loop, player recovery, UI priority and relocation hooks.
for(const fn of inputHandlers.focus||[])fn();el('bSun').onclick();
const rh=__game.reflectionInterior,lm=__game.landmarks;
__game.P.pos.set(rh.b.x,heightAt(rh.b.x,rh.b.z+4.2),rh.b.z+4.2);__game.cam.yaw=0;__game.P.vel.set(0,0,0);__game.P.grounded=true;
for(let i=0;i<30;i++)draw();key('keydown','KeyW','w');for(let i=0;i<150;i++)draw();key('keyup','KeyW','w');resetInput();for(const fn of inputHandlers.focus||[])fn();
assert(__game.P.pos.z<rh.b.z+2.1,'Stone approach must be reachable on foot: '+JSON.stringify(__game.P.pos.toArray()));
__game.P.pos.copy(rh.entry);__game.P.grounded=true;draw();assert.equal(el('actPrompt').dataset.target,'landmark');key('keydown','KeyE','e');key('keyup','KeyE','e');for(let i=0;i<65;i++)draw();
assert(rh.active&&__game.P.grounded);assert(Math.abs(__game.P.pos.y-rh.floor)<.01,'Water recovery must retain the underwater room');
const roomStart=__game.P.pos.clone();key('keydown','KeyA','a');for(let i=0;i<40;i++)draw();key('keyup','KeyA','a');assert(__game.P.pos.distanceTo(roomStart)>.2&&rh.roomContains(__game.P.pos));
key('keydown','Space',' ');key('keyup','Space',' ');for(let i=0;i<90;i++)draw();assert.equal(__game.P.pos.y,rh.floor,'Low room ceiling cannot be jumped through');
__game.P.pos.set(rh.center.x,rh.floor,rh.center.z+.6);draw();key('keydown','KeyE','e');key('keyup','KeyE','e');for(let i=0;i<70;i++)draw();assert(!rh.active&&__game.P.pos.y>.3);
for(let cycle=0;cycle<2;cycle++){
 const dock=lm.dock;__game.P.pos.set(dock.anchorX,heightAt(dock.anchorX,dock.anchorZ),dock.anchorZ);__game.P.grounded=true;draw();
 key('keydown','KeyE','e');key('keyup','KeyE','e');for(let i=0;i<65;i++)draw();assert(lm.aboard&&__game.P.pos.x*dock.x>0);
 const previousDock=lm.dockIndex;assert(lm.begin('sleep',__game.P.pos));assert(!lm.begin('sleep',__game.P.pos),'Repeated activation is ignored');
 for(let i=0;i<240;i++)draw();assert.equal(lm.dockIndex,previousDock,'No relocation before five active seconds');
 resetInput();for(let i=0;i<240;i++)draw();assert.equal(lm.dockIndex,previousDock,'Sleep pauses while unfocused');for(const fn of inputHandlers.focus||[])fn();
 for(let i=0;i<95;i++)draw();assert.notEqual(lm.dockIndex,previousDock);assert(lm.aboard&&__game.P.grounded);assert(Math.abs(__game.P.pos.y-lm.dock.y)<.01);
 key('keydown','KeyW','w');for(let i=0;i<180;i++)draw();key('keyup','KeyW','w');assert(__game.P.pos.distanceTo(lm.kite.position)<2,'Cabin edge prevents falling into the sea');
 assert(lm.begin('exit',__game.P.pos));for(let i=0;i<65;i++)draw();assert(!lm.aboard);assert(__game.P.pos.distanceTo(new THREE.Vector3(lm.dock.anchorX,heightAt(lm.dock.anchorX,lm.dock.anchorZ),lm.dock.anchorZ))<.1);
}
console.log({reflectionApproachEnterWalkExit:'PASS',underwaterFloorAndCeiling:'PASS',kiteBoardSleepReturnExit:'PASS',sleepFiveActiveSeconds:'PASS',blurPausesTravel:'PASS',cabinEdgeSafety:'PASS'});
