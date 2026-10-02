import type { Address, Hex } from 'viem';
export type MaterialOrder = {
  order_id: Hex; user_id: string; request_key: string; track_id: string;
  chain_id: 1 | 11155111; contract_address: Address; token_id: string; recipient_address: Address;
  amount: 1; catalog_revision: string; metadata_uri: string; uri_hash: Hex;
  status: 'prepared' | 'authorized' | 'sending' | 'unknown' | 'submitted' | 'confirming' | 'success' | 'reverted' | 'cancelled';
  version: number; current_digest: Hex | null; tx_hash: Hex | null;
  confirmed_block: string | null; confirmed_block_hash: Hex | null; confirmed_log_index: number | null;
  lease_owner: string | null; lease_until: string | null; error_kind: string | null;
  scan_cursor?: string | null;
};
export type MaterialAttempt = {
  order_id: Hex; digest: Hex; deadline: number; authorizer: Address; send_attempted_at: string | null;
  outcome: 'rejected' | 'unknown' | 'submitted' | null; tx_hashes: Hex[];
};
export type MaterialMintProof = {
  orderId: Hex; chainId: number; contract: string; recipient: string; tokenId: string; amount: string;
  uriHash: Hex; txHash: Hex; blockNumber: string; blockHash: Hex; logIndex: number; digest: Hex;
  canonicalConfirmed: true;
};
export function publicMaterialOrder(row: MaterialOrder) {
  return { orderId: row.order_id, trackId: row.track_id, chainId: row.chain_id,
    contractAddress: row.contract_address, tokenId: String(row.token_id), recipientAddress: row.recipient_address,
    amount: row.amount, catalogRevision: row.catalog_revision, metadataUri: row.metadata_uri,
    status: row.status, version: row.version, txHash: row.tx_hash, digest: row.current_digest,
    recovery: ['sending', 'unknown', 'submitted', 'confirming'].includes(row.status) ? 'check_existing_order' : 'none' };
}
