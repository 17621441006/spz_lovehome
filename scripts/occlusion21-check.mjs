import assert from 'node:assert/strict';import {THREE} from './headless.mjs';import {TreeOcclusion} from '../dist/src/tree-occlusion.js';
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera();cam.position.set(0,1.6,6);cam.lookAt(0,.8,0);const head=new THREE.Vector3(0,1.4,0),feet=new THREE.Vector3(0,0,0),group=new THREE.Group();group.userData.occludingTree=true;scene.add(group);const mat=new THREE.MeshStandardMaterial(),tree=new THREE.Mesh(new THREE.BoxGeometry(2,4,1),mat);tree.position.set(0,2,3);group.add(tree);scene.updateMatrixWorld(true);const occ=new TreeOcclusion(scene);const tick=()=>{scene.updateMatrixWorld(true);for(let i=0;i<120;i++)occ.update(1/60,cam,head,feet);};tick();assert(tree.material.opacity<.28);assert(occ.coverage>.77);
tree.position.z=-3;tick();assert(tree.material.opacity>.99,'Trees beyond the avatar stay opaque');
// The camera lies inside a huge empty box formed by two side branches: no triangles block the body.
tree.position.set(-5,2,3);const other=tree.clone();other.position.x=5;group.add(other);tick();assert.equal(occ.coverage,0);assert(tree.material.opacity>.99);assert(other.material.opacity>.99);
// One thin twig crosses only one body column, which must not hide the whole tree.
const twig=new THREE.Mesh(new THREE.BoxGeometry(.12,3,.1),mat.clone());twig.position.set(0,1.5,3);group.add(twig);tick();assert(occ.coverage<.5);assert(twig.material.opacity>.99);
console.log({fullObstruction:'fades',behindAvatar:'opaque',emptyBoundingBox:'opaque',thinTwig:'opaque',finiteSegments:'PASS'});
