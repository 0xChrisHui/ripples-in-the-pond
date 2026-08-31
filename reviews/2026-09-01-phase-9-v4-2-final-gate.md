# Phase 9 v4.2 最终 Gate Review

> 日期：2026-09-01  
> 范围：P9 最终 review Fix Pack A+B+C、`/test3` → `/` 同步、P9 状态浮窗移除  
> 结论：**本地工程与浏览器 Gate 全部通过，可以提升生产**

## 最终结论

- 正式入口严格为 33 个物理键、33 个唯一音效、33 个生产动画；12 个冻结候选与旧 key-fx 总线已物理退出。
- 20 个独立效果在未播放音乐时可触发；13 个日食依赖效果只跳过视觉，音效仍播放。
- `/` 与 `/test3` 共用同一 P9 演奏层和调参存档；截图所示 P9 状态浮窗已删除，`/test3` 的参数面板仍保留。
- 月光写入为 0；水面写入白名单仍只有 T/U/V。
- E“引力透镜轨道”和 R“花瓣原地炸裂喷射”维持用户最终拍板，不按旧版 review 回退。

## Review Fix Pack 收口

### A — 参数与合同真值

- B 的发射错峰参数真正接入运行时，默认 `0.08s`，首个孢子不等待。
- 删除 6 组无消费者历史参数及重复存档键；存档升级到 `ripples:p9-v4-1-tuning` 并兼容迁移 v4。
- V 与 FX44 并发上限统一为 5；Y 的回中阻尼只作用于 Y 的回中力与速度衰减。
- playbook v4.1 附录明确 E/R 身份、33 键真值、七类重触发语义和最终默认值。

### B — 运行时稳定性

- X/6 连击改为独立低强度补充声部，不再重启正在衰退的主包络。
- H/3 使用 180ms 全局重音冷却；同键延长、跨键弱叠加，8 不受阻塞，音效永不被视觉冷却吞掉。
- R 的炸裂场每帧清扫并在结束后归零；FX44 每次按键产生独立微光簇。
- 五个视觉消费者每个浏览器帧共享一次采样快照，状态 revision 变化立即失效。
- reduced-motion 仅把空间运动缩到约 22%，生命周期、提交、淡出和回收仍正常完成。

### C — 生产清理

- 正式注册表直接包含 33 个效果，不再保留 45 项历史注册后过滤的双重真值。
- 删除旧 `key-fx` 目录、方向实验状态、失效模式与对应消费者分支。
- 删除独立 P9 状态 HUD；参数面板继续由 `/test3` 独占。

## 自动证据

静态审计：

- registry `33`，unique sounds `33`
- requires eclipse `13`，independent `20`
- moon writers `0`，water keys `T/U/V`
- 七类重触发分组与 v4.1 playbook 完全一致

浏览器审计：

- 首页 HUD：不可见；首页 K 可触发、无日食 A 正确返回 `no-eclipse`
- 未播放音乐：`20 accepted / 13 no-eclipse`
- 播放音乐：`33/33 accepted`，动画 ID `33/33 unique`
- B：6 个独立批次；V：5 浪；FX44：5 簇；R：峰值 5 场，结束后声部与场均为 0
- X/6 连击：各保留 2 个独立声部
- 帧共享：浏览器 121 帧只执行 122 次采样，而不是按 5 个消费者重复推进
- reduced-motion 位移比 `0.21997`
- 压力测试：峰值声部 5，结束后声部 0、场 0
- 前台帧率 `60.24 FPS`，控制台异常 `0`

证据目录：`reviews/evidence/p9-v4-2/`

## 工程验证

- `bash scripts/verify.sh`：通过
- TypeScript：通过
- ESLint：0 errors
- 生产构建：33 条路由全部生成
- Forge：42/42 tests passed

## 发布 Gate

本 review 形成时，本地合并前 Gate 已通过。发布动作必须继续满足：

1. 在独立 worktree 合并最新 `origin/main`，避免混入当前工作区的 P12/auth 未提交改动；
2. 对合并结果再次完整运行 `scripts/verify.sh`；
3. 非强推更新 `main`，等待 Vercel Production 完成；
4. 对 `https://pond-ripple.xyz/`、`/api/ping`、首页 HUD 与键盘事件做线上冒烟。

## 生产发布结果

- 合并提交：`2c91db0`；Review Fix Pack 提交：`b4a0894`。
- 首次 `7bedccd` 因同一 SHA 先推功能分支，被 Vercel 去重为 Preview；没有把 Preview 成功误判为生产上线。
- 专用生产触发提交：`fe179b0870dae85394ac7cbe42fac6ca3ddec095`。
- GitHub deployment：`6188616947`，environment=`Production`，Vercel 状态 `success`。
- `https://pond-ripple.xyz/`：HTTP 200，部署后 `Age: 0`、`X-Vercel-Cache: PRERENDER`。
- `https://pond-ripple.xyz/test3`：HTTP 200；`/api/ping`：`ok=true`。

真实浏览器生产冒烟：

- 页面标题 `Ripples in the Pond`，33 动画提示存在。
- P9 状态浮窗不可见，首页 P9 调参面板不可见。
- 无音乐按 K：FX11 accepted；按 A：FX01 正确返回 `no-eclipse`。
- Runtime / console error：0。
- 证据：`production-smoke.json`、`production-homepage.png`、`production-smoke.mjs`。

**最终裁决：Phase 9 v4.2 工程、合并、Production 部署和线上冒烟全部通过。**
