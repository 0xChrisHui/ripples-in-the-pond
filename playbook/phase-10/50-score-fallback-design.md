# P10-C — /score/[id] 链上灾备方案定稿

> C-now「/score 链上灾备」的方案文本（30-c-debt.md 指定"P10 至少方案定稿"）。
> 归 🛑 停点 3 由用户过目决定：本 Phase 落地实现，还是仅定稿留待后续。

## 问题

`getScoreById` 在 B8 后全押 Supabase（A5 链上灾备 noop 残留已删）。DB 抖动 →
所有 `/score/[id]` 404。P10-A 上线分享/海报后，敞口被放大（分享出去的链接遇 DB
抖动集体 404）。

## 触发条件（最小侵入，只加降级不改主路径）

在 `getScoreByTokenId(tokenId)` 的 **DB miss 分支**（`!queueRow` 或 `error`）后，
且 `id` 是数字 tokenId 时，尝试链上灾备；UUID 路径不做（未上链无链上真相）。

## 数据链路（全部 server 侧，view call 不违"前端不调合约"，CONVENTIONS §3.1）

1. `publicClient.readContract({ SCORE_NFT, 'tokenURI', [tokenId] })` — view call 取 `ar://<txid>`
2. `publicClient.readContract({ SCORE_NFT, 'ownerOf', [tokenId] })` — 取 creatorAddress（当前持有者）
3. `resolveArUrl(ar://…)` + `fetch(…, { signal: AbortSignal.timeout(4000) })` 拉 metadata JSON
4. metadata → 降级 `ScorePageData`：
   - `coverUrl` ← metadata.image（ar://→ gateway）
   - `trackTitle` ← metadata.name 或 attributes 里的曲目名
   - `tokenId` / `txHash`(可选，链上取不到就省) / `mintedAt`(用 attributes 或留空)
   - `eventCount` ← metadata.attributes 里若有则用，否则 0

## ⚠ 关键难点：`track`（底曲）无法从 score metadata 直接重建

`ScorePageData.track` 是 `ScorePlayer` inline 播放所需的底曲对象。score metadata 的
`animation_url` 只带 `base=ar://… events=ar://… sounds=ar://…` 三个 Arweave 引用，
**没有** tracks 表那套结构化字段（title/audio_url/week/island…）。因此降级态的播放有两条路：

- **方案 a（推荐，降级但完整）**：降级页不挂 inline `ScorePlayer`，改嵌 Arweave decoder
  iframe（`animation_url` 本就是自包含播放器）。展示封面/标题/tokenId + "在 Arweave 播放"入口。
  改动：page.tsx 增加 `degraded?: boolean` 分支，降级时渲染 iframe 版而非 ScorePlayer。
- **方案 b（完整但重）**：从 `animation_url` 的 `base=ar://…` 反查 tracks 表（audio 的 arweave_url
  → track），DB 已挂时这步也可能挂 → 灾备意义打折。不推荐。

## 失败降级

链上 call 失败 / Arweave 4s 超时 / metadata 解析失败 → 回到今天的 `notFound()`（404）。
灾备是"锦上添花"，不引入新崩溃面。

## 落地成本 & 建议

- 新增 `src/data/score-fallback.ts`（拉链上+Arweave→降级 ScorePageData，约 60-80 行）
- `getScoreByTokenId` DB miss 后 `?? await scoreFallback(tokenId)`
- `page.tsx` + `ScorePlayer` 挂载点加 `degraded` 分支（方案 a 的 iframe 版，约 30 行）
- SCORE_NFT ABI 需含 `tokenURI` / `ownerOf`（ERC721 标准，contracts.ts 现有 ABI 应已含，施工时核对）

**估算**：~1.5 个施工单元。**风险**：metadata schema 与 decoder query 契约需现场核对
（scripts/arweave/upload-decoder 与 metadata 生成处）；重建正确性错了会显示错曲目/错封面。

**建议**：本 Phase 落 **方案 a**（iframe 降级），完整覆盖"DB 抖动分享链接不 404"的核心诉求，
且不碰 tracks 反查这条也可能挂的链路。若停点 3 用户认可，下一步即施工。
