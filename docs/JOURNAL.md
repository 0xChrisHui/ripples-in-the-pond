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
