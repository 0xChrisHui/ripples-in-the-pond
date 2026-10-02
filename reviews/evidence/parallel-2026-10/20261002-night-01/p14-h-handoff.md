# P14-H — 第36圆驻留交接

## 恢复入口

- lane：`p14-h`。
- runId：`20261002-night-01`。
- BASE_SHA：`e6985bec5ef6d6f191526e6f2e5b58caa5414357`。
- headSha：`1cdc275cb277fe4a4504281f86bf643c54509969`（已验证代码 HEAD；本记录作为直接后继文档提交交付，最终完整移交 HEAD 在总控交接消息中）。
- dependsOn：`e6985bec5ef6d6f191526e6f2e5b58caa5414357`；不依赖其他 worker 提交。
- 工作目录：`E:\Projects\nft-music-cleanup`。
- 分支：`codex/night-p14h-20261002-night-01`。
- completedSteps：`H0,H1,H2,H3,H4,H5` 的独立代码、测试与接线交付。
- nextStep：总控 K2 完成共享接线，再在唯一集成浏览器会话执行 H6。
- status：`code_ready`。
- verification：本文列出的定向检查在代码 HEAD 上有效；后续仅加入交接 Markdown，不改变验证环境或代码。
- pendingItems：`integration_pending`（首页/数据/播放/日食/水面接线）、H6 页面与真实播放验收；没有已知外部网络失败。

## H0：事实、所有权与尺寸

| 项目 | 实际定位 / 结论 |
|---|---|
| 真首页 | `app/page.tsx` 导出 `app/test3/page.tsx::Test3PageInner`，使用 `pond-gl-test3` 树 |
| 旧运行入口 | BASE 中没有首页 guest/featured 控制器；不需要 worker 删除旧挂载，不重跑 P14-G |
| 真实输入 | `src/data/echo/source.ts::getEchoByTokenIdCached` 存在且 server-only；校验链上 tokenURI、永久 metadata、origin 一致性。H 未读取凭证或发 RPC 请求，真实可用性由总控提供 |
| 真实播放 | `src/features/wallet-recipe/player/use-wallet-recipe-player.ts` / `WalletRecipePlayerSnapshot`；已有 seek/播放进度保留 |
| 帧与投影 | `PondGL` 内 R3F；`sphere-projection.ts::project/unproject`；水位为 `getEffectiveWaterLevel()` 归一化深度 |
| 场景恢复 | BASE 没有 Echo 专用恢复信号；由总控显式注入 `sceneRestored`，不从音频 positionMs 或 timeout 推测 |
| 尺寸依据 | 可信保留提交 `2be3786f45fec398d67abd2cd4305e56e4b9ef19` 的 `src/components/pond-gl-test3/visitor/track36-state.ts::TRACK36_RADIUS=34`；`createTrack36State` 将它写入真实 featured 节点 `radius`，颜色为 `#d9e6df` |
| 新尺寸 | 宿主 `baseRadiusPx=34`；主体半径 `34×2×breathScale×projectionScale`。同投影、无 hover、呼吸1时为半径68 / 直径136；`size_reference_pending` 已解除，实际页面比对待 H6 |

只写本线白名单。共享首页、PlayerProvider、PondGL、spheres、水面、投影、日食、全局文档、package/lock 均未修改。
原目录脏现场由 K0 保护，本线未 stash、未处理用户文件、未创建额外工作树。

## H1–H3：参数、运动与锁

全部参数集中在 `echo-resident/config.ts::RESIDENT_ECHO_DEFAULTS`，`residentConfigVersion=1`；这是初版建议参数，未替用户完成审美定稿。

