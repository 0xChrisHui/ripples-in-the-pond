import { catalogRevision } from './canonical';
import { buildMaterialPlaybackRoute } from './identity';
import { object, arUri, token, address, proof, proofReady, archive } from './validate-fields';
import type { CatalogValidationResult } from './types';

export function validateMusicCatalog(input: unknown): CatalogValidationResult {
  const errors: string[] = [];
  const error = (message: string) => errors.push(message);
  if (!object(input)) return { valid: false, errors: ['目录必须是对象'] };
  if (input.schemaVersion !== 1 || input.environment !== 'production') error('schemaVersion/environment 无效');
  if (typeof input.revision !== 'string' || !/^[0-9a-f]{64}$/.test(input.revision)) error('revision 必须是 SHA-256');
  try { if (input.revision !== catalogRevision(input)) error('revision 与公开内容不一致'); }
  catch { error('目录含不可规范化字段'); }
  const collections = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(input.collections)) error('缺少 collections');
  else for (const row of input.collections) {
    if (!object(row)) { error('系列必须为对象'); continue; }
    if (![1, 10].includes(Number(row.chainId)) || !address(row.contractAddress)) error('系列坐标无效');
    const coordinate = `${row.chainId}/${row.contractAddress}`;
    if (collections.has(coordinate)) error('系列坐标重复');
    collections.set(coordinate, row);
    if (!['original', 'score', 'echo'].includes(String(row.kind)) || !['ERC721', 'ERC1155'].includes(String(row.standard))) error('系列类型/标准无效');
    if (row.metadataMethod !== (row.standard === 'ERC1155' ? 'uri' : 'tokenURI')) error('metadataMethod 与标准不符');
    if (!['audio', 'html_decoder'].includes(String(row.playbackKind)) || typeof row.enabled !== 'boolean') error('系列播放/启用字段无效');
    if (!proof(row.verification)) error('系列验证字段不完整');
    if (row.enabled === true && !proofReady(row.verification)) error('启用系列必须具备真实证明');
    if ('samples' in row) {
      if (!Array.isArray(row.samples)) error('系列样例必须为数组');
      else for(const sample of row.samples) {
        if(!object(sample) || !token(sample.tokenId) || !arUri(sample.metadataUri)
          || typeof sample.publicPlaybackUrl!=='string' || !/^\/(?:echo|score)\/[a-zA-Z0-9/-]+$/.test(sample.publicPlaybackUrl)
          || !proof(sample.verification)) error('系列样例字段无效');
      }
    }
  }
  const ids = new Set<string>(), numbers = new Set<number>(), assets = new Set<string>();
  if (!Array.isArray(input.tracks) || input.tracks.length !== 35) error('正式原曲必须恰好35首');
  if (Array.isArray(input.tracks)) for (const row of input.tracks) {
    if (!object(row)) { error('曲目必须为对象'); continue; }
    if (typeof row.trackId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(row.trackId)) error('trackId 必须沿用真实 UUID');
    if (ids.has(String(row.trackId))) error('trackId 重复'); ids.add(String(row.trackId));
    if (!Number.isSafeInteger(row.displayNumber) || Number(row.displayNumber) < 1 || Number(row.displayNumber) > 35) error('展示编号无效');
    if (numbers.has(Number(row.displayNumber))) error('展示编号重复'); numbers.add(Number(row.displayNumber));
    if (typeof row.title !== 'string' || !row.title.length) error('缺少真实曲名');
    if (row.audioArUri !== null && !arUri(row.audioArUri)) error('永久音频 URI 无效');
    if (!['canonical_hash', 'legacy_verified_source', 'unverified'].includes(String(row.integrityMode))) error('完整性模式无效');
    if (row.audioSha256 !== null && (typeof row.audioSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.audioSha256))) error('音频 hash 无效');
    if (row.integrityMode === 'canonical_hash' && row.audioSha256 === null) error('canonical 需永久承诺 hash');
    if (!object(row.notes) || !['absent', 'draft', 'final'].includes(String(row.notes.status))
      || (row.notes.status === 'absent' ? row.notes.text !== null : typeof row.notes.text !== 'string')) error('手记状态无效');
    if (!Array.isArray(row.deployments) || row.deployments.length !== 2) { error('每曲必须明确 OP/ETH 状态'); continue; }
    const chains = new Set<number>();
    for (const item of row.deployments) {
      if (!object(item)) { error('发行必须为对象'); continue; }
      if (![1, 10].includes(Number(item.chainId)) || chains.has(Number(item.chainId))) error('发行网络无效/重复');
      chains.add(Number(item.chainId));
      if (item.standard !== 'ERC1155' || !['undeployed', 'unverified', 'ready'].includes(String(item.status))) error('原曲发行标准/状态无效');
      if (!proof(item.verification) || !archive(item.archiveMint)) error('发行验证/留存字段不完整');
      if (item.tokenId !== null && !token(item.tokenId)) error('tokenId 无效');
      if (item.metadataUri !== null && !arUri(item.metadataUri)) error('metadata URI 无效');
      if (item.status === 'undeployed') {
        if (item.contractAddress !== null || item.metadataUri !== null || item.publicPlaybackUrl !== null) error('未部署不能伪造链上资料');
      } else {
        if (!address(item.contractAddress) || !token(item.tokenId)) { error('已知发行坐标无效'); continue; }
        const coordinate = `${item.chainId}/${item.contractAddress}/${item.tokenId}`;
        if (assets.has(coordinate)) error('资产坐标重复'); assets.add(coordinate);
        const collection = collections.get(`${item.chainId}/${item.contractAddress}`);
        if (!collection || collection.standard !== item.standard || collection.kind !== 'original') error('发行与系列不一致');
        if (item.publicPlaybackUrl !== buildMaterialPlaybackRoute(Number(item.chainId), String(item.contractAddress), String(item.tokenId))) error('播放路由与坐标不符');
        if (item.status === 'ready' && (!arUri(item.metadataUri) || !arUri(row.audioArUri)
          || !proofReady(item.verification) || collection?.enabled !== true || row.integrityMode === 'unverified')) error('ready 缺真实证明/永久资料');
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
