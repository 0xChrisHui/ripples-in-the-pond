# P11-I3 路由转场 Gate

## 结果

- 状态：通过。
- 基底：`origin/main` 是当前 HEAD 的祖先，`HEAD..origin/main=0`。
- 自动浏览器：20 次 `/ ↔ /me` 快速往返、动画中反向、重复点击、浏览器后退与前进全部收敛到正确稳定态。
- 连续性：全部样本的 Water Core、首个 Canvas 与 mountId 保持一致；页面错误为 0，无横向溢出。
- 可访问性：离场首页保持 `inert`，指针与 Tab 均不会进入离场层；目标入口在收场后接管焦点。
- B07：池中回声、艺术家与登录入口均保留。
- B08：转场只切换路由前景与首页交互权，不重挂全局 Player/Water Core。
- 静态 Gate：TypeScript、I3 定向 ESLint 与 `git diff --check` 通过。
- 完整 Gate：`bash scripts/verify.sh` 通过；生产构建 38/38、Forge 56/56。构建时沿用用户批准的本机 Google Fonts 临时绕行，随后恢复 `app/layout.tsx`，没有字体差异进入提交。

## 证据

- `reviews/evidence/p11-i/i3-transition.json`
- `reviews/evidence/p11-i/i3-transition-check.mjs`
- `reviews/evidence/p11-i/lib/edge-cdp.mjs`

## 实现说明

- 导航意图、地址落地与动画结束分别记录；只有目标地址落地后才允许收场。
- 只由完全显现的入场层结束转场，忽略子元素冒泡与离场层延迟补发的 `transitionend`。
- Suspense 只包路由前景，持久 Water Core 与转场控制器不进入 Suspense。
- 档案稳定前首页前景为 `inert`；浏览器历史导航会清除过期点击意图并重新编排相位。
