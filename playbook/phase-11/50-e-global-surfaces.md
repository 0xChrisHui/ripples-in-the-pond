# Track E — 全局表面整合

> **目标**：把首页入口、登录、全局播放器、系统状态与站外视觉接入已验证的 P11 语言；首页与 Score 共享水塘能力，但不共享会话状态。

---

## E0｜生产首页导航

### 当前真值

- `app/page.tsx` 转发生产 `app/test3/page.tsx`。
- 生产标题、登录与 GL overlay 位于 `app/test3/page.tsx` 和 `pond-gl-test3/overlay/`。
- P11 不在 `app/page.tsx` 复制导航，也不因 Score 复用 PondGL 而改写首页场景。

### 📦 范围

- 新增 `src/components/pond-gl-test3/overlay/PondHeader.tsx`
- `app/test3/page.tsx` 只改为挂载 PondHeader
- `src/components/auth/LoginButton.tsx`

### 行为

- 桌面 header 提供产品名、我的音乐档案、艺术家和登录。
- 手机使用一个 44px 菜单触发器展开纵向入口，不横排挤出屏幕。
- header 使用 pointer-events 分层，不拦截首页拖拽与演奏。
- `/` 隐藏 sandbox 文字和调参入口；`/test3` 保持诊断能力。

### 禁止

- 不动首页 35 节点、P9 注册表、键位、音频、调参存档或场景渲染顺序。
- 不把 Score 的单节点、播放 manifest 或路由会话带入首页。

### 验收

- 375px 不遮住核心演奏 UI，键盘和触屏都能进入三个公开页面。
- 首页首包不引入 Score 数据源、播放内核、账本或路由会话。
- `bash scripts/verify.sh` 通过。

---

## E1｜登录身份纸页

### 📦 范围

- `src/components/auth/LoginModal.tsx`
- `src/components/auth/SemiLogin.tsx`
- `src/components/auth/PinInput.tsx`
- 对应局部样式

### 视觉与语义

- 弹窗像浮在夜塘上的高不透明身份纸页，使用骨白正文、hairline 与黄铜焦点。
- 说明“登录用于找回你的音乐档案”；按真实 kill switch 显示 Semi 或邮箱能力。
- 返回只用于验证码步骤，顶层弹窗只保留一个关闭动作。
- `role="dialog"`、`aria-modal`、标题关联、初始焦点、Tab 约束、Escape 关闭和焦点归还全部成立。
- 手机软键盘出现时内容可滚动，确认按钮不被遮挡。

### 禁止

- 不改 provider、JWT、session、回调 URL、签名协议或 kill switch。
- 不新增 focus-trap 依赖。

### 验收

- Semi 可用/禁用、手机号、验证码、未注册、错误与 Privy 邮箱均可完成或退出。
- `bash scripts/verify.sh` 通过。

---

## E2｜全局播放器与 Score 互斥

### 📦 范围

- `src/components/player/BottomPlayer.tsx`
- `src/components/player/PlayerProvider.tsx`（仅确有生命周期缺口时）
- 对应样式

### 设计与行为

- 全局播放器像一张窄唱片标签：标题、时间、进度、收藏和停止。
- 桌面最大宽度受控；手机尊重 safe-area。
- 进度视觉可细，但可操作区域 ≥44px。
- `/score/[id]` 始终隐藏 BottomPlayer；Score 挂载时 stop，离开不恢复。
- Score 内核、P9 session 与 Pond pointer state 不能写回全局 PlayerProvider。

### 验收

- 首页/档案试听、Score 播放与登录弹窗切换始终只有一个音源。
- `/ → /score/1 → /` 往返后首页无残留单节点、日食、事件能量或水面 pointer 状态。
- 长标题、safe-area 与 375px 最后一条档案记录不被遮挡。
- `bash scripts/verify.sh` 通过。

---

## E3｜加载、空、错误、404

### 状态语言

- loading：稳定唱片/纸面轮廓，不使用无限大 spinner。
- empty：解释原因和唯一下一步。
- error：保留页面身份，提供重试或返回池塘。
- degraded：说明正在从链上与 Arweave 读取。
- not-found：明确作品不存在，不把 DB 抖动误报 404。

### 📦 范围

- 已有各路由 `loading.tsx` / `error.tsx`
- `app/error.tsx`
- `app/not-found.tsx`
- `app/layout.tsx`（`lang="zh-CN"` 与 metadata）

### 规则

- 同一状态使用 `EditionStamp` 与同一动作顺序。
- body 使用 P11 body 字体；mono 只留给技术字段。
- 错误不泄露堆栈、表名、内部 URL 或密钥。
- 状态变化通过 `aria-live` 感知，高频事件不进入 live region。
- Score 的 WebGL fallback 保留静态唱片、分享、账本与永久入口。

### 验收

- 断网、DB 故障、无 WebGL、context lost、未登录、空内容和 404 分别有证据。
- 加载到完成无显著布局跳动。
- `bash scripts/verify.sh` 通过。

---

## E4｜OG、海报与分享

- Score OG/海报使用“静态唱片浮于夜塘”的单帧构图；不尝试在服务器渲染 WebGL 或假装日食正在播放。
- 缩略图先读作品编号，再读产品名；不显示数据库 UUID。
- 创作者未知时不拿 currentHolder 填 `Created by`。
- canonical 已铸链接固定 `/score/<tokenId>`。
- 页面首屏分享至少保留一个直接动作；完整动作组提供系统/复制、X、微博和海报。
- 海报下载失败不阻断页面，所有分享操作有文本反馈。

### 📦 范围

- `app/score/[id]/opengraph-image.tsx`
- `app/score/[id]/poster/route.tsx`
- Score `ShareActions` 与根 metadata

### Track E 完成条件

- 首页导航、登录、播放器、状态与分享来自已批准的作品水塘/档案语言。
- 首页与 Score 共享渲染能力但会话完全隔离，P9 和认证核心行为无回退。
- 跨路由音频、P9、pointer、焦点、safe-area 与首页 bundle 通过。
- 更新状态后停在 P11-F。
