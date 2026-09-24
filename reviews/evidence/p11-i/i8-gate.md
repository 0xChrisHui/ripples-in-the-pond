# P11-I8 自动总验收 Gate（2026-09-24）

## 结果

- `scripts/p11/pond-continuity.mjs`：通过。
- 首页 `/ ↔ /me` 20 次往返、档案 `/me ↔ /score/1` 20 次往返：Water Core、Canvas、花瓣、WebGL context 与 FBO 身份稳定。
- GC 后趋势：heap `+1,111,572 bytes`、DOM nodes `-6`、listeners `-7`；最终 RAF、active fetch、AudioContext、AudioBufferSource 与 media 全部回到基线。
- Back/Forward、首页与 Score 动画中反向、后台/前台、断网恢复、forceFallback、真实 context loss 与 `--disable-webgl` 三路由通过。
- 375/768 coarse、1024 fine、375/1024/1440 reduced-motion 能力矩阵通过；所有样本无横向溢出。
- 同源写请求为 0；私人接口只由只读 fixture 响应。

## 实现期修复

- Score 转场的 `Promise.race` 现在会在所有终态释放 31 秒 deadline、kick timer 和递归取消 RAF。
- 浏览器 Back 可在来源仍为 `forward` 时进入 returning，避免快速反向留下半张唱片。
- HTML 底曲销毁时移除自身 `error` listener。

## 证据边界

- I8 外部媒体在本轮没有稳定进入真实 playing；真实 playing、P9、pause/resume/ended/replay 采用 I6 已通过证据 `i6/i6-score.json`，I8 另验证音频上下文建立后立即离页全部归零。
- 无界面 Edge 能触发真实 context loss 并显示静态夜塘，但驱动不发原生 restored；恢复保留实机目验。
- `--disable-webgl` 下 `/`、`/me`、`/score/1` 均为 0 Canvas、静态夜塘可见、无横向溢出。
- 无 WebGL 的开发态压力轮次记录到热更新/网络失败与一次 client rendering recovery；三路由最终均可用，随后独立 production build 38/38 未复现，保留为开发态非阻塞日志。
- 真实账号 B10/B11、真实 processing/failed 行、日食肉眼构图与完整体感仍待用户只读验收。

## 完整验证

- TypeScript：通过。
- ESLint：0 error，3 个既有 warning。
- P15 H1–H7、readback、Instant Start、规模与危险扫描：通过。
- Production build：38/38。
- Forge：56/56。
- Google Fonts 仅在本地验证时临时绕过，随后恢复；`app/layout.tsx` 无差异。
