import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { safeMessage } from '@/src/lib/score-pack/redact';
import { runScorePackCycle } from './cycle';

export const runtime = 'nodejs';

/** 独立入口（可在 cron-job.org 单独建任务）；同样的逻辑也嵌在 process-mint-queue 的空闲分支里。 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const result = await runScorePackCycle({ batch: 5 });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[score-pack-cron]', safeMessage(error));
    return Response.json({ code: 'SCORE_PACK_CRON_FAILED' }, { status: 503 });
  }
}
