# ERRORS — 错误博物馆

> 每次遇到报错，AI 在修复后会自动追加一条记录到这里。
> 4 个月后回头看，这是你"闯关史"的完整地图。
>
> **格式**：每条 5 段
> - 📅 日期 + 触发的 Step
> - 😱 报错原文（粘贴 stack trace 关键部分）
> - 🧠 为什么会错
> - 🔧 怎么修的
> - 💡 学到的（一句话原则，可以反复套用的）
>
> **编号规则**：E001, E002, ... 从 001 起递增

---

## 🎯 这份文件的价值

错误是**学习最深**的时刻。大脑在看到红色 stack trace 时会高度专注，
此时记下"为什么 + 怎么修 + 原则"，比读 10 篇教程都有效。

第二次遇到相似的错误，你会直觉地搜这份文件，往往 1 秒钟解决。

---

## 📖 错误正文

> 按时间顺序追加。

---

### E001 — Tailwind v4 `Invalid code point 12675409`

- 📅 2026-04-10 / Phase 2 Step 0（合奏 spike）

- 😱 `RangeError: Invalid code point 12675409` at `tailwindcss/dist/lib.js` → `markUsedVariable`

- 🧠 Tailwind v4 默认扫描整个项目目录。`.claude/logs/` 里的日志文件含 Windows 路径如 `\c16951a6...`，Tailwind 的 CSS 转义解析器把 `\c16951` 当成十六进制转义，算出超范围 Unicode code point（12675409 > 0x10FFFF）崩溃。

- 🔧 最终修复：将 `.claude/logs/` 加入 `.gitignore`，Tailwind v4 自动跳过 gitignored 路径，`globals.css` 恢复默认 `@import "tailwindcss"`。之前的 `source(none)` 白名单方案是临时 workaround，已移除。

- 💡 Windows 路径的反斜杠 + 十六进制字符会被 CSS 解析器误读。根本解法是让 Tailwind 不扫描这些路径（gitignore），而非手动白名单。

---

### E002 — Cursor 执行 `git checkout` 还原 globals.css

- 📅 2026-04-10 / Phase 2 Step 0

- 😱 通过 CLI/终端修改的 `globals.css` 修复内容，约 2-6 分钟后被还原成 git 中的旧版。ProcMon 抓到是 `git.exe checkout app/globals.css`。

- 🧠 Cursor 编辑器检测到 git 仓库后，会在后台执行 `git checkout` 恢复文件到 git 版本。只要 git 里的版本是旧的，Cursor 就会反复还原。

- 🔧 把修复提交到 git（`git commit`），这样 Cursor 的 `git checkout` 恢复的就是正确版本。

- 💡 外部修改被 git tracked 的文件后，必须及时提交，否则 Cursor 等编辑器可能通过 git 还原。

---

### E003 — 背景音乐快速点击叠加

- 📅 2026-04-10 / Phase 2 Step 0

- 😱 快速连续点击"播放背景"按钮，会触发多条音轨同时播放。

- 🧠 `startBg` 是异步函数（fetch + decode），第一次点击还没完成时 `bgPlaying` 还是 false，第二次点击又触发一次 `startBg`。

- 🔧 加 `bgLoadingRef` 锁，进入时检查、退出时释放。同时在 startBg 开头停掉旧的 source。

- 💡 异步操作的开关按钮必须加锁，React 的 state 更新是异步的，不能依赖 state 做互斥。

---

### E004 — `useSyncExternalStore` 引用不稳致 Maximum update depth exceeded

- 📅 2026-05-15 / Phase 7 Track B B3

- 😱 `The result of getSnapshot should be cached to avoid an infinite loop` + `Maximum update depth exceeded` —— useAuth 改双源化后，dev server 首屏即报，整页崩。

- 🧠 `readSemiJwt()`（= `useSyncExternalStore` 的 `getSnapshot`）每次调用都 `new` 一个 `{ jwt, payload }` 对象。React 用 `Object.is` 比对快照，引用不同 → 触发 rerender → 又调 getSnapshot → 又是新对象 → 死循环。jose 的 atob 解码 / Date.now() 比较都是"看似 pure 实际每次返回新对象"的典型陷阱。

- 🔧 模块级 `cachedState` 变量缓存上一份；`refresh()` 计算新值后做等值检查（jwt 字符串 + payload.sub + payload.exp），相同就保持旧引用、否则替换 + 通知 listeners。`ensureSnapshot()` 第一次 getSnapshot 时同步初始化（pure，无副作用）；`ensureSubscribers()` 第一次 subscribe 时挂全局 setInterval(60s) + storage listener，全程只挂一次。

