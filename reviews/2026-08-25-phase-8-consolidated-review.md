# Review 2026-08-25 — Phase 8 综合审查与修复交接

> 用途：交给新的独立进程，按本文逐项修复 Phase 8。
> 本文只管 P8（水塘视觉重设计），不负责其他 Phase、媒体资产整理、工作区切分或 commit。

## 0. 审查说明

**审查来源**：

1. Trae Work / Kimi K3 的 `reviews/2026-08-25-phase-8-review.md`；
2. Codex 对当前 P8 工作区的运行时、交互、GPU 生命周期与文档契约审查；
3. 2026-08-25 对关键结论的二次静态交叉验证；
4. `bash scripts/verify.sh` 的完整验证结果。

**当前基线**：

- `/test3` 是 P8-L 与真透明 R3 的当前验收沙盒；
- `/test4` 只是复用 `/test3` 的兼容入口；
- 生产首页 `/` 仍使用 SVG `Archipelago`，GL 水塘尚未迁移；
- L 线 10 项生命感中，除 `jelly` 外默认开启；
- R3 自动复验已通过，仍等待用户最终视觉验收；
- 当前工作区包含其他 Phase 的并行修改，修复进程只能碰本文明确列出的 P8 范围。

**自动验证结果**：

- TypeScript：通过；
- ESLint：通过，只有 3 条既有 warning；
- 文件与目录硬线：通过；
- 危险模式扫描：通过；
- Next.js 生产构建：通过；
- Forge：42/42 通过；
- `/test3`、`/test4`：运行时 HTTP 200。

**整体判断**：⚠️ **有警告，不可宣布 P8 完结，也不应立即迁移首页。**

- 未发现 P0 级安全、数据损坏或生产故障；
- 有 3 个应先修的 P1 运行时问题；
- 有 7 个 P2 交互、可访问性、结构与契约问题；
- 自动检查全绿不代表运行时资源、旋转适配和视觉 gate 已通过；
- “首页仍是 SVG”是冻结中的产品决策，不应被修复进程擅自当成 bug。

---

## 1. 本轮严格范围

### 1.1 可以处理

- `app/test1/`、`app/test2/`、`app/test3/`、`app/test4/` 中与 P8 GL 水塘直接相关的代码；
- `src/components/pond-gl/`；
- `src/components/pond-gl-test3/`，但不扩展 P9 `key-fx` 功能；
- `playbook/phase-8/`；
- `STATUS.md`、`TASKS.md`、`docs/JOURNAL.md` 中仅与 P8 当前状态直接相关的段落；
- 为本次 P8 修复新增的、无需新依赖的最小回归验证。

### 1.2 明确排除

- P9 按键声音与 `key-fx` 编舞；
- P10、P12、P13、P14、P15 的定义、排序或文档冲突；
- `TestJam` 生产依赖沙盒 `key-fx` 的归宿；该问题属于 P9/生产整合，不在本进程处理；
- `public/sounds/`、`public/1-35 Shorts/` 等媒体策略；
- auth、community、SemiLogin、合约、API、数据库、部署；
- 工作区切分、暂存、commit、push；用户会开独立进程处理；
- 未经用户拍板把 GL 水塘替换到生产首页；
- R4 或新的透明遮罩/亮度补丁。R3 失败必须执行既定止损线。

### 1.3 执行护栏

- 开始每项修复前重新读取当前文件，不能用历史版本覆盖并行修改；
- 一次只修本文中的一个问题编号，验证通过后再进入下一项；
- 禁止 `git add .`、清理工作区、重置或顺手提交；
- 不新增依赖，不改 `docs/ARCHITECTURE.md` / `docs/STACK.md`；
- 多个目标文件已接近行数硬线，新增逻辑前应先抽取 helper，不能申请放宽；
- 每个闭环执行 `bash scripts/verify.sh`；失败立即停，不通过改相邻文件救火。

---

## 2. P1 — 必须先修的运行时问题

### P8-RUN-01：`WaterDistort` 手工创建的 GPU 资源没有释放

