# Track B — 原生 `/score/[id]` 作品水塘

> **目标**：把已批准的唱片 ↔ 日食沙盒迁入生产 Score；永久 metadata 提供输入，路由级 Web Audio 与隔离的 P9 会话负责重演。
> **前置**：Track A 目验通过，并已取得明确授权将 v3 结论同步到 `docs/ARCHITECTURE.md`。

---

## B0｜架构同步门

### 为什么必须先停

当前架构仍冻结“Score 使用 React/CSS + Web Audio，不加载首页 WebGL”。v3 改为复用生产 PondGL，属于正式运行时边界变化，不得只靠 playbook 偷渡。

### 完成标准

- 用户明确批准修改 `docs/ARCHITECTURE.md`。
- 架构写明：同一 PondGL 能力、Score 单节点、唱片 ↔ 日食状态、永久输入、P9 路由隔离、移动 capability 降级与无 WebGL fallback。
- 首页仍只加载自己的 35 节点数据；Score 模块不进入首页首包。
- 不新增依赖、Canvas 树或第二个 P9 注册表。

未完成 B0 不修改生产 `app/score/[id]/`。

---

## B1｜数据真值与类型收束

### 📦 范围

- `src/data/score-source.ts`
- `src/data/score-fallback.ts`
- 新增 `src/data/score-metadata.ts`
- `src/types/jam.ts`（只补共享类型）

### 判别联合

```ts
type ScorePageData =
  | ScoreReadyData
  | ScoreProcessingData
  | ScoreFailedData;

type ScorePlaybackManifest = {
  permanentDecoderUrl: string;
  eventsRef: string;
  baseAudioRef: string;
  soundsMapRef: string;
};
```

- `ready`：`source: 'database' | 'chain'`、作品身份、永久 manifest、公开凭证与可选创作者/持有人。
- `processing`：queue UUID、真实 active status、标题、创建时间和已存在的链上字段。
- `failed`：queue UUID、公开安全错误分类；不把 `last_error` 原文暴露给访客。
- 路由不存在返回 `null`；不把数据库抖动伪装成 404。

### 数据优先级

1. UUID：数据库定位 queue 与真实生命周期；未完成时不生成播放 manifest。
2. 数字 Token + DB 正常：数据库定位创作者与凭证，从 `metadata_ar_tx_id` 读取永久 metadata。
3. 数字 Token + DB 失败/miss：OP Mainnet `tokenURI → Arweave metadata → ownerOf`。
4. 已完成 Token 缺 metadata 或 manifest 无法验证：保留链上身份、分享与故障出口，不用当前环境拼替代资源。

### manifest 校验

- tx id 使用现有 43 位 Arweave 规则；两个既有网关有界重试。
- JSON 限制 128KiB；`animation_url` 只接受允许的 Arweave URL。
- `events/base/sounds` 三项逐一验证后才生成 manifest。
- 保留原始永久 Decoder URL 供用户主动打开，但站内不执行其中脚本。
- 事件数、按键、时间戳与 sounds map 都从真实永久文件读取，不写死 35 或 26。

### 凭证字段

- Score 合约、Token ID、当前持有人 `ownerOf`、创作者、mint tx、setURI tx、tokenURI。
- metadata、events、base、sounds 与永久 Decoder 的完整引用。
- `created_at` 只叫创建时间；缺失事件数或确认时间使用 `null`，不写假 0 或 Unix epoch。

### 验收

- DB 与链上路径对同一 Token 得到相同 manifest。
- `ownerOf` 只进入 `currentHolder`，不进入 creator。
- 每个账本字段都有来源、完整复制值与缺失策略。
- `bash scripts/verify.sh` 通过。

---

## B2｜路由级 Web Audio 与 P9 会话

### 📦 范围

- `src/features/score-playback/types.ts`
- `src/features/score-playback/sounds-map.ts`
- `src/features/score-playback/engine.ts`
- `src/features/score-playback/use-score-playback.ts`
- `src/features/score-playback/score-p9-session.ts`

