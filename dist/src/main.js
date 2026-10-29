import {TreeOcclusion} from './tree-occlusion.js';
import {addElderTree,updateElderGlade,inElderRiver,onElderBridge} from './elder-tree.js';
import {moveWithCollisions} from './collision.js';
import {planStartup,finishStartup,detailStream} from './asset-stream.js';
import {canopySnow,SunShafts} from './forest-weather.js';
import {addEnchantedGrove,updateCrystals} from './enchanted-grove.js';
import {addFantasyEcology,FANTASY_ASSET_FILES} from './fantasy-ecology.js';
import {CatBus} from './catbus.js';
import {cameraBasis,removeReverseInertia} from './locomotion.js';
import {ForestLife} from './forest-life.js';
import {SnowTracks} from './snow-tracks.js';
// 脏脏包的龙猫森林 — main game loop
import * as THREE from 'three';
import { furEnv } from './fur.js';
import { LAYOUT, heightAt, buildTerrain, buildGrass, buildFlowers, grassUniforms, setTerrainSnow, edgeRadius, inLakeWater, lakeDist } from './terrain.js';
import {
  buildWorld, colliders, groundAt, skyUniforms, cloudMat, windowMats, floatUniforms, Rain, Acorns, sproutTree,
  nearStructure, lampLight, lampBulbMat, waterMat,
} from './world.js';
import {CharacterRoster,CHARACTER_DEFS} from './characters.js';
import {EquipmentPanel} from './equipment.js';
import {Snow} from './weather.js';
import { BigTotoro, SmallTotoro, SootSprites } from './totoro.js';
import { Sound } from './audio.js';
import { TotoroRainGame } from './minigames/totoro-rain.js';
import { RoarContest } from './minigames/roar-contest.js';
import { FishingGame, FISH } from './minigames/fishing.js';
import { showDialog, isDialogOpen, KEEPER_FACE } from './minigames/dialog.js';
import { loadJournal, saveJournal } from './minigames/journal.js';
import { buildLake, onPier, FISHING_SPOT, KEEPER_POS } from './lake.js';
import { loadDreamWorld, updateDream, magicTreePrototype } from './dream.js';

const params = new URLSearchParams(location.search);
const LOW = params.get('q') === 'low' || (params.get('q') !== 'high' && matchMedia('(pointer: coarse)').matches);

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW ? 1 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#cfe3e6', 40, 150);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 1200);

const hemi = new THREE.HemisphereLight('#cfe6ff', '#6d8a4a', 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const roster=new CharacterRoster(scene);
let savedCharacter='zangzangbao';try{savedCharacter=localStorage.getItem('zzb-forest-character')||savedCharacter;}catch{}
const requestedCharacter=params.get('character')||savedCharacter;
const initialCharacter=CHARACTER_DEFS[requestedCharacter]?requestedCharacter:'zangzangbao';
const worldFiles=['forest-tree','forest-tree-lod','broadleaf-tree','broadleaf-tree-lod','fantasy-tree','fantasy-tree-lod','treehouse','shrine-lod','pagoda-lod','temple-lod','japanese-house','sakura-lod','crystal-lod'].map(n=>'assets/'+n+'.glb');
const actorFile=initialCharacter==='zangzangbao'?'assets/cat-rig.glb':'assets/characters/'+initialCharacter+'.glb';
let savedOutfits={};try{savedOutfits=JSON.parse(localStorage.getItem('zzb-outfits-v12')||'{}');}catch{}
const savedOutfit=savedOutfits[initialCharacter],outfitFile=savedOutfit&&savedOutfit!=='original'?'assets/characters/'+savedOutfit+'.glb':null;
planStartup([...worldFiles,...FANTASY_ASSET_FILES,actorFile,...(outfitFile?[outfitFile]:[])]);
const characterReady=roster.select(initialCharacter);
// ---------------- world ----------------
scene.add(buildTerrain());
buildWorld(scene);
const lake = buildLake(scene, colliders);
await loadDreamWorld(scene, LOW,{progressive:true});
await addEnchantedGrove(scene,LOW,{progressive:true});
const fantasyEcology = await addFantasyEcology(scene);
scene.add(buildGrass(LOW ? 15000 : 38000, (x, z) => nearStructure(x, z, 0)));
scene.add(buildFlowers(LOW ? 250 : 520, (x, z) => nearStructure(x, z, 0.5)));
const rain = new Rain(scene);
const snow = new Snow(scene,{low:LOW,pixelRatio:renderer.getPixelRatio()});
const acorns = new Acorns(scene);
const snowTracks=new SnowTracks(scene);
const sprout = sproutTree(magicTreePrototype);
scene.add(sprout.group);

const totoro = new BigTotoro(scene);
const chu = new SmallTotoro(scene, 'chu', { x: -8, z: -4 });
const chibi = new SmallTotoro(scene, 'chibi', { x: -1, z: -7 });
const soot = new SootSprites(scene, 14);

const sound = new Sound();
let catbus=CatBus.pending();
const sunShafts=new SunShafts(scene,LOW);
const treeOcclusion=new TreeOcclusion(scene);

// ---------------- selectable protagonists ----------------
await characterReady;
let cat=roster.active,characterId=roster.id,selectionSerial=0,switching=false,characterMenuOpen=true;
const P = {
  pos: new THREE.Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z),
  vel: new THREE.Vector3(), vy: 0, grounded: true, heading: Math.PI, idle: 0, coyote: 0, jumpBuf: 0,
};
P.pos.y = heightAt(P.pos.x, P.pos.z);
cat.root.position.copy(P.pos);
const life=new ForestLife(roster,colliders);
let extrasStarted=false;
function loadExtras(){if(extrasStarted)return;extrasStarted=true;
 // Decode optional assets after entry, one at a time; detail streaming starts last.
 Promise.resolve().then(()=>addElderTree(scene)).catch(console.error).then(()=>CatBus.create(scene,colliders)).then(bus=>{catbus=bus;}).catch(console.error).then(()=>life.populate()).catch(console.error).finally(()=>{detailStream.enabled=true;});
}
const CAT_R = 0.42;

// Totoro is a big soft trampoline
colliders.push({
  type: 'circle', x: LAYOUT.totoro.x, z: LAYOUT.totoro.z, r: 1.9, top: 999,
  onHit(n) {
    if (!totoro.bounce()) return;
    P.vel.set(n.x * 6.5, 0, n.z * 6.5);
    P.vy = 10.5; P.grounded = false;
    cat.land(4);
    sound.boing();
    say(['噗叽~', 'boing!', '软乎乎~', '肚子好弹！'][Math.floor(Math.random() * 4)], () => totoroHead(), 1.4, true);
  },
});

// ---------------- camera ----------------
const cam = { yaw: 0.35, pitch: 0.32, dist: 5.8, target: new THREE.Vector3().copy(P.pos), dragging: false };
if (params.get('cam')) {
  const v = params.get('cam').split(',').map(Number);
  cam.fixed = { pos: new THREE.Vector3(v[0], v[1], v[2]), look: new THREE.Vector3(v[3], v[4], v[5]) };
}

