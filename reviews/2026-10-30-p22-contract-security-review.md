# P22 合约安全自查

> 2026-10-30，Claude 自查（非第三方审计）。对象：`contracts/src/p22/*`、`contracts/script/DeployScorePack.s.sol`，以及它们依赖的 Tokenbound AccountV3。
> 方法：逐行读源码；从 Sourcify 取 `0x41C8…`（AccountV3Upgradable，主网 exact match，runtime hash 与四链一致）的源码核对；补对照测试 `test/p22/AccountIntegration.t.sol`。`forge test` 135 全绿。
> 未做：静态分析工具（slither 未安装）、模糊测试、第三方审计。

## 结论

合约层没有发现可直接造成资产被盗、素材被转出或重复开包的问题。主要风险在**部署环节**（部署后不可改），有 2 项中等问题建议主网前修。

## 中等

**M1 部署脚本没有钉死 Score 合约地址。** `P22_SCORE_ADDRESS` 全靠环境变量；主网填错时，开包合约会永久绑在错误的 Score 上，三个合约整套作废（约 0.33 ETH）。建议：OP 主网与以太坊主网写死 `0xAc3F…A4AA`、`0xdeC9…f02A` 并校验。

**M2 开包合约地址靠部署者 nonce 预测，且部署后只在模拟里核对。** 若部署者是共用热钱包（测试网就是：部署者 = OP 运营钱包，cron 会用它发交易），中途插入一笔交易会让 nonce 错位，素材合约永久指向一个不存在的开包合约。`_verify` 在 forge 本地模拟里执行，不读真链。建议：主网要求部署者 nonce 为 0（一次性钱包）；开包合约构造时校验 `sounds.opener() == address(this)`；加一个部署后读真链的核对脚本。

## 低

- **L1** 部署脚本没校验 signer ≠ OP 运营钱包（计划要求两者独立）。
- **L2** OP 代付的 Gas 消耗：持有人可以给自己的账户设置接收回调覆盖，让开包交易消耗大量 Gas（由项目方代付）。受限于每枚 Score 只能开一次、每人每天 3 次，影响有限；建议 cron 发送前设 Gas 上限。
- **L3** `MAX_VALIDITY` 只限制"截止时间不超过提交时 + 1 小时"，被盗的 signer 仍可预签未来时段的凭证；轮换 signer 后这些凭证立即失效（合约在执行时检查角色）。接受，靠轮换兜底。

## 已知并接受

- signer 泄露可给尚未开包的 Score 铸入错误（但已登记）的素材，永久消耗其唯一一次开包机会。处置：暂停 → 轮换。
- 以太坊上凭证可被抢先提交，结果不变，但用户自己的交易会失败并白付 Gas。
- 持有人可锁定自己的 TBA 最长 365 天、设置覆盖与授权；这些都按"当前持有人"存储，转手后失效（已测）。
- AccountV3 自带 ERC-4337 入口（第三方代码，我们不实现），P22-0b 改 STACK 文档时需写明。

## 冻结表订正

`05-frozen-decisions.md` §1 写"Score 持有人可升级 TBA"——**错误**。直接绑定 `0x41C8…` 时，克隆账户的 ERC-1967 槽为空，UUPS `onlyProxy` 必然拒绝 `upgradeTo`（已测）。TBA 实际不可升级。Tokenbound guardian 只管升级白名单和跨链执行者，对本链账户无权限。

## 已验证（有测试）

| 项 | 测试 |
|---|---|
| 对照：持有人经 TBA `execute` 转出 ETH 成功，证明"素材转不出"的测试有效 | `test_positiveControl_ownerCanExecuteBenignCall` |
| 素材转账 / 批量转账 / 授权 / 第三方 / 销毁 / 转手后新旧持有人：全部拒绝 | `SoulboundAsset.t.sol`、`test_tbaDirectTransferHitsSoulboundHook` |
| 只有开包合约能铸；admin 授予任何角色都不能铸 | `test_onlyOpenerMintsAndAdminCannotMint` |
| 持有人用接收回调重入开包合约：被拦下，吞掉错误也无法成功 | `test_holderOverrideReentry*` |
| 持有人拒收只伤自己；换主人后旧覆盖失效 | `test_holderRejectingReceiptOnlyHurtsOwnPack` |
| 旧持有人的执行授权不会带给下一任 | `test_oldOwnerPermissionsDoNotCarryOver` |
| TBA 不可升级 | `test_tbaIsNotUpgradeableInDirectBinding` |
| 签名：跨链、篡改、错误 signer、过期、轮换 | `ScorePackOpener.t.sol` |
| 任一步失败整体回滚（含账户创建） | `test_unknownSoundRollsBackEverything` |
| 服务端素材映射：Score 2–4 的音效、1–4 的背景音乐都能命中；Score 1 旧音效不命中（符合范围决定） | 一次性脚本核对 `data/compatibility/*` |
