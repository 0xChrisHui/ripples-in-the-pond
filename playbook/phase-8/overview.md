# Phase 8 — 水塘视觉重设计

> **2026-06-04 新定**：Phase 7 已完结（commit `5a2211a`），Phase 8 重新定义为"水塘视觉重设计"，替代原"UI 大升级（艺术家反馈 5 条 + Claude Design）"。
>
> **决策来源**：2026-06-04 用户对话。视觉方向从"星空"转为"水塘"，更贴合 Ripples in the Pond 产品名。
>
> **前置**：Phase 7 完结（commit `5a2211a`）+ STATUS/TASKS/JOURNAL 同步完成

---

## Phase 8 是什么 / 不是什么

### 是

- **首页视觉从星空改为水塘**：水塘 / 涟漪 / 水面 / 漂浮感
- 球体形状 / 颜色 / 动效 / 整体氛围转向水面感
- 让产品视觉语言和名字"Ripples in the Pond"对齐

### 不是

- ❌ 小球数量调整（36 → 35）→ **Phase 10**
- ❌ 5 个背景大球 → **Phase 10**
- ❌ 按键动画优化 → **Phase 9**
- ❌ 全局 UI 重设计（/me / /score / /artist）→ **Phase 11**
- ❌ 音效扩展 → **Phase 14**
- ❌ OP Mainnet 部署 → **Phase 12**
- ❌ 混音系统 → **Phase 13**

---

## Phase 拆分（2026-06-04 新定）

| Phase | 内容 | 工时估 |
|---|---|---|
| **Phase 8（当前）** | 水塘视觉重设计：首页从星空改水塘 | 1-2 周 |
| **Phase 9** | 按键动画优化 | 1 周 |
| **Phase 10** | 组件功能升级 + 小球数量 36→35 + 分享/海报/5 大球 | 1-2 周 |
| **Phase 11** | 全局 UI 优化：/me / score / artist 重设计 + Claude Design | 2-3 周 |
| **Phase 12** | OP Mainnet 上线准备与部署 | 1-2 周 |
| **Phase 13** | 混音系统 + RemixNFT | 2-3 周 |
| **Phase 14** | 音效系统扩展 | 1 周 |
| **Phase 15** | Semi 音乐 NFT 生态合作 | 待定（你先和社区商量） |
| **Phase 16** | 原生钱包 + 多链 / ETH Mainnet | 待定（往后排） |

---

## Phase 8 Scope（当前核心任务）

### 用户确认的视觉方向

> "把星空视觉换成水塘视觉"

### 具体目标

- 首页球体现在是星空 / 星系感 → 改成**水面漂浮感**
- 关键词：**水塘、涟漪、漂浮、水珠、波纹、池塘感**
- 小球视觉：保持数量（36 个），但改颜色、质感、动效、氛围
- 整体风格：弱化宇宙感，强化"Ripples in the Pond"的水面感

### 具体方向（待 AI 提出方案后用户确认）

以下方向需 AI 调研后提方案，用户预览确认再实施：

1. **颜色基调**：深蓝/深紫 → 深青/墨绿/水面色系
2. **球体质感**：发光星球感 → 半透明水珠/漂浮水球
3. **动效**：轨道旋转/引力 → 水波漂浮/涟漪扩散/漂浮感
4. **背景**：星空黑 → 水面深色（墨蓝/深绿）
5. **Archipelago 整体氛围**：从 archipelago（群岛/星系）→ 接近水面漂浮物
6. **导航 / 顶栏**：配合水塘视觉统一调整

### 不在 P8 范围的 UI 项

以下在 Phase 8 **不碰**，保持现状或等后续 Phase：

- `/me` 页面内容区
- `/score/[id]` 内容区
- `/artist` 页面
- 音效数量 / 音效文件
- 按钮动画（→ P9）
- 音乐小球数量（→ P10）
- 5 个背景大球（→ P10）
- 分享按钮 / 海报下载（→ P10）

---

## P8 子 track 索引 + 全局铁律（2026-06-12 立项）

| Track | 文件 | 内容 |
|---|---|---|
| **P8-A** | `phase-8-a-water-ripple.md` | 水波折射动效 + 水面机位常量（默认正圆 1.0 + /test slider）+ 动效语言三原则 |
| **P8-B** | `phase-8-b-effects-migration.md` | 13 特效开关水塘化迁移（waterDrop / caustics / pondLights / waterWake / drops / pondShadow / waterMoon 水中月）+ S8 移动端最小水塘集拍板 |
| **P8-C** | `phase-8-c-opensource-integration.md` | 开源方案引入（audioPulse / beatRipple / flow / springBack / gooey） |
| **P8-D** | `phase-8-d-color-direction.md` | ❄️ **已冻结（2026-06-12）**：色彩方向 A–K 11 套经 D0 外部 HTML 预览粗筛全部淘汰，暂不排期；P8 期间默认配色保持现状。重启先做新一轮 D0 粗筛 |
| **P8-E** | `phase-8-e-orchestration.md` | 入场转场与收尾（splashIntro 入场落水 / groupWave 切组涟漪转场 / navPond 导航顶栏水塘化）；依赖 8-B S1 先行（2026-06-12 立项） |
| **P8-F** | `phase-8-f-effects-pool.md` | 效果候选池：15 个广撒网 flag（播放叙事 4 / 交互反馈 2 / 氛围 7 / 编排 2）+ F0 /test 面板分组与预设按钮 + ambient/pond/ 子目录方案 + F9 统一删减拍板（2026-06-12 立项） |
| P8-W | （gate，未立项） | WebGL 背景水面，仅当纯 SVG 验收后"还差口气"再议 |

