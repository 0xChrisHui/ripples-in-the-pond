# P14-G — 主网索引恢复、ECHO #1 水中访客与日食黑场

> **建立日期**：2026-09-12
> **状态**：G0–G6 与 G7 发布/observe/live 恢复已完成；新的 24h/7d 观察从 `2026-09-12T17:58:09.356Z` 起算，F8 尚未完成。旧 Track/MSTR 方案作废
> **进入条件**：P14 F1–F7 已完成；F8 暂停
> **唯一顺序**：`G0 → G1 → G2 → G3 → G4 → G5 → G6 → G7 → F8`

---

## 1. 为什么新增这一轨

P14 首枚主网空投成功后，生产 Score 事件源游标从约 1.567 亿异常退回低位，并以每次 500 blocks 的节奏缓慢前进。P14 发现器自身保持 fail closed，ECHO #1 没有损坏，也没有错误空投；但新 Score 不能被及时发现，因此原 24h/7d 观察窗失效，不能直接执行 F8。

同时，原 P14 只把“首页入口”实现成 `/me#pond-echoes` 导航，没有把已经成功空投的 ECHO #1 作为首页可直接点击聆听的第 36 枚音乐圆圈。这不满足用户最初的产品意图。本轨把下面三件事一次收口：

1. 修复并恢复生产 Score 事件索引，防止游标再次回退。
2. 把 `/echo/1` 对应的 ECHO #1 作为首页周期穿越水塘的第 36 枚特殊音乐圆圈，可直接点击现场组合播放。
3. 任何音乐圆进入日食模式时，让全部音乐圆按原方案淡出，并把水底贴图丝滑切换为黑色贴图；水波与 P9 动画继续运行。

这三项共享同一发布 Gate：先恢复数据源，再只读接入链上 ECHO #1 与其永久档案，最后完成视觉、浏览器和生产观察。不得为了先看视觉而在生产继续使用已知不安全的旧游标写入路径。

---

## 2. 冻结的产品合同

### 2.1 第 36 枚音乐圆圈的身份

- #36 固定代表已经成功空投、公开页为 `/echo/1` 的 **ECHO #1**；唯一内容真值来自 OP Mainnet `PondEchoes.tokenURI(1)` 与该 URI 指向的永久 metadata `recipe + clips`。
- #36 **不是** MSTR、不是 `tracks.week=36`、不是 MaterialNFT，也不是第 36 个常规力导 Track。候选完整母带及其权利、试听、上传 Gate 全部退出本轨。
- 上线前，链上合约身份、tokenURI、永久 metadata、36 位 recipe、clips 完整性与网关字节校验必须全部成功；运行时链上/metadata Gate 失败时首页严格只有 35 首，点击后的临时 clip 网关失败则显示可重试错误，不用数据库 Track、假 URL 或本地文件降级冒充。
- `/` 的每个 A/B/C 分组都保持 **35 个常规圆圈 + 同一枚 ECHO #1 特殊访客**。切组不能复制 #36，也不能让普通球数量变成 36 或总数变成 37。
- #36 不参加常规 d3 力导、拖拽、滚轮景深和生命感随机漂移；它复用现有球 shader、投影、命中和日食能力，但数据身份不得适配成 Track。
- 点击 #36 复用现有 `WalletRecipePlayerEngine`，按永久 metadata 在浏览器现场组合 36 段；不生成、不上传新的 MP3。播放后冻结在点击位置，停止或自然结束后从该进度继续穿行。
- 视觉自动出现不等于音频自动播放。音频永远只由明确用户手势启动。

### 2.2 水中穿行

水面不是固定绝对 z，而是运行时 `surface = getEffectiveWaterLevel()`。用户描述的水层按相对水面解释：

| 路段 | 深度 | 视觉含义 |
|---|---:|---|
| 左上屏外入场 | `surface - 0.30` | 水下 30 层 |
| 中段浮出 | `surface + 0.20` | 水上 20 层 |
| 后段下潜 | `surface - 0.10` | 水下 10 层 |
| 屏幕下方离场 | `surface - 0.10` | 保持浅水下离场 |

默认时间合同：

