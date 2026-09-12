import '../../_env';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  createPublicClient, decodeEventLog, getAddress, http, parseAbi, zeroAddress,
  type Hex,
} from 'viem';
import { optimism } from 'viem/chains';
import { parseClipManifestJsonV1 } from '@/src/lib/wallet-recipe/clip-manifest';
import { WALLET_RECIPE_GATEWAYS, WALLET_RECIPE_GATEWAY_QUORUM } from '@/src/lib/wallet-recipe/gateways';
import { parseWalletRecipeMetadataJsonV1 } from '@/src/lib/wallet-recipe/metadata-parser';
import { deriveRecipeV1, hashRecipeV1 } from '@/src/lib/wallet-recipe/recipe-v1';

const ABI = parseAbi([
  'function tokenURI(uint256) view returns (string)',
  'function tokenIdByOrigin(address) view returns (uint256)',
  'function originWalletOf(uint256) view returns (address)',
  'function ownerOf(uint256) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'event WalletRecipeMinted(address indexed origin, uint256 indexed tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);
const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && process.argv[index + 1], `缺少参数 ${name}`);
  return process.argv[index + 1];
};
const tokenId = BigInt(arg('--token-id'));
const origin = getAddress(arg('--origin'));
const mintTx = arg('--mint-tx').toLowerCase() as Hex;
const outputPath = resolve(arg('--out'));
assert(tokenId > 0n && /^0x[0-9a-f]{64}$/.test(mintTx), 'token-id 或 mint-tx 格式错误');
assert(process.env.NEXT_PUBLIC_CHAIN_ID === '10', '本工具只允许 OP Mainnet');

const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
const dbUrl = process.env.SERVER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(rpcUrl && dbUrl && dbKey, 'Production RPC/Supabase 环境不完整');
const p14 = getAddress(process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS ?? '');
const score = getAddress(process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS ?? '');
const chain = createPublicClient({ chain: optimism, transport: http(rpcUrl) });
const db = createClient(dbUrl, dbKey, { auth: { persistSession: false } });

type GatewayEvidence = { gateway: string; ok: boolean; bytes?: number; sha256?: string; error?: string };
type ObjectAudit = { label: string; txId: string; bytes: number; sha256: string; quorum: number; gateways: GatewayEvidence[] };
const arTx = (value: unknown, label: string, allowQuery = false) => {
  const pattern = allowQuery ? /^ar:\/\/([A-Za-z0-9_-]{43})(?:\?.*)?$/ : /^ar:\/\/([A-Za-z0-9_-]{43})$/;
  const match = typeof value === 'string' ? value.match(pattern) : null;
  assert(match, `${label} 不是冻结的 ar:// txid`);
  return match[1];
};
async function auditObject(label: string, txId: string, expected?: string): Promise<ObjectAudit & { data: Uint8Array }> {
  const results = await Promise.all(WALLET_RECIPE_GATEWAYS.map(async (gateway) => {
    try {
      const response = await fetch(`${gateway}/${txId}`, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) return { gateway, ok: false, error: `HTTP ${response.status}` };
      const data = new Uint8Array(await response.arrayBuffer());
      return { gateway, ok: true, bytes: data.length, sha256: sha256(data), data };
    } catch { return { gateway, ok: false, error: '请求失败或超时' }; }
  }));
  const groups = new Map<string, typeof results>();
  for (const item of results) if (item.ok && item.sha256) groups.set(item.sha256, [...(groups.get(item.sha256) ?? []), item]);
  const winner = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  assert(winner && winner[1].length >= WALLET_RECIPE_GATEWAY_QUORUM, `${label} 未达到双网关同字节 quorum`);
  assert(!expected || winner[0] === expected, `${label} 的永久字节偏离冻结 hash`);
  const data = winner[1][0].data;
  assert(data, `${label} 缺少可验证字节`);
  return { label, txId, bytes: data.length, sha256: winner[0], quorum: winner[1].length,
    gateways: results.map((item) => ({ gateway: item.gateway, ok: item.ok,
      ...(item.bytes === undefined ? {} : { bytes: item.bytes }),
      ...(item.sha256 === undefined ? {} : { sha256: item.sha256 }),
      ...(item.error === undefined ? {} : { error: item.error }) })), data };
}
const publicAudit = (audit: ObjectAudit & { data: Uint8Array }): ObjectAudit => ({
  label: audit.label, txId: audit.txId, bytes: audit.bytes, sha256: audit.sha256,
  quorum: audit.quorum, gateways: audit.gateways,
});
const one = <T>(data: T | null, error: unknown, label: string): T => {
  assert(!error && data, `${label} 缺失或不唯一`);
  return data;
};
function decodedEvents(receipt: Awaited<ReturnType<typeof chain.getTransactionReceipt>>) {
  return receipt.logs.filter((log) => log.address.toLowerCase() === p14.toLowerCase()).flatMap((log) => {
    try { return [decodeEventLog({ abi: ABI, data: log.data, topics: log.topics })]; } catch { return []; }
  });
}

