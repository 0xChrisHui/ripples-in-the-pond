import 'server-only';

import { getAddress, type Address } from 'viem';
import { supabaseAdmin } from '@/src/lib/supabase';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { publicClient } from '@/src/lib/chain/operator-wallet';
import { sourceCursorKey, sourceSuccessKey } from '@/src/features/source-index/source-policy';
import {
  getWalletRecipeAddress,
  getWalletRecipeMode,
  WALLET_RECIPE_ABI,
} from '@/src/lib/chain/wallet-recipe-contract';
import {
  blockLag,
  collectHealthAlerts,
  isCronStale,
  parseCursorBlock,
  summarizeQueue,
  WALLET_RECIPE_STATUSES,
} from '@/src/features/wallet-recipe/health/health-policy';
import type { WalletRecipeHealth, WalletRecipeStatusDistribution } from '@/src/types/wallet-recipe-health';

const ACTIVE_STATUSES = [
  'pending', 'preparing_media', 'uploading_metadata',
  'minting_onchain', 'confirming_onchain', 'safe_retry',
] as const;
const AR_TX_ID = /^[A-Za-z0-9_-]{43}$/;

function unavailableDatabaseHealth(nowMs: number) {
  const distribution = Object.fromEntries(
    WALLET_RECIPE_STATUSES.map((status) => [status, 0]),
  ) as WalletRecipeStatusDistribution;
  return {
    tableReachable: false,
    rpcReachable: false,
    queue: summarizeQueue(distribution, null, 0, nowMs),
    activationBlock: null,
    discoveryCursor: null,
    sourceCursor: null,
    sourceLastSuccessAt: null,
    lastCronSuccessAt: null,
  };
}

async function readDatabaseHealth(scoreContract: string, nowMs: number) {
  const upstreamKey = sourceCursorKey(CHAIN_ID_NUM, scoreContract);
  const upstreamSuccessKey = sourceSuccessKey(CHAIN_ID_NUM, scoreContract);
  const base = () => supabaseAdmin.from('wallet_recipe_queue')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', CHAIN_ID_NUM)
    .eq('source_score_contract', scoreContract);
  const statusResults = await Promise.all(WALLET_RECIPE_STATUSES.map((status) => base().eq('status', status)));
  const distribution = Object.fromEntries(WALLET_RECIPE_STATUSES.map((status, index) => [
    status, statusResults[index].count ?? 0,
  ])) as WalletRecipeStatusDistribution;
  const [oldest, unknown, rpc, kv] = await Promise.all([
    supabaseAdmin.from('wallet_recipe_queue').select('created_at')
      .eq('chain_id', CHAIN_ID_NUM).eq('source_score_contract', scoreContract)
      .in('status', [...ACTIVE_STATUSES]).order('created_at', { ascending: true })
      .limit(1).maybeSingle(),
    supabaseAdmin.from('arweave_upload_ledger').select('id', { count: 'exact', head: true })
      .eq('chain_id', CHAIN_ID_NUM).eq('state', 'upload_result_unknown'),
    // 传空 owner 会在函数首行抛出固定异常，因此只探测 RPC 而不 claim 任务。
    supabaseAdmin.rpc('claim_wallet_recipe_job', { p_owner: null, p_lease_minutes: 5 }),
    supabaseAdmin.from('system_kv').select('key,value').in('key', [
      upstreamKey,
      upstreamSuccessKey,
      `p14:activation:${CHAIN_ID_NUM}:${scoreContract}`,
      `p14:cursor:${CHAIN_ID_NUM}:${scoreContract}`,
      `p14:last-cron-success:${CHAIN_ID_NUM}:${scoreContract}`,
    ]),
  ]);
  const tableReachable = statusResults.every((result) => !result.error)
    && !oldest.error && !unknown.error && !kv.error;
  const rpcReachable = rpc.error?.code === 'P0001'
    && rpc.error.message.includes('P14 lease owner is required');
  const values = new Map((kv.data ?? []).map((row) => [String(row.key), String(row.value)]));
  return {
    tableReachable,
    rpcReachable,
    queue: summarizeQueue(
      distribution,
      oldest.data?.created_at ?? null,
      unknown.count ?? 0,
      nowMs,
    ),
    activationBlock: values.get(`p14:activation:${CHAIN_ID_NUM}:${scoreContract}`) ?? null,
    discoveryCursor: values.get(`p14:cursor:${CHAIN_ID_NUM}:${scoreContract}`) ?? null,
    sourceCursor: values.get(upstreamKey) ?? null,
    sourceLastSuccessAt: parseSourceSuccess(values.get(upstreamSuccessKey)),
    lastCronSuccessAt: values.get(`p14:last-cron-success:${CHAIN_ID_NUM}:${scoreContract}`) ?? null,
  };
}

