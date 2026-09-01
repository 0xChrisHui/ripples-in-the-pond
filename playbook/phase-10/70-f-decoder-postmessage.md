# Phase 10 — Track F：解码器 postMessage 控制接口

> **完成状态（2026-08-23）**：协议 v1 已随 P12-A1 实现、完成浏览器验收并上传 Arweave；
> 新 Decoder txid `NMCj...Zmb0` 已切入三环境，主网 ScoreNFT tokenId 1 真实播放通过。

> **来源**：2026-07-11 P13（Semi 生态合作）需求会话。Semi NFT 详情页要做"全局播放器 + 底部
> 迷你条（播放/暂停、×、进度）"，迷你条隔着 iframe 控制我方解码器，唯一正规途径 =
> postMessage 消息桥。现解码器只有内部 `togglePlay()`（`src/score-decoder/index.html:318`），
> 无任何对外接口。
>
> **为什么进 P10 而不是等 P12**：解码器版本逐 NFT 永久钉死进 `animation_url`
> （见 `../phase-12/10-a-sound-extensibility.md` §1 永久性），**主网开铸后铸出的 NFT
> 用哪版就永远是哪版**。主网部署在即 → 本接口必须赶在开铸前进入解码器，否则主网 NFT
> 永远不支持外部控制。
>
> **与 P12-A1 的关系**：同一个文件（`src/score-decoder/index.html`）。推荐与 A1
> （数量无关化 + 音效表 v2 兼容）**同批实施、一次重传 Arweave**；若排期错开也允许各自
> 重传（只有最终 txid 会上主网，中间版本无成本残留）。
>
> **对外契约**：Phase 13 的 Semi PRD 目前是 `references/phase-13-drafts/` 下的本地草稿，
> 不进入版本控制；**规范权威始终是本文件 D-F1**，正式发送前再从这里同步对外拷贝。
>
> **核心交付物**：解码器新版（含协议 v1）上传 Arweave + `SCORE_DECODER_AR_TX_ID` 三环境切换。
> **预估工时**：0.5-1 天。

---

## 冻结决策

### D-F1 — 协议 v1（🛑 停点 F-0 拍板对象；开铸后即长期契约）

**入站命令（父页 → 解码器）**：

```js
{ source: 'ripples-parent', type: 'play' | 'pause' | 'toggle' }
```

- `source !== 'ripples-parent'` 或未知 `type` → 一律静默忽略
- `ready` 之前收到的命令一律忽略（不排队）—— 父页职责是等 ready
- **不校验 origin**：嵌入方控制的是自己页面里的 iframe，命令无危害面；校验反而
  把未来合作方挡在门外
- v1 **无 seek / 音量**（Semi 迷你条不需要；未来加 = v2 扩展，老 NFT 不支持是 by design）

**出站事件（解码器 → 父页）**：公共字段 `{ source: 'ripples-decoder', v: 1 }`，
仅在被嵌入时发送（`window.parent !== window`），`targetOrigin '*'`（事件无敏感数据）：

| type | 附加字段 | 时机 |
|---|---|---|
| `ready` | `durationMs` | 音频资源全部加载完、▶ 可点时发一次 |
| `state` | `playing: boolean, positionMs, durationMs` | 任何播放状态变化立即发；播放中每 250ms 节流发 |
| `ended` | — | 底曲播放自然结束 |
| `error` | `message: string` | 资源加载失败 / 播放失败（含 autoplay 被拦截、AudioContext resume 失败） |

### D-F2 — 手势前提明示（不做 autoplay 魔法）

设计前提：首次播放由用户在 iframe 内点 ▶（或父页在自身手势 + `allow="autoplay"` 委托下发
`play`）。解码器对 `play` 的实现 = 调用与按钮相同的路径；若 AudioContext 被浏览器拦 →
发 `error` + `state(playing:false)`，**不重试不绕过**。父页 UI 按 state 事件如实显示。

### D-F3 — 状态事件是唯一真相源

