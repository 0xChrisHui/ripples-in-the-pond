# Review 2026-05-15 — Phase 7 Track B（Semi 钱包前端接入）

**审查范围**：commits `c3c65f6..HEAD` = `1c38349`（B2+B3）+ `da9ccab`（fix 死循环）
**审查者**：Claude（自审）
**整体判断**：⚠️ 有警告（功能 OK，verify 全绿；2 条 P1 / 4 条 P2 待修，无 P0）

---

## 一、架构一致性

- ✅ 没碰链上 / cron / 合约 / Arweave，ARCHITECTURE.md §3 12 条决策均无触碰
- ✅ 没在任何 API Route 中 `await waitForTransactionReceipt`（本次未新增 API Route，全是前端 + 文档）
- ✅ 前端文件零 `operator-wallet` import（grep 验证：`useAuth.ts` / `client-jwt.ts` / `LoginModal.tsx` / `SemiLogin.tsx` 全无）
- ✅ 严格遵守 D-B7：本次完全没碰 `src/lib/chain/operator-wallet.ts`，A1 完结无回归风险
- ✅ 自签 JWT 沿用 Phase 4 已有的 `src/lib/auth/jwt.ts`（jose / RS256），未自建新 JWT 系统

## 二、技术栈合规

- ✅ 零新增 npm 依赖；`useSyncExternalStore` 是 React 18+ 内置 API（项目 React 19）
- ✅ 未引入黑名单包（wagmi / ethers / howler / tone / hardhat / jsonwebtoken）
- ✅ 未引入灰名单包

## 三、坏味道（CONVENTIONS.md §2 七类）

| 类型 | 状态 | 说明 |
|---|---|---|
| 1. 僵化 | ✅ | useAuth 双源化把 Privy / Semi 行为收敛到一个 hook，4 caller 透明兼容（仅改字段名） |
| 2. 冗余 | ⚠️ 轻微 | `client-jwt.ts` 与 `LoginModal.tsx` 各有一套 `listeners + notify + subscribe` pub/sub 模式（client-jwt.ts:36-37 / LoginModal.tsx:17-32）。语义不同（JWT 状态 vs modal 开关），抽通用 store helper 在仅 2 处时属过度抽象。**可接受，下次第三处出现时合并** |
| 3. 循环依赖 | ✅ | `useAuth → LoginModal (openLoginModal)` / `useAuth → client-jwt` / `LoginModal → SemiLogin → client-jwt` — 无环 |
| 4. 脆弱性 | ⚠️ | useAuth 保留 `login` 字段直传 `privy.login`（useAuth.ts:69）做 D-B3 兼容；新 caller 若直觉调 `login()` 会绕过两 tab modal 直弹 Privy，不易察觉。**P2 加注释提示** |
| 5. 晦涩性 | ⚠️ 轻微 | `LoginModal.tsx:14-32` 用 `useSyncExternalStore + module-level isOpen` 替代 React Context，无注释说明这是 React 标准 store 契约。**P2 补一行注释** |
| 6. 数据泥团 | ✅ | `SemiJwtPayload` 已抽 interface（client-jwt.ts:18-22）；useAuth return 字段 9 个但符合 hook 惯例 |
| 7. 不必要的复杂性 | ✅ | 60s setInterval + storage event + listeners 三层兜底是 playbook D-B5 "JWT 过期自动 logout + 跨 tab 同步"的真实需求，非过度设计 |

## 四、安全

- ✅ 无 `console.log(process.env)` 痕迹
- ✅ 无 TODO / 占位符 / mock 数据（grep `TODO` / `FIXME` / `mock` 全无新增）
- ✅ 无硬编码私钥 / API key / 合约地址（SemiLogin 通过 `/api/auth/community*` 后端代理，无 SEMI_API_URL 前端泄露）
- ✅ `.env.local` 未 commit（git status 已确认）
- ⚠️ **localStorage JWT XSS 风险**：明示挂 P10（D-B8 / JOURNAL 2026-05-15 已记）。当前 PoC 阶段接受
- ✅ atob 解码容错：`client-jwt.ts:25-43` 三层防御（parts.length / 字段类型校验 / try-catch JSON.parse），损坏自动 `removeItem`
- ✅ JWT base64url padding 处理（client-jwt.ts:28-29 `==='.slice((b64.length + 3) % 4)`）

