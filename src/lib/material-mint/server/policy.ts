import 'server-only';
import { ETH_MATERIAL_ISSUANCE_POLICY } from '../issuance-policy';
export class MaterialError extends Error {
  constructor(message: string, readonly code: string, readonly status = 409) { super(message); }
}
export function requireMaterialIssuancePolicy() {
  // 规则批准只解除政策依赖，生产off、部署及数据库授权仍分别校验。
  return ETH_MATERIAL_ISSUANCE_POLICY;
}
export function materialErrorResponse(error: unknown) {
  if (error instanceof MaterialError) return Response.json({ error: error.message, code: error.code },
    { status: error.status, headers: { 'Cache-Control': 'no-store', ...(error.status === 429 ? { 'Retry-After': '60' } : {}) } });
  console.error('[material-mint] 请求未完成', error instanceof Error ? error.name : '未知错误');
  return Response.json({ error: '原曲服务暂不可用', code: 'INTERNAL_ERROR' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}
