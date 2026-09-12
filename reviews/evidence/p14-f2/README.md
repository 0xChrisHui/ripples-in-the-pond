# P14 F2 — OP Sepolia 资格、空投与转让 E2E

时间：2026-09-11（Asia/Shanghai）
activationBlock：`48629909`（20 confirmations safe head）

## 钱包场景

| 场景 | Score 证据 | P14 结果 |
|---|---|---|
| W0 历史钱包 | Score #25，block `48629862` | `excluded_prelaunch`，无 recipe/metadata/P14 tx |
| W1 首次资格 | Score #26，block `48630245` | P14 #1，成功 |
| W2 同块并发 | Score #27/#28，均在 block `48631928` | 仅一行/一枚，source 固定 #27，P14 #2 |
| W1 重复触发 | Score #29，block `48632008` | 扫描 1，处理 0，仍仅一行/一枚 |
| W3 第三个播放样本 | Score #30，block `48632190` | P14 #3，成功 |

observe 阶段 W1 只生成 eligible 行与固定 recipe，`arweave_upload_ledger=0`、无 metadata txid、
无 P14 tx。切 live 后，各任务逐步经过 media、metadata、mint、confirming；没有跨状态跳写。

## 三枚链上作品

| Token | Origin | Source Score | Metadata txid | Mint tx |
|---:|---|---:|---|---|
| 1 | `0x4Fffc941Af305Efa80Afc9754083411859af0F78` | 26 | `D39k74TJP6LY6_NXQYEQt15GRhWAxn77mxYVgzAmJ5g` | `0x9285192011e5ff5261f348cd48ec5179d3431ffa6de7342b88a7262dc922165e` |
| 2 | `0x40F72999b7102bA213102bcbFAe8f2378c7Fc7A9` | 27 | `e-VnBwXHVDe6lWUEw_7z5jvvrpTNaXwZwUV_WEnefh0` | `0x0da09228438d7dc4efef3c0104ef2efa525a498246c454aadbacf65735ff4d3a` |
| 3 | `0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1` | 30 | `SUe5bK4Ez2dd6hey4Hw3SCiWCrxlGrS01YUn-TFbLjY` | `0x72c5c464cacf17981115b9e5a9f4a622c1443e1ff7183724c37610ecba3ed896` |

三份 ledger 均为 `verified`。2026-09-11 复查时 ardrive.net 与 arweave.tokyo 的 metadata
字节/sha256 一致，arweave.net 单点失败，仍满足 2/3 quorum；分别为 4530、4684、4364 bytes。

## 转让与档案

- P14 #1 转让交易：`0xa8defbc89fdddb19446f685e4bbdc757394a01ec06609416ee1e2fa3e4147433`
- 转让发生时 `ownerOf(1)=W3`，`originWalletOf(1)=W1`，`tokenIdByOrigin(W1)=1`，
  `tokenIdByOrigin(W3)=0`（转让不创造 origin 资格）；W3 后续以自己的首次 Score 获得 #3，
  最终 `tokenIdByOrigin(W3)=3`。
- 带签名 JWT 的 `/api/me/pond-echoes` 验证：W1 `onChainTotal=0 + origin-history`；
  W2 `onChainTotal=1 + current-owner`；W3 能以 `current-owner` 发现 #1。
- 对 W1 再执行合约 mint 的 `eth_call` 被 revert，链上终身唯一性成立。

## 真实故障/恢复矩阵

- source cursor 落后：返回 `source_index_lagging`，同步追平后原任务继续，无重复行。
- 旧单点网关超时：返回 transient 且零上传/零广播；改用冻结的 3 候选/2 quorum 后同任务恢复。
- metadata 上传后按 txid 双网关复核，再进入 mint；三份付费对象全部能在 ledger 解释。
- receipt 延迟：W1 在 `confirmations_18` 保持 confirming，达到 28 后才 success。
- Vercel 错库配置：live health `live_fail_closed`，没有外部写入。
- 空发现批次：修复后稳定返回 `processed=0/discovered=0`，不再访问不存在的样本。
- P14 处理期间 Score #27/#28/#29/#30 均独立成功，P14 故障未阻断 Score 铸造。
