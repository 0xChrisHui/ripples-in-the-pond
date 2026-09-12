import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ServerTiming } from '../../src/lib/performance/server-timing';

function clock(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) throw new Error('测试时钟读数不足');
    return value;
  };
}

async function verifyDeterministicHeader(): Promise<void> {
  const timing = new ServerTiming(clock([100, 102, 107, 108, 120, 121, 124, 130]));
  await timing.measure('auth', async () => 'ok');
  await timing.measure('db', async () => 'ok');
  timing.measureSync('serialize', () => 'ok');
  assert.equal(
    timing.headerValue(),
    'auth;dur=5.0, db;dur=12.0, serialize;dur=3.0, total;dur=30.0',
  );
}

async function verifyFailureAndAccumulation(): Promise<void> {
  const timing = new ServerTiming(clock([0, 1, 4, 5, 10, 11]));
  await timing.measure('db', async () => 'first');
  await assert.rejects(
    timing.measure('db', async () => { throw new Error('预期失败'); }),
    /预期失败/,
  );
  assert.equal(timing.headerValue(), 'db;dur=8.0, total;dur=11.0');
}

function verifyHeaderSafety(): void {
  const timing = new ServerTiming(clock([0, 2, 4, 5]));
  timing.record('auth', Number.NaN);
  const response = timing.response(() => ({ headers: new Headers() }));
  const header = response.headers.get('Server-Timing') ?? '';
  assert.match(header, /^auth;dur=0\.0, serialize;dur=2\.0, total;dur=5\.0$/);
  assert.doesNotMatch(header, /wallet|user|token|error|description/i);
}

async function verifyEchoRouteCoverage(): Promise<void> {
  const source = await readFile('app/api/me/pond-echoes/route.ts', 'utf8');
  assert.match(source, /timing\.measure\('auth'/);
  assert.match(source, /timing\.measure\('db'/);
  assert.match(source, /timing\.measure\('rpc'/);
  assert.match(source, /return timing\.response/);
}

async function main(): Promise<void> {
  await verifyDeterministicHeader();
  await verifyFailureAndAccumulation();
  verifyHeaderSafety();
  await verifyEchoRouteCoverage();
  console.log('Server-Timing 纯函数与 Echo route 覆盖验证通过');
}

void main();
