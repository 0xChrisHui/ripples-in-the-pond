# P12 上线前 — 用户操作清单

> **这份文件专门写"需要你亲手做的事"**，每项都标了「你做什么 / 我做什么 / 做完什么样算成功」。
> 部署日当天的操作看 `docs/MAINNET-RUNBOOK.md`（那份是给合约部署用的），本文件是它的前置。
> 执行总路径见 `playbook/phase-12/00-overview.md` §8。
>
> **已完成的不在这里**（C1 密钥轮换 / C4 告警 / C7 / C8 / C9 / C10 / B-1 回归 / 生产热修）。
>
> **2026-08-23 状态更新**：C1 尾巴**拍板跳过**（ADMIN_TOKEN 未泄露不换；Alchemy 测试网 key 泄露无资产风险不换，主网另建新 App）/ C3 **✅ 已转 0.01**（阈值代码已下修 0.005）/ C5 **✅ 已做**（2026-07-27，恢复演练通过；部署日前 24h 重跑）/ admin + deployer + 新 Turbo 三钱包 **✅ 已生成**（地址已进 runbook §2.1）/ D-1 曲名 **✅ 已定**（1-35 即正式名）/ 主网 Alchemy App + Etherscan V2 合约验证 key **✅ 已就绪**。最新待办以本文件末尾「最终清单」为准。

---

## 分组一：随时能做，不用等我

### ✅ C6 免费额度盘点（2026-08-23 CLI/API 完成）

**为什么**：主网上线后流量变真实，得知道哪个服务会先撞免费额度天花板。

**执行结果**：优先使用官方 CLI/API 自动盘点，不要求用户逐后台抄数：

| 服务 | 结论 |
|---|---|
| Vercel | Hobby；保守 cron 上界 17.3% 月调用额度，够用 |
| Supabase | 14 表 349 行 / 应用用户 9，远低于免费上限 |
| Upstash | 56 keys，够用；上线后周看 500K commands/月 |
| Alchemy | 275,096 / 30M CU（0.92%），非常充足 |
| cron-job.org | 4 jobs，1min 与 <5s 路径满足限制 |
| Resend | 小时级告警最坏 24/day < 100/day |

**成功标志 ✅**：六项全部“够用 / 不升级 / 不降频”；证据见 infra review C6。

---

## 分组二：需要我在场配合（每件 10-20 分钟）

### ☐ C1 尾巴 — 换 ADMIN_TOKEN + Alchemy key

**为什么**：`ADMIN_TOKEN` 顺手轮换；Alchemy key 在这次调试的输出里露过。

**流程（跟 CRON_SECRET 那次一模一样）**：
1. 我生成新 `ADMIN_TOKEN` → 写你桌面文件 + 剪贴板（**不进聊天**）
2. 你去 Alchemy 后台 → 你的 App → API Key → **Regenerate**（或新建一个 App）→ 复制新的 HTTPS URL
3. 你在 Vercel 改这三个变量：`ADMIN_TOKEN`、`ALCHEMY_RPC_URL`、`NEXT_PUBLIC_ALCHEMY_RPC_URL`
4. **Redeploy（不带 Build Cache）** ← 上次就是这步没跑完，导致验证全反
5. 我验证：新值通、旧值 401、cron 保持全绿

**成功标志**：`/api/health` 200 + cron 10 分钟内正常跑过。

### ✅ C2 换 Turbo 钱包（2026-08-22 完成）

**为什么**：旧 Turbo 钱包（`0xdE78..Fba8`）私钥在调试记录里泄露过，必须换。新钱包已生成：
`0xD9AEDeAd70F4Cd7532163C4FACBEc77b127B4582`（`.ripples-secrets\turbo-wallet-v2.json`）。

