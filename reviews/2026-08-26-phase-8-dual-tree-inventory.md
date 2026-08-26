# Phase 8 `pond-gl` / `pond-gl-test3` 双树归宿清单

> 对应综合 Review：`P8-STRUCT-01`。本文件只建立迁移决策地图，不合并、不覆盖、不删除任何仍在运行的树。
> 快照时间：2026-08-26；比较方式：以两棵目录的相对路径与 SHA-256 内容哈希逐文件比较。

## 1. 当前结论

| 项目 | 数量 |
|---|---:|
| `src/components/pond-gl/`（test1 基线） | 41 |
| `src/components/pond-gl-test3/`（test3 当前候选） | 61 |
| 同路径且内容相同 | 12 |
| 同路径但内容不同 | 26 |
| test1 独有 | 3 |
| test3 独有 | 23 |

与 2026-08-25 Review 快照不同的原因：test3 的死 `WaterLevelIndicator` 已删除，新增了独立 `auto-dpr.tsx`，同时 P9/showcase 仍在 test3 树内继续发展。因此迁移时必须重新以本清单为准，不能沿用旧数量，也不能按同名文件整树覆盖。

## 2. 归宿标签

- **T1 基线**：`/test1` 仍在运行的冻结参照；用户拍板迁移前保留。
- **T3 候选**：当前 `/test3` 的 P8 正式候选；只有首页迁移 gate 通过后才可人工移植。
- **路由边界**：行为或存储本来就因 test1/test3 不同，不应抽成一个共享文件。
- **可共享内核**：纯函数、shader 或无产品状态的计算可以在迁移时提取；当前不为整洁提前重构。
- **实验遗留**：只服务旧 spike/旧交互，不进入生产候选。
- **P9 排除**：属于按键动画/showcase，不由本次 P8 清单决定是否上线。

## 3. 26 个同路径分叉文件

