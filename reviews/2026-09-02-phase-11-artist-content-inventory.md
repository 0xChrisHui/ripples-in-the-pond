# P11-D0 `/artist` 艺术家内容取证

> 取证日期：2026-09-02
> 范围：`app/artist/`、README、docs、reviews、playbook 与相关 reference。
> 结论口径：文件里“出现过”不等于艺术家本人确认，也不等于用户批准公开发布。

## D1–D3 完成更新（当前权威）

用户随后明确授权先使用安全草拟内容进入生产页面、以后再用艺术家正式稿替换。D1–D3 已完成：

- `src/content/artist.ts` 集中保存草稿，并在页面显式标记“文字草稿 · 待艺术家确认”；没有补写奖项、履历、年份、链接或具体身份事实。
- `publicLinks` 保持空数组，链接区域不渲染；36/72、空投和未经批准的候选章节名均未进入新 UI。
- `/artist` 已改为移动优先的“日式留白 × 实体档案”文字肖像，108 是第二章节，项目机制使用 HTML 文字呈现。
- `published` 只统计 `published=true`；已发布数、总铸造数、参与者并行并字段级局部容错，任一字段查询失败只让该字段为 `null` / “—”，成功且真实为零才显示 `0`，不会拖垮其余统计。
- 主任务已同步清理 `GET /api/artist/stats` 的旧空投字段；公开页面和公开统计 API 均不再输出当前产品的空投承诺。
- Artist 目标 TypeScript 与 ESLint 验证通过，文件 `≤220`、目录 `≤8`。
- 最终 `scripts/verify.sh` 全绿（production build 34/34、Forge 42/42）；Artist 375/768/1024/1440 四视口通过，无横向溢出，文字肖像、108、草稿标识与真实统计均可读，页面不挂 BottomPlayer，最终矩阵 console 0。

正式展示名、身份句、简介、第一人称宣言、108 说明与公开链接仍应由艺术家最终确认并替换，但这已是内容校对事项，不再阻塞 D1–D3 代码完成。下文保留原 D0 取证，继续作为正式稿替换时的事实边界。

## 原始 D0 门禁结论（历史快照）

当前内容包不足，不能进入 D1 生产页面。

仓库能证明的是项目名、108 的长期目标、用户可参与演奏与永久保存等项目级事实；不能证明艺术家的公开展示名、身份句、个人简介、第一人称创作宣言或任何艺术家个人外链已经获得用户逐段批准。现有 `/artist` 也不是艺术家介绍，而是统计仪表盘，并公开展示了已经失效的空投承诺。

唯一安全动作是停在 D0，请用户补充并批准最小内容包。不得从音频文件名、Git 身份、钱包、域名、Score 创作者或当前持有人反推艺术家身份。

## 1. `ArtistContent` 逐字段证据

| 字段 | 仓库中找到的候选 | 来源 | 能否证明用户已批准 | D0 判定 |
|---|---|---|---|---|
| `displayName` | 没有明确展示名；生产页只显示产品名 `Ripples in the Pond` | `app/artist/page.tsx:54`、README 标题 | 否；产品名不是人名或艺名 | **缺失，必填** |
| `identityLine` | “艺术家 · 项目进度” | `app/artist/page.tsx:56` | 否；这是页面类别标签，不是 20–40 字身份句 | **缺失，必填** |
| `biography` | 无个人经历、工作方式或人物简介 | 全仓文本搜索 | 否 | **缺失，必填** |
| `statement` | 无第一人称或经艺术家确认的创作宣言 | 全仓文本搜索 | 否 | **缺失，必填** |
| `project108` | “一位艺术家用两年时间，将 108 首音乐逐周刻进区块链。每位用户可与艺术家合奏，并将生成的音乐永久存储进自己的钱包。” | `README.md:3-4`、`docs/ARCHITECTURE.md:15` | 只能证明它自项目地基期就是产品定位；Git 历史没有“D0 逐段批准”证据，且长度不足 100–220 字 | **可作为用户校对种子，不可直接视为批准稿** |
| `publicLinks` | 没有被标注为“艺术家公开链接”的网站、社交账号、邮箱或钱包 | 全仓文本与现有页面 | 否 | **可为空，但需用户明确选择** |

### 不可自动采用的身份候选

