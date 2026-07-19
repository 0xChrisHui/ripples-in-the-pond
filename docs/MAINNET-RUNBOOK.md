# MAINNET-RUNBOOK — OP 主网部署流程

> Phase 6 Track C 产出，P12 Track B（B4）按 B-0 拍板全面更新（2026-07-19）。
> 主网部署严格按此清单执行。测试网可走简化模式（deployer = admin = minter，
> env 不设 ADMIN/MINTER 自动回退，脚本 `DeployBase._resolveRoles` 内置）。
>
> **本版关键变化（对旧版）**：① 3 个合约（不部署 AirdropNFT，B-0 #9）② admin = 独立普通钱包
> （≠ 冷钱包/多签，B-0 #8 + 2026-07-19 用户拍板）③ 编译器已 pin（CT-11）④ ScoreNFT
> name/symbol 走 env（CT-1）⑤ MaterialNFT 部署后 setURI→freezeURI（CT-8）⑥ 每合约 verify（SR-P1-13）。

---

## 0. 部署 = 3 个合约（B-0 #9）

| 合约 | 类型 | 部署脚本 |
|---|---|---|
| MaterialNFT | ERC-1155（素材/曲目） | `script/Deploy.s.sol` |
| ScoreNFT | ERC-721（乐谱） | `script/DeployScore.s.sol` |
| MintOrchestrator | ScoreNFT 前台薄壳 | `script/DeployOrchestrator.s.sol` |

**AirdropNFT 主网不部署**（B-0 #9：省 gas 省面，将来要用再单独部署）。`DeployAirdropNFT.s.sol`
已加主网护栏（chainid 10 直接 revert）。`process-airdrop` cron 主网**不配置**、`AIRDROP_ENABLED` **不设**。

---

## 1. 权限模型（B-0 #8 拍板，2026-07-19）

| 角色 | 钱包类型 | 权限 | 私钥位置 |
|---|---|---|---|
| **admin** | **独立普通钱包**（≠ 铸造热钱包；非硬件/多签） | `DEFAULT_ADMIN_ROLE`（治理：增删角色 / MaterialNFT setURI+freezeURI） | 用户本地电脑，**绝不进 Vercel/.env.local/聊天** |
| **minter** | 运营热钱包（= `OPERATOR_PRIVATE_KEY` 派生地址） | `MINTER_ROLE`（mint + setTokenURI） | Vercel env + `.env.local` |
| **deployer** | 一次性部署钱包 | 部署时临时持有，脚本内即移交 admin 并 revoke 自己 | 部署完即销毁（§4.4） |

- **红线（已写进 `DeployBase._assertMainnetRoles`，主网部署即校验）**：admin **绝不等于** minter；
  admin/minter 都 ≠ deployer；都非零。任一踩线 → 部署脚本 revert，不会误配。
- 热钱包被盗 ≠ 合约治理被盗（admin 独立，且在本地）。deployer 私钥用完即抛。
- **升级路径**：admin 后续可升硬件钱包/Safe/renounce（部署后再定，不阻塞上线）。
- **admin 操作靠 Claude 逐步带**（用户"自己记不住"）：所有需要 admin 的动作见 §6 逐步命令。

---

## 2. 部署前准备

### 2.1 钱包准备
- [ ] **admin 钱包**：新建一个独立普通 EOA（如 MetaMask 新账户），记好地址 = `ADMIN_ADDRESS`；私钥留本地
- [ ] **minter 钱包**：= 现运营热钱包（`OPERATOR_PRIVATE_KEY` 派生），OP Mainnet ETH ≥ 0.05
- [ ] **deployer 钱包**：新建 + 充值 OP Mainnet ETH ≥ 0.04（够 3 次部署 + 移交）
- [ ] 三者地址两两不同（脚本会强校验，此处先自查）

