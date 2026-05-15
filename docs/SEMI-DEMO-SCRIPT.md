# Semi 社区钱包 demo 演示话术 + 实测脚本

> Phase 7 Track B B4b 产出。投资人 demo 用 + B4a 端到端冒烟用。
>
> **PoC 范围**：仅测试网（OP Sepolia）+ 限定测试号清单 + 仅投资人 demo 场景；不向公众开放。
> **正式授权状态**：未经 Semi 团队明确许可使用 `/send_sms`、`/signin`、`/get_me`。Phase 10 主网前必须找 Semi 沟通正式授权或切 SIWE。

---

## 一、B4a 端到端实测脚本（先用户自己走通，再约投资人）

### 前置

- Vercel preview 部署完成（B2/B3 commit 推上 main 触发）
- Vercel env `SEMI_API_URL=https://semi-production.fly.dev` 三环境齐
- 一个 Semi 钱包 APP 端真实账号 + 能收短信的手机号
- 测试网 OP Sepolia operator wallet 有足够 ETH（用于收藏 → MaterialNFT 铸造）

### 7 步流程

1. **退出 Privy 登录**：浏览器打开 `https://pond-ripple.xyz`（或 preview URL），右上角如显示"我的音乐 / 登出" → 点登出
2. **打开 LoginModal**：右上角"登录"按钮 → modal 弹出 → 默认 tab 是"邮箱"
3. **切到 Semi tab**：点击"社区钱包" tab → 看到手机号输入框 + 发送验证码按钮
4. **输手机号 + 发码**：输 Semi APP 注册的手机号（默认 +86，不带 country code 选择器）→ 点发送验证码 → button 变 loading → 成功后切到验证码输入页 + 60s 倒计时
5. **输验证码 + 登录**：输入 6 位短信验证码 → 点"登录" → 成功后 modal 关闭 + 右上角显示"我的音乐"（已登录态）
6. **校验地址**：进入 `/me` 页 → 顶部右侧地址缩写应当是 Semi 钱包 APP 内的 EVM 地址（与 Semi APP 一致）
7. **铸造 + 链上确认**：回首页 → 选一个 sphere → 点收藏 → /me 看到 MaterialNFT 卡片（先灰 pending，后绿 minted）→ 等 1-3 分钟 cron 跑完 → tx hash 出现 → 在 `sepolia-optimism.etherscan.io` 搜地址确认 ERC-721 Transfer 到 Semi 钱包地址 → 在 Semi 钱包 APP 内查"我的 NFT"应当能看到这枚

### 边界场景验证

- **错码**：故意输错验证码 → modal 内显示红色"验证码无效或已过期"
- **60s 内重发**：刚发完码立刻点"重发"按钮 → 按钮 disabled 显示"60s 后重发"
- **手机格式**：输非数字 / 长度 < 5 → 按钮 disabled
- **JWT 过期**（24h+ 后）：等 7 天真过期，或在 DevTools localStorage 把 `ripples_auth_jwt` 的 exp 改成过去时间戳 → 刷新页面 → useAuth 自动 logout（顶栏回到"登录"按钮）
- **双源切换**：登出 Semi → 重新用 Privy 邮箱登录同地址账号 → /me 数据不串（B1 cache 隔离已防护）

### A1 完结后回归 smoke（10 分钟）

A1 chain-config 抽走后必须重跑：
- 步骤 5（输码登录）
- 步骤 7（铸造 + Etherscan + Semi APP 端确认）

只跑这两步即可，不需要全 7 步重做。

---

## 二、投资人 demo 现场话术（30 秒版）

> "我们的 Ripples in the Pond 已经接入 Semi 社区钱包登录。投资人这边可以用 Semi APP 注册的手机号，60 秒之内拿到验证码登录我们站，进来后铸造的 NFT 会直接进到 Semi 钱包里。这是测试网 demo，主网部署日我们会和 Semi 团队对齐正式授权。"

### 演示节奏（5 分钟版）

1. **0:00-0:30** — 打开 `https://pond-ripple.xyz`，介绍项目（音乐 NFT 平台，108 首曲目，铸造素材 → 合奏录制 → 乐谱 NFT）
2. **0:30-1:30** — 演示登录：点右上角登录 → modal 弹出 → 切 Semi tab → 投资人输自己手机号 → 短信验证 → 登录
3. **1:30-2:30** — 选一个 sphere → 收藏 → /me 看到 NFT 卡片（pending → minted）
4. **2:30-3:30** — 打开 Semi 钱包 APP → "我的 NFT" → 找到刚铸造的这枚（截屏归档）
5. **3:30-5:00** — 答疑：主网时间表 / Semi 正式授权 / 后续 UI 翻修计划（Phase 8）

### 现场可能踩坑预案

| 风险 | 应对 |
|---|---|
| Semi API 限流 | 临时换备用测试号，或停演示改 PPT |
| 短信延迟 > 60s | 让投资人耐心等，或事先用自己手机号"预热"演示通路 |
| 链上确认慢（5-25min） | 提前在 demo 前 10 分钟用自己账号先铸一枚预热 cron；现场说"NFT 通常 5 分钟内上链，今天我们提前预热过了" |
| Vercel preview down | 切到 `pond-ripple.xyz` 主域名（main 分支） |
| Semi APP 端 NFT 不可见 | 截图主链 etherscan tx 证明所有权（备份证据） |
| 投资人浏览器 cache 太脏 | 让对方用隐私模式开 demo URL |

---

## 三、demo 后归档清单

演示完成后归档到 `reviews/2026-05-XX-semi-demo-screenshots/`：
- 7 张关键节点截图（Modal 弹出 / 切 tab / 输手机号 / 收码 / 登录成功 / /me NFT 卡 / Semi APP 端 NFT）
- 投资人 quote / 反馈 1-2 句（如有）
- 触发的 bug 清单（如有）→ 同步 STATUS 悬空 TODO

---

## 四、风险与后续

- **Semi API 任意时候变更** → 后端 `src/lib/auth/semi-client.ts` 重写，前端不动
- **Semi 拒绝授权** → Phase 10 切 SIWE 钱包签名方案（JWT 中间件 100% 兼容）
- **localStorage JWT XSS 风险**（PoC 阶段接受）→ Phase 10 主网前重新评估是否换 httpOnly cookie
- **JWT 过期前端检测频率**：useAuth 每 60 秒兜底检查 + storage event 跨 tab 同步；403/401 全 caller 自动 logout 挂 P10（当前各 caller 自行 catch）
