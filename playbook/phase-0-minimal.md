# Phase 0 — Minimal Closed Loop

> 🎯 **目标**：跑通 "前端 → API → 队列 → 链上 1 笔 mint" 的完整技术主路。
>
> 🚫 **不包含**：底部播放条 / 个人页 / 多岛屿 / 合奏 / 乐谱 / 分享卡 / Vercel Cron 配置 / 部署到 Vercel
>
> ✅ **完成标准**：在 OP Sepolia Etherscan 上看到一笔由本项目铸造的 NFT 交易。

---

## 📖 阅读规则

每个 Step 都用同一套七段式格式。**不同读者读不同段**：

| 段 | AI 必读 | 用户读 |
|---|---|---|
| 🎯 目标 | ✅ | ✅ |
| 📦 范围 | ✅ | — |
| 🚫 禁止 | ✅ | — |
| ✅ 完成标准 | ✅ | ✅ |
| 🔍 验证命令 | ✅ | ✅ |
| ⏪ 回滚点 | ✅ | — |
| 📖 概念简报 | — | ✅ |
| 🤖 AI 执行指引 | ✅ | — |
| 📝 复述问题 | — | ✅ |

**AI 跳过 📖 和 📝 段**——那是给用户学习用的。

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| 0 | 环境检查 + 注册账号 + checkpoint 演练 | `doctor.sh` 0 ❌ |
| 1 | Next.js 调整深色首页 | 浏览器看到深色页 |
| 2 | Island 组件 + 点击播放本地 mp3 | 点击圆，听到声音 |
| 3 | Privy 登录拿到 evm_address | 登录后 console 打印地址 |
| **🛑 中场休息点** | Step 0-3 完成 = "前端能跑"。停一下，吃饭散步，明天再来 |
| 4 | Supabase 建 2 张表 | Dashboard 看到表 |
| 5 | MaterialNFT 部署 **OP Sepolia**（用 OZ 现成合约） | OP Etherscan 看到合约 |
| 6 | POST /api/mint/material（写队列） | curl 返回 200 |
| 7 | 手动触发 cron 端点 | 队列 status → success |
| 8 | Etherscan 看到 tx | 🎉 |

> ⏱ **时间预期**：这是 8 个 step，**不是 1 天**。预计 2-4 个工作日，每天 2-3 个 step 是正常节奏。**卡 3-4 小时不算失败，是常态**。如果今天卡了 4 小时，停下，明天再来。

---

# Step 0：环境检查 + 账号注册 + checkpoint 演练

## 🎯 目标
确认 Node / Git 装好；注册 Privy / Supabase / Alchemy 账号；准备 **OP Sepolia** 测试钱包；演练一次 checkpoint.sh。

## 📦 范围
- `.env.example`（创建）
- `.env.local`（创建，不入 git）
- 注册外部账号（不在仓库里）

## 🚫 禁止
- 不动 `package.json`
- 不装任何 npm 包
- 不装 Foundry（Step 5 才需要）

## ✅ 完成标准
- `bash scripts/doctor.sh` 输出 **0 ❌**（warning 可以有）
- `.env.local` 含真实的 Privy App ID / Supabase URL / Alchemy OP Sepolia RPC / 测试钱包私钥
- 测试钱包在 **OP Sepolia** 上 ≥ 0.02 OP-ETH（去 https://app.optimism.io/faucet 领）
- 已经跑过一次 `bash scripts/checkpoint.sh "Phase 0 起点演练"` 并理解输出

## 🔍 验证命令
```bash
bash scripts/doctor.sh
```

## ⏪ 回滚点
环境配置失败不需要 git 回滚，删 `.env.local` 重做。

