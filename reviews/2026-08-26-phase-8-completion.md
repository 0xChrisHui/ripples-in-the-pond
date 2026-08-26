# Phase 8 完结报告

> 日期：2026-08-26
> 范围：水塘视觉重设计、P8-L 生命感、R3 真透明、综合 Review 修复、首页迁移。

## 结论

Phase 8 正式完结。用户已确认 R3 最终目验与 L 线“活而不乱”目验合适，并明确批准当前 `/test3` 体验替代首页。

## 最终路由

| 路由 | 角色 | 搜索引擎 |
|---|---|---|
| `/` | 正式 GL 水塘首页 | 正常收录 |
| `/v1` | 旧 SVG 首页存档 | `noindex` |
| `/test3` | 当前 GL 调参/诊断沙盒 | `noindex` |
| `/test4` | `/test3` 兼容入口 | `noindex` |
| `/test1`、`/test2` | 历史基线与参考实验页 | 保留 |

正式首页与 `/test3` 复用同一实现；正式路由隐藏 ScenePanel、TunePanel、LifePanel、RippleSpikePanel、PerfHUD 和 sandbox 标题，避免视觉分叉。

## 完成范围

- P8-L 十项生命感实现、调参、默认值迁移与“活而不乱”用户验收；
- R3 真透明三 pass 合成、水上实体覆盖、水下折射与最终视觉验收；
- 综合 Review 的 3 个 P1、7 个 P2、死文件、文档契约与双树归宿全部关闭；
- GL health、context lost/restore、动态高度场、UI wheel 边界、reduced-motion、AutoDpr 恢复、拖拽取消与键盘操作完成回归；
- `/` 正式切换 GL，旧 SVG 稳定迁移到 `/v1`；
- 当前 `/test3` 已集成的按键编舞随用户批准的整体体验进入首页，后续 P9 候选扩展仍归 Phase 9。

## 验证证据

- `scripts/verify.sh` 全通过：TypeScript、ESLint（0 error，3 条既有 warning）、文件/目录硬线、危险扫描、生产构建；
- Foundry：42/42；
- 浏览器矩阵：`reviews/2026-08-26-phase-8-browser-regression.md`；
- 双树归宿：`reviews/2026-08-26-phase-8-dual-tree-inventory.md`；
- 首页烟测：`/`、`/v1`、`/?legacySvg=1` 均为 200；只有 `/v1` 返回旧 SVG 且带 `noindex`。

## 接受的非阻塞观察项

- 实体触屏的 pinch 手感尚无物理手机数据；桌面尺寸与横竖屏 Canvas/命中对齐已自动回归。
- 弱 GPU 上 AutoDpr 对 FPS 的实际提升尚无物理设备量化；降档、恢复与 Canvas 基准状态转换已验证。
- 旧 SVG 不删除是产品决定：它作为 `/v1` 存档存在，不属于 P8 技术欠债。
- 已铸造视觉记号和 I3 新组件属于未来增强，不再阻塞 P8。

以上观察项由用户在要求“正式完结 P8”时接受，不保留 P8 开放任务。
