# P15 全站丝滑体验与永久播放可靠性最终评审

## 裁决

P15 在仓库内可安全完成的代码闭环已经落地：导航反馈与非空外壳、首页真实曲目快显、确定性圆圈与延后预热、`/me` 三段 owner 隔离缓存和草稿幂等、核心 API `Server-Timing`、永久媒体统一 resolver，以及 Score/P14 分批下载解码与同一音频时钟调度均已实现。完整仓库验证通过。

P15 不能标记为“已上线完结”。当前仍有四类真实 Gate：P14 素材权利与永久 txid 尚未完成；高速镜像供应商/额度没有获批；Phase 15 migration 未应用；登录态、真实设备、首声与断站矩阵缺少可用外部环境。代码没有通过伪造账号、伪造音频或擅自创建外部服务越过这些 Gate。

## 隔离与版本

- P15 工作树：`E:\Projects\nft-music-p15`
- 分支：`codex/p15-smooth-playback`
- P14 合入锚点：`80ed458`
- P15 独立提交：`42c2f7a`、`d879350`、`f798de9`、`41ce4a9`、`7cb2c80`、`a3e7362`
- P14 主工作树的未提交 playbook、文档和素材未被修改、暂存、提交或中断。
- 未 push、未部署 Preview/Production、未执行数据库 migration、未写 Arweave/链上/对象存储。

## 交付内容

### 导航和路由外壳

- 捕获同站普通 Link 的点击意图，保留新标签、下载、修饰键与浏览器后退语义；相同目标重复点击被阻止。
- 反馈在路由完成后至少保留 160ms，避免快路由在首个绘制前闪没。
- 核心路由具有真实结构 loading/error；`/star` 以 308 收口到 `/v1`。
- 生产首页不再静态携带沙盒控制台；调参代码只在 `/test3`、`/test4` 动态 chunk 中加载。

### 首页

- 首屏先读版本化真实 tracks LKG；环境键包含 origin、chain 与 MaterialNFT 合约。
- CSS fallback 与 GL 使用同一批 node id、曲目、数量和确定性位置，GL 接管不重建随机布局。
- 当前组的真实目标数量来自 `getGroupTargetCount`，不再把 35 写死到所有分组。
- 音频预热限制为最多 4 个、并发 2，并受 idle、页面可见、`save-data`、Range 206 与 AbortSignal 控制。

### `/me`

- 唱片、录音、素材三段独立恢复、独立刷新、独立失败，不再由一个慢请求拖死整页。
- 缓存键隔离 origin、chain、Material/Score 合约、auth source、user、schema 与 section；只缓存最小展示数据，不缓存 token 或正文。
- 5 分钟 freshness、7 天最大保留期；换环境不命中，过期删除，登出清当前身份。
- 本地草稿有稳定 `clientDraftId`；后台上传按草稿精确删除，避免旧请求删除用户刚创建的新草稿。
- migration `050_pending_scores_client_draft_id.sql` 提供唯一约束、事务 advisory lock 与幂等 RPC；部署应用代码前必须先应用 migration。

### API 和永久播放

- 核心公共/私人接口分别记录 auth、db、rpc、arweave、serialize、total 等 `Server-Timing`，不写 token、钱包或私人正文。
- Artist stats 与 tracks 使用 5 分钟公共 revalidate。
- 永久 resolver 候选顺序为可选同字节镜像、`arweave.net`、`ario.permagate.io`；具备超时、重试、取消、Range、类型、长度和完整性验证。
- 带 canonical SHA-256 的 P14 资源走强校验；历史 Score 没有永久 hash 时明确走兼容校验，不伪称同字节密码学证明。
- Score 先加载前四段所需的唯一资源，尽早 ready；其余资源后台加载、解码并按同一 AudioContext 时钟加入。P14 重复字符复用 AudioBuffer，时间线仍保留 36 段。

## 性能证据

环境：Windows、Edge 138、本地 production build、未登录态。热高频路径 50 个有效样本；昂贵冷启动 10 个有效样本，按修订后口径只以 p50/p90/max 裁决。原始数据见 `reviews/evidence/p15-final/`。

### 真实站内 Link 热导航

以下时刻由无后台节流的专用 headless Edge 逐帧测量；反馈只有真实 opacity 已绘制才计成功。

| 目标 | 反馈 p50 / p95 / max | 外壳 p50 / p95 / max | 裁决 |
|---|---:|---:|---|
| `/` | 19 / 37 / 44ms | 113 / 182 / 222ms | 通过 |
| `/me` | 51 / 94 / 124ms | 167 / 239 / 250ms | 通过 |
| `/artist` | 50 / 71 / 123ms | 169 / 235 / 244ms | 通过 |

