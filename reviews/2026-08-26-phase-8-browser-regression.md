# Phase 8 综合 Review — 浏览器回归证据

> 日期：2026-08-26
> 环境：Windows、Microsoft Edge Headless、Next.js dev server `127.0.0.1:3011`、全新临时 user-data-dir。
> 范围：`P8-RUN-01/02/03`、`P8-INT-01/02`、`P8-A11Y-01`、`P8-PERF-01` 相关浏览器语义。

## 结果总览

自动矩阵最终全部通过，运行期间没有未捕获异常或 error 级浏览器日志。

| 验证项 | 结果 | 证据 |
|---|---|---|
| `/test1`、`/test2`、`/test3`、`/test4` | ✅ | 四路由均 HTTP 200 |
| `forceFallback` | ✅ | Canvas 保持挂载，球 DOM 命中按钮为 0 |
| WebGL context lost / restore | ✅ | lost 后命中按钮立即为 0；restore 后恢复 35 个；Canvas DOM 身份不变 |
| 参数 UI wheel 边界 | ✅ | UI 内 wheel `defaultPrevented=false`；场景 wheel `defaultPrevented=true` |
| `pointercancel` | ✅ | 活跃拖拽命中 cancel 收尾；后续 pointer release 正常 |
| `lostpointercapture` | ✅ | 释放前 capture=true，事件后 capture=false |
| 键盘播放 | ✅ | 球按钮可聚焦；Enter 后 `aria-pressed=true`，Space 后恢复 false |
| reduced-motion | ✅ | 同一批 5 球、900ms 位移总量：reduce `5.297px`，no-preference `36.703px`；自动注入显著冻结，剩余为既有 d3 阻尼收尾 |
| 宽屏 | ✅ | `1200×700`，Canvas 尺寸一致，context 未丢失 |
| 手机竖屏 | ✅ | `390×844`，Canvas 尺寸一致，context 未丢失 |
| 手机横屏 | ✅ | `844×390`，Canvas 尺寸一致，context 未丢失 |
| 横竖屏往返 | ✅ | 回到 `1200×700` 后仍正常渲染，截图数据有效 |
| AutoDpr 降档与恢复 | ✅ | 基准 DPR `2` → 人工低帧率后 `1.5` → 关闭自动降配后恢复 `2` |
| waterFx 连续切换 | ✅ | 连续 4 轮关/开后仍是同一 Canvas，context 未丢失 |
| 浏览器运行时错误 | ✅ | 无 Runtime exception、无 error 级 Log entry |

## 验证边界

- context、DPR、DOM 语义、Canvas 身份和尺寸是自动断言，不是只看页面是否返回 200。
- reduced-motion 的少量残余位移来自进入测试前已有 d3 速度按阻尼自然停稳；切回 no-preference 后位移明显恢复，符合“不清零用户反馈、不积累爆发”的契约。
- 自动测试能证明 waterFx 反复切换不重挂 Canvas、无 context loss/运行时异常；Edge CDP 没有提供本场景可直接断言的 Three.js GPU geometry/material 计数，因此显存不增长仍以显式 `dispose()` 代码契约和后续人工 Performance 面板观察为辅。
- 自动截图确认各尺寸均有有效画面，但“涟漪是否主观上足够圆”“R3 水上球是否仍符合审美”“L 线全开是否活而不乱”仍是用户视觉 gate，不能由数值测试代替。

## 临时资源

- QA 脚本执行后已删除。
- 临时 Edge 进程已确认是 0。
- 执行层阻止递归删除 `.tmp-p9-edge-qa-p8-review`；该目录只剩 Edge 自动生成的 profile，已被项目现有 `.tmp-p9-edge-qa*/` Git/ESLint 规则忽略，不进入提交。
