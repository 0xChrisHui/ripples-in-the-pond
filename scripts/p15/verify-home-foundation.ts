import assert from 'node:assert/strict';
import { buildGlNodes, setupGlSimulation } from '../../src/components/pond-gl-test3/spheres/gl-sim-setup';
import { prewarmAudioUrls } from '../../src/features/home-pond/audio-prewarm';
import {
  HOME_TRACKS_CACHE_KEY,
  cacheHomeTracksResponse,
  deriveTracksDataVersion,
  readHomeTracksSnapshot,
} from '../../src/features/home-pond/tracks-cache';
import { exposeTrack } from '../../src/lib/track-contract';
import type { Track } from '../../src/types/tracks';

const tracks: Track[] = Array.from({ length: 8 }, (_, index) => ({
  id: `track-${index + 1}`,
  title: `${index + 1}`,
  week: index + 1,
  audio_url: `/tracks/${index + 1}.mp3`,
  arweave_url: null,
  audio_gateway_urls: [],
  cover: '#000',
  island: '测试',
  created_at: '2026-01-01T00:00:00.000Z',
  published: true,
}));

function layoutSnapshot(version: string) {
  const built = buildGlNodes(tracks, 'A', version);
  const setup = setupGlSimulation(built.nodes, built.links, built.assignment, 1200, 800, version);
  setup.sim.stop();
  return {
    assignment: [...built.assignment.entries()],
    nodes: built.nodes.map((node) => ({ id: node.id, lw: node.lw, x: node.x, y: node.y })),
    links: built.links.map((link) => ({ source: link.source, target: link.target, correlation: link.correlation })),
    anchors: [...setup.anchors.entries()],
  };
}

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

async function main() {
  assert.deepEqual(layoutSnapshot('data-v1'), layoutSnapshot('data-v1'));
  assert.notDeepEqual(layoutSnapshot('data-v1'), layoutSnapshot('data-v2'));

  const storage = new MemoryStorage();
  const environment = 'https://example.test|10|0xabc';
  const good = cacheHomeTracksResponse({ tracks }, storage, environment, 1_000);
  assert.ok(good);
  const saved = storage.getItem(HOME_TRACKS_CACHE_KEY);
  assert.equal(cacheHomeTracksResponse({ tracks: [] }, storage, environment, 2_000), null);
  assert.equal(cacheHomeTracksResponse({ broken: true }, storage, environment, 2_000), null);
  assert.equal(storage.getItem(HOME_TRACKS_CACHE_KEY), saved);
  const legacyTrack = { ...tracks[0] } as Partial<Track>;
  delete legacyTrack.audio_gateway_urls;
  assert.equal(cacheHomeTracksResponse({ tracks: [legacyTrack] }, storage, environment, 2_000), null);
  assert.equal(storage.getItem(HOME_TRACKS_CACHE_KEY), saved, '旧 Track 合同不得覆盖 LKG');
  const changedGateways = tracks.map((track, index) => index === 0
    ? { ...track, audio_gateway_urls: ['https://gateway.example/changed'] }
    : track);
  assert.notEqual(deriveTracksDataVersion(tracks), deriveTracksDataVersion(changedGateways));

  const txId = 'a'.repeat(43);
  const exposed = exposeTrack({ ...tracks[0], arweave_url: `ar://${txId}` });
  assert.equal(exposed.audio_gateway_urls.length, 3);
  assert.equal(exposed.audio_url, `https://ardrive.net/${txId}`);

  const tamperedStorage = new MemoryStorage();
  const tampered = JSON.parse(saved ?? '{}') as Record<string, unknown>;
  tampered.dataVersion = 'tampered';
  tamperedStorage.setItem(HOME_TRACKS_CACHE_KEY, JSON.stringify(tampered));
  assert.equal(readHomeTracksSnapshot(tamperedStorage, environment, 2_000), null);
  assert.equal(readHomeTracksSnapshot(storage, 'other-environment', 2_000), null);

  let active = 0;
  let maxActive = 0;
  const fetcher: typeof fetch = async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return new Response(new Uint8Array([1, 2, 3]), { status: 206 });
  };
  const completed = await prewarmAudioUrls(tracks.map((track) => track.audio_url), new AbortController().signal, fetcher, 8);
  assert.equal(completed, tracks.length);
  assert.equal(maxActive, 2);

  const abortController = new AbortController();
  let sawAbort = false;
  const abortingFetcher: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      sawAbort = true;
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });
  const aborting = prewarmAudioUrls(['/slow.mp3'], abortController.signal, abortingFetcher);
  abortController.abort();
  await assert.rejects(aborting, { name: 'AbortError' });
  assert.equal(sawAbort, true);
  console.log('P15-B 首页基础验证通过');
}

void main();
