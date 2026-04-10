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
