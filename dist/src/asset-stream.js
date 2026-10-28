import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ASSET_SIZES} from './asset-sizes.js';
const bytes=new Map();let planned=[],done=false,last=0;
export function planStartup(urls){planned=[...new Set(urls)];report();}
function report(){if(done)return;const total=planned.reduce((s,u)=>s+(ASSET_SIZES[u]||1),0),loaded=planned.reduce((s,u)=>s+Math.min(bytes.get(u)||0,ASSET_SIZES[u]||1),0);last=Math.max(last,Math.min(94,Math.floor(loaded/Math.max(1,total)*94)));globalThis.document?.getElementById?.('loadProgress')?.setAttribute('value',last);const label=globalThis.document?.getElementById?.('loadPercent');if(label)label.textContent=last+'%';}
export function finishStartup(){done=true;globalThis.document?.getElementById?.('loadProgress')?.setAttribute('value',100);const label=globalThis.document?.getElementById?.('loadPercent');if(label)label.textContent='100%';}
export function loadGLB(url){return new GLTFLoader().loadAsync(url,e=>{bytes.set(url,e.loaded);report();}).then(g=>{bytes.set(url,ASSET_SIZES[url]||1);report();return g;});}
// At most one large decode at a time; retain the lower-detail model on failure.
export class DetailStream{
 constructor(){this.jobs=[];this.active=false;this.enabled=false;this.tick=0;}
 add(key,anchors,run){this.jobs.push({key,anchors,run,state:'queued'});}
 update(dt,viewer){if(!this.enabled||this.active)return;this.tick-=dt;if(this.tick>0)return;this.tick=.4;const job=this.jobs.filter(j=>j.state==='queued'&&j.anchors.some(o=>o.getWorldPosition(new THREE.Vector3()).distanceTo(viewer)<34)).sort((a,b)=>Math.min(...a.anchors.map(o=>o.getWorldPosition(new THREE.Vector3()).distanceToSquared(viewer)))-Math.min(...b.anchors.map(o=>o.getWorldPosition(new THREE.Vector3()).distanceToSquared(viewer))))[0];if(!job)return;this.active=true;job.state='loading';Promise.resolve().then(job.run).then(()=>job.state='ready').catch(e=>{job.state='failed';console.warn('Detail retained at base resolution:',job.key,e);}).finally(()=>{this.active=false;});}
}
export const detailStream=new DetailStream();
export function replaceDetail(old,next){const parent=old.parent;if(!parent)return;next.position.copy(old.position);next.quaternion.copy(old.quaternion);next.scale.copy(old.scale);next.visible=old.visible;const level=parent.isLOD?parent.levels.find(l=>l.object===old):null;parent.remove(old);parent.add(next);if(level)level.object=next;}
