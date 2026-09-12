import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const listRoute = source('app/api/tracks/route.ts');
assert.ok(
  listRoute.includes(".gte('week', HOMEPAGE_TRACK_WEEK_MIN)"),
  '首页 Track 列表缺少 week 下界',
);
assert.ok(
  listRoute.includes(".lte('week', HOMEPAGE_TRACK_WEEK_MAX)"),
  '首页 Track 列表缺少 week 上界',
);

const unrestrictedPaths = [
  'app/api/tracks/[id]/route.ts',
  'app/api/mint/material/route.ts',
  'app/api/cron/process-mint-queue/steps.ts',
  'app/api/cron/process-mint-queue/steps-helpers.ts',
  'app/api/score/save/route.ts',
  'app/api/cron/process-score-queue/steps-upload.ts',
  'app/api/me/nfts/route.ts',
  'app/api/artist/stats/route.ts',
  'app/artist/page.tsx',
];
for (const path of unrestrictedPaths) {
  const text = source(path);
  assert.ok(!text.includes('HOMEPAGE_TRACK_WEEK_'), `${path} 不应继承首页上限`);
  assert.ok(!text.includes('isRegularTrackWeek'), `${path} 不应把 35 当作全局 Track 上限`);
  assert.ok(!text.includes(".lte('week', 35)"), `${path} 不应把详情/写链限制到 week 35`);
  assert.ok(!text.includes(".lte('token_id', 35)"), `${path} 不应把 NFT 限制到 token 35`);
}

const materialRoute = source('app/api/mint/material/route.ts');
assert.ok(materialRoute.includes(".eq('week', tokenId)"), 'Material API 必须按真实 Track 存在性守门');
const materialWorker = source('app/api/cron/process-mint-queue/steps.ts');
assert.ok(materialWorker.indexOf(".eq('week', job.token_id)") >= 0, 'Material cron 缺少真实 Track 查询');
assert.ok(
  materialWorker.indexOf(".eq('week', job.token_id)")
    < materialWorker.indexOf('operatorWalletClient.writeContract'),
  'Material cron 必须先确认 Track，再发链上交易',
);
assert.ok(source('src/types/tracks.ts').includes('周数编号，1-108'), 'Track 总规划仍应保留 1–108');

console.log('首页 Track 1–35 列表边界验证通过；详情、Material 与 Score 未被限死。');
