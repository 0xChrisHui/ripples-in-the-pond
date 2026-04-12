# LEARNING — 概念词典

> 这是你的"大脑外挂"。AI 自动维护，你只需要在空闲时间瞄一眼。
>
> **使用方式**：
> - AI 在写代码过程中，每遇到一个新概念，自动追加 1 条到本文件
> - 你在厕所、早餐、睡前花 5 分钟翻一翻
> - 同一个概念你看到第 2、5、10 次时，理解会逐步加深
> - 遇到忘记的词，Ctrl+F 直接搜
>
> **格式**：每条 3 行
> 1. **是什么**：1 句话定义
> 2. **类比**：日常生活的比喻（比定义更容易记）
> 3. **第一次出现**：在哪个 step / 文件第一次见到

---

## 🎯 小白成长曲线

每过一段时间回到这里看一眼，你会惊讶于自己已经记住的东西。

- **Phase 0 阶段目标**：理解"前端 → API → 数据库 → 链上"这条主路是什么意思
- **Phase 1 阶段目标**：能看懂一个普通的 React 组件 + API Route
- **Phase 2 阶段目标**：能看懂状态管理 + 异步流程
- **Phase 3 阶段目标**：能独立 review AI 写的简单功能

---

## 📚 词典正文

> 按首次出现的时间顺序追加。同名概念多次出现时，更新原条目而非新增。

---

### Tailwind CSS
- **是什么**：一个 CSS 工具库，让你用类名（如 `text-white bg-black`）直接写样式，不需要自己写 CSS 文件。v4 版本会自动扫描项目文件找出你用了哪些类名。
- **类比**：像一本巨大的样式菜单，你只说菜名（类名），它帮你做出来。但 v4 的"自动扫描"功能像一个太勤快的实习生，会翻遍办公室所有文件夹。
- **第一次出现**：`app/globals.css`（`@import "tailwindcss"`），Phase 0 初始化

---

### Web Audio API
- **是什么**：浏览器内置的音频引擎，可以低延迟地播放、叠加、变调多个音源。核心对象是 `AudioContext`。
- **类比**：一个小型录音棚——`AudioContext` 是调音台，`BufferSource` 是播放器，`GainNode` 是音量旋钮，全部用线（`connect`）连起来最后接到音箱（`destination`）。
- **第一次出现**：`src/spike/useJamAudio.ts`，Phase 2 Step 0

---

### AudioContext 的用户手势要求
- **是什么**：浏览器安全策略要求 AudioContext 必须在用户点击/按键后才能启动（`resume`），不能页面一加载就自动播放声音。
- **类比**：像餐厅里不能自己去厨房拿菜，必须先举手叫服务员（用户手势），服务员才会帮你上菜（播放音频）。
- **第一次出现**：`src/spike/useJamAudio.ts:29`（`getContext` 里的 `resume`），Phase 2 Step 0

---

### useCallback + 闭包陷阱
- **是什么**：React 的 `useCallback` 会缓存函数，但函数内部引用的变量可能是创建时的旧值（闭包）。如果依赖项写错，回调里拿到的是过期数据。
- **类比**：你拍了一张照片（闭包），照片里的东西是拍照那一刻的样子。即使现实已经变了，照片不会自动更新。用 `useRef` 可以绕过这个问题，因为 ref 像一个"实时监控画面"而不是照片。
- **第一次出现**：`src/spike/useJamAudio.ts:46`（`playKick` 改用 `ctxRef.current` 避免闭包问题），Phase 2 Step 0

---

### 异步操作加锁（防抖）
- **是什么**：异步函数（如 fetch）执行期间，用户可能再次触发同一操作。用一个布尔 flag（锁）防止重复执行。
- **类比**：电梯门正在关的时候，按钮会暂时失效，防止门反复开关。
- **第一次出现**：`src/spike/useJamAudio.ts:76`（`bgLoadingRef` 防止快速点击叠加背景音乐），Phase 2 Step 0

---

### 状态机（state machine）
- **是什么**：先定义一个功能会经历哪些状态，以及状态之间允许怎么切换，比如 `idle → loading → success / error`，避免流程半路卡在假成功或脏状态。
- **类比**：像机场值机，乘客不能从“还没安检”直接跳到“已经登机”；每一步都要按顺序通过。
- **第一次出现**：`reviews/2026-04-10-phase-2-cto.md`，Phase 2 CTO review

---

### 动态路由（Dynamic Route）
- **是什么**：Next.js 用方括号命名文件夹（如 `[tokenId]`），表示这个路径段是一个变量。访问 `/score/2` 时，`tokenId` 自动变成 `2`，一个文件就能服务所有 ScoreNFT。
- **类比**：像酒店房间号，走廊只有一个设计（页面文件），但每间房的号码（tokenId）不同，内容也不同。
- **第一次出现**：`app/score/[tokenId]/page.tsx`，Phase 3 S6

---

### OG 分享卡（OpenGraph Image）
- **是什么**：当你在微信/Twitter 分享一个链接时，平台会读取页面的 `og:image` 标签，自动生成一张预览卡片。Next.js 的 `opengraph-image.tsx` 可以在服务端用 JSX "画"出这张图。
- **类比**：像书的封面——你把书推荐给朋友时，朋友先看到封面决定要不要翻开。OG 卡片就是链接的"封面"。
- **第一次出现**：`app/score/[tokenId]/opengraph-image.tsx`，Phase 3 S6

---

### iframe 嵌入
- **是什么**：`<iframe>` 是一个"页面中的页面"，可以加载另一个网址的内容。ScorePlayer 用 iframe 加载 Arweave 上的 Decoder HTML，让播放器代码和主站完全隔离。
- **类比**：像在电视里看另一个频道的节目——电视机（主页面）提供框架，节目内容（decoder）来自别处。
- **第一次出现**：`app/score/[tokenId]/ScorePlayer.tsx`，Phase 3 S6

---

## 🗓 历史归档

每个月末，AI 会把超过 30 天的条目归档到本文件末尾。
归档区先是空的。
