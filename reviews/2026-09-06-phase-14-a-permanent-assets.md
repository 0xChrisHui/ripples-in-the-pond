# P14-A｜永久素材冻结报告

> 日期：2026-09-06（Asia/Shanghai）
> 状态：38/40 已完成；封面等待第二网关完整传播，collection metadata 尚未上传。

## 已关闭 Gate

- 权利确认与 36 段 A→9 完整人耳试听均已归档。
- 36/36 MP3：唯一 SHA-256 为 36/36，全部取得 txid，双网关 bytes/hash/type/CORS 为 72/72。
- clip manifest 与 Decoder v1：均已上传并通过双网关完整字节验证。
- 恢复账本没有 `uploading` 或 `upload_result_unknown`，因此不存在可疑重传。

## 永久对象

| 对象 | 状态 | bytes | SHA-256 | Arweave txid |
|---|---|---:|---|---|
| 36 clips | verified 36/36 | 4,550,472 | 见 manifest | 见 manifest |
| clip manifest v1 | verified | 13,617 | `0e39b1b1a78a3be181c011dd4142fde6f2b2edcc4fdb93a3d478fde48f7a0fba` | `vcoWSlqUAGMH_0CO6QM4jvJPwgjbuVkYzzXG3uWPoGA` |
| Decoder v1 | verified | 13,512 | `2521bd95a7fb58f01343ce8625648553067a7c5831eaf71c17d84cd5f7833a4e` | `h1xSTezG7OuH85i2pT88H1iJI-KFRbImtvmfXSseKf0` |
| cover v1 | uploaded / waiting | 1,247,695 | `8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8` | `4uEbvBt9gIaVt50FZ1wfQkuz3ogXZIGGjAdoWre3-SU` |
| collection metadata v1 | not uploaded | — | — | — |

36 个音频的逐项 txid、bytes、duration 与 SHA-256 以
`src/features/wallet-recipe/clips-v1.json` 为冻结清单；逐网关响应证据以
`data/p14-arweave-upload-ledger.json` 为恢复账本。

## 成本与恢复安全

- 已记账对象：39（38 verified，1 uploaded/waiting）。
- 已记账 Turbo 成本：`71,698,526,275 winc`。
- 上传器每个对象先原子写入 `uploading`，拿到 txid 后写 `uploaded`；不确定结果会进入 `upload_result_unknown` 并禁止重传。
- 本轮 unknown 数量为 0；封面 txid 已明确，后续只允许 `image --verify`，不得再次 `--upload`。

## 当前传播阻塞

主网关已完整取回封面 1,247,695 bytes，SHA-256、`image/png` 与 CORS 全部一致。
`ario.permagate.io` 当前仍在 `x-ar-io-stable: false` 状态，并可复现错误：对
`bytes=122880-122880` 返回 `206`/正确 Content-Range，却返回 0 bytes；Turbo 数据项状态接口仍为
`Not Found`。六档传播重试窗口已经跑完，故保持 `uploaded`，不以单网关冒充双网关通过，也不重传。

集合 metadata 必须引用已 verified 的封面 txid，因此保持未上传。第二网关恢复后依次执行：

```text
npx tsx scripts/arweave/p14/upload-p14-assets.ts image --verify
npx tsx scripts/arweave/p14/upload-p14-assets.ts collection --audit
npx tsx scripts/arweave/p14/upload-p14-assets.ts collection --upload
npx tsx scripts/arweave/p14/upload-p14-assets.ts collection --verify
```
