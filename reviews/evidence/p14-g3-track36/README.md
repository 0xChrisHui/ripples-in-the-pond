# P14-G3 Track #36 本地素材证据

## 结论

- 候选母带为 `references/36-AU/第36个 当所有的碎片都在最后组合在了一起 MSTR.mp3`，只读 SHA-256 为 `3f35b07300f0e6aefb179178267be0f36d0c70c0e04b4e5235483669b83a4b5d`。
- MP3 为 MPEG-1 Layer III、48 kHz、双声道、128 kbps CBR，11,336 帧，帧时长合计 272.064 秒；文件共 4,359,823 bytes。
- 同目录存在同 basename 的 24-bit/48 kHz/双声道 PCM WAV（274 秒）和 PKF 峰值文件，支持“该 MP3 属于同一 MSTR 导出链”的 provenance，但尚未做解码后的音频指纹，不能把目录关联写成逐样本同一证明。
- 本机没有 `ffprobe`。上述编码参数由仓库内只读审计脚本逐帧解析，Windows Shell 属性另行读出 `00:04:32 / 128kbps` 作为交叉证据；工具缺失如实记录在 `master-audit.json`，没有安装新依赖或伪造 ffprobe 输出。

## 尚未通过的不可逆 Gate

- 用户此前确认的是 `public/the36` 36 段音频及其中采样的公开/NFT 权利；现有记录没有明确逐字覆盖这个完整 MSTR 文件，因此完整母带的增量权利确认仍为 pending。
- “36 段试听完成”不等于完整 272.064 秒母带的人耳试听。完整母带试听仍为 pending。
- 因上述两项和永久 URL 均未冻结，本次没有上传 Arweave、没有写生产数据库，也没有填任何 txid。migration 首次插入 week 36 时保持 `published=false`、`arweave_url=null`、`audio_url=''`、`material_mintable=false`；API/播放器据此 fail closed。

## 可复现命令

```powershell
npx tsx scripts/p14/audit-track36-master.ts 'E:\Projects\nft-music\references\36-AU\第36个 当所有的碎片都在最后组合在了一起 MSTR.mp3'
npx tsx scripts/p14/verify-track36-contract.ts
```

运行结果以 `master-audit.json` 为结构化记录。任何后续永久上传都必须使用同一 SHA-256 的 MP3 bytes。
