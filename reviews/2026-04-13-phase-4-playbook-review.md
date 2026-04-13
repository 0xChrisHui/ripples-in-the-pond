# Phase 4 Playbook Review

日期：2026-04-13  
范围：`playbook/phase-4-community.md`

## 结论

这版 Phase 4 playbook 的方向是合理的，抓住了 4 个真正有价值的主题：

- 社区钱包第二登录入口
- 双认证体系
- 运营可观测性补齐
- 空投基础设施

但按“现在就能安心开工”的标准看，我认为它还没有完全冻结。  
最大的问题不是某个 step 写漏了，而是 **认证协议、用户模型、空投资格语义** 这 3 个基础定义还没有真正收口。现在直接推进，最容易出现的不是小 bug，而是做到一半才发现“底座假设是错的”。

---

## Findings

### [P0] playbook 把 Semi 写成 “OAuth2”，但参考实现实际是自家 Bearer token，不是标准 OAuth2

位置：
- `playbook/phase-4-community.md:15`
- `playbook/phase-4-community.md:119`
- `playbook/phase-4-community.md:121`
- `references/semi-backend/api.md:58`
- `references/semi-backend/api.md:187`
- `references/semi-backend/app/controllers/application_controller.rb:10`

问题：

playbook 反复使用了“Semi OAuth2”“授权页”“回调后拿 semiToken”这套语言，但参考实现里我看到的是：

- `POST /signin`
- `POST /signin_with_email`
- `POST /signin_with_password`
- `GET /get_me`
- Bearer `auth_token`

而不是标准 OAuth2 的：

- authorization endpoint
- authorization code
- redirect URI
- token exchange
- refresh token

也就是说，当前参考资料支撑的是“拿到 Semi 自家 auth_token，再调 `/get_me`”，而不是“接一个标准 OAuth2 provider”。

这不是措辞问题，而是协议层面的差异。  
如果这里不先冻结，S1/S2 的前后端接口、UI 交互、回调处理、错误恢复都会跟着打架。

建议：

- 开工前先把协议名字说准
- 先做一个 **S0 spike / protocol memo**：
  - Semi 到底有没有标准 OAuth2
  - 如果没有，你们实际采用的是哪条登录链路
  - semiToken 是谁签发、怎么拿、多久过期、能不能刷新
- 只有这件事明确，S1/S2 才能真正开始写

---

### [P0] 当前 `users` 表结构和 playbook 的“双入口同一用户模型”并不兼容

位置：
- `supabase/migrations/phase-0-2/001_initial_minimal.sql:8`
- `playbook/phase-4-community.md:17`
- `playbook/phase-4-community.md:18`
- `playbook/phase-4-community.md:85`

问题：

现在库里的 `users` 表是：

- `evm_address text not null unique`
- `privy_user_id text not null unique`

而 playbook 想要的是：

- Semi 用户首次登录自动入库
- 和 Privy 用户共享同一张 `users` 表
- 通过 `evm_address` 关联

这里有 3 个硬冲突：

1. Semi 用户首次入库时，`privy_user_id` 从哪来  
当前 schema 不允许为空。

2. 如果某个 Semi 用户还没有钱包地址，`evm_address` 从哪来  
当前 schema 也不允许为空。

3. 如果同一个真人既能用 Privy 登录，又能用 Semi 登录  
“一张 users 表 + 一个 `auth_provider` 字段”并不能优雅表达“一人多身份源”。

这说明 playbook 里写的“通过 evm_address 关联同一用户”，现在还只是口号，不是已经闭环的数据模型。

建议：

- 不要再在 `users` 表上硬塞身份源语义
- 更稳的方案是：
  - `users` 只代表站内用户
  - 新增 `auth_identities` 表，记录 `provider / provider_user_id / user_id`
  - `users.evm_address` 是否必填，单独冻结
- 如果你们坚持不建 `auth_identities`
  - 那至少也要先明确：`privy_user_id` 是否改 nullable，`evm_address` 是否改 nullable
  - 以及“同一人双登录源合并”的规则

---

### [P0] S0 写了双验证中间件，但 playbook 没把现有受保护 API 的迁移范围写进去

位置：
- `playbook/phase-4-community.md:63`
- `playbook/phase-4-community.md:104`
- `playbook/phase-4-community.md:123`
- `app/api/score/save/route.ts:14`
- `app/api/mint/score/route.ts:20`
- `app/api/mint/material/route.ts:10`
- `app/api/me/scores/route.ts:11`
- `app/api/me/score-nfts/route.ts:12`
- `app/api/me/nfts/route.ts:12`

问题：

playbook 里最危险的“遗漏”是：它写了一个新的 `auth-middleware.ts`，但没有把“哪些现有 API 要切过去”列成明确范围。

而现实代码里，当前几乎所有受保护接口都还是：

- 各自 new `PrivyClient`
- 各自 `verifyAuthToken`
- 各自按 `privy_user_id` 查人

这意味着就算 S1 做完、Semi 用户能拿到自签 JWT：

- `/api/score/save` 还是 401
- `/api/mint/score` 还是 401
- `/api/mint/material` 还是 401
- `/api/me/*` 还是 401

也就是说，**登录成功 ≠ 产品可用**。  
如果 playbook 不把这部分纳入范围，S2 很可能出现“看起来登录成功了，但后面一碰就炸”的假完成。

建议：

- 把“所有受保护 API 迁移到 `authenticateRequest()`”单独列成一个 step
- 至少要盘点这 6 类接口：
  - `/api/score/save`
  - `/api/mint/score`
  - `/api/mint/material`
  - `/api/me/scores`
  - `/api/me/score-nfts`
  - `/api/me/nfts`
- completion standard 不能只写“拿到 JWT”，必须写“Semi 用户能完整走完至少 1 条真实业务链路”

