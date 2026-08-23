// 为 MaterialNFT 生成 1-35 的永久封面与 ERC-1155 metadata，并上传 Arweave。
// 用法：npx tsx scripts/arweave/material/upload-metadata.ts --dry-run
//       npx tsx scripts/arweave/material/upload-metadata.ts

import '../../_env';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { uploadBuffer } from '../../../src/lib/arweave/core';

const DRY_RUN = process.argv.includes('--dry-run');
const OUTPUT_DIR = join(homedir(), 'ripples-mainnet-assets', 'material-mainnet-v1');
const STATE_FILE = join(OUTPUT_DIR, 'upload-state.json');
const TX_RE = /^[a-zA-Z0-9_-]{43}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

type TrackRow = {
  title: string;
  week: number;
  cover: string;
  island: string;
  arweave_url: string;
  published: boolean;
};
type UploadEntry = { txId: string; hash: string };
type UploadState = {
  covers: Record<string, UploadEntry>;
  metadata: Record<string, UploadEntry>;
  manifest?: UploadEntry;
};

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function saveState(state: UploadState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function tokenHex(week: number): string {
  return week.toString(16).padStart(64, '0');
}

function arTxId(url: string): string {
  const match = url.match(/(?:ar:\/\/|arweave\.net\/)([a-zA-Z0-9_-]{43})/);
  if (!match || !TX_RE.test(match[1])) throw new Error(`week 音频地址非法：${url}`);
  return match[1];
}

function coverSvg(track: TrackRow): Buffer {
  if (!COLOR_RE.test(track.cover)) throw new Error(`week ${track.week} 封面色非法：${track.cover}`);
  const phase = track.week % 7;
  const paths = [
    `M-80 ${430 + phase * 7} C180 170 360 760 650 420 S1080 220 1280 470`,
    `M-90 ${610 - phase * 5} C170 860 390 270 670 620 S1080 790 1290 520`,
    `M-60 ${760 + phase * 4} C210 490 420 930 720 650 S1110 440 1270 720`,
    `M-70 ${290 - phase * 3} C230 520 430 80 730 330 S1080 580 1280 250`,
  ];
  const strokes = ['#78d8e8', '#6bbfc4', '#8d84bc', '#d8d2c4'];
  const waves = paths.map((d, i) =>
    `<path d="${d}" fill="none" stroke="${strokes[i]}" stroke-width="5" opacity="${0.36 + i * 0.07}"/>`,
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
<defs><radialGradient id="g" cx="32%" cy="24%" r="90%"><stop stop-color="${track.cover}"/><stop offset="1" stop-color="#06110f"/></radialGradient></defs>
<rect width="1200" height="1200" rx="96" fill="url(#g)"/><g>${waves}</g>
<circle cx="600" cy="600" r="430" fill="none" stroke="#e7e1d5" stroke-opacity=".12" stroke-width="2"/>
<text x="72" y="1080" fill="#eee9df" font-family="Arial,sans-serif" font-size="42" letter-spacing="9">RIPPLES IN THE POND</text>
<text x="1128" y="110" text-anchor="end" fill="#eee9df" font-family="Arial,sans-serif" font-size="64">${String(track.week).padStart(2, '0')}</text>
</svg>`;
  return Buffer.from(svg, 'utf-8');
}

function metadataBuffer(track: TrackRow, coverTxId: string): Buffer {
  const metadata = {
    name: `Ripples in the Pond — ${track.title}`,
    description: `Track ${track.title} from Ripples in the Pond, preserved as a permanent musical material for collaborative scores.`,
    image: `ar://${coverTxId}`,
    animation_url: `ar://${arTxId(track.arweave_url)}`,
    external_url: 'https://pond-ripple.xyz',
    attributes: [
      { trait_type: 'Track', value: track.title },
      { trait_type: 'Week', value: track.week },
      { trait_type: 'Island', value: track.island },
    ],
  };
  return Buffer.from(JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
}

async function uploadOnce(buffer: Buffer, contentType: string, previous?: UploadEntry): Promise<UploadEntry> {
  const hash = sha256(buffer);
  if (previous) {
    if (previous.hash !== hash) throw new Error('已有上传状态与当前内容不一致，请保留证据后换新输出目录');
    return previous;
  }
  const result = await uploadBuffer(buffer, contentType);
  return { txId: result.txId, hash };
}

async function loadTracks(): Promise<TrackRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 Supabase 部署环境变量');
  const { data, error } = await createClient(url, key)
    .from('tracks').select('title,week,cover,island,arweave_url,published').order('week');
  if (error) throw error;
  const tracks = data as TrackRow[];
  if (tracks.length !== 35) throw new Error(`预期 35 首，实际 ${tracks.length}`);
  for (let week = 1; week <= 35; week++) {
    const track = tracks[week - 1];
    if (track.week !== week || track.title !== String(week) || !track.published) {
      throw new Error(`week ${week} 内容冻结检查失败`);
    }
    arTxId(track.arweave_url);
  }
  return tracks;
}

async function main() {
  mkdirSync(join(OUTPUT_DIR, 'covers'), { recursive: true });
  mkdirSync(join(OUTPUT_DIR, 'metadata'), { recursive: true });
  const tracks = await loadTracks();
  const state: UploadState = existsSync(STATE_FILE)
    ? JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as UploadState
    : { covers: {}, metadata: {} };
  let totalBytes = 0;

  for (const track of tracks) {
    const hex = tokenHex(track.week);
    const cover = coverSvg(track);
    writeFileSync(join(OUTPUT_DIR, 'covers', `${hex}.svg`), cover);
    totalBytes += cover.length;
    if (!DRY_RUN) {
      state.covers[String(track.week)] = await uploadOnce(cover, 'image/svg+xml', state.covers[String(track.week)]);
      saveState(state);
    }
    const coverTxId = DRY_RUN ? 'A'.repeat(43) : state.covers[String(track.week)].txId;
    const metadata = metadataBuffer(track, coverTxId);
    writeFileSync(join(OUTPUT_DIR, 'metadata', `${hex}.json`), metadata);
    totalBytes += metadata.length;
    if (!DRY_RUN) {
      state.metadata[String(track.week)] = await uploadOnce(metadata, 'application/json', state.metadata[String(track.week)]);
      saveState(state);
    }
    console.log(`${DRY_RUN ? '校验' : '上传'} ${track.week}/35 ✅`);
  }

  if (DRY_RUN) {
    console.log(`dry-run 通过：35 covers + 35 metadata，${totalBytes} bytes，未上传`);
    return;
  }
  const paths = Object.fromEntries(tracks.map((track) => [
    `${tokenHex(track.week)}.json`, { id: state.metadata[String(track.week)].txId },
  ]));
  const manifest = Buffer.from(JSON.stringify({ manifest: 'arweave/paths', version: '0.2.0', paths }) + '\n');
  state.manifest = await uploadOnce(manifest, 'application/x.arweave-manifest+json', state.manifest);
  saveState(state);
  console.log(`MATERIAL_URI=ar://${state.manifest.txId}/{id}.json`);
}

main().catch((error) => {
  console.error('[material-metadata] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
