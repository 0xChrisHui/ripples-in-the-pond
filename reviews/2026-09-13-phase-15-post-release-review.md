# Phase 15 发布后 Review 与优化记录

日期：2026-09-13

## 结论

P15 的导航反馈、首页 LKG、私人档案分段刷新、永久媒体 resolver 与两套播放状态机未发现新的阻塞级回归。本轮发现并修复 3 个合并后合同缺口，均集中在 P14 永久音频字段进入 P15 缓存/档案后的交界面。

## 已修复问题

1. **P1 — 同一内部 userId 的跨登录源内存串档窗口**
   - 原因：`/me` 的缓存 key 含 `authSource`，但当前内存 owner 与轮询回写只比较 `userId`。
   - 修复：内存 generation、页面放行条件和轮询回写统一比较 `authSource + userId` 复合身份。
2. **P1 — `/me` 与处理中 Score 返回不完整 Track 合同**
   - 原因：P14 新增 `arweave_url/audio_gateway_urls` 后，`/api/me/nfts`、`/api/me/scores` 和数据库 Score 路径仍直接暴露 DB 行。
   - 修复：三条路径统一经过 `exposeTrack`，永久音频存在时优先返回同一组三网关候选；pending 素材的 `track: null` 也改为真实类型。
3. **P2 — 首页与私人档案接受旧 Track 缓存**
   - 原因：运行时校验未覆盖两个永久音频字段，损坏或旧响应可能继续成为 LKG。
   - 修复：建立共享公开 Track 校验器；首页、录音和素材缓存都拒绝不完整合同，坏响应不覆盖最后成功快照。

## 回归结果

- TypeScript：通过。
- ESLint：通过；保留 3 条既有 P8 warning，本轮无新增 warning。
- P15 首页、`/me`、永久媒体、Server-Timing 定向脚本：通过。
- P14 配方渐进播放器状态机：通过。
- Foundry：56/56 通过。
- Webpack production build：37/37 路由通过；构建期 Arweave 超时按既有降级路径处理。
- 默认 Turbopack build 在隔离工作树因 `node_modules` 指向工作树外被工具拒绝；这是本地依赖 junction 限制，不是源码失败，发布构建仍需以 Vercel 原生环境复核。

## 保留边界

- 未接入未获批的高速镜像供应商；E4–E5 继续关闭。
- 真实双账号、物理手机和人耳听音仍沿用 P15 最终评审中的非阻塞人工 review 边界。
