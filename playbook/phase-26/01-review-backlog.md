# P26 — 审核维修清单

> 本表承接 2026-11-14 全仓审核，42 项均已纳入范围，当前全部“待复核”，尚未开始维修。P1/P2/P3 为严重程度。完整触发、影响、证据与维修方向见 [审核报告](../../reviews/2026-11-14-full-code-review.md)。

开修时以当前代码重新复现，核对其他阶段是否已经修复；不要把审核中的定位行号当作永远不变的坐标。每次只推进一个独立小闭环。

| 编号 | 优先级 | 问题 | 状态 | 修复与验证记录 |
|---|---|---|---|---|
| R01 | P1 | 失败交易不能作为释放跨链铸造占用的充分证据 | 待复核 | 尚未开修；原定位 `src/lib/self-mint/reconcile.ts:62` |
| R02 | P1 | 长期未结束的开包订单会一直占住对账队首 | 待复核 | 尚未开修；原定位 `app/api/cron/process-score-pack/cycle.ts:14` |
| R03 | P1 | 升级固定在已知漏洞范围内的Next版本 | 待复核 | 尚未开修；原定位 `package.json:50` |
| R04 | P2 | 不要用当前持有人否定已经成功的铸造 | 待复核 | 尚未开修；原定位 `src/lib/self-mint/reconcile.ts:82` |
| R05 | P2 | 录音预览需绑定具体录音和可见页面 | 待复核 | 尚未开修；原定位 `src/hooks/useEventsPlayback.ts:26` |
| R06 | P2 | 预览前按按下时间排序录音事件 | 待复核 | 尚未开修；原定位 `src/hooks/useEventsPlayback.ts:41` |
| R07 | P2 | 拒绝钱包后保留ETH开包重试入口 | 待复核 | 尚未开修；原定位 `src/components/score-pack/ScorePackPanel.tsx:45` |
| R08 | P2 | 补足球数时不要重写正式曲目身份 | 待复核 | 尚未开修；原定位 `src/components/archipelago/sphere-config.ts:129` |
| R09 | P2 | 动态导入完成后注册按键前检查组件是否仍挂载 | 待复核 | 尚未开修；原定位 `src/components/animations-svg/SvgAnimationLayer.tsx:26` |
| R10 | P2 | 按最终屏幕坐标剔除平移或缩放后的旧版球体 | 待复核 | 尚未开修；原定位 `src/components/archipelago/hooks/use-sphere-sim.ts:168` |
| R11 | P2 | 持有人快照读取失败时应停止创建可分发空投 | 待复核 | 尚未开修；原定位 `app/api/airdrop/trigger/route.ts:108` |
| R12 | P2 | 把已计算的唱片队列分布写入健康响应 | 待复核 | 尚未开修；原定位 `app/api/health/route.ts:69` |
| R13 | P2 | OP收藏完成后同步更新本地等待状态 | 待复核 | 尚未开修；原定位 `src/components/music-catalog/claim/MaterialMintPanel.tsx:94` |
| R14 | P2 | 代码约束钩子需要识别实际app目录 | 待复核 | 尚未开修；原定位 `.claude/hooks/check-forbidden-imports.js:41` |
| R15 | P2 | 快照发布的 INSERT 触发器拒绝所有第二次修订 | 待复核 | 尚未开修；原定位 `supabase/migrations/phase-15/052_permanent_core_queue_and_snapshots.sql:385` |
| R16 | P2 | ETH 自付准备的每小时限额可被不同草稿并发穿透 | 待复核 | 尚未开修；原定位 `supabase/migrations/phase-16/058_score_token_counters.sql:87` |
| R17 | P2 | 订单弹窗应在异步内容挂载后接管键盘焦点 | 待复核 | 尚未开修；原定位 `src/components/mint/hooks/useMintDialogFocus.ts:8` |
| R18 | P2 | 充值后应重新读取余额而非复用永久交易计划 | 待复核 | 尚未开修；原定位 `src/hooks/useEthereumScoreMint.ts:40` |
| R19 | P2 | 开包详情与操作面板应共享同一份状态 | 待复核 | 尚未开修；原定位 `src/components/score-pack/PackView.tsx:17` |
| R20 | P2 | 恢复录音行时应还原已保存的自动开包选择 | 待复核 | 尚未开修；原定位 `src/components/me/archive/RecordingArchiveRow.tsx:55` |
| R21 | P2 | 不要把 noopener 的空返回值当成分享窗口被拦截 | 待复核 | 尚未开修；原定位 `app/(pond)/score/[id]/components/ShareActions.tsx:64` |
| R22 | P2 | 窗口缩小时同步 Score 播放球的物理边界和锚点 | 待复核 | 尚未开修；原定位 `app/(pond)/score/[id]/components/use-score-pond-sim.ts:113` |
| R23 | P2 | OP Sepolia 页面读取固定 OP 主网快照后重标资产身份 | 待复核 | 尚未开修；原定位 `src/data/score/multichain.ts:128` |
| R24 | P2 | 流式底轨结束后时间线无法推进到音效尾声结束 | 待复核 | 尚未开修；原定位 `src/features/score-playback/timeline-session.ts:73` |
| R25 | P2 | 永久 Score decoder 按按键时长计算结尾会截断音效尾音 | 待复核 | 尚未开修；原定位 `src/score-decoder/index.html:58` |
| R26 | P2 | 开关扭曲水面时遗漏手建 GPU 场景资源释放 | 待复核 | 尚未开修；原定位 `src/components/pond-gl/water/WaterDistort.tsx:108` |
| R27 | P2 | 重置 P9 场次时同步清理消费者提交缓存 | 待复核 | 尚未开修；原定位 `src/components/pond-gl-test3/p9/runtime/p9-state.ts:188` |
| R28 | P2 | 详情模式仍需记录拖动阈值，避免滑动被当成播放 | 待复核 | 尚未开修；原定位 `src/components/pond-gl-test3/overlay/SphereHit.tsx:66` |
| R29 | P2 | 为音乐圆保留 click 激活路径 | 待复核 | 尚未开修；原定位 `src/components/pond-gl-test3/overlay/SphereHit.tsx:99` |
| R30 | P2 | 持续低于 10fps 时也应触发自动降清晰度 | 待复核 | 尚未开修；原定位 `src/components/pond-gl-test3/auto-dpr.tsx:53` |
| R31 | P2 | 调整窗口尺寸后刷新聚类力缓存 | 待复核 | 尚未开修；原定位 `src/components/pond-gl-test3/spheres/gl-sim-setup.ts:142` |
| R32 | P2 | 修正星河塘底星点的阈值分支 | 待复核 | 尚未开修；原定位 `src/components/pond-gl-test3/shaders/pond-floor-shaders.ts:149` |
| R33 | P2 | 素材交易回滚后清除旧发送戳，才能执行重试 | 待复核 | 尚未开修；原定位 `app/api/cron/process-mint-queue/steps-helpers.ts:102` |
| R34 | P2 | 预算耗尽退出前撤销尚未上传的 Echo 账本占用 | 待复核 | 尚未开修；原定位 `app/api/cron/process-wallet-recipe/steps-metadata.ts:112` |
| R35 | P2 | 浏览器首枚验收完成后因 rm 未导入而总是异常退出 | 待复核 | 尚未开修；原定位 `scripts/p14/mainnet/audit-first-token.mjs:192` |
| R36 | P2 | 测试开包脚本允许把固定测试素材永久写入主网 Score | 待复核 | 尚未开修；原定位 `scripts/p22/e2e-open.ts:19` |
| R37 | P2 | 续传复用旧条目前应核对当前文件的内容哈希 | 待复核 | 尚未开修；原定位 `scripts/p22/upload-assets.ts:21` |
| R38 | P2 | 充值确认超时后应对账既有交易而非重跑转账 | 待复核 | 尚未开修；原定位 `scripts/arweave/topup-turbo.ts:76` |
| R39 | P2 | 把进入error状态的首声样本判为失败 | 待复核 | 尚未开修；原定位 `scripts/p15-i/measure-score.mjs:101` |
| R40 | P2 | 移除转场启动时重复注册的动画帧 | 待复核 | 尚未开修；原定位 `src/components/pond-shell/motion/use-route-presence.ts:36` |
| R41 | P3 | 在跳过注释前检测占位标记 | 待复核 | 尚未开修；原定位 `.claude/hooks/check-forbidden-imports.js:65` |
| R42 | P3 | 原型复制回调需在 await 前保存按钮节点 | 待复核 | 尚未开修；原定位 `references/visual-prototypes/p14-pond-echoes/app.js:72` |

## 记录规则

- 原始 R 编号保留；关闭时填写修复提交或文件位置、验证命令/证据、实际结果和未覆盖范围。
- “已修”与“已验证关闭”分开；已由其他改动修复仍需补验并链接对应记录。
- 条件性路径或未使用工具先记录适用范围；延期/接受风险由用户决定并留依据。
- 两项未调用第三方工具边界只作报告附录，未来触及时再决定是否追加维修任务。
