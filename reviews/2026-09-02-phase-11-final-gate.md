# Phase 11 F0 最终门静态审计

> 审计日期：2026-09-02（Asia/Shanghai）
> 范围：P11 范围、架构、永久真值、结构硬线、Canvas 与首页 bundle 静态边界。
> 方法：F0 先以只读 `rg`、Git diff/status、文件与目录计数、import 边界检查形成静态快照；随后由统一最终验证补齐完整 `scripts/verify.sh` 与生产构建 chunk 证据。
> 最终工程验证：最新 `scripts/verify.sh` 全绿（TypeScript、ESLint 0 errors、production build 34/34、Forge 42/42）；首页生产构建遍历 18 个入口 chunk、共 2,449,474 bytes，禁入模式 0 命中。
> 当前权威更新：P11 代码与自动 Gate 已完成。C2/C3、D1–D3、ARCH 当前/Phase 4 旧空投清理与第二枚 Mainnet Token Gate 决策均已关闭；第二枚 Token 明确 deferred，不用 Sepolia fixture 冒充。只剩双 Arweave 网关恢复后补 ready Score 的 cold-start reduced-motion / 日食黑盘动态证据，以及以后替换 Artist 正式文案。
> 说明：下文保留最初静态审计细节用于追溯；凡与“后续覆盖证据”冲突的旧快照，均以后续结果为准。未提交状态本身不判成错误。

## 裁决

**P11 代码与自动 Gate 已完成；当前不再有本地实现阻塞。**

Score 的核心架构与永久输入静态边界成立：生产页没有 Decoder iframe，旧 `ScorePlayer` / `ShareBar` 已退出，已铸播放输入来自 metadata `animation_url`，合约、数据库 schema、永久 Decoder 和 P9 registry 均未被改写，P11 代码结构与禁用依赖扫描通过。

后续施工已经关闭原四项阻塞：C2/C3 获得最小越界授权并完成七态档案与局部错误；用户授权 Artist 先使用明确标记的安全草稿，D1–D3 与公开 stats API 清理完成；ARCH 第 38 行已改为不承诺按曲目数量触发空投；第二枚 OP Mainnet ready Token Gate 已由用户明确 deferred。正式 Artist 文案仍待以后替换，但不再阻塞代码收口。

后续浏览器补证已确认 Score 非音频矩阵、分享首屏、12 行账本、BottomPlayer 隔离、桌面 WebGL healthy、OG/海报与 production 普通 404 HTTP 语义；Artist 375/768/1024/1440 四视口和 `/me` 未登录边界也通过，最终矩阵 console 0。仅 Mainnet Token #1 的 ready Score cold-start reduced-motion 与日食黑盘复拍尚未完成：验收时 `arweave.net`、`ario.permagate.io` 同时失败，永久音频未能在预算内 ready。这个结论必须保持“外部资源阻塞”，不能写成动态通过或代码失败。

原审计中“STATUS/TASKS 仍停在 B3/B4”“尚未执行完整 verify / production chunk 分析”以及 C/D/ARCH/第二 Token 未决的判断，均已被后续工作覆盖，不再构成当前阻塞。

## 1. Git 工作树与归属

审计快照：`git status --short` 共 65 项，其中 39 modified、2 deleted、24 untracked、0 staged。

### P11 范围内改动

- Score：`app/score/[id]/`、`src/data/score-source.ts`、`score-fallback.ts`、`src/data/score/`、`src/features/score-playback/`、`src/types/jam.ts`。
- P11 原语与样式：`src/components/p11/`、`src/styles/`、`app/globals.css`。
- `/me` C0/C1：`app/me/`、`src/components/me/archive/` 与两份盘点 review。
- 全局表面：`app/error.tsx`、`app/not-found.tsx`、`app/layout.tsx`、`app/test3/page.tsx`、`LoginButton`、登录弹窗表面、BottomPlayer。
- 同源 Score 能力：`pond-gl-test3/PondGL.tsx`、`auto-dpr.tsx`、`WaterDistort.tsx`、P9 runtime 清理入口；registry 本身未改。
- P11 文档与证据：`playbook/phase-11/`、ARCH v3 段、STATUS/TASKS/JOURNAL/LEARNING/ERRORS 的 P11 追加、样板与 evidence。

