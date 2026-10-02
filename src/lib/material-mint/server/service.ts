import 'server-only';
import { randomBytes } from 'node:crypto';
import { getAddress, keccak256, stringToHex, hashTypedData } from 'viem';
import { getOriginalDeployment, getMusicCatalog } from '../../music-catalog/asset-registry';
import { supabaseAdmin } from '../../supabase';
import { materialExternalContext, materialOwner, requireMaterialMode } from './access';
import { requireMaterialIssuancePolicy, MaterialError, materialErrorResponse } from './policy';
import { materialRate } from './rate';
import { ownedMaterialOrder, transitionOrder } from './order';
import { publicMaterialOrder, type MaterialOrder } from '../types';
import { signMaterialOrder } from './authorization';

export async function materialRequest(request: Request, action: 'prepare' | 'authorization' | 'attempt' | 'submission') {
  try {
    const body = await request.json() as Record<string, unknown>;
    const context = await materialExternalContext(request, body.walletAddress);
    if (action === 'prepare' || action === 'authorization') {
      requireMaterialMode(context.userId); requireMaterialIssuancePolicy();
    }
    await materialRate(context.userId, action === 'prepare' || action === 'authorization' ? action : 'transition');
    if (action === 'prepare') {
      if (typeof body.trackId !== 'string' || body.chainId !== 1 || typeof body.requestKey !== 'string'
        || body.requestKey.length < 1 || body.requestKey.length > 128) throw new MaterialError('收藏请求无效', 'INVALID_REQUEST', 400);
      const catalog = getMusicCatalog(), deployment = getOriginalDeployment(body.trackId, body.chainId);
      if (!deployment || deployment.status !== 'ready' || !deployment.metadataUri || !deployment.contractAddress || !deployment.tokenId) {
        throw new MaterialError('该发行尚未完成真实部署核验', 'DEPLOYMENT_NOT_READY', 503);
      }
      const snapshot = { order_id: `0x${randomBytes(32).toString('hex')}`, track_id: body.trackId,
        chain_id: body.chainId, contract_address: deployment.contractAddress, token_id: deployment.tokenId,
        recipient_address: context.recipient.toLowerCase(), catalog_revision: catalog.revision,
        metadata_uri: deployment.metadataUri, uri_hash: keccak256(stringToHex(deployment.metadataUri)) };
      const { data, error } = await supabaseAdmin.rpc('prepare_material_order', { p_user_id: context.userId,
        p_request_key: body.requestKey, p_snapshot: snapshot });
      if (error) throw error;
      return Response.json(publicMaterialOrder(data as MaterialOrder), { headers: { 'Cache-Control': 'no-store' } });
    }
    const row = await ownedMaterialOrder(context.userId, body.orderId);
    if (getAddress(row.recipient_address) !== context.recipient) throw new MaterialError('切换了订单接收地址', 'WALLET_CHANGED');
    if (action === 'authorization') {
      if (!['prepared', 'authorized', 'reverted'].includes(row.status)) throw new MaterialError('已有发送等待核对', 'UNSAFE_AUTHORIZATION');
      const voucher = await signMaterialOrder(row), digest = hashTypedData(voucher.typedData);
      const updated = await transitionOrder(row, 'authorize', { digest, deadline: Number(voucher.authorization.deadline), authorizer: voucher.authorizer.toLowerCase() });
      return Response.json({ ...publicMaterialOrder(updated), digest, signature: voucher.signature, authorizer: voucher.authorizer,
        authorization: { ...voucher.authorization, tokenId: String(voucher.authorization.tokenId), amount: '1', deadline: String(voucher.authorization.deadline) } },
      { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!Number.isInteger(body.version) || body.version !== row.version || typeof body.digest !== 'string'
      || !/^0x[0-9a-f]{64}$/.test(body.digest)) throw new MaterialError('订单版本已变化', 'VERSION_CONFLICT');
    const transition = action === 'submission' ? 'submission' : request.method === 'POST' ? 'send'
      : body.outcome === 'rejected' ? 'rejected' : body.outcome === 'unknown' ? 'unknown' : null;
    if (!transition) throw new MaterialError('尝试结果无效', 'INVALID_OUTCOME', 400);
    const updated = await transitionOrder(row, transition, { digest: body.digest, txHash: body.txHash });
    return Response.json(publicMaterialOrder(updated), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return materialErrorResponse(error); }
}
export async function materialOrderGet(request: Request, id: string) {
  try {
    const auth = await materialOwner(request); await materialRate(auth.userId, 'read');
    return Response.json(publicMaterialOrder(await ownedMaterialOrder(auth.userId, id)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return materialErrorResponse(error); }
}
/** 只读本人已有订单，恢复查询不依赖新签发开关，不接受客户端user_id。 */
export async function materialOrdersGet(request: Request) {
  try {
    const auth = await materialOwner(request); await materialRate(auth.userId, 'read');
    const trackId = new URL(request.url).searchParams.get('trackId');
    if (trackId && !getMusicCatalog().tracks.some(track => track.trackId === trackId)) throw new MaterialError('曲目不存在', 'INVALID_TRACK', 400);
    let query = supabaseAdmin.from('material_mint_orders').select('*').eq('user_id', auth.userId);
    if (trackId) query = query.eq('track_id', trackId);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) throw new MaterialError('订单数据库尚未就绪', 'DATABASE_UNAVAILABLE', 503);
    return Response.json({ orders: (data as MaterialOrder[]).map(publicMaterialOrder), limit: 50 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return materialErrorResponse(error); }
}
