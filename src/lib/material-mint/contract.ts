import { parseAbi, hashTypedData, getAddress, type Address, type Hex } from 'viem';
export const MATERIAL_NAME = 'Ripples in the Pond Originals';
export const MATERIAL_VERSION = '1';
export const MATERIAL_TYPES = { MaterialMintAuthorization: [
  { name: 'orderId', type: 'bytes32' }, { name: 'tokenId', type: 'uint256' },
  { name: 'amount', type: 'uint256' }, { name: 'recipient', type: 'address' },
  { name: 'tokenURIHash', type: 'bytes32' }, { name: 'deadline', type: 'uint256' },
] } as const;
export type MaterialAuthorization = {
  orderId: Hex; tokenId: bigint; amount: bigint; recipient: Address; tokenURIHash: Hex; deadline: bigint;
};
export const MATERIAL_ABI = parseAbi([
  'function redeem((bytes32 orderId,uint256 tokenId,uint256 amount,address recipient,bytes32 tokenURIHash,uint256 deadline) authorization,address authorizer,bytes signature)',
  'function authorizationDigest((bytes32 orderId,uint256 tokenId,uint256 amount,address recipient,bytes32 tokenURIHash,uint256 deadline) authorization) view returns(bytes32)',
  'function redeemedOrders(bytes32 orderId) view returns(bool)',
  'function hasClaimed(address account,uint256 id) view returns(bool)',
  'function uri(uint256 id) view returns(string)',
  'function balanceOf(address account,uint256 id) view returns(uint256)',
  'function hasRole(bytes32 role,address account) view returns(bool)',
  'event MaterialRedeemed(bytes32 indexed orderId,address indexed recipient,uint256 indexed tokenId,uint256 amount,bytes32 tokenURIHash)',
]);
export function buildMaterialTypedData(chainId: number, contract: string, authorization: MaterialAuthorization) {
  if (![1, 11155111, 31337].includes(chainId)) throw new Error('原曲签名链无效');
  return { domain: { name: MATERIAL_NAME, version: MATERIAL_VERSION, chainId, verifyingContract: getAddress(contract) },
    types: MATERIAL_TYPES, primaryType: 'MaterialMintAuthorization' as const, message: authorization };
}
export function hashMaterialAuthorization(chainId: number, contract: string, authorization: MaterialAuthorization) {
  return hashTypedData(buildMaterialTypedData(chainId, contract, authorization));
}
