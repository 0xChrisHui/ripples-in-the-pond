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

### E011 — npm 全局安装后当前 PowerShell 找不到 Alchemy CLI

- 📅 2026-08-23 / P12 主网 Alchemy App
- 😱 `The term 'alchemy' is not recognized`
- 🧠 npm 已把 CLI 安装到用户级全局目录，但当前 Codex PowerShell 进程的 PATH 没有刷新该目录。
- 🔧 用 `npm prefix -g` 定位 `C:\Users\Hui\AppData\Roaming\npm\alchemy.cmd`，后续显式调用绝对路径。
- 💡 Windows 全局 CLI 安装成功不代表既有 shell 立即能解析命令；先查 npm prefix，不要重复安装。

---

### E012 — Alchemy CLI Admin 命令完成后触发 UV assertion

- 📅 2026-08-23 / P12 主网 Alchemy App
- 😱 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c`
- 🧠 CLI v0.23.0 在 Windows 退出阶段关闭异步句柄时崩溃；API 请求此前已完成，因此退出码非零不等于创建失败。
- 🔧 不重试 create；先用 `app list --search` 查重，确认账户中恰有一个目标 App，再用 RPC chainId 验收。
- 💡 外部创建命令遇到“请求后崩溃”必须先读回外部状态，盲重试会制造重复资源。

---

### E013 — Etherscan 免费 key 的 OP 普通 API 被拒绝

- 📅 2026-08-23 / P12 合约验证凭证
- 😱 OP Mainnet `eth_blockNumber` 返回 `Free API access is not supported for this chain`。
- 🧠 Etherscan 免费套餐不开放 OP 的普通链数据 API，但合约源码与 ABI 类接口对免费套餐开放；用错探针会把有效 key 误判为无效。
- 🔧 改用部署真正依赖的 `getsourcecode` 和验证状态端点验收；两者均通过鉴权，无需升级套餐。
- 💡 凭证验收必须贴近实际用途，不能用一个无关端点概括整套权限。

---

### E014 — Vercel Hobby 无法通过 CLI 读取精确 Usage

- 📅 2026-08-23 / P12 C6 额度盘点
- 😱 `vercel usage --format json` 返回 `Costs not found (404)`；metrics 查询要求 Observability Plus。
- 🧠 项目确认是 Hobby，但账单 CLI 与高级 metrics 没有返回 Hobby 的实际消耗。
- 🔧 不把 404 当零用量；改用官方硬上限 + 4 个 cron 全按 1min 的保守月调用上界做承载判断。
- 💡 精确数字拿不到时，保守上界比猜测更适合上线 gate。

---

### E015 — Vercel Sensitive env 不能注入本地 Resend 查询

- 📅 2026-08-23 / P12 C6 额度盘点
- 😱 `vercel env run -e production` 仍只加载现有 `.env.local`，Resend API 返回 400；生产 Sensitive 值未导出。
- 🧠 Vercel 对 Sensitive env 保持不可读边界，不能为了盘点把生产 Resend key 拉回本机。
- 🔧 停止重试；改用已验证的 C4 收信记录、告警触发上界与官方 100/day、3,000/month 限制判断。
- 💡 配额盘点不值得降低 secret 安全等级；能用行为上界证明就不搬运生产密钥。

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
- E011 npm 全局安装后当前 PowerShell 找不到 Alchemy CLI
- E012 Alchemy CLI Admin 命令完成后触发 UV assertion
- E013 Etherscan 免费 key 的 OP 普通 API 被拒绝
- E014 Vercel Hobby 无法通过 CLI 读取精确 Usage
- E015 Vercel Sensitive env 不能注入本地 Resend 查询
- E016 PowerShell 直接启动 Edge headless 未生成截图

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

#### PowerShell 找不到 `bash`，导致验证脚本无法启动
- **报错原文**：`The term 'bash' is not recognized as a name of a cmdlet`
- **为什么**：Git Bash 已安装在 `D:\DevTools\Git\bin\bash.exe`，但该目录没有加入当前 PowerShell 的 PATH。
- **怎么修**：使用绝对路径 `& 'D:\DevTools\Git\bin\bash.exe' scripts/verify.sh`，完整验证通过。
- **学到了什么**：Windows 上命令不在 PATH 不代表工具未安装；先从 `git.exe` 所在工具目录定位配套 Bash，再按项目规定运行原脚本。
- **相关文件**：`scripts/verify.sh`

#### Next.js 生产构建拿不到 `.next/lock`
- **报错原文**：`Unable to acquire lock at E:\Projects\nft-music\.next\lock, is another instance of next build running?`
- **为什么**：localhost 的 `next dev` 正在使用同一个 `.next` 目录，`verify.sh` 的 `next build` 无法并发取得锁；不是代码编译错误。
- **怎么修**：先正常停止 dev session，运行完整 `scripts/verify.sh`，全部通过后再启动 `npm run dev` 并确认 `/test3` 返回 200。
- **学到了什么**：本项目 dev/build 共用 `.next`；完整验证前要释放 dev 锁，验证后恢复用户的预览环境。
- **相关文件**：`scripts/verify.sh`

#### 新路由加入后 TypeScript 读取了旧 `.next` 路由类型
- **报错原文**：`.next/dev/types/validator.ts` 将 `/test4` 判定为不属于旧的 `LayoutRoutes`。
- **为什么**：开发服务器生成的 `.next/dev/types` 与旧生产类型缓存同时存在，二者路由集合不一致。
- **怎么修**：先运行 `npm run build` 重新生成当前路由类型，再运行 `npx tsc --noEmit`；随后类型检查通过。
- **学到了什么**：Next.js 新增路由后，不能只依赖旧开发缓存判断类型结果，应先让构建刷新 `.next` 类型产物。
- **相关文件**：`app/test4/page.tsx`、`app/test4/layout.tsx`

#### PowerShell 直接启动 Edge headless 未生成截图
- **报错现象**：直接用 PowerShell 调用 `msedge.exe --headless` 立即返回 0，但没有生成目标截图。
- **为什么**：GUI 子系统进程的启动/参数转交没有形成当前终端可等待的 headless 进程；首次复用的 profile 也可能留下启动竞争。
- **怎么修**：使用独立临时 profile，并在同一 `cmd` 进程内调用 Edge 的 8.3 可执行路径；命令会等待到输出“bytes written to file”。
- **学到了什么**：Windows 上做浏览器视觉回归要同时隔离 profile、确保调用进程可等待，并核对截图文件实际存在，不能只看退出码。
- **相关文件**：`/test4` 视觉回归流程（不涉及产品代码）

---

### E017 — 解析圆形遮罩无法修复水上球串水纹

- 📅 2026-08-23 / Phase 8 P8-L R1 真透明维修

- 😱 用户动态复验：水上球依然出现涟漪，浅色球依然严重曝光；静态截图曾被误判为已修复。

- 🧠 单张 `sphereTarget` 只有最终 RGBA，不保存像素来自水上球还是水下球。合成 shader 后算的圆形遮罩与真实球体抗锯齿边、生命感形变和重叠关系不一致；同时，半透明球即使最后绘制也会透出下面的动态水纹。

- 🔧 每个 instance 写入 `aSubmerge`，同一球材质分两次输出水下与水上 target；只有水下 target 接受折射和水光，水上 target 的真实 alpha 负责最终覆盖与主体静态背景揭示。曝光继续使用预乘 headroom 限幅。

- 💡 需要严格图层语义时，身份必须在 draw 时保留；不能在颜色已经合并后靠几何近似把身份猜回来。

---

### E018 — 球体实际没有进入水上/水下 FBO

- 📅 2026-08-23 / Phase 8 P8-L R3 真透明最终维修

- 😱 表现：R1/R2 修改了 alpha、遮罩与三层合成，但用户视频里水上球仍被涟漪穿过并爆白；真实 target 调试最初只有黑色，最终画面却仍有彩色球。

- 🧠 根因：`SphereInstances` 用 `useLayoutEffect([separatePass])` 设置 Three.js layer。网格尚未挂载时 effect 直接返回，随后 ref 出现但依赖不变，effect 不会重跑；球一直落在背景 layer 0，先被水面 shader 烘进湿背景，两个球体 FBO 都是空的。

- 🔧 修复：改用 callback ref，在 `InstancedMesh` 真正挂载和 `separatePass` 变化时同步设置 layer。调试结果恢复为混合水位红/绿分流、完全出水纯绿、无蓝色预乘 Alpha 失配。

- 💡 看到最终画面有对象，不代表对象进入了预期的中间 pass；多 pass 问题必须先检查真实 render target，再讨论 shader 公式。

### E019 — 开发服务器并发改写 `.next/dev/types` 导致临时类型语法错误

- 📅 2026-08-23 / R3 验证

- 😱 报错：`.next/dev/types/routes.d.ts` 出现 `TS1128`、`TS1160` 等不完整声明错误。

- 🧠 原因：独立 `tsc` 与正在运行的 Turbopack 同时读取/改写生成类型，读到了生成中的半文件；错误位置全部位于 `.next/dev/types`，不在源码。

- 🔧 处理：停止开发服务器后再运行项目规定的完整 `scripts/verify.sh`，避免 dev/build/typecheck 共用 `.next` 时互相竞争。

- 💡 生成目录里的“语法错误”应先检查写入竞争；不能据此修改业务源码救火。

### E020 — 生产构建无法获取 Google Fonts

- 📅 2026-08-24 / 最终验证

- 😱 报错：`next/font` 无法从 `https://fonts.googleapis.com` 下载 `Azeret Mono`，导致 `next build` 失败。

