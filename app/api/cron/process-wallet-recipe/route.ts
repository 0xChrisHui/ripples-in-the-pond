import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/src/lib/auth/cron-auth';
import { sendAlert } from '@/src/lib/alerts/resend';
import { supabaseAdmin } from '@/src/lib/supabase';
import { CHAIN_ID_NUM } from '@/src/lib/chain/chain-config';
import { SCORE_NFT_ADDRESS } from '@/src/lib/chain/contracts';
import { getWalletRecipeAddress, getWalletRecipeMode,
  getWalletRecipePermanentConfig } from '@/src/lib/chain/wallet-recipe-contract';
import { decideWalletRecipeRuntime, WALLET_RECIPE_CLAIM_DEADLINE_MS,
  WALLET_RECIPE_RESPONSE_DEADLINE_MS,
  matchesRuntimeIdentity } from '@/src/features/wallet-recipe/pipeline-policy';
import { discoverWalletRecipes, type DiscoveryResult } from './discover';
import { assertPermanentConfig, preflightPermanentInputs,
  stepPrepareMedia } from './steps-media';
import { stepUploadMetadata } from './steps-metadata';
import { stepMintOnchain } from './steps-mint';
import { asPipelineError, pipelineFailureHttpStatus, type PipelineStepResult,
  type WalletRecipeQueueRow } from './shared';

export const runtime = 'nodejs';
async function markCronSuccess(): Promise<void> {
  const now = new Date().toISOString();
  const scoreContract = SCORE_NFT_ADDRESS.toLowerCase();
  const { error } = await supabaseAdmin.from('system_kv').upsert({
    key: `p14:last-cron-success:${CHAIN_ID_NUM}:${scoreContract}`,
    value: now,
    updated_at: now,
  }, { onConflict: 'key' });
  if (error) throw error;
}

async function successfulResponse(body: Record<string, unknown>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      markCronSuccess(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('lastCronSuccessAt 写入超时')), 3_000);
      }),
    ]);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ...body,
      result: 'safe_retry',
      message: `lastCronSuccessAt 写入失败：${message}`,
    }, { status: 503 });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function finishJob(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  result: PipelineStepResult,
): Promise<WalletRecipeQueueRow | null> {
  const { data, error } = await supabaseAdmin.rpc('finish_wallet_recipe_job', {
    p_id: row.id,
    p_owner: leaseOwner,
    p_expected_status: row.status,
    p_next_status: result.status,
    p_failure_kind: result.failureKind ?? null,
    p_last_error: result.failureKind ? result.detail : null,
  });
  if (error) throw error;
  return (data?.[0] as WalletRecipeQueueRow | undefined) ?? null;
}

async function alertOnce(row: WalletRecipeQueueRow, message: string): Promise<void> {
  if (row.alerted_at) return;
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin.from('wallet_recipe_queue')
    .update({ alerted_at: now }).eq('id', row.id).is('alerted_at', null)
    .select('id').maybeSingle();
  if (!data) return;
  void sendAlert({
    subject: 'wallet_recipe_queue 需要人工处理',
    body: [
      `queueId: ${row.id}`,
      `origin: ${row.origin_wallet}`,
      `sourceScoreTokenId: ${row.source_score_token_id}`,
      `txHash: ${row.tx_hash ?? 'unknown'}`,
      `error: ${message.slice(0, 1000)}`,
    ].join('\n'),
  });
}

async function runCurrentStep(
  row: WalletRecipeQueueRow,
  leaseOwner: string,
  deadlineAt: number,
): Promise<PipelineStepResult> {
  const config = getWalletRecipePermanentConfig();
  const contract = getWalletRecipeAddress();
  if (!config || !contract) {
    return { status: 'manual_review', detail: '永久配置或 P14 合约缺失', failureKind: 'permanent_input' };
  }
  const requireP14Contract = row.status !== 'pending' && row.status !== 'preparing_media';
  if (!matchesRuntimeIdentity({
    jobChainId: row.chain_id,
    runtimeChainId: CHAIN_ID_NUM,
    jobScoreContract: row.source_score_contract,
    runtimeScoreContract: SCORE_NFT_ADDRESS,
    jobP14Contract: row.p14_contract,
    runtimeP14Contract: contract,
    requireP14Contract,
  })) {
    return { status: 'manual_review', detail: '队列与运行网络/合约身份不一致', failureKind: 'permanent_input' };
  }
  switch (row.status) {
    case 'pending':
      return { status: 'preparing_media', detail: 'job_started' };
    case 'preparing_media':
      return stepPrepareMedia(row, leaseOwner, config, contract);
    case 'uploading_metadata':
      return stepUploadMetadata(row, leaseOwner, deadlineAt);
    case 'minting_onchain':
    case 'confirming_onchain':
      return stepMintOnchain(row, leaseOwner, contract, deadlineAt);
    default:
      return { status: 'manual_review', detail: `不可处理状态：${row.status}`, failureKind: 'manual_review' };
  }
}

