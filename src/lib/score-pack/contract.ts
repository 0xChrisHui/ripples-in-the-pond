import { getAddress, zeroAddress, type Address } from 'viem';

/** 与 contracts/src/p22/ScorePackOpener.sol 一致；改动需同步合约与 contracts/test/p22/VoucherVector.t.sol。 */
export const PACK_DOMAIN_NAME = 'Ripples Pond Score Pack';
export const PACK_DOMAIN_VERSION = '1';
export const PACK_VOUCHER_TTL_SECONDS = 10 * 60;
export const PACK_MAX_SOUNDS = 64;

export const PACK_VOUCHER_TYPES = {
  PackVoucher: [
    { name: 'scoreTokenId', type: 'uint256' },
    { name: 'holder', type: 'address' },
    { name: 'trackTokenId', type: 'uint256' },
    { name: 'soundIdsHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

const VOUCHER_TUPLE = {
  type: 'tuple', name: 'v',
  components: [
    { name: 'scoreTokenId', type: 'uint256' },
    { name: 'holder', type: 'address' },
    { name: 'trackTokenId', type: 'uint256' },
    { name: 'soundIds', type: 'uint256[]' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const SCORE_PACK_OPENER_ABI = [
  {
    type: 'function', name: 'open', stateMutability: 'nonpayable',
    inputs: [VOUCHER_TUPLE, { name: 'signer', type: 'address' }, { name: 'signature', type: 'bytes' }],
    outputs: [{ name: 'account', type: 'address' }],
  },
  {
    type: 'function', name: 'opened', stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'accountOf', stateMutability: 'view',
    inputs: [{ name: 'scoreTokenId', type: 'uint256' }], outputs: [{ type: 'address' }],
  },
  {
    type: 'event', name: 'PackOpened',
    inputs: [
      { name: 'scoreTokenId', type: 'uint256', indexed: true },
      { name: 'account', type: 'address', indexed: true },
      { name: 'holder', type: 'address', indexed: true },
      { name: 'trackTokenId', type: 'uint256', indexed: false },
      { name: 'soundIds', type: 'uint256[]', indexed: false },
      { name: 'caller', type: 'address', indexed: false },
    ],
  },
] as const;

export const POND_ASSET_ABI = [
  {
    type: 'function', name: 'balanceOfBatch', stateMutability: 'view',
    inputs: [{ name: 'accounts', type: 'address[]' }, { name: 'ids', type: 'uint256[]' }],
    outputs: [{ type: 'uint256[]' }],
  },
] as const;

export const SCORE_OWNER_ABI = [{
  type: 'function', name: 'ownerOf', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }],
}] as const;

export type PackChainConfig = {
  chainId: 1 | 10 | 11155111 | 11155420;
  opener: Address;
  sounds: Address;
  tracks: Address;
};

/** 每条链的 P22 合约地址从 env 读取；未配置即视为该链未开放资产包。 */
export function getPackChainConfig(chainId: number): PackChainConfig | null {
  const read = (name: string) => process.env[`NEXT_PUBLIC_P22_${name}_${chainId}`];
  const opener = read('OPENER');
  const sounds = read('SOUNDS');
  const tracks = read('TRACKS');
  if (!opener || !sounds || !tracks) return null;
  const addresses = [opener, sounds, tracks].map((value) => getAddress(value));
  if (addresses.some((address) => address === zeroAddress)) return null;
  return {
    chainId: chainId as PackChainConfig['chainId'],
    opener: addresses[0], sounds: addresses[1], tracks: addresses[2],
  };
}
