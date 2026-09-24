import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  process.env.NEXT_PUBLIC_CHAIN_ID = '10';
  process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS = '0x1111111111111111111111111111111111111111';
  process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID = '1';
  process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS = '0x2222222222222222222222222222222222222222';
  process.env.ETH_SCORE_DEPLOYMENT_BLOCK = '11762358';

  const registry = await import('../../src/lib/chain/multichain/registry');
  const opAsset = registry.buildAssetId(10, process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS, 7);
  const ethAsset = registry.buildAssetId(1, process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS, 7);

  assert.notEqual(opAsset, ethAsset, '相同 tokenId 的跨链资产必须拥有不同身份');
  assert.equal(opAsset, 'eip155:10/erc721:0x1111111111111111111111111111111111111111/7');
  assert.equal(
    registry.buildScoreRoute(1, process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS, 7),
    '/score/1/0x2222222222222222222222222222222222222222/7',
  );
  assert.deepEqual(registry.parseAssetId(ethAsset), {
    chainId: 1, contractAddress: '0x2222222222222222222222222222222222222222', tokenId: 7n,
  });
  assert.throws(() => registry.buildAssetId(8453, process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS!, 1));
  assert.throws(() => registry.buildAssetId(1, process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS!, 0));
  assert.equal(registry.getConfiguredScoreAddress(10), process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS);
  assert.equal(registry.getConfiguredScoreAddress(1), process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS);
  assert.throws(() => registry.getConfiguredScoreAddress(11155111), /未在当前环境启用/);
  assert.equal(registry.getChainDefinition(1).allowsMintInitiation, false);
  assert.equal(registry.getChainDefinition(11155111).allowsMintInitiation, true);
  assert.equal(registry.getConfiguredScoreDeploymentBlock(1), 11_762_358n);
  process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS = '0x0000000000000000000000000000000000000000';
  assert.throws(() => registry.getConfiguredScoreAddress(1), /地址无效/);

  const migrations = [
    '053_score_self_mint_schema.sql',
    '054_op_score_claim.sql',
    '055_self_mint_rpcs.sql',
    '056_self_mint_pipeline.sql',
    '057_self_mint_hash_recovery.sql',
  ]
    .map((name) => readFileSync(join(process.cwd(), 'supabase/migrations/phase-16', name), 'utf8'))
    .join('\n');
  assert.match(migrations, /score_mint_claims/);
  assert.match(migrations, /score_self_mint_orders/);
  assert.match(migrations, /MINT_CLAIM_CONFLICT/);
  assert.match(migrations, /score_self_mint_token_id_seq/);
  assert.match(migrations, /score_self_mint_upload_ledger/);
  assert.match(migrations, /write_score_self_mint_upload_state/);
  assert.match(migrations, /events_upload_state = 'verified'/);
  assert.match(migrations, /package_upload_state = 'verified'/);
  assert.match(migrations, /metadata_upload_state = 'verified'/);
  assert.match(migrations, /release_verified_at is null/);
  assert.match(migrations, /order_id ~ '\^0x\[0-9a-f\]\{64\}\$'/);
  assert.match(migrations, /mark_score_self_mint_attempt/);
  assert.match(migrations, /complete_score_self_mint/);
  assert.match(migrations, /status = 'consumed'/);
  assert.match(migrations, /CLAIM_COMPLETE_CONFLICT/);
  assert.match(migrations, /permanent_core_active/);
  assert.match(migrations, /requires_package_v3/);
  assert.match(migrations, /IMMUTABLE_PERMANENT_RECORD: score_self_mint_orders pins/);

  const p14Discovery = readFileSync(
    join(process.cwd(), 'app/api/cron/process-wallet-recipe/discover.ts'), 'utf8',
  );
  assert.match(p14Discovery, /SCORE_NFT_ADDRESS/);
  assert.match(p14Discovery, /CURRENT_CHAIN/);
  assert.doesNotMatch(p14Discovery, /ETH_SCORE/);

  console.log('P16-B chain identity、053–057 migration 与 P14 OP-only 边界验证通过');
}

void main();
