# P23 夜间执行报告（2026-11-14）

## 本夜结果

| 线 | 实际结果 |
|---|---|
| A `/score` | 字体、首屏、播放条、摘要/凭证、状态轮询、访客底曲入口、手机双指换层已实现；32组布局截图、40项页面断言通过 |
| B 封面池 | 600张全上传、全读回；生产池经事务演练后单事务由旧100换新600，正式读回通过，无回滚 |
| C Semi | 主代理定位Alchemy索引/Semi补全链路，未发现本站可修缺陷；**Semi显示尚未恢复** |
| D `/lens` | 每链一张卡、图标播放、颜色联系、对比度、手机抽屉已实现；20项专项与既有4个浏览器门禁通过 |

所有代码为本地提交，主代理统一审查与推送。**最终整合verify.sh由主代理合入P25后执行，本报告不宣称最终整合验证已完成。**

## 授权与实质取舍

- 最新授权覆盖旧计划C“不排查”和B“不用事务”：C由主代理只读取证；B使用明确生产项目`uupobbgnhpattyxhxvmc`的管理SQL单事务。
- B用`EXCLUSIVE`表锁、10秒锁等待上限，兼容现有取封面RPC的`SELECT FOR UPDATE`锁顺序；锁后逐项核对旧池`id/ar_tx_id/created_at`，允许usage_count自然变化。
- D桌面宽度300→340px，保留44px热区及链名/标准/Token单行；标题两行与播放键共用高度。实测353→246px，降低30.3%；手机收起62px。
- A凭证收起后，隐藏预备艺术家页仍撑大文档。仅在作品页CSS作用域裁掉隐藏预备层溢出，保留实例与路由结构。中文手机ready页3253→1505px，英文1529px。
- 旧快照没有数据库track时，按永久底曲ar://身份精确匹配同一注册表，保证访客入口不遗漏。落点`/lens?track=N`只选中，不自动播放；现有产品没有独立的一键创作路由。
- 日食半径为屏幕半径÷投影倍率，中心走逆投影；初始化、resize、转屏及归位重新计算。透视开关显式来自本作品页，避免沿用首页旧相机状态。
- A2/A5/A6存在同文件调用关系，首屏、状态导航、轮询与访客入口部分按文件小闭环合并提交；字体、凭证、播放、手势和印章分别独立提交。

## B：上传与生产替换

- 600张=12风格×50，800×800 JPEG。尺寸、哈希、唯一性、亮度和轮转检查零问题；逐张查看12张总览，无需替换，`cover-replacements.json`为`{}`。
- 上传前余额**1,279,968,307,778 winc**，分批最坏报价**764,925,192,799 winc**；上传后余额**618,378,244,996 winc**，实扣**661,590,062,782 winc**，未再充值。
- 600项uploaded、600项verified、最大attempts=1。遇Windows临时文件改名EPERM，在下张网络上传前保存pending时退出；增加本地改名短重试后续跑，没有重传成功项或额外永久副本。
- 600/600经arweave.net及至少另一独立网关返回200、image/jpeg且sha256一致，03:24北京时间全过。
- 试跑：锁表/核对旧100→插新600→删旧100→断言集合与顺序→ROLLBACK，再读旧池与试跑前完全一致。
- 正式同一事务COMMIT；读回正好600、txId集合与created_at轮转序完全一致，当时全部usage_count=0。**无回滚、未触发真实铸造、未动已铸metadata。**
- 当时下一张order1/A-001.jpg：`myB_HUk_xzuDtXeHlKhP8L1jLeoQUZftqczJX1domS8`，另读200 image/jpeg。
- 已提交账本：`data/p23/{cover-replacements,cover-upload-ledger,cover-uris,score-covers-before,score-covers-after}.json`。
- 本地总览：`E:/Projects/nft-music/data/p23/review/index.html`；同目录`sheet-{A,E,F,J,K,M,N,O,S,U,V,X}.jpg`。池/母版/总览不提交大图。
- 事务证据：同目录`cover-transaction.sql`、`write-dry-run.json`、`write-execute.json`及相应log；最终SQL为正式提交版本，不含密钥。
- 日后明确决定恢复旧池时，先运行`npx tsx --conditions=react-server scripts/p23/cover-gen/write-covers.ts --rollback`演练，再决定是否加`--execute`；已取用的新封面行保留，旧行最新usage不覆盖。

