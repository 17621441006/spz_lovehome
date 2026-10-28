# 脏脏包 · 风与森林

一个以脏脏包、小涌和小司为主角的 Three.js 森林探索游戏。当前源码对应 v18（2026-10-28）。

## 本地运行

安装 Python 3，在项目目录运行：

```bash
python restore_assets.py
python -m http.server 8642 --directory dist
```

打开 http://localhost:8642/ 。Windows 也可双击 `start.bat`，macOS / Linux 可执行 `./start.sh`。需要支持 WebGL 2 的浏览器和可用的图形加速；不要直接双击 HTML 文件。游戏运行无需 npm，模型、音效和 Three.js 都随仓库提供。

两个较大的模型（猫车、水晶）使用无损 gzip 打包在 `packed-assets/`；`restore_assets.py` 会校验并还原与线上版本逐字节相同的 GLB。启动脚本自动完成还原。直接部署 `dist/` 前也请先运行还原脚本。

## 操作

- WASD / 方向键移动，Shift 跑步，空格跳跃；手机显示触控摇杆。
- 点击画面后移动鼠标转动镜头；Esc 释放鼠标，滚轮调整距离。
- C / X 坐下，移动起身；停留约 7 秒也会自动坐下。
- E 打招呼；靠近猫车时开启乘车对话，乘车后可请求停稳下车。
- J / K 使用角色动作。脏脏包是两种踢腿，动作中再按一次可衔接下一次。
- B 打开行囊，装备折扇或切换衣服。移动时折扇合起，站定后展开。
- 主页或「换角色」选择主角，其余角色在地图中自主活动。
- 「天气」切换晴天、雨雪、昼夜；「操作说明」查看控制方式。
- 「配乐」调整音量，也能选择本地音频；本地文件不上传，刷新后需重选。
- 地址末尾加 `?q=low` 使用低画质；加 `?q=high` 使用高画质。

## v18 更新

- 撤回 v17 的头部裁切和拉长胸口，保留原始头部、下巴的全部三角面。内衬退到胸毛后方，肩袖增加封闭端面与同色连接；坐下时保持躯干正直、降低骨盆并让脚掌接地。
- 西侧古树移至 `(-28, 0)`，完整树根下方整平半径 10.5 米，外围平滑接回山坡。古树高度约 44 米，保持普通高树三倍以上。
- 树旁加入流动浅溪、苔石、蘑菇，以及用户补充的奇幻树与魔法岩石。近景分别保留约 18 万 / 14 万三角面、原始贴图；低细节模型先加载，靠近后再加载细节。
- 猫车使用东南侧固定椭圆环线，预留整个车身的通行走廊；巡游约 2.33 米/秒，不再随机换路线和每圈停顿，保留平滑起停与乘车镜头。
- 小涌步行从 1.25 提至 2.5 米/秒，奔跑从 2.3 提至 9.2 米/秒。步频同步调整，修复跑步末帧回到初始站姿的跳帧，并保留相位衔接。

## 源码目录

- `dist/index.html`：界面与样式。
- `dist/src/main.js`：游戏循环、输入、移动和相机。
- `dist/src/modelcat.js`、`rig-repair.js`、`cat-appearance.js`、`garment-detail.js`：脏脏包动作与外形修复。
- `dist/src/human-character.js`、`characters.js`：人类角色与角色切换。
- `dist/src/terrain.js`、`dream.js`、`elder-tree.js`：地形、场景与古树秘境。
- `dist/src/catbus.js`：固定巡游、车身避障与乘降。
- `dist/src/asset-stream.js`：分阶段加载和近景细节队列。
- `dist/assets/`：游戏使用的模型、贴图、加载壁纸和音效。
- `dist/vendor/`：本地 Three.js 和加载器。
- `scripts/`：模型处理与回归检查。
- `ASSET_CREDITS.md`：素材来源和授权说明。

## 开发与检查

```bash
python restore_assets.py
npm ci
npm run check
node scripts/cat18-check.mjs
node scripts/pose-check.mjs
node scripts/human-motion-check.mjs
node scripts/glade18-check.mjs
node scripts/catbus-check.mjs
node scripts/main-boot-check.mjs
```

数值检查使用真实几何、骨骼与动画，替换浏览器图片 IO 和渲染器。v18 已检查原始下巴网格、双肩闭合、坐姿接地、步频与动画循环、地形根部支撑、三分钟猫车巡游及主流程初始化。另做了角色和新增模型的 CPU 离线渲染。当前开发环境无法创建 WebGL 上下文，实时 GPU 画面、帧率和操作手感仍需在支持 WebGL 的设备测试。

模型源文件由用户提供，授权归原权利人；仓库提供源码不代表第三方或用户模型被重新授权。工程默认使用原创森林配乐，没有打包电影原声。

线上源码版本：`c17e263bb7cabc302c3f7e1da3242508467883a6`。本仓库仅额外加入大模型无损打包与自动还原步骤；游戏逻辑与运行素材一致。
