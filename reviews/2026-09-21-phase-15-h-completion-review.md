# P15-H Permanent Core + Verified Edge 完成复盘

日期：2026-09-21  
范围：`playbook/phase-15/90-h-permanent-core-verified-edge.md` H0–H8

## 结论

P15-H 已把永久真相、可重建快照和边缘加速分层落地。数字 Score 的 HTML/RSC 直接内嵌已验证
events 与 effective sounds，浏览器不再为了两个小 JSON 等待 Arweave；音频立即请求 Blob，
1.2 秒后才以 Arweave hedge 兜底，任何来源都必须通过完整身份验证。

Score #1–#4 均保留原 tokenURI 与原始永久档案。#1 保持 legacy-26；#2–#4 按链上时间与
Production 版本证据精确恢复录制时的 current-33，其中 #2 使用真实 `space`，没有静音占位。

## 永久身份

- SoundSet：`current-33-v1`，33 个键与 33 个唯一 MP3。
- 33 键 manifest：`-93vQHgv6u7csNm4ImhDh48NU8Ys3ZGk4KRQAB0l4mg`。
- decoder v3 修正版：`Yu9fOcdc8fzBnPzFWabCyeh3TRcXYTowN5cpv68dOO0`；首版保留为历史 revision，不覆盖。
- Score #1–#4 compatibility：分别为 `q7RC…inlw`、`sxHC…R05A`、`HWa3…HpDE`、`tzMA…LpaY`。
- 四份 compatibility 均绑定 chain、ScoreNFT contract、tokenId 与原 tokenURI，并由发布时持有
  ScoreNFT admin role 的 `0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722` 作 EIP-712 签名。

## 发布结果

- H4：37 个唯一音频对象全部完成 AR→Blob 精确路径镜像与全字节 readback；4 个既有对象复验，
  33 个新对象上传。误建的 1 个未引用随机后缀重复对象已删除。
- 数据库：远端 migration `052_permanent_core_queue_and_snapshots.sql` 已应用；Permanent Core
  registry、35/35 track base 身份、0 个活跃旧队列均通过读回。
- Snapshot：Development、Preview、Production 各有 Score #1–#4 四枚 active immutable revision；
  #2 的 bootstrap 明确包含真实 `space` 音频身份。
- Preview：部署 `dpl_FTBGG1jF99PoTa4zDS1tuZsfif1m` 为 READY；四个数字路由 HTTP 200、
  `edition-stamp=finalized` 且均含 `ripples.score-bootstrap.v1`。
- Production：`pond-ripple.xyz/score/1–4` 均以 HTTP 200 返回 finalized 页面与 bootstrap；#2
  同时包含 `space` 和永久音频 txid `y_nkK9XOvAIDizi_LP60BuXoRriAKvQvLuADjhFxd3s`。

## Gate 结果

- 完整 `scripts/verify.sh` 仅运行一次：TypeScript、ESLint、H1/H2/H4/H5/H6/H7、37 路由
  production build、目录/危险代码检查与 Foundry 56/56 通过。
- 完整运行中的 H3 曾因合法的更高状态 `edge-mirrored` 未列入旧断言而失败；修正状态断言后，
  只重跑受影响的 `p15:h3:verify`、H7 production readback 与 TypeScript，全部通过，没有重复全量 Gate。
- resolver 定向故障注入覆盖 Blob 慢、404、坏类型、坏长度、坏 hash、AR 回退、双路径失败与
  abort；snapshot Gate 覆盖 AR 被屏蔽时 HTML 仍能生成 bootstrap、篡改 hash fail closed。

## 保留边界

- 历史 `animation_url` 永久不可改；主站与签名 compatibility decoder 能恢复播放，但 UI 继续
  区分“原始永久档案”和“兼容恢复”。
- Supabase snapshot 与 Vercel Blob 都是可重建层，不替代链上 tokenURI 和 Arweave 原件。
- 现有合约仍是 mint 后才能得到 tokenId；package Gate 已把 mint 前可验证范围做到最大，
  mint→metadata→setTokenURI 的剩余孤儿风险留给未来合约版本。
- H4 完成后不需要 Development OIDC 作为运行时依赖；应撤回本次临时开放的 Development scope。
