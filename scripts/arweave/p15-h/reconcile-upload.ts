// P15-H3：外部查询拿到候选 txid 后，以双网关完整读回解除 unknown；绝不再次上传。
import '../../_env';
import { isSoundKey } from '../../../src/lib/sound-set';
import { fullReadbackQuorum, hasFullReadbackQuorum } from './full-readback';
import {
  freezeVerifiedManifest, freezeVerifiedSound, manifestAsset,
  readCurrentRegistry, soundAssets,
} from './sound-set-assets';
import {
  blockInterruptedH3Uploads, loadH3Ledger, readH3Entry, updateH3Entry,
  withH3UploadLock, type H3Kind,
} from './upload-state';

const TX_ID = /^[A-Za-z0-9_-]{43}$/;

async function main(): Promise<void> {
  const [reference, txId, ...extra] = process.argv.slice(2);
  const [kind, key] = reference?.split(':') ?? [];
  if (extra.length || !['sound', 'manifest'].includes(kind) || !key || !TX_ID.test(txId ?? '')) {
    throw new Error('用法：<sound:key|manifest:current-33-v1> <43位候选txid>');
  }
  await withH3UploadLock(async () => {
    const ledger = loadH3Ledger();
    blockInterruptedH3Uploads(ledger);
    const entry = readH3Entry(ledger, kind as H3Kind, key);
    if (entry?.state !== 'upload_result_unknown') throw new Error(`${reference} 不是 unknown 条目`);
    const registry = readCurrentRegistry();
    const asset = kind === 'sound'
      ? soundAssets(registry).find((candidate) => candidate.key === key)
      : manifestAsset(registry, ledger);
    if (!asset || asset.sha256 !== entry.contentSha256 || asset.buffer.length !== entry.bytes) {
      throw new Error(`${reference} 与本地冻结身份不一致`);
    }
    const evidence = await fullReadbackQuorum(txId, asset);
    if (!hasFullReadbackQuorum(evidence)) throw new Error('候选 txid 未达到双网关完整 readback quorum');
    updateH3Entry(ledger, entry, {
      state: 'verified', arweaveTxId: txId, verifiedAt: new Date().toISOString(),
      gatewayEvidence: evidence, lastError: null,
    });
    if (kind === 'sound') {
      if (!isSoundKey(key)) throw new Error(`非法声音键：${key}`);
      freezeVerifiedSound(registry, key, txId);
    } else freezeVerifiedManifest(registry, asset, txId);
    console.log(`✅ ${reference} 已通过候选 txid 对账并解除熔断：${txId}`);
  });
}

main().catch((error) => { console.error('[P15-H3 reconcile] 失败：', error); process.exit(1); });
