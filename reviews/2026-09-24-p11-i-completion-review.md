# P11-I 主线重放完成审查（2026-09-24）

## 结论

I0–I8 的自动施工与自动 Gate 已完成。代码从 `origin/main@9324386` 重放 G/H，并保留 main 上的 Score、日食、#36、播放器与永久资源合同。当前可以进入用户目验与交付决策；尚未 push、合并、部署、修改 Vercel 环境变量、清理 worktree/profile，也未修改 `docs/ARCHITECTURE.md`。

## 70-g §6

- [x] `/` 与 `/me` 共享唯一且不重挂的生产 PondGL/花瓣会话。
- [x] Water Core 与 Home Scene 已分层，Score 通过 SceneSlot 接入。
- [x] 音乐圆圈连续进退场，快速反向从当前进度收敛。
- [x] 水面、花瓣、pointer 与导航前涟漪连续。
- [ ] 档案真实账号数据、收藏播放、倒计时与铸造入口：代码/未登录自动 Gate 通过，真实账号只读目验待用户。
- [x] 直接访问、刷新、历史、快速反向、后台恢复通过。
- [x] fine/coarse/reduced-motion/no-WebGL 四类能力路径通过。
- [x] 20 次往返后 Canvas、FBO、listener、RAF、内存与音源趋稳。
- [ ] 完整验证与自动矩阵通过；真实账号体感目验待用户。

## 80-h §6

- [x] 自动范围内的 P11-G 通过，H 没有复制 Water Core。
- [x] `/me` 与 `/score` 使用同一 Canvas、水面、花瓣与 pointer 波场。
- [x] ready 唱片行与真实 Score 锚点可正反转换。
- [ ] processing/failed/direct-entry 自动夹具诚实降级；真实 processing/failed 数据待用户目验。
- [x] Score Audio/P9/永久输入隔离，离页 context/source/media 归零；真实播放采用 I6 证据。
- [x] Score 滚动、分享、凭证、永久 Decoder 与 fallback 自动 Gate 通过。
- [x] fine/coarse/reduced-motion/no-WebGL 能力路径通过。
- [x] 20 次往返后 Canvas、FBO、listener、RAF、内存与音源趋稳。
- [ ] 完整验证与自动矩阵通过；真实主网唱片肉眼验收待用户。

## B01–B18 复核

| 范围 | 自动结论 | 证据 / 待办 |
|---|---|---|
| B01、B07、B09、B12、B15、B17、B18 | 通过 | I2–I8 路由、四视口、阅读、fallback 与错误 Gate |
| B02–B05 | 核心动态合同通过 | I4 圆圈逐帧、I6 Score/P9；首页细节仍需用户与 I0 基准肉眼对照 |
| B06 | 未改 #36 产品实现 | 用户已决定两项额外修复悬置；视觉基准待确认 |
| B08 | 通过批准偏差 | 进入 Score 不停止全局播放器，只有 Score 真正 playing 才接管 |
| B10–B11 | 自动边界通过，真实数据待验 | 未登录零私人请求、唯一预备档案与控件隔离通过 |
| B13–B14 | 自动行为通过，肉眼待验 | I6 真实 playing/P9/日食序列；日食构图需用户确认 |
| B16 | 通过批准偏差 | Score 返回 `/me`，来源有效时恢复行/页码/滚动/焦点 |

## 已知限制与早上决策

1. 用真实账号只读完成 `/ → /me → /score/<ready Token> → /me → /`，检查 B10/B11 与锚点体感。
2. 肉眼确认 B02–B06 和 Score #1–#4 的 B13 日食构图；实机补 context lost → restore。
3. 决定 D-5 是否授权更新 `docs/ARCHITECTURE.md`。
4. 分别授权 push、快进合并 main、Production 部署与旧 worktree/profile 清理。

开发态无 WebGL 压力轮次曾出现热更新/网络失败和一次 client rendering recovery，但三路由最终可用，独立 production build 38/38 未复现；证据原样保留在 I8 JSON。

## 证据索引

- I0：`reviews/2026-09-24-p11-i-baseline.md`
- I2–I7：`reviews/evidence/p11-i/i2-gate.md` 至 `i7/i7-gate.md`
- I8：`reviews/evidence/p11-i/i8-gate.md`、`i8-continuity.json`
- 完整验证：I8 Gate 记录，production build 38/38、Forge 56/56。
