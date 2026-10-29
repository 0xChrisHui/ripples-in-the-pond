# Phase 22 — Score 资产包（ERC-6551 代币绑定账户）

> 制定日期：2026-10-28；同日按 Codex（gpt-6-astra）只读审查意见修订（审查原文见 `reviews/2026-10-28-p22-playbook-codex-review.md`）。状态：执行计划，**尚未开发**。\
> 编号说明：P20（池塘气泡与手记）、P21（`/lens` 详情页）已占用；本需求排为 P22，开工顺序由用户定。\
> 基线：开工时从 `main` 最新提交新开分支 `feat/p22-score-pack`，不用 worktree。\
> 标"已核实"的事实均在 2026-10-23 至 10-28 会话里实际读链或读 Arweave 确认；标"未核实"的必须在 P22-0 查实并留证据后才能施工。

---

## 1. 一句话

用户铸造 Score 时可以勾选"开通资产包"；也可以在 `/score` 页面给已铸造的 Score 补开。开通后，这枚 Score 会有一个专属的 ERC-6551 账户（TBA），里面装着这首乐谱**实际用到的**音效和背景音乐，每种都新铸一份，**且这些素材锁在 TBA 里、不能单独转出**。另做一个精美的可视化页面，展示这枚 Score、它的 TBA 和里面的素材，并列出合约地址和交易哈希。

### 白话版

- Score 是钥匙，TBA 是按这把钥匙编号算出来的保险箱。谁持有 Score，谁就能指挥保险箱。
- 素材被"焊"在保险箱里：谁都不能把它们单独取出、单独买卖。保险箱跟着 Score 转手，素材也就跟着 Score 走。
- Score 本身**始终留在用户钱包里**，所以 Semi、OpenSea 对 Score 的展示不受影响。

### 为什么素材不可转让（用户 2026-10-28 定，方案 C）

可转让的素材无法保证"买包就有素材"：卖家在卖出 Score 前，可以让 TBA 对自己的另一个地址授权，卖出后用授权把素材取空；授权记录在素材合约里，不会随 Score 转手失效（ERC-721/1155 都一样，换标准无效）。素材改为不可转让后，该漏洞和"市场掏空"风险一并消失。代价：素材不能单独交易。

---

## 2. 已定的决策（用户 2026-10-23 至 10-28 拍板）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 链 | **OP 和 ETH 都做** |
| D2 | 谁付 Gas | OP：项目方代付；ETH：用户自付 |
| D3 | 一笔交易完成 | 两条链都用**开包合约**；"本次 `opened` 状态与全部素材铸造**共同成功或共同回滚**"。注意：Registry 部署 TBA 若发生在更早的交易里（任何人都能预先部署），不会被回滚，也不影响开包 |
| D4 | 与 Score 铸造的关系 | 先铸 Score，再开包（两笔交易）。**不改**已部署的 ScoreNFT / EthereumScoreNFT / MintOrchestrator |
| D5 | 放哪些素材 | 乐谱**实际用到的**音效 + 这首乐谱的背景音乐；数量不固定，用到多少铸多少，同一种音效只放 1 份 |
| D6 | 每个 TBA 的素材 | 每次开包都**新铸**，不共用；素材总量无上限 |
| D7（**2026-10-28 修订**） | 素材合约 | 音效与背景音乐各一个**不可转让 ERC-1155**：只允许"从零地址铸造到 TBA"，禁止转账、禁止 `setApprovalForAll`/授权、禁止 burn。不复用旧 MaterialNFT、P17 原曲合约、OP 原曲 SBT |
| D8 | 新合约数量 | **6 个**：每条链各 1 个音效合约、1 个背景音乐合约、1 个开包合约 |
| D9 | 安全 | 两条链同样防护：服务端签名凭证 + 合约验签 + 持有人校验 + 每枚 Score 只能开一次 |
| D10 | 用户自付开包 | 两条链合约都支持用户钱包直接调用；**OP 的用户自付按钮先不开放**，未来只加前端 |
| D11 | /me 勾选框 | 待铸造卡片上可选，默认不勾；勾选后 Score 铸成功即自动进入开包流程 |
| D12 | /score 补开按钮 | 没开过的 Score 显示"开通资产包"；已开通则不显示。只有当前持有人能点 |
| D13 | OP 代付防滥用 | 每枚 Score 链上只能开一次 + 服务端幂等 + 单日上限 |
| D14 | 可视化 | TBA 结构图 + 合约 / 地址 / 哈希信息，优雅精美；接 P19 中英双语 |
| D15 | ETH 钱包确认次数 | 勾选时共 2 次：铸 Score 一次、开包一次。OP 用户不需要额外确认 |
| D16 | 市场风险 | 采用方案 C（见 §1）；不再承诺也不再需要"防掏空"展示，但页面仍显示开包清单与当前余额（读链真值） |

