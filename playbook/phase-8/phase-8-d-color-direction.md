# Phase 8-D — 色彩方向主题开关（pondThemeA – K，共 11 套）

> **定位**：overview 的 P8-S1（视觉方向）+ P8-S2（颜色体系）落地 track。**每套色彩方向 = 一个 effect 开关**（2026-06-12 用户拍板）：默认配色保持不动（全部 flag 关 = 现状星空配色分毫不动），开启任一主题即整体换皮，用户在 /test 切换对比，看到实际效果后再拍板最终方向。方向构成：调研产出 A/B/C 三套（§1）+ 头脑风暴扩展 D–K 八套（§1.5，四季 + 风格化，2026-06-12 用户要求）。
> **前置**：8-B S1 的 `--pond-*` token 已建（`:root` 兼容值）。
> **状态**：❄️ **已冻结（2026-06-12）**——D0 外部预览粗筛结果：A–K 11 套用户**全部不满意**，本 track 暂不放入工作计划。P8 期间默认配色保持现状星空配色；8-B 的 `--pond-*` token 维持 `:root` 兼容值，`.theme-pond-*` 覆盖块不实现。重启条件 = 用户重新发起色彩方向调研（不沿用 A–K，新方向先过新一轮 D0 粗筛再立项）。详见 JOURNAL 2026-06-12。
> **D0 外部预览粗筛（2026-06-12 新增，已完成）**：用 `p8-d-color-preview-prompt.md` 生成单文件 HTML 预览器，用户离线对比 11 套完整效果——结果全部淘汰。流程本身保留：0 行项目代码杀掉一个方向，未来任何配色方向先过 D0 再立项。
> **铁律**：沿用 P8 全局模块化/抽象/沙盒铁律（`overview.md`）。

---

## 1. 三套候选方向（hex 全量）

### 方向 A：墨绿深潭（Zen Ink Pond）★ 主推

莫奈《绿色倒影》× 日式苔庭。最贴"深青/墨绿"题中之义，背景明度与现状几乎相同（对比参数全套沿用），靠青橙互补保球显著性。

- 背景 `#05100e`，水面渐变 `#05100e → #0a1f1a → #0e2a24`，月光斑 `#14342c` @8%
- 球色板：`#D8A878` `#B8684A` `#C9899B` `#E8E2C8` `#7EA898` `#5C8A6A` `#2E7066` `#4A7878`（4 暖 4 冷）
- 光色：高光 `#EDE6CE` / 强 `#F6F0DC`；涟漪 `#C8D8CC`；雾 `#A8C0B4`

### 方向 B：夜塘月色（Cinestill 夜潭）

冷青蓝水面 + 钨丝暖橙球，胶片机理背书最硬（halation 红晕只出现在点光源 = 正在发声的球），离现在的"夜"最近风险最小。

- 背景 `#06141d`，渐变 `#020b15 → #06141d → #0c2733` + 垂直"月光水路" `#34606844 → transparent`
- 球色板：`#E8A85C` `#C8503C`(限2-3球) `#E8D8A8` `#D89AA8` `#3A8A8C` `#5C9C94` `#2C5878` `#9ACFD4`
- 光色：月光冷白青 `#E0F7FF`；播放球 halation 暖晕 `#FF7A50`

### 方向 C：萤光水塘（Bioluminescent）

最暗的水 + 最亮的点，可点击显著性最强但离胶片感最远；饱和度压 60-75% 防暗底振动。

- 背景 `#020d0c`，中心微亮 `#052420`、四角 vignette `#010807`
- 球色板：`#41E0C4` `#00B4A4` `#6FC8E0` `#8A86E0` `#F3D340` `#E8A85C` `#2E8A6E` `#E8F4E0`
- 光色：`#9AFFF7`；hover/播放瞬时 `#00FFE5`；暖侧 `#F8EE99`

**三套共享迁移主轴**：背景色相 240°→170°（明度不动）；白色光元素 → 月光冷白青/象牙；球保留 3-4 个暖胶片色做 teal-orange 前景层。**无论选谁，建议吸收 B 的"播放球 halation 暖晕"。**

---

## 1.5 扩展方向 D–K（2026-06-12 头脑风暴：四季 + 风格化）

