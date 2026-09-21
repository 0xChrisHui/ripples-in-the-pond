import { createHash } from 'node:crypto';
import { ARWEAVE_AUDIO_GATEWAYS } from '../../../src/lib/arweave/shared';
import { decodeMp3 } from '../../p15-h/sound-set-ledger';
import type { H3GatewayEvidence } from './upload-state';
import type { H3Asset } from './sound-set-assets';

const REQUEST_ORIGIN = 'https://pond-ripple.xyz';

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function decode(buffer: Buffer, contentType: H3Asset['contentType']): boolean {
  if (contentType === 'audio/mpeg') {
    decodeMp3(buffer);
    return true;
  }
  const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
  return typeof parsed === 'object' && parsed !== null;
}

async function readOne(
  gateway: string,
  txId: string,
  asset: H3Asset,
  fetcher: typeof fetch,
): Promise<H3GatewayEvidence> {
  try {
    const response = await fetcher(`${gateway}/${txId}`, {
      headers: { Origin: REQUEST_ORIGIN },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return {
        gateway, status: response.status, bytes: null, sha256: null,
        contentType: response.headers.get('content-type'), decoded: false, ok: false, error: null,
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');
    let decoded = false;
    try { decoded = decode(buffer, asset.contentType); } catch { decoded = false; }
    const digest = sha256(buffer);
    const mimeOk = contentType?.split(';')[0].trim().toLowerCase() === asset.contentType;
    return {
      gateway, status: response.status, bytes: buffer.length, sha256: digest,
      contentType, decoded, ok: buffer.length === asset.buffer.length
        && digest === asset.sha256 && mimeOk && decoded,
      error: null,
    };
  } catch (error) {
    return {
      gateway, status: null, bytes: null, sha256: null, contentType: null,
      decoded: false, ok: false, error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export async function fullReadbackQuorum(
  txId: string,
  asset: H3Asset,
  fetcher: typeof fetch = fetch,
): Promise<H3GatewayEvidence[]> {
  const evidence: H3GatewayEvidence[] = [];
  for (const gateway of ARWEAVE_AUDIO_GATEWAYS) {
    evidence.push(await readOne(gateway, txId, asset, fetcher));
    if (new Set(evidence.filter(({ ok }) => ok).map(({ gateway: item }) => item)).size >= 2) break;
  }
  return evidence;
}

export function hasFullReadbackQuorum(evidence: readonly H3GatewayEvidence[]): boolean {
  return new Set(evidence.filter(({ ok }) => ok).map(({ gateway }) => gateway)).size >= 2;
}