暂不处理：OP 代付钱包余额耗尽的告警与降级（用户 2026-10-28 说先不管），沿用现有余额监控。

---

## 3. 合约清单

### 3.1 新部署（每条链各 3 个，共 6 个）

| 合约 | 标准 | 职责 | 铸造权限 |
|---|---|---|---|
| `PondSoundNFT`（名称待定） | ERC-1155，**不可转让** | 音效素材，每个不同的音效文件一个 tokenId | 只给本链开包合约 |
| `PondTrackNFT`（名称待定） | ERC-1155，**不可转让** | 背景音乐，tokenId 见 §4.5 | 只给本链开包合约 |
| `ScorePackOpener`（名称待定） | 普通合约 | 验凭证 → 创建 TBA → 铸素材进 TBA | 无（它是调用方） |

三个合约都**不可升级**。"不可升级"只指这三个项目合约，**不等于 TBA 不可升级**（见 §3.2）。

#### 角色（必须分开，两条主网同样强制）

| 角色 | 谁 | 能做什么 |
|---|---|---|
| admin | 现有独立 admin 钱包（本地保管） | 管理角色、恢复暂停；**不得**同时持有 signer / operator / 素材 minter |
| signer | 服务端凭证签名钥匙（**独立于** operator） | 只签凭证 |
| pauser | 可与 admin 分开的应急钥匙 | 暂停 `open` 与素材铸造 |
| operator | OP 代付提交者（现有铸造热钱包） | 只提交交易，无特殊合约权限 |
| 素材 minter | **只有本链开包合约** | 铸素材 |
| deployer | 部署用临时钱包 | 部署后必须放弃所有角色（读回验证） |

- 现有 `contracts/script/DeployBase.s.sol:28` 的角色红线**只在 `chainid == 10` 生效**，以太坊主网会回退到 deployer 当 admin。P22 部署脚本必须在**两条主网**都强制校验上表，并在 Foundry 里测试"admin 不能经 `grantRole` 给自己铸造权"（或明确 admin 的角色管理权并留证据）。
- 补测试：signer 撤销与轮换、暂停与恢复。
- **应急预案（写入 P22-0 冻结表）**：signer 钥匙泄露不会直接取得任何 TBA 控制权，但可能给真实 Score 签发错误的素材包，永久消耗那枚 Score 唯一的开包机会。处置：pauser 立即暂停 → 轮换 signer → 评估已被错误开包的 Score；链上无法撤销已开包，只能公告。凭证有效期设短，降低窗口。

### 3.2 直接复用，不部署

| 项 | 地址 | 状态 |
|---|---|---|
| ERC-6551 Registry | `0x000000006551c19487814612e58FE06813775758` | **已核实**：OP 主网与 ETH 主网均有代码 |
| TBA 账户 | 见下 | **结构未冻结** |
| OP ScoreNFT | `0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA` | 不改 |
| ETH EthereumScoreNFT | `0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A` | 不改 |