### 2.2 环境变量（`.env.local`，部署机本地）
```
DEPLOYER_PRIVATE_KEY=0x...      # 一次性部署钱包私钥
ADMIN_ADDRESS=0x...             # 独立普通钱包地址（只填地址，私钥不进这里）
MINTER_ADDRESS=0x...            # 运营热钱包地址（= OPERATOR_PRIVATE_KEY 派生地址，须一致）
ALCHEMY_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_CHAIN_ID=10         # OP Mainnet
# CT-1：ScoreNFT 永久 name/symbol（主网缺这两个 → DeployScore 直接 revert，防焊错名）
SCORE_NFT_NAME=Ripples in the Pond
SCORE_NFT_SYMBOL=RPIP
# CT-15：MaterialNFT 初始 URI（可留空用脚本默认占位；部署后 admin setURI 到最终值再 freeze）
MATERIAL_URI=https://placeholder.ripples/{id}.json
```
> ⚠ `MINTER_ADDRESS` 必须 == `OPERATOR_PRIVATE_KEY` 派生地址。不一致则 hasRole 验收全过、
> 但 cron 发交易全 revert（cron 用 OPERATOR 私钥签，合约认 MINTER_ADDRESS）。用
> `cast wallet address --private-key $OPERATOR_PRIVATE_KEY` 核对。

### 2.3 编译 + 测试（编译器已 pin，CT-11）
```bash
cd contracts
forge test          # 42 tests 全绿
forge build         # solc 0.8.33 / evm cancun / optimizer 200（foundry.toml 已钉死）
```
**全绿才能进入下一步。** `foundry.toml` 的 pin 保证部署字节码与 §5 verify 复现一致。

---

## 3. 部署顺序（3 个合约 + 授权 + verify）

> 脚本已接入 `DeployBase`：主网自动强校验角色红线；ScoreNFT/MaterialNFT 部署即把
> `DEFAULT_ADMIN_ROLE` 移交给 `ADMIN_ADDRESS`（先 grant 链上验成功、再 revoke deployer）。

### 3.1 MaterialNFT
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录输出：`MaterialNFT: 0x...`

### 3.2 ScoreNFT
```bash
forge script script/DeployScore.s.sol --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录输出：`ScoreNFT: 0x...`（脚本会打印 Name = "Ripples in the Pond" / Symbol = "RPIP"，核对）

### 3.3 MintOrchestrator
```bash
SCORE_NFT_ADDRESS=<ScoreNFT 上一步输出> \
  forge script script/DeployOrchestrator.s.sol --rpc-url $ALCHEMY_RPC_URL --broadcast -vv
```
记录输出：`MintOrchestrator: 0x...`

**注意**：脚本会尝试 `ScoreNFT.grantRole(MINTER_ROLE, orchestrator)`，但 3.2 部署时 deployer
在 ScoreNFT 上的 admin 已移交给 `ADMIN_ADDRESS` 并被 revoke → 脚本 log：
```
[!] deployer lacks ScoreNFT.DEFAULT_ADMIN_ROLE
    admin must run: cast send <ScoreNFT> 'grantRole(...)' ...
```
→ 这一步由 **admin 钱包手动补**，见 §6.1（这是"找 Claude"最关键的一步：不补，铸造全断）。

### 3.3.2 全角色验收（3.3.1 admin 授权后执行一次）

把 `<...>` 替换成实际地址，逐条跑，全部符合预期才算通过，否则**立刻停**：
```bash
# ── ScoreNFT ──
# 1. admin 持 DEFAULT_ADMIN_ROLE（治理权在独立钱包） → 期望 true
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 <ADMIN_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 2. MintOrchestrator 持 MINTER_ROLE（能 mint+setTokenURI） → 期望 true
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") <MintOrchestrator> --rpc-url $ALCHEMY_RPC_URL
# 3. deployer 已被 revoke DEFAULT_ADMIN_ROLE → 期望 false
cast call <ScoreNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 <DEPLOYER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# ── MaterialNFT ──
# 4. minter 热钱包持 MINTER_ROLE → 期望 true
cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "MINTER_ROLE") <MINTER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 5. admin 持 MaterialNFT DEFAULT_ADMIN_ROLE（能 setURI+freezeURI） → 期望 true
cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 <ADMIN_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
# 6. deployer 已被 revoke（Material） → 期望 false
cast call <MaterialNFT> "hasRole(bytes32,address)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 <DEPLOYER_ADDRESS> --rpc-url $ALCHEMY_RPC_URL
```
> `cast call` 返回 hex：`0x...0001 = true`，`0x...0000 = false`。

---

## 4. 部署后

### 4.1 `.env.local` + Vercel env 同步（每枚 NFT 永久值，务必读回确认）
- [ ] `NEXT_PUBLIC_SCORE_NFT_ADDRESS` = ScoreNFT 新地址
- [ ] `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` = Orchestrator 新地址
- [ ] `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS` = MaterialNFT 新地址
- [ ] `NEXT_PUBLIC_CHAIN_ID=10`
- [ ] **`NEXT_PUBLIC_APP_URL=https://pond-ripple.xyz`**（每枚 NFT 的 `external_url` 来源；
      漏配即第一枚 smoke NFT 永久写错域名。Codex 发现 runbook 旧版漏列此项）
