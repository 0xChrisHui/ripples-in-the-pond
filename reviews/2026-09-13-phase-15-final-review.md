# P15 全站丝滑体验与永久播放可靠性发布评审

## 裁决

P15 已形成可发布候选：代码、migration、production build、导航/路由矩阵、首页运行时、Pond Echo 冷热排程与永久媒体合同完成自动验证。用户于 2026-09-13 明确将剩余 review 视为非阻塞，因此真实双账号、物理 iOS/Android、人耳听音及未自动覆盖的设备/故障矩阵转为发布后观察，不冒充自动化已覆盖。

E4–E5 新高速镜像没有获批供应商、账号、额度与清理边界，本轮不创建；空配置继续使用三候选永久网关。合并 P14-G 最终修复后的 Production 已发布，公开路由、35+1、播放器标记与授权健康面均通过线上 smoke。

## 版本与边界

- P15 分支：`codex/p15-smooth-playback`。
- P14-G 最终基线：`8f5a735`；P15 合并发布提交：`2be3786`。
- 首声、分批补解码与可信运行时 Gate：`db7f4d6`。
- `2be3786` 的 Vercel Preview `G8hMLPoXqHpTAxYh99Sa2QF9eyMM` 与 Production `2rgmgPS2ypnR7oqw3j97VrNFt93g` 均构建成功；匿名 Preview 页面仍受 SSO 保护。
- P14 主工作树的未提交 review、playbook、hook 与素材改动没有被修改、暂存或提交。

## 交付内容

### 导航、首页与档案

- 同站 Link 点击立即显示可绘制反馈，保留新标签、下载、修饰键和浏览器历史语义。
- 核心路由均有非空 loading/error 外壳；首页先读带 origin、chain、合约和版本隔离的真实 tracks LKG。
- CSS fallback 与 GL 共用确定性曲目身份和位置；音频预热有 idle、可见性、save-data、Range、并发与取消边界。
- `/me` 四栏独立恢复/刷新，私人缓存按身份与合约隔离；换号中止旧请求，旧 Echo 快照明确标为“上次链上确认”。

### 草稿幂等与可观测性

- 本地草稿使用稳定 `clientDraftId`，后台上传只删除对应草稿。
- P15 migration 051 增加格式约束、用户内部分唯一索引、advisory lock 与六参数幂等 RPC；旧五参数 overload 保留兼容。文件从冲突的 050 纯重命名，SQL blob 保持 `7ab96e7d…` 不变。
- test 与 production 已读回 P15 结构，test 中同一 `clientDraftId` 两次 RPC 返回同一 `score_id` 且仅一条 draft，测试行已清理。远端 051 history 只可在确认既有 050 属于 P14 后补记；本次未重放 SQL、未修改远端 050。
- 核心 API 输出分段 `Server-Timing`，不记录 token、钱包与私人正文。

### 永久播放

- 统一 resolver 候选为可选镜像、`ardrive.net`、`arweave.tokyo`、`arweave.net`，并执行有界超时、重试、取消、类型、长度和 SHA-256 校验。
- CacheStorage 命中仍重新校验 canonical SHA-256；坏缓存删除回源，只缓存强校验成功的字节。
- Pond Echo 首播只解码首个四片段窗口，排程后后台补解码其余资源，避免热缓存时集中解码最多 26 个唯一片段阻塞首声。
- 重复字符复用 AudioBuffer；晚到资源按当前 AudioContext 时钟接入；AudioContext 仍只在用户手势后创建或恢复。

## 性能与浏览器证据

环境为 Windows、Edge headless 与本地 production build；原始 JSON 在 `reviews/evidence/p15-final/`。导航与路由矩阵采于最终播放器提交之前，作为同一 P15 实现方向证据；只有 runtime JSON 绑定最终提交、干净状态和 BUILD_ID。

### 站内 Link 与路由直达

| 目标 | Link 反馈 p95 / max | Link 外壳 p95 / max | 裁决 |
|---|---:|---:|---|
| `/` | 36.6 / 37ms | 92 / 94ms | 通过 |
| `/me` | 51.8 / 52.2ms | 116 / 142ms | 通过 |
| `/artist` | 52.4 / 54.5ms | 124 / 134ms | 通过 |

150/150 样本为真实 Next.js Link。五路由各 10 次冷直达全部有效，最慢外壳为 `/score/1` p95 714.4ms；首页冷圆圈 p90 494.6ms、max 632.7ms。

首轮 250 次热直达中，首页圆圈 p95 835.9ms，轻微超过冻结的 800ms；独立再跑首页 50 次为 p95 212.7ms、max 220.2ms，未复现长尾。首轮 `/me` 有一次 309ms Long Task，同时 responseStart 为 1.43s；独立再跑 `/me` 50 次 max 176ms，未复现。原始离群样本全部保留，最终按复测证据与用户 review 豁免接受，不改写历史结果。

### 首页运行时与 Pond Echo

