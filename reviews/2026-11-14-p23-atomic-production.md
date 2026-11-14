# P23-C 原子发行生产验收

2026-11-14，北京时间14:06:59启用；14:07:16生产读回通过。用户授权后台、部署授权和生产切换，暂停讨论后再次明确恢复。当前工作区完成，其他线路保留。

## 已完成

- 业务提交：22bd846；正式部署：dpl_4cVTZ5MpQj9osSy1A6ozdRuq8SWK（Ready，绑定pond-ripple.xyz）。
- NFT保持 0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA；旧订单账本保持 0x406519962cDD1673D30fEcC13c4B6f7Af87Ba1dA。
- 发行助手：0x7cb59E953d59563EeF66314a583CEa18f703E714；两层MINTER_ROLE已读回；运营钱包旧Orchestrator角色已撤销。
- 数据库064已应用，新单issuance_mode默认atomic，score-atomic:enabled=true。切换时旧在途0，运营nonce latest=pending=81。
- 正式cron返回atomic-v1和同一助手地址；链上运行字节码与本次构建匹配；新入口模拟成功，旧入口直接调用模拟回滚。
- 手动核验结束于14:07，随后自然cron心跳已到14:09；当前活跃订单0，独立SQL测试schema已清理。
- 模拟前后测试orderId映射均为0，下一编号12的NFT不存在；没有替用户铸造。

## 验证

后台专项22、P24回归37、真实PostgreSQL独立测试区8项、完整Forge152项在接线阶段通过。接线完整verify仅两处已接受历史目录超限（self-mint9/types10），类型、Lint、业务Gate和生产构建通过。本轮切换再次完整verify退出1，仍仅上述两处目录超限；类型、Lint、业务Gate、生产构建和Forge152/152通过，无新增失败。完整证据见同目录verify-cutover.log/exit。

证据：[生产模拟与接口](evidence/p23-atomic-live/production-proof.json)、[切换与部署](evidence/p23-atomic-live/cutover.json)、[链上四笔操作](evidence/p23-atomic-live/chain-actions.json)。

## 用户验收

在官网新铸一张OP共创唱片，预计#12。核对数据库atomic、预留编号、已验证metadata、同一mint/URI交易哈希及链上URI，再查询Alchemy并到Semi查看封面。配置与模拟通过不等于Semi实显通过。不要用旧#11是否自动变好判断新流程。

## 边界与恢复

- 原有NFT、URI、编号、原曲/Ethereum/Echo路径保持原样；旧#11的Alchemy空缓存尚未恢复。
- 保留一张历史failed且从未尝试发链上交易的旧单，未代用户重试；如恢复须独立对账，不能假定旧入口仍有权限。
- 如需暂停，把score-atomic:enabled改false，仅停止新预留；已冻结订单继续按新入口恢复。不要直接回滚旧后台或改默认legacy。
- 项目维护文档已同步本次真实进度，先前“未部署/未接线”段落为历史记录。
