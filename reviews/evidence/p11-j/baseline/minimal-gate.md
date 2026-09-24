# P11-J 最小交互 Gate

> 执行时间：2026-09-24 17:15（Asia/Shanghai）
> 命令：`node scripts/p11/score-route-handoff.mjs --minimal`
> 结果：通过

## 场景结果

| 场景 | 结果 | 关键证据 |
|---|---|---|
| 浏览器 Back | 通过 | `/score/1 → /me` 后 `stable/archive`，busy 与来源 stage 均清空，锚点 0 |
| 快速反向 | 通过 | `/score/2` RSC 冷延迟 2002ms；`preparing` 时 Escape；请求正常释放后仍为 `/me`、`stable/archive`，无晚到导航、busy、来源 stage 或锚点残留 |
| 换目标 | 通过 | `/score/1` preparing 时改点 `/score/2`，最终 Token 为 2；返回档案后 busy 清空且锚点不超过 1 |
| 失败壳恢复 | 通过 | 公开缺失 `/score/99999999` 落到真实失败生命周期页；返回 `/me` 后 `stable/archive`，无 busy、来源 stage 或锚点残留 |
| 音频离页清理 | 通过 | 主动播放请求创建 AudioContext 1 个；离开 Score 后 AudioContext/source/media/Score-owned fetch 全为 0 |
| 双播放器 | 通过 | 整段逐帧 telemetry 中双播放器帧为 0 |
| 生产数据只读 | 通过 | 生产同源写请求 0；2 个 Next dev 栈帧 POST 单独记录，不属于产品或数据库请求 |

## 观测限制

- 本轮外部媒体未在离页前进入 `playing`，但已建立真实 AudioContext 并触发 Score 播放资源路径；离页清理断言全部归零。真实持续播放离页仍复用 P11-I I6 的 real-playing 证据。
- 控制性换目标会主动中止旧 `/score/1` RSC，控制台的对应 `Failed to fetch RSC payload` 是预期取消日志。
- `/score/99999999` 的 verified snapshot missing 日志是失败壳场景的预期输入。

完整逐帧数据与请求明细见 `minimal-interactions.json`。
