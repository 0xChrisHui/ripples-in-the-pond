# P23-C：#12 等待故障修复与真实验收

2026-11-14，当前工作区；业务修复已推送 main 并上线。用户最终确认：**Semi 和 /score 都已显示正常**。

## 结果

- 原订单 `b04f071e-112d-47f3-852a-d8741ddb73ac` 于北京时间 **15:20:20** 完成，仍是原 ScoreNFT 的 **#12**。
- 没有新建订单、重新上传资源或替换 NFT 合约。仅在确认无锁、无发送尝试、无交易哈希后，以条件更新提前结束原订单的等待期，再由正常队列处理。
- 最后一次恢复与自然 cron 重叠：自然 worker 领取并完成订单，手动调用返回 processed=0；没有重复发送。
- [成功交易](https://optimistic.etherscan.io/tx/0xd4b07e457241809b6c08a33418969bcfaa009418b342bf6e5e43b5a6f633721d) 在同一笔交易中包含 Transfer、MetadataUpdate 和 ScoreIssued。旧订单映射=12，交易所在区块的 tokenURI 已完整写入，数据库 mint/URI 哈希相同。
- 生产播放快照 revision=1；[原作品链接](https://pond-ripple.xyz/score/b04f071e-112d-47f3-852a-d8741ddb73ac) 显示「已定稿」「Ripples #12」，浏览器无捕获到的页面或控制台错误。用户随后确认 /score 正常。
- Alchemy 未经手动刷新即自动索引名称、永久 URI、完整资料及图片；缓存图片 HTTP 200、JPEG 800×800、127904 字节，SHA-256 与原图一致。用户随后确认 Semi 正常。

## 根因与修复

新加的发行前 arweave.net 全文检查在生产端收到 HTTP 302，并把它归入「资源尚未传播」，导致等待间隔增长到十五分钟。资源本身已通过原双网关验证；这不是 JPG 文件损坏，也不是链上交易卡住。

第一轮显式跟随跳转后，生产证据进一步显示：该节点对 metadata 返回的 302 **没有 Location**。因此仅支持普通跳转还不够。本地默认 fetch 能正常读取，不代表生产出口行为相同。

最终处理：最多三次显式跳转，共享八秒总超时；只允许 HTTPS 官方域名与同一交易路径。主域返回无 Location 的跳转时，按交易 ID 确定官方资源子域，再读取同一文件；子域仍异常则继续等待。最终 MIME、大小、哈希检查全部保留，不接受跳转状态本身作为文件可读证据。

子域是交易 ID 原始字节的无填充、小写 Base32，依据 [ar.io 官方 Browser Sandboxing 文档](https://docs.ar.io/build/advanced/sandboxing/#deriving-sandbox-value)。尚未证明为什么该生产节点省略 Location；记录为已观测到的网关响应差异，不归咎于未经证实的 Vercel 或 Next.js 缺陷。

## 发布与验证

- 诊断提交 `491836f`；普通跳转处理 `4dbd945`；最终子域补全 `a2a3780`。
- 最终生产部署 `dpl_FPmJnuqwkAUCaupx7oBh4Dy44gXY`，构建日志确认 a2a3780，READY 且绑定 `pond-ripple.xyz`。
- 39 项专项测试通过：真实队列发送/恢复边界、常见跳转、越界与循环、错误内容、官方子域示例及 #12 两个实际资源 ID。两轮独立只读复核均无重大问题。
- 本地真实主域与推导子域读取、生产资源检查、真实链上发行、Alchemy 图片下载、官网浏览器及用户 Semi 验收均已完成。
- 完整验证的队列非空断言被 #12 本身触发；用户明确批准本次临时例外。恢复后独立重跑 Production snapshot Gate 已通过，未修改或绕过检查脚本。两处历史目录超限 self-mint=9、types=10 保留。
- 最终完整 verify 退出1：执行时的队列非空断言（本次已批准例外，恢复后原检查已通过）及两处既有目录超限；类型、Lint（4个既有警告）、其他业务Gate、生产构建和Forge152/152通过。日志与退出码见 `reviews/evidence/p23-order12/verify-sandbox.*`。不把此次全量命令描述为全绿；未修旁线、未放宽检查。

证据目录：`reviews/evidence/p23-order12/`。`http302-proof.json` 与 `missing-location-proof.json` 保留失败原貌；`order-proof.json`、`alchemy-image.json`、`deployment.json` 和 `page.json/png` 保留恢复结果。历史 #11 不在本次恢复范围，不能用 #12 的成功推断旧缓存恢复。
