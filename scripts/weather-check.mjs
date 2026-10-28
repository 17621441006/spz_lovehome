import assert from 'node:assert/strict';
import {THREE} from './headless.mjs';
import {buildTerrain,buildGrass,heightAt,setTerrainSnow,terrainSnow,grassUniforms} from '../dist/src/terrain.js';
import {Snow} from '../dist/src/weather.js';

// Snow is a material coating: roots, buildings and player physics keep the same surface.
const ground=buildTerrain(),before=ground.geometry.attributes.position.array.slice();
setTerrainSnow(1);assert.equal(terrainSnow.value,1);assert.equal(grassUniforms.uSnow.value,1);assert.deepEqual(ground.geometry.attributes.position.array,before);
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};ground.material.onBeforeCompile(shader);
assert.equal(shader.uniforms.uTerrainSnow,terrainSnow);assert(shader.vertexShader.includes('vMeadowXZ=position.xz'));assert(shader.fragmentShader.includes('diffuseColor.rgb=mix(meadowColor,snowColor,powder)'));
assert(!shader.fragmentShader.includes('#include <map_fragment>'),'The original map multiply must be replaced by the meadow detail sampling');
assert(shader.fragmentShader.indexOf('#include <color_fragment>')<shader.fragmentShader.indexOf('vec3 meadowColor=diffuseColor.rgb'),'Use painted vertex color before terrain detail');
assert(shader.fragmentShader.indexOf('#include <color_fragment>')<shader.fragmentShader.indexOf('diffuseColor.rgb=mix(meadowColor,snowColor,powder)'),'Snow must replace the green vertex tint');
const grass=buildGrass(15000,()=>false),blades=grass.getObjectByName('风中的细草'),clover=grass.getObjectByName('草甸里的三叶草');assert(blades&&clover);assert(clover.count>1000);
const cloverShader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader};clover.material.onBeforeCompile(cloverShader);
assert(cloverShader.fragmentShader.indexOf('#include <color_fragment>')<cloverShader.fragmentShader.indexOf('diffuseColor.rgb=mix(diffuseColor.rgb,vec3('),'Clover snow is applied after leaf colors');
assert(blades.material.fragmentShader.indexOf('col = mix(col,vec3(')<blades.material.fragmentShader.indexOf('col *= uLight'),'Grass snow receives scene lighting after its neutral coating');
// Keep the grass triangle budget at the pre-existing 15 triangles/tuft.
assert.equal(blades.geometry.index.count/3,15);assert(Math.max(...blades.geometry.attributes.aScale.array)<.34);
const scene=new THREE.Scene(),snow=new Snow(scene,{low:true,pixelRatio:2}),center=new THREE.Vector3(0,2,6);
snow.update(1/60,center,0);assert(!snow.mesh.visible);
let fall=0;
for(let n=0;n<600;n++){const y=snow.positions[1];snow.update(1/60,center,1,.25);if(n>0&&snow.positions[1]<y)fall+=y-snow.positions[1];for(const v of snow.positions)assert(Number.isFinite(v));}
assert(snow.mesh.visible);assert(fall>3);assert.equal(snow.count,650);
// Teleporting the viewpoint redistributes flakes and never drags the old volume with it.
center.set(-29,heightAt(-29,-25)+2,-25);snow.update(1/60,center,1);
for(let i=0;i<snow.count;i++)assert(Math.hypot(snow.positions[i*3]-center.x,snow.positions[i*3+2]-center.z)<20.01);
snow.update(1/60,center,0);assert(!snow.mesh.visible);setTerrainSnow(0);assert.equal(terrainSnow.value,0);
snow.dispose();assert(!scene.getObjectByName('缓缓落下的雪'));
console.log(JSON.stringify({weather:'PASS',mobileFlakes:snow.count,meadowTufts:blades.geometry.instanceCount,cloverPlants:clover.count,terrainUnchanged:true},null,2));
