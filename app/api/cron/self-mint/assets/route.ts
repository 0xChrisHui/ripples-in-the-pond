import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { runNextSelfMintAssetJob } from '@/src/lib/self-mint/asset-job';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return Response.json({ error: '无效的 secret' }, { status: 401 });
  try {
    return Response.json({ result: 'ok', ...await runNextSelfMintAssetJob() });
  } catch {
    return Response.json({ error: '资产处理失败' }, { status: 500 });
  }
}
