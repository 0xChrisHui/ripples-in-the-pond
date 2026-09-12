import assert from 'node:assert/strict';
import {
  blockLag,
  collectHealthAlerts,
  isCronStale,
  parseCursorBlock,
  summarizeQueue,
} from '../../src/features/wallet-recipe/health/health-policy';
import type { WalletRecipeStatusDistribution } from '../../src/types/wallet-recipe-health';

const distribution: WalletRecipeStatusDistribution = {
  excluded_prelaunch: 8,
  pending: 2,
  preparing_media: 1,
  uploading_metadata: 1,
  minting_onchain: 1,
  confirming_onchain: 1,
  safe_retry: 2,
  manual_review: 3,
  success: 13,
};
const now = Date.parse('2026-09-06T12:00:00.000Z');
const queue = summarizeQueue(
  distribution,
  '2026-09-06T11:50:00.000Z',
  1,
  now,
);

assert.equal(queue.active, 8);
assert.equal(queue.failed, 5);
assert.equal(queue.oldestActiveAgeSeconds, 600);
assert.equal(queue.uploadResultUnknown, 1);
assert.equal(parseCursorBlock('12345:8'), 12345n);
assert.equal(parseCursorBlock('12345:-1'), 12345n);
assert.equal(parseCursorBlock('bad'), null);
assert.equal(blockLag(12_400n, 12_345n), '55');
assert.equal(blockLag(12_300n, 12_345n), '-45');
assert.equal(isCronStale('2026-09-06T11:57:00.000Z', now), false);
assert.equal(isCronStale('2026-09-06T11:56:59.999Z', now), true);

const base = {
  chainId: 10,
  walletRecipeMode: 'live' as const,
  modeConfigured: true,
  configured: false,
  database: { tableReachable: true, rpcReachable: true },
  permanentInputs: {
    clipManifestConfigured: true,
    decoderConfigured: true,
    imageConfigured: true,
  },
  contract: { addressConfigured: true, codeExists: true, minterRole: false },
  activationBlock: '12300',
  expectedActivationMatches: true,
  lastDiscoveryCursor: '12345:8',
  sourceChainCursor: '12400',
  sourceCursorIdentity: {
    chainId: 10,
    contract: '0x1234567890abcdef1234567890abcdef12345678',
    key: 'chain-events:cursor:10:0x1234567890abcdef1234567890abcdef12345678',
  },
  sourceLastSuccessAt: '2026-09-06T11:59:00.000Z',
  sourceSyncStale: false,
  cursors: {
    head: '12420', safeHead: '12400', discoveryToHeadBlocks: '75',
    discoveryToSafeHeadBlocks: '55', sourceToSafeHeadBlocks: '0',
  },
  lastCronSuccessAt: '2026-09-06T11:50:00.000Z',
  cronStale: true,
  queue,
};
assert.deepEqual(collectHealthAlerts(base), [
  'cron_stale',
  'manual_review',
  'upload_result_unknown',
  'active_queue_stale',
  'minter_role_missing',
  'live_fail_closed',
]);

console.log('P14-D5 health 聚合、游标差值与告警分类验证通过');
