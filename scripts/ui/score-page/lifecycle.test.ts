import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { startLifecyclePolling } from '../../../src/hooks/score/useScoreLifecyclePolling';

async function main() {
  mock.timers.enable({ apis: ['setTimeout'] });
  let count = 0;
  const visibility = new EventTarget() as EventTarget & { hidden: boolean };
  visibility.hidden = false;
  const stop = startLifecyclePolling(() => { count++; }, visibility);
  const tick = async (ms: number) => { mock.timers.tick(ms); await Promise.resolve(); };
  await tick(9999); assert.equal(count, 0);
  await tick(1); assert.equal(count, 1);
  await tick(19_999); assert.equal(count, 1);
  await tick(1); assert.equal(count, 2);
  visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange'));
  await tick(30_000); assert.equal(count, 2);
  visibility.hidden = false; visibility.dispatchEvent(new Event('visibilitychange'));
  assert.equal(count, 3);
  stop(); await tick(30_000); assert.equal(count, 3);
  mock.timers.reset();
  console.log('制作状态轮询：10/20/30秒退避、隐藏暂停、恢复补查与卸载清理通过');
}
void main();
