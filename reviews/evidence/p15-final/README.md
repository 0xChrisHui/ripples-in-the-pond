# P15 本地 production build 证据

本目录保存 `codex/p15-smooth-playback` 的自动化复测。线上 baseline 与本地 after 的网络距离不同，前后百分比只作方向证据；发版结论必须在独立 Preview 复跑。

- `routes-warm.json`：四路由各 50 次直达热样本。
- `routes-cold.json`：四路由各 10 次清 HTTP cache/cookies 冷样本。
- `route-summary.json`：p50/p90/p95/max、错误数、长任务和传输量。
- `navigation.json`：`/`、`/me`、`/artist` 各 50 次真实 Link；反馈等待实际绘制，外壳等待后续浏览器帧，同时保存四视口 fallback/reduced-motion 矩阵。

复跑前先启动本地 production build，再以禁用后台节流的 Edge 打开独立 CDP 端口：

```powershell
npm run build
npm run start -- -p 3015
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless=new --remote-debugging-port=9338 --user-data-dir="$env:TEMP\ripples-p15-edge-9338" --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows about:blank
$env:P15_SITE_URL='http://127.0.0.1:3015'
$env:P15_CDP_URL='http://127.0.0.1:9338'
$env:P15_SAMPLES='50'
$env:P15_ROUTES='/me,/artist,/'
node scripts/p15/measure-navigation.mjs
```

未登录态没有公开 `/score/1` Link，所以没有把脚本临时插入的普通 `<a>` 冒充 Next.js 热导航。真实账号、首声、健康 GL、移动设备、镜像和断站证据均不在本目录的“通过”范围内。
