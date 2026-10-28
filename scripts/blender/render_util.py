import bpy, math, os
from mathutils import Vector
VIEWS = {'front': (0, -1, 0), 'left': (1, 0, 0), 'back': (0, 1, 0), 'q34': (0.7, -0.7, 0.25),
         'q34r': (-0.7, -0.7, 0.25), 'right': (-1, 0, 0), 'top': (0, -0.3, 1), 'low': (0, -1, -0.15), 'sideh': (1, -0.15, 0.3), 'sidehr': (-1, -0.15, 0.3), 'fronth': (0.15, -1, 0.3)}
_setup = {}
def setup(res=400, ortho=1.15):
    scene = bpy.context.scene
    if _setup.get('done'): return _setup['cam']
    for o in list(scene.objects):
        if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = res
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None) if world.node_tree else None
    if bg: bg.inputs[0].default_value = (0.75, 0.8, 0.85, 1)
    world.color = (0.75, 0.8, 0.85)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun)
    sun.data.energy = 3; sun.rotation_euler = (math.radians(40), 0, math.radians(30))
    # ground grid plane for contact reading
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, -0.15, 0))
    g = bpy.context.active_object; mat = bpy.data.materials.new('ground'); mat.diffuse_color = (0.45, 0.55, 0.4, 1)
    mat.use_nodes = True; mat.node_tree.nodes['Principled BSDF'].inputs[0].default_value = (0.35, 0.45, 0.3, 1)
    g.data.materials.append(mat); _setup['ground'] = g
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    _setup.update(done=True, cam=cam)
    return cam
def render(outdir, tag, views, center=(0, -0.15, 0.42), res=400, ortho=1.15):
    cam = setup(res, ortho)
    cam.data.ortho_scale = ortho
    c = Vector(center)
    for name in views:
        d = Vector(VIEWS[name]).normalized()
        cam.location = c + d * 3
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.render.filepath = os.path.join(outdir, f'{tag}_{name}.png')
        bpy.ops.render.render(write_still=True)