## 五、可学性

- ✅ `client-jwt.ts:3-15` 顶部注释解释了"快照引用稳定性"硬要求 + PoC XSS 风险
- ✅ `SemiLogin.tsx:13-17` 状态机 + D-B4 错误分类注释
- ✅ `LoginModal.tsx:5-12` 模块级 state 选择 + Privy tab 用原生 modal 的决策注释
- ✅ `useAuth.ts:18-28` 双源策略 + B1 cache 隔离注释
- ✅ JOURNAL 2026-05-15 段记录决策 + 减项明示（401 自动 logout / 移动端响应式 / 测试号清单）
- ✅ `docs/SEMI-DEMO-SCRIPT.md` 完整（7 步实测 + demo 话术 + 现场踩坑预案）
- ❌ **ERRORS.md 未补 da9ccab 死循环条目**：`useSyncExternalStore getSnapshot` 必须返回稳定引用——这是非显然的 React 18+ 陷阱，**学习价值高，应该写 E0XX**
- ✅ LEARNING.md 无需更新（本次未引入"新概念"，useSyncExternalStore 是修 bug 时学到的"陷阱"而非"概念"）

## 六、Step 范围

playbook `track-b-semi.md` 的 📦 范围字段对比：

| Step | 范围明示 | 实际改动 | 判定 |
|---|---|---|---|
| B2 | `src/components/auth/SemiLogin.tsx`（新建） | ✅ 同 | OK |
| B2 | `src/components/auth/LoginModal.tsx`（新建） | ✅ 同 | OK |
| B2 | `src/components/LoginButton.tsx`（改 onClick） | ✅ 同（实际是 `src/components/auth/LoginButton.tsx`） | OK |
| B2 | **不**新建 LoginEntry / client-jwt | ❌ 新建了 `src/lib/auth/client-jwt.ts` | **越界 1** |
| B3 | `src/hooks/useAuth.ts`（扩双源） | ✅ 同 | OK |
| B3 | **不**新建 `src/lib/auth/client-jwt.ts`（JWT 解码 1 行 atob 直接放 useAuth） | ❌ 同上 | **越界 1（同点）** |
| 隐式 | `src/components/Providers.tsx` 挂 `<LoginModal />` | 改了 | **范围未明示，但 modal 必须挂在某处，可接受** |
| 隐式 | `src/components/MintButton.tsx` / `src/hooks/useFavorite.ts` / `app/me/page.tsx` 改 login → openLoginModal | 改了 | **useAuth signature 变更的连带改动，可接受** |
| 越界 | `app/layout.tsx` 加 `suppressHydrationWarning` | 改了（在 fix commit `da9ccab` 里） | **越界 2 / 越界但合理**：浏览器扩展 hydration mismatch 与 B 系列无关，但实测时同时暴露顺手修；越界但已在 commit message 显式说明 |

**越界 1 已在 JOURNAL 解释**（避免 useAuth ↔ LoginModal ↔ SemiLogin 三角循环依赖、`src/lib/auth/` 6→7 ≤ 8 硬线 OK）。但 playbook 文字未同步修订，**P1 修订 playbook 或加 JOURNAL 回链注脚**。

## 七、Track B 特有审查点

### D-B5 JWT 契约比对

| 契约项 | 实施 | 一致性 |
|---|---|---|
| localStorage key `ripples_auth_jwt` | `client-jwt.ts:17` SEMI_JWT_KEY | ✅ |
| JWT payload `{ userId, evmAddress, iat, exp }` | 实际是 jose 标准 `{ sub, evm, iat, exp, iss, jti }`，前端读 `sub`→userId / `evm`→evmAddress | ⚠️ **字段名差异**：D-B5 写 `userId/evmAddress`，实际是 jose 标准 `sub/evm`。前端 atob 行为正确（playbook 描述抽象层与代码实施有 gap），P1 修订 playbook 字段名或代码加映射注释 |
| 过期判断 `Date.now()/1000 < exp` | `client-jwt.ts:66 Date.now()/1000 >= payload.exp` | ✅ 等价 |
| 过期后 useAuth 视为未登录 + 清 localStorage | ✅ `client-jwt.ts:60-69` | ✅ |
| 失败降级 JWT 失效 → 自动 logout + 提示重登 | ❌ **未做**（明示减项） | **真减项**：D-B5 verify 列了"调任意 /me API 收 401 → 前端 logout"是 must，但当前各 caller 自行 catch 不会自动登出。STATUS / JOURNAL 已记挂 P10 |
| logout: localStorage 删 + 后端可选 revoke | ✅ 前端 删；后端 revoke 未做（D-B5 说"P7 不强制"） | ✅ |

