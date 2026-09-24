# P11-I7 档案与作品锚点 Gate

日期：2026-09-24

分支：`claude/p11-i-replay`

## 结果

- I-D1 基底断言：`BASE_OK`，分支落后 `origin/main` 为 `0`。
- I7 浏览器 Gate：通过，见 `i7-anchor.json`；同源产品写请求为 0。
- 完整 `scripts/verify.sh`：通过；生产构建 38/38，Forge 56/56。
- Google Fonts：按用户授权仅在本地构建时临时移除初始化；验证后恢复 `app/layout.tsx`，无产品差异。

## 锚点与来源

- 只有 `success + tokenId` 的稳定唱片行启用锚点；processing、failed、直接访问、来源失效和账号切换都走普通淡入。
- 只给当前选中的档案行和匹配 Token 的 Score 唱片命名，页面内不会出现多个同名来源。
- 来源记录带导航代次、账号、分区、分页、滚动位置和条目矩形；旧导航异步结果不能清掉后点的新目标。
- 档案常驻期间不会在前向点击后过早清来源；Score 确认匹配后才进入可反向状态。

## 自动矩阵

- 第 2 页 Token 行用键盘 Enter 进入 Score；前向快照中恰好 2 个 `score-record` 锚点。
- 页面“返回档案”和浏览器 Back 均恢复第 2 页、原滚动位置与来源链接焦点，随后清空短期来源。
- 同行双击被同步锁拦截；快速点 Token 1 再点 Token 2 时最终落在 Token 2。
- Ctrl/新标签语义不捕获来源；直接访问 `/score/4` 没有虚假锚点。
- 假身份 A→B 后旧来源立即失效；目标从 ready 变为真实 failed 页面时自动回原行并恢复交互；Escape 也清理 pending。
- fixture 只拦截本地 `/api/me/**` GET，processing/failed 行仍是普通链接；没有点击保存、铸造、注册、删除或管理接口。

## 范围与缺口

- 浏览器证据使用全新本地 Edge 资料、假 Semi 身份和只读 API fixture，不接触生产私人数据。
- 真实账号的唱片行视觉体感仍需用户早上只读目验；processing/failed 的真实数据样式也保留到该次检查。

## 文件

- `reviews/evidence/p11-i/i7/i7-anchor-check.mjs`
- `reviews/evidence/p11-i/i7/i7-anchor.json`
- `reviews/evidence/p11-i/i7/final-state.jpg`
