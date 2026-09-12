# P14 测试数据库证据

> 日期：2026-09-06（Asia/Shanghai）
> 项目：`ripples-p14-test` / `ypjyurxoavjznwuvmglo`

## Migration

- Supabase CLI 登录与测试项目 link 均正确；生产项目未链接。
- 本机 Mihomo/TUN 会截断原始 PostgreSQL 5432 会话，因此改用 Supabase 官方 HTTPS Management API。
- 46 个 migration 按真实 Phase 顺序分 8 个事务执行，每批均在返回后只读 read-back，无 transport unknown。
- 结果：16 张 public 表；`wallet_recipe_queue` 与 `arweave_upload_ledger` 存在、RLS 开启、5 个 P14 RPC 齐全，两张 P14 表为 0 行。

## C4 真库状态机证明

先用显式事务 + rollback 验证，再用两个并行 HTTPS 会话实测：

- 同 source event 的 2 个并发 registration 收敛为 1 行。
- 两个并发 claim 领取 2 个不同 job。
- 同 origin 后续 Score 不产生第二行；OP Sepolia/Mainnet 同钱包彼此隔离。
- `excluded_prelaunch` 不会被后续 eligible 覆盖。
- lease 期内 stale owner CAS 更新返回 0 行；safe retry 恢复原状态。
- metadata 上传结果未知会同步进入 ledger `upload_result_unknown` 与 job `manual_review`，不再被 claim。
- anon/authenticated 无表读权，service_role RPC execute 权限存在。
- 并发测试夹具已删除，最终 P14 两表均为 0 行。

## 发现并修复

首次真库测试发现：cursor 已前移后重放同一 source event 会误报冲突。
`049_wallet_recipe_queue.sql` 现在会先锁住 cursor，再对已存在的 source evidence
做全字段一致性核对；一致则返回原行，被篡改则 fail closed。
