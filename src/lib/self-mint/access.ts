import 'server-only';

import { getAddress, type Address } from 'viem';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { ethSelfMintAllowed, findLinkedExternalWallet } from '@/src/lib/auth/privy-server';

export class SelfMintAccessError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

export type SelfMintContext = { userId: string; walletAddress: Address };

export async function requireSelfMintContext(
  request: Request,
  requestedAddress: unknown,
): Promise<SelfMintContext> {
  const auth = await authenticateRequest(request);
  if (!auth) throw new SelfMintAccessError('未登录', 401, 'UNAUTHENTICATED');
  if (auth.authSource !== 'privy' || !auth.privyUserId) {
    throw new SelfMintAccessError('当前登录方式不支持 ETH 自付铸造', 403, 'EXTERNAL_WALLET_REQUIRED');
  }
  if (!ethSelfMintAllowed(auth.userId)) {
    throw new SelfMintAccessError('ETH 自付铸造尚未向当前账号开放', 403, 'FEATURE_DISABLED');
  }

  let address: Address;
  try {
    if (typeof requestedAddress !== 'string') throw new Error('missing');
    address = getAddress(requestedAddress);
  } catch {
    throw new SelfMintAccessError('钱包地址无效', 400, 'INVALID_WALLET');
  }
  if (!await findLinkedExternalWallet(auth.privyUserId, address)) {
    throw new SelfMintAccessError('钱包未与当前登录会话关联', 403, 'WALLET_NOT_LINKED');
  }
  return { userId: auth.userId, walletAddress: address };
}

export function selfMintErrorResponse(error: unknown): Response {
  if (error instanceof SelfMintAccessError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('[self-mint]', error);
  return Response.json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' }, { status: 500 });
}
