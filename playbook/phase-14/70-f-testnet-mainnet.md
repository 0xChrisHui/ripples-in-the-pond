# P14-F — OP Sepolia E2E、主网部署与渐进启用

> **目标**：用真实链、真实 Arweave 和真实浏览器证明全链路，再分两道用户 Gate 部署与启用 OP Mainnet。
> **前置**：A–E/D 全部完成，永久资源已冻结，完整本地验证为绿色。
> **红线**：测试网通过不自动授权主网；主网部署通过不自动授权 live。

---

## F0｜发布前真值审计

### 工作树与代码

1. `git status --short` 保存到证据，区分 P14、P11 未提交改动和用户素材。
2. P14 每个运行时代码文件 ≤220 行、route ≤270 行、目录 ≤8 条目。
3. 无新黑名单依赖、前端私钥 import、普通 API receipt wait、TODO/占位/mock 运行时数据。
4. ScoreNFT、现有 MintOrchestrator、Score queue route 与永久 Score metadata 无 P14 功能性改动。
5. 首页构建产物不包含 P14 player/36 音频表/详情视觉 runtime。

### 永久输入

- 36 clips、clip manifest、Decoder、共用封面或封面生成版本的 txid/hash 全冻结。
- 双网关重新抽查全部 JSON/HTML和 36 音频；若外部网关正在故障，F0 标为阻塞而不是沿用旧截图假通过。
- 固定 recipe 测试向量仍与 B 一致。
- metadata schema、Decoder query 和站内 parser 对同一测试向量逐字段一致。

### 环境与资金

- OP Sepolia/Mainnet RPC chainId 分别读回 11155420/10。
- deployer、admin、operator 三地址逐一打印公开地址并确认互不混用；不打印私钥。
- operator/deployer 余额满足部署、测试空投、失败缓冲和 Score 正常运营底线。
- Turbo 余额满足测试 metadata/封面和首批生产任务。
- Supabase/Vercel/Upstash/Resend 权限与额度复核；保留 P12 已有全局 operator lock。

F0 任一硬项失败即停，不通过临时改正式 schema 或跳验证赶部署。

---

## F1｜OP Sepolia 部署

### 🛑 Gate F1-start

需要用户明确允许：测试 migration、OP Sepolia 合约部署、测试角色交易、测试 Arweave token metadata，以及 Development/Preview 环境变量修改。

### 顺序

1. 对测试数据库做可恢复快照/记录行数。
2. 执行 Phase 14 migrations，读回表、约束、索引、RPC、RLS。
3. 部署新 P14 ERC-721 到 OP Sepolia。
4. 在 explorer/Etherscan V2 验证源码和构造参数。
5. admin 给 operator/minter 授 `MINTER_ROLE`；读回 true。
6. 如果 deployer 有临时角色，按 P14-0 规则撤销并读回 false。
7. 配置 Development/Preview 新合约地址与永久 txid，mode 保持 `off`。
8. redeploy 后 `/api/health` 显示 chain、contract code、role、mode 与 DB 正常。

每笔交易记录 hash、block、from、to、用途和 receipt；不只保存命令行成功文字。

---

## F2｜测试网资格与空投 E2E

### 测试钱包

至少准备：

- W0：activation 前已有 Score，验证排除。
- W1：全新地址，验证首枚触发。
- W2：全新地址，验证并发两个 Score 只认首枚。
- W3：作为受让人，验证当前持有人发现。
- Receiver 合约：验证 safeMint 不可接收时整笔回滚（若 C 测试已足够可不真实部署）。

钱包只用测试私钥；不得拿主网 admin/operator 私钥做浏览器登录。

### 启用演练

1. 记录当前测试网 head 为 activationBlock，冻结比较符号。
2. 扫描历史 mint 基线并写 W0 excluded；链/DB 集合一致。
3. mode=`observe`：W1 首铸 Score，发现 eligible + recipe，但零 metadata 上传、零 P14 tx。
4. 重扫/重启/并发触发，W1 仍一行同 recipe。
5. mode=`live`：worker 依次完成 media/metadata/mint，W1 收到一枚。
6. W1 再铸 Score，数据库无第二行，合约直接 mint 也拒绝。
7. W1 转给 W3；W3 页面能发现和完整播放，W1 不再显示当前持有。
8. W1 再铸仍不能获得第二枚；origin/provenance 不因转让改变。
9. W2 同时/快速铸两枚 Score，source 固定为链上更早 tokenId。

