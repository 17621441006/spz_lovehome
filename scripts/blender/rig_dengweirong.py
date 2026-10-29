"""Small real armature and authored gait, written in Blender through MCP.
Foot swing: FL+BR [0,.45], FR+BL [.5,.95]; cycle 1s, reference .35m/s.
The continuous body and moss tufts share weights. No squash/stretch scale tracks.
"""
import bpy, math, json, shutil
from mathutils import Vector, Quaternion

FOOT_POS={'FL':(.169,-.205,.36),'FR':(-.169,-.205,.36),'BL':(.205,.137,.275),'BR':(-.205,.137,.275)}

def build_rig(m):
    if bpy.data.objects.get('DWR_Rig'):raise RuntimeError('Rig already exists')
    ad=bpy.data.armatures.new('DWR · Gentle forest gait');rig=bpy.data.objects.new('DWR_Rig',ad);m.COL.objects.link(rig);rig.parent=m.ROOT
    m.activate(rig);bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=ad.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=ad.edit_bones[parent]
        return b
    bone('DWR_Body',(0,0,.28),(0,0,.56))
    bone('DWR_Head',(0,-.1,.55),(0,-.1,.85),'DWR_Body')
    for side,sign in [('L',1),('R',-1)]:bone('DWR_Ear_'+side,(sign*.176,-.105,.84),(sign*.40,-.13,.90),'DWR_Head')
    bone('DWR_Tail',(.02,.24,.28),(.23,.235,.51),'DWR_Body')
    bone('DWR_Lantern',(.205,.145,.983),(.205,.145,1.063),'DWR_Tail')
    for key,p in FOOT_POS.items():bone('DWR_Foot_'+key,p,(p[0],p[1],.06),'DWR_Body')
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    def skin_weights(p):
        x,y,z=p;head=m.soft(.49,.66,z)
        if head>.999:return {'DWR_Head':1.}
        weights={};foot_max=0
        if z<.41:
            for key,c in FOOT_POS.items():
                dx=(x-c[0])/.145;dy=(y-c[1])/(.16 if key[0]=='B' else .15)
                spread=m.soft(1.7,.20,dx*dx+dy*dy)
                strength=m.soft(.39 if key[0]=='F' else .32,.115,z)*spread
                if z<.11 and abs(x)>.07 and ((y<-.06)==(key[0]=='F')) and x*c[0]>0:strength=max(strength,.98)
                if strength>foot_max:foot_max=strength;foot='DWR_Foot_'+key
            if foot_max>0:weights[foot]=min(.995,foot_max)*(1-head)
        if head>0:weights['DWR_Head']=head
        weights['DWR_Body']=max(0,1-sum(weights.values()))
        return weights
    for o,kind in m.PARTS:
        world=o.matrix_world.copy();o.parent=rig;o.matrix_world=world
        groups={name:o.vertex_groups.new(name=name) for name in ad.bones.keys()}
        for v in o.data.vertices:
            weights=skin_weights(o.matrix_world@v.co) if kind=='body' else {kind:1}
            for name,w in weights.items():
                if w>1e-5:groups[name].add([v.index],w,'REPLACE')
        mod=m.modifier(o,'DWR · Organic articulated movement','ARMATURE');mod.object=rig
    m.RIG=rig
    m.ROOT['creature']='灯尾茸';m.ROOT['version']='1.0';m.ROOT['face_forward']='Three +Z';m.ROOT['gait_reference_speed']=.35
    m.ROOT['source']='Original concept; modeled and rigged in Blender via MCP. No generated external asset.'
    for pb in rig.pose.bones:pb.rotation_mode=m.enum(bpy.types.PoseBone.bl_rna,'rotation_mode','QUATERNION')
    m.SC.render.fps=30
    build_actions(m)
    print({'bones':list(ad.bones.keys()),'actions':list(m.ACTIONS.keys())})

