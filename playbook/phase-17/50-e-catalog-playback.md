# P17-E — 安静唱片目录与原曲公开播放

> 前置：A2 的真实目录；B0 的永久资源解析。只读浏览/试听可先于 ETH 合约和外部 Gate 完成。
> [总控](../parallel-2026-10/00-orchestration.md)与[共享合同](../parallel-2026-10/10-shared-contracts.md)规定 P15 视觉和公共播放器的所有权。证据路径见[总览](00-overview.md)。

下列文件为职责建议，先复用现有页面原语、鉴权/钱包与验证能力，只补缺口，不按清单强建工具或重构。普通结果/接线要求记唯一 `P17_HANDOFF`，各报告名仅为按需附件。目录与既有音频播放不依赖 ETH 发行政策或 collection 级附加 metadata 齐备；未就绪的收藏动作单独关闭。

## 1. 可运行候选设计

采用“安静的唱片目录”，作为默认可逆设计交晨间验收：

- `/tracks` 顶部简洁标题和返回水塘；桌面左侧 35 首编号/曲名列表，右侧选中曲的唱片、播放控制、创作手记和链上收藏资料。
- 移动端改为单列：选中曲详情与可展开目录，保留清楚的上一首/下一首操作；选择新曲不自动播放，不抢焦点、不跳到页顶。
- 沿用现有字体、色彩与 `p11` 原语。不新增全局设计系统，不强行给每首生成新封面/营销故事。
- 只有用户主动点击播放才建立音频会话；不预加载/解码全部 35 首，不自动随机播放。
- 创作手记 absent 显示一条真实简短说明；draft仅在已允许公开真实稿件时展示草稿标记；final 显示正文。不要为缺文字制造大段占位内容。
- OP/ETH 切换容器尺寸稳定；地址可换行，状态/错误保留有界位置，与 P15 的稳定布局要求一致。
- 合约地址、Token、网络、metadata 与永久音频都由同 revision 目录产生；未部署显示状态，不出现可点击假地址。

## 2. 路由职责

| 路由 | 职责 | 写入者 |
|---|---|---|
| `/tracks` | 35 首原曲目录；可用 `?track=<真实trackId>` 保留选中曲 | P17 |
| `/score/material/[chainId]/[contract]/[tokenId]` | ERC-1155 原曲公开唱片页，网络/合约/Token 明确 | P17 |
| `/score/[id]` | 旧 OP Score 与既有队列兼容入口 | P15/原负责者，P17不改 |
| `/score/[id]/[contract]/[tokenId]` | 当前多链 Score 路由，其中 id 是 chainId | P17只读消费，不重命名 |
| `/score` | 本批次建议作为入口重定向 `/tracks`；不接受模糊 token 推断资产 | 若缺入口，由总控在 K2 创建；若已有职能，保留并加入原曲入口 |

静态 `material` 子树与既有动态 `[id]` 并存。不要在同一层再创建 `[chainId]` 与 `[id]` 冲突；新的 `[chainId]` 位于 `material/` 之下。`/score` 根入口属于明确接线请求，未完成不得把根路径算通过。

## P17-E0：公开查询层和三元坐标解析

**输入依赖**：A2 C1、B0；production/test environment 明确。目录中的链上事实暂缺不影响返回真实 pending 状态。

**实际文件/符号**：新增 `src/data/material/{catalog-source.ts,asset-source.ts}`、`app/api/music-catalog/route.ts`；只读 registry 的 `getMusicCatalog/getOriginalTrack/getOriginalDeployment/listEnabledCollections`、身份模块与 B0 解析器。

**具体操作**：

