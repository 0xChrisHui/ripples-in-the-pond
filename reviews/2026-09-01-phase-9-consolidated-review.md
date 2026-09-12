# Review 2026-09-01 — Phase 9 系统性审查（v4.1 当前态）

> **历史审查（已关闭）**：本文记录的是 Fix Pack 之前的 v4.1 风险快照；其中 Track C 建议均已在 v4.2 完成。不得把本文的待办当成当前状态，最终裁决见 `2026-09-05-phase-9-completion-review.md`。

> 用途：对 P9（33 键 / 33 音效 / 33 动画按键编舞）当前实现做一次性系统盘点，供用户决定是否进入 Track C 清理。
> 本文只管 P9，不负责其他 Phase、首页迁移、生产提升或 commit。
> 本次为只读审查：未修改任何代码、未重跑 verify.sh（STATUS 记录 2026-09-01 全绿，且工作区自那以后无代码改动）。

## 0. 审查说明

**审查来源**：

1. 合同真值：`playbook/phase-9/03-v4-33-key-audiovisual-remap.md`（v4 冻结合同）+ `STATUS.md` 2026-09-01 v4.1 收束记录；
2. 代码全读：`p9/registry`（8 文件全读）、`p9/runtime`（4/5 全读）、`p9/consumers`（5/5 全读）、`p9/tuning`（2/3 全读）、`key-fx/`（核心 3 文件）、`useKeyboard.ts`、`TestJam.tsx`、`GlEclipse.tsx`、`WaterDistort.tsx` P9 段、`app/test3/page.tsx`；
3. 2026-09-01 重跑 `reviews/evidence/p9-v4/static-audit.ts`：通过（45 历史 / 33 active / 13 日食依赖 / 水波白名单 T,U,V / 月光写入 0 / 大小写归一）；
4. 音频资产实测：`public/sounds/` 33 个 MP3、33 个唯一 SHA-256；`useJam.ts` 键集恰好 a–z + 3–8 + space = 33。

**当前基线**：

- P9 触发仅限 `/test3`（`p9Enabled={isP9Sandbox}`），生产 `/` 只播音效、无 P9 视觉——符合 v4 红线"不自动提升到生产"✅；
- v4.1 默认参数收束已完成，等待用户重置存档后继续目验；
- 12 个废弃 FX 仅退出注册表、实现冻结未物理删除——符合"Track C 才物理清理"✅。

**整体判断**：⚠️ **运行态健康，合同文档失真；可继续目验，但进入 Track C 前应先修合同。**

- 0 个 P0；
- 2 个 P1（全部是"代码已被四轮目验接受、但冻结合同未同步"的文档真理漂移，非运行时 bug）；
- 5 个 P2（休眠总线、生产空转循环、采样副作用隐患、迁移表瑕疵、V 浪显示截断）；
- 4 个 P3 观察项。

---

## 1. 合同符合性验证（全部通过 ✅）

| 合同项（playbook 03） | 验证方式 | 结果 |
|---|---|---|
| 33 键 / 33 音效 / 33 动画一一映射 | 静态审计重跑 + 逐 lane 对照 §3.2 | ✅ 33/33/33 |
| Shift/Caps 归一同一 soundKey | `useKeyboard.normalizeKey` 用 `e.code` 转小写；`findP9Effect` 再 `toLowerCase` | ✅ |
| auto-repeat 不计连击 | `if (e.repeat) return` | ✅ |
| Space 防滚动 + 不劫持表单/按钮 | `preventDefault` + `isEditableTarget` 过滤 INPUT/TEXTAREA/SELECT/BUTTON/A | ✅ |
| 数字只收 3–8（主键盘 + 小键盘） | `/^(Digit\|Numpad)[3-8]$/` | ✅ |
| `requiresEclipse` 13/20 显式门控 | 静态审计 = 13；门控接 `getShowcasePose().active`（真实播放态，GlEclipse 每帧写入） | ✅ |
| 无日食静默跳过：不报错、不排队、不补播 | `triggerP9Effect` dispatch `reason:'no-eclipse'` 后即返；HUD 显示原因 | ✅ |
| 声音优先：视觉被拒仍播音 | `TestJam` 先 `triggerP9Effect` 后无条件 `playSound` | ✅ |
| 水波白名单 T/U/V | 静态审计；`collectP9Drops` 仅 `waterWrite && mode==='droplet'`（U） | ✅ |
| 月光写入 0 | 无任何 effect 声明 `moonWrite`；sampler 对 moon channel 显式跳过 | ✅ |
| velocity-impulse 回落首击抵消负速度 | `reinforce`: `velocity < 0 ? 0 : +gain` | ✅ |
| B 最多 6 批、满载播音不播视觉 | `spawnLimit` 读 `batchLimit=6`；`reason:'capacity'` 拒绝后 `playSound` 仍执行 | ✅ |
| I 结束位置提交新基准 | `p9-motes` `settledOffsets`/`settledVoice` 在 progress>0.96 提交 | ✅ |
| M 吸收不回弹、随机异地补生 | `consumedVoice` + `respawns`（1.4–3.6s 后随机偏移重现） | ✅ |
| P 吞没→休眠→最远点重生 | `transformLives` dormant → 6 候选取离日食最远点 → 渐显 | ✅ |
| R 以真实花瓣位置驱动微光喷射 | `burstFields` 记录真实花瓣坐标，`p9-motes` 从 origins 喷射 | ✅ |
| F/K 共用 24 色 + 相邻色插值 | `P9_PALETTE_24` + `paletteColor` 双线性混合；F 无独立色相跨度 | ✅ |
| 参数默认值 = STATUS v4.1 | 逐项对照 `p9-params.ts`：E 六项 1.8/0.9/2.5/1.8/0.3/2.0、Y 2.0/0.3/1.2、3 潮膜 0.35、7 张力 1.5、H 遮罩 1 等全中 | ✅ |
| 12 个废弃 FX 只退入口 | `status:'deleted'/'empty'`，实现代码冻结在 consumers 中不可达 | ✅ |
| 工程硬线 | P9/key-fx 子树最大 173 行；`registry/` 恰 8 文件；无 wagmi/ethers/howler/tone | ✅ |
| 音频资产 | 33 MP3 / 33 唯一哈希；`useJam` 键集 = 33 | ✅ |

