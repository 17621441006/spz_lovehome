# Stage 1: clean rig + rebuilt skin weights for 閼村繗鍓伴崠?
# Usage: blender -b --factory-startup --python build_rig.py -- src.glb out.blend
import bpy, bmesh, sys, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene

arm = next(o for o in scene.objects if o.type == 'ARMATURE')
arm.name = 'CatRig'
W = arm.matrix_world.copy(); Wi = W.inverted()
# Keep the model's own kick clips (sampled bone-local transforms) so anims.py can reuse them.
import json, os
src_fps = scene.render.fps / scene.render.fps_base
kicks = {}
for act in bpy.data.actions:
    if act.name not in ('front_kick_01', 'front_kick_02'): continue
    arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    frames = []
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        fr = {}
        for pb in arm.pose.bones:
            m = pb.matrix_basis
            fr[pb.name] = [list(m.to_translation()), list(m.to_quaternion())]
        frames.append(fr)
    kicks[act.name] = {'fps': src_fps, 'frames': frames}
    print('KICK', act.name, len(frames), 'frames @', src_fps)
json.dump(kicks, open(os.path.join(os.path.dirname(OUT), 'source_kicks.json'), 'w'))
# Drop Tripo's animations; we author new ones.
if arm.animation_data:
    arm.animation_data.action = None
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
for o in list(scene.objects):
    if o.type == 'MESH' and not o.name.startswith('tripo_part_'):
        bpy.data.objects.remove(o)

parts = {int(o.name.split('_')[-1]): o for o in scene.objects if o.type == 'MESH'}
P = 'mixamorig:'
def wpos(o):
    m = o.matrix_world
    return [m @ v.co for v in o.data.vertices]

# ---------------- part groups ----------------
FAN = [21, 30, 34, 35, 37, 39, 41, 42, 50]
FAN_TASSEL = [7, 15]
HAIR = [2, 29]
HEAD_RIGID = [32, 38, 44, 48, 51]
TAIL = [1]
SLEEVE_L = [4, 8, 11, 40]
SLEEVE_R = [12, 23, 25]
TASSEL_L, TASSEL_R = [17], [27]
APRON = [10, 18, 28, 31, 45]
SPECIAL = set(FAN + FAN_TASSEL + HAIR + HEAD_RIGID + TAIL + TASSEL_L + TASSEL_R)

# ---------------- skeleton edits ----------------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
for b in list(eb):
    n = b.name.replace(P, '')
    if any(k in n for k in ('Index', 'Middle', 'Ring', 'Pinky', 'Thumb')) or n.endswith('_End'):
        eb.remove(b)
# Neck and head may translate (a little visible neck between chin and collar).
eb[P + 'Neck'].use_connect = False
eb[P + 'Head'].use_connect = False

def centerline(obj, root_pred, nbins):
    """Geodesic (edge-walk) bins from the root region -> joint positions in world space."""
    pts = wpos(obj)
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    import heapq
    dist = [math.inf] * len(pts); h = []
    for i, p in enumerate(pts):
        if root_pred(p):
            dist[i] = 0; h.append((0, i))
    heapq.heapify(h)
    while h:
        d, i = heapq.heappop(h)
        if d > dist[i]: continue
        for e in bm.verts[i].link_edges:
            j = e.other_vert(bm.verts[i]).index
            nd = d + (pts[i] - pts[j]).length
            if nd < dist[j]:
                dist[j] = nd; heapq.heappush(h, (nd, j))
    root = [pts[i] for i, d in enumerate(dist) if d == 0]; rc = sum(root, Vector()) / len(root)
    dist = [(p - rc).length for p in pts]  # euclidean: robust to split islands
    fin = dist
    mx = max(fin)
    joints = []
    for k in range(nbins + 1):
        lo, hi = mx * (k - 0.5) / nbins, mx * (k + 0.5) / nbins
        sel = [pts[i] for i, d in enumerate(dist) if lo <= d < hi] or [pts[i] for i, d in enumerate(dist) if abs(d - mx * k / nbins) < mx * 0.08]
        c = sum(sel, Vector()) / len(sel)
        joints.append(c)
    bm.free()
    return joints