**TBA 结构未冻结（Codex P0-1，已部分核实）**：
- 候选 `0x41C8f39463A868d3A88af00cd0fe7102F30E44eC` 两条主网有代码、长度一致，但我此前把它当成"传给 Registry 的 implementation"是**不准确**的：Tokenbound 官方推荐传给 Registry 的是 AccountProxy `0x55266d75D1a14E4572138116aF39863Ed6596E7F`（两条主网均有代码，已核实），`0x41C8…` 更可能是它指向的初始化逻辑。
- 代理有独立 `initialize`，账户本身**可升级**；AccountV3 的 ERC-1155 回调允许 override。
- P22-0 必须冻结并留证据：①传给 Registry 的 implementation 地址及完整代理层级；②初始化要求、已初始化账户如何处理；③升级权限与 guardian/执行权限（升级不会让素材可转出，因为素材合约本身禁转让，但要写明）；④源码版本与两条链 runtime code hash；⑤两条测试网同样的核对；⑥确认能接收 ERC-1155。

### 3.3 为什么不能复用现有素材合约

- OP `MaterialNFT`（`0x03504aeb…a299`）：链上 `uriFrozen() = true`；它的 Arweave 目录只有 token 1–35 的 metadata，36、109、134 请求均 404。结论收窄为：**这些音效编号当前没有可用的永久 metadata，且 URI 已冻结无法补**。该合约的 `mint` 本身不限制 tokenId 范围（`contracts/src/MaterialNFT.sol:34`），但我们不用它：它可转让，且 URI 不可改。
- ETH `EthereumMaterialNFT`（P17）：原曲合约，每钱包每首只能领一次，规则不合。
- OP 原曲 SBT（P17）：绑定持有人，不是绑定 TBA，且无音效。
- 相关"已核实"依据是 2026-10-23 至 10-28 会话里的 RPC 与 Arweave 请求；P22-0 要补上区块高度、runtime hash 和查询范围的记录。

---

## 4. 开包合约规则

### 4.1 凭证（EIP-712，服务端签名）

| 字段 | 类型 | 含义 |
|---|---|---|
| `scoreTokenId` | uint256 | 哪一枚 Score |
| `holder` | address | 签发时的当前持有人 |
| `trackTokenId` | uint256 | 背景音乐的 P22 tokenId（见 §4.5，不是 catalog UUID） |
| `soundIds` | uint256[] | 音效 tokenId，**升序、不重复、非空、数量有上限**（上限 P22-0 定） |
| `deadline` | uint256 | 过期时间，取短 |

以下内容**在合约构造时固定**，不进凭证，但 P22-0 要写明绑定方式：Score 合约、两个素材合约、Registry、TBA implementation、salt。链 ID 与开包合约地址由 EIP-712 domain 绑定，凭证不能跨链、跨合约复用。

- 照 `contracts/src/EthereumScoreNFT.sol` 的写法：OpenZeppelin 4.9.6 `EIP712` + `SignatureChecker`，不手写密码学。
- 但 P16 的结构体只有标量字段，`soundIds[]` 需要显式编码：P22-0 冻结字段类型、TYPEHASH、domain name/version、数组哈希方式，并产出 **Solidity / viem 共用测试向量**，服务端、前端、合约用同一组向量对照。
- 没有 nonce 不是漏洞：在固定 Score 合约与固定 opener 下，`opened[scoreTokenId]` 足以阻止重复成功开包。但**续签不会撤销旧凭证**，Score 经 A→B→A 转回后旧凭证可能重新满足持有人检查。因此"转走自动失效"只指"执行时所有权检查"；P22-0 决定是否要加撤销 epoch，否则靠短有效期与 signer 轮换兜底。

### 4.2 `open(凭证, 签名)` 依次检查

1. 合约未暂停；
2. 签名来自有效 signer；
3. 未过期；
4. `ScoreNFT.ownerOf(scoreTokenId) == holder`；
5. `opened[scoreTokenId] == false`；
6. 素材列表格式合法，且每个 ID 在素材合约里已登记（未知 ID 拒绝）。

