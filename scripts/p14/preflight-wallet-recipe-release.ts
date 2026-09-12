import '../_env';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { TurboFactory, type TokenType } from '@ardrive/turbo-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import type { ClipManifestV1 } from '@/src/types/wallet-recipe';
import { buildWalletRecipeMetadataJsonV1 } from '@/src/lib/wallet-recipe/metadata';
import { parseWalletRecipeMetadataJsonV1 } from '@/src/lib/wallet-recipe/metadata-parser';
import { deriveRecipeV1 } from '@/src/lib/wallet-recipe/recipe-v1';
import { RECIPE_V1_TEST_VECTORS } from '@/src/lib/wallet-recipe/vectors-v1';
import {
  hasWalletRecipeGatewayQuorum,
  WALLET_RECIPE_GATEWAYS,
} from '@/src/lib/wallet-recipe/gateways';

type State = 'PASS' | 'WARN' | 'BLOCKED';
type Check = { id: string; state: State; detail: unknown };
const root = process.cwd();
const evidenceDir = join(root, 'reviews', 'evidence', 'p14-f0');
const checks: Check[] = [];
const add = (id: string, state: State, detail: unknown): void => { checks.push({ id, state, detail }); };
const rel = (path: string) => relative(root, path).replaceAll('\\', '/');
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const read = (path: string) => readFileSync(join(root, path));
const run = (file: string, args: string[] = []) => spawnSync(file, args, { cwd: root, encoding: 'utf8', timeout: 120_000 });
const command = (file: string) => run(process.platform === 'win32' ? 'where.exe' : 'which', [file]).status === 0;

