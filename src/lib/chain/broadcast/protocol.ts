export type Hash = `0x${string}`;
export type Marker = { hash: Hash | null; at: number };
export interface BroadcastJob {
  stamp(): Promise<boolean>;
  send(): Promise<Hash>;
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

// 调用者持有全局锁。先持久化未知标记，进程即使死在广播与保存哈希之间也会挡住下一笔。
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
  if (!ready() || !await s.renew()) return 'blocked';
  // 写标记时原子核对 holder。失锁不能覆盖接管者的标记。
  await s.write({ at, hash: null });
  if (!ready() || !await s.renew()) return 'blocked';
  const hash = await job.send();
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
