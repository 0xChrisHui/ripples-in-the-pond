# P11-I4 圆圈进退场 Gate

日期：2026-09-24

分支：`claude/p11-i-replay`

## 结果

- I-D1 基底断言：`BASE_OK`，分支落后缓存的 `origin/main` 为 `0`；本轮远端 fetch 遇到一次 TLS EOF，但没有合并或改写基底。
- I4 浏览器 Gate：通过，见 `i4-motion.json`。
- TypeScript：通过。
- 定向 ESLint：通过。
- 完整 `scripts/verify.sh`：通过；生产构建 38/38，Forge 56/56。
- Google Fonts：按用户授权仅在本地构建时临时移除初始化；验证后恢复 `app/layout.tsx`，无产品差异。

## 动态证据

- 离场 presence（实际采样时间 → 值）：`7ms→1`、`133ms→0.2109`、`273ms→0.0258`、`523ms→0`。
- 回场 presence：`5ms→0`、`130ms→0.7558`、`271ms→0.9607`、`535ms→1`。
- 动画中反向：从当前 presence 连续回升，同一球节点保持不变，没有过期 RAF 回写。
- reduced-motion：`5ms→0.9559`、`88ms→0.0118`、`166ms→0`；球宽比例 `1`，没有路由缩放/下沉，导航 213ms 收场。
- 涟漪：离场前后的 `waveSpawn` 相同，年龄增加约 580ms，证明是同一波继续扩散。
- 返回首页：35 个节点 ID 顺序一致，同一 DOM 球节点，平均中心位移约 10.1px，尺寸比例在容差内，没有重新散射。
- 播放：一次启动成功，进入档案和返回首页后均继续播放。
- Water Core、Canvas 引用和 mountId 保持不变；页面错误 0。

## 修复说明

参考实现以被动 `useEffect` 启动 presence 动画，快速反向时旧 archive 更新可能晚到。现改为 `useLayoutEffect`，每段动画递增 generation；旧 RAF 在写入前必须匹配当前 generation。

无界面 Edge 原先强制 SwiftShader，只能约每秒绘制一帧，会把真实中间帧误判为整段静止。证据工具现优先使用系统 D3D11，并保留 `P11_EDGE_SOFTWARE=1` 降级入口；同时收紧端点、采样迟到、反向、同一涟漪、节点连续性和 reduced-motion 缩放断言。

## 文件

- `reviews/evidence/p11-i/i4-motion-check.mjs`
- `reviews/evidence/p11-i/i4-motion.json`
- `reviews/evidence/p11-i/i4-gate-blocker.md`（修复前的三轮失败记录）
