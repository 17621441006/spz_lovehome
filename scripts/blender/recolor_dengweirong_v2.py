"""Non-destructive v2 palette in Blender: ivory, mist lilac-grey and amber.

Run `run()` via Blender MCP with the original DWR scene loaded. Creates a fully
independent scene. Original geometry, files, scene, material nodes and animation
Actions are never rewritten. Change OUT/ASSET before use in another checkout.
"""
import bpy, colorsys, hashlib, json, math, shutil, struct
from pathlib import Path
from mathutils import Vector

OUT=Path(r'C:/Users/ctyok/Documents/Codex/2026-10-30/three-js-blender-mcp-github-https/outputs')
ASSET=Path(r'C:/Users/ctyok/Documents/Codex/2026-10-30/three-js-blender-mcp-github-https/work/site-source/dist/assets/creatures')
SOURCE='Dengweirong · Lantern-tail Mossling'
DEST='Dengweirong v2 · Ivory and Mist'

def lin(c):
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in [int(c.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)])

def srgb(c):
    return tuple(12.92*v if v<=.0031308 else 1.055*max(0,v)**(1/2.4)-.055 for v in c)

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def enum(rna,prop,wanted):
    return next(i.identifier for i in rna.properties[prop].enum_items if i.identifier.lower()==wanted.lower())

def fingerprint(sc):
    h=hashlib.sha256()
    for o in sorted(sc.objects,key=lambda o:o.name):
        h.update(o.name.encode());h.update(str(list(o.matrix_world)).encode())
        if o.type=='MESH':
            for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
            for a in o.data.color_attributes:
                for c in a.data:h.update(struct.pack('<4f',*c.color))
        for m in getattr(o.data,'materials',[]):
            h.update(m.name.encode())
            for n in m.node_tree.nodes if m.node_tree else []:
                for p in n.inputs:
                    if hasattr(p,'default_value'):h.update(str(p.default_value[: ] if hasattr(p.default_value,'__len__') else p.default_value).encode())
    return h.hexdigest()

def create():
    if bpy.data.scenes.get(DEST):raise RuntimeError('Dedicated v2 scene exists; inspect instead of overwriting')
    src=bpy.data.scenes.get(SOURCE)
    if not src:raise RuntimeError('Load the preserved v1 Blender scene first')
    before=fingerprint(src);file_before=bpy.data.filepath
    sc=src.copy();sc.name=DEST
    for col in list(sc.collection.children):sc.collection.children.unlink(col)
    for o in list(sc.collection.objects):sc.collection.objects.unlink(o)
    col=bpy.data.collections.new('DWR v2 · Export and studio');sc.collection.children.link(col)
    sc.world=src.world.copy();sc.world.name='DWR v2 · Neutral quiet studio'
    mapping={};mats={}
    for old in src.objects:
        new=old.copy();new.name=old.name.replace('DWR_','DWRv2_',1);new['dwr_original_name']=old.name
        if old.data:new.data=old.data.copy()
        if old.type=='MESH':
            for i,mat in enumerate(old.data.materials):
                if mat not in mats:mats[mat]=mat.copy();mats[mat].name=mat.name.replace('DWR ·','DWR v2 ·')
                new.data.materials[i]=mats[mat]
        col.objects.link(new);mapping[old]=new
    for old,new in mapping.items():
        new.parent=mapping.get(old.parent);new.matrix_world=old.matrix_world.copy()
        for mod in new.modifiers:
            if mod.type=='ARMATURE':mod.object=mapping.get(mod.object,mod.object)
    sc.camera=mapping[src.camera]
    bpy.context.window.scene=sc
    root=mapping[bpy.data.objects['DWR_Root']];rig=mapping[bpy.data.objects['DWR_Rig']]
    root['version']='2.0';root['palette']='ivory, mist lilac grey, apricot ears, honey amber'
    old_moss=lin('#859451');target=lin('#a49caf');luma=lambda c:.2126*c[0]+.7152*c[1]+.0722*c[2]
    base_luma=luma(old_moss);changed=0;greens=0
    for old,o in mapping.items():
        if o.type!='MESH' or 'FurTint' not in o.data.color_attributes:continue
        for item in o.data.color_attributes['FurTint'].data:
            c=tuple(item.color[:3]);h,s,v=colorsys.rgb_to_hsv(*srgb(c));deg=h*360
            amount=smooth(45,61,deg)*(1-smooth(120,150,deg))*smooth(.07,.16,s)
            if amount>0:
                brightness=max(.5,min(1.6,luma(c)/base_luma))
                new=[target[k]*brightness for k in range(3)]
                # Soft pigment variation is carried through luminance, not erased.
                item.color=(*(c[k]*(1-amount)+new[k]*amount for k in range(3)),1);changed+=1
            nh,ns,nv=colorsys.rgb_to_hsv(*srgb(item.color[:3]));greens+=int(55<nh*360<160 and ns>.12)
    # Amber irises avoid the old olive hue; the face/ears keep peach and ivory.
    for old,mat in mats.items():
        bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bs:continue
        if 'Amber olive iris' in old.name:bs.inputs['Base Color'].default_value=(*lin('#b58945'),1)
        if 'Studio matte' in old.name:bs.inputs['Base Color'].default_value=(*lin('#7d777e'),1)
    bg=next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(*lin('#c2bdca'),1)
    sc.frame_set(1);bpy.context.view_layer.update()
    assert fingerprint(src)==before,'v1 scene unexpectedly changed'
    assert bpy.data.filepath==file_before,'main filepath unexpectedly changed'
    state={'scene':sc,'source':src,'mapping':mapping,'root':root,'rig':rig,'originalFingerprint':before,'mainFile':file_before,'changedColors':changed,'remainingGreenColors':greens}
    bpy.app.driver_namespace['dwr_palette_v2']=state
    print(json.dumps({'created':sc.name,'changedVertexColors':changed,'remainingGreenVertexColors':greens,'originalSceneUnchanged':True,'mainFile':file_before},ensure_ascii=False))
    return state

