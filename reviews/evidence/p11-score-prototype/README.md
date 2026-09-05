# P11 Score 样板证据包 — Token #1

> 取证时间：2026-09-01（UTC 链上核验点 `2026-09-01T05:28:49Z`）
> 原则：只读公开链、生产页面与永久 Arweave 资源；没有读取或保存任何 RPC key、数据库密钥或钱包信息。

## 1. 截图索引

| 文件 | 画布 | 内容 |
|---|---:|---|
| `current-score-375.png` | 375×1102 | 当前生产 `/score/1` 手机全页基线 |
| `current-score-1440.png` | 1440×1102 | 当前生产 `/score/1` 桌面全页基线 |
| `permanent-decoder-375.png` | 375×932 | Token #1 永久 Decoder 手机错误态基线 |
| `permanent-decoder-1440.png` | 1440×1000 | Token #1 永久 Decoder 桌面基线 |
| `375.png` | 375×2500 | P11 原生 Score 高保真手机样板 |
| `1440.png` | 1440×2050 | P11 原生 Score 高保真桌面样板 |

## 2. 链上身份

- 网络：OP Mainnet（chain ID `10`）
- ScoreNFT：`0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA`
- 合约名 / 符号：`Ripples in the Pond` / `RPIP`
- Token ID：`1`
- `ownerOf(1)`：`0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54`
- `tokenURI(1)`：`ar://YoRsYgKb2Wdc_a2ZRZVa9IU-TdFa8-OVCylVbKczIUo`
- 核验区块：`156320879`；当时 finalized 区块 `156320302`，已高于两笔作品交易区块。

> `ownerOf` 只证明当前持有人。样板不把它写成艺术家姓名或创作者身份。

## 3. Metadata 原文摘要

来源：<https://arweave.net/YoRsYgKb2Wdc_a2ZRZVa9IU-TdFa8-OVCylVbKczIUo>

- SHA-256：`47bba212f0e83e7c508b64479b8bd857a89c390cb03b3dd7ec06fb1c57975144`
- `name`：`Ripples #1`
- `image`：<https://arweave.net/K0NAVlE00l6RhefjO7lZKqrG_HTSM9DglDhCC7UnhIo>
- `external_url`：<https://pond-ripple.xyz/score/1>
- attributes：`Track=33`、`Week=33`、`Events=35`、`Minted At=2026-08-23`
- Arweave block：`1985804`，时间 `2026-08-23T08:23:51Z`

永久 `animation_url` 原文：

```text
https://arweave.net/NMCjKLoaRNWKgH0AyCDB6p8qjjv2iD2Fidzf7VAZmb0?events=ar://7wkFL72xytedtsM8JRU4duTJ9bX7zKDHhVLfUccTGZQ&base=ar%3A%2F%2FM-NM7NGjnakWHaNE8Su3LLO5qAGckpNeVX3weToIqIQ&sounds=ar://NQsgcCSPJjeRzvXHnXNWbUsovDCjkO5xHJBX7Eu_kl8
```

## 4. 永久资源

| 资源 | Tx ID | 类型 / 大小 | SHA-256 |
|---|---|---:|---|
| Cover | `K0NAVlE00l6RhefjO7lZKqrG_HTSM9DglDhCC7UnhIo` | SVG / 8,322 B | `fcaddf14d09d98f33fa47b15ee47dc443f5491441413a213549cef758b9cc17b` |
| Decoder | `NMCjKLoaRNWKgH0AyCDB6p8qjjv2iD2Fidzf7VAZmb0` | HTML / 23,362 B | `399f94a78127fc9b34eb7ba5c52bb674e9ca128b39d5ec8bd0b45f639c4e4f05` |
| Events | `7wkFL72xytedtsM8JRU4duTJ9bX7zKDHhVLfUccTGZQ` | JSON / 1,345 B | `728a104ac691aadcf7f6ca0c9d66fd678d0dbe1a5c9205887d84d9b69eb1851d` |
| Base | `M-NM7NGjnakWHaNE8Su3LLO5qAGckpNeVX3weToIqIQ` | MP3 / 7,326,016 B | `c94083362491cdf9b84387a0e7d392017579478ece082df46a544d1b08b5b1ab` |
| Sounds | `NQsgcCSPJjeRzvXHnXNWbUsovDCjkO5xHJBX7Eu_kl8` | JSON v2 / 2,558 B | `df59a2eaddc1ae63f26e7cf58da3c02e80cfe2558bbf17794dda697a36c98fb9` |

Events 共 35 条，真实使用 13 键：`b×3 c×3 d×4 f×3 h×3 j×2 k×1 l×1 n×2 r×3 s×2 t×2 v×6`。事件从 `126ms` 开始，最晚尾端为 `4156ms`；这不是底曲总时长。Sounds manifest 为 v2，包含 `a–z` 26 项。

## 5. 交易凭证

- Mint tx：[`0x1d2d…82f4a`](https://optimistic.etherscan.io/tx/0x1d2de0a47e73114e87ecb7d81b5b49e61edb5f7b4a4c2871317811b53f182f4a)，block `155937041`，`2026-08-23T08:14:19Z`，success。
- setURI tx：[`0xaa72…550dc`](https://optimistic.etherscan.io/tx/0xaa72331c194da27e56c6243f27223b089a37ddbf2a94e5c5ca1774a8784550dc)，block `155937046`，`2026-08-23T08:14:29Z`，success；参数为 Token `1` 与上述 tokenURI。
- Metadata Arweave tx：[`YoRs…zIUo`](https://viewblock.io/arweave/tx/YoRsYgKb2Wdc_a2ZRZVa9IU-TdFa8-OVCylVbKczIUo)。

## 6. 生产页面 / 数据库公开证据

生产 `/score/1` 的公开 RSC 可确认：

- queue UUID：`30c75936-515c-411e-a033-0d64357b19a6`
- track UUID：`eeef9acd-b0f5-4846-ab6c-e72e06656598`
- 底曲 `33`、Week `33`、事件数 `35`
- 数据库页面短地址 `0x19da...bA54`
- 页面日期 `8/23/2026`
- 当前 OG URL 使用 queue UUID，而公开永久入口是 `/score/1`；样板首屏不展示 UUID。

公开页面没有创作者展示名、简介、精确 queue 创建时间或可证明的底曲总时长。这些字段在样板中均未虚构。

## 7. 网关说明

取证时 `arweave.net` 六项资源的独立 HTTP 请求均返回 200；`ario.permagate.io` 对多数资源短时返回 503，Base 超时。无头 Edge 内的部分音效请求还出现 `ERR_CONNECTION_CLOSED`，因此两张 Decoder 截图保留了真实 `Failed: Failed to fetch` 状态。该记录只表示取证时的网关状态，不表示永久资源缺失。
