import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import {
  externalWalletLoginAllowed,
  ethSelfMintAllowed,
  findLinkedExternalWallet,
} from '@/src/lib/auth/privy-server';
import type { ExternalWalletCheck } from '@/src/types/auth';

const DENIED: ExternalWalletCheck = {
  allowed: false,
  selfMintAllowed: false,
  walletClientType: null,
  connectorType: null,
};

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (auth.authSource !== 'privy' || !auth.privyUserId) return NextResponse.json(DENIED);

  let address: string | null = null;
  try {
    const body = await request.json() as { address?: unknown };
    address = typeof body.address === 'string' ? body.address : null;
  } catch {
    return NextResponse.json(DENIED);
  }
  if (!address || !externalWalletLoginAllowed(auth.userId)) return NextResponse.json(DENIED);

  const wallet = await findLinkedExternalWallet(auth.privyUserId, address);
  const response: ExternalWalletCheck = wallet ? {
    allowed: true,
    selfMintAllowed: ethSelfMintAllowed(auth.userId),
    walletClientType: wallet.walletClientType,
    connectorType: wallet.connectorType,
  } : DENIED;
  return NextResponse.json(response);
}
