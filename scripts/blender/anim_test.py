import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_util
argv = sys.argv[sys.argv.index('--') + 1:]
blend, outdir, clips = argv[0], argv[1], argv[2].split(',')
views = argv[3].split(',') if len(argv) > 3 else ['front', 'left']
nsamp = int(argv[4]) if len(argv) > 4 else 4
bpy.ops.wm.open_mainfile(filepath=blend)
arm = bpy.data.objects['CatRig']
scene = bpy.context.scene
for clip in clips:
    act = bpy.data.actions[clip]
    arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    a, b = act.frame_range
    for k in range(nsamp):
        f = a + (b - a) * k / nsamp if nsamp > 1 else a
        scene.frame_set(int(round(f)))
        render_util.render(outdir, f'{clip}_{k}', views, res=300)
