# P14 F6 — OP Mainnet cutoff 与 observe

时间：2026-09-11（Asia/Shanghai）

## 基线

- activationBlock：`156738598`；写入时已获得至少 20 个确认。
- discovery cursor 从 ScoreNFT 部署块前一块开始，经正式
  `register_wallet_recipe_origin` RPC 顺序处理两个历史 mint，最终为 `156213815:80`。
- Score Token #1、#2 的 origin 均为 `excluded_prelaunch`；链上、chain_events、receipt
  与 P14 队列集合一致。eligible 为 0。
- 可重放初始化与断言 SQL 见 `initialize-baseline.sql`；脚本遇到已有 key、非空队列、
  历史集合变化或写后集合不一致时会整笔回滚。

## observe

- Production deployment：`dpl_5Fp9BjxmC26pV3pRqjUyHuuvEJu5`，Ready 并绑定
  `https://pond-ripple.xyz`。
- `WALLET_RECIPE_MODE=observe`，expected activation 与数据库值一致；合约、minter、
  数据库 RPC 和三项永久输入全部健康。
- cron-job.org job `8394060`：每分钟 GET、Bearer、30 秒 timeout，已启用。
- 从启用起连续观察 954 秒；共 15 次执行，15 次均 HTTP 200。终态：2 excluded、
  0 eligible、0 active、0 safe_retry、0 manual_review、0 success，P14 supply 仍为 0。
- 观察中发现上游 `sync-chain-events` 原每 5 分钟运行，导致 P14 在间隔期安全拒绝发现并
  短暂出现 stale/lagging；job `7520772` 已改为每分钟。修改后 `cron_stale` 未再出现，
  `source_index_lagging` 仅在同步与健康采样的秒级竞态中闪现并于下一帧清零。

## F7 当前状态

cutoff 后尚无真实 Score 首铸，因此没有可展示的 pending origin。按 playbook 保持 observe；
不得切 live、制造假用户或给历史钱包补发。真实 eligible 出现后再执行 F7 live 与首枚空投。
