import assert from 'node:assert/strict';
import test from 'node:test';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { catalogRevision } from '../../../src/lib/music-catalog/canonical';
import { buildMaterialPlaybackRoute } from '../../../src/lib/music-catalog/identity';
import { buildSemiPackage, serializeSemiPackage } from './package';
import { matchesGeneratedContent, validateSemiPackage } from './validate';

test('真实 C2 导出35首OP已验证资料，保留35项ETH未部署与70项归档待定', () => {
  const catalog = getMusicCatalog();
  const output = buildSemiPackage(catalog);
  assert.equal(output.inventory.tracks.length, 35);
  const deployments = output.inventory.tracks.flatMap((track) => track.deployments);
  assert.equal(deployments.length, 70);
  assert.equal(deployments.filter((item) => item.status === 'ready').length, 35);
  assert.equal(deployments.filter((item) => item.status === 'undeployed').length, 35);
  assert.ok(deployments.filter((item) => item.status === 'undeployed').every((item) => item.readyExclusionReasons.length > 0));
  assert.ok(deployments.every((item) => item.archiveMint.state === 'awaiting_input'));
  assert.equal(output.contracts.collections.length, 1);
  assert.equal(output.assets.originals.length, 35);
  assert.ok(deployments.filter((item) => item.assetId).every((item) => item.assetId?.includes('/erc1155:')));
  assert.deepEqual(validateSemiPackage(output, catalog, catalog), []);
});

test('重复生成确定且所有产物包含同 schema/revision', () => {
  const catalog = getMusicCatalog();
  const files = serializeSemiPackage(buildSemiPackage(catalog));
  assert.deepEqual(files, serializeSemiPackage(buildSemiPackage(catalog)));
  const reordered = structuredClone(catalog);
  reordered.tracks.reverse();
  reordered.collections.reverse();
  reordered.tracks.forEach((track) => track.deployments.reverse());
  assert.equal(catalogRevision(reordered), catalog.revision);
  assert.deepEqual(files, serializeSemiPackage(buildSemiPackage(reordered)));
  for (const [name, value] of Object.entries(files)) {
    if (name.endsWith('.json')) {
      const parsed = JSON.parse(value);
      assert.equal(parsed.schemaVersion, catalog.schemaVersion);
      assert.equal(parsed.revision, catalog.revision);
    } else assert.ok(value.includes(catalog.revision));
  }
});

test('Git检出CRLF不构成资料漂移，实际字段变化仍失败', () => {
  const files = serializeSemiPackage(buildSemiPackage(getMusicCatalog()));
  for (const value of Object.values(files)) {
    assert.equal(matchesGeneratedContent(value.replaceAll('\n', '\r\n'), value), true);
    assert.equal(matchesGeneratedContent(`${value}损坏测试输入`, value), false);
  }
});

test('生产包拒绝测试网、伪ready、旧schema和不匹配revision的损坏副本', () => {
  for (const mutate of [
    (copy: ReturnType<typeof getMusicCatalog>) => { copy.tracks[0].deployments[0].chainId = 11155420; },
    (copy: ReturnType<typeof getMusicCatalog>) => { copy.tracks[0].deployments[1].status = 'ready'; },
    (copy: ReturnType<typeof getMusicCatalog>) => { Object.assign(copy, { schemaVersion: 0 }); },
  ]) {
    const copy = getMusicCatalog();
    mutate(copy);
    copy.revision = catalogRevision(copy);
    assert.throws(() => buildSemiPackage(copy));
  }
  const drift = getMusicCatalog();
  drift.tracks[0].title += '损坏测试输入';
  assert.throws(() => buildSemiPackage(drift));
});

test('页面坐标缺项和包被手改可检测', () => {
  const catalog = getMusicCatalog();
  const output = buildSemiPackage(catalog);
  const page = getMusicCatalog();
  page.tracks[0].deployments[0].status = 'undeployed';
  Object.assign(page.tracks[0].deployments[0], {
    contractAddress: null, tokenId: null, metadataUri: null, publicPlaybackUrl: null,
  });
  page.revision = catalogRevision(page);
  assert.ok(validateSemiPackage(output, catalog, page).some((error) => error.includes('坐标')));
  output.inventory.tracks.pop();
  assert.ok(validateSemiPackage(output, catalog, catalog).length > 0);
});

test('相同合约和Token的不同链发行保留独立standard-aware身份', () => {
  // 仅把真实 C1 的损坏/变体副本作为转换测试输入，不用作部署证据。
  const copy = getMusicCatalog();
  const op = copy.tracks[0].deployments[0];
  const eth = copy.tracks[0].deployments[1];
  Object.assign(eth, op, { chainId: 1,
    publicPlaybackUrl: buildMaterialPlaybackRoute(1, op.contractAddress!, op.tokenId!) });
  copy.collections.push({ ...copy.collections[0], chainId: 1 });
  copy.revision = catalogRevision(copy);
  const deployments = buildSemiPackage(copy).inventory.tracks[0].deployments;
  assert.equal(new Set(deployments.map((item) => item.assetId)).size, 2);
});

test('Echo样例仅由同源注册表派生，未完整核验的系列不进入ready', () => {
  const catalog = getMusicCatalog(), output = buildSemiPackage(catalog);
  const source = catalog.collections.find((item) => item.kind === 'echo')!;
  const echo = output.inventory.collections.find((item) => item.kind === 'echo')!;
  assert.equal(echo.sampleStatus, 'provided');
  assert.equal(echo.sampleAssets[0], `eip155:${source.chainId}/erc721:${source.contractAddress}/${source.samples![0].tokenId}`);
  assert.deepEqual(echo.samples, source.samples);
  assert.equal(output.contracts.collections.some((item) => item.kind === 'echo'), false);
});
