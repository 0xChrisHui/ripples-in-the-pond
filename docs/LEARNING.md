# LEARNING — 概念词典

> 这是你的"大脑外挂"。AI 自动维护，你只需要在空闲时间瞄一眼。
>
> **使用方式**：
> - AI 在写代码过程中，每遇到一个新概念，自动追加 1 条到本文件
> - 你在厕所、早餐、睡前花 5 分钟翻一翻
> - 同一个概念你看到第 2、5、10 次时，理解会逐步加深
> - 遇到忘记的词，Ctrl+F 直接搜
>
> **格式**：每条 3 行
> 1. **是什么**：1 句话定义
> 2. **类比**：日常生活的比喻（比定义更容易记）
> 3. **第一次出现**：在哪个 step / 文件第一次见到

---

## 🎯 小白成长曲线

每过一段时间回到这里看一眼，你会惊讶于自己已经记住的东西。

- **Phase 0 阶段目标**：理解"前端 → API → 数据库 → 链上"这条主路是什么意思
- **Phase 1 阶段目标**：能看懂一个普通的 React 组件 + API Route
- **Phase 2 阶段目标**：能看懂状态管理 + 异步流程
- **Phase 3 阶段目标**：能独立 review AI 写的简单功能

---

## 📚 词典正文

> 按首次出现的时间顺序追加。同名概念多次出现时，更新原条目而非新增。

---

### Tailwind CSS
- **是什么**：一个 CSS 工具库，让你用类名（如 `text-white bg-black`）直接写样式，不需要自己写 CSS 文件。v4 版本会自动扫描项目文件找出你用了哪些类名。
- **类比**：像一本巨大的样式菜单，你只说菜名（类名），它帮你做出来。但 v4 的"自动扫描"功能像一个太勤快的实习生，会翻遍办公室所有文件夹。
- **第一次出现**：`app/globals.css`（`@import "tailwindcss"`），Phase 0 初始化

---

### Web Audio API
- **是什么**：浏览器内置的音频引擎，可以低延迟地播放、叠加、变调多个音源。核心对象是 `AudioContext`。
- **类比**：一个小型录音棚——`AudioContext` 是调音台，`BufferSource` 是播放器，`GainNode` 是音量旋钮，全部用线（`connect`）连起来最后接到音箱（`destination`）。
- **第一次出现**：`src/spike/useJamAudio.ts`，Phase 2 Step 0

---

### AudioContext 的用户手势要求
- **是什么**：浏览器安全策略要求 AudioContext 必须在用户点击/按键后才能启动（`resume`），不能页面一加载就自动播放声音。
- **类比**：像餐厅里不能自己去厨房拿菜，必须先举手叫服务员（用户手势），服务员才会帮你上菜（播放音频）。
- **第一次出现**：`src/spike/useJamAudio.ts:29`（`getContext` 里的 `resume`），Phase 2 Step 0

---

### useCallback + 闭包陷阱
- **是什么**：React 的 `useCallback` 会缓存函数，但函数内部引用的变量可能是创建时的旧值（闭包）。如果依赖项写错，回调里拿到的是过期数据。
- **类比**：你拍了一张照片（闭包），照片里的东西是拍照那一刻的样子。即使现实已经变了，照片不会自动更新。用 `useRef` 可以绕过这个问题，因为 ref 像一个"实时监控画面"而不是照片。
- **第一次出现**：`src/spike/useJamAudio.ts:46`（`playKick` 改用 `ctxRef.current` 避免闭包问题），Phase 2 Step 0

---

### 异步操作加锁（防抖）
- **是什么**：异步函数（如 fetch）执行期间，用户可能再次触发同一操作。用一个布尔 flag（锁）防止重复执行。
- **类比**：电梯门正在关的时候，按钮会暂时失效，防止门反复开关。
- **第一次出现**：`src/spike/useJamAudio.ts:76`（`bgLoadingRef` 防止快速点击叠加背景音乐），Phase 2 Step 0

---

### 状态机（state machine）
- **是什么**：先定义一个功能会经历哪些状态，以及状态之间允许怎么切换，比如 `idle → loading → success / error`，避免流程半路卡在假成功或脏状态。
- **类比**：像机场值机，乘客不能从“还没安检”直接跳到“已经登机”；每一步都要按顺序通过。
- **第一次出现**：`reviews/2026-04-10-phase-2-cto.md`，Phase 2 CTO review

---

### 动态路由（Dynamic Route）
- **是什么**：Next.js 用方括号命名文件夹（如 `[tokenId]`），表示这个路径段是一个变量。访问 `/score/2` 时，`tokenId` 自动变成 `2`，一个文件就能服务所有 ScoreNFT。
- **类比**：像酒店房间号，走廊只有一个设计（页面文件），但每间房的号码（tokenId）不同，内容也不同。
- **第一次出现**：`app/score/[tokenId]/page.tsx`，Phase 3 S6

---