---

## 2. P1 — 合同文档真理漂移（2 项，进 Track C 前必修）

### P1-1 重触发模型：§5.2 五类合同 vs 注册表实际 10 键不符

playbook 03 §5.2 冻结了五类模型，但注册表实际使用 **7 种** 模式，其中 `smooth-accumulate`（7 个效果在用）和 `one-way-commit`（2 个）**未在任何合同文档中定义**：

| 合同 §5.2 | 代码实际 | 偏差键 |
|---|---|---|
| spawn-batch = B,T,V,Z,5,Space | 另有 S(FX19)、8(FX43) | S、8 |
| object-cycle = J,M,N,P,Q,R,S,7 | M→one-way-commit、P→one-way-commit、S→spawn-batch | M、P、S |
| bounded-envelope = C,E,G,H,L,O,U,X,3,4,6,8 | 仅 H,X,3,4,6 命中；C,E,G,L,O,U→smooth-accumulate；8→spawn-batch | C,E,G,L,O,U,8 |

**运行时影响：低。** 代码里 `one-way-commit` 与 `object-cycle` 语义相同（都不 reinforce、都受 spawnLimit 约束）；`smooth-accumulate` 实际承担了合同 bounded-envelope 的"叠加有限、连续包络"职责。四轮目验接受的正是当前行为。
**问题在合同**：`docs` 是唯一真理来源的项目规则下，冻结合同与实现脱节且未在任何 review/JOURNAL 登记。Track C 若按 §5.2 字面审计会误伤正确实现。
**处置建议**：给 playbook 03 追加 v4.1 附录，把 7 种模式与 33 键的对应定为新真值；或在 `p9-types.ts` 的 `P9Retrigger` 定义处补注释说明与 §5.2 的映射关系。

### P1-2 playbook 03 权威映射表/真值表已过期（E、R、Y、3、F、N）

§3.2 与 §7 自称"最终真值"，但以下内容只存在于 STATUS 2026-09-01，playbook 未同步：

- **E**：§3.2 写"光晕凝光"→ 实际已正式化为"引力透镜轨道"（`lens-orbit`，六项新参数）；
- **R**：§3.2 写"花瓣闪耀湮灭"→ 实际为"花瓣原地炸裂"（`petal-burst`，复用 P 喷射，原"闪耀强度 1.5"参数已不存在）；
- **默认值**：E 六项 `1.80/0.90/2.50/1.80/0.30/2.00`、Y `2.00/0.30/1.20`、3 潮膜 `0.35`、F 取消色相跨度改共享 `P9_PALETTE_24`——§7 仍是旧值；
- **N**：§7 写"个体渐隐区间 1.8–4.8s"，代码模型为 dwell `2.5–7` + fadeIn `1.2` + fadeOut `2.4`，参数模型本身不同。

**处置建议**：同一份 v4.1 附录一并修订；否则下次任何 AI 按 playbook 施工会把已拍板的 E/R 改回去。

