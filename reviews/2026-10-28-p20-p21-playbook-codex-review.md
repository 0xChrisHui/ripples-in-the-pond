# P20 / P21 playbook 审查（Codex）

> 审查者：Codex CLI `gpt-6-astra`，只读沙箱（`codex exec -s read-only`），2026-10-28。对象：`playbook/phase-20/00-overview.md`、`playbook/phase-21/00-overview.md` 初稿（均未提交）。
> Claude 复核（2026-10-28）：抽查 7 处关键证据全部属实——`PondGL.tsx:169` Canvas 在花瓣挂载前已关闭；`sphere-shader.ts:106` 水上 pass 强制主体 alpha；`integration-gate.mjs:54,71,97` 点击顶栏 `a[href="/tracks"]`；`pond-transition.tsx:102` 仅同路径跳过事务；`e7e9df9` 提交说明 11 首保持原译；`zh.json:758` 是 `titles.tracks`；`bg-ripple:wave` 被两套监听分别读取两组字段。另核实 AGENTS.md:31"禁止占位"。
> 用户决定（审查后）：①按审查修订两份 playbook；②审查原文存入本文件；③未收到新稿的 11 首英文手记艺术家认可、不改（35 首均为艺术家认可版本）；④#36 在 `/lens` 上可以播放；⑤面板的链上信息 OP 与 ETH 都给，多放链上信息显得专业，控制好布局、字号、排版。
> 修订结果见两份 playbook 的修订记录。

---

**结论：两份计划的方向可行，但不宜原样执行。** 已发现渲染挂载位置错误、#36 透明度实现陷阱、旧测试保留承诺冲突，以及步骤范围缺口。

本次仅阅读文件、搜索代码和查看 Git 历史；没有修改文件、安装依赖、运行 build/dev/verify 或访问网络。以下“已核实”指代码或仓库记录已证实；视觉、性能和浏览器行为未经实测。

**阻塞**

1. **P20 §3 F14、§6 Step 2：气泡挂载示例与 R3F 方案冲突。〔已核实〕**

   问题：`WaterPetals` 是 Canvas 外的 **2D canvas 叠层**。照第 172 行挂气泡，无法进入背景 FBO；使用 R3F hooks 的组件也不能直接挂在这里。

   证据：[PondGL.tsx:169](E:/Projects/nft-music/src/components/pond-gl-test3/PondGL.tsx:169) 已关闭 `<Canvas>`，第 172 行才挂花瓣；[WaterPetals.tsx:43](E:/Projects/nft-music/src/components/pond-gl-test3/decor/WaterPetals.tsx:43) 明确说明是 2D overlay。真正的背景绘制入口在 [render-passes.ts:132](E:/Projects/nft-music/src/components/pond-gl-test3/water/composite/render-passes.ts:132)。

   建议：气泡 mesh 放进现有 `<Canvas>`，沿用 `FloatingMotes` 的背景 layer；手记 DOM 单独挂在 Canvas 外。文档明确两个挂载点及其坐标通信方式。**背景层路线本身成立，无需因此更换渲染架构。**

2. **P20 §5 D1、§6 Step 1：“不透明度 85%”不能只改 fill 参数。〔已核实〕**

   问题：当前水上 pass 会强制提高主体 alpha；把 `fillOpacity` 调成 0.85，水上圆心仍可能完全不透明。另外，#36 原始颜色已经是白色，“降低饱和度 30%”必须说明作用在哪个调色阶段。

   证据：[sphere-shader.ts:106](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/sphere-shader.ts:106)：
   ```glsl
   alpha = max(alpha, bodyMask * playDim * waterWeight);
   ```
   [sphere-config.ts:154](E:/Projects/nft-music/src/components/archipelago/sphere-config.ts:154) 给 #36 设置 `#FFFFFF`；shader 第 113 行做饱和度处理，第 114 行之后才加入偏色调色。身份渐显、隐退与场景退场则共同进入 [sphere-frame.ts:160](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/sphere-frame.ts:160) 的透明度。

   建议：明确“85%”是默认态最终主体覆盖率，还是现有效果的乘数；针对 `node.echo` 增加独立视觉因子，并保留播放态与 presence 渐变。不要改共享 `sphere-config` 来实现本次视觉变化，以免波及 `/test1`。D1 的去饱和应针对最终偏色，或改为可目验的颜色目标。

