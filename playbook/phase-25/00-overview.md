# Phase 25 — 国内访问加速（香港反向代理 + 同源音频镜像 + 按地区解析）

> 2026-11-14 夜间执行补记：兼容代码、测试与香港运维准备已完成并整合，详见 `02-execution-log.md`；下列购买、DNS、生产变量、分流和镜像操作仍留白天，未启用大陆加速。原计划正文保留，执行授权以本次夜间指令为准。

> 制定日期：2026-11-13。2026-11-14 经 Codex（gpt-6-astra，high）审查 18 条，Claude 逐条核实后全部采纳（部分做了调整），并补了 1 条自查发现，处理记录见 §11。\
> 依据：2026-11-13 会话里对“国内用户如何丝滑访问”的讨论，以及对代码、生产 DNS 的只读核实。\
> 状态：**已立项，决策 D1–D6 已定（用户 2026-11-13：“都按照你推荐的来”），未开工**。等用户发出执行命令。\
> 基线：`main` `6c3c000`（开工时以 P24 合入后的 main 为准，重新冻结）。代码步骤放在独立 worktree `E:\Projects\nft-music-p25`、分支 `feat/p25-cn-edge`。**必须等 P24 合入 main 后再从 main 建分支**，因为 Step 1 和 P24 Step 5 都会改 `middleware.ts`，而且 P24 会改限流阈值和失败策略。不改代码的 Step 0、5、6 可以先做。\
> 需要用户另行放行的事：购买服务器、注册 AWS、迁移 DNS、改 Vercel 环境变量、调带宽、push、合并 main、部署、写生产库（本阶段不写库）、修改 `docs/ARCHITECTURE.md` / `docs/STACK.md`。

---

## 1. 目标

不做 ICP 备案，让中国大陆用户访问 `pond-ripple.xyz` 时，页面能打开、首页原曲和 Score / Echo 能顺畅播放；海外用户的访问路径和体验保持不变。宣发等流量峰值期间可以临时扩容，峰值过后再降回来。

做法分三部分：

1. 在香港买一台**按流量计费**的云服务器，做反向代理加缓存。带宽上限可以随时调高调低。
2. DNS 迁到 **AWS Route 53**，按国家解析：来自中国的查询指向香港，其他查询仍直连 Vercel。香港机器故障时，DNS 自动把大陆用户切回 Vercel。
3. 把音频镜像改成同源的 `/media/<txid>`。大陆用户经香港缓存取音频，海外用户经 Vercel 转发到现有的 Vercel Blob。

**不在本阶段范围内（大陆用户仍然直连第三方，体验不保证）**：封面图、旧版 Score 的永久 JSON、Privy 登录、钱包连接与交易、Semi 注册页、区块浏览器链接。具体见 F10。

---

## 2. 现状（2026-11-13 / 11-14 只读核实）

