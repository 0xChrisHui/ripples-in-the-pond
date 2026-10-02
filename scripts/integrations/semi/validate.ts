import { getMusicCatalog, validateMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { buildCatalogAssetId } from '../../../src/lib/music-catalog/identity';
import type { MusicCatalog } from '../../../src/lib/music-catalog/types';
import { buildSemiPackage } from './package';
import type { SemiPackage } from './types';

// Git在Windows检出时可转换CRLF；只容忍换行，地址/字段/顺序仍严格相等。
export function matchesGeneratedContent(actual: string, expected: string): boolean {
  return actual.replaceAll('\r\n', '\n') === expected;
}

function pageCoordinates(catalog: MusicCatalog): string[] {
  return catalog.tracks.flatMap((track) => track.deployments
    .filter((item) => item.status !== 'undeployed' && item.contractAddress && item.tokenId)
    .map((item) => JSON.stringify([track.trackId,
      buildCatalogAssetId(item.chainId, item.contractAddress!, item.tokenId!, item.standard),
      item.metadataUri, item.publicPlaybackUrl]))).sort();
}

// 页面公开快照只用于比对，不成为第二份导出数据源。
export function validateSemiPackage(
  output: SemiPackage, catalog: MusicCatalog = getMusicCatalog(), pageCatalog: MusicCatalog = catalog,
): string[] {
  const errors: string[] = [];
  for (const [label, input] of [['注册表', catalog], ['页面公开快照', pageCatalog]] as const) {
    const validation = validateMusicCatalog(input);
    if (!validation.valid) errors.push(`${label}无效：${validation.errors.join('；')}`);
  }
  if (errors.length) return errors;
  if (catalog.schemaVersion !== pageCatalog.schemaVersion || catalog.revision !== pageCatalog.revision) {
    errors.push('页面 schemaVersion/revision 与注册表漂移');
  }
  if (JSON.stringify(pageCoordinates(catalog)) !== JSON.stringify(pageCoordinates(pageCatalog))) {
    errors.push('页面已部署坐标/标准/URI/播放地址集合与注册表不一致');
  }
  const expected = buildSemiPackage(catalog);
  for (const name of ['inventory', 'contracts', 'assets'] as const) {
    if (JSON.stringify(output[name]) !== JSON.stringify(expected[name])) errors.push(`${name} 与唯一注册表派生结果不一致`);
  }
  return errors;
}
