# P14 封面网关复核

> 日期：2026-09-10（Asia/Shanghai）
> 对象：`4uEbvBt9gIaVt50FZ1wfQkuz3ogXZIGGjAdoWre3-SU`

## 结果

- 连续两次只读执行 `image --verify`，中间保留 15 秒传播窗口。
- 首次：`arweave.net` 完整请求与 Range 均连接失败；`ario.permagate.io` 返回 HTTP 503。
- 第二次：`arweave.net` 仍连接失败；`ario.permagate.io` 完整请求超时，Range 最小分段返回 HTTP 502。
- 历史已证明本地封面与 `arweave.net` 的 1,247,695 bytes 和 SHA-256 `8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8` 一致；本轮不把历史证据当作当前双网关通过。

## 决定

- ledger 继续保持 image=`uploaded`、`verifiedAt=null`、`upload_result_unknown=0`。
- 本轮没有上传、没有产生新 txid，也没有执行 collection metadata 或链上部署。
- P14 仍停在永久封面 Gate；恢复点不变：只验证现有 txid，双网关通过后首次上传 collection metadata。

## 无限等待收口

- 用户于 2026-09-10 批准将“指定两个域名全通过”改为“3 个候选中至少 2 个独立网关完整字节/hash 一致”。
- 候选为 `ardrive.net`、`arweave.tokyo`、`arweave.net`；重复域名不得凑 quorum。
- `ardrive.net` 已对当时 ledger 的 39 个已上传对象全量取回，39/39 字节数、SHA-256 与 CORS 通过；`arweave.tokyo` 与另一注册 AR.IO 网关也已对封面完整 hash 通过。
- 新 quorum 验证已对封面、36 clips 与 manifest 通过；全程没有重传这些对象。