def build_actions(m):
    rig=m.RIG;actions={}
    def loc(name,world):
        pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector(world)
    def turn(name,axis,angle):
        pb=rig.pose.bones[name];local=pb.bone.matrix_local.to_3x3().inverted()@Vector(axis);pb.rotation_quaternion=Quaternion(local,angle)
    for clip,duration in [('idle',4),('walk',1),('greet',2.4),('sniff',3.2)]:
        action=bpy.data.actions.new(clip);rig.animation_data_create();rig.animation_data.action=action
        for frame in range(1,round(duration*30)+2):
            t=(frame-1)/30;phase=t/duration
            for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
            if clip=='walk':
                for key in FOOT_POS:
                    s=(phase-(0 if key in ('FL','BR') else .5))%1
                    amp=.35*.55/2
                    if s<.45:
                        q=s/.45;y=amp*math.cos(q*math.pi);z=.026*math.sin(q*math.pi)**1.4
                    else:q=(s-.45)/.55;y=-amp+2*amp*q;z=0
                    loc('DWR_Foot_'+key,(0,y,z))
                    # Feet remain horizontal; limbs absorb the small translation.
                turn('DWR_Head',(0,0,1),.018*math.sin(phase*math.tau))
                turn('DWR_Tail',(0,1,0),.025*math.sin(phase*math.tau+.5))
                for side,sign in [('L',1),('R',-1)]:turn('DWR_Ear_'+side,(0,1,0),sign*.055*math.sin(phase*math.tau+.7))
            elif clip=='idle':
                turn('DWR_Head',(1,0,0),.018*math.sin(phase*math.tau))
                turn('DWR_Tail',(0,1,0),.026*math.sin(phase*math.tau))
                for side,sign in [('L',1),('R',-1)]:turn('DWR_Ear_'+side,(0,1,0),sign*.025*math.sin(phase*math.tau+.2))
            elif clip=='greet':
                envelope=math.sin(math.pi*phase)**2;wave=math.sin(phase*math.pi*6)
                loc('DWR_Foot_FL',(.022*envelope,.013*wave*envelope,.105*envelope))
                turn('DWR_Head',(0,1,0),-.10*envelope)
                turn('DWR_Tail',(0,0,1),.06*math.sin(phase*math.tau)*envelope)
                for side,sign in [('L',1),('R',-1)]:turn('DWR_Ear_'+side,(0,1,0),sign*.09*envelope)
            else:
                envelope=math.sin(math.pi*phase)**2
                turn('DWR_Head',(1,0,0),.25*envelope)
                turn('DWR_Head',(0,0,1),.055*math.sin(phase*math.pi*4)*envelope)
                # Compose forward pitch with the curious left-right sniff.
                pb=rig.pose.bones['DWR_Head'];axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((1,0,0));pb.rotation_quaternion=pb.rotation_quaternion@Quaternion(axis,.25*envelope)
                for side,sign in [('L',1),('R',-1)]:turn('DWR_Ear_'+side,(0,1,0),sign*.065*envelope)
            for pb in rig.pose.bones:
                pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
                pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
        action.use_fake_user=True;actions[clip]=action
    m.ACTIONS=actions;rig.animation_data.action=actions['idle'];m.SC.frame_set(1)
    m.SC.frame_start=1;m.SC.frame_end=121

def export(m):
    m.RIG.animation_data.action=m.ACTIONS['idle'];m.SC.frame_set(1)
    for o,_ in m.PARTS:
        if o.data.shape_keys:o.data.shape_keys.key_blocks['Blink'].value=0
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT');m.ROOT.select_set(True);m.RIG.select_set(True)
    for o,_ in m.PARTS:o.select_set(True)
    bpy.context.view_layer.objects.active=m.RIG
    export_rna=bpy.ops.export_scene.gltf.get_rna_type()
    opts=dict(filepath=str(m.OUT/'dengweirong-v1.glb'),check_existing=False,use_selection=True,use_active_scene=True,export_yup=True,export_animations=True,export_skins=True,export_morph=True,export_morph_animation=False,export_extras=True,export_cameras=False,export_lights=False,export_force_sampling=True,export_animation_mode=m.enum(export_rna,'export_animation_mode','ACTIONS'),export_frame_range=False,export_anim_single_armature=True,export_vertex_color=m.enum(export_rna,'export_vertex_color','MATERIAL'),export_reset_pose_bones=True)
    # Dynamic RNA enum is empty in this build. The operator TypeError was queried
    # in the live Blender and reported ('GLB', 'GLTF_SEPARATE').
    opts['export_format']='GLB'
    bpy.ops.export_scene.gltf(**opts)
    m.ASSET.mkdir(parents=True,exist_ok=True);shutil.copy2(m.OUT/'dengweirong-v1.glb',m.ASSET/'dengweirong-v1.glb')
    bpy.data.libraries.write(str(m.OUT/'dengweirong-v1.blend'),{m.SC,*m.ACTIONS.values()},fake_user=True,compress=True)
    stats={'version':bpy.app.version_string,'scene':m.SC.name,'tris':sum(len(p.vertices)-2 for o,_ in m.PARTS for p in o.data.polygons),'meshes':len(m.PARTS),'materials':sorted({mat.name for o,_ in m.PARTS for mat in o.data.materials}),'bones':list(m.RIG.data.bones.keys()),'clips':{k:(v.frame_range[1]-v.frame_range[0])/30 for k,v in m.ACTIONS.items()},'gaitReferenceMetersPerSecond':.35,'gaitSwingPhases':{'FL_BR':[0,.45],'FR_BL':[.5,.95]},'originalSceneObjects':[o.name for o in bpy.data.scenes['Scene'].objects],'originalMainFile':bpy.data.filepath,'bytes':(m.OUT/'dengweirong-v1.glb').stat().st_size}
    points=[];bad_weights=0;nonfinite=0;degenerate=0
    for o,_ in m.PARTS:
        for v in o.data.vertices:
            points.append(o.matrix_world@v.co)
            nonfinite+=int(not all(math.isfinite(x) for x in v.co))
            bad_weights+=int(abs(sum(g.weight for g in v.groups)-1)>1e-5)
        o.data.calc_loop_triangles();degenerate+=sum(1 for t in o.data.loop_triangles if t.area<1e-12)
    mn=[min(p[i] for p in points) for i in range(3)];mx=[max(p[i] for p in points) for i in range(3)]
    stats.update(boundsBlender=[mn,mx],dimensionsBlender=[mx[i]-mn[i] for i in range(3)],nonFiniteVertices=nonfinite,unnormalizedSkinVertices=bad_weights,degenerateTriangles=degenerate)
    (m.OUT/'dengweirong-model-report.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(stats,ensure_ascii=False))

if __name__=='__main__':build_rig(bpy.app.driver_namespace['dwr_builder'])
