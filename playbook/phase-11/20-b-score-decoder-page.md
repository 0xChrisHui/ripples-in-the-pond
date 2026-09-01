# Track B — `/score/[id]` Decoder-first 唱片页

> **目标**：取消“旧详情页中再嵌一个小播放页”的双层结构，让该 NFT 元数据中永久钉住的 Score Decoder 成为页面主体，并把站内导航、身份、链上凭证和分享整合为同一张唱片页。
> **视觉锚点**：用户提供的截图及 `src/score-decoder/index.html`。
> **最高优先级**：历史作品必须继续使用铸造时写入元数据的原始 `animation_url`。

---

## B0｜架构同步门（强制停点）

当前 `docs/ARCHITECTURE.md` 的“公开回放页”仍规定：站内主路径使用 inline `ScorePlayer`，Decoder 只服务 OpenSea/降级。这与用户最新决定冲突。

### 执行规则

1. 用户说“继续，并同步架构”后，才可先更新架构对应章节。
2. 只改公开回放职责，不借机调整钱包、数据库、队列或合约架构。
3. 架构同步完成、验证通过并得到用户继续指令后，才进入 B1。

### 新职责边界

```text
/score/[id]
├─ 站内原生层：返回导航、作品身份、生命周期、链上凭证、分享
└─ 永久 Decoder：作品视觉、事件重放、底曲、播放状态

NFT metadata.animation_url
└─ 指向该枚 NFT 铸造时钉住的 Decoder + events/base/sounds 参数
```

---

## B1｜建立作品真值，不重建永久 URL

### 为什么先做数据

`process-score-queue/steps-upload.ts` 已把完整 `animation_url` 写入每枚 NFT 的永久元数据。若页面用当前环境变量重新拼 URL，旧 NFT 会被悄悄切到新版 Decoder，破坏永久性。

### 📦 范围

- `src/data/score-source.ts`
- `src/data/score-fallback.ts`
- `src/types/jam.ts`（仅已有类型确实缺字段时）
- 可新增 `src/data/score-metadata.ts`

### 数据优先级

1. **数据库可用且已有 `metadata_ar_tx_id`**：读取 `ar://<metadata_ar_tx_id>` 对应 JSON，使用其中原样的 `animation_url`。
2. **数据库不可用且 id 是 Token ID**：从 OP Mainnet 读取 `tokenURI`，再读取永久元数据，使用原样 `animation_url`。
3. **UUID 尚未铸造或尚未上传元数据**：显示真实生命周期状态，不生成假的 Decoder URL。

### 页面数据契约

| 字段 | 准确含义 | 缺失策略 |
|---|---|---|
| `tokenId` | ScoreNFT token id | 未铸造时明确显示“生成中” |
| `contractAddress` | ScoreNFT 合约地址 | 来自受信配置，不叫“合约哈希” |
| `mintTxHash` | 铸造交易哈希 | 未确认时隐藏该行并显示阶段 |
| `metadataArTxId` | NFT 元数据 Arweave 交易 ID | 上传前显示处理中 |
| `animationUrl` | 元数据永久钉住的 Decoder URL | 不允许自行猜测或拼新版本 |
| `creatorAddress` | 创作时的钱包地址 | 仅数据库有可靠关联时使用 |
| `currentHolder` | 当前 `ownerOf` 地址 | 降级读链时可用，不冒充作者 |
| `eventCount` | 录制事件数 | 可靠时显示，否则不填 0 |
| `mintedAt` | 铸造完成时间 | 无可靠来源时不虚构 |

### 安全与正确性

- 仅接受 `https://arweave.net/` 或项目已允许的永久网关。
- 继续使用现有超时、大小限制和 JSON 校验约定。
- 元数据读取失败返回可诊断状态，不把任意远程 URL塞进 iframe。
- 不改 NFT 合约、数据库 schema、cron 状态机或已上传元数据。

### 验收

- 数据库主路径和链上降级路径对同一 Token 得到同一个永久 URL。
- 旧 Token 的 URL 不因当前 Decoder 配置改变。
- `ownerOf` 结果只标为“当前持有人”。
- `bash scripts/verify.sh` 通过。

