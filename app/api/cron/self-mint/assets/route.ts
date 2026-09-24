import { randomUUID } from 'node:crypto';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { supabaseAdmin } from '@/src/lib/supabase';
import { processSelfMintAsset } from '@/src/lib/self-mint/assets';
import type { SelfMintOrderRow } from '@/src/lib/self-mint/order';

function releaseLease() {
  return { locked_by: null, lease_expires_at: null, updated_at: new Date().toISOString() };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return Response.json({ error: '无效的 secret' }, { status: 401 });
  const owner = randomUUID();
  const { data, error } = await supabaseAdmin.rpc('claim_score_self_mint_asset_job', {
    p_owner: owner, p_lease_minutes: 5,
  });
  if (error) return Response.json({ error: '资产任务领取失败' }, { status: 500 });
  const row = (Array.isArray(data) ? data[0] : data) as SelfMintOrderRow | undefined;
  if (!row) return Response.json({ result: 'ok', processed: 0 });

  try {
    const result = await processSelfMintAsset(row, owner);
    const ready = result.kind === 'metadata' && result.verified;
    const saved = await supabaseAdmin.from('score_self_mint_orders').update({
      ...(ready ? { status: 'ready_to_sign' } : {}),
      ...releaseLease(),
    }).eq('id', row.id).eq('locked_by', owner).select('id').maybeSingle();
    if (!saved.data) throw new Error('资产任务 lease 已丢失');
    return Response.json({
      result: 'ok', processed: 1, asset: result.kind,
      status: ready ? 'ready_to_sign' : 'preparing_assets',
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const retryCount = row.retry_count + 1;
    const resultUnknown = message.includes('CRITICAL') || message.includes('结果未知');
    const exhausted = !resultUnknown && retryCount >= 5;
    const manualReview = resultUnknown || exhausted;
    await supabaseAdmin.from('score_self_mint_orders').update({
      status: manualReview ? 'manual_review' : 'preparing_assets',
      failure_stage: 'asset_upload',
      failure_code: resultUnknown ? 'UPLOAD_RESULT_UNKNOWN'
        : exhausted ? 'ASSET_RETRY_EXHAUSTED' : 'ASSET_PREPARE_FAILED',
      retryable: !manualReview,
      retry_count: retryCount,
      last_error: message.slice(0, 2000),
      ...releaseLease(),
    }).eq('id', row.id).eq('locked_by', owner);
    return Response.json({
      error: '资产处理失败', code: manualReview ? 'MANUAL_REVIEW' : 'RETRYABLE',
    }, { status: 500 });
  }
}
