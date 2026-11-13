import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';
import { sendAlert } from './resend';

export async function notifyOnce(queue: string, kind: string, subject: string, body: string, seconds = 21600) {
  const key = ['alert', process.env.VERCEL_ENV ?? 'local', process.env.NEXT_PUBLIC_CHAIN_ID, queue, kind].join(':');
  const holder = randomUUID();
  const lock = key + ':delivery';
  let redis: Redis | undefined;
  let acquired = false;
  try {
    redis = Redis.fromEnv();
    if (await redis.get(key)) return true;
    acquired = Boolean(await redis.set(lock, holder, { nx: true, ex: 60 }));
    if (!acquired) return true;
    if (await redis.get(key)) return true;
    const ok = await sendAlert({ subject, body });
    if (ok) {
      try { await redis.set(key, 'sent', { ex: seconds }); }
      catch { console.error('[alert] 邮件已投递，去重记录写入失败'); }
    }
    return ok;
  } catch {
    return sendAlert({ subject, body });
  } finally {
    if (redis && acquired) await redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
      [lock], [holder],
    ).catch(() => undefined);
  }
}
