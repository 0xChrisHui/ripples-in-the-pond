import { getAddress, zeroAddress } from 'viem';
import { getChainDefinition } from '../chain/multichain/registry';

export function normalizeTokenId(value: bigint | string | number): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('tokenId 不得丢失精度');
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) throw new Error('tokenId 必须是十进制正整数');
  const token = BigInt(value);
  if (token <= 0n || token >= 2n ** 256n) throw new Error('tokenId 超出 uint256');
  return String(token);
}
export function normalizeContract(value: string): string {
  const address = getAddress(value).toLowerCase();
  if (address === zeroAddress) throw new Error('合约不得为零地址');
  return address;
}
export function buildCatalogAssetId(
  chainId: number, contract: string, tokenId: bigint | string | number,
  standard: 'ERC721' | 'ERC1155',
): string {
  getChainDefinition(chainId);
  if (standard !== 'ERC721' && standard !== 'ERC1155') throw new Error('未知资产标准');
  return `eip155:${chainId}/${standard.toLowerCase()}:${normalizeContract(contract)}/${normalizeTokenId(tokenId)}`;
}
export function parseCatalogAssetId(value: string) {
  const match = /^eip155:(\d+)\/(erc721|erc1155):(0x[0-9a-f]{40})\/([1-9]\d*)$/.exec(value);
  if (!match) throw new Error('资产身份无效');
  const chainId = Number(match[1]);
  getChainDefinition(chainId);
  return { chainId, contractAddress: normalizeContract(match[3]), tokenId: normalizeTokenId(match[4]),
    standard: match[2] === 'erc1155' ? 'ERC1155' as const : 'ERC721' as const };
}
export function buildMaterialPlaybackRoute(chainId: number, contract: string, tokenId: bigint | string | number) {
  const identity = parseCatalogAssetId(buildCatalogAssetId(chainId, contract, tokenId, 'ERC1155'));
  return `/score/material/${identity.chainId}/${identity.contractAddress}/${identity.tokenId}`;
}
export function resolveErc1155Uri(uri: string, tokenId: string | bigint): string {
  return uri.replaceAll('{id}', BigInt(normalizeTokenId(tokenId)).toString(16).padStart(64, '0'));
}
