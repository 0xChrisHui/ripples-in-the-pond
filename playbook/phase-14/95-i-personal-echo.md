# P14-I — 首页 #36 改为“当前登录钱包自己的 Pond Echo”

> **建立日期**：2026-10-21（同日按用户确认修订 I-1 / I-5：以 origin 钱包判定，不看当前持有人）。状态：I0–I6 已完成（2026-10-28 用户目验通过；全量审查修复见 JOURNAL），未推送、未部署。
> **覆盖范围**：本文件推翻 `80-g-recovery-track36-eclipse.md` §2.1 中“#36 固定代表 ECHO #1、所有访客共享同一枚”的身份规则，以及 G3 的公开 featured 接口。#36 的视觉与运动（P14-H / `special36/`）、播放引擎、日食、35 个普通圆规则继续有效。
> **不改**：Pond Echoes 合约、recipe v1 算法、metadata、空投队列与 cron、`/echo/[id]` 与 `/echo/origin/[address]` 公开页（链上数据本就公开）。

---

## 1. 问题

无痕窗口未登录即可在首页看到 #36「Pond Echo · 456b—7708」。根因不是登录态泄露，而是按 G 轨定案实现：

- `PondExperience.tsx` 首页初始化后无条件 `fetch('/api/echo/featured')`，不带身份。
- `app/api/echo/featured/route.ts` 写死 `getEchoByTokenId(1n)`，并以 `public, s-maxage=86400` 进入 CDN 公共缓存。
- `src/data/echo/featured.ts` 断言 `tokenId === '1'`。
- 作品名取自 metadata，格式 `Pond Echo · <前4>—<后4>`，因此把真实用户 `0x456b…7708` 的地址片段展示给所有访客。

## 2. 冻结的产品规则（用户 2026-10-21 确认）

| # | 规则 |
|---|---|
| I-1 | #36 只代表**当前登录钱包自己生成**的那一枚 Pond Echo：`originWallet == 当前登录钱包`（链上 `tokenIdByOrigin(wallet)`）。与这枚 NFT 现在归谁无关——转走后首页仍显示；别人转入的不显示。 |
| I-2 | 未登录、登录但该钱包没有生成过 Echo、查询失败：首页只显示 35 个普通圆，不留占位、不显示“待生成”。 |
| I-3 | 首次 ScoreNFT 铸造后、Echo 铸造完成前：首页不显示 #36；链上 `tokenIdByOrigin` 非 0 且永久 metadata 校验通过后才出现。 |
| I-4 | 该钱包已生成过 Echo 的用户登录（或回访时已登录）后，#36 **渐显**出现；登出时渐隐并移除。 |
| I-5 | 算法输入就是钱包地址，合约保证一钱包终身一枚，因此首页与钱包一一对应，不存在“多枚选哪一枚”。别人转入的 Echo 不上首页，只在 `/me#pond-echoes` 查看。 |
| I-6 | 任何匿名或公共缓存的响应都不得包含某个用户的 Echo。 |

定制化算法本身不变：钱包地址 → recipe v1（`00-overview.md` D3、`30-b-recipe-data-contract.md`），由空投链路生成并永久写入 metadata；首页只读取结果。

## 3. 改动设计

### 3.1 服务端：新增私有接口，下线公共 featured

- 新增 `GET /api/me/pond-echo/home`（需 `authenticateRequest`）：
  1. 取登录钱包 → `getEchoByOrigin(owner)`（`src/data/echo/source.ts` 已有：`tokenIdByOrigin` → `getEchoByTokenId`，含链上 + metadata quorum 校验）。**不再**调用 `getOwnedEchoes`，也不看 `ownerOf`，所以转走后仍返回。
  2. 映射为首页 DTO（复用 `FeaturedEcho` 结构；`toFeaturedEcho` 去掉 `tokenId === '1'` 断言，`href` 改为 `/echo/<id>`；DTO 不携带 owner）。
  3. `tokenIdByOrigin` 为 0 时返回 `echo: null`，并读 `wallet_recipe_queue` 该 origin 行得到 `pending`：状态属于 `pending / preparing_media / uploading_metadata / minting_onchain / confirming_onchain / safe_retry`，或 `success` 但链上仍读不到（RPC 滞后）→ `true`；`manual_review / excluded_prelaunch / 无队列行` → `false`。只返回布尔，不返回内部错误细节。队列读取逻辑从 `app/api/me/pond-echoes/route.ts` 的 `readOriginHistory` 抽成共享函数，不复制。
  4. 响应头 `Cache-Control: private, no-store`。
- 响应：`{ echo: FeaturedEcho | null, pending: boolean }`；未登录 401；链上/metadata 失败 503（前端按“无 #36”处理）。
- 删除 `app/api/echo/featured/route.ts`。新首页不再请求它；线上 CDN 里残留的旧缓存无人消费，自然过期。

