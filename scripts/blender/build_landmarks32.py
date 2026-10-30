"""Two authored, enterable landmarks. Run in Blender; preserves every existing scene.

Blender -Y is the entrance (glTF +Z). Walking floor is exactly Z=0 (glTF Y=0).
Only dedicated new scenes are written to the output .blend; no original is saved.
"""
import bpy, math, json, struct, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parents[1]/'outputs'
ASSETS=ROOT/'dist/assets/buildings'
OUT.mkdir(parents=True,exist_ok=True);ASSETS.mkdir(parents=True,exist_ok=True)
PROMPT='我为游戏设计了两个建筑物，你可以尽量还原图片的设计稿完成3D建模，然后把他俩放进游戏中合适的地方吗？系风亭的功能就是玩家在里面选择睡觉的话，5秒中之后会睡醒，然后醒来发现亭子已经系在了另一个悬崖边上；色彩饱和度可以稍微高一点，颜色要好看协调'

def enum(rna,prop,value):
    values=[x.identifier for x in rna.properties[prop].enum_items]
    if value not in values:raise ValueError((prop,value,values))
    return value
def linear(s):
    rgb=[int(s[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb)
def material(name,color,rough=.82,emit=0):
    m=bpy.data.materials.new('L32 '+name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*linear(color),1);p.inputs['Roughness'].default_value=rough
    if emit:p.inputs['Emission Color'].default_value=(*linear(color),1);p.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=(*linear(color),1);m.use_backface_culling=False
    return m

M={}
for key,col,rough,emit in [('red','BD442E',.83,0),('coral','D76343',.83,0),('old','813D30',.9,0),('bark','654631',.9,0),('wood','A67B45',.78,0),('edge','CBA06B',.83,0),('paper','FFF0C7',.95,.07),('roof','2F656A',.78,0),('roofedge','234B52',.83,0),('stone','A8AD92',.95,0),('moss','7B9565',.98,0),('gold','E4B65C',.55,.04),('glow','FFCC74',.8,.8),('blue','75A8BA',.9,0),('indigo','3D637D',.96,0),('rope','CBB485',.9,0)]:M[key]=material(key,col,rough,emit)

class Builder:
    def __init__(self,prefix):
        self.prefix=prefix;self.groups={}
        self.scene=bpy.data.scenes.new(prefix+' Landmark v32')
        self.root=bpy.data.objects.new(prefix+'_Root',None);self.scene.collection.objects.link(self.root)
        self.objects=[]
    def mesh(self,part,mat,verts,faces,smooth=False):
        key=(part,mat);v,f,s=self.groups.setdefault(key,([],[],[]));offset=len(v)
        v.extend(verts);f.extend([tuple(offset+i for i in face) for face in faces]);s.extend([smooth]*len(faces))
    def tube(self,part,mat,points,r,segments=8,closed=False):
        ps=[Vector(p) for p in points]
        if closed:ps.append(ps[0])
        vs=[];fs=[]
        for i,p in enumerate(ps):
            tang=(ps[min(i+1,len(ps)-1)]-ps[max(0,i-1)]).normalized()
            if tang.length<.1:tang=Vector((0,0,1))
            u=tang.cross(Vector((0,0,1)))
            if u.length<.1:u=tang.cross(Vector((0,1,0)))
            u.normalize();vv=tang.cross(u).normalized()
            rr=r[i] if isinstance(r,list) else r
            for j in range(segments):vs.append(tuple(p+rr*(u*math.cos(j*math.tau/segments)+vv*math.sin(j*math.tau/segments))))
        for i in range(len(ps)-1):
            for j in range(segments):a=i*segments+j;b=i*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
        if not closed:fs.extend([tuple(range(segments-1,-1,-1)),tuple((len(ps)-1)*segments+j for j in range(segments))])
        self.mesh(part,mat,vs,fs,True)
    def box(self,part,mat,loc,size,bevel=.025,rot=0):
        # Eight-sided cross section gives restrained worn/chamfered edges without modifiers.
        x,y,z=loc;hx,hy,hz=[v/2 for v in size];b=min(bevel,hx*.4,hy*.4,hz*.4)
        ring=[(-hx+b,-hy),(hx-b,-hy),(hx,-hy+b),(hx,hy-b),(hx-b,hy),(-hx+b,hy),(-hx,hy-b),(-hx,-hy+b)]
        vs=[];ca,sa=math.cos(rot),math.sin(rot)
        for zz,fac in [(-hz,.98),(-hz+b,1),(hz-b,1),(hz,.98)]:
            for xx,yy in ring:vs.append((x+fac*(xx*ca-yy*sa),y+fac*(xx*sa+yy*ca),z+zz))
        fs=[tuple(range(7,-1,-1)),tuple(24+j for j in range(8))]
        for k in range(3):
            for j in range(8):a=k*8+j;b=k*8+(j+1)%8;fs.append((a,b,b+8,a+8))
        self.mesh(part,mat,vs,fs)
    def disk(self,part,mat,c,rx,ry,zdepth,n=48):
        x,y,z=c;vs=[];fs=[]
        for zz,f in [(-zdepth,.97),(0,1)]:
            for j in range(n):a=j*math.tau/n;vs.append((x+rx*math.cos(a)*f,y+ry*math.sin(a)*f,z+zz))
        fs=[tuple(range(n-1,-1,-1)),tuple(n+j for j in range(n))]
        fs.extend((j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n))
        self.mesh(part,mat,vs,fs)
    def finish(self):
        # Keep independent fading shells, but batch every static part by material.
        batched={}
        for (part,mat),(vs,fs,smooths) in self.groups.items():
            key=('Occluder' if 'Occluder' in part else 'Details',mat)
            v,f,s=batched.setdefault(key,([],[],[]));offset=len(v)
            v.extend(vs);f.extend(tuple(offset+i for i in face) for face in fs);s.extend(smooths)
        self.groups=batched
        for (part,mat),(vs,fs,smooths) in self.groups.items():
            me=bpy.data.meshes.new(self.prefix+'_'+part+'_'+mat);me.from_pydata(vs,[],fs);me.update();me.materials.append(M[mat])
            ob=bpy.data.objects.new(me.name,me);self.scene.collection.objects.link(ob);ob.parent=self.root
            for p,s in zip(me.polygons,smooths):p.use_smooth=s
            self.objects.append(ob)
        self.root['floor_y']=0;self.root['front_axis']='+Z after glTF export'
        return self

def nest():
    b=Builder('TN');R=5.0;H=7.5
    b.disk('Foundation','stone',(0,0,-.04),5.7,5.7,.26,64)
    b.disk('Floor','wood',(0,0,0),4.94,4.94,.09,64)
    b.box('Floor','wood',(0,-5.15,-.055),(2.6,1.7,.11),.035)
    # Interior floor planks, finer than the reclaimed exterior timber.
    for x in [-4.4+i*.55 for i in range(17)]:
        extent=math.sqrt(max(0,4.85**2-x*x))
        b.box('Floor','edge',(x,0,.003),(.014,extent*2,.007),0)
    def rad(z):return R*math.sqrt(max(.002,1-(z/H)**2))
    # Solid, hollow curved timber courses; no central mesh and no doorway-filled glow card.
    rng=random.Random(32)
    for row in range(24):
        lo=row*.305;hi=lo+.285
        for j in range(48):
            a0=j*math.tau/48;a1=(j+1)*math.tau/48;mid=(a0+a1)/2
            if lo<3.14 and math.sin(mid)<-.91:continue
            ro0,ro1=rad(lo),rad(hi);ri0,ri1=ro0-.18,ro1-.18
            vs=[(r*math.cos(a),r*math.sin(a),z) for z,r in [(lo,ro0),(hi,ro1),(lo,ri0),(hi,ri1)] for a in [a0,a1]]
            b.mesh('OccluderShell',['red','red','old','coral'][rng.randrange(4)],vs,[(0,1,3,2),(5,4,6,7),(4,5,1,0),(2,3,7,6),(4,0,2,6),(1,5,7,3)],False)
    # Broad circular beams interrupt the finer courses; limited hand-worn waviness.
    for row,z in enumerate([.30,.94,1.62,2.30,3.18,3.92,4.66,5.33,5.96,6.52,7.00]):
        r=rad(z)+.13;start=-math.pi/2+(.34 if z<3.12 else 0);end=3*math.pi/2-(.34 if z<3.12 else 0)
        points=[(r*math.cos(a),r*math.sin(a),z+.026*math.sin(a*5+row)) for a in [start+i*(end-start)/56 for i in range(57)]]
        b.tube('OccluderBeams','coral' if row%3 else 'red',points,.115,8)
    for k in range(16):
        a=k*math.tau/16
        low=3.2 if math.sin(a)<-.91 else .18
        points=[((rad(z)+.07)*math.cos(a), (rad(z)+.07)*math.sin(a),z) for z in [low+i*(7.42-low)/24 for i in range(25)]]
        b.tube('OccluderBeams','old',points,.083,7)
    # The entry uses a real torii header, projecting curved crossbeams and open throat.
    for s in [-1,1]:
        b.tube('OccluderGate','red',[(s*1.43,-5.04,.02),(s*1.43,-5.04,3.17)],.15,12)
        b.tube('GateDetails','gold',[(s*1.43,-5.04,.18),(s*1.43,-5.04,.28)],.157,12)
    for z,width in [(3.16,3.5),(3.50,3.94)]:
        pts=[(-width/2+i*width/20,-5.03,z+.13*(abs(-1+i/10)**2)) for i in range(21)]
        b.tube('OccluderGate','red',pts,.14 if z<3.3 else .17,10)
    b.box('OccluderGate','old',(0,-5.02,3.34),(.26,.25,.42))
    # Curved entrance brow with teal restrained cap echoes the supplied three-view roof.
    for y in [-5.48,-4.62]:
        b.tube('OccluderGate','roof',[(x,y,3.71+.12*(abs(x)/2.15)**2) for x in [-2.15+i*.215 for i in range(21)]],.055,8)
    vs=[(x,y,3.70+.12*(abs(x)/2.15)**2) for y in [-5.48,-4.62] for x in [-2.15+i*.215 for i in range(21)]]
    b.mesh('OccluderGate','roof',vs,[(i,i+1,i+22,i+21) for i in range(20)])
    # Reclaimed stacked torii at the crown, not antenna-like ribs.
    for i,(z,w) in enumerate([(7.33,3.85),(7.63,3.3),(7.91,2.7)]):
        for y in [-.55,.55]:b.tube('OccluderCrown','red',[(x,y,z+.10*(abs(x)/(w/2))**2) for x in [-w/2+j*w/20 for j in range(21)]],.13,10)
    b.disk('CrownBell','gold',(0,0,8.22),.16,.16,.26,16)
    # Rope and four paper shide over the entrance, matching the sketch.
    b.tube('OccluderGate','rope',[(-2.08,-5.31,4.08),(-1.0,-5.36,3.96),(0,-5.38,3.93),(1,-5.36,3.96),(2.08,-5.31,4.08)],.032,6)
    for x in [-1.55,-.65,.65,1.55]:
        for j in range(3):b.box('GateDetails','paper',(x+(.04 if j%2 else -.04),-5.39,3.76-j*.16),(.16,.035,.20),.005,(-1 if j%2 else 1)*.25)
    # Warm rear shoji panel makes the interior readable while leaving the entry entirely empty.
    b.box('Interior','paper',(0,3.63,1.48),(4.6,.055,2.7),.012)
    for x in [-2.3,-1.15,0,1.15,2.3]:b.box('Interior','wood',(x,3.58,1.48),(.045,.07,2.77),.01)
    for z in [.15,1.05,1.95,2.85]:b.box('Interior','wood',(0,3.58,z),(4.65,.07,.045),.01)
    # Low tea bench and four soft floor cushions.
    b.box('Interior','old',(0,2.45,.30),(2.35,.72,.12),.04)
    for x in [-.9,.9]:b.box('Interior','bark',(x,2.45,.14),(.16,.55,.28),.025)
    for x,y in [(-1.2,.8),(1.2,.8),(-1.2,-.8),(1.2,-.8)]:
        b.box('Interior','indigo',(x,y,.045),(1.05,.75,.09),.07)
        b.box('Interior','gold',(x,y,.094),(.76,.49,.009),.04)
    for x in [-2.2,2.2]:
        b.tube('Interior','rope',[(x,2.3,4.4),(x,2.3,2.5)],.015,5)
        b.disk('Interior','glow',(x,2.3,2.18),.28,.28,-.35,16)
        for z in [2.18,2.53]:b.disk('Interior','old',(x,2.3,z),.29,.29,.028,16)
    for x,y,r in [(-4.3,2.6,.6),(4.7,1.7,.42),(-3.8,-3.7,.43),(3.8,-3.7,.4)]:b.disk('Foundation','moss',(x,y,-.025),r,r*.7,.025,18)
    b.root['entrance_width']=2.56;b.root['entrance_height']=3.02;b.root['outer_radius']=5.2;b.root['base_radius']=5.7
    return b.finish()

def kite_house():
    b=Builder('KH')
    b.box('Floor','wood',(0,0,-.08),(4.10,4.10,.16),.04)
    for i in range(13):b.box('Floor','edge',(-1.92+i*.32,0,-.016),(.015,4.04,.032),.004)
    for x in [-1.8,1.8]:
        for y in [-1.8,1.8]:
            b.box('OccluderPosts','wood',(x,y,1.28),(.17,.17,2.56),.03)
            b.box('OccluderPosts','edge',(x,y,.19),(.20,.20,.12),.02)
    # Three paper walls; front central entry remains two metres clear.
    for side in [-1,1]:
        x=side*1.8
        b.box('OccluderScreens','paper',(x,0,1.32),(.045,3.45,2.22),.01)
        for y in [-1.7,-.85,0,.85,1.7]:b.box('OccluderLattice','wood',(x-side*.025,y,1.32),(.08,.045,2.28),.007)
        for z in [.20,.95,1.68,2.43]:b.box('OccluderLattice','wood',(x,0,z),(.08,3.5,.048),.007)
    b.box('OccluderScreens','paper',(0,1.8,1.32),(3.45,.045,2.22),.01)
    for x in [-1.7,-.85,0,.85,1.7]:b.box('OccluderLattice','wood',(x,1.77,1.32),(.045,.08,2.28),.007)
    for z in [.20,.95,1.68,2.43]:b.box('OccluderLattice','wood',(0,1.77,z),(3.5,.08,.048),.007)
    for side in [-1,1]:
        b.box('OccluderRail','wood',(side*1.5,-1.87,.69),(1.0,.09,.10),.02)
        for x in [side*1.08,side*1.5,side*1.95]:b.box('OccluderRail','wood',(x,-1.87,.34),(.055,.07,.68),.012)
    # Concave teal hip roof with slightly raised, rounded eaves.
    rings=[(2.48,2.62),(2.17,2.58),(1.3,2.88),(.72,3.30)]
    vs=[]
    per=32
    for size,z in rings:
        for j in range(per):
            a=j*math.tau/per;mx=max(abs(math.cos(a)),abs(math.sin(a)));x=size*math.cos(a)/mx;y=size*math.sin(a)/mx
            vs.append((x,y,z+.075*(min(abs(x),abs(y))/max(size,.01))**6))
    fs=[]
    for i in range(len(rings)-1):
        for j in range(per):a=i*per+j;c=i*per+(j+1)%per;fs.append((a,c,c+per,a+per))
    # A single fan centre closes the hip roof continuously (no centre ridge gaps).
    vs.append((0,0,3.42))
    for j in range(per):fs.append((3*per+j,3*per+(j+1)%per,128))
    b.mesh('OccluderRoof','roof',vs,fs,True)
    outer=vs[:per];b.tube('OccluderRoof','roofedge',outer,.055,8,True)
    b.tube('OccluderRoof','roofedge',[(-1.1,0,3.45),(1.1,0,3.45)],.07,8)
    for x in [-1.8,-.9,0,.9,1.8]:
        for s in [-1,1]:b.tube('OccluderRoof','roofedge',[(x,s*2.47,2.63),(x*.88,s*2.17,2.60),(x*.55,s*1.3,2.9),(x*.3,s*.70,3.32)],.014,5)
    # Bedding and a folded contrasting quilt are at glTF X=.65,Z=-.35.
    b.box('Bedding','indigo',(.65,.35,.07),(1.2,1.9,.14),.09)
    b.box('Bedding','paper',(.65,.95,.18),(1.08,.45,.18),.08)
    b.box('Bedding','gold',(.65,-.10,.165),(1.13,.82,.13),.07)
    for x in [.18,.34,.50,.66,.82,.98,1.14]:b.box('Bedding','edge',(x,-.10,.235),(.023,.75,.008),.005)
    b.box('Interior','old',(-1.10,.9,.27),(.68,.58,.11),.045)
    for x in [-1.33,-.87]:b.box('Interior','wood',(x,.9,.12),(.08,.45,.24),.02)
    for x in [-1.5,1.5]:
        b.tube('Lanterns','rope',[(x,-1.88,2.54),(x,-1.88,2.28)],.014,5)
        b.disk('Lanterns','glow',(x,-1.88,2.05),.13,.13,-.24,16)
        for z in [2.05,2.29]:b.disk('Lanterns','old',(x,-1.88,z),.14,.14,.025,16)
    # Three distinctive diamond kites. Four lightly billowed triangles each.
    kites=[(-2.80,.60,8.65,1.65,'red'),(.10,1.15,9.45,1.65,'paper'),(2.90,-.15,7.75,1.25,'blue')]
    for index,(x,y,z,s,col) in enumerate(kites):
        pts=[(x,y,z+s),(x+s*.78,y,z),(x,y,z-s*1.12),(x-s*.78,y,z),(x,y-.14,z)]
        b.mesh('Kites',col,pts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
        b.tube('KiteSpars','wood',[pts[0],(x,y-.16,z),pts[2]],.022,6)
        b.tube('KiteSpars','wood',[pts[1],(x,y-.16,z),pts[3]],.022,6)
        b.tube('KiteSpars','wood',pts[:4],.018,6,True)
        # Round, contrasting crest sewn on the sail, facing front -Y.
        for r,crest,dy in [(.25,'paper' if col=='red' else 'red',-.175),(.11,'red' if col=='red' else 'gold',-.18)]:
            v=[(x,y+dy,z)]+[(x+r*math.cos(j*math.tau/24),y+dy,z+r*math.sin(j*math.tau/24)) for j in range(24)]
            b.mesh('KiteCrests',crest,v,[(0,j+1,(j+1)%24+1) for j in range(24)])
        tail=[pts[2],(x+.20,y,z-s*1.45),(x+.44,y+.07,z-s*1.8),(x+.28,y+.10,z-s*2.2)]
        b.tube('KiteLines','rope',tail,.012,5)
        for j,p in enumerate(tail[1:]):
            xx,yy,zz=p
            b.mesh('KiteBows','paper' if col=='red' else 'red',[(xx-.14,yy,zz+.10),(xx+.14,yy,zz+.05),(xx,yy-.012,zz-.06)],[(0,1,2)])
        anchors=[(-2.3,-2.3,2.67),(2.3,-2.3,2.67)] if index==0 else ([(2.3,2.3,2.67),(-2.3,2.3,2.67)] if index==1 else [(2.3,-2.3,2.67)])
        for anchor in anchors:b.tube('KiteLines','rope',[anchor,(x,y-.04,z)],.013,5)
    # Hanging rope ladder only. Runtime provides the mooring rope to the cliff.
    for x in [-.38,.38]:b.tube('Ladder','rope',[(x,-1.95,.01),(x,-2.02,-.90),(x,-2.12,-1.8)],.028,7)
    for j in range(6):
        z=-.22-j*.29;y=-1.95+z*.09;b.tube('Ladder','wood',[(-.42,y,z),(.42,y,z)],.045,8)
    b.root['entrance_width']=2.0;b.root['deck_width']=4.1;b.root['bed_x']=.65;b.root['bed_z']=-.35
    return b.finish()

def studio(b,center,scale,location):
    sc=b.scene;world=bpy.data.worlds.new(b.prefix+' StudioWorld');world.use_nodes=True
    bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(*linear('C8D9D5'),1);bg.inputs[1].default_value=.7;sc.world=world
    for name,loc,power,size in [('Key',(-9,-12,17),2400,10),('Fill',(10,-4,8),1300,10),('Rim',(1,7,13),1900,8)]:
        data=bpy.data.lights.new(b.prefix+name,'AREA');ob=bpy.data.objects.new(data.name,data);sc.collection.objects.link(ob);ob.location=loc;data.energy=power;data.shape=enum(bpy.types.AreaLight.bl_rna,'shape','DISK');data.size=size;ob.rotation_euler=(Vector(center)-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new(b.prefix+' PreviewCamera');data.type=enum(bpy.types.Camera.bl_rna,'type','ORTHO');data.ortho_scale=scale
    camera=bpy.data.objects.new(data.name,data);sc.collection.objects.link(camera);camera.location=location;camera.rotation_euler=(Vector(center)-camera.location).to_track_quat('-Z','Y').to_euler();sc.camera=camera
    sc.render.engine=bpy.data.scenes['Scene'].render.engine
    sc.render.resolution_x=1100;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
    sc.render.image_settings.file_format=enum(bpy.types.ImageFormatSettings.bl_rna,'file_format','PNG')
    sc.render.film_transparent=False
    sc.view_settings.view_transform=bpy.data.scenes['Scene'].view_settings.view_transform
    sc.render.filepath=str(OUT/(b.prefix.lower()+'-landmark-v32.png'))

def export(b,filename):
    bpy.context.window.scene=b.scene
    for o in b.scene.objects:o.select_set(False)
    for o in [b.root,*b.objects]:o.select_set(True)
    bpy.context.view_layer.objects.active=b.root;bpy.context.view_layer.update()
    try:bpy.ops.export_scene.gltf(export_format='__query__')
    except TypeError as err:
        if "'GLB'" not in str(err):raise
    bpy.ops.export_scene.gltf(filepath=str(ASSETS/filename),export_format='GLB',check_existing=False,use_selection=True,use_active_scene=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    raw=(ASSETS/filename).read_bytes();j=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    verts=[o.matrix_world@Vector(v) for o in b.objects for v in o.bound_box]
    report={'file':filename,'bytes':len(raw),'meshBatches':len(j.get('meshes',[])),'drawCalls':sum(len(m['primitives']) for m in j.get('meshes',[])),'triangles':sum(len(p.vertices)-2 for o in b.objects for p in o.data.polygons),'gltfMin':[min(v.x for v in verts),min(v.z for v in verts),-max(v.y for v in verts)],'gltfMax':[max(v.x for v in verts),max(v.z for v in verts),-min(v.y for v in verts)],'floorY':0,'entranceAxis':'+Z'}
    print(json.dumps(report));return report

def build():
    if any(bpy.data.scenes.get(n) for n in ['TN Landmark v32','KH Landmark v32']):raise RuntimeError('Dedicated landmark scenes already exist; originals are never overwritten')
    original=bpy.context.window.scene
    try:
        torii=nest();kite=kite_house()
        studio(torii,(0,0,3.6),13.5,(11,-20,10));studio(kite,(0,0,4.5),14.0,(12,-25,12))
        reports=[export(torii,'torii-nest-v1.glb'),export(kite,'kite-house-v1.glb')]
        bpy.data.libraries.write(str(OUT/'new-buildings-v32.blend'),{torii.scene,kite.scene},fake_user=True,compress=True)
        (OUT/'new-buildings-v32-report.json').write_text(json.dumps(reports,indent=2),encoding='utf8')
        bpy.app.driver_namespace['landmarks32']={'torii':torii,'kite':kite,'reports':reports}
    finally:bpy.context.window.scene=original
if __name__=='__main__':build()
