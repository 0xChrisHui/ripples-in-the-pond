# Phase 12 — Track A：音效可扩展性设置（主网前永久性冻结项）

> **来源**：2026-07-11 会话拍板（音效可增/可换架构裁决 + 解码器托管方案 A）。
> **定位**：Phase 12 = OP Mainnet 上线准备与部署。本文件是 P12 第一个 track（`-a`）。
> P12 完整 playbook 已同日建齐（2026-07-11）：`00-overview.md` + `20-b`~`50-e`，总览见 overview。
> **时机**：与 P8/P9/P10/P11 零文件冲突，可在任何时间提前施工；
> 硬 deadline = **主网开放公开铸造之前必须完成**（原因见 §1 永久性）。

---

## 0. 背景与架构裁决（为什么"可增"天生成立）

每枚 ScoreNFT 铸造时，cron 把四个 Arweave 地址逐个钉死进该 NFT 的永久 metadata
（`app/api/cron/process-score-queue/steps-upload.ts:111`）：

```
animation_url = https://arweave.net/<SCORE_DECODER_AR_TX_ID>   ← 解码器版本
              ?events=ar://<本次录制事件>                       ← 事件
              &base=ar://<底曲>                                ← 底曲
              &sounds=ar://<SOUNDS_MAP_AR_TX_ID>               ← 音效表版本
```

metadata 上 Arweave 不可改 + 合约 `_uriSet` 只许写一次 → **已铸 NFT 是完整自洽的永久快照**。
未来增加/更换音效 = 出新音效表（新 txid）+ 改 env，老 NFT 指旧表分毫不动。
**合约零改动**：音效全在链下，合约不感知数量，26 → 50 → 更多都不碰链上。

**已拍板（2026-07-11 用户）**：解码器托管走 **方案 A** —— 继续钉死 Arweave（最永久、最去中心化），
放弃方案 B（自有域名可热修）。推论：解码器逐 NFT 冻结、发射后对老 NFT 不可修 →
**主网前必须把解码器质量与格式一次锁死**，这是本 track 的核心。

## 1. 三条永久性（本 track 存在的全部理由）

| # | 永久物 | 主网开铸后还能改吗 |
|---|---|---|
| 1 | 解码器（每枚 NFT 钉自己那版） | ❌ 老 NFT 永远用铸造时版本 |
| 2 | 音效 id ↔ 音频的绑定（被任何已铸 NFT 引用后） | ❌ 按 §4 规则冻结 |
| 3 | 事件里的 key 字面量（a-z，随 events JSON 永久上链） | ❌ 但守住 §4-3 即无害 |

## 2. 步骤总览

| 步骤 | 内容 | 性质 | 前置 |
|---|---|---|---|
| A1 | 解码器数量无关化 + 音效表 v2 兼容 + 重传 Arweave | 代码，现在可做 | 停点 A-0 |
| A2 | 音效表 v2 格式 + `upload-sounds.ts` 升级 | 代码，现在可做 | 停点 A-0 |
| A3 | 音效永久性规则落盘（§4 + JOURNAL） | 文档 | 停点 A-0 |
| A4 | 换血 26 音效 runbook（用户近期计划） | 运营，素材 gated | A1+A2 + 新音频到位 |
| A5 | 输入键 ↔ 音效 id 解耦 | **登记挂 P15**，本 track 不做 | — |
| A6 | 站内播放器按 NFT 忠实播放 | **条件触发登记**，默认不做 | — |

## 3. 分步细则

### A1 解码器数量无关化（`src/score-decoder/index.html`）

改动点（全部数据驱动化，不留任何"26"假设）：
- `.keys` 网格 `grid-template-columns: repeat(13, 1fr)`（:34）→ 按实际音效数自适应
  （CSS `repeat(auto-fit, minmax(...))` 或 JS 按数量算列数；50+ 时布局仍可读）