### OG 分享卡（OpenGraph Image）
- **是什么**：当你在微信/Twitter 分享一个链接时，平台会读取页面的 `og:image` 标签，自动生成一张预览卡片。Next.js 的 `opengraph-image.tsx` 可以在服务端用 JSX "画"出这张图。
- **类比**：像书的封面——你把书推荐给朋友时，朋友先看到封面决定要不要翻开。OG 卡片就是链接的"封面"。
- **第一次出现**：`app/score/[tokenId]/opengraph-image.tsx`，Phase 3 S6

---

### 链上事件同步（Event Sync）
- **是什么**：你的数据库只知道"自己铸造了什么"，但不知道用户在 OpenSea 把 NFT 转给了谁。定期从链上拉 `Transfer` 事件，把所有权变更记录到自己的 DB，让数据库和区块链保持一致。
- **类比**：像银行对账——你自己的账本记了收支，但每月还要和银行流水核对一遍，确保没有漏记的转账。
- **第一次出现**：`app/api/cron/sync-chain-events/route.ts`，Phase 3B

---

### 幂等同步（system_kv + UNIQUE 约束）
- **是什么**：`system_kv.last_synced_block` 记录"上次扫到第几个区块"，下次从这里继续；`chain_events` 表用 `UNIQUE(tx_hash, log_index)` 保证同一个事件不会被写入两次。两层保险确保 cron 即使重复跑也不会产生脏数据。
- **类比**：像看书时夹书签（last_synced_block = 书签位置），同时笔记本里用标号防止同一段话被抄两次（UNIQUE 约束）。
- **第一次出现**：`supabase/migrations/phase-3/013_system_kv.sql` + `014_chain_events.sql`，Phase 3B

---

### iframe 嵌入
- **是什么**：`<iframe>` 是一个"页面中的页面"，可以加载另一个网址的内容。ScorePlayer 用 iframe 加载 Arweave 上的 Decoder HTML，让播放器代码和主站完全隔离。
- **类比**：像在电视里看另一个频道的节目——电视机（主页面）提供框架，节目内容（decoder）来自别处。
- **第一次出现**：`app/score/[tokenId]/ScorePlayer.tsx`，Phase 3 S6

---

### JWT（JSON Web Token）
- **是什么**：一种"数字签名的身份证"。服务器签发一段带有效期的令牌，客户端每次请求带上它，服务器验证签名就知道"你是谁"，不用每次都查数据库。由 header.payload.signature 三部分用 `.` 拼接。
- **类比**：游乐园的一日手环——入口盖了章就能一天内随便进各个游乐设施，不用每次重新买票。
- **第一次出现**：`src/lib/jwt.ts`，Phase 4 S0

---

### RS256（非对称签名算法）
- **是什么**：用私钥签名、公钥验证的 JWT 签名方式。私钥只有服务器有（永远不暴露），公钥可以公开。比对称签名（HS256）更安全——即使公钥泄露，攻击者也无法伪造签名。
- **类比**：邮局的蜡封印章——只有你有印章能盖，但任何人都能看出封印是不是你的。
- **第一次出现**：`scripts/generate-jwt-keys.ts` + `src/lib/jwt.ts`，Phase 4 S0

---

### jti + 黑名单（JWT 撤销机制）
- **是什么**：JWT 天生是"签了就生效，到期才失效"的（无状态）。要支持提前作废（如用户登出），给每个 JWT 一个唯一 ID（jti = JWT ID），登出时把 jti 写入 `jwt_blacklist` 表，验证时额外查一次。
- **类比**：信用卡挂失名单——卡片本身没过期，但银行系统里标了"此卡已注销"，刷卡时会被拒绝。
- **第一次出现**：`src/lib/jwt.ts` 的 `revokeJwt()` + `supabase/migrations/phase-4/015_jwt_blacklist.sql`，Phase 4 S0

---

### auth_identities（多源身份表）
- **是什么**：一个中间表，记录"这个用户通过哪种方式登录过"。`users` 表只代表站内用户，`auth_identities` 表记录 `provider`（privy / semi）和 `provider_user_id` 的对应关系，一个 user 可以有多条。
- **类比**：一个人可以有身份证、护照、驾照——都指向同一个人，但发证机关不同。`auth_identities` 就是"证件列表"。
- **第一次出现**：`supabase/migrations/phase-4/016_auth_identities.sql`，Phase 4 S1

---

### 统一认证中间件（authenticateRequest）
- **是什么**：一个共享函数，所有需要登录的 API 都调它来验证"你是谁"。先尝试 Privy 验证，失败再尝试自签 JWT。这样 Privy 用户和 Semi 用户都能通过同一个入口验证身份。
- **类比**：机场安检有两条通道（国内/国际），但最终都汇到同一个候机厅。中间件就是"安检口"，不管你从哪条通道来，验完身份都能进。
- **第一次出现**：`src/lib/auth/middleware.ts`，Phase 4 S1

---

### Token 交换（一次性中转模式）
- **是什么**：用户从外部服务（Semi）拿到的登录凭证（auth_token），到我们后端换成自签 JWT。之后所有请求只认我们自己的 JWT，不再依赖外部服务。这样即使 Semi 暂时挂了，已登录用户也不受影响。
- **类比**：用外国驾照换本地驾照——换的时候需要外国驾照原件，但换完之后在本地开车只看本地驾照。
- **第一次出现**：`app/api/auth/community/route.ts`，Phase 4 S2

