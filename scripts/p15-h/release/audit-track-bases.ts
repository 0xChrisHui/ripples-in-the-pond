import '../../_env';
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const GATEWAYS = ['https://ardrive.net', 'https://arweave.tokyo', 'https://arweave.net'] as const;
const TX = /^[A-Za-z0-9_-]{43}$/;
const OUTPUT = join(process.cwd(), 'reviews/evidence/p15-h/h7-track-bases.json');

type Track = { id: string; week: number; title: string; arweave_url: string; published: boolean };
type Proof = { gateway: string; ok: boolean; status?: number; bytes?: number; sha256?: string; mime?: string; error?: string };
type AuditedTrack = Track & { arTxId: string; bytes: number; sha256: string; mime: 'audio/mpeg'; gateways: Proof[] };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

function txId(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'arweave.net' || parts.length !== 1
    || parsed.search || parsed.hash || !TX.test(parts[0])) throw new Error(`非法 track arweave_url：${url}`);
  return parts[0];
}

async function read(gateway: string, id: string): Promise<Proof> {
  try {
    const response = await fetch(`${gateway}/${id}`, { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) return { gateway, ok: false, status: response.status };
    const body = Buffer.from(await response.arrayBuffer());
    return {
      gateway, ok: true, status: response.status, bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
      mime: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase(),
    };
  } catch (error) {
    return { gateway, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function audit(track: Track): Promise<AuditedTrack> {
  const arTxId = txId(track.arweave_url);
  const gateways = await Promise.all(GATEWAYS.map((gateway) => read(gateway, arTxId)));
  const groups = new Map<string, Proof[]>();
  for (const proof of gateways.filter((item) => item.ok && item.mime === 'audio/mpeg')) {
    const key = `${proof.bytes}:${proof.sha256}:${proof.mime}`;
    groups.set(key, [...(groups.get(key) ?? []), proof]);
  }
  const quorum = [...groups.values()].find((items) => items.length >= 2)?.[0];
  if (!quorum?.bytes || !quorum.sha256) throw new Error(`Track week ${track.week}: AR 双网关未形成共识`);
  return { ...track, arTxId, bytes: quorum.bytes, sha256: quorum.sha256, mime: 'audio/mpeg', gateways };
}

async function mapLimited<T, R>(values: T[], limit: number, work: (value: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await work(values[index]);
      console.log(`已核验 ${index + 1}/${values.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return result;
}

function save(value: unknown): void {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  const temporary = `${OUTPUT}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, OUTPUT);
}

async function main(): Promise<void> {
  const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [tracksResult, queueResult] = await Promise.all([
    client.from('tracks').select('id,week,title,arweave_url,published').eq('published', true).order('week'),
    client.from('score_nft_queue').select('id,status,token_id').not('status', 'in', '(success,failed)'),
  ]);
  if (tracksResult.error) throw tracksResult.error;
  if (queueResult.error) throw queueResult.error;
  const tracks = (tracksResult.data ?? []) as Track[];
  if (tracks.length !== 35 || tracks.some((track) => !track.arweave_url)) {
    throw new Error(`Production published tracks 必须为完整 35 首；实际 ${tracks.length}`);
  }
  if (queueResult.data?.length) throw new Error(`存在 ${queueResult.data.length} 个活跃旧队列，H7 禁止切换`);
  const audited = await mapLimited(tracks, 3, audit);
  save({
    schema: 'p15-h7.track-bases.v1', generatedAt: new Date().toISOString(),
    environment: 'production', activeQueueCount: 0, trackCount: audited.length, tracks: audited,
  });
  console.log(`H7 35 首 base 双网关审计通过：${OUTPUT}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
