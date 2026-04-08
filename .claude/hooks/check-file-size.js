#!/usr/bin/env node
/**
 * check-file-size.js — PostToolUse hook
 *
 * 触发：Edit / Write / MultiEdit 之后
 * 职责：阻止任何代码文件超过 200 行
 * 豁免：docs/、playbook/、reviews/ 下的 markdown 不受限
 *
 * 退出码：
 *   0 = 通过
 *   2 = 阻止（向 stderr 输出错误信息）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LINES = 220;
// API route handler 天然比组件长（业务编排），上限单独放宽
const MAX_LINES_ROUTE = 270;

// 豁免目录（路径用正斜杠匹配，跨平台）
const EXEMPT_DIRS = [
  'docs/',
  'playbook/',
  'reviews/',
  'node_modules/',
  '.next/',
  '.git/',
];

// 判断是否是 Next.js API route handler 文件
function isRouteHandler(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return /\/src\/app\/api\/.*\/route\.ts$/.test(norm);
}

// 只检查这些扩展名
const CHECK_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.sol', '.css'];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    // 避免长时间挂起
    setTimeout(() => resolve(data), 5000);
  });
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isExempt(filePath) {
  const normalized = normalizePath(filePath);
  return EXEMPT_DIRS.some((dir) => normalized.includes(dir));
}

function shouldCheck(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CHECK_EXTS.includes(ext);
}

async function main() {
  let input;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw || '{}');
  } catch (e) {
    // 解析失败 → 静默通过（不阻塞）
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path;
  if (!filePath) {
    process.exit(0);
  }

  // 豁免目录直接通过
  if (isExempt(filePath)) {
    process.exit(0);
  }

  // 不在检查范围内的扩展名
  if (!shouldCheck(filePath)) {
    process.exit(0);
  }

  // 文件可能不存在（被删除等）
  if (!fs.existsSync(filePath)) {
    process.exit(0);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    process.exit(0);
  }

  const lines = content.split('\n').length;
  const limit = isRouteHandler(filePath) ? MAX_LINES_ROUTE : MAX_LINES;

  if (lines > limit) {
    const kind = isRouteHandler(filePath) ? 'API route handler' : '代码文件';
    process.stderr.write(
      `\n❌ check-file-size: ${kind} 超过 ${limit} 行硬线\n` +
        `   文件: ${filePath}\n` +
        `   行数: ${lines}\n\n` +
        `   规则来源: docs/CONVENTIONS.md §1.1\n` +
        `   修复方案: 必须先告诉用户拆分计划，得到批准再拆分。\n` +
        `   不要默默拆分，先停下来汇报。\n`
    );
    process.exit(2);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