## 📖 概念简报
1. **环境变量**：放在 `.env.local` 的 `key=value`，前缀 `NEXT_PUBLIC_` 的会暴露给前端，没前缀的只在后端
2. **OP Sepolia**：Optimism（以太坊 L2）的测试网。L2 = 跑在以太坊上的"二楼"，gas 便宜十几倍，安全性继承自一楼。我们生产用 OP Mainnet，所以测试也用对应的 OP Sepolia 而不是 ETH Sepolia。水龙头免费发测试 ETH
3. **私钥 vs 地址**：地址公开（像微信号），私钥是密码（千万不能泄露），有私钥就能动这个地址里的钱

## 🤖 AI 执行指引
1. 跑 `bash scripts/doctor.sh` 看现状
2. 创建 `.env.example`（变量按 ARCHITECTURE.md 决策 5 + 决策 1 + 决策 3 推断；至少含 `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET` / `NEXT_PUBLIC_CHAIN_ID=11155420`（OP Sepolia）/ `ALCHEMY_RPC_URL`（指向 OP Sepolia 端点）/ `OPERATOR_PRIVATE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET`，每个加中文注释）
3. 检查 `.gitignore` 含 `.env.local`，没有就追加
4. 引导用户去注册 Privy / Supabase / Alchemy，把值填到 `.env.local`，等用户说"填好了"
5. 再跑一次 `doctor.sh` 确认 0 ❌
6. 让用户跑 `bash scripts/checkpoint.sh "Phase 0 起点演练"`，解释输出（backup branch + commit），让用户理解将来如何回滚到这里

## 📝 复述问题
> 为什么 `.env.local` 不能 commit 到 git？

---

# Step 1：深色首页

## 🎯 目标
把 Next.js 默认首页清空，换成深色全屏背景 + 中央一行小字。

## 📦 范围
- `app/page.tsx`
- `app/globals.css`（如有需要微调）

## 🚫 禁止
- 不动 `app/layout.tsx` 结构
- 不删 `app/` 下任何已有文件
- 不创建新组件

## ✅ 完成标准
- 浏览器 http://localhost:3000 看到全屏深色页
- 中央有一行白色小字 "108 Cyber Records"
- 控制台 0 报错

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
失败回到 Step 0 末尾的 commit。

## 📖 概念简报
1. **App Router**：Next.js 16 用的路由系统，`app/page.tsx` 就是首页
2. **Tailwind CSS**：用 className 写样式，`bg-black text-white` = 黑底白字
3. **Server Component**：默认情况下 `page.tsx` 在服务器渲染好 HTML 再发给浏览器

## 🤖 AI 执行指引
读 `app/page.tsx` 现状 → 清空 `<main>` 换成全屏深色 + flex 居中 + `<h1>` 显示产品名 → 跑 `verify.sh` → 让用户在浏览器确认 → 用户确认后引导 commit。

## 📝 复述问题
> Next.js 的 `app/page.tsx` 和 React 的普通组件有什么区别？

---

# Step 2：Island 组件 + 点击播放

## 🎯 目标
首页中央有会呼吸的圆形（Island）。点击它播放 `public/tracks/001.mp3`。

## 📦 范围
- `src/components/archipelago/Island.tsx`（新建）
- `src/hooks/useAudioPlayer.ts`（新建）
- `app/page.tsx`（修改）
- `public/tracks/001.mp3`（用户准备）

## 🚫 禁止
- 不写 BottomPlaybar（Phase 1 才做）
- 不引入任何音频库（用 Web Audio API，见 STACK.md 黑名单）
- 不创建 `src/lib/` 或其他目录

## ✅ 完成标准
- 深色页中央一个柔和蓝色圆，缓慢"呼吸"
- 点击 → 听到 mp3 播放
- 再次点击 → 停止
- 控制台 0 报错

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

## 📖 概念简报
1. **AudioContext**：浏览器音频引擎。**必须**在用户点击之后才能创建，否则浏览器拒绝（防止广告自动播放）
2. **React Hook**：以 `use` 开头的函数，让组件复用状态逻辑
3. **'use client'**：放在文件顶部，告诉 Next.js 这是浏览器组件。任何用 hooks/事件的组件都需要

