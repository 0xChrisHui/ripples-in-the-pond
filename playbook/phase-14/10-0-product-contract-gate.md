# P14-0 — 产品、合约与连续施工 Gate

> **目标**：正式写代码前一次性拍板所有会改变永久内容、合约字节码或用户体验的参数。
> **本 Track 只改文档，不上传 Arweave、不部署合约、不执行 migration。**

---

## 0. 为什么必须先做

P14 同时包含三类不可逆结果：Arweave 内容、不可升级 ERC-721、上线后的钱包终身资格。任何一个参数留到施工途中再问，都会让“夜间连续执行”失效，甚至产生永久错误。因此 P14-0 不做模糊方向讨论，而是产出一份可直接成为代码输入的最终决策表。

---

## 1. 当前已知事实

- 网络只用 Optimism：测试为 OP Sepolia，生产为 OP Mainnet（chainId 10）。
- 触发者是 P14 启用后第一次成功铸造 ScoreNFT 的 origin wallet。
- 每个 origin wallet 终身最多一枚；NFT 可转让，转走不恢复资格。
- P14 上线前已有 ScoreNFT 的钱包不补发。
- recipe 为 36 位，字符表固定 `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`，允许重复。
- `public/the36` 实际有 36 个 MP3：`A–Z` 和 `0–9`；当前只确认 36/36 文件大小一致且 SHA-256 互不重复，精确时长尚未冻结。
- 不合成四分钟 MP3；作品由永久 recipe 与永久碎片重建。
- P14 使用独立 ERC-721，不修改现有 ScoreNFT 或 MintOrchestrator。
- ScoreNFT 铸造主流程不得等待或依赖 P14。
- 用户已明确要求 P14-E 的视觉效果必须共同讨论后再实施。

---

## 2. 用户决策表

下面每项必须写成一个明确最终值；“以后再说”只允许用于明确列为 Phase 外的功能，不能进入本期代码。

### G1｜产品身份

| 项目 | 需要拍板 | 建议边界 |
|---|---|---|
| UI 产品名 | NFT 系列和详情页显示名 | 使用用户可见品牌语气，不沿用已作废的 `RemixNFT` |
| 合约 `name` | 区块浏览器/市场名称 | 与 UI 名一致或明确说明差异 |
| 合约 `symbol` | 2–8 个大写字符 | 不带 Testnet、版本号或临时缩写 |
| 单枚作品命名 | 是否含序号、短钱包或 recipe 摘要 | metadata 上传前必须可在不知道 tokenId 时生成 |
| 描述文案 | collection 与 token description | 不承诺收益、稀缺升值或未实现功能 |
| 路由 | 例如 `/recipe/[id]` 的最终字面量 | 数字 tokenId 为永久公开链接；不使用 queue UUID 宣传 |

### G2｜声音与播放

| 项目 | 选项 | 默认建议 |
|---|---|---|
| 片段边界 | 硬切 / 极短等功率交叉淡化 / 按原尾音自然叠加 | 先试听后定；不要只凭波形猜 |
| 淡化长度 | 精确毫秒数 | 若采用交叉淡化，先用 30–80ms 三档实听 |
| 初次加载 | 全部唯一片段预解码 / 滚动预载 | 优先全量唯一片段，移动端以真实内存 Gate 决定是否降级 |
| 暂停恢复 | 样本级续播 / 回到当前片段起点 | 建议样本级续播 |
| 重播 | 原 recipe 从零开始 / 重新生成 | 必须原 recipe 从零开始 |
| 自动播放 | 是 / 否 | 必须否；用户手势后才创建或恢复 AudioContext |
| recipe 展示 | 完整 36 位 / 分组 / 默认收起 | 数据永远完整可复制；视觉呈现留 E0 共创 |

### G3｜封面与永久播放器

这里只冻结“数据形态”，具体审美仍留 P14-E0：

| 项目 | 需要拍板 | 对后端影响 |
|---|---|---|
| `image` | 全系列共用 / 每 recipe 生成唯一静态封面 | 唯一封面会增加每枚一次 Arweave 上传步骤 |
| `animation_url` | 静态永久 Decoder + recipe 查询参数 | 建议采用；不依赖本站或数据库 |
| 永久播放器输入 | `recipe + 全局 clip manifest txid` | 避免 metadata txid 自引用循环 |
| 图片格式 | PNG / SVG | 需确认目标市场兼容性；不能用只在本站可渲染的 Canvas 状态代替 |
| OG/分享图 | 直接使用 NFT image / 独立静态海报 | 必须不依赖 WebGL 服务端渲染 |

推荐的非循环永久结构：

```text
metadata.animation_url
  = <永久 decoder>?v=1&recipe=<36位>&clips=<全局清单 txid>

metadata 本体
  = recipe + 实际用到的 clips + originWallet + sourceScoreTokenId
```