3. **P21 开头、§3 F15、§6 Step 5–6：移除 `/tracks` 入口与“旧测试原样保留”不可同时满足。〔已核实〕**

   问题：旧测试不仅测试旧页内部，也依赖全站导航入口。

   证据：[integration-gate.mjs:54](E:/Projects/nft-music/scripts/ui/tracks-circle/integration-gate.mjs:54)、第 71、83、97 行直接查找或点击顶栏 `a[href="/tracks"]`。此外，[TASKS.md:65](E:/Projects/nft-music/TASKS.md:65) 已登记 `tracks-experience.test.ts` 早已过期，并非现成可用的回归保障。

   建议：改成“保留旧页功能及内部测试；更新涉及全站入口的集成测试”。将这些测试文件明确加入 Step 5/6 范围，并单独记录已有失效测试，不能宣称全部无需调整。

4. **两份文档 §6：若严格执行当前范围，若干步骤无法独立完成。〔已核实〕**

   | 位置 | 问题与证据 | 建议改法 |
   |---|---|---|
   | P20 Step 0 | 范围仅只读及 JOURNAL，完成标准却要求修改本计划 §3 | 将计划文档勘误纳入范围 |
   | P20 Step 2–3 | Step 2 明确交付“空组件”，违反 AGENTS 禁止占位；Step 3 要验气泡运动，但 shader 安排到 Step 4 | 合并为最小可见、可开关、可运动的气泡闭环；Step 4 再精修 |
   | P20 Step 6 | 只列新建 HTML/样式，但必须改已有载体泡寿命、调度与挂载，才能实现“文字先退、泡后破” | 列出 Step 3 调度模块及 Canvas 外宿主的修改权限 |
   | P21 Step 3 | 只允许 lens、`SphereHit`、`SphereOverlay`，但实际调用处尚未传入新交互参数 | 将 [PondExperience.tsx:164](E:/Projects/nft-music/src/features/home-pond/PondExperience.tsx:164) 或 Step 1 抽出的宿主纳入范围 |
   | 两份 Step 0 | 已知目录超限，却未规定 verify 失败后的执行方式；AGENTS 要求失败立即停止 | 开工前明确处理旧失败的方式，不能把“记录基线”默认为继续授权 |

**重要**

5. **P21 §3 F2、§4 N1、Step 5：首页别名涉及“路径”和“场景身份”两层，不能只替换五处判断。〔已核实；实际闪动未核实〕**

   还应列入以下具体位置：

   - [pond-transition.tsx:102](E:/Projects/nft-music/src/components/pond-shell/pond-transition.tsx:102)：只有**相同 pathname**才跳过新事务。`/ → /lens` 即使同属 `home`，仍执行 `start → ready → reveal`。
   - 同文件第 76 行：reveal 冻结旧 surface；第 78 行处理滚动；第 158 行的 Back/Forward 也无条件启动事务。
   - [route-reducer.ts:18](E:/Projects/nft-music/src/components/pond-shell/transition/route-reducer.ts:18)：`start` 没有同场景别名分支。
   - [PondRouteLink.tsx:20](E:/Projects/nft-music/src/components/pond-shell/PondRouteLink.tsx:20)：再次点击“详情”默认仍导航，不会执行两级退出。
   - [PondExperience.tsx:57](E:/Projects/nft-music/src/features/home-pond/PondExperience.tsx:57)：URL 参数仅在首次挂载时读取；持久外壳不会因 `/ → /lens?track=12` 重挂。
   - [use-route-presence.ts:39](E:/Projects/nft-music/src/components/pond-shell/motion/use-route-presence.ts:39)：pathname 变化也会重新执行 presence 更新。

   建议：Step 0 先确定同 `home` 场景内切换的事务语义，以及首次进入、站内进入、仅 query 改变、Back/Forward、快速反向、取消导航的选中状态规则。不要直接把所有 `href="/"` 改成 `/lens`；品牌返回首页应保留其产品语义。

