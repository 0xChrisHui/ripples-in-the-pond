# Track C — `/me` 私人音乐档案

> **目标**：把后台式卡片列表重组为可扫描的私人档案；顺序固定为“我的唱片 → 我的录音 → 我的素材”。
> **前置**：Track B 原生 Score 页面已通过，`ArchiveRow` 已在真实唱片页验证。

---

## C0｜行为与数据盘点

### 三句话概念简报

1. 档案页的第一任务是回答“我的作品在哪里、现在是什么状态”，不是展示尽可能多的卡片。
2. 唱片、录音和素材来自不同数据源，可以共享视觉索引，但不能伪装成同一种对象。
3. 先守住旧入口和真实状态，再改变布局。

### 📦 范围

- 只读 `app/me/`、`src/components/me/`、相关 hooks 与 data source
- `reviews/` 下新增 `/me` 行为与状态映射

### 盘点清单

- 每个现有按钮、播放、铸造、外链和错误出口。
- localStorage 草稿、服务端录音、MaterialNFT、ScoreNFT 的真实来源。
- 认证 `ready/authenticated/authSource` 的所有组合。
- 七个 `ScoreMintStatus` 与当前卡片文案。
- 部分请求失败时哪些分区可以继续显示。

### 验收

- 旧功能全部有新位置；没有因为卡片退役而丢入口。
- 数据含义与页面名称一一对应，无 mock。
- 本步无产品代码改动。

---

## C1｜档案骨架

### 页面顺序

1. `FolioHeader`：返回池塘、`PERSONAL ARCHIVE`、登录身份摘要。
2. 档案标题与一句说明。
3. 三类真实数量的窄行摘要，不使用统计卡片。
4. 我的唱片：已完成及制作中的 ScoreNFT。
5. 我的录音：已保存、可试听或可进入既有制作流程的演奏。
6. 我的素材：用户拥有的 MaterialNFT。

### 📦 范围

- `app/me/page.tsx`
- `app/me/loading.tsx`
- `src/components/me/archive/ArchiveHeader.tsx`
- `src/components/me/archive/ArchiveSection.tsx`
- `src/components/me/archive/ArchiveEmpty.tsx`
- `src/components/me/archive/archive.css`

### 视觉合同

- 每条记录像唱片目录条目：编号 / 标题 / 日期 / 状态 / 唯一主动作。
- 桌面可用 12 栏对齐字段，但 DOM 阅读顺序保持线性。
- 手机为单列；标题和状态优先，地址与技术信息不进入索引主行。
- 分区用 WaterlineRule 和留白，不使用三层容器或缩略图卡片墙。

### 验收

- 首屏能回答用户有几张唱片、最近一张处于什么状态。
- 0、1、20+ 条记录都保持可扫描。
- 375px 无横向滚动，所有动作可触控。
- `bash scripts/verify.sh` 通过。

---

## C2｜唱片状态与条目迁移

### 唱片状态

| 后端状态 | 档案标签 | 主动作 |
|---|---|---|
| `pending` | 等待制作 | 查看进度 |
| `uploading_events` | 保存演奏中 | 查看进度 |
| `minting_onchain` | 写入链上 | 查看进度 |
| `uploading_metadata` | 装配唱片 | 查看进度 |
| `setting_uri` | 绑定永久播放器 | 查看进度 |
| `success` | 永久唱片 | 打开 `/score/<tokenId>` |
| `failed` | 制作未完成 | 查看既有恢复入口 |

- 状态必须直接映射 `ScoreMintStatus`，不新增数据库枚举。
- 已完成条目只用 Token 路由；处理中条目继续用 UUID。
- 失败不可只靠红色；状态文字和动作始终可见。

### 录音与素材

- 录音试听继续复用全局 `PlayerProvider`，不创建第二个 audio。
- 已保存录音保留现有铸造/入队能力。
- MaterialNFT 保留真实名称、Token、铸造时间和既有外链，不补假封面。

### 📦 范围

- 新增 `src/components/me/archive/ScoreArchiveRow.tsx`
- 新增 `src/components/me/archive/RecordingArchiveRow.tsx`
- 现有 Score/Draft/NFT card 与 section 文件（逐个替换后删除）

> `archive/` 单层最多 8 个文件；若超过，按 `score/recording/material` 拆子目录，不把根目录继续塞满。

### 验收

- 每个旧卡操作都能在新条目完成。
- 唱片、录音、素材的图标和动作不会互相冒充。
- 播放录音时 BottomPlayer 不遮挡最后一条记录。
- `bash scripts/verify.sh` 通过。

---

## C3｜认证与局部故障

### 状态

- `ready=false`：稳定档案骨架与“正在确认身份”，禁止 `return null`。
- 未登录：说明登录用于找回音乐档案，调用既有 LoginModal。
- 空档案：按分区说明获得第一件内容的真实路径。
- 局部失败：成功分区继续可用；错误只占本分区。
- 登录恢复：缓存可以先显示，但必须标明正在刷新，不瞬间误报空档案。

### 📦 范围

- `app/me/page.tsx`
- `app/me/loading.tsx`
- `src/components/me/EmptyState.tsx`（迁移完成后删除或收束）

### Track C 完成条件

- 三类档案和七种 Score 状态准确。
- 未登录、认证中、空、局部错误与缓存刷新都有反馈。
- 不改变认证协议、上传、铸造和数据 schema。
- 五档视口与完整验证通过；更新状态后停在 P11-D。
