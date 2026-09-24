# P11-I6 作品页共享水面 Gate

日期：2026-09-24

分支：`claude/p11-i-replay`

## 结果

- I-D1 基底断言：`BASE_OK`，分支落后 `origin/main` 为 `0`。
- I6 浏览器 Gate：通过，见 `i6-score.json`。
- 四枚 OP Mainnet Score：`/score/1–4` 均为 ready，标题、canonical、唱片、分享与 12 行永久凭证保持正确。
- 完整 `scripts/verify.sh`：通过；生产构建 38/38，Forge 56/56。
- Google Fonts：按用户授权仅在本地构建时临时移除初始化；验证后恢复 `app/layout.tsx`，无产品差异。

## 共享 Water Core

- Score 路由迁入 Pond route group，URL、canonical、OG 与 poster 路径未变。
- `/score/1 → /me → history.back()` 前后 mountId、Water Core Canvas 与花瓣 Canvas 均为同一 DOM 引用；任一稳定时刻只有一棵生产 Water Core。
- Score Scene 原子注册到 SceneSlot；首页与 Score 的日食 RAF 不再同时驱动全局焦点。
- Score 播放前使用静态唱片；播放时共享 Core 只接入当前 Token 的单节点。暂停、ended 和离页都按原动画归位，不把首页多节点传进 Score。
- `.score-pond-page` 在共享 Shell 内为透明背景；当前水位、FBO、花瓣数组与 pointer 波场不因路由切换重置。

## 日食、音频与 P9

- 迁移前同机样本：点击后约 1.5 秒进入 playing，日食激活，点击前 AudioContext 为 0；见 `pre-i6-score.json`。
- 迁移后从真实 playing 时刻采样：`0ms→0.1709`、`150ms→0.8124`、`450ms→0.9934`、`1500ms→1.0000`；唱片切为日食，Core/Canvas/花瓣全程不变。
- 暂停归位：`0/150/450ms` 保持返回过程，`1500ms→0.0094` 且 `recordMotion=resting`。
- loading 点击排队只创建一个 AudioContext；播放 1.5 秒内收到 16 个 P9 事件。pause、resume、seek-to-ended、replay 全部通过。
- 播放中离开到 `/me` 后 AudioContext `1/1` 关闭，P9 数量不再增长，日食 CSS 状态清零。

## 阅读与能力矩阵

- 分享入口初始收束、点击展开、点外部收起；凭证复制通过注入的内存 clipboard 截获完整值，没有写系统剪贴板。
- 真实滚轮让页面向下滚动，永久凭证 12 行可读；页面无横向溢出。
- 375×812、768×1024、1024×768、1440×900 四档均通过，唱片触控目标不小于 44px。
- reduced-motion 在 180ms 内进入完整日食；`forceFallback=1` 下静态唱片、CSS 日食替代和播放仍可用。
- 同源 POST/PUT/PATCH/DELETE 为 0。当前持有人只读请求有一次网络失败，既有降级逻辑显示“暂时无法读取当前持有者”，不影响永久凭证与播放；该预期 fallback 从意外错误中单独记录。

## 人工缺口

- B13 仍需用户在真实桌面浏览器肉眼确认日食构图；自动证据证明时序、状态、同一 Canvas 与播放/P9 对齐。
- 无登录态，无法从真实档案唱片条目进入 Score，也无法在已有首页全局播放器播放时走真实档案入口；前者属于 I7，后者列入早上只读目验。

## 文件

- `reviews/evidence/p11-i/i6/pre-i6-score-baseline.mjs`
- `reviews/evidence/p11-i/i6/pre-i6-score.json`
- `reviews/evidence/p11-i/i6/i6-score-check.mjs`
- `reviews/evidence/p11-i/i6/i6-score.json`
- `reviews/evidence/p11-i/i6/screenshots/`