### useSyncExternalStore 引用稳定性（da9ccab fix）

- ✅ 修法标准：`cachedState` 模块级缓存 + `refresh()` 等值检查复用引用 + `ensureSnapshot()` 仅同步初始化（pure 无副作用）+ `ensureSubscribers()` 把 setInterval / storage listener 移到 subscribe 触发点
- ✅ `getServerSnapshot()` 返 stable EMPTY 引用，SSR safe
- ❌ ERRORS.md 未补条目（同五.学习性问题）

### Modal SSR safety

- ✅ `LoginModal.tsx:27 getServerSnapshot` 返 false；client hydrate 后才可能看到 open=true
- ⚠️ Modal 内调用 `usePrivy().login` 直接弹 Privy 原生 modal 时 close 自己的 modal 后再调 login（LoginModal.tsx:91-93）— 顺序合理（避免两个 modal 叠加）

### 跨 tab / 时间触发

- ✅ storage event 监听（client-jwt.ts:91-93）
- ✅ 60s setInterval 兜底 exp 检查（client-jwt.ts:88）
- ✅ 同 tab pub/sub（client-jwt.ts:36-37 + setSemiJwt:99 / clearSemiJwt:106 → refresh:71-80）

### Privy + Semi 用户合并

- ✅ 后端 `auth_identities` + `evm_address` upsert 由 Phase 4 已有的 `middleware.ts` + `community/route.ts` 处理（本次未碰）
- ✅ B1 nft-cache 按 userId 隔离已防双源切换串数据（Phase 6 完成）

### 错误分类（D-B4）

| 类型 | 实施位置 | 状态 |
|---|---|---|
| 手机格式不对 | SemiLogin.tsx:42 `phoneValid = /^\+?[0-9]{5,15}$/` + 提示 | ✅ |
| 60s 内重发禁用 | SemiLogin.tsx:154 `disabled={countdown > 0 \|\| loading}` | ✅ |
| 验证码错（401） | SemiLogin.tsx:75-77 `if (res.status === 401) throw '验证码无效或已过期'` | ✅ |
| 网络错 | SemiLogin.tsx:62-64 / 87-89 catch fallback `'网络错误，请稍后重试'` | ✅ |

---

## 优先修复清单

### P0（必修，阻塞下一 Phase）
- 无

### P1（应修，不阻塞但尽快）

1. **ERRORS.md 加 E0XX `useSyncExternalStore` 引用稳定性陷阱**
   - 触发：1c38349 → da9ccab，dev server 浏览器 `Maximum update depth exceeded` + `getSnapshot should be cached`
   - 为什么会错：`readSemiJwt()` 每次 `new` 一个 `{ jwt, payload }` 对象
   - 怎么修：模块级 `cachedState` + 等值检查复用旧引用
   - 学到的：useSyncExternalStore 的 getSnapshot 必须 referentially stable，每次返回同一份数据时引用必须相等

2. **D-B5 字段名 vs jose 标准差异修订**
   - playbook 写 `{ userId, evmAddress, iat, exp }`，jose `signJwt` 实际写入 `{ sub, evm, iss, jti, iat, exp }`
   - 二选一：① playbook 修文字与代码对齐 ② 代码加显式映射注释 `// sub → userId, evm → evmAddress`
   - 推荐 ②（playbook 是契约抽象，代码实施细节）

### P2（可修，攒到 Phase 末）

3. **useAuth.ts:69 保留 `login` 字段加注释提示新 caller 用 openLoginModal**
   - 当前注释 "旧 caller 兼容（直接弹 Privy，不经 modal）" 描述了 what，没说 don't（新 caller 别用）

