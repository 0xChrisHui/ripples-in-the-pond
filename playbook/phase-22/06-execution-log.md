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
