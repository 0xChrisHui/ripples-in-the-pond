import 'server-only';
import { getMusicCatalog, getOriginalMintDeployment } from '../../music-catalog/asset-registry';
import { supabaseAdmin } from '../../supabase';
import { materialOwner } from './access';
import { MaterialError, materialErrorResponse } from './policy';
import { materialRate } from './rate';
import { opSbtRequestKey, requireOpSbtTarget } from '../op/target';
import { publicMaterialOrder, type MaterialOrder } from '../types';

type OpRow = { mintId: string; status: string | null; txHash: string | null; recipientAddress: string | null;
  recipientFrozen: boolean; contractAddress: string; chainId: 10; edition: 'sbt'; needsReview: boolean; alreadyMinted: boolean };

/**
 * 一次返回本人全部原曲的铸造状态：OP 收藏记录（按曲目）与以太坊订单列表。
 * 替代逐曲目请求：登录与进入 /lens 时各一次，只消耗一次 read 限流额度。
 * 未收藏的 OP 曲目返回 null（= 已确认未收藏）；OP 未开放的曲目不出现在结果里。
 */
export async function materialStatusBatch(request: Request) {
  try {
    const auth = await materialOwner(request);
    await materialRate(auth.userId, 'read');
    const queueReady = process.env.MATERIAL_OP_SBT_QUEUE_READY === '1' && process.env.MATERIAL_OP_RECIPIENT_SNAPSHOT_READY === '1';
    const op: Record<string, OpRow | null> = {};
    const keyToTrack = new Map<string, string>();
    for (const track of getMusicCatalog().tracks) {
      if (getOriginalMintDeployment(track.trackId, 10)?.status !== 'ready') continue;
      op[track.trackId] = null;
      try {
        const target = requireOpSbtTarget(track.trackId, process.env.OP_ORIGINAL_SBT_MINT_MODE, queueReady);
        keyToTrack.set(opSbtRequestKey(auth.userId, target.contractAddress, target.tokenId), track.trackId);
      } catch { /* 该曲目 OP 当前不可用：保持 null，面板按"未开放"处理 */ }
    }
    if (keyToTrack.size) {
      const { data, error } = await supabaseAdmin.from('mint_queue')
        .select('idempotency_key,id,status,tx_hash,recipient_address,material_contract_address')
        .eq('user_id', auth.userId).in('idempotency_key', [...keyToTrack.keys()]);
      if (error) throw new MaterialError('OP新SBT队列尚待迁移', 'OP_SBT_QUEUE_PENDING', 503);
      for (const row of data ?? []) {
        const trackId = keyToTrack.get(row.idempotency_key as string);
        if (!trackId) continue;
        op[trackId] = { mintId: row.id, status: row.status, txHash: row.tx_hash, recipientAddress: row.recipient_address,
          recipientFrozen: Boolean(row.recipient_address), contractAddress: row.material_contract_address, chainId: 10, edition: 'sbt',
          needsReview: row.status === 'failed', alreadyMinted: row.status === 'success' };
      }
    }
    const { data: orders, error: orderError } = await supabaseAdmin.from('material_mint_orders').select('*')
      .eq('user_id', auth.userId).order('created_at', { ascending: false }).limit(100);
    if (orderError) throw new MaterialError('订单数据库尚未就绪', 'DATABASE_UNAVAILABLE', 503);
    return Response.json({ op, orders: (orders as MaterialOrder[]).map(publicMaterialOrder) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return materialErrorResponse(error); }
}
