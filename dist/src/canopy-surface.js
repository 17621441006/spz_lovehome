import * as THREE from 'three';
// Rasterise the actual upper leaf triangles once. Runtime ground queries are
// bilinear lookups, with no extra invisible primitive above the tree.
export function createCanopySurface(tree,minY,step=.28){
 tree.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(tree),nx=Math.ceil((box.max.x-box.min.x)/step)+1,nz=Math.ceil((box.max.z-box.min.z)/step)+1,data=new Float32Array(nx*nz).fill(-Infinity),v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
 tree.traverse(m=>{if(!m.isMesh)return;const g=m.geometry,p=g.attributes.position,index=g.index,count=index?index.count:p.count;
  for(let i=0;i<count;i+=3){for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(m.matrixWorld);const [a,b,c]=v;if(Math.max(a.y,b.y,c.y)<minY)continue;const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-8)continue;
   const x0=Math.max(0,Math.ceil((Math.min(a.x,b.x,c.x)-box.min.x)/step)),x1=Math.min(nx-1,Math.floor((Math.max(a.x,b.x,c.x)-box.min.x)/step)),z0=Math.max(0,Math.ceil((Math.min(a.z,b.z,c.z)-box.min.z)/step)),z1=Math.min(nz-1,Math.floor((Math.max(a.z,b.z,c.z)-box.min.z)/step));
   for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){const x=box.min.x+ix*step,z=box.min.z+iz*step,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,w=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u<0||w<0||u+w>1)continue;const y=u*a.y+w*b.y+(1-u-w)*c.y;if(y>=minY)data[iz*nx+ix]=Math.max(data[iz*nx+ix],y);}
  }
 });
 const sample=(x,z)=>{const fx=(x-box.min.x)/step,fz=(z-box.min.z)/step,ix=Math.floor(fx),iz=Math.floor(fz);if(ix<0||iz<0||ix>=nx-1||iz>=nz-1)return -Infinity;const a=data[iz*nx+ix],b=data[iz*nx+ix+1],c=data[(iz+1)*nx+ix],d=data[(iz+1)*nx+ix+1];if(![a,b,c,d].every(Number.isFinite)||Math.max(a,b,c,d)-Math.min(a,b,c,d)>.6)return -Infinity;return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,fx-ix),THREE.MathUtils.lerp(c,d,fx-ix),fz-iz)+.045;};
 const candidates=[];for(let iz=4;iz<nz-4;iz+=2)for(let ix=4;ix<nx-4;ix+=2){const x=box.min.x+ix*step,z=box.min.z+iz*step,y=sample(x,z);if(!Number.isFinite(y))continue;const ring=Array.from({length:12},(_,i)=>sample(x+Math.cos(i*Math.PI/6)*.8,z+Math.sin(i*Math.PI/6)*.8));if(ring.every(h=>Number.isFinite(h)&&Math.abs(h-y)<.5))candidates.push(new THREE.Vector3(x,y,z));}
 candidates.sort((a,b)=>b.y-a.y);if(!candidates.length)throw new Error('No safe leaf landing on the elder crown');const seat=candidates[0];
 // Find the return pad on the same connected crown, rather than another lower
 // branch. Each short step must be walkable under the player's .32m step limit.
 const start=[Math.round((seat.x-box.min.x)/step),Math.round((seat.z-box.min.z)/step)],queue=[start],seen=new Set([start.join(',')]),reachable=[];
 for(let q=0;q<queue.length;q++){const [ix,iz]=queue[q],x=box.min.x+ix*step,z=box.min.z+iz*step,y=sample(x,z),d=Math.hypot(x-seat.x,z-seat.z);if(d>1.35&&d<3){const ring=Array.from({length:8},(_,i)=>sample(x+Math.cos(i*Math.PI/4)*.42,z+Math.sin(i*Math.PI/4)*.42));if(ring.every(h=>Number.isFinite(h)&&Math.abs(h-y)<.34))reachable.push(new THREE.Vector3(x,y,z));}if(d>3.6)continue;
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const key=[ix+dx,iz+dz].join(',');if(seen.has(key))continue;seen.add(key);const h=sample(x+dx*step,z+dz*step);if(Number.isFinite(h)&&Math.abs(h-y)<.25)queue.push([ix+dx,iz+dz]);}
 }
 reachable.sort((a,b)=>a.distanceTo(seat)-b.distanceTo(seat));if(!reachable.length)throw new Error('Crown return pad must be reachable from the seat');const returnPad=reachable[0];
 return {type:'heightfield',floorOnly:true,elderCanopy:true,top:box.max.y+.1,minY,sample,seat,returnPad,box,gridSize:[nx,nz]};
}
