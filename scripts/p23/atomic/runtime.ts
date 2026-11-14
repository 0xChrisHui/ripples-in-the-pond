import * as viem from 'viem';
import { loadOfflineModule } from '../../p14-j/offline-module';
import { memoryDb, scoreRow } from '../../p24/continuation/fixture';
import { safeBroadcast, type BroadcastJob, type Marker } from '../../../src/lib/chain/broadcast/protocol';
import type { ScoreMintQueueRow, ScoreMintStatus } from '../../../src/types/score-mint';
import * as wait from '../../../src/lib/permanent-core/permanent-wait';
import { createHash } from 'node:crypto';

const root = 'app/api/cron/process-score-queue/';
const issuer = '0x0000000000000000000000000000000000000023';
const nft = '0x0000000000000000000000000000000000000002';
const orchestrator = '0x0000000000000000000000000000000000000003';
const recipient = '0x0000000000000000000000000000000000000001';
type Step = (row: ScoreMintQueueRow, owner: string, deadline: number) => Promise<ScoreMintStatus>;
export async function runtime() {
  let time = 1_000, marker: Marker | null = null;
  let transaction: { to: string; input: viem.Hex } | null = null;
  const control = { ready: true, conflict: false, replyLost: false, receiptPending: false, revert: false,
    wrongUri: false, wrongId: false, failHashWrite: false, signingDelay: 0,
    broadcasts: 0, readinessChecks: 0, simulateCount: 0,
    advance(ms: number) { time += ms; } };
  const row = { ...scoreRow('atomic-order'), status: 'minting_onchain', issuance_mode: 'atomic',
    locked_by: 'lease', lease_expires_at: new Date(1_000_000).toISOString(),
    package_ar_tx_id: 'package', package_sha256: 'hash', package_bytes: 10, package_upload_state: 'verified',
  } as ScoreMintQueueRow;
  const db = memoryDb([row], () => time);
  await db.from('system_kv').insert({ key: 'score-atomic:enabled', value: 'true' });
  const current = () => db.records.get(row.id)!;
  const globals = { Date: class extends Date {
    static now() { return time; } constructor(value?: string | number) { super(value ?? time); }
  }, process: { env: { ATOMIC_SCORE_ISSUER_ADDRESS: issuer, NEXT_PUBLIC_APP_URL: 'https://pond-ripple.xyz' } } };
  const admin = { ...db, rpc: async (name: string, p: Record<string, unknown>) => {
    if (name === 'reserve_atomic_score') {
      if (control.conflict) return { data: false, error: null };
      Object.assign(current(), { atomic_issuer: p.p_issuer, atomic_recipient: p.p_recipient, expected_token_id: p.p_expected_token_id });
      return { data: true, error: null };
    }
    throw Error('未允许的 RPC');
  } };
  const common = { viem, '@/src/lib/supabase': { supabaseAdmin: admin } };
  const shared = loadOfflineModule<typeof import('../../../app/api/cron/process-score-queue/atomic/shared')>(root + 'atomic/shared.ts', common, globals);
  const client = {
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'scoreNft') return nft;
      if (functionName === 'orchestrator') return orchestrator;
      if (functionName === 'tokenIdByOrderId') return control.wrongId ? 13n : 12n;
      if (functionName === 'tokenURI') return control.wrongUri ? 'ar://wrong' : shared.tokenUri(current());
      throw Error('未允许的读取');
    },
    simulateContract: async () => { control.simulateCount++; return { result: 12n }; },
    getTransaction: async () => transaction,
    getTransactionReceipt: async () => {
      if (control.receiptPending) throw Error('pending');
      return { status: control.revert ? 'reverted' : 'success', blockNumber: 100n, logs: [{ address: issuer,
        topics: [viem.keccak256(viem.stringToHex('ScoreIssued(bytes32,address,uint256,bytes32)')),
          shared.orderId(current()), viem.pad(recipient), viem.toHex(12n, { size: 32 })],
        data: viem.keccak256(viem.stringToHex(shared.tokenUri(current()))),
      }] };
    },
  };
  const imports = { ...common, './shared': shared,
    '@/src/lib/chain/public-client': { publicClient: client },
    '@/src/lib/chain/contracts': { SCORE_NFT_ADDRESS: nft, SCORE_NFT_ABI: [], ORCHESTRATOR_ADDRESS: orchestrator },
    '@/src/lib/chain/operator-wallet': { operatorWalletClient: { account: { address: recipient }, chain: {} } },
    '@/src/lib/chain/broadcast/operator': { broadcastOperator: (_: string, job: BroadcastJob, deadline: number) => safeBroadcast({
      now: () => time, renew: async () => true, read: async () => marker, write: async value => { marker = value; },
      confirmed: async () => !control.receiptPending, nonceClear: async () => true,
      wait: async () => undefined, alarm: async () => undefined,
    }, job, deadline) },
    '@/src/lib/chain/broadcast/guarded-wallet': { guardedWallet: (_a: unknown, _c: unknown, guard: (h: viem.Hex) => Promise<void>) => ({
      writeContract: async ({ address, args }: { address: string; args: ReturnType<typeof shared.issueArgs> }) => {
        const input = viem.encodeFunctionData({ abi: shared.ATOMIC_ABI, functionName: 'mintScoreWithURI', args });
        const hash = viem.keccak256(input);
        time += control.signingDelay;
        if (control.failHashWrite) db.failWrites(true);
        await guard(hash);
        if (current().tx_hash !== hash) throw Error('原始交易发出前必须已保存哈希');
        transaction = { to: address, input }; control.broadcasts++;
        if (control.replyLost) throw Error('RPC 返回丢失');
        return hash;
      },
    }) },
  };
  const confirm = loadOfflineModule(root + 'atomic/confirm.ts', imports, globals);
  const send = loadOfflineModule(root + 'atomic/send.ts', imports, globals);
  const step = loadOfflineModule<{ stepAtomicIssue: Step }>(root + 'atomic/step.ts', {
    ...imports, './send': send, './confirm': confirm, './readiness': { verifyIssuanceResources: async () => {
      control.readinessChecks++;
      if (!control.ready) throw new wait.PermanentResourcePendingError('arweave.net 404');
    } },
  }, globals);
  const uploads: object[] = [];
  const upload = loadOfflineModule<{ stepUploadMetadata: Step }>(root + 'steps-upload.ts', {
    ...common, '@/src/lib/arweave': { resolveArUrl: (id: string) => `https://arweave.net/${id}`,
      uploadBuffer: async (buffer: Buffer) => { uploads.push(JSON.parse(buffer.toString())); return { txId: 'm'.repeat(43) }; } },
    '@/src/lib/permanent-core/attestation': { attestPermanentResource: async () => new Uint8Array() },
    '@/src/lib/score-package': { sha256Hex: async (b: Buffer) => createHash('sha256').update(b).digest('hex') },
    '@/src/lib/sound-set': {},
    './_shared': { UPLOAD_COLUMNS: { metadata: { state: 'metadata_upload_state', tx: 'metadata_ar_tx_id', sha: 'metadata_sha256', bytes: 'metadata_bytes', mime: 'metadata_mime' } },
      writeUploadState: async (_id: string, _owner: string, _kind: string, identity: { sha256: string; bytes: number; mime: string }, state: string, tx: string) => {
        Object.assign(current(), { metadata_upload_state: state, metadata_ar_tx_id: tx ?? null,
          metadata_sha256: identity.sha256, metadata_bytes: identity.bytes, metadata_mime: identity.mime }); return true;
      } },
  }, globals);
  const tick = async (budget = 25_000) => {
    const value = { ...current() };
    const next = value.status === 'uploading_metadata'
      ? await upload.stepUploadMetadata(value, 'lease', time + budget)
      : await step.stepAtomicIssue(value, 'lease', time + budget);
    current().status = next;
    return next;
  };
  return { current, tick, control, db, uploads, globals, walletMarker: () => marker };
}
