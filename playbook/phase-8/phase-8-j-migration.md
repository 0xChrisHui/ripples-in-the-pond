# P8-J — J 线 · GL 替换 SVG 首页（生产化迁移）

> **属 Phase-8-G 伞下的「另立 track」**（I 线收口线预告：搬上首页 = 更远将来、另立 track）。红线 / 编号系统 / 执行模式见总文档 [`phase-8-g.md`](./phase-8-g.md)；H 线见 [`phase-8-h.md`](./phase-8-h.md)、I 线见 [`phase-8-i.md`](./phase-8-i.md)。
> **commit scope**：`feat(p8-j): J1 …`；结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
> **本文档依据**：2026-06-16 一次并行代码审计落实（各步附「审计实况」file:line）。审计 J1 那路 agent 卡在 StructuredOutput 重试循环被中止，J1 现状由主会话直接核 `PondGL.tsx` 补；critic（漏网坑）那步未跑完，「迁移坑清单」由主会话补。

## 总则

**目标**：把 `/test1` 的 GL 水塘做到「生产级靠谱」，最终替换现役 SVG 首页 `/`。

**红线**
- GL 没换稳、没验证过之前，**SVG 是现役首页，不删、不停**。删 SVG 是整条迁移的**最后一步**（J8）。
- 只动 GL 沙盒侧（`src/components/pond-gl/` + `app/test1/`），**不碰共享 SVG 水塘**（`/` 与 `/test` 零变化）。
- 共享代码 `sphere-config`（GROUPS / computeNodeAttrs / 力参数）**GL 还在 import**，弃 SVG 时**不删**。

**顺序**：先把沙盒做「靠谱」（**J1–J4，本期要做**）→ deferred（已铸造记号 / 生产化 / 定稿 / 正式替换）等沙盒做厚再推。

**执行模式**：每步一闭环，**⏸ 末尾停等浏览器验收**。

---

## 本期要做（J1–J4）

### J1 — WebGL 兜底 + 画面中途崩了自愈　✅ 已完成（commit `4abc882` + 修复 `967b66a`）

> **审计实况（主会话核 PondGL）**：`PondGL.tsx` 的 `GLErrorBoundary` 原在 WebGL 失败 / 渲染抛错时渲染 **null**（= 空），无 context lost / restore 处理。
> **实现实况**：① `isWebGLAvailable()`（挪进 `gl-flags`、无 three 依赖 → page 可廉价调用门控 overlay）检测，**真没 WebGL → 不挂 Canvas、渲 `GlFallback` 夜塘**（纯 CSS 径向渐晕，色值对齐 base-tone deep/black）；② `GLErrorBoundary` fallback `null` → `GlFallback`；③ `onCreated` 挂 `webglcontextlost`(preventDefault + 盖兜底)/`restored`(撤兜底)。page 用 `glOk = isWebGLAvailable() && !forceFallback` 门控 GL 球 DOM 叠层（兜底时隐，免浮空标题）。新增 `forceFallback` flag + ScenePanel「强制兜底」开关（免手动禁 WebGL 验收）。
> **验收踩坑（已修 `967b66a`）**：切「GL 球」/「强制兜底」会**重挂整个 Canvas** → 每次漏一个 WebGL context（累积被浏览器丢弃 → 球闪一下就没、再切不回）。修：forceFallback 改盖 overlay 不卸 Canvas；去掉 glSpheres 的 Canvas key 重挂（AA 固定开 + camera manual 固定）→ **Canvas 全程只挂一次**，切球只挂/卸 SphereInstances mesh。

- 📦 范围：`PondGL.tsx` 错误边界 + 一个兜底视觉 + R3F `onContextLost`/restore。
- 做什么：① 检测 WebGL 不可用 → 渲染**兜底**（静态水塘图 / 极简 CSS 夜塘，不白屏）；② `GLErrorBoundary` 的 fallback 从 `null` 改成兜底；③ 接 WebGL context lost（GPU 重置）→ 尝试恢复，恢复不了退兜底。
- 验收（⏸）：禁用 WebGL（浏览器 flag / 模拟）打开 → 看到兜底而非空白；强制丢 context → 能恢复或退兜底。