通过后：标记 `opened = true`（**先置位**）→ Registry `createAccount`（账户已存在时规范 Registry 直接返回地址，不重建、不重新初始化）→ 铸 1 份背景音乐到 TBA → `mintBatch` 各音效 1 份到 TBA → 发出 `PackOpened`（Score、TBA、持有人、素材列表、调用者）。

- `open` 加 `nonReentrant`；不得吞掉任何 mint 失败；失败时 `opened` 与两种素材余额必须一并回滚（有测试）。
- 暂停范围：只暂停 `open` 与素材铸造（素材合约本就禁转让，暂停不涉及转账）。
- 对账**不能要求本次一定出现** `ERC6551AccountCreated`（TBA 可能早已存在）；以 `opened` 与 `PackOpened` 为准。

### 4.3 为什么"谁都能提交"是安全的

`open` 不限制调用者：项目方 operator（OP 代付）和用户钱包（ETH 自付、未来的 OP 自付）调用同一函数。安全性来自凭证：

- 凭证固定了"哪枚 Score、哪些素材"，提交者改不了；素材只进**这枚 Score 自己的** TBA，提交者拿不到任何东西；
- 凭证被别人抢先提交，结果与本人提交相同，只是对方替你付了 Gas。
- 但本人此后广播的同一笔交易会 revert 并**白付 Gas**。UI 提交前要先读 `opened`，提交后按链上状态恢复，不当成失败。

### 4.4 素材合约：不可转让

- 只允许 `from == address(0)` 的铸造；`safeTransferFrom` / `safeBatchTransferFrom` / `setApprovalForAll` 一律 revert；不提供 burn。
- 只有开包合约能铸；admin 不能铸，也不能通过 `grantRole` 绕开（对应 §3.1 测试）。
- 实现用 OpenZeppelin 4.9.6 ERC1155 覆盖钩子，不手写转账逻辑；参考 P17 `OptimismOriginalSBT.sol` 的做法并核对其与本需求的差异。
- 铸造进的接收方必须是 TBA 地址（开包合约保证），而不是任意地址。

### 4.5 编号与映射

- **背景音乐 tokenId 不等于 catalog trackId。** catalog 的 `trackId` 是 UUID（`src/lib/music-catalog/validate.ts:40`），还有展示编号 `displayNumber` 和各部署的 tokenId，三者不可混用，不得 `BigInt(trackId)`。
- 冻结映射：`catalog UUID → P22 uint256 tokenId → 背景音频永久身份`；数据库保留原 UUID，凭证字段叫 `trackTokenId`。背景音乐按 Score 永久包里的 `base` 身份反查 catalog，**不靠标题匹配**。
- 音效 tokenId：**只追加，不重排旧 ID**。覆盖"历史 Score 实际用过的有效音效"与"当前完整 33 音效集"（避免未来首次使用的音效没有身份）。是否允许未来新增声音、URI 如何永久固定，P22-0 决定；两条链共用同一内容映射，但资产身份始终含链与合约。
- ERC-1155 `{id}` URI 规则沿用 `src/lib/music-catalog/identity.ts:36` 的 64 位十六进制处理。

### 4.6 TBA 地址派生

冻结五元组 `implementation、salt、block.chainid、固定 Score 合约、tokenId` 与 Registry 地址；salt 用固定零值但须写明。合约、服务端、前端共用测试向量，以 Registry `account()` 对照。错误的 chainId 会得到无法由本链 Score 控制的另一个地址。

### 4.7 必须测试的边界

- TBA 已被别人预先部署 → 开包仍成功；
- 同一枚 Score 第二次开包 → 拒绝；
- 凭证签发后 Score 转走 → 拒绝；A→B→A 后旧凭证行为符合 P22-0 冻结的策略；
- 过期、错误签名者、跨链复用、篡改素材列表、未登记素材 ID、列表超限 → 拒绝；
- **素材转让路径全部被拒**：TBA 自己 `execute` 转出、`setApprovalForAll`/授权、第三方转移、burn——全部 revert；Score 转手后新旧持有人都无法转出素材；
- 重入：同包与跨包回调重入、TBA 拒收、第二次 mint 失败 → `opened` 与余额整体回滚；任一素材合约暂停；
- Score 自持有、Score 转进预部署地址、循环持有（`opened` 之后）不破坏合约状态；
- TBA 实现能收 ERC-1155（`onERC1155Received` / `onERC1155BatchReceived`）；
- 最大列表 gas（含新部署与已部署两种 TBA）；OP 另测 L1 data fee。

