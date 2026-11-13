# 2026-11-14 夜间任务早报

**已推送 `main` 并上线**。业务代码 `f007ec8`，发布记录 `22d8a29`；Vercel 生产部署 `dpl_DsxtavrZLU4QsA6DmZHGZoSLLUJm` 已 Ready，正式域名已绑定。以下官网检查在北京时间 04:38–04:40 完成。P25 国内加速**尚未启用**。

| 阶段 | 今晚已上线 | 明早打开、操作与预期 | 仍需本人操作 / 实际边界 |
|---|---|---|---|
| P23 视觉维修 | 作品页字体、大唱片、播放反馈、作品摘要与折叠凭证；详情页每链一卡、手机抽屉和双指换层；新600张封面池已在生产生效 | [作品 #1](https://pond-ripple.xyz/score/1)、[作品 #5](https://pond-ripple.xyz/score/5)：点唱片播放，向下看作品信息、展开完整凭证；[详情](https://pond-ripple.xyz/lens?track=4)：查看OP/ETH卡，手机展开/收起抽屉、双指换层，无遮挡处可点球播放。应见新布局、可滚动凭证、每链独立信息和同一抽屉；作品页自身保留浏览器缩放 | 真机双指/转屏手感、登录后的OP/ETH收藏及资产包仍需验收。新铸造应从600图池取封面，但今晚未发真实铸造。**Semi旧作品绿封面未恢复**：请用持有OP #5或#8的钱包登录Semi检查，详见独立调查报告 |
| P24 宣发负载准备 | 批量5单、非钱包步骤并发3、全局运营钱包串行与最终发送守卫；限流/排队反馈/告警逻辑 | [我的作品](https://pond-ripple.xyz/me)：登录后先完成一笔OP铸造，再组织少量受控多人排队；应显示排队/处理状态，额度或频率不足有明确提示，失败可按状态重试。ETH路径也需真实钱包验收 | 今晚为离线并发、顺序和失败重试验证，**未做主网压测或真实钱包铸造**。现有每分钟一次任务保留且发布后自然心跳已核实；需本人登录cron-job.org为既有评分队列和余额巡检开启失败通知，并核对P22独立调度、套餐/余额。无已确认必须追加支付的金额 |
| P25 国内访问准备 | 默认关闭的可信IP/同源媒体兼容代码，香港节点模板、检查/预热脚本、运维与回滚说明已入库 | [首页](https://pond-ripple.xyz/)、[Echo #1](https://pond-ripple.xyz/echo/1)：按原方式播放，应正常出声；现有音频路径保持原配置 | **大陆加速未启用，未证明大陆已变快**。白天购买香港服务器、验证线路，再完成AWS/全量DNS/证书/生产变量/大陆分流/音频镜像。真实香港TLS、故障切换和带宽演练须在线路通过后做；本地Next/nginx合同测试不能替代这些验收 |

## 已实际核查

- 主代理在整合后亲跑 `bash scripts/verify.sh`：退出码1，仅两处已接受的旧目录超限（`src/lib/self-mint` 9、`src/types` 10）。类型、Lint、生产历史快照、686词条、业务门禁、生产构建及Forge 139/139通过；没有新增失败。P24 20/20、P25 12/12、P23末轮意图/转屏真实源码回归10/10通过。完整摘要见 [verification.json](evidence/night-20261114/verification.json)。
- 官网首页、OP Score #1/#5的桌面和390px手机均就绪，无横向溢出；详情桌面和手机抽屉可见，手机抽屉已展开。浏览器未记录脚本或控制台错误。抽屉按方案可换边避球，截图中停在顶部是该规则生效。
- 官网实际点击Score #1与Echo #1，均进入 `playing`，Score首音调度有记录；不是只检查HTTP页面。无头浏览器不能代替本人听感、手机实体手势和钱包操作。检查摘要和公开资源路径见 [audio.json](evidence/night-20261114/after/checks/audio.json)。
- `/api/ping` 200且IP来源为direct；原曲 `No.1.mp3` Range返回206/1字节；未配置新Blob origin时 `/media/<txid>` 仍404，符合默认关闭状态。原Blob镜像播放资源仍在使用，未改生产变量、DNS或流量。见 [HTTP记录](evidence/night-20261114/after/checks/http.json)。
- 04:38现有定时器自然写入发布后心跳；04:38:54四队列活跃/未知/人工复核/有效租约均0，Pack intents 0、无钱包锁/广播标记、无新告警记录。OP已确认/待确认序号均76，与发布前一致；未手动触发处理cron或发送交易。见 [发布后只读记录](evidence/night-20261114/postdeploy-queue.json)。

## 封面池与Semi分别结论

600张JPG全部通过完整性与唯一性检查，逐张上传并由Arweave及至少一个独立网关读回同哈希；无重复付费上传。上传前余额1,279,968,307,778 winc，实扣661,590,062,782，剩618,378,244,996，无需补款。

先用事务替换并ROLLBACK试跑，再在一个事务里锁表、断言原100张静态身份、插600删100并COMMIT。提交后以及主代理独立读回均确认600条与既定轮转顺序一致，无回滚。首张A001的公开图已200/JPEG；生产池生效不意味着已铸旧NFT换图。正式台账在 `data/p23/cover-upload-ledger.json`、`cover-uris.json` 和 `score-covers-before/after.json`。

Semi调查查到：已铸 #5/#8的链上永久metadata与SVG图片可读；Alchemy返回的图片与tokenURI字段为空，Semi补全链路还有重定向障碍。当前没有证据支持修改本项目已铸永久内容来修复，未改外部Semi仓库，也未宣称恢复。详见 [Semi调查](2026-11-14-p23-semi-cover-investigation.md)。

## 关键截图

以下均为发布后从正式域名截图，非本地示意：

- [作品页·桌面](evidence/night-20261114/after/score-desktop.png) · [作品页·手机](evidence/night-20261114/after/score-mobile.png)
- [详情卡·桌面](evidence/night-20261114/after/lens-desktop.png) · [详情抽屉·手机展开](evidence/night-20261114/after/lens-mobile.png)
- [Score正在播放](evidence/night-20261114/after/playback/score-playback.png) · [Echo正在播放](evidence/night-20261114/after/playback/echo-playback.png)

## 提交与白天操作入口

- P23末轮安全/转屏：[c9776cb](https://github.com/0xChrisHui/ripples-in-the-pond/commit/c9776cb)、[f007ec8](https://github.com/0xChrisHui/ripples-in-the-pond/commit/f007ec8)；封面生产台账：[6a8692e](https://github.com/0xChrisHui/ripples-in-the-pond/commit/6a8692e)；页面/抽屉说明见 [P23夜报](../playbook/phase-23/05-night-report.md)。
- P24收口：[0a15e52](https://github.com/0xChrisHui/ripples-in-the-pond/commit/0a15e52)；具体通知与额度核查步骤见 [运维清单](../playbook/phase-24/01-ops-checklist.md)。
- P25凭据隔离：[e90e013](https://github.com/0xChrisHui/ripples-in-the-pond/commit/e90e013)，香港工具：[8679f32](https://github.com/0xChrisHui/ripples-in-the-pond/commit/8679f32)；白天启用和三种回滚见 [香港节点手册](../ops/hk-edge/README.md)。当前默认关闭部署不是启用同源镜像后的回滚基线，配置origin且Range通过后须另标基线。
- 三阶段整合验证与发布记录：[22d8a29](https://github.com/0xChrisHui/ripples-in-the-pond/commit/22d8a29)。本早报与官网截图在后续纯文档提交归档，不包含新增业务代码。

实际子代理：P23、P25均GPT-6.1 Sol 高，P24为GPT-6 Astra 高；各做过重点交叉审查并修复发现的问题。主对话的工具不支持切换模型，保持当前会话统筹，未假称已切成指定型号。主仓和已有P24工作区的其他进程改动保留；未强推、未整体合并P24旧基线、未改架构/技术栈、未新增依赖或额外付费。
