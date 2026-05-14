import 'server-only';
import { optimism, optimismSepolia, type Chain } from 'viem/chains';

function readChainId(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_CHAIN_ID 未设置。本地 dev：.env.local 加 NEXT_PUBLIC_CHAIN_ID=11155420（OP Sepolia）。主网部署：=10。',
    );
  }

  const chainId = Number(raw);
  if (chainId !== 10 && chainId !== 11155420) {
    throw new Error(
      `不支持的 NEXT_PUBLIC_CHAIN_ID=${raw}，仅允许 10（OP Mainnet）或 11155420（OP Sepolia）。请修正 .env.local / Vercel env 后重启。`,
    );
  }

  return chainId;
}

export const CHAIN_ID_NUM = readChainId();
export const CURRENT_CHAIN: Chain = CHAIN_ID_NUM === 10 ? optimism : optimismSepolia;

const explorerBase =
  CHAIN_ID_NUM === 10
    ? 'https://optimistic.etherscan.io'
    : 'https://sepolia-optimism.etherscan.io';

export function explorerTxUrl(hash: string): string {
  return `${explorerBase}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${explorerBase}/address/${address}`;
}
