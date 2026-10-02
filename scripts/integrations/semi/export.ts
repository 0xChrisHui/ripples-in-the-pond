import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getMusicCatalog, type MusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { buildSemiPackage, serializeSemiPackage } from './package';
import { matchesGeneratedContent, validateSemiPackage } from './validate';

export function exportSemiPackage(check = false): void {
  const catalog = getMusicCatalog();
  const page: MusicCatalog = JSON.parse(readFileSync(resolve('public/music-catalog/catalog.v1.json'), 'utf8'));
  const output = buildSemiPackage(catalog);
  const errors = validateSemiPackage(output, catalog, page);
  if (errors.length) throw new Error(errors.join('\n'));
  const files = serializeSemiPackage(output);
  const directory = resolve('docs/integrations/semi');
  if (check) {
    for (const [name, expected] of Object.entries(files)) {
      if (!existsSync(join(directory, name)) || !matchesGeneratedContent(readFileSync(join(directory, name), 'utf8'), expected)) {
        throw new Error(`${name} 缺失、版本过期或与唯一源不一致；未写入任何文件`);
      }
    }
  } else {
    mkdirSync(directory, { recursive: true });
    const stage = join(directory, `.stage-${process.pid}`);
    if (existsSync(stage)) throw new Error('发现未完成的导出暂存目录，先核对现场');
    const previous = new Map<string, Buffer | null>();
    mkdirSync(stage);
    try {
      for (const [name, value] of Object.entries(files)) {
        const destination = join(directory, name);
        previous.set(name, existsSync(destination) ? readFileSync(destination) : null);
        writeFileSync(join(stage, name), value);
      }
      for (const name of Object.keys(files)) renameSync(join(stage, name), join(directory, name));
    } catch (error) {
      // 单文件替换失败时恢复整包旧内容；源注册表从不写入。
      for (const [name, value] of previous) {
        const destination = join(directory, name);
        if (value !== null) writeFileSync(destination, value);
        else if (existsSync(destination)) unlinkSync(destination);
      }
      throw error;
    } finally {
      for (const name of Object.keys(files)) if (existsSync(join(stage, name))) unlinkSync(join(stage, name));
      rmdirSync(stage);
    }
  }
  console.log(`SEMI ${check ? '检查通过' : '导出完成'}：schema=${catalog.schemaVersion} revision=${catalog.revision}，原曲=${output.inventory.tracks.length}，ready=${output.assets.originals.length}`);
}

if (process.argv[1] && /(?:^|[\\/])export\.ts$/.test(process.argv[1])) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('仅支持 --check 参数');
    exportSemiPackage(process.argv.includes('--check'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