### 3.2 客户端：首页按登录态取数

- 新 hook `usePersonalEcho()`（`src/hooks/echo/`）：
  - 读 `useAuth()` 的 `authenticated / authSource / userId / evmAddress / getAccessToken`；身份为空时返回 `null` 且不发请求。
  - 身份变化（登录、登出、换钱包）时 abort 旧请求并重新查询；登出立即返回 `null`。
  - `pending === true` 时在首页可见期间每 30 秒复查，最长 20 分钟；窗口重新聚焦时也复查一次。查到 `echo` 后停止。
  - 同一身份的结果做内存缓存（不进 localStorage，避免共享设备串号；与 `/me` 的 archive cache 隔离）。
- `PondExperience.tsx`：把现有 `fetch('/api/echo/featured')` effect 替换为 `usePersonalEcho()`，`featuredEcho` 的下游（`useGlSim`、`GlNav featured`、`FeaturedEchoBottomPlayer`、日食）不改接口。
- 登出或身份切换时若 #36 正在播放：先停止 Echo 播放，再移除节点。

### 3.3 GL：#36 动态出现不重建 35 球

当前 `use-gl-sim.ts` 的建点 effect 依赖 `echo`，echo 从 null 变为有值会重建整个模拟（35 球位置重置、水线复位），登录后会整池跳一下。

- 把 #36 从 `buildGlNodes` 的重建依赖中拆出：35 球按原逻辑建点；#36 作为单独节点追加/移除到现有 sim（`sim.nodes([...])` 后低 alpha 重启，不重置锚点、水线、景深）。
- 只按 Echo 永久 `identity` 判断是否变化，避免同一枚 Echo 因对象引用变化而反复增删。
- 渐显：`special36/depth-presence.ts` 增加入场状态，新节点从 presence 0 开始，以 1.2–2s 缓入到 1；入场期间 `< SPECIAL36_HIT_MIN` 不可点击（沿用现有规则）。渐隐：presence 降到 0 后再从 sim 移除。
- 首次加载时若登录态在 GL 就绪前已确定，同样走渐显，不做“首帧直接出现”的特殊分支。

### 3.4 配套清理

- `scripts/p14/verify-featured-echo.ts`、`scripts/p14/browser-track36-smoke.mjs` 依赖公共 featured 接口：改为测新私有接口（带测试 token）或标记退役，不能留下必然失败的脚本。
- `src/lib/music-catalog/data/known-facts.ts` 中引用 featured-echo-proof 的说明文字：核对是否仍描述“首页固定 ECHO #1”，如是则改述。
- 文档：`80-g` §2.1 顶部加一行“身份规则已由 95-i 取代”；同步 STATUS / TASKS / JOURNAL。

## 4. Steps

### I0 — 基线与确认（只读）
- 记录 `git status`；先跑一次 `bash scripts/verify.sh` 留基线，记录改动前就存在的失败项（dev 未开时才跑）。
- 只读核对本地链上数据。本地 `.env.local` 是 **OP Sepolia**（`NEXT_PUBLIC_CHAIN_ID=11155420`，合约 `0x43E86Af0437386a8Af7A3b0c806d917c030BAb38`，`WALLET_RECIPE_MODE=live`），所以本地看不到主网 ECHO #1。2026-10-21 核对 `totalSupply = 3`：
  - #1：origin `0x4Fffc941Af305Efa80Afc9754083411859af0F78`，现持有人 `0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1`（**已转走**）
  - #2：origin `0x40F72999b7102bA213102bcbFAe8f2378c7Fc7A9`，仍在原钱包（普通）
  - #3：origin `0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1`，仍在原钱包；该钱包同时持有转入的 #1

  三个钱包正好覆盖“转走仍显示”“转入不显示”“普通”三种情况，可同时用于自动验证与 I6 目验。
- 确认 `getEchoByOrigin` 在 RPC 上的耗时，作为新接口预算参考。
- 📦 范围：无代码改动。

### I1 — 私有接口
- 📦 范围：`app/api/me/pond-echo/home/route.ts`（新）、`src/data/echo/origin-queue.ts`（新，从 `me/pond-echoes/route.ts` 抽出的队列读取）、`app/api/me/pond-echoes/route.ts`（仅改为引用共享函数，行为不变）、`src/data/echo/featured.ts`（去掉 #1 断言）、`src/types/featured-echo.ts`（响应类型）、`scripts/p14-i/`（新，测试脚本，`tsx` 运行，沿用项目既有 `*.test.ts` 写法）。
- 验收：
  - 未登录 401。
  - 从未生成 → `{echo:null, pending:false}`。
  - 已生成且仍在原钱包 → 返回 DTO。
  - 已生成但已转走（单测 mock `ownerOf ≠ origin`）→ 仍返回 DTO。
  - 别人转入、自己从未生成 → `{echo:null}`。
  - 用只读脚本对 I0 的三个测试网钱包直接调用选择逻辑（不经登录）：`0x4Fff…0F78 → #1`、`0xce8c…D2d1 → #3（不是转入的 #1）`、`0x40F7…c7A9 → #2`、任意未生成过的新地址 → `null`。
  - 地址大小写不影响结果。
  - 响应头 `private, no-store`。
  - `/api/me/pond-echoes` 行为不变（回归）。