| 参数 | 本次值 |
|---|---|
| 直径 / 呼吸 | 2倍；0.90–1.10；完整周期14–28s |
| 漂移 | 安全矩形短边3%–8%，不超过80px；10–25s；五阶缓动峰值≤6px/s；方向候选最多8次 |
| 深度 | surface+[0.04,0.10] / surface−[0.04,0.12]；完整周期10–25s；最终[0.02,0.98] |
| 显隐 | 可见20–45s；隐藏8–20s；淡入/淡出各1.5–3s；初次ready后延迟0–1.5s |
| 保护 | 交互解除1.5–3s；播放结束/停止且场景恢复后3–6s；接续前另保证可见期限至少3s |
| 恢复缓冲 | 0.6–1.0s按转换抽样，以五阶速度积分渐进恢复，保持原运动段与随机状态 |
| 边界 | 视口16px+safe-area；控件外扩12px；最大呼吸×透视上限×实际halo，再留4px焦点环 |
| 时钟 / 命中 | active elapsed；单帧最多50ms；有效透明度≥0.15启用命中；淡出停止新的Tab进入 |

位移、深度、缩放、显隐四条随机流互不消耗。生产只创建一次视觉随机种子，不用钱包或recipe，不暴露URL调参。
非法配置整体回退默认值，`onConfigError` 可接宿主反馈；非法几何归一为有限值，零面积/半径不命中。
安全区域按控件切割，单轮最多64块候选；漂移起终点在同一凸矩形内，不穿过 UI。resize 映射段端点，保留时间/随机状态；放大视口不把路线拉长到超速。
极端短屏有界搜索最大可容纳尺寸，输出 `sizeClamped/sizeScale`，停止运动；不能把这种响应式缩小记作尺寸目标通过。

hover/focus/pointerDown 平滑减速，连续恢复透明度；loading/playing/paused保持冻结。播放解除须先等 `sceneRestored` 再开始保护。
后台重置真实采样点，不追赶；其他作品焦点/场景隐去冻结本线时钟；运行中reduced-motion静止且完全可见，仍遵守场景透明度。
request只消费用户手势，等待中去重，错误输出可重试信息；destroy幂等，清除订阅与命中，不拥有音频。

非显然决定（交总控按公共单写规则归并 JOURNAL）：

1. BASE没有guest壳，因此提供同Canvas单实例球和共享pose，不以假Track补第36个d3节点。
2. 使用独立CSS屏幕球心，逆投影只用于共享适配；禁用普通球漂移/浮动/闪烁，保证GL/DOM/水面同步。
3. shader最终alpha写 `aParams.z`，`aLifeDim=1`；现有水上pass恢复主体alpha仍消费playDim，因此隐藏不会留下球体。
4. 不新增自动尾波/新Canvas/FBO/rAF；每帧由原Canvas驱动一次，DOM订阅只写元素几何，避免React每帧重渲染。

## H4：总控接线请求

所有下表项目前为 `integration_pending`，总控集成 SHA 尚未产生。

### H-WIRE-01：宿主与资产

`app/test3/page.tsx::Test3PageInner` 只挂一次 `useResidentEcho({layout,seed?})`，不以group/A/B/C作key；返回 nullable runtime。
hook在effect中创建/销毁runtime，管理visibilitychange与prefers-reduced-motion change；没有Audio或独立RAF。
首次布局可用后创建；后续布局经frame输入，不重建控制器。控件矩形只在布局变化测量，包含Header/GlNav/Jam/BottomPlayer可见区域与safe-area。

`src/types/echo-resident.ts::ResidentEchoAsset` 保存 `status=available,chainId=10,contractAddress,tokenId='1',metadataUri`。
服务端使用既有严格数据源，总控将结果映射到 `ResidentEchoFrameInput.available`；H不fetch、不import server-only、不改变资产/配方。
不可用状态保留真实reason，available=false不画球/按钮；禁止本地短音频、public/the36或假的NFT代替。

### H-WIRE-02：帧、命中与播放

`PondGL.tsx` 在当前 Canvas 中挂 `EchoResidentSphere({runtime,getFrameInput,separatePass:flags.waterFx,colorGrade:flags.colorGrade})`。
该组件的useFrame优先级为−1，**负责调用唯一runtime.step**；宿主不要另设rAF或在正常帧重复step。
`getFrameInput(): ResidentEchoFrameInput` 输入包含layout、available、healthy、sceneReady、scenePresence、sceneRestored、reducedMotion、playback、otherPlaybackActive。
layout.baseRadiusPx固定34；maxProjectionScale至少1.5；haloRatio=现有HALO_R=1.16；surface/projection与共享球同帧同源。

