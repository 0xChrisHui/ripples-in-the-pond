# 夜间开发交付 — 当前事实（2026-10-03）

本页替换多轮追加总结，历史过程保留在各线handoff与Git。UI打磨按用户要求延期，不索要目验。

## 版本与入口

- 工作树 E:/Projects/nft-music-progress-release；分支 codex/night-production-20261003。
- 最后业务代码SHA：3c823873a5d760368afad4b4026fb641eb6167e7。
- BASE_SHA：e6985bec5ef6d6f191526e6f2e5b58caa5414357。
- 本地只读：http://127.0.0.1:3115/ 、http://127.0.0.1:3115/tracks 。已启动最新整合产物；首页、曲目馆和两链原曲页HTTP检查通过。
- 正式站：https://pond-ripple.xyz/ 。本次整合已发布，Ready与正式域名smoke通过。
- 手动启动：本工作树PowerShell先设置 LOCAL_REVIEW_ONLY=1 环境变量，然后 npm run start -- --hostname 127.0.0.1 --port 3115；Ctrl+C停止。预览不用于真实签名/交易验收。
- 原目录HEAD 001a21dd60c96adf0fa72cfb47f217885132a655 保留；收尾只读核对77条status与K0备份完全一致、暂存区为空。必要用户进度已纳入BASE，其余仍在原处。备份 E:/Projects/nft-music-night-backup-20261002。

## 四线与共享合同

| 线 | 原四线移交HEAD | 最新发布适配/整合 |
|---|---|---|
| P15-X | 4990dcbe72892a19e42941794be64b3430a14265 | 19938e6、1f4c2bf；代码完成，视觉延期 |
| P14-H | 9e7140be1def11ff03c4811d559da491f3ed4bfe | d1434d8、1f4c2bf、3c82387；代码完成，绘制未验 |
| P17 | 16c18dc6c3060b470e0729673d1e728228220b84 | 6aaf985、f37598a；代码/部署/迁移完成，领取及留存待办 |
| P13 | 70dbc0dee536552e63612e626f580ccb65398aca | 43111a0；资料通过，SEMI实际接入待办 |

C1原移交0e1195f04222c0e441989cb9ca74304a37801b7f；C2原移交624216cb8b35c6b7883ae87693bf7cfb38487c32。当前唯一注册表revision：70437f5e71f2684018b2565a815b78dffd8d1b0d692063ee43f2b447148b85b8。网站快照、曲目地址、SEMI机器表同源。70项ready只表示部署资料齐全；留存confirmed=0。旧archive-ledger保留，新计划为p17/archive/archive-ledger-c2.json。

## 十项需求完成表

| # | 需求 | 当前结果与限制 |
|---|---|---|
| 1 | OP/ETH切换稳定 | 布局代码已整合；真实登录切换绘制未验，UI延期 |
| 2 | /me状态稳定 | 状态占位/恢复代码已整合；真实钱包完整状态绘制未验 |
| 3 | 去旧入口、不抢焦点 | 导航与键盘来源焦点恢复已接通；连续演奏绘制未取得新证据 |
| 4 | 分享文案 | 默认B，作者/旁听者和链地址测试通过；其他候选留文档 |
| 5 | 第36圆动态 | runtime与GL/水面/花瓣已接通，五组专项通过；真实运动效果未验 |
| 6 | 唱片结束自然 | 生命周期与场景presence整合、定向测试通过；真实结束绘制未验 |
| 7 | 登录称谓 | SEMI社区身份/链上地址登录已统一；未冒称真实登录通过 |
| 8 | 双链原曲永久留存 | 两链合约及媒体/metadata资料就绪；留存0/70，未完成 |
| 9 | SEMI接入 | 同源导出8/8与--check通过；实际SEMI数量/播放未验，未完成 |
| 10 | 曲目馆 | 35首手记/选曲/公开页/订单恢复代码完成；手机首屏按钮已见，新领取仍关闭 |

## 真实外部结果

