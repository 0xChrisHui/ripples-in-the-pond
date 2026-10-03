# 四线共享合同 — 同一曲目、同一链上地址、同一份 SEMI 清单

> 状态：执行规范 v1；代码由 P17 实现。本文件只冻结本轮交接合同，不代表任何新合约已经部署。
> 权威来源：[四线总控](./00-orchestration.md)；用户明确要求曲目页展示的地址同时进入 SEMI 接入清单。

## 1. 唯一数据来源与负责人

- P17 维护 `src/lib/music-catalog/asset-registry.ts` 及其同目录类型、校验与公开数据。该模块是曲目页面和导出程序的唯一读取入口。
- 现有 chain registry 继续提供网络、浏览器和已经部署的合约配置；新注册表通过它读取已有事实，不建立另一套网络配置，也不放 RPC 密钥或服务端私钥。
- 原曲清单若按规范拆为 JSON/TS 数据文件，文件在 P17 目录内，由同一个入口读取；P13 不修改源数据。
- P13 从该入口生成 `docs/integrations/semi/` 的机器清单和人读说明。网页、对接清单、验收记录携带同一 `schemaVersion` 和 `revision`。
- 部署环境、chainId、合约和 Token 是不同维度；测试网条目不能进入生产 ready 清单。

## 2. 公开数据模型

| 层级 | 必需字段 | 约束 |
|---|---|---|
| 根 | `schemaVersion=1`、`revision`、`environment`、`tracks`、`collections` | `revision` 来自规范化公开内容的 SHA-256，排除生成时间与自身 revision |
| 原曲 | `trackId`、`displayNumber`、`title`、`audioArUri`、`audioSha256`、`integrityMode`、`notes`、`deployments` | 正式范围恰好35首，displayNumber 1–35；trackId用既有稳定ID，不用数组位置推Token |
| 手记 | `status`、`text`或内容引用 | `absent / draft / final`；用户未提供时 absent，不能伪造作品解读 |
| 网络发行 | `chainId`、`status`、`contractAddress`、`tokenId`、`standard`、`metadataUri`、`publicPlaybackUrl`、`archiveMint`、`verification` | 部署前字段为明确空值，不允许填零地址或假 txid；ready 必须所有关键字段齐全 |
| 系列 | `kind`、`chainId`、`contractAddress`、`standard`、`metadataMethod`、`playbackKind`、`enabled`、`verification` | kind为 original/score/echo；列全部正式启用系列，排除停用历史合约和测试集合 |
| 留存凭证 | `state`、`recipient`、`amount`、`txHash`、`blockNumber`、`verifiedAt` | `not_planned / awaiting_input / pending / confirmed / unknown`；confirmed须真实链读回 |
| 验证记录 | 来源、区块/时间、URI解析、媒体结果 | 公共证据可导出；签名secret、JWT、私人身份信息不可导出 |

这些字段是接口合同，不要求一个文件塞下全部实现。规范上限和目录限制依照 CONVENTIONS 分拆。

网络发行 `status` 固定为 `undeployed / unverified / ready`，`standard` 固定为 `ERC721 / ERC1155`。`ready` 由实际部署、永久资料及核验证据计算，不通过手工填值跳过验证；归档是否已铸另看 `archiveMint.state`，不能混为一个状态。

### 身份规则

1. 完整身份为 `chainId + lowercase contractAddress + tokenId`，同时保存明确 `standard`。
2. `tokenId` 序列化为十进制字符串，不用 JavaScript number 承载任意 uint256。
3. 同一原曲的 OP/ETH 发行可有不同 tokenId；编号 1–35 只是展示编号，不能静默当作链上 ID。
4. 当前 `src/lib/chain/chain-registry.ts` 的 `buildAssetId/parseAssetId` 固定 ERC-721。ERC-1155 原曲使用 standard-aware 身份模块；保留旧 Score 路由和旧身份函数兼容，不把原曲误标成 ERC-721。
5. 系列键为 `chainId + contractAddress`；代币键在其上加 tokenId。SEMI 的合约白名单与单曲映射分别导出，不能只给35个 token URL 代替系列地址。

### 完整性与历史兼容

- 永久 metadata 已承诺的 hash 才叫 canonical；只从网关下载后计算的 hash 标记 observed，不冒充创作者原本的承诺。
- `audioSha256=null` 配合 `integrityMode=legacy_verified_source` 是诚实历史状态，不用空字符串/假hash补齐。
- 新永久上传具备 canonical hash 时写明字段来源；不重写已经冻结的 OP URI 来满足新模板。

## 3. 可消费接口与两次交付

C1 至少提供以下等价接口（命名可按既有规范局部调整，但两线同一提交冻结）：

```ts
getMusicCatalog(): MusicCatalog
getOriginalTrack(trackId: string): OriginalTrack | null
getOriginalDeployment(trackId: string, chainId: number): OriginalDeployment | null
listEnabledCollections(): readonly MusicCollection[]
validateMusicCatalog(input: unknown): CatalogValidationResult
```

