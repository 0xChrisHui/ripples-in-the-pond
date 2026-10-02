import { mkdirSync, writeFileSync } from 'node:fs';
import { getMusicCatalog, validateMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
const catalog = getMusicCatalog();
const result = validateMusicCatalog(catalog);
if (!result.valid) throw new Error(result.errors.join('\n'));
mkdirSync('public/music-catalog', { recursive: true });
// 生成文件保持每曲一行，目录地址只从注册表读取。
writeFileSync('public/music-catalog/catalog.v1.json', JSON.stringify(catalog) + '\n');
console.log(`C1 schema=1 tracks=${catalog.tracks.length} revision=${catalog.revision}`);
