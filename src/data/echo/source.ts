import 'server-only';

import { cache } from 'react';
import { getAddress, type Address } from 'viem';
import { CLIP_MANIFEST_V1 } from '@/src/features/wallet-recipe/clip-manifest';
import { CHAIN_ID_NUM, explorerAddressUrl } from '@/src/lib/chain/chain-config';
import { publicClient } from '@/src/lib/chain/public-client';
import {
  getWalletRecipeAddress, getWalletRecipePermanentConfig, WALLET_RECIPE_ABI,
} from '@/src/lib/chain/wallet-recipe-contract';
import { formatPondEchoName } from '@/src/lib/wallet-recipe/metadata';
import { parseWalletRecipeMetadataJsonV1 } from '@/src/lib/wallet-recipe/metadata-parser';
import { fetchMetadataQuorum } from './arweave';
import type { EchoArchiveItem, EchoViewData } from './types';

const MAX_OWNED = 64;

function contractAddress(): Address {
  const address = getWalletRecipeAddress();
  if (!address) throw new Error('Pond Echoes 合约尚未配置');
  return address;
}

function metadataTxId(tokenUri: string): string {
  const match = /^ar:\/\/([A-Za-z0-9_-]{43})$/.exec(tokenUri);
  if (!match) throw new Error('链上 tokenURI 不是冻结的 ar:// metadata');
  return match[1];
}

function networkLabel(): string {
  return CHAIN_ID_NUM === 10 ? 'OP Mainnet' : 'OP Sepolia';
}

export async function getEchoByTokenId(tokenId: bigint): Promise<EchoViewData | null> {
  if (tokenId <= 0n) return null;
  const address = contractAddress();
  const totalSupply = await publicClient.readContract({
    address, abi: WALLET_RECIPE_ABI, functionName: 'totalSupply',
  });
  if (tokenId > totalSupply) return null;
  const owner: Address = await publicClient.readContract({
    address, abi: WALLET_RECIPE_ABI, functionName: 'ownerOf', args: [tokenId],
  });
  const [originWallet, tokenUri] = await Promise.all([
    publicClient.readContract({
      address, abi: WALLET_RECIPE_ABI, functionName: 'originWalletOf', args: [tokenId],
    }),
    publicClient.readContract({
      address, abi: WALLET_RECIPE_ABI, functionName: 'tokenURI', args: [tokenId],
    }),
  ]);
  const txId = metadataTxId(tokenUri);
  const permanent = getWalletRecipePermanentConfig();
  if (!permanent) throw new Error('Pond Echoes 永久输入尚未配置');
  const fetched = await fetchMetadataQuorum(txId);
  const metadata = parseWalletRecipeMetadataJsonV1(fetched.json, {
    decoderTxId: permanent.decoderTxId,
    clipManifestTxId: permanent.clipManifestTxId,
    imageTxId: permanent.imageTxId,
    clipManifest: CLIP_MANIFEST_V1,
  });
  if (metadata.properties.originWallet !== originWallet) {
    throw new Error('链上 origin 与永久 metadata 不一致');
  }
  return {
    tokenId: tokenId.toString(), contractAddress: address, owner, originWallet, tokenUri,
    metadataTxId: txId, metadata, network: networkLabel(),
    explorerUrl: explorerAddressUrl(address),
    imageUrl: `${fetched.gateways[0]}/${permanent.imageTxId}`,
    verifiedGateways: fetched.gateways,
  };
}

export async function getEchoByOrigin(origin: string): Promise<EchoViewData | null> {
  const normalized = getAddress(origin);
  const tokenId = await publicClient.readContract({
    address: contractAddress(), abi: WALLET_RECIPE_ABI,
    functionName: 'tokenIdByOrigin', args: [normalized],
  });
  return tokenId === 0n ? null : getEchoByTokenId(tokenId);
}

export async function getOwnedEchoes(owner: string): Promise<{
  items: EchoArchiveItem[];
  total: number;
  truncated: boolean;
}> {
  const normalized = getAddress(owner);
  const address = contractAddress();
  const balance = await publicClient.readContract({
    address, abi: WALLET_RECIPE_ABI, functionName: 'balanceOf', args: [normalized],
  });
  const count = Number(balance > BigInt(MAX_OWNED) ? BigInt(MAX_OWNED) : balance);
  const tokenIds = await Promise.all(Array.from({ length: count }, (_, index) => (
    publicClient.readContract({
      address, abi: WALLET_RECIPE_ABI, functionName: 'tokenOfOwnerByIndex',
      args: [normalized, BigInt(index)],
    })
  )));
  const items = await Promise.all(tokenIds.map(async (tokenId): Promise<EchoArchiveItem> => {
    const [originWallet, tokenUri] = await Promise.all([
      publicClient.readContract({ address, abi: WALLET_RECIPE_ABI,
        functionName: 'originWalletOf', args: [tokenId] }),
      publicClient.readContract({ address, abi: WALLET_RECIPE_ABI,
        functionName: 'tokenURI', args: [tokenId] }),
    ]);
    return {
      key: `owned:${tokenId}`, tokenId: tokenId.toString(),
      name: formatPondEchoName(originWallet), originWallet, currentOwner: normalized,
      tokenUri, status: 'owned', relation: 'current-owner', hasError: false,
    };
  }));
  return { items, total: Number(balance), truncated: balance > BigInt(MAX_OWNED) };
}

export const getEchoByTokenIdCached = cache(getEchoByTokenId);
export const getEchoByOriginCached = cache(getEchoByOrigin);
