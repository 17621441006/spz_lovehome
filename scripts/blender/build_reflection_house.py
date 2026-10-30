"""倒影宅 · 水下之家 — 原创建筑，Blender 独立场景建模 + GLB 导出。

坐标约定：Z 向上，水面在 Z=0，+Y 指向湖心（导出 Y-up 后即 -Z 方向）。
导出后游戏把根节点放在星湖水位上，所以模型原点必须正好落在水线上。

用法：
  blender -b --factory-startup --python build_reflection_house.py -- out.glb [render_dir]
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), "reflection-house.glb")
RENDER_DIR = argv[1] if len(argv) > 1 else ""

# ------------------------------------------------------------------ scene
bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene
COLL = bpy.data.collections.new("倒影宅")
SCENE.collection.children.link(COLL)
MATS = {}
OBJECTS = []

ISLET_TOP = 0.62
GATE_TOP = 3.45
HOUSE_Y = 5.60
HOUSE_TOP = -0.55

HOUSE_L0 = HOUSE_TOP - 0.30
HOUSE_L1 = HOUSE_L0 - 1.95
ROOF0_EAVE = HOUSE_L1 - 0.05
ROOF0_RIDGE = ROOF0_EAVE - 0.92
HOUSE_U0 = ROOF0_RIDGE - 0.02
HOUSE_U1 = HOUSE_U0 - 1.05
ROOF1_EAVE = HOUSE_U1 - 0.04
ROOF1_RIDGE = ROOF1_EAVE - 0.72


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def mat(name, color, rough=0.9, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new("RH_" + name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*lin(color), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = 0.0
    if emit > 0:
        p.inputs["Emission Color"].default_value = (*lin(color), 1)
        p.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*lin(color), 1)
    MATS[name] = m
    return m


STONE = mat("Stone", "c9c5b4", 0.95)
STONE_D = mat("StoneDark", "a5a08e", 0.95)
MOSS = mat("Moss", "8fa36b", 0.95)
WOOD = mat("Wood", "6e5334", 0.85)
WOOD_L = mat("WoodLight", "9a7c55", 0.85)
WALL = mat("Wall", "e7d8bc", 0.9)
PAPER = mat("Paper", "f7e7c4", 0.95, 0.16)
ROOF = mat("Roof", "59686b", 0.8)
ROOF_D = mat("RoofDark", "3f4b4c", 0.8)
GLOW = mat("Glow", "ffd39a", 0.6, 3.2)


# ------------------------------------------------------------------ helpers
def mesh(name, verts, faces, material, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = smooth
    OBJECTS.append(ob)
    return ob


def box(name, center, size, material, rot_z=0.0):
    cx, cy, cz = center
    sx, sy, sz = (s / 2 for s in size)
    pts = []
    for dz in (-1, 1):
        for dy, dx in ((-1, -1), (-1, 1), (1, 1), (1, -1)):
            pts.append((dx * sx, dy * sy, dz * sz))
    ca, sa = math.cos(rot_z), math.sin(rot_z)
    out = [(cx + x * ca - y * sa, cy + x * sa + y * ca, cz + z) for x, y, z in pts]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return mesh(name, out, faces, material)


def tent(name, cx, cy, hx, hy, ze, zr, roof_mat):
    """封闭双坡顶：屋脊沿 X，檐口 ze，屋脊 zr（可低于檐口 = 倒扣）。"""
    e = [(cx - hx, cy - hy, ze), (cx + hx, cy - hy, ze), (cx + hx, cy + hy, ze), (cx - hx, cy + hy, ze)]
    r0, r1 = (cx - hx, cy, zr), (cx + hx, cy, zr)
    verts = e + [r0, r1]
    faces = [(0, 1, 5, 4), (3, 2, 5, 4)[::-1], (0, 4, 3), (1, 2, 5)[::-1], (0, 3, 2, 1)]
    return mesh(name, verts, faces, roof_mat)


def quad(name, a, b, c, d, material):
    return mesh(name, [a, b, c, d], [(0, 1, 2, 3)], material)


def cylinder(name, cx, cy, z0, z1, r0, r1, material, seg=20, wobble=0.0, seed=1):
    verts = []
    for i in range(seg):
        a = i / seg * math.tau
        w = 1 + wobble * math.sin(a * 3 + seed) + wobble * 0.6 * math.sin(a * 5 + seed * 2)
        verts.append((cx + math.cos(a) * r0 * w, cy + math.sin(a) * r0 * w, z0))
        verts.append((cx + math.cos(a) * r1 * w, cy + math.sin(a) * r1 * w, z1))
    faces = []
    for i in range(seg):
        a, b = i * 2, ((i + 1) % seg) * 2
        faces.append((a, b, b + 1, a + 1))
    faces.append(tuple(range(0, seg * 2, 2))[::-1])
    faces.append(tuple(range(1, seg * 2, 2)))
    return mesh(name, verts, faces, material)


def shoji(name, cx, cy, z0, z1, w, face="+Y", mullions=2, wood=WOOD_L):
    """纸窗：纸面 + 木框 + 竖棂，贴在外墙外 0.03。"""
    if face in ("+Y", "-Y"):
        y = cy + (0.03 if face == "+Y" else -0.03)
        quad(name + "Paper", (cx - w / 2, y, z0), (cx + w / 2, y, z0),
             (cx + w / 2, y, z1), (cx - w / 2, y, z1), PAPER)
        t = 0.05
        box(name + "L", (cx - w / 2, y, (z0 + z1) / 2), (t, t, z1 - z0 + t), wood)
        box(name + "R", (cx + w / 2, y, (z0 + z1) / 2), (t, t, z1 - z0 + t), wood)
        box(name + "B", (cx, y, z0), (w, t, t), wood)
        box(name + "T", (cx, y, z1), (w, t, t), wood)
        for i in range(1, mullions + 1):
            mx = cx - w / 2 + w * i / (mullions + 1)
            box(name + "M", (mx, y, (z0 + z1) / 2), (0.03, t * 0.8, z1 - z0), wood)
    else:
        x = cx + (0.03 if face == "+X" else -0.03)
        quad(name + "Paper", (x, cy - w / 2, z0), (x, cy + w / 2, z0),
             (x, cy + w / 2, z1), (x, cy - w / 2, z1), PAPER)
        t = 0.05
        box(name + "L", (x, cy - w / 2, (z0 + z1) / 2), (t, t, z1 - z0 + t), wood)
        box(name + "R", (x, cy + w / 2, (z0 + z1) / 2), (t, t, z1 - z0 + t), wood)
        box(name + "B", (x, cy, z0), (t, w, t), wood)
        box(name + "T", (x, cy, z1), (t, w, t), wood)
        for i in range(1, mullions + 1):
            my = cy - w / 2 + w * i / (mullions + 1)
            box(name + "M", (x, my, (z0 + z1) / 2), (t * 0.8, 0.03, z1 - z0), wood)


def islet():
    seg = 14
    top, bot = [], []
    for i in range(seg):
        a = i / seg * math.tau
        w = 1 + 0.075 * math.sin(a * 3 + 0.7) + 0.045 * math.sin(a * 5 + 2.1)
        top.append((math.cos(a) * 2.00 * w, math.sin(a) * 1.86 * w, ISLET_TOP - 0.03 * math.sin(a * 2)))
        bot.append((math.cos(a) * (2.20 + 0.10 * math.sin(a * 4 + 1.1)) * w, math.sin(a) * (2.08 + 0.10 * math.sin(a * 3 + 2.3)) * w, -1.35))
    verts = top + bot
    faces = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append((i, j, seg + j, seg + i))
    faces.append(tuple(range(seg)))
    faces.append(tuple(range(seg, seg * 2))[::-1])
    mesh("Islet", verts, faces, STONE)
    cylinder("IsletMoss", 0.05, 0.0, ISLET_TOP - 0.02, ISLET_TOP + 0.03, 1.10, 1.04, MOSS, 26, 0.05, 3)
    cylinder("IsletMoss2", 0.55, -0.42, ISLET_TOP - 0.02, ISLET_TOP + 0.045, 0.62, 0.57, MOSS, 18, 0.07, 5)
    cylinder("IsletMoss3", -0.52, 0.46, ISLET_TOP - 0.02, ISLET_TOP + 0.04, 0.50, 0.45, MOSS, 18, 0.07, 7)
    for i, (x, y, r) in enumerate(((-1.92, 0.15, 0.20), (1.86, -0.35, 0.17))):
        cylinder(f"Rock{i}", x, y, -0.28, ISLET_TOP - 0.05, r, r * 0.8, STONE_D, 8, 0.14, i + 2)
    box("Step0", (0, -2.02, 0.42), (1.60, 0.60, 0.22), STONE)
    box("Step1", (0, -2.46, 0.16), (1.80, 0.56, 0.20), STONE_D)
    box("Step2", (0, -2.86, -0.10), (1.95, 0.52, 0.18), STONE)


def gate():
    z0 = ISLET_TOP
    for sx in (-1, 1):
        box("GatePost", (sx * 0.98, 0, (z0 + GATE_TOP) / 2 - 0.08), (0.20, 0.20, GATE_TOP - z0 - 0.06), WOOD)
        box("GatePostBase", (sx * 0.98, 0, z0 + 0.09), (0.30, 0.30, 0.18), STONE_D)
        box("GateBrace", (sx * 0.98, 0, z0 + 1.55), (0.26, 0.26, 0.06), WOOD_L)
    box("GateNuki", (0, 0, z0 + 1.86), (2.30, 0.13, 0.15), WOOD_L)
    box("GateKasagi", (0, 0, z0 + 2.32), (2.74, 0.18, 0.20), WOOD)
    box("GateShimaki", (0, 0, z0 + 2.45), (2.94, 0.24, 0.09), STONE_D)
    tent("GateRoof", 0, 0, 1.58, 0.60, z0 + 2.50, z0 + 2.92, ROOF)
    box("GateRidge", (0, 0, z0 + 2.95), (3.24, 0.09, 0.08), ROOF_D)
    box("GateEaveL", (-1.58, 0, z0 + 2.47), (0.09, 1.32, 0.10), ROOF_D)
    box("GateEaveR", (1.58, 0, z0 + 2.47), (0.09, 1.32, 0.10), ROOF_D)
    box("LanternCord", (0.55, 0, z0 + 2.10), (0.03, 0.03, 0.30), WOOD)
    cylinder("LanternBody", 0.55, 0, z0 + 1.66, z0 + 1.94, 0.18, 0.18, GLOW, 12)
    cylinder("LanternCap", 0.55, 0, z0 + 1.93, z0 + 1.98, 0.08, 0.18, WOOD, 10)
    cylinder("LanternBase", 0.55, 0, z0 + 1.61, z0 + 1.66, 0.18, 0.08, WOOD, 10)
    for x in (-1.28, 1.28):
        zz = z0 + 2.22
        box("ShideA", (x, 0, zz - 0.07), (0.11, 0.02, 0.16), PAPER)
        box("ShideB", (x - 0.01, 0, zz - 0.26), (0.10, 0.02, 0.18), PAPER)


def house():
    cy = HOUSE_Y
    box("Footing", (0, cy, HOUSE_TOP - 0.12), (4.66, 3.76, 0.24), STONE_D)
    box("FootingLip", (0, cy, HOUSE_TOP - 0.26), (4.50, 3.60, 0.06), STONE)

    # ---- 一层
    box("LWall", (0, cy, (HOUSE_L0 + HOUSE_L1) / 2), (4.45, 3.55, HOUSE_L0 - HOUSE_L1), WALL)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("LCorner", (sx * 2.19, cy + sy * 1.74, (HOUSE_L0 + HOUSE_L1) / 2),
                (0.16, 0.16, HOUSE_L0 - HOUSE_L1 + 0.02), WOOD)
    box("LBeamT", (0, cy, HOUSE_L0 + 0.05), (4.56, 3.66, 0.11), WOOD)
    box("LBeamB", (0, cy, HOUSE_L1 - 0.04), (4.56, 3.66, 0.11), WOOD)
    for sy in (-1, 1):
        y = cy + sy * 1.80
        box("LWindowPaper", (0, y, (HOUSE_L1 + 0.30 + HOUSE_L1 + 1.45) / 2), (3.44, 0.03, 1.15), PAPER)
        box("LWindowTop", (0, y, HOUSE_L1 + 1.47), (3.56, 0.07, 0.08), WOOD_L)
        box("LWindowBot", (0, y, HOUSE_L1 + 0.28), (3.56, 0.07, 0.08), WOOD_L)
        for i in range(3):
            box("LWindowMullion", (-0.86 + i * 0.86, y, HOUSE_L1 + 0.88), (0.04, 0.06, 1.18), WOOD_L)
    for sx in (-1, 1):
        x = sx * 2.24
        box("LWindowPaperX", (x, cy, HOUSE_L1 + 0.92), (0.03, 2.20, 1.10), PAPER)
        box("LWindowFrameX", (x, cy, HOUSE_L1 + 1.47), (0.07, 2.26, 0.07), WOOD_L)
        box("LWindowFrameX2", (x, cy, HOUSE_L1 + 0.30), (0.07, 2.26, 0.07), WOOD_L)
        for i in range(2):
            box("LWindowMullionX", (x, cy - 0.55 + i * 1.10, HOUSE_L1 + 0.88), (0.06, 0.04, 1.16), WOOD_L)
    door_z = HOUSE_L1 + 0.95
    box("Door", (0, cy + 1.80, door_z), (0.96, 0.07, 1.28), WOOD)
    box("DoorGlow", (0, cy + 1.845, door_z - 0.02), (0.52, 0.03, 0.92), GLOW)
    box("DoorFrameL", (-0.54, cy + 1.82, door_z), (0.08, 0.10, 1.36), WOOD_L)
    box("DoorFrameR", (0.54, cy + 1.82, door_z), (0.08, 0.10, 1.36), WOOD_L)
    box("Deck", (0, cy + 1.98, HOUSE_L0 - 0.16), (4.3, 0.62, 0.08), WOOD)
    for i in range(6):
        box("RailPost", (-1.95 + i * 0.78, cy + 2.26, HOUSE_L0 - 0.48), (0.06, 0.06, 0.60), WOOD_L)
    box("Rail", (0, cy + 2.26, HOUSE_L0 - 0.76), (4.1, 0.07, 0.07), WOOD_L)

    # ---- 一层屋顶（倒扣：檐口高、屋脊低）
    tent("LRoof", 0, cy, 2.86, 2.34, ROOF0_EAVE, ROOF0_RIDGE, ROOF)
    box("LRidge", (0, cy, ROOF0_RIDGE - 0.04), (5.80, 0.12, 0.10), ROOF_D)
    box("LEaveF", (0, cy + 2.34, ROOF0_EAVE), (5.76, 0.12, 0.16), ROOF_D)
    box("LEaveB", (0, cy - 2.34, ROOF0_EAVE), (5.76, 0.12, 0.16), ROOF_D)
    for sx in (-1, 1):
        box("LEaveS", (sx * 2.86, cy, ROOF0_EAVE), (0.12, 4.72, 0.16), ROOF_D)
    for i in range(5):
        box("LBracket", (-2.0 + i * 1.0, cy + 2.30, HOUSE_L1 - 0.14), (0.09, 0.30, 0.12), WOOD)

    # ---- 二层
    box("UWall", (0, cy, (HOUSE_U0 + HOUSE_U1) / 2), (3.20, 2.55, HOUSE_U0 - HOUSE_U1), WALL)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("UCorner", (sx * 1.57, cy + sy * 1.25, (HOUSE_U0 + HOUSE_U1) / 2),
                (0.12, 0.12, HOUSE_U0 - HOUSE_U1 + 0.02), WOOD)
    box("UBeamT", (0, cy, HOUSE_U0 + 0.04), (3.28, 2.63, 0.09), WOOD)
    for sx in (-1, 1):
        x = sx * 1.60
        box("UPaper", (x, cy, HOUSE_U1 + 0.53), (0.03, 1.62, 0.62), PAPER)
        for k in (-0.40, 0.40):
            box("UMullion", (x, cy + k, HOUSE_U1 + 0.53), (0.05, 0.04, 0.64), WOOD_L)
    tent("URoof", 0, cy, 2.10, 1.74, ROOF1_EAVE, ROOF1_RIDGE, ROOF)
    box("URidge", (0, cy, ROOF1_RIDGE - 0.04), (4.30, 0.10, 0.09), ROOF_D)
    box("UEaveF", (0, cy + 1.74, ROOF1_EAVE), (4.26, 0.09, 0.08), ROOF_D)
    box("UEaveB", (0, cy - 1.74, ROOF1_EAVE), (4.26, 0.09, 0.08), ROOF_D)

    box("Chimney", (1.0, cy + 0.45, ROOF1_RIDGE - 0.42), (0.32, 0.32, 0.72), STONE_D)
    box("ChimneyCap", (1.0, cy + 0.45, ROOF1_RIDGE - 0.80), (0.42, 0.42, 0.08), STONE)


islet()
gate()
house()

# ------------------------------------------------------------------ merge
def merge_by_material():
    """同材质合并，控制 draw call：101 件 -> 每种材质 1 件。"""
    groups = {}
    for ob in list(COLL.objects):
        key = ob.data.materials[0].name if ob.data.materials else "none"
        groups.setdefault(key, []).append(ob)
    for key, obs in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for ob in obs:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        bpy.context.view_layer.objects.active.name = "RH_" + key.replace("RH_", "")
    return list(COLL.objects)


OBJECTS = merge_by_material()
print("MERGED meshes=", len(OBJECTS))

# ------------------------------------------------------------------ export
for ob in bpy.context.selected_objects:
    ob.select_set(False)
for ob in OBJECTS:
    ob.select_set(True)
bpy.context.view_layer.objects.active = OBJECTS[0]
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True,
    export_yup=True, export_apply=True, export_materials="EXPORT",
    export_cameras=False, export_lights=False, export_animations=False,
)

tris = 0
for ob in OBJECTS:
    me = ob.data
    me.calc_loop_triangles()
    tris += len(me.loop_triangles)
print(f"BUILT objects={len(OBJECTS)} tris={tris} out={OUT}")

# ------------------------------------------------------------------ preview
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    SCENE.render.engine = "CYCLES"
    SCENE.cycles.device = "CPU"
    SCENE.cycles.samples = 64
    SCENE.cycles.use_denoising = True
    SCENE.render.resolution_x = 1000
    SCENE.render.resolution_y = 800

    world = bpy.data.worlds.new("PreviewWorld")
    SCENE.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (*lin("c9d9d8"), 1)
    bg.inputs[1].default_value = 1.15

    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    SCENE.collection.objects.link(sun)
    sun.data.energy = 3.4
    sun.data.angle = math.radians(10)
    sun.rotation_euler = (math.radians(50), math.radians(8), math.radians(35))

    fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
    SCENE.collection.objects.link(fill)
    fill.data.energy = 300
    fill.data.size = 12
    fill.location = (-8, 7, 7)
    fill.rotation_euler = (math.radians(55), 0, math.radians(-48))

    water_mat = bpy.data.materials.new("PreviewWater")
    water_mat.use_nodes = True
    wp = next(n for n in water_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    wp.inputs["Base Color"].default_value = (*lin("2f5c66"), 1)
    wp.inputs["Roughness"].default_value = 0.15
    wp.inputs["Alpha"].default_value = 0.38
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0.002))
    water = bpy.context.active_object
    water.name = "PreviewWaterPlane"
    water.data.materials.append(water_mat)

    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -8.4))
    bed = bpy.context.active_object
    bed.name = "PreviewBed"
    bed_mat = bpy.data.materials.new("PreviewBed")
    bed_mat.use_nodes = True
    bp = next(n for n in bed_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bp.inputs["Base Color"].default_value = (*lin("26302c"), 1)
    bed.data.materials.append(bed_mat)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 30
    cam = bpy.data.objects.new("Cam", cam_data)
    SCENE.collection.objects.link(cam)
    SCENE.camera = cam

    def shoot(name, loc, target, hide_water=False):
        water.hide_render = hide_water
        cam.location = Vector(loc)
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
        SCENE.render.filepath = os.path.join(RENDER_DIR, name)
        bpy.ops.render.render(write_still=True)

    cam_data.lens = 30
    shoot("view-hero.png", (-17.0, 2.0, 3.2), (0, 1.2, -3.0), hide_water=True)
    cam_data.lens = 32
    shoot("view-surface.png", (-15.5, -6.0, 2.6), (0, 1.2, -3.2), hide_water=False)
    cam_data.lens = 40
    shoot("view-gate.png", (3.4, -5.0, 1.4), (0, 0.4, 1.2), hide_water=False)
    print("RENDERED", RENDER_DIR)
