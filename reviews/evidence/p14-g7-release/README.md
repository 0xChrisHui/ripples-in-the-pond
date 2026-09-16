# P14-G7 生产恢复证据

日期：2026-09-12 UTC / 2026-09-13 Asia/Shanghai

## 发布

- ECHO 首页 G6：`dpl_5j7YLuBbeEgZ5yVUDyTbmW8iWAQX`，已绑定 `pond-ripple.xyz`。
- 首个 observe：`dpl_H44o48bNkQ88rhGTbDSQE6BYqh26`；发现异步 source 上界误判后停止计时。
- 修复后 observe：`dpl_E822awh3LVnAyWVpefa8MDcZJsHZ`，提交 `8f5a735`。
- live 恢复：`dpl_9hueV8kCLTiM6HcqYibhUMdsqGKL`，mode/合约角色/永久输入/activation 读回全绿。

## observe Gate

首次窗口暴露两个真实 503：log `344`（`2026-09-12T17:15:13Z`）与 log `359`
（`2026-09-12T17:30:23Z`）。失败不计绿，窗口从最后一次失败后重置。

`observe-results.json` 保存重置后的连续窗口：log `360–381` 共 22 次，22/22 为 HTTP 200，
首末相隔 1261 秒。终态为 2 `excluded_prelaunch`、1 `success`、0 active、0 failed、
0 manual review、0 upload unknown，PondEchoes `totalSupply=1`，source cursor `156818352`，
health alerts 为空。observe 没有上传或交易。

根因是两个每分钟 cron 异步运行，却错误要求 source cursor 精确等于持续移动的 safe head。
修复后 P14 只消费 source 已完成“事件落库 → CAS 游标”的稳定前缀；source/discovery 超前仍在
查询前失败关闭。正常 fresh 小 lag 仅作 telemetry，stale、超过 500 blocks 或 ahead 才报警。
真实 discovery/DB/config/manual-review/last-success 失败现在返回 500/503，不再让外部历史伪绿。

## live 恢复与新窗口

- P14 cron 恢复：`2026-09-12T17:56:58.030Z`。
- 首次 live 成功 / 新观察起点：`2026-09-12T17:58:09.356Z`
  （Asia/Shanghai `2026-09-13 01:58:09`）。
- 24h 里程碑：`2026-09-13T17:58:09.356Z`；7d Gate：`2026-09-19T17:58:09.356Z`。
- source job `7520772` 与 P14 job `8394060` 均 enabled、最近状态成功；两者已开启
  `onFailure=true`、`onSuccess=false`，状态不变时不通知。
- 首轮 live 读回：mode `live`、configured、activation、contract/minter、三项永久输入全部正常；
  `/api/tracks=35`，featured ECHO 身份和 36 位 recipe 不变，队列 0 active/failed/manual/unknown。

Codex 本轮未暴露 `automation_update`，因此没有创建应用内 heartbeat；cron-job.org 原生失败通知
作为即时异常兜底。24h/7d 仍是未完成的时间 Gate，不能用本文件提前关闭 F8。

## 可复跑

```powershell
$env:P14_BASE_LOG_ID='<最后一次失败或窗口前一条 log id>'
npx vercel env run -e production -- node reviews/evidence/p14-g7-release/observe-recovery.mjs
```

脚本要求 cron ≥10 次、首末 ≥900 秒、全部 HTTP 200、source cursor 不回退、supply=1、
队列无副作用且 health 无持续告警。
