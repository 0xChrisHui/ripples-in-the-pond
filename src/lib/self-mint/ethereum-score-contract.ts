import { parseAbi, type Address, type Hex } from 'viem';

export const ETHEREUM_SCORE_NAME = 'Ripples in the Pond' as const;
export const ETHEREUM_SCORE_VERSION = '1' as const;

export const MINT_AUTHORIZATION_TYPES = {
  MintAuthorization: [
    { name: 'orderId', type: 'bytes32' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'tokenURIHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export type MintAuthorization = {
  orderId: Hex;
  tokenId: bigint;
  recipient: Address;
  tokenURIHash: Hex;
  deadline: bigint;
};

// 浏览器与服务端共用这一份最小 ABI，不复制 Forge 生成的整份调试 artifact。
export const ETHEREUM_SCORE_ABI = parseAbi([
  'function redeem((bytes32 orderId,uint256 tokenId,address recipient,bytes32 tokenURIHash,uint256 deadline) authorization,string tokenUri,address authorizer,bytes signature)',
  'function tokenIdByOrderId(bytes32 orderId) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function paused() view returns (bool)',
  'function AUTHORIZER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role,address account) view returns (bool)',
  'event ScoreRedeemed(bytes32 indexed orderId,address indexed recipient,uint256 indexed tokenId,bytes32 tokenURIHash)',
]);
