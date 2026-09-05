# P14-E — 视觉共创、顺序播放器与永久体验

> **目标**：先与用户冻结会被永久 metadata 引用的视觉/声音体验，再实现站内与 Arweave Decoder。
> **前置**：P14-C 本地地基完成。
> **硬规则**：E0 是用户明确要求的共创 Gate；未拍板前不得自行完成正式视觉。

---

## E0｜🛑 视觉与声音共创 Gate

### 为什么在 D 前

P14-D 会上传不可改的 token metadata，其中 `image` 和 `animation_url` 必须指向最终媒体。E 如果在 D 后做，只能留下占位资产或重传分叉，均不接受。因此 E0/E1–E5 完成后，D 才能生成第一份真实 metadata。

### 开会前准备

执行 AI 先准备、但不代替用户拍板：

1. 用 B 的一个固定测试钱包和真实 `public/the36` 派生 recipe；禁止 mock recipe。
2. 列出 36 段的时长、响度/边界异常和按 recipe 的完整时间线。
3. 回看现有首页水塘、Score 的唱片 ↔ 日食、P9 动画语汇，明确哪些可以继承、哪些会造成重复。
4. 若当时 `frontend-design` skill 可用，正式制作页面/原型前必须读取并按该 skill 工作；若用户选择 AI 位图封面，再单独使用 `imagegen`，不能自动把位图路线当默认。
5. 准备两到三个**有明确艺术哲学差异**的方向，不做只有换色差别的伪方案。

### 必须与用户讨论的 10 项

1. 这张 NFT 是“钱包肖像”“声音护符”“36 段旅程”还是其他核心隐喻。
2. 与首页水塘的关系：同一世界延伸，还是刻意形成新的私密空间。
3. 静态封面要表达 recipe 本身、钱包身份、首枚 Score 来源，还是只表达情绪。
4. `idle / loading / playing / paused / ended / error` 六态分别看见什么。
5. 片段切换是否需要可见的 36 格、轨道、刻度、字符或完全抽象的变化。
6. 播放时的视觉驱动来自当前字符、音量包络、累计旅程还是固定时序。
7. 手机端保留哪些核心动效，桌面 fine pointer 才增加哪些探索互动。
8. reduced-motion 下保留什么状态信号，去掉什么空间运动。
9. recipe 与 provenance 信息在首屏、第二屏、展开层之间如何分配。
10. 永久 Decoder 应忠实复刻站内体验到什么程度；哪些 WebGL 效果可降级为 Canvas/CSS。

### 原型交付

### 📦 范围

- `references/visual-prototypes/` 下 P14 专属 HTML/CSS/必要静态资产
- `reviews/evidence/p14-e-prototype/`
- 不修改生产路由、全局 CSS、PondGL 或 Score 页面

每个候选必须：

- 使用同一真实 recipe、相同文案和相同 36 段音频，保证比较的是设计而不是内容。
- 同时提供 375×844 和 1440×900 的 idle/playing 关键帧。
- 能实际点击播放至少连续 4 段，观察衔接与视觉切换，不只交静态截图。
- 不依赖第三方在线素材、临时 CDN、mock 数据或自动播放。
- 标注性能等级和永久 Decoder 可复刻程度。

### E0 通过条件

用户明确说出：采用哪个方向、要改什么、封面策略、衔接方式、移动/reduced-motion边界。结论进入 JOURNAL；未通过不得进入正式页面或永久上传。

---

## E1｜顺序播放内核

### 📦 范围

- `src/features/wallet-recipe/playback/engine.ts`
- `src/features/wallet-recipe/playback/use-wallet-recipe-player.ts`
- `src/types/wallet-recipe.ts`

如果名称让 feature 目录超过 8 个条目，先按职责拆 `playback/` 子目录并报告；不要把 200 行限制靠压缩格式规避。

### 状态合同

```text
idle → loading → ready → playing ↔ paused → ended
                  └──────────────────────────→ error
```

snapshot 至少包含：

```text
state / positionMs / durationMs / currentIndex / currentKey
loadedUniqueCount / totalUniqueCount / errorKind / errorMessage
```

API：`load / play / pause / resume / replay / destroy`。本期不做随机、编辑、跳段生成新 recipe 或自动播放；是否提供 seek 由 P14-0 决定，未拍板默认不做。

### 调度

