"""Moon-pouch, original rigged creature. Run in Blender; never replaces a scene.
Z up / face -Y. GLB is Y up / face +Z. No external assets or paid services.
"""
import bpy, bmesh, math, json, struct
from pathlib import Path
from mathutils import Vector
from mathutils import noise

BASE=Path(r'C:/Users/ctyok/Documents/Codex/2026-10-30/three-js-blender-mcp-github-https')
OUT=BASE/'outputs'; ASSET=BASE/'work/site-source/dist/assets/creatures'
SC=None; ROOT=None; RIG=None; PARTS=[]; M={}; ACTIONS=[]
def en(rna,key,value):
    values=[i.identifier for i in rna.properties[key].enum_items]
    return next(v for v in values if v.lower()==value.lower())
def lin(h):
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
def mat(name,color,emit=0,rough=.86,vertex=False):
    m=bpy.data.materials.new('YD '+name);m.use_nodes=True;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*lin(color),1);p.inputs['Roughness'].default_value=rough
    if emit:p.inputs['Emission Color'].default_value=(*lin(color),1);p.inputs['Emission Strength'].default_value=emit
    if vertex:
        n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='MoonTint';m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
    m.diffuse_color=(*lin(color),1);return m
def mesh(name,vs,fs,material,weights,colors=None):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);SC.collection.objects.link(o);me.materials.append(material)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    for p in me.polygons:p.use_smooth=True
    if colors:
        a=me.color_attributes.new(name='MoonTint',type=en(bpy.types.Attribute.bl_rna,'data_type','FLOAT_COLOR'),domain=en(bpy.types.Attribute.bl_rna,'domain','POINT'))
        for i,c in enumerate(colors):a.data[i].color=(*c,1)
        me.color_attributes.active_color=a
    PARTS.append((o,weights));return o
def tint(p):
    x,y,z=p;v=.97+.025*noise.noise(Vector((x*22,y*22,z*22)))+.018*math.sin(z*25+x*19)
    a=lin('e9d9ba');b=lin('fff4d9');t=.38+.30*max(0,-y/.35)+.16*z
    return tuple((a[k]*(1-t)+b[k]*t)*v for k in range(3))
def sphere(name,center,scale,material,bone,seg=24,rings=16):
    vs=[];fs=[]
    for i in range(rings+1):
        v=i/rings*math.pi
        for j in range(seg):
            u=j/seg*math.tau;p=(center[0]+scale[0]*math.sin(v)*math.cos(u),center[1]+scale[1]*math.sin(v)*math.sin(u),center[2]+scale[2]*math.cos(v));vs.append(p)
    for i in range(rings):
        for j in range(seg):a=i*seg+j;b=i*seg+(j+1)%seg;fs.append((a,b,b+seg,a+seg))
    return mesh(name,vs,fs,material,lambda p:{bone:1},[tint(p) for p in vs] if material==M['fur'] else None)
def body():
    vs=[];fs=[];N=48;K=36
    for i in range(K+1):
        t=i/K;z=.025+1.025*t;r=math.sin(math.pi*t)**.47*(.50-.19*t)
        for j in range(N):
            a=j/N*math.tau;x=r*math.cos(a);y=r*.79*math.sin(a)-.035*t
            # Small cheek/face plane and a gentle pear belly, no stacked primitives.
            y-=.021*math.exp(-((z-.88)/.15)**2)*max(0,-math.sin(a))
            vs.append((x,y,z))
    for i in range(K):
        for j in range(N):a=i*N+j;b=i*N+(j+1)%N;fs.append((a,b,b+N,a+N))
    def w(p):
        z=p[2];h=max(0,min(1,(z-.68)/.23));s=max(0,min(1,(z-.32)/.32))*(1-h)
        return {'YD_Head':h,'YD_Spine':s,'YD_Hips':1-h-s}
    return mesh('YD_Body',vs,fs,M['fur'],w,[tint(p) for p in vs])