- 页面稳定后 2–4 秒首次出现。
- 单次穿行约 15 秒。
- 离场后 24–36 秒再次出现，全程最多一枚。
- 桌面 hover、键盘 focus 或 pointer down 时减速到正常速度的 10%–20%，方便点击；播放时完全冻结。
- 页面进入后台时暂停时钟，回来后从原进度继续，不补发过期实例、不瞬移。
- `prefers-reduced-motion` 下取消跨屏路径和尾波，在安全区域保留一枚静止、轻呼吸且可点击的 #36。

建议屏幕归一轨迹：

```text
P0 = (-0.12W, 0.10H)
P1 = ( 0.18W, 0.04H)
P2 = ( 0.78W, 0.55H)
P3 = ( 0.58W, 1.12H)
```

位置使用连续 cubic Bézier；深度独立用分段 smoothstep，在进度 `0 / 0.48 / 0.74 / 1` 依次到达 `-30 / +20 / -10 / -10`。控制器对目标屏幕点调用现有 `unproject()` 写回 sim 坐标，保证 resize、DPR、透视和视差下 GL 球与 DOM 命中仍重合。

### 2.3 涟漪拖尾

- 不复活旧彗星的 SVG 白线、散点尾巴或独立 DOM 对象池。
- 水下路段每移动约 32–48px，向当前 FBO 水面送一枚低强度、有界 Drop，形成稀疏的水中涟漪路径。
- 水上路段停止连续尾波；两次穿越水面各产生一枚更强、更大的出水/入水涟漪。
- transient Drop 队列必须有固定上限并由 WaterDistort 统一 drain；禁止高频广播 `bg-ripple:wave`，避免长期堆积和过度推挤普通球。
- 如果需要推开附近圆圈，只允许两次穿水事件各产生一次现有 wake wave。

### 2.4 日食黑色贴图合同

- 点击任意普通音乐圆或 #36 后，约 500ms 内：当前水底贴图连续混合为独立黑色贴图；停止后按同一路径丝滑恢复。
- 全部音乐圆（含播放圆自身与 #36）按原日食方案淡出，由现有 DOM 日食黑核与白环接管视觉焦点。
- 水面、水波、月光、植物、常驻花瓣/微光、全局 grain 与全部 P9 消费者不乘日食背景系数；日食只换背景贴图，不停止或压暗这些动画。
- `GlEclipse`、P9 Showcase/Stage 的临时微光、花瓣、水波和焦散继续在黑色贴图上演奏。
- Header、合奏说明和 BottomPlayer 是操作界面，不属于“背景”，保持可见、可停止播放。
- 不通过卸载 Canvas、重建 WebGL context 或给整棵 PondGL 盖黑幕实现，否则会丢失场景状态并遮掉 P9 动画。
- 停止、自然结束、播放失败或失去有效焦点时恢复水塘。WebGL/context 异常必须 fail open，不能让用户困在无日食、无控制的黑屏。
- 日食期间分组导航禁用；用户先停止播放再切组，避免当前焦点节点被替换。
- `prefers-reduced-motion` 下全屏转换改为即时或不超过 80ms；视觉变化不改变音量、播放时间、录制时钟或 Audio 实例。

### 2.5 #36 的系统边界

- ECHO #1 已经是独立 Pond Echo ERC-721；首页 #36 只提供该既有 NFT 的公开聆听入口，不进入 MaterialNFT 铸造、Track 收藏或 Track API。
- 点击 #36 不启动 TestJam/Score 录制，不把 36 段组合结果写成 Track，也不生成新的媒体或永久上传任务。
- 不修改既有 ECHO #1 的 tokenURI、metadata、recipe、clips 或所有权；首页只读复用 `/echo/1` 已有的严格验证数据源和 `WalletRecipePlayerEngine`。
- 普通 Track 继续走 PlayerProvider 与既有录制规则；ECHO #1 与普通 Track 必须互斥播放，但不能通过伪造 Track 对象实现互斥。

---

## 3. 已知事故证据与根因假设

2026-09-12 的只读证据显示：

