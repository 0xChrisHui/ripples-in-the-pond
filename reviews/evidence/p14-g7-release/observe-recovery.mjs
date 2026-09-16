import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const APP = process.env.P14_APP ?? 'https://pond-ripple.xyz';
const SOURCE_JOB_ID = 7520772;
const P14_JOB_ID = 8394060;
const BASE_LOG_ID = Number(process.env.P14_BASE_LOG_ID);
const KEY_PATH = process.env.P14_CRON_KEY_PATH
  ?? 'C:/Users/Hui/.config/ripples-in-the-pond/cron-job-org-api-key.txt';
const OUT = new URL('./observe-results.json', import.meta.url);
const SAMPLE_MS = 60_000;
const MAX_MS = 18 * SAMPLE_MS;
const MIN_SPAN_SECONDS = 900;
const RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(label, task) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await task(attempt); } catch (error) { last = error; }
    await sleep(attempt * 750);
  }
  throw new Error(`${label} 三次失败：${last instanceof Error ? last.message : last}`);
}

async function fetchJson(url, init, label) {
  return retry(label, async () => {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  });
}

async function health() {
  const json = await fetchJson(`${APP}/api/health`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'cache-control': 'no-cache' },
  }, 'health');
  const value = json.walletRecipe;
  if (!value?.configured || value.walletRecipeMode !== 'observe') {
    throw new Error(`health 未就绪：${JSON.stringify({
      mode: value?.walletRecipeMode, configured: value?.configured, database: value?.database,
    })}`);
  }
  return value;
}

async function history(apiKey, jobId) {
  const json = await fetchJson(`https://api.cron-job.org/jobs/${jobId}/history`, {
    headers: { authorization: `Bearer ${apiKey}` },
  }, 'cron history');
  return json.history.sort((a, b) => a.date - b.date);
}

async function totalSupply() {
  const json = await fetchJson(RPC_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{
      to: process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS, data: '0x18160ddd',
    }, 'latest'] }),
  }, 'totalSupply');
  if (json.error || typeof json.result !== 'string') throw new Error(JSON.stringify(json.error));
  return Number(BigInt(json.result));
}

function compact(value) {
  return {
    at: new Date().toISOString(), configured: value.configured,
    sourceCursor: value.sourceChainCursor, sourceLastSuccessAt: value.sourceLastSuccessAt,
    sourceLag: value.cursors.sourceToSafeHeadBlocks,
    discoveryCursor: value.lastDiscoveryCursor, lastCronSuccessAt: value.lastCronSuccessAt,
    queue: value.queue, alerts: value.alerts,
  };
}

function spanSeconds(values, selector) {
  return values.length > 1 ? selector(values.at(-1)) - selector(values[0]) : 0;
}

function cursorPosition(value) {
  const [block, log = '0'] = value.split(':');
  return BigInt(block) * 1_000_000n + BigInt(log);
}

function isMonotonic(values) {
  return values.every((value, index) => index === 0 || value >= values[index - 1]);
}

const apiKey = (await readFile(KEY_PATH, 'utf8')).trim();
assert.ok(Number.isSafeInteger(BASE_LOG_ID) && BASE_LOG_ID >= 0, '必须显式提供 P14_BASE_LOG_ID');
assert.ok(process.env.CRON_SECRET, '缺少 CRON_SECRET');
assert.ok(RPC_URL, '缺少主网 RPC URL');
assert.ok(process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS, '缺少 PondEchoes 地址');
const result = {
  startedAt: new Date().toISOString(), baseLogId: BASE_LOG_ID,
  samples: [], history: [], sourceHistory: [], supply: [], gate: 'running',
};

try {
  const started = Date.now();
  while (Date.now() - started <= MAX_MS) {
    const [wallet, p14Logs, sourceLogs, supply] = await Promise.all([
      health(), history(apiKey, P14_JOB_ID), history(apiKey, SOURCE_JOB_ID), totalSupply(),
    ]);
    const sample = compact(wallet);
    result.samples.push(sample);
    result.history = p14Logs.filter((item) => item.jobLogId > BASE_LOG_ID);
    result.sourceHistory = sourceLogs.filter((item) => item.date * 1000 >= started);
    result.supply.push(supply);
    const sampleSpan = spanSeconds(result.samples, (item) => Date.parse(item.at) / 1000);
    const p14Span = spanSeconds(result.history, (item) => item.date);
    const sourceSpan = spanSeconds(result.sourceHistory, (item) => item.date);
    console.log(JSON.stringify({ sample: result.samples.length, logs: result.history.length,
      sourceLogs: result.sourceHistory.length, sampleSpan, p14Span, sourceSpan,
      cursor: sample.sourceCursor, lag: sample.sourceLag,
      lastCron: sample.lastCronSuccessAt, queue: sample.queue, supply }));
    if (result.history.length >= 10 && result.sourceHistory.length >= 10
      && Math.min(sampleSpan, p14Span, sourceSpan) >= MIN_SPAN_SECONDS) break;
    await sleep(SAMPLE_MS);
  }
  assert.ok(result.history.length >= 10, 'observe cron 少于 10 次');
  assert.ok(result.sourceHistory.length >= 10, 'source cron 少于 10 次');
  assert.ok(spanSeconds(result.samples, (item) => Date.parse(item.at) / 1000)
    >= MIN_SPAN_SECONDS, 'health 样本首末不足 15 分钟');
  assert.ok(spanSeconds(result.history, (item) => item.date)
    >= MIN_SPAN_SECONDS, 'observe cron 首末不足 15 分钟');
  assert.ok(spanSeconds(result.sourceHistory, (item) => item.date)
    >= MIN_SPAN_SECONDS, 'source cron 首末不足 15 分钟');
  assert.ok(result.history.every((item) => item.status === 1 && item.httpStatus === 200), 'cron 非全绿');
  assert.ok(result.sourceHistory.every((item) => item.status === 1
    && item.httpStatus === 200), 'source cron 非全绿');
  assert.ok(result.supply.every((value) => value === 1), 'observe 期间 supply 变化');
  assert.ok(result.samples.every((item) => item.queue.active === 0
    && item.queue.failed === 0 && item.queue.manualReview === 0
    && item.queue.uploadResultUnknown === 0), 'observe 队列出现副作用');
  assert.ok(result.samples.every((item) => item.alerts.length === 0), 'observe 健康告警未清零');
  const cursors = result.samples.map((item) => BigInt(item.sourceCursor));
  const discovery = result.samples.map((item) => cursorPosition(item.discoveryCursor));
  const cronSuccess = result.samples.map((item) => Date.parse(item.lastCronSuccessAt));
  assert.ok(isMonotonic(cursors), 'source cursor 回退');
  assert.ok(isMonotonic(discovery), 'discovery cursor 回退');
  assert.ok(isMonotonic(cronSuccess) && cronSuccess.at(-1) > cronSuccess[0], 'P14 last-success 未推进');
  result.gate = 'passed'; result.endedAt = new Date().toISOString();
  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ gate: result.gate, calls: result.history.length,
    sourceCalls: result.sourceHistory.length,
    spanSeconds: spanSeconds(result.samples, (item) => Date.parse(item.at) / 1000),
    firstCursor: result.samples[0].sourceCursor, lastCursor: result.samples.at(-1).sourceCursor,
    samples: result.samples.length, supply: result.supply.at(-1) }, null, 2));
} catch (error) {
  result.gate = 'failed'; result.endedAt = new Date().toISOString();
  result.error = error instanceof Error ? error.stack : String(error);
  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
  throw error;
}
