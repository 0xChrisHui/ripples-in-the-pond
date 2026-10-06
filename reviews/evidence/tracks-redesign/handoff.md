# 曲目页下一轮优化交接

## 范围与结果

- 日期：2026-10-04；目标：按9/10品质方向完成一轮可运行、可自检的曲目页优化。评分是设计目标，不是获奖或外部评委认证。
- 工作树：`E:\Projects\nft-music-progress-release`；分支：`codex/tracks-award-redesign`。
- 开发基线：`463b116f8c264d3a9c6c6125a40325720070bb6c`；最终集成提交见本分支最新提交。
- 可打开：`http://127.0.0.1:3121/tracks`。原工作树77项已有未提交进度保留。
- 本轮没有发布、真实铸造、数据库写入或永久上传。

## 已落地

| 项目 | 结果 |
| --- | --- |
| 独特视觉 | 七道水纹轮廓由真实音频RMS/过零特征生成；断口来自各时间区间最低能量点，不用随机形状或曲号种子 |
| 首屏开听 | 桌面1440×900、手机390×844和375×667的播放入口全部可见，没有横向溢出 |
| 原文层级 | 首屏摘取原文完整句子，完整手记在温暖纸色阅读区逐段保留；日期、括号、单换行继续呈现 |
| 35首目录 | 桌面5列×7行数字方格，手机展开完整数字目录；共用一份曲目模型，选曲不带动页面滚动 |
| 真实状态 | preparing/playing/ended/error从原生音频与现有网关回退确认；初始时长直接读取真实分析，不预载音频 |
| 控制与可达性 | 主控与浮控按可见性和播放身份协调；手机目录支持焦点围栏、Escape关闭及焦点返回；减少动态偏好生效 |
| 单曲路由 | 从永久来源区的注册表链接打开，真实播放后滚至手记出现浮控，点击浮控停止返回idle |

## 验证证据

- `tsc --noEmit`：退出0，最终源码类型检查通过。
- ESLint：受影响组件及helper定向通过；目录焦点修正后单独复验，退出0。
- `tsx --test scripts/ui/tracks-experience.test.ts`：2/2通过，验证HTTP输出、原文、首播时长与35首目录。
- `tsx scripts/ui/audio-imprints/verify.ts`：35首来源哈希、ffprobe时长、96段特征、包络差异及未知ID/数据隔离验证。生成数据30,039字节；JSON SHA256 `cf52f0231eee4a6ee424cfc5d3835eee9277fc606030f46adbe03714e8149f42`。
- `TRACKS_REVIEW_PASS=single node scripts/ui/tracks-browser-gate.mjs`：最终浏览器检查退出0。原生音频进度从0推进至387ms，单曲浮控停止回idle，目录键盘和31号530字符长手记检查通过，无浏览器异常。完整记录见 `browser-v4.json`。
- 最终截图：`desktop-v4.png`、`mobile-v4.png`、`mobile-small-v4.png`、`mobile-note-v4.png`、`single-v4.png`、`single-note-playing-v4.png`。已目验最终Geist数字、较清晰的移动水纹和纸色阅读区。
- 两轮独立视觉审查：修复细笔触、机械等距轮廓、数字歧义和原文分量；最终只读代码复审未发现高价值阻塞。
- 不运行全量verify.sh或生产build：本轮未改依赖/打包/发行逻辑，定向静态及真实页面证据足够。

## 关键代码

- `TrackCatalog.tsx`：`data-controls-visible`同时要求所选曲目与当前播放身份匹配，避免隐藏另一首正在播放的控制。
- `SoundImprint.tsx`：水纹半径读取真实RMS与过零特征；低能量点决定断口，进度光点只在真实playing时显示。
- `BottomPlayer.tsx`：只对`/score/material/`开放共享浮控，保留独立Score播放器的原有路由边界。

## 实际边界

本地预览和短时真实播放已验证；本轮没有新增生产发布、主网或SEMI接入结果。较长时间网络故障和全站回归不在此次UI改动的验证范围。

## 数字方格目录（2026-10-04续改）

