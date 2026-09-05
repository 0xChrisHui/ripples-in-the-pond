# Track A — Score 作品水塘样板与设计基础

> **目标**：用真实 Token #1 先证明“静态唱片 ↔ 播放日食”的 375/1440 体验，再从真实样板提炼 tokens 与原语。
> **禁止倒序**：样板未通过用户目验前，不建立公共组件、不修改生产 `/score`。

---

## A0｜真实证据包 ✅

### 已完成

- Token #1 的链上 `tokenURI`、Arweave metadata、永久 Decoder 与真实 Track 33 已核验。
- 35 条永久 Events、events/base/sounds 引用、合约、mint tx、setURI tx 与当前公开页已有证据。
- 证据保存在 `reviews/evidence/p11-score-prototype/`；缺失字段不造值。

### 永久规则

- 样板与生产均只读取 Token #1 的真实公开值。
- 敏感环境变量、RPC key 和数据库密钥不得进入浏览器证据。
- NFT cover 只来自永久 metadata，不生成替代封面。

---

## A1｜高保真 Score 水塘样板

### A1.1 同源单球证明 ✅

`/score-lab/1` 已直接复用生产 `pond-gl-test3`，完成以下基线：

- 一棵 R3F Canvas、一层现有花瓣 Canvas、一个真实 Track 33 节点。
- 点击可播放真实底曲并进入首页同款日食。
- P9 G5 只接真实 `V×6` 与现有“白色静浪”；其余 29 条 Events 未提前扩展。
- 375/1440、reduced-motion、Canvas 不重挂与 0 console error 已有自动证据。

该基线证明引擎复用可行，但“idle 仍显示球体”已经被新交互合同取代。

### A1.2 唱片 ↔ 日食状态样板（当前下一步）

### 📦 范围

- `app/score-lab/1/` 内现有 5 个沙盒文件
- `reviews/evidence/p11-score-single-sphere/`

不修改生产 `app/score/[id]/`、`docs/ARCHITECTURE.md`、P9 注册表或永久 Decoder。

### 状态合同

```text
idle ──点击唱片/开始──> loading ──可播──> playing
 ↑                         │                  │
 ├──── error / retry ──────┘                  ├── pause ──> paused
 └──────────── replay <──────── ended <───────┘
```

| 状态 | 中央锚点 | 水塘 | 主动作 |
|---|---|---|---|
| `idle` | 静态唱片，无球体 | 花瓣、微光、基础水波 | 开始播放 |
| `loading` | 唱片 + 细进度环 | 保持稳定，不伪装播放 | 正在准备 |
| `playing` | 唱片约 450ms 淡出为日食 | 永久 Events 驱动声音与 P9 | 暂停 |
| `paused` | 回到唱片，保留进度标记 | 环境回到静息 | 继续播放 |
| `ended` | 回到唱片 | 环境完成余韵并复位 | 再次播放 |
| `error` | 唱片仍在 | 不销毁页面身份 | 重试 / 永久播放器 |

- 唱片、日食和播放按钮代表同一件作品，不允许同时堆成两个主角。
- 转场不重挂 PondGL Canvas，不从零重启整个场景。
- 错误或无 WebGL 时仍显示真实唱片、标题、分享与永久播放器出口。

### 375px 合同：可播放的作品封面

```text
返回池塘      TOKEN #001      分享

              静态唱片
              开始播放
          标题 / 播放状态 / 进度

                ↓
          作品注脚与永久凭证
```

- 手机与粗指针设备不显示球体，也不注册 hover、鼠标跟随、视差、持续触摸追踪或额外指针粒子。
- 点击唱片或 ≥44px 的明确按钮开始；播放后只观看水波、花瓣、日食和声音驱动 P9 演出。
- 不把“触摸拖水面”设计成隐藏能力；页面滚动优先，单指滑动不拦截阅读。
- 首屏分享始终可见；完整哈希放在同页下方，不塞满 375px Hero。
- 正文 ≥16px，页面边距 20px，无横向滚动。

### 1440px 合同：可探索的单件作品水塘

- Hero 全视口或接近全视口；唱片偏离绝对几何中心，给标题、状态和分享留下呼吸空间。
- 仅当 `(hover: hover) and (pointer: fine)` 成立时，保留首页同源的水面跟随、轻视差、悬停和鼠标扰动。
- 指针反馈不得遮住唱片、分享、返回与播放控制；进入凭证阅读区后降低环境扰动。
- 不增加第二颗装饰球、独立光环、玻璃卡片或新的全屏粒子层。

### P9 Gate

- A1.2 继续只使用已实现的 `V×6` 代表家族，验证状态切换不会破坏现有包络、容量与恢复。
- 完成 G6：单次、同键压力、暂停/恢复、最长余韵与路由往返；任一失败只修代表家族。
- 用户看过单击与压力证据并明确批准后，A1.3 才按 G7 接入其余永久 Events。

