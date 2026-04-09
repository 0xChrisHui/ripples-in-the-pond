# Phase 1 Track A — 后端 + 合约

> 🎯 **目标**：建好数据层 + 产品合约 + API，给 Track C 集成做准备
>
> **分支**：`feat/phase1-backend`
>
> **与 Track B 并行**，完成后等 B 完成，一起进入 Track C

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| A0 | 建 tracks + mint_events 表 + 清理模板 | Dashboard 看到表 |
| A1 | 自定义 MaterialNFT 合约 + 部署 | Etherscan 看到新合约 |
| A2 | tracks 种子数据 + GET /api/tracks + GET /api/tracks/[id] | curl 返回 JSON |
| A3 | GET /api/me/nfts | curl 返回用户 NFT 列表 |
| A4 | GET /api/health（最小健康检查） | curl 返回 ok + 余额 |

---

# Step A0：建 tracks + mint_events 表 + 清理模板

## 🎯 目标
Phase 1 需要 4 张表（ARCHITECTURE 决策 4）。Phase 0 已有 users + mint_queue，补 tracks + mint_events。清理 Foundry 模板文件。

## 📦 范围
- `supabase/migrations/003_tracks_and_mint_events.sql`（新建）
- Supabase Dashboard 执行 SQL
- 删除 `contracts/src/Counter.sol` / `contracts/test/Counter.t.sol` / `contracts/script/Counter.s.sol`

## 🚫 禁止
- 不改现有 users / mint_queue 表结构
- 不建 Phase 2+ 的表

## ✅ 完成标准
- Dashboard Table Editor 看到 tracks 和 mint_events
- 字段与 `src/types/tracks.ts` 的 Track / MintEvent 对齐
- Foundry 模板文件已删
- `forge build` 仍通过

## ⏪ 回滚点
Dashboard DROP TABLE。

---

# Step A1：自定义 MaterialNFT 合约 + 部署

## 🎯 目标
用自己的 Solidity 替换 OZ Preset，加 URI 管理 + AccessControl mint 权限。部署到 OP Sepolia。

## 📦 范围
- `contracts/src/MaterialNFT.sol`（新建）
- `contracts/script/Deploy.s.sol`（修改）
- `.env.local`（更新合约地址）
- `src/lib/contracts.ts`（更新 ABI）

## 🚫 禁止
- 不写 ScoreNFT（Phase 3）
- 不部署主网
- 不用 `onlyOwner`（用 AccessControl / allowlist）

## ✅ 完成标准
- `forge build` 通过
- 新合约在 OP Sepolia Etherscan 可查
- operator 有 MINTER_ROLE
- `.env.local` 更新为新地址
- 用 cron 跑一次 mint 验证全链路

## ⏪ 回滚点
改回旧合约地址即可。

---

# Step A2：tracks 种子数据 + GET /api/tracks + GET /api/tracks/[id]

## 🎯 目标
填入 3-5 条测试 track，写两个 API：列表（首页用）和详情（含是否已铸造）。

## 📦 范围
- `supabase/seeds/tracks.sql`（新建）
- `app/api/tracks/route.ts`（新建，列表）
- `app/api/tracks/[id]/route.ts`（新建，详情）

## 🚫 禁止
- 不做分页 / 搜索（Phase 2）
- 不上传音频到 Arweave（Phase 2）

## ✅ 完成标准
- `GET /api/tracks` 返回 `{ tracks: Track[] }`
- `GET /api/tracks/<id>` 返回 `TrackDetailResponse`（含 minted/pending 状态）
- Dashboard 里 tracks 有 3-5 条记录

## ⏪ 回滚点
```bash
git checkout HEAD -- app/api/ supabase/
```

---

# Step A3：GET /api/me/nfts

## 🎯 目标
返回当前登录用户的 NFT 列表，Track C 的个人页会消费这个 API。

## 📦 范围
- `app/api/me/nfts/route.ts`（新建）

## 🚫 禁止
- 不做分页
- 不做 NFT 转让

## ✅ 完成标准
- 带 Authorization header：`GET /api/me/nfts` 返回 `MyNFTsResponse`
- 不带 header：返回 401
- 有铸造记录时返回列表，没有时返回空数组

## ⏪ 回滚点
```bash
git checkout HEAD -- app/api/
```

---

# Step A4：GET /api/health（最小健康检查）

## 🎯 目标
一个端点检查系统状态：数据库连接 + 运营钱包余额 + 队列积压数。

## 📦 范围
- `app/api/health/route.ts`（新建）

## 🚫 禁止
- 不做复杂监控（Phase 4 用 Sentry）
- 不暴露敏感信息（余额用 "ok" / "low" / "critical"）

## ✅ 完成标准
- `GET /api/health?secret=<CRON_SECRET>` 返回：
  ```json
  { "db": "ok", "wallet": "ok", "walletBalance": "0.019", "pendingJobs": 0 }
  ```
- 无 secret 返回 401

## ⏪ 回滚点
```bash
git checkout HEAD -- app/api/health/
```

---

## Track A 完成后

1. 确认 `bash scripts/verify.sh` 全绿
2. 所有 step 已 commit
3. 等 Track B 完成
4. 进入 Track C（集成线）
