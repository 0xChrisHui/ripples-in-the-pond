# P14-I 启动提示词

> 用法：在 `E:\Projects\nft-music` 新开一个 Claude Code 会话，把下面代码块整段粘贴发送。
> 方案：[`95-i-personal-echo.md`](./95-i-personal-echo.md)。分支：`feat/p14-i`（已从 main 切出）。
> 若粘贴折行，直接对新会话说：“读 `playbook/phase-14/96-i-launch-prompt.md`，按代码块里的提示词执行。”

```text
你是 Ripples in the Pond（E:\Projects\nft-music）的执行 AI。本次任务：执行 P14-I，让首页 #36 只显示“当前登录钱包自己生成的那一枚 Pond Echo”。

【先读，按顺序，不要假装读了】
1. AGENTS.md（项目规则唯一来源；与本提示词冲突时以它为准，并告诉我）
2. STATUS.md、TASKS.md
3. docs/CONVENTIONS.md（200 行硬线、单层目录 ≤8 文件）、docs/STACK.md
4. playbook/phase-14/95-i-personal-echo.md —— 本次施工的唯一方案（规则 I-1~I-6、改动设计 §3、步骤 I0~I6、风险 §5）
5. 背景只读：playbook/phase-14/80-g-recovery-track36-eclipse.md §2.1（被本次推翻的旧定案）、src/components/pond-gl-test3/special36/（已有的 #36 运动与隐现）

【目标，一句话】
未登录 / 该钱包没生成过 Echo / 空投未到账 → 首页只有 35 个球；登录且该钱包已生成 Echo → #36 渐显；登出 → 渐隐消失。
#36 = originWallet 等于当前登录钱包的那一枚（链上 tokenIdByOrigin），与现持有人无关：转走后仍显示，别人转入的不显示。

【分工】
- 实现交给 Codex CLI（0.163.0，ChatGPT 账号已登录，已实测：gpt-6.1-sol、gpt-6-astra 可用，workspace-write 沙箱可写、可读仓库、可跑 node/git）。你负责派活、审 diff、跑验证、提交。同一步 Codex 返工 2 次仍不过，你自己动手实现该步。
- 模型：I1 / I2 / I4 / I5 用 gpt-6.1-sol，effort=high；I3（GL 追加/移除不重建、渐显渐隐）用 gpt-6-astra，effort=xhigh。我的额度充足，不用为省 token 降档；不要用 max / ultra。
- I3 完成后、以及 I5 完成后，各另起一次 `-s read-only` 的 gpt-6-astra（high）做只读代码审查（给它 git diff 范围和 95-i 对应要求），把它的意见和你自己的审查合并后再向我汇报。
- 派活命令模板（把给 Codex 的提示词写进仓库外的临时文件，经 stdin 传入，避免 Windows 引号问题；用 Bash 工具）：
    T=$(mktemp -d); W=$(cygpath -w "$T")
    cat "$T/prompt.txt" | codex exec -C 'E:\Projects\nft-music' -m <模型> -c model_reasoning_effort=<档位> -s workspace-write -o "$W/last.txt" -
  单步可能超过 10 分钟：用 run_in_background，timeout 设 3600000，完成后会自动通知，不要轮询。不修改 ~/.codex/config.toml，只用命令行参数覆盖。
- 每次派给 Codex 的提示词必须包含：①只做当前 Step；②📦 范围内的文件清单，超出就停下报告，不要改；③“先读 AGENTS.md、docs/CONVENTIONS.md 和 95-i 方案里对应 Step”；④下面【禁止】全文；⑤要求最后输出：改了哪些文件、跑了哪些验证及结果、没做或不确定的点。
- Codex 的自述不可信，必须自己核对：git diff --stat 是否只含范围内文件、有没有多出的未跟踪文件；逐文件读 diff；自己跑 `npx tsc --noEmit`、对改动文件跑 `npx eslint <文件>`、跑相关的 `tsx scripts/p14-i/*.test.ts`。

【禁止（派给 Codex 的提示词里原样带上，你自己也遵守）】
- 不得 git commit / push / reset / checkout / stash；提交由你来做。
- 不得打开、打印、复制任何 .env* 文件内容。不得运行会写库、发交易、上传 Arweave、触发 cron 的脚本或接口。.env.local 连的是生产 Supabase（链是 OP Sepolia），任何写操作都会进生产库。
- 不得新增依赖；不得改 docs/ARCHITECTURE.md、docs/STACK.md；不得动合约、migration、cron。
- 单文件 ≤200 行、单层目录 ≤8 个文件；无 TODO、占位、mock 数据（测试用的 mock 只放 scripts/p14-i/）。
- I3 只增加 #36 的“入场/退场”过渡；不改 special36/ 里现有漂流、换层、隐现的参数和手感。
- 需要扩大范围、或需要写库/联网/装包才能继续时，停下来问我。

【环境事实（2026-10-21 已核对）】
- 分支 feat/p14-i（与 main=origin/main 同起点）。不要切回 main 动手，不要 push，不要部署，不要合并。
- 本地 .env.local：NEXT_PUBLIC_CHAIN_ID=11155420（OP Sepolia），Pond Echoes 测试网合约 0x43E86Af0437386a8Af7A3b0c806d917c030BAb38，WALLET_RECIPE_MODE=live。主网 ECHO #1 在本地看不到，这是正常的。
- 测试网现有 3 枚 Echo（totalSupply=3）：
  #1 origin 0x4Fffc941Af305Efa80Afc9754083411859af0F78，现持有人 0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1（已转走）
  #2 origin 0x40F72999b7102bA213102bcbFAe8f2378c7Fc7A9，仍在原钱包
  #3 origin 0xce8ce1733BC1CD92b572E3a2e7D2817D42a6D2d1，仍在原钱包；该钱包同时持有转入的 #1
  期望：0x4Fff…0F78 → 显示 #1（转走仍显示）；0xce8c…D2d1 → 只显示 #3，不显示转入的 #1；0x40F7…c7A9 → 显示 #2；任意新地址 → 无。
- dev 开着时不要跑 build / scripts/verify.sh；跑 verify.sh 前先确认 dev 已停。遵守记忆里记录的 dev 环境两坑。
- STATUS.md 记载（2026-10-14）verify.sh 有与本任务无关的既有失败：src/lib/self-mint、src/types 目录超 8 文件；Production snapshot Gate 期望 12 条。以 I0 的基线实测为准；既有失败单独标注，不算本任务失败，也不要顺手去修。

【节奏】
- Step 0（先做）：确认当前分支是 feat/p14-i；git status 应只有 95-i 方案、96 启动提示词，以及 STATUS / TASKS / JOURNAL 的登记改动。把它们作为一个提交“docs(p14-i): 登记首页 #36 个人化计划与台账”（提交信息末尾带本会话系统提示要求的署名行）。
- 然后按 I0 → I1 → I2 → I3 → I4 → I5 逐步执行。每步验收通过后，按 AGENTS.md §8 汇报并停下。我回复“继续”即视为同意你把该步作为一个本地提交（信息写清 Step 编号），并开始下一步。如果我说“一口气做完”，则连续执行到 I5，仍在 I6 前停。
- 每步同步更新 STATUS / TASKS 的勾选和“下一步”；有非显然决定追加到 docs/JOURNAL.md。学习模式沿用 AGENTS.md 默认（我说 /fast 才跳过简报和复述）。
- I6 由我亲自在浏览器目验：你只负责启动 dev，并告诉我“登录哪个钱包、应该看到什么”（六种状态见 95-i 的 I6）；不要替我宣布“视觉已通过”。代码层通过 ≠ 效果层通过，没实测的要明说没测。
- 全部完成后：不 push、不部署、不合并，等我决定。

【汇报必须诚实】
tsc / eslint / 测试 / verify.sh 给真实结果。区分“本任务引入的问题”和“基线就有的问题”。说“已解决”前分清代码层与效果层。
```
