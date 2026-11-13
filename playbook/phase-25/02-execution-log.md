# P25 执行记录

2026-11-14。P24 合入后的 `main` 基线 `0a15e52`，隔离工作区 `E:\Projects\nft-music-p25`，分支 `codex/p25-cn-edge`。只复制用户原有的 00/01 计划供阅读，不修改、不把它们混入实现提交；主仓的 P23 文件不复制、不修改。没有 push、合并 main、部署或修改生产配置。

## 代码进度与实际启用状态

| 步骤 | 代码/本地验收 | 实际启用 |
|---|---|---|
| Step 0 基线 | 部分完成：公开 HTTP、DoH、音频清单及历史 Blob 原件核对；受权后台项目尚未取得 | 不能视为完整生产库存、用量或大陆测速 |
| Step 1 可信 IP | 新旧密钥、合法单 IP、IPv6 /64、所有 API 返回来源标记；P24 限值/失败策略保留 | 默认关闭：没配密钥仍用原 XFF/x-real-ip 来源 |
| Step 2 同源镜像 | 可选服务端 Blob origin 改写，只有43位 txid；合法配置构建 manifest 已核验 | 默认关闭：没配 MEDIA_BLOB_ORIGIN 没有改写；原镜像变量未动 |
| Step 3 节点准备 | nginx 模板、渲染、Range/缓存检查、预热、自检、systemd/logrotate、Route53/IAM 模板与手册 | 仅本地回环合同演练；没有香港机器、证书或云端配置 |
| Step 4 发布 | 代码可交主代理整合；生产变更留白天 | 本工作区没有发布 |
| Step 5–10 | 操作说明已备好 | 购买、线路、AWS/DNS、生产变量、流量/镜像、续证与故障/带宽演练均未执行 |

**不能据此声称国内加速已上线，或大陆用户已经变快。** 当前用户路径仍由原生产配置决定。

## 基线证据与缺口

- 公开站首页 `200`，`/api/ping` `200`，原曲 `No.1.mp3` 的 `bytes=0-0` 返回 `206`、1字节，`Content-Range: bytes 0-0/2846656`。现网已知 `/media/<txid>` 在基线时为404。
- 历史公开 Blob 对象 `PEba3c_yoWBaoc8ILomlKPojUzlf_D-LfAR6iVtL8G4`：完整 `200`、81,546字节；Range `206`、1字节；完整 SHA-256 `b247eaf947b33ad05369eea63cae662c8bdcded32651557bcd6013108d5b04e8` 与 H4 原件一致。该读取不能证明当前完整 Blob 库存数量或生产镜像变量。
- 35首原曲清单合计160,211,840字节；33个本地 `/sounds` 音效 URL 无hash/版本，因此本期维持不缓存 `/sounds`。
- 公开 DoH：NS仍为 Vercel；AAAA/DS无回答；CAA允许 Let's Encrypt、Google 与 Sectigo；A读回 `64.29.17.65` / `64.29.17.1`。这些是当时公开记录，不能替代 Vercel 域名页的推荐回源目标。
- `vercel dns ls pond-ripple.xyz` 返回当前 CLI 身份无权限。全量 DNS 导出、注册商/通配符核对、独立回源目标、生产环境读回、Blob现库存与套餐用量仍待后台权限。
- 本机 DNS 与连接落到 `198.18.x` fake-IP，即使 curl 显式 `--noproxy '*'` 也一样；本次耗时不能算大陆无代理线路成绩。itdog、多时段实下载、真实新访客MB/请求数仍未做。
- 原始头、字节、调查草稿与验证日志在 `D:\Temp\Hui\p25-baseline-20261114`；文件不含真实应用密钥，不提交大体积中间产物。

## 安全决定与计划偏差

