# Track D — `/artist` 艺术家文字肖像

> **目标**：以艺术家个人介绍为首屏主叙事，用排版而非照片建立人物感；108 项目作为其长期实践的第二章节。
> **硬门**：内容包未由用户批准前，不写生产页面。

---

## D0｜内容包

### 三句话概念简报

1. “文字肖像”不是没有图片的简历，而是用姓名、语气、留白和选择过的事实建立人物存在感。
2. AI 可以整理用户提供的材料，但不能发明艺术家身份、履历、理念或外部链接。
3. 108 项目属于艺术家实践的一部分，不再用虚构章节名替代真实内容。

### 内容合同

```ts
type ArtistContent = {
  displayName: string;
  identityLine: string;
  biography: string;
  statement: string;
  project108: string;
  publicLinks: Array<{ label: string; href: string }>;
};
```

### 用户需要批准的材料

- 展示名或艺名。
- 20–40 字身份句。
- 80–160 字个人简介。
- 160–320 字创作宣言。
- 100–220 字的 108 项目说明。
- 可公开使用的网站、社交账号、邮箱或钱包；没有则留空。

### 规则

- 缺失可选链接则整个区域不渲染，不写“即将上线”。
- 禁止 lorem ipsum、虚构奖项、展览、教育经历、引语和年份。
- 删除 `First Rings / Widening Water / Lasting Pond` 等未经用户批准的候选章节名。
- 36/72/108 只在用户明确认可其创作含义后出现；绝不再表达空投。

### 📦 范围

- 只读已有项目文案、README 与用户提供材料
- `reviews/` 下形成内容校对稿

### Stop D0

用户逐段批准内容后，才创建静态内容模块和生产页面。

---

## D1｜文字肖像首屏

### 构图

```text
folio：ARTIST / RIPPLE 001 / SINCE …（仅有真值才显示）

超大展示名                              身份句
                                        简介
                                        公开链接

一条长 WaterlineRule
创作宣言（编辑式两栏）
```

- 桌面 12 栏：姓名占 1–7 栏，身份与简介占 9–12 栏；不强行居中。
- 手机顺序：姓名 → 身份句 → 简介 → 宣言；正文最小 16px。
- 姓名使用 display serif；正文使用中文 body stack；技术注脚才用 mono。
- 不使用人物占位图、头像圆圈、简历时间线或统计卡片。

### 📦 范围

- `src/content/artist.ts`
- `app/artist/page.tsx`
- `app/artist/loading.tsx`
- `app/artist/artist.css`
- `src/components/artist/ArtistPortrait.tsx`
- `src/components/artist/ArtistStatement.tsx`

### 验收

- 10 秒内能回答艺术家是谁、在做什么、语气是什么。
- 内容与用户批准稿逐字一致。
- 无照片仍具有明确人物感，而不是空白页面。
- `bash scripts/verify.sh` 通过。

---

## D2｜108 项目作为第二章节

### 内容层级

1. 章节眉题 `A LONG-TERM SCORE PRACTICE`。
2. 用户批准的 108 项目说明。
3. 真实完成数 `published / 108`。
4. 项目机制：一次演奏 → 永久资源 → ScoreNFT → 可重放唱片。
5. 代表作品索引只在已有可靠数据与产品入口时出现。

### 数据

- `published`、总铸造数、参与者查询并行执行。
- 每项结果用 `Promise.allSettled` 或等价局部容错；查询失败返回 `null`，不伪装成 0。
- 进度由 `published / 108` 纯计算，不新增字段。
- 删除 `AIRDROP_INTERVAL/currentRound/nextAirdrop` 与所有空投文案。

### 视觉

- 进度表现为横向档案索引和数字，不使用 SaaS 蓝色进度条。
- 108 是作品约束，不是倒计时、销售进度或稀缺营销。
- 统计是脚注证据，不能超过艺术家宣言的视觉权重。

### 📦 范围

- `app/artist/page.tsx`
- `src/components/artist/Project108.tsx`
- `src/components/artist/ProjectFacts.tsx`
- `app/artist/artist.css`

### 验收

- 数据正常、部分失败、全部失败、0 件与 108 件均有准确呈现。
- 不出现失效空投含义和未经批准的章节叙事。
- `bash scripts/verify.sh` 通过。

---

## D3｜公开链接、机制与移动端

- 外链只渲染用户批准项，注明打开目标。
- 钱包若公开，明确写“艺术家公开地址”，不与 Score 创作者或当前持有人字段混用。
- 机制图使用 HTML 文字与 WaterlineRule，不增加图表库。
- 装饰波纹读屏隐藏，DOM 顺序与移动阅读顺序一致。
- reduced-motion 下页面不依赖 reveal 才能读取。

### Track D 完成条件

- 艺术家个人介绍是首屏主角，108 项目是第二章节。
- 内容包完整批准，无照片、假资料、假链接或占位。
- 数据错误不显示错误数字。
- 五档视口与完整验证通过；更新状态后停在 P11-E。
