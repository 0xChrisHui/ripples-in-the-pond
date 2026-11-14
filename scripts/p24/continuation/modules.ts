import { createHash } from 'node:crypto';
import { keccak256, stringToHex } from 'viem';
import { loadOfflineModule } from '../../p14-j/offline-module';
import { memoryDb, scoreRow } from './fixture';
import { runScoreCycle } from '../../../src/lib/cron/score-cycle';
import * as batch from '../../../src/lib/cron/batch';
import * as wait from '../../../src/lib/permanent-core/permanent-wait';
import { safeBroadcast, type BroadcastJob, type Marker, type Hash } from '../../../src/lib/chain/broadcast/protocol';
import type { ScoreMintQueueRow, ScoreMintStatus } from '../../../src/types/score-mint';

type Step = (row: ScoreMintQueueRow, owner: string, deadline?: number) => Promise<ScoreMintStatus>;
type Reply = { status: number; body: { processed: number; orders: Array<{ steps: number }> } };

export function integration(count = 1) {
  let time = 1000, uuid = 0, marker: Marker | null = null;
  const db = memoryDb(Array.from({ length: count }, (_, i) => scoreRow(String(i + 1))), () => time);
  const uploads: string[] = [], sends: string[] = [];
  const assets = new Map<string, Buffer>();
  const receipts = new Set<Hash>();
  const control = { gatewayPending: false, uploadWriteLost: false, rpcReplyLost: false, receiptPending: false,
    readLost: false, advance(ms: number) { time += ms; } };
  const globals = { Date: class extends Date {
    static now() { return time; } constructor(value?: string | number) { super(value ?? time); }
  }, console: { log() {}, warn() {}, error() {} }, process: { env: { NEXT_PUBLIC_APP_URL: 'https://example.invalid' } } };
  const admin = { ...db, rpc: async (name: string, p: Record<string, unknown>) => {
    if (name === 'claim_score_queue_job') {
      const job = db.claim(String(p.p_owner));
      return { data: job ? [job.row] : [], error: null };
    }
    if (name !== 'write_score_upload_state') throw Error(`测试未允许 RPC：${name}`);
    if (control.uploadWriteLost && p.p_state === 'uploaded') return { data: false, error: null };
    const row = db.records.get(String(p.p_queue_id))!;
    if (row.locked_by !== p.p_lease_owner || Date.parse(row.lease_expires_at!) <= time) return { data: false, error: null };
    const kind = String(p.p_kind);
    Object.assign(row, { [`${kind}_upload_state`]: p.p_state, [`${kind}_sha256`]: p.p_content_sha256,
      [`${kind}_bytes`]: p.p_bytes, [`${kind}_mime`]: p.p_mime, [`${kind}_ar_tx_id`]: p.p_arweave_tx_id });
    return { data: true, error: null };
  } };
  const common: Record<string, unknown> = {
    '@/src/lib/supabase': { supabaseAdmin: admin },
    '@/src/lib/alerts/once': { notifyOnce: async () => true },
    '@/src/lib/permanent-core/permanent-wait': wait,
    '@/src/lib/chain/contracts': { SCORE_NFT_ADDRESS: '0x01', ORCHESTRATOR_ADDRESS: '0x02',
      SCORE_NFT_ABI: [], ORCHESTRATOR_ABI: [] },
  };
  const shared = loadOfflineModule('app/api/cron/process-score-queue/_shared.ts', common, globals);
  const upload = loadOfflineModule<{ stepUploadEvents: Step; stepUploadMetadata: Step }>(
    'app/api/cron/process-score-queue/steps-upload.ts', { ...common, './_shared': shared,
      '@/src/lib/arweave': { resolveArUrl: (id: string) => `ar://${id}`, uploadBuffer: async (bytes: Buffer) => {
        const txId = `upload-${uploads.length + 1}`; uploads.push(txId); assets.set(txId, bytes); return { txId };
      } },
      '@/src/lib/permanent-core/attestation': { attestPermanentResource: async ({ arTxId }: { arTxId: string }) => {
        if (control.gatewayPending) throw new wait.PermanentResourcePendingError('尚未同步');
        if (!assets.has(arTxId)) throw Error('不存在的测试资源');
      } },
      '@/src/lib/score-package': { sha256Hex: async (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex') },
      '@/src/lib/sound-set': { isSoundKey: (key: string) => key === 'a' },
    }, globals);
  const chainImports = { ...common, './_shared': shared, viem: { keccak256, stringToHex },
    '@/src/lib/chain/operator-wallet': { operatorWalletClient: { account: { address: '0x01' }, chain: {} },
      publicClient: { getTransactionReceipt: async ({ hash }: { hash: Hash }) => {
        if (control.receiptPending || !receipts.has(hash)) throw Error('尚未确认');
        return { status: 'success', logs: [{ address: '0x01', topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '0x0', '0x0', '0x0a'] }] };
      } } },
    '@/src/lib/chain/broadcast/guarded-wallet': { guardedWallet: (_a: unknown, _c: unknown, guard: (hash: Hash) => Promise<void>) => ({
      writeContract: async ({ functionName }: { functionName: string }) => {
        const hash = `0x${(sends.length + 1).toString(16).padStart(64, '0')}` as Hash;
        await guard(hash); sends.push(functionName); receipts.add(hash);
        if (control.rpcReplyLost) throw Error('RPC 返回丢失');
        return hash;
      },
    }) },
    '@/src/lib/chain/broadcast/operator': { broadcastOperator: (_a: string, job: BroadcastJob, deadline: number) => safeBroadcast({
      now: () => time, renew: async () => true, read: async () => marker,
      write: async next => { marker = next; }, confirmed: async hash => !control.receiptPending && receipts.has(hash),
      nonceClear: async () => true, wait: async () => { if (control.receiptPending) throw Error('回执等待超时'); },
      alarm: async () => undefined,
    }, job, deadline) },
  };
  const mint = loadOfflineModule<{ stepMintOnchain: Step }>('app/api/cron/process-score-queue/steps-mint.ts', chainImports, globals);
  const uri = loadOfflineModule<{ stepSetTokenUri: Step }>('app/api/cron/process-score-queue/steps-set-uri.ts', chainImports, globals);
  const processor = loadOfflineModule('app/api/cron/process-score-queue/process-order.ts', common, globals);
  const { GET } = loadOfflineModule<{ GET(req: unknown): Promise<Reply> }>('app/api/cron/process-score-queue/route.ts', {
    ...common, './process-order': processor, './steps-upload': upload, './steps-mint': mint, './steps-set-uri': uri,
    // 资源闭包和快照内容由 P15 专项覆盖；这里隔离其外部读取，检验路由衔接与真实上传/发送步骤。
    './steps-package': { stepPreparePackage: async (row: ScoreMintQueueRow) => {
      Object.assign(db.records.get(row.id)!, { package_ar_tx_id: 'package', package_sha256: 'digest',
        package_bytes: 12, package_upload_state: 'verified' }); return 'minting_onchain';
    } },
    './steps-finalize': { stepFinalizeSnapshot: async () => 'success' },
    '@/src/lib/auth/cron-auth': { verifyCronSecret: (req: unknown) => req === 'authorized' },
    '@/src/lib/cron/batch': batch,
    '@/src/lib/cron/score-cycle': { runScoreCycle: (options: Parameters<typeof runScoreCycle>[0]) => runScoreCycle({
      ...options, now: () => time, reload: job => control.readLost ? Promise.reject(Error('数据库读取失败')) : options.reload(job),
    }) },
    crypto: { randomUUID: () => `route-${++uuid}` },
    'next/server': { NextResponse: { json: (body: Reply['body'], options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
  }, globals);
  return { db, control, uploads, sends, tick: (authorized = true) => GET(authorized ? 'authorized' : 'denied') };
}
