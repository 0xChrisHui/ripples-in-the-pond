# P23-C：Semi 纯绿封面调查

2026-11-14 夜间任务；只读生产数据库和链上状态，读取公开资源及 Alchemy NFT 元数据。未修改已铸作品、永久元数据或 Semi 仓库；仅请求 Alchemy 刷新其索引缓存。

## 实际结论

**旧作品在 Semi 的封面显示尚未恢复。** 已取得“链上地址正确、永久图片可读、Alchemy 返回空图”的证据。Semi 公开源码的补全路径还存在两个障碍：不自行读链上 tokenURI，以及拒绝 Arweave 实际使用的重定向。没有发现可以通过本仓前端改动修复的缺陷，因此未改写已铸作品。

## 样本与结果

抽查 Optimism Mainnet，合约 `0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA`。生产库现有 #1–9 的永久地址已只读盘点。

| 样本 | 链上 tokenURI 与生产快照 | 永久 metadata / 封面 | Alchemy 图片字段 | 刷新索引后 |
|---|---|---|---|---|
| #1 | 一致 | 首次 GET 网络失败；另一次取到 metadata 的 302 地址 | 全为空 | 仍为空 |
| #5 | 一致 | metadata 200；封面 SVG 200，8315 字节 | 全为空 | 仍为空 |
| #8 | 一致 | metadata 200；封面 SVG 200，8322 字节 | 全为空 | 仍为空 |

三枚 Alchemy 响应均 HTTP 200，但 `tokenUri` 和 `raw.tokenUri` 为空、`raw.metadata` 为 `{}`、`image.originalUrl/pngUrl/cachedUrl` 均为空。依次请求 `refreshCache=false/true/false`，结果没有恢复。

- #5 封面：[永久图片](https://arweave.net/YrXemxbDu6KCO_Oqm3YL6asavciY-_OSgTyMyGD7n9k)，SHA-256 `2af8404b23654659ff55c9e2414926ab56077a2857255fd09e9c21f9327be7c7`。
- #8 封面：[永久图片](https://arweave.net/5fE4_VEwQWk9YyAXRvuxsQZEAUt0GWngWEBtkCl24Gk)，SHA-256 `1ef85baf8e00ac207a0645de746de624ba31049f03c994bbfc006845c1681d48`。

## Semi 源码与复现边界

公开仓库检查时 HEAD：`95bebc8de8cacfc40278aec2d46bf2668c5f805f`。**没有确认 Semi 线上部署就是此提交，也没有冒充真实登录验收。**

1. [`server/utils/nft.ts`](https://github.com/nantang-dao/semi-app/blob/95bebc8de8cacfc40278aec2d46bf2668c5f805f/server/utils/nft.ts) 首先选择 Alchemy 的 `originalUrl → pngUrl → cachedUrl`。
2. [`NFTItem.client.vue`](https://github.com/nantang-dao/semi-app/blob/95bebc8de8cacfc40278aec2d46bf2668c5f805f/components/NFTItem.client.vue) 在图片缺失或加载失败时使用 `/images/placeholder.png`。因此纯绿现象与缺图路径吻合；不能据此区分“没有图片 URL”和“已有 URL 下载失败”。
3. [`fetchChainMetadata.ts`](https://github.com/nantang-dao/semi-app/blob/95bebc8de8cacfc40278aec2d46bf2668c5f805f/server/utils/nft/fetchChainMetadata.ts) 刷新 Alchemy 后仅从其 `raw.tokenUri` 或列表响应取得地址，不自行调用合约 `tokenURI`。本次 NFT metadata 响应里此字段为空，补全可能在这里结束；真实 owned 列表返回值仍需登录确认。
4. 即使取得正确 tokenURI，补全的 `fetchJson` 设置 `redirect: 'error'`。三个样本的 Arweave metadata 地址均返回 302；以相同请求设置复现均得到 `unexpected redirect`。不能为绕过此问题直接取消 Semi 的服务端 URL 白名单，应在该仓另行实现受限重定向及链上兜底。

## 证据

- `reviews/evidence/night-20261114/semi/chain-metadata-images.json`：链上读回、永久图片 MIME / 字节 / 哈希、Alchemy 图片字段。
- `reviews/evidence/night-20261114/semi/refresh-and-redirect.json`：三次索引查询及 Arweave 302、拒绝重定向的复现。
- 本地原始公开源码：`.tmp/night-20261114/semi/`，不含登录凭据；不作为本仓应用代码提交。

## 明早验收与后续

1. 用实际持有 #5 或 #8 的钱包登录 [Semi](https://semi.ntdao.xyz/)，确认 OP 网络、合约及 Token 编号，记录是否仍纯绿。未登录界面或本站 `/score` 正常显示均不能替代此验收。
2. 如果仍纯绿，后续在 Semi 仓库核对实际部署版本及 owned 响应，再修复“Alchemy 空 tokenURI 的链上兜底”和“受限 Arweave 重定向”；本次未改外部仓库、未发送对外消息。
3. 新 600 张 JPG 的双网关上传核验、生产封面池替换另见 P23 夜报。它们服务后续新铸作品，**不会改变上述已铸作品的永久 metadata，也不能作为旧 Semi 恢复的证据**。