### J2 — 手机能用 + 改窗口/转屏不错位　✅ 代码完成（resize 已验 `723419a` / 触控 `911b702` 待真机验）

> **实现实况**：
> - **① resize/转屏对齐**（`723419a`，**桌面已验**）：`SphereInstances` 相机改每帧跟随 `sizeRef`（变了才重配像素相机，不再 useEffect 冻结）；`use-gl-sim` 加 `resize`/`orientationchange` 监听 → 更新 `sizeRef` + `resizeGlSim`（等比缩放节点位置 **+ cluster 锚点**，否则 cluster 力把球拉回旧 px）+ 更新中心力/边界 clamp；`setupGlSimulation` 返回 anchors。撞 220 行 → `BgWave`/`pushGlSpheresByWaves` 拆到 `gl-sim-waves.ts`。
> - **② 触控**（`911b702`，**待真机验**——用户设备是触控板非触屏，挂 push 后手机验）：`useWaterLevelControl` 加双指捏合控水位（拉开升/捏拢降，仅双指 preventDefault 拦缩放）；触控拖/点本就走 `SphereOverlay` 的 pointer 事件 + 命中 div `touchAction:none`。
> - **移动响应式默认**：当前 GL 默认已轻（基调+球、水面默认关），按屏档调默认值挂 **J3/真机压测** 一起定。

> **审计实况**：GL 尺寸只在「建 sim」那刻冻结、之后不更新——`use-gl-sim.ts:106-107` 写 `sizeRef={w,h}`，该 effect deps `[active,tracks,groupId]`（:115），window 尺寸**不在依赖** → 纯 resize/转屏不重建；相机像素对齐 `SphereInstances.tsx:163-167` 也只在 nodes 变时跑。**全树无 resize 监听 → 拉窗口/转屏后 GL 球与 DOM 命中层错位（确认 bug，不只手机）**。无触控 pinch（水位只 wheel，`water-level.ts` `useWaterLevelControl` 仅监听 wheel）。SVG 侧 `use-responsive-effects.ts` 按屏宽给桌面/手机不同默认 effect 集。

- 📦 范围：resize 重适配（`use-gl-sim` sizeRef + `SphereInstances` 相机 + `WaterDistort` viewport）+ 移动响应默认 + pinch 水位 + 触控复核。
- 做什么：① 加 `resize`/`orientationchange` 监听 → 重算 sizeRef + 相机 frustum + sim 边界（**这条电脑拉窗口也受益**）；② 移动端响应式默认（参考 `use-responsive-effects` 断点思路，手机精简层 + 默认水位/球数）；③ pinch 手势驱动水位（对标 wheel）；④ 触控 down/move/up 复核（`SphereOverlay` 已用 pointer events，验证拖/点/捏不打架）+ DPR/分辨率移动降级（并入 J3）。
- 验收（⏸）：拉窗口/转屏 → 球与点击位置始终对齐；手机上能点/拖/捏缩水位、不卡。

### J3 — 卡了自动降配 ⏸

> **审计实况**：GL 侧**无任何自动降配**，只有只读 FPS 显示——`PerfHUD.tsx` 用 rAF 算滚动 FPS + 最长帧，纯展示、`pointer-events:none`、**从不回写渲染参数**。DPR 写死 `PondGL.tsx:79 dpr={[1,2]}`（R3F 初始 prop、不热更新）；水面高度场 `RES=256` 写死（`WaterDistort`）。SVG 侧 `use-adaptive-effects.ts` 在 FPS 持续低时自动关贵 effect。

- 📦 范围：GL 版「低 FPS 自动降配」控制环 + 可运行时调的降配旋钮（DPR / 水面 RES / 重 effect 开关）。
- 做什么：① 复用 `PerfHUD` 的 FPS 测量，加**反馈回路**：持续低 FPS → 逐级降配（先降 DPR → 降/关水面扭曲 RES → 关浮沉/微波…）；② 把写死的 DPR、RES 改成**可运行时调**（`setDpr` / RES 作为可变）；③ 降配策略对标 `use-adaptive-effects`（只降不回升 vs 允许回升，实施时定）。
- 验收（⏸）：人为压低帧（throttle）→ 画质自动降、帧率回升；解除 → 行为符合策略。

