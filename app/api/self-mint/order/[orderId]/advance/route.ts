import { after } from 'next/server';
import { authenticateRequest } from '@/src/lib/auth/middleware';
import { supabaseAdmin } from '@/src/lib/supabase';
import { runSelfMintAssetOrder } from '@/src/lib/self-mint/asset-job';
import { reconcileSelfMintOrder } from '@/src/lib/self-mint/server/reconcile-job';

const ORDER_ID = /^0x[0-9a-f]{64}$/;
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: '未登录' }, { status: 401 });
  const { orderId } = await params;
  if (!ORDER_ID.test(orderId)) return Response.json({ error: '订单编号无效' }, { status: 400 });
  const { data } = await supabaseAdmin.from('score_self_mint_orders')
    .select('status, send_attempted_at').eq('order_id', orderId).eq('user_id', auth.userId).maybeSingle();
  if (!data) return Response.json({ error: '订单不存在' }, { status: 404 });
  if (data.status === 'preparing_assets') {
    after(async () => {
      try { await runSelfMintAssetOrder(orderId); }
      catch (caught) { console.error('[self-mint-assets]', caught); }
    });
    return Response.json({ accepted: true, stage: 'assets' }, { status: 202 });
  }
  const canReconcile = ['submitted', 'confirming'].includes(data.status)
    || (data.status === 'manual_review' && data.send_attempted_at !== null);
  if (!canReconcile) return Response.json({ accepted: false, status: data.status });
  after(async () => {
    try { await reconcileSelfMintOrder(orderId, auth.userId); }
    catch (caught) { console.error('[self-mint-reconcile]', caught); }
  });
  return Response.json({ accepted: true, stage: 'reconcile' }, { status: 202 });
}