- 🧠 类型检查、Lint 和 Foundry 合约测试均已通过；当前失败点是生产构建的外部字体请求，不是 Bash 或业务 TypeScript 错误。

- 🔧 本次未修改字体配置，先停在真实错误处，避免把网络问题和源码改动混在一起。

- 💡 生产构建依赖外部字体网络；要保证离线或受限网络下稳定构建，应把字体改为本地资源或采用已有的构建缓存策略。

### E021 — ESLint 扫描并行 Edge QA 临时目录时遇到文件锁

- 📅 2026-08-25 / P8 综合 Review 文档验证

- 😱 报错：ESLint 读取 `.tmp-p9-edge-qa/Default/Extensions/.../1089.24319cd46457e9ad60ef.js` 时返回 `EPERM: operation not permitted`。

- 🧠 原因：另一个工作线留下或正在使用 Edge QA 临时浏览器目录，其中的扩展文件被系统锁定；失败路径不属于本次 P8 文档或 P8 源码。

- 🔧 用户确认这些目录是 P9 浏览器 QA 临时 profile 后，在 `.gitignore` 与 `eslint.config.mjs` 精确忽略 `.tmp-p9-edge-qa*`；随后完整 `verify.sh` 通过。

- 💡 多工作线共享同一工作区时，浏览器 profile 等临时目录可能干扰全仓扫描；应由拥有该工作线的进程关闭/收束资源，而不是由无关 Phase 擅自清理。

