import { getAddress } from 'viem';
import { getChainPublicClient } from '@/src/lib/chain/multichain/public-client';
import { operatorWalletClient } from '@/src/lib/chain/operator-wallet';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { readOpened, readPackOpenedEvent, readScoreOwner } from '@/src/lib/score-pack/chain';
import { getPackChainConfig, SCORE_PACK_OPENER_ABI } from '@/src/lib/score-pack/contract';
import { transitionOrder, type PackOrderRow } from '@/src/lib/score-pack/orders';
import { OP_MAX_ATTEMPTS, retryDelayMs, shouldAbandon } from '@/src/lib/score-pack/rules';
import { buildVoucher, signVoucher } from '@/src/lib/score-pack/voucher';

const OP_RECEIPT_WAIT_MS = 15 * 60_000;

export type StepResult = 'opened' | 'abandoned' | 'reverted' | 'requeued' | 'sent' | 'waiting' | 'failed';

/** 链上 opened 为唯一真值：先按 PackOpened 事件收口，不依赖用户上报的 hash。 */
export async function reconcileOrder(order: PackOrderRow, nowMs = Date.now()): Promise<StepResult> {
  const cfg = getPackChainConfig(order.chain_id);
  if (!cfg) return 'waiting';
  const tokenId = BigInt(order.token_id);

  if (await readOpened(cfg, tokenId)) {
    const event = await readPackOpenedEvent(cfg, tokenId);
    await transitionOrder(order.id, order.status, 'opened', {
      tx_hash: event?.txHash.toLowerCase() ?? order.tx_hash,
      block_number: event ? Number(event.blockNumber) : null,
      account_address: event?.account.toLowerCase() ?? null,
      opened_at: new Date().toISOString(), failure_code: null, locked_by: null, lease_expires_at: null,
    });
    return 'opened';
  }

  const owner = await readScoreOwner(order.chain_id, getAddress(order.score_contract), tokenId);
  if (shouldAbandon({
    status: order.status, createdAtMs: Date.parse(order.created_at), nowMs,
    holderStillOwner: owner?.toLowerCase() === order.holder_address, openedOnChain: false,
  })) {
    const reason = owner?.toLowerCase() === order.holder_address ? 'WALLET_TIMEOUT' : 'HOLDER_CHANGED';
    await transitionOrder(order.id, order.status, 'abandoned', { failure_code: reason, locked_by: null });
    return 'abandoned';
  }

  if ((order.status === 'submitted_unknown' || order.status === 'confirming') && order.tx_hash) {
    const client = getChainPublicClient(order.chain_id);
    const receipt = await client.getTransactionReceipt({ hash: order.tx_hash as `0x${string}` })
      .catch(() => null);
    if (receipt?.status === 'reverted') {
      await transitionOrder(order.id, order.status, 'reverted', {
        failure_code: 'TX_REVERTED', block_number: Number(receipt.blockNumber),
      });
      return 'reverted';
    }
    if (!receipt && order.mode === 'op_sponsored' && order.status === 'submitted_unknown'
      && nowMs - Date.parse(order.created_at) > OP_RECEIPT_WAIT_MS) {
      await transitionOrder(order.id, 'submitted_unknown', 'unsent', { tx_hash: null });
      return 'requeued';
    }
    if (receipt && order.status === 'submitted_unknown') {
      await transitionOrder(order.id, 'submitted_unknown', 'confirming', { block_number: Number(receipt.blockNumber) });
    }
    return 'waiting';
  }

  // OP 的 unsent：凭证已过期且链上仍未开 → 回到队列，按递增间隔重试
  if (order.status === 'unsent' && order.mode === 'op_sponsored'
    && (order.voucher_deadline ?? 0) * 1000 < nowMs) {
    await transitionOrder(order.id, 'unsent', 'queued', {
      next_attempt_at: new Date(nowMs + retryDelayMs(order.attempts)).toISOString(),
      locked_by: null, lease_expires_at: null,
    });
    return 'requeued';
  }
  return 'waiting';
}

/** OP 代付：先落"发送意图"再广播；广播抛错留在 unsent，由 reconcileOrder 对账后再决定重发。 */
export async function sendSponsoredOrder(order: PackOrderRow, workerId: string): Promise<StepResult> {
  const cfg = getPackChainConfig(order.chain_id);
  if (!cfg || order.chain_id !== CHAIN_ID_NUM || !order.sound_ids || !order.track_token_id) return 'waiting';
  if (order.attempts >= OP_MAX_ATTEMPTS) {
    await transitionOrder(order.id, 'queued', 'abandoned', { failure_code: 'MAX_ATTEMPTS' });
    return 'abandoned';
  }
  const holder = getAddress(order.holder_address);
  const voucher = buildVoucher(BigInt(order.token_id), holder, {
    trackTokenId: BigInt(order.track_token_id), trackCatalogId: '', soundIds: order.sound_ids.map(BigInt),
  });
  const signed = await signVoucher(order.chain_id, cfg.opener, voucher);
  const intent = await transitionOrder(order.id, 'queued', 'unsent', {
    attempts: order.attempts + 1, voucher_digest: signed.digest.toLowerCase(),
    voucher_deadline: Number(voucher.deadline), signer_address: signed.signer.toLowerCase(),
    locked_by: workerId, next_attempt_at: null,
  });
  if (!intent) return 'waiting'; // 别的 worker 已抢到

  try {
    const hash = await operatorWalletClient.writeContract({
      address: cfg.opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'open',
      args: [voucher, signed.signer, signed.signature],
    });
    await transitionOrder(order.id, 'unsent', 'submitted_unknown', { tx_hash: hash.toLowerCase() });
    return 'sent';
  } catch (error) {
    await transitionOrder(order.id, 'unsent', 'unsent', {
      last_error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      failure_code: 'SEND_FAILED',
    });
    return 'failed';
  }
}
