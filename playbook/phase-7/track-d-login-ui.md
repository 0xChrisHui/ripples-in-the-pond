# Track D — 登录 UI 抄社区钱包 + Semi 默认 + /me 跳社区钱包按钮

> **范围**：Track B 接通 Semi 登录主代码后，UI 层的三件小事并入一个 Track。
>
> **前置**：Track B B2/B3 已完成（commit `da9ccab` + `1c38349`），用户线下 B4a/B4b 已确认（2026-05-15）。
>
> **核心交付物**：
> - 登录 modal UI 抄 `references/community wallte/semi-app` 结构（保留深色）
> - 默认登录方式从「邮箱（Privy）」改为「手机号（Semi 社区钱包）」
> - Semi 登录的用户在 `/me` 右上角看到「↗ 社区钱包」按钮，外链到 `https://app.ntdao.xyz/`
>
> **来源**：用户原话 2026-05-15 "登录界面用 references/community wallte 的 UI 设计方案 / 默认基于社区钱包手机号登录 / Semi 登录在 /me 右上角增加跳转按钮"
>
> **风格 4 项答案（用户 2026-05-15 拍板）**：
> 1. **保留深色，抄结构**（不引入浅色卡片，避免与全站冲突）
> 2. **6 格分离 PIN 框**（对齐 semi-app UPinInput 体验）
> 3. **保留全站 modal**（不拆 /login 路由，4 个 caller 不动）
> 4. **Semi 登录时替换「← 首页」为「↗ 社区钱包」**（互斥，不挤位）
> 5. **附加**（用户 2026-05-15 二次补充）：点击底部「邮箱登录」**直接弹 Privy 原生 modal**，省一次中间点击

---

## 冻结决策

### D-D1 — 登录 modal 不拆 /login 路由（沿用 D-B6）

D-B6 已冻结"Semi 登录走 Header modal 单例"，Track D 不推翻，只重设计 modal 内部布局。理由：4 个 caller（LoginButton / MintButton / useFavorite / `/me`）已稳定使用 `openLoginModal`，拆路由属于 P8 UI 翻修级别动作，与"修严重 BUG + Semi + 提速"P7 主线脱节。

### D-D2 — 视觉路线：深色 + 抄结构

semi-app 原图是浅色卡片 + Nuxt UI 主题。Track D **不引入浅色**，仅复用：
- 左上"← 返回"按钮 + 右上"✕"按钮（双关闭入口）
- 大标题（"登录" / "验证码"）+ 副标题（"输入你登录用的手机号" / "请输入收到的 6 位验证码 发往 138...0000"）
- 全宽 input + 全宽主操作按钮的纵向布局
- 底部辅助链接（"用邮箱登录"）

颜色继续走 `bg-zinc-950` / 白字 / `border-white/10` 这一套，与全站深色一致。

### D-D3 — Tab 切换 UI 移除，Semi 永远主显

用户决策"默认社区钱包手机号"= Semi 永远是主流程，不存在「Privy / Semi 二选一」对等场景。所以：
- 移除 LoginModal 当前的两个 tab 圆形按钮
- 主区域直接渲染 SemiLogin
- "用邮箱登录"降级为底部一行小链接，点击 → `closeLoginModal()` + `privy.login()` 直接弹 Privy 原生 modal

**回滚位**：万一未来要恢复双 tab，git 可查 commit `1c38349`（Track B B2/B3 落地版本）。

### D-D4 — 邮箱登录直跳 Privy（不做异步跳转）

用户 2026-05-15 二次补充："点击邮箱登录直接跳转 privy，节省异步跳转步骤"。当前 LoginModal Privy tab 下还有一个"用邮箱登录"按钮（多一次点击），D-D3 调整后该按钮消失，邮箱入口直接是底部链接 → privy.login()，省一步。

### D-D5 — PinInput 抽独立组件（控行数硬线）

SemiLogin 现 159 行，加 6 格 PIN + 阶段标题/副标题 + masked phone 显示会破 220 硬线。抽 `src/components/auth/PinInput.tsx`：
- 6 个 input ref（数组）
- 输入数字自动跳格 + 退格回退
- 支持粘贴 6 位数字自动分发
- `inputMode="numeric"` + 第一个 input 标 `autoComplete="one-time-code"`（iOS 短信自动填）

**前置 ls 检查**：`src/components/auth/` 当前 2 文件（LoginModal / SemiLogin），加 PinInput → 3 ≤ 8 ✅。

### D-D6 — /me 顶栏「← 首页」与「↗ 社区钱包」互斥