永久 Decoder 读取全局清单；metadata 自己仍保存本 token 用到的素材子集，因此 tokenURI 单独读取也能完整恢复。

### G4｜合约能力

| 项目 | 需要拍板 | 默认建议 |
|---|---|---|
| 可升级性 | immutable / proxy | immutable，保持当前项目简单安全边界 |
| ERC-721 Enumerable | 加 / 不加 | 加；让转让后的当前持有人无需第三方索引器即可发现藏品 |
| ERC-2981 版税 | 无 / 百分比 + receiver | 默认无，与 ScoreNFT 当前策略一致 |
| burn | 允许 / 禁止 | 若允许，烧毁也不得释放 origin 资格 |
| pause | mint pause / 全转让 pause / 不做 | 默认只以应用层启用开关控制新任务，不冻结用户转让 |
| supply cap | 固定上限 / 无链上上限 | 默认无；origin 唯一性天然约束 |
| 初始接收人 | 必须等于 origin / 可指定 | 必须等于 origin；首次空投语义写进合约 |
| tokenURI | mint 时一次写死 / mint 后补写 | mint 前 metadata 已上传，建议 mint 时写死 |
| admin | 复用现有独立 admin / 新 admin | 默认复用现有独立 admin，绝不等于运营热钱包 |
| minter | 现有 operator EOA | 复用串行锁；只授新合约 `MINTER_ROLE` |
| recipe on-chain | 不存 / 存 recipeHash / 存完整 recipe | 默认不重复存；tokenURI + Arweave 是作品真值，合约只存 origin |

### G5｜资格与启用

| 项目 | 最终值 |
|---|---|
| 生产启用依据 | OP Mainnet `activationBlock`，不是服务器时间 |
| 启用前钱包来源 | 从历史成功 Score queue 生成排除基线，并与链上 `Transfer(from=0)` 对账 |
| 同钱包多个登录账号 | 规范化钱包地址合并为同一 origin |
| 大小写 | 输入接受 checksum/大小写，持久化统一小写 `0x` + 40 hex |
| 首枚认定 | ScoreNFT mint receipt 成功且 tokenId 已可靠写入；不是 URI 完成时间 |
| 启用后首次 mint 但 P14 关闭 | 是否保留资格待恢复 | 建议保留：发现器可记录任务，mint worker 由独立开关控制 |
| 历史漏数处理 | 自动补发 / 停止启用并人工核对 | 必须停止，不允许猜测资格 |

### G6｜运营与发布权限

逐项写“允许/不允许”，不能用一句“全部继续”代替：

- 是否允许上传 36 个音频和清单到 Arweave。
- 是否允许上传永久 Decoder、封面母版或封面生成结果到 Arweave。
- 是否允许在 OP Sepolia 部署合约、执行测试 migration 与发送测试交易。
- 是否允许改 Vercel Development/Preview 环境变量和 cron。
- 是否允许部署 Production 代码但保持 P14 disabled。
- 是否允许广播 OP Mainnet 合约部署。
- 是否允许在主网授予/撤销角色。
- 是否允许写入 `activationBlock` 并启用生产发现器。
- 是否允许真实首枚空投。

---

## 3. 连续施工授权包

P14-0 结束时生成一段可复制的授权文本，至少包含：

```text
本轮允许执行：<Track/Step 范围>
允许的外部写入：<Arweave / Supabase 测试环境 / OP Sepolia / Vercel 环境>
明确禁止：OP Mainnet 广播、production 启用、架构/技术栈变更（按实际拍板）
遇到临时外部故障：按 playbook 有界重试；仍失败则保留证据并停
完成边界：verify.sh + 定向 Gate 全绿，更新 STATUS/TASKS/LEARNING，等待验收
```

该授权只消除重复确认，不覆盖 `AGENTS.md` 的必停条件，也不把测试网授权扩大成主网授权。

---

## 4. 📦 范围

- `playbook/phase-14/*.md`
- `STATUS.md`
- `TASKS.md`
- `docs/JOURNAL.md`
- `docs/LEARNING.md`

禁止修改代码、合约、数据库、环境变量或永久资源。

---

## 5. 完成标准

- G1–G6 每一项有最终值和日期，未采用项写明“不做”。
- P14-E0 共创 Gate 被明确保留，视觉审美没有被默认值偷偷替代。
- 合约 name/symbol、路由、metadata 命名无需 tokenId 预知即可生成。
- 所有外部写入权限被拆分；没有笼统主网授权。
- 用户确认决策表准确后，结果追加到 `docs/JOURNAL.md`。
- `bash scripts/verify.sh` 通过。

### 🛑 Stop P14-0

用户复述并确认：触发资格、终身唯一、播放器数据形态和主网禁区。未收到“继续 P14-A”前不审计或上传永久音频。
