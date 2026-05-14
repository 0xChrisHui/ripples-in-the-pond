# JOURNAL — 决策日志

> 只记**为什么**，不记"做了什么"（"做了什么"看 git log）。
> 一条 1-3 行，密度像 commit message。三个月后光看 git log 想不起来的事，才写到这里。

## 写入时机
- 完成一个 playbook step
- 做了一个非显然的技术/产品决定
- 推翻了之前的决定（一定要写，标注"推翻 YYYY-MM-DD 的决定"）

## 不写
- git log 能查到的代码改动
- STATUS / TASKS / LEARNING / ERRORS 已经管的内容
- 日记式碎碎念

---

## 2026-04-08

- 清理 `quirky-herschel` worktree，决定后续直接在 main 主目录工作
  - 原因：单人项目，worktree 只增加心智负担
  - 影响：STATUS.md 备注同步删除该条
- 新增本文件 `docs/JOURNAL.md`
  - 原因：希望工作历史可追溯到"为什么"层，而不只是 git log 的"什么"层
- 完成"正式编程前的最后一次架构审查 + 90 分钟修复"
  - 推翻：之前 ARCHITECTURE.md 把所有 Phase 5 设计写成 782 行的细节，被识别为"过度规划综合症"
  - 决定：ARCHITECTURE.md 压缩到 309 行，只保留 12 条核心架构决策的"形状"，删掉所有具体 SQL/函数签名/字段表（AI 写代码时会现场决定，不需要文档照抄）
  - 同时引入：JOURNAL/INDEX/learn.sh/PROMPT-TEMPLATE/复述代码规则/3 名映射/越界停/中场休息点/Step 5 改用 OZ 现成合约
  - 影响：这是项目正式开始编程前的最后一次"地基整修"
- **推翻"$15/张 Arweave 成本"估算**
  - 起因：用户问"$500 预算能 mint 几张唱片"
  - 真相：26 音效 + 10000 封面 + 108 底曲全部预上传一次性复用（决策 8 已写但我之前自己忘了），每次 mint 真正新增的只有 events.json（~3 KB）+ metadata.json（~500 B），增量 Arweave 成本 ~$0.002/张
  - 数字修订：$500 预算 → 一次性投入 $50 + 动态铸造 $0.78×N → **能 mint ~577 张**（不是 31 张）
  - 影响：预算瓶颈不是 Arweave，是 gas（特别是主网 gas 飙升时）。需要的是 gas price guard，不是激进的 daily mint limit
- **Score Decoder 从"退出工具"提升为 Phase 3 核心组件**
  - 起因：用户问 OpenSea 能不能正常播放合奏
  - 真相：OpenSea 的 `animation_url` 不会播放 events.json（不识别 JSON 格式），必须有一个 HTML 播放器才能 iframe 嵌入
  - 决定：score-decoder.html 一次性上传 Arweave，所有 ScoreNFT 通过 URL 参数共用同一个 decoder 地址（类比"网页唱片机，每人带自己的唱片去播放" — 用户原话）
  - 影响：Score Decoder 不再属于"退出策略"章节，提升为决策 13 + Phase 3 必做项。没有它 = OpenSea 上分享卡只有图无声 = 损失 50% 病毒传播力
- **澄清"乐谱 vs 子 NFT"概念**
  - 起因：用户曾以为乐谱、音效、原曲都是子 NFT，由"首图 NFT"做母 NFT
  - 真相：首图不是 NFT，是 ScoreNFT 的"脸"（image 字段）。乐谱不是子 NFT，是母 NFT 的"灵魂"（events.json 存在 metadata 里）。子 NFT 只有底曲 + 音效 (MaterialNFT)
  - 决定：ARCHITECTURE.md 决策 6 加一段澄清，避免将来重新困惑
- **从 Ethereum Mainnet 切到 Optimism (OP) Mainnet**
  - 起因：用户复盘成本后觉得 ETH 主网仍然太贵 + 抗 gas 飙升能力差
  - 数字对比：单笔铸造 ETH 主网（0.3 gwei）~$0.78 vs OP 典型 ~$0.10；$500 预算从 ~577 张提升到 ~4500 张
  - 测试网：从 Sepolia (chainId 11155111) 切到 **OP Sepolia (chainId 11155420)**，避免 Phase 0 在 L1 测试网通过但 Phase 5 主网在 L2 翻车
  - 安全性不损失：OP 是 EVM 等价的 L2，最终结算到 ETH 主网，不是侧链
  - 工具链零成本：Foundry / viem / Privy / OpenSea / ERC-6551 Registry 全部支持 OP，代码不变
  - **降级 / 删除的护栏**：daily mint limit + gas price guard 都从"必须"降级为"可选"——OP 上烧不出灾难
  - **保留的护栏**：allowlist（与链无关的安全模型）+ balance alert（< 0.05 OP-ETH 告警）
  - 损失：仅"on Ethereum mainnet"的旁观者炫耀价值；目标用户是音乐爱好者不是 NFT 交易员，损失约等于 0

## 2026-04-10

- Phase 2 Step 0 spike 通过（4/4 标准），Web Audio 键盘方案可行
  - 途中修复 Tailwind v4 白名单 bug（`.claude/logs/` Windows 路径触发 Invalid code point）
  - 发现 Cursor 会 `git checkout` 还原未提交文件，globals.css 修改后必须立即 commit
- **推翻"单独合奏页 /jam/[trackId]"方案，改为首页融合**（决策 14-17）
  - 起因：用户参考 Patatap 设计，认为合奏不应该是需要跳转的"功能"，而是首页本身的一部分
  - 核心变化 4 条：
    1. 首页 = 全屏乐器 + 岛屿群，不跳转（决策 14）
    2. 播放背景曲 = 自动开始录制，用户无感（决策 15）
    3. 铸造改叫"收藏"，岛屿上方爱心按钮（决策 16）
    4. 草稿存 localStorage，登录后上传（决策 17）
  - 推翻的内容：playbook/phase-2/ 中 Track B 的 `/jam/[trackId]` 路由方案、手动录制流程、Track C 的"首页加合奏入口"
  - `feat/phase2-frontend` 分支旧 B0 代码保留但不再使用（useKeyboard/jam-source/mock-sounds 可复用）
  - 影响：Phase 2 playbook 全套重写，ARCHITECTURE.md 新增决策 14-17
- **产品决策：收藏不要求先演奏**
  - 起因：CTO review 问"没演奏也能收藏，是 bug 还是设计？"
  - 决定：规则 A——允许纯收藏素材，创作只是附加价值。用户可以只听曲、收藏/mint 曲子，不参与共创。共创专辑是另一条线，不绑定收藏。
  - 影响：Phase 3 做 ScoreNFT 时，Score 和 MaterialNFT 是独立资产，不互为前置条件
- **产品决策：爱心失败不告诉用户**
  - 起因：CTO review 指出乐观更新无回滚
  - 决定：保持乐观更新（点击即红），后端失败不回退红心、不显示错误。开发者从日志排查，后端静默重试。与 A5 决策一致——用户只看到成功。
  - 影响：需要完善铸造失败监控+告警（已记入 `reviews/phase-1-deferred.md`）

### 2026-04-12 — Phase 3 完成 + 稳定性修复

- **Alchemy Free 10 区块限制**：sync-chain-events cron 不能用大范围 getLogs，改成分批循环（50×10=500 区块/次）。主网需要升级 Alchemy 或用其他 RPC。
- **产品决策：/me 展示"我铸造的"而非"我持有的"**：Codex 建议接 chain_events 做 owner 投影，讨论后决定当前语义就是 minter。链上转手是极少数场景，不值得增加复杂度。
- **metadata external_url 必须用环境变量**：Arweave metadata 一旦上传不可修改。`NEXT_PUBLIC_APP_URL` 缺失时 cron 拒绝铸造，避免永久写入错误链接。
- **F9 链上灾备延后**：/score/[tokenId] 的 Arweave fallback 路径（DB 丢数据时从链上恢复）技术上可行但当前不紧急，延后到主网前。

### 2026-04-13 — Phase 4A 认证底座 + Semi 暂停

- **Semi 登录暂停，等他们 OAuth 方案出来**
  - 起因：Semi 团队回复"最近在设计 OAuth 开放登录机制"，现有 /send_sms + /signin 是内部 API，不确定是否开放给第三方
  - 决定：S2 后端代码保留（已写完+全绿），S3 前端暂不做。等 Semi OAuth 方案出来后只需改 `src/lib/semi-client.ts` + 前端登录流程
  - 影响：Phase 4A S3 挂起 → 先跳 S4-S5（与认证解耦）
  - 已做完的部分 100% 可复用：JWT 基础设施 / 双验证中间件 / auth_identities / 6 个 API 迁移 / community 登录端点
