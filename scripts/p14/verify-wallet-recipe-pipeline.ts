import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLIP_MANIFEST_V1 } from '../../src/features/wallet-recipe/clip-manifest';
import {
  buildWalletRecipeMetadataJsonV1,
} from '../../src/lib/wallet-recipe/metadata';
import { deriveRecipeV1, normalizeOriginWallet } from '../../src/lib/wallet-recipe/recipe-v1';
import {
  classifyEligibility,
  compareDiscoveryCursor,
  decideMintAction,
  decideUploadAction,
  decideWalletRecipeRuntime,
  formatDiscoveryCursor,
  matchesRuntimeIdentity,
  parseDiscoveryCursor,
  retryDelayMinutes,
  WALLET_RECIPE_CLAIM_DEADLINE_MS,
  WALLET_RECIPE_RESPONSE_DEADLINE_MS,
} from '../../src/features/wallet-recipe/pipeline-policy';
import type { ClipManifestV1 } from '../../src/types/wallet-recipe';

const TX = {
  image: 'I'.repeat(43),
  decoder: 'D'.repeat(43),
  manifest: 'M'.repeat(43),
  clip: 'C'.repeat(43),
};

function verifyModes(): void {
  assert.equal(decideWalletRecipeRuntime({
    mode: 'off', modeConfigured: true, hasPermanentConfig: true, hasContract: true,
  }).effectiveMode, 'off');
  assert.equal(decideWalletRecipeRuntime({
    mode: 'off', modeConfigured: false, hasPermanentConfig: true, hasContract: true,
  }).reason, 'misconfigured');
  assert.deepEqual(decideWalletRecipeRuntime({
    mode: 'observe', modeConfigured: true, hasPermanentConfig: false, hasContract: false,
  }), { requestedMode: 'observe', effectiveMode: 'observe', reason: 'ready' });
  assert.deepEqual(decideWalletRecipeRuntime({
    mode: 'live', modeConfigured: true, hasPermanentConfig: false, hasContract: true,
  }), { requestedMode: 'live', effectiveMode: 'off', reason: 'permanent_input' });
  assert.equal(decideWalletRecipeRuntime({
    mode: 'live', modeConfigured: true, hasPermanentConfig: true, hasContract: true,
  }).effectiveMode, 'live');
}

function verifyDiscoveryPolicy(): void {
  assert.equal(classifyEligibility(100n, 100n), 'excluded_prelaunch');
  assert.equal(classifyEligibility(101n, 100n), 'eligible');
  const cursor = parseDiscoveryCursor('123:7');
  assert.equal(formatDiscoveryCursor(cursor), '123:7');
  assert.equal(compareDiscoveryCursor(cursor, parseDiscoveryCursor('123:7')), 0);
  assert.equal(compareDiscoveryCursor(cursor, parseDiscoveryCursor('123:8')), -1);
  assert.throws(() => parseDiscoveryCursor('head'), /格式无效/);

  const lower = '0x1234567890abcdef1234567890abcdef12345678' as const;
  const checksum = normalizeOriginWallet(lower);
  assert.equal(deriveRecipeV1(lower), deriveRecipeV1(checksum));
  assert.equal(deriveRecipeV1(lower), deriveRecipeV1(lower));
  assert.equal(matchesRuntimeIdentity({
    jobChainId: 10,
    runtimeChainId: 11155420,
    jobScoreContract: lower,
    runtimeScoreContract: lower,
    jobP14Contract: lower,
    runtimeP14Contract: lower,
    requireP14Contract: true,
  }), false);
}

