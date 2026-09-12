import { createHash } from 'node:crypto';
import {
  hasWalletRecipeGatewayQuorum,
  WALLET_RECIPE_GATEWAYS,
} from '../../../src/lib/wallet-recipe/gateways';

const REQUEST_ORIGIN = 'https://pond-ripple.xyz';
const RANGE_CHUNK_BYTES = 32 * 1024;
const MIN_RANGE_BYTES = 1024;

export type GatewayEvidence = {
  gateway: string;
  status: number | null;
  bytes: number | null;
  sha256: string | null;
  contentType: string | null;
  cors: string | null;
  transport: 'full' | 'range' | null;
  ok: boolean;
  error: string | null;
};

type VerifyInput = {
  txId: string;
  expectedBytes: number;
  expectedSha256: string;
  expectedContentType: string;
};

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function evidence(
  gateway: string,
  input: VerifyInput,
  buffer: Buffer,
  response: Response,
  transport: 'full' | 'range',
): GatewayEvidence {
  const digest = sha256(buffer);
  const contentType = response.headers.get('content-type');
  const cors = response.headers.get('access-control-allow-origin');
  const corsOk = cors === '*' || cors === REQUEST_ORIGIN;
  const typeOk = contentType?.toLowerCase().startsWith(
    input.expectedContentType.toLowerCase(),
  ) ?? false;
  return {
    gateway, status: response.status, bytes: buffer.length, sha256: digest,
    contentType, cors, transport, ok: buffer.length === input.expectedBytes
      && digest === input.expectedSha256 && typeOk && corsOk,
    error: null,
  };
}

type RangePart = { response: Response; buffer: Buffer };

async function fetchRangeParts(
  assetUrl: string,
  input: VerifyInput,
  start: number,
  end: number,
): Promise<RangePart[]> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(assetUrl, {
        headers: { Origin: REQUEST_ORIGIN, Range: `bytes=${start}-${end}` },
        signal: AbortSignal.timeout(12_000),
      });
      const expectedRange = `bytes ${start}-${end}/${input.expectedBytes}`;
      if (response.status !== 206 || response.headers.get('content-range') !== expectedRange) {
        throw new Error(`Range 响应不匹配：${response.status} ${response.headers.get('content-range')}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== end - start + 1) throw new Error(`Range bytes 不匹配：${start}-${end}`);
      return [{ response, buffer }];
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown';
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (end - start + 1 > MIN_RANGE_BYTES) {
    const middle = Math.floor((start + end) / 2);
    return [
      ...await fetchRangeParts(assetUrl, input, start, middle),
      ...await fetchRangeParts(assetUrl, input, middle + 1, end),
    ];
  }
  throw new Error(`Range ${start}-${end} 三次失败：${lastError}`);
}

async function fetchByRanges(gateway: string, input: VerifyInput): Promise<GatewayEvidence> {
  const buffers: Buffer[] = [];
  let firstResponse: Response | null = null;
  let assetUrl = `${gateway}/${input.txId}`;
  const redirectProbe = await fetch(assetUrl, {
    redirect: 'manual',
    headers: { Origin: REQUEST_ORIGIN, Range: 'bytes=0-0' },
    signal: AbortSignal.timeout(12_000),
  });
  assetUrl = redirectProbe.headers.get('location') ?? assetUrl;
  for (let start = 0; start < input.expectedBytes; start += RANGE_CHUNK_BYTES) {
    const end = Math.min(input.expectedBytes - 1, start + RANGE_CHUNK_BYTES - 1);
    const parts = await fetchRangeParts(assetUrl, input, start, end);
    for (const part of parts) {
      firstResponse ??= part.response;
      buffers.push(part.buffer);
    }
  }
  return evidence(gateway, input, Buffer.concat(buffers), firstResponse!, 'range');
}

async function verifyOne(gateway: string, input: VerifyInput): Promise<GatewayEvidence> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`${gateway}/${input.txId}`, {
        headers: { Origin: REQUEST_ORIGIN },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        return {
          gateway, status: response.status, bytes: null, sha256: null,
          contentType: response.headers.get('content-type'),
          cors: response.headers.get('access-control-allow-origin'),
          transport: null, ok: false, error: null,
        };
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return evidence(gateway, input, buffer, response, 'full');
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown';
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (input.expectedBytes > RANGE_CHUNK_BYTES) {
    try {
      return await fetchByRanges(gateway, input);
    } catch (error) {
      lastError = `${lastError}; range: ${error instanceof Error ? error.message : 'unknown'}`;
    }
  }
  return {
    gateway, status: null, bytes: null, sha256: null, contentType: null,
    cors: null, transport: null, ok: false, error: lastError,
  };
}

export async function verifyAssetOnGateways(input: VerifyInput): Promise<GatewayEvidence[]> {
  const results: GatewayEvidence[] = [];
  for (const gateway of WALLET_RECIPE_GATEWAYS) {
    results.push(await verifyOne(gateway, input));
    if (hasWalletRecipeGatewayQuorum(results)) break;
  }
  return results;
}