---

## 5. 两条入口

| | OP | ETH |
|---|---|---|
| 谁提交交易 | 项目方 operator，沿用现有**全局串行锁** | 用户当前外部钱包，沿用 P16 的 Privy provider + viem |
| 是否等待回执 | 不在 HTTP 请求里等；cron 对账 | 同 P16：按事件对账，`txHash` 只是加速提示 |
| 勾选后体验 | Score 铸成功后自动入队，用户无需操作 | Score 确认后弹出第二次钱包确认；取消则 Score 不受影响，之后可在 `/score` 补开 |
| 失败 | 队列可重试（次数有上限），状态可见 | 订单保留，可重新签发凭证 |

OP 与 ETH 是独立执行路径，不得把 ETH 状态塞进 OP 队列（沿用 P16 规则）。**链上真值优先**：按钮是否显示以 `opened(scoreTokenId)` 为准，数据库只用于展示进度。

### OP 执行语义（写成可测规则）

- 使用与现有 Score/素材/Pond Echo worker **同一把锁**（`src/lib/chain/operator-lock.ts`，有 TTL 与续期）；订单 CAS 租约；续期失败立即停止后续广播；**发送意图先落库**，未知结果先对账再重发。
- 单日上限：定义时区、全局/用户范围、原子预占、失败如何计数；自动重试次数有限（链上只能开一次，但失败交易仍烧 operator Gas）。
- 测试：与旧 Score、素材、Pond Echo worker 并发运行不互踩。

---

## 6. 数据

- 新表 `score_pack_orders`（名称待定）。**唯一约束**：`(chain_id, score_contract, token_id)` 同时只有一个进行中订单。订单固定 opener、凭证 digest 与素材身份。
- 状态：`queued` / `awaiting_wallet` / `unsent`（未发送）/ `submitted_unknown`（已发送结果未知）/ `confirming`（确认中）/ `opened` / `reverted`（确定失败）/ `abandoned`（超时、取消或失去所有权）。进行中订单不得因旧持有人取消或转走 Score 而长期阻塞新持有人：需超时与失去所有权规则、替换交易规则、确认数规则。
- 恢复优先按 `opened + PackOpened` 事件，不只依赖用户 hash；不把"开包后的当前 owner / 余额"当历史成功条件。可参考 `src/lib/self-mint/reconcile.ts:48`，但其 owner 校验不能照搬。
- **勾选意图要持久化**并绑定原 Score 订单，否则关页后 OP 自动开包会丢。
- migration 编号接在当时 `main` 最大编号之后（2026-10-28 为 `062`）；先写测试库；正式库 migration 属用户 Gate。

---

## 7. 界面

### 7.1 `/me` 待铸造卡片

- 可选勾选框"同时开通资产包"，默认不勾；说明会放入什么（"这首乐谱用到的 N 个音效 + 背景音乐"）、素材不可单独转让、ETH 需多确认一次并自付 Gas、OP 免费。
- 勾选只影响"Score 成功后是否自动开包"，不影响 Score 铸造。

### 7.2 `/score` 页面

- 未开通：显示"开通资产包"，仅当前持有人可见可点。进行中：显示进度，无按钮。已开通：按钮消失，改为"查看资产包"。
- 适用所有已铸 Score，包括 OP 历史 Score 与 ETH Token #1。

### 7.3 可视化页面

