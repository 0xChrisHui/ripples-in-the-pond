# P11 收口 Review

> 2026-10-02 后续修复：R1–R3 已完成代码修复及定向验证；浏览器通过 R3，R1 的真实双引擎播放与 R2 的生产预取命中仍受本地环境限制。详见文末，以下发现保留为修复前记录。

日期：2026-10-02
审查基线：P11 最终提交 `f24f5bd`；当前远端主线 `04a33bf`。
结论：本轮有限范围 review 完成，发现 **1 项 P1、2 项 P2**；不宜将 P11 标记为“无遗留问题”。原先用户确认的主要换场体验仍保留，本报告没有修改产品实现。

## 范围与方法

- 核查常驻 Pond、路由事务、Score 加载外壳、档案返回、曲谱预热和播放器生命周期。
- 复用 `E:/Projects/nft-music-p16-fast` 的干净主线与既有依赖；没有触碰旧 `E:/Projects/nft-music` 工作区。
- `src/components/pond-shell`、`src/features/home-pond`、`src/features/score-playback` 和 `useScorePackagePreload.ts` 在 `f24f5bd..04a33bf` 间没有变化；下列问题仍适用于当前主线。
- 浏览器只有一次检查会话，使用原有 Edge profile、CDP helper 和只读档案夹具。没有生产写操作。

## 发现

### R1 / P1：Score 播放没有停止常驻首页 ECHO，存在重叠播放路径

位置：`app/(pond)/score/[id]/components/ScorePondScene.tsx:112`。

触发路径：在首页播放第 36 首 Pond Echo，然后经 `/me` 打开任一可播放 Score 并点击播放。

`PondExperience.tsx:85` 将 ECHO 引擎挂在常驻外壳上；切换到档案或 Score 只是隐藏首页，不会卸载这个 hook。Score 进入 playing 后只调用 `PlayerProvider.stop()`，它仅停止普通 Track 的 HTMLAudio。ECHO 订阅的是 `onBeforePlay`（`useFeaturedEchoPlayback.ts:77–82`）；Score 不通过普通播放器的 play，因此不会触发该回调。ECHO 的停止按钮同时被隐藏在不可交互首页中。

影响：ECHO 与 Score 两个引擎可以同时运行，违背单播放器要求，用户还无法在 Score 页停止隐藏的 ECHO。历史 `audioCleanup` Gate 从直接进入 Score 开始，没有先启动 ECHO，无法覆盖该路径。

建议：在 Score 取得播放权时显式让普通 Track 与 Featured ECHO 共同交出播放权，覆盖 playing 和等待播放的状态；补一条“首页 ECHO → 档案 → Score 播放”的定向验收。

证据等级：代码调用链确认；本轮真实双声复现因本地有效快照缺失未完成，不声称已听到或测得双声。

### R2 / P2：预热的 Score Package 没有被 Score 页面或播放器消费

位置：`src/hooks/me/useScorePackagePreload.ts:10–16`。

进入 `/me` 后，hook 下载、校验并缓存 package JSON，解析结果随后被丢弃。实际 Score 路径由服务端 `getActiveScoreSnapshot` 读取 active pointer 和 revision，向页面内嵌 `playbackBootstrap`。客户端 `ScorePondScene.tsx:72` 使用这个 bootstrap；`resource-loader.ts:63–83` 直接读取其中的 events/sounds，仅请求音频。它没有读取 package ref/hash 或预热的 package 缓存。

影响：现有预热确实会下载小文件，但无法缩短服务端详情查询或该播放器的曲谱等待；它额外占用网络和缓存。打开 Arweave 永久播放器也不能复用本站 origin 下的 Cache Storage。不能将目前的快速打开归因于 package 预热，主要收益来自加载外壳。

建议：先明确预热的消费点。按现有 verified snapshot 架构，最小方案是去掉无消费路径的下载；若必须保留“预热曲谱”的产品目标，应接入一个实际可复用且核验身份一致的读取路径，不能绕过后端 verified snapshot。

证据等级：静态数据流确认；现有 `score-snapshot.test.ts` 通过，验证 bootstrap 路径只请求启动音频，事件来自内嵌快照。

### R3 / P2：`/me/test` 的调参页面被常驻路由层永久隐藏

位置：`src/features/home-pond/PersistentRouteSurfaces.tsx:97–102`，`src/components/pond-shell/use-prepared-archive.ts:7–10`。

`/me/test` 返回包含调参按钮的 `MePondArchive`，但该 children 被放进 `.pond-route-surface`。路由分类把 `/me/test` 视为 archive，稳定后 `data-archive-placeholder=true`，CSS 对这个容器执行 `display:none`。首次直达 `/me/test` 时，预备档案又只识别精确 `/` 或 `/me`，因此没有另一份可见档案；从首页导航过来则只显示无调参按钮的常驻档案。

影响：保留的调参路由无法按页面代码提供透明度/遮罩控制。普通 `/me` 不受这一问题影响。

建议：让 `/me/test` 的模式传入唯一档案实例，或在统一 Surface 中显式处理测试页内容，避免再挂第二个档案实例。

证据等级：路由分类、组件层级与 CSS 条件静态确认；本轮浏览器被前置 Score 读取阻断，未到达该检查。

## 验证结果与限制

