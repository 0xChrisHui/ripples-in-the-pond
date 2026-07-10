# P10-B 合约 CT 项 — 待办（延后到有 Foundry 时做）

> **状态（2026-07-11）**：延后。P10 其它全部完成，唯 CT 合约脚本类未做。
> **原因**：本机 `forge` 命令缺失（2026-04 装过、`contracts/out/` 有旧产物，现不在 PATH），
> 改合约代码却无法 `forge test` 编译验证 → 不盲改。用户拍板延后（选项 2）。
> **不急**：CT 是主网部署（P12）的准备工作，测试网用不着，不阻塞任何东西。

## 前置（做 CT 前先装回 Foundry）

```bash
# 安装 foundryup 再装 forge/cast/anvil（Windows 建议在 git-bash 或用官方安装脚本）
curl -L https://foundry.paradigm.xyz | bash
foundryup
# 验证
cd contracts && forge --version && forge build && forge test
```
装好后 `bash scripts/verify.sh` 的第 7 节（forge test）会自动从"跳过"变成真跑。

## 要做的 4 项（全 P1，只改脚本+补测试，**不部署**）

来源：`reviews/2026-07-05-backend-review.md` CT-1/2/3/5。

- [ ] **CT-1 name/symbol 参数化** — `contracts/script/DeployScore.s.sol:34-38` 与
      `DeployAirdropNFT.s.sol:27-31` 硬编码 `"…(Testnet)"`；ERC721 name 部署后不可改，
      主网会永久写死"Testnet"。改：`vm.envOr("SCORE_NFT_NAME", string("…(Testnet)"))` 之类参数化。
- [ ] **CT-2 ADMIN_ADDRESS 主网硬失败** — 4 个部署脚本 `vm.envOr("ADMIN_ADDRESS", deployer)`
      缺省静默回退 deployer（热钱包）。改：`block.chainid == 10` 时用 `vm.envAddress("ADMIN_ADDRESS")`
      （缺失即 revert），非主网保留 envOr 回退。
- [ ] **CT-3 DEFAULT_ADMIN 两步移交** — `DeployScore.s.sol:41-44` 单步 grant/revoke，地址填错即永久失控。
      改：`AccessControlDefaultAdminRules`（两步+延迟）**或**交权前先链上探活（probe 地址有 code / 非零）。
      ⚠ 前者要改合约本体 + 测试，后者只改脚本——做时先定哪个。
- [ ] **CT-5 MaterialNFT 补测试** — `contracts/test/` 缺 `MaterialNFT.t.sol`（Deploy.s.sol 部署的正是它）。
      对齐 `ScoreNFT.t.sol` 补齐。

## 验收
- `cd contracts && forge test` 全过 + `MaterialNFT.t.sol` 有实质覆盖
- `bash scripts/verify.sh` 第 7 节 forge test 真跑且绿
- 产出 diff 记入 `reviews/2026-07-11-phase-10-backend-fixes.md` 的 CT 段

## 不在此清单（另有归宿）
- CT-6~9 决策 gate（ERC2981/供应上限/可升级性/URI 空串）→ 🛑 **停点 4**（P12 前拍板，不可升级架构错过永久不可加）
- CT-10~15（P3 测试覆盖/foundry.toml pin 等）→ 随 CT-1/2/3/5 顺路或 P12
