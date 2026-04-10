# Phase 2.5 — Flow Hardening Sprint (v2)

> 目标：把 Phase 2 从"可玩的作品"升级成"可信的作品系统"，再进入 Phase 3 资产化
>
> 前置：Phase 2 已 merge 回 main
> 原则：不加新功能，只加固现有链路
> 来源：`reviews/2026-04-10-phase-2-cto.md` + `reviews/2026-04-10-phase-2.5-playbook-review.md`
>
> 已在 Phase 2 中解决的 review 项（不再重复）：
> - 爱心乐观更新 + 失败不回退 → 用户决策，commit `c7e8e90`
> - "无草稿能否收藏" → 产品决策：允许，JOURNAL.md 已记录
> - 浏览器 token log → 已删除，commit `c7e8e90`
> - 红心缓存对齐 → Archipelago 每次加载从 API 刷新覆盖缓存，自愈

---

## 总览

| Step | 做什么 | 验证 |
|---|---|---|
| S0 | DB 加固 + server-only + TTL 真理源统一 | 唯一索引存在 + build 通过 + 前端 import 报错 |
| S1 | AudioContext 延迟加载 | 首页不自动创建 AudioContext |
| S2 | 录制时钟源统一（消除双语义） | 事件时间只基于音频时钟 |
| S3a | 合约 admin/minter 分离 | 两个角色不同地址 |
| S3b | 统一 build/verify | `npm run build` 纳入 verify.sh |

---

# Step S0：DB 加固 + server-only + TTL 真理源统一

## 📦 范围
- `supabase/migrations/006_pending_scores_unique.sql`（新建）
- `src/lib/supabase.ts`（加 `import 'server-only'`）
- `src/lib/operator-wallet.ts`（加 `import 'server-only'`）
- `src/lib/constants.ts`（新建，共享 TTL 常量）
- `app/api/score/save/route.ts`（改用共享常量）
- `src/lib/draft-store.ts`（改用共享常量）
- `docs/STACK.md`（登记 `server-only`）

## 做什么

### 1. 清理脏数据 + 创建唯一索引
数据库可能已有重复 draft（Phase 2 无约束期间产生）。Migration 分两步：
```sql
-- 1. 保留每组 user_id+track_id 最新的一条 draft，其余标 expired
-- 2. 创建部分唯一索引
CREATE UNIQUE INDEX idx_pending_scores_active_draft
  ON pending_scores (user_id, track_id) WHERE status = 'draft';
```

### 2. server-only
- `npm install server-only --legacy-peer-deps`
- `supabase.ts` 和 `operator-wallet.ts` 顶部加 `import 'server-only'`
- `docs/STACK.md` 登记该依赖

### 3. TTL 真理源统一
- 新建 `src/lib/constants.ts`，导出 `DRAFT_TTL_MS = 24 * 60 * 60 * 1000`
- `score/save/route.ts`、`draft-store.ts`、`me/page.tsx` 统一引用
- 确认前端文案"24h"和常量一致

## ✅ 完成标准
- `verify.sh` 全绿
- `npm run build` 不报错
- 前端组件 import supabase/operator-wallet → 编译报错（证明 server-only 生效）
- Supabase 唯一索引存在，重复插入返回冲突而非成功

---

# Step S1：AudioContext 延迟加载

## 📦 范围
- `src/hooks/useJam.ts`

## 做什么
当前 `useJam` 在 `useEffect` 里立刻创建 AudioContext 解码 26 个音效。改为：
1. 页面加载时只 fetch 音效列表 + mp3 文件为 ArrayBuffer（网络 IO，不需要 AudioContext）
2. 首次用户按键时才 `new AudioContext()` + 批量 `decodeAudioData`
3. 解码期间短暂 loading 状态（首次按键可能有 ~100ms 延迟，之后无感）

## ✅ 完成标准
- 页面加载后、用户按键前，不存在 AudioContext 实例
- 首次按键后音效正常播放
- `verify.sh` 全绿

---

# Step S2：录制时钟源统一

## 📦 范围
- `src/hooks/useRecorder.ts`
- `src/components/player/PlayerProvider.tsx`

## 做什么
当前录制用 `performance.now()` 作为时间基准。改为：
1. PlayerProvider 暴露背景曲的 `AudioContext.currentTime` 和播放开始时间
2. useRecorder 用 `bgCtx.currentTime - playStartTime` 作为事件时间基准
3. **无背景曲时不录制**（当前已是如此——useRecorder 订阅 PlayerProvider 的 onPlayStart/onPlayEnd，没播放就不录）
4. 删除所有 `performance.now()` 调用，消除双时钟语义

## ✅ 完成标准
- useRecorder 中无 `performance.now()` 调用
- 播放背景曲时录制的事件 `time` 基于音频时钟
- 录制回放时事件时间与背景曲进度对齐
- `verify.sh` 全绿

---

# Step S3a：合约 admin/minter 分离

## 📦 范围
- `contracts/`（合约修改或重部署）
- `src/lib/contracts.ts`（更新 ABI 如有变化）
- `.env.local`（如需要新增 minter 地址配置）

## 做什么
1. 检查当前 MaterialNFT 合约的权限模型
2. 如果合约支持 AccessControl / Ownable + 独立 minter role：配置分离
3. 如果不支持：OP Sepolia 重部署（测试网，成本为零）
4. 日常 cron 用 minter key，admin key 只用于紧急操作

## ✅ 完成标准
- 合约有独立的 minter 角色，admin 和 minter 可以是不同地址
- cron 处理器用 minter 身份调合约
- `verify.sh` 全绿

---

# Step S3b：统一 build/verify

## 📦 范围
- `scripts/verify.sh`

## 做什么
1. `verify.sh` 末尾加 `npm run build` 检查
2. 确保生产构建和开发模式行为一致

## ✅ 完成标准
- `verify.sh` 包含 build 检查
- `npm run build` 零错误
- STATUS.md / TASKS.md 更新
