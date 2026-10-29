import { authenticateRequest } from '@/src/lib/auth/middleware';
import { supabaseAdmin } from '@/src/lib/supabase';
import { badRequest, packErrorResponse } from '../_shared';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 勾选意图持久化并绑定待铸造作品：关页后 OP 仍会在 Score 铸成时自动开包。 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return Response.json({ error: 'UNAUTHENTICATED', code: 'UNAUTHENTICATED' }, { status: 401 });
    const body = await request.json() as { pendingScoreId?: unknown; wanted?: unknown };
    if (typeof body.pendingScoreId !== 'string' || !UUID.test(body.pendingScoreId)
      || typeof body.wanted !== 'boolean') return badRequest('INVALID_INTENT');
    const { data: owned } = await supabaseAdmin.from('pending_scores').select('id')
      .eq('id', body.pendingScoreId).eq('user_id', auth.userId).maybeSingle();
    if (!owned) return Response.json({ error: 'NOT_FOUND', code: 'NOT_FOUND' }, { status: 404 });
    if (body.wanted) {
      const { error } = await supabaseAdmin.from('score_pack_intents')
        .upsert({ pending_score_id: body.pendingScoreId, user_id: auth.userId }, { onConflict: 'pending_score_id' });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('score_pack_intents')
        .delete().eq('pending_score_id', body.pendingScoreId).eq('user_id', auth.userId);
      if (error) throw error;
    }
    return Response.json({ wanted: body.wanted });
  } catch (error) {
    return packErrorResponse(error);
  }
}
