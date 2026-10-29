"""Visual landmark regression for the approved cover's rigid cat passenger."""
import importlib.util
from pathlib import Path
import numpy as np

spec=importlib.util.spec_from_file_location('cover',Path(__file__).with_name('render-loading-wallpaper.py'))
cover=importlib.util.module_from_spec(spec);spec.loader.exec_module(cover)
a=cover.render(0);b=cover.render(3)
# Independently track texture patches: unlike checking the displacement formula,
# this catches a deformed face, red outfit, folded fan or tail in the final pixels.
patches={'face':(780,228,83,57),'outfit':(889,253,52,49),'fan':(801,295,55,23),'tail':(981,285,60,43)}
shifts={}
for name,(x,y,w,h) in patches.items():
    reference=a[y:y+h,x:x+w].astype(float)
    errors=[np.mean(np.abs(reference-b[y-dy:y+h-dy,x:x+w].astype(float))) for dy in range(27)]
    shift=int(np.argmin(errors));shifts[name]={'liftPixels':shift,'meanError':round(errors[shift],3)}
    assert errors[shift]<7,(name,'cat texture changed shape',errors[shift])
assert max(v['liftPixels'] for v in shifts.values())-min(v['liftPixels'] for v in shifts.values())<=1,shifts
assert min(v['liftPixels'] for v in shifts.values())>=12,'Passenger must visibly ride the breathing belly'
first_step=np.abs(a[165:365,710:1080].astype(int)-cover.render(1/24)[165:365,710:1080].astype(int))
assert first_step.max()<20,('Matte edge flashes at breathing turn',first_step.max())
assert np.array_equal(a[:160],b[:160]),'Sky moved'
assert np.array_equal(a[165:235,710:750],b[165:235,710:750]),'Moon edge moved with cat'
assert np.array_equal(a[100:400,1300:1550],b[100:400,1300:1550]),'Treehouse moved'
assert np.array_equal(a[180:380,60:300],b[180:380,60:300]),'Torii background moved'
assert np.max(np.abs(a.astype(int)-cover.render(12).astype(int)))<=1,'Loop does not close'
assert cover.render(1.8)[547:561,1164:1178].mean()>a[547:561,1164:1178].mean()+15,'Ring glint lost'
print({'catLandmarks':shifts,'background':'fixed','loop':'12 seconds seamless','ring':'retained'})
