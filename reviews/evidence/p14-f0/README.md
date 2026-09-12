# P14-F0 首次只读发布预检

- 时间：2026-09-06T00:34:55.901Z
- 总 Gate：**BLOCKED**
- 首次预检脚本外部写入：无

> 本表保留 F0 首次快照，不回填改写历史证据。
> 后续已完成测试数据库与 cron-job.org 运维预置，见本页下方的「后续闭环」。

| 检查 | 状态 | 摘要 |
|---|---|---|
| worktree | BLOCKED | `{"counts":{"p14":9,"user-media":3,"existing":25},"lines":["M .claude/hooks/check-file-size.js"," M .claude/hooks/check-folder-size.js"," M .claude/hooks/check-forbidden-imports.js"," M .claude/hooks/session-start-context.js"," M .claude/hooks/stop-checklist.js"," M AGENTS.md"," M QUICKSTART.md"," M STATUS.md"," M TASKS.md"," M docs/ARCHITECTURE.md"," M docs/CONVENTIONS.md"," M docs/ERRORS.md"," M docs/JOURNAL.md"," M docs/LEARNING.md"," M docs/STACK.md"," M playbook/phase-14/00-overview.md"," M ` |
| p14-code-policy | PASS | `{"files":80,"oversized":[],"crowded":[],"forbidden":[]}` |
| score-isolation | PASS | `{"anchor":"cb06907250046e84743d9d0f9b1c0eee1e82a836","changed":[]}` |
| contract-forge | PASS | `{"rules":{"ERC721Enumerable":true,"tokenIdByOrigin":true,"originWalletOf":true,"mintToOrigin":true,"contractURI()":true,"_transferOwnership(admin_)":true,"RolesMustDiffer":true},"absentCapabilities":[],"forgeAvailable":true,"forgeExitCode":0}` |
| permanent-local-inputs | PASS | `{"count":36,"mismatches":[],"hashes":{"manifest":"fffadcde8d0a04d13f9240cf3d42fc4e89b932b1ef8d221a0885cbd74f62252c","decoder":"2521bd95a7fb58f01343ce8625648553067a7c5831eaf71c17d84cd5f7833a4e","image":"8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8"}}` |
| recipe-vector | PASS | `{"wallet":"0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54","expected":"ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR","actual":"ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR"}` |
| permanent-txids | BLOCKED | `{"configured":{"manifest":false,"decoder":false,"image":false},"clipTxIds":0}` |
| metadata-roundtrip | BLOCKED | `{"reason":"永久 txid 未冻结，拒绝使用假地址代验"}` |
| environment | BLOCKED | `{"required":{"rpcSepolia":true,"rpcMainnet":false,"operator":true,"deployer":true,"supabase":true,"upstash":true,"resend":false,"cron":true,"turbo":true,"vercel":false,"admin":false,"minter":false},"secrets":{"ALCHEMY_RPC_URL":true,"OP_SEPOLIA_RPC_URL":false,"OP_MAINNET_RPC_URL":false,"OPERATOR_PRIVATE_KEY":true,"DEPLOYER_PRIVATE_KEY":true,"SUPABASE_SERVICE_ROLE_KEY":true,"UPSTASH_REDIS_REST_TOKEN":true,"RESEND_API_KEY":false,"CRON_SECRET":true,"TURBO_WALLET_PATH":true,"TURBO_WALLET_JWK":false,"` |
| roles | BLOCKED | `{"deployer":"0x306D3A445b1fc7a789639fa9115e308a34231633","admin":null,"operator":"0x306D3A445b1fc7a789639fa9115e308a34231633","minter":null,"minterMatchesOperator":false}` |
| rpc-11155420 | BLOCKED | `{"configured":true,"error":"fetch failed"}` |
| rpc-10 | BLOCKED | `{"configured":false}` |
| turbo-balance | BLOCKED | `{"error":"fetch failed"}` |
| database-tooling | PASS | `{"supabaseCli":true,"docker":false,"psql":false,"supabaseHttp":200}` |
| rights-gate | PASS | `{"expected":"reviews/evidence/p14-f0/rights-confirmation.md"}` |
| homepage-build-isolation | PASS | `{"buildArtifacts":1021,"leaks":[]}` |
| opensea-metadata | PASS | `{"checkedAt":"2026-09-06T00:34:55.898Z","official":["https://docs.opensea.io/docs/metadata-standards","https://docs.opensea.io/docs/metadata-storage","https://docs.opensea.io/docs/contract-level-metadata"]}` |

## 后续闭环

- [测试数据库](./test-database.md)：46 个 migration、RLS/RPC、回滚状态机与真并发 registration/claim 均已通过。
- [cron-job.org](./cron-job-org.md)：job `8394060` 已创建并读回，在 F6 activation/observe Gate 前保持 disabled；进入 observe 时启用 job，F7 通过后才将应用 mode 切为 live。
- Vercel 登录与项目链接已通过；新环境变量须等永久 txid 与合约地址生成后再配置。
- 当前最前置的永久资源 Gate 仍为 **BLOCKED**：封面 txid `4uEbvBt9gIaVt50FZ1wfQkuz3ogXZIGGjAdoWre3-SU` 尚未被第二网关完整取回，collection metadata 因此尚未首传；在此前不进入 F1 部署，也不重传封面。F1 开始前还会按当时环境重跑角色、RPC、余额与配置预检。
