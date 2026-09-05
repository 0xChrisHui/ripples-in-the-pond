# P14-A — 36 段音频审计、上传与永久冻结

> **目标**：把 `public/the36` 变成可验证、可重跑、不可误配的 P14 v1 永久声音输入。
> **前置**：P14-0 完成；Arweave 写入必须有 G6 单独授权。

---

## 0. 输入与字符合同

```text
CHARSET_V1 = ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
文件名     = <字符>.mp3
数量       = 36
```

字符顺序是配方算法的一部分，不按文件系统排序推导。Windows 默认排序可能把数字放在字母前，但 manifest 必须严格按 `CHARSET_V1` 输出。

当前只读预审计：

- 目录内 36 个 `.mp3`，没有缺字或多余字符。
- 每个文件均为 126,402 bytes。
- 36 个 SHA-256 全部不同。
- 当前机器没有可直接调用的 `ffprobe`；正式时长审计不得因此安装未批准 npm 依赖。

---

## A0｜冻结本地审计器

### 📦 范围

- `scripts/arweave/upload-p14-assets.ts`（新增后该目录正好 8 个文件，A/E 共用）
- `src/features/wallet-recipe/clip-manifest.ts`
- `src/types/wallet-recipe.ts`
- `src/features/wallet-recipe/clips-v1.json`（由脚本确定性生成）

若实际目录计数与本清单不同，先按 `rg --files` 复核；不得为塞文件突破 8 条目硬线。

### 脚本模式

同一个脚本提供三种互斥模式，避免多建一次性脚本：

```bash
npx tsx scripts/arweave/upload-p14-assets.ts clips --audit
npx tsx scripts/arweave/upload-p14-assets.ts clips --upload
npx tsx scripts/arweave/upload-p14-assets.ts clips --verify
```

- `--audit`：只读本地文件，生成候选 JSON 到 stdout；明确传 `--write-manifest` 才写仓库。
- `--upload`：需要 Turbo 凭证和 P14-0 授权；按字符顺序上传，成功一项立即原子保存进度。
- `--verify`：只读冻结 manifest，从两个网关分别取回每个对象并重新算 SHA-256。
- 未传模式、字符不全、出现多余 MP3、manifest 与本地 hash 冲突时 fail closed。

### 审计字段

每个字符记录：

```ts
type P14ClipV1 = {
  key: string;
  fileName: string;
  bytes: number;
  mimeType: 'audio/mpeg';
  sha256: string;
  durationMs: number;
  arweaveTxId: string | null;
};
```

清单顶层记录：

- `version: 1`
- `charset`
- `count: 36`
- `generatedAt` 只作审计信息，不参与内容身份比较
- `clips`
- `manifestSha256`：对移除 `generatedAt` 与自身字段后的规范 JSON 计算

### 精确时长

不以 `文件大小 ÷ 码率` 猜时长。优先顺序：

1. 若系统已有 `ffprobe`，记录版本并批量读取容器 duration、codec、sample rate、channels。
2. 否则用浏览器原生 Web Audio 对 36 个本地 URL `decodeAudioData`，以 `buffer.length / sampleRate` 得到解码时长；审计页必须由用户手势启动 AudioContext。
3. 两种方法同时可用时，差值超过 1 个采样帧即停，不擅自取平均。

不得为时长审计安装 `howler`、`tone` 或未批准 metadata 包。

### A0 验收

- 36/36 key 精确匹配；无大小写碰撞、隐藏副本或零字节文件。
- SHA-256 唯一数为 36；时长全部为有限正数。
- codec/sample rate/channels 一致；若不一致，报告具体 key 并停在上传前。
- 随机试听不是完整音乐验收：必须顺序试听 36 段，标记爆音、截断、过长静音、响度突变。
- `bash scripts/verify.sh` 通过。

### 🛑 Stop A0

向用户交付 36 行候选清单和异常摘要。用户确认“这些就是 v1 母带”后才允许 A1 上传。

