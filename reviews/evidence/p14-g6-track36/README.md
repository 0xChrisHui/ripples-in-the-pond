# P14-G6 ECHO #1 首页浏览器验收证据

日期：2026-09-12
环境：本地 Next.js Development `http://localhost:3014/`，Edge Headless + SwiftShader，CDP `9336`。

## 本轮结论

本轮功能矩阵已经跑到恢复态，以下项目有真实浏览器断言和截图：

| 项目 | 结果 | 证据 |
|---|---:|---|
| featured API 503 时严格 35+0 | ✅ | `smoke-no-featured-35+0.png` |
| 35+0 下 B/C 切组仍各 35 个 regular | ✅ | CDP 断言；同上截图为 C 组 |
| 768×1024 为 35+1、无横向溢出、命中区 ≥44px | ✅ | `smoke-tablet-768x1024.png` |
| 35+1 下 B/C 切组仍各 35 regular + 唯一 ECHO | ✅ | CDP 断言；平板截图为 C 组 |
| 768×1024 → 1024×768 resize | ✅ | `smoke-resize-1024x768.png` |
| resize 不重建目标 Canvas/WebGL context | ✅ | `sameCanvas=true`、`sameContext=true` |
| reduced-motion 静止 | ✅ | 1.2 秒位置差 `0px` |
| ECHO 按钮 Enter / Space 各激活一次 | ✅ | `smoke-reduced-motion-keyboard-768.png`、点击计数 `1/1` |
| `forceFallback=1` CSS 兜底可见、64×64 可点击 | ✅ | `smoke-forced-webgl-fallback.png` |
| 退出强制兜底后恢复 35+1 + WebGL | ✅ | `smoke-webgl-recovered-768.png` |
| A/B/C 的 35 个 regular id 唯一，ECHO 唯一且不进 links | ✅ | `npx tsx scripts/p14/test-track36-visitor.ts` |
| 普通 Track ↔ ECHO 双向停止合同 | ✅ | 同一定向测试的源码合同断言 |

正常态 DOM 中有一个 WebGL Canvas 和一个水面花瓣 2D Canvas；resize 前后总数稳定为 2，且目标 WebGL Canvas/context 身份均未变化。强制 fallback 时花瓣层卸载，总 Canvas 数为 1。

## 最终矩阵补跑

源码稳定后以全新页面补跑，`matrix-results.json` 已生成，功能断言、应用 console error=0、mutation method=0 全部通过。矩阵用确定性 featured DTO 隔离 OP Sepolia RPC 波动；链上身份、metadata quorum 与真实 clip 字节不由该 fixture 代替，分别由 `verify-featured-echo.ts --live` 和真实播放 smoke/soak 验证。

Edge 内建 MetaMask/Base Account 会输出 `MaxListenersExceededWarning`、`ObjectMultiplex` 与 COOP 检查失败；脚本只把已识别的 COOP 第三方消息降为 warning，React/runtime exception 和其余 console error 仍严格失败。`THREE.Clock` 是既有弃用 warning，不属于本次回归。

## 脚本

- `g6-browser-matrix.mjs`：35+0、B/C、768、resize、reduced-motion、Enter/Space、forced fallback、恢复、console 与 mutation method。
- `g6-soak.mjs`：生产候选地址 30 分钟资源/FPS/Canvas soak，并在前 5 分钟完成 ECHO 自然 ended。
- `scripts/p14/browser-track36-smoke.mjs`：桌面 20 次播放/停止、日食、P9、真实 ECHO 播放、375 与 fallback 主矩阵。
- `scripts/p14/test-track36-visitor.ts`：A/B/C 唯一 regular fixture、35+0/35+1、links 隔离、路径、reduced-motion 与双向互斥合同。

## 不纳入最终通过证据

建议删除或提交时排除以下文件：

- `smoke-matrix-failure.png`：失败/中断轮次的现场图。
- `smoke-failure.png`：旧主矩阵失败现场图。
- `home-1440-after8s.png`、`home-375-after8s.png`、`home-375-after8s-swiftshader.png`、`test3-1440.png`、`test3-1440-after8s.png`：早期 MSTR/旧身份阶段截图，不能证明纠正后的 ECHO #1 合同。

其余 `smoke-*.png` 必须结合对应脚本断言和运行日志使用；单张截图不代表动态 Gate 完成。