def crescent():
    vs=[];fs=[];cols=[];N=64;K=20
    def path(t):
        # asymmetric continuous moon: a low left tip and a tall curling right tip
        x=-.53+1.06*t-.085*t**8;z=.94+.41*(abs(2*t-1)**2.3)+.20*t**5
        return Vector((x,.005,z))
    for i in range(N+1):
        t=i/N;c=path(t);tangent=(path(min(1,t+.001))-path(max(0,t-.001))).normalized();normal=Vector((-tangent.z,0,tangent.x))
        r=.135*math.sin(math.pi*t)**.60+.003;d=.205*math.sin(math.pi*t)**.63+.003
        for j in range(K):
            a=j/K*math.tau;p=c+normal*(math.cos(a)*r)+Vector((0,math.sin(a)*d,0));vs.append(tuple(p))
            warm=max(0,math.cos(a))**4*.85;cream=tint(p);gold=lin('f6ce76');cols.append(tuple(cream[k]*(1-warm)+gold[k]*warm for k in range(3)))
    for i in range(N):
        for j in range(K):a=i*K+j;b=i*K+(j+1)%K;fs.append((a,b,b+K,a+K))
    fs+=[tuple(reversed(range(K))),tuple(N*K+j for j in range(K))]
    def weights(p):
        sign='L' if p[0]>0 else 'R';t=max(0,min(1,abs(p[0])/.53));u=t*3
        if u<1:return {'YD_Head':1-u,'YD_Crest_'+sign+'1':u}
        if u<2:return {'YD_Crest_'+sign+'1':2-u,'YD_Crest_'+sign+'2':u-1}
        return {'YD_Crest_'+sign+'2':3-u,'YD_Crest_'+sign+'3':u-2}
    outer=mesh('YD_MoonPouch',vs,fs,M['fur'],weights,cols)
    # An inset golden lining reveals that this crescent is a moonlight pouch.
    iv=[];faces=[];count=48;cross=4
    for i in range(count+1):
        t=.12+.77*i/count;c=path(t);tan=(path(t+.001)-path(t-.001)).normalized();normal=Vector((-tan.z,0,tan.x))
        for j in range(cross+1):
            a=-1.26+1.05*j/cross;r=.135*math.sin(math.pi*t)**.60+.0045;d=.205*math.sin(math.pi*t)**.63+.0045
            iv.append(tuple(c+normal*(math.cos(a)*r)+Vector((0,math.sin(a)*d,0))))
    for i in range(count):
        for j in range(cross):a=i*(cross+1)+j;b=a+cross+1;faces.append((a,b,b+1,a+1))
    mesh('YD_MoonLining',iv,faces,M['lining'],weights)
    return outer
def limb(sign,leg=False):
    side='L' if sign>0 else 'R';tag='Leg' if leg else 'Arm';vs=[];fs=[];N=20;K=12
    start=Vector((sign*(.20 if leg else .29),0,.24 if leg else .76));end=Vector((sign*(.25 if leg else .40),-.10 if leg else -.12,.055 if leg else .37));axis=(end-start).normalized();sideV=Vector((0,1,0));cross=axis.cross(sideV).normalized()
    for i in range(N+1):
        t=i/N;c=start.lerp(end,t);c.y-=.045*math.sin(math.pi*t)
        r=(.10 if leg else .093)*math.sin(math.pi*t)**.56+.006
        for j in range(K):
            a=j/K*math.tau;p=c+sideV*(r*math.sin(a))+cross*(r*math.cos(a));vs.append(tuple(p))
    for i in range(N):
        for j in range(K):a=i*K+j;b=i*K+(j+1)%K;fs.append((a,b,b+K,a+K))
    fs+=[tuple(reversed(range(K))),tuple(N*K+j for j in range(K))]
    def weight(p):
        t=max(0,min(1,(Vector(p)-start).dot(end-start)/(end-start).length_squared));v=max(0,min(1,(t-.22)/.55))
        foot=max(0,min(1,(t-.66)/.34)) if leg else 0
        return {'YD_'+tag+'Upper_'+side:1-v,'YD_'+tag+'Lower_'+side:v*(1-foot),**({'YD_Foot_'+side:v*foot} if leg else {})}
    o=mesh('YD_'+tag+'Mesh_'+side,vs,fs,M['fur'],weight,[tint(p) for p in vs])
    if leg:sphere('YD_FootMesh_'+side,(sign*.24,-.075,.048),(.105,.15,.049),M['fur'],'YD_Foot_'+side)
    return o
