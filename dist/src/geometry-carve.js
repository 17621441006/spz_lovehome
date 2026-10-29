import * as THREE from 'three';

// Subtract convex volumes from triangles, interpolating all vertex attributes.
// The opening is real geometry: shadows, collision rays and both camera views agree.
export function carveGeometry(mesh,volumes,toWorld){
 const source=mesh.geometry,index=source.index?.array||Array.from({length:source.attributes.position.count},(_,i)=>i),attrs=Object.entries(source.attributes).filter(([,a])=>!a.isInterleavedBufferAttribute),out=Object.fromEntries(attrs.map(([key])=>[key,[]]));
 const vertex=i=>{const a={};for(const [key,attr]of attrs)a[key]=Array.from({length:attr.itemSize},(_,k)=>attr.getComponent(i,k));a.world=new THREE.Vector3().fromArray(a.position).applyMatrix4(toWorld).toArray();return a;};
 const blend=(a,b,t)=>{const v={};for(const k of Object.keys(a))v[k]=a[k].map((x,i)=>x+(b[k][i]-x)*t);return v;};
 const split=(poly,plane)=>{const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane[0]*a.world[0]+plane[1]*a.world[1]+plane[2]*a.world[2]+plane[3],db=plane[0]*b.world[0]+plane[1]*b.world[1]+plane[2]*b.world[2]+plane[3];(da<=0?inside:outside).push(a);if((da<0&&db>0)||(da>0&&db<0)){const v=blend(a,b,da/(da-db));inside.push(v);outside.push(v);}}return {inside,outside};};
 for(let t=0;t<index.length;t+=3){let parts=[[vertex(index[t]),vertex(index[t+1]),vertex(index[t+2])]];
  for(const planes of volumes){const next=[];for(const poly of parts){if(planes.some(p=>poly.every(v=>p[0]*v.world[0]+p[1]*v.world[1]+p[2]*v.world[2]+p[3]>.000001))){next.push(poly);continue;}let inside=poly;for(const plane of planes){if(inside.length<3)break;const splitPoly=split(inside,plane);if(splitPoly.outside.length>=3)next.push(splitPoly.outside);inside=splitPoly.inside;}}parts=next;}
  for(const poly of parts)for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]])for(const [key]of attrs)out[key].push(...v[key]);
 }
 const g=new THREE.BufferGeometry();for(const [key,attr]of attrs)g.setAttribute(key,new THREE.Float32BufferAttribute(out[key],attr.itemSize));g.normalizeNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;return g;
}