- C1 包含真实已知来源与显式未部署状态、运行时验证器及相关测试；不能返回虚构35首/伪合约的 mock 数据。
- C1 类型和读取接口先稳定；P13 可直接消费已存在 OP 资产。未知数据只阻断相应条目 ready 状态，不阻止导出结构和验证功能开发。
- C2 更新链上事实与验证证据，不随意改变 C1 字段语义。若确需破坏性变化，P17 告知总控和 P13，升级 schemaVersion 并同时适配，禁止静默漂移。
- C1/C2 交接都包含完整 commit SHA、revision、文件清单和通过的验证，不靠聊天里的短地址作为数据传输。

## 4. 曲目页与 SEMI 的一致性断言

以下是自动验收必须满足的等式：

- 曲目页在某链显示的正式 `contractAddress/tokenId/standard`，与 SEMI 单曲映射相同。
- 曲目页展示的每个已验证生产合约，都在 SEMI 合约清单中有同 chainId 的记录；反向检查导出内无失效、虚构或未经验证的“新增合约”。
- 两者使用同一 publicPlaybackUrl 和 metadataUri 解析规则。
- 同一 revision 下生成的导出内容可重复，字段顺序和格式固定；运行时间改变不应造成地址清单变更。
- 全部35首在 OP 与 ETH 都完成留存时，可核对70个 `trackId × chainId` 结果；不能按70笔交易判断，已有记录复用或批量交易都需逐条对应。

页面允许显示未部署网络的说明，但该状态不能进入 `ready` 导出，也不能提供可点击的假合约地址。机器导出可在单独 `pending` 列表说明未完成项。

## 5. 单曲播放与资产标准

- 推荐原曲 NFT 路由为 `/score/material/[chainId]/[contract]/[tokenId]`，独立解析 ERC-1155 原曲；保留现有 `/score/[id]` 与多链 Score 路由。
- `/tracks` 负责35首原曲的浏览、选择和创作手记；无须 NFT 的试听使用 trackId 与已验证音频来源。
- 若要让 `/score` 根路径成为入口，P17 明确其列表/导航职责并测试；不能让它凭一个模糊 id 猜链或合约类型。
- 原曲播放复用当前唱片视觉时只消费明确的“单曲资产”适配接口，不能构造假的 Score events、creator、tokenURI 或 ownership。
- ERC-1155 使用 `uri(id)` 和 `balanceOf(address,id)`；标准 URI 中若含 `{id}`，按64位小写十六进制无 `0x` 替换。ERC-721 使用 `tokenURI` 与 `ownerOf`。
- 既有 Material metadata 的 `animation_url` 可能直接指向音频；SEMI 必须区分音频、HTML Decoder、其他合法媒体，不能把所有地址当 iframe 页面。
- 永久播放器与音频不以本站会话、SEMI JWT 或数据库可用作为必要条件；公共网关暂不可用必须诚实返回可重试状态。

## 6. 共享 UI 与播放接线

- P15 负责现有 Score 的退出动画：音频状态结束后，视觉保留退场所需快照直至淡出完成。P17 单曲适配遵守这套生命周期，避免重新实现另一套突然卸载逻辑。
- P14-H 只改变第36枚 ECHO 的运动与显隐；它不是第36首原曲，不进入35首目录或 MaterialNFT 铸造列表。
- 所有播放器需要互斥，原曲点击应停止先前曲目，切走应按既有规则清理。共享 PlayerProvider 接线由总控一次完成，不能由三条线各新增全局 Audio 实例。
- 首页导航：P15 删除旧 echo 状态链接；P17 交付“曲目”入口要求；总控在 P15 结果上加入指向 `/tracks` 的链接，保留“艺术家”。
- 初始首页不抢焦点；保留用户主动 Tab 的可见焦点。第36圆隐藏期间不保留幽灵命中区，聚焦/播放时的可用性由 H 合同保证。

## 7. 建议默认值与尚需输入

已确认：35首原曲、OP/ETH双链目标、SEMI清单和网页地址一致、第36圆直径2倍、界面称谓、布局与退场体验修复。

可自动采用的候选：曲目馆安静目录式布局；手记网站后补；分享文案“邀请回应”方向；H 的随机参数采用样板范围。这些可逆视觉/文案选择交晨间验收，不要求夜间逐项确认。

不能代填：原曲留存接收钱包、主网总费用上限、用户实际签名、缺失的素材权利、SEMI 所需外部权限。先从已有明确记录核验；无证据时只关闭受影响的外部动作。

35 首原曲的新增发行限制（例如每地址终身一次、转出不重置）不属于本轮已经确认的需求，不能作为默认值固化进不可变合约，也不能反向默认为无限发行。P17 将待确认政策与订单防重放等必要安全机制分开；缺政策只暂停依赖它的实现/生产启用，不阻断目录、试听和清单。

ETH 原曲超出目前 ARCH/STACK 的 ETH Score-only 约定。P17 输出精确扩展条目，由总控在明确包含该架构扩展的实施指令下同步；本轮计划编写不直接修改架构。