DOM挂 `EchoResidentHit({runtime,getPlayback,execute})`。getPlayback返回既有snapshot的idle/loading/ready/playing/paused/ended/error。
execute消费play/pause/resume/retry/stop命令，沿用既有钱包配方播放控制与全局互斥；H只在click执行，不绑定重复keydown。
playing映射pause，paused映射resume，error映射retry；加载中重复点击由request去重。
暂停仍是播放锁；stop/ended/error/另一作品接管才解除。独立球在日食中可以scenePresence=0，但宿主必须保留可见停止入口。
sceneRestored必须由现有视听场景完成退场后提供，不用positionMs归零推测；全局Player接线归总控。

无有效GL画面时，即使Canvas停止帧回调，宿主health/data事件也要立即 `runtime.step({...frame,healthy:false/available:false},performance.now())` 禁用旧命中。
可恢复context loss保留同一控制器；路由卸载由hook destroy清理。

### H-WIRE-03：共享水面与场景

独立sphere层在waterFx模式使用SPHERE_LAYER；现有 `render-passes.ts::setSphereWaterPass` 根据uWaterPass自动覆盖水下/水上两次pass。
在非waterFx模式使用BACKGROUND_LAYER。没有新增Canvas、render pass、FBO或普通球节点。

`render/pose.ts::resolveResidentScenePose(pose,frame)` 输出原pose、simX/simY、blurAmt、submerge、shaderAlpha、waterMaskPresence。
GL、按钮、水面读取 `runtime.getSnapshot().pose` 的同一frameId；渲染接线不会再叠applyFloat/jelly/flicker/wake/d3。
水面 `water-distort-setup.ts::applySpheres` 在35个普通节点后直接注入render-only槽：

```ts
// 总控在共享层实现；隐藏时不进入有效槽数。
arr[index].set(pose.sx, pose.sy, pose.bodyRadiusPx * 1.15, pose.depth);
visualDim[index] = pose.effectivePresence;
```

effectivePresence>0且主体半径>0时才计入uSphereCount；核对MAX_SPHERES/uniform容量≥36；不把Echo cast成GlPhysNode。
水面/阴影/折射与shader只消费最终alpha一次，不在DOM父级再次乘presence。隐藏时没有mask孔洞。
WaterPetals若开启，同样消费pose作为独立遮挡项；无需改普通35球的来源、links或Track计数。

验收断言：同frameId球/按钮中心和半径误差≤2CSS px；隐藏无透明命中/Tab/实体/水面孔；切组仍一个实例；停止后保持旧相位；播放焦点互斥；出现不主动focus。

## H5：验证与 changedFiles

| 实际检查 | 结果 |
|---|---|
| `npx --no-install tsx scripts/p14-h/verify-resident-echo.ts` | 退出0；数学/生命周期/呈现适配/命令四组通过 |
| 数学重放 | 60s虚拟时间，25ms与50ms步长；位置/深度同时间误差<1e−7；随机调用次数一致；峰值5.99996CSS px/s |
| 几何 | Header+光晕+焦点避让；375×844 resize；90×150短屏明确sizeClamped；全UI占满时scale0；NaN/Infinity有限输出 |
| 生命周期 | 正常显隐、淡出hover、focus、playing/paused、ended等待场景、另曲接管、后台两次1h跳时、动态reduced-motion、失效数据/GL、重复destroy |
| 命令 | 创建/step零自动命令；等待去重；reject可重试并解除等待；暂停保持锁；destroy后不执行 |
| 呈现适配 | 旧参考半径34的2倍公式；带视差/透视投影互逆；aParams.z最终alpha0.5只乘一次；alpha0时mesh不可见 |
| `npx --no-install eslint src/components/pond-gl-test3/echo-resident src/types/echo-resident.ts` | 退出0 |
| `npx --no-install eslint --no-ignore scripts/p14-h` | 退出0；项目默认忽略scripts，显式检查本线脚本 |
| `npx --no-install tsc --noEmit` | 退出0；直接使用当前生成类型，未改业务救绿 |
| `git diff --check` / staged diff检查 | 退出0 |