6. **P20 §4 N1、P21 §4 N3：能拿到球位置，但照抄花瓣投影不够准确。〔已核实〕**

   问题：花瓣只调用 `project()`；实际球和命中层还应用浮动与颤动。用花瓣公式会使避让范围、光圈和面板与可见球错位。

   证据：[WaterPetals.tsx:134](E:/Projects/nft-music/src/components/pond-gl-test3/decor/WaterPetals.tsx:134) 只用 `project()`；[SphereOverlay.tsx:75](E:/Projects/nft-music/src/components/pond-gl-test3/overlay/SphereOverlay.tsx:75) 和 [sphere-frame.ts:118](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/sphere-frame.ts:118) 使用 `applyFloat(project(...))`，GL 还叠 hover 放大、场景缩放和可选形变。

   P14-I 的 #36 已直接追加进 `glSim.nodes`，见 [echo-node.ts:55](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/simulation/echo-node.ts:55)；`getPondRenderNodes()` 主要补旧 visitor，并不是“取得个人 #36”的必要入口。

   建议：明确复用现行投影链及可见性口径，避让使用保守半径；P21 按 `node.echo` 排除特殊圆，不能按数组第 36 项或字符串 `"36"` 判断。还应为背景折射预留避让余量：合成 shader 的位移上限为 UV ±0.025，泡的最终屏幕位置并不严格等于未折射位置。

7. **P20 §3 F7、§4 N2、Step 3：两种涟漪字段不是二选一，而是同一事件的两个消费者。〔已核实〕**

   证据：[WaterDistort.tsx:129](E:/Projects/nft-music/src/components/pond-gl-test3/water/WaterDistort.tsx:129) 读取 `{x,y,strength,radius}`；[use-gl-sim.ts:110](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/use-gl-sim.ts:110) 同时读取 `{x,y,size,duration}`，且直接计算 `duration * 1000`。`ripple-feed.ts` 提供计算和写 uniform 的函数，**没有独立的公共 enqueue 接口**。

   建议：在 Step 3 前冻结完整事件合同：`x/y` 为屏幕像素，`radius` 为高度场归一尺度，`size` 为推球范围、`duration` 为秒。若气泡破裂只需水纹、不应推球，应明确采用专用注入通道及文件范围，不能只发半套字段。

8. **P20 §3 F6、§4 N3、Step 7：照花瓣透传，不能保证所有路由持续开启。〔已核实〕**

   问题：当前 `coreFlags` 的特殊透传只覆盖注册了 score/tracks 场景的分支；`/me`、`/artist` 会使用 `ARCHIVE_FLAGS`，它从默认 flags 派生。花瓣默认开，所以看似跨页正常；新气泡默认关，行为不同。

   证据：[PondExperience.tsx:88](E:/Projects/nft-music/src/features/home-pond/PondExperience.tsx:88)、[PondSceneLayers.tsx:9](E:/Projects/nft-music/src/features/home-pond/PondSceneLayers.tsx:9)。而 score 场景还会切换 `coreSim`，见前者第 103 行。

   建议：把 N3 提前到 Step 0；制定逐路由的气泡、手记、遮挡节点来源和播放抑制表。P21 的“气泡保留、手记关闭”也应通过明确接口接入，并补充 P20 文件的修改范围。