| # | 事实 | 证据 | 影响 |
|---|---|---|---|
| F1 | 生产域名的 DNS 托管在 Vercel（`ns1/ns2.vercel-dns.com`），Vercel DNS 不支持按地区解析。没有开 DNSSEC（`.xyz` 上级域查不到 DS 记录）。根域名**没有 AAAA（IPv6）记录** | 公共 DNS 查询 | 要按地区解析，必须先迁 DNS（Step 6）。没有 DNSSEC，换 NS 不会因签名问题导致解析失败。没有 AAAA 就不存在“IPv6 用户绕过中国记录”的问题，本阶段也不加 AAAA |
| F2 | 限流用 `x-forwarded-for` 的第一个 IP 作为 key。Vercel 会用实际连接方的 IP 覆盖这个头（[官方说明](https://vercel.com/docs/headers/request-headers#x-forwarded-for)） | `middleware.ts:80` | 经香港代理后，所有大陆用户都会被识别成香港 IP，共用一个限流额度。**必须先改代码**（Step 1）。这个改动只修复应用自己的限流；Vercel 防火墙看到的仍然是香港 IP |
| F3 | 中间件只匹配 `/api/:path*`；不需要限流的 API 在 `middleware.ts:70` 就提前返回；`/api/ping` 是公开的、没有副作用的存活检查 | `middleware.ts:70、116`；`app/api/ping/route.ts` | `/media`、`/tracks`、页面不经过中间件。核验标记要加在提前返回之前，用 `GET /api/ping` 检查 |
| F4 | 首页原曲优先走同源的 `/tracks/No.N.mp3?v=<sha256>`，35 首共 156MB。**但 `/tracks/` 下面还有真实页面** `/tracks/pond`、`/tracks/archive` | `track-audio.ts:14`、`audio-streams.ts:12`；`app/(pond)/tracks/`、`app/tracks/archive/` | 缓存规则只能精确匹配 `/tracks/No.<编号>.mp3`，不能按目录前缀缓存 |
| F5 | **现行镜像规则以 P15-H 和当前代码为准**，P15-G 的一字节探针流程已被取代：浏览器直接完整 GET 镜像地址（`race/attempt.ts:60`），1.2 秒后开始抢跑 Arweave（`resolver.ts:124`），每个来源失败 2 次后在内存里冷却 30 秒，不持久化（`health.ts:38`）。单个对象 404 只回退这个对象（`resolver.ts:90`）。**Score 底曲另有一条 HTMLAudio 流式播放路径，直接用镜像地址**（`resource-loader.ts:16`、`streaming/stream-base.ts`），浏览器会发 Range 请求。一字节 Range 只作为发布前的能力检查（`phase-15/90-h-permanent-core-verified-edge.md` H4） | 代码 | 同源 `/media` 必须同时满足两点：完整 GET 返回 `200` 且内容一致；任意 Range 请求返回正确的 `206`。Blob 里现在有多少对象，Step 0 现场盘点 |
| F6 | 浏览器不直连 Supabase：前端没有 supabase 客户端，`supabase.ts` 是 `server-only` | 代码 | 不用处理 |
| F7 | 字体用 `next/font/google`，构建时会转成自托管 | `app/layout.tsx:2` | 不用处理 |
| F8 | Echo 元数据和链上读取都在服务端（Vercel）完成；cron 用 `Authorization: Bearer` 鉴权；仓库里没有 Privy webhook 接收路由 | `src/data/echo/arweave.ts`；`src/lib/auth/cron-auth.ts:22` | 不用处理。Privy 登录要在 Step 8 用真实流程确认 |
| F9 | Semi 短信登录只调用本站的 `/api/auth/community/*` | `SemiLogin.tsx` | 经香港代理后可以正常使用 |
| F10 | **以下内容由浏览器直连第三方，香港代理覆盖不到**：①Score 封面 `https://arweave.net/<id>`（`snapshot-contract.ts:169` → `RecordAnchor.tsx:75`）；②Echo 封面直连网关（`echo/source.ts:69` → `EchoPage.tsx:36`）；③旧版 Score 的永久 JSON（`resource-loader.ts:84`，不走音频镜像）；④钱包的链上读写用钱包自己的节点（`wallet-send.ts:45`）；⑤Privy（`auth.privy.io` 与内嵌钱包 iframe）、WalletConnect 中继；⑥Semi 新用户注册跳转 `semi.ntdao.xyz`；⑦区块浏览器链接 | 代码 | 本阶段不代理。Step 0 拨测，Step 8 列入验收观察，**不对外承诺大陆体验完整加速**。封面加速可以作为后续阶段 |
| F11 | 仓库里没有 CSP 响应头；业务代码没有 `use server` Server Actions | 全仓搜索 | 换镜像地址不会被浏览器拦截。以后加 Server Actions 时，只要生产 Host 与 Origin 一致就能用，不要预先放宽 `allowedOrigins` |
| F12 | Next.js 对 `public/` 下的文件默认返回 `Cache-Control: public, max-age=0`，而 nginx 会优先遵循上游的缓存头，`proxy_cache_valid` 配了也不生效 | [Next.js 文档](https://nextjs.org/docs/pages/api-reference/file-conventions/public-folder)、[nginx 文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_valid) | 只在精确匹配的、内容不可变的静态路径上忽略上游缓存头（R1） |

---

## 3. 方案

### 3.1 流量走向（全部完成后）

| 请求 | 大陆用户 | 海外用户 |
|---|---|---|
| 页面 HTML、RSC、`/api/*`（包括 `/tracks/pond`、`/tracks/archive`） | 香港 nginx 转发到 Vercel，**不缓存** | 直连 Vercel（不变） |
| `/_next/static/*`（文件名带哈希） | 香港缓存，长期有效 | 直连 Vercel（不变） |
| `/tracks/No.<编号>.mp3?v=<sha256>`（首页原曲） | 香港缓存，按 1MB 分片，支持 Range | 直连 Vercel（不变） |
| `/media/<43 位 txid>`（Score / Echo 音频，包括底曲流式播放） | 香港缓存；未命中时经 Vercel 改写从 Blob 取 | Vercel 改写到 Blob |
| cron-job.org 定时任务 | 发起方在境外，直连 Vercel（不变） | — |
| 封面、旧 Score JSON、Privy、钱包、WalletConnect、Arweave 网关 | 浏览器直连（不变，F10） | 不变 |

### 3.2 为什么用同源 `/media`（D1 = M1）

- 镜像只能配一个地址。改成同源后，同一个地址在大陆解析到香港、在海外解析到 Vercel，自动分流，前端代码不用改。
- 香港不直接代理 Arweave，只回源 Vercel。`/media` 只缓存 Blob 里已经核验过的对象，Blob 里没有的对象返回 404，按现行规则只让这一个对象回退。所以香港机器**不会变成任意上游内容的公开代理**。但公开的合法音频仍然可以被人反复下载刷流量，这个风险还在（§10、R8）。
- 同源请求不需要 CORS。
- **`/media` 改写永久保留**，回滚时也不删。浏览器已经打开的页面会继续请求构建时写进去的地址，删掉改写会让这些页面放不出声。

### 3.3 可信客户端 IP（Step 1）

- 香港 nginx **只在 `/api/` 路径**上加两个头：`x-pond-client-ip` 和 `x-pond-edge-secret`。前者的值取 nginx 看到的实际连接地址 `$remote_addr`，覆盖访客自己带来的同名头。其他路径不带密钥，避免密钥随 `/media` 改写被转发到 Blob。
- 中间件只在密钥匹配时才采用 `x-pond-client-ip`，其他情况沿用现有逻辑。没配密钥时，行为和现在完全一样。有人绕过香港直接访问 Vercel 并伪造这个头，因为没有密钥，伪造无效。
- IP 处理规则：
  - 头里只能有一个值，出现逗号或多个值就忽略；
  - IPv4 按点分格式校验；
  - IPv6 用 URL 解析规范成统一写法，按 /64 前缀作为限流 key（香港节点目前只开 IPv4，这条是为将来留的）；
  - 不合法就忽略。
- 双密钥轮换：Vercel 同时接受 `EDGE_PROXY_SECRET` 和 `EDGE_PROXY_SECRET_PREVIOUS`。正常轮换的顺序是：
  1. Vercel 设新密钥，把旧密钥放进 PREVIOUS，重新部署；
  2. 香港 nginx 换成新密钥；
  3. 删除 PREVIOUS，再重新部署。

  整个过程不会出现两边对不上的时间窗口。密钥泄露时，直接删除泄露的那个值，香港立刻换新值，接受短时间的限流误伤。

### 3.4 DNS 结构（Route 53，D3）

| 记录 | 路由方式 | 指向 | 健康检查 |
|---|---|---|---|
| `pond-ripple.xyz` 默认（Default location） | 地理位置 | Vercel 给出的 A 记录值（Step 6 从 Vercel 域名页读取） | 无 |
| `pond-ripple.xyz` 中国（Country: China） | 地理位置，别名指向 `edge-cn.pond-ripple.xyz`，打开“评估目标健康状态”（EvaluateTargetHealth） | — | 跟随目标 |
| `edge-cn.pond-ripple.xyz` | 加权，每台香港机器一条，权重相同 | 各香港机器 IP | 每条一个独立检查（R12） |
| 其他记录（Resend 发信记录、各类验证 TXT、CAA 等） | 简单记录 | 按 Step 0 导出结果原样复制（**NS 和 SOA 除外**，这两条用 Route 53 自动生成的） | 无 |

- **默认记录必须有**。它覆盖未配置的地区和无法定位的查询，也是香港故障时的回退目标；默认记录本身不挂健康检查。
- `edge-cn` 下所有香港机器都不健康时，“中国”记录被视为不可用，Route 53 改为返回默认记录，大陆用户回到直连 Vercel。机器恢复后自动切回香港。
- 定位依据的是 DNS 查询的来源（运营商 DNS 的位置，或查询里附带的 ECS 客户端网段），不一定等于用户的实际位置。用境外 DoH 的大陆用户可能拿到默认记录，直连 Vercel，这是可以接受的。香港、澳门、台湾在 Route 53 里是独立地区，走默认记录。
- 加权记录按 DNS 应答次数分配，不保证每台机器的流量一样多。

---

## 4. 已定决策（用户 2026-11-13：“都按照你推荐的来”）

| # | 问题 | 结论 |
|---|---|---|
| D1 | 音频镜像方案 | **M1 同源 `/media`**（§3.2） |
| D2 | 服务器 | **阿里云或腾讯云香港的普通云服务器**（阿里云 ECS、腾讯云 CVM），**不用轻量服务器**；公网带宽**按使用流量计费**，带宽上限可以随时调整。选你已经实名的那家，都没有的话选腾讯云。先按量或按月付费，Step 5 拨测合格后再考虑长期购买 |
| D3 | DNS | **迁到 AWS Route 53**（§3.4）。不交给国内 DNS 服务商，避免因内容审查停止解析导致全球都打不开 |
| D4 | 执行方式 | 代码步骤（1–3）一口气完成、本地 commit 不停，这是对 AGENTS.md“每个闭环停一次”的明确授权；线上步骤（4–9）每步等用户放行 |
| D5 | 服务器由谁操作 | Claude 用专用 SSH 密钥直接配置；用户负责购买和放入公钥 |
| D6 | 故障切换 | 用 Route 53 健康检查**自动切回 Vercel**；另保留一个从大陆发起的可用性监控（O12） |

---

## 5. 推荐值与强制配置（验收时可以改推荐值，强制项不改）

| # | 事项 | 内容 |
|---|---|---|
| R1 | 缓存范围（强制） | 只缓存这几类精确路径：`/_next/static/`（文件名带哈希）、`/tracks/No.<数字>.mp3`、`/media/<43 位 txid>`；`/sounds/` 在 Step 3 核对后再定精确匹配规则。在这些路径上忽略上游的 `Cache-Control` 和 `Expires`（F12），自己设定有效期：静态文件和 `/media` 365 天，`/tracks` 30 天。**其他所有请求不缓存**，包括 HTML、RSC、`/api/*`、`/_next/image`、`/tracks/pond`、`/tracks/archive`。 |
| R2 | 缓存键与参数（强制） | `/_next/static/` 和 `/media/`：缓存键不含参数，回源时去掉参数。`/tracks/`：缓存键只含 `v` 参数，回源只带 `v`。这样随机参数既不能制造新缓存，也穿透不到 Vercel。缓存路径只允许 GET 和 HEAD。带 `Set-Cookie` 的响应不缓存；`404` 只缓存 1 分钟；`416` 和 `5xx` 不缓存。 |
| R3 | 音频分片（强制） | 用 nginx `slice` 模块，每片 1MB。下面几项必须同时配：<br>• `proxy_set_header Range $slice_range`；<br>• 缓存键包含 `$slice_range`；<br>• `proxy_cache_valid 200 206`；<br>• 缓存路径打开 `proxy_buffering`（不能继承动态路径的关闭设置）；<br>• 打开 `proxy_cache_lock`；<br>• **不启用 `proxy_cache_background_update`**（它和 slice 不兼容，[官方说明](https://nginx.org/en/docs/http/ngx_http_slice_module.html)）。<br>注意：客户端只要 1 字节时，缓存未命中仍会回源拉 1MB。 |
| R4 | 回源 TLS（强制） | HTTPS 回源，并且：<br>• `proxy_ssl_verify on`，用系统 CA；<br>• `proxy_ssl_server_name on`；<br>• `proxy_ssl_name pond-ripple.xyz`；<br>• `Host: pond-ripple.xyz`。<br>上游地址解析 Step 6 记录的**独立 Vercel 目标**（例如 Vercel 给出的 CNAME 目标），配合 `resolver` 定期重新解析，**绝不解析 `pond-ripple.xyz` 本身**，防止绕回香港。动态路径关闭 `proxy_buffering`，保证流式渲染正常。 |
| R5 | 超时 | 连接 5 秒，读取 60 秒 |
| R6 | 密钥 | 头名 `x-pond-edge-secret` / `x-pond-client-ip`，只在 `/api/` 上发送；密钥是 32 字节随机值，按“密钥交付不进聊天”规则交付；Vercel 环境变量用 `EDGE_PROXY_SECRET` 和 `EDGE_PROXY_SECRET_PREVIOUS`（§3.3） |
| R7 | 核验标记 | 中间件对所有匹配的响应（包括 `middleware.ts:70` 的提前返回）加 `x-pond-ip-source: edge` 或 `direct`，只标来源，不回显 IP。用 `GET /api/ping` 检查，不触发短信、铸造等有副作用的接口 |
| R8 | 服务器与防滥用 | • 机器：Debian 12，2 核 2G，按流量计费；平时带宽上限 50Mbps，峰值期 100–200Mbps（§6）；<br>• 缓存：缓存盘上限 10GB，30 天不访问自动清除；<br>• 只认 `server_name pond-ripple.xyz`，其他 Host 由默认 server 直接断开（444）；HTTP 一律跳转 HTTPS；<br>• 限速：每个 IP 的并发连接数和动态请求速率设宽松上限，起步值在 Step 3 定，要照顾到学校、公司等共享出口；<br>• 告警：磁盘和 inode 使用率超过 80%；<br>• 带宽：50Mbps 持续跑满一天理论上约 540GB 出站，预算告警不会自动停机，处置见 R14 |
| R9 | 日志 | nginx 访问日志保留 7 天，按天轮转，不记录请求体 |
| R10 | 证书（强制） | • 用 acme.sh 走 DNS-01（`dns_aws`）。IAM 权限按 [acme.sh 官方最小策略](https://github.com/acmesh-official/acme.sh/wiki/How-to-use-Amazon-Route53-API)：允许列出区域、读取记录、查询变更状态；修改权限限定为 `_acme-challenge.pond-ripple.xyz`、类型 TXT。<br>• 用 `--install-cert` 把证书安装到固定路径，`reloadcmd` 设为 `nginx -t && systemctl reload nginx`；用 acme.sh 自带的定时任务续期。<br>• 到期监控：剩余不足 14 天时告警（O12）。Route 53 的 HTTPS 健康检查**不验证证书**，不能替代到期监控。<br>• **不能用 HTTP-01**：Let's Encrypt 从境外发起验证，会解析到 Vercel 而不是香港。 |
| R11 | DNS | 按 §3.4 的结构。`edge-cn` 的 TTL 设 60 秒，默认记录 300 秒；不加 AAAA |
| R12 | 健康检查（强制） | • **每台机器一个独立检查**：`IPAddress` 填该机器的公网 IP，`FullyQualifiedDomainName` 填 `pond-ripple.xyz`，端口 443，打开 `EnableSNI`。<br>• 检查路径 `/_edge/health`，**由 nginx 本地应答，不回源 Vercel**。Route 53 的多个检查节点高频访问，如果回源会给 Vercel 带去每天几万次请求，Hobby 额度扛不住。<br>• 每 30 秒一次，连续失败 3 次判定不健康，检查区域选最少的 3 个。<br>• 实际切换时间以 Step 8 实测为准，Route 53 是汇总多个检查节点的结果来判定，并不是严格的 30 秒 × 3。 |
| R13 | 上游自检 | 香港机器每分钟通过 R4 的回源路径请求一次 `GET /api/ping`，连续失败 3 次就写一个标记文件，让 `/_edge/health` 返回 503，从而让 Route 53 把大陆用户切回 Vercel；成功后删掉标记。这样“香港本身没挂、但连不上 Vercel”也能被发现。每月约 4.3 万次请求，Vercel 承受得起 |
| R14 | 预算告警的处置 | 收到云账号预算告警后：先看 nginx 日志里是否有异常 IP 或异常路径；有滥用就封禁，或把带宽上限调低；情况严重时删除 Route 53 的“中国”记录，让大陆用户暂时直连 Vercel |

---

## 6. 峰值扩容预案

香港机器平时的带宽上限是 50Mbps。宣发前按下面的预案临时扩容，峰值过后关掉。具体命令在 Step 3 写进 `ops/hk-edge/README.md`，Step 10 演练一次。

**先估算需要多少带宽**：所需 Mbps ≈ 同时首次访问人数 × 每人下载量（MB，Step 0 实测）× 8 ÷ 希望多少秒内下载完 × 1.5（余量）。例如 50 人在 10 秒内各下载 10MB，约需 600Mbps。可见“几十人同时首次访问”这个量级，单台机器已经吃紧，下面给出的倍数也只是参考，以实测为准。

| 方案 | 什么时候用 | 开 | 关 |
|---|---|---|---|
| **A. 调高带宽上限（默认）** | 每次宣发 | 宣发前 1 天：控制台或 CLI 把带宽上限调到 100–200Mbps；运行 `edge-warm.sh` 预热缓存 | 峰值过后调回 50Mbps |
| **B. 临时加机器** | 按公式算出来远超 A 的上限时 | 用**不含任何密钥的基础镜像**（Step 5）按量创建 HK2 → 重新生成 SSH 主机密钥 → HK2 自己签发证书、写入 edge 密钥 → `edge-warm.sh` 预热 → `edge-check.sh` 全部通过 → 在 `edge-cn` 下加 HK2 的加权记录和独立健康检查 | 删除 HK2 的加权记录和健康检查 → 等 10 分钟 → 释放 HK2 |

- 每台机器各自签发、各自续期证书（都走 DNS-01，互不影响）。
- 按流量计费意味着峰值期按实际用掉的 GB 收费，单价以官网为准。扩容前看一下 O5 的预算告警阈值够不够。
- 长期用户量真的上来以后，再考虑在香港机器前面套 CDN（加速区域选“全球（不含中国内地）”，不需要备案）。CDN 不在本阶段范围内。

---

## 7. 施工步骤

每个代码步骤完成后：定向类型检查、本步单测、本地 commit。完整 `verify.sh` 跑三次：Step 0、Step 4 合并前、Step 10。“谁做”一栏写“用户”的步骤，Claude 只提供命令或清单。

### Step 0 — 基线与拨测（只读）

- 谁做：Claude 和用户。📦 范围：只读，新建 `02-execution-log.md`。
- 内容：
  - ①用 `vercel dns ls pond-ripple.xyz` 导出全部 DNS 记录及各自的 TTL，包括 Resend 的 DKIM / SPF / DMARC、CAA、各类验证 TXT、子域委派。
  - ②确认域名注册商，再查一次 DS 和 AAAA（F1）。
  - ③确认项目没有用通配符域名 `*.pond-ripple.xyz`（它的证书依赖 Vercel 自己的 DNS）。
  - ④从 Vercel 域名页记下 Vercel 推荐的 A 记录值和 CNAME 目标，供 §3.4 的默认记录和 R4 的回源地址使用。
  - ⑤从 Vercel 读出生产环境 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 的 Blob 地址（不是密钥，可以记录），并盘点 Blob 里现有多少对象。
  - ⑥用 curl 直连 Blob 一个对象：分别记录 `Range: bytes=0-0` 的响应和完整 GET 的响应，包括状态码、`Content-Range`、类型、长度、缓存头。
  - ⑦记录 Vercel 和 Blob 当前的用量、剩余额度和限制，作为 §10 的停止阈值依据。
  - ⑧本机不走代理直连，用 `curl` 测首页、一个 `/_next/static` 文件、`/tracks/No.1.mp3`、Blob 对象的首字节时间和总耗时。
  - ⑨用户在 itdog.cn 上对 `pond-ripple.xyz`、Blob 域名、`arweave.net`、`auth.privy.io` 做全国多地拨测。
  - ⑩**测一个大陆新访客首次访问的下载量**：清空缓存后打开首页并播放一首原曲，打开一次 `/score/1`，记下总 MB 数和请求数，代入 §6 的公式。
  - ⑪跑一次完整 `verify.sh`，记下既有失败项。
- 结果写进 `02-execution-log.md`，作为验收时的对比基线。

### Step 1 — 可信客户端 IP（代码，P24 合入后）

- 📦 范围：`middleware.ts`；新建 `src/lib/edge/client-ip.ts`（P24 若已建 `src/lib/rate-limit/`，就放进去）；单测 `scripts/p25/`；`.env.example` 加 `EDGE_PROXY_SECRET=` 和 `EDGE_PROXY_SECRET_PREVIOUS=`；`package.json` 加一条测试脚本。
- 内容：按 §3.3 和 R7 实现。密钥比较用手写的等长比较（中间件运行在 Edge，不能用 node crypto）。
- 单测：
  - 未配密钥时行为与原来一致；
  - 新旧两个密钥都能通过；
  - 密钥错误、缺失或长度不同时忽略新头；
  - 新头里有多个值或 IP 不合法时忽略；
  - IPv6 规范化后按 /64 取 key；
  - 伪造的 `x-forwarded-for` 行为不变；
  - 两个不同的可信 IP 各算各的限流额度；
  - 提前返回分支和限流分支都带核验标记。
- **P24 回归**：确认 P24 的 IP 阈值、关闭 analytics、短信预算、草稿限流的行为和失败策略不变。本步只改“用哪个 IP 作为 key”。

### Step 2 — 同源 `/media/<txid>` 改写到 Blob（代码）

- 📦 范围：`next.config.ts`；`.env.example` 加服务端变量 `MEDIA_BLOB_ORIGIN=`（不加 `NEXT_PUBLIC_` 前缀）；单测或构建检查脚本 `scripts/p25/`。
- 内容：配置 `rewrites`，只匹配 `/media/:txid([a-zA-Z0-9_-]{43})`，转发到 `${MEDIA_BLOB_ORIGIN}/media/:txid`。变量没配时不加这条改写。这条改写**永久保留**（§3.2）。
- 不改：`permanent-media` 的候选顺序、抢跑、健康判断，以及播放器。
- 验证：构建后检查改写规则存在，且只匹配 43 位 txid。真实 Range 行为放到 Step 4 部署后测。

### Step 3 — 香港节点配置模板、检查与预热脚本（代码）

- 📦 范围：新目录 `ops/hk-edge/`：nginx 站点配置模板（按 R1–R5、R8、R12 写）、上游自检脚本（R13）、`edge-check.sh`、`edge-warm.sh`、Route 53 记录、健康检查和 IAM 策略的 JSON 模板、`README.md`。目录内不超过 8 个文件，**不放任何密钥**，密钥用服务器上单独的 include 文件引入。
- `README.md` 包括：部署、证书安装与续期演练、双密钥轮换（§3.3）、清缓存、§6 扩容方案 A/B 的逐条命令，以及三种回滚各自的作用和耗时（DNS、应用、缓存，见 `01-ops-checklist.md`）。
- `edge-check.sh` 用 `curl --resolve pond-ripple.xyz:443:<香港IP>` 检查以下各项：

  | 类别 | 检查内容 |
  |---|---|
  | 页面与不缓存 | 首页 `200`；`/tracks/pond`、`/tracks/archive` 的普通访问和 RSC 请求都**不命中缓存**；HTML 响应不带缓存命中头 |
  | 静态缓存 | 同一个静态文件连续请求两次，第二次 `X-Cache-Status: HIT`；带随机参数请求，命中同一个缓存，且不回源 |
  | 音频 Range（`/tracks/No.1.mp3` 和 `/media/<一个已知 txid>`） | 分别在缓存未命中和命中时测：<br>• `bytes=0-0` 返回 `206`，`Content-Range: bytes 0-0/<总长>`，长度 1；<br>• 先 Range 后完整 GET、先完整 GET 后 Range 都正确；<br>• 跨分片的 Range 和尾部 Range（`bytes=-1000`）正确；<br>• 越界 Range 返回 `416`；<br>• 完整文件的 SHA-256 与原件一致 |
  | 回退与防滥用 | `/media/<不存在的 txid>` 返回 `404`；未知 Host 被拒绝；POST 请求静态路径被拒绝 |
  | 健康与 IP | `GET /api/ping` 带 `x-pond-ip-source: edge`；`/_edge/health` 返回 200；手动放置标记文件后返回 503 |

- `edge-warm.sh`：从仓库的原曲清单（`tracks-source.json`、`audio-stream-proof.json`）和 Step 0 盘点的 Blob 对象清单生成 URL 列表，经本机 nginx 逐个完整拉取一遍。
- 核对 `/sounds/` 和其他 public 静态目录的文件名和版本参数，确定 R1 里 `/sounds/` 的精确匹配规则。

### Step 4 — 合并、部署代码（用户放行）

- 谁做：用户放行后由 Claude 执行。
- 合并前：基于 P24 合入后的 main 跑完整 `verify.sh`，与 Step 0 基线对比，只允许出现既有的失败项。
- 内容：合并 main、push、部署。Production 只设置 `MEDIA_BLOB_ORIGIN`。`EDGE_PROXY_SECRET` 先不设，`NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 不改。
- 验证：
  - 线上行为与之前一致，`GET /api/ping` 带 `x-pond-ip-source: direct`。
  - 对 `https://pond-ripple.xyz/media/<已知 txid>` 做 Step 0 ⑥ 的同样测试，逐项和 Blob 直连对比：状态码、`Content-Range`、类型、长度、缓存头、完整 SHA-256。检查项目对外部改写的缓存设置（[Vercel 变更说明](https://vercel.com/changelog/vercels-cdn-now-respects-cache-control-headers-from-external-origins-by-default)），确认 Range 响应没有被错误缓存。
- 把这次部署标记为“**回滚基线**”：有 `/media` 改写，镜像仍指向 Blob。以后回滚应用只回到这次或更新的部署，不回到更早没有改写的部署。

### Step 5 — 购买与初始化服务器（用户购买，Claude 配置）

- 用户：
  - 按 `01-ops-checklist.md` 的 O1–O5 购买服务器、设置预算告警；
  - 把 Claude 生成的公钥 `~/.ssh/pond_hk_ed25519.pub` 加到服务器上（私钥只留在本机）。
- Claude 通过 SSH：
  - 系统更新，开启自动安全更新；
  - 新建 `deploy` 用户，禁止 root 登录和密码登录；
  - 防火墙只开放 22、80、443；
  - 时间同步；
  - 安装 nginx，并用 `nginx -V` 确认包含 `http_slice_module`。
- 拨测门槛（O4）：
  - itdog 的 ping 和 TCP 拨测要在白天、晚上 8–11 点各测一次；
  - 还要在 nginx 里临时放一个 10MB 测试文件，从本机和 itdog 多地测 **HTTPS 实际下载速度**。
  - 结果记入执行日志，明显不达标就退订换线路，不进入下一步。
- 做一份**不含任何密钥的基础镜像**：只包括系统加固和 nginx 安装，不含证书、AWS 密钥、edge 密钥和缓存，供 §6 方案 B 使用。

### Step 6 — DNS 迁到 Route 53（用户执行或放行，暂不切流量）

- 用户：
  - 按 O6 注册 AWS；
  - 在控制台创建 `pond-ripple.xyz` 的 hosted zone，或用一次性引导权限创建；
  - 按实际 Zone ID 建好两个最小权限 IAM 用户。
- Claude 用 `aws` CLI：
  - 按 Step 0 的导出结果**逐条**复制记录，**NS 和 SOA 除外**；根域名先只建一条简单 A 记录，值用 Step 0 ④ 记下的 Vercel 推荐值；
  - 通过 itdog 直接向 Route 53 分配的 4 台 NS 查询，确认大陆和海外都能拿到正确答案，记下解析耗时；
  - 确认 CAA（如果有）允许 Let's Encrypt 和 Vercel 使用的证书机构。
- 用户到注册商把 NS 改成 Route 53 的 4 台。
- 过渡期：
  - 上级域对 NS 委派的缓存时间通常是小时级，最长等 48 小时；
  - 过渡期内**不删 Vercel DNS 里的旧记录**，期间要改任何记录，两边同步改。
- 验证：
  - 全球访问正常；
  - Vercel 域名页状态正常、证书能续期；
  - 用告警测试邮件确认 SPF、DKIM、DMARC 都通过（看邮件头，不只是能收到）。
- 这一步完成后功能没有任何变化，只是换了 DNS 托管方。回滚：把 NS 改回 Vercel。**注意这不是即时回滚**，也要等委派缓存过期，同样是小时级。

### Step 7 — 证书与节点上线（不切流量）

- Claude：
  - 按 R10 签发并安装证书（用户按密钥交付规则提供 `pond-dns-acme` 的密钥），用 Let's Encrypt 测试环境演练一次续期和 reload；
  - 部署 `ops/hk-edge/` 配置和上游自检（R13）；
  - 生成 `EDGE_PROXY_SECRET`，写入服务器的 include 文件，同时按交付规则交给用户。
- 用户：在 Vercel Production 环境设置 `EDGE_PROXY_SECRET`，然后重新部署（或放行 Claude 走 REST API）。
- 验证：从本机（大陆网络、直连）跑 `edge-check.sh`，全部通过。

### Step 8 — 切大陆流量（用户放行）

- Claude 按 §3.4 和 R12 操作：
  - 建立 HK1 的独立健康检查，从 nginx 日志确认 Route 53 的检查请求确实打到了 HK1，状态为健康；
  - 建立 `edge-cn` 加权记录；
  - 把根域名的简单 A 记录换成“默认 → Vercel”和“中国 → `edge-cn`（EvaluateTargetHealth）”两条地理位置记录。
- 观察：
  - 1 小时内：itdog 拨测对比 Step 0 基线（大陆节点应解析到香港，海外节点仍解析到 Vercel）；nginx 错误率；缓存命中率；带宽峰值。
  - 24 小时：Upstash 限流 key 是分散的用户 IP，不是一个香港 IP；Vercel 没有对香港 IP 发起质询或限流；Vercel 用量的增幅在 Step 0 ⑦ 定的阈值内。
  - 用大陆网络走一遍 F10 里的项目：封面、旧 Score、Privy 登录、钱包连接和签名、Semi 注册入口。记下实际体验，这些项目本阶段不处理。
- **故障切换演练**（O11，选低峰时段）：
  - 停掉 HK1 的 nginx，确认大陆拨测节点改为解析到 Vercel，记下实际用时；
  - 恢复后确认切回香港；
  - 再用 R13 的标记文件演练一次“香港活着但连不上 Vercel”；
  - 演练期间大陆用户可能有几分钟访问失败，结果写进执行日志。
- 回滚：删除“中国”地理位置记录，或把根域名改回简单 A 记录，生效时间取决于运营商 DNS 缓存，通常几分钟。

### Step 9 — 镜像切到同源（用户放行）

- Production 环境的 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 改为 `https://pond-ripple.xyz/media`（必须是完整 HTTPS 地址，不能写成相对路径 `/media`，否则 `candidates.ts:18` 会判定无效），然后重新部署（`NEXT_PUBLIC_` 变量在构建时写入，必须重新部署）。Preview 环境保持指向 Blob。
- 验证（按 F5 的现行规则）：
  - 大陆（本机）和海外（itdog 海外节点，或让 Claude 走代理测）各打开一次 `/score/1` 和 `/echo/1`；
  - 抓包确认音效等资源对 `/media/<txid>` 完整 GET 返回 `200`、内容校验通过；Score 底曲流式播放发出的 Range 请求返回正确的 `206`，能拖动进度；
  - 大陆请求经过香港（响应带缓存状态头），海外请求不经过；
  - 临时让 `/media` 对一个对象返回 404，确认只有这一个对象回退 Arweave。
- 回滚：
  - 把变量改回 Blob 地址，重新部署；`/media` 改写保留，已打开的页面不受影响。
  - 如果怀疑香港缓存了错误内容，按 `ops/hk-edge/README.md` 清空缓存目录并 reload。开源版 nginx 不能按单个 key 清除，只能整体清空。

### Step 10 — 收尾

- 完整 `verify.sh`；写 `02-execution-log.md`、JOURNAL（非显而易见的决定），更新 STATUS / TASKS 里的 P25 条目。
- 按 §6 演练一次方案 A（调高带宽再调回），确认命令可用。
- 在 `docs/MAINNET-RUNBOOK.md` 增加“香港节点运维”一节，或者指向 `ops/hk-edge/README.md`。
- **需要用户批准**：在 `docs/STACK.md` 的“部署”一节和 `docs/ARCHITECTURE.md` 登记香港节点、Route 53 和同源镜像。
- 交给用户 §8 的验收清单，然后停下等验收。

---

## 8. 验收清单

1. 对比 `02-execution-log.md` 里 Step 0 和 Step 8、Step 9 的拨测数据，以及 Vercel 用量变化；
2. 用你自己的手机（大陆网络、不开代理）打开首页、播放原曲、打开 `/score/1` 和 `/echo/1`（拖动一下进度）、走一次短信登录；
3. 看执行日志里 F10 各项（封面、钱包、Privy 等）在大陆的实际体验，决定要不要另开阶段处理；
4. 找一位海外朋友，或者开代理，确认海外访问没有变慢；
5. 看执行日志里故障切换演练、续期演练和扩容演练的结果；
6. 看 §5 的推荐值，需要改的告诉我。

---

## 9. 红线与不做

- 香港服务器上**不放任何应用密钥**（Supabase、运营钱包、Privy 等）。只放：TLS 证书私钥、只能改 `_acme-challenge` TXT 记录的 AWS 密钥、`EDGE_PROXY_SECRET`。基础镜像里一样都不放。
- 云账号和 AWS 账号的密钥都用最小权限的子账号或 IAM 用户，**不用主账号密钥**；AWS 主账号开启 MFA。
- 香港不缓存 HTML、RSC、API，也不缓存带 `Set-Cookie` 的响应；只缓存 R1 列出的精确路径。
- 香港不直接代理 Arweave 或其他任意上游，只回源 Vercel，而且必须验证证书（R4）。
- edge 密钥只在 `/api/` 上发送。
- 不加 AAAA 记录。
- `/media` 改写一旦上线，永久保留。
- 不改 `permanent-media` 的候选、抢跑、健康判断逻辑，不改播放器，不改合约，不加 migration，不新增 npm 依赖。`aws` CLI 和 acme.sh 是运维工具，不进项目依赖。
- 单文件不超过 220 行，单层目录不超过 8 个文件；不碰 `/test1`；**不覆盖 P23、P24 已有的行为**（Step 1 会改 P24 也改过的 `middleware.ts`，只改 IP 来源这一处）。
- 买机器、注册 AWS、迁 DNS、改环境变量、调带宽、push、部署，每一项都要用户放行。

---

## 10. 已知后果与风险（需要用户知情）

- **Vercel 仍然是共同的故障点**：大陆的动态请求、音频缓存未命中、海外的 `/media`，以及故障回退的目标，全都依赖同一个 Vercel 项目。Hobby 额度用尽后可能要等额度窗口恢复，**这种情况 DNS 回退也救不了**。Step 0 ⑦ 记录当前用量并设停止阈值，Step 8 观察增幅。宣发前按 P24 运维清单 O4 评估是否升级 Pro。本方案只解决“香港出问题”，解决不了“Vercel 出问题”。
- **带宽与费用**：几十人同时首次访问，单台机器就已经吃紧（§6 公式）。按流量计费后带宽可以临时调高，但费用按实际 GB 计算。被人恶意刷流量也会产生费用（50Mbps 跑满一天约 540GB），预算告警只通知不停机，要按 R14 人工处置。
- **故障切换不是瞬时的**：Route 53 汇总多个检查节点的结果才判定故障，再加上 TTL 和运营商 DNS 缓存，大陆用户通常要几分钟才恢复，以 Step 8 实测为准。少数不遵守 TTL 的运营商 DNS 会更久。
- **健康检查的盲区**：Route 53 的检查节点在境外，发现不了“大陆到香港的线路变差”。R13 能补上“香港连不上 Vercel”这种情况，线路变差靠 O12 的大陆侧监控，再由人工判断是否回滚。
- **按国家分流不是百分之百准确**：依据的是 DNS 查询来源，用境外 DoH 的大陆用户会直连 Vercel。Route 53 在大陆的解析速度在 Step 6 拨测。
- **Vercel 看到大量请求来自同一个 IP**：可能被 Vercel 自动防护质询或限流，Step 8 重点观察。真的发生的话，Hobby 套餐能调的手段有限，只能回滚或升级 Pro 后再处理。
- **大陆体验并没有全部加速**：F10 列出的封面、旧 Score JSON、Privy、钱包、WalletConnect、Semi 注册页仍然直连第三方。大陆用户推荐用短信登录，或者用浏览器插件钱包、钱包 App 内置浏览器。
- **政策风险**：如果域名或 IP 被封锁（DNS 污染、SNI 阻断），香港代理也救不了。NFT 和加密相关业务在大陆有政策风险，这不是技术能解决的问题。香港云服务商也可能依据自己的条款停用机器，这时健康检查会自动把大陆用户切回 Vercel，不影响海外用户。
- **海外音频多经过一层 Vercel**：海外的 `/media` 经 Vercel 改写转到 Blob，计入 Vercel 流量。
- **DNS 迁移回滚很慢**：NS 改回 Vercel 要等上级域的委派缓存过期，是小时级的，所以 Step 6 要做在没有其他变更的平静期。
- **新增两个付费账号**：云服务商（按流量计费）和 AWS（hosted zone、地理位置查询、健康检查，每月几美元，以官网为准）。都要绑定支付方式。按量机器如果因为欠费被停，健康检查会自动切回 Vercel。
- **密钥泄露的后果**：如果 `EDGE_PROXY_SECRET` 泄露，别人可以伪造 IP 绕过限流，但碰不到登录和资金。正常轮换用双密钥，不会中断；泄露时要立即作废旧密钥，大陆用户可能短时间内共用香港 IP 被限流，偶尔会出现 `429`。

---

## 11. 审查记录（2026-11-14）

Codex（gpt-6-astra，high）提出 18 条问题，Claude 对照代码和官方文档逐条核实后**全部采纳**。

| # | 问题 | 处理 |
|---|---|---|
| 1 | `/tracks/` 下有页面，不能按前缀缓存 | 采纳：F4、R1 改为精确匹配；Step 3 加不缓存的验证 |
| 2 | 回源没验证 Vercel 证书 | 采纳：R4 改为强制验证，回源地址不解析自身域名 |
| 3 | 健康检查没固定检查对象 | 采纳：R12 每台机器配 IPAddress + FQDN + SNI；Step 8 先确认检查真的打到对应机器 |
| 4 | Vercel 是共同故障点，Hobby 额度没有设门槛 | 采纳：Step 0 ⑦ 记用量，Step 8 加阈值，§10 单列 |
| 5 | P15-G 已被 P15-H 和当前代码取代 | 采纳：F5 改写；Step 9 按完整 GET 和底曲流式 Range 分别验收；Blob 对象数改为现场盘点 |
| 6 | 只写 slice 不够 | 采纳：R3 列出必须同时配置的项；Step 3 补全 Range 测试 |
| 7 | 上游缓存头会让 nginx 缓存时长不生效；外部改写的头需要实测 | 采纳：F12、R1；Step 0 ⑥ 和 Step 4 做对比实测 |
| 8 | 证书续期没有闭环 | 采纳：R10 加安装、reload、续期演练和到期监控 |
| 9 | DNS 迁移的例外记录与等待时间 | 采纳：Step 6 排除 NS/SOA、两边同步、CAA、邮件头校验；§10 说明 NS 回滚很慢。AAAA 已查实不存在（F1） |
| 10 | 镜像回滚没覆盖已打开的页面 | 采纳：`/media` 改写永久保留；Step 4 设回滚基线；Step 9 加清缓存 |
| 11 | 密钥发送范围过大，IP 和轮换规则不严 | 采纳：只在 `/api/` 上发；§3.3 定 IP 规则和双密钥轮换；§10 改掉“不会中断”的说法 |
| 12 | “没有带宽被滥用的风险”说法不成立 | 采纳：§3.2 改措辞；R2 参数白名单与方法限制；R8 Host 白名单、限速与告警；R14 处置 |
| 13 | 直连第三方的清单不全 | 采纳：F10 补全；§1 写明不在范围内；Step 8 加大陆体验观察 |
| 14 | IAM 创建顺序与读取权限 | 采纳：Step 6 先建区域再按 Zone ID 授权；R10 引用 acme.sh 官方最小策略；O6 拆开写 |
| 15 | 镜像会把密钥一起复制 | 采纳：Step 5 做不含密钥的基础镜像；方案 B 各自签证书、重新生成主机密钥 |
| 16 | 分流、倍数和切换时间写得太确定 | 采纳：§3.4、§6、R12 改为以实测为准；§6 加带宽公式；O4 加 HTTPS 实际下载测试 |
| 17 | 完整验证太晚，P24 回归不足 | 采纳：Step 4 合并前加完整 verify；Step 1 加 P24 回归；§9 改为“不覆盖 P24 行为”；D4 写明授权 |
| 18 | 核验标记的范围不一致 | 采纳：R7 覆盖提前返回分支，统一用 `GET /api/ping` 检查 |
| 自查 | Codex 未提出：健康检查访问 `/` 会给 Vercel 带去大量请求 | 新增：R12 改由 nginx 本地应答 `/_edge/health`，R13 补上游自检 |