**成本订正**：真实待传物只有 decoder HTML + 音效表（<1MB ≈ 几分钱）——mp3 已永久在
Arweave 上无需重传，原"15 美元"作废。两条路等 A-1 定稿要上传时二选一：
- **干净（推荐）**：往新地址转一丢丢 Base ETH（≈1-2 美元），跑 `topup-turbo.ts`，彻底弃旧
- **省转账**：`shareCredits` 借旧钱包 1.84 GiB 额度——但需改 `core.ts` 加 `paidBy`（SDK 不会
  自动用共享额度），且每次上传永久引用已泄露钱包 = 治标，不推荐

**脚本状态**：`upload-sounds.ts --map-only` 会复用 26 个现有音频 txid，只上传 v2 音效表；
旧索引缺 hash 时普通模式默认拒绝执行，防止误传 26 个 mp3。`--map-only --dry-run` 已通过：
2558 bytes / 26 sounds，上传 0、扣费 0。新钱包收到 **0.001 ETH（Base 网络）**，其中
**0.0009 ETH** 已充值为 623,213,389,830 winc；Base 余额约 0.00009987 ETH。

**上传结果**：decoder `NMCjKLoaRNWKgH0AyCDB6p8qjjv2iD2Fidzf7VAZmb0`；v2 音效表
`NQsgcCSPJjeRzvXHnXNWbUsovDCjkO5xHJBX7Eu_kl8`。两个网关均 200 且 SHA-256 一致；
Production/Preview 已切新钱包 JWK，本地与 Vercel 三环境已切新 txid。

**成功标志**：新钱包成功上传 decoder + 音效表并扣费；三环境 env 切新 txid。

### ✅ C3 运营钱包充主网 ETH（2026-07-28 已转 0.01）

**为什么**：主网上每次铸造 NFT 的 gas 由这个钱包代付。

**状态**：用户已往 `0x306D3A445b1fc7a789639fa9115e308a34231633`（OP 主网）转 **0.01 ETH**。
实测 OP gas 0.001 gwei → 0.01 ≈ 5000 次铸造，足够上线 + 小圈实测。不够再加（"少于 0.005 提醒我"）。
- 告警阈值已代码下修 **0.05 → 0.005**（`check-balance` + `/api/health` 两处；**待部署生效**）。
**成功标志**：部署后 `/api/health` 里 `wallet` 非 `low`（0.01 > 0.005 阈值）。

### ☐ C5 数据库快照（我做，你只需说一声）

**为什么**：部署日要清空链相关的旧表（B-1 已证明不清就会卡死），清之前必须有可恢复的备份。

**我做**：用管理密钥把所有表导成 JSON 存到本地 `backups/`（仓库外，不进 git），并做一次恢复演练。
**你做**：说一句"跑备份"。部署日前一天我会再跑一次新的。
**成功标志**：备份文件存在 + 恢复演练成功（"没演练过的备份 = 没有备份"）。

---

## 分组三：需要你的审美/内容决策

### ✅ A-1 解码器 UI 优化轮与永久上传

**为什么**：解码器 = 买家点开 NFT 时看到的播放器。**这版定稿后，主网铸出的每一枚 NFT 永远用这版**（地址焊死进 NFT，改不了）。

**流程**：
1. 我在浏览器里打开当前版本给你看
2. 你像点评设计稿一样提意见（说人话就行："按钮太小"、"想要水波背景"）
3. 我改 → 你看 → 循环到满意
4. 你点头定稿 → 我做三组参数回归验证 → 上传 Arweave → 切三环境 env

**完成**：用户已拍板 UI；三组参数 + 重试复验通过；永久上传与双网关哈希通过；三环境已切换。
**Track A DoD 已完成**：`Ripples #26` 真实铸造成功，链上 metadata 已确认引用两个新 txid。

### ☐ D-1 曲名定稿（**永久，最容易后悔的一项**）

**为什么**：曲名会**永久写进每一枚 NFT** 的名称、描述、属性里。现在有一批曲子叫"16"、"17"这种数字占位名。

