# Review 2026-08-25 — Phase 8（水塘视觉重设计）系统性审查

**审查范围**：2026-06-04 ~ 2026-08-25，共 173 个 commit（其中 P8 主题 106 个，61.3%）
**审查方式**：3 个独立探查代理并行（代码健康 / spec 符合度与文档一致性 / git 历史与技术栈合规），全程只读
**审查依据**：`AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md`、`docs/STACK.md`、`reviews/PROMPT-TEMPLATE.md` 清单
**整体判断**：⚠️ **有警告** —— 工程纪律优秀（硬线全绿、依赖 100% 合规、沙盒隔离干净、决策全留痕），但 ① Phase 完结 gate 形式未达成（首页仍是 SVG）② 决策后 spec 文本多处未回写 ③ pond-gl 双树 26 个同名文件已分叉 ④ 38 个改动 + 73MB 媒体未提交

> 说明：视觉观感的最终验收（R3 目验、L 线逐开关验收）属用户浏览器动作，不在本次静态审查范围内。

---

## 〇、P8 完成度矩阵（速览）

| 线 | 范围 | 状态 | 证据 |
|---|---|---|---|
| Wave 0 | 涟漪总线 + 面板 + 并行基建 | ✅ 已合并 main | STATUS.md L79 |
| Wave 1 | 5 lane / 35 flag（默认全 false） | ✅ 全合并 | STATUS.md L80-83 |
| Wave 2 | splashIntro + 验收 + 拍板 + 压测 | 🧊 冻结（2026-07-05 用户拍板） | TASKS.md L12-13 |
| G | G1-G6 GL 地基（G7 已取消） | ✅ | commit `744b64d`/`eb5e11d` |
| H | H1-H6 水面子系统 | ✅ 全完（deferred 4 项） | `baddee8`/`a170029` |
| I | I1 去SVG / I2 GL 日蚀 / I3 | ✅✅⏸（I3 实质由 K8-K12 承担） | `7469ae4`/`add5a2f` |
| J | J1-J4 生产化迁移 | ✅ 本期完；正式替换首页 🧊 冻结 | STATUS.md L85 |
| K | K1-K12 视觉深化 | ✅ 全实现；验收 🧊 冻结 | JOURNAL L852-881 |
| L | L0 + 10 生命感模块（/test3） | ✅ 全实现；👁 浏览器验收中 | STATUS.md L87 |
| R 真透明 | A0-A6 → R1✗ → R2✗ → R3 | ✅ R3 自动复验过；👁 等用户最终目验 | 96-l §14.4 |
| P8-D 色彩 | 11 套配色 | ❌ 整 track 冻结淘汰 | JOURNAL L795-800 |

**形式结论：`playbook/phase-8/00-overview.md` 的「Phase 8 完结标准」6 项 checkbox 全部未勾——P8 从未正式完结，首页至今是 SVG 现状，GL 全部在沙盒（/test1 /test2 /test3）。**

---

## 一、架构一致性 ✅

- P8 全程 **0 次触碰** `app/api/**`、合约、migrations（git 全量 173 commit 逐文件归因）。
- 唯一碰 `app/page.tsx` 的 P8 commit `732599e`（Lane E）：已核 diff，仅 flag 门控 class/节点，默认 false 零变化。
- commit `32994df` 主动**回退**两处默认值变更，守「首页默认零变化直到用户验收」原则（自我纠错，合规）。
- 12 条核心架构决策无违反；「渲染层 GL + 命中层 DOM」边界由 2026-06-13 G4 拍板确立并遵守（JOURNAL L830-840）。
- ⚠️ 一处边界穿透（非违规，需正式化）：生产首页 `app/page.tsx:6` → `src/components/jam/TestJam.tsx:8` → `@/src/components/pond-gl-test3/key-fx/key-fx-events`——生产 import 沙盒树。已确认该链路纯 TS 不拉 three/R3F，bundle 风险小，但 J 线迁移拍板时应正式化此依赖。

## 二、技术栈合规 ✅ 100%

P8 窗口新增依赖仅 5 个，全部「先批准登记、后安装」：

| 包 | 版本 | commit | STACK.md | 结论 |
|---|---|---|---|---|
| three | ^0.184.0 | `dd9c9e1` | L50-53 白名单 + L129-130 | ✅ |
| @react-three/fiber | ^9.6.1 | `dd9c9e1` | 同上 | ✅ |
| @react-three/drei | ^10.7.7 | `dd9c9e1` | 同上（限轻工具） | ✅ |
| qrcode + @types/qrcode | ^1.5.4/^1.5.6 | `7a27de7`（P10） | L67 + L132-133 | ✅ |

- 黑名单（wagmi/ethers/howler/tone/hardhat 等）零命中；灰名单 `@react-three/postprocessing`（标注未批准，STACK L54）未安装。
- commit message 自带 bundle 影响说明（首页 First Load +89B≈零增量）。

## 三、坏味道（CONVENTIONS §2）✅ 基本干净

