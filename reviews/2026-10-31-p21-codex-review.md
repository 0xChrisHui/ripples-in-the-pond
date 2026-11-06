# P21 /lens Codex 审查记录（2026-10-31）

审查工具：`codex review`（codex-cli 0.163.0，模型 gpt-5.6-luna，reasoning high）。
两轮审查：①`--base main`（分支已提交部分）②`--uncommitted`（悬停 / 边缘修改）。原始输出为完整对话记录，未入库。

## 第一轮（已提交部分）

| 级别 | 位置 | 问题 | 处置 |
|---|---|---|---|
| P2 | `src/features/lens/use-lens-deeplink.ts` | 离开 `/lens` 后 `written` 未重置，再次进入同一 `?track=N` 不重新选中 | 已修：离开时重置；门禁 `scripts/ui/lens/regression-gate.mjs` 已验证（撤掉修复门禁即失败） |
| P2 | `src/components/pond-gl-test3/overlay/SphereHit.tsx` | 球的 `onBlur` 无条件清键盘选中，焦点进入面板时面板合上，键盘够不着 | 已修：焦点转入面板时保留选中；面板 `onBlurCapture` 在焦点离开面板到别处时清除；门禁已验证 |

附带修复（审查过程中门禁发现）：离开 `/lens` 时 veil 残留上一次的 `data-lens-target` / `data-lens-locked`，门禁读到的是旧值。已在离开时清空。

## 第二轮（未提交部分）

| 级别 | 位置 | 问题 | 处置 |
|---|---|---|---|
| P1 | `SphereHit.tsx:101-104` | 同 P2 焦点问题（审查时读到的是修复前的代码） | 已在第一轮修复中解决，键盘门禁通过 |

## 验证

- `tsc --noEmit`、ESLint（`src/features/lens`、`overlay`）通过
- 单测：`lens-geometry`、`lens-hover` 通过
- 浏览器门禁：`browser-gate` 14 项、`playback-gate`、`hover-gate`、`edge-gate`、`regression-gate` 全部通过