### P11 开始前已有或与别线重叠的脏改

P9 最终 review 明确记录当时工作区已有“P12/auth 未提交改动”。当前仍能明确归到该组的有：

- `app/api/auth/community/route.ts`
- `app/api/auth/community/send-code/route.ts`
- `src/lib/auth/semi-client.ts`
- `docs/MAINNET-RUNBOOK.md`
- `playbook/phase-10/00-overview.md`
- `playbook/phase-12/40-d-cutover-week1.md`
- `reviews/2026-08-23-phase-12-launch-review.md`
- `reviews/2026-09-01-phase-9-v4-2-final-gate.md`
- `references/36-AU/`、`references/audio/`

`src/components/auth/SemiLogin.tsx` 同时承载原有 auth 改动与 P11 E1 表面修改，属于重叠文件，不能整体归给单一阶段。没有阶段起点 checkpoint 的文件不得凭文件时间猜归属。

## 2. 架构 v3 与受保护真值

### 通过

- 用户授权记录存在，`docs/ARCHITECTURE.md:124-129` 与 `:355-369` 已写明：
  - OP tokenURI → metadata `animation_url` → Arweave 网关 → DB 运维镜像；
  - 首页 35 节点、Score 单节点；
  - 唱片 ↔ 日食；
  - 路由级 Web Audio / P9 会话隔离；
  - capability、fallback、首包边界。
- `contracts/src`、`contracts/script`、`contracts/test` 无工作树改动。
- `supabase/migrations` 无工作树改动。
- `src/score-decoder/` 无工作树改动。
- `src/components/pond-gl-test3/p9/registry.ts` 无工作树改动。
- `src/components/pond-gl-test3/p9/runtime/p9-state.ts` 只增加 Score 所需的 elapsed 触发与 runtime reset；没有更改 33 键注册表或效果定义。
- P11 没有改铸造上传步骤，因此历史 metadata 与链上 `animation_url` 没有被重新生成或写回。

### 后续关闭项

- 用户已单独授权修正 `docs/ARCHITECTURE.md:38`；当前表述为“以已发布作品与共创乐谱为素材继续再创作；具体公开机制另行冻结，不承诺按曲目数量触发空投”。原冲突已关闭，Phase 4 空投章节只作为历史实施记录保留。
- Phase 4 的旧空投当前产品叙事也已清理；保留的历史记录不再被描述成现行功能。

## 3. Decoder、旧播放器与永久输入

### 通过

- 生产 `app/score/[id]` 中不存在 `<iframe>`，站内只把永久 Decoder 作为新标签外链。
- `app/score/[id]/ScorePlayer.tsx` 与 `ShareBar.tsx` 已删除；全仓没有活跃 import/render。
- `src/score-decoder/index.html` 中的 iframe 文字只描述 Decoder 被 OpenSea/站外嵌入及 postMessage 合同，不是站内 iframe 回退。
- `src/data/score/metadata.ts`：
  - Arweave txId 必须为 43 位；
  - Decoder 与资源 URL 只接受固定 Arweave 网关或 `ar://`；
  - `animation_url` 只允许且必须各有一个 `events/base/sounds`；
  - metadata 双网关、每网关 4 秒；
  - header 与流式读取双重限制 128KiB；
  - 第三方 URL、额外参数、重复参数均拒绝。
- 客户端播放只接收规范化 `ar://<txId>`，固定 `arweave.net` 与 `ario.permagate.io` 两网关，两轮有界失败；JSON 限制 128KiB。
- 数字 ID 先 DB 定位，任一 DB 抖动回落 OP 链；UUID 只读 DB 生命周期，不跨链伪造。
- ready 的 events/base/sounds 全部来自 metadata manifest；DB events 镜像与当前 Track 音频没有替换永久播放输入。
- 环境变量只决定当前 OP RPC、合约、网络标签与站点 canonical base，不构造历史 Token 的 events/base/sounds/Decoder。

