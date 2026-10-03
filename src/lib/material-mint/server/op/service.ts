import 'server-only';
import { materialOwner } from '../access';
import { MaterialError, materialErrorResponse } from '../policy';
import { materialRate } from '../rate';
import { supabaseAdmin } from '../../../supabase';
import { resolveMaterialRecipient } from '../../../runtime/material-recipient';
import { requireOpSbtTarget, opSbtRequestKey } from '../../op/target';

/** 新SBT独立幂等身份，沿用串行mint_queue；旧请求与旧藏品不迁移。 */
export async function opSbtRequest(request: Request, readOnly = false) {
  try {
    const trackId = readOnly ? new URL(request.url).searchParams.get('trackId') : (await request.json()).trackId;
    if (typeof trackId !== 'string') throw new MaterialError('曲目不存在', 'INVALID_TRACK', 400);
    let target;
    try { target = requireOpSbtTarget(trackId, process.env.OP_ORIGINAL_SBT_MINT_MODE,
      process.env.MATERIAL_OP_SBT_QUEUE_READY === '1' && process.env.MATERIAL_OP_RECIPIENT_SNAPSHOT_READY === '1'); }
    catch (error) { throw new MaterialError('OP原曲收藏暂不可用，旧藏品保留',
      error instanceof Error ? error.message : 'OP_SBT_DISABLED', 503); }
    const auth = await materialOwner(request);
    await materialRate(auth.userId, readOnly ? 'read' : 'prepare');
    const recipient = resolveMaterialRecipient(null, auth.evmAddress);
    const key = opSbtRequestKey(auth.userId, target.contractAddress, target.tokenId);
    if (!readOnly) {
      const queued = await supabaseAdmin.rpc('prepare_op_sbt_job', { p_user_id: auth.userId, p_key: key,
        p_token_id: Number(target.tokenId), p_contract: target.contractAddress.toLowerCase(), p_recipient: recipient.toLowerCase() });
      if (queued.error) throw new MaterialError('OP新SBT队列尚待数据库验证或状态已变化', 'OP_SBT_QUEUE_PENDING', 503);
    }
    const { data, error } = await supabaseAdmin.from('mint_queue').select('id,status,tx_hash,failure_kind,recipient_address,material_contract_address')
      .eq('user_id', auth.userId).eq('idempotency_key', key).maybeSingle();
    if (error) throw new MaterialError('OP新SBT队列尚待迁移', 'OP_SBT_QUEUE_PENDING', 503);
    return Response.json({ mintId: data?.id ?? null, status: data?.status ?? null, txHash: data?.tx_hash ?? null,
      recipientAddress: data?.recipient_address ?? recipient, recipientFrozen: Boolean(data?.recipient_address),
      contractAddress: data?.material_contract_address ?? target.contractAddress, chainId: 10, edition: 'sbt',
      needsReview: data?.status === 'failed', alreadyMinted: data?.status === 'success' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return materialErrorResponse(error); }
}