## 🤖 AI 执行指引
提醒用户在 `public/tracks/` 放 `001.mp3` → 写 `useAudioPlayer.ts`（AudioContext 单例 + play/stop + 同时只播一首）→ 写 `Island.tsx`（圆形 + Tailwind animate-pulse + onClick prop）→ 改 `app/page.tsx` 接入 → `verify.sh` → 浏览器测试 → commit。

## 📝 复述问题
> 为什么 AudioContext 不能在页面加载时创建，必须等用户点击？

---

# Step 3：Privy 登录

## 🎯 目标
右上角"登录"按钮，邮箱登录后 console 打印 evm_address。

## 📦 范围
- `src/lib/privy.ts`（新建）
- `src/hooks/useAuth.ts`（新建）
- `src/components/auth/LoginButton.tsx`（新建）
- `app/layout.tsx`（修改：加 PrivyProvider）
- `app/page.tsx`（修改：加 LoginButton）
- `package.json`（新增依赖）

## 🚫 禁止
- 不自建 JWT（违反 ARCHITECTURE 决策 5）
- 不开启 Privy Smart Account（见 STACK.md 黑名单）
- 不做用户列表 / 个人页

## ✅ 完成标准
- 右上角"登录"按钮
- 点击 → Privy 弹窗 → 邮箱登录 → 按钮变成地址前 6 后 4
- console 打印完整 evm_address
- 登出能登出

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/ package.json package-lock.json
rm -rf node_modules && npm i
```

## 📖 概念简报
1. **Privy**：第三方登录服务，用户邮箱/Google 登录，Privy 在背后生成以太坊钱包，用户感觉不到区块链
2. **JWT**：登录后服务端发的"通行证"字符串，前端每次请求带着它。我们用 Privy 自带的，不自建
3. **PrivyProvider**：React Context Provider，包在 app 最外层，所有子组件都能用 `usePrivy()` 拿到登录状态

## 🤖 AI 执行指引
`npm i @privy-io/react-auth @privy-io/server-auth`（白名单包）→ 写 `lib/privy.ts`（config，loginMethods: ['email']，embedded wallet 配置）→ 写 `useAuth.ts` 封装 → 写 `LoginButton.tsx`（未登录"登录"，已登录显示 0x 短地址 + console.log 完整地址）→ 改 `app/layout.tsx` 包 PrivyProvider → 改 `app/page.tsx` 加 LoginButton → `verify.sh` → 浏览器测试登录全流程 → commit。

## 📝 复述问题
> 用户用邮箱登录后，他的"以太坊地址"是从哪里来的？

---

## 🛑 中场休息点

**Step 0-3 完成 = "前端能跑"**。

到这里你已经有了：环境就绪、深色首页、能播放音频的呼吸圆、Privy 登录拿到地址。**这是一个完整的可炫耀的小成果**，去倒杯水/吃个饭/睡一觉。

明天再开 Step 4，不要赶。

---

# Step 4：Supabase 建 2 张表

## 🎯 目标
在 Supabase Dashboard 手动建 `users` 和 `mint_queue` 两张表。

## 📦 范围
- Supabase Dashboard（不在代码仓库里）
- `supabase/migrations/001_initial_minimal.sql`（仅备份用）

## 🚫 禁止
- 不装 Supabase CLI
- 不本地跑 Docker
- 不一次建 4 张表（按 ARCHITECTURE 决策 4，Phase 0 只要 2 张）

## ✅ 完成标准
- Dashboard → Table Editor 看到 `users` 和 `mint_queue` 两张表
- `users` 至少有：`id`、`evm_address`、`privy_user_id`、`created_at`
- `mint_queue` 至少有：`id`、`idempotency_key`、`user_id`、`mint_type`、`token_id`、`status`、`retry_count`、`created_at`
- SQL 文件备份在 `supabase/migrations/001_initial_minimal.sql`

## 🔍 验证命令
浏览器 Dashboard → Table Editor → 看到两张表

## ⏪ 回滚点
Dashboard 里 DROP TABLE。SQL 文件 git checkout 还原。

## 📖 概念简报
1. **PostgreSQL**：关系数据库，数据存在"表"里，每张表有列和行。Supabase 是托管的 PostgreSQL
2. **Primary Key**：每行的唯一标识，通常 UUID 或自增整数
3. **Foreign Key**：一张表引用另一张表的主键，例如 `mint_queue.user_id` 引用 `users.id`

## 🤖 AI 执行指引
写 `supabase/migrations/001_initial_minimal.sql`（按 ARCHITECTURE 决策 4 + Phase 0 最小集，自己定字段类型）→ 引导用户去 Dashboard SQL Editor 粘贴执行 → 让用户在 Table Editor 确认看到表 → 让用户手动插一条测试 user → commit。

## 📝 复述问题
> 为什么 `mint_queue` 用 `user_id` 字段而不是把用户信息直接写在每条记录里？

---

# Step 5：MaterialNFT 部署 OP Sepolia（保守版：用 OZ 现成合约）

## 🎯 目标
**用 OpenZeppelin 现成的 ERC1155PresetMinterPauser**（不自己写）部署到 **OP Sepolia**。零自定义代码，目的是验证整条链路。Phase 1 再写自己的版本。

## 📦 范围
- `contracts/`（Foundry 项目，新建）
- `contracts/script/Deploy.s.sol`
- `contracts/foundry.toml`

## 🚫 禁止
- ❌ **不要手写 MaterialNFT.sol**——Phase 0 用 OZ 现成的就够了
- 不部署 ScoreNFT（Phase 3）
- 不部署到主网（Phase 0-1 永远不部署主网，包括 OP Mainnet）
- 不用 Hardhat（用 Foundry）

## ✅ 完成标准
- `forge build` 通过
- `forge script ... --broadcast` 输出合约地址
- 合约地址在 https://sepolia-optimism.etherscan.io 能查到
- 写入 `.env.local` 的 `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS`
- 部署的钱包地址已被授予 MINTER_ROLE（OZ 的角色控制等价于 allowlist）

## 🔍 验证命令
```bash
cd contracts
forge build
# 部署后:
# 浏览器打开 https://sepolia-optimism.etherscan.io/address/<合约地址>
```

## ⏪ 回滚点
合约部署失败：删 `contracts/` 重建。链上的失败合约不用管（测试网不花钱）。

## 📖 概念简报
1. **Solidity**：写以太坊合约的语言，部署后不能改
2. **ERC-1155**：以太坊标准之一，"一个 tokenId 可以有多份"（适合音乐素材）
3. **OZ Preset**：OpenZeppelin 提供的"开箱即用"合约，已经写好权限/角色/限额，工业级安全。Phase 0 用现成的，Phase 1 再学着写自己的

## 🤖 AI 执行指引
`forge init contracts --no-git` → `forge install OpenZeppelin/openzeppelin-contracts --no-git` → 写一个最小的 `Deploy.s.sol`：部署 `ERC1155PresetMinterPauser` 传 URI，部署后 `grantRole(MINTER_ROLE, deployer)` → 跑 `forge build` 确认编译 → `forge script script/Deploy.s.sol --rpc-url $ALCHEMY_RPC_URL --private-key $OPERATOR_PRIVATE_KEY --broadcast -vv` → 把输出地址告诉用户加到 `.env.local` 的 `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS` → 让用户在 Etherscan 上确认 → `cd ..` → commit。

> **注意**：OZ v5 把 `ERC1155PresetMinterPauser` 移除了。如果安装的是 v5，改用 OZ v4.9.x：`forge install OpenZeppelin/openzeppelin-contracts@v4.9.6 --no-git`。这种小坑是 vibe coding 的常态，不要慌。

## 📝 复述问题
> 为什么 Phase 0 用 OZ 现成合约而不是自己写？

---

# Step 6：POST /api/mint/material

## 🎯 目标
API 端点，前端调用它写一条记录到 `mint_queue`，**立即返回**，不等链上交易。

## 📦 范围
- `src/lib/supabase.ts`（新建）
- `src/app/api/mint/material/route.ts`（新建）
- 安装 `@supabase/supabase-js`

## 🚫 禁止
- ❌ 这个 API 内 import `operator-wallet`（hook 强制）
- ❌ 这个 API 内 `await waitForTransactionReceipt`（hook 强制 + ARCHITECTURE 决策 1）
- 不在这一步做前端调用 UI（Step 7 之后）

## ✅ 完成标准
- curl POST → `{ result: "ok", mintId: "<uuid>" }`
- Supabase Dashboard → mint_queue 看到一条 `status='pending'`
- 同一个 idempotencyKey 第二次请求 → 返回原 mintId

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# 另一个终端：
curl -X POST http://localhost:3000/api/mint/material \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <Privy token>" \
  -d '{"tokenId": 1, "idempotencyKey": "<uuid>"}'
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/
```

