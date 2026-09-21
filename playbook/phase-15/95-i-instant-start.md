# P15-I — Instant Start

> **授权日期**：2026-09-21
> **状态**：I0–I4 已完成，执行 I5 Production 发布
> **目标**：保持 Permanent Core 与完整字节校验不变，把数字 Score 的页面显示、播放意图和首声准备解耦；冷播放 p95 目标 ≤2s，热播放 p95 目标 ≤500ms。
> **执行顺序**：I0 → I1 → I2 → I3 → 条件 I4 → I5。I0–I3 达标时 I4 关闭，不为“更先进”主动放松客户端 hash-before-play。

## 1. 当前瓶颈

```text
snapshot + ownerOf 都完成
          ↓
底曲 + 全部已用音效完整下载并校验
          ↓
按钮才可点击
          ↓
第一次点击后集中解码全部 AudioBuffer
          ↓
排程首声
```

Permanent Core 已消除 events/sounds JSON 回源等待，但以上三个串行屏障仍会把冷启动放大到 3–5 秒。

## 2. 冻结边界

- 不修改历史 tokenURI、metadata、decoder、SoundSet 或音频字节。
- 不降低 Blob/AR 完整 bytes、MIME、SHA-256 校验；I0–I3 不改变信任模型。
- 页面播放主体不能等待可变的当前持有人 RPC；持有人异步补齐且失败只影响该凭证行。
- `loading` 时第一次点击必须被记录，AudioContext 仍只在用户手势中创建/恢复。
- 前 8 秒音效是启动闭包；其余音效后台准备，但任何事件都不得静默漏播。
- 流式底曲 I4 只有 I0–I3 的生产冷播放 p95 仍大于 2 秒才触发；它需要单独记录“发布时已验证 Edge attestation”取代“首声前客户端整文件 hash”的边界。

## 3. I0 — 可重复基线

1. 新增数字 Score 专项浏览器测量：HTML/播放器出现、资源 ready、点击、decode、首声排程。
2. Score #1–#4 各做冷/热样本；保存资源 winner、传输量、错误与 P9/space 关键时间。
3. 冻结同一浏览器、网络与缓存清理方法，完成后复用同一脚本对比。

**Gate I0**：能把 3–5 秒拆成 SSR、下载、解码和点击到首声四段，不用主观体感代替证据。

## 4. I1 — 页面与 ownerOf 解耦

1. 数字 Score 服务端只等 active verified snapshot，立即输出播放主体。
2. 新增只读 owner endpoint；客户端独立查询并只更新“当前持有者”一行。
3. endpoint 使用短 CDN 缓存和 stale-while-revalidate；超时/失败不改变 finalized 与播放状态。

**Gate I1**：人为让 RPC 慢/失败时，HTML bootstrap 与播放器仍立即出现；持有人行诚实显示核对中或暂不可用。

## 5. I2 — 启动闭包与网络优先级

1. 从 bootstrap 计算底曲、前 8 秒唯一音效与后台音效。
2. 底曲先启动；启动音效随后并发；后台音效限制并发，避免与底曲抢满连接。
3. HTML 为底曲与启动音效发出同 URL preload，浏览器请求与 resolver 复用 HTTP cache。
4. 播放仅在底曲与启动音效完整验证后启动；后台音效必须在首次事件前完成，否则有界等待而非漏播。

**Gate I2**：#2 `space` 属于启动闭包；所有 Score 事件仍有完整音效覆盖，Blob/AR 故障矩阵不退化。

## 6. I3 — 播放意图与解码

1. `loading` 按钮可点击；第一次点击同步创建/恢复 AudioContext 并记录 pending intent。
2. 资源到齐后自动解码并排程，不要求第二次点击；再次点击可取消 pending intent。
3. `ready` 只表示点击后能快速排程；下载与解码状态分开呈现。
4. 桌面可在资源到齐后空闲预解码；低内存、省流量与兼容失败回到手势内解码。

**Gate I3**：快速连点、离页 abort、重播、暂停、错误重试均无幽灵播放；AudioContext 只在手势后创建。

## 7. I4 — 条件流式底曲

只有 I0–I3 的同口径生产冷播放 p95 仍大于 2 秒才执行：

1. 使用同一个 Verified Edge MP3 URL 的 Range 流式播放，`HTMLMediaElement.currentTime` 成为主时钟。
2. 音效与 P9 使用短 lookahead 跟随主时钟；Blob 异常回退现有完整下载路径。
3. 记录客户端首声前不再具备整文件 SHA 的边界，并保留发布时全字节 attestation、不可覆盖路径与运行时解码失败回退。

**Gate I4**：桌面/移动端首声达标，P9 与 #2 space 漂移 ≤50ms；否则不发布 I4。

## 8. I5 — 发布

1. 定向测试后只跑一次 `scripts/verify.sh`；失败只重跑受影响层。
2. Preview 用同一脚本复测 #1–#4 冷/热与故障矩阵。
3. 快进推送，Production Ready 后在正式域名复测并写 completion review。

**完成线**：页面不被 ownerOf 阻塞、loading 点击可排队、#1–#4 无漏音、#2 space 正确；I0–I3 达到预算则明确关闭 I4，未达到才进入 I4。
