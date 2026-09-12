import { getAddress, type Address } from 'viem';
import { ARWEAVE_TX_ID_PATTERN } from '@/src/lib/wallet-recipe/constants';
import {
  WALLET_RECIPE_GATEWAYS,
} from '@/src/lib/wallet-recipe/gateways';
import { parseClipManifestV1 } from '@/src/lib/wallet-recipe/clip-manifest';
import { CLIP_MANIFEST_V1 } from '@/src/features/wallet-recipe/clip-manifest';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { WalletRecipePermanentConfig } from '@/src/lib/chain/wallet-recipe-contract';
import { PipelineStepError, type PipelineStepResult, type WalletRecipeQueueRow } from './shared';
import { fetchPermanentObjectQuorum } from './gateway-quorum';

const FETCH_TIMEOUT_MS = 12_000;

export type VerifiedPermanentObject = { bytes: Buffer; sha256: string };
let verifiedConfigKey: string | null = null;

export function assertPermanentConfig(config: WalletRecipePermanentConfig): void {
  for (const [name, txId] of Object.entries(config)) {
    if (!ARWEAVE_TX_ID_PATTERN.test(txId)) {
      throw new PipelineStepError(`${name} 不是合法 Arweave txid`, 'permanent_input');
    }
  }
  if (CLIP_MANIFEST_V1.clips.some((clip) => !clip.arweaveTxId)) {
    throw new PipelineStepError('36 段音频尚未全部永久冻结', 'permanent_input');
  }
}

async function fetchGateway(
  txId: string,
  gateway: (typeof WALLET_RECIPE_GATEWAYS)[number],
  signal: AbortSignal,
) {
  const response = await fetch(`${gateway}/${txId}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${gateway} HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function verifyPermanentObject(txId: string): Promise<VerifiedPermanentObject> {
  return fetchPermanentObjectQuorum(txId, fetchGateway);
}

function assertManifestMatches(bytes: Buffer): void {
  let remote: ReturnType<typeof parseClipManifestV1>;
  try {
    remote = parseClipManifestV1(JSON.parse(bytes.toString('utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PipelineStepError(`永久 clip manifest 无效：${message}`, 'permanent_input');
  }
  if (JSON.stringify(CLIP_MANIFEST_V1) !== JSON.stringify(remote)) {
    throw new PipelineStepError('永久 clip manifest 与仓库冻结清单不一致', 'permanent_input');
  }
}

export async function preflightPermanentInputs(
  config: WalletRecipePermanentConfig,
): Promise<void> {
  assertPermanentConfig(config);
  const configKey = `${config.imageTxId}:${config.decoderTxId}:${config.clipManifestTxId}`;
  if (verifiedConfigKey === configKey) return;
  const [image, decoder, manifest] = await Promise.all([
    verifyPermanentObject(config.imageTxId),
    verifyPermanentObject(config.decoderTxId),
    verifyPermanentObject(config.clipManifestTxId),
  ]);
  if (image.bytes.length === 0 || decoder.bytes.length === 0) {
    throw new PipelineStepError('永久封面或 Decoder 为空', 'permanent_input');
  }
  assertManifestMatches(manifest.bytes);
  verifiedConfigKey = configKey;
}

export async function stepPrepareMedia(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  config: WalletRecipePermanentConfig,
  contract: Address,
): Promise<PipelineStepResult> {
  await preflightPermanentInputs(config);

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('wallet_recipe_queue').update({
    image_ar_tx_id: config.imageTxId,
    p14_contract: getAddress(contract).toLowerCase(),
    updated_at: now,
  }).eq('id', row.id).eq('locked_by', leaseOwner).gt('lease_expires_at', now)
    .select('id').maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'preparing_media', detail: 'lease_lost' };
  return { status: 'uploading_metadata', detail: 'permanent_media_verified' };
}