## 📖 概念简报
1. **API Route**：Next.js 后端代码。`src/app/api/foo/route.ts` 自动变成 `/api/foo` 接口
2. **乐观 UI**：前端假设操作会成功立刻显示成功，后台异步处理真正的事情。用户感觉极快
3. **idempotency**：同一个操作重复执行多次，结果不变。用唯一 key 防止重复铸造

## 🤖 AI 执行指引
`npm i @supabase/supabase-js`（白名单）→ 写 `lib/supabase.ts`（导出 supabaseAdmin 用 service role key + supabasePublic 用 anon key，加注释"Admin 不能被前端 import"）→ 写 `route.ts`（POST，从 Authorization header 拿 token，PrivyClient 验证拿 userId，按 idempotencyKey 查 → 存在返回原记录，不存在 insert status='pending' → 返回 `{ result: 'ok', mintId }`，try/catch 包住）→ `verify.sh` → 引导用户用 curl + 浏览器拿 Privy token 测试 → commit。

## 📝 复述问题
> 为什么这个 API 不直接调合约 mint，而是写一条数据库记录就返回？

---

# Step 7：手动触发 Cron 处理器

## 🎯 目标
Cron 端点，从 `mint_queue` 取一条 pending，用运营钱包真的发交易上链。手动访问 URL 触发。