**证据**：

- `src/components/pond-gl-test3/water/WaterDistort.tsx:98-104` 用 `useMemo` 创建 sim/composite 场景；
- `src/components/pond-gl-test3/water/water-distort-setup.ts:32-36` 手工创建两个 `ShaderMaterial` 与两个 `PlaneGeometry`；
- 当前没有对应的 unmount cleanup；
- ScenePanel 可以反复开关 `waterFx`，组件每次重挂都会重新创建这些 GPU 资源。

**影响**：

- 连续开关水面或调试时，geometry/material 计数可能持续增长；
- 长会话可能出现显存增长、卡顿，甚至 WebGL context 被浏览器回收；
- 违反真透明 playbook A6“切 flag 不持续增长 GPU 资源”的验收要求。

**修复边界**：

- 只释放 `makeQuadScene` 手工创建并由当前组件独占的 geometry/material；
- 不要误释放由 R3F、`useFBO` 或外部组件管理的共享纹理；
- cleanup 必须覆盖组件卸载与依赖导致的资源重建；
- 如果工厂无法定位 geometry，应让 `QuadScene` 明确持有可释放资源，或提供单一 `disposeQuadScene` helper。

**验收**：

- `waterFx` 连续开关至少 20 次，`renderer.info.memory.geometries` 与 program/material 相关资源不随次数单调增长；
- 关闭再开启后水面、球层级与 R3 合成保持正常；
- context 数量不增长；
- `scripts/verify.sh` 通过。

---

### P8-RUN-02：GL fallback 健康状态没有同步给 DOM 交互层

**证据**：

- `src/components/pond-gl-test3/PondGL.tsx:49-61` 的错误边界只在组件内部渲染 fallback，没有向父页面上报失败；
- `src/components/pond-gl-test3/PondGL.tsx:120-133` 知道 context lost 与 `forceFallback`；
- `app/test3/page.tsx:36-49` 的 `glOk` 只看初始 WebGL 检测与 `forceFallback`；
- `app/test3/page.tsx:74-95` 继续依据 `glOk` 挂载 GlNav、SphereOverlay、GlEclipse。

**影响**：

- WebGL context 丢失或 Canvas 渲染崩溃后，画面已经是 fallback，但透明 DOM 球命中层可能仍可点击、拖拽或播放；
- 用户会遇到“看不见球却能点到东西”、导航仍工作、日蚀浮在兜底背景上的状态分裂。

**修复边界**：

- 建立唯一的 GL health 状态，至少覆盖：不可用、正常、context lost、错误边界失败、force fallback；
- 将健康状态上抬给 `/test3`，或让所有 GL 相关 DOM overlay 共享同一来源；
- context restored 后必须恢复交互层；
- 不要通过卸载/重挂 Canvas 解决，现有代码已记录重挂导致 context/球状态问题。

**验收**：

- `forceFallback=true` 时 GL 导航、球命中层、日蚀和 GL loading 全部隐藏；
- 人工触发 `WEBGL_lose_context` 后立即进入同样状态；
- context restore 后画面与命中层一起恢复；
- 主动制造 Canvas 子树异常时，不存在 fallback 上的隐形点击区；
- 播放状态与球位置不因健康状态切换被无故重置。

---

### P8-RUN-03：屏幕旋转/resize 后高度场比例不更新，圆形涟漪会变椭圆

**证据**：

- `src/components/pond-gl-test3/water/WaterDistort.tsx:39-42` 在模块加载时用 `window.innerWidth / innerHeight` 计算一次 `RES_X`；
- `src/components/pond-gl-test3/water/WaterDistort.tsx:86-87` 高度场 FBO 始终使用固定的 `RES_X × RES_Y`；
- 模块不会因为横竖屏切换而重新加载；
- 代码注释本身要求“格子在屏幕上是正方形，涟漪传播天然正圆”，resize 后这个前提不再成立。

**影响**：

