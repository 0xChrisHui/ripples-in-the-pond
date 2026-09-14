# P15-G — Vercel 高速镜像探针与自动恢复

> **性质**：P15 发布后的增量扩展，不改写已经完成的 P15-0/A–F 证据。
> **目标**：永久曲谱先建立真相，再用真实音频对象判断 Vercel Blob 是否可用；镜像异常时在 800ms 内转向 Arweave，恢复后无需改环境变量或重新部署即可自动启用。
> **授权边界**：仓库代码、自动测试与文档可连续完成；Blob Store 创建、对象上传、三环境变量和 Preview/Production 真服务验收集中留到最后配置。

---

## G0 — 冻结分层合同

- 链上 tokenURI、Arweave metadata/recipe/events/sounds 与 canonical SHA-256 仍是永久真相；Vercel 只提供可删除、可重建的音频字节副本。
- Score 与 Pond Echo 在永久 manifest/metadata 已解析后才能选择高速来源；两套播放器共用镜像健康判断，但不共用播放状态机。
- `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 长期保留。额度耗尽不清空变量、不按自然月切换、不为恢复镜像重新部署；是否恢复只由真实探针成功决定。
- 已有 canonical CacheStorage 命中时不探针、不联网；历史兼容资源仍按原有类型、长度与解码合同验证。

## G1 — 真实素材一字节探针

1. 曲谱就绪且首窗没有可信缓存时，用首个实际需要播放的音频 txid 构造镜像 URL。
2. 浏览器直接发送 `GET` + `Range: bytes=0-0`，不访问普通应用页面或与本次播放无关的固定健康页。
3. 只有以下条件同时成立才判定镜像可用：HTTP `206`、`Content-Range` 为 `bytes 0-0/<正整数>`、`Content-Length` 为 `1`、Content-Type 为音频或二进制。
4. `200`（忽略 Range）、404、403/429/5xx、CORS/DNS/网络错误、响应头异常都不能进入镜像路径；立即取消响应体并回退。
5. 探针只证明“这个对象此刻可以下载”。后续完整音频仍逐对象执行类型、长度、SHA-256/兼容验证，单对象缺失或损坏只回退该对象，不伪造全局健康。

## G2 — 800ms 有界抢跑

- 探针明确失败时立即启动 Arweave，不等待计时器结束。
- 探针在 800ms 内没有形成有效 `206` 时取消镜像探针并启动 Arweave；允许最多 100ms 浏览器调度误差。
- 同一页面会话、同一镜像 origin 只允许一个在途探针；Score/Pond Echo 的并发素材等待同一个结果，不能各自制造探针风暴。
- 竞速或切源后必须 Abort 败方；不允许无界双下载。探针与随后的完整镜像 GET 共用 900ms 总预算；超时后 Abort 镜像，并由统一 resolver 逐对象回退三条永久网关。
- 关键测量点：`p15:mirror-probe-start`、`p15:mirror-probe-settled`、`p15:ar-fallback-started`、`p15:first-verified-audio-ready`，以及两套播放器已有的首声 marker。

## G3 — 持久长熔断与自动恢复

- localStorage 只保存 schema、规范化镜像 origin、连续失败级别与 `nextProbeAt`；严禁保存钱包、userId、txid、recipe 或播放偏好。
- 推荐退避序列为 `5 分钟 → 1 小时 → 6 小时 → 24 小时（封顶）`；不可用 localStorage 时退化为当前标签页内存状态。
- 冷却期内直接跳过镜像。到期进入 half-open，同 origin 只放行一个真实素材探针；Range 成功只临时准入，完整镜像对象通过既有验证后才清除失败状态；任一服务级失败进入下一档退避。
- 单对象 404、哈希不符或格式错误只做对象级回退；只有 Range/CORS 合同失败、连续网络失败或服务级 HTTP 错误才提升 origin 熔断级别。
- 不按“下月 1 日”强制恢复，避免 Vercel 实际 30 天用量窗口与自然月错位。

## G4 — 播放器接入

- Score：永久 manifest 就绪后，以实际底曲或首个音效完成一次来源选择；本次加载复用结果，原有全文件验证与独立音频时钟不变。
- Pond Echo：永久 metadata/recipe/hash 清单就绪后，以首窗第一段真实 clip 完成一次来源选择；首窗与后续批次复用结果，窗口化解码、重复 clip 复用和约四分钟时间线不变。
- 路由离开必须同时取消探针和媒体请求；重试加载重新读取持久健康状态。
- 镜像关闭或额度耗尽不能改变 tokenURI、Arweave 内容、永久 Decoder 或已验证 CacheStorage。

## G5 — 验证、发布与用户配置 Gate

自动验证矩阵：

- `206` 正常；`200` 忽略 Range；Content-Range/Length/Type 错误。
- 404 对象级回退；403/429/5xx、CORS/DNS/超时的 origin 退避。
- 800ms deadline、Abort/路由离开、同 origin 并发探针去重与部分等待者取消。
- localStorage 缺失、损坏、旧 schema、跨刷新熔断、half-open 成功恢复。
- 探针成功但完整对象 404/哈希错误；并发完整 GET 服务失败只升一档；缓存命中零探针；镜像与全部 Arweave 候选均失败时诚实报错。
- 持久状态不含身份、txid 或曲谱；`scripts/verify.sh` 全绿。

发布 Gate：

1. 先在 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 仍为空时把本 Track 代码合入 `main` 并完成一次 Production 部署，确保回退保护先于配置上线。
2. 用户创建 **Public** Vercel Blob Store；写入优先使用 Vercel 部署内的短期 OIDC。若一次性迁移必须临时启用 `BLOB_READ_WRITE_TOKEN`，只准由固定资产白名单的 Preview 上传器使用，完成后删除上传器与临时变量、撤销长效 Token，并把 Store 恢复为 OIDC；凭证不进入浏览器、仓库、日志或聊天。
3. 资产清单必须从当前 NFT 钉住的永久 txid 建立，不能把后来改过的同名本地文件当真相。选择固定目录前缀（推荐 `media/`），pathname 精确为 `media/<arweave-txid>`，禁用随机后缀与覆盖；既有同路径对象只有全字节 SHA-256 相同才视为幂等成功。
4. `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 填 Public Blob origin 加固定目录前缀，例如 `https://<store-id>.public.blob.vercel-storage.com/media`；配置 Development/Preview/Production。Public Blob 浏览器读取不需要 Development 写凭证；Development 只需 pull 新基址并重启，实际只部署 Preview/Production。
5. Preview 真测 Range/CORS：必须返回严格 `206`、一字节 body 与正确 Content-Range，再推进 Production。
6. Production 小流量验收成功、超时、超额模拟和自动恢复；以后额度变化不再重新部署。

本次首批清单为 63 个当前已钉住对象：Pond Echo 的 36 段、Score #1 永久音效表的 26 个音效与 Score #1 底曲。首批 63 个对象全部通过 Arweave 原件与 Blob 副本全字节 SHA-256、严格 Range/CORS、pathname 和 Content-Type 核对后，才允许配置镜像基址。

## 完成预算

- 未知或失败镜像：`arFallbackStarted - mirrorProbeStart ≤ 800ms`，另允许 ≤100ms 调度误差。
- 探针响应体 ≤1 byte；同 origin 同健康周期最多一个在途探针；可信缓存命中为 0 probe。
- 镜像失败带来的额外阻塞 ≤900ms；竞速败方均已 Abort，无无界双下载。
- 原 P15 NFT 冷首声 p95 ≤2.0s、热首声 p95 ≤500ms 继续成立。
- half-open 成功后无需刷新、修改变量或重新部署，下一未缓存资源自动恢复高速镜像。
