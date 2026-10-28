import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=argv[0])
arm = bpy.data.objects['CatRig']
bpy.context.scene.render.fps = 30; bpy.context.scene.render.fps_base = 1.0
for i in [21, 30, 34, 35, 37, 39, 41, 42, 50, 7, 15]:
    o = bpy.data.objects.get('tripo_part_%d' % i)
    if o: o.name = 'fan_part_%d' % i
# rest pose for export, no active action (all clips exported as separate animations)
arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
for o in bpy.data.objects:
    o.select_set(o.type in ('MESH', 'ARMATURE'))
bpy.ops.export_scene.gltf(filepath=argv[1], export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_frame_range=False, export_anim_single_armature=True, export_reset_pose_bones=True,
    export_skins=True, export_all_influences=False, export_morph=False, export_yup=True,
    export_image_format='AUTO', export_apply=False, export_optimize_animation_size=True)
print('EXPORTED', argv[1])
