"""Real Blender render deliverables (no substitute illustration or generated image)."""
import bpy,shutil
from mathutils import Vector

def portrait(m):
    sc=m.SC;camera=sc.camera;floor=bpy.data.objects['DWR_StudioFloor']
    previous=(camera.matrix_world.copy(),camera.data.ortho_scale,sc.render.resolution_x,sc.render.resolution_y,sc.render.film_transparent,sc.render.image_settings.color_mode,floor.hide_render)
    try:
        m.RIG.animation_data.action=m.ACTIONS['idle'];sc.frame_set(1)
        sc.render.resolution_x=384;sc.render.resolution_y=384
        sc.render.film_transparent=True;sc.render.image_settings.color_mode=m.enum(bpy.types.ImageFormatSettings.bl_rna,'color_mode','RGBA');floor.hide_render=True
        camera.location=(.55,-3,1.05);camera.rotation_euler=(Vector((0,-.06,.78))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.18
        sc.render.filepath=str(m.OUT/'dengweirong-portrait.png');bpy.ops.render.render(write_still=True,scene=sc.name)
        shutil.copy2(m.OUT/'dengweirong-portrait.png',m.ASSET/'dengweirong-portrait.png')
    finally:
        camera.matrix_world=previous[0];camera.data.ortho_scale=previous[1]
        sc.render.resolution_x=previous[2];sc.render.resolution_y=previous[3];sc.render.film_transparent=previous[4];sc.render.image_settings.color_mode=previous[5];floor.hide_render=previous[6]

def run(m):
    m.RIG.animation_data.action=m.ACTIONS['idle'];m.SC.frame_set(1)
    m.render_view('dengweirong-v1-front.png',(0,-3,1.05))
    m.render_view('dengweirong-v1-side.png',(3,-.2,1.2))
    m.render_view('dengweirong-v1-three-quarter.png',(1.8,-2.8,1.5))
    portrait(m)
    bpy.data.libraries.write(str(m.OUT/'dengweirong-v1.blend'),{m.SC,*m.ACTIONS.values()},fake_user=True,compress=True)

if __name__=='__main__':run(bpy.app.driver_namespace['dwr_builder'])