- 💡 `useSyncExternalStore` 的 `getSnapshot` 必须 referentially stable —— "同一份底层数据每次返回必须 === 上次"。模块级 store 用 cachedState + 等值检查复用引用是标准模式；副作用（定时器 / 事件监听）必须挂在 `subscribe` 而非 `getSnapshot`，否则 React 严格模式下也会报。

---

### E005 — Arweave 瞬时 404 导致解码器整页失败

- 📅 2026-08-22 / Phase 12 A-1

- 😱 `Failed: https://ario.permagate.io/<sound-txid> → HTTP 404` —— 旧格式回归首次加载失败，刷新后恢复。

- 🧠 链上音效表与本地 txid 完全一致；随后直接请求两个网关均返回 200、文件 59,597 bytes，证明不是数据写错，而是网关瞬时错误。当前 `fetchWithFallback` 对每个网关只尝试一次，任一音效两路同轮失败就让 26 音效的 `Promise.all` 整体失败。

- 🔧 已修：两个候选地址同轮全失败后等待 400ms，再完整尝试一轮；最多两轮，仍失败继续抛出具体资源错误。`verify.sh` 全绿，用户无参数 Demo 浏览器复验通过。

- 💡 去中心化存储不等于每个网关随时可靠；永久播放器既要多网关，也要对瞬时故障做有界重试。

---

### E006 — 旧音效索引缺 hash 会误触发 26 个 mp3 全量上传

- 📅 2026-08-22 / Phase 12 C2

- 😱 上传前 dry-run 审查发现：`data/sounds-ar-map.json` 只有 `{ txId, url }`，升级后的增量脚本无法证明文件未变化，会把 26 项全部当成待上传。

- 🧠 内容 hash 是新索引才有的字段；对旧索引直接执行“hash 不同即上传”，会把“没有 hash”误解为“内容变化”。

- 🔧 普通模式遇旧索引缺 hash 时 fail-closed；新增 `--map-only` 显式复用已有 txid，并用 `--dry-run` 在付费前验证 v2 表。实测上传 0、扣费 0。

- 💡 涉及付费或不可逆操作时，“无法判断”必须等于“停止”，不能等于“全部重做”。

---

### E007 — PowerShell `$home` 撞只读系统变量 `$HOME`

- 📅 2026-08-22 / Phase 12 A-1 生产检查
- 😱 `Cannot overwrite variable HOME because it is read-only or constant.`
- 🧠 PowerShell 变量名不区分大小写，`$home` 与系统 `$HOME` 是同一个变量。
- 🔧 改用任务专属变量 `$homepageResponse`，并启用 `$ErrorActionPreference='Stop'` 后重跑，首页与 health 均 200。
- 💡 脚本变量必须使用任务专属名称，尤其不要复用 HOME、PATH 等系统名。

---

### E008 — `env-sync` 缺少 API token，但 Vercel CLI 已登录

- 📅 2026-08-22 / Phase 12 A-1 三环境验收
- 😱 `缺少 VERCEL_TOKEN 或 VERCEL_PROJECT_ID，请加到 .env.local`
- 🧠 `scripts/vercel-env-sync.ts` 只认显式 API token；`vercel whoami` 的 CLI 登录态是另一套凭证，脚本不会自动复用。
- 🔧 本轮用已登录 Vercel CLI 完成三环境更新、逐环境内存读回与精准 Production redeploy；未为一次性校验新增长期 token。
- 💡 “CLI 已登录”不等于“自写 API 脚本有 token”；部署工具的认证来源必须分开检查。

---

### E009 — PowerShell 请求 Arweave 偶发 SSL 握手失败

- 📅 2026-08-23 / Phase 12 A-1 最终 smoke 核验
- 😱 `Invoke-WebRequest: The SSL connection could not be established`
- 🧠 本机 PowerShell/.NET 到 `arweave.net` 的 TLS 通道偶发被本地网络安全层影响；同一地址随后由 Node `fetch` 返回 200，内容哈希与备用网关一致，因此不是 Arweave 内容丢失。
- 🔧 换独立 Node `fetch` 客户端复验，并同时比较 HTTP 状态、字节数与 SHA-256，避免把客户端握手问题误判为资源故障。
- 💡 永久资源验收不能只依赖一个本地 HTTP 客户端；状态、内容哈希和第二网关要交叉验证。

---

