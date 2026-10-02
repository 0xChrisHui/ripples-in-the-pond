import 'server-only';
import { supabaseAdmin } from '../../supabase';
import { MaterialError } from './policy';
import type { MaterialOrder, MaterialAttempt } from '../types';
const HEX32 = /^0x[0-9a-f]{64}$/;
export function orderId(value: unknown): string {
  if (typeof value !== 'string' || !HEX32.test(value) || /^0x0+$/.test(value)) throw new MaterialError('订单标识无效', 'INVALID_ORDER', 400);
  return value;
}
export async function ownedMaterialOrder(userId: string, value: unknown): Promise<MaterialOrder> {
  const id = orderId(value);
  const { data, error } = await supabaseAdmin.from('material_mint_orders').select('*').eq('order_id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new MaterialError('订单数据库尚未就绪', 'DATABASE_UNAVAILABLE', 503);
  if (!data) throw new MaterialError('订单不存在', 'ORDER_NOT_FOUND', 404);
  return data as MaterialOrder;
}
export async function materialAttempts(id: string): Promise<MaterialAttempt[]> {
  const { data, error } = await supabaseAdmin.from('material_mint_attempts').select('*').eq('order_id', id);
  if (error) throw error;
  return data as MaterialAttempt[];
}
export async function transitionOrder(row: MaterialOrder, action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.rpc('transition_material_order', { p_user_id: row.user_id,
    p_order_id: row.order_id, p_version: row.version, p_action: action, p_payload: payload });
  if (error) throw new MaterialError('订单状态已变化或不允许重复发送，请查询已有订单', 'ORDER_STATE_CONFLICT');
  return data as MaterialOrder;
}
