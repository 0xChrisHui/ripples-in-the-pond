# P14 F4 — OP Mainnet 部署前只读对账

时间：2026-09-11（Asia/Shanghai）
状态：F4/F5 已完成；主网合约、production migration 与 off 部署均已验证。

## ScoreNFT 历史集合

- 合约：`0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA`
- 部署块：`155933187`
- 本轮 head / 20-confirmation safe head：`156735422 / 156735402`
- 生产 `last_synced_block`：`156735366`；与 safe head 相差 36 blocks，属于正常 cron 窗口。
- 连续 `ownerOf` 探测：#1、#2 存在，#3 revert；当前最新 tokenId 为 2。
- `chain_events` 有 2 个 `Transfer(from=0)`，两笔 receipt 均 success，tokenId、origin、block 全一致。
- `score_nft_queue(status=success)` 与 `mint_events` 各 1 行，只对应 Token #1。

| Token | Origin | Block | Mint tx | 归因 |
|---:|---|---:|---|---|
| 1 | `0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54` | 155937041 | `0x1d2de0a47e73114e87ecb7d81b5b49e61edb5f7b4a4c2871317811b53f182f4a` | chain_events + queue + mint_events 一致 |
| 2 | `0xFD869d82A64e51cb488631fe25A46f9DBe417f20` | 156213815 | `0xdbc760988b59faff3636e70f51614d59de599eab69b87378680a143b880050f0` | chain_events + receipt + owner/tokenURI 可回查；旧生产 DB 无 queue/mint_events 行 |

Token #2 是已归因的历史 chain-only 记录，不是未知 mint。链上供应量、chain_events 与 receipt
集合没有第三类差异，因此无需启动离线全历史 backfill。F6 必须把两个 origin 都写为
`excluded_prelaunch`，不能只按旧 queue 表导入 Token #1。

## F4 其余预检

- 正式 40 个永久对象已 verified；v1 Decoder 固定为
  `WebQxIooDPjHHHLrkKniMK8W0Se5omXPDH3cYWSpI64`。
- OP Sepolia 部署的 runtime bytecode 与当前编译产物一致；solc 0.8.33、Cancun、optimizer 200。
- 测试网实测部署 gas `2,453,984`；主网一次性 deployer 计划充值 `0.0001 ETH`。
- operator 当前余额约 `0.010098 ETH`，充值后仍高于 `0.005 ETH` 运维告警线。
- 当前 Production 未设置任何 P14 变量；主网数据库尚未执行 049，未发生 P14 生产写入。
- 部署前生产全量数据快照已落在
  `C:\Users\Hui\ripples-backups\20260911-042645-p14-predeploy`：14 张表、288 行、
  15 个文件（含 manifest），0 个失败；备份位于仓库外，不会进入 Git。

## 广播前必须关闭的 Gate

1. F3 顺序长播与浏览器量化证据完成。
2. P14 改动分步提交并跑完整 `scripts/verify.sh`。
3. 在隔离工作树合并最新 `origin/main` 后再验证和部署，避免回退当前生产 P11 UI。
4. 使用本轮部署日生产数据库快照；只对生产项目执行 049，禁止使用当前链接到测试库的
   `supabase db push --linked`。
5. 重新采样 head/safe head/cursor、运行本目录脚本，确认历史集合仍一致。

上方 F4 预检轮全部为只读 RPC/数据库查询；F5 的生产写入结果记录如下。

## F5 实际部署结果

- migration 049 已对 production project `uupobbgnhpattyxhxvmc` 执行；两表 RLS 开启，
  anon/authenticated 无读权限，5 个 service-role RPC 齐全，初始行数为 0。
- Pond Echoes / ECHO：`0xd2E884FA06C9a9BDef2350956cc4216d3E2B476c`。
- deploy tx：`0xebb5ade46ec1ad3578b7344e20c8c136ffe12233b0438ea97666057e9bf379ba`，
  block `156737905`，gas used `2,453,984`。
- 链上 runtime 与本地编译 Keccak 均为
  `0x62a0f5f7859bad946ed1ebaa5020de379e2919065f0bfdd6dc83215ef4582a7c`；
  Etherscan `Pass - Verified`。
- owner/admin 为 `0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722`，minter 为
  `0x306D3A445b1fc7a789639fa9115e308a34231633`；一次性 deployer 的 admin/minter
  均为 false，初始 supply 为 0。
- 首次 Production deployment `dpl_9DWWZwDtXNpQ8dVReR3iQGadA1HV` 已 Ready 并绑定
  `pond-ripple.xyz`；受保护 health 证明 mode=off、DB/角色/永久资源可达、P14 队列为空。
