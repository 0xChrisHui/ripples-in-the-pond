import { getAddress, isHex } from 'viem';
import { PackIssueError } from '@/src/lib/score-pack/issue';
import { safeMessage } from '@/src/lib/score-pack/redact';
import { SelfMintAccessError } from '@/src/lib/self-mint/access';

export type PackTarget = { chainId: number; scoreContract: string; tokenId: bigint };

export function parseTarget(body: Record<string, unknown>): PackTarget | null {
  try {
    const chainId = Number(body.chainId);
    if (![1, 10, 11155111, 11155420].includes(chainId)) return null;
    if (typeof body.scoreContract !== 'string' || typeof body.tokenId !== 'string'
      || !/^[1-9]\d{0,15}$/.test(body.tokenId)) return null;
    const tokenId = BigInt(body.tokenId);
    // 数据库与快照查询把 tokenId 当 JS number：超过安全整数会舍入成别的 Score（Codex P2-5）
    if (tokenId > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return { chainId, scoreContract: getAddress(body.scoreContract), tokenId };
  } catch {
    return null;
  }
}

export function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && isHex(value) && value.length === 66;
}

export function badRequest(code: string) {
  return Response.json({ error: code, code }, { status: 400 });
}

export function packErrorResponse(error: unknown): Response {
  if (error instanceof PackIssueError) {
    return Response.json({ error: error.code, code: error.code, detail: error.detail }, { status: error.status });
  }
  if (error instanceof SelfMintAccessError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('[score-pack]', safeMessage(error)); // RPC 报错会带含 API key 的 URL，必须脱敏
  return Response.json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }, { status: 500 });
}
