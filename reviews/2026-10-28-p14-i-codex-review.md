# P14-I 全量 Codex 审查（2026-10-28）

> 审查者：Codex CLI gpt-6-astra（high，read-only 沙箱）；范围 `6933898^..b00c35d`（14 个提交）。处置见文末。

**可进入评审，但暂不建议合并：已复现随机出生点回归和轮询漏唤醒，测试凭证的环境隔离也需要确认。**

以下位置、行号均以 `b00c35d` 为准。审查了全部 14 个提交；未修改文件、读取 `.env*`、启动 dev/build 或访问真实业务接口。

**阻塞**

未发现已证实的阻塞级漏洞。生产是否接受本地测试凭证尚未核实，不能直接断言发生了生产凭证泄露。

**应修**

1. **I6 测试凭证没有环境或用途隔离。〔本轮操作引入风险；认证机制基线已有〕**  
   位置：[JOURNAL.md:1875](E:/Projects/nft-music/docs/JOURNAL.md:1875)、[jwt.ts:77](E:/Projects/nft-music/src/lib/auth/jwt.ts:77)、[middleware.ts:32](E:/Projects/nft-music/src/lib/auth/middleware.ts:32)。  
   **触发条件：**本地签名私钥与生产验签公钥配对，且凭证尚未过期、未被撤销。  
   **后果：**相同 `issuer= ripples`、`audience= ripples-app` 的凭证会通过生产认证；测试网地址、随机 `sub`、localhost 登录都不能把权限限定在本地或首页。桌面明文文件还可能进入同步、备份。2 小时有效期确实限制时间，但比原脚本的 45 分钟更长。  
   **建议：**使用独立测试密钥和生产明确拒绝的 audience，配套测试数据库或仅供审查的受限认证；缩短有效期、尽量只在内存保存。记录 `jti/exp`，需要提前撤销时写入对应环境的黑名单并核验结果。此次凭证是否仍有效、密钥是否共用，需要另行确认。

2. **JWT 撤销在数据库异常时可能失效。〔基线已有〕**  
   位置：[jwt.ts:86](E:/Projects/nft-music/src/lib/auth/jwt.ts:86)、[jwt.ts:115](E:/Projects/nft-music/src/lib/auth/jwt.ts:115)、[useAuth.ts:149](E:/Projects/nft-music/src/hooks/useAuth.ts:149)。  
   **触发条件：**黑名单查询或写入返回 Supabase `error`。  
   **后果：**验证只检查 `data`，查询失败可能仍放行；撤销写入失败也没有检查。客户端登出仅清本地状态，不撤销已经复制出去的 token。  
   **建议：**查询失败拒绝认证；撤销检查错误并读回确认。删除桌面文件、浏览器登出都不能替代服务端撤销。

3. **随机出生点使既有 ≤2px 验收出现偶发失败。〔`b00c35d` 引入〕**  
   位置：[echo-node.ts:27](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/simulation/echo-node.ts:27)、[echo-node.ts:42](E:/Projects/nft-music/src/components/pond-gl-test3/spheres/simulation/echo-node.ts:42)、[echo-lifecycle.test.ts:183](E:/Projects/nft-music/scripts/p14-i/echo-lifecycle.test.ts:183)。  
   **触发条件：**小屏布局没有无碰撞候选点，使用经过随机抖动的“最空处”回退。  
   **证据：**保留原断言、注入 50 组固定随机序列，**3/50 失败**，最大额外位移 **2.284px/tick**。同一序列 seed=7：改动前 **1.953px**，改动后 **2.283px**。样本失败率约 **6%**，不是线上发生率。  
   另外，320×568、667×375 的指定稳定布局各抽样 1,000 次，出生位置全部存在完整半径重叠；所以“最空处”并不保证“不碰撞”。  
   **建议：**保留空位随机选择，另行设计拥挤时的回退；若坚持绝不碰撞，应延迟追加并重试。补充固定失败种子、无空位测试，重新验证位移预算，不能只放宽断言。

4. **30 秒冷却会丢掉唯一一次回首页唤醒。〔`585d564` 引入〕**  
   位置：[personal-echo-poll.ts:107](E:/Projects/nft-music/src/hooks/echo/personal-echo-poll.ts:107)。  
   **触发条件：**首次返回 `echo:null,pending:false`，随后 30 秒内完成相关操作并返回首页。  
   **后果：**`recheck()` 直接返回，既不查询，也不安排冷却结束后的补查；用户持续停留首页时，已经生成的 Echo 可以一直不出现。  
   **复现：**t=0 查空，t=10 秒 Echo 已就绪并唤醒，推进至 t=600 秒，仍只有 **1 次请求、0 个定时器**。  
   **建议：**冷却期间合并为一次延后复查，执行前检查可见性、身份和销毁状态。

5. **测试没有完整覆盖身份隔离与 HTTP 合同。〔本任务新增测试的缺口〕**  
   位置：[home-echo.test.ts:121](E:/Projects/nft-music/scripts/p14-i/home-echo.test.ts:121)、[usePersonalEcho.ts:31](E:/Projects/nft-music/src/hooks/echo/usePersonalEcho.ts:31)、`scripts/p14-i/`。  
   **触发条件：**以后修改 React effect、鉴权或响应分支。  
   **后果：**轮询器测试通过，并不能证明真实 hook 换号、缓存恢复、迟到响应及播放器停止正确；HTTP 测试只实际调用匿名 401 分支，未覆盖认证后的 200/400/503 缓存头，也没有 `/me/pond-echoes` 回归测试。  
   **建议：**补这些集成边界，并把 `home-echo.test.ts` 从真实环境加载器、服务端客户端初始化中隔离出来。`verify-home-echo-live.ts` 是真实 RPC／网关／数据库只读联调，不能算单测；当前命名已作区分。