- 手机横竖屏切换、桌面窗口改变宽高比后，传播网格与屏幕比例失配；
- 滴水注入即使有 `uAspect` 校正，后续高度场传播仍可能被拉伸；
- `/test3` 不重新刷新就无法恢复正确比例。

**修复边界**：

- 分辨率应从 R3F 当前 canvas size 派生，而不是模块级 `window` 常量；
- 比例变化时同步更新 FBO 尺寸、`uDelta` 与相关 composite uniform；
- resize 后清空或安全重建高度场，不能把旧尺寸内容当新尺寸继续传播；
- 仍保留最大纹理尺寸和极端比例 clamp。

**验收**：

- 桌面从宽屏拖到窄屏，再拖回宽屏，中心点击涟漪始终为圆；
- 手机 portrait → landscape → portrait，无需刷新且涟漪不椭圆；
- resize 后无旧帧拉伸、黑帧、闪白或水面停住；
- AutoDpr 升降与 resize 同时发生时，两张高度 target 尺寸与 uniform 一致。

---

## 3. P2 — P1 后逐项修复

### P8-INT-01：全局 wheel 监听劫持参数面板滚动

**证据**：

- `src/components/pond-gl-test3/pointer-fx.ts:85-95` 把非 passive wheel 监听挂在 `window`；
- 一点透视开启时，无条件 `preventDefault()`；
- `src/components/pond-gl-test3/life/LifePanel.tsx:118` 的面板使用 `max-h-[55vh] overflow-y-auto`。

**影响**：鼠标位于 LifePanel、TunePanel 或 RippleSpikePanel 上时，滚轮不能正常滚动参数列表，反而改变球体深度。

**修复边界**：

- 视觉区域滚轮继续控制水位/球深度；
- 交互控件、滚动容器和明确标记的 UI 区域必须保留原生滚动；
- 不应靠关闭 perspective 绕过；
- 推荐使用统一的 `data-*` 交互边界或可靠的 `closest()` 判定，避免列举每一个面板类名。

**验收**：

- 光标在三个参数面板上滚动，只滚面板，不改变球深度；
- 光标在水塘视觉区域滚动，仍按当前速度模型移动球；
- trackpad、小 delta 与大 delta 行为一致；
- 移动端触摸不受影响。

---

### P8-A11Y-01：`prefers-reduced-motion` 仍遗漏两条自动运动路径

**证据**：

- `playbook/phase-8/95-l-life-sense.md:28` 要求 reduced-motion 下所有无序项归零/冻结；
- `src/components/pond-gl-test3/spheres/sphere-frame.ts:80` 调用 `driftSpheres` 时没有 reduced-motion 门控；
- `src/components/pond-gl-test3/spheres/gl-sim-waves.ts:19-29` 的自动随机游走没有门控；
- `src/components/pond-gl-test3/life/life-core.ts:84-100` 的 `stepParallax` 没有 reduced-motion 门控；
- 其他生命感路径已经部分正确处理该偏好，说明这两处是漏网而非产品例外。

**影响**：系统开启“减少动态效果”后，球仍会自动漂移，鼠标视差个体差仍生效，与 P8-L 契约不一致。

**修复边界**：

- 只冻结自动、无序、非用户必要的运动；
- 点击播放、明确拖拽、必要的即时交互反馈是否保留，应沿用现有 playbook 语义；
- 关闭效果时要平滑归中，不能突然跳位。

**验收**：

- DevTools 模拟 reduced-motion 后，随机漂移、流场、视差去同步、颤动、隐现与呼吸全部停止或回中；
- hover、点击播放、拖拽仍可用；
- 切回 no-preference 后不跳位、不瞬间爆发积累速度。

---

### P8-PERF-01：关闭 AutoDpr 不会恢复进入组件前的 DPR

**证据**：

- `src/components/pond-gl-test3/PondGL.tsx:75-100` 会动态调用 `setDpr()`；
- `src/components/pond-gl-test3/PondGL.tsx:176` 通过条件挂载关闭 AutoDpr；
- `AutoDpr` 没有 unmount cleanup 恢复初始 DPR。

