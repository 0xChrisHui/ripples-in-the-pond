// P15-H0：只读盘点当前 33 键、旧 26 键永久表与主网全部 Score。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'reviews', 'evidence', 'p15-h', 'h0-permanent-core.json');
const SCORE_NFT = '0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA';
const OLD_MAP_TX = 'NQsgcCSPJjeRzvXHnXNWbUsovDCjkO5xHJBX7Eu_kl8';
const GATEWAYS = ['https://ardrive.net', 'https://arweave.tokyo', 'https://arweave.net'] as const;
const KEY_ORDER = [...'abcdefghijklmnopqrstuvwxyz', 'space', '3', '4', '5', '6', '7', '8'];
const TX_ID_RE = /^[A-Za-z0-9_-]{43}$/;

type Kind = 'json' | 'audio' | 'html';
type GatewayRead = {
  gateway: string; ok: boolean; status?: number; bytes?: number;
  sha256?: string; contentType?: string | null; error?: string;
};
type Quorum = { reads: GatewayRead[]; bytes: Uint8Array };
const resourceCache = new Map<string, Promise<{ txId: string; kind: Kind; gateways: GatewayRead[] }>>();

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function mp3Info(bytes: Buffer) {
  let offset = 0;
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') {
    offset = 10 + ((bytes[6] & 0x7f) << 21) + ((bytes[7] & 0x7f) << 14)
      + ((bytes[8] & 0x7f) << 7) + (bytes[9] & 0x7f);
  }
  let durationMs = 0;
  let frames = 0;
  const sampleRates = new Set<number>();
  const channelCounts = new Set<number>();
  while (offset + 4 <= bytes.length) {
    const header = bytes.readUInt32BE(offset);
    if (((header & 0xffe00000) >>> 0) !== 0xffe00000) { offset++; continue; }
    const versionBits = (header >>> 19) & 3;
    const layerBits = (header >>> 17) & 3;
    const bitrateIndex = (header >>> 12) & 15;
    const sampleIndex = (header >>> 10) & 3;
    const padding = (header >>> 9) & 1;
    if (versionBits === 1 || layerBits !== 1 || !bitrateIndex || bitrateIndex === 15 || sampleIndex === 3) {
      offset++; continue;
    }
    const mpeg1 = versionBits === 3;
    const sampleRate = [44100, 48000, 32000][sampleIndex] / (mpeg1 ? 1 : versionBits === 2 ? 2 : 4);
    const ratesKbps = mpeg1
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const frameBytes = Math.floor((mpeg1 ? 144 : 72) * ratesKbps[bitrateIndex] * 1000 / sampleRate) + padding;
    if (frameBytes < 4 || offset + frameBytes > bytes.length) break;
    durationMs += (mpeg1 ? 1152 : 576) / sampleRate * 1000;
    sampleRates.add(sampleRate);
    channelCounts.add(((header >>> 6) & 3) === 3 ? 1 : 2);
    frames++;
    offset += frameBytes;
  }
  if (!frames) throw new Error('MP3 中没有可解析帧');
  return { codec: 'MPEG Layer III', frames, durationMs: Math.round(durationMs), sampleRates: [...sampleRates], channelCounts: [...channelCounts] };
}