- `system_kv.last_synced_block` 曾从约 `156771542` 回退到低位；采样又看到 `2000 → 3500`。
- 当前 safe head 约 `156791788`，`/api/health` 报 `cron_stale` 与 `source_index_lagging`。
- `chain_events` 仍保有 Score #1/#2/#3，最新 #3 为 `156746674:188`；P14 queue 为 2 excluded / 1 success，没有错误新增。
- `sync-chain-events` 读取 `system_kv` 时忽略 Supabase error，并用缺失值兜底 `0`；每轮最多处理 `10 × 50 = 500` blocks，再用普通 update 覆盖游标。
- 该 route 即使游标读写异常仍可能 HTTP 200；相邻 Score cron 的 500 说明当时共享依赖/数据库出现过短暂故障。
- 裸 key `last_synced_block` 没有 chain/contract 身份，测试 baseline 脚本也是写入者之一。

因此高置信故障链是“瞬时读失败 → 被当成 0 → 扫 500 blocks → 无条件倒写为 500”。低位游标的 500 整倍数推进是直接指纹。G0 仍需保存日志与所有写入者清单，把推断升级成可审计证据后再变更生产。

---

## 4. G0｜止血、快照与身份确认

### 目标

阻止旧代码继续倒写游标，同时保留全部链事件、队列和首枚 ECHO 证据。

### 操作

1. 只在不含 `.env.local` 的隔离 release worktree 读取 Production 环境；先只打印 chainId、公开 ScoreNFT 地址和 Supabase host，三者必须同时匹配 OP Mainnet。
2. 保存以下只读快照到 `reviews/evidence/p14-g0-cursor/`：
   - `/api/health` 与 P14 health；
   - `system_kv` 游标值、更新时间和全部相关 key；
   - `chain_events`、`score_nft_queue`、`wallet_recipe_queue`、`mint_events` 计数与身份集合；
   - cron-job.org job `7520772`、`8394060` 的配置和近期运行历史；
   - Vercel 故障窗口及当前日志；
   - 仓库中每个 source cursor 读写者。
3. 将 Production `WALLET_RECIPE_MODE` 改为 `off` 并 redeploy/read-back。
4. 禁用 source sync job `7520772` 与 P14 job `8394060`；等待在途请求与旧 lock TTL 排空，再连续两次确认 source cursor 与两条 queue 不再变化。
5. 暂停旧 24h/7d 观察 heartbeat，保留历史结果但不再把它当有效上线窗口；修复 live 后创建新窗口。
6. 不删除任何事件、queue、upload ledger 或交易记录，不回退 P14 activation/cutoff/discovery cursor。

### Gate G0

- Production 身份三重断言通过；快照可复现。
- 旧 source sync 已停止写，P14 新资格/上传/交易为 0。
- ECHO #1 的 owner、origin、tokenURI 和永久资源仍一致。
- 任何外部配置写入结果未知时停止，不重复执行可能造成分叉的写操作。

---

## 5. G1｜分链游标与不可回退写入

### 数据合同

- 新 key 按 `chainId + lowercase ScoreNFT contract` 隔离，例如 `chain-events:cursor:10:0xac3f...`。
- legacy `last_synced_block` 只作为事故证据，不再有运行时写入者；不得自动把它当新 key 的可信初值。
- `chain_events` 增加 `chain_id`，事件唯一身份改为 `chain_id + lowercase contract + tx_hash + log_index`；所有 source sync、discovery、health 与对账查询必须同时按 chain+contract 过滤。
- 旧事件按已知 contract→chain 映射回填；无法唯一识别的行进入人工核查并阻塞 migration Gate，不能猜网络。
- 新 migration 追加两个职责分离的 service-role-only RPC；anon/authenticated 均 revoke：
  - initialize RPC 只允许目标 scoped key 不存在时插入，强校验 chainId、lowercase contract 和非负整数 safeHead；已存在一律拒绝，禁止普通 insert/upsert 初始化；
  - advance RPC 使用行锁和 expected-value CAS；
  - key/chain/contract 身份必须匹配；
  - row 缺失、格式错误、expected 不等、`next < current` 一律拒绝；
  - `next === current` 明确幂等 no-op；
- source sync 的 Redis lock key同样带 chainId 与 ScoreNFT contract，并使用随机 owner token + compare-and-delete；旧 worker 的 finally 不得删除 TTL 后新 worker 的锁。Redis 只是削峰，数据库 CAS 才是正确性边界。

### 代码合同