- 首次用户手势后才创建/恢复 AudioContext。
- 从 metadata/manifest 校验后的 `ar://` txid 通过现有双网关 fetch；不直接信页面 query 的任意 URL。
- 同一 key 在 recipe 重复出现只 decode 一份 AudioBuffer。
- 用 AudioContext 时钟和累计真实时长调度 36 个位置，不用 36 个 `setTimeout` 串接。
- 片段边界严格采用 P14-0/E0 已拍板的硬切/交叉淡化参数；站内和永久 Decoder 使用同一数值。
- pause 保存逻辑位置并停止已排程 source；resume 从精确位置重建剩余调度。
- ended 只触发一次；replay 清空旧 source/RAF 后从零重建。
- `destroy` 中止 fetch、source、gain、RAF/timer 并关闭或释放本路由 AudioContext。

### 资源策略

- 记录 unique key 数；36 位均匀 recipe 平均约使用 23 种片段，但必须支持 1–36 种。
- 先实测 36 个全唯一的最坏情况：压缩下载量、解码内存、首播等待、后台恢复。
- 若全量预解码超过移动 Gate，再采用有明确 look-ahead 和无缝证明的滚动预载；不得只为省内存退回 HTMLAudio 顺序播放造成可闻间隙。
- 单网关失败切备用；两个失败进入可恢复 error，保留身份/recipe/重试。

### 定向验收

- 同 key 连续三次、首尾相同 key、36 个全相同、36 个全唯一。
- 暂停点位于片段开头/中间/交界；恢复没有双声或跳回。
- 快速 play/pause/replay 20 次，无 source 泄漏和重复 ended。
- 后台 30 秒再回前台，时间策略与拍板一致且 UI/声音同步。
- 单/双网关失败、损坏 MP3、manifest hash 错、duration 不符有明确错误。
- reduced-motion 只影响视觉，不改变音频 recipe 或时长。

---

## E2｜永久 Decoder v1

### 📦 范围

- `src/wallet-recipe-decoder/index.html`
- `scripts/arweave/upload-p14-assets.ts`（复用 A 已建立的脚本，使用 `decoder` 模式）
- `reviews/evidence/p14-e-decoder/`

### 合同

- 单文件 HTML/CSS/vanilla JS、零 npm runtime、可直接从 Arweave 打开。
- query 只接受 `v=1`、合法 36 位 `recipe`、43 位 `clips` manifest txid。
- Decoder 内置 v1 算法解释和允许的字符表，但音频地址只从永久 manifest 读取。
- 双网关有界回退；禁止硬编码本地域名、数据库或当前 Vercel API。
- 用户点击后播放；显示加载数量、当前位置、暂停/恢复/重播和可读错误。
- 实现 E0 批准视觉的“永久降级版”，不伪装实现站内独有的高成本 WebGL。
- 页面明确显示 recipe 和永久资源入口，项目网站关闭后仍可理解并播放。

### 上传 Gate

1. 本地用固定测试向量完整播放。
2. HTTP 静态托管下完整播放，验证 CORS。
3. 上传 Arweave 前用户目验 Decoder 视觉和声音衔接。
4. 收到独立授权后上传一次，双网关验证 bytes/hash。
5. 冻结 `P14_DECODER_V1_TX_ID`；以后修复只能出 v2，已铸 token 不回写。

### 🛑 Stop E2-upload

这版 Decoder 会被未来所有 v1 NFT 永久引用。未经用户明确说“允许上传永久 Decoder”不得执行上传。

---

## E3｜链上数据源与详情页

### 📦 范围

- P14-0 冻结的详情路由目录
- `src/features/wallet-recipe/recipe-source.ts`
- `src/lib/chain/wallet-recipe-contract.ts`
- 页面专属 CSS/组件子目录；先检查 8 条目限制

### 数据优先级

1. 数字 tokenId → 新合约 `tokenURI / ownerOf / originWalletOf`。
2. tokenURI → 双网关 metadata → B4 严格校验。
3. DB 只补 source Score queue 的友好信息和状态，不替代永久 recipe/音频。
4. DB 故障时已铸 token 仍可完整播放；链上不存在才 404。

### 页面内容

- 首屏：返回池塘、作品名、当前持有人、静态/动态作品锚点、主播放控制。
- 播放区：当前位置、当前字符、总进度和 E0 视觉演出。
- recipe：完整 36 位、可复制、按当前位置有可访问的非纯颜色提示。
- provenance：origin wallet、首枚 Score tokenId/链接、P14 合约、tokenId、tokenURI、metadata、manifest、Decoder。
- ownership：origin 与 current owner 明确分开，转让后不把新持有人显示成创作者。
- error/fallback：WebGL/Canvas 失败仍可播放；音频失败仍可查看和复制永久证据。

