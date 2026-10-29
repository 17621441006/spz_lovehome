"""Hand-shaped refinements for the live Blender sculpt, before skinning/export.
Run through Blender MCP after build_dengweirong.build_form(). No original data touched.
"""
import bpy, math, random
from mathutils import Vector

def run(m):
    rng=random.Random(84221)
    if m.ROOT.get('dwr_refined'):raise RuntimeError('Already refined; inspect before applying twice')
    # Deliberately asymmetric botanical ears, with a taper and a small curl.
    for sign in (-1,1):
        o=bpy.data.objects['DWR_EarMesh_'+('L' if sign>0 else 'R')]
        for i in range(23):
            t=i/22
            if sign<0:
                x=sign*(.176+.38*t-.055*t**7);z=.84+.225*t-.015*math.sin(math.pi*t)+.055*t**6
                dx=sign*(.38-.385*t**6);dz=.225-.015*math.pi*math.cos(math.pi*t)+.33*t**5
            else:
                x=sign*(.176+.44*t-.045*t**7);z=.84-.15*math.sin(t*math.pi*.7)+.05*t**7
                dx=sign*(.44-.315*t**6);dz=-.105*math.pi*math.cos(t*math.pi*.7)+.35*t**6
            tangent=Vector((dx,0,dz)).normalized();wide=Vector((-tangent.z,0,tangent.x))
            if wide.z<0:wide=-wide
            cy=-.105-.05*math.sin(math.pi*t)-.05*t**5
            width=.073*math.sin(math.pi*t)**.8+.008*(1-t);thick=.012*(1-.7*t)
            for j in range(14):
                a=j/14*math.tau;v=o.data.vertices[i*14+j]
                ripple=.0028*math.sin(t*math.pi*6)*math.sin(math.pi*t)
                v.co=Vector((x,cy,z))+wide*((width+ripple)*math.cos(a))+Vector((0,thick*math.sin(a)-.016*math.sin(math.pi*t)*math.cos(a)**2,0))
        o.data.update()
    # One continuous remeshed body: flatten only the paw ends, retaining ankles.
    for v in m.BODY.data.vertices:
        x,y,z=v.co
        if z<.135:
            influence=m.soft(.135,.03,z)
            cy=-.205 if y<-.045 else .137
            v.co.y=cy+(y-cy)*(1+.18*influence)
            v.co.z=z*(1-.18*influence)
    m.BODY.data.update()
    color=m.BODY.data.color_attributes['FurTint']
    cream=m.linear('#f1e1bb');moss=m.linear('#87994f')
    for i,v in enumerate(m.BODY.data.vertices):
        c,mask=m.fur_color(v.co)
        paw=m.soft(.145,.065,v.co.z)*m.soft(.07,.13,abs(v.co.x))
        variation=.95+.055*math.sin(v.co.x*58+v.co.z*34)*math.cos(v.co.y*47)
        color.data[i].color=(*(c[k]*(1-paw)+cream[k]*paw*variation for k in range(3)),1)
    # Faint toe seams follow the continuous paw surface; no separate ball toes.
    toe=m.mat('DWR · Paw crease','#b69e77',.95)
    for side in (-1,1):
        for back in (False,True):
            x0=side*(.205 if back else .169);front=.006 if back else -.333
            for q in (-1,1):
                x=x0+q*.025
                o=m.curve_tube('DWR_ToeFold',[(x,front,.039),(x,front+.013,.059),(x,front+.033,.072)],.0015,toe,res=4)
                m.PARTS.append((o,'DWR_Foot_'+('B' if back else 'F')+('L' if side>0 else 'R')))
    # Flat, sculpted leaf-fur tufts share only two meshes; smooth body still carries volume.
    def leaves(name,samples,bone):
        verts=[];faces=[];colors=[]
        for p,n,heading,length,width,c in samples:
            n=n.normalized();heading=heading-n*heading.dot(n)
            if heading.length<.01:heading=n.cross(Vector((1,0,0)))
            heading.normalize();side=heading.cross(n).normalized();start=len(verts)
            for j in range(6):
                t=j/5;w=width*(math.sin(math.pi*t)**.72+.03*(1-t))
                center=p+heading*(length*t)+n*(-.003+.012*math.sin(math.pi*t)+.016*t*t)
                for a in (-1,0,1):
                    v=center+side*w*a+n*(.003*math.sin(math.pi*t)*(1-abs(a)))
                    verts.append(v);factor=(.89+.18*t)*(1.05 if a==0 else .98)
                    colors.append(tuple(min(1,k*factor) for k in c))
            for j in range(5):
                for a in range(2):q=start+j*3+a;faces.append((q,q+1,q+4,q+3))
        o=m.mesh_object(name,verts,faces,m.MATS['fur'],colors);m.PARTS.append((o,bone));return o
    candidates=list(m.BODY.data.vertices);rng.shuffle(candidates);samples=[];chosen=[]
    for v in candidates:
        p=v.co.copy();n=v.normal.copy();c,creamness=m.fur_color(p)
        if p.z<.15 or creamness>.35:continue
        if p.y<-.24 and abs(p.x)<.205 and p.z<.81:continue
        if any((p-q).length<.038 for q in chosen):continue
        chosen.append(p)
        # Crown combs outward, cheeks and chest downward, back sweeps to the tail.
        heading=Vector((p.x*.9,.08,-1)) if p.z<.80 else Vector((p.x*1.8,.08,.20))
        if p.y>.05:heading=Vector((p.x*.15,.4,-.9))
        samples.append((p,n,heading,rng.uniform(.035,.067),rng.uniform(.009,.016),tuple(k*rng.uniform(.88,1.1) for k in c)))
        if len(samples)>=195:break
    leaves('DWR_MossTufts',samples,'body')
    tail=bpy.data.objects['DWR_TailMesh'];candidates=list(tail.data.vertices);rng.shuffle(candidates);chosen=[];samples=[]
    for v in candidates:
        p=v.co.copy();n=v.normal.copy()
        if p.z<.37 or any((p-q).length<.035 for q in chosen):continue
        chosen.append(p)
        heading=Vector((-.2,0,1)) if p.z<1.02 else Vector((-1,0,-.3))
        c=m.linear(rng.choice(['#819543','#91a65b','#758b42','#a6ad62']))
        samples.append((p,n,heading,rng.uniform(.045,.072),rng.uniform(.012,.019),c))
        if len(samples)>=115:break
    leaves('DWR_TailTufts',samples,'DWR_Tail')
    # Give the dew a golden glass edge and a small luminous suspended seed.
    lamp=m.MATS['lamp'];bs=next(n for n in lamp.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value=(*m.linear('#e7a521'),1)
    bs.inputs['Roughness'].default_value=.15;bs.inputs['Transmission Weight'].default_value=.65
    bs.inputs['IOR'].default_value=1.38;bs.inputs['Coat Weight'].default_value=.35
    bs.inputs['Emission Color'].default_value=(*m.linear('#f7a522'),1);bs.inputs['Emission Strength'].default_value=.5
    core=m.mat('DWR · Luminous dew heart','#ffe6a0',.18,emit=3.0)
    o=m.sphere('DWR_LanternCore',(.205,.145,.983),(.016,.016,.022),core,20,12);m.PARTS.append((o,'DWR_Lantern'))
    o=m.curve_tube('DWR_LanternFilament',[(.205,.145,1.07),(.199,.145,1.038),(.205,.145,1.00)],.0022,core,res=6);m.PARTS.append((o,'DWR_Lantern'))
    for o,_ in m.PARTS:o.parent=m.ROOT
    m.ROOT['dwr_refined']=True
    bpy.context.view_layer.update()
    print({'parts':len(m.PARTS),'tris':sum(len(p.vertices)-2 for o,_ in m.PARTS for p in o.data.polygons),'originalSceneObjects':[o.name for o in bpy.data.scenes['Scene'].objects]})

if __name__=='__main__':run(bpy.app.driver_namespace['dwr_builder'])
