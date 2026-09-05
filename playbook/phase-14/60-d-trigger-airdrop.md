# P14-D — 首枚 Score 发现、永久 metadata 与异步空投

> **目标**：把已冻结的 A/B/C/E 输入接成独立、可恢复的自动空投流水线。
> **前置**：P14-E 的封面、Decoder、路由和播放参数均已用户批准并取得冻结身份。
> **核心隔离**：不修改现有 Score queue route；P14 通过独立发现/处理 cron 观察已发生的 Score mint。

---

## D0｜触发真值与运行模式

### 什么叫“首枚 ScoreNFT mint 成功”

- 以 ScoreNFT 合约的 `Transfer(from=0x0, to=origin, tokenId)` 成功日志为链上真值。
- 不以登录、API 入队、页面显示 success 或 setTokenURI 成功作为首铸时刻。
- 现有 `score_nft_queue` 提供发现索引与 source queue 关系；receipt/log 用于确认真实接收钱包、tokenId 和 block。
- 即使 Score 后续 metadata/setURI 失败，只要 mint receipt 成功，它仍是该钱包历史首枚，P14 资格不能转移到第二枚。

### 启用边界

- `activationBlock` 是 OP Mainnet 已确认区块，资格规则必须写成 `sourceScoreBlock > activationBlock` 或 `>=` 的唯一最终版本；P14-0/F 上线前冻结。
- 启用前从 Score 合约部署块扫描到 activationBlock，所有 `from=0` 的接收钱包写为 `excluded_prelaunch`。
- 数据库 success rows 与链上 mint logs 做集合对账；任一方向有漏项都不允许 live。
- 同一钱包在 activationBlock 前后各 mint 一枚，历史排除行优先，后者不能覆盖成 eligible。

### 三态开关

建议用一个 server-only mode，避免多个布尔组合失控：

```text
WALLET_RECIPE_MODE=off      不发现、不处理
WALLET_RECIPE_MODE=observe  发现并冻结资格/recipe，不上传、不发交易
WALLET_RECIPE_MODE=live     发现 + worker 全流程
```

- 未配置或非法值必须等同 `off` 并在 health 明示 misconfigured。
- Preview/Testnet 和 Production 分开设置。
- `observe` 是主网启用前的安全观察态，不得偷偷上传 token metadata。

---

## D1｜独立发现器

### 📦 范围

- `app/api/cron/process-wallet-recipe/discover.ts`
- `app/api/cron/process-wallet-recipe/route.ts`
- `src/features/wallet-recipe/recipe-v1.ts`
- C 的 register RPC migration（只在发现确有缺口时追加新 migration，不回改已执行 migration）

### 扫描策略

1. 从 `system_kv` 读取 P14 专属 Score token cursor；没有 cursor 时只允许初始化流程，不能从当前 head 猜起点。
2. 以 tokenId/区块严格递增扫描 Score mint；分批大小遵守现有 Alchemy 免费额度和已验证范围。
3. 对每个 mint log 读取/交叉核验 receipt、Score contract address、from=0、to、tokenId、block。
4. `block <= activationBlock` 写/确认 `excluded_prelaunch`；之后首个未登记 origin 计算 recipe 并原子 register eligible。
5. 同一批全部持久化成功后才推进 cursor；部分失败停在上一个完整位置。
6. 重跑同一批只命中唯一约束并返回既有行，不改变 source Score 或 recipe。

### 为什么不挂现有 Score 成功回调

- Score mint 主流程无需等待 P14 DB、Arweave 或合约。
- P14 代码故障不能把 Score queue 标成 failed。
- 独立 cursor 可从链上重放并恢复漏触发。
- 不在 `stepSetTokenUri` 加 fire-and-forget；Serverless 进程结束后该 promise 不具备 durable 保证。

### D1 验收

- P14 off 时请求只返回 disabled，不推进 cursor。
- observe 扫描新 mint，生成 eligible 行但不上传/不广播。
- 旧钱包、新钱包、同块多个 mint、同钱包并发两枚、DB 批次中途失败全部符合 Gate。
- 人为回退 cursor 重扫，行数/recipe/source 不变。
- 现有 Score cron 文件 diff 为零。