1. 公开 API仅返回 registry安全投影，带 schemaVersion/revision/environment；不从用户订单、JWT或运行 env拼接额外私有数据。
2. `getMaterialByCoordinate` 严格检查 chainId/地址/tokenId，先查目录允许的 original ERC1155，再按该链读取必要 URI。无法识别的三元组返回 not_found，不把路径中的任意地址发去扫描。
3. 在目录已验证快照可用时页面可以先显示身份；新鲜链核验失败明确标 `temporarily_unavailable`，不能混同 404、已销毁或未铸。
4. 响应缓存只按环境+revision+完整资产身份；公开目录可缓存，owner/订单状态独立认证 no-store。若 BASE有成熟缓存层只读复用，不引入新框架。
5. 非生产环境使用独立目录产物与明显测试标识，生产 never 自动回退到 Sepolia示例。

**失败恢复**：目录坏数据 fail closed 并返回可读错误；资源不可达保留真实凭证及重试动作。API不得靠假曲目填满35项；缺真实ID按A2处理。

**定向验证**：合法OP坐标、未来ETH未部署、标准错配、大小写地址、极大token字符串、错链、任意合约拒绝、无登录公开读取、revision一致性。

**完成证据**：handoff 的 E0 条目记录真实响应样例/错误映射或已有测试引用，复杂数据合同才另附 data-contract。

**自动下一步**：进入 E1。

## P17-E1：35 首目录、手记与链上信息

**输入依赖**：E0；无需新增音频或用户手记；复用现有 UI tokens。D 未就绪时按钮诚实显示未开放，不伪造成功。

**实际文件/符号**：新增 `app/tracks/{page.tsx,loading.tsx,error.tsx,tracks.css}`，`src/components/music-catalog/{TrackDirectory.tsx,TrackDetail.tsx,TrackNotes.tsx,AssetReferences.tsx}`；复杂状态拆 `src/features/material-catalog/selection/`，保持每目录≤8文件。

**具体操作**：

1. SSR输出35个真实曲目及可读选择列表，客户端选择按稳定 trackId；默认第一首可被显示，但不得 autofocus，更不自动播放。
2. 查询参数仅作为选中曲校验输入，非法ID回到明确目录状态；返回/前进恢复选择和滚动位置，不写全局浏览记录。
3. 详情由title、真实封面/现有可用封面样式、播放区域、notes、两个网络的资产资料组成。网络选择按用户能力显示，公共链上信息无需登录也能查看。
4. 无手记显示“创作手记尚未提供”；缺合约显示“该网络尚未开放”，不输出`0x000...`链接。地址展示、复制与浏览器URL均来自完整坐标。
5. 使用语义列表/按钮与明确播放标签；不将35首做成35个独立播放上下文。移动端触控目标、文字换行、焦点可见与 reduced-motion 沿用项目规范。
6. 新 CSS 全部 scoped到曲目馆/原曲页，不改根 globals 或P15 Score CSS。让数据刷新和网络切换只更新稳定槽位内容。

**失败恢复**：某首音频失败不影响选其他曲或看手记/凭证；组件错误有局部恢复。现有tokens不足时在本页作用域补样式，不写全局设计系统。

**定向验证**：组件数据/选择的相关测试及已有静态检查；确需真实排版证据的断言交 K2 一次必要视觉验收，E1/E4 不分别开浏览器，不为本页面另建 a11y 或全站测试基础。

**完成证据**：handoff 的 E1 条目记录可运行布局、真实空态、实际测试范围与晨间审美待评项；截图/长说明才按需附件，不另写设计报告。

**自动下一步**：进入 E2。

## P17-E2：单曲播放器与原曲公开唱片页

**输入依赖**：E0/B0真实音频、K0公共播放接口；P15退出视觉合同若未交付，先完成只读可运行适配并提交接口需求，不能拷贝旧Score场景重写它。

**实际文件/符号**：只读 `src/components/player/PlayerProvider.tsx:usePlayer`、`src/components/p11/{RecordAnchor.tsx,ScorePondHeader.tsx}`、`src/components/common/PlaybackSeekBar.tsx`（若BASE存在）、P15已交付退出视觉；新增 `src/features/material-player/{types.ts,use-material-playback.ts,media-source.ts}`、`src/components/music-catalog/player/{MaterialRecord.tsx,MaterialRecordPage.tsx,material-record.css}`、`app/score/material/[chainId]/[contract]/[tokenId]/{page.tsx,loading.tsx,error.tsx}`。

