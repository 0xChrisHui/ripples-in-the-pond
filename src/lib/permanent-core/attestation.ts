import { ARWEAVE_AUDIO_GATEWAYS, ARWEAVE_GATEWAYS } from '@/src/lib/arweave/shared';
import { sha256Hex } from '@/src/lib/score-package';

export type PermanentResourceIdentity = Readonly<{
  arTxId: string;
  sha256: string;
  bytes: number;
  mime: string;
}>;

const TIMEOUT_MS = 15_000;
const READ_GATEWAYS = [...new Set([...ARWEAVE_GATEWAYS, ...ARWEAVE_AUDIO_GATEWAYS])];

export class PermanentResourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentResourceUnavailableError';
  }
}

class PermanentResourceIntegrityError extends Error {}

function normalizeMime(value: string | null): string {
  return (value ?? '').split(';', 1)[0].trim().toLowerCase();
}

async function readGateway(
  gateway: string,
  identity: PermanentResourceIdentity,
): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${gateway}/${identity.arTxId}`, {
      cache: 'no-store', headers: { Accept: identity.mime }, signal,
    });
  } catch (caught) {
    throw new PermanentResourceUnavailableError(String(caught));
  }
  if (!response.ok) throw new PermanentResourceUnavailableError(`HTTP ${response.status}`);
  if (normalizeMime(response.headers.get('content-type')) !== normalizeMime(identity.mime)) {
    throw new PermanentResourceIntegrityError(`MIME ${response.headers.get('content-type') ?? 'missing'}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== identity.bytes) {
    throw new PermanentResourceIntegrityError(`bytes ${bytes.byteLength} != ${identity.bytes}`);
  }
  if (await sha256Hex(bytes) !== identity.sha256) {
    throw new PermanentResourceIntegrityError('SHA-256 mismatch');
  }
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

/** 已通过双网关验收并冻结身份的资源，后续读取只需任一网关返回匹配字节。 */
export async function readVerifiedPermanentResource(
  identity: PermanentResourceIdentity,
): Promise<Uint8Array> {
  const settled = await Promise.allSettled(
    READ_GATEWAYS.map((gateway) => readGateway(gateway, identity)),
  );
  const valid = settled.find((item): item is PromiseFulfilledResult<Uint8Array> => (
    item.status === 'fulfilled'
  ));
  if (valid) return valid.value;
  const integrityFailure = settled.find((item) => (
    item.status === 'rejected' && item.reason instanceof PermanentResourceIntegrityError
  ));
  const reasons = settled.map((item, index) => (
    `${READ_GATEWAYS[index]}: ${String((item as PromiseRejectedResult).reason)}`
  ));
  if (integrityFailure) throw new Error(`永久资源身份冲突：${reasons.join('; ')}`);
  throw new PermanentResourceUnavailableError(`永久资源当前不可读：${reasons.join('; ')}`);
}