- source sync 的唯一目标是 `safeHead = latestHead - 20`。cursor read 的 Supabase error、空行、非整数、负值、超出 safe head 都返回非 2xx，且执行 0 次 `getLogs`、0 次写入；绝不自动降低领先 cursor。
- 每个完整 batch 先幂等 upsert 事件，再 CAS 推进到该 batch 终点；事件写失败不能推进游标。
- cursor 写失败让整次 cron 失败，下一轮依靠事件幂等重放；不得吞错或伪装 HTTP 200。
- discovery、health、baseline/recovery 脚本和 source sync 统一调用同一 key builder/解析器。
- health 输出 source cursor identity、value、safe-head lag 和 last-success；错误必须能被 cron-job.org 识别。
- 测试网和主网即使使用同一数据库，也不能相互读写游标。

### 测试

- read error、row missing、malformed、cursor ahead of head 全部 fail closed。
- CAS expected mismatch、回退、错误 chain/contract、missing key 全部拒绝。
- 两个并发 worker 最多一个成功推进，最终值永不下降。
- 两个并发 initialize 最多一个成功；重复初始化不能覆盖既有值，G2 只能调用 initialize RPC。
- batch upsert 失败只停在最后完整 batch；重放无重复事件。
- 在独立测试库主动尝试高值回退，数据库 RPC 必须拒绝。
- 同一测试库中的主网/测试网相同 tokenId、txHash/logIndex fixture 不互相命中。

### Gate G1

migration/RLS/RPC read-back、真并发测试、route 测试、TypeScript、lint 和 `scripts/verify.sh` 全绿；尚不恢复 Production job。

---

## 6. G2｜全链对账与生产恢复

### 离线对账

1. 从 ScoreNFT 主网部署块 `155933187` 到执行时 `head - 20 confirmations`，按有界区间获取全部 `Transfer` 事件，不只筛 mint。
2. 先实测 provider 单次 logs 区间上限，再输出总区块数、预计请求数、最坏时间与额度 ceiling；当前约 85.8 万 blocks，禁止沿用 10-block 窗口产生约 8.6 万次请求后才发现额度不足。
3. 使用带持久化 checkpoint 的可续跑批处理、指数退避和速率上限；达到预算只能安全暂停续跑，不能跳到 head。
4. 每条日志再用 RPC receipt 校验 chain、contract、txHash、logIndex、blockHash、from/to/tokenId。
5. 与生产 `chain_events` 做双向集合 diff；缺失项只做幂等 upsert，多余项或身份冲突立即停止。
6. 交叉核对：ScoreNFT totalSupply/owner/tokenURI、Score #1–#3、`score_nft_queue`、`mint_events`、`wallet_recipe_queue` 与 ECHO #1。
7. 输出区块范围、请求数、重试、checkpoint、集合 hash、missing/extra/conflict 和最终 0-diff 证据。

### 恢复顺序

1. 两项 cron 仍关闭时，先把 G1 的 production migration/RPC 应用并完成 schema、权限和旧行回填 read-back；此时不部署新 route。
2. 运行上述全链 reconciliation；0-diff 后通过显式初始化 RPC 将新 scoped cursor 设置为同一次测量的 safe head。migration 不猜链头。
3. 部署 G1 的新 source sync/discovery/health 代码，保持 P14 mode=`off`。
4. 只恢复 source sync job，连续观察至少 10 次且跨度不少于 15 分钟。
5. 10/10 必须返回真实成功；游标只能单调前进，lag 符合 20-confirmation 与一分钟调度预算。
6. 停机期如有新 Score，先由 source sync 补齐并完成集合对账，再允许 P14 observe/live。

### 回滚

异常时立即停止 source sync，保持 P14 off，保留新事件和游标证据。可以回滚应用，但旧版 sync job 不得重启；禁止整库恢复、删除 queue、降低游标或跳过未对账区间直接把 cursor 写到 head。

### Gate G2

链/RPC/DB/Score queue/P14 queue 全部 0-diff；scoped cursor 初始化与 10 次生产推进证据完整。只有 G2 通过，视觉发布才可进入 Production。

---

## 7. G3｜ECHO #1 链上身份、永久档案与首页接入

### 链上与永久档案 Gate

