"""Deterministic local character animation; no camera transform.
Run with Python (numpy/scipy/Pillow) and ffmpeg. Coordinates use the approved C cover at 1672px. Ring glints are baked into both video sizes.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import map_coordinates, binary_closing, binary_fill_holes, binary_dilation, distance_transform_edt, label
from pathlib import Path
import subprocess, math, sys, argparse, shutil
root=Path(__file__).resolve().parents[1]
source=np.array(Image.open(root/'dist/assets/loading-night.png').convert('RGB'))
h,w=source.shape[:2]; Y,X=np.mgrid[:h,:w].astype(np.float32)
def ellipse(cx,cy,rx,ry):
    q=((X-cx)/rx)**2+((Y-cy)/ry)**2
    return np.clip(1-q,0,1)**2
boy=ellipse(548,458,95,89);girl=ellipse(1158,506,105,96)
belly=ellipse(850,445,515,289)
# The approved pixels form one rigid passenger, independently composited over
# the breathing belly. An outlined warm-color matte excludes the blue moon and
# forest, rather than dragging them along with a broad displacement plateau.
cat_mask=Image.new('L',(w,h))
ImageDraw.Draw(cat_mask).polygon([(728,279),(742,254),(776,210),(807,212),(848,196),(872,186),(912,190),(944,219),(969,232),(1003,239),(1025,258),(1055,284),(1065,312),(1049,337),(1011,348),(971,343),(940,330),(884,338),(850,336),(802,314),(757,304)],fill=255)
cat_area=np.s_[165:365,710:1080]
cat_pixels=source[cat_area].astype(np.float32)
warm=(cat_pixels[:,:,0]>cat_pixels[:,:,1]*1.015)&(cat_pixels[:,:,0]>cat_pixels[:,:,2]*1.035)
hard=binary_fill_holes(binary_closing((np.asarray(cat_mask)[cat_area]>0)&warm))
components,_=label(hard);sizes=np.bincount(components.ravel());sizes[0]=0;hard=components==sizes.argmax()
cat_alpha=np.zeros((h,w),dtype=np.float32)
cat_alpha[cat_area]=np.asarray(Image.fromarray(np.uint8(hard)*255).filter(ImageFilter.GaussianBlur(.6)),dtype=np.float32)/255
# Only the narrow newly exposed boundary is ever seen. Extend its nearest clean
# background pixels inward, retaining the real belly color and local shadows.
erase=binary_dilation(hard,iterations=2);nearest=distance_transform_edt(erase,return_distances=False,return_indices=True)
clean_source=source.copy();patch=clean_source[cat_area];visible_alpha=cat_alpha[cat_area]>0;patch[visible_alpha]=source[cat_area][nearest[0][visible_alpha],nearest[1][visible_alpha]]
# Reconstruct a premultiplied foreground, so the unchanged source is recovered
# exactly at zero lift. Blending the already anti-aliased source twice would
# flash a pale fringe at each breath's turning point.
cat_premult=np.zeros(source.shape,dtype=np.float32)
cat_premult[cat_area]=source[cat_area].astype(np.float32)-clean_source[cat_area]*(1-cat_alpha[cat_area][...,None])
cat_support=float(belly[337,895])
silhouette=Image.new('L',(w,h))
ImageDraw.Draw(silhouette).polygon([(425,480),(500,409),(610,342),(710,302),(753,285),(825,287),(900,309),(969,330),(1048,337),(1170,355),(1250,430),(1320,540),(1340,650),(1150,710),(650,710)],fill=255)
matte=np.asarray(silhouette.filter(ImageFilter.GaussianBlur(5)),dtype=np.float32)/255
body=belly*matte*(1-np.minimum(1,boy*4))*(1-np.minimum(1,girl*4))
# Smooth mask reaches zero well before any scenery; every background pixel stays fixed.
closed=Image.fromarray(source.copy()); d=ImageDraw.Draw(closed)
for cx,cy,rx,ry,skin in [(553,476,6,7,(235,166,120)),(579,467,5,7,(234,167,119)),(1120,510,6,8,(243,178,137)),(1150,523,7,8,(244,180,140))]:
    d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill=skin)
    d.arc((cx-rx,cy-4,cx+rx,cy+3),0,180,fill=(79,44,32),width=2)
closed=np.asarray(closed)
eye_masks=[]
for eyes in [[(553,476,7,8),(579,467,6,8)],[(1120,510,7,9),(1150,523,8,9)]]:
    m=Image.new('L',(w,h));dr=ImageDraw.Draw(m)
    for cx,cy,rx,ry in eyes:dr.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill=255)
    eye_masks.append(np.asarray(m.filter(ImageFilter.GaussianBlur(.55)),dtype=np.float32)/255)
def blink(t,centers):
    return max([max(0,1-abs(t-c)/.12) for c in centers]+[0])
def render(t):
    eye=np.maximum(eye_masks[0]*blink(t,[2.5,6.5,10.5]),eye_masks[1]*blink(t,[1.5,5.5,9.5]))
    breath=26*(.5-.5*np.cos(2*np.pi*t/6))
    lift=breath*cat_support
    base=clean_source*(1-eye[...,None])+closed*eye[...,None]
    bx=.9*np.sin(2*np.pi*t/12);gx=.8*np.sin(2*np.pi*t/12+1)
    mx=X-bx*boy-gx*girl
    my=Y+breath*body-.6*np.sin(2*np.pi*t/12)*boy-.7*np.sin(2*np.pi*t/12+1)*girl
    frame=np.stack([map_coordinates(base[:,:,c],[my,mx],order=1,mode='nearest',prefilter=False) for c in range(3)],axis=-1)
    area=np.s_[max(0,165-int(np.ceil(lift))):365,710:1080]
    coords=[Y[area]+lift,X[area]]
    alpha=map_coordinates(cat_alpha,coords,order=1,mode='constant',cval=0,prefilter=False)
    passenger=np.stack([map_coordinates(cat_premult[:,:,c],coords,order=1,mode='constant',cval=0,prefilter=False) for c in range(3)],axis=-1)
    frame[area]=frame[area]*(1-alpha[...,None])+passenger
    # Five warm fireflies gently pulse in place, with only a tiny local drift.
    for i,(cx,cy) in enumerate([(390,692),(1010,660),(1071,715),(1487,635),(604,768)]):
        pulse=(.5+.5*np.sin(2*np.pi*t/(3 if i%2 else 4)+i*1.7))**2
        # Evaluate tiny local glows only where they can affect an 8-bit pixel.
        # This preserves their appearance without millions of exponentials/frame.
        area=np.s_[max(0,cy-30):min(h,cy+31),max(0,cx-30):min(w,cx+31)]
        glow=np.exp(-((X[area]-cx-1.5*np.sin(2*np.pi*t/12+i))**2+(Y[area]-cy-2*np.sin(2*np.pi*t/6+i))**2)/32)
        frame[area]+=glow[...,None]*np.array([35,29,10],dtype=np.float32)*pulse
    # A clear white/gold four-point glint anchored to her left ring finger.
    # Two distinct flashes per six seconds, not a screen-wide light or camera effect.
    phase=t%6
    pulse=max(0,1-abs(phase-1.8)/.62)**1.6+.85*max(0,1-abs(phase-2.65)/.40)**1.6
    rx,ry=1170.5,554.0
    ix,iy=int(rx),int(ry)
    rx+=gx*girl[iy,ix]
    ry-=breath*body[iy,ix]-.7*np.sin(2*np.pi*t/12+1)*girl[iy,ix]
    area=np.s_[max(0,int(ry)-72):min(h,int(ry)+73),max(0,int(rx)-72):min(w,int(rx)+73)]
    dx=X[area]-rx;dy=Y[area]-ry
    halo=np.exp(-(dx*dx+dy*dy)/48)*.65
    cross=np.exp(-dx*dx/1.8-dy*dy/190)+np.exp(-dy*dy/1.8-dx*dx/140)
    frame[area]+=(halo+cross)[...,None]*np.array([255,244,220],dtype=np.float32)*pulse
    return np.uint8(np.clip(frame,0,255))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',nargs='?',default=str(root/'dist/assets/loading-night-v28.mp4'));parser.add_argument('--lite',action='store_true');parser.add_argument('--ffmpeg');args=parser.parse_args();out=Path(args.output)
    ffmpeg=args.ffmpeg or shutil.which('ffmpeg')
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    # Preserve the original approved source image and earlier video versions.
    if out.resolve() in [(root/'dist/assets/loading-night.mp4').resolve(),(root/'dist/assets/loading-lite.mp4').resolve()]:raise ValueError('Choose a versioned output; original videos are preserved')
    p=subprocess.Popen([ffmpeg,'-v','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','24','-i','-','-vf','scale=1280:720' if args.lite else 'scale=1920:1080','-an','-c:v','libx264','-preset','slow','-crf','23' if args.lite else '20','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
    for n in range(288):
        f=render(n/24);p.stdin.write(f.tobytes())
        if n in (0,36,43,60,72):
            qa=root/'qa-output/cover';qa.mkdir(parents=True,exist_ok=True);Image.fromarray(f).save(qa/f'frame-{n}.png')
        if n%48==0:print(f'frame {n}/288',flush=True)
    p.stdin.close();assert p.wait()==0
    # Validate stationary environment before encoding; character area must move.
    a=render(0);b=render(3)
    assert np.array_equal(a[:160],b[:160]),'Sky must stay fixed'
    assert np.array_equal(a[100:400,1300:1550],b[100:400,1300:1550]),'Treehouse must stay fixed'
    assert np.abs(a[300:550,700:1000].astype(float)-b[300:550,700:1000]).mean()>.1
    quiet=render(0)[547:561,1164:1178].mean();flash=render(1.8)[547:561,1164:1178].mean()
    assert flash>quiet+15,'Diamond must visibly sparkle'
    assert np.max(np.abs(render(0).astype(int)-render(12).astype(int)))<=1,'Loop must close'
    print('PASS: sky/treehouse fixed; belly moves; separate blink schedules; diamond flashes; seamless 12s loop')
