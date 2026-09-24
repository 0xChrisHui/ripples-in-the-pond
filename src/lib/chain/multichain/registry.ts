import { getAddress, zeroAddress, type Address } from 'viem';

export type SupportedChainId = 1 | 10 | 11155111 | 11155420;
export type ScoreMintMode = 'op_sponsored' | 'eth_self_paid';
export type AssetCoordinate = {
  chainId: SupportedChainId;
  contractAddress: Address;
  tokenId: bigint;
};

export type ChainDefinition = {
  chainId: SupportedChainId;
  shortName: string;
  displayName: string;
  rpcEnv: 'ALCHEMY_RPC_URL' | 'ETHEREUM_RPC_URL';
  explorerBaseUrl: string;
  deploymentBlockEnv: 'SCORE_NFT_DEPLOYMENT_BLOCK' | 'ETH_SCORE_DEPLOYMENT_BLOCK';
  scoreMintMode: ScoreMintMode;
  allowsLoginConnection: boolean;
  allowsMintInitiation: boolean;
  receiptTimeoutMs: number;
  confirmations: number | 'ETH_SCORE_CONFIRMATIONS';
};

const REGISTRY: Record<SupportedChainId, ChainDefinition> = {
  1: {
    chainId: 1, shortName: 'eth', displayName: 'Ethereum Mainnet',
    rpcEnv: 'ETHEREUM_RPC_URL', explorerBaseUrl: 'https://etherscan.io',
    deploymentBlockEnv: 'ETH_SCORE_DEPLOYMENT_BLOCK',
    scoreMintMode: 'eth_self_paid', allowsLoginConnection: true,
    allowsMintInitiation: false,
    receiptTimeoutMs: 30 * 60_000, confirmations: 'ETH_SCORE_CONFIRMATIONS',
  },
  10: {
    chainId: 10, shortName: 'op', displayName: 'OP Mainnet',
    rpcEnv: 'ALCHEMY_RPC_URL', explorerBaseUrl: 'https://optimistic.etherscan.io',
    deploymentBlockEnv: 'SCORE_NFT_DEPLOYMENT_BLOCK',
    scoreMintMode: 'op_sponsored', allowsLoginConnection: true,
    allowsMintInitiation: true,
    receiptTimeoutMs: 10 * 60_000, confirmations: 1,
  },
  11155111: {
    chainId: 11155111, shortName: 'sep', displayName: 'Sepolia',
    rpcEnv: 'ETHEREUM_RPC_URL', explorerBaseUrl: 'https://sepolia.etherscan.io',
    deploymentBlockEnv: 'ETH_SCORE_DEPLOYMENT_BLOCK',
    scoreMintMode: 'eth_self_paid', allowsLoginConnection: true,
    allowsMintInitiation: true,
    receiptTimeoutMs: 30 * 60_000, confirmations: 'ETH_SCORE_CONFIRMATIONS',
  },
  11155420: {
    chainId: 11155420, shortName: 'op-sep', displayName: 'OP Sepolia',
    rpcEnv: 'ALCHEMY_RPC_URL', explorerBaseUrl: 'https://sepolia-optimism.etherscan.io',
    deploymentBlockEnv: 'SCORE_NFT_DEPLOYMENT_BLOCK',
    scoreMintMode: 'op_sponsored', allowsLoginConnection: true,
    allowsMintInitiation: true,
    receiptTimeoutMs: 10 * 60_000, confirmations: 1,
  },
};

export function getChainDefinition(chainId: number): ChainDefinition {
  const chain = REGISTRY[chainId as SupportedChainId];
  if (!chain) throw new Error(`不支持的 chainId=${chainId}`);
  return chain;
}

export function getConfiguredScoreAddress(chainId: number): Address {
  const chain = getChainDefinition(chainId);
  const configuredChain = chain.scoreMintMode === 'op_sponsored'
    ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
    : Number(process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID);
  const rawAddress = chain.scoreMintMode === 'op_sponsored'
    ? process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS
    : process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS;
  if (configuredChain !== chainId || !rawAddress) {
    throw new Error(`${chain.displayName} ScoreNFT 未在当前环境启用`);
  }
  const address = getAddress(rawAddress);
  if (address === zeroAddress) throw new Error(`${chain.displayName} ScoreNFT 地址无效`);
  return address;
}

export function getConfiguredScoreDeploymentBlock(chainId: number): bigint {
  const chain = getChainDefinition(chainId);
  const value = process.env[chain.deploymentBlockEnv];
  if (!value || !/^\d+$/.test(value) || BigInt(value) < 1n) {
    throw new Error(`${chain.deploymentBlockEnv} 必须是正整数`);
  }
  return BigInt(value);
}

export function buildAssetId(
  chainId: number,
  contractAddress: string,
  tokenId: bigint | number | string,
): string {
  getChainDefinition(chainId);
  const contract = getAddress(contractAddress).toLowerCase();
  const token = BigInt(tokenId);
  if (token <= 0n) throw new Error('tokenId 必须为正整数');
  return `eip155:${chainId}/erc721:${contract}/${token}`;
}

export function parseAssetId(assetId: string): AssetCoordinate {
  const match = /^eip155:(\d+)\/erc721:(0x[0-9a-f]{40})\/([1-9]\d*)$/.exec(assetId);
  if (!match) throw new Error('非法 ERC-721 assetId');
  const chain = getChainDefinition(Number(match[1]));
  return {
    chainId: chain.chainId,
    contractAddress: getAddress(match[2]),
    tokenId: BigInt(match[3]),
  };
}

export function buildScoreRoute(
  chainId: number,
  contractAddress: string,
  tokenId: bigint | number | string,
): string {
  const assetId = buildAssetId(chainId, contractAddress, tokenId);
  const [, asset, token] = assetId.split('/');
  return `/score/${chainId}/${asset.slice('erc721:'.length)}/${token}`;
}

export function explorerTxUrlFor(chainId: number, hash: string): string {
  return `${getChainDefinition(chainId).explorerBaseUrl}/tx/${hash}`;
}

export function explorerAddressUrlFor(chainId: number, address: string): string {
  return `${getChainDefinition(chainId).explorerBaseUrl}/address/${getAddress(address)}`;
}
