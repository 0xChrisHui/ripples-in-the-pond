# P8 并行执行指南（跑法一：主会话调度 + worktree 子代理）

> **触发**：用户说"跑 Phase 8 / 按并行方案执行"→ 本文件即执行手册，按 §3 流程直接开始，**无需再次向用户确认方案**。
> **授权记录（2026-06-12 用户拍板）**：① 采用跑法一（主会话调度 + 每 lane 一个 worktree 子代理并行）；② **铁律临时松绑**：AGENTS.md"一次只做一件事 / 每步 6 行汇报等'继续'"在 P8 并行冲刺期间改为"**lane 内自动继续、按波集中验收**"；③ 其余铁律全部照旧（见 §1）。已记 docs/JOURNAL.md 2026-06-12。
> **simplex-noise 装包未批**：C2（flow）跳过，留待用户批准后单独补。

---

## 0. 开工前必读

**主会话（调度者）**：AGENTS.md → STATUS.md → docs/CONVENTIONS.md §1-§3 → docs/STACK.md → `playbook/phase-8/` 全部文件（overview / 8-A / 8-B / 8-C / 8-E / 8-F；8-D 已冻结跳过）。

**每个 lane 子代理**（写进其 prompt）：必读 docs/CONVENTIONS.md §1-§3 + `phase-8-b-effects-migration.md` §0（通用工程规则）+ 本 lane 对应的 track 文档章节 + 8-A 补充一/二/三（机位/动效语言/光源锚点）。**实施前先勘探真实代码**——playbook 规格里标"方向性"的条目以现场代码为准。

## 1. 不变的铁律（松绑只松"等继续"，其余全部有效）

1. 沙盒铁律：所有新 flag 桌面/移动默认 **false**——并行期间首页默认视觉零变化（Wave 0 的 bgRipples 减速曲线/调度器除外，属已拍板的总线升级）。
2. flag 五件套缺一不可；关 flag = 完全回现状。
3. 抽象铁律：禁止任何具象形态（鱼/虫/叶/花）。
4. 性能纪律（8-B §0.3）：只动 transform/opacity；禁逐帧动 baseFrequency；filter 收紧 region。
5. 单代码文件 ≤200 行、单目录 ≤8 文件。
6. 各 track 的"触发停下问用户"条款照旧——lane 内撞到停下条款：**跳过该步、标记，波末汇总**，不阻塞本 lane 其余步骤、不阻塞其他 lane。
7. 不碰合约 / cron / DB / `/me` / `/score` / `/artist` 内容区。

## 2. 波次与 Lane 划分

### Wave 0（主会话亲自做，串行，1 个闭环）

**内容**：8-B S1 + 8-F F0 + 并行基建。具体：
1. 8-B S1 全量：`--pond-*` token（兼容值）、`POND_TILT_RATIO`（context/CSS 变量广播 + 响应式消费，见 8-A 补充一修订）、`MOON_ANCHOR`、bgRipples/sphereRipple 椭圆化 + 减速曲线 + token 接线、**涟漪调度器**（三级优先，8-B §2.1.6）、`.ripple-once` class（8-B §0.6）、hoverRipple（含 `bg-ripple:spawn` 监听）。
2. F0：EffectsPanel 分组折叠 + 3 预设按钮。
3. 并行基建：建 `effects/ambient/pond/` 目录；在 `effects-config.ts`（接口 / DESKTOP / MOBILE / EFFECTS_META 四处）和 `globals.css` 末尾预埋 5 个 lane 的注释区块标记（`/* === Lane A === */` 等），让各 lane 在自己区块内追加、merge 冲突机械可解。

完成：verify.sh 全绿 + 简报用户（不等回复）→ 直接拉起 Wave 1。

### Wave 1（5 条 lane 并行，每 lane 一个 worktree 子代理）

