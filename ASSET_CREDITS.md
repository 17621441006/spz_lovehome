# 素材与授权

## 用户提供的素材

- 原 `totoro-cat.zip`：原有游戏、照片、角色设计与交互。
- `cute+cat+3d+model(1).glb`：Tripo 双足和服猫与 9 组骨骼动画。
- `treehouse+3d+model.glb`：树屋，经保留 UV 的减面优化。
- `树木+3d+模型.glb`：森林树，经保留 UV 的减面优化。

- `日式五重塔+3dモデル.glb` → `pagoda.glb`。
- `日式神社3d模型.glb` → `shrine.glb`。
- `日式建筑3d模型_Clone1.glb` → `japanese-house.glb`。
- `日式寺院+3dモデル.glb` → `temple.glb`。
- `奇幻树木3d模型.glb` → `fantasy-tree.glb`。
- `树木+3d+模型 (1).glb` → `broadleaf-tree.glb`。
- 本轮提供的三张猫咪照片：用于观察头型与橘白毛色，没有作为新照片打包。

新增六个模型保留原 UV 和贴图，进行减面；三种树另有 `-lod.glb` 远景版本。
胸部和手掌补片复用用户猫模型的毛发贴图；折扇为本工程新建几何。

这些用户提供的素材不因工程使用其他 CC0 资源而自动变为 CC0。

## 本次新增资源

### Forest Leaves 02

作者：Rob Tuytel / Poly Haven。授权：CC0。
使用：`dist/assets/textures/forest-floor.jpg`，地面细节层。
来源：https://polyhaven.com/a/forest_leaves_02
授权：https://polyhaven.com/license

### Mossy Rock

作者：Rob Tuytel / Poly Haven。授权：CC0。
使用：`dist/assets/textures/mossy-rock.jpg`，石阶、基座与石灯笼。
来源：https://polyhaven.com/a/mossy_rock
授权：https://polyhaven.com/license

### Cat Purr & Meow — cat_softmew.wav

作者：Kerzoven。授权：CC0。
使用：`dist/assets/audio/cat-softmew.wav`，柔和猫叫。
来源：https://opengameart.org/content/cat-purr-meow
作者自录，原始录音可能含少量环境声；播放时使用低通滤波与增益控制。

### Three.js

原工程随附的 Three.js 0.186.1，MIT License。完整许可见 `dist/vendor/LICENSE-three.txt`。
模型减面使用 Three.js 随附的 meshoptimizer Simplifier（MIT），工具源文件由 npm Three 包提供。

### 配乐与氛围

`dist/src/audio.js` 的「林间慢板」是本次编写的原创合成循环，不是《龙猫》电影原声，也未复刻其旋律。
水波、树冠风动与光束均为本工程的实时程序效果。

## 调研但未打包的备用模型库

Quaternius — Stylized Nature MegaKit，CC0，免费 Standard 版 68 个模型；完整 116 模型不是全部免费包。
https://quaternius.com/packs/stylizednaturemegakit.html
本工程优先使用用户提供的树和树屋，未引入该资源包。

## 小涌与小司（第四版）

来自用户此前“制定模拟生活游戏计划”的 `cozy-life-v0.16-source.zip`：

- `models/xiaoyong-animated.glb` → `dist/assets/characters/xiaoyong.glb`，15 段原生动画。
- `models/xiaosi-animated.glb` → `dist/assets/characters/xiaosi.glb`，22 段原生动画。

两个 GLB 逐字节保留源包内容，没有替换人物外观或原始贴图。人物预览 PNG 是实际模型的软件渲染。
人类坐地与脚掌接触在运行时调整；小涌伸展/抱抱提取既有动作的上半身，站姿下半身采用原 idle。
本轮猫咪参考图用于检查眼线、头型与红衣配色，没有打包该参考照片。

- v11 猫车：用户提供 `fantasy+catbus+3d+model.glb`，原始网格及 2K 贴图保留，用于本项目。
- v11 建筑近景：从用户原始日式五重塔、日式神社、日式寺院模型重新制作较高面数版本；原始 512px 贴图保持，旧版本用作远景 LOD。

- v12 樱花树、水晶、僧衣、红袍来自用户上传的 GLB。两份樱花文件 SHA-256 相同，使用一个共享模型；近景保留较多几何细节，远景使用独立简化网格，贴图保持原分辨率。

- v13 `catbus-zzb-face.glb`：从用户提供的脏脏包模型提取中性待机面部，保留原纹理；用于猫车换脸试装。未引入第三方脸部资产。

## v18 古树秘境

- `enchanted+tree+3d+model.glb` → `glade-tree.glb` / `glade-tree-lod.glb`：用户补充的蘑菇奇幻树，近景 179,998 三角面，远景 17,920 三角面。
- `magical+lava+rock+3d+model.glb` → `glade-rock.glb` / `glade-rock-lod.glb`：用户补充的魔法岩石，近景 140,000 三角面，远景 14,000 三角面。
- 两份模型均保留原始 UV 和贴图；采用带 UV 约束的网格简化。溪流、低矮蘑菇与苔石为工程内程序几何。
- 既有 `elder-tree.glb` 为用户提供的棕色古树，保持原始 46,643 三角面。本次调整位置和地形，不裁切树干与树冠。