### E010 — 使用文档缩写地址调用到空合约

- 📅 2026-08-23 / Phase 12 B5 admin 签名演练
- 😱 `The contract function "hasRole" returned no data ("0x")`
- 🧠 初次检查把 STATUS 中供人阅读的 `0xE0fA..DB23` 缩写按记忆补成了错误完整地址；该地址没有目标合约代码，因此 `hasRole` 返回空数据。
- 🔧 停止手工补地址，直接从 `.env.local` 读取 `NEXT_PUBLIC_SCORE_NFT_ADDRESS` / `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS`，并先用 chainId=11155420 护栏确认 OP Sepolia 后再广播。
- 💡 交易地址只能来自权威 env 或部署记录的完整值；展示用缩写永远不能反推成执行参数。

---

## 🏷 错误索引（按类型）

随着错误积累，AI 会在这里维护一份按类型分类的索引：

### 浏览器 / Web API
- E003 背景音乐快速点击叠加

### Next.js / React
- E001 Tailwind v4 扫描 `.claude/logs/` 导致 Invalid code point
- E002 Cursor autoSave 覆盖外部修改
- E004 useSyncExternalStore getSnapshot 引用不稳致死循环

### TypeScript
- （空）

### 数据库 / Supabase
- （空）

### 区块链 / viem
- E010 使用文档缩写地址调用到空合约

### 网络 / API
- E005 Arweave 瞬时 404 导致解码器整页失败
- E006 旧音效索引缺 hash 会误触发 26 个 mp3 全量上传
- E009 PowerShell 请求 Arweave 偶发 SSL 握手失败

### Git / 工具链
- E007 PowerShell `$home` 撞只读系统变量 `$HOME`
- E008 `env-sync` 缺少 API token，但 Vercel CLI 已登录

### JWT / 认证

#### `CryptoKey is not extractable`
- **报错原文**：`TypeError: CryptoKey is not extractable`
- **为什么**：`jose` 的 `generateKeyPair()` 默认生成不可导出的密钥。想导出 PEM 就必须加 `extractable: true`
- **怎么修**：`generateKeyPair("RS256", { modulusLength: 2048, extractable: true })`
- **学到了什么**：Web Crypto API 默认保护密钥不可导出，这是安全设计——导出时要显式声明
- **相关文件**：`scripts/generate-jwt-keys.ts`

#### forge deploy 脚本 MINTER_ROLE 授给了错误地址
- **报错原文**：`The contract function "mint" returned no data ("0x")` — 合约拒绝 mint
- **为什么**：部署脚本里 `address minter = msg.sender` 在 `vm.startBroadcast()` 之前执行，拿到的是 Foundry 默认地址 `0x40d36fd4...`，不是 `--private-key` 对应的 operator 地址
- **怎么修**：改用 `vm.envUint("OPERATOR_PRIVATE_KEY")` + `vm.addr(key)` 推导正确地址；已部署合约用 `cast send grantRole` 补授权
- **学到了什么**：Foundry 脚本里 `msg.sender` 在 `startBroadcast()` 前是模拟地址。要拿真实 deployer 地址必须从私钥推导
- **相关文件**：`contracts/script/DeployAirdropNFT.s.sol`

#### 空投快照返回 0 个钱包（列名写错）
- **报错原文**：快照返回 `recipientCount: 0`，无报错但数据为空
- **为什么**：`chain_events` 表的列叫 `to_addr`，代码里写成了 `to_address`。Supabase 查不到列不报错，返回空
- **怎么修**：`snapshotOwners()` 里 `to_address` → `to_addr`
- **学到了什么**：Supabase select 未知列名会静默返回 null，不抛错。写 DB 查询时一定要对照 migration 文件确认列名
- **相关文件**：`app/api/airdrop/trigger/route.ts` + `supabase/migrations/phase-3/014_chain_events.sql`

#### 构建期 `Cannot read properties of undefined (reading 'replace')`
- **报错原文**：`TypeError: Cannot read properties of undefined (reading 'replace')` in jwt.ts
- **为什么**：jwt.ts 在模块顶层就 `process.env.JWT_PRIVATE_KEY!.replace(...)` — 构建期这个环境变量还不存在
- **怎么修**：把 PEM 读取从模块顶层移到函数内部（惰性读取），构建时不触发
- **学到了什么**：Next.js 构建时会加载所有 server 模块做类型检查，环境变量可能未设置。服务端模块里的全局初始化要做成惰性的
- **相关文件**：`src/lib/auth/jwt.ts`