---

## B2｜永久 Decoder 成为页面主体

### 📦 范围

- `app/score/[id]/page.tsx`
- `app/score/[id]/components/ScoreDecoderFrame.tsx`（新建）
- `app/score/[id]/score-page.css`（新建）
- `src/components/player/PlayerProvider.tsx`（仅补安全的页面互斥能力）
- `src/components/player/BottomPlayer.tsx`（仅补 `/score/[id]` 隐藏规则）

### 布局

```text
顶部原生身份条：返回池塘 / Ripples #002 / 链状态
┌──────────────────────────────────────────┐
│ 永久 Score Decoder：占据首屏和主要视觉   │
│ 作品标题、编排视觉、播放与重放均在其中    │
└──────────────────────────────────────────┘
下方原生账本：作者/持有人、合约、铸造交易、永久资源
末尾原生操作：复制链接、分享、下载海报
```

### iframe 契约

- `src` 必须是 B1 获得的原始 `animationUrl`。
- 延续已验证安全属性：`sandbox="allow-scripts"` 和 `allow="autoplay"`；若现状另有必要权限，逐项说明。
- 使用有意义的 `title`，加载前有纸面占位，失败后可重试或打开永久页。
- 桌面首屏高度不低于 720 px；移动端按 Decoder 内容高度给足空间，目标是页面滚动而不是“小窗内再滚动”。
- 不强行 `scrolling="no"` 隐藏不可达内容；先验证所有历史 Decoder 版本在 375 px 可完整操作。
- 不裁掉 Decoder 标题、播放按钮或底部状态。

### postMessage

沿用 P10 已冻结的 v1 协议：`ready/state/ended/error`，命令仅 `play/pause/toggle`。

- 父页接收事件前必须校验 `event.source === iframe.contentWindow`。
- 不根据任意第三方 `postMessage` 修改站内播放器或 UI。
- 进入 Decoder 页面时暂停现有全局底曲；页面内只允许 Decoder 出声。
- 离开页面不自动恢复旧声音，避免用户未授权播放。

### 删除双层感

- 删除外层重复的大标题、事件数和地址堆叠。
- 不再使用 360 px 高的内嵌卡片和卡片内滚动条。
- `ScorePlayer` 不再是站内回放主路径。
- 不先删除事件 API；等 B5 引用审计确认无消费者。

### 验收

- 首眼看到的是 Decoder 唱片，不是外层信息壳。
- 页面只有一个音源、一个播放状态，不出现全局播放器叠在底部。
- 375、768、1440 px 均能触达 Decoder 全部内容。
- 键盘进入 iframe、播放、退出的顺序可理解。
- `bash scripts/verify.sh` 通过。

---

## B3｜身份条与链上凭证账本

### 📦 范围

- `app/score/[id]/components/ScoreIdentityRail.tsx`（新建）
- `app/score/[id]/components/ScoreProvenance.tsx`（新建）
- `app/score/[id]/ShareBar.tsx` → `app/score/[id]/components/ShareBar.tsx`
- `app/score/[id]/score-page.css`

> 组件进入 `components/` 子目录，避免 `app/score/[id]/` 根目录超过 8 个条目；移动 `ShareBar` 时先更新全部引用，不复制两份实现。

### 信息层级

1. **作品身份**：`Ripples #002`、完成/处理中/降级状态。
2. **创作身份**：创作者地址；只有读链降级时则显示“当前持有人”。
3. **链上凭证**：OP Mainnet、合约地址、Token ID、铸造交易哈希。
4. **永久资源**：tokenURI / 元数据 Arweave、Decoder 永久页。
5. **作品数据**：录制事件数、铸造时间；仅在有真值时出现。

### 交互

- 地址/哈希默认短显，点击复制完整值；复制后有可读状态反馈。
- 合约与交易链接到项目既有 OP Mainnet 浏览器来源。
- Decoder 链接标注“打开永久播放器”，在新标签页打开。
- 分享条只有：复制链接、分享至 X、分享至微博、下载海报。
- 分享文案使用产品名 `Ripples in the Pond`，不暴露数据库 UUID。

