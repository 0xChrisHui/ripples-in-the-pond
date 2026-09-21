#!/usr/bin/env bash
# verify.sh — 通用代码验证
# 用法：bash scripts/verify.sh
# AI 在每次完成一个小闭环后会自动跑

set -uo pipefail

OK="✅"
FAIL="❌"
INFO="ℹ"

EXIT_CODE=0

echo "================================================"
echo "  代码验证 — verify.sh"
echo "================================================"
echo ""

# 1. TypeScript 类型检查
echo "── 1. TypeScript 类型检查 ──"
if [ -f "tsconfig.json" ]; then
  if npx tsc --noEmit 2>&1; then
    echo "$OK 类型检查通过"
  else
    echo "$FAIL 类型检查失败"
    EXIT_CODE=1
  fi
else
  echo "$INFO 没有 tsconfig.json，跳过"
fi
echo ""

# 2. ESLint
echo "── 2. ESLint ──"
if [ -f "eslint.config.mjs" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ]; then
  if npm run lint 2>&1; then
    echo "$OK Lint 通过"
  else
    echo "$FAIL Lint 失败"
    EXIT_CODE=1
  fi
else
  echo "$INFO 没有 ESLint 配置，跳过"
fi
echo ""

# 2b. P15-H1：声音注册表、真实文件、P9 映射和旧档案必须保持闭包。
echo "── 2b. 33 键 SoundSet Gate ──"
if npm run p15:h1:verify 2>&1; then
  echo "$OK SoundSet Gate 通过"
else
  echo "$FAIL SoundSet Gate 失败"
  EXIT_CODE=1
fi
echo ""

# 2c. P15-H2/H3：队列闭包、上传工具、decoder 与 compat 合同。
echo "── 2c. Permanent Core 合同 Gate ──"
if npm run p15:h2:verify 2>&1 && npm run p15:h3:audit 2>&1 && npm run p15:h3:verify 2>&1; then
  echo "$OK Permanent Core 合同 Gate 通过"
else
  echo "$FAIL Permanent Core 合同 Gate 失败"
  EXIT_CODE=1
fi
echo ""

# 2d. P15-H4：固定路径、已有对象不覆盖、AR 双网关与 Blob 回读 Gate。
echo "── 2d. Verified Edge 工具 Gate ──"
if npm run p15:h4:verify 2>&1; then
  echo "$OK Verified Edge 工具 Gate 通过"
else
  echo "$FAIL Verified Edge 工具 Gate 失败"
  EXIT_CODE=1
fi
echo ""

# 2e. P15-H5：数字 Score 只读 verified snapshot，HTML bootstrap 不请求 JSON。
echo "── 2e. Score verified snapshot Gate ──"
if npm run p15:h5:verify 2>&1; then
  echo "$OK Score snapshot Gate 通过"
else
  echo "$FAIL Score snapshot Gate 失败"
  EXIT_CODE=1
fi
echo ""

# 2f. P15-H6/H7：媒体竞速、历史 snapshot 与 Production readback。
echo "── 2f. 播放回退与 Production snapshot Gate ──"
if npm run p15:h6:verify 2>&1 \
  && npm run p15:h7:verify-snapshots 2>&1 \
  && npm run p15:h7:verify-production 2>&1; then
  echo "$OK 播放回退与 Production snapshot Gate 通过"
else
  echo "$FAIL 播放回退与 Production snapshot Gate 失败"
  EXIT_CODE=1
fi
echo ""

# 3. 文件大小检查（额外保险，hook 也会查）
# 硬线与 .claude/hooks/check-file-size.js + docs/CONVENTIONS.md §1.1 同步：
#   - 普通代码文件 ≤220 行
#   - API route handler（app/api/**/route.ts 或 src/app/api/**/route.ts）≤270 行
echo "── 3. 代码文件大小（≤220 行 / API route ≤270 行）──"
LARGE_FILES=$(find app src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | while read -r f; do
  lines=$(wc -l < "$f")
  case "$f" in
    app/api/*/route.ts|src/app/api/*/route.ts) limit=270 ;;
    *) limit=220 ;;
  esac
  if [ "$lines" -gt "$limit" ]; then
    echo "  $f: $lines 行 (上限 $limit)"
  fi
done)

if [ -n "$LARGE_FILES" ]; then
  echo "$FAIL 以下文件超过行数硬线："
  echo "$LARGE_FILES"
  EXIT_CODE=1
else
  echo "$OK 没有超过行数硬线的代码文件"
fi
echo ""

# 4. 目录文件数检查
echo "── 4. 目录文件数（≤8）──"
LARGE_DIRS=$(find app src -type d 2>/dev/null | while read -r d; do
  # 豁免：天然 fan-out 目录（与 .claude/hooks/check-folder-size.js 同步）
  case "$d" in
    app/api|app/api/*|src/app/api|src/app/api/*|src/components/animations/effects*|src/components/animations-svg/effects*) continue ;;
  esac
  count=$(find "$d" -maxdepth 1 -type f 2>/dev/null | wc -l)
  if [ "$count" -gt 8 ]; then
    echo "  $d: $count 文件"
  fi
done)

if [ -n "$LARGE_DIRS" ]; then
  echo "$FAIL 以下目录超过 8 个文件："
  echo "$LARGE_DIRS"
  EXIT_CODE=1
else
  echo "$OK 没有超过 8 文件的目录"
fi
echo ""

# 5. 禁止的字符串扫描
echo "── 5. 危险代码扫描 ──"
DANGER_FOUND=0

# 5a. TODO / FIXME 占位符
if grep -rn --include="*.ts" --include="*.tsx" "// TODO\|// FIXME\|// implement later\|// XXX" app/ src/ 2>/dev/null; then
  echo "$FAIL 发现 TODO/FIXME 占位符"
  DANGER_FOUND=1
fi

# 5b. console.log(process.env)
if grep -rn --include="*.ts" --include="*.tsx" "console\.log(process\.env" app/ src/ 2>/dev/null; then
  echo "$FAIL 发现 console 打印 process.env — 会泄露密钥"
  DANGER_FOUND=1
fi

# 5c. .env.local 里有占位值未替换
if [ -f ".env.local" ]; then
  if grep -nE "=(0x0+$|your_value_here|placeholder|xxx)" .env.local 2>/dev/null; then
    echo "$FAIL .env.local 里有占位值未替换（0x000.../your_value_here/placeholder/xxx）"
    DANGER_FOUND=1
  fi
fi

if [ "$DANGER_FOUND" -eq 0 ]; then
  echo "$OK 没有发现危险代码"
else
  EXIT_CODE=1
fi
echo ""

# 6. 生产构建
echo "── 6. 生产构建（npm run build）──"
if npm run build 2>&1; then
  echo "$OK 生产构建通过"
else
  echo "$FAIL 生产构建失败"
  EXIT_CODE=1
fi
echo ""

# 7. 合约测试（P10-B P3-4）—— 有 forge + foundry.toml 才跑，无则跳过（CI/无 Foundry 机器不误伤）
echo "── 7. 合约测试（forge test）──"
if command -v forge >/dev/null 2>&1 && [ -f "contracts/foundry.toml" ]; then
  if (cd contracts && forge test); then
    echo "$OK forge test 通过"
  else
    echo "$FAIL forge test 失败"
    EXIT_CODE=1
  fi
else
  echo "$INFO 没有 forge 或 contracts/foundry.toml，跳过合约测试"
fi
echo ""

echo "================================================"
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  $OK 所有验证通过"
else
  echo "  $FAIL 验证失败 — 请修复后重试"
fi
echo "================================================"

exit $EXIT_CODE
