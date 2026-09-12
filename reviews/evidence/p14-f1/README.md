# P14 F1 — OP Sepolia 部署证据

时间：2026-09-11（Asia/Shanghai）

## 合约与永久输入

- WalletRecipeNFT：`0x43E86Af0437386a8Af7A3b0c806d917c030BAb38`
- 部署交易：`0x1104f7dc4a0672e26606347e0ffeed3f37a2f84f62e594c929a579901165e6ce`
- 部署区块：`48626572`
- OP Sepolia chainId：`11155420`
- clip manifest：`vcoWSlqUAGMH_0CO6QM4jvJPwgjbuVkYzzXG3uWPoGA`
- Decoder：`WebQxIooDPjHHHLrkKniMK8W0Se5omXPDH3cYWSpI64`
- 共用封面：`4uEbvBt9gIaVt50FZ1wfQkuz3ogXZIGGjAdoWre3-SU`
- collection metadata：`AnmfGMZSfbGODpfo9C03thRxuRmN9iMF9nSuRVFCC80`

Etherscan V2 源码验证成功。链上读回确认 owner 为 admin、`DEFAULT_ADMIN_ROLE` 仅授 admin、
`MINTER_ROLE` 授 operator，临时 deployer 不持有 owner/admin/minter 权限。

## Preview 与健康闸门

- observe 修正版：`https://ripples-in-the-pond-kr6h0kh5r-0x991-thomas-projects.vercel.app`
- deployment：`dpl_EsLHCS7FAnrgUVPvxX58PuQBrDGA`
- `/api/health`：contract code、minter role、测试 DB、activation `48629909`、永久输入均为 true。
- 空事件回归：`result=ok, mode=observe, processed=0, discovered=0`。

live 演练期间，Vercel CLI 的无分支/同名变量覆盖曾使预览连到错误数据库。三次部署均被
`database_unreachable + activation_mismatch + live_fail_closed` 拦截；未上传 metadata、未广播
P14 交易。真实 E2E 随后改由相同代码的本地 cron 进程连接隔离测试库执行。

## 资金与密钥处置

- 部署资金转入交易：`0xc288...623b`
- 剩余资金退回交易：`0x0253...bc9e`
- 临时 deployer 密钥文件已永久删除；地址只剩测试网 dust `0.000000124092932213 ETH`。
- 测试钱包私钥只保存在用户配置目录，未进入仓库、日志或证据。
