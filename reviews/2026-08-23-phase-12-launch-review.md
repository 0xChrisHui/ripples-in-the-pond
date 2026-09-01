# Phase 12 OP Mainnet 上线完成 Review

> 部署日：2026-08-23。最终复核：2026-09-01。Phase 12 已完成。

## 上线结论

部署日硬 gate 与 7 天软启动完成，Ripples in the Pond 已稳定运行在 OP Mainnet。依据部署记录、观察窗内未记录 P0，以及 2026-09-01 的只读生产终检，Phase 12 正式关闭。

## 永久部署

| 合约 | 地址 | 部署区块 |
|---|---|---:|
| MaterialNFT | `0x03504aeb95EbE3DC8c427b7b147f873F9948a299` | `155933141` |
| ScoreNFT | `0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA` | `155933187` |
| MintOrchestrator | `0x406519962cDD1673D30fEcC13c4B6f7Af87Ba1dA` | `155933224` |

- 三份源码均通过 OP Etherscan 验证。
- Material URI 已永久冻结。
- admin 持三个治理角色；operator 持 Material/Orchestrator 铸造角色；Orchestrator 持 Score 铸造角色；deployer 无任何角色。

## 数据与生产切换

- 冻结快照：`C:\Users\Hui\ripples-backups\20260823-135447`，14 表 / 349 行 / 0 失败。
- 链衍生表已清零，主网同步游标从 ScoreNFT 部署块 `155933187` 起步。
- Vercel Development / Preview / Production 均切到 chainId 10 与新合约，生产部署 `dpl_G8s8LR8ZPbEe3bKR3ZbphiMVdRoG` READY。
- `process-mint-queue`、`process-score-queue`、`sync-chain-events`、`check-balance` 已恢复；airdrop 保持关闭。

## 真实 smoke

- MaterialNFT：#24、#7、#34 三条队列均 success，链上余额各为 1。
- ScoreNFT：tokenId 1 的 mint tx `0x1d2d...2f4a` 与 set URI tx `0xaa72...50dc` 均成功，Transfer 事件已同步入库。
- 永久 metadata：`ar://YoRsYgKb2Wdc_a2ZRZVa9IU-TdFa8-OVCylVbKczIUo`；`external_url=https://pond-ripple.xyz/score/1`。
- `/score/1` 页面 200、OG 图片 200；用户已在生产浏览器确认 animation 播放正常。
- 新上传 events/metadata 在 `ario.permagate.io` 可读；`arweave.net` 的传播期 404 由已验收的双网关 fallback 吸收。

## 密钥收口

- deployer 余额转回 operator，交易 `0x1b7ba0f6b68dbe770a05fb793c7d3367ae171f5ad88146362656f257cde1ef00` 成功。
- deployer 仅剩约 `0.000000999038 ETH` 尘埃，无链上角色。
- 一次性 `deployer-wallet.json` 已删除；admin 钱包备份仍在且未进入仓库、Vercel 或聊天。

## 观察期清单

- [x] 观察窗已超过 7 天，仓库状态与运维记录中未出现 P0。
- [x] 2026-09-01 使用现有 Bearer 凭证只读请求 `/api/health`：HTTP 200，DB 与钱包均为 `ok`。
- [x] 两条铸造队列无积压：Material `failed=0`、`stuck=0`，Score 无非终态项，`manual_review=0`。
- [x] operator 余额 `0.010098 ETH`，高于当前 `0.005 ETH` 告警阈值；Upstash 锁提供方正常。
- [x] `/score/1` HTTP 200；三份主网合约地址经 OP 公共 RPC 读取均返回非空字节码。
- [x] 部署期真实 ScoreNFT tokenId 1 全链路与余额告警记录已满足软启动完成标准。

## 最终结论与遗留

- **Phase 12 完成**：主网合约、永久资源、生产环境、队列、cron 与密钥收口不再作为阶段待办。
- health、cron、双队列、余额与额度继续作为日常运维观察项；出现异常时按 `playbook/phase-12/40-d-cutover-week1.md` §4 处理。
- `/api/health` 按设计需要 Bearer；匿名请求返回 401 属于正确安全行为。
- Upstash 免费额度达到 70% 时再评估降频或升级，不阻塞阶段关闭。
