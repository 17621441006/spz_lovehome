"""系风亭 / 千本鸟居巢 —— 三视图用模型（Blender 5.2，headless）。

两栋都建在独立 Collection 里，基座 z=0，正面朝 -Y。
渲染正交三视图：front(-Y)、side(+X)、top(+Z)，输出到 shots 目录。

用法：
  blender -b --factory-startup --python build_threeviews.py -- <outdir>
"""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), "threeview")
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene

MATS = {}


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def mat(name, color, rough=0.9, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*lin(color), 1)
    p.inputs["Roughness"].default_value = rough
    if emit:
        p.inputs["Emission Color"].default_value = (*lin(color), 1)
        p.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*lin(color), 1)
    MATS[name] = m
    return m


VERM = mat("Vermilion", "b5503c", .85)
VERM_D = mat("VermilionDark", "8c4436", .9)
VERM_L = mat("VermilionLight", "c8664c", .85)
WOOD = mat("Wood", "6e5334", .85)
WOOD_L = mat("WoodLight", "9a7c55", .85)
PAPER = mat("Paper", "f7e7c4", .95, .12)
ROOF = mat("Roof", "59686b", .8)
ROOF_D = mat("RoofDark", "3f4b4c", .8)
STONE = mat("Stone", "c9c5b4", .95)
STONE_D = mat("StoneDark", "a5a08e", .95)
MOSS = mat("Moss", "8fa36b", .95)
GOLD = mat("Gold", "d9ae5e", .55)
KITE_R = mat("KiteRed", "c4553f", .85)
KITE_C = mat("KiteCream", "efe2c2", .9)
ROPE = mat("Rope", "c7b48c", .95)
GLOW = mat("Glow", "ffd9a0", .6, 2.5)


def coll(name):
    c = bpy.data.collections.new(name)
    SCENE.collection.children.link(c)
    return c


def mesh(name, verts, faces, material, collection, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = smooth
    return ob


def box(name, center, size, material, collection, rot_z=0.0):
    cx, cy, cz = center
    sx, sy, sz = (s / 2 for s in size)
    pts = []
    for dz in (-1, 1):
        for dy, dx in ((-1, -1), (-1, 1), (1, 1), (1, -1)):
            pts.append((dx * sx, dy * sy, dz * sz))
    ca, sa = math.cos(rot_z), math.sin(rot_z)
    out = [(cx + x * ca - y * sa, cy + x * sa + y * ca, cz + z) for x, y, z in pts]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return mesh(name, out, faces, material, collection)


def tube(name, pts, radius, material, collection, closed=False):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1)
    if closed:
        sp.use_cyclic_u = True
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    ob = bpy.data.objects.new(name, cu)
    collection.objects.link(ob)
    ob.data.materials.append(material)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    ob.select_set(False)
    return ob


def tent(name, cx, cy, hx, hy, ze, zr, material, collection):
    e = [(cx - hx, cy - hy, ze), (cx + hx, cy - hy, ze), (cx + hx, cy + hy, ze), (cx - hx, cy + hy, ze)]
    r0, r1 = (cx - hx, cy, zr), (cx + hx, cy, zr)
    verts = e + [r0, r1]
    faces = [(0, 1, 5, 4), (3, 2, 5, 4)[::-1], (0, 4, 3), (1, 2, 5)[::-1], (0, 3, 2, 1)]
    return mesh(name, verts, faces, material, collection)


def cylinder(name, cx, cy, z0, z1, r0, r1, material, collection, seg=18):
    verts = []
    for i in range(seg):
        a = i / seg * math.tau
        verts.append((cx + math.cos(a) * r0, cy + math.sin(a) * r0, z0))
        verts.append((cx + math.cos(a) * r1, cy + math.sin(a) * r1, z1))
    faces = []
    for i in range(seg):
        a, b = i * 2, ((i + 1) % seg) * 2
        faces.append((a, b, b + 1, a + 1))
    faces.append(tuple(range(0, seg * 2, 2))[::-1])
    faces.append(tuple(range(1, seg * 2, 2)))
    return mesh(name, verts, faces, material, collection)


