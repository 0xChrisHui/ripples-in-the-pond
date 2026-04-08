#!/usr/bin/env node
/**
 * check-forbidden-imports.js — PreToolUse hook
 *
 * 触发：Edit / Write / MultiEdit 之前
 * 职责：扫描即将写入的内容，阻止以下情况：
 *   - 前端文件 import operator-wallet 或 OPERATOR_PRIVATE_KEY
 *   - 任何文件 import wagmi / ethers / howler / tone / hardhat
 *   - src/app/api/（除 cron/）使用 await ...waitForTransactionReceipt
 *   - 占位符 TODO / FIXME / implement later
 *   - console.log(process.env)
 *
 * 退出码：
 *   0 = 通过
 *   2 = 阻止
 */

'use strict';

const path = require('path');

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

function isFrontendFile(filePath) {
  const norm = normalizePath(filePath);
  // 后端：API Route 和明确标记为 server-only 的 lib
  if (norm.includes('/src/app/api/')) return false;
  if (norm.endsWith('/operator-wallet.ts')) return false;
  // 不在 src/ 下的不算前端（合约、脚本等）
  if (!norm.includes('/src/')) return false;
  return true;
}

function isCronFile(filePath) {
  return normalizePath(filePath).includes('/src/app/api/cron/');
}

/**
 * 检查内容是否触发了禁令
 * 返回 [{ rule, line, snippet }, ...] 或空数组
 */
function checkContent(filePath, content) {
  const violations = [];
  const norm = normalizePath(filePath);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 跳过单行注释行（避免误判文档/解释里出现的关键字）
    // 注：不处理多行注释 /* ... */，因为简单且很少有人在多行注释里写 import
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      return;
    }

    // 1. 前端文件不能 import operator-wallet 或 OPERATOR_PRIVATE_KEY
    if (isFrontendFile(filePath)) {
      if (
        /from\s+['"][^'"]*operator-wallet['"]/.test(line) ||
        /import\s+.*operator-wallet/.test(line)
      ) {
        violations.push({
          rule: '前端文件禁止 import operator-wallet',
          line: lineNum,
          snippet: line.trim(),
        });
      }
      if (/OPERATOR_PRIVATE_KEY/.test(line)) {
        violations.push({
          rule: '前端文件禁止引用 OPERATOR_PRIVATE_KEY',
          line: lineNum,
          snippet: line.trim(),
        });
      }
    }

    // 2. 任何文件不能 import 黑名单包
    const BLACKLIST_PKGS = ['wagmi', 'ethers', 'howler', 'tone', 'hardhat'];
    for (const pkg of BLACKLIST_PKGS) {
      const re = new RegExp(`from\\s+['"]${pkg}['"]|require\\(['"]${pkg}['"]\\)`);
      if (re.test(line)) {
        violations.push({
          rule: `禁止使用 ${pkg}（见 docs/STACK.md 黑名单）`,
          line: lineNum,
          snippet: line.trim(),
        });
      }
    }

    // 3. API Route（非 cron）不能 await waitForTransactionReceipt
    if (norm.includes('/src/app/api/') && !isCronFile(filePath)) {
      if (/await\s+.*waitForTransactionReceipt/.test(line)) {
        violations.push({
          rule: 'API Route 禁止 await 链上确认（违反乐观 UI 架构）',
          line: lineNum,
          snippet: line.trim(),
        });
      }
    }

    // 4. 占位符
    if (
      /\/\/\s*TODO\b/i.test(line) ||
      /\/\/\s*FIXME\b/i.test(line) ||
      /\/\/\s*XXX\b/i.test(line) ||
      /\/\/\s*implement\s+later/i.test(line) ||
      /\/\/\s*待实现/i.test(line)
    ) {
      violations.push({
        rule: '禁止留 TODO / FIXME / 占位符',
        line: lineNum,
        snippet: line.trim(),
      });
    }

    // 5. console.log(process.env)
    if (/console\.log\s*\(\s*process\.env/.test(line)) {
      violations.push({
        rule: '禁止 console.log(process.env)（会泄露密钥）',
        line: lineNum,
        snippet: line.trim(),
      });
    }
  });

  return violations;
}

async function main() {
  let input;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw || '{}');
  } catch (e) {
    process.exit(0);
  }

  const toolName = input?.tool_name;
  const toolInput = input?.tool_input || {};
  const filePath = toolInput.file_path;

  if (!filePath) {
    process.exit(0);
  }

  // 只检查 JS/TS 源代码（含 jsx/tsx/mjs/cjs）。其他都跳过：
  //   - md/json/yml/toml/txt/gitignore: 文档配置
  //   - sh/bash: shell 脚本（自有规范，本 hook 不管）
  //   - sol: Solidity 合约（自有规则）
  //   - env*: 环境变量文件
  //   - css/html/svg: 静态资源
  const ext = path.extname(filePath).toLowerCase();
  const CHECK_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  if (!CHECK_EXTS.includes(ext) || filePath.includes('.env')) {
    process.exit(0);
  }

  // 拼接将要写入的内容
  let contentToCheck = '';
  if (toolName === 'Write') {
    contentToCheck = toolInput.content || '';
  } else if (toolName === 'Edit') {
    contentToCheck = toolInput.new_string || '';
  } else if (toolName === 'MultiEdit') {
    const edits = toolInput.edits || [];
    contentToCheck = edits.map((e) => e.new_string || '').join('\n');
  }

  if (!contentToCheck) {
    process.exit(0);
  }

  const violations = checkContent(filePath, contentToCheck);

  if (violations.length > 0) {
    process.stderr.write(`\n❌ check-forbidden-imports: 发现 ${violations.length} 处违规\n`);
    process.stderr.write(`   文件: ${filePath}\n\n`);
    violations.forEach((v, i) => {
      process.stderr.write(`   ${i + 1}. ${v.rule}\n`);
      process.stderr.write(`      第 ${v.line} 行: ${v.snippet}\n\n`);
    });
    process.stderr.write(`   规则来源: docs/CONVENTIONS.md §3 + docs/STACK.md\n`);
    process.stderr.write(`   修复方案: 移除违规代码，或停下来告诉用户为什么必须违反。\n`);
    process.exit(2);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