### E022 — effect 内同步上报 GL 不可用状态触发 lint

- 📅 2026-08-25 / P8-RUN-02
- 😱 报错：`react-hooks/set-state-in-effect` 指向 `reportHealth('unavailable')`。
- 🧠 原因：状态初值本来就是 unavailable，却又在 effect 主体同步触发内部与父级 setState。
- 🔧 修复：删除冗余 effect；Canvas reporter 只在真实外部生命周期事件中上报 healthy/lost/error。
- 💡 能由初始 state 表达的状态不要再用 effect 回写。

### E023 — 并行 Next.js 进程占用生产构建锁

- 📅 2026-08-26 / P8-RUN-02 验证
- 😱 报错：`Unable to acquire lock at .next/lock`。
- 🧠 原因：另一个本项目 Next.js 进程仍持有构建锁，与本次源码无关。
- 🔧 修复：用户只结束命令行指向本工作区的 Next.js 进程，并清理遗留单个 lock；重跑完整验证通过。
- 💡 不要用 `taskkill /IM node.exe` 误杀其他 Node/Codex 进程，应按工作区命令行精准结束。

### E024 — 浏览器 QA 脚本把 DOM 对象当 JSON 返回

- 📅 2026-08-26 / P8 浏览器回归
- 😱 前 17 项通过后，CDP 返回 `Object reference chain is too long`；第二轮又因复用刚取消拖拽的命中目标而拿不到 pointerId。
- 🧠 原因：临时脚本的表达式最后返回了 Canvas DOM 对象，而 `Runtime.evaluate(returnByValue)` 只能序列化普通值；lost-capture 用例也没有在新按压前重新定位鼠标。
- 🔧 修复：赋值后显式返回布尔值；lost-capture 改用另一颗球并先移动鼠标到最新包围盒。第三轮完整矩阵全绿。
- 💡 浏览器测试夹具失败要与产品失败分开记录；先看已通过断言和 fatal 位置，不能据此修改业务代码。

### E025 — 执行层阻止递归删除临时 Edge profile

- 📅 2026-08-26 / P8 浏览器回归清理
- 😱 已确认临时 Edge 进程数为 0、目录位于工作区内，但 `Remove-Item -Recurse -Force` 仍被执行层 policy 拒绝。
- 🧠 原因：这是 Codex 执行层对浏览器数据目录递归删除的保护，不是 Windows 文件占用或项目权限错误。
- 🔧 处理：没有绕过安全拦截；删除本次 QA 脚本，保留已被 Git/ESLint 精确忽略的自动生成 profile。
- 💡 “进程已关”与“执行层允许递归删除”是两件事；遇到 policy 拦截应保留忽略目录或交给用户手动清理，不能换壳绕过。
