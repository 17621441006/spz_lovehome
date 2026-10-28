# Find the head yaw/roll that makes the standing face mirror-symmetric in a front view.
import bpy, sys, os, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anims, poselib
from poselib import *
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=argv[0]); outdir = argv[1]
yaws = [float(v) for v in argv[2].split(',')]; rolls = [float(v) for v in argv[3].split(',')]
arm = bpy.data.objects['CatRig']; b = anims.Builder(arm)
scene = bpy.context.scene
import render_util
cam = render_util.setup(160, 0.30)
render_util._setup['ground'].hide_render = True
scene.render.engine = 'BLENDER_EEVEE'
nose = bpy.data.objects['tripo_part_44']
def nose_pos():
    dg = bpy.context.evaluated_depsgraph_get(); e = nose.evaluated_get(dg); me = e.to_mesh()
    c = sum((e.matrix_world @ v.co for v in me.vertices), Vector()) / len(me.vertices); e.to_mesh_clear(); return c
res = []
for yaw in yaws:
    for roll in rolls:
        pose = b.wait(0.0)
        pose['d']['Head'] = pose['d'].get('Head', Quaternion()) @ eul(z=yaw, y=roll)
        apply(b.rig, solve_full(b.rig, pose)); bpy.context.view_layer.update()
        c = nose_pos() + Vector((0, 0, 0.035))
        cam.location = c + Vector((0, -3, 0)); cam.rotation_euler = (math.radians(90), 0, 0)
        f = os.path.join(outdir, f'face_y{yaw:+.0f}_r{roll:+.0f}.png'); scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f); px = np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)[..., :3]
        bpy.data.images.remove(img)
        g = px.mean(2); score = float(np.abs(g - g[:, ::-1]).mean())
        res.append((score, yaw, roll)); print('SYM', yaw, roll, round(score, 4))
res.sort(); print('BEST', res[:3])
