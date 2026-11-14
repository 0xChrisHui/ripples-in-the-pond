import type { ScoreMintQueueRow, ScoreMintStatus } from '../../types/score-mint';

export type ScoreLease = { row: ScoreMintQueueRow; leaseOwner: string };
type StepResult = { result: string; status?: ScoreMintStatus };
type CycleResult = { result: string; queueId: string; status: ScoreMintStatus; steps: number };
type Options = {
  limit: number; concurrency: number; claimUntil: number; deadline: number;
  now?: () => number;
  claim(): Promise<ScoreLease | null>;
  step(job: ScoreLease): Promise<StepResult>;
  reload(job: ScoreLease): Promise<ScoreMintQueueRow | null>;
  release(job: ScoreLease): Promise<void>;
};

// updated_at 会被领取和空转刷新，只有业务事实变化才允许继续。
function progress(row: ScoreMintQueueRow) {
  return JSON.stringify([row.status, row.events_upload_state, row.package_upload_state,
    row.metadata_upload_state, row.events_ar_tx_id, row.package_ar_tx_id,
    row.metadata_ar_tx_id, row.tx_hash, row.uri_tx_hash, row.token_id, row.token_uri]);
}

/** 同一订单始终持租约，完成一步后排到本批队尾；等待不在本轮反复轮询。 */
export async function runScoreCycle(options: Options) {
  const now = options.now ?? Date.now;
  const jobs: ScoreLease[] = [];
  let claimFailed = false;
  for (let i = 0; i < options.limit && now() < options.claimUntil; i++) {
    try {
      const job = await options.claim();
      if (!job) break;
      jobs.push(job);
    } catch (error) {
      console.error('[score-cron] 领取失败', error);
      claimFailed = true;
      break;
    }
  }
  const queue = jobs.map((_, i) => i);
  const steps = jobs.map(() => 0);
  const results: PromiseSettledResult<CycleResult>[] = [];
  async function finish(index: number, result: CycleResult, failure?: unknown) {
    try { await options.release(jobs[index]); }
    catch (error) { failure = failure ? new AggregateError([failure, error], '处理与释放均失败') : error; }
    if (failure) console.error('[score-cron] 连续推进失败', jobs[index].row.id, failure);
    results[index] = failure ? { status: 'rejected', reason: failure } : { status: 'fulfilled', value: result };
  }
  async function worker() {
    while (queue.length) {
      const index = queue.shift()!;
      const job = jobs[index];
      let result = 'yielded';
      let failure: unknown;
      try {
        // 留五秒给已启动工作的落库与释放；不把超时当成可以安全取消上传。
        if (options.deadline - now() >= 5000 && steps[index] < 12) {
          if (job.row.locked_by !== job.leaseOwner || !job.row.lease_expires_at
            || Date.parse(job.row.lease_expires_at) <= now()) throw Error('订单租约已失效');
          const before = progress(job.row);
          const outcome = await options.step(job);
          steps[index]++;
          result = outcome.result;
          if (outcome.result === 'ok' && outcome.status !== 'success' && outcome.status !== 'failed') {
            const fresh = await options.reload(job);
            if (!fresh || fresh.locked_by !== job.leaseOwner || !fresh.lease_expires_at
              || Date.parse(fresh.lease_expires_at) <= now()) throw Error('订单最新状态未能在有效租约下读回');
            job.row = fresh;
            if (progress(fresh) !== before && !['success', 'failed'].includes(fresh.status)) {
              queue.push(index);
              continue;
            }
          } else if (outcome.status) job.row = { ...job.row, status: outcome.status };
        }
      } catch (error) { failure = error; }
      await finish(index, { result, queueId: job.row.id, status: job.row.status, steps: steps[index] }, failure);
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs.length, options.concurrency) }, worker));
  return { results, claimFailed };
}
