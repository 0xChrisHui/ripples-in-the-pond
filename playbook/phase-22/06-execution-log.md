# P22 执行记录

> 2026-10-30，分支 `feat/p22-score-pack`，全部本地提交，未 push、未部署、未写任何数据库。

## 已完成

| 步 | 状态 | 证据 |
|---|---|---|
| P22-0 查实与冻结 | 完成 | `01-chain-evidence.md`、`05-frozen-decisions.md` |
| P22-A 合约 | 完成 | `forge test` 128 全绿（P22 新增 35） |
| P22-C 服务端 | 代码完成，未联调 | 类型检查、ESLint、`scripts/p22/pack.test.ts` 通过 |
| P22-D 界面 | 代码完成，未目验 | `/score` 开通面板、`/me` OP 勾选框 |
| P22-E 可视化页 | 代码完成，未目验 | `/score/[chainId]/[contract]/[tokenId]/pack` |

## 用户决定（2026-10-30）

- **范围：只给用现行 33 个音效铸成的 Score 开包。** 用过旧版音频的 Score（如 ETH Token #1）不盘点旧音效，开包会被服务端以 MISSING_ASSETS 拒绝，属预期行为，不是缺陷。
- **ETH 用补开逻辑：** 不做"Score 确认后自动弹第二次钱包确认"，ETH 用户在 `/score` 页点"开通资产包"。OP 保持勾选后自动开包。

## 未做（需用户放行或前置条件）

- P22-0b 规则文档同步（`ARCHITECTURE.md` 决策 6/7、`STACK.md:33`、`CONVENTIONS.md:71`）：改前须用户确认。
- P22-A2 测试网部署、P22-B Arweave 上传（付费）、P22-G 主网：均为用户 Gate。
- migration `063_score_pack_orders.sql` 未跑，测试库与正式库都要用户放行。
- 浏览器实测（P22-D/E/F）：依赖测试网合约与 migration。
- 素材 metadata/图片尚未上传，`defineTokens` 还没调用。
- 并发测试（与旧 Score/素材/Pond Echo worker 同跑）与 cron 的 DB 路径无自动化测试。

## 新增环境变量（均未配置，代码对未配置安全降级为"该链不开放资产包"）

- 每链：`NEXT_PUBLIC_P22_OPENER_<chainId>`、`NEXT_PUBLIC_P22_SOUNDS_<chainId>`、`NEXT_PUBLIC_P22_TRACKS_<chainId>`、`NEXT_PUBLIC_P22_DEPLOY_BLOCK_<chainId>`
- 服务端：`P22_SIGNER_PRIVATE_KEY`、`P22_SIGNER_ADDRESS`（独立于 operator）
- 部署脚本：`P22_SCORE_ADDRESS`、`P22_ADMIN_ADDRESS`、`P22_SIGNER_ADDRESS`、`P22_PAUSER_ADDRESS`、`P22_SOUND_CONTRACT_URI`、`P22_TRACK_CONTRACT_URI`、`P22_ADMIN_DELAY_SECONDS`

## P22-A2 OP Sepolia 部署与端到端（2026-10-30，第一版，已被下方重部署取代）

| 合约 | 地址 |
|---|---|
| ScorePackOpener | `0x646d46312C0ad844d90a39C5c60bb3f8571391e4` |
| PondSoundNFT | `0xF8501Aa707899644b9943Ba2Fb9a2cBea2590Db0` |
| PondTrackNFT | `0xbc99085aeB238d5329640eB6c899A9C3Ee1b71aF` |

- 部署者 `0x306D…1633`（现有热钱包，部署后不持有任何角色，已读回确认）；admin / signer / pauser 为新生成的测试网专用钥匙，保存在桌面 `p22-testnet-keys.json`，**仅限测试网，主网必须另换**。
- 素材 URI 是占位地址（`ar://P22-testnet-placeholder-not-real-…`），登记了音效 1–33、背景音乐 1–35。主网换真实 Arweave 地址。
- 端到端（`scripts/p22/e2e-open.ts`）：服务端同一套凭证代码签名，由**非持有人**地址提交 `open`，Score #2 的账户 `0x5319…7b59` 收到背景音乐 1 份 + 音效 1/2/3 各 1 份，`opened=true`，gas 292972；第二次开包被拒绝。
- 未做：浏览器界面实测、cron 与数据库路径联调（无测试库）、ETH Sepolia（已决定跳过）。

## 安全修复后重部署 OP Sepolia（2026-10-30，当前有效）

开包合约构造函数新增绑定校验，旧版作废（旧地址 `0x646d…91e4` 等不再使用）。

| 合约 | 地址 |
|---|---|
| ScorePackOpener | `0x4Db23587222c2BDd3aa051558AB4e37F945d7399` |
| PondSoundNFT | `0xa269619706bD25B648a10Cd0AC32671847C572b9` |
| PondTrackNFT | `0xbF394442603447B022Bd7057F98CcEC386D8c35E` |

- `VerifyScorePack` 读真链核对通过；占位素材已登记（音效 1–33、背景音乐 1–35）。
- 端到端：Score #2 由非持有人提交 `open` 成功（gas 223578），TBA 同样地址 `0x5319…7b59`（账户地址只由 Score 决定，与 opener 无关），第二次开包被拒绝。
- 主网部署前置：全新部署钱包、运营钱包地址（`P22_OPERATOR_ADDRESS`）、独立 admin/signer/pauser。

## P22-0b 与 P22-B 准备（2026-10-30）

- P22-0b 已按用户授权完成：`docs/ARCHITECTURE.md` 决策 6/7、`docs/STACK.md`（链选择）、`docs/CONVENTIONS.md`（钱包写入例外）已同步，提交 `ee21ab2`。
- 素材 metadata 生成器 `scripts/p22/build-asset-metadata.ts`（只写本地，不上传）：音效 33/33、背景音乐 35/35，单个文件最大 525 字节。音频全部复用已有 Arweave 文件，只需新传 metadata 与图片。
- **上传成本估算**（Turbo 公开报价，1 GiB ≈ \$73.08；2026-10-30）：70 个 metadata（约 0.6 KB）合计约 \$0.005；2 张图片（各 ≤100 KB）各约 \$0.007；合计不到 \$0.02。过往 <105 KB 的文件在账本里 `costWinc` 为 0（免费档），实际可能为 \$0。
- **上传前提（未满足）**：①两张图片（音效共用一张、背景音乐共用一张）需要设计，当前为占位值；②Turbo 钱包已配置（`TURBO_WALLET_PATH` 指向存在的文件）；③上传属付费动作，需用户批准。
- 主网合约登记还需把 70 个 metadata 的 `ar://` 地址回填到 `defineTokens`。
- Turbo 余额实测（只读，`getTurboUploadBudget`）：可用 536,146,205,390 winc（约 \$2.5）；70 个 metadata + 2 张图片需约 3.9×10^9 winc（约 \$0.02），余额约为所需的 136 倍，无需充值。