- 路由建议 `/score/[id]/[contract]/[tokenId]/pack`（沿用现有多链路由；注意多链路由里 `[id]` 实际是 chainId，与旧 `/score/[id]` 的 tokenId/UUID 含义不同，实施时在代码注释里写明）。P22-0 最终确定。
- 图形：Score（母）→ TBA（账户）→ 背景音乐 + 各音效（子）的层级，强调"钥匙与保险箱"。
- 信息：Score 合约与 tokenId、当前持有人、TBA 地址、是否已部署、各素材合约与 tokenId、开包交易哈希与区块、浏览器链接。
- 数据以链上读取为准（Registry `account()`、`getCode`、`balanceOfBatch`、`PackOpened`）。**展示范围限定为"P22 素材及其余额"**（`balanceOfBatch` 只能查已知 ID，无法枚举 TBA 的所有外来资产）；同时显示"开包时铸入清单"与读取区块。
- 未开通的 Score 也能打开该页，展示"可开通"预览（TBA 地址可提前算出）。
- 视觉沿用夜塘语言，必须用户目验；全部文案进 next-intl 词典。

---

## 8. 签发接口：素材清单由服务端派生

签发接口**绝不接受客户端提交的素材清单**。清单由服务端按链路派生：

按链与合约枚举 Score → 核验其永久 metadata / package（或历史兼容资料，注意播放优先采用 `compatibility.effectiveSounds`，见 `src/data/score/snapshot-contract.ts:88`）→ 提取 events 使用的键 → 应用"有效 sounds 映射" → **按音频 SHA-256 去重** → 映射 P22 音效 tokenId；背景音乐按 `base` 身份反查。

- 不能只按按键字母：Score #1 用旧音效，#2–#4 用修复后的当前音效；当前 33 个加 #1 用过的旧音效已有 **46 个不同 SHA-256**（本地资料统计，不是两链全量）。
- `src/lib/sound-set.ts` 只定义当前按键和本地路径，`ScorePackageV3`（`src/lib/score-package/types.ts:22`）只保存资源引用，二者都不直接给出"已用素材 ID"，所以必须走上面的解析链。
- 资料缺失 → 拒签并列出缺口，不静默跳过。

---

## 9. 施工步骤

每步完成后按 AGENTS.md §4 验证、更新台账，等用户说"继续"。

| 步 | 内容 | 产出 / Gate |
|---|---|---|
| **P22-0 查实与冻结** | ①冻结 TBA 结构（§3.2 六项，两条主网与两条测试网）；②冻结凭证编码、测试向量、TBA 地址派生、撤销策略；③盘点两条链所有已铸 Score 的音效与背景音乐（§8 解析链），分配 tokenId，建 UUID 映射；④定合约名称/symbol、素材 metadata 与图片方案；⑤定包的音效数量上限、凭证有效期、OP 单日上限与重试次数；⑥角色表与应急预案落成冻结表；⑦Foundry 测试如何拿到 Registry（**fork 测试**，固定 RPC、区块与代码身份，不可静默跳过；若需 `forge install` 新库则停下问用户）；⑧目录与既有 verify 失败的处理（见下） | `05-frozen-decisions.md`；**用户批准后**才进入 A |
| **P22-0b 同步规则文档** | `docs/ARCHITECTURE.md` 决策 6、7 写着"TBA 未实装、要新部署 MintOrchestrator"，与 D4 冲突；`docs/STACK.md:33`"非 ScoreNFT 资产 OP-only"；`docs/CONVENTIONS.md:71` 的钱包写入例外限定 P16 `redeem`。区分"调用已部署的账户"与"导入其依赖"：官方 AccountV3 源码带 ERC-4337 能力，不能复制其整套依赖后仍声称未涉及黑名单；P22 只走普通交易路径，不引入 SDK / Bundler / Paymaster | 按 AGENTS.md §5，改这些文件前**停下请用户确认** |
| **P22-A 合约** | 三个合约 + 部署脚本（两主网强制角色校验）+ §4.7 全部测试 | `forge test` 全绿 |
| **P22-A2 测试网部署** | OP Sepolia 与 Ethereum Sepolia 部署，**放在 C/D/E 之前**，让后续浏览器实测有真实合约 | 逐项 Gate |
| **P22-B 素材永久资料** | 音效与背景音乐 metadata、图片上传 Arweave；音频复用已有 Arweave 文件 | 上传前报成本，**用户批准** |
| **P22-C 服务端** | 凭证签发（登录者必须是当前持有人）、`score_pack_orders` migration、OP 队列 + cron 对账、ETH 订单对账、幂等与单日上限 | 测试库 migration；单测 |
| **P22-D 界面** | `/me` 勾选框、`/score` 按钮与进度、ETH 第二次钱包确认 | 浏览器实测 |
| **P22-E 可视化页面** | §7.3 | **用户目验** |
| **P22-F 测试网验收与回归** | 勾选铸造、补开、重复开包被拒、转手后控制权转移、素材无法转出、hash 漏报恢复、换账户/换链、取消第二次确认、双链同 tokenId 隔离；回归 OP / 邮箱 / SEMI / P14（P14 按固定 Score 合约的 mint `Transfer` 发现资格，见 `app/api/cron/process-wallet-recipe/discover.ts:136`，确认 P22 不触碰其事件源与游标）/ P16 / P19（无路由语言切换、不中断播放）；Semi 里 Score 展示不变（实测） | 验收报告 |
| **P22-G 主网** | 两条主网部署 6 个合约、授权、源码验证、正式库 migration、生产配置、首个真实开包 | **每一项都是用户 Gate** |