- Supabase uupobbgnhpattyxhxvmc 已迁移059–062；旧users/tracks/queue为10/35/7不变，RLS/RPC权限与新增空表/可空列读回通过。证据 p17/pipeline/database-proof.json；发行仍off/pending。
- ETH ERC1155：0x6c731e5faa26e648cad6f86b1c1e741f0aae136b；部署tx 0x1722ef09fb5fb6f1222780e88949232d5eef15a7d91936817638bf185333fff5。每钱包同曲累计一次、转出不恢复、可转让、总量无上限。
- OP SBT：0xa65c9308635c8dd068a314c189e8d77941a7e99c；部署tx 0x5b379690cd000879b73fb65570be665c2dd19b35d5df61d63088dfba0579909b。不可转让；未擅加OP终身次数政策。
- 部署实际费用合计0.00052265292627745 ETH；回执、runtime、角色、35 URI均核对。证明 src/lib/music-catalog/data/original-deployment-proof.json。
- 合集永久JSON费用0：ETH ar://LjA2sgPArVOFL_gpPZmOaFBqXzb5VKTCINGAy7cKGQw、OP ar://JWV5HPaY5-Vjq0iVhadIzT8YrpNP9H-qhfczm6bKrmA；双网关bytes/hash/MIME通过，未重传音乐。
- 留存钱包0x7742951CBCF469A3Fe59f6F9AdEdB72cC4Ba2DbA，本机仓库外DPAPI加密保存；未充值/留存铸造。恢复依赖当前Windows用户，迁移机器前须安全导出。

## 验证与边界

- 当前修复：TypeScript、定向ESLint退出0；P14 math/runtime/render/commands/host五组实际执行通过。新联合回归先复现日食mix到1后反复掉焦，再验证修复。独立审查唯一P2已解决，底部播放器承接暂停/停止，隐藏对象不命中。
- 复用：P15过渡/分享专项；C1目录35曲/70部署、P13导出8/8与--check；P17部署恢复、OP冻结目标/worker、ETH政策/客户端、archive四组通过。
- 安全链路：ETH合约16项、OP SBT7项（含fuzz256），Anvil完整构造/角色/URI/runtime/幂等，PostgreSQL17.11真实事务/并发/RLS13组通过。源码未变，不重复测试。
- K2旧证据仅复用未变断言。本次手机390×844首屏播放按钮top317/bottom361、35项、无横溢出、revision一致。桌面探针零尺寸判为无效，不算通过。低帧浏览器未完成GL/Score结束绘制验收，未据此断言产品死锁；已停止重复浏览器尝试。
- 未跑全量verify.sh；当前整合构建及网站结果见收口记录。文档更新不重跑媒体/链/浏览器矩阵。

## 剩余工作线与真实外部项

1. 网站发布与域名最小smoke已完成；新领取仍off。
2. 新领取：需要可用authorizer签名材料及匹配角色的运行时来源，再做受限真实钱包领取/恢复核验，最后开放；公钥读回不等于可签名。
3. 70项留存：使用既定接收钱包/C2计划；ETH接收钱包需要明确安全资金来源、有限Gas和签发凭证，广播前核准具体范围，逐笔对账，unknown不重发。泛化部署授权未扩成转账/70笔铸造。
4. SEMI需要当前build/version、账号/导入入口和持有样例，完成实际数量/播放容器验收。未联系团队，资料就绪不算接入。
5. UI统一留后，不要求用户现在验收；十项不能统称全部完成。

关键代码：echo-resident/host/frame-input.ts 的 isResidentPlaybackFocus 按播放身份维持日食；useEclipseTransition.ts 消费该结果以避免透明度自我反馈；music-catalog保持页面与SEMI地址唯一来源。


## 最终发布收口

- Vercel部署 dpl_6kV74B4k2XSJtF8A6bN83AWVjaxj，READY；API读回releaseSourceSha=ee50f5dddcc8457460ea42966748b513a1460e77、项目prj_haw2cownQHfmKmrUaP9etU82xwT4一致。
- 2026-10-03 17:38 +08，候选smoke通过后promote；正式pond-ripple.xyz读回同部署ID，首页/曲目馆/新ETH第1首/新OP第35首均200且非not-found；目录全字段等于冻结快照、35份手记final；匿名订单401、OP新领取503/OP_SBT_DISABLED。
- 首次promote默认团队上下文报不同团队，未重新部署；显式使用已登记team_8S51udZUIyBNsdvoxyAAtHMU后成功。
- 本地构建next build --webpack退出0、59静态页、buildId IrsJTgldiMzXLWSRYrpfA；Vercel生产Turbopack构建亦通过。沿用既有依赖，保留Privy可选模块/peer与middleware约定警告，不扩大任务修依赖。
- 3115当前服务运行同一业务源码；本次收尾文档/证据提交不改变代码。集成最终SHA在交付消息中记录，避免自引用SHA循环。
- 匿名HTTP证据保存在同目录k2-browser.json的releaseIntegration20261003.release；不是登录、真实铸造、SEMI或GL运动验收。
- 原工作区未改；回退可使用先前正式部署dpl_AXpgWT4vdxQkXwtkbPrjPYatgkxb。合约/永久资源/迁移保留真实账本，不能用网站回退撤销。