1. 外部 rewrite 默认转发请求头。只读审查及本地真实 nginx / Next 外部源都复现 Cookie/Authorization canary 泄漏，故把中间件匹配范围从 API 扩至精确媒体路径，仅保留 Host、Accept、Accept-Encoding、Range、If-Range、If-None-Match、If-Modified-Since；香港媒体路径另清 Cookie/Authorization。API鉴权与P24额度策略不变。该必要保密修正已由主代理明确授权。
2. Next 外部 rewrite 默认大小写不敏感，而 middleware matcher 使用无 `i` 的正则。真实 Next 复现 `/MEDIA/<43位>` 可绕过小写清洗；最终 matcher 前缀显式匹配大小写，处理分支带 `i`，仍要求43位txid，不改全站大小写路由规则。编码前缀未取得外部可达的泄漏证据，不记作漏洞。
3. Blob origin 只接受已核验的公开 Vercel Blob 主机类型；规范化大小写和尾点，并拒绝本站/edge-cn、路径、凭证、参数、非HTTPS及非标准端口。nginx 渲染器也规范化尾点，防止回源循环。
4. nginx 只缓存哈希静态、精确No.N.mp3、43位txid。静态/media参数移除；原曲只保留合法64位hash的v；1MB slice、独立分片key、200/206、锁与显式buffering；404一分钟，416/5xx和Set-Cookie不缓存。动态/RSC/API不缓存。
5. 真实 nginx 测试的 Windows master 事件握手失效、Node24 fetch 不能正确保留 Host。运行器达到三次修改后暂停，由主代理只读取证并授权一次集中修正：仅Windows测试单进程启动，HTTP用 node:http。生产 nginx 模板保持原策略；后续修复没有放宽任何产品断言。
6. 初次过早运行遇到未复制完的依赖，等待实体复制完成后重跑；没有改P24补救。另修正 ProcessEnv 与精确密钥参数的 TS2559，仅显式传两项密钥。Git Bash会先放系统工具路径，测试夹具在子shell内明确放入离线工具目录，避免误用真实curl；生产脚本不受影响。
7. `edge-check` 静态状态的 `&&` 在 Bash `set -e` 下可能放过404，已拆为独立强制断言，并用404负测确认不会继续验后续项目。

## 验证

- `npm run p25:test`：12/12通过。覆盖密钥关闭/双密钥/伪造、单IP/IPv4/IPv6、middleware成功/429/失败开放与所有提前返回、媒体凭据白名单、Blob配置边界、尾点回源、静态404拒绝、自检连续3次失败/恢复及磁盘/证书告警去重。
- `npm run p25:nginx`：真实 nginx、本地大于2MB音频源；冷/热缓存、随机参数不回源、GET/Range先后顺序、首字节/跨片/尾部/越界416/完整hash、404短缓存、5xx/Set-Cookie不缓存、动态/RSC隔离、Host拒绝、POST405、API可信头和媒体canary剥离、健康标记503/200均通过。只将测试监听换为回环HTTP；真实香港TLS与线路仍待验收。
- 合法 MEDIA_BLOB_ORIGIN 的生产构建通过，routes-manifest中只有 `/media/:txid([a-zA-Z0-9_-]{43})` 指向该Blob的 `/media/:txid`。
- `npm run p25:media`：真实 Next 生产服务经过构建后的 middleware 与外部rewrite，本地可观测上游不再收到Cookie/Auth/edge/其他凭据；Range/If-Range保留；大小写路径及非法长度覆盖。只临时修改本工作区构建产物的目标，finally恢复；不改源码或线上配置。测试仅发ping/媒体GET，采用生产相同路径规则，防止本地只读开关掩盖路由边界。
- Bash、Python和AWS JSON语法、`git diff --check`均通过；无新增依赖，每个新代码文件≤220行，每层新目录≤8文件。
- 最后一次 `npm run p24:test` 20/20通过，日志 `p25-p24-regression.log`。
- 最终 `bash scripts/verify.sh`（`p25-release-verify.log`）退出码1，只命中既有 `src/lib/self-mint` 9文件、`src/types` 10文件两项目录基线；TypeScript、ESLint、完整业务Gate、真实Production历史快照、669词条、P21、当前默认配置生产构建及Forge 139/139全部通过，没有新增失败。按用户已接受基线视为通过。最终构建确认未配置Blob origin时无外部改写，媒体matcher覆盖大小写且严格43位。

本地实现提交依次为 `b9a4cbf`（可信IP）、`b5fb7b4`（默认关闭改写）、`8e73711`（凭据隔离及大小写回归）、`3db69cf`（香港配置与运维工具）。无新增代码待处理；本记录单独提交。主代理统一维护主STATUS/TASKS/JOURNAL等并决定整合，不能把本地提交当作部署或加速启用。

## 白天执行顺序

补齐受权后台基线 → 用户购买香港机器/双时段线路验收 → AWS区域与最小权限/全量DNS核对 → 先发布兼容代码并配置Blob origin、验证公开Range → DNS迁移但不分流 → 独立DNS-01证书/节点/edge密钥及真实检查 → 大陆分流观察 → 生产音频镜像切同源 → 续证、故障、带宽演练与真实登录/播放验收。故障与带宽演练已授权，但香港节点和线路前置未满足，本夜不能执行。

运维步骤及三种回滚见 `ops/hk-edge/README.md`。云厂商/实例尚未选定，带宽操作采用实际控制台流程，不能填猜测的跨云CLI或提前运行付费动作。
