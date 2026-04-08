#!/usr/bin/env node
/**
 * check-folder-size.js — PostToolUse hook
 *
 * 触发：Write / Edit / MultiEdit 之后
 * 职责：阻止任何目录直接包含超过 8 个文件
 * 豁免：
 *   - 命名豁免：docs/ playbook/ reviews/ node_modules/ .next/ .git/ public/ contracts/
 *   - 项目根目录例外：含 package.json + .git 的那一层（工具链文件必须在根，搬不走）
 *
 * 退出码：
 *   0 = 通过
 *   2 = 阻止
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_FILES = 8;

const EXEMPT_DIRS = [
  'docs',
  'playbook',
  'reviews',
  'node_modules',
  '.next',
  '.git',
  'public',
  'contracts', // Foundry 子目录有自己的规则
];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 5000);
  });
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isExemptDir(dirPath) {
  const normalized = normalizePath(dirPath);
  // Next.js API route 子树天然会超 8 个端点，整棵 src/app/api/** 豁免
  if (normalized.includes('/src/app/api/') || normalized.endsWith('/src/app/api')) {
    return true;
  }
  return EXEMPT_DIRS.some(
    (d) => normalized.includes(`/${d}/`) || normalized.endsWith(`/${d}`) || normalized === d
  );
}

// 项目根目录例外：同时含 package.json 和 .git（目录或文件，后者是 worktree 标记）
// 工具链文件（next.config.ts、tsconfig.json、package.json 等）必须在根，搬不走
function isProjectRoot(dirPath) {
  try {
    const hasPackageJson = fs.existsSync(path.join(dirPath, 'package.json'));
    const hasGit = fs.existsSync(path.join(dirPath, '.git'));
    return hasPackageJson && hasGit;
  } catch {
    return false;
  }
}

async function main() {
  let input;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw || '{}');
  } catch (e) {
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path;
  if (!filePath) {
    process.exit(0);
  }

  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    process.exit(0);
  }

  if (isExemptDir(dir) || isProjectRoot(dir)) {
    process.exit(0);
  }

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    process.exit(0);
  }

  // 只数文件，不数子目录
  const fileCount = entries.filter((e) => e.isFile()).length;

  if (fileCount > MAX_FILES) {
    process.stderr.write(
      `\n❌ check-folder-size: 目录文件数超过 ${MAX_FILES} 硬线\n` +
        `   目录: ${dir}\n` +
        `   文件数: ${fileCount}\n\n` +
        `   规则来源: docs/CONVENTIONS.md §1.2\n` +
        `   修复方案: 必须先告诉用户子目录规划，得到批准再建子目录。\n` +
        `   不要默默移动文件，先停下来汇报。\n`
    );
    process.exit(2);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
