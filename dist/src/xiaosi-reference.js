// Fit the supplied reference on a private geometry copy. Keep the original GLB,
// UV atlas, bone weights and animation clips reusable in Blender.
export const XIAOSI_REFERENCE_VERSION=27;

function fitBodyPoint(x,y,z){
 const excess=y>1.34?Math.max(0,Math.abs(x)-.125):0;
 const front=Math.max(0,Math.min(1,(z-.015)/.08)),lower=Math.exp(-Math.pow((y-1.22)/.065,2))*front,cheek=Math.exp(-Math.pow((Math.abs(x)-.075)/.042,2)-Math.pow((y-1.245)/.055,2))*front,upper=Math.max(0,Math.min(1,(y-1.34)/.16));
 return [Math.sign(x)*(Math.abs(x)-excess*.45)*(1+.12*lower),y+.016*Math.exp(-Math.pow((y-1.155)/.04,2))*front-.018*upper,z+.006*cheek];
}

// GLB vertices are split at UV seams. Recomputing their normals independently
// creates thousands of visible lighting cracks, even on untouched legs. Keep
// the authored smooth normals and transform them by the fitting deformation's
// inverse-transpose Jacobian, without welding UVs, weights or intentional edges.
function fitBodyNormal(x,y,z,nx,ny,nz){
 const e=.0001,dx0=fitBodyPoint(x-e,y,z),dx1=fitBodyPoint(x+e,y,z),dy0=fitBodyPoint(x,y-e,z),dy1=fitBodyPoint(x,y+e,z),dz0=fitBodyPoint(x,y,z-e),dz1=fitBodyPoint(x,y,z+e);
 const dx=dx1.map((v,k)=>(v-dx0[k])/(2*e)),dy=dy1.map((v,k)=>(v-dy0[k])/(2*e)),dz=dz1.map((v,k)=>(v-dz0[k])/(2*e));
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],cx=cross(dy,dz),cy=cross(dz,dx),cz=cross(dx,dy),det=dx[0]*cx[0]+dx[1]*cx[1]+dx[2]*cx[2];
 if(Math.abs(det)<1e-8)return [nx,ny,nz];
 const out=cx.map((v,k)=>(v*nx+cy[k]*ny+cz[k]*nz)/det),length=Math.hypot(...out);
 return length>1e-8?out.map(v=>v/length):[nx,ny,nz];
}

export function fitXiaosiReference(root){
 // Exported comparison copies carry this marker so their fitting is not baked
 // twice when they are loaded through the normal game character pipeline.
 if(root.userData.xiaosiReferenceFit===XIAOSI_REFERENCE_VERSION)return;
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const geometry=mesh.geometry.clone();geometry.computeBoundingBox();const looseHair=geometry.boundingBox.min.y>.8&&geometry.boundingBox.max.y<1.3,p=geometry.attributes.position,n=geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(looseHair){const tail=Math.max(0,Math.min(1,(1.255-y)/.15));const back=z<-.12?-.12+(z+.12)*(.55-.20*tail):z;const front=back>.045?.045+(back-.045)*(1-.78*tail):back;p.setXYZ(i,x*(.88-.16*tail),y,front);continue;}
   p.setXYZ(i,...fitBodyPoint(x,y,z));
   if(n&&(p.getX(i)!==x||p.getY(i)!==y||p.getZ(i)!==z))n.setXYZ(i,...fitBodyNormal(x,y,z,n.getX(i),n.getY(i),n.getZ(i)));
  }
  if(looseHair){
   // Weld UV seam copies for a small surface relaxation, retaining strand roots
   // and the broad haircut silhouette rather than smoothing the facial mesh.
   const groups=[],ids=[],keys=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!keys.has(key)){keys.set(key,groups.length);groups.push({v:[p.getX(i),p.getY(i),p.getZ(i)],near:new Set()});}ids[i]=keys.get(key);}
   const idx=geometry.index;for(let i=0;i<idx.count;i+=3){const t=[ids[idx.getX(i)],ids[idx.getX(i+1)],ids[idx.getX(i+2)]];for(let j=0;j<3;j++){groups[t[j]].near.add(t[(j+1)%3]);groups[t[j]].near.add(t[(j+2)%3]);}}
   for(let pass=0;pass<3;pass++){const next=groups.map(g=>{if(g.v[1]>1.23||!g.near.size)return g.v;const avg=[0,0,0];for(const n of g.near)for(let k=0;k<3;k++)avg[k]+=groups[n].v[k]/g.near.size;return g.v.map((v,k)=>v+(avg[k]-v)*.22);});groups.forEach((g,i)=>g.v=next[i]);}
   for(let i=0;i<p.count;i++)p.setXYZ(i,...groups[ids[i]].v);
  }
  p.needsUpdate=true;if(looseHair||!n)geometry.computeVertexNormals();else n.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 });
 root.userData.xiaosiReferenceFit=XIAOSI_REFERENCE_VERSION;
}