- 用户要求更紧凑的数字方格：桌面5列×7行，单格44×44px，35首全部可见；浅色反显选中项，悬停不覆盖选中状态。
- 手机展开目录同样采用方格，保留完整曲名的无障碍标签、键盘焦点围栏、Escape与焦点返回；没有另一份曲目数据。
- `TRACKS_REVIEW_PASS=grid node scripts/ui/tracks-browser-gate.mjs`通过：实测5列/7行/44px/全部可见，点击35和31切换正确，桌面与手机首屏开听及无横向溢出断言通过。记录见`browser-grid-v5.json`，截图见`desktop-grid-v5.png`及`mobile-catalog-grid-v5.png`。
- `TrackIndex.tsx`定向ESLint退出0。播放器、音频资产、完整正文和单曲发行逻辑未改，复用前一轮相关证据。

## 平行水波候选与文案清理（2026-10-04续改）

- 本轮基线：`7cf524f`；沿用同一工作树、3121开发服务及原浏览器profile。
- 纯色版：`http://127.0.0.1:3121/tracks`；水波版：`http://127.0.0.1:3121/tracks/pond`；首页转场比较入口：`http://127.0.0.1:3121/?tracks=pond`。
- 页头“纯色 / 水波”链接保留当前编号，例如两版的`?track=31`均从唯一注册表解析31号原曲。普通首页导航保持进入纯色版。
- 新水波路由加入现有transition事务的`tracks`归属，等待实际前景DOM就绪后再揭幕；首页圆圈沿现有曲线退场，稳定曲目页presence为0。共享水面不重挂载、不复制引擎。
- 两版同步删除“35封回信”“声音之外，还有这些”“作者的文字，保留原来的样子”、下一封回信、目录邀请、装饰图注及底部抒情文案；完整作者手记、必要播放和收藏/来源文字保留。正文居中单列，水波版采用透明深色阅读区。
- 静态检查：全部受影响TS/TSX定向ESLint退出0；`npx tsc --noEmit`退出0；`git diff --check`退出0。代码文件均不超过200行，受影响目录文件数不超过8。
- `npx tsx --test scripts/ui/tracks-experience.test.ts`：4/4通过，覆盖首屏语义、35首同模型、两版31号原文/去除文案，以及readiness、交互归属和过期回调隔离。
- 浏览器实测：1440×900桌面、390×844手机首屏播放入口可见，无横向溢出；35格选曲及两版31号保留通过。首页→水波曲目→首页的shell、Canvas、WebGL context、mountId均相同，真实GL绘制继续推进；总Canvas保持2个，其中仅1个GL（另一个为已有花瓣层）。普通及减少动态偏好的转场断言均通过。
- 截图与数据：`desktop-pond-v6.png`、`mobile-pond-v6.png`、`mobile-note-pond-v6.png`、`browser-pond-v6.json`。水面连续性脚本复用`runtime-cdp.mjs`与原9335端口，不新增测试服务；工具观察表达式及绘制帧等待修正仅补对应断言。
- 浏览器限制：桌面首轮无page/console异常；补测期间捕获一条首页`useGlSim /api/tracks Failed to fetch`，原始错误及时间区间保留在最终JSON的`consoleLimitations`。最后正文会话page/console均无异常，浏览器内只读接口核验HTTP200、无degraded；该错误未复现，根因未确定，不能称全程console无异常，没有扩大为首页网络重构。
- 关键接线：`PersistentRouteSurfaces.tsx`在对应route marker就绪后交接前景；`use-scene-presence.ts`将稳定`tracks`归为presence=0；`TrackCatalog.tsx`两版只读同一注册表和同一作者原文。音频、发行与永久资源未改，继续复用v4的相关播放/资产证据。

## 2026-10-04 用户确认：水波版音乐圆与基础日食（v7）

