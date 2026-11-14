import { parseAbi, keccak256, stringToHex, type Address } from 'viem';
import { supabaseAdmin } from '@/src/lib/supabase';
import type { ScoreMintQueueRow } from '@/src/types/score-mint';

export const ATOMIC_ABI = parseAbi([
  'function mintScoreWithURI(address recipient, bytes32 orderId, uint256 expectedTokenId, string tokenUri) returns (uint256)',
  'function tokenIdByOrderId(bytes32) view returns (uint256)',
  'function orchestrator() view returns (address)',
  'function scoreNft() view returns (address)',
  'event ScoreIssued(bytes32 indexed orderId, address indexed recipient, uint256 indexed tokenId, bytes32 tokenURIHash)',
]);
export const orderId = (row: ScoreMintQueueRow) => keccak256(stringToHex(row.id));
export const tokenUri = (row: ScoreMintQueueRow) => `ar://${row.metadata_ar_tx_id}`;
export function issueArgs(row: ScoreMintQueueRow) {
  if (!row.atomic_issuer || !row.atomic_recipient || !row.expected_token_id || !row.metadata_ar_tx_id) {
    throw Error('CRITICAL: 原子发行固定身份不完整');
  }
  return [row.atomic_recipient as Address, orderId(row), BigInt(row.expected_token_id), tokenUri(row)] as const;
}
export async function saveAtomic(row: ScoreMintQueueRow, owner: string, values: Partial<ScoreMintQueueRow>) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('score_nft_queue')
    .update({ ...values, updated_at: now }).eq('id', row.id).eq('locked_by', owner)
    .gt('lease_expires_at', now).select('id').maybeSingle();
  if (error || !data) throw Error('CRITICAL: 原子发行状态保存失败，需按已记录哈希对账');
}