function parseSourceSuccess(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { at?: unknown };
    return typeof parsed.at === 'string' ? parsed.at : null;
  } catch {
    return null;
  }
}

async function readContractHealth(address: Address | null, operator: Address) {
  if (!address) return { addressConfigured: false, codeExists: false, minterRole: null };
  let code: `0x${string}` | undefined;
  try {
    code = await publicClient.getBytecode({ address });
  } catch {
    return { addressConfigured: true, codeExists: false, minterRole: null };
  }
  if (!code || code === '0x') return { addressConfigured: true, codeExists: false, minterRole: null };
  try {
    const role = await publicClient.readContract({ address, abi: WALLET_RECIPE_ABI, functionName: 'MINTER_ROLE' });
    const minterRole = await publicClient.readContract({
      address, abi: WALLET_RECIPE_ABI, functionName: 'hasRole', args: [role, operator],
    });
    return { addressConfigured: true, codeExists: true, minterRole };
  } catch {
    return { addressConfigured: true, codeExists: true, minterRole: null };
  }
}

/** P14 健康聚合独立降级；单项失败不能遮掉旧 health 的其他结果。 */
export async function getWalletRecipeHealth(operator: Address): Promise<WalletRecipeHealth> {
  const nowMs = Date.now();
  const mode = getWalletRecipeMode();
  let scoreContract = '';
  let contractAddress: Address | null = null;
  try { scoreContract = getAddress(SCORE_NFT_ADDRESS).toLowerCase(); } catch { scoreContract = ''; }
  try { contractAddress = getWalletRecipeAddress(); } catch { contractAddress = null; }
  const [database, contract, head] = await Promise.all([
    readDatabaseHealth(scoreContract, nowMs).catch(() => unavailableDatabaseHealth(nowMs)),
    readContractHealth(contractAddress, operator),
    publicClient.getBlockNumber().catch(() => null),
  ]);
  const safeHead = head === null ? null : head > 20n ? head - 20n : 0n;
  const discoveryBlock = parseCursorBlock(database.discoveryCursor);
  const sourceBlock = database.sourceCursor && /^\d+$/.test(database.sourceCursor)
    ? BigInt(database.sourceCursor) : null;
  const activationValid = database.activationBlock !== null && /^\d+$/.test(database.activationBlock);
  const expected = process.env.WALLET_RECIPE_EXPECTED_ACTIVATION_BLOCK?.trim() || null;
  const permanentInputs = {
    clipManifestConfigured: AR_TX_ID.test(process.env.WALLET_RECIPE_CLIP_MANIFEST_V1_TX_ID?.trim() ?? ''),
    decoderConfigured: AR_TX_ID.test(process.env.WALLET_RECIPE_DECODER_V1_TX_ID?.trim() ?? ''),
    imageConfigured: AR_TX_ID.test(process.env.WALLET_RECIPE_IMAGE_V1_TX_ID?.trim() ?? ''),
  };
  const configured = mode.configured && scoreContract !== '' && database.tableReachable
    && database.rpcReachable && activationValid && discoveryBlock !== null && sourceBlock !== null
    && Object.values(permanentInputs).every(Boolean) && contract.codeExists && contract.minterRole === true;
  const base: Omit<WalletRecipeHealth, 'alerts'> = {
    chainId: CHAIN_ID_NUM,
    walletRecipeMode: mode.mode,
    modeConfigured: mode.configured,
    configured,
    database: { tableReachable: database.tableReachable, rpcReachable: database.rpcReachable },
    permanentInputs,
    contract,
    activationBlock: activationValid ? database.activationBlock : null,
    expectedActivationMatches: expected === null ? null : activationValid && expected === database.activationBlock,
    lastDiscoveryCursor: database.discoveryCursor,
    sourceChainCursor: database.sourceCursor,
    sourceCursorIdentity: {
      chainId: CHAIN_ID_NUM,
      contract: scoreContract,
      key: scoreContract ? sourceCursorKey(CHAIN_ID_NUM, scoreContract) : '',
    },
    sourceLastSuccessAt: database.sourceLastSuccessAt,
    sourceSyncStale: isCronStale(database.sourceLastSuccessAt, nowMs),
    cursors: {
      head: head?.toString() ?? null,
      safeHead: safeHead?.toString() ?? null,
      discoveryToHeadBlocks: blockLag(head, discoveryBlock),
      discoveryToSafeHeadBlocks: blockLag(safeHead, discoveryBlock),
      sourceToSafeHeadBlocks: blockLag(safeHead, sourceBlock),
    },
    lastCronSuccessAt: database.lastCronSuccessAt,
    cronStale: isCronStale(database.lastCronSuccessAt, nowMs),
    queue: database.queue,
  };
  return { ...base, alerts: collectHealthAlerts(base) };
}
