import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../../../supabase';
import { getChainPublicClient, getRequiredConfirmations } from '../../../chain/multichain/public-client';
import { inspectMaterialOrder } from '../../inspect';
import { materialAttempts } from '../order';
import type { MaterialOrder } from '../../types';
export async function reconcileMaterialMints() {
  const deployment = process.env.ETH_MATERIAL_DEPLOYMENT_BLOCK;
  if (!deployment || !/^\d+$/.test(deployment)) throw new Error('原曲部署区块尚未配置');
  const worker = randomUUID();
  const { data, error } = await supabaseAdmin.rpc('lease_material_orders', { p_worker: worker, p_limit: 10 });
  if (error) throw error;
  const results = [];
  for (const row of data as MaterialOrder[]) {
    try {
      const result = await inspectMaterialOrder(getChainPublicClient(row.chain_id), row, await materialAttempts(row.order_id),
        { fromBlock: BigInt(row.scan_cursor ?? deployment), requiredConfirmations: getRequiredConfirmations(row.chain_id) });
      if (result.state === 'success') {
        const finalized = await supabaseAdmin.rpc('finalize_material_order', { p_order_id: row.order_id,
          p_version: row.version, p_worker: worker, p_proof: result.proof });
        if (finalized.error) throw finalized.error;
      } else {
        const updated = await supabaseAdmin.rpc('defer_material_reconcile', { p_order_id: row.order_id, p_worker: worker,
          p_version: row.version, p_cursor: result.nextCursor, p_state: result.state });
        if (updated.error) throw updated.error;
      }
      results.push({ orderId: row.order_id, state: result.state });
    } catch (error) {
      console.error('[material-reconcile] 本订单保留等待核对', error instanceof Error ? error.name : '未知错误');
      results.push({ orderId: row.order_id, state: 'unknown' });
    }
  }
  return { processed: results.length, results };
}
