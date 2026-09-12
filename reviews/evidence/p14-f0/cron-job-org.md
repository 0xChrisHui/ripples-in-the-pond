# P14 cron-job.org 证据

> 日期：2026-09-06（Asia/Shanghai）

- API key 只从仓库外本机文件读取，未输出、未入库。
- 创建 job id：`8394060`，title：`process-wallet-recipe`。
- URL：`https://pond-ripple.xyz/api/cron/process-wallet-recipe`。
- GET、Asia/Shanghai、每分钟、30 秒 timeout、`saveResponses=false`。
- Authorization Bearer 与本机 `CRON_SECRET` 布尔比对一致，未输出值。
- 创建后立即读回通过，当前 `enabled=false`。
- 现行冻结预算是 route 20 秒停止 claim、25 秒前返回，与 30 秒外部 timeout 一致。

在永久输入、F1/F2 与 F6 activation/observe Gate 通过前，不得启用该 job。
进入 observe 时启用 job，但应用 mode 保持 `observe`；F7 通过后才切换为 `live`。