---

## D2｜metadata 构建与上传

### 📦 范围

- `app/api/cron/process-wallet-recipe/steps-media.ts`
- `app/api/cron/process-wallet-recipe/steps-metadata.ts`
- `src/features/wallet-recipe/metadata.ts`
- `src/features/wallet-recipe/clip-manifest.ts`

### preparing_media

- 共用封面路线：验证 E 冻结 image txid 的双网关 hash，写入 job 后推进。
- 唯一封面路线：用 recipe 纯函数生成 bytes，先存本地计算 hash，再上传；恢复时相同 recipe 必须得到相同 hash。
- 已有 `image_ar_tx_id` 时只验证/复用，不重复上传。
- 单网关传播期按 A 的有界策略等待；两个网关失败不推进。

### uploading_metadata

1. 从 job 读取不可变 recipe/origin/source Score。
2. 从 A manifest 选出 recipe unique keys，重新计算 duration。
3. 注入 E 冻结的 image、Decoder、路由和衔接版本。
4. 用 B 的 schema validator 自验，再规范序列化为稳定 bytes。
5. 上传前记录 metadata SHA-256；若 job 已记录 hash 但本次构建不同，进入 manual_review。
6. 上传后写 `metadata_ar_tx_id`，双网关取回 bytes 比较。
7. 生成 `token_uri=ar://<txid>`；同任务重跑不产生不同 metadata。

不得把当前 owner 写成 origin、把 queue UUID 放入公开 metadata、或用当前环境 clip map 替换 A v1 manifest。

### tokenId 路由分支

若 P14-0 冻结的 external_url 需要 tokenId，本步只能在 D3 mint receipt 后执行，并进入 `setting_uri` 两步合约方案。playbook 其他顺序相应反转；不得在代码中同时维护两条模糊分支。

---

## D3｜串行链上空投

### 📦 范围

- `app/api/cron/process-wallet-recipe/steps-mint.ts`
- `app/api/cron/process-wallet-recipe/shared.ts`
- `src/lib/chain/operator-lock.ts` 仅在现有 API 无法复用时最小扩展
- `src/lib/chain/wallet-recipe-contract.ts`

### 发交易前

- mode 必须为 `live`；observe 绝不进入本步。
- job 的 metadata hash/txid 已双网关验证。
- 读合约 `tokenIdByOrigin(origin)`：
  - 为 0 → 可继续。
  - 非 0 → 读取 owner/origin/tokenURI；若与 job 完全一致则恢复 DB 成功态，不再广播。
  - 非 0 但 URI/source 不能对账 → manual_review。
- `simulateContract` 成功后才发送。
- 仅在即将 `writeContract` 时获取现有 operator global lock；上传和 receipt 查询不占 nonce 锁。

### 广播幂等

沿用 Score 已验证的“三刀盖戳”：

1. `mint_attempted_at` 先用 lease CAS 写入。
2. `writeContract` 后立刻保存 `tx_hash`。
3. 以后只查该 hash receipt，不盲目重发。

- attempted 窗口内无 hash：等待，不重发。
- 超窗口仍无 hash：manual_review，并以 `tokenIdByOrigin` 作为首要恢复检查。
- 有 hash 无 receipt：在冻结超时前等待；超时 manual_review。
- receipt revert：记录确定失败原因；只有合约确认 origin 未铸且属于 safe 原因时才允许人工重开。
- receipt success：只解析新 P14 合约的 Transfer 与专用 origin event，写 tokenId/URI/success。

DB 写 hash 丢失但链上成功时不得第二次 mint；下次以合约 origin 映射恢复。

### 运营锁边界

- P14 与素材/Score 交易共用同一个全局 operator lock，不能各建 Redis key 导致 nonce race。
- 一次 cron 最多广播一笔运营钱包交易。
- receipt polling 不持锁；释放失败写日志并由 TTL 兜底。
- P14 的上传或网关等待不阻塞 Score 铸造拿锁。