4. **LoginModal.tsx:14-32 useSyncExternalStore 模式加一行注释**
   - 说明这是 React 标准 store 契约（subscribe / getSnapshot / getServerSnapshot 三件套）

5. **playbook track-b-semi.md 越界修订**
   - 把 B2/B3 范围里"不新建 client-jwt.ts"删除，或加注 "JOURNAL 2026-05-15 决策：新建一个 lib 文件优于循环依赖"

6. **401 自动 logout 全 caller 覆盖**（D-B5 真减项）
   - 当前各 caller 自行 catch + toast，不自动登出
   - 挂 P10 主网前补 fetch wrapper（fetchWithAuth 统一 401 处理）
   - STATUS 已记，本条仅复述

---

## 表扬

1. **双源化设计干净** — useAuth 把 Privy / Semi 两种登录态收敛到一个 hook，4 处 caller 透明兼容（仅改字段名 `login → openLoginModal`）。Phase 4A S0-S2 把后端 middleware 双通道做完后，前端这次只补 1 个 hook + 1 个 store + 2 个组件即可上线，证明 Phase 4A 当时"先后端后前端"策略正确

2. **da9ccab 死循环 fix 找到根因** — 没有用 `useState + useEffect` 临时绕过，而是精确定位到 `useSyncExternalStore` 引用稳定性硬要求；修法标准（cachedState + 等值检查 + 副作用挂 subscribe 保 pure），React 官方推荐的 module store 模式

3. **文档同步完整** — STATUS / TASKS / JOURNAL / SEMI-DEMO-SCRIPT 一次到位，减项明示（401 自动 logout / 移动端响应式 / 测试号清单 / D-B5 字段名 gap）。三个月后看 JOURNAL 能立刻还原决策上下文

---

## 二审差异（codex review 整合）

**Codex 跑 `codex review --base c3c65f6` 后只输出 2 条 finding（均原标 P2），但都是 Claude 自审漏掉的真问题，本次整合时升 P1**：

### Codex-1（升 P1）— useAuth `ready` 仅看 Privy

- **位置**：`src/hooks/useAuth.ts:31`（原版）
- **问题**：回访 Semi 用户已有有效 JWT 时 `semiAuth` 同步可用，但 `ready` 直接 = `privy.ready`；Privy SDK 初始化慢 / 网络阻塞时 `ready=false` → `LoginButton` / `/me` 都返 null → Semi 用户看到空白
- **修法**：`const ready = privyReady || semiAuth`（已应用，加注释指明 codex review 来源）
- **影响**：真 bug，Semi 用户体验回归。Claude 自审清单完全漏了"双源化 = 不仅 authenticated 双源，ready 也要双源"

### Codex-2（升 P1）— SEMI-DEMO-SCRIPT 步骤 6 vs 实际 UI 不符

- **位置**：`docs/SEMI-DEMO-SCRIPT.md:26`
- **问题**：脚本写"右上角显示 evm 地址"，但 `LoginButton.tsx:30-43` 已登录态实际显示"我的音乐 / 登出"，**没有地址**。Phase 5 commit `1bb1b05` 后的设计决策：地址不主动暴露，跳转 /me 才是用户期待的"地址"语义
- **修法选择**：① 改 UI 暴露地址（推翻 Phase 5 决策，太重）vs ② 改脚本不靠 UI 校验地址，用 DevTools localStorage JWT 或 Etherscan tx 校验（轻、零回归）
- **采纳 ②**：脚本第 6 步改"DevTools 看 ripples_auth_jwt payload 的 evm 字段 或 Etherscan mint tx 的 to 地址"

### 为什么 Claude 自审漏了这两点

- **Codex-1**：写代码时 mental model 只跟踪 "authenticated 状态" 双源，没把 ready 一起带过来。这是单 AI 写代码 + 自审的盲区典型——`ready` 字段在 useAuth 旧版直接透传 Privy，惯性继承
- **Codex-2**：写脚本时凭"印象"以为 LoginButton 显示地址（Phase 5 早期版本可能确实显示过？），没回头看 `LoginButton.tsx:30-43` 当前实际代码。这是文档写作时"代码盲跑"

**结论**：Codex review 价值确认 —— 第二 AI 没有写代码时的执念，能抓到惯性盲区。两条 P2→P1 都已修。