1. 以 Production chainId 与 PondEchoes 合约地址读取 `ownerOf(1)`、`originWalletOf(1)`、`tokenURI(1)`；token 不存在、合约身份错误或读取失败均 fail closed。
2. 复用 `/echo/1` 的 `getEchoByTokenId(1n)` 严格数据源，验证 tokenURI 为规范 `ar://`，并对永久 metadata 做现有网关 quorum/字节一致性检查；不得以数据库 queue 或缓存对象替代链上真值。
3. 发布 Gate 对 metadata schema、36 位 `A-Z0-9` recipe、每个引用 clip 的 `ar://`、SHA-256、bytes、duration 与 clip manifest 一致性执行一次全量永久档案校验。运行时公开 API 每次只复核链上身份、tokenURI、metadata quorum/schema 和 manifest 映射；点击后播放器再逐片执行网关 fallback、bytes/hash/duration 校验，避免首页展示前为每位访客重复下载约 3.3MB 音频。
4. 链上身份、tokenURI、metadata quorum/schema 或 manifest 映射任一运行时 Gate 失败时返回“无 featured ECHO”，首页仍渲染 35 个普通 Track；clip 字节在点击时校验失败则保留圆圈并给出可恢复错误，不构造本地 placeholder、MSTR 或 `tracks.week=36` 兜底。

### 数据与播放接入

- `/api/tracks` 作为当前首页常规列表只返回 week 1–35；Track schema、详情、Material/Score 与未来 Track 36–108 不设全局 35 上限。首页用独立的只读 ECHO featured 输入承载 tokenId、name、recipe、clips 与永久身份，绝不把它查询或伪装成 `tracks.week=36`。
- 首页服务端取得通过 Gate 的 ECHO #1 数据后，只把播放器必需的已验证 `recipe + clips` 与展示身份传给客户端；不把私钥、queue 内部状态或数据库信任旁路带入浏览器。
- `regularTargetCount = 35` 只控制 padding/simulation；`displayTotalCount` 仅在 ECHO Gate 成功时为 36，否则为 35。B/C 不得先 pad 到 36 再追加 featured。
- A/B/C 每组断言 35 regular；Gate 成功时共享 1 个 ECHO featured，失败时为 0。ECHO 的 React key/GL node id 使用链+合约+tokenId 永久身份，不使用 Track id。
- 点击调用现有 `useWalletRecipePlayer`/`WalletRecipePlayerEngine` 现场组合 36 段，沿用其网关 fallback、hash/bytes/duration 校验、60ms 等功率衔接和单一 AudioContext 规则。
- 普通 PlayerProvider 与 ECHO engine 建立显式互斥协调：启动一方先停止另一方；同一次手势只能创建一次 ECHO 播放，不重复 load/play 或录制。
- ECHO 播放状态只驱动其 BottomPlayer 兼容展示、PlaybackFocus 与日食；不进入 TestJam、Score/Track 录制、Material 收藏或任何上传队列。
- 记录链上读取、metadata quorum、36/36 clips 解码、完整现场组合播放、暂停/续播/ended 与首网关失败后的有界 fallback 基线。

### Gate G3

- ECHO #1 的链、合约、tokenId、owner/origin、tokenURI、永久 metadata、recipe 与 clips 形成同一条可审计身份链。
- `/api/tracks` 仍为 35 首；ECHO Gate 成功时三组均为 35+1，失败时均为 35+0，无重复/填充假球。
- 36 段可由现有 WalletRecipePlayerEngine 完整现场组合播放，且 0 个新 MP3、0 次新上传、0 个 MaterialNFT/Track/Score 录制副作用。

---

## 8. G4｜GL 特殊访客与真实水波

### 推荐结构

在 `src/components/pond-gl-test3/visitor/` 建立不超过 8 个职责清晰的文件；旧 `track36-*` 原型允许就地重命名/改造，但不得保留 Track 数据依赖：

- `track36-path.ts`：纯函数轨迹、深度与 crossing 计算。
- `track36-state.ts`：单实例状态、ECHO 永久身份、progress、冻结/恢复与 focus pose。
- `use-track36-visitor.ts`：首次/周期调度、visibility 和 ECHO/普通 Track 互斥播放联动。
- `Track36Visitor.tsx`：把 featured node 接入现有 GL sphere pipeline。
- `Track36HitTarget.tsx`：至少 44×44px 的 DOM/键盘命中层。
- `track36-ripples.ts`：有界 transient Drop 队列与节流；若能自然并入现有 ripple-feed，则不另建。

