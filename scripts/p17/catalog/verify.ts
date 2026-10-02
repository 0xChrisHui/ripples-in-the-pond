import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getMusicCatalog, validateMusicCatalog, listReadyOriginals } from '../../../src/lib/music-catalog/asset-registry';
import { buildCatalogAssetId, parseCatalogAssetId, resolveErc1155Uri } from '../../../src/lib/music-catalog/identity';
import { canonicalCatalogContent, catalogRevision } from '../../../src/lib/music-catalog/canonical';
const catalog = getMusicCatalog();
assert.deepEqual(validateMusicCatalog(catalog), { valid: true, errors: [] });
assert.deepEqual(JSON.parse(readFileSync('public/music-catalog/catalog.v1.json', 'utf8')), catalog);
assert.equal(catalog.revision, createHash('sha256').update(canonicalCatalogContent(catalog)).digest('hex'));
assert.equal(listReadyOriginals().length, catalog.tracks.flatMap((track)=>track.deployments).filter((deployment)=>deployment.status==='ready').length);
const address = catalog.collections[0].contractAddress;
for (const standard of ['ERC721', 'ERC1155'] as const) {
  const id = buildCatalogAssetId(10, address, 2n ** 255n, standard);
  assert.equal(parseCatalogAssetId(id).tokenId, String(2n ** 255n));
  assert.equal(parseCatalogAssetId(id).standard, standard);
}
assert.equal(resolveErc1155Uri('ar://manifest/{id}.json', '35'), `ar://manifest/${'23'.padStart(64, '0')}.json`);
for (const mutate of [
  (value: typeof catalog) => { value.tracks[0].deployments[1].status = 'ready'; },
  (value: typeof catalog) => { value.tracks[0].deployments[0].standard = 'ERC721' as 'ERC1155'; },
  (value: typeof catalog) => { value.tracks[0].trackId = value.tracks[1].trackId; },
  (value: typeof catalog) => { value.tracks[0].notes.text = '伪造'; },
  (value: typeof catalog) => { value.tracks[0].deployments[0].contractAddress = '0x' + '0'.repeat(40); },
]) {
  const invalid = structuredClone(catalog); mutate(invalid); invalid.revision = catalogRevision(invalid);
  assert.equal(validateMusicCatalog(invalid).valid, false);
}
const later = structuredClone(catalog); later.tracks[0].deployments[0].verification.verifiedAt = '2030-01-01';
assert.equal(catalogRevision(later), catalog.revision);
later.tracks[0].title = '真实语义变化'; assert.notEqual(catalogRevision(later), catalog.revision);
const shuffled = structuredClone(catalog); shuffled.tracks.reverse(); shuffled.collections.reverse();
assert.equal(catalogRevision(shuffled), catalog.revision);
console.log(`PASS C1：35真实ID、70状态、标准身份、大token、拒绝假ready、hash独立向量、生成一致性；${catalog.revision}`);
