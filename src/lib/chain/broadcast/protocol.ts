export type Hash = `0x${string}`;
export type Marker = { hash: Hash | null; at: number };
export interface BroadcastJob {
  stamp(): Promise<boolean>;
  unstamp(): Promise<void>;
  send(beforeRaw: (hash: Hash) => Promise<void>): Promise<Hash>;
  save(hash: Hash): Promise<void>;
}
export interface BroadcastServices {
  now(): number;
  renew(): Promise<boolean>;
  read(): Promise<Marker | null>;
  write(mark: Marker | null): Promise<void>;
  confirmed(hash: Hash): Promise<boolean>;
  nonceClear(): Promise<boolean>;
  wait(hash: Hash, budget: number): Promise<unknown>;
  alarm(mark: Marker): Promise<void>;
}

// 调用者持有全局锁，发送前先登记签名可推导的哈希；即使进程中断仍可阻止重用 nonce。
export async function safeBroadcast(s: BroadcastServices, job: BroadcastJob, deadline: number) {
  const ready = () => deadline - s.now() >= 15_000;
  if (!ready() || !await s.renew()) return 'blocked';
  const last = await s.read();
  if (last) {
    const age = s.now() - last.at;
    if (last.hash ? !await s.confirmed(last.hash) : age < 180_000) {
      if (age >= 900_000) await s.alarm(last);
      return 'blocked';
    }
  }
  if (!await s.nonceClear() || !ready() || !await s.renew()) return 'blocked';
  if (!await job.stamp()) return 'blocked';
  const at = s.now();
  let reachedWire = false;
  let stopped = false;
  const beforeRaw = async (signedHash: Hash) => {
    if (!ready() || !await s.renew()) {
      stopped = true;
      throw Error('广播前预算或锁已失效');
    }
    // 本地签名已确定交易哈希；即使 RPC 响应丢失，下一轮仍能按同一哈希核对。
    await s.write({ at: s.now(), hash: signedHash });
    if (deadline - s.now() < 3000 || !await s.renew()) {
      stopped = true;
      await s.write(null);
      throw Error('广播前预算或锁已失效');
    }
    reachedWire = true;
  };
  let hash: Hash;
  try {
    if (!ready() || !await s.renew()) {
      await job.unstamp();
      return 'blocked';
    }
    hash = await job.send(beforeRaw);
  } catch (error) {
    if (!reachedWire) {
      await job.unstamp();
      if (stopped) return 'blocked';
    }
    throw error;
  }
  let markerError: unknown;
  try { await s.write({ at, hash }); } catch (error) { markerError = error; }
  try {
    await job.save(hash);
    if (markerError) throw Error(`CRITICAL: 钱包标记写入失败 ${hash}`, { cause: markerError });
  } finally {
    const budget = Math.min(10_000, deadline - s.now() - 3000);
    if (budget > 0) await s.wait(hash, budget).catch(() => undefined);
  }
  return 'sent';
}
