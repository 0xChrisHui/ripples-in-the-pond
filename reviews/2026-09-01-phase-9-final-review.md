# Phase 9 系统性 Review — 最终交叉审查

> 日期：2026-09-01  
> 范围：P9 v4.1 当前工作树，33 键 / 33 音效 / 33 动画系统  
> 输入报告：DeepSeek v4 Pro（`2026-09-01-phase-9-review-trae.md`）、Kimi K3（`2026-09-01-phase-9-consolidated-review.md`）、Codex 当前代码与验证审计  
> 边界：本轮只生成最终审查结论，不修改 P9 动画源码、不进入 Track C、不提升生产、不部署

## 0. 最终结论

**当前 P9 视觉方向已经可以冻结，但工程层尚不应直接宣布 Track C 完结。**

- **P0：0 项**；
- **P1：3 项**——参数接线合同、权威文档真值、最终自动验收证据；
- **P2：8 项**——R 缓存生命周期、reduced-motion、全局重音冷却、V 第五浪、FX44 双轨运行时、休眠 key-fx、生产空转 rAF、采样副作用时钟；
- **P3：6 项**——存档迁移、遗留字段、文件归属、J 错峰文字、U 固定落点、目录/历史实现清理。

运行基线本身健康：33/33/33 映射、13/20 日食门控、月光写入 0、33 个唯一音频哈希、输入隔离和工程验证均通过。真正需要避免的是两种误判：

1. **不要按旧 playbook 把 E/R 改回去。** 当前正式 E 是“引力透镜轨道”，R 是“花瓣原地炸裂喷射”，这是用户明确拍板后的代码真值；
2. **不要因为画面目验通过就认定所有参数已经接线。** 当前至少 6 个可见滑块不会改变对应运行时行为。

推荐顺序：先完成一个小型 **P9 Review Fix Pack**，再补最新连续演奏自动验收；全部通过后才进入 Track C 物理清理或生产提升。

---

## 1. 三方意见交叉裁决

