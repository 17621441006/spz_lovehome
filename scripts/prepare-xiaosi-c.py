import struct,json,numpy as np,io
from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1];data=(root/'dist/assets/characters/xiaosi.glb').read_bytes();nj=struct.unpack_from('<I',data,12)[0];d=json.loads(data[20:20+nj]);buf=bytearray(data[28+nj:]);prim=d['meshes'][0]['primitives'][0]
dtypes={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'};dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def arr(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dt=np.dtype(dtypes[a['componentType']]);n=dims[a['type']];return np.ndarray((a['count'],n),dtype=dt,buffer=buf,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*dt.itemsize),dt.itemsize)).copy()
p=arr(prim['attributes']['POSITION']);uv=arr(prim['attributes']['TEXCOORD_0']);ix=arr(prim['indices']).reshape(-1,3);skin=arr(prim['attributes']['JOINTS_0']);weights=arr(prim['attributes']['WEIGHTS_0']);im=d['images'][d['textures'][d['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']];v=d['bufferViews'][im['bufferView']];tex=np.array(Image.open(io.BytesIO(buf[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB'));T=tex.shape
u=uv[ix].mean(1);rgb=tex[np.clip((u[:,1]*T[0]).astype(int),0,T[0]-1),np.clip((u[:,0]*T[1]).astype(int),0,T[1]-1)].astype(float);pos=p[ix].mean(1);x,y,z=pos.T;r,g,b=rgb.T
# The atlas distinguishes brown curls from the blue shirt and pale skin.
brown=(r>g*1.13)&(g>b*1.10)&(r<190)&(g<145)
region=(y>.78)&(y<1.25)&((z<-.07)|((abs(x)>.065)&(z>.015)))
not_blue=(r>b*.92)&(r>g*.90)
hair=((not_blue)&(y>.78)&(y<1.25)&(z<-.075))|(brown&region)|((y>.88)&(y<1.20)&(x<-.10)&(z>.105)&not_blue)
print('hair faces',hair.sum(),'triangles',len(ix))
# Include adjoining very dark strands by texture hue, but never blue cloth.
ids=np.unique(ix[hair]);pp=p.copy();t=np.clip((1.20-p[:,1])/.42,0,1);pp[ids,1]=np.where(p[ids,1]<1.20,1.20-(1.20-p[ids,1])*.32,p[ids,1]);pp[ids,0]*=(1-.15*t[ids])
# Each triangle uses the correct side of the cut: no half-deformed cloth triangles.
def add(a,typ,ct,target=None):
 global buf
 while len(buf)%4:buf.append(0)
 off=len(buf);buf.extend(a.tobytes());v={'buffer':0,'byteOffset':off,'byteLength':a.nbytes}
 if target:v['target']=target
 vi=len(d['bufferViews']);d['bufferViews'].append(v);ac={'bufferView':vi,'componentType':ct,'count':len(a),'type':typ}
 if typ=='VEC3':ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 ai=len(d['accessors']);d['accessors'].append(ac);return ai
bodyix=ix[~hair]
parents=np.arange(len(p))
def find(i):
 while parents[i]!=i:
  parents[i]=parents[parents[i]];i=parents[i]
 return i
def join(a,b):parents[find(a)]=find(b)
weld={}
for i,pt in enumerate(p):
 key=tuple(np.round(pt,5))
 if key in weld:join(i,weld[key])
 else:weld[key]=i
for a,b,c in bodyix:join(a,b);join(a,c)
from collections import Counter
labels=np.array([find(t[0]) for t in bodyix]);counts=Counter(labels)
center=p[bodyix].mean(1)
keep=np.array([counts[k]>60 for k in labels])|~((center[:,1]>.78)&(center[:,1]<1.20))
bodyix=bodyix[keep]
body=dict(prim);body['attributes']=dict(prim['attributes']);body['indices']=add(bodyix.astype('<u4').reshape(-1,1),'SCALAR',5125,34963)
hp=dict(prim);hp['attributes']=dict(prim['attributes']);hp['attributes']['POSITION']=add(pp.astype('<f4'),'VEC3',5126,34962);hp['indices']=add(ix[hair].astype('<u4').reshape(-1,1),'SCALAR',5125,34963)
norm=np.zeros_like(pp);tris=ix[hair];n=np.cross(pp[tris[:,1]]-pp[tris[:,0]],pp[tris[:,2]]-pp[tris[:,0]]);
for k in range(3):np.add.at(norm,tris[:,k],n)
norm/=np.maximum(1e-12,np.linalg.norm(norm,axis=1))[:,None];hp['attributes']['NORMAL']=add(norm.astype('<f4'),'VEC3',5126,34962)
# Curls now end close to their original hair-bone pivots. Remove stray torso weights.
joints=d['skins'][0]['joints'];names=[d['nodes'][i]['name'] for i in joints];sw=weights.copy();si=skin.copy()
for i in ids:
 if p[i,1]>=1.20:continue
 name='HairBack' if p[i,2]<-.10 else ('HairLeft' if p[i,0]>0 else 'HairRight')
 si[i]=[names.index(name),0,0,0];sw[i]=[1,0,0,0]
hp['attributes']['JOINTS_0']=add(si.astype('<u2'),'VEC4',5123,34962);hp['attributes']['WEIGHTS_0']=add(sw.astype('<f4'),'VEC4',5126,34962)
# Compact each primitive so runtime contacts/bounds ignore unused vertices.
for primitive in [body,hp]:
 oldix=arr(primitive['indices']).reshape(-1);verts,compact=np.unique(oldix,return_inverse=True)
 for semantic,accessor in list(primitive['attributes'].items()):
  meta=d['accessors'][accessor];primitive['attributes'][semantic]=add(arr(accessor)[verts],meta['type'],meta['componentType'],34962)
 primitive['indices']=add(compact.astype('<u4').reshape(-1,1),'SCALAR',5125,34963)
d['meshes'][0]['primitives']=[body,hp]
# Discard superseded geometry buffers; retain every image, animation and inverse bind.
used=set()
for m in d['meshes']:
 for pr in m['primitives']:used.update(pr['attributes'].values());used.add(pr['indices'])
for anim in d.get('animations',[]):
 for sampler in anim['samplers']:used.update([sampler['input'],sampler['output']])
for sk in d.get('skins',[]):used.add(sk['inverseBindMatrices'])
amap={old:new for new,old in enumerate(sorted(used))};accessors=[d['accessors'][i] for i in sorted(used)]
for m in d['meshes']:
 for pr in m['primitives']:
  pr['attributes']={k:amap[v] for k,v in pr['attributes'].items()};pr['indices']=amap[pr['indices']]
for anim in d.get('animations',[]):
 for sampler in anim['samplers']:sampler['input']=amap[sampler['input']];sampler['output']=amap[sampler['output']]
for sk in d.get('skins',[]):sk['inverseBindMatrices']=amap[sk['inverseBindMatrices']]
usedviews={a['bufferView'] for a in accessors}|{im['bufferView'] for im in d['images']};vmap={old:new for new,old in enumerate(sorted(usedviews))};views=[];packed=bytearray()
for old in sorted(usedviews):
 v=dict(d['bufferViews'][old]);part=buf[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
 while len(packed)%4:packed.append(0)
 v['byteOffset']=len(packed);packed.extend(part);views.append(v)
for a in accessors:a['bufferView']=vmap[a['bufferView']]
for im in d['images']:im['bufferView']=vmap[im['bufferView']]
d['accessors']=accessors;d['bufferViews']=views;buf=packed
d['buffers'][0]['byteLength']=len(buf);js=json.dumps(d,separators=(',',':')).encode();js+=b' '*((-len(js))%4);buf+=bytes((-len(buf))%4);out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(buf))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\0')+buf
(root/'dist/assets/characters/xiaosi-c.glb').write_bytes(out)