async function main() {
  const [tokenUri, mappedToken, mappedOrigin, owner, totalSupply, receipt] = await Promise.all([
    chain.readContract({ address: p14, abi: ABI, functionName: 'tokenURI', args: [tokenId] }),
    chain.readContract({ address: p14, abi: ABI, functionName: 'tokenIdByOrigin', args: [origin] }),
    chain.readContract({ address: p14, abi: ABI, functionName: 'originWalletOf', args: [tokenId] }),
    chain.readContract({ address: p14, abi: ABI, functionName: 'ownerOf', args: [tokenId] }),
    chain.readContract({ address: p14, abi: ABI, functionName: 'totalSupply' }),
    chain.getTransactionReceipt({ hash: mintTx }),
  ]);
  assert(mappedToken === tokenId && mappedOrigin === origin, '链上 origin/token 双向映射不一致');
  assert(receipt.status === 'success' && receipt.to?.toLowerCase() === p14.toLowerCase(), 'P14 mint receipt 无效');
  const events = decodedEvents(receipt);
  assert(events.some((event) => event.eventName === 'WalletRecipeMinted'
    && event.args.origin === origin && event.args.tokenId === tokenId), 'receipt 缺少匹配的 WalletRecipeMinted');
  assert(events.some((event) => event.eventName === 'Transfer' && event.args.from === zeroAddress
    && event.args.to === origin && event.args.tokenId === tokenId), 'receipt 缺少匹配的 mint Transfer');

  const metadataTxId = arTx(tokenUri, '链上 tokenURI');
  const metadataFile = await auditObject('metadata', metadataTxId);
  const metadataJson = new TextDecoder().decode(metadataFile.data);
  const loose = JSON.parse(metadataJson) as Record<string, unknown>;
  const props = loose.properties as Record<string, unknown>;
  assert(props && typeof props === 'object', 'metadata.properties 缺失');
  const manifestTxId = arTx(props.clipManifest, 'metadata.clipManifest');
  const decoderTxId = arTx(loose.animation_url, 'metadata.animation_url', true);
  const imageTxId = arTx(loose.image, 'metadata.image');
  const manifestFile = await auditObject('manifest', manifestTxId);
  const manifest = parseClipManifestJsonV1(new TextDecoder().decode(manifestFile.data));
  const identity = { version: manifest.version, charset: manifest.charset, count: manifest.count, clips: manifest.clips };
  assert(sha256(JSON.stringify(identity)) === manifest.manifestSha256, 'manifest 自身身份 hash 不一致');
  const metadata = parseWalletRecipeMetadataJsonV1(metadataJson,
    { decoderTxId, clipManifestTxId: manifestTxId, clipManifest: manifest, imageTxId });
  const frozen = [
    ['manifest', manifestTxId, process.env.WALLET_RECIPE_CLIP_MANIFEST_V1_TX_ID],
    ['decoder', decoderTxId, process.env.WALLET_RECIPE_DECODER_V1_TX_ID],
    ['image', imageTxId, process.env.WALLET_RECIPE_IMAGE_V1_TX_ID],
  ];
  for (const [label, actual, configured] of frozen) assert(!configured || actual === configured, `${label} txid 偏离 Production 冻结值`);
  const [decoder, image] = await Promise.all([auditObject('decoder', decoderTxId), auditObject('image', imageTxId)]);
  const clips: ObjectAudit[] = [];
  for (let start = 0; start < manifest.clips.length; start += 6) {
    const batch = await Promise.all(manifest.clips.slice(start, start + 6).map(async (clip) => {
      assert(clip.arweaveTxId, `${clip.key}.mp3 缺少永久 txid`);
      const audit = await auditObject(`${clip.key}.mp3`, clip.arweaveTxId, clip.sha256);
      assert(audit.bytes === clip.bytes, `${clip.key}.mp3 字节数不一致`);
      return publicAudit(audit);
    }));
    clips.push(...batch);
  }

  const queueResult = await db.from('wallet_recipe_queue').select('*').eq('chain_id', 10)
    .ilike('p14_contract', p14).eq('token_id', tokenId.toString()).ilike('origin_wallet_key', origin).single();
  const queue = one(queueResult.data, queueResult.error, 'wallet_recipe_queue');
  assert(queue.status === 'success' && queue.tx_hash === mintTx && queue.token_uri === tokenUri, 'P14 DB 成功态与链不一致');
  assert(queue.metadata_ar_tx_id === metadataTxId && queue.metadata_sha256 === metadataFile.sha256, 'metadata 与 DB 不一致');
  const recipe = deriveRecipeV1(origin);
  assert(queue.recipe === recipe && queue.recipe_hash === hashRecipeV1(recipe).slice(2), 'recipe 与 DB 不一致');
  assert(metadata.properties.originWallet === origin && metadata.properties.recipe === recipe
    && metadata.properties.sourceScoreTokenId === queue.source_score_token_id, 'metadata 与 origin/Score source 不一致');
  assert(metadata.properties.clipManifestSha256 === manifest.manifestSha256, 'metadata 与 manifest hash 不一致');

  assert(queue.source_score_queue_id, 'P14 行缺少 source_score_queue_id');
  const [sourceQueueResult, chainEventResult, mintEventResult] = await Promise.all([
    db.from('score_nft_queue').select('id,token_id,tx_hash,status,user_id').eq('id', queue.source_score_queue_id).single(),
    db.from('chain_events').select('chain_id,contract,event_name,tx_hash,log_index,block_number,from_addr,to_addr,token_id')
      .eq('chain_id', 10).eq('contract', score.toLowerCase())
      .eq('tx_hash', queue.source_score_tx_hash).eq('log_index', queue.source_score_log_index).single(),
    db.from('mint_events').select('score_queue_id,score_nft_token_id,tx_hash,user_id')
      .eq('score_queue_id', queue.source_score_queue_id).single(),
  ]);
  const sourceQueue = one(sourceQueueResult.data, sourceQueueResult.error, 'score_nft_queue');
  const chainEvent = one(chainEventResult.data, chainEventResult.error, 'Score chain_event');
  const mintEvent = one(mintEventResult.data, mintEventResult.error, 'Score mint_event');
  assert(sourceQueue.status === 'success' && sourceQueue.token_id === queue.source_score_token_id
    && sourceQueue.tx_hash === queue.source_score_tx_hash, 'Score queue 与 P14 source 不一致');
  assert(chainEvent.event_name === 'Transfer' && chainEvent.from_addr.toLowerCase() === zeroAddress
    && getAddress(chainEvent.to_addr) === origin && chainEvent.token_id === queue.source_score_token_id
    && chainEvent.block_number === queue.source_score_block, 'Score chain_event 与 origin/source 不一致');
  assert(mintEvent.score_nft_token_id === queue.source_score_token_id
    && mintEvent.tx_hash === queue.source_score_tx_hash && mintEvent.user_id === sourceQueue.user_id, 'Score mint_event 不一致');
  const sourceReceipt = await chain.getTransactionReceipt({ hash: queue.source_score_tx_hash as Hex });
  const scoreMint = sourceReceipt.logs.some((log) => {
    if (log.address.toLowerCase() !== score.toLowerCase()) return false;
    try { const event = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
      return event.eventName === 'Transfer' && event.args.from === zeroAddress && event.args.to === origin
        && event.args.tokenId === BigInt(queue.source_score_token_id); } catch { return false; }
  });
  assert(sourceReceipt.status === 'success' && sourceReceipt.blockNumber === BigInt(queue.source_score_block) && scoreMint,
    'Score source receipt 与 DB 不一致');

  const report = { schemaVersion: 1, gate: 'PASS', generatedAt: new Date().toISOString(), chainId: 10,
    contracts: { p14, score }, token: { tokenId: tokenId.toString(), origin, owner, totalSupply: totalSupply.toString(), tokenUri },
    p14Receipt: { txHash: mintTx, blockNumber: receipt.blockNumber.toString(), status: receipt.status },
    scoreSource: { tokenId: queue.source_score_token_id, txHash: queue.source_score_tx_hash,
      blockNumber: queue.source_score_block, logIndex: queue.source_score_log_index, queueId: queue.source_score_queue_id },
    database: { queueId: queue.id, status: queue.status, metadataUploadState: queue.metadata_upload_state },
    permanent: { metadata: publicAudit(metadataFile), manifest: publicAudit(manifestFile),
      decoder: publicAudit(decoder), image: publicAudit(image), clips },
    consistency: { chain: true, database: true, metadata: true, scoreSource: true, gatewayQuorum: true, clipCount: clips.length } };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ gate: report.gate, tokenId: report.token.tokenId, origin, outputPath }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`审计失败：${message.replace(/https?:\/\/\S+/g, '[已隐藏 URL]')}`);
  process.exit(1);
});
