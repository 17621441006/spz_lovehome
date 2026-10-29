"""Exportable vertex-color glazing: warm, quiet pigment variation without textures."""
import bpy,bmesh,math
from mathutils import Vector,noise

def run(m):
    if m.ROOT.get('dwr_painted'):raise RuntimeError('Paint already applied')
    body=m.BODY;layer=body.data.color_attributes['FurTint']
    for i,v in enumerate(body.data.vertices):
        p=v.co;c=list(layer.data[i].color[:3]);_,cream=m.fur_color(p)
        n=noise.noise(p*12+Vector((2.4,1.8,.3)));fine=noise.noise(p*77)
        warm=max(0,noise.noise(p*7+Vector((.4,2.8,.9))))
        strength=.13 if cream<.5 and p.z>.14 else .035
        for k in range(3):c[k]*=1+strength*n+.025*fine
        if cream<.5 and p.z>.14:
            gold=m.linear('#a8a957');amount=.13*warm
            c=[c[k]*(1-amount)+gold[k]*amount for k in range(3)]
        cheek=math.exp(-((abs(p.x)-.153)/.044)**2-((p.z-.637)/.034)**2)*m.soft(-.18,-.28,p.y)*cream*.24
        pink=m.linear('#edac8b');c=[c[k]*(1-cheek)+pink[k]*cheek for k in range(3)]
        layer.data[i].color=(*c,1)
    for name in ['DWR_EarMesh_L','DWR_EarMesh_R']:
        o=bpy.data.objects[name];a=o.data.color_attributes['FurTint']
        for i,c in enumerate(a.data):
            t=(i//14)/22;angle=(i%14)/14*math.tau
            inner=max(0,-math.sin(angle));vein=math.exp(-(math.cos(angle)/.28)**2)*inner*math.sin(math.pi*t)*.22
            base=c.color[:3];leaf=m.linear('#b4b66e')
            stripe=.025*math.sin(t*math.pi*15+abs(math.cos(angle))*6)*inner
            c.color=(*(base[k]*(1-vein)*(1+stripe)+leaf[k]*vein for k in range(3)),1)
    for name in ['DWR_MossTufts','DWR_TailTufts']:
        o=bpy.data.objects[name];a=o.data.color_attributes['FurTint'];tip=m.linear('#c2bc70')
        for i,c in enumerate(a.data):
            t=((i%18)//3)/5;ridge=(i%3)==1;amount=.16*t**2+(.06 if ridge else 0);base=c.color[:3]
            c.color=(*(base[k]*(1-amount)+tip[k]*amount for k in range(3)),1)
    bs=next(n for n in m.MATS['lamp'].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Transmission Weight'].default_value=0
    bs.inputs['Base Color'].default_value=(*m.linear('#b77919'),1)
    bs.inputs['Emission Color'].default_value=(*m.linear('#ffc44f'),1)
    bs.inputs['Emission Strength'].default_value=.85
    bs.inputs['Roughness'].default_value=.24
    # Weld collapsed petal/leaf tips and the lathe poles. These should be real
    # shared apex vertices, rather than exporting zero-area end triangles.
    for name in ('DWR_EarMesh_L','DWR_EarMesh_R','DWR_LanternMesh','DWR_MossTufts','DWR_TailTufts'):
        o=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
        for face in list(bm.faces):
            if face.calc_area()<1e-12:bm.faces.remove(face)
        bm.to_mesh(o.data);bm.free();o.data.update()
    m.ROOT['dwr_painted']=True

if __name__=='__main__':run(bpy.app.driver_namespace['dwr_builder'])