### I2 — 首页 hook 接入
- 📦 范围：`src/hooks/echo/usePersonalEcho.ts`（新）、`src/features/home-pond/PondExperience.tsx`。
- 验收：无痕未登录 → 35 球，Network 中无任何 echo 请求；登录未生成过 Echo 的钱包 → 35 球；登录已生成过 Echo 的钱包 → 出现 #36；登出 → #36 消失、播放停止。

### I3 — 不重建追加 + 渐显/渐隐
- 📦 范围：`src/components/pond-gl-test3/spheres/use-gl-sim.ts`、`spheres/simulation/nodes.ts`、`special36/depth-presence.ts`、`special36/special36-step.ts`。
- 验收：登录后 35 球位置连续不跳（录屏对比）；#36 约 1.5s 渐显；渐显中不可点；登出渐隐后节点移除；切组仍为 35+1 / 35+0。

### I4 — pending 轮询
- 📦 范围：I1 接口的 `pending` 字段、I2 hook 的轮询逻辑。
- 验收：用单测（fake timers + mock 的接口响应）验证：`pending:true` 时 30 秒后复查，拿到 `echo` 后停止；20 分钟上限后停止；窗口聚焦触发一次复查；登出立即停止。**不写任何库、不发交易、不触发 cron**；如确需真实空投联调，停下来问用户。

### I5 — 下线公共接口与清理
- 📦 范围：删除 `app/api/echo/featured/route.ts`；`scripts/p14/` 两个脚本；`known-facts.ts` 文案；`80-g` 顶部说明；STATUS / TASKS / JOURNAL。
- 验收：`git grep "api/echo/featured"` 无残留；`bash scripts/verify.sh` 中与本改动相关项通过（既有的两项目录超限失败照旧记录）。

### I6 — 本地目验（用户亲自在浏览器看）
- 用户亲自在浏览器看，AI 只负责启动 dev 并说明“登录哪个钱包、应看到什么”。本地为 OP Sepolia，六种状态：
  1. 无痕未登录 → 35 球，Network 无 echo 请求。
  2. 登录从未生成过 Echo 的钱包 → 35 球。
  3. 登录 `0x40F7…c7A9` → 渐显 #2。
  4. 登录 `0x4Fff…0F78`（#1 已转走）→ 仍渐显 #1。
  5. 登录 `0xce8c…D2d1`（同时持有转入的 #1）→ 只显示自己的 #3，不显示 #1。
  6. 登出 → #36 渐隐消失、播放停止。
- 用户自己的目验钱包是否属于以上三个，由用户在 I6 告知；若是别的钱包且无 Echo，则只能验第 1、2 种。
- 推送与部署需用户单独放行。

## 5. 风险与边界

- **本地 env 连生产库**：`.env.local` 的 Supabase 是生产库，本轮任何步骤都不得写 `wallet_recipe_queue` 或其他表；不跑 cron、不发交易、不上传 Arweave。
- **本地是测试网，主网 ECHO #1 看不到**：这是正常的。主网行为（匿名不再看到 `456b—7708`）只能在部署后的正式域名无痕窗口复核，部署需用户单独放行。
- **转走态/转入态**：用测试网 #1 / #3 的现成数据目验（见 I0），不需要在任何网络上新做转让；mock 单测仍保留。
- **真实“首铸 → 空投 → 渐显”端到端不在本轮清单**：它需要触发空投队列并写库，需用户明确提出后另议。
- **ETH 主网 Score**：P14 空投只由 OP ScoreNFT 首铸触发（D5）。只在 ETH 铸造过的钱包不会有 Echo，首页按 I-2 显示 35 个。
- **RPC 负担**：每个登录用户访问首页，未生成 Echo 时多 1 次链上读（`tokenIdByOrigin`）+ 1 次 DB 读；已生成时再加 `getEchoByTokenId` 的 4 次链上读和 metadata 网关核验。如果 I0 测得耗时过高，再考虑服务端按钱包短 TTL 内存缓存。
- **SEO/分享**：首页不再对匿名访客展示 #36，公开 `/echo/1` 页面不受影响。
