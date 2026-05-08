/**
 * 合奏相关共享类型 — Track A / Track B / Track C 共用
 * 改这个文件前所有线必须对齐
 *
 * 冻结的 API 端点命名：
 *   GET  /api/sounds                → SoundsListResponse
 *   POST /api/score/save            → SaveScoreResponse
 *   GET  /api/scores/[id]/preview   → ScorePreviewResponse
 *   GET  /api/me/scores             → MyScoresResponse
 */

import type { Track } from './tracks';

/** sounds 表的一行 — 26 个键盘音效之一 */
export interface Sound {
  id: string;
  /** tokenId 109-134 */
  token_id: number;
  /** 音效名称（如 "Kick", "Snare", "Bell"） */
  name: string;
  /** 本地路径或 Arweave URL */
  audio_url: string;
  /** 时长（毫秒） */
  duration_ms: number;
  /** 分类 */
  category: 'percussion' | 'melody' | 'effect';
  /** 对应键盘键（a-z） */
  key: string;
}

/** 单次按键事件 */
export interface KeyEvent {
  /** 按的键（a-z） */
  key: string;
  /** 距离录制开始的时间（毫秒） */
  time: number;
  /** 按键持续时间（毫秒） */
  duration: number;
}

/** pending_scores 表的一行 — 合奏草稿（状态机表，禁止 DELETE） */
export interface PendingScore {
  id: string;
  user_id: string;
  track_id: string;
  /** 按键事件序列 */
  events_data: KeyEvent[];
  /** draft = 有效草稿，expired = 已过期（不删除，标记状态） */
  status: 'draft' | 'expired';
  created_at: string;
  updated_at: string;
  /** 24h 后过期 */
  expires_at: string;
}

/** API 响应：GET /api/sounds */
export interface SoundsListResponse {
  sounds: Sound[];
}

/** API 请求体：POST /api/score/save */
export interface SaveScoreRequest {
  trackId: string;
  eventsData: KeyEvent[];
  /** 创作时间（ISO 字符串），服务端按此计算 24h TTL，超过 24h 拒绝 */
  createdAt: string;
}

/** API 响应：POST /api/score/save */
export interface SaveScoreResponse {
  result: 'ok';
  scoreId: string;
  expiresAt: string;
}

/** API 响应：GET /api/scores/[id]/preview */
export interface ScorePreviewResponse {
  score: {
    trackId: string;
    eventsData: KeyEvent[];
    expiresAt: string;
  };
}

/** API 响应：GET /api/me/scores
 *
 *  B8 简化（2026-05-07）：草稿入队后立刻从此端点消失（route.ts 用 NOT IN queue 过滤），
 *  转去"我的唱片"显示。所以本响应里的草稿都是"未铸造的活草稿"。
 *  Phase 2 加 track + events 让"我的创作"里的草稿可以前端 inline 播放
 *  （PlayerProvider 播底曲 + useEventsPlayback 按 events.time 触发音效）。
 */
export interface MyScoresResponse {
  scores: {
    id: string;
    /** 草稿绑定的底曲（DraftCard ▶ 按钮 toggle 用） */
    track: Track;
    /** 按键事件序列（useEventsPlayback 按时间触发音效用） */
    events: KeyEvent[];
    /** 该用户对同一曲目的第几次创作 */
    seq: number;
    /** 音符数量（= events.length，前端方便用） */
    eventCount: number;
    createdAt: string;
    expiresAt: string;
  }[];
}

// ─────────────────────────────────────────────────
// Phase 3 S5 — ScoreNFT 铸造队列 + metadata
// ─────────────────────────────────────────────────

/** score_nft_queue 5 步状态机 — 单一来源，运维 + 类型都从这里读 */
export const SCORE_STATUSES = [
  'pending',
  'uploading_events',
  'minting_onchain',
  'uploading_metadata',
  'setting_uri',
  'success',
  'failed',
] as const;

export type ScoreMintStatus = (typeof SCORE_STATUSES)[number];

/** 非终态：用于监控积压 */
export const SCORE_ACTIVE_STATUSES = SCORE_STATUSES.filter(
  (s) => s !== 'success' && s !== 'failed',
);

/** score_nft_queue 表的一行 */
export interface ScoreMintQueueRow {
  id: string;
  user_id: string;
  pending_score_id: string;
  track_id: string;
  cover_ar_tx_id: string;
  events_ar_tx_id: string | null;
  metadata_ar_tx_id: string | null;
  token_id: number | null;
  token_uri: string | null;
  status: ScoreMintStatus;
  retry_count: number;
  last_error: string | null;
  tx_hash: string | null;
  /** Phase 6 A1: setTokenURI tx hash（拆步，发后存 hash → 下次 cron 查 receipt）*/
  uri_tx_hash: string | null;
  /** Phase 6 A1: durable lease — claim 时分配的 owner uuid */
  locked_by: string | null;
  /** Phase 6 A1: durable lease 过期时间，过期后其他 cron 可重新 claim */
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** OpenSea ERC-721 metadata 标准
 *  S5 cron 在 uploading_metadata 阶段生成并上传 Arweave */
export interface ScoreMetadata {
  name: string;
  description: string;
  /** ar:// 或 https://arweave.net/... 指向封面 */
  image: string;
  /** ripples.app/score/[tokenId] */
  external_url?: string;
  /** decoder.html + URL 参数 = 网页唱片机 */
  animation_url: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * 个人页用：用户的 ScoreNFT（B8 重设：包含未上链的中间态草稿）
 *
 * 用户感知"我的唱片" = 数据库中所有 queue row，与链上完成度脱钩。
 * 链上字段（tokenId / txHash）是 progressive enhancement：
 *   - 已上链 → 字段补齐，详情页可显示 Etherscan / OpenSea link，可点击进详情页
 *   - 未上链 → 字段为 undefined，卡片显示"上链中"，暂不可点击（Phase 3 路由双兼容后启用）
 */
export interface OwnedScoreNFT {
  /** 路由用 ID — 已上链=tokenId 字符串，未上链=queue row UUID */
  id: string;
  /** queue row UUID — React key 必用此字段（始终非空，与 tokenId 是否回写无关）*/
  queueId: string;
  /** 链上 tokenId — 已上链才有 */
  tokenId?: number;
  trackTitle: string;
  coverUrl: string;
  eventCount: number;
  /** 链上 tx hash — 已上链才有 */
  txHash?: string;
  /** 入队时间（已上链时近似铸造时间）*/
  mintedAt: string;
}

/** API 响应：GET /api/me/score-nfts */
export interface MyScoreNFTsResponse {
  scoreNfts: OwnedScoreNFT[];
}

/** API 请求体：POST /api/mint/score */
export interface MintScoreRequest {
  pendingScoreId: string;
}

/** API 响应：POST /api/mint/score */
export interface MintScoreResponse {
  queueId: string;
  coverArTxId: string;
  coverUrl: string;
}