按用户答案"Semi 登录时替换「← 首页」":
- `authSource === 'semi'` → `<a href="https://app.ntdao.xyz/" target="_blank" rel="noopener noreferrer">↗ 社区钱包</a>`
- 否则保留 `<Link href="/">← 首页</Link>`

useAuth 已暴露 `authSource: 'privy' | 'semi' | null`（Track B B3 commit `1c38349` 内已实施），不用扩 hook。

### D-D7 — 外链 URL 硬编码 vs env

`https://app.ntdao.xyz/` 走**硬编码常量**，不进 env：
- Semi 社区钱包域名是用户给的固定地址，未来变更概率低
- 改 env 反而增加 Vercel 三环境同步负担
- 一旦真要换，搜代码一处即可

**对照参考**：D-D7 与 D-B7（chain 配置抽 single source）走相反方向 — chain config 是 30+ 处硬编码 + 主网/测试网切换风险，必须抽；外链 URL 单点常量无切换需求。

### D-D8 — 不动 useAuth / Providers / 4 caller

Track D 严守"UI 层"边界，不碰：
- `src/hooks/useAuth.ts`（B3 已完成双源化）
- `src/components/Providers.tsx`（B3 已挂 LoginModal）
- `src/components/LoginButton.tsx` / `MintButton.tsx` / `useFavorite.ts` / `app/me/page.tsx` 的 `openLoginModal` 调用（B3 已迁移）

唯一修 `app/me/page.tsx` 的部分是顶栏右上角条件渲染（D3 范围），不动登录入口逻辑。

---

## 📋 Step 总览