| 文件 | 当前归宿 | 差异与迁移说明 |
|---|---|---|
| `decor/FloatingMotes.tsx` | T3 候选／P9 混入 | test3 修正 zoom 下限并接入 key-fx/showcase；迁移 P8 前先决定是否连同 P9 上线，禁止直接覆盖 test1。 |
| `decor/water-petals-sim.ts` | 可共享内核 | test3 新增屏幕坐标注入唯一入口 `petalDropScreen`；可在迁移时成为共享 CPU 波场接口。 |
| `decor/WaterColumns.tsx` | 路由边界 | test1 读有效水位，test3 读固定原始水位；取哪版取决于首页最终采用“升降水面”还是“固定水面、移动球”。 |
| `decor/WaterPetals.tsx` | T3 候选 | test3 使用统一投影/深度、共享 wake-field，并让抠洞贴合视觉球；依赖 L 线与固定水面契约。 |
| `decor/WaterPlants.tsx` | T3 候选／可共享公式 | test3 使用带 `ZOOM_MIN` 的缩放公式；公式可共享，组件归属等首页水位方案。 |
| `gl-flags.ts` | 路由边界 | 两页默认值、公开控制项和 URL 参数不同；生产应新建明确默认，而不是任选一份覆盖。 |
| `overlay/GlEclipse.tsx` | T3 候选／P9 混入 | test3 使用统一投影且接入 key-fx；P8 日蚀与 P9 临时编舞需在迁移前分清。 |
| `overlay/ScenePanel.tsx` | 路由边界 | test1 是完整实验控制台，test3 是当前验收控制台；生产页面不应照搬任一调试面板。 |
| `overlay/SphereOverlay.tsx` | T3 候选 | test3 具备统一投影、R3/L 可见度、幂等拖拽取消与键盘按钮语义；是生产交互候选。 |
| `PondGL.tsx` | T3 候选 | test3 已统一 GL health、R3 分层、L wake、AutoDpr 与 overlay 门控；它是组合入口，但含 P9 消费方，必须人工移植。 |
| `shaders/water-light-glsl.ts` | T3 候选／可共享内核 | test3 使用 R3 `uVisualDim`，删除旧解析球遮罩；生产若采用 R3 应取 test3 契约。 |
| `spheres/gl-sim-setup.ts` | T3 候选 | test3 增加 L 线逐球状态并恢复基于 cluster 的深度分配；不是可安全逐段拼接的同一模型。 |
| `spheres/gl-sim-waves.ts` | T3 候选／可共享内核 | test3 统一 `depthOf` 并补 reduced-motion；物理函数可在注入深度适配器后共享。 |
| `spheres/sphere-motion.ts` | 路由边界／用户 gate | test1 的浮动会改深度并含播放焦点；test3 改为不动深度的投影脉冲。属于产品运动选择，不能由工程侧合并。 |
| `spheres/sphere-shader.ts` | T3 候选 | test3 承载 R3 水上/水下 pass、L 边缘/halo 与颜色契约；采用 R3 时整套迁移，禁止只摘 alpha 行。 |
| `spheres/sphere-tuning.ts` | 路由边界 | test1/test3 使用不同默认值和 localStorage key；生产需要独立迁移策略，不能共享可变 store。 |
| `spheres/SphereInstances.tsx` | T3 候选／P9 混入 | test3 已把逐帧逻辑拆到 `sphere-frame`，接 R3/L/颜色与 key-fx；与 shader/render-passes 必须作为同一闭环迁移。 |
| `spheres/use-gl-sim.ts` | T3 候选 | test3 配合固定水面、统一投影与当前切组行为；迁移前复核首页组切换契约。 |
| `water/ripple-feed.ts` | T3 候选／可共享内核 | test3 的滴水位置经统一投影并可注入 L 激励；事件合并算法可共享，坐标适配保持显式。 |
| `water/spike/ripple-spike-shaders.ts` | 可共享内核 | 当前只剩宽高场说明差异；shader 本体可在下一次正式迁移时收敛为单一来源。 |
| `water/spike/ripple-tuning.ts` | 路由边界 | 两页参数、默认值、迁移键和滚轮模型不同；保持独立，生产再定义权威 store。 |
| `water/spike/RippleSpikePanel.tsx` | 路由边界 | test1 与 test3 暴露的调参项不同；它是沙盒工具，不是生产 UI 候选。 |
| `water/water-distort-setup.ts` | T3 候选／可共享内核 | test3 含 GPU dispose、动态高度场尺寸、R3 uniforms；应随 WaterDistort 整体迁移，之后才评估抽纯工厂。 |
| `water/water-distort-shaders.ts` | T3 候选 | test3 是 R3 真透明与当前亮底/水光契约，且含临时编舞通道；必须与 setup/render-passes 同版本。 |
| `water/water-level.ts` | 路由边界／用户 gate | test1 用滚轮升降水位，test3 固定水面并移动球；这是首页迁移前必须由用户拍板的核心分叉。 |
| `water/WaterDistort.tsx` | T3 候选／P9 混入 | test3 具备动态比例高度场、R3 三 target、GPU cleanup/context 恢复及 key-fx/showcase；生产候选但不可整文件盲拷。 |

## 4. 两树独有文件

### 4.1 test1 独有（3）

| 文件 | 归宿 | 说明 |
|---|---|---|
| `GlAmbientRipples.tsx` | 实验遗留／T1 基线 | test1 的随机环境涟漪 spawner；test3 已由共享 wake-field/当前编舞接管，不默认迁移。 |
| `overlay/WaterLevelIndicator.tsx` | T1 基线／用户 gate | test1 的可变水位才需要；test3 固定水面决定下已确认不需要。 |
| `water/spike/ripple-panel-config.ts` | T1 基线 | test1 调参面板的元数据拆分；若生产不带调试面板则不迁移。 |

### 4.2 test3 独有的 P8 文件（10）

