import 'server-only';

import {
  PrivyClient,
  type LinkedAccountWithMetadata,
  type User,
} from '@privy-io/server-auth';
import { getAddress } from 'viem';

type EthereumWallet = Extract<LinkedAccountWithMetadata, { type: 'wallet' }>;

let client: PrivyClient | null = null;

function getClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Privy 服务端环境变量未配置');
  client ??= new PrivyClient(appId, appSecret);
  return client;
}

function isEthereumWallet(account: LinkedAccountWithMetadata): account is EthereumWallet {
  return account.type === 'wallet' && account.chainType === 'ethereum';
}

function isExternal(wallet: EthereumWallet): boolean {
  return wallet.connectorType !== 'embedded'
    && wallet.walletClientType !== 'privy'
    && wallet.walletClientType !== 'privy-v2';
}

export async function verifyPrivyAccessToken(token: string): Promise<string | null> {
  try {
    return (await getClient().verifyAuthToken(token)).userId;
  } catch {
    return null;
  }
}

export async function getPrivyUser(userId: string): Promise<User> {
  return getClient().getUser(userId);
}

export function preferredEvmAddress(user: User): string | null {
  const wallets = user.linkedAccounts.filter(isEthereumWallet);
  const preferred = wallets.find((wallet) => !isExternal(wallet)) ?? wallets[0];
  if (!preferred) return null;
  try { return getAddress(preferred.address); } catch { return null; }
}

export async function findLinkedExternalWallet(
  privyUserId: string,
  requestedAddress: string,
): Promise<{ address: string; walletClientType: string | null; connectorType: string | null } | null> {
  let address: string;
  try { address = getAddress(requestedAddress); } catch { return null; }

  try {
    const user = await getClient().getUserByWalletAddress(address);
    if (!user || user.id !== privyUserId) return null;
    const wallet = user.linkedAccounts.filter(isEthereumWallet).find((account) => {
      if (!isExternal(account)) return false;
      try { return getAddress(account.address) === address; } catch { return false; }
    });
    return wallet ? {
      address,
      walletClientType: wallet.walletClientType ?? null,
      connectorType: wallet.connectorType ?? null,
    } : null;
  } catch {
    return null;
  }
}

function enabledForUser(mode: string | undefined, allowlist: string | undefined, userId: string): boolean {
  if (mode === 'live') return true;
  if (mode !== 'allowlist') return false;
  return (allowlist ?? '').split(',').map((value) => value.trim()).filter(Boolean).includes(userId);
}

export function externalWalletLoginAllowed(userId: string): boolean {
  return enabledForUser(
    process.env.EXTERNAL_WALLET_LOGIN_MODE,
    process.env.EXTERNAL_WALLET_LOGIN_ALLOWLIST,
    userId,
  );
}

export function ethSelfMintAllowed(userId: string): boolean {
  return enabledForUser(
    process.env.ETH_SCORE_SELF_MINT_MODE,
    process.env.ETH_SCORE_SELF_MINT_ALLOWLIST,
    userId,
  );
}