- 本轮终点：`http://127.0.0.1:3121/tracks/pond` 中的声音刻印换成可点击的音乐圆，保留 `/tracks` 纯色刻印版比较；本地实现，无发布。
- 5%以圆自身直径为基准：X/Y分别±5%，单轴两端跨度最多10%，有界曲线不累积漂移；播放时位移收为一半。日食、GL圆、点击区域共用圆心和尺寸。基础态包含轻微边缘波动、大小与光晕呼吸。
- 首播准备不提前变日食，真实playing进入黑盘、白环、日冕，已开播后的短暂preparing保留；停止/结束/错误/换曲退出。复用现有HTMLAudio与播放进度，没有新音频引擎。圆的颜色继续来自原曲模型和已有首页色板，不新增地址/曲目注册表。
- 圆使用首页球体片元材质，在现有Canvas的独立前景层绘制，不新建Canvas、FBO、相机或测试服务；日食仅基础SVG，不采样P9/Showcase，没有新增按键合作或按键动效。隐藏首页GlEclipse不再在稳定曲目路由写入焦点。BaseTone原样移出PondGL以遵守200行限制。
- 浏览器目视修正：彩色圆在日食期间淡出，日冕在舞台边缘前衰减为透明，消除方形裁切；局部圆不继承旧刻印的入场位移，防止DOM和GL在首帧位置不同。WebGL尚未准备/故障时显示同位置可点击的CSS圆，降低动态偏好移除位移与呼吸，滚出可视区冻结局部时间且不停止音乐。
- 定向测试：新增状态/漂移/减少动态4项。首次执行模块缺失失败后实现，最终4/4通过；漂移覆盖244/300/556/660px、idle/过渡/eclipse、模拟一小时。之前同轮的4项目录/原文/路由测试通过，相关语义与来源未改，继续复用。类型与受影响TS/TSX的ESLint最终退出0；不跑全量verify或生产build。
- 浏览器：`node scripts/ui/tracks-circle/browser-gate.mjs`完成桌面真实点击、音频进度1920ms、停止、换35号、滚出保持播放、往返首页同Canvas/context/mount、纯色版保留；只补相关视觉后使用`TRACKS_CIRCLE_REVIEW_PASS=finish`完成最终1440×900/390×844截图、圆/日食/命中区对齐、手机首屏开听、减少动态、强制fallback真实播放。最终两段记录均无page/console异常，详情`browser-circle-v7.json`。首次手机抽样未等布局尺寸交接，脚本改用实际布局与pose匹配；补检曾在旧页导航/15秒CDP导航超时，添加新导航标识与45秒上限，仅补受影响验收，未扩大产品改动。
- 最终目视证据：`desktop-circle-v7.png`、`desktop-eclipse-v7.png`、`mobile-circle-v7.png`、`mobile-eclipse-v7.png`。v6水面/手记与v4资产证明继续有效；本次未动音频、原文、合约、发行、上传与数据库。
- 核心走读：`circle-state.ts`的`limit = diameter * .05`约束最大位移，`circlePlayback`要求真实playing才首次日食；`TrackCatalog.tsx`的`appearance === 'pond' ? 'circle' : 'imprint'`限定只替换水波候选。

## 2026-10-05 位移基准与可见速度更正（v8，覆盖v7的位移规定）

- 用户明确：上下左右5%指页面高度，前轮“圆直径”属于误读。当前两轴均以可视页面高度innerHeight计量；900px窗口为±45px，844px为±42.2px；滚动长手记不会放大范围，缩放圆也不改变位移范围。
- 轨迹主周期18/23秒，叠加31/37秒的小分量；保持连续有界漂移。普通态与日食使用同一轨迹，不再在播放时减半。SVG允许光晕超出原舞台盒子，避免更大位移造成方形裁切。
- 真实页面首次两秒只移动3.34px，进一步定位到每帧64ms上限同时截断了位移时间；现将过渡限步和运动时间分离，运动按真实elapsed推进。visibilitychange重置last，后台期间不累积位移时间。低帧率仍按设定速度前进。
- 新范围/速度测试先红（2失败）后绿，最终5/5；涵盖圆大小与位移解耦、窗口高度比例、一小时边界、两秒可辨认位移、减少动态、既有播放交接。定向ESLint通过，tsc --noEmit通过；不跑全量verify/build。
- 只对受影响运动进行浏览器复验：1440×900普通圆两秒移动24.00px、真实playing日食24.18px；390×844普通圆22.74px。动画时钟分别推进2.067/2.183/2.017秒；圆、日食、命中区对齐，无横向溢出，减少动态时dx/dy=0，最终page/console错误为空。记录browser-circle-motion-v8.json，截图desktop-circle-motion-v8.png、desktop-eclipse-motion-v8.png、mobile-circle-motion-v8.png，均已目视检查。
- 原服务已停止，仅在原工作树和3121端口恢复一个开发服务；没有新建工作树、profile或测试服务。无关原文、目录、音频/资产、发布链路不变，复用v7相关证据。原主工作区既有用户进度未修改。
- 关键代码：circle-state.ts的limit = pageHeight * .05定义范围；use-track-circle.ts中elapsed只用于位移时间、delta仍限64ms用于过渡。