def tube(name,points,radius,material,bone):
    vs=[];fs=[];K=8
    for i,p0 in enumerate(points):
        p=Vector(p0);t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized();side=t.cross(Vector((0,1,0))).normalized();up=t.cross(side).normalized()
        for j in range(K):a=j/K*math.tau;vs.append(tuple(p+radius*(side*math.cos(a)+up*math.sin(a))))
    for i in range(len(points)-1):
        for j in range(K):a=i*K+j;b=i*K+(j+1)%K;fs.append((a,b,b+K,a+K))
    return mesh(name,vs,fs,material,lambda p:{bone:1})
def face():
    for s in (-1,1):
        side='L' if s>0 else 'R';center=(s*.125,-.253,.877)
        eye=sphere('YD_Eye_'+side,center,(.026,.016,.035),M['ink'],'YD_Head',24,12)
        eye.shape_key_add(name='Basis');blink=eye.shape_key_add(name='Blink');blink.value=0
        for v in blink.data:v.co.z=center[2]+(v.co.z-center[2])*.1
        sphere('YD_EyeLight_'+side,(s*.119,-.268,.888),(.006,.003,.008),M['light'],'YD_Head',12,8)
        sphere('YD_Blush_'+side,(s*.18,-.233,.826),(.039,.007,.019),M['blush'],'YD_Head',20,12)
    tube('YD_Mouth',[(-.019,-.296,.817),(-.01,-.298,.825),(0,-.299,.827),(.01,-.298,.825),(.019,-.296,.817)],.004,M['ink'],'YD_Head')
    # A softly inset crescent seam is a pouch rather than a detached ornament.
    pts=[]
    for i in range(19):t=i/18;x=-.12+.24*t;pts.append((x,-.302-.025*math.sin(math.pi*t),.60-.045*math.sin(math.pi*t)))
    tube('YD_PocketSeam',pts,.008,M['gold'],'YD_Spine')
    sphere('YD_MoonSeed',(0,-.18,1.21),(.024,.024,.032),M['glow'],'YD_Seed',20,12)
def rig():
    global RIG
    data=bpy.data.armatures.new('YD_Skeleton');RIG=bpy.data.objects.new('YD_Rig',data);SC.collection.objects.link(RIG);RIG.parent=ROOT
    bpy.ops.object.select_all(action='DESELECT');RIG.select_set(True);bpy.context.view_layer.objects.active=RIG;bpy.ops.object.mode_set(mode='EDIT')
    def bone(n,a,b,parent=None):
        o=data.edit_bones.new('YD_'+n);o.head=a;o.tail=b
        if parent:o.parent=data.edit_bones['YD_'+parent]
    bone('Root',(0,0,0),(0,0,.1));bone('Hips',(0,0,.2),(0,0,.47),'Root');bone('Spine',(0,0,.47),(0,-.015,.75),'Hips');bone('Head',(0,-.015,.75),(0,-.015,1.04),'Spine')
    for s in (-1,1):
        q='L' if s>0 else 'R'
        for i,(a,b) in enumerate([((0,0,.98),(s*.2,0,1.01)),((s*.2,0,1.01),(s*.39,0,1.18)),((s*.39,0,1.18),(s*.49,0,1.45 if s>0 else 1.32))]):bone('Crest_'+q+str(i+1),a,b,'Head' if i==0 else 'Crest_'+q+str(i))
        bone('ArmUpper_'+q,(s*.29,0,.76),(s*.36,-.055,.56),'Spine');bone('ArmLower_'+q,(s*.36,-.055,.56),(s*.4,-.12,.37),'ArmUpper_'+q);bone('Hand_'+q,(s*.4,-.12,.37),(s*.4,-.15,.32),'ArmLower_'+q)
        bone('LegUpper_'+q,(s*.20,0,.24),(s*.235,-.045,.14),'Hips');bone('LegLower_'+q,(s*.235,-.045,.14),(s*.25,-.1,.055),'LegUpper_'+q);bone('Foot_'+q,(s*.25,-.1,.055),(s*.25,-.21,.055),'LegLower_'+q)
    bone('Seed',(0,-.18,1.2),(0,-.18,1.25),'Head');bpy.ops.object.mode_set(mode='OBJECT')
    for o,weights in PARTS:
        for b in data.bones:o.vertex_groups.new(name=b.name)
        for v in o.data.vertices:
            w={k:max(0,val) for k,val in weights(v.co).items() if val>1e-7};total=sum(w.values())
            for k,val in w.items():o.vertex_groups[k].add([v.index],val/total,'REPLACE')
        mod=o.modifiers.new('Moon pouch skin','ARMATURE');mod.object=RIG;o.parent=RIG
    for p in RIG.pose.bones:p.rotation_mode='XYZ'