### 保留但不是生产消费者

- `app/api/scores/[id]/events` 与 `src/data/score-events-source.ts` 仍是旧 DB events 通道；生产 Score 不再消费它。
- `score-events-source.ts` 仍被 `/score-lab/1` 用作已核验镜像，因此不能为“搜索结果归零”而盲删；其注释仍提到 `ScorePlayer`，属于可清理的历史表述，不是运行时回退。

## 4. 假日期、假 0 与未批准内容

### Score 与 `/me`

- 未发现固定假日期、Unix epoch 或空哈希补值。
- metadata 的 `Minted At` 只进入 `mintedAt` 兼容显示，`confirmedAt` 保持 `null`；账本没有把 metadata 日期冒充链上确认时间。
- 数量未知时使用 `null` / “—” / 明确缺失文案；`metadata` 的 `content-length ?? 0` 和播放引擎内部 `duration ?? 0` 不是用户可见统计伪造。
- BottomPlayer 的 `__placeholder__` 只为遵守 Hook 调用顺序，`currentTrack` 为空时组件不渲染，不是 UI mock。

### Artist：后续已关闭

- 用户明确授权先使用安全草稿并在 UI 标记“文字草稿 · 待艺术家确认”；正式内容以后替换，不虚构履历、奖项、年份、链接或具体身份事实。
- `src/content/artist.ts`、四个 Artist 组件与移动优先页面/样式已经建立，文字肖像是首屏，108 是第二章节。
- `published` 只统计 `published=true`；已发布、总铸造与参与者并行局部容错，失败为 `null` / “—”，不装成 0。
- 页面不显示空投、36/72 或未经批准章节；`publicLinks=[]` 时整区不渲染。
- 公开 stats API 的 `currentRound/nextAirdropAt` 等旧空投语义已由主任务清理。

## 5. Track C 完成度

### 已完成（当前权威）

- `/me` 已有稳定认证骨架、固定“我的唱片 → 我的录音 → 我的素材”顺序、真实数量与分区 error/loading 外壳。
- 原有试听、铸造、上传、外链与数据请求仍保留。
- C2/C3 的最小越界范围已获授权并完成：API/type 贯通真实 `status` / `failure_kind`，七态穷尽映射，数字 Token/queue UUID 主动作准确，failed 只“查看详情”。
- Score、Recording、Material 档案行已替换旧卡片；data source 非 2xx 抛错，三个远端分区局部失败不再冒充空档案。
- 旧试听/停止、重试播放、制作唱片/重试制作、BottomPlayer 与收藏动作全部保留；未新增 schema/auth 或 failed queue 写操作。
- 最终复核又关闭了身份切换竞态、刷新反馈、坏封面和损坏缓存四类边界；坏缓存只会被放弃并继续远端读取，不再污染档案真值。

## 6. 结构、依赖、Canvas 与 bundle 边界

### 通过

- 所扫描 P11 代码文件均 `≤220`；边界文件 `engine.ts=220`、`score-page.css=220`，未超线。
- P11 新目录直接文件均 `≤8`：
  - `app/score/[id]` 6，`components` 6；
  - `app/score-lab/1` 7；
  - `src/components/p11` 5；
  - `src/components/me/archive` 4；
  - `src/components/pond-gl-test3/overlay` 7；
  - `src/features/score-playback` 5；
  - `src/data/score` 1；`src/styles` 2。
- P11 路径没有 import `wagmi`、`ethers`、`howler`、`tone`、`operator-wallet` 或 `OPERATOR_PRIVATE_KEY`。
- `package.json` 与 lockfile 均无改动；P11 没有新增依赖。
- Score 复用唯一 `pond-gl-test3/PondGL.tsx` 的一棵 R3F `<Canvas>`；花瓣是现有 `WaterPetals` 的一个 2D `<canvas>`。没有第二个 Score PondGL 或第二份 P9 registry。
- 首页 `app/test3/page.tsx` 仍对 PondGL 使用 `next/dynamic(..., { ssr:false })`。
- 首页与 `pond-gl-test3` import 图没有 `src/data/score*`、`score-playback`、P11 ledger、单节点 session 或 Score route import。
- Score 的数据源只在 server route；客户端只用 `import type` 接收 `ScoreReadyData`，播放内核留在 `/score` 客户端路由。
- coarse/reduced 条件静态门成立：`usePointerFx` 只在 fine 且非 reduced 时挂载，`WaterDistort` 的 pointermove/pointerdown 由 `pointerInteractive` 门控。