### 禁止

- 不把合约地址写成交易哈希。
- 不把元数据 tx id 写成 mint tx hash。
- 不在读链降级时把当前持有人写成创作者。
- 不用大面积 Web3 渐变、币价式数据卡或虚假“100% on-chain”文案。

### 验收

- 不懂链上术语的人也能区分“作品是谁”和“凭证在哪里”。
- 每个外链、复制和分享操作都有可访问名称与反馈。
- 手机端完整值不撑破页面。
- `bash scripts/verify.sh` 通过。

---

## B4｜生命周期与故障模式

### 状态矩阵

| 场景 | 页面主体 | 用户可做什么 |
|---|---|---|
| 已铸造 + 元数据可读 | Decoder + 完整凭证 | 播放、分享、复制、下载海报 |
| DB 不可用 + 链上可读 | Decoder + “链上直读”提示 | 正常播放和访问永久资源 |
| UUID 处理中 | 原生压片进度页 | 查看真实阶段、稍后刷新、返回池塘 |
| Token 不存在 | 作品不存在页 | 返回池塘 |
| 元数据暂不可读 | 凭证与故障说明 | 重试、打开 tokenURI（若安全可用） |
| Decoder 加载失败 | 仍保留身份与凭证 | 重试、打开永久播放器 |

### 📦 范围

- `app/score/[id]/FallbackShell.tsx`
- `app/score/[id]/loading.tsx`
- 可新增 `app/score/[id]/components/ScoreLifecycleStage.tsx`
- `app/score/[id]/score-page.css`

### 文案规则

- “链上直读”是韧性说明，不是红色错误。
- “作品仍在压片”必须来自真实队列阶段，不展示伪进度百分比。
- 错误说明给出下一步，不显示堆栈、内部表名或密钥。
- 不用 mock 数据填满骨架。

### 验收

- 六种状态均可通过真实夹具或受控测试路径验证。
- JavaScript 关闭时仍能看到作品身份和错误出口。
- 加载态与最终布局高度接近，避免首屏大跳动。
- `bash scripts/verify.sh` 通过。

---

## B5｜退役旧播放路径与统一分享视觉

### 📦 范围

- `app/score/[id]/ScorePlayer.tsx`（确认无引用后删除）
- `src/data/score-events-source.ts`（只在确认无其他消费者后处理）
- `app/api/scores/[id]/events/route.ts`（只在确认无其他消费者后处理）
- `app/score/[id]/opengraph-image.tsx`
- `app/score/[id]/poster/route.tsx`
- 相关测试与文档

### 执行顺序

1. 用 `rg` 列出 `ScorePlayer`、事件端点和事件源全部引用。
2. 先移除页面消费者并验证，再判断代码是否真正死亡。
3. 事件端点若仍服务外部客户端或其他步骤，保留并记录原因；不为“干净”盲删。
4. OG 图与海报改用 P11 唱片语言，并显示 Token 与简短链上身份。
5. 分享链接继续落到 `/score/<tokenId>`，不直发临时数据库地址。

### Track B 浏览器验收

- `/score/1`：数据库主路径。
- `/score/2`：另一枚历史作品，验证版本兼容。
- 断开数据库后的有效 Token：链上 + Arweave 降级。
- 有效未完成 UUID：真实生命周期页。
- 不存在 Token、元数据故障、Decoder 故障。
- 375、390、768、1024、1440 px。
- 鼠标、触屏、键盘、reduced-motion。
- 播放中来回 `/` 与 `/score`：无双重声音、无幽灵恢复。

### Track B 完成条件

- Decoder 是 `/score/[id]` 唯一主播放器。
- 历史 NFT 的原始 `animation_url` 未被替换或重建。
- 身份、合约地址、铸造交易哈希和永久资源准确区分。
- 所有状态完成验收，完整验证通过。
- 更新 `STATUS.md` 后停下，等待用户目验再进入 Track C。
