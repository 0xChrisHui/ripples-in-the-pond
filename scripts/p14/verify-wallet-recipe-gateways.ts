import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hasWalletRecipeGatewayQuorum,
  WALLET_RECIPE_GATEWAYS,
  WALLET_RECIPE_GATEWAY_QUORUM,
} from '../../src/lib/wallet-recipe/gateways';
import { fetchPermanentObjectQuorum, type PermanentObjectFetcher }
  from '../../app/api/cron/process-wallet-recipe/gateway-quorum';
import { PipelineStepError } from '../../app/api/cron/process-wallet-recipe/shared';

assert.equal(WALLET_RECIPE_GATEWAYS.length, 3);
assert.equal(WALLET_RECIPE_GATEWAY_QUORUM, 2);
assert.equal(new Set(WALLET_RECIPE_GATEWAYS).size, 3);
assert.equal(hasWalletRecipeGatewayQuorum([
  { gateway: WALLET_RECIPE_GATEWAYS[0], ok: true },
  { gateway: WALLET_RECIPE_GATEWAYS[0], ok: true },
]), false, '重复网关不得凑 quorum');
assert.equal(hasWalletRecipeGatewayQuorum(WALLET_RECIPE_GATEWAYS.map(
  (gateway, index) => ({ gateway, ok: index < 2 }),
)), true);

const decoder = readFileSync('src/wallet-recipe-decoder/index.html', 'utf8');
for (const gateway of WALLET_RECIPE_GATEWAYS) assert.ok(decoder.includes(gateway));
assert.doesNotMatch(decoder, /ario\.permagate\.io/);

function fakeFetcher(
  results: readonly ({ bytes: string; delay: number } | { error: string; delay: number })[],
): PermanentObjectFetcher {
  return (_txId, gateway, signal) => new Promise((resolve, reject) => {
    const index = WALLET_RECIPE_GATEWAYS.indexOf(gateway);
    const result = results[index];
    const timer = setTimeout(() => {
      if ('error' in result) reject(new Error(result.error));
      else resolve(Buffer.from(result.bytes));
    }, result.delay);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function main() {
  const startedAt = Date.now();
  const early = await fetchPermanentObjectQuorum('early', fakeFetcher([
    { bytes: 'same', delay: 5 }, { bytes: 'same', delay: 10 }, { bytes: 'late', delay: 500 },
  ]));
  assert.equal(early.bytes.toString(), 'same');
  assert.ok(Date.now() - startedAt < 200, '达到 quorum 后应立即返回并取消慢网关');

  await assert.rejects(
    fetchPermanentObjectQuorum('recoverable', fakeFetcher([
      { bytes: 'a', delay: 1 }, { bytes: 'b', delay: 2 }, { error: 'timeout', delay: 3 },
    ])),
    (error) => error instanceof PipelineStepError && error.failureKind === 'transient',
  );
  await assert.rejects(
    fetchPermanentObjectQuorum('conflict', fakeFetcher([
      { bytes: 'a', delay: 1 }, { bytes: 'b', delay: 2 }, { bytes: 'c', delay: 3 },
    ])),
    (error) => error instanceof PipelineStepError && error.failureKind === 'permanent_input',
  );

  console.log('P14 三网关、2-of-3 quorum 与 Decoder 同步验证通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
