import assert from 'node:assert/strict';
import { createResidentEchoRuntime } from '../../src/components/pond-gl-test3/echo-resident/runtime';
import { input, layout } from './fixture';

export async function verifyCommands() {
const runtime = createResidentEchoRuntime({ seed: 3, layout, clock: () => 0 });
runtime.step({ ...input, reducedMotion: true }, 0);
let calls = 0;
let release!: () => void;
const pending = new Promise<void>((resolve) => { release = resolve; });
const execute = () => { calls++; return pending; };
assert.equal(calls, 0, '创建和 step 不得自动播放');
const first = runtime.request('play', execute);
await runtime.request('play', execute);
assert.equal(calls, 1, '加载中的连续点击只能执行一次');
assert.equal(runtime.getSnapshot().commandPending, true);
release(); await first;
assert.equal(runtime.getSnapshot().commandPending, false);
await runtime.request('retry', async () => { throw new Error('媒体暂不可用'); });
assert.equal(runtime.getSnapshot().commandError, '媒体暂不可用');
assert.equal(runtime.getSnapshot().playbackHeld, false, '失败应解除等待锁');
runtime.step({ ...input, playback: 'playing' }, 50);
await runtime.request('pause', () => undefined);
runtime.step({ ...input, playback: 'paused' }, 100);
assert.equal(runtime.getSnapshot().playbackHeld, true, 'pause 仍冻结');
await runtime.request('resume', () => undefined);
runtime.destroy();
await runtime.request('play', execute);
assert.equal(calls, 1, '销毁后命令不得执行');
console.log('命令：无自动播放、等待去重、失败解锁、暂停锁与卸载抑制通过');
}