| Step | 内容 | 工时 | 依赖 | 改文件数 |
|---|---|---|---|---|
| [D1](#step-d1--loginmodal-重设计) | LoginModal 抄结构 + 移除 tab + 默认 Semi + 邮箱直跳 Privy | 0.3 天 | 无 | 1 |
| [D2](#step-d2--semilogin-两阶段布局--pininput-组件) | SemiLogin 两阶段重布局 + PinInput 抽组件 | 0.5 天 | D1 | 2（改 SemiLogin + 新建 PinInput）|
| [D3](#step-d3--me-顶栏条件按钮) | /me 右上角按 authSource 切换「← 首页」/「↗ 社区钱包」 | 0.2 天 | 无（与 D1/D2 完全独立）| 1 |
| [D4](#step-d4--端到端-smoke--commit) | 7 步浏览器实测 + commit | 0.3 天 buffer | D1/D2/D3 全部完成 | 0 |

**Track D 总工时**：约 1.3 天（含验证 buffer）

**起点选择**：D1 与 D3 完全独立，可以任一开始。AI 默认建议 **D3 起手**（最小风险、5 分钟可见效果），再做 D1 → D2。用户可裁决。

---

## Step D1 — LoginModal 重设计

### 概念简报

当前 `LoginModal.tsx`（127 行）的结构是「头部 + 双 tab 按钮 + tab 内容」。Track D 后变成「头部（含返回箭头）+ 主区域 SemiLogin + 底部邮箱链接」。tab 切换的 useState、setTab、tab 按钮三段全部删掉，整体反而变短（预估 90-110 行）。

### 📦 范围（环境：本地）

- `src/components/auth/LoginModal.tsx`（仅此一个文件）
- **不改**：openLoginModal / closeLoginModal / subscribe / getSnapshot 等模块级 store API（其他 caller 依赖）

### 做什么

1. **删 tab state**：移除 `const [tab, setTab] = useState<Tab>('privy')` + 两个 tab 圆形按钮 JSX + `type Tab = ...`。
2. **头部加左上返回箭头**：与右上"✕"对称（两者都触发 `closeLoginModal()`）。返回箭头用 `←` 字符或 inline SVG，不引入 icon 包（STACK 黑名单未列 lucide-react 但能省一个依赖最好）。
3. **主区域直接渲染 `<SemiLogin onSuccess={closeLoginModal} />`**（无 tab 包装）。
4. **底部加邮箱链接**：
   ```tsx
   <button
     type="button"
     onClick={() => { closeLoginModal(); privyLogin(); }}
     className="mt-4 flex w-full items-center justify-end gap-1 text-xs text-white/40 transition-colors hover:text-white/70"
   >
     ✉ 用邮箱登录
   </button>
   ```
5. **保留**：背景 `bg-black/80 backdrop-blur-sm`、modal 容器 `bg-zinc-950 border-white/10 rounded-2xl`、点击外层关闭、`e.stopPropagation()` 防穿透。

### 验证标准

- [ ] 用户浏览器实测：点 LoginButton → modal 浮出 → 默认看到手机号 input（不是邮箱按钮）
- [ ] 左上"← 返回"+ 右上"✕"都能关 modal
- [ ] 点击底部「✉ 用邮箱登录」→ modal 关 + Privy 原生 modal 立即弹（不需要中间一次点击）
- [ ] modal 行数 ≤ 130（hook 强制 220 硬线，留余量）
- [ ] verify.sh 通过（TS / ESLint / 行数 / build）
- [ ] **不要碰**：openLoginModal 模块导出（4 caller 已绑死）

### 风险

- **Privy SDK 初始化慢**时（privyReady=false），点底部邮箱链接调 `privy.login()` 可能 no-op。当前 LoginButton 在 ready=false 时返 null（B3 已实施），但 modal 内的邮箱链接没这个保护。**降级**：邮箱按钮 disabled 状态依据 `usePrivy().ready` 控制，未 ready 时显示「邮箱登录加载中…」。

---

## Step D2 — SemiLogin 两阶段布局 + PinInput 组件

### 概念简报

semi-app 的 `login.client.vue`（phone 阶段）+ `verifyphone.client.vue`（code 阶段）是**两个独立路由页**。Track D 把这两段塞进同一个组件的 phase 状态机（D1 决定的 modal 模式）。视觉抄它的纵向骨架：返回按钮（已在 modal 头部）→ 大标题 → 副标题 → 输入区 → 主操作按钮。

### 📦 范围（环境：本地）

- `src/components/auth/SemiLogin.tsx`（改写布局，保留所有现有逻辑：phase 状态机 / 倒计时 / 发码 / 验证 / 错误分类 / setSemiJwt 调用）
- `src/components/auth/PinInput.tsx`（**新建**，6 格 PIN 输入）
- **前置 ls 检查**：`src/components/auth/` 当前 2 文件 → 加 PinInput → 3 ≤ 8 ✅

### 做什么

**SemiLogin 阶段 1（phone）**：
```
登 录          （text-2xl font-light tracking-widest 居中）
输入你登录用的手机号  （text-sm text-white/50 居中）

[ +86 138 0000 0000 ]   （size-xl input，placeholder 居中或左对齐）

[      下 一 步      ]   （全宽 button，rounded-full border-white/20 bg-white/10）

错误条（如果有）        （text-xs text-red-400 居中）
```

**SemiLogin 阶段 2（code）**：
```
验 证 码        （同 phase 1 样式）
请输入收到的 6 位验证码  （副标题 1）
发往 138...0000      （副标题 2，masked phone）

[ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]   （PinInput，6 格分离）

[ 58s 后重发 ]                   （倒计时按钮，倒计时归零变"重发"）
[      验  证      ]              （全宽主按钮）

错误条（如果有）
```

**PinInput 组件**：
- props: `value: string`（受控） / `onChange: (v: string) => void` / `disabled?: boolean` / `length?: number = 6`
- 6 个 input ref（`useRef<HTMLInputElement[]>`）
- 输入数字字符 → 写当前格 + 跳下一格
- 退格 → 当前格非空清当前；当前格空回退上一格
- 粘贴（onPaste）→ 提取 6 位数字分发到 6 格 + focus 末格
- 第一个 input 标 `autoComplete="one-time-code"`，其他空（iOS 短信自动填只触发第一格，之后由 onChange 自动分发）
- 每格视觉：`size-12 rounded-lg border border-white/10 bg-black/40 text-center text-xl text-white focus:border-white/40 outline-none`
- 行数预估：≤ 80 行

**masked phone 实现**：复用 semi-app 写法 `${phone.slice(0, 3)}...${phone.slice(-4)}`，国际号码（+86 开头）截断后仍清晰。

### 验证标准

- [ ] phone 阶段：标题居中、input 全宽、按钮全宽，整体视觉接近用户拍板的 preview
- [ ] code 阶段：6 格分离 PIN + masked phone 副标题 + 倒计时按钮
- [ ] PinInput：iOS Safari + Android Chrome 实测短信自动填能填进第一格 → 触发自动分发
- [ ] PinInput：粘贴 "123456" 到第一格自动分发 6 格
- [ ] PinInput：退格行为符合预期（清当前 / 回退）
- [ ] SemiLogin 文件 ≤ 200 行；PinInput 文件 ≤ 80 行
- [ ] verify.sh 全绿
- [ ] **不要破坏**：phase 状态机、60s 倒计时、setSemiJwt 调用、错误 4 分类（D-B4）

### 风险

- **iOS one-time-code 行为不稳**：分离格的 autoComplete OTP 在不同 iOS 版本表现不一。降级方案：如果分发失败，用户可以手动逐格输或粘贴。**不要回退到单 input**（用户已拍板要 6 格）。
- **粘贴非数字**：onPaste 必须 filter `/\d/`，不要把字母 / 空格 / 加号塞进格子。
- **完成自动提交可选**：6 格填满后自动调 submit() 还是要用户点"验证"？建议**填满后 button 高亮但不自动 submit**（避免 iOS 输入法把自动填错认成完成）。

---

## Step D3 — /me 顶栏条件按钮

### 概念简报

`app/me/page.tsx:170-173` 当前是固定的 `<Link href="/" className="text-xs text-white/30 hover:text-white/50">← 首页</Link>`。改成按 useAuth 暴露的 `authSource` 切换。useAuth 已 return `authSource: 'privy' | 'semi' | null`（B3 已实施），不需要扩。

### 📦 范围（环境：本地）

- `app/me/page.tsx`（仅顶栏右上角的一段 ~5 行）
- **不改**：登录入口逻辑、fetch 三件套、ScoreNftSection / DraftSection 等

### 做什么

1. 从 useAuth 解构加 `authSource`：
   ```ts
   const { ready, authenticated, openLoginModal, getAccessToken, userId, authSource } = useAuth();
   ```
2. 顶栏右上角条件渲染：
   ```tsx
   {authSource === 'semi' ? (
     <a
       href="https://app.ntdao.xyz/"
       target="_blank"
       rel="noopener noreferrer"
       className="text-xs text-white/30 hover:text-white/50"
     >
       ↗ 社区钱包
     </a>
   ) : (
     <Link href="/" className="text-xs text-white/30 hover:text-white/50">
       ← 首页
     </Link>
   )}
   ```
3. 外链必须有 `rel="noopener noreferrer"`（防 reverse tabnabbing）。

### 验证标准

- [ ] Privy 用户进 /me：顶栏右上仍是「← 首页」→ /
- [ ] Semi 用户进 /me：顶栏右上是「↗ 社区钱包」→ 新窗口 https://app.ntdao.xyz/
- [ ] 未登录但有缓存 NFT 的访客（`authSource === null` 且 nfts.length > 0）：顶栏右上是「← 首页」（按 fallback 分支走 Privy 侧 UI 一致）
- [ ] 切换登录源（Privy logout → Semi login）后 /me 顶栏立即更新（useAuth useSyncExternalStore 已保证）
- [ ] verify.sh 全绿
- [ ] page.tsx 总行数 ≤ 215（当前 205 + 约 8 行新增 = 213，在 220 硬线内）

### 风险

- **page.tsx 接近 220 硬线**：当前 205 行 + 新增约 8 行 = 213。若进一步触线（如 D4 实测发现要加副标题），考虑把顶栏抽 `MeHeader` 组件。**当前不预防性重构**（CONVENTIONS §4.2 "不做预防性优化"）。
- **外链域名变更**：`app.ntdao.xyz` 若 Semi 团队换域名，硬编码点一次。挂"悬空 TODO"追踪即可，不进 env。

---

## Step D4 — 端到端 smoke + commit

### 前置

D1 / D2 / D3 全部完成 + verify.sh 全绿。

### 📦 范围（环境：本地浏览器 + Semi production API + 真测试号）

- 无代码改动；纯实测
- `docs/SEMI-DEMO-SCRIPT.md` 加 Track D 段（可选，**仅在用户要求**时加）

### 做什么

按用户拍板的视觉 + UX，跑 7 步：

1. **退出登录**（DevTools 清 localStorage `ripples_auth_jwt` + Privy logout）
2. **点 Header 登录按钮** → modal 浮出 → **默认看到手机号 input**（不是邮箱按钮、不是 tab 切换）
3. **左上「← 返回」**关 modal，再开一次（测两个关闭入口）
4. **输测试号 → 下一步** → 进 code 阶段 → 副标题显示"发往 138...0000"
5. **6 格 PIN 输入验证码**（iOS 测试自动填能进第一格触发分发）
6. **验证** → modal 关 → /me 顶栏右上**显示「↗ 社区钱包」** → 点击新窗口打开 `https://app.ntdao.xyz/`
7. **退出 Semi → 重开 modal → 点底部「✉ 用邮箱登录」** → **Privy 原生 modal 立即弹**（不需要中间一次点击）→ Privy 登录后 /me 顶栏右上恢复**「← 首页」**

### 验证标准

- [ ] 7 步全过
- [ ] DevTools localStorage 中 `ripples_auth_jwt` 在 Semi 登录后存在、Privy 登录后不存在（双源互斥）
- [ ] verify.sh 全绿
- [ ] commit 一次（type=feat / scope=ui，concepts: login-modal, pin-input, semi-auth-source）

### 风险

- **iOS 短信自动填**：若 iOS 实测分发失败 → 不阻塞 D4 收口（PinInput 仍支持手输 + 粘贴），但要在 STATUS"悬空 TODO"记一笔"iOS OTP 分发 Phase 8 验证"。
- **app.ntdao.xyz 域名访问**：测试期间确认外链可达；若 Semi 团队后端在维护中，链接打开 404 不算 Track D bug。

---

## Track D 完结标准

- [ ] D1 / D2 / D3 / D4 全部 ✅
- [ ] `bash scripts/verify.sh` 全绿
- [ ] 用户浏览器实测 7 步全过
- [ ] STATUS.md / TASKS.md 同步（Phase 7 范围加 Track D；下一步指向 Phase 7 剩余 Track A）
- [ ] JOURNAL 加 2026-05-XX 段记录 D-D1 ~ D-D8 决策清单
- [ ] commit message 含 concepts: `login-ui-redesign, pin-input, default-semi-tab, external-wallet-link`

---

## 不在 Track D 范围（明确挪走）

- ❌ **桌面 vs 移动端布局重设计** → Phase 8 UI 翻修
- ❌ **错误态视觉升级**（toast 系统 / 内联错误条美化）→ Phase 8
- ❌ **拆 /login + /verifyphone 独立路由** → 永久不做（D-D1 沿用 D-B6）
- ❌ **Privy 原生 modal 二次封装** → 不做（保留 Privy SDK 自带 UI）
- ❌ **Semi 社区钱包 deep-link 集成**（如 `nantang://wallet/...`）→ Phase 10 主网部署后视用户量评估
- ❌ **多语言 i18n**（semi-app 用 useI18n）→ 全站还没 i18n 框架，不在 P7 范围

---

## 与其他 Track 的依赖关系

```
A1（chain 配置）─────── Track D 完全独立（不碰 operator-wallet.ts）
B2/B3（Semi 主代码）── Track D 前置（已完成 2026-05-15）
B4a/B4b（Semi smoke）─ Track D 前置（已完成 2026-05-15）
C3（/me API 拆 split）── Track D 不依赖（D3 仅改顶栏 UI）

Track D 内部：D1 / D3 完全独立；D2 依赖 D1；D4 依赖 D1+D2+D3
```

Track D 起点 **D1 或 D3 任选**，与 Track A 剩余 step（A3+A12 / A4 / A5 / A6 …）完全可并行。

---

## 风险 / 反悔机制

- **D-D3 移除 tab 切换争议**：若用户在 D4 实测后觉得"邮箱链接太小不显眼"，可在 D2 收口后 commit + Track D-revisit step 加回更显眼的「邮箱登录」按钮（不退回 tab 切换）。
- **D-D7 外链硬编码 vs env 争议**：若 Semi 团队后续给"不同环境不同域名"（如 test.ntdao.xyz / app.ntdao.xyz），抽 `NEXT_PUBLIC_COMMUNITY_WALLET_URL` env 即可，挂 P10 主网起点清单。
- **PinInput iOS 行为不稳**：见 D2 风险段；不阻塞 P7 完结，挂 P8 改进项。

---

## 参考

- semi-app 抄结构来源：
  - `references/community wallte/semi-app/pages/login.client.vue`（phone 阶段）
  - `references/community wallte/semi-app/pages/verifyphone.client.vue`（code 阶段 + 6 PIN + masked phone + 倒计时）
  - `references/community wallte/semi-app/pages/email-login.client.vue`（邮箱入口对照）
- Track B 主代码：
  - `src/components/auth/LoginModal.tsx`（B2 commit `1c38349`）
  - `src/components/auth/SemiLogin.tsx`（B2 commit `1c38349`）
  - `src/hooks/useAuth.ts`（B3 commit `1c38349` + `da9ccab` 修 store 引用稳定）
- 用户决策来源：本会话 2026-05-15（"补充，点击邮箱登录直接跳转 privy" 二次确认 + 视觉 4 项答案 preview）
