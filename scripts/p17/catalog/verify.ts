import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { findOriginalTrackByAsset, getLegacyOriginalDeployment, getMusicCatalog,
  validateMusicCatalog, listReadyOriginals } from '../../../src/lib/music-catalog/asset-registry';
import { buildCatalogAssetId, parseCatalogAssetId, resolveErc1155Uri } from '../../../src/lib/music-catalog/identity';
import { canonicalCatalogContent, catalogRevision } from '../../../src/lib/music-catalog/canonical';
import { originalArchive } from '../../../src/lib/music-catalog/data/known-facts';
const catalog = getMusicCatalog();
assert.deepEqual(validateMusicCatalog(catalog), { valid: true, errors: [] });
assert.deepEqual(JSON.parse(readFileSync('public/music-catalog/catalog.v1.json', 'utf8')), catalog);
assert.equal(catalog.revision, createHash('sha256').update(canonicalCatalogContent(catalog)).digest('hex'));
assert.equal(listReadyOriginals().length, catalog.tracks.flatMap((track)=>track.deployments).filter((deployment)=>deployment.status==='ready').length);
assert.equal(listReadyOriginals().length, 70);
assert.equal(catalog.tracks.filter(track => track.deployments.find(item => item.chainId === 10)
  ?.archiveMint.state === 'confirmed').length, 35, 'OP留存必须来自35项真实证明');
assert.equal(catalog.tracks.filter(track => track.deployments.find(item => item.chainId === 1)
  ?.archiveMint.state === 'confirmed').length, 35, 'ETH必须来自独立的35项真实留存证明');
assert.ok(catalog.tracks.every((track)=>track.deployments.find((item)=>item.chainId===1)?.contractAddress
  === '0x6c731e5faa26e648cad6f86b1c1e741f0aae136b'));
assert.ok(catalog.tracks.every((track)=>track.deployments.find((item)=>item.chainId===10)?.contractAddress
  === '0xa65c9308635c8dd068a314c189e8d77941a7e99c'));
const first=catalog.tracks[0],legacy=getLegacyOriginalDeployment(first.trackId)!;
assert.equal(legacy.archiveMint.state, 'awaiting_input', '新SBT证明不能归给旧OP资产');
assert.equal(originalArchive(first.trackId, 1, first.deployments[0].contractAddress!, '1').state, 'awaiting_input');
assert.equal(originalArchive(first.trackId, 10, legacy.contractAddress!, '1').state, 'awaiting_input');
assert.equal(findOriginalTrackByAsset(10,legacy.contractAddress!,legacy.tokenId!)?.trackId,first.trackId);
assert.equal(findOriginalTrackByAsset(10,first.deployments[0].contractAddress!,first.deployments[0].tokenId!)?.trackId,first.trackId);
assert.equal(catalog.tracks.filter(track => track.notes.status === 'final' && track.notes.text?.trim()).length, 35);
const note = (number: number) => catalog.tracks.find(track => track.displayNumber === number)?.notes.text ?? '';
assert.ok(note(10).includes('\n5.12\n'), '第10首的日期补记不能变成第5首');
assert.ok(note(11).startsWith('第一个和第十一个'), '行内编号之后的第11首正文必须保留');
assert.equal(note(22), '2022年9月2日');
assert.ok(note(31).includes('66问我') && note(31).includes('\n\n'), '第31首的长文与段落不能被拆成其他曲目');
assert.equal(note(35), '完全新的尝试。内在的冲动。是什么让我来到了此刻和这里？');
const address = catalog.collections[0].contractAddress;
for (const standard of ['ERC721', 'ERC1155'] as const) {
  const id = buildCatalogAssetId(10, address, 2n ** 255n, standard);
  assert.equal(parseCatalogAssetId(id).tokenId, String(2n ** 255n));
  assert.equal(parseCatalogAssetId(id).standard, standard);
}
assert.equal(resolveErc1155Uri('ar://manifest/{id}.json', '35'), `ar://manifest/${'23'.padStart(64, '0')}.json`);
for (const mutate of [
  (value: typeof catalog) => { value.tracks[0].deployments[1].status = 'undeployed'; },
  (value: typeof catalog) => { value.tracks[0].deployments[0].standard = 'ERC721' as 'ERC1155'; },
  (value: typeof catalog) => { value.tracks[0].trackId = value.tracks[1].trackId; },
  (value: typeof catalog) => { value.tracks[0].notes = { status: 'absent', text: '伪造' }; },
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