# ================================================================ 千本鸟居巢
def build_torii_nest():
    C = coll("TORII")
    R, H = 4.3, 6.4
    # 石台
    cylinder("NestBase", 0, 0, -0.35, 0.28, 5.3, 5.0, STONE_D, C, 26)
    cylinder("NestBase2", 0, 0, 0.28, 0.42, 4.9, 4.6, STONE, C, 26)
    # 编织壳体：先做实体（内芯），再用环 + 经线包一层
    verts, faces = [], []
    rings = 14
    seg = 40
    for i in range(rings + 1):
        t = i / rings
        z = 0.42 + math.sin(t * math.pi / 2) * (H - 0.42)
        r = R * math.cos(t * math.pi / 2) * 0.93 + 0.10
        for j in range(seg):
            a = j / seg * math.tau
            verts.append((math.cos(a) * r, math.sin(a) * r, z))
    for i in range(rings):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    mesh("NestCore", verts, faces, mat("NestCore","6e3a2e",.95), C, smooth=True)
    # 横向环梁
    for i, t in enumerate([0.08, 0.20, 0.32, 0.44, 0.56, 0.68, 0.79, 0.89]):
        z = 0.42 + math.sin(t * math.pi / 2) * (H - 0.42)
        r = R * math.cos(t * math.pi / 2) * 0.98 + 0.30
        pts = [(math.cos(a / 40 * math.tau) * r, math.sin(a / 40 * math.tau) * r, z + 0.04 * math.sin(a))
               for a in range(40)]
        tube(f"NestRing{i}", pts, 0.10, VERM if i % 2 else VERM_L, C, closed=True)
    # 经线
    for k in range(12):
        a = k / 12 * math.tau
        pts = []
        for i in range(15):
            t = i / 14
            z = 0.42 + math.sin(t * math.pi / 2) * (H - 0.42)
            r = R * math.cos(t * math.pi / 2) * 0.98 + 0.34
            pts.append((math.cos(a) * r, math.sin(a) * r, z))
        tube(f"NestRib{k}", pts, 0.085, VERM_D, C)
    # 鸟居门（正面 -Y）
    for sx in (-1, 1):
        box("NestPost", (sx * 1.18, -4.62, 1.85), (0.30, 0.30, 2.9), VERM, C)
    box("NestNuki", (0, -4.62, 2.55), (2.5, 0.16, 0.18), VERM_L, C)
    box("NestKasagi", (0, -4.62, 3.12), (3.0, 0.22, 0.24), VERM, C)
    box("NestShimaki", (0, -4.62, 3.27), (3.2, 0.28, 0.10), VERM_D, C)
    tent("NestGateRoof", 0, -4.62, 1.95, 0.72, 3.40, 3.86, ROOF, C)
    # 门洞内的暖光
    box("NestDoorDark", (0, -4.10, 1.75), (2.30, 0.22, 2.85), mat("DoorDark", "4a3226", .95), C)
    box("NestDoorGlow", (0, -4.24, 1.70), (1.86, 0.06, 2.40), GLOW, C)
    # 顶层檐 + 铜铃
    for i, (w, z) in enumerate(((3.4, H - 0.15), (2.7, H + 0.28))):
        pts = []
        for a in range(24):
            th = a / 24 * math.tau
            pts.append((math.cos(th) * w / 2, math.sin(th) * w / 2 * 0.42, z + math.sin(th) * 0.10))
        tube(f"NestCrown{i}", pts, 0.12, VERM, C, closed=True)
    cylinder("NestBell", 0, 0, H + 0.42, H + 0.62, 0.16, 0.10, GOLD, C, 12)
    # 纸垂
    for sx in (-1.55, 1.55):
        box("NestShide", (sx, -4.52, 2.45), (0.12, 0.03, 0.55), PAPER, C)
    # 苔
    for i, (x, y, r) in enumerate(((-3.3, 2.2, 0.55), (2.8, 3.0, 0.45), (3.4, -1.4, 0.4))):
        cylinder(f"NestMoss{i}", x, y, 0.40, 0.50, r, r * 0.8, MOSS, C, 12)
    return C