/** 每次只发现一小批事件，并只推进一个已 claim 任务的当前一步。 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const stepDeadlineAt = startedAt + WALLET_RECIPE_RESPONSE_DEADLINE_MS - 5_000;
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '无效的 secret' }, { status: 401 });
  }

  const modeConfig = getWalletRecipeMode();
  const permanentConfig = getWalletRecipePermanentConfig();
  let contract = null;
  try {
    contract = getWalletRecipeAddress();
    if (permanentConfig) assertPermanentConfig(permanentConfig);
  } catch {
    contract = null;
  }
  const decision = decideWalletRecipeRuntime({
    mode: modeConfig.mode,
    modeConfigured: modeConfig.configured,
    hasPermanentConfig: Boolean(permanentConfig),
    hasContract: Boolean(contract),
  });
  if (decision.effectiveMode === 'off') {
    return NextResponse.json({
      result: decision.reason === 'permanent_input' ? 'permanent_input' : 'disabled',
      mode: 'off',
      requestedMode: decision.requestedMode,
      discovered: 0,
      processed: 0,
    }, { status: decision.reason === 'disabled' ? 200 : 500 });
  }

  if (decision.effectiveMode === 'live' && permanentConfig) {
    try {
      await preflightPermanentInputs(permanentConfig);
    } catch (error) {
      const failure = asPipelineError(error);
      return NextResponse.json({
        result: failure.failureKind,
        mode: failure.failureKind === 'permanent_input' ? 'off' : 'live',
        requestedMode: 'live',
        discovered: 0,
        processed: 0,
        message: failure.message,
      }, { status: pipelineFailureHttpStatus(failure.failureKind) });
    }
  }

  let discovery: DiscoveryResult;
  try {
    discovery = await discoverWalletRecipes(
      startedAt + WALLET_RECIPE_CLAIM_DEADLINE_MS - 7_000,
    );
  } catch (error) {
    const failure = asPipelineError(error);
    return NextResponse.json({
      result: failure.failureKind,
      mode: decision.effectiveMode,
      discovered: 0,
      processed: 0,
      message: failure.message,
    }, { status: pipelineFailureHttpStatus(failure.failureKind) });
  }
  if (decision.effectiveMode === 'observe') {
    return successfulResponse({ result: 'ok', mode: 'observe', processed: 0, ...discovery });
  }
  if (Date.now() - startedAt >= WALLET_RECIPE_CLAIM_DEADLINE_MS) {
    return successfulResponse({ result: 'deadline', mode: 'live', processed: 0, ...discovery });
  }

  const leaseOwner = randomUUID();
  const { data, error } = await supabaseAdmin.rpc('claim_wallet_recipe_job', {
    p_owner: leaseOwner,
    p_lease_minutes: 5,
  });
  if (error) {
    return NextResponse.json({
      result: 'safe_retry', mode: 'live', processed: 0, message: error.message, ...discovery,
    }, { status: 503 });
  }
  const row = (data?.[0] ?? null) as WalletRecipeQueueRow | null;
  if (!row) {
    return successfulResponse({ result: 'ok', mode: 'live', processed: 0, ...discovery });
  }

  try {
    if (Date.now() >= stepDeadlineAt - 12_000) {
      const delayed = await finishJob(row, leaseOwner, {
        status: row.status,
        detail: 'response_deadline',
        failureKind: 'transient',
      });
      return successfulResponse({
        result: 'deadline', mode: 'live', processed: 0,
        queueId: row.id, status: delayed?.status ?? row.status, ...discovery,
      });
    }
    const step = await runCurrentStep(
      row,
      leaseOwner,
      stepDeadlineAt,
    );
    const finished = await finishJob(row, leaseOwner, step);
    if (finished?.status === 'manual_review') await alertOnce(finished, step.detail);
    const result = finished?.status === 'manual_review'
      ? 'manual_review'
      : Date.now() >= stepDeadlineAt
        || step.detail === 'response_deadline' ? 'deadline' : 'ok';
    const body = {
      result,
      mode: 'live', processed: 1, queueId: row.id,
      status: finished?.status ?? step.status, detail: step.detail,
      ...discovery,
    };
    return result === 'manual_review'
      ? NextResponse.json(body, { status: 500 })
      : successfulResponse(body);
  } catch (error) {
    const failure = asPipelineError(error);
    const targetStatus = failure.failureKind === 'safe_retry'
      ? 'safe_retry'
      : failure.failureKind === 'transient' ? row.status : 'manual_review';
    const finished = await finishJob(row, leaseOwner, {
      status: targetStatus,
      detail: failure.message,
      failureKind: failure.failureKind,
    });
    if (finished?.status === 'manual_review') await alertOnce(finished, failure.message);
    return NextResponse.json({
      result: failure.failureKind,
      mode: 'live',
      processed: 1,
      queueId: row.id,
      status: finished?.status ?? targetStatus,
      message: failure.message,
      ...discovery,
    }, { status: pipelineFailureHttpStatus(failure.failureKind) });
  }
}
