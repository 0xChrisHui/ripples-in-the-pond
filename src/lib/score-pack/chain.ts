import 'server-only';

import { getAddress, type Address, type Hex } from 'viem';
import { getChainPublicClient } from '@/src/lib/chain/multichain/public-client';
import {
  POND_ASSET_ABI, SCORE_OWNER_ABI, SCORE_PACK_OPENER_ABI, type PackChainConfig,
} from './contract';

export async function readScoreOwner(chainId: number, score: Address, tokenId: bigint): Promise<Address | null> {
  try {
    const owner = await getChainPublicClient(chainId).readContract({
      address: score, abi: SCORE_OWNER_ABI, functionName: 'ownerOf', args: [tokenId],
    });
    return getAddress(owner);
  } catch {
    return null; // 未铸造或已销毁
  }
}

export async function readOpened(cfg: PackChainConfig, tokenId: bigint): Promise<boolean> {
  return getChainPublicClient(cfg.chainId).readContract({
    address: cfg.opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'opened', args: [tokenId],
  });
}

export type PackOpenedEvent = {
  txHash: Hex;
  blockNumber: bigint;
  account: Address;
  holder: Address;
  trackTokenId: bigint;
  soundIds: bigint[];
  caller: Address;
};

function deployBlock(chainId: number): bigint {
  const raw = process.env[`NEXT_PUBLIC_P22_DEPLOY_BLOCK_${chainId}`];
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : 0n;
}

/** 按 PackOpened 事件取开包交易（恢复优先走事件，不依赖用户上报的 hash）。 */
export async function readPackOpenedEvent(
  cfg: PackChainConfig, tokenId: bigint,
): Promise<PackOpenedEvent | null> {
  const logs = await getChainPublicClient(cfg.chainId).getContractEvents({
    address: cfg.opener, abi: SCORE_PACK_OPENER_ABI, eventName: 'PackOpened',
    args: { scoreTokenId: tokenId }, fromBlock: deployBlock(cfg.chainId), toBlock: 'latest',
  });
  const log = logs[0];
  if (!log || !log.transactionHash || log.blockNumber == null) return null;
  return {
    txHash: log.transactionHash, blockNumber: log.blockNumber,
    account: getAddress(log.args.account!), holder: getAddress(log.args.holder!),
    trackTokenId: log.args.trackTokenId!, soundIds: [...log.args.soundIds!],
    caller: getAddress(log.args.caller!),
  };
}

export type PackSnapshot = {
  owner: Address | null;
  opened: boolean;
  account: Address;
  accountDeployed: boolean;
  event: PackOpenedEvent | null;
  /** 当前余额：只覆盖 P22 已知素材（balanceOfBatch 无法枚举外来资产） */
  trackBalance: bigint | null;
  soundBalances: { id: bigint; balance: bigint }[];
  readAtBlock: bigint;
};

export async function readPackSnapshot(
  cfg: PackChainConfig, score: Address, tokenId: bigint,
): Promise<PackSnapshot> {
  const client = getChainPublicClient(cfg.chainId);
  const [owner, opened, account, readAtBlock] = await Promise.all([
    readScoreOwner(cfg.chainId, score, tokenId),
    readOpened(cfg, tokenId),
    client.readContract({
      address: cfg.opener, abi: SCORE_PACK_OPENER_ABI, functionName: 'accountOf', args: [tokenId],
    }),
    client.getBlockNumber(),
  ]);
  const tba = getAddress(account);
  const [code, event] = await Promise.all([
    client.getCode({ address: tba }),
    opened ? readPackOpenedEvent(cfg, tokenId) : Promise.resolve(null),
  ]);
  let trackBalance: bigint | null = null;
  let soundBalances: PackSnapshot['soundBalances'] = [];
  if (event) {
    const [tracks, sounds] = await Promise.all([
      client.readContract({
        address: cfg.tracks, abi: POND_ASSET_ABI, functionName: 'balanceOfBatch',
        args: [[tba], [event.trackTokenId]],
      }),
      client.readContract({
        address: cfg.sounds, abi: POND_ASSET_ABI, functionName: 'balanceOfBatch',
        args: [event.soundIds.map(() => tba), event.soundIds],
      }),
    ]);
    trackBalance = tracks[0];
    soundBalances = event.soundIds.map((id, index) => ({ id, balance: sounds[index] }));
  }
  return {
    owner, opened, account: tba, accountDeployed: Boolean(code && code !== '0x'),
    event, trackBalance, soundBalances, readAtBlock,
  };
}
