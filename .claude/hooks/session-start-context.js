#!/usr/bin/env node
/**
 * session-start-context.js — SessionStart hook
 *
 * 触发：会话开始时（Claude Code 启动 / /clear / 新对话 / resume）
 * 职责：读 STATUS.md + TASKS.md，连同必读清单和行为铁律一起
 *       通过 hookSpecificOutput.additionalContext 注入到 Claude 的上下文
 *
 * 为什么需要这个 hook：
 *   AGENTS.md §3 要求 AI "工作前必读 STATUS / TASKS / CONVENTIONS / STACK / 当前 step"
 *   但纯文档没法保证 AI 真去读。这个 hook 把最关键的两份直接塞进上下文，
 *   并提醒去读其他三份。
 *
 * 退出码：
 *   0 = 通过（context 已注入）
 */

'use strict';

const fs = require('fs');
const path = require('path');

function readSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// 从 cwd 向上找项目根
// 优先：含 AGENTS.md 的目录（本项目独有的标记，可穿透 worktree）
// Fallback：含 package.json + .git 的目录（标准 Next.js + git 项目根）
function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 15; i++) {
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: package.json + .git
  dir = start;
  for (let i = 0; i < 15; i++) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) &&
      fs.existsSync(path.join(dir, '.git'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function buildContext(root) {
  const status = readSafe(path.join(root, 'STATUS.md'));
  const tasks = readSafe(path.join(root, 'TASKS.md'));

  const lines = [];
  lines.push('# Ripples in the Pond — Session Start');
  lines.push('');
  lines.push('> 这段是 SessionStart hook 自动注入。开始任何工作前必须读完。');
  lines.push('');
  lines.push('## 必读顺序（AGENTS.md §3）');
  lines.push('1. STATUS.md — 已注入下方');
  lines.push('2. TASKS.md — 已注入下方');
  lines.push('3. docs/CONVENTIONS.md — 自行 Read，第一次必须完整看 §1-§3');
  lines.push('4. docs/STACK.md — 装包前必查');
  lines.push('5. 当前 playbook step — 用户会告诉你是哪一步');
  lines.push('');
  lines.push('## 当前 STATUS.md');
  lines.push('```markdown');
  lines.push(status || '(STATUS.md 不存在 — 严重异常，立刻向用户报告)');
  lines.push('```');
  lines.push('');
  lines.push('## 当前 TASKS.md');
  lines.push('```markdown');
  lines.push(tasks || '(TASKS.md 不存在 — 严重异常，立刻向用户报告)');
  lines.push('```');
  lines.push('');
  lines.push('## 行为铁律（AGENTS.md §2）');
  lines.push('- 一次只做一件事，做完一个小闭环立刻停下等用户');
  lines.push('- 中文沟通，禁止占位符 / TODO / mock 数据');
  lines.push('- 不确定就问，禁止猜');
  lines.push('- 不擅自改 docs/ARCHITECTURE.md 或 docs/STACK.md');
  lines.push('');
  lines.push('## slow mode 默认开启（AGENTS.md §7）');
  lines.push('- 每个 step 开始前先输出 3 句话概念简报');
  lines.push('- 每个 step 结束后问用户 1 个复述问题');
  lines.push('- 涉及新概念就追加到 docs/LEARNING.md');
  lines.push('- 出错并修复后追加到 docs/ERRORS.md');
  lines.push('- 用户说 /fast 切换到 fast mode，/slow 切回');

  return lines.join('\n');
}

function main() {
  const root = findProjectRoot(process.cwd());
  const additionalContext = buildContext(root);

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main();