### 后续覆盖证据（当前权威）

- C/D/ARCH 与最终修复落定后的 `scripts/verify.sh` 已全绿：TypeScript 通过、ESLint 0 errors、production build 34/34、Forge 42/42。此前“仍待最终 full verify”的缺口已经关闭。
- 首页生产构建已遍历 18 个入口 chunk，共 2,449,474 bytes；`score-playback`、Score data、ledger、Score session 四类禁入模式均为 0 命中。最初“静态 import 不能替代 chunk 分析”的缺口已经关闭。
- OP Mainnet Token #1 的后续真实入口已达到 healthy/playing；最初 G7 自动 Edge 夹具“只证明 fallback、未进入 healthy”的结论是历史快照，不再代表 Token #1 当前结果。

### 外部资源恢复后补证

- Mainnet Token #1 的 ready Score cold-start reduced-motion 与日食黑盘复拍仍缺；本轮两个允许的 Arweave 网关同时失败，页面正确进入永久资料 fallback，无法取得主演出证据。
- 第二枚 OP Mainnet ready Token 不存在的事实不变，但用户已明确将该双样本 Gate deferred；Sepolia #24 仍只作为隔离历史 fixture，不算生产样本。

## 7. 状态文档一致性

### 已满足

- JOURNAL 已记录唱片 ↔ 日食、桌面/手机能力分工、永久凭证、同源 PondGL 和 Score 独立会话。
- LEARNING 已记录 capability query、路由渲染会话隔离与“移动降级 ≠ reduced-motion”。
- ERRORS 的 P11 E040–E043 均对应实际发生的临时目录、字体网络、G7 与测试入口问题，没有发现为凑数编写的错误。
- STATUS/TASKS 已同步离开 B3；当前真值进入 P11 最终门收口，不再把 Track B 迁移写成权威下一步。

### 历史快照说明

- `reviews/2026-09-02-phase-11-b4-b5-gate.md` 自称“B3 迁移中的时间切片”，其中旧 iframe、旧播放器等阻塞已过期；它可作为历史快照保留，但不能被当成当前 Gate 结论。
- 本报告原先关于 STATUS/TASKS 仍停 B3/B4 的文字也属于已覆盖快照；当前裁决以本次更新和最新 STATUS/TASKS 为准。

## 8. 当前剩余事项

1. **外部动态补证**：等待 `arweave.net` 与 `ario.permagate.io` 恢复，再补 Mainnet Token #1 ready Score 的 cold-start reduced-motion 与日食黑盘复拍。恢复前不反复修改已全绿代码，也不把 fallback 截图冒充主演出通过。
2. **Artist 正式文案**：用户以后提供最终展示名、身份句、简介、宣言、108 说明与公开链接时，替换当前明确标注的安全草稿；这是内容校对，不是代码或发布 Gate 失败。

C2/C3、Artist 草稿代码、Artist API 字段级局部容错、ARCH 当前/Phase 4 旧空投清理、最终 full verify 与第二枚 Token deferred 决策均已关闭，不应再列入阻塞。

## F0 结论

永久真值、结构硬线、禁用依赖、单 Canvas、首页生产 bundle 隔离和最终完整工程验证均已通过；C、D、ARCH 与第二 Token 决策也已解除。**P11 代码与自动 Gate 完成。** 唯一未闭合的验收是双 Arweave 网关恢复后的 ready Score cold-start reduced-motion 与日食黑盘复拍；正式 Artist 文案则是后续内容替换。两者都必须保持真实状态，不能被写成已经通过，也不能反推为本地代码失败。