### 永久性验证

- 从测试 P14 token 的链上 tokenURI 开始，不使用 DB，恢复 metadata/recipe/clips/Decoder。
- 站内与永久 Decoder 完整播放 36 段，当前 key 和结束时刻一致。
- 改本地 clip/decoder env 后重载，已铸 token 仍使用永久版本。
- tokenURI、metadata bytes、image/manifest/Decoder 双网关 hash 留档。

### 故障演练

- metadata 首次上传失败后恢复，同 recipe/同 image bytes。
- 单网关失败自动切换；双网关失败保留任务不广播。
- mint 广播后进程中断：用 tx hash 或 origin mapping 恢复，不双铸。
- receipt 延迟、lease 过期、stale worker、cursor 回退、operator 锁忙。
- P14 全局失败时再铸一枚 Score，Score 仍独立成功。

### F2 通过

- 全部钱包场景与失败矩阵有链上/DB/浏览器三类证据。
- 测试产生的 eligible/excluded/token 数量可逐项解释，无孤儿 metadata 或未知交易。
- `bash scripts/verify.sh` 全绿。

---

## F3｜浏览器与长期播放验收

### 路由矩阵

| 场景 | 375 | 390 | 768 | 1024 | 1440 |
|---|---:|---:|---:|---:|---:|
| 首页无持有/有持有 | ✓ | — | ✓ | — | ✓ |
| `/me` eligible/processing/failed/success | ✓ | — | ✓ | — | ✓ |
| 详情 idle/loading/playing | ✓ | ✓ | ✓ | ✓ | ✓ |
| pause/resume/ended/replay | ✓ | ✓ | ✓ | ✓ | ✓ |
| origin 与 current owner 分离 | ✓ | — | ✓ | — | ✓ |
| 无 DB 链上灾备 | ✓ | — | ✓ | — | ✓ |
| 单/双网关错误 | ✓ | — | ✓ | — | ✓ |
| reduced-motion/无 WebGL | ✓ | — | ✓ | — | ✓ |

### 长测

- 三个不同 recipe 各完整播放一次，至少一个 36 unique 最坏夹具。
- 前后台切换、锁屏/恢复（真机可用时）、耳机中断、路由离开返回。
- 20 次快速播放/暂停/重播后无重复音、幽灵 source、RAF 或 fetch。
- 长时间内存趋稳；路由销毁后 AudioContext/source/visual runtime 归零。
- 视觉逐段变化不遮控制、不造成高频闪烁；E0 批准方向在手机和桌面都成立。
- 200% 缩放、键盘、触控、screen reader 状态文本可用。

用户完成 E 视觉终验前，F3 不能仅靠自动截图标绿。

---

## F4｜主网部署准备

### 数据快照与 activation 计划

- 记录 ScoreNFT 主网部署块、当前最新 tokenId、全部 `Transfer(from=0)` origin 集合。
- 从数据库提取已 mint Score 的钱包集合，与链上逐项对账；差异必须归因并清零。
- 预生成 `excluded_prelaunch` 计划但**不先写错误 activationBlock**。
- 定义 activationBlock 设置时序：部署/角色/env/observe 健康后，取一个已确认 head 作为 cutoff；资格从下一块开始（若 P14-0 拍板其他规则，以最终规则为准）。
- 记录回滚：mode 改 `off` 可停止发现/空投；已部署合约和已上传内容不可删除。

### 主网配置清单

- 合约 name/symbol/admin/minter/Enumerable/royalty/burn 与 P14-0 一致。
- `.env.example`、Vercel 三环境、runbook 中变量名一致；Production 默认 off。
- 主网 migration SQL/hash、部署 bytecode/hash、编译器/optimizer 与测试网一致。
- Etherscan 验证命令、role grant/revoke、read-back、health、首枚 smoke 命令全部预写准确地址槽位。
- operator/deployer 余额与告警阈值重新确认。

### 🛑 Gate F4-deploy-mainnet

向用户展示：测试网报告、最终合约 diff/hash、永久资源表、预计 gas、admin/minter 地址、Production 仍 off 的证明。用户明确说“允许部署 P14 主网合约”后才广播。

---

## F5｜OP Mainnet 部署，但保持 off