---

## D4｜worker 编排与错误分类

### Route 单次职责

一次 cron invocation：

1. 校验 cron secret 和 mode。
2. 做一小批发现/推进 cursor。
3. 原子 claim 最老的一条 active P14 job。
4. 只执行该 job 的当前一个 step。
5. lease CAS 推进状态并释放。
6. 返回结构化 `discovered/processed/status/mode`，不泄露 secret。

发现失败与 worker 失败分别记录；发现失败不能把已 claim job 写坏，worker 失败不能推进发现 cursor。

### 错误分类

| 类型 | 例子 | 结果 |
|---|---|---|
| transient | 单网关 404、receipt 尚未出现、短时 RPC | 保持状态，下次继续，不乱加 retry |
| safe_retry | 上传明确失败且无 txid、构建前网络失败 | `retry_count+1`，使用同 recipe/hash |
| manual_review | 广播后 DB 丢 hash、内容 hash 漂移、origin 链上已占但不一致 | 停止自动处理 + 告警 |
| contract_rejected | origin 已铸、角色错误、空 URI | 先分类；预期防重可恢复，配置错误 manual_review |
| permanent_input | manifest/Decoder/image hash 不一致 | 全局停，不只失败单行 |

不得把错误都归为 retry 三次，也不得吞掉 Supabase error。

---

## D5｜监控、健康与人工恢复

### 📦 范围

- `app/api/health/route.ts`
- `src/types/tracks.ts` 或 P14 专属 health 类型
- `src/lib/alerts/resend.ts` 只复用现有接口，不改告警供应商
- `docs/MAINNET-RUNBOOK.md` 的 P14 运维章节（修改前若涉及架构裁决先取得授权）

health 增加：

- `walletRecipeMode`
- `activationBlock`
- `lastDiscoveryCursor` 与距链头差值
- active/failed/manual_review/success/excluded 分布
- oldest active age
- P14 contract configured/code exists/role 状态
- clip manifest/Decoder 配置是否存在（不在每次 health 下载 36 个音频）

告警：

- manual_review 首次出现立即发一次，避免每分钟重复轰炸。
- cursor 长时间不推进、有 active 积压、operator 低余额、合约角色缺失、永久输入 hash 异常。
- 告警内容含 job id、origin、source Score token、tx hash（若有）、恢复命令入口；不含私钥/env。

runbook 给出只读诊断顺序、合约映射恢复、确认安全后重开 safe job 的 SQL；不提供批量删除资格行的快捷命令。

---

## D6｜端到端测试矩阵

自动/测试环境至少覆盖：

1. 旧钱包排除；之后再 mint 仍不触发。
2. 新钱包首枚触发并最终 success。
3. 新钱包同一时刻两枚 Score，只有 tokenId 更早者成为 source。
4. 同一 source 重扫、并发发现、进程重启，recipe/job 不变。
5. metadata 上传失败后恢复，Score queue 原状态不变。
6. P14 mint revert/receipt pending/DB hash 丢失的恢复与 manual review。
7. P14 token 转出后 origin 再铸 Score，合约与 DB 均拒绝第二枚。
8. 新持有人能发现/播放，origin 不再显示当前持有。
9. mode off/observe/live 行为严格分离。
10. Score cron 在 P14 故障、积压和外部网关失败时仍可独立完成。

故障注入必须使用测试网/测试库或可回滚夹具，不在生产制造坏任务。

---

## Track D 完成标准

- 现有 Score queue route 与五步文件运行时 diff 为零。
- 链上日志 → origin/source/activation 的资格判定可重放且游标事务性。
- metadata bytes、image 与 recipe 在重试中稳定。
- operator 交易全局串行，上传/receipt 不占锁。
- 失败矩阵全部收敛到 success、safe retry 或 manual review，无双铸。
- health、告警、恢复 runbook 完整。
- `bash scripts/verify.sh`、Forge 和定向测试全绿。
- 更新状态后停在 P14-F；不得因 D 完成自动部署任何网络。