// ---------------- input ----------------
const keys = {};
let started = false;
addEventListener('keydown', (e) => {
  if (!started || busy() || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if(!$('busDialog').hidden){if(k==='escape')$('busDialog').hidden=true;return;}
  if(catbus.riding&&k!=='e'&&k!=='escape')return;
  if(k==='b'&&!e.repeat){e.preventDefault();if(!characterMenuOpen&&!switching&&P.grounded)equipment.setOpen(!equipment.open);return;}
  if(equipment.open){if(k==='escape')equipment.setOpen(false);return;}
  if(e.repeat && [' ','e','j','k','c','x'].includes(k))return;
  keys[k] = true; keys[e.code] = true;
  if (k === ' ') { P.jumpBuf = 0.15; e.preventDefault(); }
  if (k === 'e') {if(!catbus.riding&&nearKeeper())talkToKeeper();else if(catbus.riding||P.pos.distanceTo(catbus.root.position)<6&&!nearTotoro())openBusDialog();else meow();}
  if(k==='j')performAction(0);
  if(k==='k')performAction(1);
  if (k === 'r') toggleRain();
  if (k === 'v') toggleSnow();
  if (k === 'n') toggleNight();
  if (k === 'c') { P.idle = 15; }
  if (k === 'x') { P.idle = 9; }
  if (k === 'h') toggleUI();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; keys[e.code] = false; });
function clearMovement(){for(const k in keys)keys[k]=false;touch.x=touch.y=0;P.vel.set(0,0,0);P.jumpBuf=0;dragId=null;}
addEventListener('blur',clearMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovement();});

const canvas = renderer.domElement;
let lastX = 0, lastY = 0, dragId = null;
canvas.addEventListener('pointerdown', (e) => {
  if(!started||characterMenuOpen||equipment.open||busy())return;
  if(e.pointerType==='mouse'&&canvas.requestPointerLock){try{const p=canvas.requestPointerLock();p?.catch(()=>{});}catch{} }
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45) return;
  dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if(document.pointerLockElement===canvas)return;
  if (e.pointerId !== dragId) return;
  cam.yaw -= (e.clientX - lastX) * 0.006;
  cam.pitch = Math.max(-0.15, Math.min(1.25, cam.pitch + (e.clientY - lastY) * 0.005));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('pointerup', (e) => { if (e.pointerId === dragId) dragId = null; });
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||equipment.open||characterMenuOpen)return;cam.yaw-=THREE.MathUtils.clamp(e.movementX,-160,160)*.0022;cam.pitch=THREE.MathUtils.clamp(cam.pitch+THREE.MathUtils.clamp(e.movementY,-120,120)*.0018,-.15,1.1);});
document.addEventListener('pointerlockchange',()=>{dragId=null;for(const k in keys)keys[k]=false;touch.x=touch.y=0;});
canvas.addEventListener('pointercancel',()=>dragId=null);
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(2.2, Math.min(16, cam.dist * (1 + e.deltaY * 0.001))); e.preventDefault(); }, { passive: false });

// touch joystick
const touch = { x: 0, y: 0, run: false };
if (matchMedia('(pointer: coarse)').matches || params.has('touch')) {
  document.body.classList.add('touch');
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); moveStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  function moveStick(e) {
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = 50;
    if (d > m) { dx *= m / d; dy *= m / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.x = dx / m; touch.y = -dy / m;
  }
  document.getElementById('tJump').addEventListener('pointerdown', (e) => { e.preventDefault(); P.jumpBuf = 0.15; P.idle = 0; });
  document.getElementById('tMeow').addEventListener('pointerdown', (e) => { e.preventDefault(); meow(); });
  const tRun = document.getElementById('tRun');
  tRun.addEventListener('pointerdown', (e) => { e.preventDefault(); touch.run = !touch.run; tRun.classList.toggle('on', touch.run); });
}

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
$('acornTotal').textContent = acorns.total;
function openBusDialog(){if(!started||characterMenuOpen||equipment.open)return;if(document.pointerLockElement)document.exitPointerLock();clearMovement();$('busDialog').hidden=false;$('busMessage').textContent=catbus.riding?'想在这里歇一歇吗？我会慢慢停稳，再让你下车。':'喵～要搭一程吗？我们慢慢逛森林，不赶时间。';$('busClose').focus();$('busBoard').hidden=catbus.riding;$('busExit').hidden=!catbus.riding;}
$('busPrompt').onclick=openBusDialog;
$('actPrompt').onclick=()=>{if($('actPrompt').dataset.target==='keeper')talkToKeeper();else meow();};
$('busClose').onclick=()=>{$('busDialog').hidden=true;};
$('busBoard').onclick=()=>{if(catbus.speed>.05){$('busMessage').textContent='等我停稳一下，再点「上车慢游」就好。';return;}catbus.riding=true;catbus.stopping=false;catbus.wait=1;cat.model.rotation.y=0;cat.oneShot=null;P.jumpBuf=0;clearMovement();$('busDialog').hidden=true;};
$('busExit').onclick=()=>{catbus.stopping=true;$('busDialog').hidden=true;toast('猫车正在缓缓停车…');};