1. 做生产 DB 快照并记录恢复点。
2. 执行 migration；读回 schema/约束/RLS，表初始为空。
3. 部署合约，等待 receipt，核对 bytecode/构造参数。
4. Etherscan 验证源码。
5. admin 授 operator minter；逐项 read-back。
6. 撤销 deployer 临时权限（按拍板），再次 read-back。
7. 配 Vercel Production 地址与永久资源，`WALLET_RECIPE_MODE=off`。
8. redeploy；health 证明 code/role/db/资源配置正确且 discovered=0、mint=0。
9. 浏览器打开不依赖 token 的入口与空态；不得为了 smoke 手工绕过资格铸一枚。

F5 完成只代表“主网设施存在”，不代表已上线。

---

## F6｜主网资格基线与 observe

### 🛑 Gate F6-activation

向用户展示最新链/DB 历史集合一致、拟定 activationBlock、当前 head、安全回退和第一位真实用户处理方式。收到“允许写 cutoff 并进入 observe”后继续。

### 顺序

1. 选定并记录已确认 activationBlock；写 `system_kv` 和 Production env/配置真值。
2. 从部署块至 cutoff 扫描全部历史 origin，写 `excluded_prelaunch`。
3. 再做链/DB/排除表三方计数与集合校验。
4. mode 切 `observe`；部署后验证不发 P14 tx、不上传 token metadata。
5. 若 cutoff 后出现新首铸，确认 eligible/source/recipe 正确并停留 pending。
6. observe 至少覆盖若干次 cron 周期；cursor、积压、告警、Score 主流程正常。

发现任何历史钱包被标 eligible，立即 mode=off，不能人工把它改成“反正送一枚”。

---

## F7｜live 与首枚真实空投

### 🛑 Gate F7-live

用户查看 observe 证据和待处理首个 origin/source Score 后，明确说“允许 P14 live 与首枚真实空投”。没有 eligible 任务时不得制造假用户或给历史钱包补发。

### 首枚流程

1. mode 切 live 并 redeploy/read-back。
2. 每次 cron 只观察一个状态推进；记录 media hash、metadata txid、mint tx、receipt、tokenId。
3. 从链上 tokenURI 独立取回所有永久输入，双网关 hash 一致。
4. 原钱包首页/档案发现；桌面和手机完整播放。
5. 合约 `tokenIdByOrigin`、DB origin、metadata origin、Score source 四方一致。
6. 原钱包再次触发路径被拒；不要为验证主网防重而真实多铸 Score，优先只读/测试网证据。

### 24h/7d 观察

- cursor 距链头、active age、manual_review、operator 余额、Turbo 余额、cron 成功率。
- 每个新 origin 只有一行/一枚；excluded 无错误触发。
- Score queue 吞吐和错误率与启用前基线无明显退化。
- permanent Decoder/manifest 随机抽查双网关。
- 转让发生时当前持有人发现逻辑与 origin 资格保持分离。

严重异常：先 mode=off 停止新发现/空投，保留行、tx 和 cursor；不删除、不回退 cutoff、不换 recipe。

---

## F8｜最终报告与收口

最终 review 至少包含：

- 合约地址、部署/验证/角色交易、activationBlock。
- 36 段/manifest/Decoder/image 的 txid 与 hash 总表链接。
- 测试网完整矩阵和首枚主网空投证据。
- chain/DB/metadata/player 对账结果。
- 五视口、完整播放、转让、灾备、reduced-motion、性能证据。
- 失败演练与人工恢复路径。
- 所有 deferred/soft gate 真实状态；外部服务故障不得写成已通过。

然后运行：

```bash
bash scripts/verify.sh
```

更新 STATUS、TASKS、LEARNING、必要的 ERRORS/JOURNAL；未经用户说 `commit / 发布` 不擅自提交或推送。

---

## Phase 14 Definition of Done

- 只有 cutoff 后真正首次 Score mint 的 origin 获得资格。
- 一 origin 终身最多一枚；转让/烧毁/重试不释放资格。
- 每枚 token 能从链上 + Arweave 独立恢复 recipe 和 36 段播放。
- Score 主流程在 P14 off、故障和积压时均不受影响。
- 站内与永久 Decoder 顺序/衔接一致，桌面手机完整播放。
- 所有永久资源、合约和启用操作均经过对应用户 Gate。
- 自动验证、Forge、浏览器、OP Sepolia、OP Mainnet 首枚 smoke 全绿并有证据。