# ================================================================ 系风亭
def build_kite_house():
    C = coll("KITE")
    W, D = 3.6, 3.6
    deck = 0.0
    # 台基与地板
    box("KDeck", (0, 0, deck - 0.08), (W + 0.5, D + 0.5, 0.16), WOOD, C)
    for i in range(7):
        box("KPlank", (-W / 2 + 0.25 + i * (W - 0.5) / 6, 0, deck - 0.015), (0.06, D + 0.45, 0.03), WOOD_L, C)
    # 四柱
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("KPost", (sx * W / 2, sy * D / 2, deck + 1.15), (0.14, 0.14, 2.3), WOOD, C)
    # 纸墙（三面，正面开口）
    for sy in (-1, 1):
        box("KWall", (0, sy * D / 2, deck + 1.15), (W - 0.1, 0.05, 2.0), PAPER, C)
    box("KWallB", (0, D / 2, deck + 1.15), (W - 0.1, 0.05, 2.0), PAPER, C)
    # 栏杆
    for sy in (-1, 1):
        box("KRail", (0, sy * (D / 2 + 0.12), deck + 0.55), (W + 0.3, 0.06, 0.06), WOOD_L, C)
        for i in range(4):
            box("KRailPost", (-W / 2 + 0.2 + i * (W - 0.4) / 3, sy * (D / 2 + 0.12), deck + 0.28),
                (0.05, 0.05, 0.55), WOOD_L, C)
    # 屋顶
    tent("KRoof", 0, 0, W / 2 + 0.65, D / 2 + 0.65, deck + 2.45, deck + 3.25, ROOF, C)
    box("KRidge", (0, 0, deck + 3.3), (W + 1.4, 0.10, 0.09), ROOF_D, C)
    box("KEaveF", (0, -(D / 2 + 0.65), deck + 2.43), (W + 1.3, 0.10, 0.14), ROOF_D, C)
    box("KEaveB", (0, (D / 2 + 0.65), deck + 2.43), (W + 1.3, 0.10, 0.14), ROOF_D, C)
    # 檐下灯
    for sx in (-1, 1):
        box("KLightCord", (sx * (W / 2 - 0.2), -D / 2 - 0.1, deck + 2.2), (0.03, 0.03, 0.28), WOOD, C)
        cylinder("KLight", sx * (W / 2 - 0.2), -D / 2 - 0.1, deck + 1.9, deck + 2.1, 0.13, 0.13, GLOW, C, 10)
    # 风筝（三只，大小不同，错开高度）
    kites = [(-1.9, 0.6, 8.4, 1.55), (1.4, -0.9, 8.9, 1.35), (0.2, 2.4, 7.9, 1.05)]
    for i, (kx, ky, kz, ks) in enumerate(kites):
        # 菱形风筝面
        a = (kx, ky, kz + ks)
        b = (kx + ks * 0.72, ky, kz)
        c = (kx, ky, kz - ks * 1.05)
        d = (kx - ks * 0.72, ky, kz)
        mesh(f"Kite{i}", [a, b, c, d], [(0, 1, 2, 3)], KITE_R if i % 2 == 0 else KITE_C, C)
        # 竹骨
        tube(f"KiteSpar{i}", [a, c], 0.02, WOOD, C)
        tube(f"KiteSpar{i}b", [b, d], 0.02, WOOD, C)
        # 尾
        tail = [(kx, ky, kz - ks * 1.05), (kx + 0.25, ky, kz - ks * 1.6), (kx - 0.15, ky, kz - ks * 2.1)]
        tube(f"KiteTail{i}", tail, 0.012, ROPE, C)
        for j in range(2):
            box(f"KiteBow{i}{j}", (tail[j + 1][0], ky, tail[j + 1][2] + 0.12), (0.16, 0.02, 0.10), KITE_R, C)
        # 绳：风筝到屋顶四角
        for sx in (-1, 1):
            for sy in (-1, 1):
                tube(f"KiteLine{i}{sx}{sy}",
                     [(kx, ky, kz), (sx * (W / 2 + 0.6), sy * (D / 2 + 0.6), deck + 2.4)], 0.008, ROPE, C)
    # 绳梯
    for sx in (-1, 1):
        tube("KLadderRail", [(sx * 0.35, -D / 2 + 0.3, deck + 0.05), (sx * 0.35, -D / 2 + 0.55, deck - 2.6)],
             0.035, WOOD, C)
    for i in range(7):
        t = i / 6
        z = deck - 0.05 - t * 2.5
        y = -D / 2 + 0.3 + t * 0.25
        tube("KLadderRung", [(-0.35, y, z), (0.35, y, z)], 0.028, WOOD_L, C)
    # 系在崖上的长绳
    tube("KMooring", [(-W / 2, -D / 2, deck + 0.2), (-4.5, -3.2, deck - 1.2), (-8.0, -5.0, deck - 3.4)],
         0.02, ROPE, C)
    return C


