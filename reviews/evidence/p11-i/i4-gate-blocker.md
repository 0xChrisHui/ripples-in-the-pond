# P11-I4 Gate 阻塞记录

日期：2026-09-24

分支：`claude/p11-i-replay`
状态：连续三次动态 Gate 未通过，按夜间规则停止；I4 不提交。

## 已通过

- I-D1 基底断言通过：`origin/main` 仍是当前分支祖先，分支落后 `0`。
- TypeScript、I4 定向 ESLint、diff 检查通过。
- 两次临时绕过 Google Fonts 的生产构建均通过，静态页面 `38/38`；随后已恢复 `app/layout.tsx`，字体代码没有工作区差异。
- 首页与 `/me` 往返时 Water Core、Canvas、音乐圆 DOM 节点及 35 个圆圈 ID 保持不变，返回后的尺寸比为 `0.9963`，没有重新散射。
- 导航前制造的涟漪在往返过程中保持存在。
- 播放一次启动成功，并跨 `/me` 与返回首页持续播放。
- 页面错误为 `0`。

## 三次尝试

1. **开发服务器初测**：圆圈节点、涟漪、播放连续性通过；`scenePresence` 在离场 520ms 内始终为 `1`，到稳定档案态才跳近 `0`。减少动态效果在不刷新页面时未同步。
2. **生产服务器复测**：把减少动态效果检查改为刷新后验证；主序列仍未按采样点变化，脚本等待 reduced-motion 圆圈恢复交互时超时。
3. **生产服务器诊断复测**：增加 `data-pond-reduced-scene-motion` 与逐帧诊断。离场 6/120/274/524ms 的 presence 均为 `1`；反向返回后，旧的档案稳定态更新在 270ms 才把 presence 从 `1` 跳到 `0`，随后再缓慢回到 `1`。最终证据见 `i4-motion.json`。

## 根因判断

`use-scene-presence.ts` 使用被动 `useEffect` 启动或归一化动画。在路由快速切换且主线程繁忙时，这个 effect 会晚于下一次相位变化执行；旧的 archive 收场更新因此能在 `entering-home` 已开始后才落地，造成返回途中 `1 → 0 → 1` 的反向跳变。

## 建议修复

下一次恢复先把 presence 的目标切换移到绘制前同步执行的机制（优先验证 `useLayoutEffect`），并让 RAF 回调校验当前相位/目标版本，过期回调不得写值。随后只重跑 I4 的 0/120/260/520ms、快速反向和 reduced-motion Gate；通过后再跑完整 `verify.sh`。不要在修复 I4 前进入 I5–I7。

## 证据

- `reviews/evidence/p11-i/i4-motion.json`
- `reviews/evidence/p11-i/i4-motion-check.mjs`
