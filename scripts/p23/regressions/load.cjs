const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = createRequire(path.join(process.cwd(), 'package.json'))('typescript');

// 执行真实组件/Hook源码，只替换浏览器、React调度和外部I/O边界。
exports.load = (file, injected, globals = {}) => {
  const source = process.env.P23_REPRO_REF
    ? require('node:child_process').execFileSync('git', ['show', `${process.env.P23_REPRO_REF}:${file}`], { encoding: 'utf8' })
    : fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exported = {};
  vm.runInNewContext(js, { exports: exported, require: name => {
    if (!Object.hasOwn(injected, name)) throw Error(`离线回归拒绝未注入依赖：${name}`);
    return injected[name];
  }, console, ...globals }, { filename: file });
  return exported;
};
