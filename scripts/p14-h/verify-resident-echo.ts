import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// 缺失模块必须明确失败，不能把未实现的视觉当作通过。
assert.ok(existsSync('src/components/pond-gl-test3/echo-resident/runtime.ts'), '尚未实现驻留控制器');
async function main() {
  await import('./verify-math');
  await import('./verify-runtime');
  await import('./verify-render');
  const { verifyCommands } = await import('./verify-commands');
  await verifyCommands();
  const { verifyHost } = await import('./verify-host');
  await verifyHost();
  console.log('P14-H：数学、生命周期、命令去重定向断言全部通过');
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
