import 'server-only';
import { supabaseAdmin } from '@/src/lib/supabase';
import { ARWEAVE_GATEWAYS, resolveArUrl } from '@/src/lib/arweave';
import { fallbackFromChain } from './score-fallback';
import type { KeyEvent } from '@/src/types/jam';

/**
 * /score/[tokenId] 页面数据源
 * 主路径：mint_events.score_data（DB 自包含）
 * 灾备路径（Phase 6 A5）：DB miss 时走链上 tokenURI → Arweave metadata → events
 *   ARCH 决策 6 承诺"4 层冗余"，Phase 6 才把第 4 层（链上 + Arweave fallback）真接通
 *   实施在 ./score-fallback.ts（拆出避免本文件超 200 行）
 */

export interface ScorePageData {
  tokenId: number;
  trackTitle: string;
  creatorAddress: string;
  events: KeyEvent[];
  coverUrl: string;
  txHash: string;
  decoderUrl: string;
  etherscanUrl: string;
  mintedAt: string;
  eventCount: number;
}

/** 按 tokenId 查 ScoreNFT 回放所需全部数据 */
export async function getScoreByTokenId(
  tokenId: number,
): Promise<ScorePageData | null> {
  // 主路径：DB 直查 mint_events
  const { data: mintEvent } = await supabaseAdmin
    .from('mint_events')
    .select('*')
    .eq('score_nft_token_id', tokenId)
    .single();

  if (!mintEvent) return fallbackFromChain(tokenId);

  // 并行查 queue（封面 + events txId）、track、user
  const [queueRes, trackRes, userRes] = await Promise.all([
    supabaseAdmin
      .from('score_nft_queue')
      .select('cover_ar_tx_id, events_ar_tx_id')
      .eq('id', mintEvent.score_queue_id)
      .single(),
    supabaseAdmin
      .from('tracks')
      .select('title, arweave_url')
      .eq('id', mintEvent.track_id)
      .single(),
    supabaseAdmin
      .from('users')
      .select('evm_address')
      .eq('id', mintEvent.user_id)
      .single(),
  ]);

  const queue = queueRes.data;
  const track = trackRes.data;
  const user = userRes.data;
  if (!queue || !track || !user) return null;

  const events = (mintEvent.score_data as KeyEvent[]) ?? [];
  const coverUrl = resolveArUrl(queue.cover_ar_tx_id);

  return {
    tokenId,
    trackTitle: track.title,
    creatorAddress: user.evm_address,
    events,
    coverUrl,
    txHash: mintEvent.tx_hash,
    decoderUrl: buildDecoderUrl(queue.events_ar_tx_id, track.arweave_url),
    etherscanUrl: `https://sepolia-optimism.etherscan.io/tx/${mintEvent.tx_hash}`,
    mintedAt: mintEvent.minted_at,
    eventCount: events.length,
  };
}

// 拼 Arweave decoder 完整 URL（iframe 使用）
function buildDecoderUrl(
  eventsArTxId: string | null,
  trackArweaveUrl: string | null,
): string {
  const decoderTxId = process.env.SCORE_DECODER_AR_TX_ID;
  const soundsMapTxId = process.env.SOUNDS_MAP_AR_TX_ID;
  if (!decoderTxId || !eventsArTxId || !soundsMapTxId) return '';

  // 底曲 ar:// 地址：缺失时返回空（页面不渲染播放器）
  if (!trackArweaveUrl) return '';
  const baseArUrl = trackArweaveUrl.replace(`${ARWEAVE_GATEWAYS[0]}/`, 'ar://');

  return (
    `${ARWEAVE_GATEWAYS[0]}/${decoderTxId}` +
    `?events=ar://${eventsArTxId}` +
    `&base=${encodeURIComponent(baseArUrl)}` +
    `&sounds=ar://${soundsMapTxId}`
  );
}

