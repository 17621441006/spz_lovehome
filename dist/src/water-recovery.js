import * as THREE from 'three';
import {LAYOUT,heightAt,inLakeWater,edgeRadius} from './terrain.js';
import {inElderRiver,onElderBridge} from './elder-tree.js';
import {onPier} from './lake.js';
export function hazardousWater(x,z){const rp=LAYOUT.reflection;if(rp&&Math.hypot(x-rp.poolX,z-rp.poolZ)<rp.poolR-0.15)return true;return (inLakeWater(x,z)&&!onPier(x,z,-.12))||(inElderRiver(x,z)&&!onElderBridge(x,z,.12))||Math.hypot(x-LAYOUT.pond.x,z-LAYOUT.pond.z)<LAYOUT.pond.r+.2;}
export class WaterRecovery{
 constructor(colliders){this.colliders=colliders;this.lastSafe=new THREE.Vector3(LAYOUT.spawn.x,heightAt(LAYOUT.spawn.x,LAYOUT.spawn.z),LAYOUT.spawn.z);}
 safe(x,z){if(Math.hypot(x,z)>edgeRadius(x,z)-.8)return false;for(let i=0;i<9;i++){const a=i*Math.PI/4,r=i===8?0:.6;if(hazardousWater(x+Math.cos(a)*r,z+Math.sin(a)*r))return false;}const y=heightAt(x,z);return !this.colliders.some(c=>!c.floorOnly&&c.top>y+.25&&(c.bottom===undefined||c.bottom<y+1.5)&&(c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+.5:c.type==='box'&&x>c.minX-.5&&x<c.maxX+.5&&z>c.minZ-.5&&z<c.maxZ+.5));}
 remember(p,grounded){if(grounded&&p.distanceToSquared(this.lastSafe)>.25&&Math.abs(p.y-heightAt(p.x,p.z))<.35&&this.safe(p.x,p.z))this.lastSafe.copy(p);}
 destination(p){for(let r=.8;r<=24;r+=.65)for(let i=0;i<24;i++){const a=i*Math.PI/12,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(this.safe(x,z))return new THREE.Vector3(x,heightAt(x,z),z);}if(this.safe(this.lastSafe.x,this.lastSafe.z))return this.lastSafe.clone();return new THREE.Vector3(LAYOUT.spawn.x,heightAt(LAYOUT.spawn.x,LAYOUT.spawn.z),LAYOUT.spawn.z);}
}