- **超线文件：0**。全 src/app 最大 219 行。近线预警 8 个 P8 文件（201-219 行）：`pond-gl-test3/decor/WaterPlants.tsx` 218、`pond-gl/decor/WaterPlants.tsx` 218、`pond-gl-test3/spheres/gl-sim-setup.ts` 217、`pond-gl-test3/water/WaterDistort.tsx` 211、`pond-gl/spheres/gl-sim-setup.ts` 210、`pond-gl/spheres/SphereInstances.tsx` 210、`pond-gl-test3/water/spike/RippleSpikePanel.tsx` 209、`app/test2/components/Test2Water.tsx` 201——下次加功能前需先规划拆分。
- **超 8 文件目录：0**（唯一 20 文件的 `animations-svg/effects/` 非 P8 且 hooks 已豁免）。
- **TODO/FIXME/占位/mock：0**；注释抽查均为 JSDoc 设计文档，无注释掉的代码块。
- **死代码 1 处**：`src/components/pond-gl-test3/overlay/WaterLevelIndicator.tsx` 全仓 0 import（`app/test3/page.tsx:97` 注释说明不挂载）。/test1 版正常使用，test2 有独立同构版。
- **结构性风险（最重要）**：`pond-gl/`（41 文件 5010 行）与 `pond-gl-test3/`（59 文件 6631 行）双树 MD5 比对——13 文件完全相同、**26 文件同名但已分叉**、test1 独有 2、test3 独有 20（life/、key-fx/、composite/ 等）。同名不同步（如两棵 WaterPlants 各 218 行内容已分叉）是未来合并/上首页时的主要风险点。

## 四、安全 ✅

- console 打印 process.env：src/app 零命中。仅 `scripts/arweave/wait-for-base-eth.ts:29` 打印 `BASE_RPC_URL`（本地 CLI、低风险，知悉即可）。
- 硬编码 0x+64hex 仅 2 处，均为 ERC-721 Transfer 事件 topic（公开常量）：`app/api/cron/process-score-queue/_shared.ts:9`、`app/api/cron/process-airdrop/steps.ts:18`。
- 无私钥/API key 硬编码；`.env.local` 未被 commit（`d54a1b0` 还主动 gitignore 拦截了含 token 的 `.mcp.json` 和 2.4MB 大图，正面案例）。

## 五、可学性 ✅（决策留痕质量高）

- JOURNAL.md 在 P8 期间记录 **14 条非显然决策**，全部含「决定+理由」：路线图拍板与被 `git reset --hard` 冲掉后逐字恢复（L768-793）、P8-D 冻结（L795-800）、G4 方向 A「渲染层 GL+命中层 DOM」（L830-840）、R3F uniforms prop 拷贝坑与色差根因（L838/L846）、K1「别用数学补偿救几何问题」（L852-866）、K10 暗纹→亮底推翻（L874-877）、L0b 五消费方同源（L901-908）、真透明一日五决策含同日两次推翻自己（L1046-1081）、R1→R2→R3 根因链（L1083-1115）、`0.75→0.075` 当日纠错（L1129-1158）。
- 问题不在漏记，而在**决策落地后 spec 文本未回写**（见第八节）。

## 六、范围纪律（Step 范围）✅

- P8 commit 改动集中：`pond-gl` 249 次 + `pond-gl-test3` 69 次 + playbook 62 次；生产代码（archipelago）57 次全部集中在 Wave/Lane 期且均 flag 门控；后半程（G/H/I/K/L/R）全部收敛沙盒。
- `src/components/archipelago/sphere-config.ts` P8 全程未碰（红线「共享 sphere-config 不删」）。
- 01-parallel-guide §1.7「不碰合约/cron/DB、不碰 /me//score//artist 内容区」零违反。

## 七、红线执行核验（14 条）

✅ 遵守 11 条：性能纪律（只动 transform/opacity）、220/8 硬线（多次撞线均以结构性拆分化解而非豁免）、SVG 不删、GL 力参数 1:1 快照、life 参数走独立 store、96-l 不引入 MRT/depth texture/新依赖、旧新双路径不带入生产、拖拽球不受 wake/flow/shiver 推动、K 线 R1/R5 约束。
⚠️ 有拍板突破 2 条：L 线 9/10 flag 默认开（2026-08-25 用户拍板，破「默认 false」字面）、K9/K10 具象形态（2026-06-18 用户主动要求，破「抽象铁律」文本）——均合规但文本未加批注。
⏳ 仍悬顶 1 条：**R3 止损线**——不许追加 R4；最终目验失败即回退、方向终止（96-l §14.4，STATUS.md L29）。这是当前唯一活跃的硬止损。

## 八、文档一致性冲突（需回写清单，按严重度）