const env = { rain: 0, snow: 0, night: 0, rainT: 0, snowT: 0, nightT: 0, sun:1, sunT:1 };
if (params.has('rain')) env.rain = env.rainT = 1;
if (params.has('night')) env.night = env.nightT = 1;
if(params.has('snow')){env.snow=env.snowT=1;env.rain=env.rainT=0;}
function currentWeather(){return env.snowT?'snow':env.rainT?'rain':env.nightT?'night':env.sunT?'sun':'cloud';}
function syncWeatherUI(){const chosen=currentWeather();for(const [id,value]of [['bSun','sun'],['bCloud','cloud'],['bRain','rain'],['bSnow','snow'],['bNight','night']]){$(id).classList.toggle('on',chosen===value);$(id).setAttribute('aria-pressed',String(chosen===value));}$('bWeather').textContent=({sun:'☀',cloud:'☁',rain:'☂',snow:'❄',night:'☾'}[chosen])+' 天气';}
function chooseWeather(type){env.rainT=+(type==='rain');env.snowT=+(type==='snow');env.nightT=+(type==='night');env.sunT=+(type==='sun');syncWeatherUI();closePopover('weather');}
function toggleRain(){chooseWeather(currentWeather()==='rain'?'sun':'rain');}
function toggleSnow(){chooseWeather(currentWeather()==='snow'?'sun':'snow');}
function toggleNight(){chooseWeather(currentWeather()==='night'?'sun':'night');}
function closePopover(name){$(name+'Panel').hidden=true;$(name==='weather'?'bWeather':'bHelp').setAttribute('aria-expanded','false');}
function togglePopover(name){const panel=$(name+'Panel'),open=panel.hidden;closePopover(name==='weather'?'help':'weather');panel.hidden=!open;$(name==='weather'?'bWeather':'bHelp').setAttribute('aria-expanded',String(open));if(open){if(document.pointerLockElement)document.exitPointerLock();clearMovement();$(name+'Close').focus();}}
$('bWeather').onclick=()=>togglePopover('weather');$('bHelp').onclick=()=>togglePopover('help');$('weatherClose').onclick=()=>{closePopover('weather');$('bWeather').focus();};$('helpClose').onclick=()=>{closePopover('help');$('bHelp').focus();};
$('bSun').onclick=()=>chooseWeather('sun');$('bCloud').onclick=()=>chooseWeather('cloud');
addEventListener('keydown',e=>{if(e.key==='Escape'){closePopover('weather');closePopover('help');}});
document.addEventListener('pointerdown',e=>{for(const n of ['weather','help']){const b=$(n==='weather'?'bWeather':'bHelp');if(!$(n+'Panel').contains(e.target)&&!b.contains(e.target))closePopover(n);}});
function toggleUI() { document.body.classList.toggle('hidden-ui'); }
$('bMusic').onclick=()=>{if(document.pointerLockElement)document.exitPointerLock();$('musicPanel').hidden=!$('musicPanel').hidden;};
$('musicClose').onclick=()=>{$('musicPanel').hidden=true;};
$('musicVolume').oninput=e=>sound.setMusicVolume(Number(e.target.value)/100);
$('musicFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await sound.loadMusic(file);$('musicName').textContent='当前：'+file.name;}catch{$('musicName').textContent='无法播放这个格式，请选择 MP3、WAV 或 OGG。';}};
$('nextMusic').onclick=()=>{sound.init();sound.nextTrack();$('musicName').textContent='当前：原创 · '+sound.currentTrack;};
$('forestMusic').onclick=()=>{sound.useForestMusic();$('musicName').textContent='当前：原创 · '+sound.currentTrack;};
$('bKick1').onclick=()=>performAction(0);
$('bKick2').onclick=()=>performAction(1);
$('bSnow').onclick=toggleSnow;syncWeatherUI();
$('bRain').onclick = toggleRain; $('bNight').onclick = toggleNight; $('bHide').onclick = toggleUI;
$('bSound').onclick = () => { sound.setEnabled(!sound.enabled); $('bSound').classList.toggle('on', sound.enabled); $('bSound').textContent = sound.enabled ? '🔊' : '🔇'; };
const equipment=new EquipmentPanel({renderer,getActor:()=>cat,getCharacter:()=>({id:characterId,name:CHARACTER_DEFS[characterId].name}),getAcorns:()=>({count:Number($('acornCount').textContent),total:acorns.total}),onToggle:()=>{P.vel.set(0,0,0);P.jumpBuf=0;P.idle=0;touch.x=touch.y=0;for(const k in keys)keys[k]=false;$('musicPanel').hidden=true;}});
$('bEquipment').onclick=()=>{if(catbus.riding){toast('先让猫车停稳下车，再打开行囊吧');return;}if(started&&!characterMenuOpen&&!switching){if(!P.grounded){toast('先落到地面，再打开行囊吧');return;}equipment.setOpen(!equipment.open);}};
function syncCharacterUI(){
 equipment.apply();equipment.sync();
 const def=CHARACTER_DEFS[characterId],isCat=characterId==='zangzangbao';
 for(const b of document.querySelectorAll('[data-character]')){const active=b.dataset.character===characterId;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
 $('characterName').textContent=def.name;$('characterPortrait').src=def.image;$('titlePortrait').src=def.image;$('titlePortrait').alt=def.name;$('characterSubtitle').textContent=def.name+'的夏日散步';
 $('characterNote').textContent=def.subtitle;$('tMeow').textContent=isCat?'喵':'招呼';$('interactionGuide').textContent=isCat?'喵一声（对龙猫喵试试看）':'和森林里的朋友打个招呼';
 def.actions.forEach(([_,label],i)=>{const key=i?'K':'J',button=$(i?'bKick2':'bKick1');button.innerHTML='<kbd>'+key+'</kbd> '+label;button.title=key+'：'+label;});
 $('gestureGuide').textContent=def.actions.map(a=>a[1]).join(' / ')+(isCat?'（连按可衔接）':'');
 $('hint').textContent='WASD 移动 · Shift 跑 · 空格 跳 · E '+(isCat?'喵':'招呼')+' · J / K 角色动作 · B 装备 · C 坐下 · 点击画面锁定鼠标转视角 · Esc 释放';
}
async function selectCharacter(id){
 const ticket=++selectionSerial;switching=true;$('startBtn').disabled=true;$('loadStatus').textContent='加载角色…';
 try{const selected=await roster.select(id);if(ticket!==selectionSerial||!selected)return;cat=roster.active;characterId=roster.id;P.pos.copy(cat.root.position);P.heading=cat.root.rotation.y;P.vel.set(0,0,0);P.vy=0;P.grounded=true;P.idle=0;P.jumpBuf=0;cam.target.copy(P.pos);syncCharacterUI();try{localStorage.setItem('zzb-forest-character',characterId);}catch{}$('loadStatus').textContent='';}
 catch(error){if(ticket===selectionSerial)$('loadStatus').textContent='这个角色暂时没能加载，请再点一次。当前角色仍可游玩。';console.error(error);}
 finally{if(ticket===selectionSerial){switching=false;$('startBtn').disabled=false;$('startBtn').textContent=started?'继续散步 →':'走进森林 →';}}
}
for(const b of document.querySelectorAll('[data-character]'))b.onclick=()=>selectCharacter(b.dataset.character);
$('bCharacter').onclick=()=>{if(catbus.riding){toast('先下车，再换一位伙伴吧');return;}if(document.pointerLockElement)document.exitPointerLock();characterMenuOpen=true;P.vel.set(0,0,0);P.jumpBuf=0;for(const k in keys)keys[k]=false;touch.x=touch.y=0;P.heading=cam.yaw;$('title').classList.remove('hide');$('loadingWallpaper').play?.()?.catch?.(()=>{});$('startBtn').textContent='继续散步 →';$('startBtn').focus();};
syncCharacterUI();



let toastTimer = 0;
function toast(msg, dur = 2.6) { const t = $('toast'); t.innerHTML = msg; t.classList.add('show'); toastTimer = dur; }

const bubbles = [];
function say(text, anchor, dur = 1.6, big = false) {
  const el = document.createElement('div');
  el.className = 'bubble' + (big ? ' big' : '');
  el.textContent = text;
  document.body.appendChild(el);
  bubbles.push({ el, anchor, t: dur });
}
const tmpV = new THREE.Vector3();
const catHead = () => cat.getHeadWorld(tmpV).add(new THREE.Vector3(0, 0.5, 0));
const totoroHead = () => tmpV.set(totoro.group.position.x, totoro.group.position.y + 4.6, totoro.group.position.z);

function startGame() {
  if(switching)return;const first=!started;
  started = true;characterMenuOpen=false;
  $('title').classList.add('hide');$('loadingWallpaper').pause?.();
  sound.init();
  requestAnimationFrame(()=>setTimeout(loadExtras,150));
  if (first&&!params.has('hideui')) setTimeout(() => toast('欢迎回到森林！<br>J / K 试试角色动作，东南方有鸟居山道', 4), 600);
}
$('startBtn').onclick = startGame;
if (params.has('auto')) startGame();
if(params.has('equipment'))equipment.setOpen(true);
if (params.has('hideui')) toggleUI();

// ---------------- actions ----------------
function performAction(index){if(catbus.riding)return;if(!started||characterMenuOpen||switching||equipment.open||!P.grounded)return;const action=CHARACTER_DEFS[characterId].actions[index][0];if(cat.triggerAction(action)){P.idle=0;P.vel.multiplyScalar(.08);}}

let roarGust = 0, pendingRoar = -1, pendingInvite = false, inviteT = -1;
// 龙猫大人的小游戏：吼完一声后邀请玩家玩《咚！伞上的雨滴》
const totoroGame = new TotoroRainGame({
  sound,
  getPlayerName: () => CHARACTER_DEFS[characterId].name,
  onOpen() { if (document.pointerLockElement) document.exitPointerLock(); clearMovement(); },
  onClose(result) {
    clearMovement(); totoroCD = 4;
    if (!result) { say('呼噜……下次再来玩哦', totoroHead, 2); return; }
    soot.scatter(new THREE.Vector3(LAYOUT.totoro.x, 0, LAYOUT.totoro.z), 30);
    if (result.stars > 0) {
      say('呼噜噜～谢谢你！', totoroHead, 2.4, true);
      const gifts = result.gained.map((g) => g.icon + ' ' + g.name + (g.count > 1 ? ' ×' + g.count : '')).join('、');
      toast(`${'★'.repeat(result.stars)} 龙猫大人很开心！<br>${gifts ? '收到：' + gifts : '叶子伞已经在你的手账里啦'}`, 4.5);
    } else say('雨声还不够响呢～再来！', totoroHead, 2.2);
  },
});
// ---------------- v20: who can we talk to, and the new mini-games ----------------
const TOTORO_TALK = 5.2, KEEPER_TALK = 3.2;
let totoroCD = 0, keeperTalking = false;
const nearTotoro = () => Math.hypot(P.pos.x - LAYOUT.totoro.x, P.pos.z - LAYOUT.totoro.z) < TOTORO_TALK;
const nearKeeper = () => Math.hypot(P.pos.x - KEEPER_POS.x, P.pos.z - KEEPER_POS.z) < KEEPER_TALK;
function busy() { return totoroGame.open || roarContest.open || fishing.open || keeperTalking || isDialogOpen(); }
function enterMinigame() { if (document.pointerLockElement) document.exitPointerLock(); clearMovement(); document.body.classList.add('minigame'); }
function leaveMinigame() { clearMovement(); document.body.classList.remove('minigame'); }
const roarContest = new RoarContest({
  totoro, sound, say, totoroHead: () => totoroHead(),
  soot: () => soot.scatter(new THREE.Vector3(LAYOUT.totoro.x, 0, LAYOUT.totoro.z), 40),
  shot(on) {
    if (!on) { delete cam.fixed; return; }
    const T = new THREE.Vector3(LAYOUT.totoro.x, P.pos.y, LAYOUT.totoro.z), toP = P.pos.clone().sub(T).setY(0).normalize();
    P.heading = Math.atan2(-toP.x, -toP.z);
    // over-the-shoulder: behind and a little beside the player, looking up at Totoro's face
    const side = new THREE.Vector3(-toP.z, 0, toP.x);
    cam.fixed = { pos: P.pos.clone().addScaledVector(toP, 4.2).addScaledVector(side, 1.6).add(new THREE.Vector3(0, 1.9, 0)), look: T.clone().addScaledVector(toP, 0.6).add(new THREE.Vector3(0, 2.6, 0)) };
  },
  onOpen: enterMinigame,
  onClose(result) {
    leaveMinigame(); totoroCD = 4;
    if (!result) { say('呼噜……下次再来比哦', totoroHead, 2); return; }
    if (result.stars > 0) {
      totoro.grin = 2; say('嗷呜～你吼得真好！', totoroHead, 2.4, true);
      const gifts = result.gained.map((g) => g.icon + ' ' + g.name + (g.count > 1 ? ' ×' + g.count : '')).join('、');
      toast(`${'★'.repeat(result.stars)} 月下吼叫大会<br>${gifts ? '收到：' + gifts : '礼物已经在你的手账里啦'}`, 4.5);
    } else say('嘿嘿，再大声一点！', totoroHead, 2.2);
  },
});
const fishing = new FishingGame({
  scene, camera, sound, shadows: lake.shadows, getNight: () => env.night,
  onOpen() {
    enterMinigame(); document.body.classList.add('fishing');
    P.pos.set(FISHING_SPOT.x, FISHING_SPOT.y, FISHING_SPOT.z); P.heading = Math.PI; cat.root.position.copy(P.pos); cat.root.visible = false;
  },
  onClose(session) {
    leaveMinigame(); document.body.classList.remove('fishing');
    cat.root.visible = true; cam.yaw = 0; cam.pitch = 0.3; cam.target.copy(P.pos);
    const n = session?.caught.length || 0;
    if (n) { const best = session.caught.slice().sort((a, b) => b.weight - a.weight)[0]; toast(`今天钓到 ${n} 条～<br>最大的是 ${best.name} ${best.weight} 公斤`, 4); }
    lake.talk(2); say(n ? '收获不错嘛，常来啊！' : '钓鱼嘛，急不得～', lake.keeperHead, 2.2);
  },
});
async function talkToKeeper() {
  if (busy() || !started || characterMenuOpen) return;
  keeperTalking = true; enterMinigame(); lake.talk(30);
  const j = loadJournal(), first = !j.flags?.metKeeper, dex = FISH.filter((f) => j.fish[f.id]?.count).length;
  const name = CHARACTER_DEFS[characterId].name;
  const lines = first
    ? ['哦？！……吓我一跳。好久没人走到这么北边来了。', '我是这片星湖的湖守，大家都叫我阿渔伯。湖里住着好多古怪的鱼——有的胆小，有的力气大得能把人拖下水。', `${name}，想试试吗？鱼竿借你。按住往后拉竿、松手抛出去；浮漂沉下去再提竿——然后，别跟鱼硬拼。`]
    : dex >= FISH.length ? ['……你把湖里的家伙都认全了？连湖主都见过了？了不起，了不起。', '那就随便钓钓，吹吹湖风吧。']
    : [['今天风不错，鱼会往远处游。抛远一点试试。', '天黑以后，湖底那位大胡子老前辈会出来散步哦。', '要是抛竿时力度刚好落在金色那一格……嘿，湖主说不定会看你一眼。'][Math.floor(Math.random() * 3)], `你的鱼类图鉴：${dex} / ${FISH.length}。还差几位没见过呢。`];
  if (first) { j.flags = { ...(j.flags || {}), metKeeper: true }; saveJournal(j); }
  const face = KEEPER_FACE, speaker = '湖守 · 阿渔伯', color = '#e07b39', blip = null;
  let choice = await showDialog({ speaker, color, face, lines, choices: [{ label: '开始钓鱼！', value: 'fish', main: true }, { label: '讨教钓鱼诀窍', value: 'tips' }, { label: '先不了', value: null }] });
  if (choice === 'tips') choice = await showDialog({ speaker, color, face, lines: [
    '抛竿：按住时力度条会来回摆，摆到金色那一格松手，抛得最远，也最容易遇到稀有鱼。',
    '浮漂轻轻点两下，是鱼在试探——千万别动！整个沉下去才提竿，只有不到一秒的时间。',
    '收线时盯着张力条：太紧会断线，太松鱼会脱钩。鱼往左游，你就把竿往右拉，它很快就没力气了。',
    '鱼跳出水面时一定要松手！等它翻出白肚皮，就可以放心狂收线啦。'],
    choices: [{ label: '开始钓鱼！', value: 'fish', main: true }, { label: '下次再来', value: null }] });
  keeperTalking = false; lake.talk(0);
  if (choice === 'fish') fishing.start(); else { leaveMinigame(); lake.talk(1.5); say('想钓的时候再来找我～', lake.keeperHead, 2); }
}
function meow() {
  if(equipment.open||characterMenuOpen||catbus.riding)return;
  P.idle = 0;
  cat.doMeow();
  if(characterId==='zangzangbao')sound.meow();
  say(characterId==='zangzangbao'?['喵~', '喵呜！', '喵？', '咪～'][Math.floor(Math.random()*4)]:'嗨，一起散步吧！',catHead,1.3);
  soot.scatter(P.pos, 6); fantasyEcology.onGreet(P.pos, say, sound);
  const dT = Math.hypot(P.pos.x - LAYOUT.totoro.x, P.pos.z - LAYOUT.totoro.z);
  // Totoro only reacts when you are right in front of him (his belly collider is ~1.9m)
  if (dT < TOTORO_TALK && totoro.roarT <= 0 && totoroCD <= 0) { pendingRoar = 0.7; pendingInvite = true; }
  for (const s of [chu, chibi]) if (Math.hypot(P.pos.x - s.pos.x, P.pos.z - s.pos.z) < 5) { s.target.set(s.pos.x * 2 - P.pos.x, 0, s.pos.z * 2 - P.pos.z); s.fleeing = true; }
}

let sproutState = 0, sproutT = 0;
function onAcorn(a, n, total) {
  sound.chime(n);
  $('acornCount').textContent = n;
  say(`🌰 ${n}/${total}`, catHead, 1.2);
  if (n === total) {
    toast('集齐了所有橡果！<br>龙猫要施展发芽魔法啦 🌱', 4);
    sproutState = 1; sproutT = 0;
  } else if (n === 1) toast('找到第一颗橡果！一共有 ' + total + ' 颗哦');
}

// sparkles for the sprouting
const sparkGeo = new THREE.BufferGeometry();
const SPN = 300; const sparkPos = new Float32Array(SPN * 3), sparkVel = [];
for (let i = 0; i < SPN; i++) sparkVel.push(new THREE.Vector3());
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#fff4b0', size: 0.18, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
sparks.frustumCulled = false;
scene.add(sparks);
function burstSparks(center) {
  for (let i = 0; i < SPN; i++) {
    sparkPos.set([center.x + (Math.random() - 0.5) * 2, center.y + Math.random() * 2, center.z + (Math.random() - 0.5) * 2], i * 3);
    sparkVel[i].set((Math.random() - 0.5) * 3, 2 + Math.random() * 5, (Math.random() - 0.5) * 3);
  }
  sparks.material.opacity = 1;
}

// ---------------- environment palette ----------------
const PAL = {
  day: { top: '#79b4c8', hor: '#f0e8c9', bot: '#b2c6a0', fog: '#d5e5cd', sun: '#ffe7b3', sunI: 2.05, hemiS: '#e2eff4', hemiG: '#8e9a70', hemiI: 1.65, furSun: [0.95, 0.86, 0.72], furAmb: [0.72, 0.7, 0.68], grass: [1, 1, 1], fogN: 32, fogF: 115, cloud: 1 },
  night: { top: '#081230', hor: '#25365a', bot: '#1a2638', fog: '#1b2944', sun: '#9fb5ff', sunI: 0.7, hemiS: '#41558a', hemiG: '#1c2a2a', hemiI: 0.55, furSun: [0.28, 0.33, 0.5], furAmb: [0.17, 0.2, 0.32], grass: [0.33, 0.4, 0.58], fogN: 25, fogF: 120, cloud: 0.25 },
  rainDay: { top: '#6c7a85', hor: '#aab4b6', bot: '#7d8c78', fog: '#9da9ab', sun: '#e6eef2', sunI: 0.8, hemiS: '#c4cfd8', hemiG: '#55654a', hemiI: 1.1, furSun: [0.45, 0.48, 0.5], furAmb: [0.48, 0.52, 0.56], grass: [0.78, 0.82, 0.82], fogN: 12, fogF: 85, cloud: 0.6 },
  rainNight: { top: '#0b1220', hor: '#1d2738', bot: '#131a22', fog: '#18212f', sun: '#8fa0c8', sunI: 0.3, hemiS: '#2f3d5a', hemiG: '#151d1d', hemiI: 0.5, furSun: [0.15, 0.17, 0.25], furAmb: [0.15, 0.17, 0.26], grass: [0.27, 0.32, 0.42], fogN: 8, fogF: 60, cloud: 0.18 },
};
for (const p of Object.values(PAL)) for (const k of ['top', 'hor', 'bot', 'fog', 'sun', 'hemiS', 'hemiG']) p[k] = new THREE.Color(p[k]);
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpPal(key, n, r, out) {
  _c1.copy(PAL.day[key]).lerp(PAL.night[key], n);
  _c2.copy(PAL.rainDay[key]).lerp(PAL.rainNight[key], n);
  return out.copy(_c1).lerp(_c2, r);
}
function lerpNum(key, n, r) {
  const a = PAL.day[key] + (PAL.night[key] - PAL.day[key]) * n;
  const b = PAL.rainDay[key] + (PAL.rainNight[key] - PAL.rainDay[key]) * n;
  return a + (b - a) * r;
}
function lerpArr(key, n, r, out) {
  const v = [0, 1, 2].map(i => {
    const a = PAL.day[key][i] + (PAL.night[key][i] - PAL.day[key][i]) * n;
    const b = PAL.rainDay[key][i] + (PAL.rainNight[key][i] - PAL.rainDay[key][i]) * n;
    return a + (b - a) * r;
  });
  return out.setRGB(v[0], v[1], v[2], THREE.SRGBColorSpace);
}
const daySun = new THREE.Vector3(0.55, 0.62, 0.35).normalize();
const moonDir = new THREE.Vector3(-0.45, 0.6, -0.4).normalize();
const sunDir = new THREE.Vector3();

function updateEnv(dt) {
  env.sun+=(env.sunT-env.sun)*Math.min(1,dt*.7);
  env.rain += (env.rainT - env.rain) * Math.min(1, dt * 0.9);
  env.snow += (env.snowT-env.snow)*Math.min(1,dt*.55);
  env.night += (env.nightT - env.night) * Math.min(1, dt * 0.7);
  const n = env.night, r = env.rain;
  lerpPal('top', n, r, skyUniforms.uTop.value);
  lerpPal('hor', n, r, skyUniforms.uHorizon.value);
  lerpPal('bot', n, r, skyUniforms.uBottom.value);
  skyUniforms.uNight.value = n; skyUniforms.uRain.value = r;
  sunDir.copy(daySun).lerp(moonDir, n).normalize();
  skyUniforms.uSunDir.value.copy(sunDir);
  lerpPal('fog', n, r, scene.fog.color);
  scene.fog.near = lerpNum('fogN', n, r); scene.fog.far = lerpNum('fogF', n, r);
  const snowLight=new THREE.Color('#e2eaf0').lerp(new THREE.Color('#6b7f9c'),n);
  scene.fog.color.lerp(snowLight,env.snow*.58);skyUniforms.uHorizon.value.lerp(snowLight,env.snow*.55);skyUniforms.uTop.value.lerp(snowLight,env.snow*.48);
  scene.fog.far=THREE.MathUtils.lerp(scene.fog.far,75,env.snow*.65);
  renderer.setClearColor(scene.fog.color);
  lerpPal('sun', n, r, sun.color); sun.intensity = lerpNum('sunI', n, r)*(1+.16*env.sun*(1-n)*(1-r)*(1-env.snow));
  lerpPal('hemiS', n, r, hemi.color); lerpPal('hemiG', n, r, hemi.groundColor); hemi.intensity = lerpNum('hemiI', n, r);
  furEnv.uSunDir.value.copy(sunDir);
  lerpArr('furSun', n, r, furEnv.uSunColor.value);
  lerpArr('furAmb', n, r, furEnv.uAmbient.value);
  furEnv.uFogColor.value.copy(scene.fog.color); furEnv.uFogNear.value = scene.fog.near; furEnv.uFogFar.value = scene.fog.far;
  lerpArr('grass', n, r, grassUniforms.uLight.value);
  grassUniforms.uFogColor.value.copy(scene.fog.color); grassUniforms.uFogNear.value = scene.fog.near; grassUniforms.uFogFar.value = scene.fog.far;
  grassUniforms.uRain.value = r;
  const cl = lerpNum('cloud', n, r);
  cloudMat.color.setScalar(cl); cloudMat.emissive.setRGB(0.49 * cl, 0.58 * cl, 0.7 * cl);
  const glow = Math.max(n, r * 0.4);
  for (const m of windowMats) m.emissiveIntensity = glow * 1.1;
  lampLight.intensity = glow * 30;
  lampBulbMat.color.setRGB(0.6 + glow * 0.6, 0.55 + glow * 0.5, 0.4 + glow * 0.3);
  floatUniforms.uNight.value = n * (1 - r * 0.7);
  waterMat.color.copy(scene.fog.color).lerp(_c1.set('#4f93a8'), 0.6);
  for(const m of cat.materials||[]) m.emissiveIntensity=(m.userData.forestGlow??.10)*(1-n*.55);
  updateDream(elapsed, n, r, P.pos);
  setTerrainSnow(env.snow);canopySnow.value=env.snow;sunShafts.update(elapsed,env.sun,n,r,env.snow);
  sound.setRain(r*(1-env.snow));
}

// ---------------- cat physics ----------------
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), dir = new THREE.Vector3(), nrm = new THREE.Vector3();
let splashCD = 0, lieSaid = false, zzzT = 0;
const previousPosition=new THREE.Vector3(),actualVelocity=new THREE.Vector3();
function updateCat(dt) {
  if(catbus.riding){catbus.seat(P.pos);P.heading=catbus.yaw;P.vel.set(0,0,0);P.vy=0;P.grounded=false;cat.root.position.copy(P.pos);cat.root.rotation.y=P.heading;cat.update(dt,{speed:0,running:false,grounded:true,vy:0,idle:10,vel:P.vel});return;}
  if(!document.getElementById('busDialog').hidden||busy()){P.vel.set(0,0,0);if(fishing.open)return;cat.update(dt,{speed:0,grounded:true,vy:0,idle:0});return;}

  if(equipment.open){cat.update(dt,{speed:0,running:false,grounded:true,vy:0,idle:0,vel:P.vel,actualVelocity:actualVelocity.set(0,0,0)});return;}
  previousPosition.copy(P.pos);
  let ix = 0, iy = 0;
  if (started&&!characterMenuOpen&&!switching) {
    if (keys['w'] || keys['arrowup']) iy += 1;
    if (keys['s'] || keys['arrowdown']) iy -= 1;
    if (keys['a'] || keys['arrowleft']) ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;
    ix += touch.x; iy += touch.y;
  }
  if (params.has('walk')) { iy = 1; if (params.get('walk') === 'run') keys['shift'] = true; }
  cameraBasis(camera,fwd,right);
  dir.set(0, 0, 0).addScaledVector(fwd, iy).addScaledVector(right, ix);
  const mag = (cat.isPerforming||characterMenuOpen||switching)?0:Math.min(1,dir.length());
  if(cat.isPerforming||characterMenuOpen||switching)dir.set(0,0,0);
  const running = keys['shift'] || keys['ShiftLeft'] || touch.run;
  if (mag > 0.05) {
    dir.normalize();
    removeReverseInertia(P.vel,dir);
    P.idle = 0;
    const tgt = Math.atan2(dir.x, dir.z);
    let d = tgt - P.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    P.heading += d * Math.min(1, dt * 10);
  } else if (P.grounded) P.idle += dt;
  if (P.jumpBuf > 0) P.idle = 0;
  const def=CHARACTER_DEFS[characterId];const speed = (running ? def.run : def.walk) * mag;
  const acc = P.grounded ? 10 : 2.5;
  P.vel.x += (dir.x * speed - P.vel.x) * Math.min(1, dt * acc);
  P.vel.z += (dir.z * speed - P.vel.z) * Math.min(1, dt * acc);

  // jump (with coyote time & buffering)
  P.coyote = P.grounded ? 0.12 : P.coyote - dt;
  P.jumpBuf -= dt;
  if (P.jumpBuf > 0 && P.coyote > 0) {
    P.vy = 8.4; P.grounded = false; P.coyote = 0; P.jumpBuf = 0;
    sound.jump();
  }
  P.vy -= 24 * dt;
  P.pos.y += P.vy * dt;
  moveWithCollisions(P.pos,P.vel.x*dt,P.vel.z*dt,CAT_R,colliders);
  const rr = Math.hypot(P.pos.x, P.pos.z);
  const er = edgeRadius(P.pos.x, P.pos.z);
  if (rr > er) { P.pos.x *= er / rr; P.pos.z *= er / rr; }
  // The lake is deep: only the pier lets you walk over the water.
  if (inLakeWater(P.pos.x, P.pos.z) && !onPier(P.pos.x, P.pos.z, -0.12)) {
    P.pos.x = previousPosition.x; P.pos.z = previousPosition.z; P.vel.x *= -0.2; P.vel.z *= -0.2;
    if (splashCD < 0) { splashCD = 2.2; sound.waterNotice(); say(characterId === 'zangzangbao' ? '湖水好深…喵不要下去！' : '湖水很深，从栈桥上走吧。', catHead, 1.6); }
  } else if (inElderRiver(P.pos.x, P.pos.z) && !onElderBridge(P.pos.x, P.pos.z, 0.12)) {
    P.pos.x = previousPosition.x; P.pos.z = previousPosition.z; P.vel.x *= -0.2; P.vel.z *= -0.2;
    if (splashCD < 0) { splashCD = 2.2; sound.waterNotice(); say(characterId === 'zangzangbao' ? '溪水好宽…喵要走树桥过去！' : '溪水环绕着古树，从东边的树桥走过去吧。', catHead, 1.6); }
  }

  // ground
  const g = groundAt(P.pos.x, P.pos.z, P.pos.y, CAT_R);
  if (P.pos.y <= g && P.vy <= 0) {
    if (!P.grounded && P.vy < -2) cat.land(-P.vy);
    P.pos.y = g; P.vy = 0; P.grounded = true;
  } else if (P.pos.y < g) {
    P.pos.y = g;
  } else if (P.grounded && P.pos.y - g < 0.3 && P.vy <= 0) {
    P.pos.y = g; P.vy = 0;
  } else P.grounded = false;

  // A gentle step back from the pond, with a quiet ripple cue.
  splashCD -= dt;
  const dp = Math.hypot(P.pos.x - LAYOUT.pond.x, P.pos.z - LAYOUT.pond.z);
  if (dp < LAYOUT.pond.r + 0.2 && P.pos.y < -0.18 && splashCD < 0) {
    splashCD = 1.8;
    nrm.set(P.pos.x - LAYOUT.pond.x, 0, P.pos.z - LAYOUT.pond.z).normalize();
    P.vel.set(nrm.x * 2.8, 0, nrm.z * 2.8); P.vy = 4.4; P.grounded = false;
    sound.waterNotice();
    say(characterId==='zangzangbao'?'爪爪碰到水啦～':'水凉凉的，慢一点走。',catHead,1.6);
  }

  if(characterMenuOpen)P.idle=0;
  cat.root.position.copy(P.pos);
  cat.root.rotation.y = P.heading;
  actualVelocity.subVectors(P.pos,previousPosition).divideScalar(Math.max(dt,.001));actualVelocity.y=0;
  cat.update(dt, { speed: Math.min(actualVelocity.length(),Math.hypot(P.vel.x,P.vel.z)), running:!!running, grounded: P.grounded, vy: P.vy, idle: P.idle, vel: P.vel, actualVelocity });

  // sleepy talk
  if (cat.lieAmt > 0.6 && !lieSaid) { lieSaid = true; say('我先躺了…', catHead, 2.2, true); zzzT = 3; }
  if (cat.lieAmt < 0.3) lieSaid = false;
  if (lieSaid) { zzzT -= dt; if (zzzT < 0) { zzzT = 3.2; say('Zzz…', catHead, 2); } }
}

// ---------------- camera update ----------------
function updateCamera(dt) {
  if (fishing.open) return;
  if (cam.fixed) { camera.position.copy(cam.fixed.pos); camera.lookAt(cam.fixed.look); return; }
  const desired = tmp2.copy(catbus.riding?catbus.root.position:P.pos).add(new THREE.Vector3(0, CHARACTER_DEFS[characterId].cameraHeight, 0));
  cam.target.lerp(desired, Math.min(1, dt * 7));
  cam.rideBlend=(cam.rideBlend||0)+((catbus.riding?1:0)-(cam.rideBlend||0))*(1-Math.exp(-1.4*dt));
  const pitch=THREE.MathUtils.lerp(cam.pitch,.32,cam.rideBlend),distance=THREE.MathUtils.lerp(cam.dist,10,cam.rideBlend);
  const cp = Math.cos(pitch);
  camera.position.set(
    cam.target.x + Math.sin(cam.yaw) * cp * distance,
    cam.target.y + Math.sin(pitch) * distance,
    cam.target.z + Math.cos(cam.yaw) * cp * distance,
  );
  const gh = Math.max(heightAt(camera.position.x, camera.position.z), -0.2) + 0.35;
  if (camera.position.y < gh) camera.position.y = gh;
  camera.lookAt(cam.target);
}
const tmp2 = new THREE.Vector3();

// ---------------- debug poses for screenshots ----------------
if (params.get('pose') === 'sit') P.idle = 9;
if (params.get('pose') === 'lie') P.idle = 20;
if (params.get('pos')) { const v = params.get('pos').split(',').map(Number); P.pos.set(v[0], heightAt(v[0], v[1]), v[1]); }
if (params.get('heading')) P.heading = Number(params.get('heading'));
if (params.get('yaw')) cam.yaw = Number(params.get('yaw'));
if (params.get('pitch')) cam.pitch = Number(params.get('pitch'));
if (params.get('dist')) cam.dist = Number(params.get('dist'));
if (params.has('roar')) setTimeout(() => { totoro.roar(); roarGust = 1; }, 300);
if (params.has('meow')) setTimeout(meow, 500);
if (params.has('sprout')) { sproutState = 1; sproutT = 3; }

// ---------------- main loop ----------------
let elapsed = 0, lastT = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 1 / 30);
  lastT = now;
  elapsed += dt;
  updateEnv(dt);
  updateCrystals(elapsed,env.night);
  updateElderGlade(elapsed,env.night); fantasyEcology.update(dt,elapsed,P.pos,env,roarGust,say,sound);
  if(started&&!characterMenuOpen&&!equipment.open)detailStream.update(dt,P.pos);
  catbus.paused=!started||characterMenuOpen||equipment.open||!$('busDialog').hidden;
  catbus.update(dt,[...roster.cache.values()].filter(a=>!(catbus.riding&&a===cat)).map(a=>a.root.position));
  $('busPrompt').hidden=!started||characterMenuOpen||equipment.open||(!catbus.riding&&P.pos.distanceTo(catbus.root.position)>6);
  {const near=!started||characterMenuOpen||equipment.open||catbus.riding||busy()?null:nearKeeper()?'keeper':nearTotoro()?'totoro':null,ap=$('actPrompt');ap.hidden=!near;if(near){$('busPrompt').hidden=true;const label=near==='keeper'?'E / 点击 · 和阿渔伯说话（钓鱼）':'E / 点击 · 和龙猫大人打招呼';if(ap.textContent!==label)ap.textContent=label;ap.dataset.target=near;}}
  $('busPrompt').textContent=catbus.riding?'猫车慢游中 · E / 点击 停车下车':'E / 点击 与猫车对话';
  if(catbus.stopping&&catbus.speed<.025&&catbus.riding){const exit=catbus.exitPoint();if(exit){catbus.riding=false;catbus.stopping=false;catbus.wait=8;P.pos.copy(exit);cat.root.position.copy(exit);P.grounded=true;P.idle=0;P.vel.set(0,0,0);toast('到啦，慢慢下车。');}}

  updateCamera(dt);
  updateCat(dt);
  if(started&&!characterMenuOpen&&!equipment.open)life.update(dt,P.pos);
  snowTracks.update(dt,env.snow);
  for(const [id,actor]of roster.cache)snowTracks.walk(id,actor.root.position,actor.root.rotation.y,env.snow,id===characterId?P.grounded:true);
  updateCamera(dt);
  fishing.update(dt);
  lake.update(dt, P.pos, env.night);

  // sun & shadow follow the cat
  sun.position.copy(P.pos).addScaledVector(sunDir, 50);
  sun.target.position.copy(P.pos);

  grassUniforms.uTime.value = elapsed;
  grassUniforms.uCat.value.copy(P.pos);
  floatUniforms.uTime.value = elapsed;
  floatUniforms.uPix.value = renderer.getPixelRatio() * innerHeight / 900;

  roarContest.update(dt);
  totoro.update(dt, P.pos, env.rain);
  chu.update(dt, P.pos, chibi);
  chibi.update(dt, P.pos, chu);
  soot.update(dt, P.pos);
  if(!catbus.riding)acorns.update(dt, P.pos, onAcorn);
  rain.update(dt, camera.position, env.rain*(1-env.snow));
  snow.update(dt,camera.position,env.snow,env.night);

  // Totoro's roar
  if (pendingRoar > 0) {
    pendingRoar -= dt;
    if (pendingRoar <= 0 && totoro.roar()) {
      roarGust = 1; sound.roar();
      say('嗷呜————！', totoroHead, 2, true);
      soot.scatter(new THREE.Vector3(LAYOUT.totoro.x, 0, LAYOUT.totoro.z), 40);
      if (pendingInvite) { pendingInvite = false; inviteT = 2.1; }
    }
  }
  totoroCD -= dt;
  // Rainy days: Totoro wants to catch raindrops; otherwise: the moonlit roar contest.
  if (inviteT > 0) { inviteT -= dt; if (inviteT <= 0 && started && !characterMenuOpen && !equipment.open && !catbus.riding && !busy() && nearTotoro()) { if (env.rain > 0.3) totoroGame.invite(); else roarContest.invite(CHARACTER_DEFS[characterId].name); } }
  if (totoro.roarT > 0.2) roarGust = Math.min(1, roarGust + dt * 3); else roarGust = Math.max(0, roarGust - dt * 1.5);
  grassUniforms.uRoar.value.set(LAYOUT.totoro.x, LAYOUT.totoro.z, roarGust * 1.4, 0);
  if (roarContest.open && roarContest.gust > 0.05) grassUniforms.uRoar.value.set(P.pos.x, P.pos.z, roarContest.gust * 1.8, 0);
  const toCat = new THREE.Vector3(P.pos.x - LAYOUT.totoro.x, 0, P.pos.z - LAYOUT.totoro.z);
  const dT = toCat.length(); toCat.normalize();
  furEnv.uWind.value.copy(toCat).multiplyScalar(roarGust * 3.5 * Math.exp(-dT * 0.12));

  // sprout magic
  if (sproutState === 1) {
    sproutT += dt;
    if (sproutT > 1.5 && totoro.roarT <= 0 && !sprout.roared) { sprout.roared = true; totoro.roar(); sound.roar(); roarGust = 1; }
    if (sproutT > 2.5) {
      if (!sprout.burst) { sprout.burst = true; burstSparks(sprout.group.position); chu.home.set(LAYOUT.sprout.x, 0, LAYOUT.sprout.z); }
      const p = Math.min(1, (sproutT - 2.5) / 5);
      const e = 1 - Math.pow(1 - p, 3) + Math.sin(p * Math.PI) * 0.08;
      sprout.big.scale.setScalar(Math.max(0.001, e * 2.4));
      sprout.sprouts.scale.setScalar(Math.max(0.001, 1 - p * 3));
      if (p >= 1) { sproutState = 2; toast('大树长出来啦！🌳<br>谢谢你，'+CHARACTER_DEFS[characterId].name+'～',4); }
    }
  }
  if (sparks.material.opacity > 0) {
    for (let i = 0; i < SPN; i++) {
      sparkVel[i].y -= dt * 1.5;
      sparkPos[i * 3] += sparkVel[i].x * dt; sparkPos[i * 3 + 1] += sparkVel[i].y * dt; sparkPos[i * 3 + 2] += sparkVel[i].z * dt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.material.opacity = Math.max(0, sparks.material.opacity - dt * 0.2);
  }

  if (started) sound.music(dt, env.night > 0.5);
  if(!sound.customAudio){const label='当前：原创 · '+sound.currentTrack+'（四首轮播）';if($('musicName').textContent!==label)$('musicName').textContent=label;}

  // UI
  const region=lakeDist(P.pos.x,P.pos.z)<LAYOUT.lake.r+14?'星湖 · 阿渔伯的钓场，湖底住着奇怪的鱼':Math.hypot(P.pos.x,P.pos.z)>46?'云海崖畔 · 森林到此，远处只有风与云':P.pos.x< -34?'苔岩坡 · 沿着山脊慢慢走':P.pos.x< -20&&P.pos.z>24?'风起草甸 · 留一片开阔的绿':Math.abs(P.pos.x+7)<7&&P.pos.z< -23?'林间谷地 · 风从低处吹来':P.pos.x>18&&P.pos.z>9?'东南 · 稻荷山道与山顶神社':Math.hypot(P.pos.x+6,P.pos.z-21)<12?'树屋小院 · 煤球们的秘密基地':Math.hypot(P.pos.x-8,P.pos.z-5)<8?'水光池塘 · 听一片叶子落水':Math.hypot(P.pos.x-13.2,P.pos.z+8.2)<9?'龙猫车站 · 等一班夏天的车':'风与森林 · 去发现一颗小小橡果';
  $('place').textContent='✦ '+region;
  $('bKick1').disabled=$('bKick2').disabled=!!cat.actionQueueFull||!P.grounded||switching||characterMenuOpen;
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.t -= dt;
    const p = b.anchor().clone().project(camera);
    b.el.style.left = ((p.x + 1) / 2 * innerWidth) + 'px';
    b.el.style.top = ((1 - p.y) / 2 * innerHeight - (1.6 - Math.max(0, b.t)) * 0) + 'px';
    b.el.style.opacity = p.z > 1 ? 0 : Math.min(1, b.t * 3);
    if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); }
  }

  treeOcclusion.update(dt,camera,cat.getHeadWorld(new THREE.Vector3()));
  renderer.render(scene, camera);
  equipment.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  snow.setPixelRatio?.(renderer.getPixelRatio());
});
window.__game = { fishing, roarContest, lake, talkToKeeper, P, cam, get catbus(){return catbus;}, sunShafts,detailStream, cat, totoro, chu, chibi, env, acorns, renderer, scene, sound, colliders, equipment, fantasyEcology };
$('startBtn').disabled=false; $('startBtn').textContent='走进森林 →'; $('loadStatus').textContent='';finishStartup();document.body.classList.remove('is-loading');
