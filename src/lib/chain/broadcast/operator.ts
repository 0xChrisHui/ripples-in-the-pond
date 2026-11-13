import 'server-only';
import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { acquireOpLock, heartbeatOpLock, releaseOpLock } from '../operator-lock';
import { publicClient } from '../public-client';
import { notifyOnce } from '../../alerts/once';
import { safeBroadcast, type BroadcastJob, type Marker } from './protocol';

type Address = `0x${string}`;
export async function broadcastOperator(address: Address, job: BroadcastJob, deadline: number, existingHolder?: string) {
  if (deadline - Date.now() < 15_000) return 'blocked';
  const holder = existingHolder ?? `broadcast-${randomUUID()}`;
  if (!existingHolder && !await acquireOpLock(holder)) return 'blocked';
  const redis = Redis.fromEnv();
  const chainId = publicClient.chain.id;
  const key = `op_wallet_last_broadcast:${chainId}:${address.toLowerCase()}`;
  try {
    return await safeBroadcast({
      now: Date.now, renew: () => heartbeatOpLock(holder),
      read: () => redis.get<Marker>(key),
      write: async mark => {
        const ok = await redis.eval(
          "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2]) return 1",
          ['op_wallet_lock', key], [holder, JSON.stringify(mark)],
        );
        if (ok !== 1) throw Error('运营钱包锁已失效');
      },
      confirmed: hash => publicClient.getTransactionReceipt({ hash }).then(() => true, () => false),
      nonceClear: async () => {
        const [pending, latest] = await Promise.all([
          publicClient.getTransactionCount({ address, blockTag: 'pending' }),
          publicClient.getTransactionCount({ address, blockTag: 'latest' }),
        ]);
        return pending === latest;
      },
      wait: (hash, timeout) => publicClient.waitForTransactionReceipt({ hash, timeout, retryCount: 0 }),
      alarm: mark => notifyOnce('operator', 'pending', '运营钱包交易超过 15 分钟未确认', String(mark.hash)).then(() => undefined),
    }, job, deadline);
  } finally {
    if (!existingHolder) await releaseOpLock(holder);
  }
}
