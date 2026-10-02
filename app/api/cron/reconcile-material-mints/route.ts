import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { reconcileMaterialMints } from '@/src/lib/material-mint/server/reconcile/worker';
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  try { return Response.json(await reconcileMaterialMints(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    console.error('[material-cron] 对账未完成', error instanceof Error ? error.name : '未知错误');
    return Response.json({ code: 'RECONCILE_UNAVAILABLE' }, { status: 503 });
  }
}
