# P14-G2 source cursor migration 与全链对账

> 执行日期：2026-09-12（Asia/Shanghai）

## 测试库 Gate

- 目标：独立 OP Sepolia Supabase `ypjyurxoavjznwuvmglo`。
- migration 首次遇到未登记合约 `0xE0fA…DB23` 时主动停止；核对 P12 部署记录后补入明确 OP Sepolia 映射。
- 30 条旧 `chain_events` 全部得到 `chain_id=11155420`，未知/空 chain 行为 0。
- `anon` 无 initialize 权限，`authenticated` 无 advance 权限，`service_role` 有 initialize 权限。
- 两个并发 initialize 仅 1 个成功；两个相同 expected 的并发 advance 仅 1 个成功，winner=`110`。
- 回退、错误 chain 和直接 upsert scoped cursor 均被数据库拒绝。
- migration 重放成功，PostgREST schema cache 已刷新。

## Production migration read-back

- 应用前只有 3 条已知 OP Mainnet ScoreNFT 事件，contract 均映射到 `chainId=10`。
- migration 050 应用成功；3 条旧事件全部 lowercase 且 `chain_id=10`，空 chain 行为 0。
- 应用后 scoped cursor 行仍为 0，未由 migration 猜链头。
- `anon/authenticated` 无游标 RPC 权限，`service_role` 可调用。

## 全链 reconciliation

- 区间：`155933187..156794055`，共 860,869 blocks，safe head 固定为当时 head-20。
- Alchemy 免费档实测只允许 10-block logs，拒绝执行约 8.6 万次请求。
- 改用 OP Mainnet 公共只读 RPC；探测得到 10,000-block 窗口，实际 93 requests、0 retries。
- 链上 Transfer=3、mint=3；DB chain_events=3、Score queue success=2、Score mint_events=2、P14 recipes=3。
- `missing=0 / extra=0 / conflicts=0 / integrity=[]`。
- 集合 SHA-256：`910fee5d60ba454feef635e5e27cfe4b9a7dd5b67e7ddb5a8145368c36b5fa3f`。
- 0-diff 后调用 initialize RPC，scoped cursor 一次性写为 `156794055`；read-back 与冻结 checkpoint 一致。

原始可续跑 checkpoint 与两次报告保存在同目录。