**影响**：如果先降到 DPR 1，再关闭 AutoDpr，Canvas 会继续停在低清 DPR；重新开启时低 DPR 还可能被当作新的上限。

**修复边界**：

- 挂载时捕获 Canvas 当前的基准 DPR；
- 卸载时恢复该基准值，同时清理内部计数；
- 遵守 Canvas 的 `[1,2]` cap，不直接使用无限制的 `window.devicePixelRatio`；
- context restore 后状态仍正确。

**验收**：

- 人工让 AutoDpr 降档后关闭开关，画质与 DPR 恢复到进入组件前的值；
- 再次开启仍以正确上限升降；
- 连续切换不产生 DPR 漂移或 FBO 尺寸错配。

---

### P8-INT-02：球拖拽缺少取消收尾，且键盘无法播放

**证据**：

- `src/components/pond-gl-test3/overlay/SphereOverlay.tsx:104-130` 只处理 pointer down/move/up；
- 没有 `pointercancel`、`lostpointercapture` 收尾；
- `src/components/pond-gl-test3/overlay/SphereOverlay.tsx:132-149` 使用普通 `div`，没有 button 语义、tabIndex 或键盘处理。

**影响**：

- 系统手势、来电、窗口切换或触摸取消可能让 `node.fx/fy` 保持锁定、simulation `alphaTarget` 保持升温；
- 只能用鼠标/触摸播放球，键盘用户无法操作。

**修复边界**：

- 抽出幂等的拖拽结束/取消函数；
- up、cancel、lost capture、组件卸载都必须释放 node 锁与 sim 热度；
- Enter/Space 应复用与点击相同的播放逻辑；
- 保持现有 DOM 命中层与 GL 渲染层分离，不把命中改回 Three raycaster。

**验收**：

- 拖拽中触发 pointercancel 后球不再黏住；
- lost pointer capture 后 `fx/fy` 释放，simulation 回到正常 alphaTarget；
- Tab 可聚焦球，Enter/Space 可播放/暂停；
- 微位移仍算点击，超过阈值仍算拖拽。

---

### P8-STRUCT-01：`pond-gl` 与 `pond-gl-test3` 双树已经实质分叉

**交叉验证结果**：

- `pond-gl/`：41 个文件；
- `pond-gl-test3/`：59 个文件；
- 同路径文件：39 个；
- 内容完全相同：13 个；
- 同路径但内容不同：26 个；
- `pond-gl` 独有：2 个；
- `pond-gl-test3` 独有：20 个。

**影响**：

- 同一个 bug 可能只修一棵树；
- 首页迁移时无法简单判断复制哪一版；
- 两棵 `WaterPlants` 等同名文件已经分叉，机械覆盖会丢功能或视觉定稿。

**修复边界**：

- 本轮不要“为了整洁”批量同步或删除任何一棵树；
- 先生成 26 个分叉文件的用途清单，标记：test1 基线、test3 正式候选、可共享纯函数、实验遗留；
- 当前 P1/P2 bug 若只存在 test3，先只修 test3；如果两条运行路径都命中，再分别验证；
- 只有用户决定生产迁移方向后，才能拍板主树与淘汰策略。

**验收**：

- 有逐文件归宿清单，不以“同名”推断可覆盖；
- 修复进程没有顺手 mass copy；
- `/test1` 基线与 `/test3` 当前视觉都可单独启动；
- 首页迁移任务可以明确知道每个分叉文件取哪一版。

---

### P8-STRUCT-02：test3 的 `WaterLevelIndicator` 是确认的死文件

**证据**：

- `src/components/pond-gl-test3/overlay/WaterLevelIndicator.tsx` 全仓无 import；
- `app/test3/page.tsx:97` 明确说明水面已固定，因此不挂载该组件；
- `/test1` 和 `/test2` 各自有仍在使用的版本，不能连带删除。

**影响**：保留同名死文件会误导后续迁移者，以为 test3 仍需要水位指示层。

**修复边界**：

