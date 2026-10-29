import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {THREE} from './headless.mjs';
import {heightAt,LAYOUT} from '../dist/src/terrain.js';
import {groundAt} from '../dist/src/world.js';

assert(fs.existsSync('dist/assets/creatures/dengweirong-v1.glb'),'Export the real Blender GLB before running the main integration check');
// Substitute browser IO/GPU only. Main, world, collisions, real GLB, NPC,
// keyboard handlers, quest state and player motion execute production code.
const originalCreate=document.createElement;
class El{
 constructor(id=''){this.id=id;this.tagName='BUTTON';this.hidden=/Panel|Dialog|Prompt|Modal/.test(id);this.style={};this.children=[];this.dataset={};this.textContent='0';this.handlers={};this.values=new Set();this.isConnected=true;this.classList={add:(...x)=>x.forEach(v=>this.values.add(v)),remove:(...x)=>x.forEach(v=>this.values.delete(v)),toggle:(x,v)=>{if(v===undefined)v=!this.values.has(x);v?this.values.add(x):this.values.delete(x);},contains:x=>this.values.has(x)};}
 remove(){this.isConnected=false;}addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}setAttribute(k,v){this[k]=v;}querySelectorAll(){return [];}querySelector(tag){let e=this.children.find(c=>c.tagName===tag);if(!e){e=new El();e.tagName=tag;this.children.push(e);}return e;}contains(e){return e===this;}appendChild(v){this.children.push(v);return v;}replaceChildren(){this.children=[];}focus(){document.activeElement=this;}setPointerCapture(){}getBoundingClientRect(){return {width:400,height:300,left:0,top:0};}
 set innerHTML(_){this.children=['p','small','button'].map(tag=>{const e=new El();e.tagName=tag;return e;});}
}
const els=new Map(),el=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id);};document.getElementById=el;document.querySelectorAll=()=>[];document.querySelector=()=>({outerHTML:'<svg></svg>'});document.body=new El();document.head=new El();document.body.classList.add('is-loading');document.hidden=false;document.addEventListener=()=>{};document.createElement=n=>n==='canvas'?originalCreate(n):new El();document.exitPointerLock=()=>{document.pointerLockElement=null;};
global.window=globalThis;global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;global.location={search:''};global.matchMedia=()=>({matches:false});const saved=new Map();global.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};Object.defineProperty(global,'navigator',{value:{maxTouchPoints:0,userAgent:'qa'},configurable:true});
const input={};global.addEventListener=(type,fn)=>(input[type]??=[]).push(fn);global.removeEventListener=(type,fn)=>{input[type]=(input[type]||[]).filter(x=>x!==fn);};let nextFrame;const rafJobs=[];global.requestAnimationFrame=fn=>{if(fn.name==='frame')nextFrame=fn;else rafJobs.push(fn);};
global.__BootRenderer=class{constructor(){this.domElement=new El();this.shadowMap={};this.autoClear=false;}setPixelRatio(v){this.pixel=v;}getPixelRatio(){return this.pixel;}setSize(){}setClearColor(){}getViewport(v){return v.set(0,0,400,300);}getScissor(v){return v.set(0,0,400,300);}getScissorTest(){return false;}setViewport(){}setScissor(){}setScissorTest(){}render(){}};
const source=fs.readFileSync('dist/src/main.js','utf8').replace(/from '\.\/([^']+)'/g,(_,f)=>`from '${pathToFileURL(process.cwd()+'/dist/src/'+f)}'`).replace('new THREE.WebGLRenderer(','new globalThis.__BootRenderer(').replace("import * as THREE from 'three'",`import * as THREE from '${pathToFileURL(process.cwd()+'/node_modules/three/build/three.module.js')}'`);
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const game=__game,frame=nextFrame;el('startBtn').onclick();game.equipment.previewRenderer=new __BootRenderer();let clock=performance.now();Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
const draw=(count=1)=>{for(let i=0;i<count;i++){clock+=1000/60;for(const job of rafJobs.splice(0))job(clock);frame();}};
const key=(type,code,value)=>{for(const fn of input[type]||[])fn({code,key:value,repeat:false,target:document.activeElement||{tagName:'BODY'},preventDefault(){}});};
const press=(code,value)=>{key('keydown',code,value);key('keyup',code,value);};
const event=type=>{for(const fn of input[type]||[])fn();};
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
const home=LAYOUT.dewGlade.home,reset=()=>{event('blur');event('focus');game.P.pos.set(home.x,heightAt(home.x,home.z+1.4),home.z+1.4);game.P.vel.set(0,0,0);game.P.vy=0;game.P.grounded=true;game.P.idle=0;game.cat.root.position.copy(game.P.pos);game.cam.target.copy(game.P.pos);draw(3);};
reset();for(let i=0;i<240&&!game.dewNpc;i++){draw();if(game.dewLoading)await game.dewLoading;else await new Promise(r=>setTimeout(r,10));}
assert(game.detailStream.enabled,'static/lazy world initialization must finish');assert(game.dewNpc&&game.dewGame,'nearby lazy loading must create the real NPC and quest');
const npc=game.dewNpc,quest=game.dewGame;reset();draw(2);assert.equal(el('actPrompt').dataset.target,'dew');assert(!el('actPrompt').hidden);assert(el('actPrompt').textContent.includes('E'));
assert.equal(npc.collider.noFloor,true);assert(Math.abs(groundAt(npc.position.x,npc.position.z,npc.position.y+3,.42)-heightAt(npc.position.x,npc.position.z))<.02,'NPC must not become a moving platform');
const dialogs=[];let answer;quest.dialog=args=>{dialogs.push(args);return new Promise(resolve=>{answer=resolve;});};
const blockedModes=[
 ['equipment',()=>press('KeyB','b'),()=>press('KeyB','b')],
 ['character menu',()=>el('bCharacter').onclick(),()=>el('startBtn').onclick()],
 ['sitting',()=>press('KeyC','c'),()=>press('KeyC','c')],
 ['airborne',()=>{game.P.grounded=false;game.P.pos.y+=2;game.P.vy=0;},()=>{game.P.grounded=true;}],
 ['catbus',()=>{game.catbus.riding=true;},()=>{game.catbus.riding=false;el('busDialog').hidden=true;}],
 ['blur',()=>event('blur'),()=>event('focus')],
 ['hidden document',()=>{document.hidden=true;},()=>{document.hidden=false;}],
 ['weather menu',()=>{el('weatherPanel').hidden=false;},()=>{el('weatherPanel').hidden=true;}],
];
for(const [name,enter,leave]of blockedModes){reset();const count=dialogs.length;enter();assert(!quest.canInteract(),`${name}: must not invite`);press('KeyE','e');assert.equal(dialogs.length,count,`${name}: E opened dew conversation`);leave();reset();}
key('keydown','KeyW','w');game.talkToDewFriend();assert(quest.modal);assert.equal(game.P.vel.length(),0);assert(!game.sprint.autoForward);const pausedAt=game.P.pos.clone();draw(15);assert(game.P.pos.distanceTo(pausedAt)<1e-8,'modal prevents walking');answer('start');await flush();assert(quest.active&&!quest.modal);draw(10);assert(game.P.pos.distanceTo(pausedAt)<1e-8,'closing dialog clears held movement');key('keyup','KeyW','w');
game.cam.yaw=Math.PI/2;key('keydown','KeyW','w');draw(18);key('keyup','KeyW','w');assert(game.P.pos.distanceTo(pausedAt)>.15,'active quest must allow normal walking');event('blur');event('focus');draw();assert.equal(quest.state.progress,0);
// Each interruption is exercised with an accepted, collecting task. No direct
// reward/state mutation: restarting after interruption goes through conversation.
const answerInteract=async value=>{game.talkToDewFriend();assert(quest.modal);answer(value);await flush();};
const walkTo=target=>{for(let i=0;i<400;i++){const dx=target.x-game.P.pos.x,dz=target.z-game.P.pos.z,d=Math.hypot(dx,dz);if(d<.025)break;const amount=Math.min(.035,d);game.P.pos.x+=dx/d*amount;game.P.pos.z+=dz/d*amount;game.P.pos.y=heightAt(game.P.pos.x,game.P.pos.z);game.P.vel.set(0,0,0);game.P.vy=0;game.P.grounded=true;draw();}};
for(const [name,enter,leave]of blockedModes){
 reset();if(quest.state.phase==='collecting'){event('blur');draw();event('focus');}assert.equal(quest.state.phase,'paused');await answerInteract('resume');assert.equal(quest.state.phase,'collecting');
 walkTo({x:home.x+1.2,z:home.z+.8});walkTo({x:home.x+1.2,z:home.z-1.3});const node=quest.nodes[0];walkTo({x:node.x+.75,z:node.z});assert.equal(quest.state.progress,0);
 enter();draw(2);assert.equal(quest.state.phase,'paused',`${name}: collection should pause`);for(let i=0;i<24;i++){game.P.pos.copy(node);draw();}assert.equal(quest.state.progress,0,`${name}: collection must remain blocked`);leave();reset();
}
await answerInteract('resume');walkTo({x:home.x+1.2,z:home.z+.8});walkTo({x:home.x+1.2,z:home.z-1.3});walkTo(quest.nodes[0]);draw(20);assert.equal(quest.state.progress,1,'walking to the actual node resumes collection');
console.log(JSON.stringify({realMainLazyNPC:'PASS',interactionPrompt:'PASS',blockedInvitationAndCollection:blockedModes.map(x=>x[0]),modalClearsInput:'PASS',activeAllowsWalking:'PASS',physicalCollection:'PASS',noMovingPlatform:'PASS',webgl:'Substituted renderer; actual world, GLB, main and collisions executed'},null,2));