## 📦 范围
- `src/lib/operator-wallet.ts`（新建，server-only）
- `src/lib/contracts.ts`（新建）
- `src/app/api/cron/process-mint-queue/route.ts`（新建）
- 安装 `viem`

## 🚫 禁止
- 这次不配 Vercel Cron（手动访问 URL 触发）
- 不在 `cron/` 之外的地方 import operator-wallet（hook 强制）
- 不一次处理多条（必须串行，一次一条，按 ARCHITECTURE 决策 1）

## ✅ 完成标准
- 浏览器访问 `http://localhost:3000/api/cron/process-mint-queue?secret=<CRON_SECRET>`
- 返回 `{ result: "ok", processed: 1 }`
- mint_queue 那条 `status='success'` + 有 `tx_hash`
- OP Sepolia Etherscan 能看到这笔 mint 交易

## 🔍 验证命令
```bash
bash scripts/verify.sh
npm run dev
# 浏览器访问 cron URL
```

## ⏪ 回滚点
```bash
git checkout HEAD -- src/
```

## 📖 概念简报
1. **viem**：跟以太坊交互的 TS 库。从私钥创建钱包客户端，"代替用户"发交易付 gas
2. **Nonce**：以太坊每个地址的"交易序号"，必须递增。同时发两笔会冲突，至少一笔失败。所以**必须串行**
3. **运营钱包模式**：用户不持有 ETH，所有 gas 都由项目方"热钱包"付。链上"接收 NFT 的地址"是用户的，"发交易的地址"是项目方的