---

### [P1] 空投资格快照建立在 `mint_events.user_id` 上，但 playbook 写的却是“持有者”

位置：
- `playbook/phase-4-community.md:25`
- `playbook/phase-4-community.md:208`
- `playbook/phase-4-community.md:209`
- `app/api/cron/sync-chain-events/route.ts:7`

问题：

playbook 在文字上说的是：

- “所有持有 ScoreNFT 的用户”

但实现建议写的是：

- “从 `mint_events` 查”
- `airdrop_recipients` 关联 `user_id`

这两者不是一回事。

`mint_events.user_id` 表示：

- 谁当初 mint 了它

它不表示：

- 谁现在还持有它

尤其你们已经在 Phase 3B 做了 `chain_events`，这说明项目已经承认“链上 owner 会变”。  
那 Phase 4 空投如果还按 `mint_events` 快照，语义上就是错的。

更麻烦的是：如果 NFT 被转给站外地址，当前系统里甚至可能没有对应 `users.id`。  
那 `airdrop_recipients(round_id, user_id)` 这个模型从一开始就会漏人。

建议：

- 先冻结空投资格单位到底是什么：
  - 按当前 holder address
  - 按站内 user
  - 按 token
  - 还是按去重后的 wallet
- 如果按“持有者”发
  - 快照主键应优先是 `wallet_address`，不是 `user_id`
  - 数据源应优先来自 owner projection，不是 `mint_events`
- 只有在资格单位冻结后，S5 的表结构才能真正定下来

---

### [P1] “空投复用 ScoreNFT 合约”会把资产语义混在一起，但 playbook 没把隔离成本写出来

位置：
- `playbook/phase-4-community.md:26`
- `playbook/phase-4-community.md:216`
- `playbook/phase-4-community.md:217`
- `app/score/[tokenId]/page.tsx:38`
- `src/data/score-source.ts:28`

问题：

playbook 现在假设：

- 空投 NFT 复用 `ScoreNFT`
- 甚至复用 `MintOrchestrator.mintScore`

这在链上当然能做，但产品语义会立刻变复杂：

- ScoreNFT 原本代表“用户 jam 录制的乐谱”
- 空投 NFT 则代表“运营侧发布的奖励/纪念内容”

如果两者进同一个 ERC-721 collection，就必须同步回答这些问题：

- `/score/[tokenId]` 是否还对所有 tokenId 成立
- `/me` 里的“我的乐谱”要不要混入空投
- `/artist` 的统计口径算不算空投
- `mint_events.score_data` 对空投 token 填什么
- metadata 里的 `animation_url` 是不是也要保持可播放

现在 playbook 只写了“复用”，没有把这些二次影响纳入范围。  
这会让 S5 看起来很省事，实际在 S6 或后续页面里再补债。

建议：

- 先冻结资产策略：
  - 方案 A：继续共用 `ScoreNFT`，但必须新增 `kind = 'score' | 'airdrop'`
  - 方案 B：直接拆成独立 `AirdropNFT`
- 如果坚持共用合约
  - playbook 必须把 DB / API / `/me` / `/score` / stats 的类型隔离一起写进去

---

### [P1] 自签 JWT 只有“签发与验证”，没有“撤销与轮换”，对第二套登录体系来说不够

位置：
- `playbook/phase-4-community.md:58`
- `playbook/phase-4-community.md:59`
- `playbook/phase-4-community.md:123`
- `docs/HARDENING.md:139`

问题：

当前 playbook 对自签 JWT 的定义是：

- RS256
- 7 天有效期
- 存 `localStorage`
- logout 时本地清理

这对“第一套、临时过渡”的 token 也许够用，但对“正式第二登录体系”来说还不够。  
尤其 `docs/HARDENING.md` 已经明确提过：

- `jti`
- 黑名单
- JWT_PRIVATE_KEY / JWT_PUBLIC_KEY

如果这次不至少做最小版撤销模型，就会出现：

- token 泄漏后 7 天内不可撤销
- 退出登录只是“退出当前浏览器”，不是“撤销该 token”
- 后续要补黑名单时，还要回头改 payload 协议

建议：

- S0 就把 `jti` 放进 payload
- 至少预留 `jwt_blacklist` 表或 `system_kv` 级别的撤销入口
- 明确 key rotation 策略：未来换公私钥时旧 token 怎么处理

---

## 建议重排

我建议把当前 6 步改成 3 段，而不是按“页面 / cron / 空投”平铺：

### Phase 4A：认证底座

1. 先做 Semi 协议 spike，确认它到底是不是 OAuth2
2. 再冻结用户模型：`users` 还是 `users + auth_identities`
3. 再把所有受保护 API 迁到统一双验证入口
4. 最后才上前端登录按钮

### Phase 4B：运营与观测

1. `check-balance`
2. `/api/health` 增强
3. `/artist` 页面

这块和认证解耦，完全可以并行推进。

### Phase 4C：空投

1. 先冻结资格语义：holder / minter / user / wallet / token
2. 再冻结资产语义：复用 `ScoreNFT` 还是独立合约
3. 然后才写 rounds / recipients / trigger / cron

---

## CTO 总判断

如果把这版 playbook 定义为“方向版”，我认为是成立的。  
如果把它定义为“明天就能安全开工的施工图”，我认为还差一轮收口。

我最建议你们现在先补的不是代码，而是 3 个冻结决定：

1. Semi 到底是不是 OAuth2，真实登录协议是什么
2. 一个人有两个登录源时，站内身份模型怎么表达
3. 空投到底奖励“谁”以及奖励“什么资产”

这 3 个问题一旦答清，Phase 4 会明显变顺。  
如果不先答清，最容易出现的就是 S1-S2 做出一半，才发现整条链路的真理源不一致。