- `references/audio/track-36-logic/Audio Files/柳芳艺术工作室 4.wav` 的文件名包含一个可能的人名/工作室名，但文件名只能证明素材曾这样命名，不能证明这是当前艺术家的展示名，也不能证明可以公开。
- 同一 Logic 工程名“第36个 当所有的碎片都在最后组合在了一起”可能是工作标题或项目内部命名，不能自动改写成 108 项目宣言、章节名或代表作标题。
- Git remote / commit author 的账号与邮箱是代码仓库运维身份，不是艺术家身份授权；不得显示在 `/artist`。
- `pond-ripple.xyz` 是应用主域名；`semi.ntdao.xyz` 是社区钱包；GitHub remote 是代码仓库。三者都不是已批准的艺术家个人链接。
- 合约地址、运营钱包、Score `creatorAddress` 与 `ownerOf` 当前持有人各有技术语义，均不能自动称为“艺术家公开地址”。

## 2. 可证明的项目级事实

以下事实可以用于向用户提问或校对，但仍不能替代用户对最终段落的逐字批准。

| 事实 | 证据 | 可信度与限制 |
|---|---|---|
| 产品名是 `Ripples in the Pond` | `AGENTS.md` 项目命名规则、README | 强；但产品名不是艺术家名 |
| 长期目标是 108 首音乐 | README、`docs/ARCHITECTURE.md:15,36,147`、多个 playbook | 强项目约束 |
| 早期叙事为“两年、逐周” | `README.md:3`、`docs/ARCHITECTURE.md:15` | 重复出现但没有 D0 内容批准记录；是否仍准确需用户确认 |
| 用户可以与底曲合奏并保存作品 | README、Architecture 核心体验路径 | 强产品机制 |
| 已铸 Score 的永久输入可由 metadata / Arweave 核验并回放 | `docs/ARCHITECTURE.md:351-367` | 强技术事实；可放机制脚注，不等于艺术家宣言 |
| 音乐素材由用户（艺术家）提供 | `playbook/phase-4-community.md:55` | 旧 playbook 的执行事实，不足以形成个人简介 |
| 艺术家曾提供 5 首正式音乐，并反馈视觉、动态、音阶、命名和按键动画 | `playbook/phase-6/track-b-ui-redesign.md:220,240,304,404-407`、`docs/JOURNAL.md:440-445` | 能证明参与产品反馈；不能据此编造履历、风格流派或理念 |
| `/artist` 的定位已由用户决定为“文字肖像首屏，108 第二章节” | `docs/JOURNAL.md:1295-1302` | 强设计决定；只批准结构，没有批准具体文案 |

### 108 段落仍缺少的真实回答

现有一句产品定位没有回答这些内容，因此不能由 AI补齐：

- 为什么是 108，而不是其他数量。
- “两年 / 逐周”是严格发布节奏、创作过程，还是早期宣传概括。
- 108 首之间是连续作品、独立作品、三个阶段，还是别的关系。
- 艺术家希望观众如何参与、倾听或留下演奏。
- 区块链与永久保存对艺术家本人的意义，而不只是技术机制。
- 36 / 72 / 108 是否具有艺术创作含义；目前只证明它们曾被用作旧空投轮次。

## 3. 公开链接取证

| 候选 | 真实用途 | 为什么不能放进 `publicLinks` |
|---|---|---|
| `https://pond-ripple.xyz` | 产品正式域名 | 可以作为“返回项目”，不能称艺术家个人网站，除非用户明确批准 |
| `https://semi.ntdao.xyz/` | Semi 社区钱包 / 注册入口 | 第三方服务，不是艺术家社交主页 |
| GitHub repository remote | 项目源码仓库 | 仓库账号不等于艺术家；remote 的存在也不是把它列为艺术家公开链接的授权 |
| Git commit author / email | 代码提交身份 | 私人/运维元数据，不是内容来源，禁止公开复用 |
| OP 合约、交易与钱包地址 | 链上凭证 | 只能按合约、交易、创作者、持有人等真实字段命名；没有“艺术家公开地址”授权 |
| X / 微博 URL | Score 分享 intent | 是分享服务入口，不是艺术家账号 |

因此 `publicLinks` 当前应保持空数组；空时整区不渲染。若用户希望展示产品站，也应单独批准 label（例如“项目网站”），不能由 AI 把它升级成“艺术家官网”。

## 4. 未经批准的章节与原型文案

### 已被 P11 明确判为未经批准

- `First Rings`
- `Widening Water`
- `Lasting Pond`

这三个名字只出现在 `playbook/phase-11/40-d-artist-story.md` 的删除规则中，仓库没有创作来源或用户批准证据；生产代码当前未使用。

### 参考样板中的候选章节

这些只属于视觉原型，不可迁入艺术家生产页：