### 集成规则

- 只有 G3 返回已验证 ECHO #1 时，#36 才作为唯一 `kind='featured-echo'` 的独立 `FeaturedEchoVisualNode` 追加到共享 `PondRenderNode`，复用 SphereInstances、WaterDistort 和 GlEclipse；该节点携带 ECHO 身份而非 Track，也不进入 `GlPhysNode` 的 d3 集合。
- 普通 d3 simulation/links 只接收 35 regular nodes；featured node 的 x/y/depth 在通用漂移之后由轨迹控制器最终写回。
- 所有通用沉浮、滚轮去同步、颤动、暗流、wake 和 glide 更新必须一开始就跳过 featured node，不能先积累隐藏速度/激励再覆盖 x/y。
- `depthOf/displayDepthOf` 对 featured node 读取轨迹深度，不叠加滚轮 shift、自漂或 wake 位移。
- 访客可见度必须进入球体与水面 composite 的最终透明度；休眠时节点不进入共享 render nodes，不能留下隐形命中或透明焦点。
- generic SphereOverlay 必须过滤 featured，或在同一组件内分支为专用 hit target；页面只能存在一枚 #36 DOM control，避免双命中、双 play。
- featured 节点禁止拖拽，但支持 click、Enter、Space；aria-label 为“播放/暂停 第 36 首”，hover/focus 时明确显示“36”和曲名。
- hover/focus 减速，播放冻结；切组不重置进度；resize/旋转后路径继续且命中不偏。
- 两次 surface crossing 接现有 splash 口径；水下尾波走有界 transient queue。

### 单元与集成 Gate

- 轨迹在 `0/.48/.74/1` 的位置和相对深度准确，位置/速度/深度连续。
- 后台恢复不跳、单实例、队列有界、计时器/rAF 全清理。
- ECHO Gate 成功时三组 exactly 35+1，未空投/校验失败时 exactly 35+0；普通节点始终为 35，#36 不进 links、不被拖拽。
- 点击只触发一次 WalletRecipePlayerEngine 播放动作且不产生录制/上传；播放冻结，停止/ended 恢复；另一首播放时 #36 按统一日食规则退场。
- WaterDistort 的水上/水下 pass 与 DOM 投影使用同一 featured depth。
- 调度器可注入 clock/seed 或测试 hook，2–4 秒与 24–36 秒随机窗口能确定性测试而不等待碰运气。

---

## 9. G5｜统一日食焦点、背景贴图转换与音乐圆退场

### 状态模型

- 普通音乐仍以 PlayerProvider 的 `playing/currentTrack` 为真值，#36 以既有 WalletRecipePlayerEngine snapshot 为真值；二者先互斥，再归一为一个只读 `PlaybackFocus`，不新增第二套日食事件总线。
- 共享 `PlaybackFocus`/`focusPoseRef` 由 `renderNodes + ordinary player snapshot + ECHO player snapshot` 派生；普通 node 或 ECHO featured node 提供屏幕位置、半径、深度和有效性，GlEclipse 不复制第二套实现，也不把 ECHO 伪装为 Track。
- `eclipseActive = playbackFocus.playing && focusPose.valid && glHealthy`。
- 建立 `eclipseMix`：普通态 `0`，日食态阻尼到 `1`，默认约 500ms；统一时钟/阻尼器每帧只更新一次，仅供背景贴图/基调读取，快速切歌不闪回水底贴图。

### 分层接入

将 `eclipseMix` 只接入背景内容，而不是整 Canvas opacity：

- BaseTone 与当前水底贴图向独立黑色贴图连续混合。
- 程序化塘底花纹随转换退场，避免透过黑色贴图重新显露。
- 普通音乐圆与 #36 的 GL 球、DOM 命中/标题不读取 `eclipseMix`；它们按 `PlaybackFocus` 的原日食退场逻辑独立处理。

以下内容必须绕过 `eclipseMix`：

- GlEclipse 黑核/白环。
- WaterDistort 的水波/高光/倒影/焦散、WaterSurface、植物、常驻与 P9 的 motes/petals/wave/caustics。
- ShowcaseOverlay、P9StageOverlay 与全局 body grain。
- Header、TestJam/合奏说明、BottomPlayer。

