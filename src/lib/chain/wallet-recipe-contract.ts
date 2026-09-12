import 'server-only';

import { getAddress, type Address } from 'viem';

export const WALLET_RECIPE_ABI = [
  {
    type: 'function', name: 'mintToOrigin', stateMutability: 'nonpayable',
    inputs: [
      { name: 'origin', type: 'address' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'tokenIdByOrigin', stateMutability: 'view',
    inputs: [{ name: 'origin', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'originWalletOf', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', name: 'tokenURI', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function', name: 'ownerOf', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'totalSupply', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'tokenOfOwnerByIndex', stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'contractURI', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function', name: 'MINTER_ROLE', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function', name: 'hasRole', stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event', name: 'WalletRecipeMinted',
    inputs: [
      { indexed: true, name: 'origin', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;

export type WalletRecipeMode = 'off' | 'observe' | 'live';

export function getWalletRecipeMode(): {
  mode: WalletRecipeMode;
  configured: boolean;
} {
  const raw = process.env.WALLET_RECIPE_MODE?.trim().toLowerCase();
  if (raw === 'off' || raw === 'observe' || raw === 'live') {
    return { mode: raw, configured: true };
  }
  return { mode: 'off', configured: false };
}

export function getWalletRecipeAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS?.trim();
  if (!raw) return null;
  return getAddress(raw);
}

export type WalletRecipePermanentConfig = {
  clipManifestTxId: string;
  decoderTxId: string;
  imageTxId: string;
};

export function getWalletRecipePermanentConfig(): WalletRecipePermanentConfig | null {
  const clipManifestTxId = process.env.WALLET_RECIPE_CLIP_MANIFEST_V1_TX_ID?.trim();
  const decoderTxId = process.env.WALLET_RECIPE_DECODER_V1_TX_ID?.trim();
  const imageTxId = process.env.WALLET_RECIPE_IMAGE_V1_TX_ID?.trim();
  if (!clipManifestTxId || !decoderTxId || !imageTxId) return null;
  return { clipManifestTxId, decoderTxId, imageTxId };
}
