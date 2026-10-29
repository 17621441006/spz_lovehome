import json,numpy as np,sys
from pathlib import Path
from PIL import Image
from numba import njit
@njit
def raster(verts,uv,idx,tex,color,zbuf,pixels):
 for tri in idx:
  p=verts[tri];ua=uv[tri];x0=max(0,int(np.floor(min(p[:,0]))));x1=min(pixels.shape[1]-1,int(np.ceil(max(p[:,0]))));y0=max(0,int(np.floor(min(p[:,1]))));y1=min(pixels.shape[0]-1,int(np.ceil(max(p[:,1]))));den=(p[1,1]-p[2,1])*(p[0,0]-p[2,0])+(p[2,0]-p[1,0])*(p[0,1]-p[2,1]);
  if abs(den)<1e-10:continue
  n=np.cross(p[1]-p[0],p[2]-p[0]);n/=max(1e-7,np.sqrt((n*n).sum()));shade=.73+.27*abs(n[2])
  for y in range(y0,y1+1):
   for x in range(x0,x1+1):
    a=((p[1,1]-p[2,1])*(x-p[2,0])+(p[2,0]-p[1,0])*(y-p[2,1]))/den;b=((p[2,1]-p[0,1])*(x-p[2,0])+(p[0,0]-p[2,0])*(y-p[2,1]))/den;c=1-a-b
    if a<0 or b<0 or c<0:continue
    z=a*p[0,2]+b*p[1,2]+c*p[2,2]
    if z<zbuf[y,x]:continue
    zbuf[y,x]=z;u=a*ua[0,0]+b*ua[1,0]+c*ua[2,0];v=a*ua[0,1]+b*ua[1,1]+c*ua[2,1];xx=min(tex.shape[1]-1,max(0,int(u*tex.shape[1])));yy=min(tex.shape[0]-1,max(0,int(v*tex.shape[0])))
    for k in range(3):pixels[y,x,k]=min(255,tex[yy,xx,k]*color[k]*shade)
folder=Path(sys.argv[1]);D=json.load(open(folder/'meshes.json'));W,H=320,320;all=[];head='--head' in sys.argv
for angle in [0]:
 im=np.zeros((H,W,3),np.uint8);im[:]=[226,232,217];zb=np.full((H,W),-1e8);a=angle;rot=np.array([[np.cos(a),0,-np.sin(a)],[0,1,0],[np.sin(a),0,np.cos(a)]])
 for m in D:
  p=np.array(m['p']).reshape(-1,3)@rot.T;scale=500;center=.88;p[:,0]=p[:,0]*scale+W/2;p[:,1]=(center-p[:,1])*scale+H/2;p[:,2]*=scale
  tex=np.array(Image.open(folder/m['image']).convert('RGB')) if m['image'] else np.ones((1,1,3),np.uint8)*255
  raster(p,np.array(m['uv']).reshape(-1,2),np.array(m['index']).reshape(-1,3),tex,np.array(m['color'][:3]),zb,im)
 all.append(im)
Image.fromarray(all[0]).save('dist/assets/characters/zangzangbao-front-v24.png')