## 2026-10-06 水波定稿、首播与稳定布局（v9/v10）

- 完成用户六项范围：/tracks默认水波，/tracks/pond仍兼容；纯色隐藏入口保留/tracks/archive。艺术家移入共享池塘并保持预备前景；页头增加艺术家、登录/我的音乐，复用既有认证和转场。摘要固定三行，完整作者手记不改；收藏/永久来源加入半透明阅读底层，正文15px。旧OP不再展示，当前OP SBT与ETH NFT各有合约、项目留存交易两项入口，地址继续从单一注册表派生。
- 首播发现现有Blob仓库35号路径404；没有补传，而是复用已存在的35个public/tracks/No.N.mp3。audio-stream-proof.json从H7双网关证明派生，测试逐字节比对35/35的SHA-256与长度；同源版本URL优先，原永久网关继续回退。当前曲目提前load，点击复用同一HTMLAudio、不重新load；可播后才预热至多两首相邻曲目，hover/focus准备目标，节流流量偏好跳过额外预热，没有自动play或新增AudioContext。
- 音频定向测试3/3通过；受影响ESLint退出0，tsc --noEmit退出0。搬移页面后用next typegen刷新路由类型，未跑生产build或全量verify。上轮圆圈连续性v9已通过、用户已看到效果，本轮复用9项逻辑与browser-circle-continuity-v9.json，未重跑。
- browser-integration-v10.json记录本次集中断言：桌面/手机01→07播放及相邻切换位置差0px；35号真实playing约127.9ms，点击前后load次数同为3且媒体时钟前进。艺术家视觉交接102ms、回曲目413ms；首页147ms、回曲目278ms，均维持各自会话同一Water Core/Canvas/context；开发模式路由settle仍有1.5–4.5秒，显示/交互已先接管，不冒称生产性能。登录弹窗保持水面，四个凭证入口、阅读字号、无横向溢出、纯色隐藏地址均通过；page/console错误为空。
- 门禁工具出现初始化、2D花瓣Canvas计数、键盘焦点及字号断言问题，只修对应观察和续跑未完成部分；没有改相邻产品救绿或重复已通过的真实播放。最终desktop-tracks-v10、artist-pond-v10、ledger-pond-v10、mobile-tracks-v10截图已目视。真实账号“我的音乐”私密数据/登录点击路径未验，不冒充通过；已有身份隔离逻辑未改。
- 本地地址：http://127.0.0.1:3121/tracks；http://127.0.0.1:3121/artist；http://127.0.0.1:3121/tracks/archive。原主工作区77条用户WIP保留，本轮只本地提交，不push/部署/上传/迁移/铸造。

## 2026-10-06 板块衔接、统一顶栏与播放连续性（v11）

