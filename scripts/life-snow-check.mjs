import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {cameraBasis,removeReverseInertia} from '../dist/src/locomotion.js';
import {SnowTracks,snowDepth} from '../dist/src/snow-tracks.js';
import {ForestLife} from '../dist/src/forest-life.js';
import {CharacterRoster} from '../dist/src/characters.js';
import {heightAt} from '../dist/src/terrain.js';
const c=new THREE.PerspectiveCamera(),f=new THREE.Vector3(),r=new THREE.Vector3();
for(let a=-Math.PI*2;a<Math.PI*2;a+=.1)for(const pitch of [-.15,.3,1.1]){c.position.set(Math.sin(a)*5,Math.sin(pitch)*5,Math.cos(a)*5);c.lookAt(0,0,0);cameraBasis(c,f,r);assert(f.dot(c.position.clone().setY(0))<0);assert(Math.abs(f.dot(r))<1e-8);const v=f.clone().multiplyScalar(-4);removeReverseInertia(v,f);assert(v.dot(f)>-1e-8);}
const scene=new THREE.Scene(),tracks=new SnowTracks(scene);const p=new THREE.Vector3(-2,heightAt(-2,6),6);tracks.walk('xiaosi',p,0,1,true);p.z+=.5;p.y=heightAt(p.x,p.z);tracks.walk('xiaosi',p,0,1,true);assert.equal(tracks.records.length,1);assert(tracks.records[0].life>=60&&tracks.records[0].life<=120);tracks.update(59,1);assert(tracks.records[0]);tracks.update(62,1);assert.equal(tracks.records[0],null);assert(snowDepth(-5,8)!==snowDepth(5,8));
const roster=new CharacterRoster(scene,async()=>({root:new THREE.Group(),update(){},triggerAction(){},isPerforming:false}));await roster.select('zangzangbao');const life=new ForestLife(roster,[]);await life.populate();assert.equal(roster.cache.size,3);const old=roster.active.root;old.position.set(2,heightAt(2,8),8);await roster.select('xiaosi');assert(old.parent===scene);const modes=new Set();for(let i=0;i<3600;i++){life.update(1/30,roster.active.root.position);for(const s of life.states.values())modes.add(s.mode);}assert(modes.has('sit')&&modes.has('wander')&&modes.has('gesture'));for(const a of roster.cache.values())assert(Number.isFinite(a.root.position.y));console.log({cameraHeadings:'PASS',reverseInertia:'PASS',footprintLifetime:'PASS',residentCharacters:roster.cache.size,behaviors:[...modes]});