**P8 全局铁律（每个 track 都适用）**：

1. **模块化**：P8 每一处新增/修改的功能都必须挂 `EffectsConfig` 开关，在 /test 的 effects 面板可手动单独开启/关闭、可单独回退；关 = 与现状像素级一致。
2. **抽象**：氛围元素禁止具象形态（鱼/虫/叶/花），只用光、波、斑、雾、痕表达。
3. **沙盒先行**：新 flag 桌面/移动默认全 false，先在 /test 充分体验，用户拍板后才改默认值。
4. **无指令不行动**：讨论 ≠ 行动授权（AGENTS.md 铁律 6）。

---

## Step 总览（待拆细）

| ID | 内容 | 工时 |
|---|---|---|
| **P8-S1** | 视觉方向调研：收集水塘/涟漪/水面感参考，确认颜色/质感/动效方向 | 0.5 天 |
| **P8-S2** | 颜色体系重设计：globals.css / 主题色 / Tailwind 变量 | 0.5 天 |
| **P8-S3** | SphereNode 视觉改造：球体从发光星球 → 半透明水珠 | 1 天 |
| **P8-S4** | Archipelago 动效改造：从旋转轨道 → 漂浮涟漪感 | 1 天 |
| **P8-S5** | 背景 / 导航配合水塘感统一调整 | 0.5 天 |
| **P8-S6** | verify.sh + 浏览器实测 + commit | 0.5 天 |

**Phase 8 工时**：约 4 天（单步串行估，实际可按用户节奏走）

> **P8-S4「Archipelago 动效改造」已细化为独立子track**：`playbook/phase-8/phase-8-a-water-ripple.md`（水波折射动效，路线 A = 纯 SVG `feDisplacementMap`，5 步，2026-06-11 拍板）。
>
> **P8-S5 的「导航 / 顶栏」部分已归 P8-E**（2026-06-12 用户拍板开 8-E）：见 `phase-8-e-orchestration.md` E3（navPond）。
>
> **P8-S2「颜色体系重设计」随 8-D 冻结（2026-06-12）暂不排期**——P8 期间默认配色保持现状，水塘感由质感/动效/氛围效果承担。

---

## 关键依赖

- P8 不阻塞任何后续 Phase
- P8 完成后再启动 P9（按键动画可与 P8 同期准备但不同文件）
- 小球数量 36→35 明确放 P10，P8 不动数量逻辑

---

## 工作流

> **⚡ 并行执行模式（2026-06-12 用户拍板，优先级高于下方串行流程）**：P8 采用"跑法一"并行冲刺——主会话调度 + 5 条 lane worktree 子代理，铁律"每步等'继续'"临时改为"lane 内自动继续、按波集中验收"。**执行手册：`p8-parallel-guide.md`**（用户说"跑 Phase 8"即按该指南自动开始）。P8 收尾后松绑失效，回归下方串行流程。

按 AGENTS.md 铁律"一次只做一件事"，P8 逐 Step 推进：

1. AI 调研水塘视觉方向 → 提方案 + 参考图
2. 用户预览 → 拍板颜色/质感/动效方向
3. 按 Step 逐个改文件
4. 每步完成后跑 `bash scripts/verify.sh`
5. 6 行汇报 → 等用户说"继续"
6. P8 全部完成后更新 STATUS → 进 P9

### 触发停下问用户

- 改动撞到合约 / cron / DB schema → 停
- 单文件超过 220 行 → 停
- 涉及音效文件替换 → 停（→ P14）
- 改动 /me / /score / /artist 内容区 → 停（→ P11）

---

## Phase 8 完结标准（进 Phase 9 的 gate）

- [ ] 首页从星空视觉转为水塘视觉（浏览器实测确认）
- [ ] 颜色体系 / 球体质感 / 动效整体和水塘感一致
- [ ] `bash scripts/verify.sh` 全绿
- [ ] 用户浏览器实测确认（首页小球可点击 / 可播放）
- [ ] STATUS.md 更新："Phase 8 完结" + Phase 9 启动
- [ ] JOURNAL 加 2026-06-04 段（视觉方向决策）

---

## 启动信号

用户说"开始 P8" → AI 做的第一件事：

1. 读 `playbook/phase-8/overview.md`
2. 调研水塘视觉方向（颜色/质感/动效），产出一页方案描述 + 参考关键词
3. 等用户预览确认方向
4. 从 P8-S1 开始逐 step 实施

---

## 参考文档

- [Phase 7 完结 review](../../reviews/2026-05-16-phase-7-completion-review.md)
- [JOURNAL 决策日志](../../docs/JOURNAL.md)
- [STATUS.md](../../STATUS.md)
- [TASKS.md](../../TASKS.md)