初始断言曾明确失败“尚未实现驻留控制器”；新增异常几何用例曾明确失败“非法几何不得生成NaN深度”，修复后通过。
首次检查发现相对类型import多上一级、默认范围tuple推断、scripts被全局忽略，已限于本线修正；没有未解决type/lint失败。
最后修改的恢复缓冲抽样重新跑本线测试、对应lint与tsc，均退出0；未扩展build、全量verify、浏览器或服务。

changedFiles（均新建；代码最大99行，每层文件数≤8，src/types现为8个文件）：

| 文件/目录 | 文件与行数 |
|---|---|
| `src/types/` | echo-resident.ts 82行（包含空行） |
| `echo-resident/` | config.ts 55；random.ts 28；motion.ts 92；presence.ts 37；runtime.ts 99；use-resident-echo.ts 37；EchoResidentHit.tsx 60 |
| `echo-resident/render/` | bounds.ts 62；layout.ts 17；pose.ts 34；sphere-material.ts 33；EchoResidentSphere.tsx 41 |
| `echo-resident/state/` | locks.ts 53 |
| `scripts/p14-h/` | fixture.ts 15；verify-resident-echo.ts 14；verify-math.ts 58；verify-runtime.ts 77；verify-render.ts 31；verify-commands.ts 31 |
| `reviews/evidence/parallel-2026-10/20261002-night-01/` | 本交接记录 |

关键走读：`motion.ts` 的1.875峰值限制决定轻运动速度；`state/locks.ts` 的sceneRestored门槛决定停播接续相位；`sphere-material.ts` 的aParams.z决定主体能否完全隐去。

## H6 与外部状态

H6未运行，由总控在K2单次会话完成；当前不能宣称首页实际生效、视觉审美通过、真实永久播放通过或StrictMode/group页面行为已验。
集成后优先补：桌面完整隐现一次、手机safe-area/UI避让、球/DOM/水面同帧、Tab/触摸/hover锁、真实Echo暂停/seek尾段ended、退场恢复、普通曲互斥、后台/reduced-motion、离开返回清理。
若媒体外部资源不可用，只把相应真实播放断言记external_pending；本线纯状态测试不能替代媒体证明。
恢复输入为已验证Echo资产及真实播放桥；H没有网络失败需重试，没有缺失生产写入权限需要申请。

本线未部署、未上传、未交易、未写数据库、未push、未外部联系。
早晨用户只需看三点：球大小（diameterMultiplier保持合同2倍）、运动舒适度（driftFraction/driftSeconds/depthCycleSeconds/breathCycleSeconds）、显隐节奏（visibleSeconds/hiddenSeconds/fadeInSeconds/fadeOutSeconds）。

## K2 总控结果（替代未接线状态）

共享接线已归并于cb37bf9及6dfa1be；K2唯一浏览器实测visible→fading_out→hidden→fading_in→visible、隐藏pointer none/tab -1、切组/resize不重建、桌面/手机未sizeClamped、reduced-motion、真实Echo暂停/seek尾段自然结束/stop恢复均通过。截图和原始结果见k2-browser.json/visuals；审美仍待用户目验。本段替代上文integration_pending，不增加第二份报告。

## 2026-10-03 集中UI收尾

定位真实宿主initialLayout为1×1：初始安全区域夹缩，漂移两端同一点；普通resize保留端点，导致首段10–25秒没有位移。verify-runtime增加该宿主输入的回归，先红后绿；首次完整区域重建运动，普通resize不重抽断言仍通过。另定位驻留材质uTime/边缘波/光晕恒0，呈现实色正圆；改用驻留motionSeconds驱动轻边缘波与光晕，同播放/hover/后台锁冻结，不叠普通球运动。表面参数集中config，直径2倍、呼吸范围、6px/s上限和显隐合同保留。

verify-render先复现uTime仍0，再修后通过；P14数学/生命周期/呈现/命令四组通过，峰值漂移5.99996CSS px/s。项目type与相关lint退出0。新形态仅代码就绪，不声称审美验收通过。

启动Edge9315本地验收被工具自动审批拒绝，理由仅blocked by policy；没有绕过该拒绝。因此本次真实绘制/首屏矩阵未执行，旧K2只复用未变播放/命中/身份等证据，不能用旧截图替代新画面验收。
