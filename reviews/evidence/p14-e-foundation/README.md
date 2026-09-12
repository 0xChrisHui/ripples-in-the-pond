# P14-E Foundation｜本地冻结证据

> 日期：2026-09-06（Asia/Shanghai）
> 状态：E0、E1 与 E2/E5 本地实现完成；G7 与人耳试听已关闭，38/40 个永久对象完成，封面等待第二网关传播。

## 采用方向

采用 E0 的 A「月夜声纹图谱」：日式留白、黑绿夜塘、骨白月面、黄铜水纹和 36 格可读进度。完整三方向对照、12 张关键帧及 Edge 真音频证据位于相邻的 `p14-e-prototype/`。

## E1 顺序播放内核

- 36 段按 recipe 顺序调度，重复字符只下载和解码一次。
- 相邻片段使用 60ms `sin/cos` 等功率交叉淡化。
- 总时长统一为 `Σduration − 35×60ms`；固定主网 Score #1 向量为 `269900.000004ms`。
- AudioContext 只在用户调用 `play()` 后创建；pause/resume 使用 AudioContext 时钟保存真实播放头。
- 双 Arweave 网关 fallback，逐片段 SHA-256 与解码时长校验。
- destroy 会中止 fetch、停止 source、断开 gain、取消 RAF 并关闭 AudioContext。

定向验证：

```text
npx tsx scripts/p14/verify-wallet-recipe-player.ts
P14-E1 时间线、等功率衔接、状态机与资源清理验证通过
```

## E2 永久 Decoder v1

`src/wallet-recipe-decoder/index.html` 是单文件 HTML/CSS/vanilla JS，不依赖 npm runtime、网络字体、本地域名、数据库或 Vercel API。它只接受：

```text
?v=1&recipe=<36 位 A–Z/0–9>&clips=<43 位 manifest txid>
```

Decoder 严格校验 manifest 字段、自包含 identity hash、36 个 clip txid；每个 clip 再校验 SHA-256 与解码时长。两个网关各有 12 秒超时，用户点击前不创建 AudioContext、不加载或播放音频。播放参数与站内内核共享同一合同：36 段、60ms 真重叠、等功率淡化、精确暂停/恢复、同 recipe 重播。

本地静态审计：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `src/wallet-recipe-decoder/index.html` | 13,512 | `2521bd95a7fb58f01343ce8625648553067a7c5831eaf71c17d84cd5f7833a4e` |

Decoder 已永久上传：`h1xSTezG7OuH85i2pT88H1iJI-KFRbImtvmfXSseKf0`。本地 HTTP/CORS 真音频、全曲、375/390/768/1024/1440 与 reduced-motion Gate 已通过；永久 bytes/hash 证据见 `reviews/2026-09-06-phase-14-a-permanent-assets.md`。

## E5 共用封面

封面采用纯 Node 标准库像素生成器：固定 1200×1200 RGBA、固定 PNG chunk/DEFLATE 参数、无时间、随机 seed、网络字体或第三方图片。同一脚本连续生成得到相同 bytes：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `public/pond-echoes/cover-v1.png` | 1,247,695 | `8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8` |

E0 已目视确认封面的黑绿夜塘、骨白核心、36 个黄铜点与同心水纹符合推荐方向。所有 token 共用这一封面，独特性由 recipe 与 animation 表达。

## 永久冻结进度

1. 权利确认与权利人的 A→9 完整人耳试听已归档并通过。
2. `clips-v1.json` 的 36 个 txid 已冻结；36 clips、manifest 与 Decoder 共 38 个对象已双网关 verified。
3. 封面 txid 为 `4uEbvBt9gIaVt50FZ1wfQkuz3ogXZIGGjAdoWre3-SU`；主网关 bytes/hash 已通过，第二网关仍返回截断 Range，保持 `uploaded` 等待态且禁止重传。
4. collection metadata 必须等封面双网关 verified 后才允许首次上传。

因此 E Foundation 的“本地实现”与已传 38 个对象通过，“永久媒体全部冻结”尚未通过；禁止重传封面或用本地 URL 继续 F1。