- 若“固定水面、不显示指示器”仍是当前产品决定，删除 test3 这一份；
- 不能删除 `/test1` 或 `/test2` 的在用版本；
- 如果用户决定恢复显示，则必须先说明为什么推翻 `app/test3/page.tsx:97` 的现有决定。

**验收**：

- 全仓无悬空引用；
- `/test1`、`/test2`、`/test3` 路由都正常；
- 不增加替代占位文件。

---

### P8-DOC-01：P8 spec 与当前拍板实现多处不一致

**已确认冲突**：

1. `playbook/phase-8/95-l-life-sense.md:25,68,237` 仍写 localStorage key `test3-life`，实现为 `test3-life-v2`；
2. `playbook/phase-8/95-l-life-sense.md:217` 仍写 10 flag 默认全 false，当前实现是 9 开、`jelly` 关；
3. `src/components/pond-gl-test3/gl-flags.ts:49,96-105` 是新默认值，`gl-flags.ts:184` 的注释却仍写默认全 false；
4. `playbook/phase-8/95-l-life-sense.md:194-201` 仍描述 `alphaFlicker` 降低整个球体；R3 新契约是水上主体不吃 lifeDim，只影响 halo；
5. `playbook/phase-8/96-l-true-alpha-composite.md:461-497` 已记录 R3 新契约与止损线，应作为 alphaFlicker 的当前权威；
6. `playbook/phase-8/90-k-visual-deepening.md:101-103` 仍规定 K10 是暗纹、非亮底，但实现与 JOURNAL 已按用户拍板改为亮底混合与多套花纹。

**影响**：新修复进程按旧 spec 工作会把正确的用户拍板实现“修回去”。

**修复边界**：

- 只回写与 P8 当前行为相关的文本；
- 以 STATUS 当前决定、R3 §14 和现有用户拍板记录为准；
- 历史方案可以保留，但必须加“已被哪次决定替代”的明确批注；
- 不借机修改 Phase 13/14/15 排序或 P10 定义。

**验收**：

- 95-l、96-l、gl-flags 对默认值、storage key、alphaFlicker 语义一致；
- 90-k 的 K10 文字与最终实现/JOURNAL 一致；
- 搜索 `test3-life`、`默认全 false`、`暗纹非亮底` 不再得到未标注的现行错误契约；
- 不改变任何运行时默认值。

---

## 4. 已核实但本轮不作为 bug 修复

### 4.1 `rtt` 与 `waterFx`

- 两者都是 priority-1 renderer，不能作为正式组合同时工作；
- 当前默认 `rtt=false`，`PondGL.tsx:110-114` 在开发环境同时开启时已有明确 warning；
- 这符合 `96-l` 的开发 URL 验收口径，因此暂不列为新 bug；
- 修复其他问题时不能删除 warning，也不能把两个 renderer 默默改成可同时覆盖。

### 4.2 首页仍是 SVG

- `playbook/phase-8/00-overview.md:160-167` 的 Phase 8 完结 checkbox 尚未完成；
- 生产首页仍用 `Archipelago`，GL 水塘在 `/test1`、`/test3` 沙盒；
- 这是“P8 尚未正式完结”的事实，不是要求修复进程擅自替换首页；
- 首页迁移必须等待本文问题、浏览器目验和用户去留拍板完成。

### 4.3 256²/固定纵向高度场的画质债

- H6 已记录高折射下的色斑/分辨率 known issue；
- 本轮 P8-RUN-03 必须修“比例不随 resize 更新”的正确性问题；
- 是否整体升级 512²、采用梯度平滑或做移动端性能取舍，仍属于单独的性能/画质决定，不能夹带在 resize 修复里。

### 4.4 自动验证未覆盖浏览器语义

当前 `verify.sh` 无法证明以下事项：

- GPU 资源反复开关不增长；
- context lost/error fallback 与 DOM 命中层同步；
- portrait/landscape 后涟漪仍为圆；
- pointercancel 后拖拽状态释放；
- reduced-motion 全路径生效；
- R3 的最终主观视觉正确。