async function readGateway(txId: string, gateway: string): Promise<{ summary: GatewayRead; body?: Uint8Array }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${gateway}/${txId}`, { signal: controller.signal });
    if (!response.ok) return { summary: { gateway, ok: false, status: response.status } };
    const body = new Uint8Array(await response.arrayBuffer());
    return { summary: { gateway, ok: true, status: response.status, bytes: body.byteLength, sha256: sha256(body), contentType: response.headers.get('content-type') }, body };
  } catch (error) {
    return { summary: { gateway, ok: false, error: error instanceof Error ? error.message : String(error) } };
  } finally { clearTimeout(timer); }
}

function mimeMatches(kind: Kind, value: string | null | undefined): boolean {
  const mime = value?.split(';')[0].trim().toLowerCase();
  if (kind === 'audio') return mime === 'audio/mpeg';
  if (kind === 'html') return mime === 'text/html';
  return mime === 'application/json';
}

async function readQuorum(txId: string, kind: Kind): Promise<Quorum> {
  if (!TX_ID_RE.test(txId)) throw new Error(`非法 txid：${txId}`);
  const results = await Promise.all(GATEWAYS.map((gateway) => readGateway(txId, gateway)));
  const successful = results.filter((result) => result.summary.ok && result.body);
  const identities = new Set(successful.map(({ summary }) => `${summary.bytes}:${summary.sha256}`));
  if (successful.length < 2 || identities.size !== 1) throw new Error(`${txId} 未达到 2 网关同字节 quorum`);
  if (successful.filter(({ summary }) => mimeMatches(kind, summary.contentType)).length < 2) {
    throw new Error(`${txId} 的 ${kind} MIME 未达到 2 网关 quorum`);
  }
  return { reads: results.map(({ summary }) => summary), bytes: successful[0].body! };
}

async function resource(txId: string, kind: Kind) {
  const key = `${kind}:${txId}`;
  if (!resourceCache.has(key)) {
    resourceCache.set(key, readQuorum(txId, kind).then(({ reads }) => ({ txId, kind, gateways: reads })));
  }
  return resourceCache.get(key)!;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() { while (cursor < items.length) { const index = cursor++; results[index] = await run(items[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function parseAnimationUrl(animationUrl: string) {
  const url = new URL(animationUrl);
  const names = ['events', 'base', 'sounds'] as const;
  for (const name of names) if (url.searchParams.getAll(name).length !== 1) throw new Error(`${name} 参数必须唯一`);
  if (url.searchParams.has('package')) throw new Error('legacy URL 不得混用 package');
  const ref = (name: typeof names[number]) => url.searchParams.get(name)!.replace(/^ar:\/\//, '');
  const refs = { decoderTxId: url.pathname.split('/').filter(Boolean).at(-1)!, eventsTxId: ref('events'), baseTxId: ref('base'), soundsTxId: ref('sounds') };
  if (Object.values(refs).some((txId) => !TX_ID_RE.test(txId))) throw new Error('animation_url 含非法 txid');
  return refs;
}

async function main() {
  const files = readdirSync(join(ROOT, 'public', 'sounds')).filter((name) => name.endsWith('.mp3'));
  const current = KEY_ORDER.map((key) => {
    const bytes = readFileSync(join(ROOT, 'public', 'sounds', `${key}.mp3`));
    return { key, bytes: bytes.length, sha256: sha256(bytes), mime: 'audio/mpeg', ...mp3Info(bytes) };
  });
  if (files.length !== 33 || current.length !== 33) throw new Error(`当前声音文件不是 33 个：${files.length}`);

  const oldIndex = JSON.parse(readFileSync(join(ROOT, 'data', 'sounds-ar-map.json'), 'utf8')) as Record<string, { txId: string }>;
  const oldMap = await readQuorum(OLD_MAP_TX, 'json');
  const oldMapJson = JSON.parse(Buffer.from(oldMap.bytes).toString('utf8')) as { sounds: Record<string, { txId: string }> };
  const oldEntries = await mapLimit([...'abcdefghijklmnopqrstuvwxyz'], 3, async (key) => {
    if (oldMapJson.sounds[key]?.txId !== oldIndex[key]?.txId) throw new Error(`旧表 ${key} 与仓库索引不一致`);
    return { key, txId: oldIndex[key].txId, gateways: (await resource(oldIndex[key].txId, 'audio')).gateways };
  });

  const instances = await (await fetch(`https://optimism.blockscout.com/api/v2/tokens/${SCORE_NFT}/instances`)).json() as { items?: Array<{ id: string }>; next_page_params?: unknown };
  if (!instances.items?.length || instances.next_page_params) throw new Error('Blockscout Token 枚举为空或需要分页');
  const tokenIds = instances.items.map(({ id }) => BigInt(id)).sort((a, b) => Number(a - b));
  const client = createPublicClient({ chain: optimism, transport: http('https://mainnet.optimism.io') });
  const abi = parseAbi(['function tokenURI(uint256 tokenId) view returns (string)']);
  const scores = await mapLimit(tokenIds, 1, async (tokenId) => {
    const tokenUri = await client.readContract({ address: SCORE_NFT, abi, functionName: 'tokenURI', args: [tokenId] });
    if (!tokenUri) return { tokenId: tokenId.toString(), tokenUri, lifecycle: 'minted_without_uri' as const };
    const metadataTxId = tokenUri.replace(/^ar:\/\//, '');
    const metadataRead = await readQuorum(metadataTxId, 'json');
    const metadata = JSON.parse(Buffer.from(metadataRead.bytes).toString('utf8')) as { animation_url: string };
    const refs = parseAnimationUrl(metadata.animation_url);
    const eventsRead = await readQuorum(refs.eventsTxId, 'json');
    const events = JSON.parse(Buffer.from(eventsRead.bytes).toString('utf8')) as Array<{ key: string; time: number; duration?: number }>;
    const dependencies = await Promise.all([resource(refs.baseTxId, 'audio'), resource(refs.soundsTxId, 'json'), resource(refs.decoderTxId, 'html')]);
    return { tokenId: tokenId.toString(), tokenUri, lifecycle: 'ready' as const, metadataTxId, metadataGateways: metadataRead.reads, refs, eventsGateways: eventsRead.reads, dependencies, eventCount: events.length, usedKeys: [...new Set(events.map(({ key }) => key))].sort(), spaceEvents: events.filter(({ key }) => key === 'space') };
  });

  mkdirSync(join(ROOT, 'reviews', 'evidence', 'p15-h'), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify({ schema: 'p15-h0.permanent-core.v2', generatedAt: new Date().toISOString(), git: { head: git('rev-parse', 'HEAD'), soundSetCommit: git('rev-parse', 'f7c507b') }, scoreNft: { chainId: 10, contract: SCORE_NFT, tokenIds: tokenIds.map(String) }, currentSoundSet: current, legacySoundSet: { mapTxId: OLD_MAP_TX, mapGateways: oldMap.reads, entries: oldEntries }, scores }, null, 2)}\n`);
  console.log(`✅ H0 永久核心证据：${OUTPUT}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
