import { ARWEAVE_GATEWAYS } from '@/src/lib/arweave/shared';
import { sha256Hex } from '@/src/lib/score-package';

export type PermanentResourceIdentity = Readonly<{
  arTxId: string;
  sha256: string;
  bytes: number;
  mime: string;
}>;

const TIMEOUT_MS = 15_000;

function normalizeMime(value: string | null): string {
  return (value ?? '').split(';', 1)[0].trim().toLowerCase();
}

async function readGateway(
  gateway: string,
  identity: PermanentResourceIdentity,
): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(`${gateway}/${identity.arTxId}`, {
    cache: 'no-store',
    headers: { Accept: identity.mime },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (normalizeMime(response.headers.get('content-type')) !== normalizeMime(identity.mime)) {
    throw new Error(`MIME ${response.headers.get('content-type') ?? 'missing'}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== identity.bytes) {
    throw new Error(`bytes ${bytes.byteLength} != ${identity.bytes}`);
  }
  if (await sha256Hex(bytes) !== identity.sha256) throw new Error('SHA-256 mismatch');
  return bytes;
}

/** 两个独立网关都返回同一组已固定字节，才允许队列继续。 */
export async function attestPermanentResource(
  identity: PermanentResourceIdentity,
): Promise<Uint8Array> {
  const settled = await Promise.allSettled(
    ARWEAVE_GATEWAYS.map((gateway) => readGateway(gateway, identity)),
  );
  const valid = settled.flatMap((item) => item.status === 'fulfilled' ? [item.value] : []);
  if (valid.length < 2) {
    const reasons = settled.map((item, index) => item.status === 'rejected'
      ? `${ARWEAVE_GATEWAYS[index]}: ${String(item.reason)}`
      : `${ARWEAVE_GATEWAYS[index]}: ok`);
    throw new Error(`永久资源未达到双网关 quorum：${reasons.join('; ')}`);
  }
  if (!Buffer.from(valid[0]).equals(Buffer.from(valid[1]))) {
    throw new Error('永久资源双网关字节不一致');
  }
  return valid[0];
}