**建议**

- **本地审查白名单尚不能验收个人 Echo。〔本任务接入缺口〕**  
  [local-review.ts:4](E:/Projects/nft-music/src/lib/runtime/local-review.ts:4) 删除旧路由是正确的，但 `LOCAL_REVIEW_ONLY=1` 会拦截新接口，登录后仍无 #36。不要简单关闭整道保护：既有 Privy 鉴权可能补写用户与身份记录。建议建立受限的私有只读验收路径，再精确放行。

- **部署时核验旧 CDN 响应，而非仅确认源码删除。〔旧公共缓存的遗留影响〕**  
  `e829728` 删除的路由原允许 **1 天新鲜缓存＋7 天 stale**。新首页已不消费它，但旧页面和直接请求者是否仍能取得旧响应，取决于部署及缓存失效行为。建议部署后检查旧 URL、缓存头及匿名首页；残留内容是旧 ECHO #1，不是新私有接口中其他钱包的结果。

- **台账需要统一当前状态与证据适用范围。〔本任务收尾遗漏〕**  
  [95-i:3](E:/Projects/nft-music/playbook/phase-14/95-i-personal-echo.md:3) 仍写“尚未开发”；[TASKS.md:16](E:/Projects/nft-music/TASKS.md:16) 的 I2/I3 仍写未目验；[STATUS.md:19](E:/Projects/nft-music/STATUS.md:19) 的权威“下一步”仍指向旧 ETH 工作。JOURNAL 的 ≤1.96px 是随机化之前的结果，不能作为最终提交保证。步骤提交基本清楚，主要范围扩展有提交信息或 JOURNAL 说明；但 STATUS/学习记录是集中补记，并非逐步同步。

**已核实无问题的要点**

- I-1/I-5 按 `tokenIdByOrigin` 选择；转走不改变选择，转入不会成为首页 Echo。永久 metadata 仍经过原有校验。
- 新接口所有显式响应分支均设置 `private, no-store`；匿名 hook 不请求。缓存键包含登录源、用户和规范化钱包地址，未发现串号路径；换身份先返回 null，播放停止链路已接通。
- pending 状态集合、30 秒自动轮询、单轮 20 分钟期限、取消和迟到响应防护基本正确，例外是上述冷却漏唤醒。
- I3 保留自然漂流、换层和隐现参数；首个可见期恢复为 8–45 秒。碰撞半径只在身份入退场缩放，自然隐现仍使用原半径。
- 未发现新增匿名首页个人 Echo 出口。`/echo/[id]`、`/echo/origin/[address]` 仍公开，属于方案明确保留的作品页；因此 I-6 应按首页身份响应理解。music-catalog 样例未发现超出已接受决定的新风险。
- 改动代码全部 ≤200 行；`scripts/p14-i/` 正好 8 文件。既有超限为 `self-mint=9`、`types=10`，另 `scripts/p14` 从 14 降至 13。未发现新增生产占位代码、依赖或架构修改，新增注释以中文为主，关键随机选择与期限决策有 💭 说明。

测试方面，8 个文件是 **6 个测试＋1 个夹具＋1 个联网联调脚本**。本轮从 Git 快照在内存中运行了 node、lifecycle、presence、buffer、poll 五组测试；单次均通过，扩展随机检查发现上述回归。40 次出生覆盖至少三区域的断言本身，按桌面 10,000 次抽样分布估算，误失败概率约 **10⁻¹⁶ 量级**；主要偶发失败来源是位移断言。

**未能核实**

- 浏览器真实登录、快速换号的音频停止、最终随机出生观感及完整 GL 渲染效果。
- 生产与本地密钥是否共用、桌面凭证是否已过期／撤销、生产黑名单实际状态。
- 部署后的 CDN 清理、匿名响应与生产接口耗时。
- 历史 `verify.sh`、build、Forge 等“已通过”记录。本轮未运行这些命令，也未运行会加载 `.env*` 的 API 测试或真实联网联调。

## 处置（Claude，2026-10-28，用户“全部按建议”）

- 应修 1 测试凭证隔离：本次凭证 2 小时自然过期（用户选择不写黑名单）；长期改进记入 TASKS Later。
- 应修 2 黑名单查询出错放行：基线问题，记入 TASKS Later。
- 应修 3 出生点回退：e9958f9 修复，50 种子 × 3 视口 × 3 组全 ≤2px。
- 应修 4 冷却期唤醒丢失：4f6ffe3 改为延后补查。
- 应修 5 测试缺口：4f6ffe3 补接口 401/400/200/503 与身份隔离纯模块测试；真实 hook 渲染测试因无 jsdom 等依赖未做；`/api/me/pond-echoes` 回归测试未补（I1 审查时已做 8 场景离线对照）。
- 建议：本地只读验收模式记入 Later；CDN 残留列入部署后复核清单；台账收尾已做。
