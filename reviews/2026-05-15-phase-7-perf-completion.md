# Phase 7 C8 性能对比报告

日期：2026-05-15
范围：Track C C3 / C5 / C6 / C7 完成后的修后对照。

## 环境

- 测试地址：`http://localhost:3000`
- 跑法：沿用 C1 baseline，4 页 × desktop/mobile × 2 次
- Raw 输出：`reviews/lighthouse-c8-raw/`
- 修前 baseline：`reviews/2026-05-14-phase-7-perf-baseline.md`

注意：本机 Windows Lighthouse 仍会在 Chrome 临时目录清理阶段报 `EPERM`。本次 raw JSON 主体可被 Node 正常解析，`metrics-summary.json` 已按 JSON 内容重新生成；`/score/12` 的 4 次样本因页面返回 500 / performance category 缺失，记为失败样本。

## C1 → C8 指标对比

单位：FCP / LCP / TTI / Speed Index 为秒，TBT 为毫秒。

| 页面 | 设备 | C1 Score | C8 Score | C1 FCP | C8 FCP | C1 LCP | C8 LCP | C1 TTI | C8 TTI | C1 TBT | C8 TBT | C1 Speed | C8 Speed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/artist` | desktop | 59 | 69 | 0.39 | 0.38 | 7.28 | 15.29 | 19.68 | 18.84 | 275 | 196 | 4.83 | 0.94 |
| `/artist` | mobile | 43 | 42 | 1.53 | 1.52 | 43.34 | 102.87 | 119.34 | 126.95 | 2664 | 2293 | 4.63 | 5.27 |
| `/` | desktop | 60 | 53 | 0.36 | 0.37 | 5.36 | 4.22 | 19.55 | 22.97 | 227 | 456 | 7.65 | 7.43 |
| `/` | mobile | 36 | 35 | 1.38 | 1.38 | 26.85 | 39.94 | 133.64 | 133.87 | 2328 | 3515 | 21.16 | 24.88 |
| `/me` | desktop | 71 | 62 | 0.34 | 0.39 | 15.84 | 16.77 | 16.00 | 19.59 | 163 | 272 | 1.25 | 1.69 |
| `/me` | mobile | 44 | 44 | 1.38 | 1.53 | 102.09 | 102.20 | 118.88 | 119.11 | 2738 | 2570 | 4.09 | 3.97 |
| `/score/12` | desktop | 54 | — | 0.40 | — | 15.65 | — | 20.72 | — | 275 | — | 5.79 | — |
| `/score/12` | mobile | — | — | — | — | — | — | — | — | — | — | — | — |

## 失败样本

`/score/12` 在 C8 的 4/4 Lighthouse 样本中没有有效 performance category：

- desktop run1：失败
- desktop run2：失败
- mobile run1：失败
- mobile run2：失败

这延续了 C1 已发现的详情页稳定性问题；C1 时 `/score/12` 已有 3/4 样本返回 500。结论：`/score/[id]` 当前首先是可用性问题，不应把它当作有效性能样本。

## 四个体感目标验收

| 目标 | C8 判断 | 依据 |
| --- | --- | --- |
| `/` → `/me` 到内容展示约 2 秒 | 部分达成 | C3 已把 `/api/me/scores?light=1` 首屏接口从大 JSON 拆出，避免草稿 events 阻塞；但 Lighthouse 的 `/me` LCP 未改善，说明剩余瓶颈不在这次 C3 覆盖范围内。 |
| `/me` 待铸造项目“正在上传”约 3 秒 | 部分达成 | C3 让草稿列表首屏不再等 `events_data`；A3+A12 的 cron lease 25 分钟仍会影响真实“上链中”状态推进，归 Track A。 |
| 点击唱片约 1 秒内进入 / 有反馈 | 体感达成，指标未达成 | C7 新增 `/score/[id]/loading.tsx`，点击后应立刻显示骨架；但 `/score/12` Lighthouse 全失败，详情页稳定性仍需 A10 或单独 bug step。 |
| 进入 `/` 约 0.8 秒有反馈 | 体感达成，指标未达成 | C5 首页空数据 / 慢网态改为 spinner + 慢网提示 + 手动重试；Lighthouse mobile LCP/TBT 未改善，说明 C5 是感知反馈优化，不是底层渲染耗时优化。 |

## 结论

1. **C3/C5/C6/C7 的 ROI 判断仍成立**：这些改动集中、低风险，主要改善“不要像卡死”的感知问题。
2. **Lighthouse 指标没有全面改善**：`/me` mobile LCP 仍约 102s，首页 mobile TBT/TTI 仍高；这类问题需要更大范围的 bundle / SSR / 数据加载优化，按 playbook 挪 Phase 8 / Phase 10，不在 P7 Track C 硬啃。
3. **`/score/12` 不能作为性能样本**：当前要先解决 500 稳定性，再谈 LCP / TTI。
4. **Track C 可按 downgraded-accepted 收口**：P7 的高性价比项已完成；未达标项继续优化会牵涉大改架构或详情页可用性修复，超出 Track C 本轮范围。

## 后续归属

- Track A：A3+A12 处理 cron lease 25 分钟和状态机推进，影响“正在上传”的真实等待。
- Track A / A10：处理 `/score/[id]` 链上灾备与详情页稳定性，先消除 Lighthouse 500。
- Phase 8：结合 UI 大升级做 `/me` / `/score` / `/artist` 的结构性首屏体验优化。
- Phase 10：做深度性能优化，包括 bundle splitting、资源策略、生产环境 Lighthouse / PageSpeed 复测。
