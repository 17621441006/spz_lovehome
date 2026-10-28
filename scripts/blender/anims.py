# Author all Zangzangbao clips procedurally on the rebuilt rig.
import bpy, sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, poselib; importlib.reload(poselib)
from poselib import *

FPS = 30
TAU = math.pi * 2
def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t
def qmix(a, b, t): return a.slerp(b, t)
def mixd(*pairs):
    """combine deltas multiplicatively per bone"""
    out = {}
    for d in pairs:
        for k, q in d.items():
            out[k] = out[k] @ q if k in out else q
    return out

class Builder:
    def __init__(self, arm):
        self.arm = arm; self.rig = Rig(arm)
        r = self.rig
        self.LA, self.RA = r.head('LeftFoot'), r.head('RightFoot')
        self.PL, self.PR = self.pole('Left'), self.pole('Right')
        self.HIP = r.head('Hips')

    def pole(self, side):
        r = self.rig
        up, lo, ft = r.head(side + 'UpLeg'), r.head(side + 'Leg'), r.head(side + 'Foot')
        a = (ft - up).normalized(); v = lo - up
        return (v - a * v.dot(a)).normalized()

    # ---------- shared layers ----------
    # Bind pose: chin raised and face turned ~8 deg to its left with a slight roll
    # (measured by front-view mirror symmetry, see face_sym.py). Stand it upright.
    HEAD_PITCH = float(os.environ.get('ZZB_HP', '10'))
    HEAD_YAW, HEAD_ROLL = -8.0, -3.0
    # Lift the skull a little off the collar so a fur neck shows between chin and robe.
    NECK_LIFT = float(os.environ.get('ZZB_NL', '0.03'))
    NECK_FWD = float(os.environ.get('ZZB_NF', '0.008'))

    def head_fix(self, amt=1.0):
        return {'Neck': eul(x=0.4 * self.HEAD_PITCH * amt),
                'Head': eul(x=0.6 * self.HEAD_PITCH * amt, z=self.HEAD_YAW, y=self.HEAD_ROLL)}

    def neck_offset(self):
        return {'Head': Vector((0, -self.NECK_FWD, self.NECK_LIFT))}

    def arms_rest(self):
        # right paw lowered in front of the belly (fan pose is the bind pose, blended in at runtime)
        return {'RightShoulder': eul(), 'RightArm': eul(x=8, y=-10), 'RightForeArm': eul(x=60, y=0),
                'RightHand': eul(x=-25), 'LeftArm': eul(), 'LeftForeArm': eul()}

    def tail(self, t, sway=10, lift=0, speed=1.0, phase=0.0, curl=0):
        d = {}
        for i in range(5):
            w = math.sin(TAU * (t * speed) - i * 0.7 + phase)
            d['Tail%d' % (i + 1)] = eul(x=(lift if i == 0 else curl), z=sway * w * (0.6 + 0.15 * i))
        return d

    def hair(self, t, amp=4, speed=1.0, lean=0):
        return {'Hair%d' % (i + 1): eul(x=lean * (i == 0), y=amp * math.sin(TAU * t * speed - 0.9 * (i + 1))) for i in range(3)}

    def legs_stand(self, lift=(0, 0), fwd=(0, 0), narrow=0.012):
        return {'Left': (self.LA + Vector((-narrow, fwd[0], lift[0])), Quaternion(), self.PL),
                'Right': (self.RA + Vector((narrow, fwd[1], lift[1])), Quaternion(), self.PR)}

    # ---------- keying ----------
    def clip(self, name, nframes, fn, loop=True):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        self.arm.animation_data_create()
        self.arm.animation_data.action = act
        self.rig.prevq = {}
        last = nframes if loop else nframes
        for f in range(0, last + 1):
            t = (f % nframes) / nframes if loop else f / nframes
            pose = fn(t)
            pose.setdefault('offset', self.neck_offset())
            basis = solve_full(self.rig, pose)
            apply(self.rig, basis, key_frame=f)
        act.frame_range = (0, last)
        print('CLIP', name, nframes / FPS, 's')
        return act

    # ---------- clips ----------
    def wait(self, t):
        br = math.sin(TAU * t * 2)            # 2 breaths per 3 s loop
        look = math.sin(TAU * t) * 5          # slow glance
        d = mixd(self.head_fix(), self.arms_rest(),
                 {'Spine1': eul(x=0.8 * br), 'Spine2': eul(x=0.8 * br), 'Head': eul(z=look, x=-0.6 * br),
                  'LeftArm': eul(x=1.2 * br), 'RightArm': eul(x=1.2 * br)},
                 self.tail(t, sway=9, lift=6, speed=1, curl=-2), self.hair(t, amp=3, speed=2))
        return {'hips_off': Vector((0, 0, 0.012 + 0.002 * br)), 'd': d, 'ik': self.legs_stand()}

    def gait(self, t, S, duty, lift, bob, lean, armA, hipYaw, run=False):
        def foot(phi, base, side):
            phi %= 1.0
            if phi < duty:
                s = phi / duty
                y = -S / 2 + S * s
                z = 0.0
                pitch = lerp(-8, 14, ss(0.55, 1.0, s)) if not run else lerp(-5, 22, ss(0.5, 1.0, s))
            else:
                s = (phi - duty) / (1 - duty)
                e = ss(0, 1, s)
                y = S / 2 - S * e
                z = lift * math.sin(math.pi * s) ** (0.8 if run else 1.0)
                pitch = lerp(20 if run else 14, -10, ss(0.0, 0.85, s))
            return base + Vector((0, y, z)), eul(x=pitch)
        # Feet track under the hip joints (the bind pose is a wide sumo stance) so the legs
        # step front-to-back instead of waddling sideways; knees point forward.
        r = self.rig
        hipL, hipR = r.head('LeftUpLeg'), r.head('RightUpLeg')
        baseL = Vector((hipL.x + 0.012, self.LA.y + 0.01, self.LA.z))
        baseR = Vector((hipR.x - 0.012, self.RA.y + 0.01, self.RA.z))
        fwd = Vector((0, -1, 0))
        poleL = (fwd + Vector((0.25, 0, 0))).normalized(); poleR = (fwd + Vector((-0.25, 0, 0))).normalized()
        aL, qL = foot(t, baseL, 'L')
        aR, qR = foot(t + 0.5, baseR, 'R')
        c = math.cos(TAU * t); s1 = math.sin(TAU * t)
        if run:
            z = bob * (0.5 - 0.5 * math.cos(TAU * 2 * (t - duty / 2 + 0.25)))   # high in flight
        else:
            z = bob * (0.5 + 0.5 * math.cos(TAU * 2 * t)) * -1 + bob * 0.5
        hips = Vector((0.008 * s1 if not run else 0.004 * s1, 0, (-0.014 if not run else -0.028) + z))
        # left foot forward at t=0 -> left arm back, right arm forward (opposite to the legs)
        swing = math.cos(TAU * t)
        d = mixd(self.head_fix(),
                 {'Hips': eul(z=hipYaw * swing, y=(2.0 if not run else 1.5) * s1, x=lean * 0.4),
                  'Spine': eul(x=lean * 0.3, z=-hipYaw * 0.7 * swing),
                  'Spine1': eul(x=lean * 0.3, z=-hipYaw * 0.5 * swing),
                  'Spine2': eul(x=lean * 0.2),
                  'Neck': eul(x=-lean * 0.35),
                  'Head': eul(x=-lean * 0.45 + (1.5 if run else 1) * math.cos(TAU * 2 * t), z=hipYaw * 0.4 * swing),
                  'LeftArm': eul(x=armA * swing, y=6),
                  'LeftForeArm': eul(x=(-30 if run else -12) + (12 if run else 6) * swing),
                  'RightArm': eul(x=-armA * swing, y=-8),
                  'RightForeArm': eul(x=(70 if run else 55) - (12 if run else 6) * swing),
                  'RightHand': eul(x=-20)},
                 self.tail(t, sway=7 if not run else 5, lift=(14 if not run else 26), speed=1, curl=(-3 if not run else -6)),
                 self.hair(t, amp=5 if not run else 7, speed=1, lean=(0 if not run else 12)))
        return {'hips_off': hips, 'd': d,
                'ik': {'Left': (aL, qL, poleL), 'Right': (aR, qR, poleR)}}

    def walk(self, t):
        return self.gait(t, S=0.26, duty=0.6, lift=0.05, bob=0.010, lean=5, armA=22, hipYaw=7)

    def run(self, t):
        return self.gait(t, S=0.30, duty=0.34, lift=0.075, bob=0.022, lean=12, armA=34, hipYaw=9, run=True)

    def sit(self, t):
        br = math.sin(TAU * t * 2)
        d = mixd(self.head_fix(),
                 {'Hips': eul(x=-6), 'Spine': eul(x=7 + 0.6 * br), 'Spine1': eul(x=3), 'Spine2': eul(x=0.6 * br),
                  'Head': eul(x=2, z=4 * math.sin(TAU * t)),
                  'LeftArm': eul(x=-6, y=4), 'LeftForeArm': eul(x=-10),
                  'RightArm': eul(x=0, y=-12), 'RightForeArm': eul(x=55), 'RightHand': eul(x=-20)},
                 # tail rests on the ground, curled round to the cat's left side
                 {'Tail1': eul(x=34, z=25), 'Tail2': eul(x=-16, z=18), 'Tail3': eul(x=-12, z=16 + 3 * math.sin(TAU * t)),
                  'Tail4': eul(x=-4, z=14 + 5 * math.sin(TAU * t - 0.8)), 'Tail5': eul(x=6, z=10 + 6 * math.sin(TAU * t - 1.6))},
                 self.hair(t, amp=2, speed=2))
        feet = {'Left': (Vector((0.165, -0.33, 0.07)), eul(x=-55, z=-12), self.PL + Vector((0, 0, 0.6))),
                'Right': (Vector((-0.19, -0.33, 0.07)), eul(x=-55, z=12), self.PR + Vector((0, 0, 0.6)))}
        return {'hips_off': Vector((0, 0.02, -0.105 + 0.0015 * br)), 'd': d, 'ik': feet}

    def jump(self, t):          # rising: legs tuck, arms up a little
        k = ss(0, 0.35, t)
        d = mixd(self.head_fix(),
                 {'Spine': eul(x=-4 * k), 'LeftArm': eul(x=-25 * k, y=15 * k), 'LeftForeArm': eul(x=15 * k),
                  'RightArm': eul(x=8 - 20 * k, y=-10 - 12 * k), 'RightForeArm': eul(x=70), 'RightHand': eul(x=-25)},
                 self.tail(t, sway=4, lift=lerp(10, 35, k), speed=1, curl=-8 * k), self.hair(t, amp=3, lean=-15 * k))
        feet = {'Left': (self.LA + Vector((-0.01, 0.03 * k, 0.07 * k)), eul(x=25 * k), self.PL),
                'Right': (self.RA + Vector((0.01, 0.03 * k, 0.06 * k)), eul(x=25 * k), self.PR)}
        return {'hips_off': Vector((0, 0, 0.0)), 'd': d, 'ik': feet}

    def jump_down(self, t):      # falling: legs reach down, arms spread
        w = math.sin(TAU * t) * 2
        d = mixd(self.head_fix(),
                 {'Spine': eul(x=3), 'Head': eul(x=-4), 'LeftArm': eul(x=-10, y=28 + w), 'LeftForeArm': eul(x=10),
                  'RightArm': eul(x=0, y=-32 - w), 'RightForeArm': eul(x=55), 'RightHand': eul(x=-25)},
                 self.tail(t, sway=5, lift=40, speed=1, curl=-10), self.hair(t, amp=4, lean=25))
        feet = {'Left': (self.LA + Vector((-0.015, -0.02, 0.025)), eul(x=10), self.PL),
                'Right': (self.RA + Vector((0.015, -0.02, 0.02)), eul(x=10), self.PR)}
        return {'hips_off': Vector((0, 0, 0.012)), 'd': d, 'ik': feet}

    def source_clip(self, name, data, tail_lift=20):
        """Re-key one of the model's own Tripo clips (same skeleton and bind pose) onto this rig,
        removing horizontal root drift and layering the head fix, neck, tail and ponytail on top."""
        frames, sfps = data['frames'], data['fps']
        dur = (len(frames) - 1) / sfps
        n = max(1, round(dur * FPS))
        act = bpy.data.actions.new(name); act.use_fake_user = True
        self.arm.animation_data.action = act
        self.rig.prevq = {}
        hips = P + 'Hips'
        h0, h1 = Vector(frames[0][hips][0]), Vector(frames[-1][hips][0])
        for f in range(n + 1):
            t = f / FPS
            sf = min(len(frames) - 1.0001, t * sfps); i0 = int(sf); a = sf - i0
            A, Bf = frames[i0], frames[i0 + 1]
            u = f / n
            extra = solve_full(self.rig, {'d': mixd(self.head_fix(), self.tail(u * 1.5, sway=6, lift=tail_lift, speed=1),
                                                    self.hair(u * 1.5, amp=4, speed=1, lean=10)),
                                          'offset': self.neck_offset()})
            for pb in self.arm.pose.bones:
                n_ = pb.name
                pb.rotation_mode = 'QUATERNION'
                if n_ in A:
                    loc = Vector(A[n_][0]).lerp(Vector(Bf[n_][0]), a)
                    q = Quaternion(A[n_][1]).slerp(Quaternion(Bf[n_][1]), a)
                    if n_ == hips:   # keep vertical motion, drop horizontal drift (in-place kick)
                        drift = h0.lerp(h1, u) - h0
                        loc = Vector((loc.x - drift.x, loc.y, loc.z - drift.z))
                    if n_ in (P + 'Neck', P + 'Head'):
                        q = q @ extra[n_][1]; loc = loc + extra[n_][0]
                else:
                    loc, q = extra[n_][0], extra[n_][1]
                pq = self.rig.prevq.get(n_)
                if pq is not None and pq.dot(q) < 0: q.negate()
                self.rig.prevq[n_] = q.copy()
                pb.rotation_quaternion = q
                pb.location = loc if not self.rig.bones[n_].use_connect else Vector()
                pb.keyframe_insert('rotation_quaternion', frame=f, group=n_)
                if not self.rig.bones[n_].use_connect:
                    pb.keyframe_insert('location', frame=f, group=n_)
        act.frame_range = (0, n)
        print('CLIP', name, n / FPS, 's (source)')
        return act

def build_all(arm, kicks=None):
    b = Builder(arm)
    acts = [b.clip('wait', 90, b.wait), b.clip('walk', 14, b.walk), b.clip('run', 12, b.run),
            b.clip('sit', 90, b.sit), b.clip('jump', 15, b.jump, loop=False), b.clip('jump_down', 30, b.jump_down)]
    for name in ('front_kick_01', 'front_kick_02'):
        acts.append(b.source_clip(name, kicks[name]))
    return b, acts

if __name__ == '__main__':
    import json
    argv = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.open_mainfile(filepath=argv[0])
    kicks = json.load(open(os.path.join(os.path.dirname(argv[0]), 'source_kicks.json')))
    arm = bpy.data.objects['CatRig']
    b, acts = build_all(arm, kicks)
    bpy.ops.wm.save_as_mainfile(filepath=argv[1])
