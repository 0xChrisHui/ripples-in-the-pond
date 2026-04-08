#!/usr/bin/env bash
# learn.sh — 按概念回查学习历史
# 用法：bash scripts/learn.sh <概念>
# 例子：bash scripts/learn.sh jwt
#       bash scripts/learn.sh idempotency
#
# 做的事：
#   1. git log 里搜带 [concepts: ...<关键词>...] 标签的 commit
#   2. 在 docs/LEARNING.md 里搜该关键词的条目
#
# 设计来源：CONVENTIONS.md §5.1 commit message 的 [concepts: ...] 标签

set -uo pipefail

if [ "$#" -lt 1 ]; then
  echo "用法: bash scripts/learn.sh <关键词>"
  echo "例子: bash scripts/learn.sh jwt"
  exit 1
fi

KW="$1"

echo "================================================"
echo "  搜索关键词: $KW"
echo "================================================"
echo ""

echo "── 📜 相关 commit ──"
matches=$(git log --all --oneline --grep="concepts:.*${KW}" 2>/dev/null)
if [ -n "$matches" ]; then
  echo "$matches"
else
  echo "  （没有 commit 提到 $KW）"
fi
echo ""

echo "── 📖 docs/LEARNING.md 里的条目 ──"
if [ -f "docs/LEARNING.md" ]; then
  matches=$(grep -n -i "$KW" docs/LEARNING.md 2>/dev/null)
  if [ -n "$matches" ]; then
    echo "$matches"
  else
    echo "  （LEARNING.md 里没提到 $KW）"
  fi
else
  echo "  （LEARNING.md 不存在）"
fi
echo ""

echo "── 📕 docs/ERRORS.md 里的条目 ──"
if [ -f "docs/ERRORS.md" ]; then
  matches=$(grep -n -i "$KW" docs/ERRORS.md 2>/dev/null)
  if [ -n "$matches" ]; then
    echo "$matches"
  else
    echo "  （ERRORS.md 里没提到 $KW）"
  fi
fi
echo ""

echo "================================================"
echo "  Tip: 想看某条 commit 的完整 diff: git show <hash>"
echo "================================================"