> **所有扩展方向的硬前提**：背景保持暗色（顶栏白字 / 白雾 / 对比度体系都建立在暗底上）——"青春/明亮"气质靠**球色板与光色提亮**实现，不靠亮背景。真·浅色白昼水塘若未来想要，需另立 track（全站文字反色工程，不在 P8）。每套给出：背景渐变、球色板 8 色、token 5 色（对应 `.theme-pond-x` 块的 ripple/light/mist/glow/accent）。

### 四季系列

**D 春 · 樱雨嫩柳**（用户点名：青春洋溢，嫩绿 + 樱花粉）
- 气质：暮色里的春塘，樱瓣落水、柳芽初发——底色仍暗，但球群是全 11 套里最明亮娇嫩的一组。
- 背景 `#151219`（暮樱紫灰），渐变 `#100d14 → #151219 → #1d1722`
- 球色板：`#F4B8C8` 樱粉、`#E88AA8` 桃红、`#B8E6A0` 嫩绿、`#8CC878` 柳绿、`#F8E8D8` 奶油、`#D8A8E0` 藤紫、`#F0D890` 鹅黄、`#98D8C8` 薄荷
- token：ripple `#E8C8D4` / light `#FBEFF2` / mist `#C8B0C0` / glow `#F8E0E8` / accent `#F4B8C8`

**E 夏 · 夜荷浓翠**
- 气质：盛夏夜的荷塘，浓绿欲滴、荷粉点缀，蛙声般的生命力。
- 背景 `#061410`，渐变 `#04100b → #061410 → #0a2018`
- 球色板：`#4A9A68` 荷叶绿、`#66C28A` 翠、`#F2A8B8` 荷粉、`#F4F0E0` 莲白、`#2E8A8A` 鸭青、`#C8D87A` 新苇黄绿、`#C8A0B8` 藕紫、`#2E6A4A` 深松
- token：ripple `#A8D8B8` / light `#F0F8E8` / mist `#8AB89A` / glow `#D8F0C8` / accent `#F2A8B8`

**F 秋 · 枫潭暮金**
- 气质：枫叶落满水面的黄昏，整塘鎏金，最暖的一套（teal-orange 反转：水暖球更暖）。
- 背景 `#140e08`，渐变 `#0f0a05 → #140e08 → #1e1408`
- 球色板：`#E8A85C` 金橙、`#D86A3A` 柿、`#B84A32` 枫红、`#E8C878` 稻金、`#98683A` 栗、`#D8B898` 芦花、`#788858` 残荷绿、`#E8D8B8` 月米
- token：ripple `#D8C0A0` / light `#F4E4C8` / mist `#B89878` / glow `#F0D8A8` / accent `#E8A85C`

**G 冬 · 薄冰初雪**
- 气质：结薄冰的塘面落了初雪，全冷色 + 一点雪夜灯火暖——最静的一套，球显著性全靠明度阶梯。
- 背景 `#0a0e14`，渐变 `#070a10 → #0a0e14 → #101820`
- 球色板：`#C8DCE8` 冰青、`#9ABCD8` 雪蓝、`#E8F0F4` 初雪白、`#788CA8` 暮蓝灰、`#B8C8D8` 银灰、`#6A9AB8` 湖蓝、`#D8E8E8` 霜白、`#E8C8A0` 灯火暖（限 2-3 球，唯一暖色）
- token：ripple `#C8D8E0` / light `#F0F8FF` / mist `#A8B8C8` / glow `#E0F0F8` / accent `#E8C8A0`

### 风格化系列

**H 茜 · 夕塘残照**
- 气质：日落最后十分钟的水塘，茜红与暮紫在水里化开——情绪最浓、最"电影感"的一套。
- 背景 `#160d10`，渐变 `#100a0c → #160d10 → #221016`
- 球色板：`#E87A5A` 茜红、`#E8A85C` 落日金、`#C85A78` 霞粉、`#9A6AA8` 暮紫、`#5A7A98` 鸭蓝、`#E8D0B8` 云米、`#B8485A` 绛、`#D89A88` 珊瑚
- token：ripple `#D8A898` / light `#F8E0C8` / mist `#A8788A` / glow `#F0C8A8` / accent `#E87A5A`

