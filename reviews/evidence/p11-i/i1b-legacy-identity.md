# I1-b 旧数字 Score 主网身份验证

- 本地环境仍为 OP Sepolia（链号 11155420），用于证明数字路由不会跟随当前铸造环境漂移。
- `npx tsc --noEmit`：通过。
- I1-b 相关文件 ESLint：通过，0 error。
- `npm run p15:h5:verify`：verified snapshot 测试与新增 legacy identity 配置门禁均通过。
- 用户批准忽略本机 Google Fonts 后，临时移除字体初始化完成 `npm run build`：38/38 路由通过；随后恢复 `app/layout.tsx`，字体无提交差异。
- 本地 `GET /score/1`：HTTP 200；SSR 同时包含 `OP Mainnet`、`FINALIZED` 和旧合约前缀 `0xAc3F7471`，不包含“已验证播放快照暂时不可用”。
- 发布前仍需用户确认 Vercel Production 的链号为 10、ScoreNFT 为 `0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA`；配置不符时新增门禁会主动让 Production 构建失败。
