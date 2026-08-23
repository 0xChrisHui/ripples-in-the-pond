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

### 2026-08-23 OP Mainnet 部署记录

| 合约 | 主网地址 | 部署区块 | 验证 |
|---|---|---:|---|
| MaterialNFT | `0x03504aeb95EbE3DC8c427b7b147f873F9948a299` | `155933141` | OP Etherscan 源码验证通过；永久 URI 已冻结 |
| ScoreNFT | `0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA` | `155933187` | OP Etherscan 源码验证通过 |
| MintOrchestrator | `0x406519962cDD1673D30fEcC13c4B6f7Af87Ba1dA` | `155933224` | OP Etherscan 源码验证通过 |

最终权限已链上核验：admin 持三个合约的 `DEFAULT_ADMIN_ROLE`；operator 持
MaterialNFT / MintOrchestrator 的 `MINTER_ROLE`；MintOrchestrator 持 ScoreNFT 的
`MINTER_ROLE`；deployer 不再持任何 admin/minter 权限。

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

> **2026-07-28 已生成**（`cast wallet new`，私钥存 `C:\Users\Hui\.ripples-secrets\`，不进 git/env/聊天；已 verify 私钥派生地址一致）。三者两两不同已自查通过。

- [x] **admin 钱包** = `0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722`（`admin-wallet.json`）；2026-08-23 已到账 0.00005 OP ETH
- [x] **minter 钱包** = `0x306D3A445b1fc7a789639fa9115e308a34231633`（现运营热钱包 = `OPERATOR_PRIVATE_KEY` 派生）；已到账 0.01 OP ETH
- [x] **deployer 钱包** = `0x96aAfd4817BCF9971B54B5aC180D20a47F462162`（`deployer-wallet.json`）；按实时全费估算已到账 0.0001 OP ETH，用后销毁
- [x] 三者地址两两不同（脚本会强校验，此处已自查）

### 2.2 环境变量（`.env.local`，部署机本地）
```
DEPLOYER_PRIVATE_KEY=0x...      # 一次性部署钱包私钥（从 .ripples-secrets\deployer-wallet.json 取，deploy 日临时填，§4.4 用后删）
ADMIN_ADDRESS=0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722   # 独立普通钱包地址（只填地址，私钥不进这里）
MINTER_ADDRESS=0x306D3A445b1fc7a789639fa9115e308a34231633  # 运营热钱包地址（= OPERATOR_PRIVATE_KEY 派生地址，须一致）
ALCHEMY_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/...
NEXT_PUBLIC_CHAIN_ID=10         # OP Mainnet
# CT-1：ScoreNFT 永久 name/symbol（主网缺这两个 → DeployScore 直接 revert，防焊错名）
SCORE_NFT_NAME=Ripples in the Pond
SCORE_NFT_SYMBOL=RPIP
# CT-15：35 份永久 metadata 的 Arweave manifest；构造时直接焊入，admin 核对后 freeze
MATERIAL_URI=ar://2LvJ7-D9xneN0McL5-zycmO_su0c3nUFfktmxZgbf28/{id}.json
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

