import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exposeTrack, type TrackRow } from '../../src/lib/track-contract';
import { canMintMaterial, guardMaterialMint } from '../../src/lib/material-mintability';
import {
  getTrackAudioSources,
  playTrackSources,
} from '../../src/components/player/track-audio';

const TX_ID = 'A'.repeat(43);

function row(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    id: 'track-36', title: '36', week: 36, audio_url: '/forbidden-local.mp3',
    arweave_url: null, cover: '#000', island: 'default', created_at: '2026-09-12',
    published: false, material_mintable: false, ...overrides,
  };
}

async function main() {
  const closed = exposeTrack(row());
  assert.equal(closed.audio_url, '');
  assert.deepEqual(closed.audio_gateway_urls, []);
  assert.deepEqual(getTrackAudioSources(closed), []);
  assert.deepEqual(getTrackAudioSources({
    ...closed,
    audio_gateway_urls: ['https://example.com/not-permanent.mp3'],
  }), []);
  assert.deepEqual(exposeTrack(row({
    arweave_url: `https://arweave.net/${TX_ID}/mutable-child`,
  })).audio_gateway_urls, []);

  const permanent = exposeTrack(row({ arweave_url: `ar://${TX_ID}`, published: true }));
  assert.deepEqual(permanent.audio_gateway_urls, [
    `https://ardrive.net/${TX_ID}`,
    `https://arweave.tokyo/${TX_ID}`,
    `https://arweave.net/${TX_ID}`,
  ]);
  assert.deepEqual(getTrackAudioSources(permanent), permanent.audio_gateway_urls);

  const regular = exposeTrack(row({ week: 35, audio_url: '/tracks/No.35.mp3' }));
  assert.equal(regular.audio_url, '/tracks/No.35.mp3');
  assert.deepEqual(getTrackAudioSources(regular), ['/tracks/No.35.mp3']);
  assert.equal(canMintMaterial(false), false);
  assert.equal(canMintMaterial(undefined), false);
  assert.equal(canMintMaterial(true), true);

  let rejected = 0;
  let writeContractCalls = 0;
  if (await guardMaterialMint(false, async () => { rejected += 1; })) {
    writeContractCalls += 1;
  }
  assert.equal(rejected, 1);
  assert.equal(writeContractCalls, 0);

  const calls: string[] = [];
  const fakeAudio = {
    src: '', load() {}, pause() {},
    async play() {
      calls.push(this.src);
      if (calls.length === 1) throw new Error('首网关失败');
    },
  };
  const selected = await playTrackSources(
    fakeAudio,
    permanent.audio_gateway_urls,
    () => true,
  );
  assert.equal(selected, permanent.audio_gateway_urls[1]);
  assert.deepEqual(calls, permanent.audio_gateway_urls.slice(0, 2));

  const migration = readFileSync(
    resolve('supabase/migrations/phase-14/051_track36_contract.sql'),
    'utf8',
  );
  assert.match(migration, /material_mintable boolean not null default true/i);
  assert.match(migration, /36,[\s\S]*?null,[\s\S]*?false,[\s\S]*?false/);
  assert.doesNotMatch(migration, /[A-Za-z0-9_-]{43}/);
  const worker = readFileSync(
    resolve('app/api/cron/process-mint-queue/steps.ts'),
    'utf8',
  );
  const guardAt = worker.indexOf('const mintable = await guardMaterialMint');
  assert.ok(guardAt > 0 && guardAt < worker.indexOf('mint_attempted_at 戳'));
  assert.ok(guardAt < worker.indexOf('operatorWalletClient.writeContract'));
  console.log('P14-G3 Track #36 数据、铸造边界与网关 fallback：通过');
}

void main();
