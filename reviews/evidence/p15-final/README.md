# P15 发布候选 production build 证据

本目录保存 P15 同步 P14 生产终态后的自动化复测。最终 runtime 绑定干净提交 `db7f4d6` 与 BUILD_ID `OVSGMDwlhrDwg92YUWRZ2`；导航/路由矩阵采于最终播放器提交之前，保留为方向证据，不冒充 release SHA 绑定数据。旧 Preview deployment `6413617116` 只对应整合提交 `c11c606`，且团队 SSO 令匿名页面请求返回 302。

## 文件

- `navigation-integrated.json`：`/me`、`/artist`、`/` 各 50 次真实 Next.js Link，以及四视口 fallback/reduced-motion 矩阵。
- `routes-{warm,cold}-integrated.json` 与对应 summary：五路由 250 次热直达、50 次冷直达。
- `routes-warm-me-repeat.json`：首轮 `/me` 出现一次 309ms Long Task 后的独立 50 次复测。
- `routes-warm-home-repeat.json`：首轮首页热圆圈 p95 835.9ms 后的独立 50 次复测。
- `runtime-integrated.json`：身份/BUILD_ID、glHealth、document RAF、observer 支持、Long Task、CLS、heap、错误，以及 Pond Echo 10 cold + 10 hot 与第 5 段排程样本。

## 关键结果

- Link 反馈 p95：`/` 36.6ms、`/me` 51.8ms、`/artist` 52.4ms；外壳 p95：92ms、116ms、124ms。
- 初始 300 个五路由冷热样本全部有效、CLS 最大值 0；其中热 `/me` 有一次 309ms Long Task，追加 50 次未复现且 max 176ms。
- 首页冷圆圈 p90 494.6ms；初始热 p95 835.9ms，追加 50 次复测 p95 212.7ms、max 220.2ms。
- Runtime 首页 `glHealth=healthy`；document RAF 56.05Hz、p95 delta 18.7ms，只证明主线程 RAF 连续性；最长任务 58ms、CLS 0、console/page error 0。
- Pond Echo 10 次清浏览器缓存 cold 样本预计首声 p95 433.7ms；随后 10 次 hot 样本 p95 125.4ms；另证实全资源 ready 后第 5 段已排程。预计值基于真实排程 mark + 60ms anchor，实际听音未验证。
- 四个 fallback 视口均为 35 个唯一可交互曲目，无横向溢出。

## 复跑边界

先对目标提交执行 production build，再启动独立 Edge CDP；运行 `scripts/p15/measure-navigation.mjs`、`scripts/p15/measure-routes.mjs` 与 `scripts/p15/browser/measure-runtime.mjs`。Runtime 脚本会记录 Git HEAD、dirty 状态、Next BUILD_ID 与实际加载的 Next 静态资源，并在 PerformanceObserver 不可用或 CDP 断线时失败。

真实双账号、物理 iOS/Android 与人耳听音由用户本轮“剩余 review 无伤大雅”的判断转为发布后观察；自动证据只声明缓存隔离、排程、视口和资源合同。
