# P14 v1 冻结决策表

> 冻结日期：2026-09-06  
> 适用范围：Phase 14 v1 代码、永久媒体、OP Sepolia 与 OP Mainnet  
> 状态：G1–G8 已冻结；G7 已由权利人于 2026-09-06 明确关闭，证据见 `reviews/evidence/p14-f0/rights-confirmation.md`

## G1｜产品身份

| 项目 | 最终值 |
|---|---|
| UI 系列名 | `Pond Echoes` |
| 中文辅助名 | `池中回声`；只作解释，不进入合约名 |
| 合约 `name` | `Pond Echoes` |
| 合约 `symbol` | `ECHO` |
| 单枚作品名 | `Pond Echo · <钱包前 4 位>—<钱包后 4 位>`；由规范化 origin wallet 生成，不依赖 tokenId |
| collection 描述 | `A permanent wallet-born score from Ripples in the Pond, composed from a deterministic 36-part recipe.` |
| token 描述 | 说明它由 origin wallet 的 36 位确定性配方生成并由首枚 ScoreNFT 触发；不承诺收益、价格或稀缺升值 |
| 永久 canonical 路由 | `/echo/origin/[address]`；metadata 上传前即可确定，页面用 `tokenIdByOrigin` 解析当前 token |
| 铸造后分享别名 | `/echo/[id]`；`id` 是 P14 NFT tokenId，两条路由展示同一链上真值 |

采用“Pond Echoes”，因为它直接延续 Ripples in the Pond 的水塘与声音语义，同时能与 ScoreNFT 区分。作品名与 canonical route 都只依赖 origin wallet，因此 metadata 可以在 mint 前完整生成；数字 tokenId 路由只作铸造后的易读别名。

## G2｜声音与播放

| 项目 | 最终值 |
|---|---|
| 片段边界 | 60ms 等功率交叉淡化；相邻片段真实重叠，总时长为 `Σduration − 35×60ms`；E0 用真实片段复核，若出现可测削波或吞瞬态才回到本表改值 |
| 初次加载 | 先取 manifest，再并发预取并解码 recipe 的全部唯一片段；限制并发，不重复下载相同字符 |
| 暂停恢复 | 样本级续播，保存 recipe 总时间与当前片段 offset |
| 重播 | 同一 recipe 从 0 开始，不重新派生 |
| 自动播放 | 禁止；只在用户手势后创建或恢复 AudioContext |
| recipe 展示 | 首屏显示当前字符和 6×6 旅程；永久档案完整展示并可复制 36 位原文 |

## G3｜封面与永久播放器

| 项目 | 最终值 |
|---|---|
| `image` | 全系列共用一张 1200×1200 PNG；独特性由 recipe 与 animation 表达 |
| `animation_url` | `<decoder ar:// URL>?v=1&recipe=<36位>&clips=<manifest txid>` |
| 永久播放器输入 | query 中的 recipe + 全局 clip manifest；token metadata 同时保存本 token 实际用到的 clip 子集 |
| OG/分享图 | 使用同一永久 PNG；站内可叠加 token 信息，但不得成为 NFT 真值 |
| 字体与纹理 | Decoder 只用系统字体和程序生成纹理，不请求第三方字体/CDN |

共享 PNG 只产生一次永久上传，避免每枚 token 多一次付费写入和上传结果未知分支；钱包差异仍由永久 Decoder 完整呈现。

## G4｜合约能力

| 项目 | 最终值 |
|---|---|
| 可升级性 | 不可升级 |
| ERC-721 Enumerable | 启用 |
| ERC-2981 | 不实现；v1 无版税 |
| burn | 不开放 |
| pause | 不冻结转让；新任务只由应用层 mode 控制 |
| supply cap | 无固定上限 |
| 初始接收人 | 必须等于 origin wallet |
| tokenURI | mint 时一次写入非空永久 URI，不提供后改入口 |
| admin | 复用现有独立 admin，不能等于 operator |
| minter | 现有 operator EOA，沿用全局串行锁 |
| recipe on-chain | 不重复保存；合约保存 origin、tokenIdByOrigin 与 tokenURI |
| collection metadata | 实现 ERC-7572 `contractURI()`，构造时冻结 Arweave URI |
| creator attribution | 实现 ERC-173/Ownable，owner 直接设为独立 admin；deployer 不成为长期 owner |

## G5｜资格与启用

- 唯一身份为小写规范化的 20-byte EVM origin wallet。
- 唯一资格真值为按 `chain_id + ScoreNFT contract` 隔离的 `system_kv.activationBlock`。
- 只有 `sourceScoreBlock > activationBlock` 且历史上没有更早成功 Score mint 的钱包 eligible。
- `off` 不发现；`observe` 记录 eligible/excluded 与固定 recipe 但不上传、不广播；`live` 才推进媒体与 mint。
- observe 或 live 暂停后，已正确发现的启用后资格保留并继续同一任务；历史集合不一致则全局停止。
- 转让、销毁、换账号、大小写变化、重扫、重试均不恢复 origin 资格。

## G6｜本轮连续授权

用户于 2026-09-06 明确要求“一口气执行完，开始完成 P14”。授权覆盖 playbook 已列出的仓库改动、测试库 migration、Arweave、OP Sepolia、Development/Preview 环境、cron-job.org、OP Mainnet 部署/角色、activation、observe/live 与首枚真实空投。每项必须先通过对应自动预检；预检失败时该路径 fail closed，不扩大为未列明的生产动作。

## G7｜永久公开权利 Gate

| 素材 | 当前证据 | 状态 |
|---|---|---|
| 36 个 MP3 及其中第三方采样 | 权利人已明确确认可永久公开并用于 NFT/播放器；原文归档于 `reviews/evidence/p14-f0/rights-confirmation.md` | **通过** |
| 共用封面 | 本项目生成，不引入第三方图片；本地输入 hash 已进入 F0 证据 | **通过** |
| Decoder | 项目自有代码、系统字体和程序纹理；本地输入 hash 已进入 F0 证据 | **通过** |

权利确认不替代人耳试听、字节/hash 或多网关 quorum Gate。A1、E2-upload、F1 及后续永久写入和链上发布仍必须逐项通过对应自动预检。

## G8｜技术默认值

- 生产由 cron-job.org 每分钟调用一个 P14 route，Bearer 使用现有 `CRON_SECRET`。
- route 20 秒停止 claim，25 秒前返回；给 cron-job.org 普通任务的 30 秒硬超时留 5 秒网络余量。lease 5 分钟并在每一步结束立即释放。
- safe retry 最多 5 次，按 1/2/5/15/30 分钟退避。
- 广播前 attempted 且无 tx hash：25 分钟只观察，之后 `manual_review`。
- OP Sepolia/Mainnet 都等待 20 confirmations；广播 30 分钟仍未定案进入 `manual_review`。
- metadata 最大 32 KiB；超限停止。
- 上传结果未知不自动重传，进入 `upload_result_unknown`；传播按 15s/30s/60s/2m/5m/15m 检查。
- activation 比较固定为 `sourceScoreBlock > activationBlock`。

## 连续交接

G7 已关闭。后续永久上传、真实 migration、网络部署、环境写入、cron 与 live 动作按各自 Gate 继续；任一预检失败时只停止受影响路径，并在最终报告中给出精确恢复点。
