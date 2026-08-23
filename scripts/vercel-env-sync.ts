// vercel-env-sync — 对比 .env.local 与 Vercel env，输出三类差异
// 用法：npm run env-sync
// 前置：VERCEL_TOKEN + VERCEL_PROJECT_ID 加到 .env.local
// A 类（仅本地） + C 类（NEXT_PUBLIC_* 值不一致）→ exit 1（CI fail）
// B 类（仅 Vercel） → 警告，不阻止（Vercel 可能有本地不需要的 staging 变量）

import './_env';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// 钉进每枚 NFT 的永久 server-only 值：非 NEXT_PUBLIC_ 但三环境必须一致，
// 否则新铸 NFT 指错解码器/音效表。C 类默认只查 NEXT_PUBLIC_*（这两个是盲区，Codex P1）→ 显式纳入白名单。
const CRITICAL_SERVER_ONLY = new Set(['SCORE_DECODER_AR_TX_ID', 'SOUNDS_MAP_AR_TX_ID']);

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

  // 已知限制：limit=100 不分页。超过 100 条 env 时后续变量不参与比对，A/C 类可能漏报。
  // 当前项目 env 变量约 30 条，风险可控；主网部署日若 env 增多应升级为分页循环。
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
  const criticalUncompared: string[] = []; // 关键 server-only 但 Vercel 隐藏了值（加密）→ 无法比对，提示手动读回
  for (const key of localKeys) {
    const comparable = key.startsWith('NEXT_PUBLIC_') || CRITICAL_SERVER_ONLY.has(key);
    if (!comparable || !vercelKeys.has(key)) continue;
    const vercelVal = vercelMap.get(key) ?? '';
    const localVal = localEnv.get(key) ?? '';
    if (!vercelVal) {
      if (CRITICAL_SERVER_ONLY.has(key)) criticalUncompared.push(key);
      continue;
    }
    if (localVal !== vercelVal) cMismatch.push({ key, local: localVal, vercel: vercelVal });
  }

  console.log('\n=== Vercel Env Sync ===\n');
  if (aOnly.length === 0 && bOnly.length === 0 && cMismatch.length === 0 && criticalUncompared.length === 0) {
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
    console.log('\n🔴 C 类：值不一致（NEXT_PUBLIC_* + 关键 server-only）：');
    cMismatch.forEach(({ key, local, vercel }) => {
      console.log(`  ${key}\n    本地:  ${local}\n    Vercel: ${vercel}`);
    });
  }
  if (criticalUncompared.length > 0) {
    console.log('\n🟠 关键 server-only 变量 Vercel 未返回值（加密），无法自动比对，请逐环境手动读回确认：');
    criticalUncompared.forEach(k => console.log(`  - ${k}`));
  }
  const hasError = aOnly.length > 0 || cMismatch.length > 0;
  console.log(hasError ? '\n❌ 存在 A/C 差异，修复后再部署' : '\n⚠️  仅 B 类差异，不阻止部署');
  process.exit(hasError ? 1 : 0);
}

main().catch(e => { console.error('[env-sync] 失败:', e instanceof Error ? e.message : e); process.exit(1); });