- `"Decoding 26 sound effects..."`（:226 附近）→ 用 `soundEntries.length` 实际数量
- 音效表解析升级为三格式兼容：
  `{id: txid}`（v1 平铺）/ `{id: {txId}}`（现有对象式）/ **v2 `{version, sounds: {id: {txId, name}}}`**
  —— 判别：`raw.version && raw.sounds` 则取 `raw.sounds`，否则整个 raw 当映射（向后兼容）
- 不变红线：零依赖单文件 vanilla JS / 深色 / `ARWEAVE_GATEWAYS` 两网关 fallback / demo 模式保留
- 上传：`npx tsx scripts/arweave/upload-decoder.ts` → 新 txid →
  `.env.local` + Vercel 三环境 `SCORE_DECODER_AR_TX_ID`（`npm run env-sync`）
- **老 NFT 一律不迁移不修复**（钉旧版是 by design，不是遗留问题）

**验证**（三组参数逐一过）：
1. 拿一枚现存测试网 NFT 的 animation_url，把 decoder txid 换成新版 → 旧格式参数播放正常
2. 用 v2 音效表 txid 拼参数 → 播放正常、key 显示正常
3. 无参数 demo 模式正常
顺序：本地 `file://` 双击先验 → 上传后等 Arweave 传播（10-15min）线上复验。

### A2 音效表 v2 格式 + 上传脚本（`scripts/arweave/upload-sounds.ts`）

```json
{ "version": 2, "sounds": { "a": { "txId": "...", "name": "Kick" } } }
```
- 脚本输出 v2 结构；`data/sounds-ar-map.json` 本地索引同步升级
- ⚠ **必修（Codex P0，已代码核实）**：现脚本按 key 查重、已存在即 skip（`upload-sounds.ts:53`）——
  换血时新 mp3 仍叫 a-z 会**全部被跳过、静默产出旧表**。升级为强制换血模式
  （`--force` / 独立输入输出目录 / 按内容 hash 检测变化，三选一），且输出前打印每 key 新旧 txid 对照
- 顺手升级 `scripts/vercel-env-sync.ts`：比对白名单加 server-only 关键 env
  （`SCORE_DECODER_AR_TX_ID` / `SOUNDS_MAP_AR_TX_ID`）——现只比 `NEXT_PUBLIC_*`（:71），
  而这两个恰是"钉进每枚 NFT 的永久值"，属盲区（Codex P1）
- 命名空间对齐：表内 id ≡ DB `sounds.key`（`src/types/jam.ts:15` 已有 id/name/key/category 字段，地基现成）
- **生成新表 ≠ 立即切换**：env `SOUNDS_MAP_AR_TX_ID` 的切换统一放 A4 时机执行

### A3 永久性规则落盘

§4 规则经停点 A-0 拍板后：本文件为权威 + `docs/JOURNAL.md` 记一条决策（含"方案 A"拍板）。

### A4 换血 26 音效 runbook（素材 gated，等艺术家新音频）

> 排期注：宜在 **P9 按键动画手感调优之前**完成（动画配声音性格）。素材若赶不上主网排期，
> 可拍板**放弃换血窗口**（现 26 音冻结为创世版，规则 5 随之关闭）——**不阻塞 D 部署日**。

0. 前置：A1 新解码器已上传且 env 已切；**A2 脚本升级已完成**；26 个新音频命名对齐 a-z
1. 上传 26 新 mp3 + 生成 v2 音效表：用 A2 升级后的**强制换血模式**（旧脚本会全 skip 钉旧音）
   → **逐条 diff 新旧 txid、确认 26 个全部变化**后再上传 map → 新 `SOUNDS_MAP_AR_TX_ID`
2. env 切换：`.env.local` + Vercel 三环境 + redeploy → **此后新铸 NFT 钉新表**；
   ⚠ 该 env 是 server-only，`npm run env-sync` 默认不查——务必逐环境读回确认（或先做 A2 白名单升级）
3. 站内切换：UPDATE `sounds` 表 26 行 `audio_url` → 新 Arweave 地址
   （站内链路：`useJam` → `fetchSounds()` → `/api/sounds` → `sounds.audio_url`，`src/hooks/useJam.ts:51`）
