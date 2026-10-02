import 'server-only';
import { getAddress } from 'viem';
import { authenticateRequest } from '../../auth/middleware';
import { findLinkedExternalWallet } from '../../auth/privy-server';
import { MaterialError } from './policy';

export async function materialOwner(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) throw new MaterialError('请先登录', 'UNAUTHENTICATED', 401);
  return auth;
}
export async function materialExternalContext(request: Request, walletAddress: unknown) {
  const auth = await materialOwner(request);
  if (auth.authSource !== 'privy' || !auth.privyUserId) throw new MaterialError('需要已关联的链上地址登录', 'EXTERNAL_WALLET_REQUIRED', 403);
  let address: string;
  try { if (typeof walletAddress !== 'string') throw new Error('缺少地址'); address = getAddress(walletAddress); }
  catch { throw new MaterialError('接收钱包地址无效', 'INVALID_WALLET', 400); }
  if (!(await findLinkedExternalWallet(auth.privyUserId, address))) throw new MaterialError('该地址未关联当前登录账号', 'WALLET_NOT_LINKED', 403);
  return { userId: auth.userId, recipient: getAddress(address) };
}
export function requireMaterialMode(userId: string) {
  const mode = process.env.ETH_MATERIAL_SELF_MINT_MODE ?? 'off';
  if (mode === 'live') return;
  if (mode === 'allowlist' && (process.env.ETH_MATERIAL_SELF_MINT_ALLOWLIST ?? '').split(',').map((id) => id.trim()).includes(userId)) return;
  throw new MaterialError('Ethereum 原曲收藏未开放', 'FEATURE_DISABLED', 503);
}
