# Phase 12 — Track B：合约主网化（决策 gate + CT 修复 + 部署就绪）

> 上层：`00-overview.md`。**并入并取代 `playbook/phase-10/60-ct-contract-todo.md`**
> （该文件保留作 P10 归档，施工以本文件为准）。
> findings 原始出处：`reviews/2026-07-05-backend-review.md` CT-1~CT-15。
> **本 track 终点 = "主网部署就绪"**（脚本/测试/决策/runbook 全定稿）；
> 真正向 OP Mainnet 广播在 D track 部署日执行，本 track 零主网交易。

---

## 0. 前置：装回 Foundry（P10 已裁决"不盲改"）

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cd contracts && forge --version && forge build && forge test
```
装好后 `bash scripts/verify.sh` 第 7 节（forge test）自动从"跳过"变真跑。
**forge test 跑不绿之前，本 track 一行合约/脚本代码都不改。**
⚠ Windows 安装有历史摩擦（doctor.sh 自 Day 0 即 Foundry ⚠）：curl 法不顺就换预编译
binary / scoop / WSL，预留半天缓冲，不算进施工工时。

## 1. 🛑 停点 B-0 — 合约决策 gate（承接 P10 停点 4，错过永久不可加）

主网合约是全新部署 = 最后一次改设计的机会。逐项已拍板（2026-07-19）并记 `docs/JOURNAL.md`。

### ✅ B-0 最终结论（本块为准，新进程照此执行）

| # | 决策 | 最终结论 |
|---|---|---|
| 1 | ERC2981 版税 | **不做**（接受永久无版税） |
| 2 | 供应上限 | **不设链上上限**，改链下监控告警 |
| 3 | 可升级性 | **印死（不可升级）**——故其余项必须一次定对；"换合约"不是退路（等于抛弃已铸 NFT，见 40-d D3） |
| 4 | mintScore 幂等键 | **加**（合约+ABI+cron 三层同改，见 B2） |
| 5 | URI 空串防御 | **加** |
| 6 | MaterialNFT freezeURI + 事件 | **加**（防 admin 钥匙泄露后批量篡改素材 NFT metadata；素材 NFT = 收藏的曲目，ERC1155 全局 URI 现可被 admin 随时改） |
| 7 | ScoreNFT name / symbol | **`Ripples in the Pond` / `RPIP`**（去 Testnet、无版本号） |
| 8 | admin 钱包 | **独立钱包（≠ 铸造热钱包）**；部署后再定升硬件/Safe/renounce。红线：admin 绝不等于热钱包 |
| 9 | AirdropNFT | **不部署** → 全流程"4 合约"一律改读 **3 合约**（Material/Score/Orchestrator） |

下方原始决策表保留追溯上下文。

| # | 决策 | 背景 | 默认建议 |
|---|---|---|---|
| 1 | **ERC2981 版税**（CT-6） | 不可升级合约，不加永远没有；加了市场不一定执行但链上有据 | 加（成本低：继承 + setDefaultRoyalty） |
| 2 | **供应上限**（CT-9） | minter 热钱包泄露可无限增发 | 评估：MAX_SUPPLY 或接受链下监控 |
| 3 | **可升级性** | 当前三合约全 immutable | 维持 immutable（简单=安全），本表其他项因此必须现在定 |
| 4 | **mintScore 幂等键**（CT-4） | 后端重试双铸风险；A3 长期方案的链上半。⚠ **跨层改动**：合约签名一变，`contracts.ts:104` ABI 与 `steps-mint.ts:74` 调用必须同批改（Codex P0） | 加 `mintScore(to, orderId)` + mapping 去重；链下半 simulateContract 一并评估 |
| 5 | **URI 空串防御**（CT-7） | 首写永久，空串也永久 | 合约 `require(bytes(uri).length>0)`（cron 侧校验 P10 已做） |
| 6 | **MaterialNFT freezeURI + URI 事件**（CT-8） | setURI 全局可变无冻结 | 加单向 freeze 开关 |
| 7 | **主网正式 name/symbol**（CT-1 参数化后的取值） | ERC721 name 部署后不可改 | 用户定（如 "Ripples in the Pond Score" / RIPS，去 Testnet） |
| 8 | **admin 冷钱包形态** | runbook §1：Safe multisig 或 hardware | 用户定（影响 CT-3 移交方式与 3.3.1 签名方式） |
| 9 | **AirdropNFT 部署与否** | runbook §3.4 现行=部署但不触发；主网首版无空投 | 二选一：照 runbook 部署休眠 / 干脆不部署（省 gas 省面，将来要用再部）。metadata 补完随空投启用再做，不进主网 gate |

## 2. CT 施工批（B-0 拍板后，全部只改代码不部署）

### B1 必修四项（P1，来自 60-ct 清单原文）
- [ ] **CT-1 name/symbol 参数化** — `DeployScore.s.sol:34-38` / `DeployAirdropNFT.s.sol:27-31`
      硬编码 "(Testnet)"。改 `vm.envOr("SCORE_NFT_NAME", ...)` 参数化，主网值取 B-0 #7
- [ ] **CT-2 ADMIN_ADDRESS 主网硬失败** — 4 个部署脚本 `vm.envOr("ADMIN_ADDRESS", deployer)`
      静默回退热钱包。改 `block.chainid == 10` 时 `vm.envAddress`（缺失即 revert）＝ SR-P1-12
- [ ] **CT-3 DEFAULT_ADMIN 两步移交** — 单步 grant/revoke 地址填错即永久失控。
      两方案（做前按 B-0 #8 定）：`AccessControlDefaultAdminRules`（改合约本体+测试）
      或交权前链上探活（只改脚本）
- [ ] **CT-5 MaterialNFT 补测试** — 新建 `contracts/test/MaterialNFT.t.sol` 对齐 ScoreNFT.t.sol

### B2 拍板产物施工（按 B-0 结果展开）
- [ ] **本次拍板"加"的三项**：mintScore 幂等键(B4) + ScoreNFT URI 空串防御(B5) +
      MaterialNFT freezeURI+事件(B6) —— 改合约 + 补测试；**不做** ERC2981、**不设** MAX_SUPPLY(B1/B2)
- [ ] **CT-4 若采纳 = 三层同批改**：合约 + `src/lib/chain/contracts.ts` ABI（现单参
      `mintScore(to)`）+ `steps-mint.ts` 传稳定 orderId（用 `row.id`）；补"重复 orderId 拒绝"
      测试；B-1 测试网端到端为**硬验收**——只改合约不改 app = 主网铸造全 revert（Codex P0）
- [ ] 每改一项 forge test 全绿再下一项；合约 diff 最小化（只做拍板项，不顺手重构）

### B3 顺路批（P3，随 B1/B2 一起过）
- [ ] CT-10 测试覆盖缺口（角色管理/移交序列/非 receiver/_safeMint/空串 URI/supportsInterface）
- [ ] CT-11 foundry.toml pin solc/evm_version/optimizer（主网 verify 复现一致性）
- [ ] CT-12 TestMintOrchestrator 加 `require(block.chainid != 10)` 主网护栏
- [ ] CT-13 Orchestrator setTokenURI 覆盖评估（热钱包权限面；可结论=接受现状+记录）
- [ ] CT-14 contractURI / ERC1155Supply 评估（合集级 metadata；可不做，记录）
- [ ] CT-15 Deploy.s.sol placeholder URI env 参数化

### B4 runbook 增补（`docs/MAINNET-RUNBOOK.md`）
- [ ] **SR-P1-13**：每个合约部署后的 `forge verify-contract`（Etherscan/OP Explorer）命令块进 §3
- [ ] B-0 全部拍板结果同步（正式 name 值 / admin 形态 / AirdropNFT 部署与否改写 §3.4
      与全文"4 合约"措辞——不部署则为 3）
- [ ] 新增 env（SCORE_NFT_NAME 等）进 §2.2 清单 + `.env.example`
- [ ] 修 §4.1 两处 env 口径（Codex 发现）：`AIRDROP_NFT_ADDRESS` → 代码实际读
      `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`；**补 `NEXT_PUBLIC_APP_URL`**（每枚 NFT 的
      external_url 来源，runbook 现在漏列，漏配即第一枚 smoke NFT 永久写错域名）

### B5 admin 冷钱包就绪演练（B-0 #8 拍板后、部署日前完成，Codex P1）
- [ ] OP Mainnet 上创建/确认 admin 钱包（Safe 则建好 + owner 确认 + 备 gas）
- [ ] 签名流程演练一次：拿测试网 grantRole calldata 实操（Safe UI 或 hardware 签名）
- [ ] 演练不过 = 部署日 3.3.1 授权卡死（Orchestrator 拿不到 MINTER_ROLE，铸造全断）

## 3. ✅ 停点 B-1 — 测试网全量回归（2026-07-23 完成）

> 结果：3 合约简化模式重部署 OP Sepolia + 角色 6/6 + 幂等键链上重发拒绝 + CT-7/CT-8 链上
> 状态机全验 + 两通路 app 层 e2e 全通（素材 & 乐谱 tokenId 24）。揪出 3 个管道真 bug 当场修
> （op-lock 裸 500 / tokenId 写入吞错 / mint_events 部分索引 upsert 必挂——第三个现存生产 main）。
> 全记录：`reviews/phase-6-deprecated-contracts.md` 2026-07-19 段 + 2026-07-23 补记。原步骤留档：

合约本体若有任何改动（ERC2981/幂等键/AccessControl 等），**必须先上 OP Sepolia 走完整链路**：
0. 环境选择：**优先本地 env 指向新测试合约**做回归（现网不动、测试 NFT 不消失）；
   确需切生产 testnet env 则沿 v2→v3 归档先例走
1. 新版合约测试网重部署（简化模式，runbook §5；数量按 B-0 #9）+ 3.3.2 五项 hasRole 验收
2. 测试网 env 切新地址 → 收藏→MaterialNFT / 草稿→ScoreNFT 两通路端到端各走一遍
3. 幂等键若加了：人为重发同 orderId 验证拒绝双铸
4. 归档：新旧地址对照进 `reviews/phase-6-deprecated-contracts.md`（沿用先例）

## 4. 完成标准（= "主网部署就绪"）

- [ ] B-0 九项决策全落 JOURNAL；`forge test` 全绿；`verify.sh` 第 7 节真跑且绿
- [ ] 测试网回归（停点 B-1）通过；runbook 增补完毕；admin 演练（B5）完成
- [ ] 主网 env 值全部备妥未启用（DEPLOYER/ADMIN/MINTER/RPC/name）——留给 D 部署日
- [ ] 零主网交易发生

## 5. 红线

- 不部署、不广播、不碰主网（全归 D）；测试网部署仅停点 B-1 回归用
- 合约改动只做 B-0 拍板项；每项独立 commit + forge test 绿
- deployer/admin/minter 三角色纪律照 runbook §1，测试代码里不得混用主网私钥
