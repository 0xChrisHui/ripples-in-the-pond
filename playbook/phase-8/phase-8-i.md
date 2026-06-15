# P8-I — I 线 · 去 SVG + 全新组件设计（开放）

> **属 Phase-8-G 伞下**。**红线 / 架构蓝图 / 编号系统 / 执行模式 / 弃用记录**见总文档 [`phase-8-g.md`](./phase-8-g.md)。H 线（水面子系统）见 [`phase-8-h.md`](./phase-8-h.md)。
> **commit scope**：`feat(p8-g): I1 …`（`p8-g` 当 GL 总伞）；结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

## 总则

不追平 SVG。/test1 卸掉旧 SVG、按新场景（俯视水塘）从零设计组件。
- **红线**：只在 /test1 卸载，**不删共享 SVG 代码**，`/` 与 `/test` 零变化。
- **顺序**：I1 可从 H 核心（H1–H3）稳定后启动，**与 H4–H6 解耦可并行**（不必等 H 全完）。
- **开放性**：I3 新组件是开放无尽的，靠"收口线"圈定本期范围（见文末）。

---

## Steps（每步一闭环，⏸ 末尾必停等浏览器验收）

### I1 — 去 SVG：/test1 卸 SVG 球系统 → 干净 GL 页 + GL nav　✅ 已完成（commit `7469ae4`）

> **实现实况**：`page.tsx` 重写为干净 GL 页——卸载 Archipelago（连 SphereCanvas 的 d3 sim + AmbientLayers）→ 真停后台 SVG sim（取代 G4-P0 的 display:none 止血）；移除 SvgAnimationLayer + BackgroundRipples + 旧隐藏 style；清掉死掉的 effects/fx/perspective 克隆首页 plumbing；ScenePanel 删背景氛围段（renderer 随 SVG 卸载，GL 重做留 I3）。新建 `overlay/GlNav.tsx`（左上 A/B/C，`glSim.setGroup` 直接切 GL 组 → 修 G4"nav 点击 GL 不跟随"）。红线守住：不删共享 SVG 代码，`/` 与 `/test` 零变化。

- 📦 范围：`app/test1/page.tsx` 重写（"克隆首页+GL叠加" → "干净 GL 页"）；`overlay/` 新建 GL nav 切组组件。
- **与 P0 的关系**：G4 的 P0 止血（`744b64d`）= scoped `<style>` **隐** SVG DOM、d3 sim 仍后台空跑（视觉级临时切换）；**I1 = 真正卸载** Archipelago、停 sim（架构级，两套 sim → 单一 GL sim）。两步相辅，I1 才消除 P0 遗留的后台 CPU。
- 做什么：/test1 不再挂 `Archipelago`/SVG 球系统（**卸载，非 display:none**，d3 sim 停跑）；取数已由 `use-gl-sim` 独立；切组从 Archipelago 的 nav tab 改成 **GL 自己的小 nav（A/B/C）**；旧 SVG 氛围层（星/雾/极光/彗星）按需在 I3 重设计或弃。
- 红线：**不删共享 SVG 代码**（`Archipelago`/`SphereCanvas` 仍服务 `/` 与 `/test`）；只改 /test1 这一页。
- 验收（⏸）：DevTools 确认 /test1 无 SVG 球 DOM、SVG sim 不跑；GL nav 切组正常（A=15 / B,C=36）；帧率 = GL 单跑真值。

### I2 — 日蚀 GL 重做　✅ 已完成（commit `add5a2f`）

> **实现实况**：用户确认要的播放聚焦 = 其他球**完全隐去**（SphereInstances dim→0 + SphereOverlay 标题 opacity 0/不可点，沿用首页"播放聚焦"老行为，不是 bug）+ 播放球叠**日蚀焦点**。新建 `overlay/GlEclipse.tsx` 移植共享 SVG `EclipseLayer` 视觉（日冕 halo + 黑盘[=球半径 scale=radius/50] + 白环 + 暗 pause 条），DOM/SVG overlay（z-20，不被水面折射、与命中层同坐标）跟随播放球、0.45s 淡入、pointer-events-none（点击穿透到命中层暂停）。红线：不碰共享 SVG `EclipseLayer`，`/` 首页原样。
> **过程教训**：用户只提问+表达不满那轮，Claude 擅自软化 dim（违"无指令不行动"+方向猜反），已记 memory 强化。

- 📦 范围：GL 版日蚀/播放聚焦（`spheres/` 或 `water/`）。
- 做什么：**全新设计 GL 日蚀**（对标旧 SVG `EclipseLayer` 意境，不强求 1:1），与 **H5 的"播放聚焦 / 球浮出"叙事合流**；可与水面月光 specular 共用资源。播放时其他对象按规则反应（已有 dim + 浮沉）。
- 验收（⏸）：播放聚焦感到位、无错位（同一 GL 坐标天然对齐）。

### I3 — 新组件·首批（开放，跟用户想法）　⏸ 暂缓（2026-06-15 用户未想好首批组件，先收口；待用户定方向再起）

- 📦 范围：按用户想法逐个新组件（鱼 / 贴图组件 / 新动效…），各挂 **H5 运动框架**（声明 层/层带 + 运动公式，水上/水下视觉自动；公式签名契约见 [`phase-8-h.md`](./phase-8-h.md) H5）。
- 做什么：首批做哪几个、各自行为，由用户逐个定；每个一闭环、控制台加开关。
- 验收（⏸ 逐个）：组件随水位正确浮沉/扭曲；交互/性能正常。

---

## 收口线（并入 I 线）

- **H1–H6 ✅ + I1 ✅ + I2 ✅ + 用户【首批】新组件(I3) ✅ = Phase-8-G 收官。**
- 之后的新组件 = "持续优化"**另开清单**，不卡在本阶段。
- `/test1` = 持续优化的开发面；**搬上首页 = 更远将来**（另立 track：全量迁移 + 移动端 + 替换 + 删旧透视代码），**不在本期**。原 G7 去留拍板**取消**。
