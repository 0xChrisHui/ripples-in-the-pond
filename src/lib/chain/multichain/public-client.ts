import 'server-only';

import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';
import { getChainDefinition, type SupportedChainId } from './registry';

const VIEM_CHAINS = { 1: mainnet, 10: optimism, 11155111: sepolia, 11155420: optimismSepolia };
const clients = new Map<SupportedChainId, PublicClient>();

export function getChainPublicClient(chainId: number): PublicClient {
  const definition = getChainDefinition(chainId);
  const id = definition.chainId;
  const existing = clients.get(id);
  if (existing) return existing;

  const rpcUrl = definition.rpcEnv === 'ALCHEMY_RPC_URL'
    ? process.env.ALCHEMY_RPC_URL
    : process.env.ETHEREUM_RPC_URL;
  const configuredChain = definition.scoreMintMode === 'op_sponsored'
    ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
    : Number(process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID);
  if (configuredChain !== id) {
    throw new Error(`${definition.displayName} RPC 未在当前环境启用`);
  }
  if (!rpcUrl) throw new Error(`${definition.rpcEnv} 未配置`);

  const chain: Chain = VIEM_CHAINS[id];
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  clients.set(id, client);
  return client;
}

export function getRequiredConfirmations(chainId: number): number {
  const policy = getChainDefinition(chainId).confirmations;
  if (typeof policy === 'number') return policy;
  const value = Number(process.env[policy]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${policy} 必须是正整数`);
  return value;
}
