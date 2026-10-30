"""倒影宅 v2 · preserved exterior, true hollow room and non-destructive export.

坐标约定：Z 向上，水面在 Z=0，+Y 指向湖心（导出 Y-up 后即 -Z 方向）。
导出后游戏把根节点放在星湖水位上，所以模型原点必须正好落在水线上。

用法：
  Execute this new script inside Blender; existing scenes/files are preserved.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

from pathlib import Path
import json, struct
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'dist/assets/buildings/reflection-house-v2.glb'
ARTIFACTS = ROOT.parents[1] / 'outputs'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
ORIGINAL_SCENE = bpy.context.window.scene
if bpy.data.scenes.get('Reflection Interior v32'):
    raise RuntimeError('Task scene already exists; refusing to overwrite any scene')
SCENE = bpy.data.scenes.new('Reflection Interior v32')
COLL = bpy.data.collections.new('Reflection House v2')
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
    m.use_backface_culling = False
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
    # Proper hollow room; original silhouette is retained outside this shell.
    floor, ceiling = -2.74, -.85
    cz = (floor + ceiling) / 2
    for side in (-1, 1):
        box('LWallSide', (side * 2.145, cy, cz), (.16, 3.55, ceiling-floor), WALL)
    box('LWallBack', (0, cy+1.695, cz), (4.13, .16, ceiling-floor), WALL)
    # Shore-facing open entry: glTF +Z, clear width 1.4 m.
    for side in (-1, 1):
        box('LWallFront', (side * 1.4225, cy-1.695, cz), (1.445, .16, ceiling-floor), WALL)
        box('EntryFrame', (side*.75,cy-1.80,cz),(.10,.16,ceiling-floor),WOOD_L)
    box('InteriorFloor', (0,cy,floor-.045),(4.13,3.39,.09),WOOD_L)
    box('LCeiling', (0,cy,ceiling+.04),(4.13,3.39,.08),WALL)
    for i in range(12):
        box('FloorSeam',(-1.95+i*.355,cy,floor+.001),(.012,3.20,.002),WOOD)
    # Warm paper panels, small rug and low furniture sit with normal gravity.
    TEAL=mat('InteriorTeal','426D77',.95)
    RUG=mat('InteriorGold','C4A66B',.94)
    box('InteriorRug',(0,cy-.23,floor+.012),(2.5,1.75,.024),TEAL)
    box('InteriorRugInset',(0,cy-.23,floor+.026),(2.20,1.45,.006),RUG)
    box('Cushion',(-1.35,cy+.75,floor+.08),(.75,.65,.16),TEAL)
    box('Cushion',(1.35,cy+.75,floor+.08),(.75,.65,.16),TEAL)
    box('TeaTop',(0,cy+1.15,floor+.37),(1.25,.55,.08),WOOD)
    for x in (-.45,.45):
        box('TeaLeg',(x,cy+1.15,floor+.17),(.10,.42,.34),WOOD_L)
    shoji('InnerWindow',0,cy+1.59,floor+.58,ceiling-.22,3.15,face='-Y',mullions=4)
    for x in (-1.65,1.65):
        cylinder('InnerLampCord',x,cy+.87,ceiling-.25,ceiling,.012,.012,WOOD,6)
        cylinder('InnerLantern',x,cy+.87,ceiling-.56,ceiling-.25,.12,.12,GLOW,12)
        cylinder('InnerLanternCap',x,cy+.87,ceiling-.26,ceiling-.23,.14,.14,WOOD,12)
        cylinder('InnerLanternBase',x,cy+.87,ceiling-.58,ceiling-.55,.14,.14,WOOD,12)
    # Side alcove shelf leaves centre circulation clear.
    box('WallShelf',(-1.84,cy+.05,floor+.72),(.28,.85,.06),WOOD)

    for sx in (-1, 1):
        for sy in (-1, 1):
            box("LCorner", (sx * 2.19, cy + sy * 1.74, (HOUSE_L0 + HOUSE_L1) / 2),
                (0.16, 0.16, HOUSE_L0 - HOUSE_L1 + 0.02), WOOD)
    box("LBeamT", (0, cy, HOUSE_L0 + 0.05), (4.56, 3.66, 0.11), WOOD)
    box("LBeamB", (0, cy, HOUSE_L1 - 0.04), (4.56, 3.66, 0.11), WOOD)
    for sy in (1,):
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



def merge_parts():
    groups={}
    wall_prefixes=('LWall','LCorner','LBeamT','LWindow','LCeiling','EntryFrame','LRoof','LRidge','LEave','LBracket','Footing','UWall','UCorner','UBeam','UPaper','UMullion','URoof','URidge','UEave','Chimney')
    for ob in list(COLL.objects):
        category='Occluder' if ob.name.startswith(wall_prefixes) else 'Details'
        key=(category,ob.data.materials[0].name)
        groups.setdefault(key,[]).append(ob)
        # Recalculate original helper box normals consistently before export.
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free()
    result=[]
    for (category,material),obs in groups.items():
        for ob in SCENE.objects:ob.select_set(False)
        for ob in obs:ob.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        if len(obs)>1:bpy.ops.object.join()
        ob=bpy.context.view_layer.objects.active;ob.name='RH_'+category+'_'+material.replace('RH_','');result.append(ob)
    return result

try:
    bpy.context.window.scene=SCENE
    islet();gate();house()
    OBJECTS=merge_parts()
    root=bpy.data.objects.new('RH_Root',None);COLL.objects.link(root)
    for ob in OBJECTS:ob.parent=root
    root['interiorFloorY']=-2.74;root['interiorCeilingY']=-.85;root['interiorCenterZ']=-5.6;root['interiorWidth']=4.13;root['interiorDepth']=3.23;root['entryWidth']=1.4;root['entryFrontZ']=-3.825
    for ob in SCENE.objects:ob.select_set(False)
    for ob in [root,*OBJECTS]:ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    try:bpy.ops.export_scene.gltf(export_format='__query__')
    except TypeError as err:
        if "'GLB'" not in str(err):raise
    bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    raw=OUT.read_bytes();j=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    report={'file':str(OUT),'bytes':len(raw),'drawCalls':sum(len(m['primitives']) for m in j.get('meshes',[])),'triangles':sum(len(p.vertices)-2 for o in OBJECTS for p in o.data.polygons),'floorY':-2.74,'ceilingY':-.85,'entryFrontZ':-3.825,'entryWidth':1.4,'roomBoundsXZ':[-2.065,2.065,-7.215,-3.985]}
    (ARTIFACTS/'reflection-house-v2-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    bpy.data.libraries.write(str(ARTIFACTS/'reflection-house-v2.blend'),{SCENE},fake_user=True,compress=True)
    bpy.app.driver_namespace['reflection32']={'scene':SCENE,'objects':OBJECTS,'report':report}
    print(json.dumps(report))
finally:
    bpy.context.window.scene=ORIGINAL_SCENE