修复进程应优先使用现有工具补最小回归验证；若没有合适自动化基础，不得为了测试引入新依赖，应把可复现的浏览器步骤写进交付记录。

---

## 5. R3 与 L 线最终验收 gate

### 5.1 R3 自动复验已通过的部分

`playbook/phase-8/96-l-true-alpha-composite.md:489-493` 已记录：

- debug 中水上/水下通道分流正确；
- 完全出水球中心点击时，主体内部无同心圆、亮带或折射位移；
- 浅黄、白、红、橙球无爆白；
- `alphaFlicker` 开启时水上主体仍稳定。

这些结果不能因修复上述 P1/P2 而回归。

### 5.2 仍需用户完成的 R3 目验

- 在 `/test3` 复现既定视频的滚轮浮出 + 点击动作；
- 完全出水球主体内不出现水纹、扫光、爆白或折射位移；
- 水下球继续显示受限水纹；
- 穿越水线只有短促、连续过渡，不长期双层；
- hover、播放、两球重叠、切组、resize/DPR 与 waterFx 开关不回归。

**硬止损**：若真实目验仍失败，不允许追加 R4、全屏 clamp、亮度补丁或新遮罩；必须按 `96-l:497` 回退到真透明前稳定版本并终止该方向。

### 5.3 L 线用户验收

- 10 个生命感 flag 可独立开关；
- 全关时回到 L0a/L0b 基线；
- 当前默认是 9 开、`jelly` 关；
- reduced-motion 下自动无序效果冻结；
- 全开压力测试“活而不乱”；
- 拖拽、hover、播放、花瓣、遮罩、日蚀与命中不回归。

---

## 6. 推荐修复顺序

修复进程必须按小闭环逐项推进，不要把全部问题一次改完：

1. **P8-RUN-01**：GPU geometry/material cleanup；
2. **P8-RUN-02**：统一 GL health 与 DOM overlay；
3. **P8-RUN-03**：resize/旋转时重建正确比例高度场；
4. **P8-INT-01**：参数面板 wheel 边界；
5. **P8-A11Y-01**：补齐 reduced-motion；
6. **P8-PERF-01**：AutoDpr 卸载恢复；
7. **P8-INT-02**：pointercancel/lost capture/键盘操作；
8. **P8-STRUCT-02**：确认并处理 test3 死文件；
9. **P8-DOC-01**：回写 P8 契约；
10. **P8-STRUCT-01**：只做双树归宿清单，不擅自合树；
11. 执行完整浏览器回归矩阵；
12. 交给用户完成 R3 与 L 线最终目验；
13. 用户另行决定首页迁移和 P8 正式完结。

前三项是本轮真正的阻塞修复。第 10 项是生产迁移前置，但不是要求当前进程立即重构两棵树。

---

## 7. 每项修复的统一交付格式

新的修复进程每完成一个编号，应记录：

```markdown
### 完成：P8-XXX-00

- 根因：
- 改动文件：
- 为什么没有越出 P8：
- 自动验证：`bash scripts/verify.sh` 结果
- 浏览器验证：操作步骤 + 实际结果
- 资源/性能观察：
- 是否影响 R3/L 线视觉：
- 剩余风险：
- 下一编号：
```

禁止把“代码已改”“build 通过”单独当成完成；每个问题必须满足该条目的专项验收。

---

## 8. Phase 8 最终完成定义

只有同时满足以下条件，才可以向用户建议“P8 完结”：

- 3 个 P1 全部关闭；
- 7 个 P2 已关闭，或由用户明确接受为 deferred；
- `scripts/verify.sh` 全绿；
- `/test1`、`/test3`、`/test4` 路由回归正常；
- R3 最终视觉目验通过，或按止损线完成回退；
- L 线独立开关、全开压力、reduced-motion、拖拽/播放回归通过；
- P8 spec 与当前用户拍板一致；
- 双树归宿在首页迁移前有明确清单；
- 用户明确拍板“GL 水塘是否替换首页”；
- 如果替换首页，首页小球点击、播放与 fallback 实测通过；
- STATUS/TASKS/JOURNAL 只更新 P8 对应状态，不夹带其他 Phase 收束。