**你做**（三选一，可混用）：
- **A** 把正式曲名发我（哪首叫什么），我写 SQL 你在 Supabase 跑
- **B** 告诉我哪几首暂不开放铸造，我在前端拦掉
- **C** 明确接受占位名永久（不推荐）

**成功标志**：开放铸造的曲目全部有正式名，或明确记录了接受占位。

---

## 分组四：钱包准备（部署日前必须完成）

### ◑ admin 独立钱包（合约的"房产证"）——私钥已备份，剩部署日充值

**为什么**：admin 钱包持有合约治理权。红线是 **admin ≠ 铸造热钱包**（热钱包在服务器上天天用，泄露就等于治理权被接管）。

**✅ 我已做**：`cast wallet new` 生成 → `admin` = `0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722`，
私钥存 `C:\Users\Hui\.ripples-secrets\admin-wallet.json`（仓库外，已 verify 派生一致，不进 git/Vercel/聊天），地址已进 runbook §2.1。
**✅ 已完成（2026-08-22）**：私钥已另存密码管理器。
**⬜ 你还要做**：部署日给这个地址转一点点 OP 链 ETH 当 gas（约 0.005 ETH 够用）。

**成功标志**：私钥已备份到第二处；部署日钱包里有 gas。

### ✅ 主网 Alchemy App + Etherscan V2 合约验证 key

**为什么**：`.env.local` 现有 Alchemy 是 **opt-sepolia（测试网）**；部署日 `ALCHEMY_RPC_URL`
必须指 **opt-mainnet**。合约 verify（runbook §5）需要 Etherscan V2 API key。

**✅ Alchemy 已完成（2026-08-23）**：官方 CLI v0.23.0 创建 `Ripples OP Mainnet`（App ID `w609pakm9kk1b07g`），仅允许 `OPT_MAINNET`；RPC 实测 `eth_chainId=10` 和最新区块成功。认证保存在仓库外的 Alchemy CLI 配置，API key 未进聊天或 git。

**✅ Etherscan 已完成（2026-08-23）**：统一 V2 key 已创建。OP Mainnet 普通链数据 API 在免费套餐会返回拒绝，但部署所需的 `getsourcecode` 与验证状态接口实测可用，因此不升级付费。key 已移到仓库外 `C:\Users\Hui\.config\ripples-in-the-pond\etherscan-api-key.txt`，未进聊天或 git。

**成功标志**：部署日 `ALCHEMY_RPC_URL` 是 mainnet；三个合约 verify 出绿勾。

### ✅ B5 admin 签名演练（2026-08-23 完成）

**为什么**：部署日要用 admin 钱包做一次授权（不做的话 Orchestrator 拿不到铸造权，整条链路瘫痪）。**没演练过就上阵 = 部署日卡死**。

**完成证据**：OP Sepolia 给 admin 充值 tx `0x51f1...be48`；既有测试 admin 授予新 admin 治理权 tx `0x0466...1947`；新 admin 亲自签出 grantRole tx `0x3ae2...efa7`，随后签 revokeRole tx `0x42ce...1424` 清理临时 MINTER_ROLE。最终 admin DEFAULT_ADMIN_ROLE=true、临时 MINTER_ROLE=false、Orchestrator MINTER_ROLE=true；admin 测试网余额约 0.00019993 ETH。

### ◑ deployer 一次性钱包——2026-07-28 已生成

**为什么**：专门用来部署合约，**用完即销毁**（runbook §4.4）。

**✅ 我已做**：`deployer` = `0x96aAfd4817BCF9971B54B5aC180D20a47F462162`，私钥存
`C:\Users\Hui\.ripples-secrets\deployer-wallet.json`（已 verify，地址进 runbook §2.1）。
**⬜ 你还要做**：部署日转约 0.04 ETH（OP 主网）当部署 gas（够 3 次部署 + 移交）。
**成功标志**：部署日钱包有 gas；部署完 §4.4 销毁私钥 + 转走余额。

