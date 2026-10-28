import {loadGLB} from './asset-stream.js';
import * as THREE from 'three';
const smooth=THREE.MathUtils.smoothstep;
export const OUTFITS={zangzangbao:{id:'red-robe',name:'朱砂云纹袍',description:'宽袖红袍与金色云纹，保留脏脏包的脸、毛发和尾巴。'},xiaoyong:{id:'monk-robe',name:'山行僧衣',description:'赭黄色僧衣，保留小涌的脸和头发。'}};
export async function attachOutfit(actor,id){
 const def=OUTFITS[id];if(!def)return actor;const source=(await loadGLB(`assets/characters/${def.id}.glb`)).scene;source.updateMatrixWorld(true);
 const isCat=id==='zangzangbao';let template;actor.model.traverse(o=>{if(o.isSkinnedMesh&&!template)template=o;});const sk=template.skeleton;
 const index=name=>sk.bones.findIndex(b=>b.name.replace('mixamorig','')===name),bindPoint=n=>new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[index(n)].clone().invert());
 const names=isCat?{chest:'Spine2',spine:'Spine1',arm:'Arm',leg:'UpLeg',knee:'Leg'}:{chest:'Chest',spine:'Spine',arm:'UpperArm',leg:'UpperLeg',knee:'LowerLeg'};
 const limbs={};for(const side of ['Left','Right'])limbs[side]=[bindPoint(side+names.arm),bindPoint(side+'ForeArm'),bindPoint(side+'Hand')];
 const group=new THREE.Group();group.name=def.id;const outfitMeshes=[];const original=[];actor.model.traverse(o=>{if(o.isMesh)original.push({mesh:o,visible:o.visible});});
 source.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);const p=g.attributes.position,sourceP=p.array.slice(),skinIndices=[],skinWeights=[],v=new THREE.Vector3();const kept=[];
 const keep=(i)=>{if(isCat)return true;const x=sourceP[i*3],y=sourceP[i*3+1],z=sourceP[i*3+2];return y<.833&&y>.115&&Math.abs(x)<.365&&!(Math.abs(x)<.115&&y>.40&&y<.77&&z>.063);};
 const old=g.index?.array||Array.from({length:p.count},(_,i)=>i);for(let i=0;i<old.length;i+=3)if(keep(old[i])&&keep(old[i+1])&&keep(old[i+2]))kept.push(old[i],old[i+1],old[i+2]);g.setIndex(kept);
 for(let i=0;i<p.count;i++){
  const x=sourceP[i*3],y=sourceP[i*3+1],z=sourceP[i*3+2],side=x>=0?'Left':'Right',sign=x>=0?1:-1,ax=Math.abs(x);
  const base=isCat?new THREE.Vector3(x*.76,.12+y*.56,.17+z*.64):new THREE.Vector3(x*1.65,.18+(y-.115)*1.73,-.035+z*1.55);
  const armBlend=smooth(ax,isCat?.155:.105,isCat?.235:.16)*smooth(y,isCat?.30:.38,isCat?.48:.62);
  const t=THREE.MathUtils.clamp((ax-(isCat?.18:.12))/(isCat?.105:.245),0,1),chain=limbs[side],u=t<.5?t*2:(t-.5)*2,a=t<.5?0:1;const centre=chain[a].clone().lerp(chain[a+1],u);
  const sourceY=isCat?.80-.28*t:.78-.065*t,sourceZ=isCat?.17*t:0;
  const drop=y-sourceY;const sleeve=centre.add(new THREE.Vector3(sign*(.012+Math.max(0,-drop)*(isCat?.32:.9)),drop*(isCat?.38:.65),(z-sourceZ)*(isCat?.68:1.6)));
  base.lerp(sleeve,armBlend);p.setXYZ(i,base.x,base.y,base.z);
  let weights;if(armBlend>.6)weights=[[side+names.arm,1-t],[side+'ForeArm',t]];
  else if(base.y<(isCat?.31:.88)){const bend=1-smooth(base.y,isCat?.10:.25,isCat?.31:.88);weights=[['Hips',1-bend*.72],[side+names.leg,bend*.55],[side+names.knee,bend*.17]];}
  else {const chest=smooth(base.y,isCat?.36:.9,isCat?.53:1.27);weights=[[names.spine,1-chest],[names.chest,chest]];}
  while(weights.length<4)weights.push(['Hips',0]);for(const [bone,w]of weights){skinIndices.push(index(bone));skinWeights.push(w);}
 }
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));g.computeVertexNormals();g.computeBoundingSphere();const m=o.material.clone();m.side=THREE.DoubleSide;m.metalness=0;m.roughness=.92;m.userData={...o.material.userData};if(m.map)m.map.anisotropy=8;const mesh=new THREE.SkinnedMesh(g,m);mesh.name=def.id+'_fitted';mesh.bind(sk,template.bindMatrix);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);outfitMeshes.push(mesh);
 if(!isCat){const back=g.clone(),bp=back.attributes.position,bi=[];for(let k=0;k<old.length;k+=3){const tri=[old[k],old[k+1],old[k+2]];if(tri.every(i=>Math.abs(sourceP[i*3])<.13&&sourceP[i*3+1]>.395&&sourceP[i*3+1]<.76&&sourceP[i*3+2]<-.035))bi.push(tri[0],tri[2],tri[1]);}for(let i=0;i<bp.count;i++){const x=sourceP[i*3],y=sourceP[i*3+1],z=sourceP[i*3+2];bp.setXYZ(i,x*1.65,.18+(y-.115)*1.73,-.035-z*1.55+.012);}back.setIndex(bi);back.computeVertexNormals();const fill=new THREE.SkinnedMesh(back,m.clone());fill.material.userData={...m.userData};fill.bind(sk,template.bindMatrix);fill.name='monk_restored_front';fill.frustumCulled=false;fill.castShadow=fill.receiveShadow=true;group.add(fill);outfitMeshes.push(fill);}

 });

 let humanOriginalIndex,humanDressedIndex;
 if(!isCat){const g=template.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,pos=g.attributes.position;humanOriginalIndex=g.index.clone();const kept=[];const keep=i=>{let head=0,hand=0,foot=0;for(let j=0;j<4;j++){const n=sk.bones[si.getComponent(i,j)].name,w=sw.getComponent(i,j);if(/Head|Neck/.test(n))head+=w;if(/Hand|Finger/.test(n))hand+=w;if(/Foot|Toe/.test(n))foot+=w;}return(head>.2&&pos.getY(i)>1.445)||hand>.65||(foot>.4&&pos.getY(i)<.20);};for(let k=0;k<g.index.count;k+=3){const a=g.index.getX(k),b=g.index.getX(k+1),c=g.index.getX(k+2);if(keep(a)&&keep(b)&&keep(c))kept.push(a,b,c);}humanDressedIndex=new THREE.Uint32BufferAttribute(kept,1);}
 let catHeadIndex,catHeadDressed;if(isCat){const g=actor.rig.parts.get(0).geometry;catHeadIndex=g.index.clone();const ix=[];for(let i=0;i<g.index.count;i+=3){const a=g.index.getX(i),b=g.index.getX(i+1),c=g.index.getX(i+2);if([a,b,c].every(n=>g.attributes.position.getY(n)>.565))ix.push(a,b,c);}catHeadDressed=new THREE.Uint32BufferAttribute(ix,1);}
 actor.model.add(group);group.visible=false;actor.outfit='original';actor.outfitMeshes=outfitMeshes;
 actor.setOutfit=value=>{const enabled=value===def.id;actor.outfit=enabled?def.id:'original';group.visible=enabled;
 if(isCat){actor.rig.parts.get(0).geometry.setIndex(enabled?catHeadDressed:catHeadIndex);const keepParts=new Set([0,1,2,3,22,29,32,38,44,48,51]);for(const {mesh,visible}of original){const part=Number(mesh.name.replace('tripo_part_',''));const keep=keepParts.has(part)||/closed_paw|tail_fine_fur|flowing_cheek_fur|fan/.test(mesh.name)||mesh.parent===actor.rig.fan;mesh.visible=enabled?(visible&&keep):visible;}actor.rig.fan.visible=actor.fanEquipped;}
 else template.geometry.setIndex(enabled?humanDressedIndex:humanOriginalIndex);
 return actor.outfit;};
 try{const saved=JSON.parse(localStorage.getItem('zzb-outfits-v12')||'{}');actor.setOutfit(saved[id]||'original');}catch{}
 return actor;
}

export function lazyOutfit(actor,id){
 actor.outfit='original';let pending=null;
 actor.ensureOutfit=()=>{if(actor.outfitMeshes)return Promise.resolve(actor);if(!pending)pending=attachOutfit(actor,id).catch(e=>{pending=null;throw e;});return pending;};
 return actor;
}
