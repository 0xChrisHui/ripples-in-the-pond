# I1-a 验证记录：本机 Google Fonts 构建请求

- 范围：`app/api/me/score-nfts/route.ts` 仅把 `tracks(title)` 改为显式关系 `tracks:tracks!score_nft_queue_track_id_fkey(title)`；产品其他文件未改，代码仍留在工作区、未提交。
- 第 1 次：`bash scripts/verify.sh`。TypeScript、ESLint（0 error，3 条既有 warning）、SoundSet、Permanent Core、Verified Edge、Score snapshot、生产只读回查、Instant Start、文件/目录规模、危险代码扫描及 Forge 56/56 均通过；`npm run build` 因五个 `next/font/google` 字体下载失败而使整体退出码为 1。
- 第 2 次：单独 `npm run build`，退出码 1；同样五个字体请求错误。原始本机日志：`.tmp/p11-i1a-build2.log`（不入库）。
- 第 3 次：单独 `npm run build`，退出码 1；同样五个字体请求错误。原始本机日志：`.tmp/p11-i1a-build3.log`（不入库）。
- 独立连通性检查：请求 `https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap` 在 10 秒后超时；`pond-ripple.xyz` 则返回 200。Next.js [官方字体文档](https://nextjs.org/docs/app/api-reference/components/font)明确 Google CSS 与字体文件会在构建时下载。
- 用户 2026-09-24 明确批准本地验证绕过 Google Fonts：字体加载不影响本次核心功能，不要求等待外部网络恢复。
- 绕过方式：临时从 `app/layout.tsx` 移除 `next/font/google` 初始化，仅执行一次 `npm run build`；38/38 页面构建通过。随后立即恢复 `app/layout.tsx`，文件内容 hash 与 `HEAD` 完全一致，字体改动不进入提交。
- 结论：I1-a 的查询改动通过 TypeScript、ESLint、全部 P15 合同/只读 Gate、无远程字体的生产编译及 Forge 56/56。线上字体配置保持原样；发布环境仍会用原 `next/font/google`。
