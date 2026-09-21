import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCORE_ACTIVE_STATUSES, SCORE_STATUSES } from '../../src/types/score-mint';

const root = process.cwd();
const migration = readFileSync(join(
  root, 'supabase/migrations/phase-15/052_permanent_core_queue_and_snapshots.sql',
), 'utf8');
const route = readFileSync(join(root, 'app/api/cron/process-score-queue/route.ts'), 'utf8');
const upload = readFileSync(join(root, 'app/api/cron/process-score-queue/steps-upload.ts'), 'utf8');

assert(SCORE_STATUSES.includes('preparing_package'));
assert(SCORE_STATUSES.includes('finalizing_snapshot'));
assert(SCORE_ACTIVE_STATUSES.includes('preparing_package'));
assert(SCORE_ACTIVE_STATUSES.includes('finalizing_snapshot'));
for (const status of SCORE_ACTIVE_STATUSES) {
  assert(migration.includes(`'${status}'`), `migration 缺少状态 ${status}`);
}
assert.match(route, /case 'preparing_package'/);
assert.match(route, /case 'finalizing_snapshot'/);
assert.match(migration, /package_upload_state = 'verified'/);
assert.match(migration, /PERMANENT_CORE_NOT_READY/);
assert.match(migration, /write_score_upload_state/);
assert.match(migration, /publish_score_playback_snapshot/);
assert.match(upload, /upload_result_unknown/);
assert.doesNotMatch(upload, /同内容重传拿到同 txid/);

console.log('P15-H2 队列、migration 与故障语义合同通过');
