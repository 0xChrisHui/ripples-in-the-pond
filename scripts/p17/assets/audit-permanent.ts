import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { readPermanentJson, parseOriginalMetadata } from '../../../src/lib/music-catalog/permanent';
import uploaded from '../../../src/lib/music-catalog/data/metadata-source.json';
const root = 'reviews/evidence/parallel-2026-10/20261002-night-01/p17/inventory';
const tracks = [...getMusicCatalog().tracks].sort((a,b) => a.displayNumber-b.displayNumber);
let index = 0;
const results: unknown[] = [];
async function worker() {
  while (index < tracks.length) {
    const track = tracks[index++], uri = track.deployments.find((item) => item.chainId === 10)?.metadataUri;
    const local = readFileSync(`public/tracks/No.${track.displayNumber}.mp3`);
    const base = { trackId: track.trackId, displayNumber: track.displayNumber, audioArUri: track.audioArUri,
      localObservedSha256: createHash('sha256').update(local).digest('hex'), localBytes: local.length };
    try {
      if (!uri) throw new Error('没有冻结 URI');
      const fetched = await readPermanentJson(uri), metadata = parseOriginalMetadata(fetched.json);
      if (metadata.audioArUri !== track.audioArUri || metadata.name !== `Ripples in the Pond — ${track.title}`) throw new Error('永久资料与数据库公开快照不符');
      const observed=createHash('sha256').update(fetched.bytes).digest('hex');
      const original=uploaded.find((item)=>item.tokenId===String(track.displayNumber));
      if(!original || original.uploadedMetadataSha256!==observed) throw new Error('永久metadata字节与已有上传账本hash不符');
      results.push({ ...base, metadataUri: uri, metadataMatch: true,
        metadataObservedSha256: observed, directMetadataUri:`ar://${original.txId}`,uploadedMetadataSha256:original.uploadedMetadataSha256,
        metadata, gateway: fetched.gateway, canonicalAudioHash: null });
    } catch (error) { results.push({ ...base, metadataUri: uri, metadataMatch: false, error: error instanceof Error ? error.message : '读取失败' }); }
  }
}
async function main() {
  await Promise.all([worker(),worker(),worker()]);
  mkdirSync(root, { recursive: true });
  writeFileSync(`${root}/permanent-proof.json`, JSON.stringify({ checkedAt: new Date().toISOString(),
    revision: getMusicCatalog().revision, audioDownloaded: false, results }, null, 2)+'\n');
  console.log(`原曲 metadata 有界核验：${results.length}项，媒体未重复下载，观察hash未冒充canonical`);
}
main().catch((error) => { console.error('原曲核验未完成', error); process.exitCode=1; });