150/150 次反馈绘制成功；重复目标与修饰键保护通过。未登录态没有公开 `/score/1` Link，因此不制造“热 Link”样本，Score 只保留直达文档数据。

### 直达文档与首页圆圈

| 场景 | after | 冻结预算 | 裁决 |
|---|---:|---:|---|
| 冷 `/` 外壳 p90 / max | 416 / 490ms | p90 ≤1s | 通过 |
| 冷 `/me` 外壳 p90 / max | 396 / 408ms | p90 ≤1s | 通过（未登录壳） |
| 冷 `/artist` 外壳 p90 / max | 399 / 488ms | p90 ≤1s | 通过 |
| 冷 `/score/1` 外壳 p90 / max | 970 / 982ms | p90 ≤1s | 通过，余量很小 |
| 首页热全部圆圈 p95 / max | 546 / 549ms | p95 ≤1.2s | 通过 |
| 首页冷全部圆圈 p90 / max | 707 / 776ms | p90 ≤3s | 通过 |

四个视口 375×844、768×1024、1024×768、1440×900 的强制 fallback 均得到 35 个唯一、可交互真实曲目，无横向溢出；375 同时覆盖 reduced-motion。

### 基线方向变化

baseline 是线上 `pond-ripple.xyz`，after 是本地 production build，网络距离不同，因此百分比只能说明优化方向，不能替代 Preview/Production Gate。

| 路由 | 热外壳 p95 baseline → after | 方向变化 |
|---|---:|---:|
| `/` | 1451 → 456ms | -68.6% |
| `/me` | 853 → 442ms | -48.2% |
| `/artist` | 722 → 441ms | -39.0% |
| `/score/1` | 2224 → 989ms | -55.5% |

首页冷传输中位从约 17.64MB 降到约 4.11MB；基线 10 次冷首页包含一次约 50 秒网络离群值，不用该离群值夸大收益。

## 未通过或未取证

| Gate | 状态 | 原因 / 下一动作 |
|---|---|---|
| 单次主线程长任务 ≤200ms、桌面 55–60 FPS | 未通过 | 本地直达矩阵仍观察到 245–353ms 最慢长任务；需在 Preview trace 中定位 GL/水面初始化，不能用 shell 达标覆盖 |
| CLS ≤0.1 | 未关闭 | observer 为 0，但缺逐帧/trace 交叉验证 |
| `/me` 双身份、换号、三段 fresh p90 | 阻塞 | 没有两套真实 Privy/Semi 测试账号；纯函数隔离与失效测试已通过 |
| Score 热/冷真实首声 | 阻塞 | 当前永久媒体外部可用性不足；代码只在 AudioContext 排程后标记 expected sound，不拿 fetch/decode 代替“听到” |
| P14 高速、Arweave 回退、永久 Decoder 三套预算 | 阻塞 | P14 G7 未关、36 个 clip/manifest/Decoder/封面没有正式 txid |
| E4–E5 高速镜像 ingest/回填 | 阻塞 | 没有获批供应商、账号、Range/CORS/额度与清理边界；`NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 保持空即可安全回退 |
| migration / Preview / Production | 未执行 | 需等 P14 提交干净边界，先应用 049，再建独立 Preview；禁止与 P14 主网启用同批 |
| iOS/Android、触摸/pinch、健康 GL | 未关闭 | 自动矩阵只证明桌面 headless 强制 fallback 与 reduced-motion |

## 回滚边界

- A：撤导航反馈、loading/error 与沙盒拆包提交，不触碰数据。
- B：撤 tracks LKG、确定性节点与预热调度，返回旧首页路径。
- C：撤 `/me` 快照读取并停用 049 RPC；不要删除用户本地草稿或真实服务端记录。
- D/E：清空 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 即停镜像候选；resolver 仍回退双 Arweave 网关。回滚不得修改 tokenURI、永久 metadata 或已铸 NFT。

## 验证

- `bash scripts/verify.sh`：TypeScript、ESLint、行数、目录数、危险代码、production build 35/35、Forge 56/56 全绿；3 个既有 ESLint warning 未增加。
- `npx tsx scripts/p15/verify-home-foundation.ts`：通过。
- `npx tsx scripts/p15/verify-me-archive.ts`：通过。
- `npx tsx scripts/p15/verify-server-timing.ts`：通过。
- `npx tsx scripts/p15/verify-permanent-media.ts`：通过。