**目录约束**：`src/lib/self-mint` 已 9 文件、`src/types` 已 10 文件、Score `[id]` 及其 components 均已 8 文件，`verify.sh` 已有这两项旧失败。P22 新代码一律放新子目录（如 `src/lib/score-pack/`），不往这些目录加文件；P22-0 记录基线失败项，避免与 P22 引入的问题混淆。

---

## 10. 红线与不做

- 不改、不重部署 OP ScoreNFT、ETH EthereumScoreNFT、MintOrchestrator、旧 MaterialNFT、P17 原曲合约；
- 不改 ETH Token #1 及任何已铸 Score 的 metadata；
- 不把 Score 转进任何 TBA（项目侧不操作；外部钱包仍可能这么做，见 §11）；
- 不引入 ERC-4337 能力的**自有**实现、Bundler、Paymaster 或 `@account-abstraction/*`（STACK 黑名单）；
- 不新增 npm 依赖；不引入 `wagmi` / `ethers`；
- 不改 Semi 侧；不改 P14 Pond Echo；不改 `/test1`；
- 单文件 ≤220 行（route.ts 270），单层目录 ≤8 文件；
- push、部署、正式库写入、Arweave 付费上传、主网交易均需用户逐项放行。

---

## 11. 已知后果（需让用户知情）

- **素材不能单独交易**：这是方案 C 的取舍。素材跟着 TBA 走，TBA 跟着 Score 走。
- **Semi 里看不到资产包内容**：素材的持有人是 TBA 地址，不是用户钱包；Score 本身照常显示。这是推断，P22-F 实测确认。
- **同一首曲子会有多套 NFT 身份**：旧 OP MaterialNFT、P17 原曲、P22 背景音乐各一套；界面写明 P22 背景音乐是"资产包里的素材"。
- **TBA 可升级**（若采用官方代理结构）：升级不能让素材转出，但会改变 TBA 自身的行为，要在 P22-0 写明权限归属。
- **Score 仍可被外部转进 TBA、形成循环持有**：合约状态不受损，但这类 Score 会在"按持有人展示"的地方看不到（P22-F 验证）。
- **第三方抢先提交凭证**：不改变结果，但本人随后广播的交易会 revert 并白付 Gas（§4.3）。
- **素材总量随开包数增长**，无上限。
- **OP 代付依赖铸造钱包余额**：耗尽时 OP 开包暂停，订单留在队列，充值后继续。
- **成本估算（2026-10-23 行情，未实测）**：OP 每包（20 个音效）约 $0.002；ETH 在 0.05 gwei 时约 $0.10，高峰期可能达数十美元，必须实时报价。P22-A 用 fork 实测后替换。
