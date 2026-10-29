"""Dengweirong: original creature sculpt, executed in the user's Blender via MCP.
All objects live in a new scene; original scene/data and character files stay intact.
Blender coordinates: Z up, face -Y; glTF exporter converts to Three +Y up/+Z front.
"""
import bpy, math, random, json
from mathutils import Vector, Matrix
from mathutils import noise
from pathlib import Path

OUT=Path(r'C:/Users/ctyok/Documents/Codex/2026-10-30/three-js-blender-mcp-github-https/outputs')
ASSET=Path(r'C:/Users/ctyok/Documents/Codex/2026-10-30/three-js-blender-mcp-github-https/work/site-source/dist/assets/creatures')
SCENE_NAME='Dengweirong · Lantern-tail Mossling'
SC=None;COL=None;ROOT=None;BODY=None;PARTS=[];MATS={}

def enum(rna,prop,wanted):
    values=[i.identifier for i in rna.properties[prop].enum_items]
    return next(v for v in values if v.lower()==wanted.lower())

def modifier(obj,name,kind):
    choices=[i.identifier for i in bpy.types.ObjectModifiers.bl_rna.functions['new'].parameters['type'].enum_items]
    return obj.modifiers.new(name,next(x for x in choices if x.lower()==kind.lower()))

def linear(hexcolor):
    v=[int(hexcolor.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in v)

def mat(name,color,rough=.8,metal=0,emit=0,vertex=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value=(*linear(color),1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emit:b.inputs['Emission Color'].default_value=(*linear(color),1);b.inputs['Emission Strength'].default_value=emit
    if vertex:
        v=m.node_tree.nodes.new('ShaderNodeVertexColor');v.layer_name='FurTint';m.node_tree.links.new(v.outputs['Color'],b.inputs['Base Color'])
    m.diffuse_color=(*linear(color),1)
    return m

def move_to_collection(obj):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    COL.objects.link(obj)

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def smooth(obj):
    for p in obj.data.polygons:p.use_smooth=True

def sphere(name,loc,scale,material=None,segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.name=name;move_to_collection(o);o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);smooth(o)
    if material:o.data.materials.append(material)
    return o

def mesh_object(name,verts,faces,material,colors=None):
    me=bpy.data.meshes.new(name+' Geometry');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);COL.objects.link(o);me.materials.append(material);smooth(o)
    if colors:
        a=me.color_attributes.new(name='FurTint',type=enum(bpy.types.Attribute.bl_rna,'data_type','FLOAT_COLOR'),domain=enum(bpy.types.Attribute.bl_rna,'domain','POINT'))
        for i,c in enumerate(colors):a.data[i].color=(*c,1)
        me.color_attributes.active_color=a
    return o

def soft(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def fur_color(p):
    x,y,z=p
    front=soft(-.15,-.27,y)
    upper=.823+.052*math.sin(min(1,abs(x)/.205)*math.pi)
    lower=.505+.12*(min(1,abs(x)/.23)**1.45)
    face=soft(.24,.205,abs(x))*soft(lower-.018,lower+.018,z)*soft(upper+.015,upper-.015,z)*front
    belly=max(0,1-(x/.18)**2-((z-.335)/.285)**2);belly=soft(.05,.32,belly)*soft(-.07,-.18,y)
    cream=max(face,belly)
    moss=linear('#859451');ivory=linear('#f6e8c6')
    variation=.96+.035*noise.noise(Vector((x*25,y*25,z*25)))+.025*z
    c=[(moss[k]*(1-cream)+ivory[k]*cream)*variation for k in range(3)]
    blush=math.exp(-((abs(x)-.154)/.045)**2-((z-.621)/.034)**2)*front*cream*.34
    pink=linear('#eaae94');return tuple(max(0,min(1,c[k]*(1-blush)+pink[k]*blush)) for k in range(3)),cream

def color_body(o):
    a=o.data.color_attributes.new(name='FurTint',type=enum(bpy.types.Attribute.bl_rna,'data_type','FLOAT_COLOR'),domain=enum(bpy.types.Attribute.bl_rna,'domain','POINT'))
    for i,v in enumerate(o.data.vertices):a.data[i].color=(*fur_color(v.co)[0],1)
    o.data.color_attributes.active_color=a

def curve_tube(name,points,radius,material,radii=None,res=10):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions=enum(bpy.types.Curve.bl_rna,'dimensions','3D');cu.resolution_u=res;cu.bevel_depth=radius;cu.bevel_resolution=3
    s=cu.splines.new(enum(bpy.types.Spline.bl_rna,'type','BEZIER'));s.bezier_points.add(len(points)-1)
    for i,(b,p) in enumerate(zip(s.bezier_points,points)):
        b.co=p;b.handle_left_type=enum(bpy.types.BezierSplinePoint.bl_rna,'handle_left_type','AUTO');b.handle_right_type=enum(bpy.types.BezierSplinePoint.bl_rna,'handle_right_type','AUTO');b.radius=radii[i] if radii else 1
    o=bpy.data.objects.new(name,cu);COL.objects.link(o);cu.materials.append(material);activate(o);bpy.ops.object.convert(target='MESH');o=bpy.context.object;smooth(o);return o

def ear(sign):
    verts=[];faces=[];colors=[];N=22;M=14
    for i in range(N+1):
        t=i/N;cx=sign*(.176+.51*t);cy=-.105-.10*t+.08*t*t;cz=.84-.095*math.sin(math.pi*t)+.035*t+.045*t**6
        width=.12*math.sin(math.pi*t)**.72+.008*(1-t);thick=.014*(1-.55*t)
        for j in range(M):
            a=j/M*math.tau;z=cz+width*math.cos(a);y=cy+thick*math.sin(a)-.022*math.sin(math.pi*t)*(math.cos(a)**2)
            x=cx+sign*.008*math.sin(t*math.pi*5)*math.sin(math.pi*t)*math.cos(a)
            verts.append((x,y,z));inner=max(0,-math.sin(a))**1.6*soft(.05,.18,t)*soft(1,.85,t)
            outer=linear('#879951');pink=linear('#efc6a2');colors.append(tuple(outer[k]*(1-inner*.83)+pink[k]*inner*.83 for k in range(3)))
    for i in range(N):
        for j in range(M):a=i*M+j;b=i*M+(j+1)%M;faces.append((a,b,b+M,a+M))
    faces.extend([tuple(reversed(range(M))),tuple(N*M+j for j in range(M))])
    o=mesh_object('DWR_EarMesh_'+('L' if sign>0 else 'R'),verts,faces,MATS['fur'],colors);PARTS.append((o,'DWR_Ear_'+('L' if sign>0 else 'R')));return o

def droplet():
    verts=[];faces=[];colors=[];N=32;M=20
    for i in range(M+1):
        t=i/M;z=.946+.122*t;r=.052*(math.sin(math.pi*t)**.7)*(1-.64*t)
        for j in range(N):
            a=j/N*math.tau;verts.append((.205+r*math.cos(a),.145+r*math.sin(a),z));colors.append(linear('#ffc568'))
    for i in range(M):
        for j in range(N):a=i*N+j;b=i*N+(j+1)%N;faces.append((a,b,b+N,a+N))
    o=mesh_object('DWR_LanternMesh',verts,faces,MATS['lamp']);PARTS.append((o,'DWR_Lantern'));return o

def build_form():
    global SC,COL,ROOT,BODY,MATS
    if bpy.data.scenes.get(SCENE_NAME) or any(o.name.startswith('DWR_') for o in bpy.data.objects):raise RuntimeError('Dedicated asset already exists; inspect instead of overwriting')
    SC=bpy.data.scenes.new(SCENE_NAME);bpy.context.window.scene=SC;COL=bpy.data.collections.new('DWR · Export asset');SC.collection.children.link(COL)
    ROOT=bpy.data.objects.new('DWR_Root',None);COL.objects.link(ROOT)
    MATS={'fur':mat('DWR · Hand-painted moss and cream','#ffffff',.86,vertex=True),'eye':mat('DWR · Deep warm eyes','#24190d',.12),'iris':mat('DWR · Amber olive iris','#a88d3d',.25),'pupil':mat('DWR · Pupil','#130d08',.1),'glint':mat('DWR · Eye catchlight','#fff6d8',.2,emit=.4),'nose':mat('DWR · Peach nose','#d9906d',.45),'mouth':mat('DWR · Soft smile','#72523a',.8),'lamp':mat('DWR · Honey dew light','#ffc46c',.28,emit=1.4)}
    parts=[]
    for name,loc,size in [('pear torso',(0,.065,.365),(.245,.245,.30)),('round head',(0,-.14,.684),(.25,.192,.235)),('neck blend',(0,-.06,.55),(.185,.18,.20)),('cheek L',(.12,-.245,.615),(.135,.113,.109)),('cheek R',(-.12,-.245,.615),(.135,.113,.109)),('muzzle',(0,-.274,.587),(.139,.096,.076))]:parts.append(sphere('DWR sculpt · '+name,loc,size,segments=32,rings=20))
    for sign in (-1,1):
        for label,loc,size in [('haunch',(sign*.17,.13,.238),(.148,.168,.178)),('forearm',(sign*.167,-.147,.256),(.083,.092,.192)),('front paw',(sign*.169,-.205,.067),(.093,.113,.068)),('hind paw',(sign*.205,.137,.064),(.104,.143,.065))]:parts.append(sphere('DWR sculpt · '+label,loc,size,segments=28,rings=18))
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();BODY=bpy.context.object;BODY.name='DWR_BodyMesh';bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    rm=modifier(BODY,'Continuous organic volume','REMESH');rm.mode=enum(bpy.types.RemeshModifier.bl_rna,'mode','VOXEL');rm.voxel_size=.0095;rm.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rm.name)
    sm=modifier(BODY,'Sculpt surface relaxation','SMOOTH');sm.factor=1.05;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
    BODY.data.calc_loop_triangles();tri=len(BODY.data.loop_triangles)
    if tri>15000:
        dec=modifier(BODY,'Game silhouette topology','DECIMATE');dec.ratio=15000/tri;bpy.ops.object.modifier_apply(modifier=dec.name)
    smooth(BODY);BODY.data.materials.append(MATS['fur']);color_body(BODY);PARTS.append((BODY,'body'))
    for sign in (-1,1):
        eye_parts=[];name='L' if sign>0 else 'R'
        for tag,loc,size,material in [('Eye',(.102*sign,-.341,.704),(.058,.025,.073),MATS['eye']),('Iris',(.102*sign,-.365,.695),(.039,.009,.047),MATS['iris']),('Pupil',(.100*sign,-.374,.711),(.025,.006,.037),MATS['pupil']),('Catchlight',(.088*sign,-.381,.734),(.011,.004,.012),MATS['glint']),('Lower glint',(.118*sign,-.375,.675),(.0045,.003,.005),MATS['glint'])]:eye_parts.append(sphere('DWR '+tag+' '+name,loc,size,material,segments=24,rings=16))
        bpy.ops.object.select_all(action='DESELECT')
        for o in eye_parts:o.select_set(True)
        bpy.context.view_layer.objects.active=eye_parts[0];bpy.ops.object.join();o=bpy.context.object;o.name='DWR_Eye_'+name
        o.shape_key_add(name='Basis');blink=o.shape_key_add(name='Blink');blink.value=0
        for v in blink.data:v.co.z*=.07
        PARTS.append((o,'DWR_Head'))
    nose=sphere('DWR_Nose',(0,-.383,.632),(.018,.014,.0115),MATS['nose'],24,16);PARTS.append((nose,'DWR_Head'))
    for sign in (-1,1):
        o=curve_tube('DWR_Smile_'+str(sign),[(0,-.382,.622),(sign*.012,-.378,.612),(sign*.027,-.368,.614),(sign*.041,-.356,.624)],.0025,MATS['mouth'],res=8);PARTS.append((o,'DWR_Head'))
    ear(-1);ear(1)
    o=curve_tube('DWR_TailMesh',[(.02,.24,.28),(.22,.235,.43),(.41,.20,.68),(.44,.17,.94),(.36,.145,1.13),(.19,.145,1.16),(.13,.145,1.07),(.205,.145,1.075)],.067,MATS['fur'],[1.35,1.25,1.05,.86,.70,.55,.36,.15],res=13);color_body(o);PARTS.append((o,'DWR_Tail'));droplet()
    for o,_ in PARTS:o.parent=ROOT
    SC.world=bpy.data.worlds.new('DWR · Quiet studio');SC.world.use_nodes=True;bg=next(n for n in SC.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(*linear('#b5c5bd'),1);bg.inputs['Strength'].default_value=.6
    setup_studio();SC.frame_set(1);bpy.context.view_layer.update()
    print(json.dumps({'scene':SC.name,'parts':len(PARTS),'bodyTriangles':sum(len(p.vertices)-2 for p in BODY.data.polygons),'originalSceneObjects':[o.name for o in bpy.data.scenes['Scene'].objects]},ensure_ascii=False))

def setup_studio():
    floor_mat=mat('DWR · Studio matte','#637c68',.95)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));o=bpy.context.object;o.name='DWR_StudioFloor';o.data.materials.append(floor_mat)
    def area(name,loc,power,size,color):
        data=bpy.data.lights.new(name,type=enum(bpy.types.Light.bl_rna,'type','AREA'));data.energy=power;data.shape=enum(bpy.types.AreaLight.bl_rna,'shape','DISK');data.size=size;data.color=tuple(int(color[i:i+2],16)/255 for i in (0,2,4));o=bpy.data.objects.new(name,data);SC.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
    area('DWR_StudioKey',(-2,-3,4),350,3,'ffddb2');area('DWR_StudioFill',(3,-1,2),200,3,'d0e7ff');area('DWR_StudioRim',(1,2,3),400,2,'ffe5ab')
    cam=bpy.data.cameras.new('DWR_StudioCamera');o=bpy.data.objects.new('DWR_StudioCamera',cam);SC.collection.objects.link(o);SC.camera=o;o.location=(1.7,-2.65,1.55);o.rotation_euler=(Vector((0,0,.58))-o.location).to_track_quat('-Z','Y').to_euler();cam.type=enum(bpy.types.Camera.bl_rna,'type','ORTHO');cam.ortho_scale=1.65
    SC.render.resolution_x=1000;SC.render.resolution_y=1000;SC.render.resolution_percentage=100
    SC.render.image_settings.file_format=enum(bpy.types.ImageFormatSettings.bl_rna,'file_format','PNG')
    # Keep this Blender installation's current display transform; its dynamic
    # RNA enum can be empty even when the configured transform is valid.

def render_view(name,loc):
    SC.camera.location=loc;SC.camera.rotation_euler=(Vector((0,0,.59))-SC.camera.location).to_track_quat('-Z','Y').to_euler();SC.render.filepath=str(OUT/name);bpy.ops.render.render(write_still=True,scene=SC.name);print(SC.render.filepath)

def build_complete():
    """Reproduce the final asset in a fresh Blender session, keeping existing scenes.
    The dedicated DWR scene must not already exist; this avoids overwriting user work.
    """
    import importlib.util,types
    build_form()
    builder=types.SimpleNamespace(**globals())
    bpy.app.driver_namespace['dwr_builder']=builder
    here=Path(__file__).parent
    for name in ('refine_dengweirong','paint_dengweirong','rig_dengweirong','render_dengweirong'):
        spec=importlib.util.spec_from_file_location(name,here/(name+'.py'))
        mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        if name=='rig_dengweirong':
            mod.build_rig(builder);mod.export(builder)
        else:mod.run(builder)
    return builder

if __name__=='__main__':build_complete()
