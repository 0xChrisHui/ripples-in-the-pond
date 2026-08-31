# Phase 9 系统性 Review（TRAE）

> 日期：2026-09-01
> 对象：P9「日食合奏按键动画」33 键声画映射系统
> 权威契约：`playbook/phase-9/03-v4-33-key-audiovisual-remap.md`
> 结论：输入接线 / 33 键映射 / 门控 / 数量账本 / 文件硬线全部正确；但存在 1 个规格违背（P0）与 2 类需用户裁决的偏差（P1），集中在 remap 后的「注册表收口」未完全到位。

---

## 一、总览

| 维度 | 结果 |
|---|---|
| 33 键唯一映射 | ✅ 33 active / 33 唯一 soundKey / 45 历史 |
| `requiresEclipse` 门控 | ✅ 13 true / 20 false，与 §4.1 一致 |
| 月光写入 `moonWrite` | ✅ 全 0 |
| 输入合同 §3.3 | ✅ 全部满足 |
| 并行预算 | ✅ VOICE_LIMIT / softenBudget / spawnLimit |
| 文件硬线（220 行 / 8 文件） | ✅ 最长 p9-motes.ts 173 行；registry/ 恰 8 文件 |
| 禁止依赖 | ✅ 无 wagmi / ethers / howler / tone |

---

## 二、P0 — 规格违背（阻断）

### P0-1 · FX05（键 E）实现与权威映射不符

playbook §3.2 规定 **E = FX05 = 光晕凝光（halo-bright，不改半径只凝聚增强）**，§7 给参数「凝光亮度 1.35 / 密度增益 1.25」。

但代码仍是 pre-v4 旧效果：

- `src/components/pond-gl-test3/p9/registry/lane-eclipse.ts:8`

```typescript
defineP9Effect(5, '引力透镜轨道', 'eclipse', 'lens-orbit'),  // 应为 '光晕凝光' / 'halo-bright'
```

**后果**：
1. 按 E 实际渲染「引力透镜轨道」（旋转椭圆轨道），而非规格要求的「光晕凝光」。
2. `consumers/p9-eclipse.ts` 中 `halo-bright` 分支成为死代码（无任何 active 效果使用该 mode）。
3. `registry/p9-params.ts` 的 `#5` 参数仍是 `orbit/asymmetry/speed/...`，与 §7 的「凝光亮度/密度增益」完全不符。
4. 直接与 `reviews/2026-08-31-phase-9-v4-1.md` 声称的「E 光晕增强新增增强倍率 7.5×」相矛盾——说明该改动在完成后被覆盖回了旧值。

这是唯一一个打破「33 键 / 33 音效 / 33 动画一一对应」硬承诺的点。

---

## 三、P1 — 需用户裁决的偏差

### P1-1 · retrigger 模型与 §5.2 冲突（约 10 处）

playbook §5.2 只列 5 种模型且仅覆盖 32 键（漏 I），代码 `P9Retrigger` 实际有 7 种。逐键比对：

| 键 | 代码实际 | §5.2 声称 |
|---|---|---|
| C / G / L / O / U | `smooth-accumulate`（继承默认） | `bounded-envelope` |
| M / P | `one-way-commit` | `object-cycle` |
| S | `spawn-batch` | `object-cycle` |
| 8 | `spawn-batch` | `bounded-envelope` |

**关键**：§5.2 与 §6.x 细则本身自相矛盾。例如键 8：§5.2 归入 bounded-envelope，而 §6.2 描述「每击从随机方向发出独立前线、多方向叠加、不覆盖活前线」——这是 spawn-batch 行为，代码正是如此实现。

**判断**：C/E/G/L/O/U 这 6 个是 remap 时未在 lane 文件显式补 `retrigger: 'bounded-envelope'`，落回默认 `smooth-accumulate` 的实现缺口；S、8、M、P 更可能是 §5.2 表写错。**以 §5.2 表 / §6.x 细则 / 现状代码何者为真值，需用户拍板。**

### P1-2 · 参数默认值与 §7 不符（Y、R）

- **Y**：§7 写「单击偏心冲量 0.08 / 回中阻尼 0.82」，代码 `p9-params.ts` 为 `hitGain 0.3 / damping 1.2`，且多出 §7 未列的 `amount`（偏心幅度 2）。
- **R**：§7 写「湮灭比例 0.10 / 闪耀强度 1.5」，代码为 `ratio 0.1 / launchBoost 2`，无「闪耀强度」参数，也与 v4.1 声称的「闪耀倍率 7.5×」不符。

---

## 四、P2 — 坏味道 / 小问题

1. **死字段**：`registry/p9-types.ts` 的 `key` / `shifted` 被计算但 v4 起无人读取（主键已是 `soundKey`），且 legacy 编号会产生重复 `key`。
2. **FX44（键 5 微光群落）走旁路**：通过 `runtime/p9-direction-lab.ts` 的全局 `window` 事件监听 + 独立计时实现，未走 voice→frame→consumer 管道；`#44` 的 `batchLimit` 从未被读取（无并发上限），代码读的 `FX44.hitGain` 又不在 `#44` meta（恒 fallback 0.18）。
3. **B 首反馈 80ms 硬编码**：§7 列为参数，但 `consumers/P9StageOverlay.tsx` 写死 `0.08`，面板不可调。
4. **文件组织**：FX44（`lane: 'motes'`）定义在 `lane-scene.ts` 而非 `lane-motes.ts`。
5. **重复项**：`tuning/p9-tuning-store.ts` 的 `V4_DEFAULT_KEYS` 中 `FX11.transition`、`FX23.gain` 各出现两次（Set 去重后无害）。

---

## 五、合规确认项（无问题）

- 33 active / 33 唯一 soundKey / 45 历史，`registry/index.ts` 运行时校验正常。
- `requiresEclipse` 13 true / 20 false 与 §4.1 完全一致；`moonWrite` 全 0。
- 无音乐门控逻辑正确（`runtime/p9-state.ts`，依赖效果只跳视觉、不报错、不排队）。
- 输入合同 §3.3 全部满足：`normalizeKey` 大小写归一、`e.repeat` 过滤 auto-repeat、Space `preventDefault`、`isEditableTarget` 防表单/按钮劫持。
- 并行预算存在（`VOICE_LIMIT` / `softenBudget` / `spawnLimit`）。
- 硬线合规：最长文件 `p9-motes.ts` 173 行 < 220；`registry/` 恰 8 文件；无禁止依赖。

---

## 六、建议下一步

1. 先修复 P0-1（FX05/E 改回「光晕凝光」，补齐 `#5` 参数 meta 的 `density`/`impact`）。
2. 与用户逐项对齐 P1-1 的 retrigger 真值（§5.2 表 vs §6.x 细则 vs 现状代码）。
3. 同步修正 P1-2 的 Y/R 参数默认值，并更新 §5.2 表与 §7 的对应项。