def animate():
    RIG.animation_data_create()
    for name,last,step in [('Idle',121,4),('Walk',31,2),('Greet',91,3),('Pocket',121,3)]:
        a=bpy.data.actions.new('YD_'+name);a.use_fake_user=True;RIG.animation_data.action=a
        for f in range(1,last+1,step):
            t=(f-1)/(last-1);q=t*math.tau
            for b in RIG.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
            b=RIG.pose.bones
            b['YD_Spine'].rotation_euler.x=.018*math.sin(q);b['YD_Head'].rotation_euler.y=.04*math.sin(q);b['YD_Head'].rotation_euler.z=.035*math.sin(q+.4)
            for s,side in [(1,'L'),(-1,'R')]:
                for i in (1,2,3):b['YD_Crest_'+side+str(i)].rotation_euler.y=s*.028*math.sin(q+i*.35)
            if name=='Walk':
                bounce=.005*(1-math.cos(q*2));b['YD_Hips'].location.y=bounce;b['YD_Hips'].rotation_euler.y=.055*math.sin(q)
                for s,side in [(1,'L'),(-1,'R')]:
                    phase=q+(0 if s>0 else math.pi);v=math.sin(phase)
                    b['YD_LegUpper_'+side].rotation_euler.x=.43*v;b['YD_LegLower_'+side].rotation_euler.x=-.45*max(0,v);b['YD_Foot_'+side].rotation_euler.x=-.22*v
                    b['YD_Foot_'+side].location.z=.045*max(0,v)**1.5-bounce
                    b['YD_ArmUpper_'+side].rotation_euler.x=-.20*v;b['YD_ArmLower_'+side].rotation_euler.x=.10*math.cos(phase)
                b['YD_Head'].rotation_euler.y=.04*math.sin(q)
            elif name=='Greet':
                e=math.sin(math.pi*t)**2;b['YD_ArmUpper_L'].rotation_euler.z=-1.6*e;b['YD_ArmUpper_L'].rotation_euler.x=-.40*e;b['YD_ArmLower_L'].rotation_euler.x=-.8*e+.32*math.sin(q*3)*e;b['YD_Head'].rotation_euler.z=-.12*e
                b['YD_Crest_L2'].rotation_euler.y=.16*e;b['YD_Crest_R2'].rotation_euler.y=-.12*e
            elif name=='Pocket':
                e=math.sin(math.pi*t)**2;b['YD_Head'].rotation_euler.x=.20*e;b['YD_Spine'].rotation_euler.x=.08*e
                for s,side in [(1,'L'),(-1,'R')]:
                    b['YD_ArmUpper_'+side].rotation_euler.x=-.72*e;b['YD_ArmUpper_'+side].rotation_euler.z=s*.30*e;b['YD_ArmLower_'+side].rotation_euler.x=-.70*e
                    b['YD_Crest_'+side+'2'].rotation_euler.y=s*.12*e;b['YD_Crest_'+side+'3'].rotation_euler.y=s*.15*e
                b['YD_Seed'].location.y=.18*e;b['YD_Seed'].location.z=.10*e
            for pb in b:
                pb.keyframe_insert('rotation_euler',frame=f);pb.keyframe_insert('location',frame=f)
        ACTIONS.append(a)
    RIG.animation_data.action=ACTIONS[0];SC.frame_start=1;SC.frame_end=121;SC.frame_set(1)