- **认证底座是通用的，不绑定 Semi**
  - S0-S1 的 JWT + 双验证中间件 + auth_identities 表适用于任何第三方登录源（微信 / Google / 任何 OAuth），Semi 只是第一个接入方

### 2026-04-25 — Phase 5 收口

- **推翻原 Phase 5 = 主网部署，拆成 Phase 5/6/7**
  - 起因：产品上主网前需要先给小范围用户试玩收反馈 + UI 还没重设计
  - 决定：Phase 5 = 测试网公开版（OP Sepolia 继续），Phase 6 = 基于反馈做 UI 重设计，Phase 7 = OP 主网
  - 影响：Phase 5 保留测试网合约，聚焦部署 + 安全基础；commit `b8f8c78`
- **Vercel Hobby + cron-job.org 替代 Vercel Pro**
  - 起因：Pro $20/月的核心价值是原生分钟级 cron + 60s 超时；测试网阶段没必要
  - 决定：Hobby + cron 拆步（每步 <5s）+ 外部 cron-job.org 每分钟触发
  - 影响：月成本 $0 vs $20；upstream：未来升主网时再评估是否升 Pro
- **tester 范围限定在素材收藏链路，草稿铸造挂到 Phase 6**
  - 起因：草稿铸造 UI 按钮从 Phase 3 就没做完（bug #5），且第二轮严格 review 发现 ScoreNFT cron 还有 4 个 P0
  - 决定：不在 Phase 5 临时加按钮；Phase 6 开始前先修 cron 四连，再在 UI 重设计里接通草稿铸造入口
  - 影响：tester 看到的草稿是"只能保存不能铸造"，邀请文案需要明确说明
- **Bug #6 rate limit 失效是误判 — 测试方法论教训**
  - 起因：第一轮 smoke test 发 25 个 curl 都没 429，以为 Upstash 静默 fail-open
  - 真相：Vercel sin1 + Upstash us-east 跨洋 235ms/req，curl 变成 1.6s/发，25 个发成 49s → 永远不到 20/10s 阈值
  - 后续测试方式：必须用真正并发（`&` 后台并行）而非顺序循环
  - 影响：`reviews/2026-04-24-phase-5-s5-smoke-test.md` 标为误判，middleware 加的观测日志作为预防性改进保留
- **cron post-send rollback 是 2026-04 最严重的事务性坑**
  - 起因：`writeContract` 成功后 DB 写 tx_hash 失败 → catch resetToPending → 下次 cron 重发 tx → 重复 mint
  - 决定：所有 cron 改写成"链上成功后 DB 失败不得 reset，标 failed 等人工核查 operator tx 历史"
  - 影响：material / airdrop 已改（commit `1bb1b05`）；score-queue 同样问题延后 Phase 6 前修复（第二轮 review 发现）
- **Phase 5 = 部署完成，非 12/12 完整收口**
  - STATUS 里写"S0-S5 完成"容易误导——playbook 要求 12 项冒烟全通，实际只 10/12（B9 草稿铸造 + C12 限流 C12 都有例外）
  - 决定：STATUS 改为"部署完成，开放限定范围 tester"
  - 影响：以后继任者读文档不会以为 Phase 5 无条件完成

### 2026-04-25 晚 — Phase 6 kickoff 决策

- **Phase 6 范围扩大：从"UI 重设计"变成"所有剩余开发工作"**
  - 起因：用户决策"所有需要修改、现在需要去做的开发工作，全部放在 phase 6"
  - 推翻：之前 "Phase 6 = UI 重设计，主网前必做清单单独挂" 的切法
  - 决定：Phase 1-5 两轮严格 CTO review 的 29 项 findings 全部划入 Phase 6，按域切 5 track；UI 重设计是其中一条 track 而不是整个 Phase
  - 影响：Phase 7 = 纯主网部署 + 监控 + 退出准备，所有代码层修复收口在 Phase 6 做完
- **Phase 6 用多 track 并行组织，不线性推进**
  - 起因：29 findings 按域天然聚类，且大部分 track 解耦（只有 Track A1 → B3 硬依赖，其余独立）
  - 决定：5 track 各自有独立 playbook（`playbook/phase-6/track-a 到 track-e.md`），可并行开工
  - 影响：Phase 6 完结标准从"playbook steps 按序完成"变成"5 track 都达到各自完结标准"
- **Pre-tester gate — 3 项放人前必修**
  - 起因：A2 (material failed 重试) + B1 (NFT cache 隔离) + E1 (material health) 都是 tester 会高频踩到但工作量小的问题
  - 决定：Phase 6 开工第一件事做这 3 项（共 ~2 小时），完了才放 tester
  - 影响：tester 反馈窗口和 5 track 开工并行，不浪费这 1-2 周
- **Phase 6 Track D（空投）是条件性的**
  - 起因：主网是否做空投是产品决策，不是技术决策。修全套要 1 周；不做的话只需要改 admin header 鉴权 (D2)
  - 决定：D1 作为 gate step，决策前 D3-D6 都挂起；D2（admin header）不管 D1 怎么定都做，因为 query token 是安全泄露点
  - 影响：Phase 6 工作量估算有 1 周浮动区间取决于 D1 结果

### 2026-04-25 深夜 — Phase 6 Playbook 严格 CTO Review 修正

基于 `reviews/2026-04-25-phase-6-playbook-cto-review.md` 重写 playbook。5 个关键调整：

- **A2 failed retry 不能一律 reset —— 加 `failure_kind` 区分 safe_retry / manual_review**
  - 起因：第一版 A2 写 "existing.status === 'failed' → 重置为 pending"。但某些 failed（stuck 无 tx_hash / post-send DB 失败）含义是"链上可能已发但 DB 未落"，reset 会重复 mint，和 Phase 5 Bug #7 的修复冲突
  - 决定：mint_queue 加 `failure_kind` 字段；cron 写 failed 时明确分类；API 只允许 `safe_retry` 路径自动重入队，`manual_review` 返 409 + needsReview
  - 影响：Pre-tester gate A2 的工作量从 30-60 分升到 1-2 小时（含 migration）；前端 useFavorite 需要处理 needsReview 分支
- **operator 全局锁从 Track D 条件步骤升级为 Track A0 必修**
  - 起因：第一版把 operator 钱包串行锁放到 Track D4，依赖 "D1 = 做空投" 才触发。但锁是 material / score / airdrop 三条 cron 共用 EOA 的硬问题，即使空投不启用，Phase 7 主网前也必须有
  - 决定：升级为 Track A0，成为 Phase 6 必修 gate。A0 阻塞 B3（草稿铸造按钮）接通 + 任何空投 cron 启用
  - 影响：Track A 从 6 step 变 7 step；Track D 去掉锁相关步骤
- **A1 Durable Lease 补完整规格（lease_owner + heartbeat + owner CAS）**
  - 起因：第一版只写 `locked_at / lease_expires_at`，没要求 lease_owner。半个 lease 模式无法证明并发安全：A 锁过期 → B 接手推进 → A 恢复后仍可能用 `.eq('id', row_id)` 覆盖 B 的状态
  - 决定：claim 时生成唯一 UUID `lease_owner` 写入；**所有**状态推进带 CAS `WHERE locked_by = my_owner AND lease_expires_at > now()`；长步骤 heartbeat 续租；终态释放锁
  - 影响：Track A1 工作量从"1 天"升到"1-2 天"，但这是 Phase 6 最核心的并发安全前提
- **Track C 合约重部署必须 Pre-tester 前集中完成**
  - 起因：第一版说 Track C "可随时并行"。但 C1/C4 重部署 ScoreNFT + Orchestrator，会改合约地址。tester 窗口中途切 = 用户今天的 NFT 明天因环境切换消失，反馈严重失真
  - 决定：Track C 全部 4 steps 收进 Phase 6 kickoff 的"步骤 1"，Pre-tester gate 之前一次性完成
  - 影响：Pre-tester 前多一段合约工作（~1 天），但避免 tester 反馈污染
- **Pre-tester gate 加 G0 运营就绪检查**
  - 起因：第一版只有 3 个代码项（A2/B1/E1），没检查 operator 余额 / cron-job.org 状态 / Vercel env 同步 / 真实 smoke。代码修完 ≠ 环境就绪
  - 决定：G0 不写代码但要跑清单（6 项）产出可验证结果，通过才能放人
  - 影响：Pre-tester gate 从 3 项扩 4 项（+15 分钟）

### 2026-04-25 收尾 — Phase 6 Kickoff 产品决策冻结（A6 / D1 / E2）

