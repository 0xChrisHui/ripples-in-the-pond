# 池塘交互与转场统一执行计划

> 执行：采用 Superpowers 的计划和并行分工方法；用户已批准聊天中的六项方案并要求直接开始。按当前 AGENTS 最小充分执行，不逐步骤等待、不机械生成多份报告。

**目标**：在现有 3121 本地版本完成六项反馈，保留正常音乐圆的交互基准，交付一份可打开的整合结果。
**设计依据**：本轮聊天确认的六项方案；#36 最终更正为正常态正圆、较大尺寸、可感知主动漂移，其余交互（含拖拽）与普通圆一致；不额外设计强调反馈。
**架构**：复用持久 Water Core、现有转场事务和真实音频/领取客户端。基础圆和日食视觉共用实现，页面仅提供位置、播放与 hover；保留首页 P9，曲目页不接入按键编舞。
**技术栈**：现有 Next/React/Three/SVG/CSS/Privy/viem；无新依赖。

## 范围与负责人

- [x] A（总控）：`pond-shell/`、`features/home-pond/`、相关页面路由。统一前景及 GL 场景显隐、首帧准备、返回/快速反向、滚动交接；所有水面保留 pointer ripple，阅读底板与控件排除。五类池塘页面全部 20 个双向关系，以及原曲/Echo 作品入口、历史路由和弹窗边界统一处理。
- [x] B（圆圈线）：`music-catalog/listening/circle/`、`pond-gl-test3/overlay/GlEclipse.tsx` 与必要共享基础视觉。曲目普通圆沿用首页参数和 hover，日食共用基础盘/白环/光晕，保留随机位移与换曲连续性；读取总控共享 scene presence。
- [x] C（#36 线）：`pond-gl-test3/echo-resident/`、`types/echo-resident.ts`、既有 `scripts/p14-h/`。正圆；沿用普通 hover 放大/光晕、点击/键盘与拖动阈值，拖动结束不误播放；位移使用真实可见经过时间且恢复无跳跃，保留边界/隐现保护/真实 Echo 引擎。
- [x] D（领取与版式线）：`MaterialMintPanel.tsx`、`EthereumMaterialMint.tsx`、`MaterialProvenance.tsx`、`TrackCatalog.tsx`、`app/tracks/` 内容样式。OP/ETH 同屏独立状态；下半页采用一致正文宽度的纵向排列，下一首在末尾，长地址可读可复制。
- [ ] 总控整合：阅读各线 diff，做一次定向类型/lint/相关逻辑测试；集中浏览器验收真实绘制、导航/返回、指针水波、圆圈hover/拖拽、双入口和手机布局。涉及路由搬移才集中构建一次。证据续写 `reviews/evidence/tracks-redesign/handoff.md`，中文提交。

## 共享约定

- 总控独占 `pond-shell/`、`features/home-pond/`、页面路由、JOURNAL/handoff/计划；各线不改共享文件、不自行开服务/浏览器/全量检查/提交。
- 总控提供 `src/components/pond-shell/motion/scene-presence.ts` 的 `getScenePresence(owner: PondRoute): number`，返回 0–1 的实际前景显隐进度；所有 GL 前景须消费，不因场景注册而突然全亮。
- B 线输出独立基础日食组件，#36 沿用首页 GlEclipse，不另建日食。若增加共享 hover 状态，只经总控对接，C 不编辑 focus/overlay 文件。
- 领取入口只重排客户端，不改变发行政策、订单身份隔离、重复提交保护、合约/数据库或真实资金操作。
- 单代码文件 ≤200 行、目录 ≤8 文件；旧文档中的更宽上限与逐步骤全量 Gate 不执行。
- 原工作区 77 项用户 WIP 保留；沿用 `nft-music-progress-release`；本轮本地实现，不自动 push/部署。

## 验收重点

1. 转场中新旧场景透明度连续，同一 Water Core/Canvas 不重建；快速反向按当前状态继续，隐藏前景不能接管点击。
2. #36 按下/拖拽/cancel/播放互斥，不引入双音源或重复请求；移动和点击区域一致。
3. 换曲和离开返回保留圆圈位置/颜色/随机轨迹；曲目首帧不晚于页面出现。
4. OP/ETH 状态分别归属当前身份与曲目，未知结果不自动重发；不为 UI 验证实际铸造。
5. 指针在裸露水面产生涟漪，阅读底板/控件不穿透；移动端正常滚动，减少动态偏好得到尊重。

## 收尾状态

四条实现线已完成，源码类型、受影响ESLint和相关逻辑测试通过。整合浏览器Gate未完成：匿名Me确认唯一顶栏和共享水面后，进入首页检查超时；软件GPU、首次编译与扩展异常使本轮无法可靠确认动画。完整生产构建的编译/类型阶段通过，后续旧路由缓存阻断；不把这两项报通过，交付保留本地实现与现有证据。

核心导航关系（共20个方向）：`/`分别到`/tracks /me /artist /score/*`；`/tracks`分别到`/ /me /artist /score/*`；`/me`分别到`/ /tracks /artist /score/*`；`/artist`分别到`/ /tracks /me /score/*`；`/score/*`分别到`/ /tracks /me /artist`。相关Echo、单曲和历史恢复地址复用同一事务，不另建水面。
