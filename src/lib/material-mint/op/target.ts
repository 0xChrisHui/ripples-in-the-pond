import { getAddress, type Address } from 'viem';
import { getOriginalMintDeployment } from '../../music-catalog/asset-registry';
import type { OriginalDeployment } from '../../music-catalog/types';

export function requireOpSbtTarget(trackId: string, mode: string | undefined, queueReady: boolean) {
  const target = getOriginalMintDeployment(trackId, 10);
  if (!target) throw new Error('INVALID_TRACK');
  if (!target.contractAddress || !target.tokenId || !target.metadataUri || target.status !== 'ready') throw new Error('OP_SBT_DEPLOYMENT_PENDING');
  if (mode !== 'live' || !queueReady) throw new Error('OP_SBT_DISABLED');
  return { ...target, contractAddress: getAddress(target.contractAddress), tokenId: target.tokenId, metadataUri: target.metadataUri };
}
// NULL是旧队列约定；显式新目标必须对应已核验SBT，不能退回旧合约。
export function selectMaterialJobContract(frozenTarget: unknown, legacy: string, target: OriginalDeployment | null): Address {
  if (frozenTarget === null || frozenTarget === undefined) return getAddress(legacy);
  if (typeof frozenTarget !== 'string' || !target?.contractAddress || target.status !== 'ready'
    || getAddress(frozenTarget) !== getAddress(target.contractAddress)) throw new Error('OP_SBT_TARGET_MISMATCH');
  return getAddress(frozenTarget);
}
export function opSbtRequestKey(userId: string, contract: string, tokenId: string) {
  return `op-sbt:${userId}:${getAddress(contract).toLowerCase()}:${BigInt(tokenId)}`;
}
