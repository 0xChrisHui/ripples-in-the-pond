import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { startLifecyclePolling } from '../../../src/hooks/score/useScoreLifecyclePolling';

mock.timers.enable({ apis: ['setInterval'] });
let count = 0;
const visibility = new EventTarget() as EventTarget & { hidden: boolean };
visibility.hidden = false;
const stop = startLifecyclePolling(() => { count++; }, visibility);
mock.timers.tick(9999); assert.equal(count, 0);
mock.timers.tick(1); assert.equal(count, 1);
visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange'));
mock.timers.tick(30_000); assert.equal(count, 1);
visibility.hidden = false; visibility.dispatchEvent(new Event('visibilitychange'));
mock.timers.tick(10_000); assert.equal(count, 2);
stop(); mock.timers.tick(30_000); assert.equal(count, 2);
mock.timers.reset();
console.log('制作状态轮询：10秒、隐藏暂停、恢复与卸载清理通过');
