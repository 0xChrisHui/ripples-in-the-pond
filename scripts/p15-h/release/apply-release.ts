import '../../_env';
import { readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'reviews/evidence/p15-h/h7-production-release.json');

type BaseTrack = {
  id: string; arTxId: string; sha256: string; bytes: number; mime: 'audio/mpeg';
};
type Snapshot = {
  tokenId: number; queueId: string | null; schemaId: string; originalTokenUri: string;
  metadata: unknown; events: unknown; sounds: unknown; resourceAttestations: unknown;
  compatibility: unknown; contentSha256: string;
};

function json<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

function releaseInputs() {
  const edge = json<{ mode: string; inventoryCount: number; results: Array<{ state: string }> }>(
    'reviews/evidence/p15-h/h4-edge-mirror.json',
  );
  const bases = json<{ activeQueueCount: number; trackCount: number; tracks: BaseTrack[] }>(
    'reviews/evidence/p15-h/h7-track-bases.json',
  );
  const plan = json<{ environment: string; chainId: number; contract: string; snapshots: Snapshot[] }>(
    'reviews/evidence/p15-h/h7-snapshot-plan.json',
  );
  const sounds = json<{ id: string; publicationStatus: string; manifest: {
    arTxId: string; sha256: string; bytes: number; mime: string;
  }; keyOrder: string[] }>('data/sound-sets/current-33.json');
  const decoderFiles = readdirSync(join(ROOT, 'data/score-decoder/v3-publications'));
  const decoders = decoderFiles.map((name) => json<Record<string, unknown>>(
    `data/score-decoder/v3-publications/${name}`,
  )).filter((value) => value.state === 'verified');
  if (edge.mode !== 'execute' || edge.inventoryCount !== 37
    || edge.results.some(({ state }) => !['existing', 'uploaded'].includes(state))) {
    throw new Error('H4 Verified Edge 尚未执行完成');
  }
  if (sounds.publicationStatus !== 'edge-mirrored' || sounds.keyOrder.length !== 33) {
    throw new Error('33 键 SoundSet 尚未完成 Edge readback');
  }
  if (bases.activeQueueCount !== 0 || bases.trackCount !== 35 || bases.tracks.length !== 35) {
    throw new Error('35 首 base 或旧队列 Gate 未通过');
  }
  if (plan.environment !== 'production' || plan.chainId !== 10 || plan.snapshots.length !== 4) {
    throw new Error('H7 snapshot plan 身份无效');
  }
  if (decoders.length !== 1) throw new Error('修正版 decoder verified revision 必须唯一');
  return { bases, plan, sounds, decoder: decoders[0] };
}

async function ensureRegistry(client: SupabaseClient, table: string, id: string, row: Record<string, unknown>) {
  const existing = await client.from(table).select('*').eq('id', id).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) {
    const inserted = await client.from(table).insert(row);
    if (inserted.error) throw inserted.error;
    return;
  }
  for (const [key, value] of Object.entries(row)) {
    if (key !== 'verified_at' && existing.data[key] !== value) {
      throw new Error(`${table}.${id} 已存在但内容身份不一致`);
    }
  }
}

async function applyBases(client: SupabaseClient, tracks: BaseTrack[], verifiedAt: string): Promise<void> {
  const current = await client.from('tracks').select(
    'id,base_ar_tx_id,base_sha256,base_bytes,base_mime,base_verified_at',
  );
  if (current.error) throw current.error;
  const rows = new Map((current.data ?? []).map((row) => [row.id, row]));
  for (const track of tracks) {
    const row = rows.get(track.id);
    if (!row) throw new Error(`Production 缺少 track ${track.id}`);
    const expected = [track.arTxId, track.sha256, track.bytes, track.mime];
    const actual = [row.base_ar_tx_id, row.base_sha256, row.base_bytes, row.base_mime];
    if (row.base_verified_at) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${track.id}: base identity 冲突`);
      continue;
    }
    if (actual.some((value) => value != null)) throw new Error(`${track.id}: base identity 处于部分写入状态`);
    const updated = await client.from('tracks').update({
      base_ar_tx_id: track.arTxId, base_sha256: track.sha256, base_bytes: track.bytes,
      base_mime: track.mime, base_verified_at: verifiedAt,
    }).eq('id', track.id).is('base_verified_at', null).select('id').single();
    if (updated.error) throw updated.error;
  }
}

async function applySnapshots(client: SupabaseClient, input: ReturnType<typeof releaseInputs>) {
  for (const snapshot of input.plan.snapshots) {
    const result = await client.rpc('publish_score_playback_snapshot', {
      p_environment: input.plan.environment, p_chain_id: input.plan.chainId,
      p_contract: input.plan.contract, p_token_id: snapshot.tokenId, p_queue_id: snapshot.queueId,
      p_schema_id: snapshot.schemaId, p_original_token_uri: snapshot.originalTokenUri,
      p_metadata: snapshot.metadata, p_events: snapshot.events, p_sounds: snapshot.sounds,
      p_resource_attestations: snapshot.resourceAttestations,
      p_compatibility: snapshot.compatibility, p_content_sha256: snapshot.contentSha256,
    });
    if (result.error) throw result.error;
  }
}

async function main(): Promise<void> {
  if (process.argv.slice(2).join(' ') !== '--execute --confirm-production-write') {
    throw new Error('用法：--execute --confirm-production-write');
  }
  const input = releaseInputs();
  const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const active = await client.from('score_nft_queue').select('id').not('status', 'in', '(success,failed)');
  if (active.error) throw active.error;
  if (active.data?.length) throw new Error(`存在 ${active.data.length} 个活跃旧队列`);
  const verifiedAt = new Date().toISOString();
  await applyBases(client, input.bases.tracks, verifiedAt);
  await ensureRegistry(client, 'permanent_sound_sets', input.sounds.id, {
    id: input.sounds.id, sounds_map_ar_tx_id: input.sounds.manifest.arTxId,
    sounds_map_sha256: input.sounds.manifest.sha256, sounds_map_bytes: input.sounds.manifest.bytes,
    sounds_map_mime: input.sounds.manifest.mime, key_count: 33, verified_at: verifiedAt,
  });
  const decoderId = `score-decoder-v3-${String(input.decoder.sha256).slice(0, 12)}`;
  await ensureRegistry(client, 'permanent_decoders', decoderId, {
    id: decoderId, ar_tx_id: input.decoder.arTxId, sha256: input.decoder.sha256,
    bytes: input.decoder.bytes, mime: 'text/html', verified_at: verifiedAt,
  });
  await applySnapshots(client, input);
  const pointer = await client.from('permanent_core_active').upsert({
    singleton: true, sound_set_id: input.sounds.id, decoder_id: decoderId, activated_at: verifiedAt,
  }).select('*').single();
  if (pointer.error) throw pointer.error;
  const temporary = `${OUTPUT}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({
    schema: 'p15-h7.production-release.v1', releasedAt: verifiedAt,
    soundSetId: input.sounds.id, decoderId, snapshotTokenIds: [1, 2, 3, 4], trackCount: 35,
  }, null, 2)}\n`);
  renameSync(temporary, OUTPUT);
  console.log('H7 Production registry、35 首 base 与 4 枚 snapshot 已发布');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