编译器已 pin（§2.3），verify 用同一套设置复现字节码。Etherscan V2 key 存在仓库外；部署日由 Codex 读取后只注入当前 shell，禁止 `echo`。构造参数需 abi-encode：
```bash
# Git Bash：从仓库外读取，退出当前 shell 后变量失效
ETHERSCAN_API_KEY="$(tr -d '\r\n' < /c/Users/Hui/.config/ripples-in-the-pond/etherscan-api-key.txt)"
test -n "$ETHERSCAN_API_KEY"

# MaterialNFT(string uri_, address minter)
cast abi-encode "constructor(string,address)" "$MATERIAL_URI" <MINTER_ADDRESS>
forge verify-contract <MaterialNFT> src/MaterialNFT.sol:MaterialNFT \
  --chain optimism --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args <上一步输出> --watch

# ScoreNFT(string name_, string symbol_, address minter)
cast abi-encode "constructor(string,string,address)" "Ripples in the Pond" "RPIP" <MINTER_ADDRESS>
forge verify-contract <ScoreNFT> src/ScoreNFT.sol:ScoreNFT \
  --chain optimism --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args <上一步输出> --watch

# MintOrchestrator(address scoreNftAddress)
cast abi-encode "constructor(address)" <ScoreNFT>
forge verify-contract <MintOrchestrator> src/MintOrchestrator.sol:MintOrchestrator \
  --chain optimism --etherscan-api-key "$ETHERSCAN_API_KEY" \
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

### 6.2 MaterialNFT 核对最终 URI 并封条（CT-8，开铸前做）
```bash
# ① 构造时已写最终值；先读 token 1，必须精确等于 $MATERIAL_URI
cast call <MaterialNFT> "uri(uint256)(string)" 1 --rpc-url $ALCHEMY_RPC_URL
# ② 一次性封条：此后任何人（含 admin）都改不了素材 NFT metadata
cast send <MaterialNFT> "freezeURI()" \
  --rpc-url $ALCHEMY_RPC_URL --private-key <ADMIN_PRIVATE_KEY>
# ③ 确认已封 → 期望 true
cast call <MaterialNFT> "uriFrozen()(bool)" --rpc-url $ALCHEMY_RPC_URL
```
> `MATERIAL_URI` 已于 2026-08-23 生成并上传：35 个 SVG 封面 + 35 份 metadata；
> 样本 metadata、封面、音频已在 Arweave 网关读回。freeze 前仍须逐字核对链上返回值。

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

---

## 9. DB 快照与恢复（P12 C5；C-0 #2 拍板方案③=手动导出 + 部署日全量快照）

**为什么不是 pg_dump**：本机无 PostgreSQL 客户端，且 Supabase Free 无 PITR。改用
service-role key 走 PostgREST 全表导出 JSON —— 表结构本就在 `supabase/migrations/`（git 里），
**结构（git）+ 数据（JSON）合起来 = 完整可恢复备份**。

### 9.1 执行快照

```bash
python <脚本> "$NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "C:/Users/Hui/ripples-backups/<时间戳>"
```

- 脚本逻辑：14 张表逐表 `select=*`，每页 1000 行翻页到底，逐表写 `<表名>.json` +
  `_manifest.json`（行数汇总 + 失败清单）
- 覆盖表：`users` / `auth_identities` / `tracks` / `sounds` / `mint_queue` / `mint_events` /
  `pending_scores` / `score_nft_queue` / `score_covers` / `chain_events` / `system_kv` /
  `jwt_blacklist` / `airdrop_rounds` / `airdrop_recipients`
- **产物必须落在仓库外**（现用 `C:\Users\Hui\ripples-backups\`）——内含用户数据，绝不进 git

### 9.2 恢复方法

结构先行、数据后灌：① 按 `supabase/migrations/` 顺序重建 schema →
② 按依赖序 `POST /rest/v1/<表>`（service-role key）灌回 JSON 数组。
依赖序：`users` → `auth_identities` → `tracks`/`sounds`/`score_covers` → `pending_scores` →
`mint_queue`/`score_nft_queue` → `mint_events`/`chain_events` → 其余。
生成列（如 `pending_scores.event_count`）灌入前必须剔除，否则 428C9 报错。

### 9.3 恢复演练（2026-07-27 已做，**通过**）

"没演练过的备份 = 没有备份"。演练用**自建测试行**（不碰用户数据）走完整闭环：
`system_kv` 造行 → 捕获 → DELETE 模拟丢失 → 确认消失 → 从捕获数据 POST 恢复 →
**逐字段比对一致** → 清理测试行。结果：**restore path PROVEN**。

### 9.4 快照节奏

- 首次全量：2026-07-27 已做（338 行 / 14 表）
- **部署日前 24h 内必须再做一份**（D1 检查表引用）
- **清链衍生表之前必须确认快照可恢复**（D2 步骤 0 硬前置，非可选）