9. **P21 §1、Step 3–5：手机首击、退出、播放单例和 Esc 的合同仍不完整。〔已核实；实际冲突未实测〕**

   - [SphereHit.tsx:79](E:/Projects/nft-music/src/components/pond-gl-test3/overlay/SphereHit.tsx:79) 当前第一次 pointerup 就播放，并移除焦点；新增 `draggable/showPlayIcon` 两个参数不足以实现“手机第一次选中、第二次播放”和 Tab 选中，需要选择/激活/焦点接线。
   - [PlayerProvider.tsx:146](E:/Projects/nft-music/src/components/player/PlayerProvider.tsx:146) 的 `stop()` 会取消异步播放并清状态；只隐藏日食或令光圈解锁，不等于停止音频。
   - #36 使用独立 Echo engine，见 [useFeaturedEchoPlayback.ts:25](E:/Projects/nft-music/src/components/pond-gl-test3/visitor/useFeaturedEchoPlayback.ts:25)。目前“不出面板、不锁定”**没有说明它是否仍可播放**；若允许，离开 `/lens` 的停播必须覆盖它。
   - [LoginModal.tsx:105](E:/Projects/nft-music/src/components/auth/LoginModal.tsx:105) 处理 Esc 时只 `preventDefault()`；手机菜单的 window 监听不消费事件；路由 preparing 阶段也有 Esc 取消监听，见 [pond-transition.tsx:166](E:/Projects/nft-music/src/components/pond-shell/pond-transition.tsx:166)。

   建议：补交互状态表和事件优先级：弹窗/菜单 → 路由取消 → lens 两级退出；明确 loading、播放失败、外部播放器抢占、#36、已有首页播放进入 lens 的行为。沿用现有播放器和 `HomeEclipseDriver`，不新建日食驱动。

10. **P20 §4 N6、Step 5；P21 §1 加载、Step 5：懒加载承诺需要按真实依赖图修订。〔已核实；包体积影响未核实〕**

   问题：现有英文 hook 在英文模式下同时加载艺术家内容和全部英文手记，不支持“首次出手记才下载”。

   证据：[use-english-content.ts:13](E:/Projects/nft-music/src/i18n/content/use-english-content.ts:13) 是两个 import 的 `Promise.all`；生产外壳始终挂载隐藏的艺术家页，[PersistentRouteSurfaces.tsx:129](E:/Projects/nft-music/src/features/home-pond/PersistentRouteSurfaces.tsx:129)，该页第 13 行调用此 hook。因此英文首页已有提前请求手记的代码路径。

   另：P21 N6 拟复用的 `route-selection.ts` 静态导入 `asset-registry`，后者又导入中文手记、metadata 并生成 catalog revision。把它直接引入首页宿主，会扩大依赖面。

   建议：决定 P20 的要求是“本功能不新增提前下载”，还是严格推迟现有英文下载；后者需要增加 i18n/艺术家加载模块范围。P21 将编号映射、完整 catalog、收藏组件放在 lens 异步边界内。英文加载失败时跳过手记，不能沿用 hook 的中文回退来满足“英文模式无中文手记”。

11. **两份 §6 Gate、§8：`/test4` 不能替代生产集成 Gate。〔已核实〕**

   证据：[app/test4/page.tsx:10](E:/Projects/nft-music/app/test4/page.tsx:10) 未开启 `persistent`；生产使用 [PersistentPondShell.tsx:16](E:/Projects/nft-music/src/components/pond-shell/PersistentPondShell.tsx:16) 的持久外壳。`PondExperience.tsx:45` 还明确令 `/test4` 的 `p9Enabled=false`。

   建议：保留 `/test4` 视觉 Gate，但增加真实持久外壳的功能 Gate，覆盖 `/ ↔ /lens ↔ /me`、单曲页、P9、播放中导航、Back/Forward、慢加载和 WebGL fallback。P21 的同场景别名最小验证应提前，不能到漂亮面板完成后才第一次验证核心路线。

12. **两份基线、P20 §1 手记来源、STATUS/TASKS/JOURNAL：记录存在实质漂移。〔已核实〕**

   - 当前分支是 `feat/p14-i`；TASKS 的 Now 仍是 I6 目验，不能把 P20 的“P14-I 已合 main”当作已满足。
   - STATUS 第 13 行写 P15-J 未合并，TASKS 第 34 行写已合 main；Git main 已包含相应实现。
   - STATUS/TASKS 仍写 P19 未合 main，但 main 已包含 P19 提交。
   - P20 称英文手记是艺术家确认版，**只有部分得到记录支持**。`git show e7e9df9` 明确：
     > 未收到新稿的 2/5/7/10/21/22/23/25/27/30/35 保持原机器初稿。
   - STATUS 第 17 行仍把 ECHO #1 公共样例列为待拍板，JOURNAL 第 1873 行已记录决定保留。

   建议：开工基线固定到 SHA，并在文档列出尚未验收项；英文来源写成“24 首已更新，11 首仍为机器初稿”，或补充后续确认依据。同步权威“下一步”，不要凭过期台账判断合并状态。