tailv = wpos(parts[1]); miny = min(p.y for p in tailv)
tail_j = centerline(parts[1], lambda p: p.y < miny + 0.035, 5)
hairv = wpos(parts[2]); tie = sum(wpos(parts[38]), Vector()) / len(parts[38].data.vertices)
hair_j = centerline(parts[2], lambda p: (p - tie).length < 0.05, 3)
print('TAIL JOINTS', [tuple(round(x, 3) for x in j) for j in tail_j])
print('HAIR JOINTS', [tuple(round(x, 3) for x in j) for j in hair_j])

def chain(names, joints, parent):
    prev = eb[parent]
    out = []
    for i, n in enumerate(names):
        b = eb.new(n)
        b.head = Wi @ joints[i]; b.tail = Wi @ joints[i + 1]
        b.parent = prev; b.use_connect = i > 0
        prev = b; out.append(b)
    return out
chain(['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5'], tail_j, P + 'Hips')
chain(['Hair1', 'Hair2', 'Hair3'], hair_j, P + 'Head')

# Fan bone: Y along grip -> blade centre, Z = fan plane normal (scale X closes it)
fanpts = np.array([list(p) for i in FAN for p in wpos(parts[i])])
grip = Vector(np.array([list(p) for p in wpos(parts[42])]).mean(0))
c = Vector(fanpts.mean(0))
cov = np.cov((fanpts - fanpts.mean(0)).T); ev, evec = np.linalg.eigh(cov)
normal = Vector(evec[:, 0])
# grip = vertex farthest from blade arc: use the handle part's lowest-radius end
fb = eb.new('Fan'); fb.head = Wi @ grip; fb.tail = Wi @ (grip + (c - grip).normalized() * 0.15)
fb.align_roll((Wi.to_3x3() @ normal).normalized()); fb.parent = eb[P + 'RightHand']
print('FAN grip', grip, 'centre', c, 'normal', normal)
bpy.ops.object.mode_set(mode='OBJECT')

bones = [b.name for b in arm.data.bones]
B = {n.replace(P, ''): n for n in bones}

CX = -0.013   # body mid-plane (world X)

def write(o, rows):
    """rows: list of dict bone->w per vertex"""
    for vg in list(o.vertex_groups): o.vertex_groups.remove(vg)
    groups = {}
    for vi, row in enumerate(rows):
        for n, w in row.items():
            if w <= 1e-4: continue
            g = groups.get(n) or groups.setdefault(n, o.vertex_groups.new(name=n))
            g.add([vi], w, 'REPLACE')

def chain_weights(p, joints, names, parent, sigma=0.025):
    # Continuous along the chain: every segment contributes, softly weighted by distance,
    # so points near a bent knee/elbow never jump between non-adjacent bones.
    segs = []
    for i in range(len(joints) - 1):
        a, b = joints[i], joints[i + 1]; ab = b - a
        t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
        d = (a + ab * t - p).length
        segs.append((d, i + t))
    dmin = min(d for d, _ in segs)
    ws = {}
    allnames = [parent] + names
    for d, u in segs:
        k = math.exp(-((d - dmin) / sigma) ** 2)
        if k < 1e-3: continue
        if u > len(names) - 0.5:
            ws[names[-1]] = ws.get(names[-1], 0) + k; continue
        for j, n in enumerate(allnames):
            h = max(0, 1 - abs(u - (j - 0.5)))
            if h > 0: ws[n] = ws.get(n, 0) + k * h
    s = sum(ws.values())
    return {n: w / s for n, w in ws.items()}

TAILN = ['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5']
HAIRN = ['Hair1', 'Hair2', 'Hair3']

# ---------- analytic weight field (same weights for every layer at a given point) ----------
def bh(n): return W @ arm.data.bones[B[n]].head_local
def bt(n): return W @ arm.data.bones[B[n]].tail_local
def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
TORSO_C = [('Hips', 0.22), ('Spine', 0.36), ('Spine1', 0.46), ('Spine2', 0.54), ('Neck', 0.62)]
def torso(z):
    if z <= TORSO_C[0][1]: return {B['Hips']: 1.0}
    for (a, za), (b, zb) in zip(TORSO_C, TORSO_C[1:]):
        if z <= zb:
            t = (z - za) / (zb - za); return {B[a]: 1 - t, B[b]: t}
    return {B['Neck']: 1.0}
