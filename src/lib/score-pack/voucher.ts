import { encodePacked, getAddress, hashTypedData, keccak256, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  PACK_DOMAIN_NAME, PACK_DOMAIN_VERSION, PACK_VOUCHER_TTL_SECONDS, PACK_VOUCHER_TYPES,
} from './contract';
import type { DerivedPack } from './derive';

export type PackVoucher = {
  scoreTokenId: bigint;
  holder: Address;
  trackTokenId: bigint;
  soundIds: bigint[];
  deadline: bigint;
};

export function soundIdsHash(soundIds: readonly bigint[]): Hex {
  return keccak256(encodePacked(['uint256[]'], [soundIds as bigint[]]));
}

export function packDomain(chainId: number, opener: Address) {
  return {
    name: PACK_DOMAIN_NAME, version: PACK_DOMAIN_VERSION, chainId,
    verifyingContract: getAddress(opener),
  } as const;
}

function typedMessage(voucher: PackVoucher) {
  return {
    scoreTokenId: voucher.scoreTokenId, holder: voucher.holder, trackTokenId: voucher.trackTokenId,
    soundIdsHash: soundIdsHash(voucher.soundIds), deadline: voucher.deadline,
  };
}

export function buildVoucher(
  scoreTokenId: bigint, holder: Address, pack: DerivedPack,
  nowSeconds = Math.floor(Date.now() / 1000),
): PackVoucher {
  return {
    scoreTokenId, holder: getAddress(holder), trackTokenId: pack.trackTokenId,
    soundIds: pack.soundIds, deadline: BigInt(nowSeconds + PACK_VOUCHER_TTL_SECONDS),
  };
}

export function voucherDigest(chainId: number, opener: Address, voucher: PackVoucher): Hex {
  return hashTypedData({
    domain: packDomain(chainId, opener), types: PACK_VOUCHER_TYPES,
    primaryType: 'PackVoucher', message: typedMessage(voucher),
  });
}

/** 签名钥匙独立于 operator（冻结表 §3）；私钥与公开地址必须一致，防配置串位。 */
export function packSigner() {
  const key = process.env.P22_SIGNER_PRIVATE_KEY as Hex | undefined;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('P22_SIGNER_PRIVATE_KEY 未配置或格式错误');
  const account = privateKeyToAccount(key);
  const configured = process.env.P22_SIGNER_ADDRESS;
  if (!configured || getAddress(configured) !== account.address) {
    throw new Error('P22 signer 私钥与公开地址不一致');
  }
  return account;
}

export async function signVoucher(chainId: number, opener: Address, voucher: PackVoucher) {
  const account = packSigner();
  const signature = await account.signTypedData({
    domain: packDomain(chainId, opener), types: PACK_VOUCHER_TYPES,
    primaryType: 'PackVoucher', message: typedMessage(voucher),
  });
  return {
    signer: account.address, signature,
    digest: voucherDigest(chainId, opener, voucher),
  };
}

/** 序列化给 HTTP / 钱包用（bigint 不能直接 JSON）。 */
export function voucherToJson(voucher: PackVoucher) {
  return {
    scoreTokenId: voucher.scoreTokenId.toString(), holder: voucher.holder,
    trackTokenId: voucher.trackTokenId.toString(),
    soundIds: voucher.soundIds.map(String), deadline: voucher.deadline.toString(),
  };
}
