# P16 上线收口 Review

日期：2026-10-02（北京时间）

代码基线：`04a33bf14dcf95d2717097b97de6539a3b17b0c5`

范围：Ethereum Mainnet 首枚 Token #1 的链、库、永久资源和官网使用闭环。

## 结论

P16 核心主链路收口通过。本次核验范围内未发现阻塞铸造、所有权、订单完成或公开播放的问题；发现两项 P2 标签问题，保留为后续修正。结论不代表全钱包矩阵、长时间稳定性或私密 `/me` 已全部验收。

本次仅进行了远端只读检查和公开页面播放，并更新本地验收文档；没有修改数据库、生产配置或永久素材，没有发送新交易。工作树开始时干净。沿用用户本轮提供的连续执行协议，未采用工作树旧 AGENTS.md 的逐文件暂停规则。

## 发现（非阻塞）

后续处理：两项已在本地修正，等待正常代码发布；下文保留发现时的原始证据。Token #1 的永久 metadata 不更改。

### P2-1：Ethereum 永久凭证来源误标为 OP

- 位置：`app/(pond)/score/[id]/components/ScoreArchive.tsx:7`。
- 复现：Ethereum Mainnet Token #1 的合约、Token ID、当前持有人和 tokenURI 行显示“来源：OP 合约”。
- 原因：共享凭证组件把 `contract` 来源标签固定为 OP。
- 影响：来源说明错误；主标题显示 Ethereum Mainnet，实际合约、持有人、交易与 tokenURI 核验正确。
- 后续建议：使用资产链名称，或将通用来源文字改为“链上合约”。本次 Review 不改产品代码。

### P2-2：永久 metadata 的 Minted At 实为建单日期

- 位置：`src/lib/self-mint/assets.ts:151`。
- 永久 metadata 写 `Minted At=2026-09-26`，实际 mint 区块时间为 `2026-10-02T08:23:47Z`。
- 原因：授权前需冻结 metadata，代码以 `row.created_at` 填充该字段；跨日签名时与真实铸造日不同。
- 影响：永久展示属性有歧义；交易和页面底部实际日期正确，不影响所有权或播放。
- 后续建议：未来订单使用准确的“准备日期/创建日期”字段，真实铸造时间取区块回执。Token #1 已冻结的 metadata 原文保留，不尝试覆写。

## 1. 链上证据

| 项目 | 核验结果 |
|---|---|
| 链 / Token | Ethereum Mainnet / #1 |
| 合约 | `0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A` |
| 订单 | `0x387d2d53d7875238d290a9e0ca6e0c5bea53834a142470aeeb660e011f6e9a77` |
| 交易 | `0x3ef7abb36c3f1b1c5942968409495820459fda168e3b44fd7476cd7172f50a23` |
| 回执 / 区块 | success / 26103423 |
| 时间 | 2026-10-02 16:23:47 北京时间 |
| 持有人 | `0x991b1aDe06d49454FD7A2cAeaf31F908e00d1c63` |
| tokenURI | `ar://jIqs9UaIuodoKZKrExQxel3IqqNIPgWAQjuSUVQjLTw` |
| 实际 Gas | 192792，费用 0.000428183782442424 ETH |

复用同一会话已完成的 ownerOf/tokenURI 读回；补查该订单 mapping 为 1，目标合约 ScoreRedeemed 的 orderId、recipient、tokenId、tokenURIHash 与冻结订单匹配，交易回执成功。未重新铸造。

## 2. 正式数据库

- 项目 `uupobbgnhpattyxhxvmc`，订单状态 `success`，交易与区块同上，failure_code 为空。
- confirmed_at：`2026-10-02T08:24:14.979127Z`。
- 唯一 claim 为 `eth_self_paid / consumed / version 1`，关联 orderId 与订单 claim_version 一致。
- production active snapshot 指向同一 chain/contract/token 的 revision 1，激活于 `2026-10-02T08:24:14.724170Z`。
- 原 pending score 保留 `draft`；`app/api/me/scores/route.ts` 会排除所有非 released 的 claim，因此该项不再属于待铸造列表。这是现有查询设计，不是残留可重铸订单。
- `app/api/me/score-nfts/route.ts` 读取本人 Ethereum 订单并映射为唱片，成功状态和 verified package 均齐全。此项为正式数据加查询逻辑核对，没有冒充私密会话 UI 目验。

## 3. 永久资源

- 完整读取 metadata、v3 package、events、底曲、soundSet、decoder 共 6 项，以及 38 个事件实际使用的 11 个音效，共 17 项。
- 17/17 均从已登记 ArDrive 网关取得，bytes、SHA-256、MIME 全部与已冻结身份一致；无重试。已验证资源按项目规则从任一登记网关读回即可，本次未重复上传或重跑历史双网关验收。
- 永久 metadata/events/soundSet 与生产 snapshot 内嵌内容逐项一致。
- 复用项目 `parseScorePackageV3`、`canonicalizeJson`、`sha256Hex` 验证 v3 schema、四项资源引用与 snapshot content digest，全部通过。
- metadata 的 package 引用、哈希及外部作品地址与当前作品一致。
- 明细见 [token-1-closeout.json](./evidence/p16-mainnet/token-1-closeout.json)。

## 4. 官网播放

- [正式页面](https://pond-ripple.xyz/score/1/0xdec99da00290d15f0742b0abd26e4cd5d121f02a/1) 返回 HTTP 200，用户也已确认页面出现。
- 单个无登录 Edge 会话显示 Ethereum Mainnet、Token #001、FINALIZED、曲目 17、38 个永久事件。
- 点击播放后 8 秒采样为 `record-anchor[data-state=playing][data-visual=eclipse]`，提示“正在播放”，页面及控制台错误均为 0；随后暂停并关闭本次浏览器。
- 这是播放启动 smoke，未宣称整曲听音验收。私密 `/me` 实际卡片消失/出现仍留作原钱包本人目验；数据与接口筛选证据已通过。

## 5. 收尾与边界

- 更新 STATUS、TASKS 和主网证据索引，P16 核心主线完成。
- 两项标签问题、私密档案目验、imToken/WalletConnect 真实 mint、Phantom/OKX 入口 smoke 保留在开放项；旧 Sepolia playbook 的历史阻塞表不冒充这些钱包已经通过。
- 本次仅文档与证据变更，检查 diff、JSON 与本地链接；不重复 build、合约测试或全站浏览器矩阵。