- 用户批准四项已有页面优化。本轮终点为3121可直接使用的本地版本；不追加计划、阶段更新、生产发布或外部写入。主工作区仍保留77条用户WIP。
- 手记和收藏/永久来源放进同一全宽半透明阅读层，内部继续沿用正文和凭证排版；去掉第三板块外框、独立深色矩形及衔接处横线，缩短重复留白。作者原文、字号和四个注册表凭证入口不改。
- 首页、曲目、艺术家、Me、Score、Echo共用PondHeader；共享池塘只挂一份持久顶栏。非首页左侧统一“← 返回水塘”，右侧艺术家、曲目、登录/我的音乐使用相同位置与移动菜单。Score返回档案/分享、Me身份/网络/订单作为页内操作保留；独立原曲作品页和订单页使用同一导航入口。
- 曲目第一次进入后保留前景实例，离开时冻结圆圈时钟/运动与颜色，暂停本曲播放器并释放场景所有权，不抢占首页或Score。返回时在绘制前复用原pose；健康WebGL加载交接不再显示另一种纯色备用圆。显式track查询仍有效，其他页面的查询不会改动隐藏选曲。
- 真实修复前复现：7号返回后变为1号，运动session从4026145746变3086958430，颜色也换成1号；播放中点击7号后phase=idle。修复后首刻前后session同为3365211236，选曲7、颜色及时间保持，dx差0.001px、dy差0；运动后续正常继续。
- 所有选曲入口共用select：当前本曲正在播放时同步toggle新音源，停止时只选择。useOriginalPlayback接管已开始出声的媒体时立即读取真实状态，避免漏掉playing事件。真实7→8自动开播，唯一活动音源为No.8且时钟前进；停止后再切7保持idle。
- 定向ESLint通过；TypeScript检查通过。验收记录统一为browser-integration-v11.json：六页艺术家/曲目/登录坐标完全一致，Score→tracks实际挂载后的交接保留同一Canvas，reading背景统一、ledger无外框、手机菜单可用且无横向溢出。artist-header-v11、reading-seam-v11、mobile-header-v11截图已目视。收尾浏览器段page/console错误为空；真实登录后的私人数据及铸造未在本轮测试。
- 工具对路由等待期间正常漂移、登录准备占位及服务端首段HTML作了不适用的断言，按影响范围修正观察并续跑剩余段；记录保留分段证据，不冒称一次全站矩阵。复用v10的35首音频身份/完整性及凭证证明、v9的随机运动范围；未跑全量verify、生产build或重复完整播放。
- 关键代码：TrackCatalog.tsx的continuePlaying决定是否继承播放意图；PersistentRouteSurfaces.tsx的PreparedTracks保留前景实例；use-track-circle.ts的tick(performance.now())在绘制前恢复原位置与颜色。

## 2026-10-06 总体review缺陷收口

- 本轮仅修复review确认的两项：领取状态跨曲目/身份残留，以及自动切歌全部候选超时后静默idle；没有扩展页面设计、发行政策、SEMI或发布范围。
- MaterialMintPanel只重建带authSource/userId/evmAddress/trackId身份的领取子树，保留network与圆圈。旧OP GET取消、POST回写和ETH建单导航有卸载保护，A→B→A不会复用最初A的请求；已受理服务端请求不取消、不自动重发。
- playTrackSources所有候选失败通知一次，取消和成功回退不通知；PlayerProvider按trackId保存错误，新播放/stop清除，useOriginalPlayback使用既有错误与重试UI。即使没有原生MediaError，自动切歌也不再静默停止。
- audio-start.test.ts新增全部四候选超时与取消/成功不误报断言：修复前失败通知0次，修复后5/5通过；包含既有预载复用与有界回退断言。TypeScript、五个受影响源码的ESLint、diff格式均通过；代码文件最大199行，相关目录未增加文件。
- 两位原reviewer分别交叉核对请求归属与播放错误路径，无阻塞项。此轮属于状态逻辑修复，不启动浏览器、不跑build/全量verify；v9–v11无关视觉证据继续复用。真实登录钱包完整点击链路仍未验，不将代码审查或受控音频测试称为真实领取通过。
- 本地仍为http://127.0.0.1:3121/tracks；不push、部署、上传、迁移或交易，原工作目录用户WIP保留。关键行：MaterialMintPanel的scope/key隔离领取实例；useOriginalPlayback的playbackError===trackId将自动切歌失败映射为error。

## 2026-10-06 main推送收口

- 用户明确要求push to main；fetch确认origin/main=53555188f1655350e801b5f7b89034c120e93db8，无新增分叉。沿用当前工作树，保留codex/tracks-award-redesign及25b1eee原开发记录；最终文件状态压成一个发布提交，合约、数据库、依赖及next.config.ts不变。
- 发布文件树与25b1eee一致，仅追加本段交接。复用定向类型/lint、音频5/5和v9–v11页面证据；因曲目/艺术家路由搬移，集中补生产Webpack构建：编译、TypeScript及61/61静态页面生成通过，完整构建退出0。
- 默认构建清理遭旧.next/single-shot-profile文件权限拒绝，未删除受保护文件或改源码配置；最终在同一进程加载原项目配置，仅将本地cleanDistDir设false后运行原next-build流程。遗留middleware弃用及Privy可选Farcaster模块警告不阻断构建，未安装新依赖。完成线为推送后远端main SHA核对，不等待部署，不新增交易/上传/迁移或SEMI接入声明。