1. **Phase 13/14/15 排序三方不一致**：roadmap + STATUS.md L17-19 = P13 Semi/P14 混音/P15 音效；`00-overview.md` L40-42 + JOURNAL 旧段 = P13 混音/P14 音效/P15 Semi。建议以 roadmap+STATUS 为准，修 00-overview。
2. **P10 定义过期**：`00-overview.md` L37 仍是旧 P10（组件升级/36→35/5 大球，已作废），未加 2026-07-05 收窄批注。
3. **K10 spec 与实现相反**：`90-k-visual-deepening.md` L103 红线写「暗纹非亮底」，实现已推翻为亮底 mix + 5 套花纹（JOURNAL L874-877 有记录，spec 未回写）。
4. **L 线默认值三方不一致**：95-l 红线「10 flag 默认 false」；代码 `gl-flags.ts` L96-105 实际 9/10 默认 true（用户拍板）；且同文件 L184 注释仍写「默认全 false」与 L49 注释**自相矛盾**。
5. **alphaFlicker 语义变更未回写 95-l L5-1**：R3 已拍板「水上主体不吃 lifeDim、只作用 halo」（96-l §14.1 为新权威）。
6. **storage key**：95-l 写 `test3-life`，代码实为 `test3-life-v2`（JOURNAL L1117-1121 有记录）。
7. **抽象铁律未加 K9/K10 例外批注**（00-overview 铁律 2 / 01-guide §1.3）。
8. 轻微：AGENTS.md §6 写 200 行 vs CONVENTIONS 220 行（按 §9 以 CONVENTIONS 为准，执行无误）；STATUS.md L86「已知挂 H6」的 256² 色斑缺陷与「H 线全完」并存，建议明示为 known-issue。

## 优先修复清单

**P0（保护既有工作 / 用户行动）**
1. **工作区切分提交**：38 个已跟踪文件改动（pond-gl-test3 调参、auth/community、SemiLogin、文档）+ 未跟踪（`pond-gl-test3/key-fx/`、`water/composite/`、33 个 wav、`app/test4/`、`playbook/phase-13/`、`reviews/2026-08-23-phase-12-launch-review.md`）——P9 与 L 线成果目前只在工作区，有丢失风险。提交前先定大媒体策略（见 P2-1），切勿 `git add .`。
2. **R3 止损线目验（用户）**：在 `/test3` 按 `111221.mp4` 同款滚轮浮出+点击动作最终目验；失败即按止损线回退，不追加 R4。

**P1（尽快，不阻塞）**
3. 文档回写 4 处：`00-overview.md`（Phase 13/14/15 排序 + P10 定义批注）、`90-k-visual-deepening.md`（K10 亮底红线改写）、`95-l-life-sense.md`（默认 9 开 / alphaFlicker R3 语义 / storage key v2 / shiver 开启即验收）、`gl-flags.ts` L184 过时注释。
4. 死文件 `pond-gl-test3/overlay/WaterLevelIndicator.tsx`：删除或挂回。
5. **双树 26 个同名分叉文件归宿拍板**（J 线迁移前置；建议以 test3 树为主线清单化差异）。
6. 生产首页 → `pond-gl-test3/key-fx` 依赖正式化（下沉共享目录或在 J 线拍板时登记边界）。

**P2（攒到收尾）**
7. ≈93MB 曲目 mp3 已入库（`a32984a`，No.16-35，无 LFS）策略确认：接受 / LFS / 外链；另有 ≈73MB 未跟踪媒体（`1-35 Shorts` 32MB、第36个 8.3MB）待同策略；`test2-water.jpg` 与 references 重复一份。
8. 8 个 201-219 近线文件：下次迭代前先拆。
9. 256² 高度场高折射色斑 known-issue 挂账（H6 deferred → 移动端那拍：512²/梯度平滑）。
10. P8 完结 gate：冻结解除后重设计收尾方案时，把 00-overview 的 6 项完结 checkbox 更新为现实口径（含「首页是否替换 GL」的去留拍板）。

## 表扬

1. **决策日志是全项目最硬的资产**：同日两次推翻自己仍逐条留痕；roadmap 被 `git reset --hard` 冲掉后凭记录逐字恢复——这在单人 + AI 协作项目里极罕见。
2. **依赖合规教科书级**：5 个新包全部「先批准登记、后安装」，commit message 自带 bundle 影响量化；灰名单包零安装。
3. **沙盒/生产/后端三层隔离干净**：173 个 commit 0 次碰 API/合约/migration；唯一碰首页的 commit 默认 false 零变化，还有一次主动回退守默认值（`32994df`）。
4. **硬线零豁免**：多次撞 220 行/8 文件线，全部用结构性拆分（effects-config 拆分、AmbientLayers 抽取、sphere-frame 抽取）化解，没有一次申请放宽。

---

### 附：证据来源

- 代码健康：`src/components/pond-gl/**`、`pond-gl-test3/**`、`app/test1|2|3` 全量行数/引用扫描（PowerShell + Grep）
- spec 符合度：`playbook/phase-8/` 全 12 份 + STATUS/TASKS/JOURNAL/LEARNING 交叉核对
- git 与栈：`git log --since=2026-06-04` 173 commit 全量逐文件归因 + package.json 历史 diff
