import type { SemiPackage } from './types';

export function renderReadme(output: SemiPackage): string {
  const { inventory, contracts, assets } = output;
  const deployments = inventory.tracks.flatMap((track) => track.deployments);
  const count = (status: string) => deployments.filter((item) => item.status === status).length;
  const sampleCount = inventory.collections.reduce((count, item) => count + item.sampleAssets.length, 0);
  const archived = deployments.filter((item) => item.archiveMint.state === 'confirmed').length;
  const finalNotes = inventory.tracks.filter((track) => track.notes.status === 'final').length;
  const collectionRows = inventory.collections.map((item) =>
    `| ${item.chainId} | ${item.kind} | ${item.contractAddress} | ${item.standard} | ${item.readyExclusionReasons.length ? 'pending' : '资料 ready'} | ${item.readyExclusionReasons.join('；') || '无'} |`).join('\n');
  return `# Ripples in the Pond · SEMI 对接包

此文件由唯一注册表生成，手改会被 --check 检出。

- schemaVersion: ${inventory.schemaVersion}
- revision: ${inventory.revision}
- environment: ${inventory.environment}
- 当前范围：${inventory.tracks.length} 首真实原曲、${deployments.length} 个 trackId × chainId 记录。
- 状态：ready ${count('ready')} / unverified ${count('unverified')} / undeployed ${count('undeployed')}。
- 可导入的生产系列：${contracts.collections.length}；ready 原曲：${assets.originals.length}；已确认归档：${archived}/${deployments.length}。
- 最终创作手记：${finalNotes}/${inventory.tracks.length}；同样从唯一注册表生成。

这是资料包。SEMI 当前版本、账号、网络支持和钱包内播放尚未核验；生产资料完整性与 wallet_verified 分别验收。pending 原曲不进入 ready 表。${archived === deployments.length && archived > 0 ? '两链留存已完成' : '两链留存未完成'}；归档历史状态不是当前授权、接收钱包或素材缺失的判定依据。

## 文件与导入

1. [catalog-inventory.json](catalog-inventory.json)：完整原曲与系列盘点。每个发行的 readyExclusionReasons 说明缺项，archiveMint 单独记录留存事实。
2. [contracts.ready.json](contracts.ready.json)：已验证生产系列白名单，键为 chainId + contractAddress。
3. [assets.ready.json](assets.ready.json)：单 Token 原曲映射与动态系列发现规则，键另含 tokenId + standard。

只导入 ready 表；空列表表示当前没有证据充分的生产范围，不得把 inventory 当成已上线白名单。动态 Score/Echo 按 current_holder_index 发现后续 Token，sampleAssets 仅作样例，不限制 Token 范围；本版有${sampleCount}个同源样例，不猜扫描起始区块。停用/历史测试系列不进入生产 ready。

| chainId | kind | registry 合约 | 标准 | 资料状态 | 同源排除原因 |
|---|---|---|---|---|---|
${collectionRows}

本版注册表未列出的系列没有可消费坐标，应由注册表所有者随真实证据交付；禁止从历史文件另抄地址补入。已列系列的具体范围与状态以上表及同源机器表为准。

disabled 表示当前注册表未完成或未同步本包所需证明，不表示资产未上线，也不表示 SEMI 不支持它。已有真实链、永久资源和官网播放证据交给注册表所有者复用；只有其进入同 revision 后才影响 ready 输出。

## 身份、metadata 与当前持有

- assetId 复用 standard-aware 标识 eip155:chainId/erc1155:contract/tokenId 或 erc721。
- tokenId 为十进制字符串，不能转为 JavaScript number；展示编号不推导链上 ID。
- ERC1155 调用 uri(id)、balanceOf(address,id)。URI 中 {id} 替换为无 0x、左补零至 64 位的小写十六进制。余额为0不显示持有，未知数量不默认1。
- ERC721 调用 tokenURI(tokenId)、ownerOf(tokenId)。Echo origin/sourceScore 只说明来源，不证明当前持有。
- 归档 receipt 证明当时接收；W2 真实钱包验收时刷新 owner/余额和索引。不同登录方式的接收钱包分别核对。

## 永久媒体与钱包容器

| 类型 | 实际来源/分类 | 钱包适配与能力边界 |
|---|---|---|
| 原曲 Material | metadata.animation_url 的 ar:// MP3，audio | 原生 audio MIME 分流；暂停/进度/seek 以实际容器支持为准，不当 iframe HTML |
| Score | tokenURI → metadata.animation_url，HTML Decoder + events/base/sounds | 隔离容器；只有 NFT 钉住的永久版本实证支持时才启用下述 v1 消息控制 |
| Echo | tokenURI → animation_url，HTML + v/recipe/clips + 永久 manifest | 容器内原生控件；不自动具备 Score 消息桥，也不是第36首原曲 |

保留原始 ar:// URI，由合作方现有公共网关解析器转换 HTTP 并保留路径/查询参数；不把某个单网关固定为唯一来源。失败有界重试和明确错误，200 HTML 错误页不当音频；不自动重传永久资源。audioSha256=null + legacy_verified_source 保留历史真实级别；observed hash 不冒充 canonical 承诺。官网登录/API 不应成为永久播放前提。

本地源码证明候选协议，无法证明每枚 NFT 实际永久版本。本包不声称音频已实听或永久 HTML 已在 SEMI 验证。只显示封面、外跳官网或按钮无响应不能算钱包内播放通过。

已有项目生产播放证据可按相同资源与永久版本复用，不需要为 P13 再建服务或重听35首；具体引用与缺项见本轮唯一 handoff。现有 SEMI reference 只是历史实现，不能代替当前 build/version：其 NFT 查询具有 ETH/OP、ERC721/ERC1155 和分页路径，但未传递 ERC1155 持有数量，holders 路径将 quantity 固定为1。W2必须确认当前版本已读回真实数量，不能把该默认值作为余额；历史代码也未提供足够的 audio/HTML 消息容器证据。

## Score v1 与安全边界

权威协议：[P10-F D-F1](../../../playbook/phase-10/70-f-decoder-postmessage.md)。

- 父页命令：{source:'ripples-parent',type:'play'|'pause'|'toggle'}。
- Decoder 事件：{source:'ripples-decoder',v:1,type:'ready'|'state'|'ended'|'error'}。
- ready.durationMs；state.playing/positionMs/durationMs；error.message。时长与位置单位为 ms。
- 等 ready 后发命令，以 state 更新状态；首播要用户手势，受限时提供帧内按钮/错误，不循环 autoplay。
- 比对 event.source===iframe.contentWindow、source/type/v、有限数值和字段形状；非 opaque origin 另核对实际网关最终 origin。sandbox 为 null origin 时依赖绑定窗口/会话，不全局接受 null origin。
- 从最小 allow-scripts sandbox 开始，autoplay 委托按实测决定；不默认开放同源、弹窗、顶层导航。旧帧卸载后的消息不得控制新曲。
- v1 无外部 seek/音量命令；内部拖动条不代表父页可控制。Echo 消息能力 unknown 时不显示假外部控件。
- 切曲先停旧声源；关闭迷你条暂停并销毁媒体/iframe。跨详情继续播放须保留同一实例并实测；能力未证实就保持待验。
- 不把 JWT、手机号、私钥或用户签名传入 iframe、分享 URL 或清单。

## 生成与一致性检查

在仓库根目录、使用已有依赖执行：

~~~powershell
npx --no-install tsx --test scripts/integrations/semi/export.test.ts
npx --no-install tsx scripts/integrations/semi/export.ts
npx --no-install tsx scripts/integrations/semi/export.ts --check
~~~

export 只读 [asset-registry.ts](../../../src/lib/music-catalog/asset-registry.ts)，并比对 [页面公开快照](../../../public/music-catalog/catalog.v1.json)。先校验完整输入再替换全套产物；--check 不写文件。schema、revision、页面已部署完整坐标/标准/URI/播放地址不一致或清单被手改时退出非零。

## 恢复实际接入

SEMI 提供明确外部执行授权、当前 build/version、支持网络/标准、导入格式、WebView/sandbox 策略、可用测试账号及已持有真实资产的钱包后，恢复 [W2](../../../playbook/phase-13/20-wallet-playback-acceptance.md)。在同一次会话核对导入 revision、当前持有/数量、发现分页、实际音频输出、媒体控制和错误恢复。已有相同 URI/hash/永久版本的有效证据可复用；钱包内接入证据单独产生。

本包不发送给 SEMI，不修改其参考仓库，不发交易或永久上传。版本更新从总控交付的完整 C1/C2 SHA 消费，再生成和比对；不能读取另线正在修改的目录。未改变的永久引用继续适用，发生 revision_drift 时暂停对应接入声明。
`;
}