- “三重水庭 / 薄明 / 潮汐 / 余夜”——`references/visual-prototypes/moonlit-pond/index.html`
- “生态层 / 潮下花园 / 微光群落 / 深水记忆”——`references/visual-prototypes/living-resonance/index.html`
- “CHAPTER 01 / 02 / 03”与 `A LIVING ARCHIVE · 001—108`——`references/visual-prototypes/sonic-cartography/index.html`
- “月下声音档案 · 001—108”“Bio-Digital Art × Organic Interaction”等均是视觉方向标签，不是艺术家自述。

P11 可以继承这些原型的排版启发，不能继承其章节命名或把 36/72/108 自动解释成艺术阶段。

## 5. 失效空投文案与数据字段

### 当前公开生产页必须删除

`app/artist/page.tsx`：

- `AIRDROP_INTERVAL = 36`
- `currentRound` / `nextAirdrop`
- 36、72、108 三个“空投标记点”
- 统计卡“下次空投 / 第 N 首”
- “每 36 首曲目发布时触发一轮空投”

这些内容与 `docs/JOURNAL.md:183-195` 的用户决定冲突：主网首版不做空投，前端 `/artist` 不应有空投入口。

### 公开 API 的旧语义也需在后续范围处理

`app/api/artist/stats/route.ts` 仍包含：

- `AIRDROP_INTERVAL`
- `currentRound`
- `nextAirdropAt`

D2 若继续使用此 API，应删除或停止消费这些字段；不能让新页面隐藏旧文案、API 却继续输出失效产品语义。

### 文档中的旧叙事

- `docs/ARCHITECTURE.md:38` 仍写“每 36 首 AI 再创作，空投参与者”。
- `docs/ARCHITECTURE.md` 的 Phase 4 标题与若干旧 playbook 仍保留空投实施历史。
- `playbook/phase-4-community.md:53-60` 把 36/72/108 定义为三轮空投。

实施历史与后端停用设施可作为档案保留；但这些文本不能作为新 `/artist` 内容来源。架构中的当前产品定位冲突需要另获授权后同步，D0 不改文档。

## 6. 数据事实的额外校验缺口

现有页面和 `GET /api/artist/stats` 都用 `tracks` 全表 count 当作 `published`，没有 `.eq('published', true)`；测试/demo 行可能被误计为已发布作品。D2 必须按 playbook 直接查询真实 `published=true` 数量。

当前统计还忽略每个 Supabase query 的 error，并用 `?? 0` 把失败伪装成零。D2 应按内容合同使用并行局部容错：单项失败返回 `null`，0 只表示查询成功且真实为零。

这些是数据展示问题，不影响 D0 的结论：即使统计完全正确，个人内容包仍然缺失。

## 7. D0 后续唯一需要用户批准的最小内容包

请用户一次性提供或逐段确认以下六项；AI 只能整理标点和长度，不能补事实：

1. **展示名 / 艺名**：最终公开写法，包括中英文大小写。
2. **身份句（20–40 字）**：艺术家如何定义自己和正在做的事。
3. **个人简介（80–160 字）**：只包含愿意公开的真实经历与当前实践。
4. **创作宣言（160–320 字）**：最好由艺术家用第一人称提供；确认语气和断句。
5. **108 项目说明（100–220 字）**：至少回答为何是 108、发布节奏、观众如何参与，以及永久保存对作品的意义；同时确认“两年 / 逐周”是否仍准确。
6. **公开链接清单**：每项给出 `label + href`；网站、社交账号、公开邮箱、公开钱包均由用户逐项批准，没有则明确回复“留空”。

还需一个是/否确认：**36 / 72 / 108 是否有独立于空投的创作含义？** 若没有，新页面只显示 `published / 108`，不再划三章、不显示里程碑。

当且仅当这六项与里程碑问题得到用户明确批准，才能创建 `src/content/artist.ts` 并进入 D1。

## 证据索引

- D0 内容合同与硬门：`playbook/phase-11/40-d-artist-story.md`
- 当前公开页：`app/artist/page.tsx`、`app/artist/loading.tsx`
- 当前统计 API：`app/api/artist/stats/route.ts`
- 项目定位：`README.md:1-4`、`docs/ARCHITECTURE.md:13-38`
- 主网不空投决定：`docs/JOURNAL.md:183-195`
- 文字肖像结构决定：`docs/JOURNAL.md:1295-1302`
- 艺术家参与与反馈记录：`docs/JOURNAL.md:435-445`、`playbook/phase-6/track-b-ui-redesign.md:216-245`
- 未经批准的视觉章节：`references/visual-prototypes/moonlit-pond/index.html`、`living-resonance/index.html`、`sonic-cartography/index.html`
