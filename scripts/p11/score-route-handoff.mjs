import { openEdge, writeEvidence } from '../../reviews/evidence/p11-i/lib/edge-cdp.mjs';
import { AUTH_SOURCE } from './score-route-handoff/fixtures.mjs';
import { createRequestHarness } from './score-route-handoff/request-harness.mjs';
import { PROBE_SOURCE } from './score-route-handoff/telemetry.mjs';
import { createScreencast } from './score-route-handoff/screencast.mjs';
import { meToScore, scoreToHome, scoreToMe } from './score-route-handoff/flows.mjs';
import { summarize } from './score-route-handoff/assertions.mjs';
import { runStress } from './score-route-handoff/stress.mjs';
import { runMinimalInteractions } from './score-route-handoff/interactions.mjs';

const strict = process.argv.includes('--strict');
const stress = process.argv.includes('--stress');
const minimal = process.argv.includes('--minimal');
const outputDir = 'reviews/evidence/p11-j/baseline';
const result = {
  measuredAt: new Date().toISOString(),
  fixture: true,
  scoreTarget: '/score/1',
  productionDataWrites: 'blocked',
  entries: [],
  limitations: [
    '档案使用本地只读会话与 /api/me/* fixture；/score/1 读取真实公开作品。',
    'processing/failed 没有稳定公开 ID，保留到明确标记的状态 fixture 或人工目验。',
    '基线模式记录 J1–J7 目标断言但不因现有产品缺口退出失败；--strict 会启用全部目标断言。',
  ],
};

const edge = await openEdge({ port: 9234, profile: '.edge-j0-profile' });
const { send, errors, requests, close } = edge;
let harness;
try {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `${AUTH_SOURCE};\n${PROBE_SOURCE}` });
  harness = await createRequestHarness(edge);
  const cast = createScreencast(edge, outputDir);
  if (minimal) result.interactions = await runMinimalInteractions(edge, harness);
  else result.entries.push(await meToScore(edge, cast, {
    label: 'cold-vt', cold: true, noViewTransition: false, harness,
  }));
  if (!minimal) result.entries.push(await scoreToMe(edge, cast, {
    label: 'warm-vt', cold: false, noViewTransition: false, harness,
  }));
  if (!minimal) result.entries.push(await scoreToHome(edge, cast, {
    label: 'warm-vt', cold: false, noViewTransition: false, harness,
  }));
  if (!minimal) result.entries.push(await meToScore(edge, cast, {
    label: 'warm-no-vt', cold: false, noViewTransition: true, harness,
  }));
  if (!minimal) result.entries.push(await scoreToMe(edge, cast, {
    label: 'warm-no-vt', cold: false, noViewTransition: true, harness,
  }));
  if (!minimal) result.entries.push(await scoreToHome(edge, cast, {
    label: 'warm-no-vt', cold: false, noViewTransition: true, harness,
  }));
  if (stress) result.stress = await runStress(edge, 20);
  result.requests = requests.filter(({ url }) => url.startsWith('http://127.0.0.1:3000')
    && !url.includes('/__nextjs_'));
  result.intercepted = harness.state.intercepted;
  result.writes = harness.state.writes;
  result.devRequests = harness.state.devRequests;
  result.summary = minimal ? { readOnly: result.writes.length === 0, errors,
    passed: result.interactions.passed && result.writes.length === 0 }
    : summarize(result.entries, result.writes, errors, strict);
  result.passed = result.summary.passed && (!stress || result.stress?.passed === true);
  const evidenceName = minimal ? 'minimal-interactions.json' : 'score-route-handoff.json';
  const output = await writeEvidence(`${outputDir}/${evidenceName}`, result);
  console.log(`${result.passed ? 'P11-J 路由换场基线通过' : 'P11-J 路由换场 Gate 失败'}：${output}`);
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  result.fatal = error instanceof Error ? error.stack : String(error);
  result.errors = errors;
  result.intercepted = harness?.state.intercepted ?? [];
  result.writes = harness?.state.writes ?? [];
  result.devRequests = harness?.state.devRequests ?? [];
  await writeEvidence(`${outputDir}/${minimal ? 'minimal-interactions.json' : 'score-route-handoff.json'}`, result);
  throw error;
} finally {
  close();
}