**建议**

13. **两份 §2、§8：“像素级一致”需要排除计划内的明确变化。〔已核实〕**

   P20 无论气泡开关如何，Step 1 都改变 #36；P21 无论是否访问 lens，都改变首页顶栏文字和链接。这与“对开工前像素级一致”的字面要求冲突。

   建议：P20 将气泡关闭回归基线设为 Step 1 之后；P21 明确顶栏改名是预期差异。随机画面应固定种子、视口和采样时刻再比较。

14. **P20 §5 D3–D5、P21 §5 D3–D5：默认值可作试验值，但有几个边界需写清。〔已核实文档缺口；体验优劣未核实〕**

   - P20 D5 叫“上限”，却允许无法切分时整段保留；当前英文最长单行 354 字符，会超过 180。建议改为“软目标”并设置最终布局上限。
   - P20 “切换后下一条换语言”与“英文模式没有中文手记”未说明如何处理正在显示的中文。建议切换时撤下当前片段，下一条使用新语言。
   - P21 D4 的宽限区只覆盖鼠标，键盘焦点进入面板、登录弹窗打开、收藏进行中也应保持选中状态。
   - P21 D5 只有一个“详情”链接，但同一首有 OP/ETH 两个正式单曲 URL；应按链提供链接或明确默认链，不能由实现者随意挑选。
   - P21 120/90px 光圈、60% 暗度没有代码层面的明显矛盾；可保留为目验初值，不能视作性能已通过。

15. **两份 §7–8：补充可测预算和状态变化验收。〔未核实性能结果〕**

   证据：[TASKS.md:67](E:/Projects/nft-music/TASKS.md:67) 已记录 P15-J 的 26–28 秒与后续 46–49 秒测量不一致；“相比基线无可感知变化”目前缺少稳定基准。

   建议：未来验收采用同一 SHA、设备、网络和前台可见状态，记录首帧、水面就绪、可交互时间、初始资源及帧耗时；加入运行中开启减弱动效、后台恢复、resize/转屏、context lost。每帧更新 mask 是否掉帧、backdrop-filter 成本，本次只读检查无法确认。

**§3 逐条核对结果**

下表覆盖两份文档全部事实条目；“修订”对应上面的具体问题。

| P20 条目 | 核实结果 |
|---|---|
| F1 | **已核实**正交相机和 `0.5+d`；原始水位 0.5 映射后的有效水位是 **0.525**。见 `PondGL.tsx:127`、`sphere-projection.ts:39`、`water-level.ts:33–49`。 |
| F2 | **已核实**背景、球水下、球水上三个场景 pass；另有高度场模拟与最终合成，不能把“三遍”理解为全部绘制次数。背景确实被折射，见 `water-distort-shaders.ts:142–152`。 |
| F3 | **已核实**NDC、加色混合、无 discard、215 行；hook 计为 **216 行**，实际剩 4 行。 |
| F4 | **已核实**接口、默认值、解析器三处，201 行；加三行后文本 204、hook **205**。 |
| F5 | **已核实**组件和控制台路径、82 行；URL 只在挂载时解析；“首页等价物”需限定，见第 11 条。 |
| F6 | **已核实**注册场景透传花瓣；对气泡跨页的推论不完整，见第 8 条。 |
| F7 | **已核实**事件存在；两套字段都被使用，见第 7 条。 |
| F8 | **已核实**抽象、光向、退让等规则；“确定性种子”原文针对每球个体差异，不宜扩大成所有随机效果的一律要求。见 `95-l-life-sense.md:17`。 |
| F9 | **已核实**单例及动态监听，见 `reduced-motion.ts:15–26`。 |
| F10 | **已核实全部数字**，但统计口径是按 `/\n+/` 拆非空行；若按空行分段，中文为 **51** 段、英文 **127** 段。应注明口径。 |
| F11 | **已核实**revision 包含手记、英文独立加载原则；严格首次使用才下载不成立，见第 10 条。 |
| F12 | **已核实**背景、边框、blur 和字体令牌，见 `me-pond.css:63–69`、`p11-tokens.css:27`。 |
| F13 | **已核实**直接文件数：根 8、overlay 8、decor 6、home-pond 8、i18n 8；只数文件，没有把子目录算进去。 |
| F14 | **已核实**177 行、花瓣挂载第 172 行；挂载方式的推论错误，见第 1 条。 |
| F15 | **已核实**1–2px、同屏最多 4；但实现是 DOM `div`，并非 SVG 图元，属于旧 archipelago 效果体系。 |

