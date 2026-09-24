# P11-I2 Gate：共享水塘外壳

- 日期：2026-09-24；基底 `origin/main=9324386`，I-D1 断言 BASE_OK、落后 0。
- 范围：`app/(pond)/layout.tsx`、`app/(pond)/page.tsx`、`app/me/**` → `app/(pond)/me/**`（URL 不变）、`src/components/pond-shell/`（PersistentPondShell / PersistentWaterCore / pond-shell.css）、`PondExperience.tsx`、`use-gl-sim.ts`；`/score` 仍在共享外壳之外。
- 参考：`codex/p11-main-baseline@8603008`，逐文件手工整合，未 cherry-pick。

## 实现要点

- 共享 Layout 挂载唯一 `PersistentPondShell`；首页与 `/me` 共用同一个 Water Core（PondGL）。
- `useGlSim(initialized, externalPlaybackActive, interactive)`：首页 Scene 初始化后长期保留节点与涟漪桥；离开首页只收回键盘切组、分组点击等交互权。
- 正式 `/me` 不再创建自己的 PondGL；`/me/test`（`showControls=true`）保留独立沙盒路径。
- 外壳提供只读诊断属性 `data-pond-mount-id`、`data-pond-scene-owner`；生产没有调试面板。

## Gate 结果

| 项 | 结果 | 证据 |
|---|---|---|
| `/ → /me → /` ×3：mountId、外壳节点、首个 Canvas 引用不变 | ✅ 6/6 快照同一 mountId，`sameShell=true`、`sameCanvas=true`、Canvas ≤2 | `i2-continuity.json` |
| 直接访问 `/me`、刷新 `/me` | ✅ 均落在 `/me`，GL `healthy` | 同上 |
| 无 WebGL（`forceFallback=1`）进入 `/me` | ✅ `glHealth=forced`，页面可用 | 同上 |
| TypeScript | ✅ | `verify.sh` 第 1 段 |
| ESLint | ✅ 0 error / 3 既有 warning（首轮 EPERM 已按 E054 修复后单独重跑） | `npm run lint` |
| P15 H1–H7、Production readback、Instant Start | ✅ | `verify.sh` 2b–2g |
| 文件 ≤220 行、目录 ≤8、危险扫描 | ✅ | `verify.sh` 3–5 |
| 生产构建 | ✅ 38/38（本机 Google Fonts 不可达，按用户批准临时移除字体初始化，结束后恢复，`app/layout.tsx` 无 diff） | `verify.sh` 6 |
| Forge | ✅ 56/56 | `verify.sh` 7 |

## 未覆盖与原因

- 首页 B01–B08 的动态逐项对照：自动浏览器 WebGL 在连续采样中不稳定，I0 基准本身缺少 B02–B06 动态序列。本步结构断言说明首页 Scene 未重建；动态肉眼对照列入晨报早上待办。
