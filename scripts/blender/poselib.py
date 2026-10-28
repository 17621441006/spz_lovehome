# Pose solver shared by test renders and animation baking.
# All authoring happens in WORLD space of the imported scene:
#   +Z up, cat faces -Y, cat's left = +X.
import bpy, math
from mathutils import Vector, Matrix, Quaternion, Euler

P = 'mixamorig:'

def rq(axis, deg):
    return Quaternion(Vector(axis).normalized(), math.radians(deg))

def eul(x=0, y=0, z=0):
    """world-axis rotation Z(yaw)*Y(roll)*X(pitch). +x tips up-pointing bones forward (-Y)
    and swings down-pointing limbs backward (+Y); +z turns toward the cat's left."""
    return rq((0, 0, 1), z) @ rq((0, 1, 0), y) @ rq((1, 0, 0), x)

class Rig:
    def __init__(self, arm):
        self.arm = arm
        self.W = arm.matrix_world.copy()
        self.bones = arm.data.bones
        self.rest = {}       # name -> (head_w, R_w 3x3)
        for b in self.bones:
            M = self.W @ b.matrix_local
            self.rest[b.name] = (M.to_translation(), M.to_3x3().normalized())
        self.order = []
        def walk(b):
            self.order.append(b.name)
            for c in b.children: walk(c)
        for b in self.bones:
            if b.parent is None: walk(b)
        self.prevq = {}

    def name(self, n):
        return n if n in self.rest else P + n

    def head(self, n):
        return self.rest[self.name(n)][0].copy()

    def solve(self, pose):
        """pose: dict with
             'hips_off': Vector (world offset of hips), 'd': {bone: Quaternion world-delta (parent-relative)},
             'ik': {side: (ankle_target Vector, foot_q Quaternion world-abs delta, pole Vector)}
           returns {bone: (loc, quat, scale)} basis values."""
        d = {self.name(k): v for k, v in pose.get('d', {}).items()}
        R_abs, H = {}, {}
        ik = pose.get('ik', {})
        scl = {self.name(k): v for k, v in pose.get('scale', {}).items()}
        for n in self.order:
            b = self.bones[n]
            h0, R0 = self.rest[n]
            if b.parent is None:
                R_abs[n] = d.get(n, Quaternion())
                H[n] = h0 + pose.get('hips_off', Vector())
            else:
                p = b.parent.name
                hp0 = self.rest[p][0]
                H[n] = H[p] + R_abs[p] @ (h0 - hp0)
                R_abs[n] = R_abs[p] @ d.get(n, Quaternion())
            off = pose.get('offset', {}).get(n.replace(P, ''))
            if off is not None:
                H[n] = H[n] + off
            # leg IK: overwrite UpLeg/Leg/Foot absolute rotations
            for side in ('Left', 'Right'):
                if side not in ik: continue
                if n == P + side + 'UpLeg':
                    self._ik(side, ik[side], R_abs, H)
        out = {}
        for n in self.order:
            b = self.bones[n]
            h0, R0 = self.rest[n]
            Mw = Matrix.Translation(H[n]) @ (R_abs[n].to_matrix() @ R0).to_4x4()
            if n in scl:
                Mw = Mw @ Matrix.Diagonal(scl[n]).to_4x4()
            if b.parent is None:
                basis = b.matrix_local.inverted() @ self.W.inverted() @ Mw
            else:
                p = b.parent.name
                hp, Rp = H[p], R_abs[p]
                Mp = Matrix.Translation(hp) @ (Rp.to_matrix() @ self.rest[p][1]).to_4x4()
                if p in scl: Mp = Mp @ Matrix.Diagonal(scl[p]).to_4x4()
                local_rest = b.parent.matrix_local.inverted() @ b.matrix_local
                basis = local_rest.inverted() @ Mp.inverted() @ Mw
            loc, q, s = basis.decompose()
            pq = self.prevq.get(n)
            if pq is not None and pq.dot(q) < 0: q.negate()
            out[n] = (loc, q, s)
        self.H, self.R_abs = H, R_abs
        return out

    def _ik(self, side, spec, R_abs, H):
        target, foot_q, pole = spec
        up, lo, ft = P + side + 'UpLeg', P + side + 'Leg', P + side + 'Foot'
        hip = H[up]
        h_up, h_lo, h_ft = self.rest[up][0], self.rest[lo][0], self.rest[ft][0]
        l1, l2 = (h_lo - h_up).length, (h_ft - h_lo).length
        v = target - hip
        dist = max(abs(l1 - l2) + 1e-4, min(v.length, l1 + l2 - 1e-4))
        a = v.normalized()
        pole = pole - a * pole.dot(a)
        pole.normalize()
        cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
        cosA = max(-1, min(1, cosA))
        knee = hip + a * (cosA * l1) + pole * (math.sqrt(1 - cosA * cosA) * l1)
        ankle = hip + a * dist
        # frames: rest
        def frame(u, w):
            u = u.normalized(); n = u.cross(w).normalized(); return Matrix((u, n, u.cross(n))).transposed()
        rest_pole = (h_lo - h_up) - (h_ft - h_up).normalized() * (h_lo - h_up).dot((h_ft - h_up).normalized())
        F0u = frame(h_lo - h_up, rest_pole)
        F1u = frame(knee - hip, pole)
        Rup = (F1u @ F0u.transposed()).to_quaternion()
        F0l = frame(h_ft - h_lo, rest_pole)
        F1l = frame(ankle - knee, pole)
        Rlo = (F1l @ F0l.transposed()).to_quaternion()
        parent = self.bones[up].parent.name
        R_abs['__ik_' + side] = (Rup, Rlo, foot_q)
        self._ikres = getattr(self, '_ikres', {})
        self._ikres[side] = (Rup, Rlo, foot_q, knee, ankle)

def solve_full(rig, pose):
    """solve with IK applied: first pass places hips, IK computes absolute leg rotations,
    convert to parent-relative deltas, second pass produces bases."""
    rig._ikres = {}
    rig.solve(pose)
    d = dict({rig.name(k): v for k, v in pose.get('d', {}).items()})
    for side, (Rup, Rlo, foot_q, knee, ankle) in rig._ikres.items():
        up, lo, ft = P + side + 'UpLeg', P + side + 'Leg', P + side + 'Foot'
        Rh = rig.R_abs[rig.bones[up].parent.name]
        d[up] = Rh.inverted() @ Rup
        d[lo] = Rup.inverted() @ Rlo
        d[ft] = Rlo.inverted() @ foot_q
    p2 = dict(pose); p2['d'] = d; p2['ik'] = {}
    return rig.solve(p2)

def apply(rig, basis, key_frame=None):
    for n, (loc, q, s) in basis.items():
        pb = rig.arm.pose.bones[n]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = q
        movable = not rig.bones[n].use_connect
        pb.location = loc if movable else (0, 0, 0)
        pb.scale = s
        rig.prevq[n] = q.copy()
        if key_frame is not None:
            pb.keyframe_insert('rotation_quaternion', frame=key_frame, group=n)
            if movable:
                pb.keyframe_insert('location', frame=key_frame, group=n)
            if n == 'Fan':
                pb.keyframe_insert('scale', frame=key_frame, group=n)
