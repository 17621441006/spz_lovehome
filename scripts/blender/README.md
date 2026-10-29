# 灯尾茸 Blender 制作流程

模型实际通过本机 Blender 5.2.1 LTS 的 Blender MCP 分阶段建模、绑定、渲染和导出，没有使用外部模型生成服务。

`build_dengweirong.py` 是完整入口。在新 Blender 会话执行它，会依次调用同目录的 `refine_dengweirong.py`（叶耳、爪掌与定向叶毛）、`paint_dengweirong.py`（顶点色）、`rig_dengweirong.py`（骨骼、动作与导出）、`render_dengweirong.py`（实模三视角与透明头像）。所有阶段都已通过实际 Blender MCP 执行；完整入口拒绝覆盖任何现存的 DWR 对象或专用场景。

入口的 `OUT` 和 `ASSET` 指向本次任务的 outputs 与项目 dist/assets/creatures；换工作目录时先修改这两项。模型在独立 Scene/Collection 中创建，不操作原场景 Cube/Camera/Light。保存通过 `bpy.data.libraries.write` 写出独立 `.blend`，只包含新场景及四个 Action，不修改用户当前主文件路径，也不触碰游戏人物 GLB。

导出是 Three.js 的 +Y 向上、+Z 朝前，原比例约 1.1 米宽、1.23 米高（含叶耳/卷尾），实体主头顶约 0.92 米。使用顶点色和标准 glTF PBR，无外部纹理，不使用 transmission；没有 Draco 依赖。

运行时接口：

- `DWR_Root`、`DWR_Rig`，10 根骨骼。
- 身体 `DWR_Body`，头 `DWR_Head`，叶耳 `DWR_Ear_L/R`，尾巴 `DWR_Tail`。
- 四足 `DWR_Foot_FL/FR/BL/BR`，连续主体的足端主要权重 >0.9；抬爪动作时不可强制把前爪锁回地面。
- 灯位 `DWR_Lantern` 是尾骨子骨，可直接读取世界坐标；外壳材质位于 `DWR_LanternMesh`，芯位于 `DWR_LanternCore`。
- `DWR_Eye_L/R` 各有 `Blink` 形态键，默认 0、闭眼 1。
- `idle` 4 秒、`walk` 1 秒、`greet` 2.4 秒、`sniff` 3.2 秒。无身体缩放动画。
- 步行参考速度 0.35m/s；FL+BR 在相位 0–0.45 抬步，FR+BL 在 0.5–0.95 抬步；着地阶段脚掌沿后方匀速回移。运行时应按速度同步 timeScale。

`outputs/dengweirong-model-report.json` 记录 Blender 版本、面数、动作和原场景保留证据。最终 PNG 是真实 Blender 渲染；384px 透明头像同时复制到 `dist/assets/creatures/dengweirong-portrait.png`。
