export function boundedInt(value: string | undefined, fallback: number, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? Math.min(number, maximum) : fallback;
}

export function serialSender() {
  let tail = Promise.resolve();
  return <T>(work: () => Promise<T>) => {
    const result = tail.then(work);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

// 先领满本批，之后再分配工作，快速完成的订单不会在同一批重新领取。
export async function runBatch<T, R>(options: {
  limit: number; concurrency: number; claimUntil: number;
  claim(): Promise<T | null>; process(row: T): Promise<R>;
}) {
  const claimed: T[] = [];
  let claimFailed = false;
  for (let i = 0; i < options.limit && Date.now() < options.claimUntil; i++) {
    try {
      const row = await options.claim();
      if (!row) break;
      claimed.push(row);
    } catch (error) {
      console.error('[score-cron] 领取失败', error);
      claimFailed = true;
      break;
    }
  }
  const results: PromiseSettledResult<R>[] = [];
  let index = 0;
  async function worker() {
    while (index < claimed.length) {
      const i = index++;
      try { results[i] = { status: 'fulfilled', value: await options.process(claimed[i]) }; }
      catch (reason) { results[i] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(claimed.length, options.concurrency) }, worker));
  return { results, claimFailed };
}
