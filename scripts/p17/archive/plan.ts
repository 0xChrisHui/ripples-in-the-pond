import { createHash } from 'node:crypto';
import { getAddress, zeroAddress, type Hex } from 'viem';
import type { MusicCatalog } from '../../../src/lib/music-catalog/types';
import type { ArchivePlan, ArchiveRecipient, ArchiveItem } from './types';

function digest(value: unknown): Hex {
  return `0x${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
export function createArchivePlan(catalog: MusicCatalog, options: {
  runId: string; sourceSha: string; recipients?: Partial<Record<1 | 10, ArchiveRecipient>>;
}): ArchivePlan {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.runId) || !/^[0-9a-f]{40}$/.test(options.sourceSha)) {
    throw new Error('留存计划runId或源码SHA无效');
  }
  const items: ArchiveItem[] = catalog.tracks.flatMap(track => track.deployments.map(deployment => {
    if (deployment.chainId !== 1 && deployment.chainId !== 10) throw new Error('留存链不在本轮范围');
    const input = options.recipients?.[deployment.chainId];
    const recipient = input ? getAddress(input.address).toLowerCase() as `0x${string}` : null;
    if (recipient === zeroAddress || (input && !input.approvalRef.trim())) throw new Error('接收地址或输入依据无效');
    const coordinate = { chainId: deployment.chainId, contractAddress: deployment.contractAddress,
      tokenId: deployment.tokenId, metadataUri: deployment.metadataUri, recipient, amount: '1',
      approvalRef: input?.approvalRef ?? null, strategy: 'existing-mint-and-current-balance-v1' };
    const operationId = recipient && deployment.contractAddress && deployment.tokenId ? digest(coordinate) : null;
    return { trackId: track.trackId, displayNumber: track.displayNumber, chainId: deployment.chainId,
      contractAddress: deployment.contractAddress as ArchiveItem['contractAddress'], tokenId: deployment.tokenId,
      metadataUri: deployment.metadataUri, recipient, amount: '1' as const, approvalRef: input?.approvalRef ?? null,
      operationId, operation: 'disabled' as const, feeLimitWei: '0' as const,
      state: 'awaiting_input' as const, archiveMint: structuredClone(deployment.archiveMint),
      pending: deployment.chainId === 1 ? ['budget','signature','production_authorization']
        : ['current_balance_proof','production_authorization'] };
  })).sort((a, b) => a.displayNumber - b.displayNumber || a.chainId - b.chainId);
  if (items.length !== 70 || new Set(items.map(item => `${item.trackId}:${item.chainId}`)).size !== 70) {
    throw new Error('留存目录必须恰为35首×2链且不能重复');
  }
  const header = { runId: options.runId, revision: catalog.revision, sourceSha: options.sourceSha };
  const planHash = digest({ runId: header.runId, revision: header.revision, items: items.map(({ trackId, chainId, contractAddress, tokenId,
    metadataUri, recipient, amount, approvalRef, operationId }) => ({ trackId, chainId, contractAddress,
    tokenId, metadataUri, recipient, amount, approvalRef, operationId })) });
  return { schemaVersion: 2, ...header, scope: '本地只读规划，禁止广播/上传/迁移', feeLimitWei: '0', planHash, items };
}