在用户拍板首页去留之前，正确状态应是：**P8 沙盒实现完成并通过验收，但生产迁移待决策**，不能由修复进程自行改写成“Phase 8 已完结”。

---

## 9. 做得好的部分（修复时必须保护）

- P8 没有越界触碰合约、数据库和生产 API；
- three/R3F 依赖均有批准记录，未引入黑名单或灰名单包；
- `/test3` 通过 dynamic + `ssr:false` 隔离，生产首页 bundle 未直接承载整套 GL；
- “GL 渲染层 + DOM 命中层”边界清晰，不应在修复交互问题时推翻；
- 真透明 R1 → R2 → R3 的失败根因、推翻过程和止损线都有完整记录；
- 多数生命感路径已经使用确定性种子并处理 reduced-motion；
- 文件/目录硬线、类型、lint、构建和 Forge 当前全绿；
- 生产首页仍保持 SVG 基线，为修复与目验保留了安全隔离区。

本轮目标不是重做 P8，而是修掉明确的运行时缺口、对齐契约，并保护已经拍板的视觉成果。

---

## 10. 2026-08-26 执行结果

| 项目 | 状态 | 交付 |
|---|---|---|
| P8-RUN-01 GPU cleanup | ✅ | 手工创建的 quad geometry/material 随 WaterDistort 卸载释放 |
| P8-RUN-02 GL health | ✅ | unavailable/healthy/lost/error/forced 统一上报并门控全部 DOM overlay |
| P8-RUN-03 动态高度场 | ✅ | 高度场跟随 Canvas 比例/尺寸，resize/context restore 重置 ping-pong |
| P8-INT-01 wheel UI 边界 | ✅ | `data-pond-ui` + `closest()` 保留面板原生滚动 |
| P8-A11Y-01 reduced-motion | ✅ | 随机漂移停止注入、视差平滑回中，主动交互保留 |
| P8-PERF-01 AutoDpr | ✅ | 卸载/context restore 恢复进入基准并清计数 |
| P8-INT-02 拖拽/键盘 | ✅ | up/cancel/lost/unmount 幂等收尾；原生按钮支持 Enter/Space |
| P8-STRUCT-02 死文件 | ✅ | 只删除 test3 的零引用 WaterLevelIndicator |
| P8-DOC-01 文档契约 | ✅ | 统一 `test3-life-v2`、9 开 1 关、R3 halo-only 与 K10 亮底 |
| P8-STRUCT-01 双树归宿 | ✅ | `reviews/2026-08-26-phase-8-dual-tree-inventory.md` |
| 自动浏览器矩阵 | ✅ | `reviews/2026-08-26-phase-8-browser-regression.md` |
| R3 最终视觉目验 | ✅ | 2026-08-26 用户确认合适 |
| L 线最终视觉目验 | ✅ | 2026-08-26 用户确认“活而不乱”合适 |
| 首页迁移去留 | ✅ | `/` 切换 GL，旧 SVG 保留为 `/v1` |

所有代码闭环均运行完整 `scripts/verify.sh`：TypeScript、ESLint（仅 3 条既有 warning）、硬线、危险扫描、生产构建与 Forge 42/42 通过。修复过程未安装依赖、未合并双树、未迁移首页、未修改其他 Phase 的产品范围。

### 2026-08-26 最终裁决

- R3 最终视觉目验：✅ 用户确认合适；
- L 线“活而不乱”目验：✅ 用户确认合适；
- 首页迁移：✅ 当前 `/test3` 体验替代 `/`，生产路由隐藏沙盒工具；
- 旧首页：✅ 独立保留为 `/v1` 并设置 `noindex`；
- Phase 8：✅ 用户明确要求收束、提交、推送并正式完结。

最终证据与接受的观察项见 `reviews/2026-08-26-phase-8-completion.md`。
