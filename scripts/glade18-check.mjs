import assert from 'node:assert/strict';import {THREE} from './headless.mjs';
import {heightAt,LAYOUT,catbusRouteDist} from '../dist/src/terrain.js';import {addElderTree,updateElderGlade} from '../dist/src/elder-tree.js';import {detailStream} from '../dist/src/asset-stream.js';
const scene=new THREE.Scene();const elder=await addElderTree(scene),e=LAYOUT.elder,h=heightAt(e.x,e.z);for(let r=0;r<10.5;r+=.5)for(let i=0;i<64;i++)assert(Math.abs(heightAt(e.x+r*Math.cos(i/64*6.283185),e.z+r*Math.sin(i/64*6.283185))-h)<1e-8);
const glade=scene.children.find(o=>o.userData.elderGlade);assert(glade);assert.equal(glade.userData.elderGlade.mushrooms,40);assert(glade.userData.elderGlade.streamLength>15);
const props=[];glade.traverse(o=>{if(o.userData.gladeModel)props.push(o);});assert.equal(props.length,8);
for(const job of detailStream.jobs.filter(j=>j.key.endsWith('-elder-glade')))await job.run();
for(const p of props){assert(p.userData.rootSupport.length);for(const c of p.userData.rootSupport){const gap=c.y-heightAt(c.x,c.z);assert(gap<.015,`floating ${p.name} ${gap}`);}assert(catbusRouteDist(p.position.x,p.position.z)>3.2);}
updateElderGlade(12,1);assert.equal(glade.getObjectByName('缓缓流动的浅溪').material.uniforms.uTime.value,12);
console.log({flatRootRadius:e.flat,giantHeight:elder.userData.elderTree.height,streamLength:glade.userData.elderGlade.streamLength,models:props.map(p=>p.userData.gladeModel),fullDetailGrounding:'PASS'});
