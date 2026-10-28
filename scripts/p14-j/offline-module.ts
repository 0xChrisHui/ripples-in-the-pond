import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/** 隔离执行实际业务文件；未显式注入的依赖一律拒绝，防止测试加载生产客户端或配置。 */
export function loadOfflineModule<T>(
  filename: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {},
): T {
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports, Error, Buffer, Date, ...globals,
    require: (name: string) => {
      if (!Object.hasOwn(imports, name)) throw new Error(`离线测试拒绝未注入依赖：${name}`);
      return imports[name];
    },
  }, { filename });
  return exports as T;
}
