# STATUS — 项目当前状态

> 给"人 + AI"共用的状态面板。每完成一个小闭环都要更新。

---

## 当前阶段

**Phase**: Phase 3 — Score NFT（乐谱 NFT + 封面 + 分享）
**目标**: 草稿 → 可分享的 ScoreNFT（ERC-721），带封面、可在 OpenSea 听

## 当前进度

**做到哪**: Step S0 完成（Arweave 工具链 + 26 音效 + 5 tracks 全部上链）
**下一步**: Step S1 封面系统 — 生成 100 张测试封面 + score_covers 表 + 批量上 Arweave
**playbook**: `playbook/phase-3-score-nft.md`

### 续做指南（下次会话第一件事读这段）

- S0 产物：`data/sounds-ar-map.json`（26 音效 txid）+ Supabase tracks 表 arweave_url 列已填
- **Turbo 钱包**：`0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8`（Base 链）
  - JSON 文件在 `~/.ripples-secrets/turbo-wallet.json`（绝不进 git）
  - 环境变量 `TURBO_WALLET_PATH` 指向它（在 `.env.local` 里）
  - 当前余额 ~3.3T winc（够 Phase 3 + Phase 4 早期）
- **补 credits 的 3 步**（余额低时用）：
  1. MetaMask 切到 Base 网络 → 往 `0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8` 转 ETH
  2. `TURBO_WALLET_PATH='C:/Users/Hui/.ripples-secrets/turbo-wallet.json' npx tsx scripts/arweave/wait-for-base-eth.ts`
  3. `TURBO_WALLET_PATH='C:/Users/Hui/.ripples-secrets/turbo-wallet.json' npx tsx scripts/arweave/topup-turbo.ts`
- **ARWEAVE_GATEWAYS 已缩到 2 个**：`arweave.net` + `ario.permagate.io`（原 4 个里 3 个错列/被 ESET 拦）
- **CORS 硬门槛 S0.b** 本机 2/2 smoke 通过；真验证推迟到 S6 浏览器跨设备手测
- **本机 ESET 会拦部分 Web3 域名**（g8way.io / gateway.irys.xyz / ar-io.dev 等），见 memory
- 合约地址（Phase 1 MaterialNFT）：`0x99F808bdE8E92f167830E4b9C62f92b81c664b7C`
- OP Sepolia 测试钱包：`0x306D3A445b1fc7a789639fa9115e308a34231633`

## 上次成功验证

- 验证内容: Phase 3 S0.b — Turbo 充值 + 26 音效上传 + 5 tracks 回写 + CORS smoke 2/2
- 验证时间: 2026-04-11
- 通过的 commit: `be4e07a`

## 当前阻塞

- 无

## 备注

- 项目命名：仓库/代号 `ripples-in-the-pond`（本地文件夹仍是 `nft-music`）
- 链：OP Mainnet（生产）/ OP Sepolia（测试）；Arweave credits 走 Base L2
- Next.js 16.1.6 + React 19；Windows + Git Bash；`--legacy-peer-deps`；`@/*` 映射项目根
- Foundry 在 `C:\foundry`
- 学习模式: slow mode（默认），用户自称小白，命令要给完整路径
- 文件硬线 220 行 / 目录 8 文件；`src/app/api/**` 子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