---

## 3. P2 — 结构性问题（5 项）

### P2-1 旧 key-fx 总线完全休眠但仍在每帧空转

`emitKeyFx` 在全仓库 **0 个调用者**（v4 后 `TestJam` 只调 `triggerP9Effect`）。仍活着的空转路径：
- `WaterDistort.tsx:169,193` 每帧 `sampleKeyFx` + `collectKeyFxDrops`（永远返回空）；
- `GlEclipse.tsx:36-57` 监听 `jam:key-fx` 的 corona accent（永不触发）；
- `life/wake-field.ts:77` 监听同一事件（永不触发）。

**处置建议**：登记进 Track C 清理清单（删除或重新接线需用户拍板，本次不动）。

### P2-2 生产 `/` 上两个 rAF 循环常驻空转

`P9StageOverlay` 随 `GlEclipse` 挂载（含生产 `/`），`p9Enabled=false` 时 voice 恒为空，仍每帧 `sampleP9` + 遍历 SVG 子节点写属性。`GlEclipse` 自身循环同理（该循环还承担日蚀定位，不能完全算浪费）。
**处置建议**：`P9StageOverlay` 循环内 voices 为空时跳帧（或事件驱动启停）；优先级低，实测 FPS 未受影响。

### P2-3 `sampleP9` 采样带副作用，5 个调用点共享可变状态

`sampleP9Voice` 在采样中积分 `velocity`/`renderedStrength` 并改写 `sampledAt`；当前 5 个调用点（FloatingMotes、WaterPetals、GlEclipse、WaterDistort、P9StageOverlay）**全部** 使用 `performance.now()/1000`，同帧后续调用 delta≈0 所以安全。但该"单时钟"前提无任何注释或断言保护——未来任何调用点改用 R3F `state.clock` 即造成双倍积分、动画加速。
**处置建议**：在 `p9-sampler.ts` 头部注明时钟约束，或把积分拆成显式 `advanceP9(now)` 单入口。Track C 一并处理即可。

### P2-4 v4→v4.1 存档迁移表瑕疵

`V4_DEFAULT_KEYS` 有两项重复（`FX11.transition`、`FX23.gain` 各写两次，Set 去重无实际影响）；且 FX05 的 v4.1 六项新默认值只有 `brightness` 一项进表——v3 存档若含 `orbit/asymmetry/speed/hitGain/ceiling` 同名键，旧值会盖过新默认。用户已被要求点"重置"，实际风险低。
**处置建议**：去重 + 把 FX05 六项、FX25 三项、FX42.film 补进 `V4_DEFAULT_KEYS`（或改按"整 FX 维度作废"迁移）。

### P2-5 V 白色静浪：并发上限 5 但只渲染 4 条

FX32 `batchLimit=5`，`getP9QuietWaves` 却 `slice(-4)`——第 5 条并发浪有声无画。
**处置建议**：统一为 4 或 5（一行改动，等 Track C 或下次调参顺手）。

---

## 4. P3 观察项（不阻塞）

1. **J 微光全熄**：合同 §6.1 写"所有微光同步进入阶段"，代码有每微光 0–0.35s 随机错峰（`hash(seed*17)*0.35`）。目验已接受，建议改合同文字而非改代码。
2. **`registry/` 恰 8 文件**：已达目录硬线上限，新增任何文件（新 lane、新参数分组）前必须先拆。
3. **U 水滴无音乐时固定落屏心**：符合"稳定 viewport 坐标"合同，但每击同点；若希望散布需改合同。
4. **FX44 微光群落由 `p9-direction-lab` 驱动**：研究工具转正使用；`migration`/`eclipse-pull` 两个方向无触发入口（死路径），Track C 时决定删留。

---

## 5. 明确排除（本次未审）

- 浏览器实测目验（E/F/R 等）——属用户进行中的验收流程，本 review 只审静态与结构；
- Track C 物理清理的执行；
- P8/P10/P12 的任何未决项；
- `pond-gl/`（/test1 冻结基线）与 P9 无引用关系的部分。

## 6. 结论与建议下一步

1. **继续当前目验**：运行态无 P0/P1 级问题，不阻塞用户在 `/test3` 的 E/F/R 目验；
2. **目验拍板后、Track C 动工前**：先修 P1-1/P1-2（playbook 03 补 v4.1 附录），把重触发七模式、E/R 新身份、v4.1 默认值写成新真值；
3. **Track C 清单建议收入**：P2-1（休眠 key-fx 总线）、P2-2（空转循环）、P2-3（采样副作用约束）、P2-5（V 浪 4/5 统一）、P3-4（direction-lab 死路径）。
