# P14 F7 — live 与首枚真实空投

时间：2026-09-11（Asia/Shanghai）
状态：首枚生产空投、永久性审计与公开详情页双视口长播通过；24h/7d 观察继续。

## 资格与 live Gate

- 用户明确确认已用新钱包在 `.xyz` 首次铸造 Score，并授权继续 F7。
- 唯一 eligible origin：`0x456b00a9ecC150ab8fa25bAe830E51811c3A7708`。
- Score Token #3：tx `0xf81cfa621706eeafeda22bd20cfbb16a88bd9916f51dab8f8eddfe16c9772446`，
  block/log `156746674:188`，receipt success。
- cutoff 为 `156738598`；来源块严格晚于 cutoff 8,076 blocks。Score receipt、`chain_events`、
  `score_nft_queue` 与 `mint_events` 四处一致，且该 origin 此前无 Score mint。
- observe 终态只有这一行 `eligible/pending`；两枚历史 Score 仍为 `excluded_prelaunch`，
  metadata、P14 tx 与 tokenId 均为空。
- Production deployment `dpl_CiF1Z1rnG9uzAJQCQMaQcgoxnLsz` 将 mode 切为 `live`，
  health 读回 `mode=live`、`configured=true`。

## 首枚状态机与链上结果

| UTC 时间 | 状态 | 证据 |
|---|---|---|
| 08:51:09 | `preparing_media` | 只盖 job started |
| 08:52:10 | `uploading_metadata` | 合约、封面与永久输入身份写入 |
| 08:53:08 | `uploading_metadata` | metadata txid 已上传，未广播合约交易 |
| 08:54:10 | `minting_onchain` | metadata 双网关验证、tokenURI 冻结 |
| 08:55:11 | `confirming_onchain` | mint tx 已广播并持久化 |
| 08:56:11 | `success` | receipt、origin、URI 与确认数回写完成 |

- Pond Echoes Token：ECHO #1。
- metadata txid：`E4JVJ6EWwplEAXjoff1aDpuwbG7GDm5Whcv9kYLKU88`。
- metadata SHA-256：`a87d3d0be13309affd61f23b55bc74311a27eca6e855b83ce509355a03b47960`。
- mint tx：`0x2680c5e1174cbf0eef71b2b18db8fe4d577f9862ddedf89d6b3ca6d4fcd168e8`；
  block `156759068`，gas used `299,502`，receipt success。
- 链上 `totalSupply=1`、`tokenIdByOrigin(origin)=1`、`originWalletOf(1)=origin`、
  `ownerOf(1)=origin`、`tokenURI(1)=ar://E4JV...KU88`。
- 数据库终态 `success + metadata verified + tokenId 1`，retry/failure/error 全为空。

## 永久输入与四方对账

可重跑工具：`scripts/p14/mainnet/verify-first-token.ts`。完整结果见
`permanent-audit.json`，gate 为 PASS：

- 从链上 tokenURI 出发恢复 metadata，而不是信任数据库里的 URL。
- metadata、manifest、Decoder、封面与全部 36 个音频共 40 个永久对象均达到至少
  2/3 网关 quorum，35 个为 3/3、5 个为 2/3；所有成功响应同字节，每段音频 hash
  与 bytes 均匹配冻结 manifest。
- 链上 mapping/receipt、P14 队列、永久 metadata、Score #3 source 四方一致。
- recipe 为 `KRH9G2JDWD55C6VX0F363L7K5K08BSN18W4P`，由 origin 重新派生后的 hash 与 DB 一致。

## 公开页与完整播放

可重跑工具：`scripts/p14/mainnet/audit-first-token.mjs`。`browser-audit.json` 与四张
ready/ended 截图保留在本目录；过程 partial 在最终报告成功写入后删除，避免重复证据。

- Production `/echo/1` 与 `/echo/origin/<origin>` 均 HTTP 200。
- 375×844：完整采集 1–36 段，271,385ms，结束 `第 36 / 36 段`、`4:29 / 4:29`。
- 1440×900：完整采集 1–36 段，271,717ms，结束 `第 36 / 36 段`、`4:29 / 4:29`。
- 两路都覆盖 `idle → loading → ready → playing → ended`；origin/owner/contract 在页面与永久凭证
  两处一致，ready/ended 横向溢出均为 0，console/page error 均为 0。
- 每路各记录两个 `net::ERR_ABORTED` Fetch 取消事件；36 段全部成功载入并播放，播放器无 error，
  因此不是媒体失败。三候选网关独立审计证明所有音频至少可由两条路径取得且字节正确。
- 截图目检通过：手机与桌面均无裁切、遮挡或状态错位。

## 防重、健康与剩余观察

- 不为防重测试再铸一枚真实 Score。只读主网结果为 `balanceOf(origin)=1`、
  `tokenOfOwnerByIndex(origin,0)=1`、`tokenIdByOrigin(origin)=1`；合约测试网已覆盖重复 origin 拒绝。
- F7 终检 health：mode live、cron fresh、1 success / 2 excluded / 0 active / 0 failed /
  0 manual review / 0 upload unknown，alerts 为空。
- 自动化浏览器不持有用户的私密登录会话，因此未冒充钱包访问 `/me`；链上枚举与公开 origin 路由
  已证明归档数据可发现。用户登录原钱包后的 `/me#pond-echoes` 仍保留一次最终人工目验。
- 24h/7d 期间继续只读观察 cursor、队列唯一性、manual review、运营钱包余额、cron 与永久网关；
  严重异常先切 off、保留行/tx/cursor，不删除或重传未知结果。
