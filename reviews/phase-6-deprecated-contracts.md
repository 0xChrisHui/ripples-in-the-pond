# Phase 6 Deprecated Contracts — 旧合约归档

> Phase 6 Track C 重部署后产生的"旧合约地址"清单。
> 测试网 NFT 因合约升级而不再在前端展示（决策见 `playbook/phase-6/track-c-contracts.md` 末尾"旧合约的历史 NFT 怎么处理"）。

---

## 2026-04-25 — Track C 重部署（OP Sepolia）

### ScoreNFT v1 → v2

| 字段 | v1（已弃用）| v2（当前生效）|
|---|---|---|
| 地址 | `0xA65C9308635C8dd068A314c189e8d77941A7e99c` | `0x1C478F9F5b66302A35a0178e07df67BA343c832F` |
| 部署时间 | 2026-04-11 (Phase 3 S2.b) | 2026-04-25 (Phase 6 C1) |
| 关键变化 | setTokenURI 允许覆盖 | setTokenURI 仅首写一次（`_uriSet` mapping，D-C2） |
| Etherscan | [v1](https://sepolia-optimism.etherscan.io/address/0xA65C9308635C8dd068A314c189e8d77941A7e99c) | [v2](https://sepolia-optimism.etherscan.io/address/0x1C478F9F5b66302A35a0178e07df67BA343c832F) |

**v1 上的历史 NFT**（不再在前端展示）：
- tokenId 1 — Phase 3 S3 部署测试 mint
- tokenId 2 — Phase 3 S5 端到端实测 "晨雾" (29 events)
  - mint tx: `0x596b723038108ea58a051fb9450c917c4df394914dc9b6d1a86d9b09b4ac4f73`
  - metadata: `https://ario.permagate.io/pXWRtrzzJeYdAXeMVVPm_X0GstBe_NPQIErwwlzrs60`

### MintOrchestrator v1 → v2

| 字段 | v1（已弃用）| v2（当前生效）|
|---|---|---|
| 地址 | `0xcBE4Ce6a9344e04f30D3f874098E8858d7184336` | `0x8A6Dd0Ecf108797358CC369bC6F263D2C89BC3a8` |
| 部署时间 | 2026-04-11 (Phase 3 S3.b) | 2026-04-25 (Phase 6 C4) |
| 关键变化 | 含 `tbaEnabled` 开关 + `_maybeCreateTba` 空钩子 | 删除 TBA 开关与钩子（D-C3） |
| Etherscan | [v1](https://sepolia-optimism.etherscan.io/address/0xcBE4Ce6a9344e04f30D3f874098E8858d7184336) | [v2](https://sepolia-optimism.etherscan.io/address/0x8A6Dd0Ecf108797358CC369bC6F263D2C89BC3a8) |

### 部署元信息

- 部署者 (deployer = admin = minter，简化模式): `0x306D3A445b1fc7a789639fa9115e308a34231633`
- 链: OP Sepolia (chainId 11155420)
- 简化模式：测试网未做 admin/minter 分离，主网 Phase 7 走 `docs/MAINNET-RUNBOOK.md`
- 部署 commits:
  - 代码层 `086167d` — feat(contracts): Track C 合约 & 部署硬化（C1-C4）
  - 部署 broadcast 记录: `contracts/broadcast/DeployScore.s.sol/11155420/run-latest.json` + `contracts/broadcast/DeployOrchestrator.s.sol/11155420/run-latest.json`

---

## 2026-05-15 — Phase 7 A2 重部署（OP Sepolia）

### AirdropNFT v1 → v2

| 字段 | v1（已弃用）| v2（当前生效）|
|---|---|---|
| 地址 | `0xa6Aa896b222bB522bA5c8fcC6bD8e59e3f5de56B` | `0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65` |
| 部署时间 | 2026-04-13 (Phase 4C S6) | 2026-05-15 (Phase 7 A2) |
| 关键变化 | setTokenURI 允许覆盖 | setTokenURI 仅首写一次（`_uriSet` mapping，与 ScoreNFT v2 对齐） |
| 部署 tx | `0xc8a0a0ad52ba7e3bbda24f22b8a5e6e12f5b14fdae24e8eca89e0e4e90188b3c` | `0xe05fafc3ccd3c9df4301f16fc4fa1d2cdf32d96d89e68bd59b49d1b674c37f06` |
| Etherscan | [v1](https://sepolia-optimism.etherscan.io/address/0xa6Aa896b222bB522bA5c8fcC6bD8e59e3f5de56B) | [v2](https://sepolia-optimism.etherscan.io/address/0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65) |

**v1 上的历史 NFT**（链上保留，前端不读）：
- 仅 Phase 4C S6 部署测试期间的小批量空投 NFT（D1 决策后 cron-job.org 长期 Inactive，无新增）

### 部署元信息

- 部署者（简化模式 deployer = admin = minter）：`0x306D3A445b1fc7a789639fa9115e308a34231633`
- 链：OP Sepolia (chainId 11155420)
- 部署 broadcast 记录：`contracts/broadcast/DeployAirdropNFT.s.sol/11155420/run-latest.json`
- 触发原因：strict CTO review (`reviews/2026-05-08-phase-6-strict-cto-review.md`) P0-1 — MINTER_ROLE 私钥泄露后可改 metadata 钓鱼

### 原子流程证明（D-A2）

部署当日按 D-A2 串行：
1. cron-job.org `process-airdrop` Inactive（双保险，本身 `AIRDROP_ENABLED` 也 unset）
2. forge 部署 OP Sepolia → 新地址
3. Vercel env 三环境（Production / Preview / Development）`NEXT_PUBLIC_AIRDROP_NFT_ADDRESS` 同步
4. Vercel manual redeploy（不带 Build Cache）
5. 线上验证：`pond-ripple.xyz` 可正常打开
6. **才** commit 归档（本次）+ 同步 `.env.local`

---

## 旧合约后续处置

- **测试网**：v1 合约地址保留在链上（Solidity 不可删除）。前端不再读取 v1，相关 NFT 不展示。
- **Etherscan 上的历史可查**：v1 上的 mint / setTokenURI tx 永久可查询。
- **前端不做多合约兼容**（决策见 `playbook/phase-6/track-c-contracts.md`）。
- **不会再向 v1 写入新数据**（AirdropNFT v1 因有漏洞**不能回滚使用**，`AIRDROP_ENABLED` 永久 unset 直到主网部署）。
