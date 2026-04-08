# COMMANDS — 常用命令速查

> Windows 用户：默认所有 bash 命令在 **Git Bash** 里跑（不是 cmd 不是 PowerShell）
> macOS / Linux 用户：直接在 Terminal 跑

---

## 1. 项目启动

### Windows (Git Bash) & macOS / Linux
```bash
# 启动 dev server
npm run dev

# 浏览器打开
# http://localhost:3000

# 停止 dev server
Ctrl + C
```

---

## 2. 环境检查

### 通用
```bash
# 跑一次健康检查（每次开始工作前）
bash scripts/doctor.sh

# 单独检查 Node 版本
node -v       # 应该 ≥ 18

# 单独检查 Git
git --version

# 单独检查 Foundry（Phase 0 Step 5 才需要）
forge --version
```

---

## 3. Git 安全操作（小白推荐用法）

### 通用
```bash
# 查看当前改动
git status

# 查看具体改了什么
git diff

# 查看最近的 commit
git log --oneline -10

# 查看带概念标签的 commit
git log --grep="jwt" --oneline
```

### 安全保存进度（推荐）
```bash
# 保存当前进度（自动 stash + branch）
bash scripts/checkpoint.sh "完成 Step 4 岛屿组件"
```

### 危险命令（不要用）
```bash
git reset --hard          # ❌ 会丢失未 commit 的改动
git checkout .            # ❌ 会丢失未 commit 的改动
git push --force          # ❌ 会覆盖远程历史
```

---

## 4. 验证 / 测试

### 通用
```bash
# 跑完整验证（每次完成一步后 AI 会自动跑）
bash scripts/verify.sh

# 单独跑 lint
npm run lint

# 单独跑 TypeScript 类型检查
npx tsc --noEmit

# 单独跑 build
npm run build
```

---

## 5. 文件操作

### Windows (Git Bash)
```bash
# 列出文件
ls
ls -la                    # 含隐藏文件

# 查看文件内容
cat path/to/file
head -20 path/to/file    # 前 20 行
tail -20 path/to/file    # 后 20 行

# 删除文件
rm path/to/file
rm -r path/to/dir         # 删除目录（小心！）

# 创建目录
mkdir -p path/to/new/dir  # -p 自动建父目录
```

### macOS / Linux
同上（Git Bash 就是 Linux 风格）

### Windows (cmd / PowerShell) — 不推荐
我们项目所有命令都假设 Git Bash。如果你在 cmd 里跑会失败。

---

## 6. 环境变量

### 通用
```bash
# 复制模板
cp .env.example .env.local

# 编辑 .env.local（用你喜欢的编辑器）
notepad .env.local        # Windows 简单
code .env.local           # 如果装了 VS Code
```

### 查看当前环境变量（不要在 commit 里跑！）
```bash
# Windows Git Bash & macOS / Linux
echo $NEXT_PUBLIC_PRIVY_APP_ID
```

⚠️ **永远不要 `console.log(process.env)`**，会泄露所有密钥到日志

---

## 7. npm / 依赖

### 通用
```bash
# 装依赖（npm install 的简写）
npm i

# 装单个新包（先查 docs/STACK.md 是否在白名单）
npm i <package-name>

# 装开发依赖
npm i -D <package-name>

# 升级所有包（小心！可能 break things）
npm update

# 看包是否安装了
npm ls <package-name>

# 清掉 node_modules 重装（疑难杂症时）
rm -rf node_modules package-lock.json && npm i
```

---

## 8. Foundry（Phase 0 Step 5 才需要）

```bash
# 进入合约目录
cd contracts

# 跑测试
forge test

# 跑测试 + 详细输出
forge test -vv

# 编译
forge build

# 部署到 OP Sepolia（需要 .env 里有 OP Sepolia RPC + 私钥）
forge script script/Deploy.s.sol --rpc-url $ALCHEMY_RPC_URL --private-key $OPERATOR_PRIVATE_KEY --broadcast

# 回到项目根目录
cd ..
```

---

## 9. 紧急恢复（出问题时）

### 看看哪些文件被改了
```bash
git status
git diff
```

### 把 AI 改坏的文件还原（基于上次 commit）
```bash
# 还原单个文件（安全）
git restore path/to/file

# 还原所有未暂存改动（小心，会丢失）
git restore .
# ⚠️ 用前先 git status 看清楚要丢什么
```

### 回到上一个 commit（保留改动到 stash）
```bash
git stash
# 之后想恢复改动：git stash pop
```

### 回到最近的 checkpoint
```bash
# 列出所有 checkpoint branch
git branch | grep checkpoint

# 切换到某个 checkpoint
git checkout checkpoint/2026-04-08-1430
```

---

## 10. 给 AI 看本文件

如果 AI 不会某个命令，告诉它：

> "去读 docs/COMMANDS.md 第 N 节"

---

## 附录：Windows 用户的 Git Bash 速通

如果你从来没用过 Git Bash：

1. **打开方式**：开始菜单搜 "Git Bash"，或者在任意文件夹里右键 → "Git Bash Here"
2. **路径写法**：用 `/c/Users/你/Projects/nft-music`，不是 `C:\Users\你\Projects\nft-music`
3. **粘贴**：右键 → Paste（不是 Ctrl+V）
4. **退出**：输入 `exit` 或关窗口
