import '../../_env';
import { createClient } from '@supabase/supabase-js';
import { parseScoreSnapshot, type ScoreSnapshotRow } from '../../../src/data/score/snapshot-contract';

const SNAPSHOT_ENVIRONMENTS = ['development', 'preview', 'production'] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

async function main(): Promise<void> {
  const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [sounds, decoders, core, tracks, pointers, revisions, activeQueue] = await Promise.all([
    client.from('permanent_sound_sets').select('*'),
    client.from('permanent_decoders').select('*'),
    client.from('permanent_core_active').select('*'),
    client.from('tracks').select('id,base_verified_at').eq('published', true),
    client.from('score_playback_snapshot_active').select('*')
      .in('environment', [...SNAPSHOT_ENVIRONMENTS]),
    client.from('score_playback_snapshot_revisions').select('*')
      .in('environment', [...SNAPSHOT_ENVIRONMENTS]),
    client.from('score_nft_queue').select('id').not('status', 'in', '(success,failed)'),
  ]);
  for (const result of [sounds, decoders, core, tracks, pointers, revisions, activeQueue]) {
    if (result.error) throw result.error;
  }
  if (sounds.data?.length !== 1 || decoders.data?.length !== 1 || core.data?.length !== 1) {
    throw new Error('Permanent Core registry/readback 数量错误');
  }
  if (tracks.data?.length !== 35 || tracks.data.some(({ base_verified_at }) => !base_verified_at)) {
    throw new Error('35 首 base 尚未全部 verified');
  }
  if (activeQueue.data?.length) throw new Error('H7 readback 发现活跃旧队列');
  if (pointers.data?.length !== 12 || revisions.data?.length !== 12) {
    throw new Error('三环境四枚历史 snapshot 数量错误');
  }
  for (const pointer of pointers.data) {
    const row = revisions.data.find((candidate) => candidate.token_id === pointer.token_id
      && candidate.environment === pointer.environment && candidate.revision === pointer.revision);
    if (!row) throw new Error(`Score #${pointer.token_id}: active revision 不存在`);
    const parsed = await parseScoreSnapshot(row as ScoreSnapshotRow);
    if (!parsed.manifest.permanentDecoderUrl.includes('?compat=')) {
      throw new Error(`Score #${pointer.token_id}: 未指向兼容播放器`);
    }
    if (pointer.token_id === 2 && !parsed.playbackBootstrap.sounds.space) {
      throw new Error(`Score #2: ${pointer.environment} snapshot 缺少 space`);
    }
  }
  console.log('H7 readback：33 键 Core、35 首 base、三环境各 4 枚 snapshot 全部通过');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
