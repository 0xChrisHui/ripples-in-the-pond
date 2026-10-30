import 'server-only';

import { BaseError, ContractFunctionRevertedError, getAddress, parseEventLogs, type Address, type Hex } from 'viem';
import { getChainPublicClient } from '@/src/lib/chain/multichain/public-client';
import {
  POND_ASSET_ABI, SCORE_OWNER_ABI, SCORE_PACK_OPENER_ABI, type PackChainConfig,
} from './contract';

/**
 * 三态：地址 = 当前持有人；null = 合约明确回滚（token 不存在/已销毁）；
 * RPC 超时、节点故障等"读取未知"一律抛出，调用方不得当作"已换手"处理（Codex P1-2）。
 */
export async function readScoreOwner(chainId: number, score: Address, tokenId: bigint): Promise<Address | null> {
  try {
    const owner = await getChainPublicClient(chainId).readContract({
      address: score, abi: SCORE_OWNER_ABI, functionName: 'ownerOf', args: [tokenId],
    });
    return getAddress(owner);
  } catch (error) {
    if (error instanceof BaseError && error.walk((cause) => cause instanceof ContractFunctionRevertedError)) return null;
    throw error;
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

/**
 * 取 PackOpened 事件。优先用已知交易哈希读回执（任何 RPC 套餐都能用）；
 * 没有哈希时才扫日志——免费档 RPC 的 eth_getLogs 只允许约 10 个区块范围，会报错，此时返回 null 而不是抛出。
 */
export async function readPackOpenedEvent(
  cfg: PackChainConfig, tokenId: bigint, txHash?: Hex | null,
): Promise<PackOpenedEvent | null> {
  const client = getChainPublicClient(cfg.chainId);
  type Decoded = { args: { scoreTokenId: bigint; account: Address; holder: Address; trackTokenId: bigint;
    soundIds: readonly bigint[]; caller: Address }; transactionHash: Hex | null; blockNumber: bigint | null };
  let log: Decoded | undefined;
  if (txHash) {
    // 客户端上报的哈希只是线索：必须是成功回执，且事件来自本链 opener、tokenId 一致（Codex P2-2）
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      if (receipt.status === 'success') {
        log = (parseEventLogs({ abi: SCORE_PACK_OPENER_ABI, eventName: 'PackOpened', logs: receipt.logs }) as
          (Decoded & { address: Address })[])
          .find((item) => item.address.toLowerCase() === cfg.opener.toLowerCase() && item.args.scoreTokenId === tokenId);
      }
    } catch { /* 读不到回执就回落到扫日志 */ }
  }
  if (!log) {
    try {
      const logs = await client.getContractEvents({
        address: cfg.opener, abi: SCORE_PACK_OPENER_ABI, eventName: 'PackOpened',
        args: { scoreTokenId: tokenId }, fromBlock: deployBlock(cfg.chainId), toBlock: 'latest',
      });
      log = logs[0] as unknown as Decoded | undefined;
    } catch {
      return null; // 免费档 RPC 的 getLogs 范围受限
    }
  }
  if (!log || !log.transactionHash || log.blockNumber == null) return null;
  return {
    txHash: log.transactionHash, blockNumber: log.blockNumber,
    account: getAddress(log.args.account), holder: getAddress(log.args.holder),
    trackTokenId: log.args.trackTokenId, soundIds: [...log.args.soundIds], caller: getAddress(log.args.caller),
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
  cfg: PackChainConfig, score: Address, tokenId: bigint, knownTxHash?: Hex | null,
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
    opened ? readPackOpenedEvent(cfg, tokenId, knownTxHash) : Promise.resolve(null),
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
