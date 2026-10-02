import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { createArchivePlan } from './plan';
import { updateArchiveLedger } from './ledger';

async function main() {
  if (process.argv.length > 2) throw new Error('本轮CLI仅允许dry-run，不能启用execute或覆盖参数');
  const sourceSha = execFileSync('git', ['rev-parse','HEAD'], { cwd: resolve(dirname(process.argv[1]), '../../..'), encoding: 'utf8' }).trim();
  const plan = createArchivePlan(getMusicCatalog(), { runId: '20261002-night-01', sourceSha });
  const file = 'reviews/evidence/parallel-2026-10/20261002-night-01/p17/archive/archive-ledger.json';
  const ledger = await updateArchiveLedger(file, plan);
  console.log(`dry-run：${ledger.items.length}个曲目×网络，保留unknown=${ledger.items.filter(item => item.state === 'unknown').length}，外部发送0；本命令不刷新链上确认`);
}
void main().catch(error => { console.error(error instanceof Error ? error.message : '留存账本未能更新'); process.exitCode = 1; });
