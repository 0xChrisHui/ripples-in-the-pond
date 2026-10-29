# P22 playbook 只读审查（Codex gpt-6-astra, high）

> 2026-10-28。审查对象：playbook/phase-22/00-overview.md 初稿。Codex 未实时读链、未运行 verify/Forge；我另核实了 trackId=UUID、DeployBase 仅 chainid==10 校验、AccountProxy 代码存在三项。

只读审查完成，未修改文件。以下是**计划层面的缺陷与上线前必须关闭的风险**，不是对尚未实现的合约宣称已发现可利用漏洞。D1–D15 保持不变。

本次核对了仓库代码、历史音效资料和官方标准；**没有实时读链，也没有运行会生成构建产物的 `verify.sh` / Forge 测试**。文档中的链上“已核实”结论不等于本次重新验证通过。

**P0：必须改，否则存在资产或权限安全问题**

1. **TBA 的实际执行结构尚未冻结，不能只验证“有代码、能收 1155”。**

   **位置：**[总览 §3.2、§4.2、P22-0](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:63)。

   **问题与原因：**候选 `0x41C8…44eC` 与 Tokenbound 官方推荐传给 Registry 的地址不是同一个角色：官方列出的 Registry `implementation` 参数是 AccountProxy `0x5526…6E7F`，`0x41C8…44eC` 是初始化逻辑地址。直接绑定逻辑与经过可升级代理是两种不同结构，不能混用。官方代理还有独立 `initialize`，目前流程完全没有说明初始化及已初始化账户的处理。[官方部署说明](https://docs.tokenbound.org/contracts/deployments)、[AccountProxy 源码](https://github.com/tokenbound/contracts/blob/v0.3.1/src/AccountProxy.sol)。

   **建议改法：**P22-0 必须冻结 Registry、实际传入的 implementation、完整代理层级、初始化要求、升级权限、guardian/执行权限及源码版本；以各链 runtime code hash 和实际调用验证支撑。若选代理，验证其当前逻辑和初始化状态；若直接绑定逻辑，验证该使用方式确实可用。不能把“项目三个合约不可升级”扩写成“TBA 也不可升级”。**候选地址两条链上的实际代码与这些源码是否一致，本次未核实。**

2. **“Score 转手后，原持有人不能转出素材”目前不能成立。**

   **位置：**[总览 §1、§4.4](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:117)。

   **问题与原因：**旧持有人可以先让 TBA 对其地址执行 `setApprovalForAll`，再出售 Score。TBA 地址没有变化，ERC-1155 的授权仍有效，旧持有人可以绕过 TBA，直接调用素材合约取走资产。仓库现有 OZ 实现按 `account → operator` 保存授权，并不检查关联 Score 的持有人：[ERC1155.sol:100](/E:/Projects/nft-music/contracts/lib/openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol:100)、[ERC1155.sol:120](/E:/Projects/nft-music/contracts/lib/openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol:120)。

   **建议改法：**增加“预授权 → 转手 → 旧授权者取走素材”的负面测试，并冻结处理策略。若保留普通 ERC-1155 授权语义，必须把承诺限定为“旧持有人失去默认账户执行权，历史资产授权不自动撤销”，明确交易风险；若要求旧授权也失效，需要另行设计并审查素材合约授权规则。仅测试旧持有人调用 TBA `execute` 失败不够。

3. **角色隔离引用了不覆盖 Ethereum 主网的护栏，而且混淆了 minter 与签名者。**

   **位置：**[总览 §3.1](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:56)。

   **问题与原因：**[DeployBase.s.sol:28](/E:/Projects/nft-music/contracts/script/DeployBase.s.sol:28) 仅在 `chainid == 10` 时强制检查；Ethereum 主网进入允许回退 deployer 的分支。P22 的素材 minter 是开包合约，因此 `admin != minter` 并不能证明 admin 与服务端热签名钱包隔离。“admin 不能铸”也不等于 admin 不能通过 `grantRole` 给自己授予铸造权限。

   **建议改法：**分别明确 admin、signer、pauser、operator、deployer、素材 minter；两条主网都强制验证地址、角色隔离及部署者退出。补签名者撤销、轮换、暂停与恢复测试，并明确 admin 的角色管理能力。签名密钥泄露虽不直接取得 TBA 控制权，却可能为真实 Score 签发错误素材包，永久消耗唯一开包机会；这一风险需要写入应急策略。

**P1：应改，进入实现前需要形成明确规格**

4. **背景音乐 `tokenId = catalog trackId` 与现有数据类型冲突。**

   **位置：**[总览 §3.1、§4.1](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:53)。

   **问题与原因：**catalog 的 `trackId` 是 UUID，校验器明确要求 UUID；不是 ERC-1155 的 `uint256`。见 [validate.ts:40](/E:/Projects/nft-music/src/lib/music-catalog/validate.ts:40)。catalog 另外具有展示编号和各部署的 tokenId，三者不能直接混用。

   **建议改法：**冻结 `catalog UUID → P22 uint256 tokenId → 背景音频永久身份` 映射；凭证字段建议称 `trackTokenId`，数据库保留原 UUID。不得直接 `BigInt(trackId)` 或默认使用曲目排列顺序。

5. **历史音效盘点方向正确，但缺少可执行的永久资料解析规则。**

   **位置：**[总览 P22-0③、P22-C](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:178)。

   **问题与原因：**[sound-set.ts:1](/E:/Projects/nft-music/src/lib/sound-set.ts:1) 只定义当前按键和本地路径；[ScorePackageV3](/E:/Projects/nft-music/src/lib/score-package/types.ts:22) 保存的是 events、soundSet、base 等资源引用，不直接保存已用素材 ID。历史播放还优先采用 `compatibility.effectiveSounds`，见 [snapshot-contract.ts:88](/E:/Projects/nft-music/src/data/score/snapshot-contract.ts:88)。

   本地资料明确区分：Score #1 使用旧音效，#2–#4 使用修复后的当前音效，#2 包含 `space`。当前 33 音效加 #1 使用过的旧音效已有 **46 个不同 SHA-256**；这不是两链当前全量盘点结果。

   **建议改法：**写明解析链路：按链和合约枚举 Score → 核验永久 metadata/package 或历史兼容资料 → 提取 events 使用键 → 应用有效 sounds 映射 → 按音频 SHA-256 去重 → 映射 P22 ID。背景音乐按永久 `base` 身份反查 catalog，不能靠标题匹配。签发接口必须自己派生列表，不能接受客户端提交的素材清单作为事实；缺资料时拒签并列出缺口。

6. **凭证还缺精确编码约定；没有 nonce 本身不是漏洞。**

   **位置：**[总览 §4.1、§4.2](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:83)。

   **问题与原因：**P16 参考合约只有标量字段，不能直接覆盖 `soundIds[]` 的 EIP-712 编码。OZ `EIP712` 不替应用自动生成 struct hash，现有 [EthereumScoreNFT.sol:107](/E:/Projects/nft-music/contracts/src/EthereumScoreNFT.sol:107) 也是显式编码。

   **建议改法：**冻结字段类型、TYPEHASH、domain name/version、数组哈希及 signer 参数，并加入 Solidity/viem 共用测试向量。`scoreContract` 已构造固定，可以不放凭证；两个素材合约、Registry、implementation、salt 也应固定或受到等价绑定。`opened[tokenId]` 在固定 Score 合约、固定 opener 下足以阻止重复成功开包，不必机械加 nonce；但**续签不会撤销旧凭证，A→B→A 后旧凭证也可能重新满足 holder 检查**。把“转走自动失效”改为执行时所有权检查，并决定是否需要撤销 nonce/epoch。[EIP-712 标准](https://eips.ethereum.org/EIPS/eip-712)。

7. **缺少完整的 TBA 地址派生约定。**

   **位置：**[总览 §4.2、§7.3、P22-0](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:100)。

   **问题与原因：**没有指定 salt，也没有明确 Registry 使用的 chainId 必须是本链。错误 chainId 或不同 implementation/salt 会产生另一地址，甚至形成无法由本链 Score 正常控制的账户。

   **建议改法：**冻结五元组 `implementation、salt、block.chainid、固定 Score 合约、tokenId` 及 Registry 地址；salt 可使用固定零值，但须明确约定。合约、服务端、前端共用测试向量，以 Registry `account()` 对照。规范 Registry 对已存在账户直接返回地址，不重新部署、不重新初始化；对账不能要求本次一定出现 `ERC6551AccountCreated`。[Registry 参考实现](https://github.com/erc6551/reference/blob/main/src/ERC6551Registry.sol)。

8. **`opened` 先置位正确，但回调与原子性测试不足。**

   **位置：**[总览 §4.2、§4.4](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:100)。

   **问题与原因：**当前顺序能挡住同一 Score 的重复进入，但不能直接证明跨 Score 重入安全。TBA 接收回调也不能默认视为固定无害代码：Tokenbound AccountV3 的两种 ERC-1155 回调允许 override。[官方源码](https://github.com/tokenbound/contracts/blob/v0.3.1/src/AccountV3.sol)。

   **建议改法：**明确 `nonReentrant`，保留先置位顺序，禁止吞掉 mint 失败。补同包/跨包回调重入、拒收、第二次 mint 失败、任一素材合约暂停、最大列表和非法 ID 的测试；失败后验证 `opened` 与两种素材余额均回滚。暂停还应说明限制的是 mint 还是全部转账，不能只写“带暂停开关”。仓库 P17 已有 [nonReentrant 参考](/E:/Projects/nft-music/contracts/src/p17/EthereumMaterialNFT.sol:49)。

9. **素材 ID 和 metadata 的永久绑定、扩展策略未定义。**

   **位置：**[总览 §3.1、P22-0③④、P22-B](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:52)。

   **问题与原因：**仅按“历史 Score 用过的音效”建表，会遗漏未来首次使用的当前音效。另一方面，如果沿用旧 MaterialNFT 的全局 URI 冻结模式，后来加入新音效身份会再次遇到无法扩展的问题。

   **建议改法：**至少覆盖历史有效音效与当前完整 33 音效集；冻结既有 `tokenId → sha256/永久 URI`，新增身份只追加、不重排旧 ID。明确未知 ID 是否拒绝 mint、URI 如何永久固定、是否支持未来新声音。双链共用内容映射，但资产身份仍包含链和合约。核验 `{id}` URI 的 64 位十六进制规则，现有 [identity.ts:36](/E:/Projects/nft-music/src/lib/music-catalog/identity.ts:36) 可复用。

10. **订单状态机不足以覆盖失败恢复、转手与抢跑。**

    **位置：**[总览 §5、§6](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:127)。

    **问题与原因：**五个状态没有区分“未发送”“发送结果未知”“确认中”“确定 revert”。旧持有人取消钱包或转走 Score 后，进行中的唯一订单可能长期阻塞新持有人。第三方先提交凭证虽然不能改收款地址，但本人随后广播的交易可能 revert 并消耗 Gas，因此“只是别人替你付费”不完整。

    **建议改法：**唯一约束明确为链、Score 合约、tokenId；订单固定 opener、凭证 digest 和素材身份。补超时、失去所有权、取消、替换交易、未知结果及确认数规则。优先按 `opened + PackOpened` 恢复，不能只依赖用户 hash，也不能把开包后的当前 owner/余额当作历史成功条件。P16 的 [订单恢复](/E:/Projects/nft-music/src/lib/self-mint/reconcile.ts:48) 可参考，但其 owner 校验不能直接照搬。勾选意图还需持久化并绑定原 Score 订单，否则关页后 OP 自动开包容易丢失。

11. **OP 的锁、重试和单日额度需要可测试的执行语义。**

    **位置：**[总览 §5、P22-C](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:126)。

    **问题与原因：**“沿用全局锁”不足以说明租约失效、广播超时和并发额度处理。现有锁有 TTL 与续期接口：[operator-lock.ts:18](/E:/Projects/nft-music/src/lib/chain/operator-lock.ts:18)。链上只开一次可以保护素材发行，但重复失败交易仍会烧 operator Gas。

    **建议改法：**明确使用同一锁键、订单 CAS 租约、续期失败停止后续广播、发送意图落库、未知结果先对账。单日上限定时区、全局/用户范围、原子预占及失败如何计数；限定自动重试次数。增加与旧 Score、素材、Pond Echo worker 并发运行测试。这不要求新增用户已延期的余额告警功能。

12. **规则同步范围不止 ARCHITECTURE 决策 7。**

    **位置：**[总览 P22-0b、§9](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:179)。

    **问题与原因：**架构文档不只写“未实装”，还在 [决策 6](/E:/Projects/nft-music/docs/ARCHITECTURE.md:126)、[决策 7](/E:/Projects/nft-music/docs/ARCHITECTURE.md:150) 明确要求新部署 MintOrchestrator，与已拍板 D4 冲突；[STACK.md:33](/E:/Projects/nft-music/docs/STACK.md:33) 仍有“非 ScoreNFT 资产 OP-only”；[CONVENTIONS.md:71](/E:/Projects/nft-music/docs/CONVENTIONS.md:71) 的钱包写入例外限定 P16 `redeem`。

    **建议改法：**把这些列入 P22-0b 的具体同步清单，按 D1–D15 更新过时约束。区分“调用已部署账户”与“导入其依赖”：官方 AccountV3 源码带 ERC-4337 能力，不能复制其整套依赖后仍声称完全未涉及黑名单。P22 只使用普通交易路径的边界必须写清楚；不需要因此引入 SDK、Bundler 或 Paymaster。

13. **施工 Gate 尚不足以证明真实集成可用。**

    **位置：**[总览 §8](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:178)。

    **问题与原因：**D/E 要浏览器实测，测试网部署却放到 F；Foundry fork 只是一句建议；没有列出 P14/P16 回归。目录也已有实际约束：`self-mint` 9 文件、`src/types` 10 文件，Score `[id]` 与其 components 均已有 8 文件。

    **建议改法：**在 D/E 前安排经 Gate 放行的测试网部署，或明确可运行的本地链方案；fork 固定 RPC、区块、Registry/实现代码身份，测试不可静默跳过。增加 hash 漏报、换账户/链、取消第二次确认、双链同 tokenId 隔离，以及 OP/邮箱/SEMI/P14 回归。P14 当前按固定 Score 合约的 mint `Transfer` 发现资格，见 [discover.ts:136](/E:/Projects/nft-music/app/api/cron/process-wallet-recipe/discover.ts:136)，应验证 P22 不触碰其事件源和游标。另补 P19 无路由语言切换、不中断播放 Gate，并在开工前明确目录拆分与既有 verify 失败的处理。

14. **市场掏空和循环持有风险没有进入已知后果。**

    **位置：**[总览 §1、§9、§10](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:194)。

    **问题与原因：**持有人可以在成交前取走素材，`opened=true` 不代表包仍完整。文档“不把 Score 转进 TBA”只能约束项目操作，无法阻止外部钱包使用 `transferFrom`，也不能覆盖多个 TBA 的循环持有。[ERC-6551 安全章节](https://eips.ethereum.org/EIPS/eip-6551#security-considerations)。

    **建议改法：**不推翻可转让决策，但明确展示“开包时铸入清单”和“当前余额”，包括已移出/空包状态及读取区块；不能承诺普通市场订单锁定包内容。加入自持有、预部署地址接收 Score、循环持有的验证与风险说明；不要把 ERC-721 接收回调检查当作完整防护。

**P2：建议补强文档准确性**

15. **部分“已核实”陈述的证据不足以支撑其结论。**

    **位置：**[总览 §3.2、§3.3、§10](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:62)。

    **问题与原因：**相同代码长度不能证明相同实现；几个 metadata URL 返回 404 不能证明“音效从来没有 NFT 身份”。旧 [MaterialNFT.mint](/E:/Projects/nft-music/contracts/src/MaterialNFT.sol:34) 本身没有限制 tokenId 范围。成本数字已标估算，但尚无完整包交易测量依据。

    **建议改法：**给历史核实补证据链接、链/区块、runtime hash 和查询范围；将绝对历史断言收窄为“这些 ID 当前没有可用永久 metadata”，除非有完整事件扫描。Gas Gate 测量新部署/已部署 TBA 和最大包，OP 包含 L1 data fee。上述实时链上状态、404 与成本，本次均未复核。

16. **“六个合约”“全部 TBA 内容”“一笔原子完成”需要限定含义。**

    **位置：**[总览 D3、D8、§7.3](/E:/Projects/nft-music/playbook/phase-22/00-overview.md:166)。

    **问题与原因：**六个指共享业务合约，每枚新 TBA 仍产生账户部署；`balanceOfBatch` 只能查询已知 ID，无法枚举账户所有外来资产。若 TBA 早已部署，失败交易也不会撤销那个历史部署。

    **建议改法：**明确展示范围为“P22 素材及其余额”；把原子性写为“本次 opened 状态及全部素材铸造共同成功或回滚”。路由本身与现有结构一致，但 `[id]` 在多链路由中实际表示 chainId，建议注明，避免与旧 `/score/[id]` 的 tokenId/UUID 混淆。

**总评：可以进入 P22-0 的查实与冻结阶段，暂不能直接进入 P22-A。** 两链独立执行、EIP-712 domain 隔离、固定 Score 合约、一次开包和先置状态的主方向合理。P22-0 的放行产物至少应关闭 TBA 执行结构、旧授权风险、双链角色隔离、UUID 映射及历史素材解析这几项，并把剩余测试明确列为阻塞 Gate。