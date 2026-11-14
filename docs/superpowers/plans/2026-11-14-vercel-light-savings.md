# Vercel 三项轻量节省实施计划

> 用户已于本会话批准这三项、验证后推送 main；作为一个可独立验收的闭环连续完成。当前干净主仓 main 基线 e77f29b，复用现有工作区，不改架构、依赖、合约、生产变量或调度配置。执行使用 executing-plans 与 test-driven-development。

**目标**：减少重复后台查询、公开响应重复生成和没有播放意图的音频下载，保留真实钱包与永久资源校验。

**方案与取舍**：用户选择简单优化，自动忙闲调度另做。轮询采用可见性控制、单次在途和最高30秒退避，重新可见立即补查；公开曲目目录缓存5分钟，完成海报缓存一天，处理中海报不共享缓存；Score/Echo 首次点击才取音频。首声会包含一次资源加载，但 AudioContext 仍在点击手势内恢复，播放引擎/哈希校验与失败回退继续复用。

**边界**：私有资料、持有人/交易状态不加共享缓存；原曲首页预热、cron、铸造发送及未知交易恢复不动。已有每分钟触发照旧。完整检查只接受 self-mint 9/types 10 两处历史目录超限；新增失败停止发布。生产真实钱包交易留用户验收，本轮只做公开读取与播放。

**风险检查**：隐藏/重回前台不重复排计时器；同目标并发查询合并、切目标旧响应丢弃；首次点击保留浏览器音频授权；切作品/卸载后旧异步结果隔离；错误或处理中响应不能被公开缓存。

### Task 1: 状态查询减负

**文件**：新增 src/lib/performance/visible-poll.ts；修改 src/hooks/score/useScoreLifecyclePolling.ts、src/hooks/score-pack/useScorePack.ts；新增 scripts/vercel-savings/polling.cjs、pack-query.cjs。

**接口**：startVisiblePolling(refresh, visibility, delays) 返回停止函数，10/20/30秒逐次退避；只在当前请求完成后安排下一次；隐藏取消、恢复立即查；停止阻止旧结果再排队。资产包 refresh 按 chain/contract/token 合并在途读取并拒收旧目标返回。

- [x] 先写并跑真实源码回归：并发、隐藏恢复、停止、慢请求、切目标、处理终态。
- [x] 最小接入，保持手动刷新与原 open/发送流程；定向回归通过。

### Task 2: 公开响应缓存

**文件**：修改 app/api/music-catalog/route.ts、app/(pond)/score/[id]/poster/route.tsx；新增 scripts/vercel-savings/cache.cjs（三处响应头直接写在既有路线，不额外抽象）。

**接口**：公共目录 max-age=300、s-maxage=300、stale-while-revalidate=60；海报仅 state=ready 使用 public,max-age=3600,s-maxage=86400,stale-while-revalidate=604800，其余 private,no-store。缓存规则不包含鉴权、持有人或订单状态。

- [x] 先写并跑缓存边界回归，包括处理中、失败态及公开目录。
- [x] 接入响应头与实际海报路线；用生产构建服务验证完成海报可生成、非完成规则不缓存。

### Task 3: 播放意图后加载音频

**文件**：修改 Score 的 use-score-playback.ts、ScorePondScene.tsx；修改 Echo 的 engine.ts、use-wallet-recipe-player.ts、progressive-resources.ts；新增 scripts/vercel-savings/audio-intent.cjs 与播放器专项。

**接口**：Score hook 首次 play/toggle 内同步启动已有 load 与 play，移除渲染时音频 preload。Echo load(input,deferAudio=false) 新增可选延迟模式，默认行为保持以兼容既有调用；公开 hook 使用延迟模式，load 只校验时间线并准备控件，play 手势内先恢复 AudioContext，再取首批资源。资源对象缓存初始/剩余加载 promise，防止恢复播放重复下载；新 input 使用新资源与原 generation 隔离。

- [x] 先写回归，验证浏览零音频请求、首次/重复点击不重复加载、音频授权先于网络等待、错误重试及卸载/换作品取消。
- [x] 接入现有引擎；P15 即时播放及相关原始门禁通过。

### Task 4: 整体验证与发布

- [x] 主代理执行定向回归、完整 bash scripts/verify.sh；全部新代码≤220行，现有满目录不加文件。
- [x] 真实浏览器确认 Score/Echo 点击前无 Blob 音频请求，点击后 playing；缓存头及海报 PNG 正确；只验证公开读取，不发钱包交易。
- [x] 自审实际差异，更新 STATUS/TASKS/LEARNING/JOURNAL 与交付记录，精确暂存并推送 main（功能提交cfe0422）。
- [x] 确认 Vercel Ready、正式域名页面和播放正常后交付，说明省量证据与 CPU 仍需真实周期观测。官网四组播放及公开目录/海报CDN HIT通过，证据见reviews/evidence/vercel-light-savings/production/。
