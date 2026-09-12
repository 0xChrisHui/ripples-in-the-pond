# P14 F3 — 播放器与档案页浏览器验收

时间：2026-09-11（Asia/Shanghai）
环境：Windows、本机 Edge 138 headless、OP Sepolia 真实合约与测试数据库。

## 结论

- 三枚真实测试作品均按各自链上 recipe 从第 1 段连续播放到第 36 段，三次均进入
  `ended`，总实播约 13.5 分钟；结果见 `browser-audit.json`。
- 375 / 390 / 768 / 1024 / 1440 px 均完成详情页验收；播放按钮至少
  148×44 px，当前段仅有一个 DOM 标记，`aria-live=polite`，未依赖 Canvas/WebGL。
- 冷启动五档视口均小于 12 秒；缓存后重载 2.661 秒；首个控制反馈约 5.9 毫秒。
- 单一永久网关失败仍可进入 `ready`；三网关无共识进入明确错误态。
- 播放中离开路由后，36 个 source 均释放、pending fetch 为 0、AudioContext 为
  `closed`。20 次快速播放/暂停的 heap 增量约 2.83 MB，且三次长播结束 heap
  没有单调增长。
- 首页入口、空持有、当前持有、已转出、启用前、制作中与需人工核验状态均有截图；
  reduced-motion 三档视口均命中且动画为 `none`。

## 证据索引

- `browser-audit.json`：三枚真实 recipe 的 36/36 顺序长播结果。
- `browser-expanded.json`：布局、可访问性、性能、故障降级、离页清理与状态矩阵。
- `echo-*-ended-768.png`：三次长播完成画面。
- `echo-2-playing-*.png`：五档视口播放中画面。
- `archive-processing-*.png`、`archive-failed-*.png`：制作中与恢复提示状态。
- `home-*.png`、`archive-W*.png`：入口和真实账户关系状态。

## 能力边界

浏览器自动化无法真实触发手机锁屏、蓝牙耳机拔插或操作系统音频中断，因此这三项只记为
软验收，不冒充真机通过。`processing` / `failed` 画面使用测试浏览器网络拦截注入符合接口
schema 的状态；对应的真实链上及数据库状态转换由 F2 集成证据覆盖。