Petals、motes、water 的模拟、对象池与绘制强度在黑场期间保持原样。WaterDistort 只能用 `eclipseMix` 降低塘底花纹，严禁在 shader 末尾把最终合成统一乘 0；这条约束用于保护水波和 P9 按键动画。

接近文件硬线的 WaterDistort、shader setup、FloatingMotes 等不得直接堆逻辑；先把 transition/uniform/helper 拆入相应子目录。全局样式另建路由专用文件，不继续向已达 220 行硬线的 `app/globals.css` 追加。

### 交互与故障

- 日食中隐藏的非播放圆退出 pointer events 与 Tab 顺序。
- 点击当前日食焦点或 BottomPlayer 可停止；分组导航在播放时禁用。
- `audio.play()` reject、ended、stop、route unmount、焦点失效都只触发一次恢复并清理 body 标记。
- 不创建第二个 Canvas/FBO，也不为 #36 自制新的音频引擎；只复用 WalletRecipePlayerEngine 自己的单一 AudioContext，普通 Track 继续复用 PlayerProvider 的单一 Audio 实例。
- fallback/no WebGL 时只要仍有有效 DOM 焦点就保持可停止；无法保证焦点时 fail open 恢复场景。

### Gate G5

- 普通圆与 #36 均进入同一 GlEclipse。
- 0ms/250ms/650ms 与停止后 650ms 截图证明背景贴图连续转换、音乐圆退场与恢复。
- 排除 Header、日食和播放器后，背景亮度显著低于常态，但水波相邻帧仍有可测变化。
- 日食中连续演奏 33 键，33 映射、13/20 门控不变，P9 动画仍可见且不因背景转换减弱。
- 分别为 petals、motes、water、scene 选代表键保存黑底截图/像素证据，再运行完整 33 键注册表回归。

---

## 10. G6｜浏览器、可访问性与性能总验收

### 自动验证

- `bash scripts/verify.sh`
- TypeScript、ESLint、production build、Forge 全绿。
- 现有 P9 静态审计：33 active、33 唯一音效、33 唯一映射、13/20 日食门控不变。
- 首页只有一个 PondGL Canvas/WebGL context；20 次播放/停止后不增长。
- ECHO #1 Gate 成功时 `/api/tracks` 仍为 35 且首页为 35+1；模拟未空投、tokenURI 或 metadata 校验失败时首页为 35+0；模拟 clip 字节失败时圆圈保留、播放器报错并可重试，且不进入黑场。

### 浏览器矩阵

| 场景 | 375×844 | 768px | 1440×900 | reduced-motion |
|---|---:|---:|---:|---:|
| 首次 2–4s 出现 #36 | ✓ | ✓ | ✓ | 静止可见 |
| 15s 左上入场→浮出→下潜→底部离场 | ✓ | ✓ | ✓ | 不跨屏 |
| 两次 crossing 与水下稀疏涟漪 | ✓ | ✓ | ✓ | 无尾波 |
| click / Enter / Space 播放 #36 | ✓ | ✓ | ✓ | ✓ |
| 播放冻结、停止续走 | ✓ | ✓ | ✓ | 保持静止 |
| 普通圆/#36 消失、背景切黑色贴图、水波保留 | ✓ | ✓ | ✓ | ≤80ms |
| 停止、ended、play reject 恢复 | ✓ | ✓ | ✓ | ✓ |
| resize/转屏/前后台恢复 | ✓ | ✓ | ✓ | ✓ |
| 日食中 33 键演奏 | ✓ | ✓ | ✓ | ✓ |

额外要求：

- 控制台 0 error、0 横向溢出、隐藏节点无透明焦点陷阱。
- 30 分钟无 DOM、timer、rAF、Drop queue 或内存持续增长。
- 稳态 FPS 相对同设备基线下降不超过 5 FPS，切换期无长任务。
- 路由离开 `/` 后清除 body 标记，`/me`、`/score` 背景与 grain 正常。
- #36 必须从链上 tokenURI 指向的永久 metadata 取得 recipe/clips，并由 WalletRecipePlayerEngine 完整现场组合 36 段；不得用 MSTR、静音、短样本、本地 URL 或预合成 MP3 冒充。
- #36 的播放不得触发 Material 收藏、Track/TestJam/Score 录制或上传；网络与控制台证据中 0 个新媒体写入和 0 个相关 mutation。

