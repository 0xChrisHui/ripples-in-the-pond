import { createHash } from 'node:crypto';
import { ARWEAVE_AUDIO_GATEWAYS } from '../../../src/lib/arweave/shared';
import { verifyManifestSignature } from './admin';
import type {
  CompatGatewayEvidence, CompatibilityManifest,
} from './types';

export type CompatibilityAsset = Readonly<{
  tokenId: number;
  buffer: Buffer;
  sha256: string;
}>;

const digest = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');

async function readGateway(
  gateway: string,
  txId: string,
  asset: CompatibilityAsset,
  fetcher: typeof fetch,
): Promise<CompatGatewayEvidence> {
  try {
    const response = await fetcher(`${gateway}/${txId}`, {
      headers: { Origin: 'https://pond-ripple.xyz' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return {
        gateway, status: response.status, bytes: null, sha256: null,
        contentType: response.headers.get('content-type'), signatureValid: false,
        ok: false, error: null,
      };
    }
    const announced = Number(response.headers.get('content-length') ?? 0);
    if (announced > 256 * 1024) throw new Error('compat manifest 超过 256KB');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 256 * 1024) throw new Error('compat manifest 超过 256KB');
    const contentType = response.headers.get('content-type');
    const sha256 = digest(buffer);
    let signatureValid = false;
    try {
      const manifest = JSON.parse(buffer.toString('utf8')) as CompatibilityManifest;
      await verifyManifestSignature(manifest);
      signatureValid = manifest.tokenId === asset.tokenId;
    } catch { signatureValid = false; }
    const mimeOk = contentType?.split(';')[0].trim().toLowerCase() === 'application/json';
    return {
      gateway, status: response.status, bytes: buffer.length, sha256, contentType,
      signatureValid, ok: buffer.length === asset.buffer.length && sha256 === asset.sha256
        && Boolean(mimeOk) && signatureValid,
      error: null,
    };
  } catch (error) {
    return {
      gateway, status: null, bytes: null, sha256: null, contentType: null,
      signatureValid: false, ok: false,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export async function verifyCompatibilityQuorum(
  txId: string,
  asset: CompatibilityAsset,
  fetcher: typeof fetch = fetch,
): Promise<CompatGatewayEvidence[]> {
  const evidence: CompatGatewayEvidence[] = [];
  for (const gateway of ARWEAVE_AUDIO_GATEWAYS) {
    evidence.push(await readGateway(gateway, txId, asset, fetcher));
    if (hasCompatibilityQuorum(evidence)) break;
  }
  return evidence;
}

export function hasCompatibilityQuorum(evidence: readonly CompatGatewayEvidence[]): boolean {
  return new Set(evidence.filter(({ ok }) => ok).map(({ gateway }) => gateway)).size >= 2;
}
