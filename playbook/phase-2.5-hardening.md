# Phase 2.5 — Flow Hardening Sprint

> 目标：把 Phase 2 从"可玩的作品"升级成"可信的作品系统"，再进入 Phase 3 资产化
>
> 前置：Phase 2 已 merge 回 main
> 原则：不加新功能，只加固现有链路
> 来源：`reviews/2026-04-10-phase-2-cto.md`

---

## 总览

| Step | 做什么 | 验证 |
|---|---|---|
| S0 | DB 加固 + server-only + TTL 文案对齐 | verify 全绿 + build 通过 |
| S1 | AudioContext 延迟加载 | 首页不自动创建 AudioContext，首次按键后才初始化 |
| S2 | 录制时钟源迁移 | 事件时间基于音频时钟，回放可还原 |
| S3 | 合约 admin/minter 分离 + 统一 build 脚本 | 角色分离 + `npm run build` 纳入验证 |

---

# Step S0：DB 加固 + server-only + TTL 文案对齐

## 📦 范围
- `supabase/migrations/006_pending_scores_unique.sql`（新建）
- `src/lib/supabase.ts`（加 `import 'server-only'`）
- `src/lib/operator-wallet.ts`（加 `import 'server-only'`）
- `src/components/jam/HomeJam.tsx`（TTL 文案确认）
- `src/lib/draft-store.ts`（TTL 常量确认与后端一致）

## 做什么
1. 在 Supabase 加部分唯一索引：`CREATE UNIQUE INDEX ... ON pending_scores (user_id, track_id) WHERE status = 'draft'`
2. `supabase.ts` 和 `operator-wallet.ts` 顶部加 `import 'server-only'`（需先 `npm install server-only --legacy-peer-deps`）
3. 确认前端 TTL 文案"24h"和后端 `TTL_MS = 24 * 60 * 60 * 1000` 一致，抽成共享常量

## ✅ 完成标准
- `verify.sh` 全绿
- `npm run build` 不报错
- 前端组件 import supabase/operator-wallet → 编译报错（证明 server-only 生效）

---

# Step S1：AudioContext 延迟加载

## 📦 范围
- `src/hooks/useJam.ts`

## 做什么
当前 `useJam` 在 `useEffect` 里立刻创建 AudioContext 解码 26 个音效。改为：
1. 页面加载时只 fetch 音效列表（从 API 拿 Sound[] 数据）
2. 音效 mp3 文件延迟到首次用户按键时才 fetch + 解码
3. 或折中：页面加载时 fetch mp3 为 ArrayBuffer 缓存，但不创建 AudioContext，首次按键时才 `new AudioContext()` + `decodeAudioData`

## ✅ 完成标准
- 页面加载后、用户按键前，不存在 AudioContext 实例
- 首次按键后音效正常播放，延迟可接受（< 200ms）
- `verify.sh` 全绿

---

# Step S2：录制时钟源迁移

## 📦 范围
- `src/hooks/useRecorder.ts`
- `src/components/player/PlayerProvider.tsx`（暴露背景曲时间基准）

## 做什么
当前录制用 `performance.now()` 作为时间基准。改为：
1. PlayerProvider 暴露背景曲的 `AudioContext.currentTime` 和播放开始时间
2. useRecorder 用 `bgCtx.currentTime - playStartTime` 作为事件时间基准
3. 没有背景曲播放时（纯键盘演奏），回退到 `performance.now()`

这样录制的事件时间和背景曲播放进度对齐，Phase 3 做回放时可以精确还原。

## ✅ 完成标准
- 播放背景曲时录制的事件 `time` 基于音频时钟
- 停止播放后事件时间仍然合理（不出现负数或跳跃）
- `verify.sh` 全绿

---

# Step S3：合约 admin/minter 分离 + 统一 build 脚本

## 📦 范围
- `contracts/`（合约修改或重部署）
- `src/lib/contracts.ts`（更新 ABI 如有变化）
- `scripts/verify.sh`（加入 `npm run build`）
- `.env.local`（如需要新增 minter 地址配置）

## 做什么

### 合约角色分离
1. 检查当前 MaterialNFT 合约的权限模型
2. 如果合约支持 AccessControl / Ownable + 独立 minter role：配置分离
3. 如果不支持：评估是否需要重部署（OP Sepolia 测试网，成本为零）
4. 日常 cron 用 minter key，admin key 只用于紧急操作

### 统一 build 脚本
1. `verify.sh` 末尾加 `npm run build` 检查
2. 确保生产构建和开发模式行为一致

## ✅ 完成标准
- 合约有独立的 minter 角色，admin 和 minter 是不同地址（或至少是不同 role）
- `verify.sh` 包含 build 检查
- `npm run build` 零错误
- STATUS.md / TASKS.md 更新