---

## A1｜可恢复上传

### 前置检查

- 明确收到“允许上传 P14 36 段到 Arweave”。
- `TURBO_WALLET_JWK` 或 `TURBO_WALLET_PATH` 可读，但任何输出不得打印私钥/JWK。
- Turbo 余额覆盖 36 个音频 + 1 个 manifest，并预留一次失败重传缓冲。
- A0 manifest 的本地 hash 与工作树当前文件仍一致。

### 上传规则

1. 使用现有 `uploadBuffer`，Content-Type 固定 `audio/mpeg`。
2. 以内容 SHA-256 做恢复索引；同一 hash 已有已验证 txid 时跳过，不按文件名盲跳。
3. 每成功一条立即写入恢复文件；进程崩溃后从未完成 key 续跑。
4. 恢复文件不得含 JWK、token 或完整环境变量。
5. 上传后先等待传播，再验证两个网关；传播期 404 属等待态，不把同一内容再次上传。
6. 只有明确确认 txid 永久不可取或内容错误时才产生替代 txid，并保留旧/新对照。

### 禁止

- 不并发上传 36 项冲击余额或让错误难以归因。
- 不用 HTTP URL 作为永久身份写入 manifest；只保存 43 位 txid，运行时拼网关。
- 不修改源 MP3 以追求“统一”；发现母带问题返回 A0，让用户更换文件。
- 不把未验证 txid 写成冻结值。

---

## A2｜双网关字节验证与清单上传

对每个 clip：

1. 从 `arweave.net/<txid>` 取回原始 bytes。
2. 从 `ario.permagate.io/<txid>` 取回原始 bytes。
3. 分别计算 SHA-256，与本地冻结值三方比较。
4. 验证 Content-Type 可被浏览器解码，且 CORS 满足站内/永久 Decoder fetch。
5. 记录 HTTP 状态、字节数、hash 和验证时间；报告不得只写“能打开”。

36/36 通过后：

- 生成不含 `generatedAt` 波动的 canonical `clips-v1.json`。
- 上传该 manifest 到 Arweave，取得 `P14_CLIP_MANIFEST_V1_TX_ID`。
- 再从双网关取回 manifest，比较字节和 SHA-256。
- 本地冻结文件写入 manifest txid 与校验值；代码不得靠 env 临时替换 v1 字符映射。

若只有一个网关完成传播，继续有界等待并留下证据；两个都未通过时 A2 不完成。

---

## A3｜永久性复核

冻结后逐项证明：

- `CHARSET_V1[index]` 与 manifest `clips[index].key` 完全一致。
- 每个 `ar://txid` 取回内容与 `public/the36/<key>.mp3` SHA-256 一致。
- 36 个 txid 和 36 个内容 hash 均无重复。
- 时长总表可计算任意 recipe 的真实总时长。
- 删除数据库或关闭本站时，只凭 manifest + Arweave 仍能下载全部片段。
- manifest 未包含本地绝对路径、凭证、网关绑定或临时 URL。

### 证据输出

- `reviews/` 下新增 P14-A 冻结报告：总数、字符顺序、大小、时长、hash、txid、双网关结果。
- 大表只保存一次；STATUS 只写结论和报告链接。
- 若发生重传，报告解释旧 txid 为什么未采用。

---

## Track A 完成标准

- 36/36 源片段内容、时长、hash、txid 冻结。
- 全局 manifest 已永久上传并经双网关字节一致验证。
- 上传脚本支持 audit/upload/verify/resume，重复执行不会重复花费。
- 无新增 npm 依赖；没有把 Turbo 凭证写入仓库或日志。
- `bash scripts/verify.sh` 通过。
- 更新 STATUS/TASKS/LEARNING 后停在 P14-B。

### 夜间可验收摘要

第二天用户只需先看四项：`36/36`、`unique hashes=36`、`双网关=72/72`、`manifest hash 一致`；任一不是绿色都不进入 B 的永久绑定。
