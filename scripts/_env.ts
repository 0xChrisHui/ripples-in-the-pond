// 共享环境变量加载器 —— side-effect import
// 用法：每个 scripts/ 下的 .ts 文件顶部加 `import './_env';`
//
// 为什么需要：tsx 不像 Next.js 会自动读 .env.local，所以脚本跑的时候
// process.env.TURBO_WALLET_PATH 这类是空的。这个 helper 原生 fs 解析，
// 不依赖 dotenv，不进 STACK.md。只在本地脚本用，不会被 Next.js bundle。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const selectedEnv = process.env.RIPPLES_ENV_FILE ?? '.env.local';
const envPath = join(process.cwd(), selectedEnv);

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // 去首尾引号（支持 KEY="value" 和 KEY='value'）
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // 不覆盖已设置的变量（允许命令行 export 覆盖文件）
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}