---

## 分组五：部署日

### ☐ D-0 排期拍板

**你做**：挑一个能连续投入 **2-3 小时**、且当天精神好的时段（不要赶时间）。
**建议**：部署完先**不对外宣传**，自己小圈实测 2-3 天，稳了再公开。

### ☐ 部署日执行

照 `docs/MAINNET-RUNBOOK.md` 走，我全程给命令、你复制粘贴执行。
**红线**：任何一步验收不过 → **停在原地，不硬推**。合约部署不可回滚。

---

## 顺序建议

```
C6 盘点 ─┐
C5 快照 ─┼─→ C1尾巴 → C2/C3 充值 → A-1 UI轮 → D-1 曲名 ─┐
        └─→ admin/deployer 钱包 → B5 演练 ─────────────┴─→ 🛑D-0 排期 → 部署日
```

**最省事的起手**：C6 盘点（你自己就能做）+ 说一声让我跑 C5 快照。

---

## 🎯 最终清单（2026-07-28 · 只留必要项 · 权威口径以此为准）

> 上面分组是完整背景；这张是"到底还剩啥"。已删掉所有已完成 / 已跳过项。

### 你亲手做（我没法代劳）
| # | 事项 | 类别 | 时机 |
|---|---|---|---|
| U2 | ✅ **主网 Alchemy App**（CLI 创建并验证 chainId 10） | 已完成 | 2026-08-23 |
| U3 | ✅ **Etherscan V2 合约验证 key**（OP 合约接口实测可用） | 已完成 | 2026-08-23 |
| U4 | ✅ **C6 免费额度盘点**：六项均维持免费档 | 已完成 | 2026-08-23 |
| U5 | ✅ **deployer 0.0001 ETH / admin 0.00005 ETH / operator 0.01 ETH** 均已在 OP 主网到账 | 已完成 | 2026-08-23 |
| U6 | ✅ 用户已发出“开始部署”，维护窗口启动 | 已完成 | 2026-08-23 |

### 需要你我配合（我主导，你到场）
| # | 事项 | 说明 |
|---|---|---|
| P1 | **A-1 decoder 收口** | ✅ `Ripples #26` 真实 smoke 已完成；链上 tokenURI、metadata、新 decoder 与 v2 sounds 全部核验通过 |
| P2 | **B5 admin 签名演练**（测试网） | ✅ grant / revoke 实操与权限清理均已完成 |
| P3 | **曲名描述文案**（一行）：`"17"` → `Track 17`，改不改你拍 | 永久写进 NFT，问一句 |

### 部署日当天（照 runbook，我全程给命令）
| # | 事项 |
|---|---|
| D1 | 部署前 24h 内重跑一次 **C5 快照** |
| D1.1 | ✅ MaterialNFT 35 份永久 metadata + SVG 封面已上传，最终 manifest `2LvJ7...gbf28` |
| D2 | **合并 `feat/p12-mainnet-prep` → main**（带 CT-1~15，必须与部署同步——早合并会让线上两参数 mintScore 撞旧合约全 revert） |
| D3 | 3 合约部署 + admin 授权（P2 演练过）+ 6/6 角色验收 + 3 verify 绿勾 |
| D4 | env 切主网（合约地址 / CHAIN_ID=10 / APP_URL / Alchemy mainnet）+ Redeploy 无缓存 |
| D5 | cron 4 绿 + 端到端 smoke（真 gas 铸一枚）+ 销毁 deployer 私钥 |

**削掉了什么**（不必要/已了结，别再纠结）：C1 ADMIN_TOKEN 轮换（未泄露）、Alchemy 测试网 key 轮换（无资产风险）、C2 那 15 美元（mp3 无需重传）、曲名大改（1-35 即正式名）。

**下一个动作建议**：进入 D2 写冻结与主网广播。
