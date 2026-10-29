import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {THREE} from './headless.mjs';

// Browser IO and the GPU are substituted; actual models, preview reparenting,
// skeleton updates, keyboard handlers, camera basis and movement run unchanged.
const originalCreate=document.createElement;
class El{
 constructor(id=''){this.id=id;this.tagName='BUTTON';this.hidden=/Panel|Dialog|Prompt|Modal/.test(id);this.style={};this.children=[];this.dataset={};this.textContent='0';this.handlers={};this.values=new Set();this.classList={add:(...x)=>x.forEach(v=>this.values.add(v)),remove:(...x)=>x.forEach(v=>this.values.delete(v)),toggle:(x,v)=>{if(v===undefined)v=!this.values.has(x);v?this.values.add(x):this.values.delete(x);},contains:x=>this.values.has(x)};}
 remove(){}addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}setAttribute(k,v){this[k]=v;}querySelectorAll(){return [];}contains(e){return e===this;}appendChild(v){this.children.push(v);}replaceChildren(){this.children=[];}focus(){document.activeElement=this;}setPointerCapture(){}getBoundingClientRect(){return {width:400,height:300,left:0,top:0};}
}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id);};document.getElementById=el;document.querySelectorAll=()=>[];document.querySelector=()=>({outerHTML:'<svg></svg>'});document.body=new El();document.body.classList.add('is-loading');document.addEventListener=()=>{};document.createElement=n=>n==='canvas'?originalCreate(n):new El();
global.window=globalThis;global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;global.location={search:''};global.matchMedia=()=>({matches:false});global.localStorage={getItem:()=>null,setItem(){}};Object.defineProperty(global,'navigator',{value:{maxTouchPoints:0,userAgent:'qa'},configurable:true});
const input={};global.addEventListener=(type,fn)=>(input[type]??=[]).push(fn);let nextFrame;global.requestAnimationFrame=fn=>nextFrame=fn;
global.__BootRenderer=class{
 constructor(){this.domElement=new El();this.shadowMap={};this.autoClear=false;}setPixelRatio(v){this.pixel=v;}getPixelRatio(){return this.pixel;}setSize(){}setClearColor(){}getViewport(v){return v.set(0,0,400,300);}getScissor(v){return v.set(0,0,400,300);}getScissorTest(){return false;}setViewport(){}setScissor(){}setScissorTest(){}
 render(scene){if(!this.portrait)return;scene.updateMatrixWorld(true);const skeletons=new Set();scene.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const s of skeletons)s.update();}
};
let source=fs.readFileSync('dist/src/main.js','utf8').replace(/from '\.\/([^']+)'/g,(_,f)=>`from '${pathToFileURL(process.cwd()+'/dist/src/'+f)}'`).replace('new THREE.WebGLRenderer(','new globalThis.__BootRenderer(').replace("import * as THREE from 'three'",`import * as THREE from '${pathToFileURL(process.cwd()+'/node_modules/three/build/three.module.js')}'`);
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const game=__game,frame=nextFrame;el('startBtn').onclick();game.equipment.previewRenderer=Object.assign(new __BootRenderer(),{portrait:true});
let clock=performance.now();Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
const draw=(count=1)=>{for(let i=0;i<count;i++){clock+=1000/60;frame();}};
const key=(type,code,value,repeat=false)=>{for(const fn of input[type]||[])fn({code,key:value,repeat,target:document.activeElement||{tagName:'BODY'},preventDefault(){}});};
const pressB=()=>{key('keydown','KeyB','Unidentified');key('keyup','KeyB','Unidentified');};
const blur=()=>{for(const fn of input.blur||[])fn();};
const horizontalDelta=p=>Math.hypot(game.P.pos.x-p.x,game.P.pos.z-p.z);
const headings=[2.7,-2.7,Math.PI,.3,-1.8],results=[];
for(const heading of headings)for(let cycle=0;cycle<2;cycle++){
 blur();game.P.pos.set(0,0,6);game.P.vy=0;game.P.grounded=true;game.P.heading=heading;game.cat.root.rotation.set(0,heading,0);game.cat.model.rotation.set(0,0,0);game.cam.yaw=heading-Math.PI;draw(3);
 const before=game.P.pos.clone(),cameraYaw=game.cam.yaw;
 // Opening while the canvas holds an old drag must end that gesture as well.
 for(const fn of game.renderer.domElement.handlers.pointerdown||[])fn({pointerId:7,pointerType:'mouse',clientX:200,clientY:150});
 pressB();assert(game.equipment.open);key('keydown','KeyB','b',true);assert(game.equipment.open,'Held B cannot oscillate the modal');
 key('keydown','KeyW','w');key('keydown','KeyD','d');draw(6);key('keyup','KeyD','d');key('keyup','KeyW','w');
 assert(horizontalDelta(before)<1e-8,'Menu direction keys cannot move the player');assert.equal(game.cat.root.rotation.x,0);assert.equal(game.cat.root.rotation.z,0);
 key('keydown','KeyW','w');pressB();assert(!game.equipment.open);draw(6);assert(horizontalDelta(before)<1e-8,'Closing clears keys pressed inside the menu');key('keyup','KeyW','w');
 for(const fn of game.renderer.domElement.handlers.pointermove||[])fn({pointerId:7,clientX:420,clientY:240});assert.equal(game.cam.yaw,cameraYaw,'Old pre-menu drag cannot turn the camera after closing');
 const start=game.P.pos.clone(),forward=new THREE.Vector3(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));key('keydown','KeyW','w');
 for(let i=0;i<12;i++){draw();if(i>2){const visual=new THREE.Vector3(0,0,1).applyQuaternion(game.cat.model.getWorldQuaternion(new THREE.Quaternion()));visual.y=0;visual.normalize();assert(visual.dot(forward)>.995,`Heading ${heading}: avatar must face its actual travel after B close`);}}
 key('keyup','KeyW','w');const travel=game.P.pos.clone().sub(start);travel.y=0;assert(travel.length()>.15);assert(travel.clone().normalize().dot(forward)>.995);draw(25);assert(game.P.vel.length()<.03,'Key release stops movement');results.push({heading,cycle,forwardTravel:Number(travel.length().toFixed(3))});
}
blur();game.P.pos.set(0,0,6);game.P.vy=0;game.P.grounded=true;draw(3);key('keydown','KeyW','w');key('keyup','KeyW','w');draw();key('keydown','KeyW','w');key('keyup','KeyW','w');draw();assert(game.sprint.autoForward);pressB();assert(!game.sprint.autoForward&&!game.sprint.active);draw();pressB();const stopped=game.P.pos.clone();draw(10);assert(horizontalDelta(stopped)<1e-8,'Bag close must not restart automatic forward');blur();assert.equal(game.P.vel.length(),0);
console.log(JSON.stringify({mainKeyboardBagCycles:'PASS',orientations:results,menuInputAndRelease:'PASS',heldB:'PASS',oldPointerDrag:'PASS',autoForwardCancellation:'PASS',blur:'PASS',webgl:'Substituted renderer; actual model/skeleton and handlers executed'},null,2));
