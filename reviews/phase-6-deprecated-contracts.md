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

## 2026-07-19 — P12 B-1 测试网回归重部署（OP Sepolia）

> ⚠ 本次为 **B-1 回归专用**：只切**本地 `.env.local`**，Vercel 生产 env **未动**
> （现网继续用下表"旧"列合约直到 D 部署日）。主网将按 `docs/MAINNET-RUNBOOK.md`
> 全新部署，非沿用本批地址。

| 合约 | 旧（现网仍在用）| 新（B-1 回归版，本地生效）| 关键变化 |
|---|---|---|---|
| MaterialNFT | `0x99F808bdE8E92f167830E4b9C62f92b81c664b7C`（2026-04-09 Phase 1）| `0xe335f9d89442B980db1B673D0439B8fE49c413c0` | CT-8 `freezeURI` 单向封条 + URIUpdated/URIFrozen 事件 |
| ScoreNFT | `0x1C478F9F5b66302A35a0178e07df67BA343c832F`（v2, 2026-04-25）| `0xE0fAed842283F3D689AA8619CBb0ccc232A1DB23`（v3）| CT-7 setTokenURI 空串防御（置位前拦截） |
| MintOrchestrator | `0x8A6Dd0Ecf108797358CC369bC6F263D2C89BC3a8`（v2, 2026-04-25）| `0x970bCb2F6a8CD215173D8BC8c19286F4740601FA`（v3）| **CT-4 mintScore(to, orderId) 幂等键** + tokenIdByOrderId getter |

### 链上回归记录（全部通过）

- 部署者（简化模式 deployer = admin = minter）：`0x306D3A445b1fc7a789639fa9115e308a34231633`
- 角色验收 6/6：Orchestrator 持 ScoreNFT MINTER / deployer 持三合约 admin+minter / scoreNft 绑定正确
- **幂等键**：orderId `..b1` 首铸 tokenId 1（tx `0xd900095aae085abdde4dcd68669fef625bbf30ad496c07e138623111727b9a0a`）→
  同 orderId 重发 revert `orderId used` → `tokenIdByOrderId` 反查 = 1
- **CT-7 URI 状态机**：`setTokenURI(1,"")` revert（空串拒）→ 拒后写 `ar://b1-regression-test` 成功
  （**槽位未烧**）→ 二次覆盖 revert `URI already set` → 终值正确
- **CT-8 封条**：setURI 定稿 → freezeURI 成功 → 再 setURI **链上 revertReason `MaterialNFT: URI frozen`** →
  `uriFrozen()=true`
- 编译器：solc 0.8.33 / evm cancun / optimizer 200（CT-11 pin 后首次真链部署验证）
- broadcast 记录：`contracts/broadcast/{Deploy,DeployScore,DeployOrchestrator}.s.sol/11155420/run-latest.json`
- 已知环境噪声：Alchemy OP Sepolia 间歇 TLS 抖动 + `intrinsic gas too high` 估算抽风
  （显式 `--gas-limit` 绕过即成功，与合约无关）

### 2026-07-23 补记 — B-1 两通路 app 层 e2e 完成 + 揪出 3 个管道真 bug

**e2e 结果（本地 dev + 共享 Supabase，生产 cron 两 job 暂停期间）**：
- 素材通路：queue `ea0c0c15` → cron 新 ABI → 新 MaterialNFT tx
  `0x1e50ad20823903100bb65c29e111e864a1556262d3d0f473bbab557001f04b45` confirmed → success ✓
- 乐谱通路：queue `ee6ab320`（克隆行，见下）→ 5 步状态机全走通 → 新 Orchestrator mint tx
  `0xa0101fa6d0853fad7237d919445fc309f23c32ef320ca90d4cbe464fe1cc8958` →
  **tokenId 24** → `ownerOf` = 用户钱包 `0x19da4b17...bA54` → `tokenURI = ar://_1Levmve...ytY4`
  → mint_events 记账行落库 ✓（该记账历史上从未真正成功过，见 bug 3）

**3 个管道真 bug（全部当场修复在 `feat/p12-mainnet-prep`）**：
1. **operator-lock 网络错误裸抛** → cron 空 body 500（`acquireOpLock` 调用点在路由 try 之外）。
   修复：网络错误生产 fail-closed（返 busy 下轮重试）/ 开发 fail-open，与"未配置"分支同哲学
2. **steps-mint tokenId 写入吞 DB error** → 误判"lease lost"无限空转烧 RPC。修复：补 error 检查并 throw
3. **mint_events upsert 撞部分唯一索引**（016h `WHERE score_queue_id IS NOT NULL`，PostgREST
   `onConflict` 无法匹配部分索引为仲裁）→ **生产乐谱铸造最后一步必挂**。A17（2026-05-16）之前该
   错误被静默吞掉（假成功+记账悄悄丢失），A17 加 throw 后第一次真实铸造（=本次）即触雷。
   修复：改"查后插"（行级单写者由 lease+全局锁保证），部分索引留作兜底。⚠ **此 bug 现存于
   生产 main 分支**——主网前随 P12 合并即修；期间生产如有真实铸谱会在最后一步 failed（NFT 已上链）

**D-0 硬证据（本次最大收获）**：新合约 tokenId 从 1 重数 → tokenId=2 撞
`uq_score_queue_token_id`（旧合约时代 2-23 已占）→ 管道卡死。中毒行 `e7eaafb9` 弃置
（链上 tokenId 2 无 URI，测试弃子）；为完成回归用 21 枚占位 token 垫高计数至 23 后克隆行走通。
**主网切换不清链衍生表 = 第一枚 NFT 同一处死亡**——`40-d` D-0 方案①由"推荐"升级"硬需求"。

**本机 dev e2e 环境备忘**：dev server 必须 `NODE_USE_ENV_PROXY=1 npm run dev`
（Turbo 上传必须走系统代理，Next 只给自家 fetch 挂代理、不管第三方 SDK 的裸 undici fetch；
Upstash 走代理会被重置 → 由 bug1 修复的 fail-open 兜住）。

## 旧合约后续处置

- **测试网**：v1 合约地址保留在链上（Solidity 不可删除）。前端不再读取 v1，相关 NFT 不展示。
- **Etherscan 上的历史可查**：v1 上的 mint / setTokenURI tx 永久可查询。
- **前端不做多合约兼容**（决策见 `playbook/phase-6/track-c-contracts.md`）。
- **不会再向 v1 写入新数据**（AirdropNFT v1 因有漏洞**不能回滚使用**，`AIRDROP_ENABLED` 永久 unset 直到主网部署）。