## 🤖 AI 执行指引
`npm i viem`（白名单）→ 写 `contracts.ts`（地址 + 最小 abi 子集）→ 写 `operator-wallet.ts`（顶部加 `// SERVER ONLY` 注释 + 用 **`viem/chains` 的 `optimismSepolia`** + privateKeyToAccount）→ 写 cron route（GET，验 secret 否则 401，取一条 pending → update minting_onchain → 查 user evm_address → operatorWalletClient.writeContract({...mint}) → 拿 txHash → waitForTransactionReceipt（这里 OK，cron 不受 hook 约束）→ update success + tx_hash，失败则 retry_count++ 或回到 pending）→ 一次只处理一条 → try/catch → `verify.sh` → 引导用户：先用 Step 6 的 API 写一条 pending → 浏览器访问 cron URL → 看 Supabase + OP Sepolia Etherscan → commit。

## 📝 复述问题
> 为什么 cron 处理器一次只能处理一条 mint，不能并发？

---

# Step 8：验证完整链路 + 庆祝

## 🎯 目标
确认前端 → API → 数据库 → cron → 链上 整条主路通了。

## 📦 范围
- 不写代码
- 跑一次完整流程
- 更新 STATUS.md / TASKS.md

## ✅ 完成标准
- OP Sepolia Etherscan 看到一笔 `Transfer`，from `0x0`，to 用户地址
- 用一句话能告诉别人 "我刚才铸造了一个 NFT"
- STATUS.md 标记 Phase 0 完成
- TASKS.md Done 区有 "Phase 0 全部 8 步"

## 🔍 验证命令
```bash
npm run dev
# 1. 浏览器登录
# 2. curl 调 /api/mint/material
# 3. 浏览器访问 /api/cron/process-mint-queue?secret=...
# 4. Supabase Dashboard 看 mint_queue
# 5. sepolia-optimism.etherscan.io/tx/<tx_hash>
```

## ⏪ 回滚点
失败回到 Step 7 commit，对照流程一段一段查。

## 📖 概念简报
**这是一个里程碑！** 你刚才完成的是 Web3 应用的核心架构：
1. 用户通过 Web2 方式（邮箱）登录
2. 前端不持有任何私钥，所有链上操作通过后端
3. 后端用"队列 + 异步处理"模式，让用户感觉极快
4. 真正的链上交易由"运营钱包"代签代付

这个架构会一直用到 Phase 5。

## 🤖 AI 执行指引
引导用户跑完整流程 → 帮用户解读 Etherscan → 更新 STATUS.md（Phase 0 ✅ + tx hash + 时间）→ 更新 TASKS.md（Step 0-8 移到 Done）→ `bash scripts/checkpoint.sh "Phase 0 完成 — 第一笔 mint 上链"` → LEARNING.md 顶部加一段"🎉 Phase 0 完成"。

## 📝 复述问题
> 用你自己的话告诉一个不懂代码的朋友：你刚才做了什么？

---

# 🎊 Phase 0 完成后

Codex review 流程：
1. 打开 Codex
2. 让 Codex 读：`AGENTS.md` / `STATUS.md` / `docs/CONVENTIONS.md` / 最近 8-10 个 commit 的 diff
3. Codex 输出到 `reviews/2026-MM-DD-phase-0.md`（用 `reviews/PROMPT-TEMPLATE.md` 作起点）
4. 回到 Claude Code，根据 review 修复
5. 决定是否进入 Phase 1

Phase 1 的 playbook 之后会在 `playbook/phase-1/` 目录里展开。

---

## 📌 Phase 0 地图

```
[环境就绪] → [深色页] → [圆+音频] → [登录]
                                         ↓
                                  🛑 中场休息点
                                         ↓
[庆祝🎉] ← [触发链上] ← [写队列 API] ← [部署合约] ← [建表]
```

每个箭头都是一次 commit。8 个 commit 之后，你拥有一个能 mint NFT 的 Web3 应用。