目录保持最多 8 个文件；此内核不进入全局 `PlayerProvider`。

### 状态合同

```text
loading → ready → playing ↔ paused → ended
   └──────────────────────────────→ error
```

- snapshot：`state / positionMs / durationMs / activeKeys / errorMessage`。
- API：`load / play / pause / toggle / replay / destroy`；本期无 seek、局部循环或自动播放。
- 首次播放必须来自用户手势；不绕过浏览器 autoplay 规则。
- 唱片/日食只消费状态，不自行监听键盘、不自行建立 AudioContext。

### 播放与 P9 语义

1. 从 manifest 读取 events、底曲与 sounds map，并兼容永久 Decoder 已接受的旧/v1/v2 格式。
2. Web Audio 时钟同时驱动底曲、事件音效、进度、activeKeys 与 P9 事件调度。
3. P9 使用现有注册表与共享行为家族，不复制 33 套效果定义。
4. Score session 拥有自己的事件游标、活跃 voice、临时调制、pointer 与水面输入；挂载时初始化，销毁时全部复位。
5. 连击只累积、延长、混合或让位，不从零反复重启全局闪光。
6. pause 保留音频位置与可读进度，但画面回到唱片；resume 再切日食并续播。
7. ended 等待最长余韵完成后复位唱片；replay 从零建立干净会话。

### 与全局播放器互斥

- Score 客户端边界挂载时调用现有 `PlayerProvider.stop()` 一次。
- `BottomPlayer` 在 `/score/` 不渲染。
- 离开页面不恢复旧曲；Score engine 与 P9 session 都销毁后保持静音。

### G6 / G7

- 先用 Token #1 的 `V×6` 完成单次、8次/秒压力、暂停/恢复、路由往返与最长余韵恢复。
- 确认无容量拒绝造成的不可解释缺拍、无持续内存增长、无 context loss。
- 用户明确批准代表家族后，才把其余永久 Events 按既有注册表接入同一调度器。
- “接入全部 Events”不等于制造新动画；未注册或不兼容输入必须有明确降级策略。

### 验收

- 任意时刻只有一个音频源和一个 Score P9 会话。
- pause/resume/ended/replay 的声音、进度、唱片/日食与 P9 一致。
- 快速路由往返后无幽灵声音、未决 timer、残留 pointer、重复 AudioContext 或全局能量。
- `bash scripts/verify.sh` 通过。

---

## B3｜生产作品水塘

### 📦 范围

- `app/score/[id]/page.tsx`
- `app/score/[id]/components/ScorePondScene.tsx`
- `app/score/[id]/components/ScoreRecordAnchor.tsx`
- `app/score/[id]/components/ScoreHeroOverlay.tsx`
- `app/score/[id]/components/ScoreLifecycle.tsx`
- `app/score/[id]/components/ShareActions.tsx`
- `app/score/[id]/score-page.css`

若目录将超过 8 个文件，先提出子目录规划，不挤进同层。

### ready 页面顺序

1. Hero 常驻层：返回池塘、作品标题、网络/Token/finalized 摘要与首屏分享。
2. 中央作品锚点：idle/loading/paused/ended 唱片；playing 日食。
3. 播放状态与进度：不与全局 BottomPlayer 重叠。
4. 作品注脚：底曲、真实事件数和永久重演说明。
5. `ProvenanceLedger`：创作者/当前持有人、合约、两笔交易、tokenURI、metadata、events/base/sounds、永久 Decoder。
6. 分享补充动作：系统/复制、X、微博、海报；首屏动作不因这里存在而隐藏。

### capability 合同

- 默认按 375px 单列构建：无球体、无 hover、无指针视差、无触摸拖水面；单指滚动归页面。
- `min-width` 只扩展网格和留白；`(hover: hover) and (pointer: fine)` 才开启桌面水面跟随、悬停和鼠标扰动。
- 移动端仍播放同一永久声音与 P9 动画，只去掉鼠标式输入和非必要额外粒子。
- reduced-motion 再独立降低空间运动、花瓣密度与水面精度，保留状态和短淡入。