def normalize_glb_names(path,mapping):
    raw=path.read_bytes();length,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
    data=json.loads(raw[20:20+length]);names={new.name:old.name for old,new in mapping.items()}
    for node in data.get('nodes',[]):
        if node.get('name') in names:node['name']=names[node['name']]
    # Blender may rename copied mesh datablocks. Preserve the public v1 mesh
    # names too, so GLTFLoader's children and morph bindings stay byte-for-byte
    # compatible in their names; geometry buffers are not altered here.
    reference=(ASSET/'dengweirong-v1.glb').read_bytes()
    original=json.loads(reference[20:20+struct.unpack_from('<I',reference,12)[0]])
    mesh_names={n['name']:original['meshes'][n['mesh']]['name'] for n in original['nodes'] if 'mesh' in n}
    for node in data.get('nodes',[]):
        if 'mesh' in node and node.get('name') in mesh_names:data['meshes'][node['mesh']]['name']=mesh_names[node['name']]
    js=json.dumps(data,separators=(',',':'),ensure_ascii=True).encode();js+=b' '*((-len(js))%4)
    tail=raw[20+length:];result=struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),0x4e4f534a)+js+tail
    path.write_bytes(result);return data

def export(state):
    sc=state['scene'];rig=state['rig'];root=state['root'];bpy.context.window.scene=sc
    rig.animation_data.action=bpy.data.actions['idle'];sc.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True);rig.select_set(True)
    parts=[o for o in sc.objects if o.type=='MESH' and o.parent==rig]
    for o in parts:
        o.select_set(True)
        if o.data.shape_keys:o.data.shape_keys.key_blocks['Blink'].value=0
    bpy.context.view_layer.objects.active=rig;rna=bpy.ops.export_scene.gltf.get_rna_type()
    opts=dict(filepath=str(OUT/'dengweirong-v2.glb'),check_existing=False,use_selection=True,use_active_scene=True,export_yup=True,export_animations=True,export_skins=True,export_morph=True,export_morph_animation=False,export_extras=True,export_cameras=False,export_lights=False,export_force_sampling=True,export_animation_mode=enum(rna,'export_animation_mode','ACTIONS'),export_frame_range=False,export_anim_single_armature=True,export_vertex_color=enum(rna,'export_vertex_color','MATERIAL'),export_reset_pose_bones=True)
    # Blender 5.2's dynamic format enum is empty; query operator's accepted list.
    values=[i.identifier for i in rna.properties['export_format'].enum_items]
    if 'GLB' in values:opts['export_format']='GLB'
    else:
        try:bpy.ops.export_scene.gltf(export_format='__query_supported_formats__')
        except TypeError as e:
            if "'GLB'" not in str(e):raise
            opts['export_format']='GLB'
    bpy.ops.export_scene.gltf(**opts)
    data=normalize_glb_names(OUT/'dengweirong-v2.glb',state['mapping'])
    shutil.copy2(OUT/'dengweirong-v2.glb',ASSET/'dengweirong-v2.glb')
    actions={bpy.data.actions[n] for n in ('idle','walk','greet','sniff')}
    bpy.data.libraries.write(str(OUT/'dengweirong-v2.blend'),{sc,*actions},fake_user=True,compress=True)
    stats={'scene':sc.name,'triangles':sum(len(p.vertices)-2 for o in parts for p in o.data.polygons),'meshObjects':len(parts),'bones':list(rig.data.bones.keys()),'animations':[a['name'] for a in data.get('animations',[])],'bytes':(OUT/'dengweirong-v2.glb').stat().st_size,'palette':root['palette'],'remainingGreenVertexColors':state['remainingGreenColors'],'originalSceneUnchanged':fingerprint(state['source'])==state['originalFingerprint'],'originalMainFile':bpy.data.filepath,'originalDefaultObjects':[o.name for o in bpy.data.scenes['Scene'].objects]}
    (OUT/'dengweirong-v2-report.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(stats,ensure_ascii=False))

def render(state,night=False,portrait=False,front=False):
    sc=state['scene'];bpy.context.window.scene=sc;rig=state['rig'];rig.animation_data.action=bpy.data.actions['idle'];sc.frame_set(1)
    camera=sc.camera;objects={old.name:new for old,new in state['mapping'].items()}
    bg=next(n for n in sc.world.node_tree.nodes if n.type=='BACKGROUND')
    settings=(camera.matrix_world.copy(),camera.data.ortho_scale,sc.render.resolution_x,sc.render.resolution_y,sc.render.film_transparent,sc.render.image_settings.color_mode,objects['DWR_StudioFloor'].hide_render,bg.inputs['Color'].default_value[:],bg.inputs['Strength'].default_value)
    lights={name:(objects[name].data.energy,objects[name].data.color[:]) for name in ('DWR_StudioKey','DWR_StudioFill','DWR_StudioRim')}
    try:
        if night:
            bg.inputs['Color'].default_value=(*lin('#28334f'),1);bg.inputs['Strength'].default_value=.25
            for name,power,color in [('DWR_StudioKey',90,(.63,.71,1)),('DWR_StudioFill',50,(.76,.70,1)),('DWR_StudioRim',180,(1,.72,.40))]:objects[name].data.energy=power;objects[name].data.color=color
        camera.location=(0,-3,1.05) if front else (1.8,-2.8,1.5)
        camera.rotation_euler=(Vector((0,0,.59))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.65
        sc.render.resolution_x=sc.render.resolution_y=1000
        label='night' if night else 'front' if front else 'three-quarter'
        if portrait:
            label='portrait';sc.render.resolution_x=sc.render.resolution_y=384;sc.render.film_transparent=True
            sc.render.image_settings.color_mode=enum(bpy.types.ImageFormatSettings.bl_rna,'color_mode','RGBA');objects['DWR_StudioFloor'].hide_render=True
            camera.location=(.55,-3,1.05);camera.rotation_euler=(Vector((0,-.06,.78))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.18
        sc.render.filepath=str(OUT/('dengweirong-portrait-v2.png' if portrait else 'dengweirong-v2-'+label+'.png'))
        bpy.ops.render.render(write_still=True,scene=sc.name)
        if portrait:shutil.copy2(sc.render.filepath,ASSET/'dengweirong-portrait-v2.png')
        print(sc.render.filepath)
    finally:
        camera.matrix_world=settings[0];camera.data.ortho_scale=settings[1];sc.render.resolution_x=settings[2];sc.render.resolution_y=settings[3];sc.render.film_transparent=settings[4];sc.render.image_settings.color_mode=settings[5];objects['DWR_StudioFloor'].hide_render=settings[6]
        bg.inputs['Color'].default_value=settings[7];bg.inputs['Strength'].default_value=settings[8]
        for name,(power,color) in lights.items():objects[name].data.energy=power;objects[name].data.color=color

def run():
    state=create();export(state);render(state,front=True);render(state);render(state,night=True);render(state,portrait=True)
    return state

if __name__=='__main__':run()