| 外部结论 | 最终裁决 | 依据 |
|---|---|---|
| DeepSeek：E“引力透镜轨道”违反 playbook，属于 P0 | **驳回** | 用户已明确选择 `\` 候选替换正式 E；`docs/JOURNAL.md` 2026-09-01 与 `STATUS.md` 均登记该决策。问题是 playbook 过期，不是代码回退。 |
| DeepSeek：重触发模型约 10 键与 §5.2 不符 | **接受，但归为文档 P1** | 代码确实使用 7 种模型，§5.2 只写 5 种；S/8/M/P 的逐键规格反而支持当前代码。不能按旧表机械改代码。 |
| DeepSeek：Y/R 参数与 §7 不符 | **拆分处理** | R 是正式重做后参数模型变化，属于旧文档；Y 的 `damping` 则确实只定义未读取，是运行时缺陷。 |
| DeepSeek：FX44 `batchLimit` 从未读取 | **纠正** | `spawnLimit()` 会泛型读取 `batchLimit`；真实问题是视觉由独立 direction-lab 合并状态驱动，并未形成 5 个独立群落实例。 |
| DeepSeek：B 的 80ms 写死、`key/shifted` 遗留、迁移 Set 重复 | **接受** | 分别列入参数合同 P1、遗留 P3、迁移 P3。 |
| Kimi：运行态无 P1，P1 全是文档漂移 | **不完整** | 漏掉 6 个可见但无效的参数、R 缓存泄漏和 reduced-motion 绕行。 |
| Kimi：休眠 key-fx、生产空转、采样副作用、V 4/5 | **接受** | 当前源码逐项可证，列入 P2/Track C 清单。 |
| Kimi：FX05 六项旧值都可能被 v3 存档覆盖 | **缩小范围** | `mergeSaved` 只按同名键覆盖；主要风险是 v4.1 沿用 `ripples:p9-v4-tuning`，浏览器现有同名值继续优先。用户重置可解除。 |

---

## 2. 已验证通过的合同

| 项目 | 当前结果 |
|---|---|
| 最终输入集合 | `A–Z + 3–8 + Space`，恰好 33 键 |
| 注册表 | 45 个历史 FX、33 个 active、33 个唯一 `soundKey` |
| 音频资产 | `public/sounds/` 恰好 33 个 MP3、SHA-256 全部唯一 |
| 录音/音效键集 | `useJam` 与 P9 最终键集一致 |
| 大小写与 Shift/Caps | 基于 `KeyboardEvent.code` 归一为同一小写 `soundKey` |
| auto-repeat | `e.repeat` 被过滤 |
| 表单/按钮/链接 | INPUT、TEXTAREA、SELECT、BUTTON、A、contentEditable 不被全局乐器劫持 |
| Space | 非编辑场景阻止页面滚动；按钮自身 Space 不被劫持 |
| 日食门控 | 13 个依赖日食、20 个可无音乐触发 |
| 声音优先 | 视觉被 `no-eclipse` 或 `capacity` 拒绝时，音效仍播放 |
| 月光 | active FX 的 `moonWrite` 全为 false；月光通道写入 0 |
| 水面白名单 | T/U/V 保持水面写入边界 |
| 并行预算 | local 20 / environment 16 / global 12；同效果另有 `batchLimit` |
| B | 最多 6 个声部，已生成批次不会因新击直接删除 |
| I | 结束位置提交到 `settledOffsets`，避免动画结束跳回 |
| M/P | 使用对象级提交、休眠与异地补生，不在日食边缘突然复现 |
| R | 使用真实花瓣位置作为 P 同款微光喷射原点 |
| F/K | 共用 `P9_PALETTE_24` 和相邻色插值 |
| 当前默认值 | E、Y、3、7、H 与 GL 球亮度均命中用户最后给定值 |
| 代码硬线 | P9 最大文件 173 行；各子目录不超过 8 文件 |
| 禁止依赖 | P9 未引入 wagmi / ethers / howler / tone |

---

## 3. P1 — Track C 前必须处理

### P1-1 可见参数与运行时断线

P9 面板会根据 meta 自动显示所有 active FX 参数，但以下 **6 个可见参数不会实际改变对应行为**：

| 面板项 | 根因 | 实际后果 |
|---|---|---|
| X / FX24 `hitGain`（连击退暗） | FX24 是 `bounded-envelope`，而 `reinforce()` 只处理 smooth/velocity/palette；水面又只取最强 `caustic-dark` voice | 连击可以延长覆盖，但不会按该滑块逐击加深 |
| Y / FX25 `damping`（回中阻尼） | 参数只在 `p9-params.ts` 定义；速度衰减仍硬编码为 `1.25` 与 `0.72` | 用户最后定稿的 `1.20` 不参与轨迹 |
| 6 / FX35 `hitGain` | FX35 是 `bounded-envelope`，不进入 `reinforce()` | “连击增益”滑块无效 |
| 8 / FX43 `gain` | FX43 是 `spawn-batch` | “单击补充量”滑块无效 |
| 8 / FX43 `ceiling` | FX43 是 `spawn-batch` | “连击上限”滑块无效；真正上限来自 `batchLimit` |
| 场景同族 `crossfade` | 全仓库只有 meta 定义，没有运行时读取 | “全屏交叉渐变”滑块无效 |

此外，playbook 把 B 的“首反馈上限 80ms”列入参数真值，但运行时直接把 `0.08` 写在 `P9StageOverlay.tsx`，面板没有该参数。这不是当前观感故障，但违反 Gate F5“统一参数真值”的合同。

关键证据：

- `src/components/pond-gl-test3/p9/runtime/p9-state.ts:67-85,114-124`
- `src/components/pond-gl-test3/p9/runtime/p9-sampler.ts:34-40`
- `src/components/pond-gl-test3/p9/consumers/p9-water.ts:14-16,31-35`
- `src/components/pond-gl-test3/p9/registry/p9-params.ts:38-52`
- `src/components/pond-gl-test3/p9/tuning/p9-tuning-meta.ts:41`
- `src/components/pond-gl-test3/p9/consumers/P9StageOverlay.tsx:21`

**建议**：先决定每项是“接线”还是“从面板删除”。对 Y/X 应优先接线，因为它们来自用户明确的连续点击反馈；6/8/crossfade 可结合实际审美决定保留参数还是精简。

### P1-2 权威 playbook 已不是当前真值

`playbook/phase-9/03-v4-33-key-audiovisual-remap.md` 仍自称最终映射与参数真值，但至少有三组过期内容：

1. **身份过期**：E 仍写“光晕凝光”，R 仍写“花瓣闪耀湮灭”；当前正式实现分别是“引力透镜轨道”和“花瓣原地炸裂”；
2. **参数过期**：E 六项、Y 三项、3 潮膜、F 共享 24 色、N 的 dwell/fade 模型均未同步；
3. **重触发模型过期**：合同只定义 5 类，注册表实际有 7 类；C/E/G/L/O/U、M/P、S/8 与 §5.2 不一致。

这会直接诱发“按旧合同修复正确代码”的风险，DeepSeek 的 E=P0 误报已经证明该风险真实存在。

**建议**：不要重写历史 v4 主体；追加一节“v4.1 最终附录”，明确：

- E/R 当前身份与参数；
- 7 种 retrigger 的真实语义和 33 键分配；
- 用户最后拍板的默认值；
- 被废弃参数与 Track C 清理边界。

### P1-3 最终 E/R 缺少可重复的自动浏览器回归

当前有效自动证据可证明旧 v4 的 33 键、20/13 门控、B 六批、A/Y 回落重按、Space 前线、56.52 FPS 与 0 控制台异常；但 `reviews/evidence/p9-v4-1/` 仍拍摄旧 E 光晕与旧 R 闪耀，时间早于最后的 E 透镜/R 原地喷射重做。

现有 `browser-audit.mjs` 对 reduced-motion 也只截图，没有数值断言；没有覆盖：

- 当前 E 透镜单击/连击/衰退；
- 当前 R 多批炸裂与最长重生；
- X/Y 参数接线后的连击；
- 同键 8 次/秒、两键交替、四键近同时；
- 全局重音跨键冷却；
- 最长余韵后的内存与幽灵实例。

用户目验“没问题”是有效审美结论，但不能替代防回归证据。Track C 或生产提升前应补一次最终自动验收。

---

## 4. P2 — 运行安全与连续演奏问题

### P2-1 R 的 `burstFields` 会按声部永久积累

`burstFields` 以 voice seed 为键。字段过期时间设置为“捕获时刻 + 效果时长 + 0.5s”，必然晚于 voice 自身结束；删除逻辑只在同一 seed 再次调用 getter 时执行。voice 结束后不再有消费者查询该 seed，因此每次 R 都会留下一个 Map 条目。

- 证据：`p9-petals.ts:12-18,119-124`
- 风险：短期很小，长时间高频演奏会持续增长，违反 G6“无持续内存增长”。
- 建议：在统一帧清理中过期删除，或让 getter 的过期时间不晚于 voice 生命周期。

### P2-2 reduced-motion 只部分生效

sampler 将 `motion` 降为 22%、channelEnergy 降为 35%，但多个消费者直接使用未缩放的 `energy/progress`。E 轨道角度直接以 `now * speed` 计算，开启减少动态效果后仍全速旋转；孢子、描摹等也保留完整 progress 运动。

- 证据：`p9-sampler.ts:31,64,78`；`P9StageOverlay.tsx:37-71`
- 建议：给 voice frame 提供统一的 reduced progress/motion policy，消费者禁止直接绕过。

### P2-3 没有真正的全局重音冷却

当前只有三类 voice 数量预算与 `globalLimit` 幅度上限，没有跨键的 global accent cooldown。连续敲 H/3/5/8 等全局或全屏效果时，新声部仍可重新 attack，直到达到 voice limit 后才提前释放最弱项。

- 风险：高密度演奏时全屏层可能连续重新起音，其他局部效果可读性下降；现有自动验收没有覆盖该压力模式。
- 建议：先用压力录像判断是否需要 150–300ms 的共享冷却；若加入，冷却期只允许抬高有限能量或延长余韵，不应吞掉声音。

### P2-4 V 允许 5 条声部，但只输出 4 条浪

FX32 `batchLimit=5`，`getP9QuietWaves()` 却固定 `slice(-4)`。第 5 次点击会被运行时接受并播放声音，但对应第五条静浪不进入渲染数据。

- 证据：`p9-params.ts:43`；`p9-water.ts:40-47`
- 建议：统一为 5；若性能或审美只要 4，则把面板和 spawn limit 一起改成 4。

### P2-5 FX44 使用双轨状态，语义不是“5 个独立群落”

FX44 注册为 `motes-colony + spawn-batch + batchLimit=5`。generic `spawnLimit()` 确实读取该上限，但 `p9-motes.ts` 没有消费 `motes-colony` mode；真正的群落位移来自 `p9-direction-lab` 监听 trigger 后写入一个全局 `state`。多次点击只是增加同一 state 的 `hits`，并不会产生 5 个独立空间群落。

同时 direction-lab 读取 `FX44.hitGain`，但 meta 没有该参数，只会永久使用 fallback `0.18`。

- 建议：Track C 时二选一：把 colony 正式并入 voice→frame→consumer；或明确它就是单一共享群落，并移除误导性的 spawn-batch/batchLimit 语义。

### P2-6 旧 key-fx 总线没有生产入口，但消费者仍常驻

全仓库没有 `emitKeyFx()` 调用者，P9 输入只触发 `triggerP9Effect()`；因此 key-fx 的 pulse 池正常情况下永远为空。但 FloatingMotes、SphereInstances、WaterDistort、GlEclipse 和 wake-field 仍采样或监听这条总线。

- 影响：结果通常为 0，不造成当前画面错误，但增加每帧工作和双系统认知成本。
- 建议：收入 Track C 引用审计；确认不再需要后整条删除，不能只删 emitter 或单个消费者。

### P2-7 正式首页 P9 关闭时，StageOverlay 仍每帧运行

`/` 与 `/test3` 共用页面组件，但 `p9Enabled` 仅在 pathname 为 `/test3` 时开启。生产 `/` 的 GlEclipse 仍挂载 `P9StageOverlay`，它会持续调用 `sampleP9()`、查询 SVG 子节点并写样式，即使 voice 永远为空。

- 建议：生产未启用 P9 前只在 `/test3` 挂载 StageOverlay，或在无 voice 时事件驱动休眠。

### P2-8 `sampleP9()` 是带副作用的多读者采样函数

`sampleP9Voice()` 会积分并改写 `velocity`、`renderedStrength`、`sampledAt`；当前 FloatingMotes、WaterPetals、GlEclipse、WaterDistort、P9StageOverlay 五处每帧调用。它们现在都使用 `performance.now()/1000`，后续调用 delta 接近 0，视觉基本稳定；但“所有消费者必须共享同一时钟”没有类型或断言保护。

- 风险：未来某处改成 R3F clock 或不同时间精度，会在同一帧重复推进或得到顺序依赖结果。
- 建议：拆成单入口 `advanceP9(now)` + 纯只读 snapshot，或至少缓存同一时间片结果并写明时钟合同。

---

## 5. P3 — 不阻塞的清理与文字问题

1. **存档迁移**：`V4_DEFAULT_KEYS` 有 `FX11.transition`、`FX23.gain` 重复；v4.1 未更换 storage version，已有同名调参值继续覆盖新默认。用户点击重置可解决，但正式发布前应决定是否做一次性版本迁移。
2. **遗留字段**：`P9EffectDefinition.key/shifted` 在当前 soundKey 调度中不再读取；Track C 可移除或明确只供历史展示。
3. **文件归属**：FX44 的 lane 是 motes，却定义在 `lane-scene.ts`；不影响运行，但降低注册表可读性。
4. **J 合同文字**：playbook 写“所有微光同步”，实现有每个微光 0–0.35s 稳定随机错峰。若目验认可，应改文字而不是强行同步代码。
5. **U 无音乐落点**：无日食时 `getShowcasePose()` 的稳定坐标使水滴反复落在同一点；符合当前合同，但若希望随机散布必须先改产品规则。
6. **结构容量**：`registry/` 已恰好 8 文件；12 个 deleted/empty FX 的 mode 分支仍冻结保留。新增文件或物理删除都应放在 Track C 的明确清单内。

---

## 6. 验证证据

### 6.1 本轮最终审查复核

- 当前静态审计：45 历史 / 33 active / 33 唯一 soundKey / 13 日食依赖 / 20 独立 / 月光写入 0；
- 音频：33 MP3 / 33 唯一 SHA-256；
- 参数引用与 retrigger reachability：逐项源码交叉检查；
- 运行时消费者：P9 registry/runtime/consumers/tuning、TestJam、useKeyboard、GlEclipse、WaterDistort、FloatingMotes、WaterPetals、key-fx 全链路复核；
- `git diff --check`：无空白错误。

### 6.2 完整工程验证

2026-09-01 当前工作树执行 `bash scripts/verify.sh`：

- TypeScript：通过；
- ESLint：0 error，6 个既有 warning；
- 代码文件/目录硬线：通过；
- 危险代码扫描：通过；
- Next.js 生产构建：通过，33 个页面生成完成；
- Forge：42/42 通过。

### 6.3 仍可沿用的旧浏览器证据

`reviews/evidence/p9-v4/v4-browser-audit.json` 仍可证明：

- 无音乐：33 次输入、20 accepted、13 no-eclipse；
- 日食模式：33 accepted / 33 unique；
- B 六批、Space 六前线；
- A/Y 回落重按无瞬间跳变；
- 前台 1440×900 平均 56.52 FPS；
- 最长等待后批次归零；
- 0 控制台异常。

但它不能证明最后重做后的 E/R，也不能证明本报告 P1/P2 项已经解决。

---

## 7. 推荐修复包与 Gate

### Fix Pack A — 真值与参数（必须先做）

1. 给 playbook 03 追加 v4.1 最终附录；
2. 接通或删除 6 个无效滑块；
3. 将 B 80ms 纳入参数真值，或从合同中明确移除“可调”要求；
4. 明确 7 种 retrigger 的最终键位表。

**Gate A**：每个面板滑块自动或人工改变一次，运行时数值与画面均有可观测变化；旧 playbook 不再会把 E/R 改回去。

### Fix Pack B — 连续演奏安全

1. 修 R `burstFields` 过期清理；
2. 统一 reduced-motion；
3. 统一 V 的 4/5 数量；
4. 拍板并实现或明确放弃全局重音冷却；
5. 统一 FX44 单状态或多 voice 语义。

**Gate B**：同键 8 次/秒持续 2 秒、两键交替 6 次/秒持续 4 秒、四键近同时、最长余韵后均无幽灵实例或持续内存增长。

### Fix Pack C — Track C 结构清理

1. 删除或重新接线休眠 key-fx；
2. 让 P9StageOverlay 在生产未启用时不空转；
3. 把 P9 推进与采样拆成单时钟、纯读取结构；
4. 清理遗留字段、文件归属、重复迁移键和确认删除的历史 mode。

**Gate C**：引用审计 0 悬挂入口；生产 `/` 无 P9 空转；完整 verify 全绿。

### Final Gate — 更新后的浏览器回归

必须新录/新测当前 E、R、X、Y、FX44、V、global accent、reduced-motion 和高密度和弦。通过后才可以把 P9 标为“工程收口”，再由用户单独决定是否提升到正式首页。

---

## 8. 最终边界

- 当前 E/R 视觉身份已冻结，除非用户重新做审美决定，不得因旧 playbook 回退；
- 本 review 不授权修改动画、不授权删除历史实现；
- 当前正式首页仍不触发 P9 视觉，这是既定生产门控，不是 P0；
- 用户下一项决策应是：**授权执行 Fix Pack A+B**，或只归档本 review、暂不进入 Track C。