### Stop A1

用户只需判断：

1. 未播放时是否像一件安静、真实的唱片，而不是隐藏的小球；
2. 点击后转为日食是否自然，作品身份有没有丢失；
3. 手机是否足够直接，桌面鼠标互动是否“活而不乱”；
4. 分享是否足够显眼，向下阅读凭证是否稳定。

未通过时只改沙盒；不进入生产、tokens 或架构同步。

---

## A2｜作品水塘设计令牌

### 📦 范围

- `src/styles/p11-tokens.css`
- `app/globals.css`（只增加 import 与必要的字体作用域）

现有 `--pond-*` 继续服务水体、P8 与 P9；P11 只增加语义 UI token，不覆盖运行时机位、Shader 或效果参数。

### 色彩方向

| Token | 候选值 | 用途 |
|---|---|---|
| `--p11-ink` | `#070706` | 页面与降级背景 |
| `--p11-surface` | `rgba(12,11,9,.90)` | 凭证高不透明阅读表面 |
| `--p11-bone` | `#E3DCCF` | 标题、主要文字 |
| `--p11-muted` | `#AAA397` | 正文与注脚 |
| `--p11-brass` | `#C3A15F` | 播放、分享、焦点和 Token 印记 |
| `--p11-brass-strong` | `#D8B870` | hover / active |
| `--p11-moss` | `#8E9B83` | 外链与低优先信息 |
| `--p11-line` | `rgba(227,220,207,.18)` | hairline |

- 淡蓝不再是按钮、当前音符和哈希链接的通用强调色。
- 水体可继续呈现真实冷色高光；UI 色与水色分工，避免整页“幽幽发蓝”。
- 每个交互和状态同时有文字/形状，不只靠颜色；候选值进入生产前做 WCAG 实测。

### 字体、空间与阅读

- Display：现有 Cormorant + 中文衬线回退；只用于作品名与艺术家姓名。
- Body：现有 Geist + 中文无衬线回退；Mono 只用于地址、tx 与永久引用。
- 8px 基准空间阶：2、4、8、12、16、24、32、48、64、96、128px。
- 手机 4 栏 / 12px gutter；平板 8 栏 / 20px；桌面 12 栏 / 24px。
- Hero 宽度随视口，账本阅读宽度 ≤68ch；凭证表面不用大圆角玻璃卡片。

### Motion 与 capability tokens

- `--p11-fast: 160ms`、`--p11-anchor-shift: 450ms`、`--p11-reveal: 520ms`。
- 转场使用平滑 ease-out，无 bounce、overshoot 或滚动劫持。
- 桌面互动必须同时满足 hover + fine pointer；断点只负责排版，不负责假定设备。
- reduced-motion 取消空间位移与旋转，保留短透明度切换、文字状态和进度。

### 暗色单主题例外

- `color-scheme: dark`；本期不添加亮色主题。
- 这是项目已批准的作品条件，不是忽略 design-token 规范：强制配色、高对比度与浏览器默认可访问性仍需验证。

---

## A3｜只提炼已验证原语

### 📦 范围

- `src/components/p11/ScorePondHeader.tsx`
- `src/components/p11/RecordAnchor.tsx`
- `src/components/p11/EditionStamp.tsx`
- `src/components/p11/ProvenanceLedger.tsx`
- `src/components/p11/ArchiveRow.tsx`
- `src/styles/p11-primitives.css`

### 组件职责

- `ScorePondHeader`：返回、网络/Token 摘要与首屏分享，不拦截桌面水面互动。
- `RecordAnchor`：唱片、日食切换、状态文字和主播放动作；不自行创建 AudioContext。
- `EditionStamp`：`finalized / processing / degraded / failed`，每态均有文字。
- `ProvenanceLedger`：短显示、完整复制、外链、来源与缺失策略。
- `ArchiveRow`：编号、标题、状态、日期与唯一主动作；供 `/me` 和 `/artist` 复用。

### 禁止

- 不新增万能 `PageShell`、`Card`、`Button`、`Stack`。
- 原语不读取钱包、数据库、P9、播放器或路由业务状态。
- 不把 PondGL 封装进通用 UI 原语，也不为只出现一次的构图强行抽组件。

### Track A 完成条件

- Token #1 唱片 ↔ 日食样板通过 375/1440 与 capability 目验。
- P9 代表家族通过 G6，扩展其他永久 Events 前取得 G7 明确批准。
- tokens 与五个原语能追溯到样板的真实使用位置。
- `bash scripts/verify.sh` 通过；更新状态后停在“架构同步门”。