**具体操作**：

1. 单曲描述显式区分 track、deployment 和 playback。不要构造 `ScoreReadyData`、虚假 creator、事件数、空 events/sounds、Score tokenURI 来进入 ScorePondScene。
2. 通过当前 `usePlayer` 或总控提供的同等公共host播放实际单曲，复用HTMLAudio流式能力。P17不创建第二个全局Audio/AudioContext，不改PlayerProvider；source选择只用实际永久URI/已核验镜像。
3. 当前host只支持toggle/stop时先提供准确“播放/停止”，seek按现有真实能力接入，不能把stop标成pause。需要暂停/完成原因时将签名写入E4接线请求，未实现不提供假按钮。
4. 点击B曲先停止A曲；处理loading、用户暂停/停止、自然结束、错误、重新播放和路由离开。相应事件必须确认属于当前会话，旧请求迟到不能清空新曲。卸载只清理本会话资源，不停止另一个刚接管的会话。
5. 播放器不自动注册首页合奏/录制，不因听原曲生成空草稿。与Score、Echo播放器的互斥由总控统一接线，P17提供会话开始/结束需求和用例。
6. `MaterialRecordPage` 只读复用通用RecordAnchor和Header原语；传入真实标题/封面/网络/tokenLabel。GL场景若接口只接受Score，先交付无GL且可听的真实唱片页，再交总控提取纯视觉适配，不冒充Score。
7. P15保留退场快照的生命周期应同时用于原曲：自然结束时音频停止后视觉完成淡出，再释放日食/黑底；不能根据 `playing=false` 立即卸载视觉。reduced-motion使用短过渡或直接稳定画面。
8. metadata/OG生成按原曲语义、真实canonical URL和网络；公开页面无登录/数据库依赖，永久引用仍可独立交给SEMI或直接播放音频。

**失败恢复**：共享接口缺失时完成可运行的现有能力，并明确 `integration_pending` 子项；不要导入不存在的未来模块或写空实现。网关失败给可重试状态，不自动连续切换源造成播头循环。

**定向验证**：仅补数据解析/媒体选择/生命周期的相关断言；复用相同播放器/依赖环境下的既有证明，不重验媒体字节。用户手势、快速切曲/seek/结束/重试、路由标准和音频互斥中确需浏览器的部分交 K2 一次验收；缺 P15/总控接线则列明待测，不另开矩阵。

**完成证据**：handoff 的 E2 条目记录真实坐标 URL、可听来源、实际控制能力和接线依赖；复杂日志才附 material-playback。

**自动下一步**：进入 E3。

## P17-E3：双链收藏面板与真实状态

**输入依赖**：E1/E2、D1；ETH 实际操作依赖 D2–D4、发行政策确认及运行环境开关，缺失只禁用相关收藏动作，不影响目录/试听。

**实际文件/符号**：新增 `src/components/music-catalog/mint/{MaterialMintPanel.tsx,MaterialNetworkChoice.tsx,MaterialMintStatus.tsx}`；复用 `src/features/material-catalog/mint/useMaterialMint.ts`。P15现有网络面板/auth名称只读，不另改一遍。

**具体操作**：

1. 未登录显示收藏登录入口；SEMI/邮箱OP默认；外部已认证且关联地址可选OP/ETH，真实网络未开放禁用并说明。标签使用“SEMI社区身份”“链上地址登录”。
2. 每次收藏展示目标链、Token、接收地址、平台代付或用户Gas；不能把是否连接ETH链直接当作是否有ETH收藏能力。
3. 点击以trackId定位真实发行，调用D的prepare/OP适配；展示待签、待确认、已确认、拒签、失败、需核对。录入队列不显示铸造完成。
4. 保存/恢复本用户已有订单；切换网络或地址不会复用另一条链的成功状态。当前持有与历史收藏分开展示，ERC1155余额来自正确链/合约/token。
5. 状态长短变化不推动主播放器或按钮上下跳动；错误信息可完整阅读，不能用截断隐藏金额或地址差异。

