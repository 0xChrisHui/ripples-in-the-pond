# Phase 7 C1 Lighthouse Baseline（修前）

日期：2026-05-14
范围：Track C 起点 baseline，用于 C3-C7 优化后在 C8 重跑对照。

## 环境

- 测试地址：`http://localhost:3000`
- 服务状态：复用已在 3000 端口运行的本地 Next server（`/api/ping` 返回 ok）
- Lighthouse：`npx lighthouse` 临时使用 v13.3.0
- 跑法：4 页 × desktop/mobile × 2 次
- Raw 输出：`reviews/lighthouse-c1-raw/`

注意：Windows Chrome 临时目录清理阶段出现过 `EPERM`，但报告 JSON 已写出并可解析；本报告按 JSON 内容统计。

## 页面范围

| 页面 | URL | 说明 |
| --- | --- | --- |
| home | `/` | 首页 / 群岛浏览入口 |
| me | `/me` | 个人页；本轮为本地当前会话状态下 baseline |
| score-12 | `/score/12` | 已铸造乐谱详情页 |
| artist | `/artist` | 艺术家页 |

## 有效样本均值

单位：FCP / LCP / TTI / Speed Index 为秒，TBT 为毫秒。

| 页面 | 设备 | 有效 run | 失败 run | Score | FCP | LCP | TTI | TBT | CLS | Speed Index |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/artist` | desktop | 1,2 | none | 59 | 0.39 | 7.28 | 19.68 | 275 | 0 | 4.83 |
| `/artist` | mobile | 1,2 | none | 43 | 1.53 | 43.34 | 119.34 | 2664 | 0 | 4.63 |
| `/` | desktop | 1,2 | none | 60 | 0.36 | 5.36 | 19.55 | 227 | 0 | 7.65 |
| `/` | mobile | 1,2 | none | 36 | 1.38 | 26.85 | 133.64 | 2328 | 0 | 21.16 |
| `/me` | desktop | 1,2 | none | 71 | 0.34 | 15.84 | 16.00 | 163 | 0 | 1.25 |
| `/me` | mobile | 1,2 | none | 44 | 1.38 | 102.09 | 118.88 | 2738 | 0 | 4.09 |
| `/score/12` | desktop | 1 | 2 | 54 | 0.40 | 15.65 | 20.72 | 275 | 0 | 5.79 |
| `/score/12` | mobile | none | 1,2 | — | — | — | — | — | — | — |

## 失败样本

`/score/12` 在 3/4 次 Lighthouse 中返回 500：

- desktop run2：500
- mobile run1：500
- mobile run2：500

Lighthouse 原始 warning：

> Lighthouse was unable to reliably load the page you requested. Make sure you are testing the correct URL and that the server is properly responding to all requests. (Status code: 500)

这不是性能均值样本，而是可用性 baseline finding。后续 A10 / C3 相关工作需要先保证详情页在 Lighthouse mobile 环境下可稳定返回，再比较性能。

## 主要结论

1. **最慢 LCP：`/me` mobile = 102.09s**  
   这和已知悬空 TODO 对齐：`/api/me/scores` 仍联 `events_data`，草稿多时首屏会被大 JSON 拖慢。C3 应优先拆成首屏主信息 + 播放时单独 fetch events。

2. **首页 mobile 体验分最低：Score 36 / Speed Index 21.16s / TTI 133.64s**  
   C5 首页慢网占位、C6 字体加载优化、C7 route transition/loading skeleton 都应以 mobile 首页为核心观察点。

3. **艺术家页 mobile LCP 43.34s，TTI 119.34s**  
   说明问题不只在 `/me` 数据接口，移动端 JS 执行和首屏资源也需要优化。

4. **desktop 指标不是主要瓶颈，但 LCP 仍偏高**  
   `/me` desktop LCP 15.84s、`/score/12` desktop LCP 15.65s，说明详情/个人页服务端数据加载仍会影响桌面首屏。

5. **CLS 全部为 0**  
   当前 layout stability 不是 Track C 优先矛盾，优化重点应放在数据拆分、首屏加载状态、资源体积和 mobile TBT/TTI。

## C2 建议目标

建议 C2 讨论时先定这组目标：

| 页面 | mobile Score | mobile LCP | mobile TTI/TBT | 备注 |
| --- | ---: | ---: | ---: | --- |
| `/me` | ≥ 60 | < 10s | TBT < 1500ms | C3 拆 `/api/me/scores` 后应明显改善 |
| `/` | ≥ 55 | < 8s | TBT < 1500ms | C5-C7 核心目标 |
| `/artist` | ≥ 55 | < 12s | TBT < 1800ms | 先做通用资源/transition 优化 |
| `/score/12` | 先 0 次 500 | < 10s | TBT < 1500ms | 先修稳定性，再谈性能 |

## 后续动作

- C2：基于本报告确认目标值。
- C3：拆 `/api/me/scores` 首屏数据和 events 数据。
- C5-C7：补首页慢网占位、字体加载优化、路由 loading skeleton。
- C8：按同样 4 页 × desktop/mobile × 2 次重跑，对比本报告。
