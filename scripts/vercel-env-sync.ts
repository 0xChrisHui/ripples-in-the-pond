// vercel-env-sync — 对比 .env.local 与 Vercel env，输出三类差异
// 用法：npm run env-sync
// 前置：VERCEL_TOKEN + VERCEL_PROJECT_ID 加到 .env.local
// A 类（仅本地） + C 类（NEXT_PUBLIC_* 值不一致）→ exit 1（CI fail）
// B 类（仅 Vercel） → 警告，不阻止（Vercel 可能有本地不需要的 staging 变量）

import './_env';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function parseLocalEnv(): Map<string, string> {
  const path = join(ROOT, '.env.local');
  const result = new Map<string, string>();
  if (!existsSync(path)) return result;
  for (const rawLine of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result.set(key, val);
  }
  return result;
}

type VercelEnvEntry = { key: string; value?: string; type: string; target: string[] };

async function main() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    console.error('❌ 缺少 VERCEL_TOKEN 或 VERCEL_PROJECT_ID，请加到 .env.local');
    process.exit(1);
  }

  const localEnv = parseLocalEnv();

  const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`❌ Vercel API ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { envs } = await res.json() as { envs: VercelEnvEntry[] };

  // 去重：同一 key 可能有多条（不同 target），production 优先
  const vercelMap = new Map<string, string>();
  for (const e of envs) {
    const existing = vercelMap.get(e.key);
    if (!existing || e.target.includes('production')) {
      vercelMap.set(e.key, e.value ?? '');
    }
  }

  const localKeys = new Set(localEnv.keys());
  const vercelKeys = new Set(vercelMap.keys());

  const aOnly = [...localKeys].filter(k => !vercelKeys.has(k));
  const bOnly = [...vercelKeys].filter(k => !localKeys.has(k));
  const cMismatch: { key: string; local: string; vercel: string }[] = [];
  for (const key of localKeys) {
    if (!key.startsWith('NEXT_PUBLIC_') || !vercelKeys.has(key)) continue;
    const vercelVal = vercelMap.get(key) ?? '';
    const localVal = localEnv.get(key) ?? '';
    if (vercelVal && localVal !== vercelVal) cMismatch.push({ key, local: localVal, vercel: vercelVal });
  }

  console.log('\n=== Vercel Env Sync ===\n');
  if (aOnly.length === 0 && bOnly.length === 0 && cMismatch.length === 0) {
    console.log('✅ .env.local 与 Vercel env 完全一致'); process.exit(0);
  }
  if (aOnly.length > 0) {
    console.log('🔴 A 类：仅在本地，Vercel 缺少：');
    aOnly.forEach(k => console.log(`  - ${k}`));
  }
  if (bOnly.length > 0) {
    console.log('\n🟡 B 类：仅在 Vercel，本地缺少（或 Vercel 多余）：');
    bOnly.forEach(k => console.log(`  - ${k}`));
  }
  if (cMismatch.length > 0) {
    console.log('\n🔴 C 类：NEXT_PUBLIC_* 值不一致：');
    cMismatch.forEach(({ key, local, vercel }) => {
      console.log(`  ${key}\n    本地:  ${local}\n    Vercel: ${vercel}`);
    });
  }
  const hasError = aOnly.length > 0 || cMismatch.length > 0;
  console.log(hasError ? '\n❌ 存在 A/C 差异，修复后再部署' : '\n⚠️  仅 B 类差异，不阻止部署');
  process.exit(hasError ? 1 : 0);
}

main().catch(e => { console.error('[env-sync] 失败:', e instanceof Error ? e.message : e); process.exit(1); });