- `db7f4d6` 干净工作树、BUILD_ID `OVSGMDwlhrDwg92YUWRZ2`：首页 `glHealth=healthy`。
- 10.5 秒 document RAF 心跳 rate 56.05Hz、p95 delta 18.7ms；它证明主线程 RAF 连续性，不冒充 R3F/GL 实际渲染 FPS。
- Long Task observer 与 Layout Shift observer 均受支持；最长任务 58ms、CLS 0、console/page error 为 0。
- 10 个 cold 样本均在导航前清 HTTP cache 与本站 Cache Storage：10/10 ready，预计首声 nearest-rank p95 433.7ms，低于冷预算 2.0s。
- 随后同一 CDP target 不清缓存连续 10 次：10/10 ready，预计首声 nearest-rank p95 125.4ms，低于热预算 500ms。
- 独立 continuity 样本确认全部资源 ready、播放器仍为 playing 且第 5 段已经排程；它不声称人耳已听过第 5 段。
- “预计首声”来自真实 `source.start` 后的排程 mark 加 60ms anchor；没有音频捕获设备，全部样本 `actualAudibilityVerified=false`，因此不把排程等同于人耳听音。
- 四个 fallback 视口均得到 35 个唯一可交互曲目且无横向溢出；375 视口同时覆盖 reduced-motion。

## Gate 裁决

| Gate | 状态 | 证据 / 边界 |
|---|---|---|
| 导航反馈与冷热外壳 | 通过 | 150 Link + 300 初始直达样本 |
| 首页真实圆圈 | 通过（复测） | 初始热 p95 835.9ms；独立 50 次 p95 212.7ms；冷测通过 |
| 首页 GL 健康、Long Task、CLS | 通过 | glHealth + observer + document RAF 连续性；不声称 GL FPS |
| `/me` 隔离、取消与局部失败 | 通过 | 专项合同；真实双账号按用户 review 豁免 |
| 草稿幂等 migration | 通过 | test/production 执行记录；test RPC 重放 |
| Pond Echo 冷热排程 | 通过 | 冷 10 次 p95 433.7ms；热 10 次 p95 125.4ms；第 5 段排程通过 |
| 永久媒体 | 通过（9/11 快照） | 40/40 至少 2/3 quorum；35 个 3/3、5 个 2/3，成功响应同字节 |
| Preview 页面实测 | review-waived | 构建成功；页面受 SSO，使用同提交本地 build |
| E4–E5 新高速镜像 | deferred | 无获批供应商；安全空配置 |
| 双真实身份、物理手机、人耳听音 | review-waived | 用户明确转发布后观察 |
| GL/R3F 实际 FPS、Score 首声、断站 Decoder、真实网关故障矩阵 | review-waived | 自动证据未完整覆盖；沿用合同测试/历史证据并转发布后观察 |
| baseline→after 全量 p50、错误/回退率、内存峰值 | review-waived | 保留 `reviews/2026-09-06-phase-15-performance-baseline.md` 与原始 JSON，不补造未采指标 |
| Production | 通过 | 合并版 Preview/Production 构建成功；5 个公开页面、2 个公开 API、35+1 与双功能 marker 线上通过 |

## 验证与环境例外

- `bash scripts/verify.sh`：TypeScript、ESLint、规模、目录、危险代码与 Forge 56/56 通过；验证工作树的 Turbopack 仅因 `node_modules` junction 指向工作树外而拒绝。
- 合并版在本机 Node 24 + 外链依赖的 webpack worker 出现 `WasmHash` 内部异常，未作为通过证据；同一提交的 Vercel 原生 Turbopack Preview 与 Production 均成功，36 路由由真实部署环境生成。
- P14 pipeline/player/gateway 与 P15 home/me/Server-Timing/permanent-media 专项验证通过。

## Production 线上结果

- `/`、`/me`、`/artist`、`/score/1`、`/echo/1` 均 HTTP 200；`/api/tracks` 返回 week 1–35 共 35 首并携带 `Server-Timing`。
- `/api/echo/featured` 返回 ECHO #1、36 位 recipe 与 26 个唯一 clip；Production chunk 同时包含 `p15:recipe-fifth-segment-scheduled`、日食数据属性与 featured API 标记。
- 发布后 scoped source cursor 从积压位置以带锁 CAS cron 有界追平；终检 safe-head lag 为 7 blocks，source/P14 cron 均 fresh，alerts 空。
- Production 保持 P14 `observe`，队列为 1 success / 2 excluded / 0 active / 0 failed / 0 manual review；本轮不越权切 `live`。
- 脱敏原始读回见 `reviews/evidence/p15-final/production-smoke-2be3786.json`。

## 回滚边界

- 导航和首页高速层可独立撤回，不触碰永久数据。
- `/me` 可停用 LKG 读取而不删除草稿或服务端记录。
- 051 为 additive；应用保留旧五参数 RPC，紧急回滚先撤应用，不先删列或索引。
- 清空 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 即停镜像；永久 resolver 继续使用三候选 fallback。
- 播放器优化不修改 tokenURI、永久 metadata、Arweave 内容或已铸 NFT。