4. 验证：站内 26 键播新音；**测试网**铸一枚 → animation_url 播新音；开一枚老 NFT 的 animation_url 播旧音不变
5. 已知取舍（明示）：测试网老 NFT 的**站内**回放会变成新音（分叉），接受——测试网藏品无承诺；
   主网从第一枚起即新音，无分叉

### A5 输入键 ↔ 音效 id 解耦（登记挂 P15，本 track 不做）

- 现状耦合：`KeyEvent.key`（`src/types/jam.ts:32`）= 键盘键 = 音效身份；
  输入层只认单字母 a-z（`SvgAnimationLayer.tsx:33`）→ 26 字母墙
- P15 扩 50 时需要：键盘键→音效 id 映射层（录制写入 id）+ 新输入方案（26 键装不下 50）
- **为什么主网前不做**：事件逐 NFT 钉死 + §4 规则已消除永久性风险（老事件 a-z 永远有效）；
  主网前不动录制主链路 = 少一分上线风险。
  （2026-07-11 评估修正：此前会话曾倾向"现在做"，按永久性重新裁决改为挂 P15）

### A6 站内按 NFT 忠实播放（条件触发登记，默认不做）

- 只要 §4 守住（id 不可变 + 站内音频只增不删），站内回放老唱片**自动忠实**，无需按 NFT 加载音效表
- 触发条件：未来若想破例"原地换音"（同 id 换音频）→ 必须先做本项
  （铸造时把 sounds_map_tx_id 落 DB 列 + 播放器按行加载），否则站内/市场声音分叉
- 默认不做，仅登记

## 4. 音效永久性规则（停点 A-0 拍板对象）

1. **id 永久**：音效 id 一旦被任何已铸 NFT 的音效表引用，永远指同一段音频；不得改指/删除/复用
2. **只增不改**：任何变更 = 出新表新 txid + 改 env；绝无"原地更新"（Arweave 也做不到）
3. **a-z 保留**：首批 26 个 id（a-z）永久保留；扩容（P15 26→50）新音效一律用新 id
4. **站内同源**：DB `sounds.key` 与音效表 id 同一命名空间；站内音频源**只增不删**
   （老 id 的音频永远可播 → 站内回放老唱片不掉音）
5. **换血窗口**：a-z 的音频绑定在**主网开放铸造前**允许最后一次整体换血（= A4）；开铸后按规则 1 冻结

## 5. 停点

| 停点 | 时机 | 需要用户做什么 |
|---|---|---|
| 🛑 A-0 | 开工前 | 拍板 §4 规则包（尤其规则 5 换血窗口）；确认 A5/A6 维持挂起 |
| 🛑 A-1 | A1 完成后 | 浏览器验收新解码器（§3-A1 三组参数）+ 视觉 OK——**这版要用很多年** |
| 🛑 A-2 | 新音频素材到位 | 执行 A4 runbook；站内 + 测试网端到端验收 |

## 6. 完成标准（Definition of Done）

- `SCORE_DECODER_AR_TX_ID` / `SOUNDS_MAP_AR_TX_ID` 均为定稿版本且三环境一致
- 新解码器三组参数验证通过；测试网新铸一枚端到端播放正常
- §4 规则进 JOURNAL；verify.sh 全绿
- **主网开铸 gate**：本 track 完成是 P12 开放公开铸造的前置条件之一
  （与 P10 停点 4 合约决策 gate——ERC2981/供应上限/可升级性——并列，都是"错过永久不可改"类）

## 7. 红线

- 不碰首页 / `pond-gl*` / 沙盒页任何文件（与 P8/P9 零冲突）
- 解码器保持零依赖单文件；本 track 预计零新包（若变，先查 `docs/STACK.md` 报批）
- 不动已部署合约、不动已铸 NFT、老 NFT 不迁移
- verify：tsc / eslint / build 全绿；解码器是独立 html 不进 Next build，靠 §3-A1 手动浏览器验证补位
