import { getAddress, keccak256, stringToHex, type Hex } from 'viem';
import { getMusicCatalog, getOriginalDeployment } from '../../../lib/music-catalog/asset-registry';
import { sendMaterialVoucher } from './wallet-send';
import { readMaterialHash, rememberMaterialHash, forgetMaterialHash } from './attempt-cache';
import { parseMaterialOrder, parseMaterialVoucher, materialOrderId, assertSameMaterialOrder,
  canSendMaterialOrder, type PublicMaterialOrder } from './order-model';

export type MaterialRequest = (path: string, method: 'GET' | 'POST' | 'PATCH', body?: Record<string, unknown>) => Promise<unknown>;
type Context = { userId: string | null; wallet: Parameters<typeof sendMaterialVoucher>[1] | null;
  request: MaterialRequest; send?: typeof sendMaterialVoucher };
/** 所有恢复先读已有订单；只恢复旧hash，不把unknown变成新钱包请求。 */
export function createMaterialMintClient({ userId, wallet, request, send = sendMaterialVoucher }: Context) {
  const requireWallet = () => {
    if (!userId || !wallet) throw Error('需要已关联的外部接收钱包');
    return getAddress(wallet.address);
  };
  async function getOrder(id: Hex) {
    const order = parseMaterialOrder(await request(`orders/${materialOrderId(id)}`, 'GET'));
    if (order.orderId !== id) throw Error('响应与冻结订单不一致'); return order;
  }
  async function listOrders(trackId?: string) {
    const result = await request(`orders${trackId ? `?trackId=${encodeURIComponent(trackId)}` : ''}`, 'GET');
    if (!result || typeof result !== 'object' || !('orders' in result) || !Array.isArray(result.orders)) throw Error('原曲订单列表响应无效');
    return result.orders.map(parseMaterialOrder);
  }
  async function prepareOrder(trackId: string) {
    const recipient = requireWallet(), deployment = getOriginalDeployment(trackId, 1), catalog = getMusicCatalog();
    if (!deployment || deployment.status !== 'ready' || !deployment.contractAddress || !deployment.tokenId || !deployment.metadataUri) {
      throw Error('Ethereum原曲尚未部署核验，当前未开放收藏');
    }
    const existing = (await listOrders(trackId)).find(o => o.chainId === 1
      && o.contractAddress === getAddress(deployment.contractAddress!) && o.tokenId === deployment.tokenId && o.recipientAddress === recipient);
    if (existing && existing.status !== 'cancelled') return existing;
    const requestKey = keccak256(stringToHex(JSON.stringify([catalog.environment, userId, 1,
      deployment.contractAddress.toLowerCase(), recipient.toLowerCase(), deployment.tokenId])));
    const order = parseMaterialOrder(await request('prepare', 'POST', { trackId, chainId: 1, walletAddress: recipient, requestKey }));
    if (order.trackId !== trackId || order.chainId !== 1 || order.recipientAddress !== recipient
      || order.contractAddress !== getAddress(deployment.contractAddress) || order.tokenId !== deployment.tokenId
      || order.metadataUri !== deployment.metadataUri || order.catalogRevision !== catalog.revision) throw Error('响应与冻结订单不一致');
    return order;
  }
  function identity(order: PublicMaterialOrder) {
    if (order.recipientAddress !== requireWallet()) throw Error('请连接此订单的接收钱包');
    return { userId: userId!, environment: getMusicCatalog().environment, chainId: order.chainId,
      contractAddress: order.contractAddress, recipientAddress: order.recipientAddress, orderId: order.orderId };
  }
  async function restore(order: PublicMaterialOrder, suppliedHash?: Hex) {
    const cache = identity(order), hash = suppliedHash ?? readMaterialHash(cache);
    if (!hash) throw Error('没有可恢复的交易hash，请等待核对');
    if (!order.digest || !['sending', 'unknown', 'submitted', 'confirming', 'success'].includes(order.status)) throw Error('已有交易需等待核对');
    const result = parseMaterialOrder(await request('submission', 'POST', { orderId: order.orderId,
      walletAddress: cache.recipientAddress, digest: order.digest, version: order.version, txHash: hash }));
    assertSameMaterialOrder(order, result);
    if (!['submitted', 'confirming', 'success'].includes(result.status)) throw Error('交易登记尚待核对');
    forgetMaterialHash(cache); return hash;
  }
  async function recoverOrder(id: Hex, hash?: Hex) {
    if (hash) materialOrderId(hash);
    return restore(await getOrder(id), hash);
  }
  async function sendOrder(id: Hex) {
    const order = await getOrder(id), cache = identity(order);
    // 不先续签：unknown禁止authorization，但仍可以登记已经收到的hash。
    if (readMaterialHash(cache)) return restore(order);
    if (!canSendMaterialOrder(order)) throw Error('已有交易等待核对，不能再次发送');
    const body = await request('authorization', 'POST', { orderId: id, walletAddress: cache.recipientAddress });
    const authorized = parseMaterialOrder(body); assertSameMaterialOrder(order, authorized);
    const voucher = parseMaterialVoucher(body);
    if (authorized.status !== 'authorized' || authorized.version !== order.version + 1) throw Error('凭证与冻结订单版本不一致');
    let version = authorized.version;
    // 对账cron每分钟会给sending订单加版本号；用户在钱包里停留越久版本越容易过期。
    // 拒绝结果与hash登记只依赖digest且可安全重复，冲突时重读订单、确认仍是同一笔授权后用最新版本重试。
    async function transition(path: string, method: 'POST' | 'PATCH', extra: Record<string, unknown>) {
      const retryable = method === 'PATCH' || path === 'submission';
      for (let tries = 0; ; tries++) {
        try {
          const next = parseMaterialOrder(await request(path, method, { orderId: id, walletAddress: cache.recipientAddress,
            digest: voucher.digest, version, ...extra }));
          assertSameMaterialOrder(order, next);
          if (next.version !== version + 1) throw Error('订单版本响应无效'); version = next.version; return;
        } catch (error) {
          if (!retryable || tries >= 3) throw error;
          const fresh = await getOrder(id);
          assertSameMaterialOrder(order, fresh);
          if (fresh.digest !== voucher.digest || !['sending', 'unknown', 'submitted', 'confirming'].includes(fresh.status)) throw error;
          version = fresh.version;
        }
      }
    }
    return send(voucher, wallet!, { attempt: () => transition('attempt', 'POST', {}),
      outcome: outcome => transition('attempt', 'PATCH', { outcome }), submission: txHash => transition('submission', 'POST', { txHash }),
      remember: hash => rememberMaterialHash(cache, hash), forget: () => forgetMaterialHash(cache) });
  }
  return { getOrder, listOrders, prepareOrder, sendOrder, recoverOrder };
}