## A/D：实际验证

| 验证 | 结果 |
|---|---|
| A页面门禁 | 32组、40断言通过；h1为92/40px与Cormorant、无旧第二层顶栏、无横向溢出、首屏不重叠、凭证默认收起、英文首屏无中文 |
| 手机页高 | 中文ready1505/failed1483px；英文ready1529/failed1531px |
| 播放文案 | ready、未请求loading、排队loading、playing、paused、ended、error共7种状态纯函数通过 |
| 制作轮询 | fake timer覆盖10秒刷新、隐藏暂停、恢复与卸载清理 |
| 复制/旧单测 | 完整66字符凭证复制通过；分享作者/旁听者规范链接1项、视觉退场/重播/减弱动效4项通过 |
| 双指单测 | 方向、封顶、零距离、第二指加入/先抬一指/全抬/取消生命周期通过 |
| 双指浏览器 | 5项通过：开合整体变层且网页比例不变、首指落球后加第二指不点播、两球双指不点播、结束后单指拖动恢复且不误点播 |
| D专项 | 20项通过：两链各一卡、44px热区、11/12/16三档、完整复制/播报、超高内部滚动、手机展开/收起/跨断点同DOM |
| 既有lens门禁 | browser-gate14项、hover-gate、regression-gate、playback-gate全过；含焦点保持、深链重入、播放锁定、Esc两级退出、手机第一次选中/第二次播放/点空白退出 |
| 对比度/球色 | 纯白背景透过面板的最坏亮度上界，最低0.76不透明度文字**6.60:1**；35球颜色提亮边界通过 |
| 静态检查 | TypeScript和改动组件定向ESLint通过；脚本以--no-ignore检查；合并P24后中英词典686keys通过 |

本地完整截图与证据（只提交代表图及JSON）：

- A：`E:/Projects/nft-music/reviews/evidence/p23-score/{baseline,font-a,font-b,after}/`，每组metrics.json；作品页另有分享展开截图。
- D：`E:/Projects/nft-music/reviews/evidence/p23-lens/{baseline,after}/`，桌面/390×844/375×667、中英、手机展开与收起齐。
- A门禁：`E:/Projects/nft-music/reviews/evidence/p23-score/score-gate.json`；触摸`pinch/result.json`。
- D门禁：`E:/Projects/nft-music/reviews/evidence/p23-lens/panel-gate.json`；对比度/球色`contrast-colors.json`。
- 运行日志：`E:/Projects/nft-music/data/p23/review/{pinch-browser,lens-browser,lens-hover,lens-regression,lens-playback}.log`。

## C：Semi边界

主代理报告`reviews/2026-11-14-p23-semi-cover-investigation.md`（9cc74f1），证据`reviews/evidence/night-20261114/semi/`。链上URI与生产快照一致，永久metadata/SVG可读；Alchemy对三枚Score返回空metadata/图片字段，refreshCache仍空。Semi源码依赖图片字段，失败落到1×1纯绿占位，且补全不自行读链、拒绝真实Arweave302。未改永久资产或外部仓，未真实登录Semi验证恢复。

## 验证状态与待人工验收