- [ ] server-only 三项**逐环境读回确认**（`npm run env-sync` 现已把这些纳入白名单可比对）：
      `SCORE_DECODER_AR_TX_ID` / `SOUNDS_MAP_AR_TX_ID`（钉进每枚 NFT，三环境须一致）
- [ ] ~~`AIRDROP_NFT_ADDRESS`~~ 不设（不部署 AirdropNFT）。代码读的 env 名是
      `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`（旧 runbook 写错为 `AIRDROP_NFT_ADDRESS`）——留空即可，
      `contracts.ts` 已惰性处理不抛错
- [ ] Vercel Production env 全部同步 → **Redeploy（不带 Build Cache）**

### 4.2 cron-job.org 验证（4 个 active，≥5 分钟全绿）
- [ ] process-mint-queue
- [ ] process-score-queue
- [ ] sync-chain-events
- [ ] check-balance
- [ ] **process-airdrop：不存在 / 保持暂停**（验证不可触发）

### 4.3 端到端 smoke（真 gas）
- [ ] 真实账号登录 → 收藏素材 → 1 分钟内 /me 显示 success（MaterialNFT 通路）
- [ ] 草稿铸造 → 4 步 cron 推进 → /score/[id] 公开页可播放（ScoreNFT 通路）
- [ ] /score/[id] 分享 OG 卡片正常；metadata `external_url` 指生产域名；animation_url 播放正常

### 4.4 销毁 deployer 私钥
- [ ] `DEPLOYER_PRIVATE_KEY` 从 `.env.local` 删除 + 从 Vercel env 删除（若配过）
- [ ] deployer 钱包剩余 ETH 转出

---

## 5. 合约 verify（SR-P1-13，每个合约部署后做）

编译器已 pin（§2.3），verify 用同一套设置复现字节码。构造参数需 abi-encode：
```bash
# MaterialNFT(string uri_, address minter)
cast abi-encode "constructor(string,address)" "$MATERIAL_URI" <MINTER_ADDRESS>
forge verify-contract <MaterialNFT> src/MaterialNFT.sol:MaterialNFT \
  --chain optimism --etherscan-api-key <OP_ETHERSCAN_KEY> \
  --constructor-args <上一步输出> --watch

# ScoreNFT(string name_, string symbol_, address minter)
cast abi-encode "constructor(string,string,address)" "Ripples in the Pond" "RPIP" <MINTER_ADDRESS>
forge verify-contract <ScoreNFT> src/ScoreNFT.sol:ScoreNFT \
  --chain optimism --etherscan-api-key <OP_ETHERSCAN_KEY> \
  --constructor-args <上一步输出> --watch

# MintOrchestrator(address scoreNftAddress)
cast abi-encode "constructor(address)" <ScoreNFT>
forge verify-contract <MintOrchestrator> src/MintOrchestrator.sol:MintOrchestrator \
  --chain optimism --etherscan-api-key <OP_ETHERSCAN_KEY> \
  --constructor-args <上一步输出> --watch
```
> verify 失败最常见 = 构造参数没对上，或 foundry.toml 的 pin 被改动。三个都 verify 成功
> （OP Explorer 显示绿勾）才算部署闭环。

