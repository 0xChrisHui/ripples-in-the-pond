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

# 3. 文件大小检查（额外保险，hook 也会查）
# 硬线与 .claude/hooks/check-file-size.js + docs/CONVENTIONS.md §1.1 同步：
#   - 普通代码文件 ≤220 行
#   - API route handler（src/app/api/**/route.ts）≤270 行
echo "── 3. 代码文件大小（≤220 行 / API route ≤270 行）──"
LARGE_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | while read -r f; do
  lines=$(wc -l < "$f")
  case "$f" in
    src/app/api/*/route.ts) limit=270 ;;
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
LARGE_DIRS=$(find src -type d 2>/dev/null | while read -r d; do
  # 豁免：天然 fan-out 目录（与 .claude/hooks/check-folder-size.js 同步）
  case "$d" in
    *src/app/api*|*src/components/animations/effects*|*src/components/animations-svg/effects*) continue ;;
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
if grep -rn --include="*.ts" --include="*.tsx" "// TODO\|// FIXME\|// implement later\|// XXX" src/ 2>/dev/null; then
  echo "$FAIL 发现 TODO/FIXME 占位符"
  DANGER_FOUND=1
fi

# 5b. console.log(process.env)
if grep -rn --include="*.ts" --include="*.tsx" "console\.log(process\.env" src/ 2>/dev/null; then
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

echo "================================================"
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  $OK 所有验证通过"
else
  echo "  $FAIL 验证失败 — 请修复后重试"
fi
echo "================================================"

exit $EXIT_CODE
