# HARDENING.md — 安全加固 & 演进路线

> 这些改进都是正确的工程实践，但不需要在 Phase 1 实现。
> 按里程碑逐步引入，等项目跑起来有用户了再做。

---

## 里程碑 A：首批真实用户后（~Phase 2-3 完成时）

### A1. API Rate Limiting

```
问题：没有限流，恶意用户可以无限调 mint API 烧光 Gas。
解法：
  - 数据库 rate_limits 表记录（user_id, action, window_start, count）
  - mint_material: 每用户每小时 10 次
  - mint_score: 每用户每小时 5 次
  - 全局：mint_queue 积压 > 100 时返回 503
  - pg_cron 每小时清理过期记录
```

### A2. Sentry 异常监控

```
问题：Vercel 日志只保留几小时，出了问题看不到错误详情。
解法：
  - Sentry Free 接入前端 + API Routes
  - mint_queue.error_message 记录完整错误栈
  - 关键操作加结构化日志
```

### A3. UptimeRobot 外部监控

```
问题：不知道系统是否正常。
解法：
  - GET /api/health 检查 Supabase + RPC + 余额
  - UptimeRobot Free 每 5 分钟 ping，宕机邮件告警
```

### A4. Telegram 余额告警

```
问题：热钱包 ETH 耗尽后所有铸造失败，手动巡检发现太慢。
解法：
  - Vercel Cron check-balance 每小时检查
  - < 0.1 ETH → Telegram 通知
  - 队列积压 > 50 → Telegram 通知
```

---

## 里程碑 B：用户量增长后（~100+ MAU）

### B1. 独立 Worker 替代 Vercel Cron

```
问题：Vercel Cron 最小 1 分钟间隔，铸造延迟可能被用户感知。
解法：
  - Railway 或 Fly.io 部署长运行 Node.js Worker（$5/月）
  - 每 5 秒轮询 mint_queue，FOR UPDATE SKIP LOCKED
  - 代码逻辑与 Cron 完全一致，只是执行频率更高
  - mint_queue 表结构不变，零迁移成本
```

### B2. Supabase Pro 升级

```
问题：Free 版无 Point-in-Time Recovery，pending_scores 丢了无法恢复。
解法：
  - 升级 Supabase Pro（$25/月）
  - 开启 Point-in-Time Recovery
  - 关键数据可恢复到任意时间点
```

### B3. Vercel Pro 升级

```
问题：Hobby 版 API Route 超时 10 秒。虽然乐观 UI 不依赖它，但部分边界情况可能受限。
解法：
  - 升级 Vercel Pro（$20/月）
  - API Route 超时延长到 60 秒
  - 更多 build 分钟数
```

---

## 里程碑 C：主网上线前（~Phase 5）

### C1. 运营钱包冷热分离

```
问题：单个热钱包持有所有 ETH，泄露损失大。
解法：
  - 热钱包：< 0.5 ETH，日常 mint
  - 冷钱包（或硬件钱包）：存储主要资金，手动充值热钱包
  - 告警阈值触发时从冷钱包补充
```

### C2. 私钥环境隔离

```
问题：Preview Deployment 也能访问 OP 主网私钥。
解法：
  - Vercel 按环境分别设置变量
  - Production + Worker：OP Mainnet 热钱包
  - Preview / Development：OP Sepolia 测试钱包
  - 杜绝把 process.env 整个打印到日志
```

### C3. 合约安全审计

```
问题：合约一旦部署不可修改，bug 成本极高。
解法：
  - Foundry 测试覆盖所有 mint 路径 + allowlist + 每日上限 + TBA 创建
  - 至少请一位懂 Solidity 的朋友 review
  - 考虑 Code4rena 社区审计（预算允许时）
```

### C4. 链上事件同步完善

```
问题：用户在 OpenSea 转了 NFT，你的数据库不知道。
解法：
  - Vercel Cron sync-chain-events 每 5 分钟
  - system_kv.last_synced_block 保证幂等
  - chain_events 表 UNIQUE(tx_hash, log_index) 防重复
  - Alchemy Webhooks 作为更实时的替代方案（Future）
```

---

## 里程碑 D：长期运营（6 个月+）

### D1. JWT 安全增强

```
问题：Privy JWT 直接使用时安全性取决于 Privy。社区钱包自签 JWT 用 HS256 有风险。
解法：
  - 社区钱包 JWT 使用 RS256 非对称签名
  - JWT 含 jti，登出时加入 jwt_blacklist 表
  - pg_cron 每天清理过期黑名单记录
  - JWT_PRIVATE_KEY / JWT_PUBLIC_KEY 环境变量
```

### D2. KMS 密钥管理

```
问题：环境变量中的明文私钥是安全隐患。
解法：
  - 迁移到 AWS KMS 或 GCP Cloud KMS
  - 私钥永不以明文存在
  - viem 自定义 signer 通过 KMS API 远程签名
```

### D3. Gnosis Safe 多签

```
问题：合约 owner 是单个 EOA，丢失无法恢复。
解法：
  - 合约 owner 转移到 Gnosis Safe
  - 2-of-3 多签（你 + 艺术家 + 可信第三方）
  - allowlist 变更需要多签批准
```

### D4. 多 L2 备选（OP 出问题时）

```
背景：项目主链已经是 OP Mainnet（决策 3，Phase 1 起就用），已经享受了 L2 的低成本红利。
本节是"OP 自身出问题"时的应急方案，不是常规演进路径。

可能触发的场景：
  - OP Sequencer 长时间宕机
  - OP 治理出现重大变更，与 EVM 兼容性产生分歧
  - 出现明显更便宜或更安全的 L2 替代

解法：
  - 在 Base / Arbitrum / 任意 EVM 等价 L2 上部署一套新合约
  - 改 RPC + chainId，代码不变
  - OP 上旧 NFT 保留（早期用户更珍贵）
  - 新铸造走新链
  - 前端通过配置切换目标链
```

### D5. Score Decoder 开源

```
问题：项目结束后用户怎么回放合奏？
解法：
  - 单文件 HTML（无需后端）
  - 输入 tokenId → 从 Arweave 读 Metadata → Web Audio API 回放
  - 开源到 GitHub，任何人可部署
  - 项目运营期间就开发好，不是结束后才想起来
```

---

## 里程碑 E：项目结束时

### E1. 低成本维持模式

```
步骤：
  1. 铸造模式切换为"用户自付 Gas"（前端连钱包签名）
  2. 停掉运营钱包、Worker、付费服务
  3. 保留 Vercel Hobby + Supabase Free
  4. 运营成本 → $0
```

### E2. 纯静态备选

```
如果 Supabase 也不想维护：
  1. ISR 缓存全部页面
  2. 前端直接从 Arweave 读数据
  3. 纯静态托管（Vercel / GitHub Pages）
  4. 不再接受新铸造，仅展示 + 回放
```

---

## 未分类改进（随时可做，优先级低）

| 改进 | 说明 |
|------|------|
| 结构化日志 | `console.log(JSON.stringify({ action, userId, timestamp }))` |
| 社区 API 健康检查 | 定期 ping，纳入 check-balance Cron |
| Arweave 多网关 | 已在架构中，实际编码时落实 |
| 合约升级流程文档 | 部署新合约 → 测试 → allowlist 切换 → 监控 → 移除旧授权 |
| 合奏数据大小限制 | pending_scores.events 限制最大条目数（如 500），防止超大乐谱 |
| 封面图预留量监控 | score_covers 剩余可用数量告警 |
