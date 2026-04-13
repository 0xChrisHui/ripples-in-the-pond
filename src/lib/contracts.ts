/**
 * 合约地址 + 最小 ABI 子集
 * - Phase 0/1：MaterialNFT (ERC-1155)
 * - Phase 3 S2：ScoreNFT (ERC-721)
 * - Phase 4 S6：AirdropNFT (ERC-721)
 */

export const MATERIAL_NFT_ADDRESS = process.env
  .NEXT_PUBLIC_MATERIAL_NFT_ADDRESS as `0x${string}`;

// MaterialNFT.mint 函数签名（ERC-1155）
export const MATERIAL_NFT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

// ─────────────────────────────────────────────────
// ScoreNFT (Phase 3 S2) — ERC-721 + URIStorage + AccessControl
// ─────────────────────────────────────────────────

export const SCORE_NFT_ADDRESS = process.env
  .NEXT_PUBLIC_SCORE_NFT_ADDRESS as `0x${string}`;

export const SCORE_NFT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'setTokenURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'grantRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'MINTER_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;

// ─────────────────────────────────────────────────
// MintOrchestrator (Phase 3 S3) — ScoreNFT 的"前台"薄壳
// S5 cron 走这个合约，不直接调 ScoreNFT
// ─────────────────────────────────────────────────

export const ORCHESTRATOR_ADDRESS = process.env
  .NEXT_PUBLIC_ORCHESTRATOR_ADDRESS as `0x${string}`;

export const ORCHESTRATOR_ABI = [
  {
    name: 'mintScore',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'tbaEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'setTbaEnabled',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'enabled', type: 'bool' }],
    outputs: [],
  },
  {
    name: 'scoreNft',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'ScoreMinted',
    inputs: [
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;

// ─────────────────────────────────────────────────
// AirdropNFT (Phase 4 S6) — 空投奖励 NFT
// 独立合约，不走 Orchestrator
// ─────────────────────────────────────────────────

// getAddress 标准化 checksum，避免 viem 拒绝大小写不严格的地址
import { getAddress } from 'viem';

export const AIRDROP_NFT_ADDRESS = getAddress(
  process.env.NEXT_PUBLIC_AIRDROP_NFT_ADDRESS as `0x${string}`,
);

export const AIRDROP_NFT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'setTokenURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [],
  },
] as const;