**I 霓 · 雨夜霓虹塘**
- 气质：城市雨夜，霓虹灯倒映在水洼里——离胶片感最远但最"赛博青春"，全部饱和度压到 70% 防暗底振动。
- 背景 `#0a0a12`，渐变 `#07070e → #0a0a12 → #10101c`
- 球色板：`#E85A9A` 霓粉、`#4AC8D8` 霓青、`#8A7AE8` 霓紫、`#58E8C8` 薄荷光、`#E8E858` 霓黄（限 1-2 球）、`#6A8AE8` 雨蓝、`#D8D8E8` 灯灰白、`#B84AC8` 紫红
- token：ripple `#A8C8E0` / light `#E8F4FF` / mist `#8888A8` / glow `#C8E8F8` / accent `#E85A9A`

**J 墨 · 宣纸月色**
- 气质：水墨画的塘——灰阶浓淡为主 + 一点朱砂，最克制最高级，把"音乐小球"变成宣纸上的墨点。
- 背景 `#0e0e0d`，渐变 `#0a0a09 → #0e0e0d → #161614`
- 球色板：`#E8E4DC` 宣白、`#C8C4B8` 淡墨、`#A8A498` 中墨、`#88857C` 浓墨、`#C84A3A` 朱砂（限 2-3 球）、`#4A5A68` 黛青、`#A87848` 赭、`#686660` 焦墨
- token：ripple `#C8C4B8` / light `#F0ECE0` / mist `#98948A` / glow `#E0DCD0` / accent `#C84A3A`

**K 湖 · 热带泻湖夜泳**
- 气质：热带海岛泻湖的夜，绿松石水色 + 珊瑚橙——最度假、最鲜活的冷暖对撞。
- 背景 `#04121a`，渐变 `#030d14 → #04121a → #082230`
- 球色板：`#38C8C8` 绿松石、`#58A8E8` 泻湖蓝、`#F2A878` 珊瑚橙、`#F4D878` 沙金、`#78E0B8` 浅礁绿、`#E88A98` 珊瑚粉、`#B8E8E0` 浪花白、`#2E7A98` 深泻湖
- token：ripple `#A8E0D8` / light `#E8FCF8` / mist `#68A8A8` / glow `#C8F4E8` / accent `#F2A878`

**扩展方向的共性纪律**：球色板一律保证对暗底 ≥3:1（每套最暗的 1-2 色只配给大球）；accent 是该套唯一允许的高显色，供浮光/halation 用；任何一套的 token 都完整对应 `.theme-pond-x` 五变量，机制与 A/B/C 完全同构。

---

## 2. 模块化机制：`pondThemeA` … `pondThemeK` 共 11 个主题开关

1. **flag 五件套 × 11**：`effects-config.ts` 加 `pondThemeA`–`pondThemeK: boolean`（桌面/移动默认**全 false** = 保持现状默认配色）+ `EFFECTS_META` 11 行（label "水塘色·A 墨绿深潭"…"水塘色·K 热带泻湖"，group=主题）→ 自动获得 `?pondThemeD=1` 等与 /test 面板复选框。
2. **互斥规则**：11 个 flag 语义互斥——生效优先级按字母序 `A > B > … > K`（同开多个取优先级最高，实现处一次 find 即可，不强改面板交互）。
   > **实现备选（D1 开工前用户二选一）**：11 个互斥布尔在面板上略笨重，可改为单值机制 `?pondTheme=A..K`（EffectsConfig 存一个 `pondTheme: ''|'A'..'K'`，EffectsPanel 渲染一个下拉/radio——类似 P8-A slider 的特例扩展）。两种都满足"可手动开关、默认关 = 现状"铁律；布尔版零面板改造，单选版体验更干净。