Phase 6 kickoff 3 个产品决策冻结。后续不允许执行中自然飘移，修改必须走新的 playbook 修订流程。

- **A6 — `/me` 语义：保持"我铸造的"（选项 1）**
  - 背景：2026-04-12 原决策是"我铸造的"；Phase 1-4 回看 P14-22 建议改成"我持有的"（链上 owner 投影）
  - 决定：保持现状。理由：
    1. 当前用户群以创作者视角为主，"我铸造的"语义稳定 3 个月无投诉
    2. 主网早期 ScoreNFT 转手场景极少（没有二级市场、没有社交分享按钮）
    3. 改 owner 投影会引入 Track A3 硬依赖 + UI 文案重设计 + chain_events 新鲜度风险
    4. 若未来真需要，可以作为 Phase 8+ 的独立产品迭代
  - 影响：
    - Track A6 工作量 = 10 分钟（只改 JOURNAL 说明）
    - Finding P14-22 状态 = `deferred-justified`
    - 不再影响 Track B2.2（/me UI 重设计）
- **D1 — 主网不做空投**
  - 背景：Phase 4C 做了 AirdropNFT 合约 + cron 骨架，但 metadata 没做，两轮 review 都提到深层 bug（快照新鲜度、cron 串行、触发事务、failed 判定等）
  - 决定：主网首版不做空投。理由：
    1. 空投不是 MVP 必需功能，主网首版价值聚焦"收藏 + 创作 + 铸造"
    2. 修全套要 1 周（D3-D5），对 MVP 上线时间性价比低
    3. 未来如果社区需要，可以独立作为新 Phase 规划并重新 review
  - 影响：
    - Track D 只做 D2（admin header 鉴权，因 query token 是安全泄露点必修，与空投启用无关）
    - Track D 工作量从 5-6 天降到 30 分钟
    - Finding P14-4 / P14-10 / P14-12 / P14-25 状态 = `deferred-justified`
    - cron-job.org 的 `process-airdrop` 定时触发**在 Phase 6 完结时停用**（保留 URL，不触发）
    - STATUS "主网承诺边界" + ARCH 空投章节 加注解
    - 前端（/me /artist 等）不需要空投入口
- **E2 — Semi 登录挂 Phase 7（不在 Phase 6 接入）**
  - 背景：Phase 4A S3 自 2026-04-13 挂起，Semi 团队 OAuth 方案至今未就绪
  - 决定：Phase 6 不等 Semi OAuth。主网首版 Privy-only。理由：
    1. Semi OAuth 就绪时间不受项目控制
    2. 主网首版验证的是核心产品循环，登录多源化不是 MVP 门槛
    3. 已完成的 Phase 4A S0-S2（JWT / 中间件 / auth_identities）100% 可复用
  - 影响：
    - Track E2 挂起到 Phase 7 或更后的 Phase
    - E3（health 加 Semi 探针）降级：只支持 `not_configured` 状态，不探真 API（Semi 配了再探）
    - Finding P14-24 状态 = `deferred-justified`
    - STATUS "主网承诺边界" 明确 "主网首版 Privy-only"
    - Track E5（文档口径对齐）依然要做，把 playbook-4 标清楚 Semi 状态

### 2026-04-25 收尾 续 — UI 重设计接入 Claude Design