用户在 iframe 内自行点按钮、命令触发、自然播完 —— 全部收敛到同一个 emit 路径。
父页迷你条**只**信 `state` 事件，不自行推演状态 → 永不失同步。

### D-F4 — 零依赖红线不变

单文件 vanilla JS / 深色主题 / `ARWEAVE_GATEWAYS` 双网关 fallback / demo 模式（无参数）
全部保留；demo 模式同样支持协议（便于合作方开发期直接拿 decoder 裸 URL 调试消息桥）。
无参数直开（OpenSea 等不发消息的环境）行为与现在完全一致 —— 协议纯增量。

---

## 📦 范围

- `src/score-decoder/index.html`（唯一代码改动；独立 HTML，不进 Next build）
- 上传：`npx tsx scripts/arweave/upload-decoder.ts` → 新 txid
- env：`.env.local` + Vercel 三环境 `SCORE_DECODER_AR_TX_ID`（`npm run env-sync` 核对）
- **零 Next.js / 合约 / DB 改动**；老 NFT 一律不迁移（钉旧版是 by design）

## 做什么

1. **message listener**：`window.addEventListener('message', ...)`，按 D-F1 过滤 →
   `play` / `pause` 映射到现有播放/暂停内部路径，`toggle` 复用 `togglePlay()`
2. **emit helper**：`emit(type, payload)` —— 内部判 `window.parent !== window`，
   统一挂公共字段；接点：资源加载完成处发 `ready`、播放状态每次翻转处发 `state`、
   进度 tick（已有进度条更新循环，250ms 节流）发 `state`、底曲 `onended` 发 `ended`、
   现有错误分支发 `error`
3. **测试父页**：scratchpad 写一个临时 `test-parent.html`（iframe 嵌本地 decoder +
   三个按钮 + 事件日志区），仅本地验证用，**不入库**

## 验证标准

- [ ] 本地 `file://` 直开（不嵌入）：行为与现版完全一致，控制台无消息报错
- [ ] 测试父页：play / pause / toggle 三命令生效；ready/state/ended 事件收到且字段齐全；
      state 进度与 iframe 内进度条一致
- [ ] iframe 内手点 ▶/⏸ → 父页收到 state 同步（D-F3）
- [ ] `ready` 前发命令 → 被忽略无异常
- [ ] `sandbox="allow-scripts"` + `allow="autoplay"` 组合下命令/事件均通（Semi 实际嵌入姿势）
- [ ] demo 模式（无参数）协议同样可用
- [ ] 上传 Arweave 后（等 10-15min 传播）：拿一枚现存测试网 NFT 的 animation_url 换新
      decoder txid 线上复验播放 + 协议
- [ ] 若与 P12-A1 同批：A1 的三组参数验证（旧格式 / v2 音效表 / demo）一并过
- [ ] env 三环境切换后 `npm run env-sync` 无差异告警

## 停点

| 停点 | 时机 | 需要用户做什么 |
|---|---|---|
| 🛑 F-0 | 开工前 | 拍板 D-F1 协议 v1（字段/事件集）—— 开铸后已铸 NFT 永远只会说这版协议 |
| 🛑 F-1 | 上传前 | 浏览器验收：测试父页全功能过一遍 + 直开无回归 |

## 红线

- 不动录制主链路 / 首页 / `pond-gl*` 沙盒任何文件
- 解码器保持零依赖单文件；本 track 零新包
- 不动已部署合约、不动已铸 NFT
- 协议改动必须同步本地 `references/phase-13-drafts/20-semi-prd2-global-miniplayer.md` 的附录 A（对外拷贝）

## 参考

- `src/score-decoder/index.html:318`（togglePlay 现状）
- `../phase-12/10-a-sound-extensibility.md`（解码器永久性 + A1 重写计划，同批重传的搭档）
- 本地 `references/phase-13-drafts/20-semi-prd2-global-miniplayer.md` §3 + 附录 A（Semi 侧消费方视角）
- 本地 `references/phase-13-drafts/10-semi-prd1-detail-player.md`（PRD 1：详情弹窗内播放，会话入口）