def studio():
    SC.world=bpy.data.worlds.new('YD Studio');SC.world.use_nodes=True;p=next(n for n in SC.world.node_tree.nodes if n.type=='BACKGROUND');p.inputs['Color'].default_value=(*lin('b9b5ca'),1);p.inputs['Strength'].default_value=.45
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));floor=bpy.context.object;floor.name='YD_StudioFloor';floor.data.materials.append(mat('studio','77768b'))
    for name,loc,power,color in [('Key',(-3,-4,4),330,(1,.86,.65)),('Fill',(3,-1,2),180,(.72,.8,1)),('Rim',(1,3,4),420,(1,.85,.54))]:
        d=bpy.data.lights.new('YD_'+name,type='AREA');d.energy=power;d.size=3;d.color=color;o=bpy.data.objects.new('YD_'+name,d);SC.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('YD_Camera');d.type='ORTHO';d.ortho_scale=1.95;o=bpy.data.objects.new('YD_Camera',d);SC.collection.objects.link(o);o.location=(1.8,-3.4,1.65);o.rotation_euler=(Vector((0,0,.75))-o.location).to_track_quat('-Z','Y').to_euler();SC.camera=o
    SC.render.resolution_x=900;SC.render.resolution_y=1000;SC.render.resolution_percentage=100;SC.render.image_settings.file_format=en(bpy.types.ImageFormatSettings.bl_rna,'file_format','PNG')
    try:SC.render.engine='BLENDER_EEVEE'
    except TypeError:pass