| P21 条目 | 核实结果 |
|---|---|
| F1 | **已核实**`/lens` 当前落到 archive，`transition/types.ts:28–35` 正确。 |
| F2 | **已核实**列出的五组位置与行号；不是完整清单，见第 5 条。 |
| F3 | **已核实**首页为标记 div，`app/(pond)/page.tsx:2`。 |
| F4 | **已核实**顶栏链接及第 30 行。 |
| F5 | **已核实**所列链接、重定向、预取位置；入口变更会影响旧测试。 |
| F6 | **已核实有误**：77 行是 `nav.tracks`，758 行是 **`titles.tracks`**，并非两个 `nav.tracks`。应分别决定是否改名。 |
| F7 | **已核实**普通球 id 等于 trackId，并复用 PlayerProvider；不包括 Echo 特殊圆，且 trackId 是 UUID，不是展示编号。 |
| F8 | **已核实**列出的 z-index；z-25 在 `PondExperience` 的 SceneCover 包装层，非 SceneCover 自身固定值。 |
| F9 | **已核实**8px、115 行、无关闭拖动参数；还需选择和焦点接口，见第 9 条。 |
| F10 | **已核实**阻止涟漪及滚轮放行；后者实际检查 `[data-pond-ui]` 属性存在，不要求值必须为 `"true"`。 |
| F11 | **已核实**119 行、track 参数、认证逻辑、ETH 条件；23px/46px 来自 `tracks-content.css:17,84` 的 `.track-ledger` 作用域，并非组件自带样式。 |
| F12 | **已核实主要描述**；复制/验证在 `ProofRow` 中，标准和归档状态等行并非每行都有按钮。 |
| F13 | **已核实仓库声明**35 首、两链均 ready；**未核实实时链上状态**。真实登录路径未验的记录属实。 |
| F14 | **已核实**178 行及全部目录各 8 文件；hook 将该文件计为 179 行。 |
| F15 | **已核实需修订**：`scripts/ui/tracks-*` 含子目录共 **11 文件、1074 行**；“不用重写”不能覆盖入口断言及既有失效测试。 |
| F16 | **未核实**生产数据库归属；“项目记忆”不是当前环境证明。STATUS 的 OP Sepolia 是链环境，不能据此推断数据库环境。 |
| F17 | **已核实**本地 prerender manifest 存在，含 `/`、`/artist`、`/me`、`/tracks` 等，尚无 `/lens`；**未核实未来 `/lens` 构建结果**。现有文件仅能作为历史基线。 |

行数差异依据：[check-file-size.js:104](E:/Projects/nft-music/.claude/hooks/check-file-size.js:104) 使用 `content.split('\n').length`，末尾换行会多算一行；目录规则依据：[check-folder-size.js:117](E:/Projects/nft-music/.claude/hooks/check-folder-size.js:117) 仅统计直接文件。两份文档的新子目录方向正确。

总体结论：  
P20 的背景 FBO 气泡路线成立，球坐标也可取得；必须先修正挂载、投影和 #36 透明度方案。  
P21 的首页别名路线成立，但仍需处理路由事务、交互状态和旧导航测试，工作量不能按“仅加遮罩”估算。  
两份计划应先修订阻塞项、步骤范围和基线记录，再按小闭环执行。  
静态预渲染、手机性能和最终视觉效果，本次均未冒充验证通过。