### J4 — 加载提示 + 失败重试 + 提前缓冲 ⏸

> **审计实况**：GL **完全无**加载态/失败/重试/预热——`use-gl-sim.ts:59-67` `fetch('/api/tracks').then(setTracks).catch(console.error)`；失败只 console.error 无 UI（:65），且**不判 `res.ok`**（HTTP 500/404 也进 then，与 `Archipelago.tsx:39` `if(!res.ok)throw` 不同）。SVG 侧 `Archipelago` 有 `LoadingState`（"正在唤醒群岛"）+ 慢网提示（3s）+ 重试（8s）+ 6-worker 音频预热。

- 📦 范围：`use-gl-sim` 取数加 loading/error/retry 状态 + GL 页加载/失败 UI + 音频预热。
- 做什么：① `use-gl-sim` 加 `res.ok` 判定 + loading/error state + `retry()`；② GL 页加载态（取数中给提示，别黑屏蹦球）+ 失败态（"加载失败，点击重试"）；③ 移植 `Archipelago` 的音频预热（对当前组前 N 首拉前 300KB）。
- 验收（⏸）：正常 → 有加载提示；断网/500 → 显示失败 + 重试可恢复；点播放更跟手（预热生效）。

---

## Deferred（记录在案，本期不做）

- **已铸造记号**（原 M4）：GL 全树无 minted 概念（`use-gl-sim` 不调 `fetchMyNFTs`、`GlPhysNode` 无 minted 字段、`SphereInstances`/`SphereOverlay` 不显示）。播放/铸造**动作**走全局 `PlayerProvider`（两页共享、GL 已能用），缺的是球上「已铸造」**视觉**。补法：`useGlSim` 取 `fetchMyNFTs`→mintedIds，球上加标识。
- **生产化清理**（原 M6）：/test1 dev chrome **全无条件渲染、无 NODE_ENV 门控**（pond-gl 全树 grep `NODE_ENV/process.env` 零命中）。要清：剥/门控调试面板（ScenePanel/TunePanel/RippleSpikePanel/遮罩/RTT）、GL flags 生产默认、标题 sandbox 后缀（`app/test1/page.tsx:53-55`）、noindex（layout）、`ssr:false` 首屏空白/SEO。
- **手感/视觉定稿**（原 M7）：日蚀/水面/浮沉默认值 + 真机帧率压测。
- **正式替换 + 删旧**（原 M8 = J 线收官）：`/` 换 GL（留 flag/URL 可回退 SVG）→ 验证 → 才删 SVG-only（`SphereCanvas`/`SphereNode`/`EclipseLayer`/`effects-config`/氛围层…）；**共享 `sphere-config` 不删**。
- **I3 新组件首批**：仍 ⏸ 待用户定（鱼/贴图/动效）。

## 迁移坑清单（主会话补，审计 critic 未跑完）

- **滚轮语义冲突**：GL 滚轮 = 水位（`water-level.ts` `useWaterLevelControl`），SVG 滚轮 = 缩放（`archipelago/hooks/use-sphere-zoom.ts`）。首页换 GL 后滚轮含义变，要拍板（保留缩放？水位？二选一/组合）。
- **共享代码边界**：删 SVG 时 `sphere-config` GL 在 import，留；只删 SVG-only。
- **键盘并存**：迁移期 GL（`useGlSim` ←→ 切组）与 SVG（`Archipelago` ←→）若同挂会双触发——首页只挂一套即可（I1 已在 /test1 卸 SVG 时顺带消除）。
- **/test 的 patatap**（`SvgAnimationLayer`）与水塘无关，不动。
- **SEO/分享**：首页 metadata/OG 卡；GL `ssr:false` 首屏空 → 配 J6 一起。
- **a11y**：GL（canvas + DOM overlay）可访问性弱于 SVG，迁移时评估键盘可达/aria。

## 收口线

**J1–J4 ✅ = GL 沙盒「生产级靠谱」**；deferred（已铸造 / 生产化 / 定稿 / 替换）按需推进；**`/` 正式替换 + 删 SVG = J 线（及 Phase-8-G）真正收官**。
