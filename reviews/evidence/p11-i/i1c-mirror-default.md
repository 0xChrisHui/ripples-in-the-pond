# I1-c 首播音效默认镜像验证

- 音频 resolver 在调用方未显式传 `mirrorBaseUrl` 时，使用已配置的 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL`。
- 调用方显式传空字符串时仍只走永久网关，保留故障演练和隔离测试能力。
- 新增定向测试证明：配置镜像时首个且唯一请求为镜像完整 GET，不等待永久网关。
- `npx tsx scripts/p15/checks/mirror-race.ts`、`npm run p15:h6:verify`、TypeScript 与相关 ESLint 全部通过。
