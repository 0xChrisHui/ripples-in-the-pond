import { getAddress, zeroAddress } from 'viem';

/** 新队列使用冻结地址；旧队列沿用已有用户地址。非法快照不能静默改收件人。 */
export function resolveMaterialRecipient(snapshot: string | null | undefined, legacyAddress: string) {
  const address = getAddress(snapshot ?? legacyAddress);
  if (address === zeroAddress) throw new Error('原曲接收地址不能为零地址');
  return address;
}