| 文件或目录 | 归宿 | 说明 |
|---|---|---|
| `auto-dpr.tsx` | T3 候选 | 自动降 DPR，并在卸载/context 恢复时回到进入基准。 |
| `life/flow-field.ts` | T3 候选／可共享内核 | L 线解析流场纯计算。 |
| `life/life-core.ts` | T3 候选 | L 线逐帧状态中枢；依赖 test3 节点扩展。 |
| `life/life-tuning.ts` | 路由边界 | test3 专属 `test3-life-v2` store。 |
| `life/LifePanel.tsx` | 路由边界 | 沙盒调参面板，不直接进入生产 UI。 |
| `life/wake-field.ts` | T3 候选 | 花瓣与尾波共享的 refcount 波场；当前还含 P9 事件入口，迁移时拆清边界。 |
| `pointer-fx.ts` | T3 候选 | test3 的滚轮位移、相机效果与 UI wheel 边界单一来源。 |
| `sphere-projection.ts` | T3 候选／可共享内核 | `project/unproject/applyFloat` 的几何契约，可在生产成为单一投影来源。 |
| `spheres/sphere-frame.ts` | T3 候选／P9 混入 | L 线每帧枢纽并采样 key-fx；与 SphereInstances 一起迁移。 |
| `water/composite/render-passes.ts` | T3 候选 | R3 背景/水下球/水上球三 pass 与 renderer 状态恢复的权威实现。 |

### 4.3 test3 独有但属于 P9/showcase（13，排除本次 P8 决策）

- `key-fx/behaviors/dew.ts`
- `key-fx/behaviors/lift.ts`
- `key-fx/behaviors/petals.ts`
- `key-fx/behaviors/relay.ts`
- `key-fx/behaviors/sink.ts`
- `key-fx/behaviors/water.ts`
- `key-fx/key-fx-behaviors.ts`
- `key-fx/key-fx-events.ts`
- `key-fx/key-fx-sphere.ts`
- `key-fx/key-fx-state.ts`
- `key-fx/key-fx-types.ts`
- `showcase/showcase-state.ts`
- `showcase/ShowcaseOverlay.tsx`

这些文件不因位于 `pond-gl-test3` 就自动成为 P8 首页候选。首页迁移时必须单独回答“是否同时上线 P9”；未批准时保留接口边界，但不携带 P9 视觉行为。

## 5. 12 个当前完全相同的文件

### 可优先抽为共享纯内核（5）

- `base-tone-shader.ts`
- `decor/water-columns-shaders.ts`
- `reduced-motion.ts`
- `shaders/pond-floor-shaders.ts`
- `water/ripple-shaders.ts`

### 先保持双树、迁移时再决定组件所有权（6）

- `BgImage.tsx`
- `overlay/GlLoading.tsx`
- `overlay/GlNav.tsx`
- `overlay/TunePanel.tsx`
- `water/use-ripple-fbo.ts`
- `water/WaterSurface.tsx`

### 实验遗留（1）

- `water/spike/RttSpike.tsx`：只用于 RTT 风险验证，不进入生产候选。

“当前相同”不代表以后会自动同步；在正式建立共享目录前，两份仍是独立文件。

## 6. 首页迁移时的执行顺序

1. 用户先拍板：固定水面还是升降水面、test3 脉冲还是 test1 深度浮动、是否同时上线 P9。
2. 新建明确的生产所有者，禁止用 test3 整树覆盖 test1，也禁止反向 mass copy。
3. 先迁移可共享纯内核，再迁移 R3 闭环：`sphere-shader` + `SphereInstances/sphere-frame` + `render-passes` + `WaterDistort/setup/shaders`。
4. 再迁移统一投影、DOM 命中、GL health、AutoDpr、reduced-motion 与 L 线；每组独立做浏览器回归。
5. 最后定义生产 flags/default/storage，不携带沙盒调参面板和 spike。
6. 生产首页验收稳定后，用户另行批准哪棵沙盒树归档或删除；本清单不授权删除。

## 7. 本清单关闭的风险

- 每个同路径分叉文件都有明确用途与候选归宿，不再以“同名”推断可覆盖。
- `/test1` 继续作为旧 GL 基线，`/test3` 继续作为 P8-L/R3 当前验收页。
- P9/showcase 已显式隔离，不会被 P8 首页迁移顺手上线。
- 尚未关闭的仍是用户 gate：真实浏览器回归、R3/L 最终目验、首页水位/运动/P9 去留。
