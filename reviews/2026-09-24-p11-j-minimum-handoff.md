# P11-J 最小安全收口交接报告

> 日期：2026-09-24
> 分支：`claude/p11-i-replay`
> 收口策略：完成最小安全 Gate 后启动 P16；全量压力、组合矩阵与深度 review 延后
> 功能与证据提交：`a8c8026 feat(ui): 完成 Score 三向无缝换场`

## 交付内容

- 三个前景 Surface 共用一个路由事务：`stable → preparing → revealing → settling → stable`。
- `/me → /score` 在目标 visualReady 前保留档案、水面与交互权；网络等待不进入 View Transition 回调。
- `/score → /me` 恢复来源唱片行；`/score → /` 通过低权重“回到水塘”入口交回常驻首页。
- Back、Escape 快速反向、准备期换目标和失败生命周期都遵守最后一次意图；取消的迟到 RSC 不会重新带走用户。
- Water Core 保持在路由 Surface 外；普通换场不重挂 Core、Canvas 或 WebGL context。
- Score 永久档案使用深色半透明阅读层，Ledger 使用更深的局部表面，并保留 forced-colors 实色回退。

## 最小 Gate

| Gate | 结果 | 证据 |
|---|---|---|
| 三方向 warm/cold；VT/无 VT | 通过 | `reviews/evidence/p11-j/baseline/score-route-handoff.json` |
| 2 秒延迟来源页面、水面、Canvas 可见 | 通过 | 同上及 `cold-vt-archive-to-score-intent-1900.jpg` |
| Back、快速反向、换目标、失败恢复 | 通过 | `minimal-interactions.json`、`minimal-gate.md` |
| 离开 Score 无双播放器，音频资源清理 | 通过 | AudioContext `1→0`，source/media/Score-owned fetch `→0`，双播放器帧 0；真实 playing 另复用 P11-I I6 |
| Water Core、Canvas、context 普通路径不重建 | 通过 | Core/Canvas identity 单一，context/FBO 普通路径增量 0 |
| TypeScript、定向 ESLint | 通过 | 最终本地检查 |
| production build、现有 `scripts/verify.sh` | 通过 | 38/38 页面、Forge 56/56；仅验证期间临时绕开不可达 Google Fonts，随后恢复原文件哈希 |
| 生产数据只读 | 通过 | 产品写请求 0 |

## FBO 6→8 判定

fresh direct Score 没有渲染首页球层，因此相关两个 WebGL framebuffer 在首次回首页时才分配。该路径表现为一次性 `6→8`；Water Core、Canvas、WebGL context 身份不变，正常首页路径稳定为 8，循环中没有继续增长。这是合法 Scene 能力恢复，不是泄漏。用于强行提前分配 FBO 的临时代码已撤销。

## 已恢复的临时改动

- `app/layout.tsx` 的 Google Fonts 加载已完整恢复；工作区 blob hash 与本轮起点 HEAD 均为 `414d7d1db296070c4769ea71dd693afabf717a19`。
- `src/components/pond-gl-test3/water/composite/render-passes.ts` 没有产品 diff。
- 未安装依赖，未修改 Vercel 环境变量，未合并 main，未部署，未删除 worktree/分支/Edge profile。

## Deferred

1. 20 次以上压力循环。
2. fine/coarse/reduced-motion/forceFallback 等全能力组合矩阵。
3. offline、context loss、no-WebGL 的重复组合。
4. J5 四视口动态对比度采样与截图美化。
5. 深度代码 review 与证据美化。
6. 真实账号档案行恢复与日食人工目验、ARCHITECTURE D-5。

第 5 项必须在 P16 开始修改共享 `/me`、`/score`、Persistent Pond、路由事务或播放器生命周期前完成。

## P16 启动边界

- 正式 P16 工作树/分支必须从本次 P11 收口提交创建。
- 旧 `codex/p16-wip-snapshot` 只作为选择性迁移来源，不作为正式底座，也不整体合并。
- 可立即推进：合约、migration、钱包认证、自付 Gas、服务端管线。
- 暂缓共享前端大改：`/me`、`/score`、Persistent Pond、路由事务、播放器生命周期。

## 最终体验修正

- `/me → /score` 的隐藏目标面改为脱离文档流，移除固定中部落点；Hero 不再带遮罩，遮罩仅保留在永久档案。
- 移除会隐藏根页面的原生 View Transition 快照，改由现有 Surface 交叉淡入淡出，浏览器录屏 174 帧无黑帧。
- `/me` 返回后从 API 获得 verified 曲谱包身份，按 SHA-256 去重、并发 2 路预热全部小型 `ripples.score-package.v3`；离页会取消未完成请求。
- 点击唱片立即进入约 520ms 的 Score 加载外壳，真实服务端详情完成后接管；数据提前完成时不会人为等待。
- 用户已完成实际体感验收。只读证据 `reviews/evidence/p11-j/score-entry-position.json` 记录顶部进入、Hero/档案遮罩边界、0 黑帧、0 写请求；TypeScript 与定向 ESLint 通过。
- 用户决定 P11 合入 `main` 后冻结，暂不启动 P16。