function verifyUploadAndMintRecovery(): void {
  assert.equal(decideUploadAction({ state: 'uploading', claimed: true, hasTxId: false }), 'upload');
  assert.equal(decideUploadAction({ state: 'uploading', claimed: false, hasTxId: false }), 'wait');
  assert.equal(decideUploadAction({ state: 'uploaded', claimed: false, hasTxId: true }), 'verify');
  assert.equal(decideUploadAction({ state: 'verified', claimed: false, hasTxId: true }), 'reuse');
  for (let run = 0; run < 10; run += 1) {
    assert.equal(decideUploadAction({
      state: 'upload_result_unknown', claimed: false, hasTxId: false,
    }), 'manual_review');
  }

  assert.equal(decideMintAction({
    chainTokenId: 0n, chainStateMatches: true, txHash: '0xhash', attemptedAgeMs: 60_000,
    receipt: 'pending', confirmations: 0n,
  }), 'check_receipt');
  assert.equal(decideMintAction({
    chainTokenId: 0n, chainStateMatches: true, txHash: '0xhash', attemptedAgeMs: 31 * 60_000,
    receipt: 'pending', confirmations: 0n,
  }), 'manual_review');
  assert.equal(decideMintAction({
    chainTokenId: 9n, chainStateMatches: true, txHash: null, attemptedAgeMs: null,
    receipt: 'unchecked', confirmations: 0n,
  }), 'recover_success');
  assert.equal(decideMintAction({
    chainTokenId: 9n, chainStateMatches: false, txHash: null, attemptedAgeMs: null,
    receipt: 'unchecked', confirmations: 0n,
  }), 'manual_review');
  assert.equal(decideMintAction({
    chainTokenId: 0n, chainStateMatches: true, txHash: '0xhash', attemptedAgeMs: 1,
    receipt: 'success', confirmations: 19n,
  }), 'wait_confirmations');
  assert.equal(decideMintAction({
    chainTokenId: 0n, chainStateMatches: true, txHash: '0xhash', attemptedAgeMs: 1,
    receipt: 'success', confirmations: 20n,
  }), 'success');
}

function verifyStableMetadata(): void {
  const fixture: ClipManifestV1 = {
    ...CLIP_MANIFEST_V1,
    clips: CLIP_MANIFEST_V1.clips.map((clip) => ({ ...clip, arweaveTxId: TX.clip })),
  };
  const input = {
    originWallet: '0x1111111111111111111111111111111111111111',
    sourceScoreTokenId: 7,
    imageTxId: TX.image,
    decoderTxId: TX.decoder,
    clipManifestTxId: TX.manifest,
    clipManifest: fixture,
  };
  const first = buildWalletRecipeMetadataJsonV1(input);
  const second = buildWalletRecipeMetadataJsonV1(input);
  assert.equal(first, second);
  assert.equal(Buffer.compare(Buffer.from(first), Buffer.from(second)), 0);
}

function verifyUploadLedgerSqlContract(): void {
  const migration = readFileSync(join(
    process.cwd(),
    'supabase/migrations/phase-14/049_wallet_recipe_queue.sql',
  ), 'utf8');
  assert.match(migration, /'collection_metadata', 'metadata'/);
  assert.match(migration, /kind = 'metadata' and queue_id is not null/);
  assert.match(migration, /kind <> 'metadata' and queue_id is null/);
  assert.match(migration, /v_ledger\.attempted_at <= now\(\) - interval '5 minutes'/);
  assert.match(migration, /set state = 'upload_result_unknown'/);
  assert.match(migration, /source_score_tx_hash = lower\(p_source_score_tx_hash\)/);
  assert.match(migration, /if found then[\s\S]*P14 replay evidence changed[\s\S]*return next v_row/);
  assert.match(
    migration,
    /status = case when v_ledger\.state = 'upload_result_unknown' then 'manual_review'/,
  );
}

verifyModes();
verifyDiscoveryPolicy();
verifyUploadAndMintRecovery();
verifyStableMetadata();
verifyUploadLedgerSqlContract();
assert.deepEqual([0, 1, 2, 3, 4, 5].map(retryDelayMinutes), [1, 2, 5, 15, 30, null]);
assert.equal(WALLET_RECIPE_CLAIM_DEADLINE_MS, 20_000);
assert.equal(WALLET_RECIPE_RESPONSE_DEADLINE_MS, 25_000);
console.log('P14-D pipeline：mode/discovery/upload/mint/retry/metadata 全部通过');
