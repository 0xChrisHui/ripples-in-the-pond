# Phase 1 Review — 认同但延后的改进项

> 来源：`2026-04-09-phase-1-cto.md`
> 每条标注"建议在哪之前修"。

---

## 上主网前必须修（Phase 4 之前）

- **admin/minter 地址分离** — 部署脚本改成显式参数化，admin 转给冷钱包，minter 留给热钱包
- **mint API 限流 + 队列积压上限 + 全局熔断** — sponsored mint 是预算消耗入口
- **`server-only` 包 + 环境变量启动校验** — 服务端边界从约定升级为机制
- **统一 verify 入口** — 覆盖 lint / typecheck / build / 合约检查，解决 `.next` 生成物污染
- **字体方案决定** — 用 `next/font` 本地化或改系统字体，去掉外网依赖
- **链上成功后落库改为幂等收敛** — cron 重跑时不会重复插入 mint_events（当前已加唯一约束，但还没有"重跑安全"的补偿逻辑）

## Phase 2 之前建议修

- ~~**个人页展示 pending / failed 状态**~~ — 用户决定不做：个人页只展示成功的 NFT，失败由后端静默重试
- **铸造失败监控 + 告警** — 连续失败 N 次时告警、人工介入面板；当前只有 cron 自动重试（Phase 0 Review Fix），缺乏可观测性
- **loading / error / empty 三类显式状态** — 所有页面补上
- **"mint 成功"设计成分享瞬间** — 动画 / 截图卡片 / 社交分享
- **结构化日志 + 钱包余额告警** — 出问题时能知道、定位、止损
- **数据补偿脚本** — 链上成功但数据库没记录时的手动恢复方案

## Phase 1 期间顺手做（已滞后）

- **LoginButton 里的 console.log token** — Phase 1 说删但还在（已标注 Phase 1 删掉）
- **补齐 LEARNING.md / ERRORS.md** — slow mode 学习闭环落地
- **JOURNAL.md 记录"先修 P0 再进 Phase 2"的决定**
