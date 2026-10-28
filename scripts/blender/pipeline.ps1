# 脏脏包 rig pipeline: Tripo source GLB -> clean rig + weights -> clips -> dist/assets/cat-rig.glb
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\blender\pipeline.ps1 -Source D:\path\cute+cat+3d+model.glb -Blender "D:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
param(
  [Parameter(Mandatory=$true)][string]$Source,
  [string]$Blender = 'blender',
  [string]$Work = (Join-Path $env:TEMP 'zzb-rig')
)
$ErrorActionPreference = 'Stop'
$S = $PSScriptRoot
$Repo = Resolve-Path (Join-Path $S '..\..')
New-Item -ItemType Directory $Work -Force | Out-Null
& $Blender -b --factory-startup --python "$S\build_rig.py" -- $Source "$Work\cat_rig.blend" 2>&1 | Select-String 'TAIL|HAIR|Traceback|Error' | % Line
& $Blender -b --factory-startup --python "$S\anims.py" -- "$Work\cat_rig.blend" "$Work\cat_anim.blend" 2>&1 | Select-String 'CLIP|Traceback|Error' | % Line
& $Blender -b --factory-startup --python "$S\export.py" -- "$Work\cat_anim.blend" "$Repo\dist\assets\cat-rig.glb" 2>&1 | Select-String 'EXPORTED|Traceback' | % Line
"Preview frames: blender -b --factory-startup --python $S\anim_test.py -- $Work\cat_anim.blend <outdir> wait,walk,run,sit front,left 4"