---

## 6. admin 操作手册（用独立 admin 钱包，"找 Claude" 逐步带）

> admin 私钥留本地，用 `cast send ... --private-key <ADMIN_PRIVATE_KEY>`（**私钥只在本地命令行，
> 绝不进 .env.local / Vercel / 聊天**）。以下每条给完整命令，照抄替换尖括号即可。

### 6.1 授权 Orchestrator 能铸 ScoreNFT（部署日必做，否则铸造全断）
```bash
cast send <ScoreNFT> "grantRole(bytes32,address)" \
  $(cast keccak "MINTER_ROLE") <MintOrchestrator> \
  --rpc-url $ALCHEMY_RPC_URL --private-key <ADMIN_PRIVATE_KEY>
```
验收：§3.3.2 第 2 条 hasRole = true。

### 6.2 MaterialNFT 定稿 URI 并封条（CT-8，开铸前做）
```bash
# ① 把素材 metadata URI 指到最终 Arweave（示例，换成实际值）
cast send <MaterialNFT> "setURI(string)" "ar://<最终素材 metadata>" \
  --rpc-url $ALCHEMY_RPC_URL --private-key <ADMIN_PRIVATE_KEY>
# ② 一次性封条：此后任何人（含 admin）都改不了素材 NFT metadata
cast send <MaterialNFT> "freezeURI()" \
  --rpc-url $ALCHEMY_RPC_URL --private-key <ADMIN_PRIVATE_KEY>
# ③ 确认已封 → 期望 true
cast call <MaterialNFT> "uriFrozen()(bool)" --rpc-url $ALCHEMY_RPC_URL
```
> 顺序不可颠倒：freeze 后 setURI 永久 revert。freeze 前务必确认 URI 是最终值。

### 6.3（可选，将来）admin 升级 / 交权 / renounce
- 升 Safe/硬件：把 `DEFAULT_ADMIN_ROLE` grant 给新 admin、再从旧 admin revoke（先 grant 验成功再 revoke）。
- renounce（彻底放弃治理）：`renounceRole(DEFAULT_ADMIN_ROLE, <ADMIN_ADDRESS>)`——之后**再也无法**
  增删任何角色（含撤销被盗的 minter），需要时才做，找 Claude 评估。

---

## 7. 评估留档（CT-13 / CT-14）

- **CT-13 Orchestrator 权限面**：Orchestrator 自身持 ScoreNFT 的 `MINTER_ROLE`（含 setTokenURI 能力），
  cron 经 Orchestrator 铸造。热钱包（minter）泄露只能调 Orchestrator.mintScore（受 orderId 幂等约束）
  与 ScoreNFT.setTokenURI（但 `_uriSet` 已锁"首写一次"）→ **结论：接受现状**，无需额外收敛；
  真出事走 admin 撤销 Orchestrator 的 MINTER_ROLE。
- **CT-14 contractURI / ERC1155Supply**：合集级 metadata（contractURI）与 1155 总量查询（ERC1155Supply）
  **本版不加**——OpenSea 合集信息可后台配置，总量走链下监控（B-0 #2）。**结论：不做，留档**；
  将来要合集级 metadata 只能新部署（合约不可升级），届时评估。

---

## 8. 紧急回滚

- 合约部署**不可回滚**（Solidity 不可改）。补救 = 走 §3 部一组新合约 + 切 env，代价 = 用户体感
  "NFT 消失"（旧藏品搁浅旧合约）。视为灾难选项——宁可推迟部署日，不带犹豫上链。
- 前端可随时 Vercel instant rollback，链上分毫不动。
- ⚠ env 回切 ≠ 数据恢复：链衍生数据（队列/唱片页）若已清，回切 env 也回不去 → 真正的回滚保险 =
  部署日步骤 0 的 **DB 快照 + Vercel env 快照**（详见 `playbook/phase-12/40-d-cutover-week1.md` D2/D3）。