ARMJ = {s: [bh(s + 'Shoulder'), bh(s + 'Arm'), bh(s + 'ForeArm'), bh(s + 'Hand'), bt(s + 'Hand') + (bt(s + 'Hand') - bh(s + 'Hand')).normalized() * 0.05]
        for s in ('Left', 'Right')}
LEGJ = {s: [bh(s + 'UpLeg'), bh(s + 'Leg'), bh(s + 'Foot'), bh(s + 'ToeBase'), bt(s + 'ToeBase')] for s in ('Left', 'Right')}
def armw(p, s): return chain_weights(p, ARMJ[s], [B[s + n] for n in ('Shoulder', 'Arm', 'ForeArm', 'Hand')], B['Spine2'])
def legw(p, s): return chain_weights(p, LEGJ[s], [B[s + n] for n in ('UpLeg', 'Leg', 'Foot', 'ToeBase')], B['Hips'])
def blend(*terms):
    out = {}
    for k, d in terms:
        if k <= 0: continue
        for n, w in d.items(): out[n] = out.get(n, 0) + k * w
    return out
def field(p, sleeve=False):
    xs = p.x - CX
    side = 'Left' if xs > 0 else 'Right'
    if sleeve:
        b = sstep(0.03, 0.09, abs(xs))
    else:
        b = sstep(0.10, 0.20, abs(xs)) * sstep(0.40, 0.48, p.z)
    a = 0.0 if sleeve else sstep(0.31, 0.20, p.z)
    sl = sstep(-0.035, 0.035, xs)
    L = blend((sl, legw(p, 'Left')), (1 - sl, legw(p, 'Right')))
    return blend(((1 - a) * (1 - b), torso(p.z)), (b, armw(p, side)), (a * (1 - b), L))
def to_row(d):
    items = sorted(d.items(), key=lambda kv: -kv[1])[:4]
    items = [(n, w) for n, w in items if w > 0.01]
    s = sum(w for _, w in items)
    return {n: w / s for n, w in items}

for i, o in parts.items():
    pts = wpos(o)
    rows = []
    if i in FAN: rows = [{'Fan': 1.0}] * len(pts)
    elif i in FAN_TASSEL: rows = [{B['RightHand']: 1.0}] * len(pts)
    elif i in HEAD_RIGID: rows = [{B['Head']: 1.0}] * len(pts)
    elif i in TASSEL_L or i in TASSEL_R:
        # Rigidly follow the sleeve corner it hangs from (its top-most point).
        top = max(pts, key=lambda q: q.z)
        rows = [to_row(field(top, sleeve=True))] * len(pts)
    elif i in TAIL: rows = [chain_weights(p, tail_j, TAILN, B['Hips']) for p in pts]
    elif i in HAIR: rows = [chain_weights(p, hair_j, HAIRN, B['Head']) for p in pts]
    else:
        for p in pts:
            if i == 0:
                hb = sstep(0.585, 0.665, p.z)
                d = blend((hb, {B['Head']: 1.0}), (1 - hb, torso(p.z)))
            elif i in SLEEVE_L or i in SLEEVE_R:
                d = field(p, sleeve=True)
            elif i in APRON:
                # Front apron hangs between the legs: follow the average of both thighs
                # toward the hem so it drapes over the lap when seated, never through the floor.
                s = 1 - min(1, max(0, (p.z - 0.10) / 0.22))
                a = 0.85 * s * s * (3 - 2 * s)
                d = blend((1 - a, torso(p.z)), (a / 2, {B['LeftUpLeg']: 1.0}), (a / 2, {B['RightUpLeg']: 1.0}))
            else:
                d = field(p)
            rows.append(to_row(d))
    write(o, rows)
    for m in o.modifiers:
        if m.type == 'ARMATURE': m.object = arm

for o in parts.values():
    for m in o.data.materials:
        if m: m.use_backface_culling = False
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('SAVED', OUT, 'bones', bones)