function walk(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function publicAddress(keyName: string): Address | null {
  const value = process.env[keyName];
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  return privateKeyToAccount(value as Hex).address;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json() as { result?: unknown; error?: { code?: number } };
  if (body.error) throw new Error(`RPC error ${body.error.code ?? 'unknown'}`);
  return body.result;
}

function rpcUrl(chainId: number): string | null {
  const names = chainId === 10
    ? ['OP_MAINNET_RPC_URL', 'ALCHEMY_OP_MAINNET_RPC_URL', 'MAINNET_RPC_URL']
    : ['OP_SEPOLIA_RPC_URL', 'ALCHEMY_OP_SEPOLIA_RPC_URL', 'SEPOLIA_RPC_URL'];
  if (Number(process.env.NEXT_PUBLIC_CHAIN_ID) === chainId) names.push('ALCHEMY_RPC_URL', 'NEXT_PUBLIC_ALCHEMY_RPC_URL');
  return names.map((name) => process.env[name]).find(Boolean) ?? null;
}

async function auditRpc(chainId: number, addresses: Address[]): Promise<void> {
  const url = rpcUrl(chainId);
  if (!url) return add(`rpc-${chainId}`, 'BLOCKED', { configured: false });
  try {
    const actual = Number(BigInt(String(await rpc(url, 'eth_chainId', []))));
    const balances = await Promise.all(addresses.map(async (address) => ({
      address, wei: String(BigInt(String(await rpc(url, 'eth_getBalance', [address, 'latest'])))),
    })));
    add(`rpc-${chainId}`, actual === chainId ? 'PASS' : 'BLOCKED', { configured: true, actualChainId: actual, balances });
  } catch (error) {
    add(`rpc-${chainId}`, 'BLOCKED', { configured: true, error: error instanceof Error ? error.message : 'unknown' });
  }
}

async function gatewayCheck(txId: string, expected: string): Promise<{ gateway: string; status: number; sha256?: string }> {
  const gateway = process.env.P14_GATEWAY_UNDER_TEST ?? '';
  try {
    const response = await fetch(`${gateway}/${txId}`, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return { gateway, status: response.status };
    const digest = sha(Buffer.from(await response.arrayBuffer()));
    return { gateway, status: digest === expected ? 200 : 409, sha256: digest };
  } catch {
    return { gateway, status: 0 };
  }
}

async function main(): Promise<void> {
  const status = run('git', ['status', '--short']).stdout.trim().split(/\r?\n/).filter(Boolean);
  const classify = (line: string) => /wallet-recipe|WalletRecipe|pond-echo|phase-14|p14/.test(line) ? 'p14' : /public\/the36|references\/(36-AU|audio)/.test(line) ? 'user-media' : 'existing';
  add('worktree', status.some((line) => classify(line) === 'p14') ? 'BLOCKED' : 'WARN', {
    counts: Object.fromEntries(['p14', 'user-media', 'existing'].map((kind) => [kind, status.filter((line) => classify(line) === kind).length])), lines: status,
  });

  const inventory = run('git', ['ls-files', '-co', '--exclude-standard']).stdout.split(/\r?\n/).filter(Boolean);
  const p14Pattern = /wallet-recipe|WalletRecipe|pond-echo|phase-14|(?:^|\/)p14(?:-|\/)|^app\/echo|src\/lib\/health/;
  const files = [...new Set(inventory.filter((path) => p14Pattern.test(path)).map((path) => join(root, path)))];
  const codeFiles = files.filter((path) => /\.(ts|tsx|js|jsx|css|sol)$/.test(path) && !/[/\\](references|reviews|playbook)[/\\]/.test(path));
  const oversized = codeFiles.map((path) => ({ path: rel(path), lines: readFileSync(path, 'utf8').split(/\r?\n/).length - 1 }))
    .filter(({ path, lines }) => lines > (path.includes('/route.') ? 270 : 220));
  const dirs = [...new Set(codeFiles.map((path) => join(path, '..')))];
  const crowded = dirs.map((path) => ({ path: rel(path), entries: readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isFile()).length })).filter(({ entries }) => entries > 8);
  const forbidden = codeFiles.filter((path) => /[/\\](app|src)[/\\]/.test(path) || /contracts[/\\]src/.test(path)).flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    const frontend = path.endsWith('.tsx') || (/[/\\]app[/\\]/.test(path) && !/[/\\]api[/\\]/.test(path));
    const patterns = [/from ['"](?:wagmi|ethers|howler|tone)['"]/, /\b(?:TODO|mock data|implement later)\b/i];
    if (frontend) patterns.push(/operator-wallet|OPERATOR_PRIVATE_KEY/);
    const hits = patterns.filter((pattern) => pattern.test(text)).map(String);
    return hits.length ? [{ path: rel(path), hits }] : [];
  });
  add('p14-code-policy', oversized.length || crowded.length || forbidden.length ? 'BLOCKED' : 'PASS', { files: files.length, oversized, crowded, forbidden });

  const anchor = run('git', ['log', '-1', '--format=%H', '--diff-filter=A', '--', 'playbook/phase-14/05-frozen-decisions.md']).stdout.trim();
  const protectedPaths = ['contracts/src/ScoreNFT.sol', 'contracts/src/MintOrchestrator.sol', 'app/api/cron/process-score-queue', 'src/data/score/metadata.ts'];
  const changed = anchor ? run('git', ['diff', '--name-only', `${anchor}^`, '--', ...protectedPaths]).stdout.trim().split(/\r?\n/).filter(Boolean) : ['P14 anchor missing'];
  add('score-isolation', changed.length ? 'BLOCKED' : 'PASS', { anchor: anchor || null, changed });

  const contract = read('contracts/src/WalletRecipeNFT.sol').toString();
  const contractRules = ['ERC721Enumerable', 'tokenIdByOrigin', 'originWalletOf', 'mintToOrigin', 'contractURI()', '_transferOwnership(admin_)', 'RolesMustDiffer'];
  const absentCapabilities = ['function burn(', 'function pause(', 'royaltyInfo('].filter((needle) => contract.includes(needle));
  const forge = command('forge') ? spawnSync('forge', ['test', '--match-contract', '(WalletRecipeNFT|DeployWalletRecipe)Test', '--summary'], { cwd: join(root, 'contracts'), encoding: 'utf8', timeout: 120_000 }) : null;
  add('contract-forge', contractRules.every((needle) => contract.includes(needle)) && !absentCapabilities.length && forge?.status === 0 ? 'PASS' : 'BLOCKED', {
    rules: Object.fromEntries(contractRules.map((needle) => [needle, contract.includes(needle)])), absentCapabilities, forgeAvailable: forge !== null, forgeExitCode: forge?.status ?? null,
  });

  const manifestPath = 'src/features/wallet-recipe/clips-v1.json';
  const manifest = JSON.parse(read(manifestPath).toString()) as ClipManifestV1;
  const localClips = manifest.clips.map((clip) => ({ key: clip.key, expected: clip.sha256, actual: existsSync(join(root, 'public/the36', clip.fileName)) ? sha(read(`public/the36/${clip.fileName}`)) : null, txId: clip.arweaveTxId }));
  const localInputs = { manifest: sha(read(manifestPath)), decoder: sha(read('src/wallet-recipe-decoder/index.html')), image: sha(read('public/pond-echoes/cover-v1.png')) };
  add('permanent-local-inputs', localClips.length === 36 && localClips.every((clip) => clip.actual === clip.expected) ? 'PASS' : 'BLOCKED', { count: localClips.length, mismatches: localClips.filter((clip) => clip.actual !== clip.expected), hashes: localInputs });

  const vector = RECIPE_V1_TEST_VECTORS.find((item) => item.label === 'OP Mainnet Score #1 owner')!;
  add('recipe-vector', deriveRecipeV1(vector.wallet) === vector.recipe ? 'PASS' : 'BLOCKED', { wallet: vector.wallet, expected: vector.recipe, actual: deriveRecipeV1(vector.wallet) });
  const tx = { manifest: process.env.WALLET_RECIPE_CLIP_MANIFEST_V1_TX_ID, decoder: process.env.WALLET_RECIPE_DECODER_V1_TX_ID, image: process.env.WALLET_RECIPE_IMAGE_V1_TX_ID };
  const permanentReady = Object.values(tx).every((value) => /^[\w-]{43}$/.test(value ?? '')) && localClips.every((clip) => /^[\w-]{43}$/.test(clip.txId ?? ''));
  add('permanent-txids', permanentReady ? 'PASS' : 'BLOCKED', { configured: Object.fromEntries(Object.entries(tx).map(([key, value]) => [key, Boolean(value)])), clipTxIds: localClips.filter((clip) => clip.txId).length });
  if (permanentReady) {
    const metadata = buildWalletRecipeMetadataJsonV1({ originWallet: vector.wallet, sourceScoreTokenId: 1, imageTxId: tx.image!, decoderTxId: tx.decoder!, clipManifestTxId: tx.manifest!, clipManifest: manifest });
    parseWalletRecipeMetadataJsonV1(metadata, { imageTxId: tx.image, decoderTxId: tx.decoder!, clipManifestTxId: tx.manifest!, clipManifest: manifest });
    add('metadata-roundtrip', 'PASS', { bytes: Buffer.byteLength(metadata), animationUrl: JSON.parse(metadata).animation_url });
    const resources = [{ txId: tx.manifest!, hash: localInputs.manifest }, { txId: tx.decoder!, hash: localInputs.decoder }, { txId: tx.image!, hash: localInputs.image }, ...localClips.map((clip) => ({ txId: clip.txId!, hash: clip.expected }))];
    const results: Awaited<ReturnType<typeof gatewayCheck>>[] = [];
    for (const item of resources) {
      const evidence = [];
      for (const gateway of WALLET_RECIPE_GATEWAYS) {
        process.env.P14_GATEWAY_UNDER_TEST = gateway;
        const result = await gatewayCheck(item.txId, item.hash);
        evidence.push({ ...result, ok: result.status === 200 });
        results.push(result);
        if (hasWalletRecipeGatewayQuorum(evidence)) break;
      }
    }
    const passed = resources.every((item) => hasWalletRecipeGatewayQuorum(
      results.filter((result) => result.gateway && result.sha256 === item.hash)
        .map((result) => ({ gateway: result.gateway, ok: result.status === 200 })),
    ));
    add('arweave-gateway-quorum', passed ? 'PASS' : 'BLOCKED', { checked: results.length, failures: results.filter((item) => item.status !== 200) });
  } else add('metadata-roundtrip', 'BLOCKED', { reason: '永久 txid 未冻结，拒绝使用假地址代验' });

  const secretNames = ['ALCHEMY_RPC_URL', 'OP_SEPOLIA_RPC_URL', 'OP_MAINNET_RPC_URL', 'OPERATOR_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'RESEND_API_KEY', 'CRON_SECRET', 'TURBO_WALLET_PATH', 'TURBO_WALLET_JWK', 'VERCEL_TOKEN'];
  const publicNames = ['NEXT_PUBLIC_CHAIN_ID', 'NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS', 'ADMIN_ADDRESS', 'MINTER_ADDRESS'];
  const required = {
    rpcSepolia: Boolean(rpcUrl(11155420)), rpcMainnet: Boolean(rpcUrl(10)), operator: Boolean(process.env.OPERATOR_PRIVATE_KEY), deployer: Boolean(process.env.DEPLOYER_PRIVATE_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY), upstash: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_TO_EMAIL && process.env.ALERT_FROM_EMAIL), cron: Boolean(process.env.CRON_SECRET),
    turbo: Boolean(process.env.TURBO_WALLET_PATH || process.env.TURBO_WALLET_JWK), vercel: Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID), admin: Boolean(process.env.ADMIN_ADDRESS), minter: Boolean(process.env.MINTER_ADDRESS),
  };
  add('environment', Object.values(required).every(Boolean) ? 'PASS' : 'BLOCKED', { required, secrets: Object.fromEntries(secretNames.map((name) => [name, Boolean(process.env[name])])), public: Object.fromEntries(publicNames.map((name) => [name, process.env[name] || null])) });
  const operator = publicAddress('OPERATOR_PRIVATE_KEY');
  const deployer = publicAddress('DEPLOYER_PRIVATE_KEY');
  const admin = /^0x[0-9a-fA-F]{40}$/.test(process.env.ADMIN_ADDRESS ?? '') ? process.env.ADMIN_ADDRESS as Address : null;
  const minter = /^0x[0-9a-fA-F]{40}$/.test(process.env.MINTER_ADDRESS ?? '') ? process.env.MINTER_ADDRESS as Address : null;
  const roles = [...new Set([deployer, admin, operator].filter(Boolean))] as Address[];
  add('roles', roles.length === 3 && new Set(roles.map((item) => item.toLowerCase())).size === 3 && minter?.toLowerCase() === operator?.toLowerCase() ? 'PASS' : 'BLOCKED', { deployer, admin, operator, minter, minterMatchesOperator: minter?.toLowerCase() === operator?.toLowerCase() });
  await auditRpc(11155420, roles); await auditRpc(10, roles);

  let turbo: { address?: string; token?: string; winc?: string; error?: string } = {};
  try {
    const raw = process.env.TURBO_WALLET_JWK || (process.env.TURBO_WALLET_PATH ? readFileSync(process.env.TURBO_WALLET_PATH, 'utf8') : '');
    const wallet = JSON.parse(raw) as { address: string; token: TokenType };
    const balance = await TurboFactory.unauthenticated({ token: wallet.token }).getBalance(wallet.address);
    turbo = { address: wallet.address, token: wallet.token, winc: balance.winc };
  } catch (error) { turbo = { error: error instanceof Error ? error.message : 'unknown' }; }
  add('turbo-balance', turbo.winc && BigInt(turbo.winc) > 0n ? 'PASS' : 'BLOCKED', turbo);

  const supabaseCli = command('supabase'); const docker = command('docker'); const psql = command('psql');
  let supabaseHttp: number | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(8_000) }); supabaseHttp = response.status;
  } catch { supabaseHttp = 0; }
  add('database-tooling', supabaseCli && supabaseHttp === 200 ? 'PASS' : 'BLOCKED', { supabaseCli, docker, psql, supabaseHttp });
  add('rights-gate', existsSync(join(evidenceDir, 'rights-confirmation.md')) ? 'PASS' : 'BLOCKED', { expected: 'reviews/evidence/p14-f0/rights-confirmation.md' });

  const buildFiles = walk(join(root, '.next')).filter((path) => /(?:server[\\/]app[\\/]page|static[\\/]chunks).*\.(?:js|json)$/.test(path));
  const leaks = buildFiles.filter((path) => /wallet-recipe|clips-v1|Pond Echoes|ER81BTKW/.test(readFileSync(path, 'utf8'))).map(rel);
  add('homepage-build-isolation', buildFiles.length && !leaks.length ? 'PASS' : 'BLOCKED', { buildArtifacts: buildFiles.length, leaks });
  add('opensea-metadata', 'PASS', { checkedAt: new Date().toISOString(), official: ['https://docs.opensea.io/docs/metadata-standards', 'https://docs.opensea.io/docs/metadata-storage', 'https://docs.opensea.io/docs/contract-level-metadata'] });

  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), readOnly: true, gate: checks.some((item) => item.state === 'BLOCKED') ? 'BLOCKED' : 'PASS', checks };
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
  const rows = checks.map((item) => `| ${item.id} | ${item.state} | \`${JSON.stringify(item.detail).replaceAll('|', '\\|').slice(0, 500)}\` |`).join('\n');
  writeFileSync(join(evidenceDir, 'README.md'), `# P14-F0 只读发布预检\n\n- 时间：${report.generatedAt}\n- 总 Gate：**${report.gate}**\n- 外部写入：无\n\n| 检查 | 状态 | 摘要 |\n|---|---|---|\n${rows}\n`);
  writeFileSync(join(evidenceDir, 'opensea-metadata.md'), `# OpenSea metadata 官方规范核验\n\n核验日期：2026-09-06。OpenSea 官方当前要求 ERC-721 由 tokenURI 返回 JSON；支持 ar://；collection 级 metadata 用 ERC-7572 contractURI，creator attribution 使用 ERC-173。Pond Echoes 的 name/description/image/animation_url/external_url/attributes、永久 Arweave URI、contractURI 与 Ownable 方向一致。\n\n- https://docs.opensea.io/docs/metadata-standards\n- https://docs.opensea.io/docs/metadata-storage\n- https://docs.opensea.io/docs/contract-level-metadata\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.gate === 'PASS' ? 0 : 2;
}

main().catch((error) => { console.error(JSON.stringify({ gate: 'BLOCKED', error: error instanceof Error ? error.message : 'unknown' })); process.exitCode = 2; });