### Gate G6

自动矩阵、桌面/手机关键帧、完整播放和性能证据统一进入 `reviews/evidence/p14-g6-track36/`。一张截图不能代替完整动态验收。

---

## 11. G7｜生产发布、重新观察与 F8

### 发布顺序

1. 断言 G2 的 production migration、全链 0-diff、scoped cursor 初始化、新 source route 和 10 次/15 分钟 source 观察均已完成；G7 不重复执行 G2。
2. 在隔离 release worktree 合入 G3–G6 已验证提交；重新确认无 `.env.local` 覆盖 Production。
3. 发布 ECHO #1 只读首页接入与 #36 视觉；线上验证链上/永久档案 Gate、35+1/失败时 35+0、36 段现场组合、零录制/上传、涟漪和日食黑场。
4. 切 P14 为 `observe`，扫描修复停机期新增事件；验证每 origin 唯一、recipe 稳定、零上传、零交易。
5. observe 至少 10 次/15 分钟全绿后恢复 `live`。若存在合法 eligible，走原队列；没有则空跑，禁止制造假用户。
6. 从 live 恢复时刻创建新的观察 heartbeat，并重新开始 24h/7d 观察。旧观察窗因 source cursor 事故作废，不能拼接计时。

### 生产观察

- scoped source cursor identity、单调性、safe-head lag、last-success。
- source/P14 cron HTTP 状态和真实错误；不允许把 DB 故障伪装成 200。
- 新 origin 唯一性、excluded、active age、manual review、Score queue 基线。
- operator/Turbo 余额与 Pond Echo 既有 metadata/manifest/clips 随机 2/3 gateway quorum；首页播放不能产生新的 Turbo 上传。
- `/` 的 #36 完整组合 36 段、日食恢复、P9 33 键和一个 Canvas。

### 最终回滚

任何严重异常：P14 mode=`off`，停止受影响 cron，保留事件、queue、upload 与链上证据；已成功的 ECHO 和 Arweave tx 不删除。视觉可回滚到上一版本，但旧 source cursor route 永远不得重新启用。

### Gate G7 / F8

只有以下全部成立才回到 F8：

- scoped source cursor 已连续 7 天无回退，24h/7d 新观察完成。
- 全链/DB/queue/合约集合一致，无漏事件或错误资格。
- ECHO #1 链上/永久档案身份、首页成功 35+1/失败 35+0、现场组合播放和零 Track/Material/录制副作用均通过。
- 普通圆/#36 的日食黑色贴图转换、持续水波、P9、可访问性、移动端和性能 Gate 全绿。
- 最终 review 明确记录本次 cursor incident 的根因、影响范围、修复、恢复区间与防复发测试。

完成后执行 `70-f-testnet-mainnet.md` 的 F8，更新 STATUS/TASKS/JOURNAL/ERRORS/LEARNING 并再进入 P15-0。

---

## 12. 关键红线

- 不把 cursor 读错误当 0，不允许任何非单调普通 update。
- 不直接跳到当前 head 掩盖可能漏掉的链事件。
- 不在含 `.env.local` 的根工作树运行 Production 环境脚本。
- 不为 #36 复活旧 SVG 首页、旧 comet eclipse 事件或自制播放器；只复用 WalletRecipePlayerEngine。
- 不把 #36 放进常规 35 球力导集合，不在 A/B/C 各复制一枚。
- 不用整 Canvas opacity 或全屏黑幕遮掉 P9 动画。
- 不把水波、motes、petals、焦散或 body grain 乘到日食背景系数；只允许背景贴图/基调消费 `eclipseMix`。
- 首页 ECHO 路径不读取或新增 `tracks.week=36`，不把 ECHO #1 包装成 Track/MaterialNFT，也不让它进入 TestJam/Score 录制；这不限制未来常规 Track 36–108。
- 不生成、上传或引用新的完整 MP3；只读使用 ECHO #1 已冻结的 tokenURI、metadata recipe 与 clips。
- 不在 ECHO #1 尚未空投或链上/永久档案 Gate 失败时显示第 36 枚圆圈。
- 不把自动截图、静态球或短音频冒充完整动态与 36 段现场组合播放验收。
