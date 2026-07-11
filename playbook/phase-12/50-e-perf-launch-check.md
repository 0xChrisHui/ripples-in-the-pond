# Phase 12 — Track E：深度性能优化 + 上线检查（软 gate）

> 上层：`00-overview.md`。**软 gate**：不阻塞部署日与开放铸造，建议在公开宣传/拉新之前完成
> （与用户"提前上主网、前端慢慢修"的节奏兼容）。可与 B/C 并行，随时施工。
> **时序注**：首页相关项（bundle/LCP/GL）等 **P8 首页形态定稿后**再做，否则换首页全部重测；
> /me、/score 等页可先行。
> 承接：P10 C-defer「深度性能优化（bundle splitting / mobile LCP）」+ roadmap P12「性能深度优化 + 上线检查」。

---

## 0. 原则（承 P7-C2，继续有效）

体感目标制 + ROI 准则：修"用户等待的秒数"，不追 Lighthouse 分数；
每项优化先估收益再动手，改完必须复测同口径对照。

## 1. E1 — 基线复测

- [ ] Lighthouse 复测，**严格沿用 C1 口径**：同 4 页 × desktop/mobile × 各 2 次取稳定值
- [ ] 对照 `reviews/2026-05-14-phase-7-perf-baseline.md` + `2026-05-15-phase-7-perf-completion.md`，
      标出主网前口径下的退化/改善（P8-P10 改了不少前端，旧报告已过时）
- 注意：**别在用户 dev server 开着时跑 build 类测量**（dev/build 共用 `.next` 互踩，历史坑）

## 2. E2 — 优化施工（按 E1 结果排 ROI，逐项独立 commit）

- [ ] **C8 downgraded-accepted 项复盘**：当时"接受不达标"的项逐条重开——主网标准下哪些翻案、
      哪些维持接受（维持的写理由留档）
- [ ] **bundle splitting**：首屏 First Load JS 分析（`next build` 输出 + analyzer），
      重点查 `/`、`/me`、`/score/[id]` 三页的非必要同步依赖
- [ ] **mobile LCP**：移动端首屏（C8 报告里最弱项）；字体/封面图加载链复查
- [ ] **首页视觉负载按"届时现状"处理**：若 P8 J 线已迁 GL 首页 → 补真机 FPS + AutoDpr
      降配实测（J2 触控/J3 降配"待真机验"欠账正好在此清）；若仍是 SVG 首页 → 以现状为准，
      不为 E 提前迁移（那是 P8 的活）
- [ ] `/api/*` 慢端点抽查：`/me` 三 fetch、`/score/[id]` 首屏（P7-C9 修过，主网数据量口径复验）

## 3. E3 — 上线检查表（轻量，一次过完）

- [ ] 全站硬链接扫一遍（导航/返回/外链），无 404/死链
- [ ] 浏览器 console 零 error（warning 记录评估）
- [ ] 404 页 / error 页 / `/api/ping` 正常（Phase 5 产物回归确认）
- [ ] OG 卡片：X/微博真机贴生产链接展开正常（P10-A 验过，主网域名口径复验一次）
- [ ] OG/海报出图复验：生产直接请求 opengraph-image + 海报路由，200 + 出图正确
      （主验在 30-c C10 Node pin，此处上线前复跑一次）
- [ ] robots / sitemap / favicon / 标题描述：评估补齐（不强制，结论留档）
- [ ] 移动端真机过一遍主流程（登录→播放→收藏→录制→/me）

## 4. 完成标准

- [ ] E1 复测报告产出（含与旧 baseline 对照表）：`reviews/2026-XX-XX-phase-12-perf.md`
- [ ] E2 每项优化有"修前/修后同口径数据"；维持接受的项有留档理由
- [ ] E3 检查表全勾或有明确"不做"结论
- [ ] verify.sh 全绿

## 5. 红线

- 不为性能改视觉表现（P8/P11 的领地）；优化以"不改变像素结果"为默认约束
- 沙盒专属文件不碰（/test1 /test3 及 pond-gl-test3）；若 GL 已上**生产首页**，DPR/节流/
  加载类参数调优须与 P8 收尾进程协调后做，仍守"不改变像素结果"
- 装包（如 bundle analyzer）先查 `docs/STACK.md` 报批
