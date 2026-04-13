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