## 2026-10-06 顶栏、领取入口与首次圆圈修正（v12）

- 本轮只处理用户截图/视频的四项反馈。Me删除独立账户/网络/订单工具栏及其loading引用，只保留公共PondHeader；账户地址作为“我的音乐”的title，外部钱包网络选择归入待铸造区域且仍在原Provider内。登录/我的音乐共用44px最小高度、flex居中与无换行样式。
- 撤回未经明确要求的原曲订单页面入口，ETH领取与已有交易恢复内嵌当前曲目；建单、接收钱包核验、发送与哈希恢复保持原服务端链路，历史直达路由仅兼容保留。没有删除订单记录、迁移数据库或执行钱包交易。
- 曲目公开前景空闲预热，圆圈Mesh改为随前景一起加载，消除第二层串行chunk；首帧备用圆与GL共用颜色/pose，第一次GL绘制后返场不再使用备用圆。已挂载前景的就绪上报改到绘制前，并按targetVisualReady防止同步重复上报；随机漂移与换曲逻辑不改。
- 本轮TypeScript与受影响ESLint通过，最后就绪钩子补定向ESLint和源码交叉审查；diff格式通过。旧音频5/5、运动范围及播放证据继续复用，不跑生产build或全量verify。
- 集中浏览器证据为browser-ui-fixes-v12.json：首次圆圈与曲目前景接管在同一观测帧可见；返回会话1472710209保持且备用圆未出现；同样式“我的音乐”文字布局偏差0px；匿名Me公共顶栏1、旧顶栏0、订单入口0。最终page/console错误为空，ui-fixes-tracks-v12.png与ui-fixes-me-v12.png已目视。
- 首次样本本地chunk编译与软件WebGL很慢，点击到前景约8.15秒、GL约10.12秒，不能称为生产无加载或真实用户性能；该证据只证明前景接管后圆圈无额外空白。Me截图捕获初始化阶段，不证明水面加载速度。实际登录账户/领取未验，“我的音乐”仅复用匿名按钮同样式替换文字测量，不冒充认证通过。
- 首轮观察包含隐藏预备DOM，后改按前景实际接管判断；就绪钩子同步重复风险已加guard；返回断言误用冻结时未回写的circleVisible属性，仅续跑余下断言改查surface交互所有权。始终复用同一浏览器，旧profile不可用才使用一个替代profile；不新增测试服务。保留主工作区77条WIP，本轮仅本地提交，不push或部署。
- 关键行：MeArchivePage的PageNavigation让共享池塘持有唯一顶栏；EthereumMaterialMint的setOrderId把领取留在当前曲目；PersistentRouteSurfaces的!tx?.targetVisualReady保证首帧就绪每事务只上报一次。

## 2026-10-06 池塘圆圈、转场和双链领取统一（v13）