页面不提供重新随机、编辑 recipe、合成下载或再次 mint。

---

## E4｜当前持有人发现入口

### 📦 范围

- 首页现有导航/入口组件的最小修改
- `/me` 对应 archive section
- `app/api/me/` 下 P14 专属只读 endpoint
- 必要类型和数据源

### 所有权查询

- 若 C 采用 ERC721Enumerable：服务端读取 `balanceOf`，按 index 有界枚举 tokenId，再批量读取 tokenURI/origin。
- 若 C 不采用 Enumerable：必须先完成可靠 Transfer 索引和 cursor 恢复，不得用 DB `origin_wallet` 冒充当前持有人。
- 地址未登录时不发私有查询；加载/空/失败分离。
- 钱包收到别人转来的 P14 NFT后应能发现；origin 转走后不再显示为“当前持有”，但可在来源记录中保留历史说明。

### 首页边界

- 首页只加轻量入口/状态，不把 36 段 player、metadata parser 或新 WebGL 打进首页首包。
- 未持有用户看到的入口文案由 P14-0 冻结，不暗示点击即可领取。
- 已 eligible 但仍 processing/failed 的 origin 可看到真实状态和恢复说明，不显示假 token 卡片。

---

## E5｜封面生成与媒体冻结

按 E0 结果执行其一：

### 共用静态封面

- 只上传一个经用户批准的 image。
- 所有 token 的独特性由 animation/recipe 表达。
- D 的 `preparing_media` 只验证冻结 image txid，不重复上传。

### 每 recipe 唯一封面

- 生成必须是 recipe 的纯函数：相同 recipe → 相同 bytes/hash。
- 不含服务器时间、随机 seed、字体网络请求或平台差异。
- 优先仓库内可验证的 SVG/Canvas 规则；若输出 PNG，固定尺寸、色彩空间和编码器版本。
- D 状态机先生成/upload image，再 metadata；失败重试不得换一张图。
- 固定测试向量的封面 hash 进入测试，防未来渲染漂移。

无论哪种：OG/分享 fallback 可静态生成，不依赖服务端 WebGL 截图。

---

## E6｜浏览器、可访问性与性能 Gate

| 状态 | 375 coarse | 390 coarse | 768 coarse | 1024 fine | 1440 fine |
|---|---:|---:|---:|---:|---:|
| 未登录入口 | ✓ | — | ✓ | — | ✓ |
| 已登录无 P14 | ✓ | — | ✓ | — | ✓ |
| processing/failed | ✓ | — | ✓ | — | ✓ |
| token idle/loading | ✓ | ✓ | ✓ | ✓ | ✓ |
| playing/paused/ended | ✓ | ✓ | ✓ | ✓ | ✓ |
| transferred ownership | ✓ | — | ✓ | — | ✓ |
| 单/双网关故障 | ✓ | — | ✓ | — | ✓ |
| reduced-motion | ✓ | — | ✓ | — | ✓ |

每格检查：

- 无自动播放、横向滚动、遮挡、重复 AudioContext、控制台错误。
- 触控目标 ≥44px；键盘可播放/暂停/复制/访问链接；焦点清晰。
- recipe 当前位不能只靠颜色表达；Canvas 有 DOM 等价状态。
- coarse pointer 不注册 hover/raycast 高频逻辑；reduced-motion 保留状态变化。
- 36 段完整播放结束一次；进度与真实总时长一致。
- 最坏 36 unique 片段的内存趋稳，离开路由后 source/RAF/fetch 归零。
- 首页构建产物不包含 player engine、36 段地址表或详情视觉 runtime。

---

## Track E 完成标准

- E0 用户批准结果、修改项和关键帧进入证据/JOURNAL。
- 站内播放器与永久 Decoder 对同 recipe 使用相同片段顺序和衔接参数。
- Decoder、clip manifest、静态媒体全部取得冻结 txid 和双网关 hash 证据。
- 当前持有人发现逻辑正确处理原始空投、转入、转出。
- 页面不依赖数据库即可从链上 + Arweave恢复已铸作品。
- 五视口、完整播放、错误矩阵、长期资源清理通过。
- `bash scripts/verify.sh` 通过；更新状态后停在 P14-D。
