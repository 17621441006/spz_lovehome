// Substeps prevent walking through thin walls after a slow frame.
export function moveWithCollisions(pos,dx,dz,r,colliders){
 const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.max(.06,r*.45)));
 for(let step=0;step<count;step++){
  pos.x+=dx/count;pos.z+=dz/count;
  for(let pass=0;pass<3;pass++)for(const c of colliders){
   if(c.floorOnly||pos.y>=c.top-.30)continue;
   if(c.type==='circle'){
    let x=pos.x-c.x,z=pos.z-c.z,d=Math.hypot(x,z),limit=c.r+r;
    if(d>=limit)continue;if(d<1e-7){x=1;z=0;d=1;}
    pos.x=c.x+x/d*limit;pos.z=c.z+z/d*limit;c.onHit?.({x:x/d,y:0,z:z/d});
   }else{
    if(pos.x<c.minX-r||pos.x>c.maxX+r||pos.z<c.minZ-r||pos.z>c.maxZ+r)continue;
    const qx=Math.max(c.minX,Math.min(pos.x,c.maxX)),qz=Math.max(c.minZ,Math.min(pos.z,c.maxZ)),x=pos.x-qx,z=pos.z-qz,d=Math.hypot(x,z);
    if(d>=r)continue;
    if(d>1e-7){pos.x=qx+x/d*r;pos.z=qz+z/d*r;}
    else{const choices=[[c.minX-r-pos.x,0],[c.maxX+r-pos.x,0],[0,c.minZ-r-pos.z],[0,c.maxZ+r-pos.z]].sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));pos.x+=choices[0][0];pos.z+=choices[0][1];}
   }
  }
 }
}