**失败恢复**：D外部依赖缺失只禁用对应mint路径，试听和凭证保持可用；unknown无重复发送按钮。网络错误允许状态查询，不自动提交新收藏。

**定向验证**：登录能力矩阵、主网/测试网隔离、切换长短标签位置稳定、已在途订单恢复、拒签/余额不足/未知结果、OP历史已收藏地址显示。

**完成证据**：handoff 的 E3 条目引用各状态的实际证明与未实测钱包项，不另强制写 mint-panel。

**自动下一步**：进入 E4。

## P17-E4：共享接线交付与一次页面验证

**输入依赖**：E0–E3；总控准备K2。P15负责人可直接改现有Score视觉/header，P17不抢改；PlayerProvider总控单写。

**实际文件/符号**：只读 `src/components/pond-gl-test3/overlay/PondHeader.tsx`、`PlayerProvider.tsx`、原 Score 视觉；先扩展现有目录测试/验证入口，仅缺少等效能力才补 `scripts/p17/catalog/verify-surface-links.ts`。接线要求写 `P17_HANDOFF`，复杂接口才另附 integration-contract。

**具体操作**：

| 接线项 | 给总控的准确要求/验收 |
|---|---|
| 首页header | 在P15删除echo导航后的版本，于“艺术家”旁增加`/tracks`链接；无autofocus，首页键盘演奏不受影响 |
| `/score`根入口 | 若BASE无根页面，创建静态redirect到`/tracks`；已存在则保留现有职能增加原曲入口；旧动态路由不改 |
| 公共音频互斥 | 原曲开始停前一Score/Echo/首页会话，退出后释放监听；不能同时响两路，不能产生空草稿 |
| 公共唱片视觉 | P15退出相位/快照由原曲纯视觉适配消费，不能直接传假Score数据；自然结束与停止都验证 |
| 网络注册/env | 提供所需字段/地址来源，不改旧ERC721 identity行为；总控决定最小扩展 |

1. 导出每项拟调用签名、调用方位置、现有BASE接口、建议最小改动和测试断言；不是一句“请集成播放器”。
2. 用已有目录验证入口比较页面投影与 registry 坐标/URL/revision；如 P13 导出可用，交总控做同 revision 双向集合核对，不由 P17 写 SEMI 文件，不要求 P13 再核验整套链/媒体证明。
3. 必要布局/选择/音频断言统一交 K2 一个集成服务一次浏览器验收，失败只补测受影响部分。页面内容/URL 用静态检查，不为每个 Step、每个 SHA、每个设备重复开浏览器。
4. 记录独立可运行状态与剩余integration子项，提交本线已完成文件。总控未接线时不能把“首页曲目入口已完成”标真。

**失败恢复**：公共接口尚未交付则保留本线可运行代码，继续F本地账本/G；冲突交文件负责人，不复制P15源文件到新目录规避合并。

**定向验证**：已有等效目录/链接检查或必要时才新增的 verify-surface-links；页面/组件有关 lint/type。路由/打包/部署风险需要 production build 时仅交 K2 集中一次，普通 Step 不 build/全仓 verify；K2 必要浏览器验收不扩成生产/移动/多 profile 矩阵。

**完成证据**：唯一 handoff 的接线段落、实际测试引用和交总控的 commit；接口较长时才附 integration-contract。无浏览器证据明确未执行，不为填报告提前另跑一遍。

**自动下一步**：进入[Track F](60-f-archive-release.md)的可执行部分，随后G交接。