TORII = build_torii_nest()
KITE = build_kite_house()

# ------------------------------------------------------------------ 渲染
SCENE.render.engine = "CYCLES"
SCENE.cycles.device = "CPU"
SCENE.cycles.samples = 48
SCENE.cycles.use_denoising = True
SCENE.render.resolution_x = 1100
SCENE.render.resolution_y = 1300
SCENE.render.film_transparent = True

world = bpy.data.worlds.new("W")
SCENE.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (*lin("f3efe4"), 1)
bg.inputs[1].default_value = 1.0

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
SCENE.collection.objects.link(sun)
sun.data.energy = 3.0
sun.data.angle = math.radians(6)
sun.rotation_euler = (math.radians(58), math.radians(4), math.radians(30))

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
SCENE.collection.objects.link(fill)
fill.data.energy = 900
fill.data.size = 16
fill.location = (-9, -11, 9)
fill.rotation_euler = (math.radians(52), 0, math.radians(-40))

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cam_data)
SCENE.collection.objects.link(cam)
SCENE.camera = cam


def show(col, visible):
    for ob in col.objects:
        ob.hide_render = not visible


def shoot(tag, col, other, center, height, radius, res=(1100, 1300)):
    show(col, True)
    show(other, False)
    SCENE.render.resolution_x, SCENE.render.resolution_y = res
    cam_data.clip_end = 200
    views = {
        "front": ((center[0], center[1] - 60, center[2]), (math.pi / 2, 0, 0), max(height, radius * 2) * 1.08),
        "side": ((center[0] + 60, center[1], center[2]), (math.pi / 2, 0, math.pi / 2), max(height, radius * 2) * 1.08),
        "top": ((center[0], center[1], center[2] + 60), (0, 0, 0), max(radius * 2, radius * 2) * 1.12),
    }
    for name, (loc, rot, scale) in views.items():
        cam.location = Vector(loc)
        cam.rotation_euler = rot
        cam_data.ortho_scale = scale
        SCENE.render.filepath = os.path.join(OUT, f"{tag}-{name}.png")
        bpy.ops.render.render(write_still=True)


shoot("torii", TORII, KITE, (0, 0, 3.5), 7.2, 5.2, (1200, 1200))
shoot("kite", KITE, TORII, (0, 0, 4.2), 12.6, 4.8, (1100, 1400))
print("THREEVIEW_DONE", OUT)