- **Track B2 引入 Claude Design 作为视觉工具**
  - 起因：用户 2026-04-17 后可访问 Anthropic 新发布的 Claude Design（claude.ai/design），由 Opus 4.7 驱动，能读 codebase 自动建 design system，明确支持把产出交给 Claude Code 实施
  - 决定：Track B2 工作流改成 "Claude Design 出视觉 → Claude Code 实施"，但**视觉之前必须先做 IA 讨论**（避免漂亮但流程错的产出）
  - 工具特性确认（来源：[Anthropic 官方](https://www.anthropic.com/news/claude-design-anthropic-labs)、[Claude Help Center](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)）：
    - Web-only，访问 `claude.ai/design`，**无 API / CLI 集成**
    - Onboarding 阶段读 codebase 自动提取颜色/字体/组件/类型契约
    - 产出 live HTML/CSS/React 组件而非静态图片
    - Pro/Max/Team/Enterprise 订阅可用，研究预览阶段
  - 工作流：用户在 web 设计 → export 代码 → 贴给 Claude Code → 我做迁路径 + 接真 hook + verify
  - 影响：
    - Track B2 子步骤从 6 增到 9：B2.0 反馈归档 + **B2.0.5 IA spec** + **B2.0.7 Claude Design onboarding** + B2.1-B2.4 各页设计 + **B2.4.5 产出迁项目** + B2.5 跨浏览器验收
    - 新建 `app/_design/` preview 路由 + `stubs.ts` 假数据，作为 Claude Design 产出的 sandbox
    - 新增产出 `reviews/2026-04-XX-phase-6-ia-spec.md`（4 页 IA 规约，喂给 Claude Design 当约束）
    - Track B 总 step 数 10 → 13
- **不手写 Design Handoff Bundle**
  - 原计划写 `docs/DESIGN-HANDOFF.md` 列项目设计 token，但 Claude Design onboarding 自动读 codebase
  - 决定：不预先手写规范文档；改为 onboarding 后让它输出 design system 摘要，我们对照项目实际 token 验证 ≥ 80% 命中

### 2026-04-25 收尾 续 2 — Track C 合约 & 部署硬化收口（C1-C4）

- **C1 setTokenURI 防覆盖用独立 `_uriSet` mapping**
  - 备选：依赖 `super.tokenURI(tokenId)` 字符串长度判断（ERC721URIStorage 的 `_tokenURIs` 是 private 不可读）
  - 否决理由：依赖 `_baseURI()` 返回空字符串的隐式行为，未来若 override `_baseURI` 会无声坏掉
  - 决定：用独立 `mapping(uint256 => bool) private _uriSet` flag，多花 1 个 SSTORE 换显式语义
- **C2 部署脚本测试网零配置回退用 `vm.envOr`**
  - 起因：playbook 强调"测试网可 deployer = admin = minter"，但脚本统一参数化又要求 ADMIN_ADDRESS / MINTER_ADDRESS
  - 决定：`vm.envOr("ADMIN_ADDRESS", deployer)` 缺省回退；测试网 `.env.local` 不需配置 admin/minter
- **C2 ScoreNFT.MINTER_ROLE 授权策略与 admin 移交时机的耦合**
  - 矛盾：ScoreNFT 部署后若立刻 revoke deployer 的 DEFAULT_ADMIN，那 Orchestrator 部署时就调不动 ScoreNFT.grantRole
  - 决定：脚本里用 `hasRole` 判断，deployer 还有 admin 就直接 grant，没有就 log 出 admin 需要手动跑的 cast 命令；主网 runbook 明确分两段
- **C4 ARCH 决策编号修正：playbook 写"决策 13"，实际是"决策 7"**
  - 起因：playbook 是新写的没核对 ARCH 实际编号；决策 13 是 Score Decoder
  - 决定：按 ARCH 实际决策 7 重写"ERC-6551 TBA 当前未实装"；同步改 line 110-114 决策 6 的母子结构、line 273-275 MintOrchestrator 描述、line 477 决策表
- **重部署用简化模式（测试网 deployer = admin = minter）**
  - 起因：测试网 cron 反正用 OPERATOR 私钥，模拟主网 admin/minter 分离意义不大且增加部署复杂度
  - 决定：`.env.local` 加一行 `DEPLOYER_PRIVATE_KEY=<同 OPERATOR_PRIVATE_KEY>`，ADMIN/MINTER 留空走 `envOr` 回退；主网 Phase 7 才走 `docs/MAINNET-RUNBOOK.md` 真分离
- **新合约地址 + 旧合约归档**
  - 新 ScoreNFT v2: `0x1C478F9F5b66302A35a0178e07df67BA343c832F`
  - 新 Orchestrator v2: `0x8A6Dd0Ecf108797358CC369bC6F263D2C89BC3a8`
  - 旧 v1 NFT（tokenId 1, 2）不在前端展示；归档 `reviews/phase-6-deprecated-contracts.md`
- **新增 `scripts/load-env.ps1` 让 forge 在 PowerShell 跑时能读 `.env.local`**
  - 起因：tsx 脚本走 `_env.ts` 自动读 `.env.local`，但 forge 是独立 binary 不读
  - 决定：写一个 dot-source 用的 PowerShell helper（`. .\scripts\load-env.ps1`）；scripts/ 目录从 7 增至 8 文件刚好踩硬线但不超

### 2026-04-26 — Phase 6 Pre-tester gate 4/4 收口

- **useFavorite 从悲观改回乐观（部分反转 commit `1019dcb`）**
  - 起因：用户 G0 验证收藏链路时反馈 3-10 秒等待 + 鼠标变工字光标，不可接受
  - 根因：Phase 5 严格 CTO review（`1019dcb`）以"失败时 UI 显示成功 = 误导用户"为由把 useFavorite 改成悲观更新（点击 → loading → 等 await fetch → success）
  - 用户原话（Phase 2 + 本次复确认）："点击红心立马变红给用户最好的体验，不用等待什么回复，都在后端搞定就行" + "失败了就后台留一个 task 然后人工来解决吧。不需要回退，我认为用户不需要知道这个"
  - 决定：UI 立即变红 + 永远红；API 后台跑失败仅 console.error 完整日志（含 user_id/tokenId/ts），UI 不回退、不通知；失败兜底由 ops 通过 health mint_queue 状态 + 用户反馈定位
  - 长期影响：存 memory `feedback/optimistic_ui_with_rollback`，未来任何 review 提"失败不回退是 bug"先核对该 memory，修法是接受 trade-off 而非改悲观
- **memory/ 目录拆子目录（feedback/ + project/）**
  - 起因：加新 memory 后 9 文件超 8 文件硬线，hook 阻塞 Write
  - 决定：按 type 分子目录（feedback/ 用户偏好；project/ 项目环境约束），MEMORY.md 索引留 root + 路径加前缀；未来加 user/ + reference/ 类型同样规则
  - 验证：检索成本几乎不变（MEMORY.md 索引始终在 context，路径在索引里写明）
- **B1 cache 用户隔离遇到 React 19 react-hooks/set-state-in-effect 新 lint**
  - 现象：`useEffect` 里同步 `setState`（重读 cache）触发 React 19 新 lint 错（cascading renders 警告）
  - 决定：用 `queueMicrotask(() => setStateXxx(...))` 推到下一个 microtask；同样套路也用在 useFavorite 的"登录后自动收藏" effect
  - 备选否决：用 React 19 `useSyncExternalStore` 重写最规范但工作量大；用父组件 key prop 重置最优雅但要改调用层
- **E1 health mintQueue 字段命名**
  - 起因：playbook 写 `failed / stuck / retry / oldest age` 四字段，实际 mint_queue 没专门 last_error 字段，retry_avg 也意义不大（每个 job 独立 retry）
  - 决定：精简为 `failed` / `stuck` / `oldestAgeSeconds`；stuck 严格定义 = `status=minting_onchain + tx_hash IS NULL + updated_at < now-3min`，与 cron 的 STUCK_TIMEOUT_MS 一致避免漂移
- **A2 failure_kind 起始编号 021（playbook 预留 024）**
  - 起因：playbook overview D6 写"由 Track A 统一分配"，预想 A0/A1/A3/A4 占 021/022/023，A2 用 024
  - 实际：A0/A1/A3/A4 都还没做，A2 是 phase-6 第一个 migration，按 README 的"找最大编号 +1"规则用 021 更自然
  - 决定：021；未来 A0/A1 等需要 migration 时往上加
- **A2 历史 NULL failure_kind 行的兜底语义**
  - 矛盾：migration 加列前已有的 failed 行 failure_kind 必然 NULL；新代码 23505 处理路径必须有兜底语义
  - 决定：保守视为 manual_review → 返 409 needsReview。理由：旧失败行无法判断是 chain 已发还是未发，安全侧不自动重试
- **A2 commit 与 migration 顺序**
  - 风险：commit 含写 failure_kind 的 cron 代码；如果 push（Vercel 自动部署）在 SQL 跑列前发生，cron 会在不存在的列上 update → 失败
  - 决定：本地 commit 后等用户 Supabase SQL 执行成功，再 push；这条对所有 schema-change 的 migration 都适用

## 2026-04-29 — Phase 6 B2 前端 25 轮优化

> 完整叙述 + 经验 + 审美 → `docs/PHASE-6-B2-FRONTEND-25-ITERATIONS.md`
> 这里仅记关键决策的"为什么"。

- **Two.js patatap 移植 → 切 SVG 引擎（`references/aaaa`）**
  - 起因：Phase 1+2 用 3 worker agent 并行完成 21 个 Two.js 动画 26 键映射，用户测试反馈"做的太糟糕，非常多 bug"
  - 决定：整套搁置（不删，作 dead code），改用 references/aaaa 的纯 SVG + RAF + 12 动画 + 26 键映射；后期补 8 个缺失动画
  - 教训：工程"完成度"不等于用户接受度；不要陷入"我做的对所以坚持"
- **聚落算法 v15 deterministic 重写**
  - 用户洞察："link 的拉力会撕裂聚落 — 是不是 link 和 cluster 算法不一致？"洞察对了
  - 根因：generateLinks 用 week hash 决定连接，setupSimulation 用 Math.random 决定 cluster anchor，**两套独立** → 同 cluster 节点之间没 link，跨 cluster 反而被 link 拉
  - 决定：`getNodeCluster(node)` 用 id hash 算 cluster index（共用函数），`generateLinks` 仅在同 cluster 内生成；anchor 位置用 Halton 低差异序列保证均匀
  - 长期影响：D3 多力系统中"link / cluster / charge 必须方向一致"成为本项目规则
- **EclipseLayer 用 React Portal + useSyncExternalStore**
  - 问题 1：日食 z-index:9999 在 Archipelago section 内仍被 z-40 SvgAnimationLayer 整层遮（stacking context 隔离）
  - 修法：Portal 渲染到 document.body 跳出所有父 stacking context
  - 问题 2：prod 首次进入主页点圆，日食不显示（圆变白），进 /me 再回来 OK
  - 根因：`typeof window === 'undefined'` 早 return null，hydration 锁定 null，Portal 永不挂
  - 修法：`useSyncExternalStore` 提供 server/client 双快照，hydration 后 React 自动 re-render 挂 Portal
  - 教训：SSR/hydration 的隐藏陷阱 → 标准 API 才稳
- **drag end 不解 fx 改"标 dragLoose 弱拉"（v11→v12）**
  - 起因：v11 完全保留 fx/fy 让拖过节点冻结，被用户否决（要"减弱回弹但保持流动"）
  - 决定：drag end 释放 fx/fy + 标 `_dragLoose=true`；forceX/Y strength 检查标记给 0.025 极弱拉（vs 普通 0.20）
  - 效果：拖过节点几乎留在新位置但仍参与 alpha 漂浮，有流动感
- **BackgroundRipples ref-based DOM（不用 setState）**
  - 起因：v15-v17 setState 涟漪闪烁（5s 后开始）
  - 根因：高频 setState 触发 React reconciliation，与 sphere D3 tick paint 同帧争预算
  - 决定：`useRef<SVGSVGElement>` + `appendChild/removeChild` 直接 DOM；React 协调零开销
  - 长期影响：高频更新场景一律 ref-based DOM，setState 仅用于"语义状态"
- **放大闪烁 → CSS .zoom-large 暂停 sphere ripple**
  - 起因：放大到 ~20 球大小时仍闪
  - 排查链：layer 累积 → MAX 限制 → glow stdDeviation 减 → sim alphaTarget(0) 仍闪 → 36×3=108 个无限 ripple animation 是底
  - 决定：zoom > 1.4 时 zoomG 加 `.zoom-large` class，CSS `.zoom-large .ripple-c { animation-play-state: paused }` 暂停所有 sphere ripple；ABC 缩回时自动恢复
  - 长期影响：CSS animation-play-state 是性能与视觉 trade-off 的精准开关
- **手动点击涟漪强反馈：transform 单调 + stroke-width 走 CSS keyframe（v24→v25）**
  - 起因：v24 multi-stop transform 卡顿 + stroke-width 一直加粗
  - 卡顿根因：CSS keyframe 每个 stop 之间是独立 ease，多 stop 拼接 = 每 stop 速度归零再启动
  - 加粗根因：`setAttribute('stroke-width', '2.6')` 后 CSS keyframe 改不动（SVG attr 不参与 CSS animation）
  - 决定：transform 用两端 stop（0% / 100% ease-out 平滑）；stroke-width / stroke-opacity 走 CSS keyframe（不 setAttribute）；前 12%（≈2s）从 strong 渐变到普通值
  - 长期影响：SVG presentation attribute 想 keyframe 控制必须 CSS 接管

## 2026-04-30 — Phase 6 B2 v36-v86 effects 沙箱 + zoom/tilt/focus 重构

> 续 v25 文档。本节聚焦 v36 起 effects 沙箱化、zoom 漂移彻底解决、tilt/focus/perspective 三系统对齐、effects 大砍，以及彗星/星空动态化的关键决策。
> 完整版本号→功能映射见 `PHASE-6-B2-FRONTEND-25-ITERATIONS.md`，此处只记"为什么"。

- **v37-v39 effects 中央化 + URL 同步**
  - 起因：v35 之前每个视觉 effect 散在 SphereCanvas，无法对比开/关、无法分享 URL
  - 决定：`effects-config.ts` 单一 source of truth + `EffectsPanel` 复选框 + `parseEffectsFromURL/effectsToQuery` 仅写非默认值（链接简短）
  - 长期影响：本项目所有"视觉沙箱试验"都走 effects-config 加字段；要进主页就改 DEFAULT_EFFECTS

- **v85 wheel 锚点 idle-lock + snap-to-sphere → 彻底解决 zoom 漂移**
  - 起因：用户报"快速缩放时鼠标横移，球跟着横移"
  - 根因：d3-zoom v3 默认 wheel handler 每次 wheel event 用当前 pointer 重设 anchor (`g.mouse[0] = p`)，wheel 期间鼠标移动 → anchor 跳变 → transform.x/y 跳变 → 球横移
  - 决定：`svgSel.on('wheel.zoom', ...)` 覆盖默认；第一次 wheel 记 anchor，连续 wheel 200ms idle 才重选；同时 snap：鼠标 80px 内最近球 → 该球作 anchor，否则屏幕中心
  - 长期影响：d3-zoom v3 没有 `.center([cx, cy])` API（v4 才有），自己 override wheel handler 是标准解法

- **v86 perspective vanish 必须用 sim 坐标，不是视觉坐标**
  - 起因：v85 改完后用户报"放大过程中以圆圈为消失点会漂"
  - 根因：v85 anchor 用了 `getBoundingClientRect()` 拿球**视觉位置**作 vanish，但 perspective 公式 `vanish + (n.x - vanish) × factor` —— 视觉位置已被旧 factor 投影过，新 factor 下错位
  - 决定：perspective 模式 vanish = 球 sim 坐标 (n.x, n.y)；数学保证 `球 A 视觉位置 = vanish + (n_A.x - vanish) × factor = n_A.x`，与 k 无关
  - 同时删除 `currentVanishRef` 0.15 lerp（让 vanish 切换瞬间生效，不再有 ~333ms 的过渡漂移期）
  - 教训："视觉位置"和"sim 位置"在 perspective 下是两个量，公式涉及哪一个要写清楚

- **v86 baseLayer 与 z 一致化**
  - 起因：用户报"看到模糊但 tilt 强烈受影响的球，矛盾"
  - 根因：`baseLayer`（决定球大小 + layerWave2）和 `zMap`（决定 tilt + focus + perspective）是两套**完全独立**的随机系统 → 一球可能 zMap 高（近）但 baseLayer 高（远小）
  - 决定：spawn 时基于同一 z 派生 `baseLayer = round((1-z) × (NUM_LAYERS-1) + 1)`，4 个系统同根
  - 副产物：聚落内球 z 相近 → 球大小相近，视觉聚落感更整齐
  - 教训：多套独立"远近"概念是 v15 之后又一次撞上；任何"远近相关"的派生量都该从同一 z 算

- **v86 tilt 三档曲线：baseline + 指数 + 双层 lerp**
  - 起因：纯线性 tilt × z 让 z=0 球完全不动太死板，且 inside/outside 切 lerp 系数瞬间速度突变造成"出边界迟滞"
  - 决定（合一个曲线）：
    - 远端 baseline 0.15 微动（z=0 球仍漂移 21px）
    - `pow(z, 1.2)` 曲线匹配 perspective 指数 factor（远衰近增）
    - inside 时单层 lerp 0.18 灵敏跟手；outside 双层 0.08+0.08 ease-in-out 柔回弹
    - mouseleave 1s 后才切 outside（与 target 归零同步），避免 lerp 系数中途切换造成视觉迟滞
  - 长期影响：相机/视差/zoom 三系统应用同一组"远近"语义，不再是独立调参

- **v86 focus 锁近端 + 随 k 衰减**
  - 起因：放大后近球反而虚化（"近视眼感"）；放大很深时远球还是模糊
  - 修法 1：`focusZ = max(0.7, 1 - (k-1) × 0.1)` 锁定焦点不漂离近端 0.7 以下
  - 修法 2：`focusDecay(k) = max(0, 1 - (k-1) × 0.5)` 让 blur/brightness 衰减系数随 k 减小，k=3 时 focus 强度 0（全清）
  - 三处用同一公式：`applyFocusBlur` / sim tick layerWave2 联动 / comet head filter

- **v86 layerWave2 事件驱动取代 v80 全员双频**
  - v80 实施：36 球同时双频 sin/cos 持续波动 → 每帧 36 球 setAttribute('transform') + scale 大幅变化（amp 1.5-3.5）→ 把背景涟漪渲染配额挤走"卡顿"
  - 决定：拆 layerWave1（保留 v80 原版）+ layerWave2（新版调度器）
  - layerWave2：每 2s 选 1 球进入波动，钟形 `sin(π·t)` 8-12s，target = kmax 或 kmin，跳过已在波动中的球
  - 调度抽到独立 hook `use-layer-wave.ts`（hook block 触发拆分，授权后自动建文件）
  - 性能：每帧最多 1-3 个 active wave，开销接近 0
  - 教训：36 球同时变化挤占 GPU 渲染时间是真实 bottleneck；事件驱动单球比全员持续动有数量级差异

- **v86 删 12 effect**
  - 起因：v40-v62 在沙箱试了 17 个 effect，用户挑选后定型
  - 决定删除：A1 glass / A3 specular / A4 tint / B5 wrap / B6 fisheye / C11 breath / layerWave1 / D13 trail / D15 flare / F19 edgeBend / G22 fly / favoriteButton（球角心形）
  - 保留 10 effect：focus / tilt / perspective / comet / sphereRipple / layerWave2 / fog / stars / aurora / bgRipples
  - 球收藏入口从"球角心形"挪到"BottomPlayer 文案按钮"，UI 更简洁
  - effects/ 子目录从 5 个（ambient/geometry/interact/motion/shading）→ 2 个（ambient/motion）
  - 教训：沙箱不是终点，要敢于砍

- **v86 d3.zoom drag pan 在 perspective 模式下恢复**
  - 起因：v84 注释"perspective 不支持 pan"被用户翻出问"原来有的拖动整体平移功能呢"
  - 修法：zoom event perspective 分支应用 `translate(transform.x, transform.y)`（仅 translate，scale 不应用因 perspective 用 vanish 处理 zoom）；自定义 wheel handler perspective 路径保留 `t0.x/t0.y` 不动，仅改 k
  - 关键：让 wheel 与 drag 互不干扰 —— wheel 只改 k、drag 只改 x/y

- **v86 K_MIN 16→24 + SIZE_BASE 动态化**
  - K_MIN 提 1.5× → 球大小最小值 8px → 12px
  - 副产物发现：`comet-spawn.ts` 的 `SIZE_BASE = 8` 是硬编码，注释说 `K_MIN × LAYER_MIN_FACTOR = 16 × 0.5 = 8`，但 K_MIN 改后没自动跟随
  - 决定：`SIZE_BASE = K_MIN * LAYER_MIN_FACTOR` 计算式而非常量，下次改 K_MIN 自动跟随
  - 长期影响：派生常量都用计算式，避免"改 A 忘改 B"

- **v86 stars-background 动态化**
  - 起因：用户希望星空有"呼吸感"
  - 决定：80 颗初始星 + 12.5% 闪烁（CSS animation fill-opacity 0.15↔0.95）+ 每秒 30% spawn / 30% despawn（fade 1.5s）
  - 性能：每 ~3.3s 一次 DOM ops + ~10 个闪烁 GPU 层 → 远低于 BackgroundRipples 规模，不会卡
  - 实现细节：闪烁星不 setAttribute fill-opacity（让 CSS keyframe 完全接管），普通星 setAttribute（v25 SVG attr ≠ CSS animation 的应用）

- **v86 彗星 trail 自然消失**
  - 起因：彗星飞出屏幕时 cometsRef filter 把对象清掉 → trailHist 跟着清 → 留下的 persistent 点点瞬间消失
  - 修法：`cometsRef` filter 加 12s 缓冲（max trail lifetime ≈ 11.2s）；path 走完后 head 不渲染、trail 不再 spawn 新节点；已 spawn 的点点按自身 lifetime 自然 fade
  - 教训：动画"消亡"应该按数据本身的 lifetime 走，不要被父对象生命周期一刀切

- **v86 aurora 偶现化**
  - 起因：用户感觉极光"几乎常驻"
  - 决定：周期 18-30s → 50-80s，keyframe opacity 静默时长占比 30% → 70%（4 块独立 delay 错开），色彩 alpha 减弱 ~45%
  - 现状：每块 50-80s 出场一次，每次约 15-25s 可见

### 文件拆分 / 硬线触发记录（v36-v86 期间）

- `archipelago/` 目录 8 文件硬线撞了 1 次（要新建子目录）：用户授权后撤回方案 A，改方案 B 压缩注释 sphere-config.ts 237→196 行
- `use-sphere-sim.ts` 220 硬线撞了 4-5 次：均自动压缩 / 抽 helper（如 `lerpMouseSmooth` 抽到 `use-mouse-tilt.ts`）
- `comet-system.tsx` / `use-sphere-zoom.ts` 220 硬线撞了多次：均通过精简注释或合并行解决
- 用户两次 feedback 强化 memory `feedback/auto_split_files.md`：拆分由 AI 自主决策，commit 说明即可，不再问

### 关键决策回顾（教训）

1. **多套"远近"概念是技术债**：v15 修过一次（link / cluster），v86 又修一次（baseLayer / zMap）。任何派生量都从同一 z 算
2. **视觉位置 ≠ sim 位置**：perspective 让二者分离，公式涉及哪个量必须写清
3. **事件驱动 > 全员持续动**：layerWave 的两版差异是数量级
4. **数学锚点 > 视觉锚点**：v85 → v86 的 vanish 修正
5. **派生常量用计算式**：SIZE_BASE 教训
6. **animation 消亡按数据 lifetime**：彗星 trail 教训
7. **inside/outside 状态切换要同步 target 切换**：tilt 迟滞教训

## 2026-05-03 — Phase 6 v2 缩减：UI 重设计深度版迁 P7

- **Phase 6 范围大幅缩减**（推翻 2026-04-25 kickoff 时定的 13-step Track B 流水线）
  - 起因：① 艺术家 5 条反馈到位（视觉 / 动态 / 音阶 / 名字 / 按键动画），② 用户决定不再放大众 tester，③ 投资人只看链上技术不看 UI
  - 决定：Track B 13 → 7 step；移除整条 Claude Design UI 重设计流水线（B2.0 / B2.0.5 / B2.0.7 / B2.1-B2.5 / B2.4.5）
  - 新增：B6（A 组 5 球 demo + B/C 36 球 demo）+ B7（端到端冒烟）
  - 重写：B2 从"4 页 Claude Design 重设计"改为"/me /score /artist 小修 + bug 清扫"
  - 影响：P6 时间线从 5-6 周压到 3-5 天；UI 重设计深度版整体迁 P7
- **artists 反馈 5 条记录**（2026-05-02 收到，作为 B2 / B6 / P7 输入）
  1. 视觉：漂浮液态感 + 透明度调整（不要"星球"要"液态细胞"）→ 迁 P7
  2. 动态：流动 + 更多随机扰动事件 → 迁 P7
  3. 音阶：键盘触发音阶（A=钢琴 1-0 / Q=提琴）→ 迁 P7（**新功能，非重设计**）
  4. 音乐圆圈不需要名字，数字代号 → P6 B6 处理
  5. 按键动画自定义 + 与岛屿/日食原生组件交互 → 迁 P7
- **/me 已知 2 个 bug**（用户反馈 2026-05-03，B2 修复输入）
  - 录制音频一直显示"上传中"卡住
  - 完全铸造专辑一直不更新
  - 待 B2 实施时和用户对齐复现路径（mint_id / token_id 让我去 Supabase 查日志）
- **stakeholder 反馈概念校准**
  - 推翻：原 kickoff 假设"放限定 tester 5-10 人 1-2 周收反馈"
  - 真相：用户只在乎艺术家（已收）+ 投资人（只看链上技术）
  - 影响：playbook 里"tester"概念校准为"关键 stakeholder"；不放大众 tester
- **B6 副作用接受清单**（用户多轮确认）
  - A/B/C 三组前 5 球数据共享同一份 tracks 行 — 接受
  - B/C 后 31 球 audio_url 循环到 No.1-5（"36 球都听新音乐"）— 接受
  - B/C 真铸造在测试网 token_id 6-36 元数据语义混乱 — 不在乎
  - 链上旧 holder NFT 不可改 — 接受
  - /me 可能出现重复 NFT 展示 — 测试网不在乎
- **Phase 7 候选清单写入 STATUS.md**
  - 含艺术家反馈 5 条 / UI 深度重设计 / Claude Design 接入条件评估 / 跨浏览器截图归档

## 2026-05-04 — B6 实施完成 + B7 改放最后

- **B6 实施完成**（A 组 5 球 + B/C 36 球 demo 上线）
  - migration 027 + seed 028（编号顺移自 022-026 已被 Track A 占用）
  - 28 SQL 安全过滤 `score_queue_id IS NULL` 避免误伤 ScoreNFT 行（playbook 原 SQL 未过滤）
  - 球内嵌 Modak 气球字数字 badge（位置 0.55r, 0.55r / 字号 1.26r / 白色 fillOpacity 0.32→hover 0.55）
  - SphereCanvas 抽 `getGroupTargetCount(gid)`：A=5/B=C=36，nav badge 同源
  - 移除 `radius >= 14` 阈值（字号 *3 后小球也能看清，原阈值反成 bug → 球随机分到深层时数字消失）
- **推翻 v2 playbook"B7 放第 2 步"，改放最后**
  - 起因：用户问"B7 要不要放最后"，复盘后发现：
  - /me 2 个已知 bug 用户已知 → 不需要 B7 发现 → B7 主要价值是发现"未知" bug
  - 中间 B7 跑出的 bug 清单会被后续 B2/B3/B4/B5/A 修复过程过时（修了又测又改的循环）
  - 决定：B7 留到最后作为 Phase 6 completion gate，一次冒烟覆盖所有功能（含 B3 草稿铸造 + Track A 改动）
  - 影响：playbook overview Day 0.5 删 B7，Day 3-4 加 B7；推进序列更顺

## 2026-05-06 — B2 Bug C 后端双根因修复（Bug A/B 留 B2 P1）

- **ScoreNFT cron 4-28 起一直 fail**，root cause 排查后是双根因叠加（不是同一个 bug）
  - 根因 a — Turbo wallet JSON 含中文 `purpose` 字段，PowerShell/编辑器写入时编码错误（GBK→UTF-8 mojibake），第 256 字节附近成非法 UTF-8 → cron 启动 `JSON.parse(jwkEnv)` 在 position 256 崩
  - 根因 b — Vercel env var 拼错成 `NEXT_PUBLIC_SCORE_NFT_ADDRES`（少一个 S），代码读的 `NEXT_PUBLIC_SCORE_NFT_ADDRESS` 全程 undefined → 修复 a 后 cron 走到第 4 步 `_shared.ts:26 SCORE_NFT_ADDRESS.toLowerCase()` 崩
  - 双根因互相遮挡：a 不修则 cron 在第 1 步就崩，b 永远不暴露
- **修法**：本地 wallet 文件 Notepad 删 purpose 行 + Vercel 加正确 env var + 删拼错版
- **代价**：4-28~5-6 期间 8 条 ScoreNFT 铸造全 fail；其中今天测试的 1 条已上链 token_id=2 但 metadata 永远空（弃了不补，测试网无所谓）
- **教训**：
  - 钱包/配置文件**永远不要写中文注释**（用文件名/单独 README 标记用途）
  - `NEXT_PUBLIC_` env var 极易 typo → P7 加 `scripts/vercel-env-sync` 自动对比 `.env.local` 与 Vercel
  - 用户调试 PowerShell 输出**含 privateKey 的完整 JSON 直接贴到 chat**了 → 钱包私钥已泄露
- **泄露处理**：当事钱包 `0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8` 余额极小，用户决定不换；P7 任务记下"换 Turbo wallet"
- **未修**：B2 P1 三件套（Bug A 服务端权威 mintingState / Bug B 骨架屏 / polling）—— 今晚继续做

## 2026-05-08 — B8 P3 端到端跑通 + arweave_url 上链 + B4 删 + agent review

- **B8 P3 实质完成 B2 Bug A/B**（不是单点修补，是数据流重设）
  - HEAD `38f7f37` (P2) commit message 列了 P3 待办：路由双兼容 + ScorePlayer 前端 inline + Resend 邮件告警 + 全链路实测
  - 本次实施前 3 项；Resend 延后到主网前必做（测试网 + 当前用户量靠人工巡查 + /api/health mintQueue 兜底）
  - 路由 `[tokenId]` → `[id]` 双兼容：纯数字按 tokenId 路径（兼容旧分享卡）+ UUID 按 queue.id 路径（B8 主路径，含未上链中间态）
  - ScorePlayer 改前端 inline：`PlayerProvider.toggle` 播底曲 + `useEventsPlayback` 按 events.time 触发音效；删 Arweave decoder iframe 调用（架构决策 6 第 4 层"链上灾备"在 B8 后已删，待 P7 重新设计）
  - **决策**：B8 inline 播放需要 `track.audio_url`，链上 metadata 拿不到完整 Track → ARCH 决策 6 第 4 层冗余降为 P7 重评估
- **B6 demo 5 球 arweave_url 上链回写**（5/6 P7 task 提前消化）
  - 起因：实测 778a2904 卡 30+ 分钟，诊断 `track.arweave_url=NULL` 导致 cron `stepUploadMetadata` 必崩
  - 跑 `scripts/arweave/upload-tracks.ts` 一次：5 个 mp3 全上传 + 回写
  - **提前做的理由**：B7 端到端冒烟反正要撞，越早做越早解锁后面工作；不做 = 主网首版铸造 0 成功率
  - 副产品：Turbo 钱包余额 3.3T winc，5 个 mp3 几 MB 不消耗多少
- **B4 删除**（PlayerProvider.tsx:86-114 loadingRef 早已实施）
  - 起因：用户提"B4 这个问题已经没了"
  - 验证：grep PlayerProvider 看到 `loadingRef.current === track.id` 防快速连点已在
  - 删除范围：playbook track-b 行 199-237 整段 step + 列表行 + 决策行 + overview Day1 Day2 + STATUS 下一步序列 + TASKS 步骤 3 + 完结标准 7→6 step
- **生产 cron 节奏发现**：lease 5 分钟 × 5 步 = 25 分钟（不是 STATUS 文案"约 5 分钟"）
  - Phase 6 A1 durable lease 防 cron timeout race 是对的，但每步占满 lease + cron 1 分钟一次 → 实际等 25 分钟
  - 选项①：终态外推进步骤时一并清 lease（让下一分钟 cron 立刻接管）
  - 选项②：cron 频率 1min → 30s
  - 选项③：保留设计但更新 STATUS 文案
  - B7 端到端冒烟前需决策（影响实测耗时体验）
- **/api/me/score-nfts 35s 慢**（B8 P2 引入回归）
  - 根因：联表 `pending_scores(events_data)` 算 eventCount，events_data 是大 JSON 数组 × N 张唱片
  - 修法：加 generated column 或 RPC `jsonb_array_length(events_data)`，挂悬空 TODO
- **agent review 13 finding**（独立 reviewer 审 B8 P3 工作树）
  - P0×3 全采纳：isSafeInteger 防御 / token_id 双行命中 order().limit() / pendingRes error log
  - P1×5 采纳 4 项：cover txId try-catch / Promise.allSettled / ScorePlayer 文案 / useEventsPlayback seek 注释；OwnedScoreNFT.id 双语义 brand type 挂 P7（caller 仅 ScoreCard 一处影响小）
  - P2×5 采纳 1 项：score-fallback.ts 完全删（noop 残留比删除更糟，TS 不报错但语义死代码）；其余挂 P7
  - codex CLI v0.128.0 走 `--uncommitted` 默认 prompt 跑出 262KB 命令日志 dump（GBK 中文乱码 + 0 finding）→ 删除该文件，下次用 `codex exec` 子命令 + 自定义 prompt 才有用
- **Audit 整体收口**（B8 P3 commit 完后用户让 "继续推进"，audit 后发现 Phase 6 几乎全完）
  - 8 项 step 标 ✅ 完成（playbook 列待做但代码早已实施，仅文档未对齐）：
    A0 operator 锁 / A1 ScoreNFT cron durable lease / A3 sync cursor 事务性 / A4 草稿原子化 RPC /
    B3 草稿铸造（5/8 实测 token_id=12 验证）/ B5 #7 tracks 韧性 / B5 #9 草稿恢复 / D2 admin Bearer
  - 2 项标废弃：
    B5 #8 移动端首帧（HomeJam 已 `references/dead-code/`，主页改 Archipelago）/
    E4 decoder 多网关 fallback（B8 P3 删 iframe，详情页改前端 inline 播放，原 step 设计目标不存在）
  - 1 项挂 P7：A5 链上灾备（B8 P3 注释已说，本次 step 顶部加状态标记）
- **E4 废弃决策**（接受 OpenSea 端单网关风险）
  - OpenSea 端 metadata animation_url 仍指向 arweave.net decoder（链上不可改），但项目主路径不依赖
  - 主网用 ario.permagate.io 作为兜底单网关已足够稳定（社区运营 + 之前实测 OK）
  - 加更复杂 metadata 多网关写法会让 OpenSea 解析风险更大，得不偿失
  - P7 若真有用户反馈再做
- **真实剩余 backlog**：B7 端到端冒烟（半天）+ Phase 6 completion review（半天）= **1 天即可进 Phase 7**
- **本次文档对齐落地**：5 个 track playbook 全加 ✅ 完成标记 + 实施位置 + commit ref / STATUS.md 主体重写 / TASKS.md 步骤 3-5 全标 ✅ / ARCHITECTURE.md 决策 6 + § 公开回放页 同步 B8 P3 路由 + 灾备 P7 + mint_events 降级 + pending_scores 不再过期
- **B7 端到端冒烟通过 + Phase 6 完结**（同日 22:00+）
  - 19 项 smoke 清单：A 4/4 + B 8/8（5/8 端到端实测覆盖）+ C 2/3（C1 audit 验证）+ D 2/2 + E 0/2（移动端挂 P7）= **16/19 通过 + 0 P0 + 0 P1**
  - AI 自动跑：A2 ping / A3 health / D1 cron 401 / D2 admin Bearer 全过；附带发现 P2 wallet-low（5/6 旧钱包）+ score-queue-cleanup（16 个历史 fail row）+ slow-network-no-spinner（C2 UX 改进）
  - 用户手动跑：C2 慢网占位文字按设计显示 + C3 防重铸 OK
  - **Phase 6 completion review** 写就 (`reviews/2026-05-08-phase-6-completion-review.md`)：含 Phase 6 全部 step 状态汇总 + 24 commits 时间线 + Phase 7 起点 10 项硬阻塞清单 + 风险评估 + 进入判定
  - 主网前必做（硬阻塞 5 项）：换 Turbo wallet + 108 曲 arweave_url + Operator wallet 主网 ETH + Resend 告警 + vercel-env-sync 脚本
- **Phase 6 v2 计算口径回顾**：原"5-6 周 4 阶段"→ v2 缩减"3-5 天"→ audit 后实际"1 天"→ 真实跨度"14 天 (4-25 → 5-8)"，含 B2 前端 25+ 轮视觉迭代（独立技术栈）+ 5/6 Bug C 双根因诊断 + B8 数据流重设 3 阶段 + audit 收口；超原 v2 估算的工作来自 B8 重设 + 视觉打磨
- **Phase 7 overview 自审 + codex review + 整合优化**（2026-05-08 晚）
  - 起因：用户要求"自己 review + codex review + 整合 + 自我优化"
  - 自审抓到 5 项：投资人伪问题 / 漏移动端 / Claude Design 工作流缺仲裁 / Phase 7 内发现需要后端改去哪 / 缺"何时从讨论切执行"
  - codex 评 8/10，抓到我没抓到的 3 项：① "唯一已定的决策" vs "只动视觉层" 内在矛盾 ② 漏"用户路径优先级（线性 vs 单页）"维度 ③ A5 应拆"UI 降级壳 P7 + 数据路径 P9"
  - 整合后核心改动：
    * 删"唯一已定的决策"，改"Phase 7 / 8 / 9 分流规则" + "候选顺手项"（4 项启动时裁决，含 A5 拆两半 + 返回链接改 /me）
    * 头脑风暴 4 层 → 5 层（加"用户路径 vs 单页"）
    * Claude Design 接入独立成节，4 件事必答（输入 / 输出格式 / 翻译 / 冲突仲裁优先级）
    * 工作模式加"何时从讨论切执行"（30 分钟卡住切最简版本）
    * 启动信号 5 步流程（先过候选项 → Claude Design 工作流 → 头脑风暴 5 层）
  - codex review 归档 `reviews/2026-05-08-phase-7-overview-review.txt`
  - 原计划：Phase 7 = UI 翻修 + 修 bug + 主网部署一锅端
  - 推翻原因：测试网当前稳定（5 cron 全绿 + B7 16/19）→ 不急上主网 → 把"产品深度"和"工程清场"分开做更线性
  - 新分法：Phase 7 = UI 翻修 + 体验细节（含 3 个顺手 P1：A5 / P1-17 / P1-18）/ Phase 8 = 按键动画 + 音效扩 26→50 / Phase 9 = 修 bug + 上主网
  - **顺手 P1 归宿**：A5 / P1-17 / P1-18 = UI 翻修必碰组件，进 Phase 7；P1-21 = 音效相关，挪 Phase 8；其他 P0/P1 = 后端，进 Phase 9
  - **CRON_SECRET 不换**：5/8 strict review 调试时在聊天泄露 → 决策测试网风险低（cron 调用浪费 vercel 配额无实损），主网部署日（Phase 9）必须换
  - **playbook/phase-7/overview.md 写得故意开放**：用户要求"留足够开放度"，启动时先头脑风暴 + Claude Design 接入再做具体计划，不预设 step 数 / 不预设改哪些文件 / 不预设交付标准
- **strict CTO review "现在就修" 6 项落地（合 push 前一刀切）**
  - 决策：`reviews/2026-05-08-phase-6-strict-cto-review.md` 三档分组里的"测试网当前已暴露/修法极小"6 项不等 Phase 7，本轮一次性合掉，避免 push 后再触发一次 vercel 部署
  - 6 项：P0-3 AirdropNFT env 硬开关 / P1-3 React key queueId 字段 / P1-8 score_nft_queue.failure_kind / P1-9 health 用 created_at / P1-10 queue-status Bearer-only / P1-19 pending_scores.event_count generated column
  - 推翻"P1-19 挂 P7"：原打算等 P7，但用户 35s 体验已暴露，且 generated column 一行 ALTER TABLE 比 RPC 简单 → 现在做
  - 新增 2 个 migration（030 / 031）— review 原文写"一行 SQL 改动"漏看了 `score_nft_queue` 没 failure_kind 列、PostgREST 不能直接 SELECT jsonb_array_length；实际工时从 1.5h 涨到 ~2h
  - **运维联动**：测试网 Vercel 必须加 `AIRDROP_ENABLED=true`（保持现有空投行为）；主网部署时**不设**此 env / runbook 把 queue-status 调用改 Bearer header

### 2026-05-13 — Phase 7 范围重定 + 拆 P7/P8/P9/P10 四段（旧 5/8 拆分作废）

**触发**：用户 2026-05-13 提"投资人在催 Semi 接入"+ "全站启动提速"诉求，与原 P7=UI 翻修不一致。

**新拆分**：
- **Phase 7（当前）** = 修严重 BUG + Semi 社区钱包接入 + 全站提速（14-18 天）
- **Phase 8** = UI 大升级（艺术家反馈 5 条 + Claude Design 接入 + /me /score /artist 深度重设计）
- **Phase 9** = 按键动画 + 音效系统扩展 26 → 50
- **Phase 10** = 性能深度优化 + 上线检查 + OP Mainnet 部署 + 首周救火

**P7 三个并行 Track**（详 `playbook/phase-7/overview.md`）：
- Track A 修严重 BUG：14 有效 step（去 4 项 5/8 已修 audit only），覆盖 strict review 6 P0 中剩余 3 项 + 9 项 Day 1-3 必修 P1
- Track B Semi 社区钱包前端接入：5 step，复用 Phase 4A S0-S2 后端 100%
- Track C 全站提速：7 step，baseline-first 方法 + 不引新依赖

**关键决策**：
- **Semi 现有 API 先用着**（D-B1）：投资人催 demo > 等 Semi OAuth 政策；标 PoC-only，Phase 10 部署主网前找 Semi 沟通正式授权；SIWE fallback 方案保留
- **A3 修订**（不承诺等 receipt）：strict review P0-2 原方案"sigkill 后等 receipt"实施不可行（无 tx_hash 时 getTransactionReceipt 无参数），改"防重发 + 5 分钟超时 manual_review + 人工核查"；长期 idempotency key + simulateContract 方案挪 P10
- **A3 + A12 合并为状态机修复包**：避免 process-score-queue/route.ts 同文件二次手术
- **A8 Resend 默认挪 P10**：原计划"基础设施 only 不接 cron"违反 AGENTS 禁止占位 + resend SDK 不在 STACK 白名单；P10 接 cron 同时做基础设施
- **A11 / A18 已修不重复**：commit `0d75a93` 5/8 落地后实际已修，改 audit step 不计工时
- **A1 复用 NEXT_PUBLIC_CHAIN_ID**：不新增 CHAIN_ID env，避免双来源
- **A2 原子部署流程**：合约重部署 + Vercel env 更新 + redeploy 必须按 D-A2 严格顺序
- **A5 / A6 事实修正**：generate-eth-wallet.ts 已 git rm (commit `be4e07a`) 需重写；public/tracks 实际 6/108（非 5/103）需用户先补 102 曲

**9 项 P1 显式挂 P10**（每项有归宿，不留模糊）：
- P1-1 save_score_atomic exception null check / P1-2 mint_score_enqueue 错误信息友好度 / P1-11 airdrop_recipients CAS / P1-12 Deploy 脚本主网 fail-fast / P1-13 forge verify-contract runbook / P1-14 load-env.ps1 多行 value / P1-24 airdrop module lazy validate / P2-11 score_nft_queue.token_id partial unique index (改进 A3+A12 migration 顺手) / P1-4 + lint 2 处 + OwnedScoreNFT.id 双语义挂 Phase 8 UI 翻修

**三方 review 整合**：
- Claude 自审（general-purpose agent）+ Codex 全量 review + Codex 合约/cron 深度 review 三方独立
- 三方共识：playbook 不可直接开工，16 项必修
- 整合归档：`reviews/2026-05-13-phase-7-playbook-review.md`
- 全部 16 项必修已落地到 4 份 playbook，可启动 Track A/B/C

**与 5/8 旧拆分对比**：
- 旧：P7=UI / P8=按键音效 / P9=主网（三段）
- 新：P7=BUG+Semi+Perf / P8=UI / P9=按键音效 / P10=主网（四段）
- 旧 P7 "顺手 3 个 P1"（A5 / P1-17 / P1-18）改为 Track A 子项归宿
- 旧 P7 "UI 翻修开放骨架"（commit `e7030a8` overview）整体作废，新 overview 覆盖重写

**Track 依赖图**（同日二次修订后的最终口径）：
- A1 (chain config) → Track A 内部起点；B4a 不硬等 A1，A1 完结后回归 10 分钟
- A3+A12 (cron 修复包) → 阻塞 A14 / A15；不再阻塞 C1
- C3 (/api/me/scores 拆 split) → 必须先于 A14 / A15（polling 契约）
- A1 / B1 / C1 是三个 Track 各自起点，完全独立可并行

---

### 2026-05-13 二次修订（同日，用户质疑起点混乱后调整）

**起点改 3 个 Track 各一个**（推翻上面"4 起点 A1 / A3+A12 / B1 / C3"）：
- 用户原话："起点简单清晰，不易出错，并且能多线并行"
- 新起点：**A1 / B1 / C1**（每个 Track 一个起点，符合直觉）
- 副作用：
  - **B4a 接受临时硬编码 chain**（D-B7 修订）：A1 完结后回归 10 分钟。理由：A1 是工程清理不改运行时，B4a 期间 operator-wallet.ts 写死 sepolia 也能跑测试网
  - **C1 跑两次**（D-C0 修订）：第一次作为"修前 baseline"现在跑（不等 A3+A12），即使含 25min lease 影响"上链中"草稿状态感知也反映真实用户体验；C8 修后对照报告对比这组数据。理由：投资人 / 协作者更有说服力 + Track C 不再卡 Track A
  - **C3 / A14 / A15 依赖保留**（不动）

**A6 范围缩到 20 曲**（推翻"108 曲全量上链"的 P7 目标）：
- 用户原话："P7A 只有 20 首，等到上架新 15 首的环节，我就把 15 首给你"
- A6 = 20 曲（艺术家承诺先给 20 首）+ 含 B6.1 子任务（A 组扩到 20 球 / B+C 36 球后 16 个循环 No.1-16 / SphereNode badge 双位数）
- 剩余 88 曲挪 Phase 10 / 艺术家长期补曲，不阻塞 P7 完结
- 副作用：Track A 不再被艺术家进度阻塞 + B+C 组 21-36 球用 audio_url 路径播放（arweave_url=NULL 允许，因为不走草稿铸造）

**A6 含 B6.1 数据扩容**（migration 030 + sphere-config + SphereNode badge），等艺术家给 15 首 mp3 时统一在 A6 step 内消化（不单独提前做，避免代码先动而数据/视觉调试拆两次）