| Lane | 步骤（lane 内按序） | 专属文件（其他 lane 禁碰） |
|---|---|---|
| **A 球体线**（关键路径） | 8-A S1→S5（waterRipple 五步）→ 8-B S2 waterDrop → 8-B S3（focus saturate / TILT_PX / perspective 默认关含 zoom 全链路验收 / bobbing）→ F1 dropShimmer → F5 sphereSheen | `SphereNode.tsx`、`SphereGlowDefs.tsx`、`use-water-field.ts`(新)、`use-sphere-sim.ts`、`render-helpers.ts`、`EffectsPanel.tsx`（两个 slider）、（超线时 `SphereDropLayers.tsx`） |
| **B 环境线** | 8-B S4（caustics+filmGrain）→ S5 pondLights → S7（drops/fog/pondShadow）→ F3（skyReflection/moonPath）→ F1 pondEdge → F4 rain | `effects/ambient/pond/*`(新)、`fog-layer.tsx`、`Archipelago.tsx`（挂载行） |
| **C 物理线** | C3 springBack → C5 viscous → F4 breeze（~~C2 flow~~ 未批跳过） | `forces/spring.ts`(新，**不碰 render-helpers**)、`forces/`(新)、`sphere-sim-setup.ts`、`motion/breeze.tsx`(新) |
| **D 音频线** | C1（audioPulse/beatRipple/reduced-motion 规则式）→ F2（echoRipple/playWaves/bubbles/lightFollow） | `use-audio-energy.ts`(新)、`PlayerProvider.tsx`、`use-responsive-effects.ts`、`render-eclipse-moon.ts`、`motion/bubbles.tsx`(新)、F2 组件(新)。⚠️ **不碰 `use-sphere-sim.ts`**（属 Lane A）——audioPulse 的 scale 绑定 4 行由主会话 merge 后补 |
| **E 编排线** | 8-B S6（waterWake+dragWake）→ S7.5 waterMoon → 8-E E2 groupWave → E3 navPond → F1 tide/clickSplash → F5 cursorRing → **最后** E1 splashIntro（等 Lane A 的 bobbing 内层 g 结构 merge 后做，若未就绪则留待 Wave 2） | `motion/water-wake.tsx`(新)、`SphereCanvas.tsx`、`EclipseLayer.tsx`、`BackgroundRipples.tsx`、顶栏组件、`motion/cursor-ring.tsx`(新)。clickSplash 经播放事件在 SphereCanvas 层实现，**不碰 SphereNode** |

**共享热点**（谁都会碰一两行）：`effects-config.ts`、`globals.css`（各自区块内追加）、`Archipelago.tsx`/`SphereCanvas.tsx` 挂载行——冲突由主会话 merge 时解，lane 代理只管在自己 worktree 里挂好并自测。

### Wave 2（主会话串行收口，需要用户在场）

E1 splashIntro（若 Wave 1 未完成）→ F5 idleCalm（跨效果系数订阅，必须在全家桶 merge 后做）→ C4 gooey（真机实测件，用户说要试才做）→ 全开压测（含单球四层滤镜专项）→ **用户 /test 集中验收 + S8/F9 统一拍板**（默认值 / 删码 / DEGRADATION_ORDER / 移动端最小水塘集）→ STATUS/JOURNAL 收尾。

## 3. 调度流程（主会话照此执行）

1. 读 §0 必读 → 做 Wave 0 → verify.sh → 简报 → 不等回复。
2. **拉起子代理前必须先 commit**（worktree 从 HEAD 检出，未提交改动不会出现在子代理的 worktree 里）：把 Wave 0 代码 + 尚未提交的 playbook 文档一并提交。然后**同一条消息里**用 Agent tool 拉起 5 个 lane 子代理：`isolation: "worktree"` + `run_in_background: true`。每个 prompt 含：lane 步骤清单、专属文件表、必读文档清单、§1 铁律、"每步跑 `bash scripts/verify.sh`，全 lane 完成后用 git 提交全部改动（中文 commit message，风格抄 git log）并汇报 commit/分支与改动摘要、挂载点清单、跳过项及原因"。
3. 子代理陆续完成 → 主会话按 **A → E → B → D → C** 优先序合并（A 是关键路径且占文件最多，先进主干让后续冲突向它对齐）；每合一个 lane：解热点冲突 → `bash scripts/verify.sh` → 下一个。
4. 全部合完：补 audioPulse×use-sphere-sim 的 4 行绑定、E1（若就绪）、跑"水塘推荐"与"全开压测"两个预设的自测 → 向用户汇报 Wave 1 完成 + §4 验收清单 → **停，等用户验收**。
5. 用户验收/初筛后 → Wave 2。
6. 异常处理：某 lane 子代理失败/超时 → 读其 worktree 现状，可救则主会话接手收尾，不可救则该 lane 改主会话串行重做，**不阻塞合并其他 lane**。

## 4. Wave 1 用户验收清单（汇报时给出）

- 组合 URL：`/test?waterRipple=1&waterDrop=1&caustics=1&filmGrain=1&pondLights=1&waterWake=1&dragWake=1&hoverRipple=1&drops=1&pondShadow=1&waterMoon=1&bobbing=1&springBack=1&viscous=1&audioPulse=1&beatRipple=1&aurora=0&stars=0&comet=0&perspective=0`（+ 池内各 flag 单独开关）
- 必验：36 球点击/拖拽/hover/切组 100% 正常；每个 flag 单独关 = 回现状；全关 = 与开工前像素级一致；滚轮缩放在 perspective=0 下正常且无涟漪冻结残留；桌面 ≥55fps（水塘推荐预设）。
- 用户给出：池内 flag 删减初筛名单（最终拍板在 Wave 2 的 F9/S8）。

## 5. 收尾义务

- 每波结束更新 STATUS.md（进度行）；Wave 2 拍板后 JOURNAL 记默认值决策。
- 本指南为一次性冲刺授权：P8 收尾后铁律松绑自动失效，回归"一次只做一件事"。