def export():
    RIG.animation_data.action=ACTIONS[0];SC.frame_set(1)
    for o,_ in PARTS:
        if o.data.shape_keys:o.data.shape_keys.key_blocks['Blink'].value=0
    bpy.ops.object.select_all(action='DESELECT');ROOT.select_set(True);RIG.select_set(True)
    for o,_ in PARTS:o.select_set(True)
    bpy.context.view_layer.objects.active=RIG;rna=bpy.ops.export_scene.gltf.get_rna_type()
    opts=dict(filepath=str(ASSET/'yuedai-v1.glb'),check_existing=False,use_selection=True,use_active_scene=True,export_yup=True,export_animations=True,export_skins=True,export_morph=True,export_morph_animation=False,export_extras=True,export_cameras=False,export_lights=False,export_force_sampling=True,export_animation_mode=en(rna,'export_animation_mode','ACTIONS'),export_frame_range=False,export_anim_single_armature=True,export_vertex_color=en(rna,'export_vertex_color','MATERIAL'),export_reset_pose_bones=True)
    try:bpy.ops.export_scene.gltf(export_format='__query__')
    except TypeError as e:
        if "'GLB'" not in str(e):raise
    opts['export_format']='GLB';bpy.ops.export_scene.gltf(**opts)
    raw=(ASSET/'yuedai-v1.glb').read_bytes();old_len=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+old_len])
    # Blender 5.2's single-armature mode also considers unrelated actions in
    # other scenes. Keep only this creature's four authored clips in the GLB.
    data['animations']=[a for a in data.get('animations',[]) if a['name'].startswith('YD_')]
    for m in data.get('meshes',[]):
        if 'weights' in m:m['weights']=[0 for _ in m['weights']]
    js=json.dumps(data,separators=(',',':')).encode();js+=b' '*((-len(js))%4);tail=raw[20+old_len:]
    raw=struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),0x4e4f534a)+js+tail;(ASSET/'yuedai-v1.glb').write_bytes(raw)
    for o,_ in PARTS:
        if o.data.shape_keys:o.data.shape_keys.key_blocks['Blink'].value=0
    bpy.data.libraries.write(str(OUT/'yuedai-v1.blend'),{SC,*ACTIONS},fake_user=True,compress=True)
    stats={'bones':list(RIG.data.bones.keys()),'animations':[a['name'] for a in data.get('animations',[])],'triangles':sum(len(p.vertices)-2 for o,_ in PARTS for p in o.data.polygons),'bytes':len(raw),'file':bpy.data.filepath,'scene':SC.name}
    (OUT/'yuedai-v1-report.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(stats,ensure_ascii=False))
def render():
    RIG.animation_data.action=ACTIONS[0];SC.frame_set(1);SC.render.filepath=str(OUT/'yuedai-v1-three-quarter.png');bpy.ops.render.render(write_still=True,scene=SC.name)
def render_actions():
    """A native Blender render of four evaluated 3D poses; no image compositing."""
    preview=bpy.data.scenes.new('YD Four authored actions');preview.world=SC.world
    for i,(index,frame,label) in enumerate([(0,1,'IDLE'),(1,9,'WALK'),(2,46,'HELLO'),(3,61,'MOON POUCH')]):
        bpy.context.window.scene=SC;RIG.animation_data.action=ACTIONS[index];SC.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
        for original,_ in PARTS:
            me=bpy.data.meshes.new_from_object(original.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg);o=bpy.data.objects.new('YD Pose '+label,me);preview.collection.objects.link(o);o.matrix_world=original.matrix_world.copy();o.location.x+=i*1.25
        curve=bpy.data.curves.new('YD label','FONT');curve.body=label;curve.align_x='CENTER';curve.size=.105
        obj=bpy.data.objects.new('YD '+label,curve);preview.collection.objects.link(obj);obj.location=(i*1.25,-.38,-.13);obj.rotation_euler.x=math.pi/2;curve.materials.append(M['light'])
    for o in SC.objects:
        if o.type=='LIGHT':n=o.copy();n.data=o.data.copy();preview.collection.objects.link(n);n.location.x+=1.8;n.data.energy*=1.4;n.data.size=5
    bpy.context.window.scene=preview
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.17));floor=bpy.context.object;floor.data.materials.append(bpy.data.objects['YD_StudioFloor'].data.materials[0])
    camera=SC.camera.copy();camera.data=SC.camera.data.copy();preview.collection.objects.link(camera);preview.camera=camera;camera.location=(1.9,-7,2.1);camera.rotation_euler=(Vector((1.9,0,.69))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=5.0
    preview.render.engine=SC.render.engine;preview.render.resolution_x=1600;preview.render.resolution_y=650;preview.render.resolution_percentage=100;preview.render.image_settings.file_format=en(bpy.types.ImageFormatSettings.bl_rna,'file_format','PNG');preview.render.filepath=str(OUT/'yuedai-v1-animation.png');bpy.ops.render.render(write_still=True,scene=preview.name)
    bpy.context.window.scene=SC;RIG.animation_data.action=ACTIONS[0];SC.frame_set(1)
def build():
    global SC,ROOT,M
    if bpy.data.scenes.get('月袋 Yuedai v1'):raise RuntimeError('Dedicated scene already exists; do not overwrite')
    SC=bpy.data.scenes.new('月袋 Yuedai v1');bpy.context.window.scene=SC;SC.render.fps=30
    ROOT=bpy.data.objects.new('YD_Root',None);SC.collection.objects.link(ROOT)
    M={'fur':mat('Ivory brushed silk','fff2d4',vertex=True),'ink':mat('Cocoa eyes','352b34',rough=.3),'light':mat('Eye glint','fff5db',emit=.15),'blush':mat('Apricot cheeks','e8b6a0'),'gold':mat('Pouch seam','c8a163'),'glow':mat('Moonlight seed','ffe2a0',emit=1.6),'lining':mat('Moon pouch lining','efc978',emit=.18)}
    body();crescent();limb(-1);limb(1);limb(-1,True);limb(1,True);face();rig();animate();studio();bpy.context.view_layer.update()
    bpy.app.driver_namespace['yuedai_builder']={'scene':SC,'root':ROOT,'rig':RIG,'parts':PARTS,'actions':ACTIONS,'export':export,'render':render}
    export();print('Yuedai ready for visual inspection')
if __name__=='__main__':build()
