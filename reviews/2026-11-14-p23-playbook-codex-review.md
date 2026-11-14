# P23 playbook — Codex 审查（2026-11-14）

> 审查者：Codex CLI 0.163.0，模型 `gpt-6-astra`，推理强度 high，只读沙盒。审查对象：`playbook/phase-23/` 的 00、02、03、04。\
> 处置：11 条全部经 Claude 逐条对照代码核实后成立，已修改对应 playbook（见 `00-overview.md` §4 修订记录）。核实时的补充：第 8 条补充了“先量投影倍率再换算”的做法；第 11 条中 B:69 把子目录计入 8 项只是偏保守，未改；第 2 条把命中层范围扩展到 `EchoResidentHit`、`Track36HitTarget`（Codex 只点名 `SphereHit`）。

---

只做了静态只读核查，未运行构建或写入操作。**A-F1 的字体失效因果链成立；D-F2/F3/F4 的登录分支、调用方和独立状态描述基本准确。**本地登录能力、生产库当前行数及历史截图结果未复测。

下文 A/B/D 指 `playbook/phase-23/` 的 02/03/04 文件。

**必须改（会做坏／会出事）**

1. **B 的自动回滚不能覆盖它自己规定的失败点。**  
   证据：B:116 读回失败时旧行尚未删除；B:121 却要求把旧 100 行全部插回，会撞主键／唯一约束（[表定义:7](E:/Projects/nft-music/supabase/migrations/phase-3/008_score_covers.sql:7)）。此外，铸造会增加使用次数（[分配函数:111](E:/Projects/nft-music/supabase/migrations/phase-16/058_score_token_counters.sql:111)），正常并发就可能打破 B:118 的排序断言，触发误回滚。  
   建议替换为：“备份不可覆盖；记录每步执行状态；回滚只补缺失旧行，保留仍存在行的最新计数，确认恢复完整后才删除本批新行。验收检查集合及静态排序字段，允许正常使用计数增长；网络结果未知先读回核对。”删除“不用事务也安全”的保证。

2. **双指只改 `pointer-fx`，会遗漏拖球和抬指播放。**  
   证据：A:224–230 只允许改该 hook；[SphereHit.tsx:60](E:/Projects/nft-music/src/components/pond-gl-test3/overlay/SphereHit.tsx:60) 独立捕获指针，75 行抬指会触发播放；`lensMode` 下移动甚至不设置 `moved`。阻止浏览器缩放不会自动取消这些处理。  
   建议把命中层纳入范围：第二指加入时取消当前拖动，直到全部离开都禁止激活；补“从球上起手、分别落在两个球上、取消手势”的集成验收。

3. **抽屉“放不下就收起”会使交易恢复操作不可达。**  
   证据：D:93、149 禁止内部滚动；[MaterialOrderView.tsx:119](E:/Projects/nft-music/src/components/music-catalog/claim/MaterialOrderView.tsx:119) 有交易恢复输入和按钮，129 行还有可展开详情，内容高度会动态增长，不能只按匿名态预算。  
   建议允许展开内容滚动，或提供明确可达的完整订单入口；并写明“折叠、换边、切换屏幕尺寸均不卸载收藏实例”，避免丢失本地状态和清除铸造活动。

4. **“失败只停该线”与同一 main 后续推送冲突。**  
   证据：[总览:26](E:/Projects/nft-music/playbook/phase-23/00-overview.md:26) 要求主工作区 main 逐步提交，51 行要求失败保留提交，40 行又允许 D 完成后推送。这样后续 push 会包含此前失败线的提交。  
   建议补：“任一代码线失败后冻结本次全部推送；其他线可以继续本地工作。恢复推送前必须明确处理失败提交并重新验证整个待推送范围。”

5. **snapshot 豁免过宽，可能放过真实回归。**  
   证据：总览:51 按 Gate 名称豁免；[verify.sh:89](E:/Projects/nft-music/scripts/verify.sh:89) 把媒体测试、快照计划测试、生产读回合并成同一失败项。生产脚本还检查快照完整性，非只有网络错误。  
   建议逐条记录失败子命令及错误特征，只豁免已确认的网络故障；媒体／快照断言失败必须阻止推送。

6. **执行现有门禁会覆盖明确禁止改动的他人文件。**  
   证据：总览:46 保护 `reviews/evidence/lens-gate-failure.png`；[browser-gate.mjs:133](E:/Projects/nft-music/scripts/ui/lens/browser-gate.mjs:133) 失败时直接覆写该路径。  
   建议在 D0 前让门禁接受输出目录，本轮统一写到 `p23-lens/`；仅“不 stage”不能保护原文件。

**建议改**

7. **D1 的抽取方案漏了必需参数和 CSS 迁移。**  
   证据：D:114 的 hook 返回值没有 `auth`，但 [MaterialMintPanel.tsx:44](E:/Projects/nft-music/src/components/music-catalog/claim/MaterialMintPanel.tsx:44) 的 OP 行必须接收它；[lens-panel.css:53](E:/Projects/nft-music/src/features/lens/panel/lens-panel.css:53) 隐藏重复链信息等规则全部依赖旧 `.lens-collect` 祖先。  
   建议明确返回并传入 `auth`；将收藏样式迁到 `.lens-panel` 内限定选择器，保留旧 `/tracks` 默认样式，避免卡片内重新出现整套链标题。

8. **日食半径不能直接等同于 DOM 半径。**  
   证据：A:155 要设为 `bounds.width / 2`；[useEclipseTransition.ts:64](E:/Projects/nft-music/src/components/pond-gl-test3/focus/useEclipseTransition.ts:64) 实际又乘投影和悬停倍率。初始化改一次也不覆盖屏幕旋转后的尺寸变化。  
   建议区分基础半径与最终屏幕半径，按实际投影换算；验收覆盖桌面透视、手机、旋转及播放归位，不能只验初始静态尺寸。

9. **A 漏列旧门禁，状态截图也没有可执行的前置条件。**  
   证据：[flows.mjs:88](E:/Projects/nft-music/scripts/p11/score-route-handoff/flows.mjs:88) 仍点击将被删除的 `.score-pond-header__back`；[measure-score.mjs:68](E:/Projects/nft-music/scripts/p15-i/measure-score.mjs:68) 点击将移除的胶囊按钮。A:175 要脚本拍暂停／结束，但 F13 又说明播放无法进入。  
   建议把这些脚本纳入范围；为每个状态写明触发方式，无法到达的明确记“待人工验证”，不能记通过。

10. **D-F8 把“铸造钉住”写成了过强的既有保证。**  
    证据：[use-lens-frame.ts:82](E:/Projects/nft-music/src/features/lens/use-lens-frame.ts:82) 优先使用选中／播放／悬停，最后才用铸造活动；OP 收藏函数没有登记活动，ETH 才有。  
    建议改为“现有 ETH 离窗保留兜底”，分别列 OP／ETH 的真实行为；若要求严格锁定曲目，应另列明确改动范围和验收。

**可选**

11. **清理过时编号及硬线口径。**  
    证据：A:242 指向 §8 执行记录，实际是 §9；A:105 仍要求逐步等待，与夜间授权冲突；B:69 把子目录算入 8 项，但 [目录 hook:116](E:/Projects/nft-music/.claude/hooks/check-folder-size.js:116) 只数文件。  
    建议统一引用总览夜间规则，修正章节，并分别列直接文件数与代码行数。

**总体结论：不能直接按现稿夜间执行；至少先解决第 1–6 条，尤其生产回滚、手势冲突和失败提交的推送隔离。**