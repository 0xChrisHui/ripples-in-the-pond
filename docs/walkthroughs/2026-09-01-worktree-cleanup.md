# 工作树堆积收口 walkthrough

## 结果

本轮在最新 `origin/main` 上建立 `codex/worktree-cleanup`，没有用旧工作树覆盖主线。最终把可提交的项目真值、纯本地参考素材和可再生临时文件分开处理。

## 处理顺序

1. 以最新主线创建独立工作树，复制被忽略的 `.env.local`，依据 lockfile 独立安装依赖。
2. 将 `references/` 从 Git 索引移除，根 `.gitignore` 统一忽略，并用 `docs/REFERENCES.md` 保留来源和边界。
3. 把未完成的 Phase 13 PRD、P9 过程证据与工具记忆移动到本地 references；P11 浏览器缓存因占用保留原位并忽略。
4. 补齐 P10 Track F 索引，正式关闭 P12 七天软启动，迁入 P11 盘点与 A–F playbook。
5. 用生产只读健康检查、公开页、OP 公共 RPC、`git diff --check` 和完整 `scripts/verify.sh` 做最终验证。

## 关键边界

- 没有修改 `docs/ARCHITECTURE.md`；P11 Decoder-first 仍需明确架构同步授权。
- 没有运行 `npm audit fix`，避免在清理任务中引入依赖升级或破坏性变化。
- 没有删除旧工作树或强制清理被占用的浏览器 profile，所有本地素材仍可恢复。
