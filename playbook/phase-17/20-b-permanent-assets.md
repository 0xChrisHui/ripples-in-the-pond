# P17-B — 永久音频与 metadata 复用

> 共同边界：[总控](../parallel-2026-10/00-orchestration.md)、[共享合同](../parallel-2026-10/10-shared-contracts.md)。
> 输入：A1 的真实盘点和 A2 的目录。此 Track 不需要为了新页面重传已有原曲。

`P17_EVIDENCE`、`P17_HANDOFF` 是[总览 §6](00-overview.md#6-分册与夜间出口)约定的未来证据路径，不代表当前已生成。步骤结果集中记 handoff，普通报告仅按需附件；永久上传账本和安全证明必须保留。下列工具位置仅描述缺口职责，先复用既有解析、上传、账本和验证基础，不按清单另造工具。

## 永久资料策略

- 同一音频可被 OP 和 ETH 原曲引用。链上资产不同不等于音频必须存两份。
- 现有 OP metadata 已冻结，`animation_url` 是音频本身；现有 `external_url` 指向首页也保留原样。新公开播放 URL 在站内目录和 SEMI 接入清单中提供。
- ETH 推荐复用核验通过的 35 份原 metadata txid。若资料确实含错链或无法满足新合约身份，先记录逐项差异和拟上传 bytes，经过永久写入 Gate 后再产生独立 ETH metadata；不能改旧 NFT。
- 创作手记默认网站内容，`notes.status=absent` 不阻断代码和收藏。用户以后给稿时修改 notes/revision，不因此改变 metadata。
- 不因历史 metadata 没写 SHA-256 就伪造强验证。观测 hash、原上传账本 hash、永久锚定 hash 是不同证据等级。
- 资产链/媒体证明由 P17 统一维护；A1 已核验的同坐标/URI/内容直接复用，B/F 仅补差异，P13 消费证明而非重复拉取 35/70 项。collection 级附加 metadata 缺失不阻断既有音频播放与目录。

## P17-B0：安全解析已有永久引用

**输入依赖**：A1 URI/manifest 快照，A2 schema。缺网关时用已存在的真实快照做可复核本地工作，远端验证保持 pending。

**实际文件/符号**：只读 `scripts/arweave/material/upload-metadata.ts:tokenHex/metadataBuffer`、`src/lib/arweave/core.ts:ARWEAVE_GATEWAYS/resolveArUrl/fetchFromArweave`；新增 `src/data/material/{permanent-uri.ts,metadata.ts}`、`scripts/p17/assets/verify-permanent.ts`。

**具体操作**：

1. 支持已存在的 `ar://txid` 和 `ar://manifestTx/{id}.json`：校验 txid、路径、替换 64 位十六进制 id，再读取 manifest 对应 txid。拒绝路径穿越、未知 scheme、任意 URL 透传和重定向到内网。
2. metadata 只读 `name/description/image/animation_url/attributes/external_url` 等必要字段；校验对象类型、文本长度和媒体类型。文本交给 React 转义，不注入 HTML。
3. 先复用当前 Arweave 安全读取能力，仅对确实缺失的超时、字节上限或重试边界补最小适配：单请求超时、响应字节上限、并发上限 3、每网关至多 2 次尝试；不修改公共网关列表，不强制新增一层 fetch。
4. 原曲 `animation_url` 必须解析为音频；不把 MP3 当 iframe 页面，不生成假的 Score events。输出媒体描述 `{kind:'audio', uri, mimeType}` 供 P13与播放使用。
5. 使用 A1/既有账本记录的音频 bytes、MIME、长度、SHA-256 证明，只核验尚缺或冲突部分。双网关返回相同 bytes 表明本次读取一致，不能仅据此宣称存在永久 hash 锚；不为本 Step 重下同一批已核验资源。

**失败恢复**：坏 JSON、错误 token 路径、超大文件、网关超时只使对应资产 unverified；保留已知坐标和重试入口。不同网关 bytes 不同则隔离冲突，禁止挑一个方便的结果晋级 verified。

**定向验证**：现存 direct URI/path manifest 各一条真实样本；1/10/35 的 hex 替换；坏 txid、`../`、异常 JSON、错误媒体类型及超时路径。禁止为通过测试修改生产 URI。

**完成证据**：handoff 的 B0 结果引用共用 35 项资产证明表，区分本地测试、远端已核验、网关暂不可用；复杂解析差异才附 `P17_EVIDENCE/catalog/permanent-resolution.md`。

**自动下一步**：进入 B1；局部资源不可达不阻断播放器错误分支与目录开发。

## P17-B1：冻结本次复用资料与发布清单

**输入依赖**：B0；真实 A1 音频对应关系。ETH 构造资料最终启用须 A3 批准。

**实际文件/符号**：`src/lib/music-catalog/asset-registry.ts` 与 data 子目录；新增 `scripts/p17/assets/prepare-bundle.ts`；已有永久上传状态的路径由 A1 查证，不能假定每台机器均有 `C:\Users\Hui\ripples-mainnet-assets`。

**具体操作**：

1. 为 35 曲生成可复现的只读 bundle：trackId、OP tokenId、direct metadataUri、音频永久 URI、bytes hash 和验证级别。只放引用和公开资料，不复制 35 份大型音频进源码。
2. 新 ETH 合约推荐显式使用 tokenId 1–35，构造参数是逐项映射的 35 份核验 direct metadataUri。必须在目录中分别记录各链 tokenId；页面/API 不凭 displayNumber 或数组位置推导 token。若最终 BASE 已有其他合法发行映射，保留并提请总控确认，不重编历史编号。不使用允许 admin 后改的 baseURI，不依赖网站数据库提供 URI。
3. ERC-1155 原曲 collection metadata 单列：名称、描述、图片与 collection 外部入口；优先复用已存在且身份语义正确的永久对象。缺失记附加资料 pending，只有获批新部署确需它时才准备待审核 bytes/hash；不能因此阻断 35 首既有音频播放、目录或 C1。
4. 未提供手记时记录 absent；真实未定稿的稿件仅放 draft，不自动公开私人稿件，不从旧迁移文件的截断文件名补全创作故事。
5. 将 bundle 内容 hash、生成工具版本和来源 revision 记入 handoff；目录语义变化时重新生成公开 JSON并通知P13，新旧 revision 不能混用。仅检查时间或无关 commit 变化不重验媒体。

**失败恢复**：本地音频与永久音频不一致时，保留旧 Token 的永久来源；需要新发行版本的决定交用户/总控，不用“重新上传全部”消除冲突。缺 collection URI 只挂起确实依赖它的新不可变部署子项，本地合约测试可用明确测试 fixture；既有音频播放/目录与其他独立工作继续。

**定向验证**：35 个构造 URI 顺序不变；同输入两次 bundle hash 相同；没有 `example`、零地址、临时 localhost 永久引用；未把 notes 或网站 URL 注入旧 metadata。

**完成证据**：保留供部署消费的 `P17_EVIDENCE/catalog/permanent-bundle.json` 或等效已有产物；handoff 列出复用、新增待上传、冲突数量，不另强制写 reuse-summary。

**自动下一步**：需要新永久对象则进入 B2；全部可复用则将 B2 标 `not_needed` 并进入 C。`not_needed` 必须有引用证据。

## P17-B2：带账本的新增永久对象上传（条件执行）

**输入依赖**：B1 最终 bytes/hash、明确原曲/封面权利范围、上传账户、总额预算与执行授权。已有 P14 的 36 段碎片授权不能自动外推。授权缺失只开发本地工具与 dry-run，不上传。

**实际文件/符号**：先复用 `src/lib/arweave/core.ts:uploadBuffer` 与既有可隔离的上传/账本/验证能力；确有缺口才在 `scripts/p17/assets/{upload.ts,ledger.ts}` 最小适配，不改变旧账本。不要直接运行旧 `upload-metadata.ts` 全量重传。

**具体操作**：

1. 工具默认 `--dry-run`，显示每个对象身份、MIME、长度、SHA-256、是否已有 txid、预估成本和总额。执行模式必须校验授权文件与 bundle hash，不能仅检查 env 有密钥就发送。
2. 本线账本使用 `contentHash + contentType + purpose` 为稳定键；写入 `prepared → attempted → uploaded → verified`。在外部调用前落盘 attempted，保存 job ID、预算和可恢复上传标识；未返回结果进入 unknown。
3. 只对明确缺失且获授权对象上传。已有 txid 直接验证，不重发；已知 hash 不同先冻结，不能覆盖账本。
4. 新上传 txid 经两个配置网关完整 bytes/hash/MIME 核验后才 verified。CDN或数据库返回成功不能代替永久内容核验。
5. 同一账本单写，原子更新；unknown 对象通过 SDK 结果、上传 ID或交易查询恢复。重复调用若无法证明没有外部写入，保持 unknown 并停止该对象。
6. 只将 verified 的公开引用写回 registry，状态与成本明细留 evidence。私钥、JWK、Bearer、原始账户配置不进入 report 或 git。

**失败恢复**：网关未传播是 waiting，不重新上传；上传未知不能“换网关重传”；余额不足或超预算停止付费路径，继续 C 的本地测试/E 页面。失败的 bytes 不直接修改后再沿用同一键。

**定向验证**：dry-run 外部写入为 0；断点恢复不增加已知对象的上传次数；模拟未知结果保持阻断；hash 不符拒绝晋级。实际上传后只核验本批新增对象，不重复支付已完成素材。

**完成证据**：必须保留真实永久上传账本及授权、成本、hash/URI、unknown 恢复证明；handoff 引用其受控位置并记录 real/fixture 分类与结果。upload-summary 仅在记录较长时作为附件，不替代账本。

**自动下一步**：A3 已批准则进入[Track C](30-c-ethereum-material.md)；否则进入[Track E](50-e-catalog-playback.md)可独立完成的只读页面，最终 G 汇总待批准项。