| 检查 | 本轮结果 |
|---|---|
| TypeScript `tsc --noEmit` | 通过 |
| Pond/Score/档案/预热/API 定向 ESLint | 通过 |
| P15-I `instant-start.test.ts` | 通过，覆盖启动闭包与排队播放 |
| P15 `verify-me-archive.ts` | 通过，覆盖 owner、Echo 缓存与草稿合同 |
| P15-H5 `score-snapshot.test.ts` | 通过，覆盖 verified snapshot/bootstrap |
| `next build --webpack` | 未通过：5 个 Google Fonts 的 TLS 下载失败；未改字体配置或重跑构建 |
| 浏览器三向/播放检查 | 未完成：本地 Development 下 Score #1 缺有效 snapshot，返回失败状态而非 ready |
| 浏览器工具 | 首轮初始化字符串缺少分号，probe 未安装；已修正复现文件但未重跑，该轮不计为产品 Gate 通过 |
| 完整 `verify.sh`、20+ 循环、全视口/设备矩阵 | 本轮未执行，沿用原延期范围 |

浏览器原始失败记录：`reviews/evidence/p11-closeout-review/browser.json`。`reproduce.mjs` 复用既有 helper，修正脚本后的版本尚未重新运行；原始失败记录完整保留。原收口 Gate 只说明历史版本与历史环境通过，不计为当前提交重新通过。所有产品文件保持原样，验证服务已停止。

## 收口建议

1. 优先修复 R1 的 ECHO/Score 互斥缺口。
2. 对 R2 明确实际加速路径，修正文档对预热收益的表述；恢复 `/me/test` 的调参入口（R3）。
3. 修复后只补受影响路径的验证，已有静态与数据合同测试可按变更范围复用。
4. 上述问题不涉及链上合约或资金管线，不据此阻止 P16 的独立主网 mint 验证；共享前端的下一轮施工应携带这份问题清单。

本轮不推送、不部署、不修改 STATUS/TASKS 的项目阶段；报告保存在独立本地 review 提交中。

## 2026-10-02 修复闭环

用户授权“都修一下”。修复基线为本工作树 `a3fe0dc`，其中已有另一个任务完成的 P16 标签修正；本提交只包含下列 P11 修复，没有推送或部署。

| 问题 | 修复 | 验证 |
|---|---|---|
| R1 / 播放重叠 | Track、Featured ECHO、Score 在用户发起播放时同步让其他引擎停止/暂停；等待资源的 Score 意图也会被取消。离开 Score 时同时取消待播意图。移除原先等到 playing 才停止普通 Track 的单向 effect。 | 互斥订阅/注销测试、现有 Score 引擎启动测试通过；新增“取消后资源到齐不自动起播”反例通过。真实 ECHO→Score 浏览器路径未到达。 |
| R2 / 无消费者预热 | 移除无用的 AR package 下载。进入 `/me` 后每 150ms 提交一张已完成唱片的完整 RSC 预取，由 Next 调度和缓存；打开和预取共用包含 chain/contract/token 的地址。曲谱仍来自服务端 verified snapshot，预取不挂载播放器、不提前下载音频。 | 本地 Next 16.1.6 源码确认 FULL 包含 loading 边界后的页面数据，导航读取同一缓存；OP/Ethereum/Sepolia 地址测试通过。生产预取命中及速度收益未实测，不承诺毫秒数。 |
| R3 / 调参页隐藏 | `/me/test` 初始化唯一 prepared archive，并在该实例上传入 showControls；路由页改成轻量占位，消除隐藏的重复档案。 | 单次浏览器验收确认控制器可见、档案实例数为 1、点击后遮罩透明度为 0.75。 |

### 本次验证及边界

- 定向 ESLint 通过（产品文件 0 error；脚本目录按既有配置忽略，脚本由 tsx 实际运行）。
- `scripts/p11/closeout-fixes.test.ts`、扩展后的 `scripts/p15-i/instant-start.test.ts` 通过。
- TypeScript 初次与 build 并行时读到被重建的 `.next/types`，属于工具竞争；构建结束后单独复验通过。
- production build 本次执行一次，仍因 Google Fonts TLS `ECONNRESET` 失败。未改字体配置、未绕过验证，也未重复全量 `verify.sh` 或无关合约检查。
- 浏览器复用原 profile、原 helper、原只读夹具。本地进程临时选择 production snapshot 和固定 OP 公开合约身份，无环境文件修改、无生产写操作；本地数据源仍缺 OP #1 verified snapshot，Score ready 超时，故未宣称真实播放检查通过。
- 新证据：`reviews/evidence/p11-closeout-review/fixes-browser.json`；原始 review 的 `browser.json` 保留。
- 更新 `docs/JOURNAL.md` 说明预取消费路径的调整，`docs/ERRORS.md` 记录生成目录竞争。不改变阶段和权威下一步，不机械改 STATUS/TASKS。

关键走读：`requestPlaybackFocus(engine)` 在播放开始前让旧引擎退让；`PrefetchKind.FULL` 预取导航真正消费的完整页面；`showControls={pathname === '/me/test'}` 只在调参路由显示控制器。

待补的只有环境恢复后的真实 ECHO→Score 音频 smoke，以及生产构建下的预取命中/体感复核；原先延期的压力矩阵继续延期。
