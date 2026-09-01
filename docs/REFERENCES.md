# REFERENCES — 本地思考素材索引

`references/` 是纯本地素材库，不参与构建、部署或版本控制。需要跨设备保留的原始音频、工程文件和视觉原型应另行备份；仓库只记录来源与用途。

## 当前参考类别

- `patatap/`：声音触发二维动画参考，原项目为 Patatap，作者 jonobr1，MIT License。
- `aaaa/`、`legacy/`、`dead-code/`：历史动画、页面方向和退役实现，仅供追溯思路。
- `flower-water-ripples/`：水面、花瓣和涟漪机制参考。
- `community wallte/`：Semi 社区钱包相关产品与代码参考。
- `audio/`：P9 WAV 母版与第 36 首 Logic 工程，本地保存，不作为网站静态资源。
- `visual-prototypes/`：未接入产品的视觉方向探索。
- `p9-evidence/`：P9 过程截图与临时审计脚本；已入库的 v4.2 最终 Gate 证据作为发布例外继续保留在 `reviews/evidence/`。
- `p11-audit-raw/`：P11 页面盘点产生的本地浏览器资料；浏览器 profile 与依赖缓存不作为交付物。
- `phase-13-drafts/`：尚含内部备注或待补真实链接的 Semi 对外 PRD 草稿，完成前不进入 playbook。
- `tool-memory/`：本地开发工具的工作记忆。

## 使用边界

- 产品代码不得 import 或运行时读取 `references/`。
- 参考实现被移植时，在正式代码注释或 `docs/JOURNAL.md` 记录来源与取舍。
- 第三方素材继续遵守原作者许可证；不要把未知授权素材发布为产品资源。