3. **CSS 层**：`Archipelago.tsx`（或 app 层）`useEffect`——按生效方向给 `document.documentElement` 挂 `theme-pond-a` / `theme-pond-b` / `theme-pond-c`（互斥，全关时移除）。`globals.css` 加三个覆盖块（值取自 §1 三方向）：
   ```css
   .theme-pond-a { --background: #05100e; --pond-bg: #05100e; --pond-ripple: #C8D8CC;
                   --pond-light: #EDE6CE; --pond-mist: #A8C0B4; --pond-glow: #F6F0DC; --pond-accent: #F3D340; }
   .theme-pond-b { --background: #06141d; --pond-bg: #06141d; --pond-ripple: #E0F7FF;
                   --pond-light: #E0F7FF; --pond-mist: #9ACFD4; --pond-glow: #E0F7FF; --pond-accent: #FF7A50; }
   .theme-pond-c { --background: #020d0c; --pond-bg: #020d0c; --pond-ripple: #9AFFF7;
                   --pond-light: #9AFFF7; --pond-mist: #2E8A6E; --pond-glow: #00FFE5; --pond-accent: #F8EE99; }
   ```
   `body` 已用 `var(--background)`（globals.css:187），class 一挂全局背景即切换；8-B 各效果引用的 `--pond-*` 同步换值——**一个 class 完成整体换皮**。D–K 八套同模式各加一块 `.theme-pond-d` … `.theme-pond-k`（变量值见 §1.5 各套 token 行）。
4. **球色板层**：`sphere-config.ts` 加 `POND_PALETTES: Record<'A'|...|'K', string[]>`（每套 8 色，hex 见 §1 与 §1.5；预览级先三组共用 8 色循环，拍板后再按组细化）；`computeNodeAttrs` 加第三参 `pondDir: keyof typeof POND_PALETTES | null = null` 选色板（null = 现状 GROUP_PALETTES）；`SphereCanvas.tsx` 由 flag 算出 pondDir 传入并加进 simData 重建 deps（切 flag 时节点重建、布局重排——可接受，与切 group 同量级）。⚠️ 11 套 × 8 色的常量表 + 现有内容可能顶到 200 行硬线——超线就把 `POND_PALETTES` 拆成独立 `pond-palettes.ts`。
5. **可选进阶**：`@property` 注册 `--pond-*` 为 `<color>` 型（2024-07 起 Baseline），主题切换时颜色平滑过渡而非跳变。非必需，D4 体验后决定。

---

## 3. 切步

| Step | 内容 | 📦 范围 | 前置 |
|---|---|---|---|
| **D1** | 11 个主题 flag（或单选机制，开工前用户二选一）+ `.theme-pond-a` … `.theme-pond-k` CSS 覆盖块 + 互斥挂载逻辑 | `effects-config.ts`、`globals.css`、`Archipelago.tsx`、（单选版另加 `EffectsPanel.tsx`） | 8-B S1 token 已建 + 机制二选一 |
| **D2** | 球色板：`POND_PALETTES`（A–K 11 套）+ `computeNodeAttrs` 接线 | `sphere-config.ts`（超线拆 `pond-palettes.ts`）、`SphereCanvas.tsx` | D1 |
| **D3** | 光色元素清查：所有写死的白色光元素（涟漪/雾/光晕/月亮）确认已走 `--pond-*` token（8-B 完成的不重做，漏网的补） | 按清查结果 | 8-B 对应步完成 |
| **D4** | /test 体验：分别勾选 A / B / C 对比整体效果 → 用户拍板最终方向、是否吸收 B 的 halation 播放晕、何时转默认 | （体验步，无代码） | 用户参与 |

每步：verify.sh → 6 行汇报 → 等"继续"。

## 4. 停下条款

- 想动 `/me` `/score` `/artist` 内容区配色 → 停（P11 范围）
- 想改 Tailwind 主题结构 / 字体 → 停
- 球色板对比度 <3:1（可点击性红线）→ 停，调亮再继续
- 方向未拍板时不进 D4 的默认值切换

## 5. 完结标准

- [ ] 全部主题开关关闭 = 与现状默认配色像素级一致（用户拍板：默认保持现配色）
- [ ] A–K 共 11 套，每套单独开启都呈现完整方向配色（背景/球/光色/雾全部切换）；同开多个时按 A>…>K 优先无报错
- [ ] /test 面板可随时切换任一套对比，无需刷新
- [ ] 36 球在全部 11 套配色下对比度均 ≥3:1，可点击性不降
- [ ] 用户看过实际效果后拍板：最终方向 + 是否吸收 B 的 halation 播放晕 + 是否/何时转默认
- [ ] verify.sh 全绿 + STATUS/JOURNAL 同步

## 6. 参考

- 三方向完整论证与色彩调研来源：`p8-s1-visual-research.md` §一
- token 兼容值与归属：`phase-8-b-effects-migration.md` §1
- `@property` 可行性：`phase-8-c-opensource-integration.md` 附录