- 实现用户六项范围：#36正常态正圆，保留双倍尺寸、随机主动漂移、浮沉与隐现，其余采用普通圆hover尺寸/光晕/播放提示、点击/键盘和8px拖动阈值。拖动/取消/多指不会误播放；松手从当前位置接回漂移。低帧率以可见经过时间分段推进，超过0.5秒的长卡顿按挂起处理；狭长屏幕从可用长边选择更可见的随机路线，速度仍受6px/s上限约束。
- 曲目圆恢复首页材质的边缘波动、柔化和呼吸参数，hover同样放大9%、光晕增强。首页与曲目共用基础日食：黑核、贴合白环和连续光晕；首页仍保留既有P9编舞，曲目不引入按键编舞。换曲随机轨迹、颜色续接与页面返回实例延续原实现。
- DOM、首页球体与曲目GL读取同一显隐进度，出入场不再叠加独立CSS过渡。旧层固定在当前屏幕位置，新页回顶不会把旧页拖走；动态Score/Echo仅保留无交互退场快照，相关GL场景淡完再注销。重复ready/reveal受到幂等保护，后退/前进复用按路径保存的滚动位置，快速反向从当前亮度续接。Echo与原曲资产路由移入现有池塘分组，单曲复用常驻TrackCatalog，不新增Canvas。
- OP/ETH两项领取同屏，分别按身份/钱包/曲目隔离状态，不再切链选项卡。保留必要的实际钱包切网、服务端凭证、未知交易核对和重复提交保护；没有执行真实领取。手记→两链领取→永久来源→下一首使用同一620px阅读轴及阅读底层；完整地址按需展开/复制，唯一资产注册表继续提供全部地址。
- Water Core在各池塘页保持指针输入；裸露水面沿用现有移动/点击涟漪，阅读底层和实际控件通过既有排除规则阻断，触摸滚动沿用原处理。
- 相关测试证据：驻留Echo数学/运行时/命令/手势/渲染/host专项均通过；曲目连续运动测试9/9、共享基础日食6项通过；新增转场测试3/3覆盖五类核心页面20个方向、重复就绪与过期generation、反向进度和相关路由分类。源码类型检查`npx --no-install tsc --noEmit --project .tmp/pond-check.tsconfig.json`退出0；该配置只排除损坏的Next临时类型缓存，不改变项目配置或依赖。受影响ESLint退出0，所有改动代码≤200行，新增文件目录≤8项，diff格式通过。
- 浏览器Gate未完成，不能称为视觉验收通过。复用3121及同一profile，原生GPU未完成初始化，软件GPU能显示水面；匿名Me确认顶栏1、owner=archive，但进入首页的后续检查超时。开发服务器记录首页首次编译约66秒；软件渲染和既有MetaMask扩展异常亦影响环境，无法据此确定动画观感或正式性能。原始结果保存在`browser-unification-v13.json`；本轮没有有效的新截图、真实#36播放/拖动实测、双链认证领取或手机视觉证明。停止继续修检查工具，相关项目保留未验标记。
- 完整生产构建未通过：编译及类型阶段通过，Collecting page data阶段旧app-paths-manifest仍含搬迁前Echo/material路由，产生undefined.replace错误。未修改项目构建配置或清除受保护的浏览器缓存。后续常规tsc读取到Next开发临时类型写入不完整；源码检查采用上述临时配置通过。两项限制均不冒称通过，发布时需要干净构建结果。
- 原工作区77项用户进度保留；当前release工作树保存本轮实现，本地提交，不push/部署，不改变合约、发行政策、生产数据库或永久对象。
- 核心走读：`getScenePresence(owner)`同时控制DOM和GL，修改其曲线会改变所有页面转场；`DRAG_THRESHOLD = 8`区分拖动和点击；MaterialMintPanel同时挂载`OpMaterialMint`与`EthereumMaterialMint`，删除任一项会撤掉对应链的直接入口。

## 2026-10-06 首页第36圆可见性修复（v14）

- 实际`/api/echo/featured`返回已核验的OP Sepolia Echo #1（chainId=11155420），宿主却硬编码只接受OP主网10，导致phase=waiting、presence=0并隐藏圆圈。改为与既有`NEXT_PUBLIC_CHAIN_ID`一致且tokenId=1才显示；服务端核验、合约地址来源、材质和运动逻辑不变。
- 驻留host专项新增测试链、主网、链不匹配和空资产断言，通过；两个受影响源码的ESLint和diff格式检查通过。不运行全量verify或生产构建。
- 复用3121服务及同一检查浏览器：phase=visible、presence=1、命中区对应第36圆；短样本确认位移，悬停直径从154.47增至167.30px，拖动35px/15px后位置跟随且未误播放。记录`resident-visible-v14.json`，截图`resident-visible-v14.png`已目视确认正圆可见。未验证真实播放或发行；本次证据只覆盖第36圆，不替代v13尚未完成的全页面转场/生产构建Gate。
- 核心行：`isResidentEchoAvailable(current.echo, Number(process.env.NEXT_PUBLIC_CHAIN_ID))`使首页沿用当前配置的已核验Echo；没有新建合约地址清单。保留原工作区用户WIP，仅本地提交，不push或部署。
