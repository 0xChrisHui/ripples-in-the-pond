# P22 主网手册

> 2026-10-30。主网部署前已在 **OP 主网 fork** 与 **以太坊主网 fork** 上各完整彩排一遍（部署 → 登记 70 个素材 → `VerifyScorePack` 读链核对 → 真实主网 Score 开包 → 第二次开包被拒），全部通过。

## 角色与地址（两条主网相同）

| 角色 | 地址 | 钥匙在哪 |
|---|---|---|
| deployer（一次性，全新钱包 nonce=0） | `0x5Ea28aAd920d9AF151b80F639DD909a7d5C6f888` | 桌面 `p22-mainnet-keys.json` |
| admin | `0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722` | `C:\Users\Hui\.ripples-secrets\admin-wallet.json` |
| signer（服务端签凭证） | `0xa1Ca024F6fac970C824c5CF4B6b72536c4a87450` | 桌面 `p22-mainnet-keys.json`，私钥要配进 Vercel `P22_SIGNER_PRIVATE_KEY` |
| pauser（应急暂停） | `0x2E37f6f613065750a3Cf184FA3Be0084123665eD` | 桌面 `p22-mainnet-keys.json`，请离线保管 |
| operator（OP 代付提交者） | `0x306D3A445b1fc7a789639fa9115e308a34231633` | 现有运营热钱包 |

## 彩排得出的合约地址（两条链相同，因为部署钱包全新、nonce 确定）

| 合约 | 地址 |
|---|---|
| ScorePackOpener | `0xa61f7fd863E255A0B96FfC53EfD5f1B974dB0941` |
| PondSoundNFT | `0x20dD346Ec1Fc763b5279a114DC4576e705B7D056` |
| PondTrackNFT | `0x8Ffb846ce8020eC519bc17235B704A62E0f7D7f2` |

真实部署后必须再核对一次地址与此一致，不一致即停。

## 需要的资金（唯一必须由用户完成的人工项）

2026-10-30 实测：以太坊 gas 约 1.3 gwei（上午曾有 22 gwei 的短时高峰）。部署约 11.1M gas，登记约 6.0M gas。

| 链 | 钱包 | 建议充值 | 估算实际用量（1.3 gwei） |
|---|---|---|---|
| 以太坊主网 | deployer `0x5Ea2…f888` | 0.06 ETH（可扛到约 5 gwei） | 约 0.015 ETH |
| 以太坊主网 | admin `0x305E…2722` | 0.04 ETH | 约 0.008 ETH |
| OP 主网 | deployer `0x5Ea2…f888` | 0.002 ETH | 约 0.001 ETH（含 L1 数据费，未实测） |
| OP 主网 | admin `0x305E…2722` | 0.001 ETH | 约 0.0003 ETH |

多出的钱部署后可转回。gas 高于 5 gwei 时先别部署，等回落。

## 部署顺序（Claude 执行，每步读回核对）

1. 以太坊主网：`DeployScorePack`（`--broadcast`）→ `VerifyScorePack` → `define-tokens`（admin 钥匙）。
2. OP 主网：同上。
3. 部署完成后 deployer 不持有任何角色，剩余余额转回。
4. 记录两条链的部署区块（`NEXT_PUBLIC_P22_DEPLOY_BLOCK_<chainId>`）与交易哈希到 `06-execution-log.md`。

环境变量（部署后才配）：`NEXT_PUBLIC_P22_OPENER_<1|10>`、`NEXT_PUBLIC_P22_SOUNDS_<1|10>`、`NEXT_PUBLIC_P22_TRACKS_<1|10>`、`NEXT_PUBLIC_P22_DEPLOY_BLOCK_<1|10>`、`P22_SIGNER_ADDRESS`、`P22_SIGNER_PRIVATE_KEY`。

## 应用侧上线（合约部署后）

1. 生产库跑 migration `063_score_pack_orders.sql`（纯新增表与函数，无破坏性；先于代码上线）。
2. Vercel 配上面的环境变量，合并分支，部署。
3. cron-job.org 新增 `/api/cron/process-score-pack`（带 `CRON_SECRET`，每分钟）。
4. 验收：一枚 OP Score 补开、一枚 ETH Score 补开（Token #1 用旧音效，开包会被拒绝，属预期）。

## 应急

signer 泄露 → pauser 立即 `pause()`（opener 与两个素材合约都可暂停）→ admin 轮换 signer（`revokeRole` + `grantRole`）→ 评估被错开的 Score。链上无法撤销已开包。
