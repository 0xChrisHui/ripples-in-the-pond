import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';

const TOTAL_TRACKS_GOAL = 108;

async function readPublished(): Promise<number> {
  const { count, error } = await supabaseAdmin.from('tracks')
    .select('id', { count: 'exact', head: true }).eq('published', true);
  if (error || count == null) throw new Error(error?.message ?? '缺少已发布作品数');
  return count;
}

async function readMaterialMints(): Promise<number> {
  const { count, error } = await supabaseAdmin.from('mint_events')
    .select('id', { count: 'exact', head: true }).is('score_nft_token_id', null);
  if (error || count == null) throw new Error(error?.message ?? '缺少素材铸造数');
  return count;
}

async function readScoreMints(): Promise<number> {
  const { count, error } = await supabaseAdmin.from('score_nft_queue')
    .select('id', { count: 'exact', head: true }).eq('status', 'success');
  if (error || count == null) throw new Error(error?.message ?? '缺少唱片铸造数');
  return count;
}

async function readParticipants(): Promise<number> {
  const [material, score] = await Promise.all([
    supabaseAdmin.from('mint_events').select('user_id').is('score_nft_token_id', null),
    supabaseAdmin.from('score_nft_queue').select('user_id').eq('status', 'success'),
  ]);
  if (material.error || score.error) throw new Error(material.error?.message ?? score.error?.message);
  const ids = [...(material.data ?? []), ...(score.data ?? [])]
    .map((row) => row.user_id).filter((id): id is string => typeof id === 'string' && id.length > 0);
  return new Set(ids).size;
}

function valueOf<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

/** 公开统计只返回可证实数字；任一局部查询失败时对应值为 null。 */
export async function GET() {
  const [publishedResult, materialResult, scoreResult, participantsResult] = await Promise.allSettled([
    readPublished(), readMaterialMints(), readScoreMints(), readParticipants(),
  ]);
  const publishedTracks = valueOf(publishedResult);
  const materialMints = valueOf(materialResult);
  const scoreMints = valueOf(scoreResult);
  const totalMints = materialMints == null || scoreMints == null
    ? null
    : materialMints + scoreMints;
  const participants = valueOf(participantsResult);
  const progress = publishedTracks == null ? null : Math.round((publishedTracks / TOTAL_TRACKS_GOAL) * 100);
  const errors = [publishedResult, materialResult, scoreResult, participantsResult]
    .filter((result) => result.status === 'rejected').length;
  if (errors > 0) console.error('[artist-stats] partial query failure:', { errors });

  return NextResponse.json({
    publishedTracks,
    totalTracksGoal: TOTAL_TRACKS_GOAL,
    totalMints,
    materialMints,
    scoreMints,
    participants,
    progress,
  });
}
