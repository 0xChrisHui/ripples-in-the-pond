# I1-d Tailwind 扫描边界验证

- Tailwind 改为 `source(none)`，只扫描 `app/` 与 `src/`；不再依赖不断追加排除目录。
- 仓库检索确认 `app/`、`src/` 之外没有 TypeScript/TSX 页面源码使用 `className`。
- 用户批准忽略本机 Google Fonts 后，无远程字体的 production build 通过 38/38。
- 构建 CSS 中仍包含 `score-pond-page`、`record-anchor` 与 `pointer-events-none` 等页面和 Tailwind 关键类。
- `.gitignore` 新增本地 Edge baseline profile 与多套 Next 构建缓存目录；不影响受控源码。
- 构建后已恢复 `app/layout.tsx`，字体配置无 diff。
