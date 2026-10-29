import * as THREE from 'three';
import {heightAt} from './terrain.js';
// The GLB contains the actual cut doorway and room. These props sit inside it.
export function furnishTemple(root,b,scene,colliders){
 const s=root.scale.x,floor=root.position.y+.1046*s;
 root.userData.templeInterior={floor,width:.354*s,depth:.284*s,doorWidth:.173*s,clearHeight:.1774*s};
 const g=new THREE.Group();g.name='山顶寺院 · 参观内室';g.position.set(b.x,floor,b.z);g.rotation.y=b.rotation;scene.add(g);
 // Rebuild the entrance tread as a continuous, shallow stair over the scanned base.
 // The source terrace has a raised lip that otherwise blocks the player's capsule.
 const start=b.z-6.4,end=b.z-2.8,base=heightAt(b.x,start)+.17,n=16,depth=(end-start)/n;
 const stone=new THREE.MeshStandardMaterial({color:'#a1a48c',roughness:1});
 for(let i=0;i<n;i++){const top=THREE.MathUtils.lerp(base,floor+.018,(i+1)/n),z=start+depth*(i+.5),h=Math.max(.12,top-heightAt(b.x,z));const tread=new THREE.Mesh(new THREE.BoxGeometry(1.85,h,depth+.016),stone);tread.position.set(b.x,top-h/2,z);tread.castShadow=tread.receiveShadow=true;scene.add(tread);colliders.push({type:'box',minX:b.x-.925,maxX:b.x+.925,minZ:z-depth/2,maxZ:z+depth/2,top,templeEntry:true});}
 const porchEnd=b.z-.95,porch=new THREE.Mesh(new THREE.BoxGeometry(1.85,.10,porchEnd-end),stone);porch.position.set(b.x,floor-.032,(porchEnd+end)/2);porch.receiveShadow=true;scene.add(porch);colliders.push({type:'box',minX:b.x-.925,maxX:b.x+.925,minZ:end,maxZ:porchEnd,top:floor+.018,templeEntry:true});
 const wood=new THREE.MeshStandardMaterial({color:'#72513b',roughness:.9}),brass=new THREE.MeshStandardMaterial({color:'#ae8b47',metalness:.3,roughness:.55}),paper=new THREE.MeshStandardMaterial({color:'#fff0ca',emissive:'#eab865',emissiveIntensity:.35,roughness:.9});
 const box=(x,y,z,w,h,d,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 box(0,.34,-.161*s,1.65,.12,.42,wood);for(const x of [-.65,.65])box(x,.16,-.161*s,.09,.32,.32,wood);
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#e9ddbc';ctx.fillRect(0,0,256,512);ctx.fillStyle='#4c5043';ctx.font='128px KaiTi,serif';ctx.textAlign='center';ctx.fillText('風',128,230);ctx.font='24px serif';ctx.fillText('山中日月長',128,365);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const scroll=new THREE.Mesh(new THREE.PlaneGeometry(.66,1.15),new THREE.MeshStandardMaterial({map:tex,roughness:1}));scroll.position.set(0,1.2,-.198*s);g.add(scroll);for(const y of [.615,1.785])box(0,y,-.198*s,.74,.035,.045,wood);
 for(const x of [-.58,.58]){const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.10,.12,.26,12),paper);lamp.position.set(x,.53,-.161*s);g.add(lamp);box(x,.68,-.161*s,.26,.045,.26,brass);}
 const light=new THREE.PointLight('#ffe5ae',1.8,6,2);light.position.set(0,1.8,-.08*s);g.add(light);
 g.updateMatrixWorld(true);const p=g.localToWorld(new THREE.Vector3(0,0,-.161*s));colliders.push({type:'box',minX:p.x-.83,maxX:p.x+.83,minZ:p.z-.22,maxZ:p.z+.22,top:floor+.4,building:'temple',furniture:true});
}