---

### Authorization Header vs URL 参数

- **是什么**：HTTP 标准的身份验证方式，密钥放在请求头（header）里而不是 URL 里
- **类比**：URL 参数像把密码写在信封外面（会被路上的人看到），header 像封在信封里面
- **为什么重要**：URL 会出现在服务器日志、浏览器历史、CDN 缓存里，密钥容易泄露
- **第一次出现**：`src/lib/auth/cron-auth.ts`，Phase 5 S0
- **跳过了复述**

---

### Durable Lease（队列持久租约）

- **是什么**：队列任务被某个 cron 抢到后，在数据库里写入“我正在处理，到某个时间前别人别碰”的锁，而不是只靠 SQL 执行瞬间的锁。
- **类比**：图书馆借书卡。你把书借走后，系统记录到期日；不是管理员看见你拿起书的那一秒才算占用。
- **为什么重要**：链上交易这种外部副作用不能被两个 cron 同时处理，否则可能重复 mint、抢 nonce 或产生孤儿 NFT。
- **第一次出现**：`reviews/2026-04-25-phase-1-4-strict-cto-review.md`，Phase 1-4 回看。

---

### Sync Cursor（同步游标）

- **是什么**：后台同步链上事件时，用一个数字记录“我已经同步到第几个区块”。下一次从这里继续。
- **类比**：读书夹书签。只有这一页真的读完了，书签才能往后移；如果中间跳过一页，后面很难知道漏了什么。
- **为什么重要**：如果单条事件写库失败但 cursor 仍推进，系统以后不会再回头扫那个区块，空投和 owner 展示会永久建立在错误数据上。
- **第一次出现**：`app/api/cron/sync-chain-events/route.ts`，Phase 3B；在 Phase 1-4 回看中被标为新增 P1 风险。

---

### 分布式互斥锁（SETNX + Lua 安全释放）

- **是什么**：多个进程/服务都可能同时跑同一段代码（比如三个 cron 都想用同一个钱包发交易），用一个共享的 Redis key 来"占座"：`SET key value NX EX 30` — 如果 key 不存在就写入并设 30 秒过期；存在就拒绝。释放时用 Lua 脚本"先 GET 比对再 DEL"，避免误删别人后续抢到的锁。
- **类比**：会议室门口的"使用中"牌子。挂牌前先看一眼有没有别人挂着；自己用完撕牌前再确认一下是自己的牌子（不是隔壁同事换上去的），避免把别人的"使用中"撕了。
- **为什么重要**：运营钱包是一个 EOA，nonce 是单调递增的。两个 cron 同时发 tx 会 nonce 冲突 → 后发的可能 replace 前一笔、被 RPC 拒绝、互相覆盖 → 出现"链上 mint 了但 DB 没记 / DB 记了但链上没成功"的诡异状态。锁是主网前必装的护栏。
- **第一次出现**：`src/lib/chain/operator-lock.ts`，Phase 6 A0；包装 `app/api/cron/process-{mint-queue,score-queue,airdrop}/route.ts` 三个入口。

---

### Chain ID 单一来源

- **是什么**：把当前链（OP Sepolia 或 OP Mainnet）的 chainId、viem chain 对象、浏览器链接统一放在一个配置文件里，其他代码只引用它，不再各自写死。
- **类比**：像全公司只认一张最新版地图；如果每个人抽屉里都有旧地图，搬家时一定有人走错地方。
- **第一次出现**：`src/lib/chain/chain-config.ts`，Phase 7 A1。

---

### 按需加载（Lazy Fetch）

- **是什么**：页面首屏只请求必要的小数据，用户真的点击某个功能时再请求大数据。
- **类比**：像餐厅先给菜单，不会把所有菜一次端上桌；你点哪道菜，厨房再做哪道。
- **第一次出现**：`src/components/me/DraftCard.tsx` + `app/api/me/scores/[id]/events/route.ts`，Phase 7 C3。

---

### 慢网反馈（Loading Feedback）

- **是什么**：数据还没回来时，先显示 spinner、提示文案和重试按钮，让用户知道页面没有卡死。
- **类比**：像外卖 App 显示“骑手正在路上”和“联系骑手”，比空白页面更让人安心。
- **第一次出现**：`src/components/common/LoadingState.tsx` + `src/components/archipelago/Archipelago.tsx`，Phase 7 C5。

---

### PinInput（分离式验证码输入）

- **是什么**：把 6 位验证码拆成 6 个小输入框，但内部仍合成一个字符串提交给后端。
- **类比**：像快递柜取件码，每个格子只放一位数字；用户看着清楚，系统最后还是读完整 6 位码。
- **第一次出现**：`src/components/auth/PinInput.tsx`，Phase 7 Track D D2。

---

## 🗓 历史归档

每个月末，AI 会把超过 30 天的条目归档到本文件末尾。
归档区先是空的。