- 开工完整验证遇旧生产快照数量断言（主代理已用5d6f255限定历史1–4修正）及新增上传脚本类型谓词错误（已修）。基线生产编译完成、合约139/139通过；该次失败没有记作全绿。
- 末次verify日志`E:/Projects/nft-music/data/p23/review/verify-final.log`：TypeScript、Lint和H1/H2/H3已过；到H4时按主代理要求主动取消，避免P25整合前重复build。**该次未进入生产build，不算最终通过。**
- 主代理负责最终整合verify、发布及线上复核，并统一维护STATUS/TASKS/JOURNAL/LEARNING/ERRORS。
- 仍须真实钱包验收：OP/ETH收藏、已收藏、进行中、恢复交易、多链Score资产包开通与位置。
- 仍须人工看Score真正播放/暂停/结束/错误重试的观感、日食中心/半径和转屏归位；纯函数文案通过不代表播放态视觉通过。
- 真实手机双指手感待人工。共享组件默认分支已审阅保持；`/score-lab/1`未做逐像素前后对照，`/echo`本地404，未冒充通过。英文译文仍供用户审措辞。

## 本轮主要本地提交

字体f84b252；D卡片1dfdd81、视觉d853d98、抽屉c2c5bd3、收尾345730b；A文案f0ae760、凭证a879ced、首屏/状态deb5fca、播放b5857c4、印章25319fa、双指690fae9、访客/滚动bd508ba、投影71b3d6e；B工具c59dc45、生产账本6a8692e；浏览器验收cacca3a。报告/代表证据收尾实际hash由交付消息补充。

## 发布前两项必修（独立实现审查后的最小修复）

2026-11-14主代理核实两项发布前缺陷并重新授权解冻；本轮仅处理这两项，不启动dev/build，不再外审。

1. **ETH旧收藏意图异步越界**：组件准备订单返回后原来只保护setPicked，卸载/同钱包换曲后仍会继续sendOrder。虽然原逻辑早于P23，这次共享收藏UI直接涉及该路径，因此纳入发布前安全闭环。scope加入实际selectedExternalWallet地址及钱包能力的选中地址；布局提交/卸载时同步最新曲目与身份。准备结果仍写原钱包/曲目缓存，只有仍挂载、同曲目/身份/实际付款钱包时才进入签名。检查作为可选参数沿既有useMaterialMint→order-client→wallet-send传递，在授权返回、切链前后、预检后、attempt返回后再次检查；确认尚未发出时用已有rejected分支释放attempt。已经发出并得到hash后继续原remember/submission/forget与恢复流程，不因UI离开丢hash。没有新钱包客户端、合约或数据库状态机改动。
2. **播放中resize重新固定音乐球**：原回调无条件pinToRecord，播放effect不会因同设备resize重跑，导致自由球fx/fy被固定。现在resize/转屏重算尺寸和半径；只有静止态pin，播放保持自由，归位中继续原动画追随新中心。

红→绿证据：修前在675b7f4执行P24提供的真实源码复现，ETH卸载后出现wallet-prompt:order-A，播放resize后fx/fy由null/null变216/196，均失败。新增可复跑回归：

- `node --test scripts/p23/regressions/eth-intent.cjs`：真实组件4项通过，覆盖卸载、同钱包换曲、换用户、换实际关联地址、scope大小写、已发hash后卸载仍入原缓存。
- `node --import tsx --test scripts/p23/regressions/wallet-intent.test.ts`：真实订单客户端与发送器3项通过，覆盖授权/预检/attempt期间失效不再签名、已有hash恢复、发送后hash记账不被取消。
- `node --test scripts/p23/regressions/score-resize.cjs`：真实Hook3项通过，覆盖播放resize/转屏不固定、静止对齐、归位中不瞬移并最终到新中心。修前新增回归中播放与归位两项失败，修后全过。
- 上述执行真实业务源码，只在离线环境替换React调度、浏览器、HTTP和钱包I/O边界，不是真实钱包交易验收。
- 旧P17客户端恢复/幂等完整合同、P24 traffic5项及P23播放文案/轮询/复制/双指/lens几何单测均通过；40项静态布局证据门禁复跑通过。
- 完整TypeScript与7个改动生产文件定向ESLint通过。新TS回归正常lint；CommonJS离线加载器按项目工具链约定检查，单独关闭仅针对require语法的web规则，其余规则通过。
- 最终整合verify仍由主代理统一执行。实际修复提交hash由本轮交付消息补充。
