import { sha256Hex } from '@/src/lib/score-package';
import { PermanentResourcePendingError, settleAttestations } from '@/src/lib/permanent-core/permanent-wait';
import type { PermanentResourceIdentity } from '@/src/lib/permanent-core/attestation';
import type { ScoreMintQueueRow } from '@/src/types/score-mint';
import covers from '@/data/p23/cover-uris.json';

/** 双网关通过不代表第三方使用的 arweave.net 已可读，发行前单独完整验收。 */
export async function verifyGatewayResource(identity: PermanentResourceIdentity, request: typeof fetch = fetch) {
  let response: Response;
  let bytes: Uint8Array;
  try {
    response = await request(`https://arweave.net/${identity.arTxId}`, {
      cache: 'no-store', signal: AbortSignal.timeout(8_000), headers: { Accept: identity.mime },
    });
    if (!response.ok || response.status === 202) throw Error(`HTTP ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    const detail = error instanceof Error
      ? `${error.name}: ${error.message}${error.cause instanceof Error ? `; ${error.cause.message}` : ''}`
      : '未知连接错误';
    throw new PermanentResourcePendingError(
      `发行前 arweave.net 尚不能完整读取资源 ${identity.arTxId}：${detail.replace(/[\r\n]+/g, ' ').slice(0, 180)}`,
      [identity.arTxId],
    );
  }
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mime !== identity.mime || bytes.length !== identity.bytes || await sha256Hex(bytes) !== identity.sha256) {
    throw Error(`CRITICAL: arweave.net 资源身份不匹配 ${identity.arTxId}`);
  }
}

export async function verifyIssuanceResources(row: ScoreMintQueueRow) {
  const cover = covers.find(item => item.txId === row.cover_ar_tx_id);
  if (!cover || !row.metadata_ar_tx_id || !row.metadata_sha256 || !row.metadata_bytes
    || row.metadata_upload_state !== 'verified') throw Error('CRITICAL: 原子发行缺少已固定资源身份');
  await settleAttestations([
    verifyGatewayResource({ arTxId: cover.txId, sha256: cover.sha256, bytes: cover.bytes, mime: 'image/jpeg' }),
    verifyGatewayResource({ arTxId: row.metadata_ar_tx_id, sha256: row.metadata_sha256,
      bytes: row.metadata_bytes, mime: 'application/json' }),
  ]);
}
