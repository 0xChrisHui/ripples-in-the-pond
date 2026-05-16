# MAINNET-RUNBOOK — Phase 7 OP 主网部署流程

> 本文档由 Phase 6 Track C 产出。Phase 7 主网部署严格按此清单执行。
> 测试网部署可走简化模式（deployer = admin = minter，env 不设 ADMIN/MINTER 自动回退）。

---

## 1. 权限模型（Phase 6 D-C1 冻结）

| 角色 | 钱包类型 | 权限 | 备份位置 |
|---|---|---|---|
| **admin** | 冷钱包（multisig 或 hardware）| `DEFAULT_ADMIN_ROLE`（治理）| 离线 |
| **minter** | 运营热钱包 | `MINTER_ROLE`（铸造 + setTokenURI）| Vercel env + `.env.local` |
| **deployer** | 一次性部署钱包 | 部署后立刻 `revoke` 所有角色 | 部署完即抛 |

热钱包被盗 ≠ 合约治理被盗。deployer 私钥用完即抛。

---

## 2. 部署前准备

### 2.1 钱包准备
- [ ] admin 钱包地址确定（推荐 Safe multisig）
- [ ] minter 钱包地址确定（OP Mainnet ETH ≥ 0.05）
- [ ] deployer 钱包：新建 + 充值 OP Mainnet ETH ≥ 0.05（够 4 次部署 + revoke）

### 2.2 环境变量
`.env.local` 必填：
```
DEPLOYER_PRIVATE_KEY=0x...    # 一次性部署钱包私钥
ADMIN_ADDRESS=0x...           # 冷钱包
MINTER_ADDRESS=0x...          # 热钱包
ALCHEMY_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_CHAIN_ID=10       # OP Mainnet
```

### 2.3 编译 + 测试
```bash
cd contracts
forge test
forge build
```
**全绿才能进入下一步。**

---

## 3. 部署顺序（4 个合约 + 授权）

### 3.1 MaterialNFT
```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录输出：`MaterialNFT: 0x...`

校验：
```bash
cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") <MINTER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 期望 true

cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 <DEPLOYER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 期望 false（deployer 已被 revoke）
```

### 3.2 ScoreNFT
```bash
forge script script/DeployScore.s.sol \
  --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录输出：`ScoreNFT: 0x...`

校验：同 MaterialNFT 模式（admin 持 DEFAULT_ADMIN，minter 持 MINTER_ROLE，deployer 全无）。

### 3.3 MintOrchestrator
```bash
SCORE_NFT_ADDRESS=<ScoreNFT 上一步输出> \
  forge script script/DeployOrchestrator.s.sol \
    --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录输出：`MintOrchestrator: 0x...`

**注意**：脚本会尝试 `ScoreNFT.grantRole(MINTER_ROLE, orchestrator)`，但主网模式下 deployer 在 ScoreNFT 上已无 `DEFAULT_ADMIN_ROLE`（3.2 部署时已 revoke），脚本会 log:
```
[!] deployer lacks ScoreNFT.DEFAULT_ADMIN_ROLE
    admin must run: cast send <ScoreNFT> 'grantRole(...)' ...
```

#### 3.3.1 admin 手动授权（用 admin 冷钱包签名）
```bash
cast send <ScoreNFT> \
  "grantRole(bytes32,address)" \
  $(cast keccak "MINTER_ROLE") \
  <MintOrchestrator> \
  --rpc-url $ALCHEMY_RPC_URL --private-key <ADMIN_PRIVATE_KEY>
```
（multisig 走 Safe UI 提交同样的 calldata）

校验 Orchestrator 真能 mint：
```bash
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") <MintOrchestrator> --rpc-url $ALCHEMY_RPC_URL
# 期望 true
```

#### 3.3.2 全角色验收（所有合约部署完后执行一次）

一次性跑完所有 `hasRole` 验收，确认 admin / minter / deployer 权限分离正确。把 `<...>` 占位替换成实际地址：

```bash
# ── ScoreNFT ──
# 1. admin 持 DEFAULT_ADMIN_ROLE（治理权在冷钱包）
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  <ADMIN_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 期望 true

# 2. MintOrchestrator 持 MINTER_ROLE（能 mint + setTokenURI）
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") <MintOrchestrator> --rpc-url $ALCHEMY_RPC_URL
# 期望 true

# 3. deployer 已被 revoke DEFAULT_ADMIN_ROLE
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  <DEPLOYER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 期望 false

# ── MaterialNFT ──
# 4. minter 热钱包持 MINTER_ROLE
cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") <MINTER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 期望 true

# 5. deployer 已被 revoke
cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  <DEPLOYER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 期望 false
```

> `cast call` 返回 hex：`0x...0001 = true`，`0x...0000 = false`。
> 5 项全部符合预期才算验收通过，否则立刻停止并手动核查 grantRole / revokeRole 步骤。

### 3.4 AirdropNFT（Phase 6 D1 = 主网不做空投，但合约保留部署）
```bash
forge script script/DeployAirdropNFT.s.sol \
  --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录地址但**不在 cron-job.org 配置 process-airdrop 触发**。

---

## 4. 部署后

### 4.1 .env.local + Vercel env 同步
- [ ] `NEXT_PUBLIC_SCORE_NFT_ADDRESS` 写新地址
- [ ] `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` 写新地址
- [ ] `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS` 写新地址（如果项目用此 env）
- [ ] `AIRDROP_NFT_ADDRESS` 写新地址（保留但 cron 不触发）
- [ ] Vercel Production env 全部同步
- [ ] Vercel Redeploy

### 4.2 cron-job.org 验证
所有非 airdrop cron 在新合约下 ≥ 5 分钟全绿：
- [ ] process-mint-queue
- [ ] process-score-queue
- [ ] sync-chain-events
- [ ] check-balance
- [ ] **process-airdrop 保持暂停**（D1 决策）

### 4.3 端到端 smoke
- [ ] 真实账号登录 → 收藏素材 → 1 分钟内 /me 显示 success（MaterialNFT 通路）
- [ ] 草稿铸造 → 4 步 cron 推进 → /score/[id] 公开页可播放（ScoreNFT 通路）

### 4.4 销毁 deployer 私钥
- [ ] DEPLOYER_PRIVATE_KEY 从 `.env.local` 删除
- [ ] DEPLOYER_PRIVATE_KEY 从 Vercel env 删除（如果配过）
- [ ] 钱包 ETH 余额转出（若有剩余）

---

## 5. 测试网简化模式

测试网允许 deployer = admin = minter（脚本默认行为）：

```bash
# .env.local 不设 ADMIN_ADDRESS / MINTER_ADDRESS
# DEPLOYER_PRIVATE_KEY 复用 OPERATOR_PRIVATE_KEY 的值

cd contracts
forge script script/DeployScore.s.sol --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
SCORE_NFT_ADDRESS=0x... forge script script/DeployOrchestrator.s.sol --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```

测试网模式下，第 3.3.1 步 admin 手动授权不需要（脚本里 deployer = admin，会自动完成）。

---

## 6. 紧急回滚

合约部署不可回滚（Solidity 不可改）。回滚 = 走 3.x 部署一组新合约 + 切 env。

env 切换 = 用户体验上"NFT 消失"。Phase 7 主网应避免回滚（Phase 6 测试网窗口暴露所有问题）。