### 分享与账本

- 分享入口在 WebGL 前的 DOM 层，WebGL 失败也可用。
- 完整哈希不塞进 Hero，但同页账本不得遗漏；短显示必须能复制完整值。
- 账本表面高不透明、对比清楚；进入阅读区时水塘降低活动，不以滚动控制播放。
- 手机账本逐行排列，不使用横向表格。

### 可访问性

- 页面只有一个 `h1`；唱片按钮有状态化 accessible name。
- 当前事件不逐个进入 live region；只播报播放/暂停/结束/错误。
- 播放、分享、复制、外链均可键盘完成，触控目标 ≥44px。
- Canvas 为装饰/演出层；核心身份、控制与凭证均有 DOM 等价物。

### Stop B3

先完成 `/score/1` 与第二枚真实历史 Token，在 375/390/768/1024/1440 目验；未通过不进入旧路径清理或 `/me`。

---

## B4｜生命周期、故障与 WebGL fallback

| Queue 状态 | 用户文案 | 页面能力 |
|---|---|---|
| `pending` | 已进入作品制作队列 | 查看身份与创建时间 |
| `uploading_events` | 正在保存演奏动作 | 等待、刷新、返回池塘 |
| `minting_onchain` | 正在写入 OP Mainnet | 若已有 mint tx 则展示 |
| `uploading_metadata` | 正在装配永久作品 | 展示 Token（若已有） |
| `setting_uri` | 正在绑定永久播放器 | 展示 Token 与 metadata |
| `success` | 永久作品已完成 | 完整播放、演出、分享与凭证 |
| `failed` | 作品制作没有完成 | 安全说明与既有恢复入口 |

- processing 不展示伪百分比，不擅自增加轮询。
- DB 降级但链上成功仍可播放，使用 `EditionStamp(degraded)` 说明来源。
- 音频错误保留唱片、身份、分享与凭证，并提供重试和永久播放器。
- WebGL 不可用/context lost 时切静态唱片背景；不白屏、不阻断音频与阅读。
- 低性能门降低 DPR/FBO/花瓣与 pointer work，不修改永久时间线。

### 📦 范围

- `app/score/[id]/FallbackShell.tsx`
- `app/score/[id]/loading.tsx`
- `app/score/[id]/components/ScoreLifecycle.tsx`
- Score scene 的既有自动降级接线

### 验收

- 七个 queue 状态、not-found、metadata 错误、单/双网关故障、无 WebGL 与 context lost 均有证据。
- loading 与最终 Hero 尺寸接近，不显著跳动。
- 所有降级路径仍可分享与打开永久 Decoder。
- `bash scripts/verify.sh` 通过。

---

## B5｜旧路径清理与站外视觉

1. 用 `rg` 审计旧 `ScorePlayer`、事件 API、数据源和 Decoder iframe 的全部消费者。
2. 新页面通过后才删除无消费者的旧文件；事件 API 是否删除以真实引用决定。
3. 永久 Decoder 与 P10 postMessage 规范继续服务站外消费者。
4. OG/海报采用“静态唱片浮于夜塘”的单帧表达，不尝试渲染 WebGL 或伪造播放状态。
5. canonical 已铸链接只用 `/score/<tokenId>`；processing UUID 不宣传为永久链接。

### Track B 完成条件

- 页面无 iframe、无双播放器、无第二棵 PondGL。
- 桌面可探索；手机无鼠标式动画但可完整播放和观看 P9。
- Token #1/第二枚历史 Token、DB 降级、七个 queue 状态与 WebGL fallback 通过。
- 站内请求与 metadata 的 events/base/sounds 逐字一致。
- 完整凭证同页可复制，永久 Decoder 可独立播放。
- 完整验证通过；更新状态后停在 P11-C。
